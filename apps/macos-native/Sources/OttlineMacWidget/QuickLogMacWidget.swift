import SwiftUI
import WidgetKit

// Shared model mirroring `SharedWidgetSnapshot` in `AppPreferences.swift`
public struct QuickLogMacWidgetSnapshot: Codable, Sendable {
    public struct ContinueItem: Codable, Sendable {
        public var titleId: String
        public var titleName: String
        public var isBook: Bool
        public var isInProgress: Bool
        public var statusBadge: String
        public var metaText: String
        public var noteSnippet: String

        public init(
            titleId: String,
            titleName: String,
            isBook: Bool,
            isInProgress: Bool,
            statusBadge: String = "",
            metaText: String,
            noteSnippet: String
        ) {
            self.titleId = titleId
            self.titleName = titleName
            self.isBook = isBook
            self.isInProgress = isInProgress
            self.statusBadge = statusBadge
            self.metaText = metaText
            self.noteSnippet = noteSnippet
        }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            self.titleId = try c.decode(String.self, forKey: .titleId)
            self.titleName = try c.decode(String.self, forKey: .titleName)
            self.isBook = try c.decode(Bool.self, forKey: .isBook)
            self.isInProgress = try c.decode(Bool.self, forKey: .isInProgress)
            self.statusBadge = try c.decodeIfPresent(String.self, forKey: .statusBadge) ?? ""
            self.metaText = try c.decode(String.self, forKey: .metaText)
            self.noteSnippet = try c.decode(String.self, forKey: .noteSnippet)
        }
    }

    public struct RecentItem: Codable, Sendable, Identifiable {
        public var id: String { titleId }
        public var titleId: String
        public var titleName: String
        public var statusLabel: String
    }

    public var isEnglish: Bool
    public var monthBadge: String
    public var inProgressCount: Int
    public var thisMonthDoneCount: Int
    public var totalLogCount: Int
    public var continueItem: ContinueItem?
    public var recentItems: [RecentItem]

    public init(
        isEnglish: Bool,
        monthBadge: String,
        inProgressCount: Int = 0,
        thisMonthDoneCount: Int = 0,
        totalLogCount: Int = 0,
        continueItem: ContinueItem?,
        recentItems: [RecentItem]
    ) {
        self.isEnglish = isEnglish
        self.monthBadge = monthBadge
        self.inProgressCount = inProgressCount
        self.thisMonthDoneCount = thisMonthDoneCount
        self.totalLogCount = totalLogCount
        self.continueItem = continueItem
        self.recentItems = recentItems
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        self.isEnglish = try c.decodeIfPresent(Bool.self, forKey: .isEnglish) ?? false
        self.monthBadge = try c.decodeIfPresent(String.self, forKey: .monthBadge) ?? "타임라인"
        self.inProgressCount = try c.decodeIfPresent(Int.self, forKey: .inProgressCount) ?? 0
        self.thisMonthDoneCount = try c.decodeIfPresent(Int.self, forKey: .thisMonthDoneCount) ?? 0
        self.totalLogCount = try c.decodeIfPresent(Int.self, forKey: .totalLogCount) ?? 0
        self.continueItem = try c.decodeIfPresent(ContinueItem.self, forKey: .continueItem)
        self.recentItems = try c.decodeIfPresent([RecentItem].self, forKey: .recentItems) ?? []
    }

    public static let placeholder = QuickLogMacWidgetSnapshot(
        isEnglish: false,
        monthBadge: "타임라인",
        inProgressCount: 0,
        thisMonthDoneCount: 0,
        totalLogCount: 0,
        continueItem: nil,
        recentItems: []
    )
}

public struct QuickLogMacTimelineEntry: TimelineEntry {
    public let date: Date
    public let snapshot: QuickLogMacWidgetSnapshot
}

public struct QuickLogMacTimelineProvider: TimelineProvider {
    private static let appGroupId = "3Z9ULN66D4.group.app.ottline"
    private static let snapshotKey = "ottline.widget.snapshot.v2"

    public func placeholder(in context: Context) -> QuickLogMacTimelineEntry {
        QuickLogMacTimelineEntry(date: Date(), snapshot: .placeholder)
    }

    public func getSnapshot(in context: Context, completion: @escaping (QuickLogMacTimelineEntry) -> Void) {
        completion(QuickLogMacTimelineEntry(date: Date(), snapshot: loadSnapshot()))
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLogMacTimelineEntry>) -> Void) {
        let entry = QuickLogMacTimelineEntry(date: Date(), snapshot: loadSnapshot())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func loadSnapshot() -> QuickLogMacWidgetSnapshot {
        guard let defaults = UserDefaults(suiteName: Self.appGroupId),
              let data = defaults.data(forKey: Self.snapshotKey),
              let decoded = try? JSONDecoder().decode(QuickLogMacWidgetSnapshot.self, from: data) else {
            return .placeholder
        }
        return decoded
    }
}

public struct QuickLogMacWidgetView: View {
    public var entry: QuickLogMacTimelineEntry
    @Environment(\.widgetFamily) private var family

    // DESIGN.md tokens
    private let warmCream = Color(red: 0.973, green: 0.965, blue: 0.949) // #F8F6F2
    private let cardWhite = Color.white
    private let brandNavy = Color(red: 0.118, green: 0.302, blue: 0.549) // #1E4D8C
    private let brandOrange = Color(red: 1.0, green: 0.6, blue: 0.2) // #FF9933
    private let ink = Color(red: 0.059, green: 0.059, blue: 0.059) // #0F0F0F
    private let mutedInk = Color(red: 0.29, green: 0.29, blue: 0.29) // #4A4A4A
    private let borderColor = Color(red: 0.925, green: 0.922, blue: 0.914) // #ECEBE9

    public var body: some View {
        let snap = entry.snapshot
        let isEn = snap.isEnglish

        VStack(alignment: .leading, spacing: 8) {
            // Header
            HStack {
                Text("ottline")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(brandNavy)
                Spacer()
                Link(destination: URL(string: "ottline://timeline")!) {
                    Text(snap.monthBadge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(brandNavy)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(cardWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(borderColor, lineWidth: 1))
                }
            }

            // Hero Continuing / Recent Card
            if let cont = snap.continueItem {
                let encodedId = cont.titleId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cont.titleId
                let contextLine = [cont.statusBadge, cont.metaText].filter { !$0.isEmpty }.joined(separator: " · ")

                Link(destination: URL(string: "ottline://quick-record?quick=1&title_id=\(encodedId)")!) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(cont.isInProgress
                            ? (isEn ? "Continuing" : "이어가는 이야기")
                            : (isEn ? "Recent memory" : "최근 남긴 이야기")
                        )
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(brandNavy)

                        Text(cont.titleName)
                            .font(.system(size: family == .systemLarge ? 15 : 13.5, weight: .bold))
                            .foregroundStyle(ink)
                            .lineLimit(1)

                        if !contextLine.isEmpty {
                            Text(contextLine)
                                .font(.system(size: 11, weight: .medium))
                                .foregroundStyle(mutedInk)
                                .lineLimit(1)
                        }

                        if family != .systemSmall && !cont.noteSnippet.isEmpty {
                            Text(cont.noteSnippet)
                                .font(.system(size: 11.5))
                                .foregroundStyle(mutedInk)
                                .lineLimit(family == .systemLarge ? 2 : 1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
                    .background(cardWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1))
                }
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    Text(isEn ? "Keep a film, series, or book." : "오늘 만난 이야기를 남겨보세요.")
                        .font(.system(size: 12.5, weight: .medium))
                        .foregroundStyle(mutedInk)
                        .lineLimit(2)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(cardWhite)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1))
            }

            // Additional Recent Items on Large Desktop Widget
            if family == .systemLarge && !snap.recentItems.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text(isEn ? "Recently kept" : "최근 타임라인")
                        .font(.system(size: 10.5, weight: .semibold))
                        .foregroundStyle(mutedInk)

                    ForEach(snap.recentItems.prefix(2)) { item in
                        let encoded = item.titleId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? item.titleId
                        Link(destination: URL(string: "ottline://title/\(encoded)")!) {
                            HStack(spacing: 8) {
                                Text(item.titleName)
                                    .font(.system(size: 12.5, weight: .semibold))
                                    .foregroundStyle(ink)
                                    .lineLimit(1)
                                Spacer(minLength: 4)
                                Text(item.statusLabel)
                                    .font(.system(size: 10.5, weight: .medium))
                                    .foregroundStyle(brandNavy)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1))
                        }
                    }
                }
            }

            Spacer(minLength: 0)

            // Action Shortcut Row
            HStack(spacing: 6) {
                Link(destination: URL(string: "ottline://quick-record?quick=1")!) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 11, weight: .bold))
                        Text(isEn ? "Record" : "빠른 기록")
                            .font(.system(size: 11.5, weight: .bold))
                    }
                    .foregroundStyle(ink)
                    .frame(maxWidth: .infinity, minHeight: 30)
                    .background(brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                if family != .systemSmall {
                    Link(destination: URL(string: "ottline://quick-record?quick=1&type=movie")!) {
                        Text(isEn ? "Video" : "영상")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 30)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1))
                    }

                    Link(destination: URL(string: "ottline://quick-record?quick=1&type=book")!) {
                        Text(isEn ? "Book" : "책")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 30)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(borderColor, lineWidth: 1))
                    }
                }
            }
        }
        .containerBackground(warmCream, for: .widget)
        .widgetURL(URL(string: "ottline://quick-record?quick=1"))
    }
}

@main
public struct QuickLogMacWidget: Widget {
    public let kind: String = "QuickLogMacWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickLogMacTimelineProvider()) { entry in
            QuickLogMacWidgetView(entry: entry)
        }
        .configurationDisplayName("ottline 빠른 기록")
        .description("데스크톱과 알림 센터에서 이어보는 작품을 확인하고 바로 감상·독서 기록을 남길 수 있어요.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
