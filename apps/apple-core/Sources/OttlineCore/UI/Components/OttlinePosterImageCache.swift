import CryptoKit
import Foundation
import SwiftUI
#if canImport(UIKit)
import UIKit
public typealias OttlinePlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
public typealias OttlinePlatformImage = NSImage
#endif

// MARK: - Shared 2-Tier (Memory + Disk) Poster Image Cache with In-Flight Deduplication

/// Thread-safe, extension-safe 2-tier image cache shared across iOS, iPadOS, Share Extension, and macOS.
/// - Tier 1: In-memory `NSCache` (synchronous 0ms lookup so tab switches and LazyVStack scroll never flash placeholders)
/// - Tier 2: Persistent disk cache in `Library/Caches/ottline-posters` (survives app restarts, auto-pruned at 100 MB)
/// - Deduplication: Concurrent requests for the same URL share a single network fetch.
public final class OttlinePosterImageCache: @unchecked Sendable {
    public static let shared = OttlinePosterImageCache()

    private let memoryCache: NSCache<NSString, OttlinePlatformImage>
    private let diskDirectory: URL
    private let session: URLSession
    private let inFlight = InFlightCoordinator()
    private let maxDiskBytes: Int64 = 100 * 1024 * 1024 // 100 MB
    private let trimLock = NSLock()
    private var writeCountSinceTrim = 0

    private actor InFlightCoordinator {
        private var tasks: [URL: Task<OttlinePlatformImage?, Never>] = [:]

        func run(for url: URL, operation: @escaping @Sendable () async -> OttlinePlatformImage?) async -> OttlinePlatformImage? {
            if let existing = tasks[url] {
                return await existing.value
            }
            let task = Task<OttlinePlatformImage?, Never> {
                await operation()
            }
            tasks[url] = task
            let result = await task.value
            tasks[url] = nil
            return result
        }
    }

    public init(
        cacheDirectory: URL? = nil,
        session: URLSession? = nil
    ) {
        let mem = NSCache<NSString, OttlinePlatformImage>()
        mem.countLimit = 240
        mem.totalCostLimit = 64 * 1024 * 1024 // 64 MB decoded bitmaps
        self.memoryCache = mem

        if let cacheDirectory {
            self.diskDirectory = cacheDirectory
        } else {
            let base = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
                ?? FileManager.default.temporaryDirectory
            self.diskDirectory = base.appendingPathComponent("ottline-posters", isDirectory: true)
        }
        try? FileManager.default.createDirectory(at: self.diskDirectory, withIntermediateDirectories: true)

        if let session {
            self.session = session
        } else {
            let config = URLSessionConfiguration.default
            config.urlCache = nil // Dedicated disk cache avoids double-storing image bytes
            config.timeoutIntervalForRequest = 15
            config.timeoutIntervalForResource = 25
            config.httpMaximumConnectionsPerHost = 8
            self.session = URLSession(configuration: config)
        }
    }

    /// Synchronous 0ms lookup from in-memory cache.
    public func cachedImage(for url: URL) -> OttlinePlatformImage? {
        memoryCache.object(forKey: url.absoluteString as NSString)
    }

    /// Synchronous lookup returning the first candidate URL already present in memory.
    public func cachedFirstAvailable(urls: [URL]) -> OttlinePlatformImage? {
        for url in urls {
            if let hit = cachedImage(for: url) {
                return hit
            }
        }
        return nil
    }

    /// Loads an image through Memory -> Disk -> Deduplicated Network.
    public func image(for url: URL) async -> OttlinePlatformImage? {
        if let hit = cachedImage(for: url) {
            return hit
        }

        return await inFlight.run(for: url) { [weak self] in
            guard let self else { return nil }
            if let hit = self.cachedImage(for: url) {
                return hit
            }

            // Tier 2: Persistent disk cache
            let diskPath = self.diskFileURL(for: url)
            if let diskData = try? Data(contentsOf: diskPath),
               let decoded = Self.decodeImage(from: diskData) {
                self.storeInMemory(decoded, for: url)
                try? FileManager.default.setAttributes([.modificationDate: Date()], ofItemAtPath: diskPath.path)
                return decoded
            }

            // Tier 3: Network fetch
            var req = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
            req.setValue("image/*", forHTTPHeaderField: "Accept")
            guard let (data, response) = try? await self.session.data(for: req) else {
                return nil
            }
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                return nil
            }
            guard !data.isEmpty, let decoded = Self.decodeImage(from: data) else {
                return nil
            }

            self.storeInMemory(decoded, for: url)
            self.writeToDisk(data, at: diskPath)
            return decoded
        }
    }

    /// Tries each candidate URL in priority order and returns the first successfully loaded image.
    public func loadFirstAvailable(urls: [URL]) async -> OttlinePlatformImage? {
        if let hit = cachedFirstAvailable(urls: urls) {
            return hit
        }
        for url in urls {
            if Task.isCancelled { return nil }
            if let img = await image(for: url) {
                return img
            }
        }
        return nil
    }

    public func clearCache() {
        memoryCache.removeAllObjects()
        let fm = FileManager.default
        if let files = try? fm.contentsOfDirectory(at: diskDirectory, includingPropertiesForKeys: nil) {
            for f in files {
                try? fm.removeItem(at: f)
            }
        }
    }

    // MARK: - Helpers

    private func storeInMemory(_ image: OttlinePlatformImage, for url: URL) {
        let cost = Self.estimatedByteCost(of: image)
        memoryCache.setObject(image, forKey: url.absoluteString as NSString, cost: cost)
    }

    private func diskFileURL(for url: URL) -> URL {
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        let hex = digest.map { String(format: "%02x", $0) }.joined()
        return diskDirectory.appendingPathComponent("\(hex).img", isDirectory: false)
    }

    private func writeToDisk(_ data: Data, at fileURL: URL) {
        try? FileManager.default.createDirectory(at: diskDirectory, withIntermediateDirectories: true)
        try? data.write(to: fileURL, options: .atomic)

        let shouldTrim: Bool = trimLock.withLock {
            writeCountSinceTrim += 1
            if writeCountSinceTrim >= 25 {
                writeCountSinceTrim = 0
                return true
            }
            return false
        }
        if shouldTrim {
            let dir = diskDirectory
            let limit = maxDiskBytes
            Task.detached(priority: .utility) {
                Self.trimDiskCache(directory: dir, maxBytes: limit)
            }
        }
    }

    private static func trimDiskCache(directory: URL, maxBytes: Int64) {
        let fm = FileManager.default
        let keys: [URLResourceKey] = [.contentModificationDateKey, .fileSizeKey]
        guard let urls = try? fm.contentsOfDirectory(at: directory, includingPropertiesForKeys: keys) else { return }

        var entries: [(url: URL, date: Date, size: Int64)] = []
        var totalSize: Int64 = 0
        for u in urls {
            guard let vals = try? u.resourceValues(forKeys: Set(keys)) else { continue }
            let size = Int64(vals.fileSize ?? 0)
            let date = vals.contentModificationDate ?? .distantPast
            entries.append((u, date, size))
            totalSize += size
        }

        guard totalSize > maxBytes else { return }
        // Evict oldest-accessed files down to 80% of limit
        let targetBytes = Int64(Double(maxBytes) * 0.8)
        for entry in entries.sorted(by: { $0.date < $1.date }) {
            if totalSize <= targetBytes { break }
            try? fm.removeItem(at: entry.url)
            totalSize -= entry.size
        }
    }

    private static func decodeImage(from data: Data) -> OttlinePlatformImage? {
        #if canImport(UIKit)
        guard let img = UIImage(data: data) else { return nil }
        return img.preparingForDisplay() ?? img
        #elseif canImport(AppKit)
        return NSImage(data: data)
        #endif
    }

    private static func estimatedByteCost(of image: OttlinePlatformImage) -> Int {
        #if canImport(UIKit)
        let w = Int(image.size.width * image.scale)
        let h = Int(image.size.height * image.scale)
        return max(1, w * h * 4)
        #elseif canImport(AppKit)
        let w = Int(image.size.width)
        let h = Int(image.size.height)
        return max(1, w * h * 4)
        #endif
    }

    public static func swiftUIImage(_ image: OttlinePlatformImage) -> Image {
        #if canImport(UIKit)
        return Image(uiImage: image)
        #elseif canImport(AppKit)
        return Image(nsImage: image)
        #endif
    }
}
