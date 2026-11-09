import Foundation

// MARK: - 1. RecordFeelings (3-Level Feeling System)

public struct FeelingOption: Equatable, Sendable {
    public let value: Int // 1, 2, 3
    public let score: Double // 2.0, 3.5, 4.5
    public let label: String
    public let shortLabel: String
}

public enum RecordFeelings {
    public static func options(isBook: Bool, locale: String) -> [FeelingOption] {
        let isEn = locale == "en"
        if isBook {
            return [
                FeelingOption(
                    value: 1,
                    score: 2.0,
                    label: isEn ? "Lightly turned the pages" : "가볍게 읽혔어요",
                    shortLabel: isEn ? "Light read" : "가볍게"
                ),
                FeelingOption(
                    value: 2,
                    score: 3.5,
                    label: isEn ? "Read with a warm heart" : "기분 좋게 읽었어요",
                    shortLabel: isEn ? "Good read" : "기분 좋게"
                ),
                FeelingOption(
                    value: 3,
                    score: 4.5,
                    label: isEn ? "Left a deep lingering note" : "오래 남는 책이었어요",
                    shortLabel: isEn ? "Lingering" : "오래 남음"
                )
            ]
        } else {
            return [
                FeelingOption(
                    value: 1,
                    score: 2.0,
                    label: isEn ? "Watched lightly" : "가볍게 봤어요",
                    shortLabel: isEn ? "Light watch" : "가볍게"
                ),
                FeelingOption(
                    value: 2,
                    score: 3.5,
                    label: isEn ? "Enjoyed the time" : "기분 좋게 봤어요",
                    shortLabel: isEn ? "Good watch" : "기분 좋게"
                ),
                FeelingOption(
                    value: 3,
                    score: 4.5,
                    label: isEn ? "Stayed with me a long time" : "여운이 오래 남았어요",
                    shortLabel: isEn ? "Deeply stayed" : "깊은 여운"
                )
            ]
        }
    }

    public static func ratingToFeelingValue(_ rating: Double?) -> Int? {
        guard let r = rating, r.isFinite, r > 0.0 else { return nil }
        if r >= 4.25 { return 3 }
        if r >= 2.75 { return 2 }
        return 1
    }

    public static func feelingValueToRating(_ value: Int?) -> Double? {
        switch value {
        case 1: return 2.0
        case 2: return 3.5
        case 3: return 4.5
        default: return nil
        }
    }

    public static func resolveFeeling(rating: Double?, isBook: Bool, locale: String) -> FeelingOption? {
        guard let value = ratingToFeelingValue(rating) else { return nil }
        return options(isBook: isBook, locale: locale).first { $0.value == value }
    }
}

// MARK: - 2. RecordDate (KST Date & Time Formatting)

public enum RecordDate {
    public static let kstTimeZone = TimeZone(identifier: "Asia/Seoul") ?? .current

    private static var kstCalendar: Calendar {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = kstTimeZone
        return cal
    }

    public static func nowIso() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }

    public static func todayDateString() -> String {
        let formatter = DateFormatter()
        formatter.calendar = kstCalendar
        formatter.timeZone = kstTimeZone
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }

    public static func parseDate(_ isoOrDate: String?) -> Date? {
        guard let raw = isoOrDate?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = isoFrac.date(from: raw) { return d }

        let isoStd = ISO8601DateFormatter()
        isoStd.formatOptions = [.withInternetDateTime]
        if let d = isoStd.date(from: raw) { return d }

        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        if let d = df.date(from: String(raw.prefix(10))) { return d }

        return nil
    }

    public static func parseInstantMillis(_ iso: String?) -> Int64 {
        guard let d = parseDate(iso) else { return 0 }
        return Int64(d.timeIntervalSince1970 * 1000.0)
    }

    public static func recordDateInput(_ iso: String?) -> String {
        guard let d = parseDate(iso) else { return todayDateString() }
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        return df.string(from: d)
    }

    public static func resolveWatchedAt(_ dateStr: String, existingIso: String?) -> String {
        let trimmed = dateStr.trimmingCharacters(in: .whitespacesAndNewlines)
        if let existing = existingIso, recordDateInput(existing) == trimmed {
            return existing
        }
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM-dd"
        if let parsed = df.date(from: trimmed) {
            // Noon KST so date never shifts across timezones
            let noon = parsed.addingTimeInterval(12 * 3600)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime]
            return iso.string(from: noon)
        }
        return nowIso()
    }

    public static func formatDisplayDate(_ iso: String?, locale: String) -> String {
        guard let d = parseDate(iso) else { return todayDateString() }
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "MMM d, yyyy"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "yyyy년 M월 d일"
        }
        return df.string(from: d)
    }

    public static func formatHomeToday(_ locale: String) -> String {
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "EEEE, MMM d, yyyy"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "yyyy년 M월 d일 EEEE"
        }
        return df.string(from: Date())
    }

    public static func monthKey(_ iso: String?) -> String {
        let d = parseDate(iso) ?? Date()
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy-MM"
        return df.string(from: d)
    }

    public static func formatMonthLabel(_ monthKey: String, locale: String) -> String {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2,
              let year = Int(parts[0]),
              let month = Int(parts[1]),
              (1...12).contains(month) else {
            return monthKey
        }
        if locale == "en" {
            var comps = DateComponents()
            comps.year = year
            comps.month = month
            comps.day = 1
            if let date = kstCalendar.date(from: comps) {
                let df = DateFormatter()
                df.calendar = kstCalendar
                df.timeZone = kstTimeZone
                df.locale = Locale(identifier: "en_US")
                df.dateFormat = "MMM yyyy"
                return df.string(from: date)
            }
            return "\(year)-\(month)"
        } else {
            return "\(year)년 \(month)월"
        }
    }

    public static func formatMonthYearPart(_ monthKey: String) -> String {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2 else { return "" }
        return String(parts[0])
    }

    public static func formatMonthShortPart(_ monthKey: String, locale: String) -> String {
        let parts = monthKey.split(separator: "-")
        guard parts.count == 2, let month = Int(parts[1]), (1...12).contains(month) else {
            return monthKey
        }
        if locale == "en" {
            let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return names[month - 1]
        } else {
            return "\(month)월"
        }
    }
}

// MARK: - 3. TimelineMoments (Grouping & Frequent Moments)

public struct MonthLogGroup: Equatable, Identifiable, Sendable {
    public let monthKey: String
    public let logs: [WatchLog]
    public var id: String { monthKey }
}

public enum TimelineMoments {
    public static func groupLogsByMonth(_ logs: [WatchLog]) -> [MonthLogGroup] {
        let sorted = logs.sorted {
            let a = $0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt
            let b = $1.watchedAt.isEmpty ? $1.createdAt : $1.watchedAt
            return RecordDate.parseInstantMillis(a) > RecordDate.parseInstantMillis(b)
        }
        var order: [String] = []
        var map: [String: [WatchLog]] = [:]
        for log in sorted {
            let mk = RecordDate.monthKey(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt)
            if map[mk] == nil {
                order.append(mk)
                map[mk] = []
            }
            map[mk]?.append(log)
        }
        return order.map { MonthLogGroup(monthKey: $0, logs: map[$0] ?? []) }
    }

    public static func availableMonths(_ logs: [WatchLog]) -> [String] {
        groupLogsByMonth(logs).map(\.monthKey)
    }

    public static func frequentPlaces(_ logs: [WatchLog], limit: Int = 3) -> [(Place, Int)] {
        var counts: [Place: Int] = [:]
        for log in logs {
            if let p = log.place {
                counts[p, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }.prefix(limit).map { ($0.key, $0.value) }
    }

    public static func frequentOccasions(_ logs: [WatchLog], limit: Int = 3) -> [(Occasion, Int)] {
        var counts: [Occasion: Int] = [:]
        for log in logs {
            if let o = log.occasion {
                counts[o, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }.prefix(limit).map { ($0.key, $0.value) }
    }
}

// MARK: - 4. KDC Bookshelf Builder (000~900)

public struct BookshelfBookItem: Equatable, Identifiable, Sendable {
    public let key: String
    public let isbn13: String?
    public let representativeLog: WatchLog
    public let logCount: Int
    public let kdcMajor: Int?
    public let kdcCode: String?
    public let classificationStatus: String

    public var id: String { key }
}

public struct BookshelfSection: Equatable, Identifiable, Sendable {
    public let major: Int? // 0..9 or nil for unclassified/pending
    public let codeLabel: String
    public let titleKo: String
    public let titleEn: String
    public let books: [BookshelfBookItem]

    public var id: String { codeLabel }
}

public enum BookshelfBuilder {
    private static let kdcLabels: [(Int, String, String, String)] = [
        (0, "000", "총류", "Generalities"),
        (1, "100", "철학", "Philosophy"),
        (2, "200", "종교", "Religion"),
        (3, "300", "사회과학", "Social Sciences"),
        (4, "400", "자연과학", "Natural Sciences"),
        (5, "500", "기술과학", "Technology"),
        (6, "600", "예술", "Arts"),
        (7, "700", "언어", "Language"),
        (8, "800", "문학", "Literature"),
        (9, "900", "역사", "History")
    ]

    public static func normalizeIsbn13(_ raw: String?) -> String? {
        guard let raw else { return nil }
        let tokens = raw.split { $0 == " " || $0 == "," || $0 == ";" || $0 == "/" }
        for token in tokens {
            let digits = token.filter { $0.isNumber }
            if digits.count == 13 && (digits.hasPrefix("978") || digits.hasPrefix("979")) {
                return String(digits)
            }
        }
        let allDigits = raw.filter { $0.isNumber }
        if allDigits.count == 13 && (allDigits.hasPrefix("978") || allDigits.hasPrefix("979")) {
            return String(allDigits)
        }
        return nil
    }

    public static func normalizeBookIsbn13(_ title: Title) -> String? {
        normalizeIsbn13(title.isbn13) ?? normalizeIsbn13(title.providerId)
    }

    public static func kdcSectionName(major: Int?, locale: String) -> String {
        guard let major, let found = kdcLabels.first(where: { $0.0 == major }) else {
            return locale == "en" ? "Sorting shelf" : "정리 중인 책칸"
        }
        return locale == "en" ? "\(found.1) \(found.3)" : "\(found.1) \(found.2)"
    }

    public static func buildBookshelf(
        logs: [WatchLog],
        classificationsByIsbn: [String: BookClassificationItemDto]
    ) -> [BookshelfSection] {
        let bookLogs = logs
            .filter { $0.title.type == .book }
            .sorted {
                let a = $0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt
                let b = $1.watchedAt.isEmpty ? $1.createdAt : $1.watchedAt
                return RecordDate.parseInstantMillis(a) > RecordDate.parseInstantMillis(b)
            }

        var groupedOrder: [String] = []
        var groupedLogs: [String: [WatchLog]] = [:]
        for log in bookLogs {
            let isbn = normalizeBookIsbn13(log.title)
            let key = isbn.map { "isbn:\($0)" } ?? "title:\(log.title.id)"
            if groupedLogs[key] == nil {
                groupedOrder.append(key)
                groupedLogs[key] = []
            }
            groupedLogs[key]?.append(log)
        }

        let items: [BookshelfBookItem] = groupedOrder.compactMap { key in
            guard let list = groupedLogs[key], let rep = list.first else { return nil }
            let isbn = normalizeBookIsbn13(rep.title)
            let cls = isbn.flatMap { classificationsByIsbn[$0] }
            let validMajor: Int? = {
                if cls?.status == "CLASSIFIED", let m = cls?.kdcMajor, (0...9).contains(m) {
                    return m
                }
                return nil
            }()
            return BookshelfBookItem(
                key: key,
                isbn13: isbn,
                representativeLog: rep,
                logCount: list.count,
                kdcMajor: validMajor,
                kdcCode: cls?.kdcCode,
                classificationStatus: cls?.status ?? (isbn == nil ? "UNCLASSIFIED" : "PENDING")
            )
        }

        var sections: [BookshelfSection] = []
        for (major, code, ko, en) in kdcLabels {
            let matching = items.filter { $0.kdcMajor == major }
            if !matching.isEmpty {
                sections.append(
                    BookshelfSection(
                        major: major,
                        codeLabel: code,
                        titleKo: ko,
                        titleEn: en,
                        books: matching
                    )
                )
            }
        }

        let unclassified = items.filter { $0.kdcMajor == nil }
        if !unclassified.isEmpty {
            sections.append(
                BookshelfSection(
                    major: nil,
                    codeLabel: "...",
                    titleKo: "정리 중인 책칸",
                    titleEn: "Unclassified / Pending",
                    books: unclassified
                )
            )
        }
        return sections
    }
}

// MARK: - 5. PersonalReportBuilder (Local Fallback Computation)

public enum PersonalReportBuilder {
    public static func buildFromLocalLogs(_ logs: [WatchLog]) -> PersonalReport {
        if logs.isEmpty {
            return PersonalReport()
        }

        let nowMonth = RecordDate.monthKey(nil)
        let thisMonthLogs = logs.filter {
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == nowMonth
        }

        // Previous week logs & posters (last 14 days fallback)
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let twoWeeksMs: Int64 = 14 * 24 * 3600 * 1000
        let recentLogs = logs.filter {
            let ts = RecordDate.parseInstantMillis($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt)
            return (nowMs - ts) <= twoWeeksMs
        }
        var seenTitles = Set<String>()
        var recentPosters: [SeasonalRecapPoster] = []
        for log in (recentLogs.isEmpty ? Array(logs.prefix(6)) : recentLogs) {
            if seenTitles.insert(log.title.id).inserted {
                recentPosters.append(
                    SeasonalRecapPoster(
                        titleId: log.title.id,
                        title: log.title.name,
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        type: log.title.type.rawValue,
                        watchedAt: log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
                    )
                )
                if recentPosters.count >= 6 { break }
            }
        }

        let rated = logs.compactMap(\.rating).filter { $0 > 0 }
        let avgRating: Double? = rated.isEmpty ? nil : ((rated.reduce(0, +) / Double(rated.count)) * 10).rounded() / 10.0

        let withNotes = logs.filter { !($0.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) }.count
        let noteFillPct = Int((Double(withNotes) * 100.0 / Double(logs.count)).rounded())

        func topKey<T: Hashable>(_ items: [T]) -> T? {
            var counts: [T: Int] = [:]
            for item in items { counts[item, default: 0] += 1 }
            return counts.max(by: { $0.value < $1.value })?.key
        }

        let topType = topKey(logs.map { $0.title.type.rawValue }) ?? "-"
        let topOtt = topKey(logs.compactMap { $0.ott?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }) ?? "-"
        let topPlace = topKey(logs.compactMap { $0.place?.rawValue }) ?? "-"
        let topOccasion = topKey(logs.compactMap { $0.occasion?.rawValue }) ?? "-"

        var monthGenres: [String: Int] = [:]
        for log in thisMonthLogs {
            for g in (log.title.genres ?? []) where !g.isEmpty {
                monthGenres[g, default: 0] += 1
            }
        }
        let topMonthGenreEntry = monthGenres.max(by: { $0.value < $1.value })

        var statusCounts: [String: Int] = [:]
        var typeCounts: [String: Int] = [:]
        var ottCounts: [String: Int] = [:]
        var genreCounts: [String: Int] = [:]
        for log in logs {
            statusCounts[log.status.rawValue, default: 0] += 1
            typeCounts[log.title.type.rawValue, default: 0] += 1
            if let o = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !o.isEmpty {
                ottCounts[o, default: 0] += 1
            }
            for g in (log.title.genres ?? []) where !g.isEmpty {
                genreCounts[g, default: 0] += 1
            }
        }

        let trend = TimelineMoments.groupLogsByMonth(logs)
            .prefix(6)
            .reversed()
            .map { MonthlyTrendPoint(month: $0.monthKey, count: $0.logs.count) }

        return PersonalReport(
            totalLogs: logs.count,
            thisMonthLogs: thisMonthLogs.count,
            previousWeekLogs: recentLogs.count,
            previousWeekPosters: recentPosters,
            avgRating: avgRating,
            ratedLogs: rated.count,
            noteFillPct: noteFillPct,
            topType: topType,
            topOtt: topOtt,
            topPlace: topPlace,
            topOccasion: topOccasion,
            monthlyTopGenre: topMonthGenreEntry?.key ?? "-",
            monthlyTopGenreCount: topMonthGenreEntry?.value ?? 0,
            streakDays: logs.isEmpty ? 0 : 1,
            longestStreakDays: logs.isEmpty ? 0 : 1,
            byStatus: statusCounts.map { StatusCountMetric(status: $0.key, count: $0.value) },
            byType: typeCounts.map { TypeCountMetric(type: $0.key, count: $0.value) },
            topOtts: ottCounts.sorted { $0.value > $1.value }.prefix(5).map { NameCountMetric(name: $0.key, count: $0.value) },
            monthlyTrend: trend,
            topGenres: genreCounts.sorted { $0.value > $1.value }.prefix(5).map { NameCountMetric(name: $0.key, count: $0.value) }
        )
    }
}

// MARK: - 6. ShareIntentParser & TitleFallback & CsvExporter

public struct ParsedSharedContent: Equatable, Sendable {
    public let query: String
    public let suggestedPlatform: String?
    public let suggestedTypeTab: String
}

public enum ShareIntentParser {
    private static let hostToPlatform: [(String, String, String)] = [
        ("netflix.com", "Netflix", "all"),
        ("tving.com", "TVING", "all"),
        ("wavve.com", "Wavve", "all"),
        ("coupangplay.com", "Coupang Play", "all"),
        ("disneyplus.com", "Disney+", "all"),
        ("watcha.com", "Watcha", "all"),
        ("primevideo.com", "Prime Video", "all"),
        ("tv.apple.com", "Apple TV+", "all"),
        ("laftel.net", "Laftel", "series"),
        ("ridibooks.com", "리디", "book"),
        ("millie.co.kr", "밀리의서재", "book"),
        ("yes24.com", "예스24", "book"),
        ("kyobobook.co.kr", "교보문고", "book"),
        ("aladin.co.kr", "알라딘", "book")
    ]

    public static func parse(sharedText: String?, subject: String? = nil) -> ParsedSharedContent {
        let rawText = (sharedText ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let rawSubject = (subject ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let combined = "\(rawSubject)\n\(rawText)".trimmingCharacters(in: .whitespacesAndNewlines)

        var platform: String?
        var typeTab = "all"

        let lowered = combined.lowercased()
        for (domain, label, tab) in hostToPlatform {
            if lowered.contains(domain) {
                platform = label
                typeTab = tab
                break
            }
        }

        // Remove URLs
        let withoutUrls = combined.replacingOccurrences(
            of: #"https?://\S+"#,
            with: " ",
            options: .regularExpression
        )

        // Check quoted title first: 「...」, 『...』, "...", '...'
        let quotePatterns = [
            #"「([^」]{1,60})」"#,
            #"『([^』]{1,60})』"#,
            #""([^"]{1,60})""#,
            #"“([^”]{1,60})”"#
        ]
        for pattern in quotePatterns {
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: withoutUrls, range: NSRange(withoutUrls.startIndex..., in: withoutUrls)),
               let range = Range(match.range(at: 1), in: withoutUrls) {
                let extracted = String(withoutUrls[range]).trimmingCharacters(in: .whitespacesAndNewlines)
                if !extracted.isEmpty {
                    return ParsedSharedContent(query: extracted, suggestedPlatform: platform, suggestedTypeTab: typeTab)
                }
            }
        }

        let cleaned = withoutUrls
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        return ParsedSharedContent(
            query: String(cleaned.prefix(60)),
            suggestedPlatform: platform,
            suggestedTypeTab: typeTab
        )
    }
}

public enum TitleFallback {
    public static func selectPopularTitleFillers(
        discussions: [DiscussionListItem],
        popularTitles: [TitleSearchItem],
        missingCount: Int
    ) -> [TitleSearchItem] {
        guard missingCount > 0 else { return [] }
        let existingKeys = Set(discussions.flatMap { d -> [String] in
            var keys = [d.titleName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()]
            if let p = d.provider, let pid = d.providerId {
                keys.append("\(p.rawValue):\(d.titleType.rawValue):\(pid)")
            }
            return keys
        })
        var results: [TitleSearchItem] = []
        for item in popularTitles {
            let key1 = item.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let key2 = "\(item.provider.rawValue):\(item.type.rawValue):\(item.providerId)"
            if !existingKeys.contains(key1) && !existingKeys.contains(key2) {
                results.append(item)
                if results.count >= missingCount { break }
            }
        }
        return results
    }
}

public enum CsvExporter {
    public static func buildCsv(_ logs: [WatchLog]) -> String {
        var rows: [String] = []
        // UTF-8 BOM for Excel/Numbers Korean compatibility
        rows.append("\u{FEFF}watched_at,title,type,status,feeling_score,platform,place,occasion,season,episode,note,spoiler,isbn13")
        for log in logs {
            let cols: [String] = [
                RecordDate.recordDateInput(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt),
                log.title.name,
                log.title.type.rawValue,
                log.status.rawValue,
                log.rating.map { String(format: "%.1f", $0) } ?? "",
                log.ott ?? "",
                log.place?.rawValue ?? "",
                log.occasion?.rawValue ?? "",
                log.seasonNumber.map(String.init) ?? "",
                log.episodeNumber.map(String.init) ?? "",
                log.note ?? "",
                log.spoiler ? "true" : "false",
                BookshelfBuilder.normalizeBookIsbn13(log.title) ?? ""
            ]
            rows.append(cols.map(escapeCsvField).joined(separator: ","))
        }
        return rows.joined(separator: "\r\n")
    }

    private static func escapeCsvField(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r") {
            let escaped = value.replacingOccurrences(of: "\"", with: "\"\"")
            return "\"\(escaped)\""
        }
        return value
    }
}
