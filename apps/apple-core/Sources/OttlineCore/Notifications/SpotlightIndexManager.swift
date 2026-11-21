import Foundation
#if canImport(CoreSpotlight)
import CoreSpotlight
#endif
#if canImport(UniformTypeIdentifiers)
import UniformTypeIdentifiers
#endif

// MARK: - 1. On-Device Spotlight Indexing (`CoreSpotlight`)

public struct SpotlightSearchablePayload: Equatable, Sendable {
    public let uniqueIdentifier: String
    public let title: String
    public let contentDescription: String
    public let keywords: [String]

    public init(
        uniqueIdentifier: String,
        title: String,
        contentDescription: String,
        keywords: [String]
    ) {
        self.uniqueIdentifier = uniqueIdentifier
        self.title = title
        self.contentDescription = contentDescription
        self.keywords = keywords
    }
}

public final class SpotlightIndexManager: @unchecked Sendable {
    public static let shared = SpotlightIndexManager()
    public static let domainIdentifier = "app.ottline.logs"
    private static let identifierPrefix = "ottline-title:"

    private init() {}

    public static func makePayload(for log: WatchLog, locale: String) -> SpotlightSearchablePayload {
        let isEn = locale == "en"
        let typeLabel = OttlineStrings.titleTypeLabel(log.title.type, locale: locale)
        let statusLabel = OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)

        var parts: [String] = [typeLabel, statusLabel]
        let trimmedOtt = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmedOtt.isEmpty {
            parts.append(trimmedOtt)
        }
        let trimmedAuthor = log.title.author?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmedAuthor.isEmpty {
            parts.append(trimmedAuthor)
        }

        let trimmedNote = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if log.spoiler {
            parts.append(isEn ? "Spoiler note hidden" : "스포일러 포함 메모")
        } else if !trimmedNote.isEmpty {
            let singleLine = trimmedNote.replacingOccurrences(of: "\n", with: " ")
            let clipped = singleLine.count > 140 ? String(singleLine.prefix(140)) + "…" : singleLine
            parts.append(clipped)
        }

        var keywordSet: [String] = []
        let candidates: [String?] = [
            log.title.name,
            trimmedAuthor.isEmpty ? nil : trimmedAuthor,
            log.title.publisher?.trimmingCharacters(in: .whitespacesAndNewlines),
            trimmedOtt.isEmpty ? nil : trimmedOtt,
            typeLabel,
            statusLabel,
            "ottline",
            "오트라인"
        ]
        for raw in candidates {
            if let k = raw, !k.isEmpty, !keywordSet.contains(k) {
                keywordSet.append(k)
            }
        }

        return SpotlightSearchablePayload(
            uniqueIdentifier: "\(identifierPrefix)\(log.title.id)",
            title: log.title.name,
            contentDescription: parts.joined(separator: " · "),
            keywords: keywordSet
        )
    }

    public static func parseTitleId(from uniqueIdentifier: String?) -> String? {
        guard let raw = uniqueIdentifier?.trimmingCharacters(in: .whitespacesAndNewlines),
              raw.hasPrefix(identifierPrefix) else {
            return nil
        }
        let id = String(raw.dropFirst(identifierPrefix.count))
        return id.isEmpty ? nil : id
    }

    public func syncLogs(_ logs: [WatchLog], locale: String) {
        #if canImport(CoreSpotlight) && canImport(UniformTypeIdentifiers)
        guard CSSearchableIndex.isIndexingAvailable() else { return }
        let items: [CSSearchableItem] = logs.prefix(300).map { log in
            let payload = Self.makePayload(for: log, locale: locale)
            let attr = CSSearchableItemAttributeSet(contentType: .content)
            attr.title = payload.title
            attr.contentDescription = payload.contentDescription
            attr.keywords = payload.keywords
            return CSSearchableItem(
                uniqueIdentifier: payload.uniqueIdentifier,
                domainIdentifier: Self.domainIdentifier,
                attributeSet: attr
            )
        }
        let index = CSSearchableIndex.default()
        index.deleteSearchableItems(withDomainIdentifiers: [Self.domainIdentifier]) { _ in
            guard !items.isEmpty else { return }
            index.indexSearchableItems(items, completionHandler: nil)
        }
        #endif
    }

    public func clearAll() {
        #if canImport(CoreSpotlight)
        guard CSSearchableIndex.isIndexingAvailable() else { return }
        CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [Self.domainIdentifier], completionHandler: nil)
        #endif
    }
}

// MARK: - 2. Pending Intent Deep-Link Store

public final class PendingIntentRouteStore: @unchecked Sendable {
    public static let shared = PendingIntentRouteStore()
    public static let didEnqueueNotification = Notification.Name("ottline.intent.openUrl")

    private let lock = NSLock()
    private var pendingUrl: URL?

    private init() {}

    public func enqueue(_ url: URL) {
        lock.lock()
        pendingUrl = url
        lock.unlock()
        DispatchQueue.main.async {
            NotificationCenter.default.post(name: Self.didEnqueueNotification, object: nil)
        }
    }

    public func consumePendingUrl() -> URL? {
        lock.lock()
        defer { lock.unlock() }
        let current = pendingUrl
        pendingUrl = nil
        return current
    }
}
