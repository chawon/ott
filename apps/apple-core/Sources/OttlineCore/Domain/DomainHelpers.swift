import Foundation

// MARK: - 1. RecordFeelings & PlatformCatalog

public struct FeelingOption: Equatable, Sendable {
    public let value: Int // 3 (good), 2 (okay), 1 (bad)
    public let score: Double // 5.0, 3.5, 2.0
    public let label: String
    public let shortLabel: String
}

public enum RecordFeelings {
    public static func options(isBook: Bool, locale: String) -> [FeelingOption] {
        let isEn = locale == "en"
        if isBook {
            let goodLabel = isEn ? "Life-changing" : "인생책"
            let okayLabel = isEn ? "Not bad" : "무난해요"
            let badLabel = isEn ? "Disappointing" : "아쉬워요"
            return [
                FeelingOption(value: 3, score: 5.0, label: goodLabel, shortLabel: goodLabel),
                FeelingOption(value: 2, score: 3.0, label: okayLabel, shortLabel: okayLabel),
                FeelingOption(value: 1, score: 1.0, label: badLabel, shortLabel: badLabel)
            ]
        } else {
            let goodLabel = isEn ? "Excellent" : "최고예요"
            let okayLabel = isEn ? "Worth watching" : "볼만해요"
            let badLabel = isEn ? "Disappointing" : "아쉬워요"
            return [
                FeelingOption(value: 3, score: 5.0, label: goodLabel, shortLabel: goodLabel),
                FeelingOption(value: 2, score: 3.0, label: okayLabel, shortLabel: okayLabel),
                FeelingOption(value: 1, score: 1.0, label: badLabel, shortLabel: badLabel)
            ]
        }
    }

    public static func ratingToFeelingValue(_ rating: Double?) -> Int? {
        guard let r = rating, r.isFinite, r > 0.0 else { return nil }
        if r >= 5.0 { return 3 }
        if r >= 3.0 { return 2 }
        return 1
    }

    public static func feelingValueToRating(_ value: Int?) -> Double? {
        switch value {
        case 3: return 5.0
        case 2: return 3.0
        case 1: return 1.0
        default: return nil
        }
    }

    public static func resolveFeeling(rating: Double?, isBook: Bool, locale: String) -> FeelingOption? {
        guard let value = ratingToFeelingValue(rating) else { return nil }
        return options(isBook: isBook, locale: locale).first { $0.value == value }
    }
}

public struct PlatformGroup: Equatable, Identifiable, Sendable {
    public let label: String
    public let items: [String]
    public var id: String { label }
}

public enum PlatformCatalog {
    public static func groups(isBook: Bool, locale: String) -> [PlatformGroup] {
        let isEn = locale == "en"
        if isBook {
            if isEn {
                return [
                    PlatformGroup(label: "Bookstore", items: ["Amazon", "Bookshop.org", "Local bookstore"]),
                    PlatformGroup(label: "E-book", items: ["Kindle", "Apple Books", "Google Play Books", "Kobo"]),
                    PlatformGroup(label: "Audiobook", items: ["Audible"]),
                    PlatformGroup(label: "Library", items: ["Libby", "Public Library", "University Library", "School Library"])
                ]
            } else {
                return [
                    PlatformGroup(label: "서점", items: ["교보문고", "영풍문고", "예스24", "알라딘"]),
                    PlatformGroup(label: "전자책·오디오북", items: ["리디", "밀리의서재", "윌라", "플레이북"]),
                    PlatformGroup(label: "도서관", items: ["공공도서관", "대학도서관", "학교도서관"])
                ]
            }
        } else {
            if isEn {
                return [
                    PlatformGroup(label: "Streaming", items: ["Netflix", "Disney+", "Apple TV+", "Prime Video", "Max", "Hulu"]),
                    PlatformGroup(label: "TV / Physical", items: ["Channel", "VOD", "DVD", "Blu-ray"]),
                    PlatformGroup(label: "Theater", items: ["Theater", "IMAX"])
                ]
            } else {
                return [
                    PlatformGroup(label: "OTT", items: ["넷플릭스", "디즈니플러스", "티빙", "웨이브", "쿠팡플레이", "애플티비", "프라임비디오", "왓챠"]),
                    PlatformGroup(label: "TV/기타", items: ["채널", "VOD", "DVD", "블루레이"]),
                    PlatformGroup(label: "극장", items: ["CGV", "롯데시네마", "메가박스", "씨네Q"])
                ]
            }
        }
    }

    public static func allDefaultLabels(isBook: Bool, locale: String) -> [String] {
        groups(isBook: isBook, locale: locale).flatMap(\.items)
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

    public static func todayIsoDateTime() -> String {
        nowIso()
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

    public static func formatDotDate(_ iso: String?) -> String {
        guard let d = parseDate(iso) else {
            return todayDateString().replacingOccurrences(of: "-", with: ".")
        }
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "yyyy.MM.dd"
        return df.string(from: d)
    }

    public static func formatCommentDateTime(_ iso: String?, locale: String) -> String {
        guard let d = parseDate(iso) else { return "" }
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "MMM d, hh:mm a"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "M월 d일 a hh:mm"
        }
        return df.string(from: d)
    }

    public static func formatHomeToday(_ locale: String) -> String {
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "EEEE, MMMM d"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "M월 d일 EEEE"
        }
        return df.string(from: Date())
    }

    public static func formatFeaturedDate(_ iso: String?, locale: String) -> String {
        let d = parseDate(iso) ?? Date()
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "MMM d (EEE)"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "M월 d일 (E)"
        }
        return df.string(from: d)
    }

    public static func formatShortMonthDay(_ iso: String?, locale: String) -> String {
        let d = parseDate(iso) ?? Date()
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "MMM d"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "M월 d일"
        }
        return df.string(from: d)
    }

    public static func formatTimelineMonth(_ iso: String?, locale: String) -> String {
        let d = parseDate(iso) ?? Date()
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        if locale == "en" {
            df.locale = Locale(identifier: "en_US")
            df.dateFormat = "MMM"
        } else {
            df.locale = Locale(identifier: "ko_KR")
            df.dateFormat = "M월"
        }
        return df.string(from: d)
    }

    public static func formatTimelineDay(_ iso: String?) -> String {
        let d = parseDate(iso) ?? Date()
        let df = DateFormatter()
        df.calendar = kstCalendar
        df.timeZone = kstTimeZone
        df.locale = Locale(identifier: "en_US_POSIX")
        df.dateFormat = "d"
        return df.string(from: d)
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
    public static func timelineSortKey(_ log: WatchLog) -> String {
        if let updated = log.updatedAt, !updated.isEmpty {
            return updated
        }
        return log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
    }

    public static func groupLogsByMonth(_ logs: [WatchLog]) -> [MonthLogGroup] {
        let sorted = logs.sorted {
            RecordDate.parseInstantMillis(timelineSortKey($0)) > RecordDate.parseInstantMillis(timelineSortKey($1))
        }
        var order: [String] = []
        var map: [String: [WatchLog]] = [:]
        for log in sorted {
            let mk = RecordDate.monthKey(timelineSortKey(log))
            if map[mk] == nil {
                order.append(mk)
                map[mk] = []
            }
            map[mk]?.append(log)
        }
        return order.map { MonthLogGroup(monthKey: $0, logs: map[$0] ?? []) }
    }

    public static func groupCompletedLogsByWatchedMonth(_ logs: [WatchLog]) -> [MonthLogGroup] {
        let sorted = logs
            .filter { $0.status == .done }
            .sorted {
                let a = $0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt
                let b = $1.watchedAt.isEmpty ? $1.createdAt : $1.watchedAt
                return RecordDate.parseInstantMillis(a) > RecordDate.parseInstantMillis(b)
            }
        var order: [String] = []
        var map: [String: [WatchLog]] = [:]
        for log in sorted {
            let dateKey = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
            let mk = RecordDate.monthKey(dateKey)
            if map[mk] == nil {
                order.append(mk)
                map[mk] = []
            }
            map[mk]?.append(log)
        }
        return order.map { MonthLogGroup(monthKey: $0, logs: map[$0] ?? []) }
    }

    public static func availableMonths(_ logs: [WatchLog]) -> [String] {
        groupCompletedLogsByWatchedMonth(logs).map(\.monthKey)
    }

    public static func revisitCandidateLogs(_ logs: [WatchLog]) -> [WatchLog] {
        logs.filter { $0.status != .wishlist }
    }

    public static func frequentPlaces(_ logs: [WatchLog], limit: Int = 3) -> [(Place, Int)] {
        let eligible = revisitCandidateLogs(logs)
        var counts: [Place: Int] = [:]
        for log in eligible {
            if let p = log.place {
                counts[p, default: 0] += 1
            }
        }
        return counts.sorted { $0.value > $1.value }.prefix(limit).map { ($0.key, $0.value) }
    }

    public static func frequentOccasions(_ logs: [WatchLog], limit: Int = 3) -> [(Occasion, Int)] {
        let eligible = revisitCandidateLogs(logs)
        var counts: [Occasion: Int] = [:]
        for log in eligible {
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
    public static let kdcLabels: [(major: Int, code: String, nameKo: String, nameEn: String)] = [
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

    public static func kdcCategoryName(major: Int, locale: String) -> String {
        guard let found = kdcLabels.first(where: { $0.major == major }) else {
            return locale == "en" ? "Unclassified" : "미분류"
        }
        return locale == "en" ? found.nameEn : found.nameKo
    }

    public static func shelfTitle(major: Int, locale: String) -> String {
        guard let found = kdcLabels.first(where: { $0.major == major }) else {
            return locale == "en" ? "Sorting shelf" : "정리 중인 책칸"
        }
        let cat = locale == "en" ? found.nameEn : found.nameKo
        return locale == "en" ? "\(found.code) · \(cat) shelf" : "\(found.code) · \(cat) 서가"
    }

    public static func waitingCopy(locale: String) -> String {
        locale == "en" ? "Finding the right shelf spot." : "서가에서는 알맞은 자리를 찾고 있어요."
    }

    public static func cardBadgeCopy(major: Int, locale: String) -> String {
        let cat = kdcCategoryName(major: major, locale: locale)
        return locale == "en" ? "Also shelved in \(cat)." : "\(cat) 서가에도 함께 꽂혔어요."
    }

    public static func kdcSectionName(major: Int?, locale: String) -> String {
        guard let major else {
            return locale == "en" ? "Sorting shelf" : "정리 중인 책칸"
        }
        return shelfTitle(major: major, locale: locale)
    }

    public static func buildBookItems(
        logs: [WatchLog],
        classificationsByIsbn: [String: BookClassificationItemDto]
    ) -> [BookshelfBookItem] {
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

        return groupedOrder.compactMap { key in
            guard let list = groupedLogs[key], let rep = list.first else { return nil }
            let isbn = normalizeBookIsbn13(rep.title)
            let cls = isbn.flatMap { classificationsByIsbn[$0] }
            let validMajor: Int? = {
                if cls?.isResolved == true, let m = cls?.kdcMajor, (0...9).contains(m) {
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
                classificationStatus: cls?.status ?? (isbn == nil ? "NO_ISBN" : "PENDING")
            )
        }
    }

    public static func buildShelfGrid(
        logs: [WatchLog],
        classificationsByIsbn: [String: BookClassificationItemDto]
    ) -> (shelves: [BookshelfSection], unclassified: [BookshelfBookItem]) {
        let items = buildBookItems(logs: logs, classificationsByIsbn: classificationsByIsbn)
        let shelves = kdcLabels.map { info in
            BookshelfSection(
                major: info.major,
                codeLabel: info.code,
                titleKo: info.nameKo,
                titleEn: info.nameEn,
                books: items.filter { $0.kdcMajor == info.major }
            )
        }
        let unclassified = items.filter { $0.kdcMajor == nil }
        return (shelves, unclassified)
    }

    public static func buildBookshelf(
        logs: [WatchLog],
        classificationsByIsbn: [String: BookClassificationItemDto]
    ) -> [BookshelfSection] {
        let (shelves, unclassified) = buildShelfGrid(logs: logs, classificationsByIsbn: classificationsByIsbn)
        var sections = shelves.filter { !$0.books.isEmpty }
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
    public static func isH1RecapVisible(now: Date = Date()) -> Bool {
        // KST 2026-08-01 00:00:00 ends 2026-H1 recap campaign
        var comps = DateComponents()
        comps.timeZone = RecordDate.kstTimeZone
        comps.year = 2026
        comps.month = 8
        comps.day = 1
        comps.hour = 0
        comps.minute = 0
        comps.second = 0
        let cutoff = Calendar(identifier: .gregorian).date(from: comps) ?? Date.distantPast
        return now < cutoff
    }

    public static func buildFromLocalLogs(_ logs: [WatchLog]) -> PersonalReport {
        if logs.isEmpty {
            return PersonalReport()
        }

        let sortedLogs = logs.sorted {
            let a = $0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt
            let b = $1.watchedAt.isEmpty ? $1.createdAt : $1.watchedAt
            return RecordDate.parseInstantMillis(a) > RecordDate.parseInstantMillis(b)
        }

        let nowMonth = RecordDate.monthKey(nil)
        let thisMonthLogs = sortedLogs.filter {
            RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == nowMonth
        }

        let doneCount = sortedLogs.filter { $0.status == .done }.count
        let doneRatePct = Double(doneCount) * 100.0 / Double(sortedLogs.count)

        let rated = sortedLogs.compactMap(\.rating).filter { $0 > 0 }
        let ratingFillPct = Double(rated.count) * 100.0 / Double(sortedLogs.count)
        let avgRating: Double? = rated.isEmpty ? nil : ((rated.reduce(0, +) / Double(rated.count)) * 10).rounded() / 10.0

        let withNotes = sortedLogs.filter { !($0.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) }.count
        let noteFillPct = Double(withNotes) * 100.0 / Double(sortedLogs.count)

        // Previous week logs & posters (last 14 days fallback)
        let nowMs = Int64(Date().timeIntervalSince1970 * 1000)
        let twoWeeksMs: Int64 = 14 * 24 * 3600 * 1000
        let recentLogs = sortedLogs.filter {
            let ts = RecordDate.parseInstantMillis($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt)
            return (nowMs - ts) <= twoWeeksMs
        }
        var seenTitles = Set<String>()
        var recentPosters: [SeasonalRecapPoster] = []
        for log in (recentLogs.isEmpty ? Array(sortedLogs.prefix(6)) : recentLogs) {
            if seenTitles.insert(log.title.id).inserted {
                recentPosters.append(
                    SeasonalRecapPoster(
                        titleId: log.title.id,
                        title: log.title.name,
                        titleType: log.title.type.rawValue,
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        count: 1,
                        lastLoggedAt: log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
                    )
                )
                if recentPosters.count >= 6 { break }
            }
        }

        func topKey<T: Hashable>(_ items: [T]) -> T? {
            var counts: [T: Int] = [:]
            for item in items { counts[item, default: 0] += 1 }
            return counts.max(by: { $0.value < $1.value })?.key
        }

        let topType = topKey(sortedLogs.map { $0.title.type.rawValue })
        let topOtt = topKey(sortedLogs.compactMap { $0.ott?.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }) ?? "-"
        let topPlace = topKey(sortedLogs.compactMap { $0.place?.rawValue })
        let topOccasion = topKey(sortedLogs.compactMap { $0.occasion?.rawValue })

        var monthGenres: [String: Int] = [:]
        for log in thisMonthLogs {
            for g in (log.title.genres ?? []) where !g.isEmpty {
                monthGenres[g, default: 0] += 1
            }
        }
        let topMonthGenreEntry = monthGenres.max(by: { $0.value < $1.value })

        let latestIso = sortedLogs.first.map { $0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt }
        let daysSinceLastLog: Int? = latestIso.flatMap { RecordDate.parseDate($0) }.map {
            max(0, Int(Date().timeIntervalSince($0) / 86400))
        }
        let continueSeries = sortedLogs.first { $0.status == .inProgress && $0.title.type == .series }

        var statusCounts: [String: Int] = [:]
        var typeCounts: [String: Int] = [:]
        var ottCounts: [String: Int] = [:]
        var genreCounts: [String: Int] = [:]
        for log in sortedLogs {
            statusCounts[log.status.rawValue, default: 0] += 1
            typeCounts[log.title.type.rawValue, default: 0] += 1
            if let o = log.ott?.trimmingCharacters(in: .whitespacesAndNewlines), !o.isEmpty {
                ottCounts[o, default: 0] += 1
            }
            for g in (log.title.genres ?? []) where !g.isEmpty {
                genreCounts[g, default: 0] += 1
            }
        }

        let trend = TimelineMoments.groupLogsByMonth(sortedLogs)
            .prefix(6)
            .reversed()
            .map { MonthlyTrendPoint(month: $0.monthKey, count: $0.logs.count) }

        return PersonalReport(
            totalLogs: sortedLogs.count,
            thisMonthLogs: thisMonthLogs.count,
            doneRatePct: doneRatePct,
            ratingFillPct: ratingFillPct,
            noteFillPct: noteFillPct,
            topType: topType,
            topPlace: topPlace,
            topOccasion: topOccasion,
            streakDays: 1,
            longestStreakDays: 1,
            lastLoggedAt: latestIso,
            previousWeekLogs: recentLogs.count,
            previousWeekPosters: recentPosters,
            monthlyTopGenre: topMonthGenreEntry?.key,
            monthlyTopGenreCount: topMonthGenreEntry?.value ?? 0,
            daysSinceLastLog: daysSinceLastLog,
            continueSeriesTitleId: continueSeries?.title.id,
            continueSeriesTitle: continueSeries?.title.name,
            continueSeriesSeasonNumber: continueSeries?.seasonNumber,
            continueSeriesEpisodeNumber: continueSeries?.episodeNumber,
            seasonalRecap: nil,
            avgRating: avgRating,
            ratedLogs: rated.count,
            topOtt: topOtt,
            byStatus: statusCounts.map { StatusCountMetric(status: $0.key, count: $0.value) },
            byType: typeCounts.map { TypeCountMetric(type: $0.key, count: $0.value) },
            topOtts: ottCounts.sorted { $0.value > $1.value }.prefix(5).map { NameCountMetric(name: $0.key, count: $0.value) },
            monthlyTrend: trend,
            topGenres: genreCounts.sorted { $0.value > $1.value }.prefix(5).map { NameCountMetric(name: $0.key, count: $0.value) }
        )
    }

    public static func merging(remote: PersonalReport, localLogs: [WatchLog]) -> PersonalReport {
        let local = buildFromLocalLogs(localLogs)
        var merged = remote
        if merged.avgRating == nil { merged.avgRating = local.avgRating }
        if merged.ratedLogs == 0 { merged.ratedLogs = local.ratedLogs }
        if merged.topOtt == "-" { merged.topOtt = local.topOtt }
        if merged.byStatus.isEmpty { merged.byStatus = local.byStatus }
        if merged.byType.isEmpty { merged.byType = local.byType }
        if merged.topOtts.isEmpty { merged.topOtts = local.topOtts }
        if merged.monthlyTrend.isEmpty { merged.monthlyTrend = local.monthlyTrend }
        if merged.topGenres.isEmpty { merged.topGenres = local.topGenres }
        if !isH1RecapVisible() { merged.seasonalRecap = nil }
        return merged
    }
}

// MARK: - 6. ShareIntentParser & TitleFallback & CsvExporter

public struct ParsedSharedContent: Equatable, Sendable {
    public let query: String
    public let suggestedPlatform: String?
    public let suggestedTypeTab: String

    public init(query: String, suggestedPlatform: String? = nil, suggestedTypeTab: String = "all") {
        self.query = query
        self.suggestedPlatform = suggestedPlatform
        self.suggestedTypeTab = suggestedTypeTab
    }
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
        ("youtube.com", "YouTube", "all"),
        ("youtu.be", "YouTube", "all"),
        ("books.apple.com", "Apple Books", "book"),
        ("play.google.com/store/books", "플레이북", "book"),
        ("amazon.com", "Amazon", "book"),
        ("ridibooks.com", "리디", "book"),
        ("millie.co.kr", "밀리의서재", "book"),
        ("yes24.com", "예스24", "book"),
        ("kyobobook.co.kr", "교보문고", "book"),
        ("aladin.co.kr", "알라딘", "book")
    ]

    private static let trailingSiteSuffixes = [
        " - Netflix",
        " | Netflix",
        " | 넷플릭스",
        " - 넷플릭스",
        " - YouTube",
        " | YouTube",
        " | 교보문고",
        " - 교보문고",
        " - 알라딘",
        " | 알라딘",
        " - 예스24",
        " | 예스24",
        " - 리디",
        " | 리디",
        " - 리디북스",
        " | 리디북스",
        " | TVING",
        " - TVING",
        " | 티빙",
        " - 티빙",
        " | 쿠팡플레이",
        " - 쿠팡플레이",
        " | 웨이브",
        " - 웨이브",
        " | Disney+",
        " - Disney+",
        " - Apple Books",
        " - Apple TV",
        " - Amazon",
        " - 밀리의서재",
        " | 밀리의서재",
        " - Watcha",
        " | Watcha"
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

        var cleaned = withoutUrls
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        for suffix in trailingSiteSuffixes {
            if cleaned.lowercased().hasSuffix(suffix.lowercased()), cleaned.count > suffix.count {
                cleaned = String(cleaned.dropLast(suffix.count)).trimmingCharacters(in: .whitespacesAndNewlines)
                break
            }
        }

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
            if let p = d.titleProvider, let pid = d.titleProviderId {
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
    public static func buildCsv(_ logs: [WatchLog], locale: String = "ko") -> String {
        let isEn = locale == "en"
        var rows: [String] = []
        let header = isEn
            ? "Title,Type,Year,Status,Rating,Platform,Place,Occasion,Note"
            : "제목,유형,연도,상태,평점,시청처,장소,상황,메모"
        rows.append("\u{FEFF}\(header)")
        for log in logs {
            let typeLabel: String = {
                switch log.title.type {
                case .movie: return isEn ? "Movie" : "영화"
                case .series: return isEn ? "Series" : "시리즈"
                case .book: return isEn ? "Book" : "책"
                }
            }()
            let statusLabel = OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)
            let feelingText = RecordFeelings.resolveFeeling(rating: log.rating, isBook: log.title.type == .book, locale: locale)?.label ?? ""
            let placeText = log.place.map { OttlineStrings.placeLabel($0, locale: locale) } ?? ""
            let occasionText = log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) } ?? ""
            let cols: [String] = [
                log.title.name,
                typeLabel,
                log.title.year.map(String.init) ?? "",
                statusLabel,
                feelingText,
                log.ott ?? "",
                placeText,
                occasionText,
                log.note ?? ""
            ]
            rows.append(cols.map(escapeCsvField).joined(separator: ","))
        }
        return rows.joined(separator: "\r\n")
    }

    public static func writeTemporaryCsvFile(logs: [WatchLog], locale: String = "ko") -> URL? {
        let csv = buildCsv(logs, locale: locale)
        guard let data = csv.data(using: .utf8) else { return nil }
        let fileName = "ottline-logs-\(RecordDate.todayDateString()).csv"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        do {
            try data.write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }

    private static func escapeCsvField(_ value: String) -> String {
        if value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r") {
            let escaped = value.replacingOccurrences(of: "\"", with: "\"\"")
            return "\"\(escaped)\""
        }
        return value
    }
}

// MARK: - 7. Shared `ottline://` Quick Record & Browser Handoff Deep Link Parser

public struct ParsedQuickRecordLink: Equatable, Sendable {
    public var query: String
    public var typeTab: String // "all" | "video" | "movie" | "series" | "book"
    public var platform: String?
    public var titleId: String?

    public init(query: String = "", typeTab: String = "all", platform: String? = nil, titleId: String? = nil) {
        self.query = query
        self.typeTab = typeTab
        self.platform = platform
        self.titleId = titleId
    }
}

public struct ParsedBrowserHandoff: Equatable, Sendable {
    public var status: String?
    public var userId: String?
    public var deviceId: String?
    public var pairingCode: String?
    public var nickname: String?
    public var personaKey: PersonaKey?

    public init(
        status: String? = nil,
        userId: String? = nil,
        deviceId: String? = nil,
        pairingCode: String? = nil,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil
    ) {
        self.status = status
        self.userId = userId
        self.deviceId = deviceId
        self.pairingCode = pairingCode
        self.nickname = nickname
        self.personaKey = personaKey
    }
}

public enum OttlineIncomingLink: Equatable, Sendable {
    case browserHandoff(ParsedBrowserHandoff)
    case quickRecord(ParsedQuickRecordLink)
    case tab(TopLevelTab)
    case overlay(ActiveOverlayScreen)
    case unknown
}

public enum OttlineDeepLinkParser {
    public static func parse(_ url: URL) -> OttlineIncomingLink {
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let queryItems = components?.queryItems ?? []

        func firstNonEmpty(_ names: String...) -> String? {
            for name in names {
                if let raw = queryItems.first(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame })?.value {
                    let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
                    if !trimmed.isEmpty {
                        return trimmed
                    }
                }
            }
            return nil
        }

        let rawPath = url.path
        let path = rawPath.lowercased()
        let host = (url.host ?? "").lowercased()

        let handoffVal = firstNonEmpty("handoff")?.lowercased()
        let status = firstNonEmpty("status")?.lowercased()
        let uid = firstNonEmpty("user_id", "userId")
        let did = firstNonEmpty("device_id", "deviceId")
        let code = firstNonEmpty("pairing_code", "code")?.uppercased()

        if host == "handoff"
            || handoffVal == "1"
            || handoffVal == "true"
            || (host == "open" && (status != nil || code != nil || (uid != nil && did != nil))) {
            return .browserHandoff(ParsedBrowserHandoff(
                status: status,
                userId: uid,
                deviceId: did,
                pairingCode: code,
                nickname: firstNonEmpty("nickname"),
                personaKey: PersonaKey.fromWire(firstNonEmpty("persona_key", "personaKey"))
            ))
        }

        let quickVal = firstNonEmpty("quick")?.lowercased()
        if host == "quick" || host == "quick-record" || quickVal == "1" || quickVal == "true" {
            let query = firstNonEmpty("q", "title", "query", "capture_title") ?? ""
            let platform = firstNonEmpty("platform", "capture_platform")
            let rawType = firstNonEmpty("type", "capture_type")?.lowercased() ?? "all"
            let allowedTypes: Set<String> = ["all", "video", "movie", "series", "book"]
            let typeTab = allowedTypes.contains(rawType) ? rawType : "all"
            let titleId = firstNonEmpty("title_id", "id")
            return .quickRecord(ParsedQuickRecordLink(
                query: query,
                typeTab: typeTab,
                platform: platform,
                titleId: titleId
            ))
        }

        if host == "timeline" || path.contains("/timeline") {
            return .tab(.timeline)
        }
        if host == "together" || path == "/public" || path.hasSuffix("/public") {
            return .tab(.together)
        }
        if path.contains("/public/") {
            if let discussionId = rawPath.split(separator: "/").last.map(String.init), !discussionId.isEmpty {
                return .overlay(.publicDiscussion(discussionId))
            }
        }
        if host == "account" || path.contains("/account") || path.contains("/myspace") {
            return .tab(.mySpace)
        }
        if host == "report" || path.contains("/report") {
            return .overlay(.report)
        }
        if host == "bookshelf" || path.contains("/bookshelf") {
            return .overlay(.bookshelf(firstNonEmpty("kdc").flatMap(Int.init)))
        }
        if path.contains("/titles/") || path.contains("/title/") {
            if let titleId = rawPath.split(separator: "/").last.map(String.init), !titleId.isEmpty {
                return .overlay(.titleDetail(titleId))
            }
        }
        if path.contains("/guide/") {
            let slug = rawPath.split(separator: "/").last.map(String.init)
            return .overlay(.guides(slug))
        }
        if path.hasSuffix("/guide") {
            return .overlay(.guides(nil))
        }
        if path.contains("/about") {
            return .overlay(.about)
        }
        if path.contains("/faq") {
            return .overlay(.faq)
        }
        if path.contains("/privacy") {
            return .overlay(.privacy)
        }
        if path.contains("/feedback") {
            return .overlay(.feedback(nil))
        }

        return .unknown
    }
}
