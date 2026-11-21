import SwiftUI
import WidgetKit

// Shared model mirroring `SharedWidgetSnapshot` in `AppPreferences.swift`
public struct QuickLogWidgetSnapshot: Codable, Sendable {
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

    public struct RecentItem: Codable, Sendable {
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

    public static let placeholder = QuickLogWidgetSnapshot(
        isEnglish: false,
        monthBadge: "타임라인",
        inProgressCount: 0,
        thisMonthDoneCount: 0,
        totalLogCount: 0,
        continueItem: nil,
        recentItems: []
    )
}

public struct QuickLogTimelineEntry: TimelineEntry {
    public let date: Date
    public let snapshot: QuickLogWidgetSnapshot
}

public struct QuickLogTimelineProvider: TimelineProvider {
    private static let appGroupId = "group.app.ottline"
    private static let snapshotKey = "ottline.widget.snapshot.v2"

    public func placeholder(in context: Context) -> QuickLogTimelineEntry {
        QuickLogTimelineEntry(date: Date(), snapshot: .placeholder)
    }

    public func getSnapshot(in context: Context, completion: @escaping (QuickLogTimelineEntry) -> Void) {
        completion(QuickLogTimelineEntry(date: Date(), snapshot: loadSnapshot()))
    }

    public func getTimeline(in context: Context, completion: @escaping (Timeline<QuickLogTimelineEntry>) -> Void) {
        let entry = QuickLogTimelineEntry(date: Date(), snapshot: loadSnapshot())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func loadSnapshot() -> QuickLogWidgetSnapshot {
        guard let defaults = UserDefaults(suiteName: Self.appGroupId),
              let data = defaults.data(forKey: Self.snapshotKey),
              let decoded = try? JSONDecoder().decode(QuickLogWidgetSnapshot.self, from: data) else {
            return .placeholder
        }
        return decoded
    }
}

public struct QuickLogWidgetView: View {
    public var entry: QuickLogTimelineEntry
    @Environment(\.widgetFamily) private var family

    private let warmCream = Color(red: 0.973, green: 0.965, blue: 0.949) // #F8F6F2
    private let cardWhite = Color.white
    private let brandNavy = Color(red: 0.118, green: 0.302, blue: 0.549) // #1E4D8C
    private let brandOrange = Color(red: 1.0, green: 0.6, blue: 0.2) // #FF9933
    private let ink = Color(red: 0.059, green: 0.059, blue: 0.059) // #0F0F0F
    private let mutedInk = Color(red: 0.29, green: 0.29, blue: 0.29) // #4A4A4A

    public var body: some View {
        let snap = entry.snapshot
        let isEn = snap.isEnglish

        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 1) {
                    Image(systemName: snap.continueItem?.isBook == true ? "book.closed.fill" : "plus.circle.fill")
                        .font(.system(size: 15, weight: .semibold))
                    Text(snap.thisMonthDoneCount > 0 ? "\(snap.thisMonthDoneCount)" : "ott")
                        .font(.system(size: 11, weight: .bold))
                }
            }
            .ottlineClearWidgetBackground()
            .widgetURL(URL(string: "ottline://quick-record?quick=1"))

        case .accessoryRectangular:
            Group {
                if let cont = snap.continueItem {
                    let encodedId = cont.titleId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cont.titleId
                    let detailText: String = {
                        if !cont.statusBadge.isEmpty && !cont.metaText.isEmpty {
                            return "\(cont.statusBadge) · \(cont.metaText)"
                        }
                        if !cont.metaText.isEmpty { return cont.metaText }
                        if !cont.statusBadge.isEmpty { return cont.statusBadge }
                        return isEn ? "Tap to record" : "탭해서 이어 기록"
                    }()

                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 4) {
                            Image(systemName: cont.isBook ? "book.fill" : "play.tv.fill")
                                .font(.system(size: 10, weight: .semibold))
                            Text(cont.isInProgress
                                ? (isEn ? "Continuing · ottline" : "이어보는 중 · ottline")
                                : "ottline"
                            )
                            .font(.system(size: 11, weight: .semibold))
                            .lineLimit(1)
                        }
                        .widgetAccentable()

                        Text(cont.titleName)
                            .font(.system(size: 14, weight: .bold))
                            .lineLimit(1)

                        Text(detailText)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .widgetURL(URL(string: "ottline://quick-record?quick=1&title_id=\(encodedId)"))
                } else {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("ottline")
                            .font(.system(size: 11, weight: .bold))
                            .widgetAccentable()
                        Text(isEn ? "Keep what you watch & read" : "보고 읽은 순간을 기록해요")
                            .font(.system(size: 13, weight: .semibold))
                            .lineLimit(1)
                        Text(isEn ? "Tap to log quickly" : "탭해서 빠른 기록 열기")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .widgetURL(URL(string: "ottline://quick-record?quick=1"))
                }
            }
            .ottlineClearWidgetBackground()

        case .accessoryInline:
            Group {
                if let cont = snap.continueItem, cont.isInProgress {
                    Label(cont.titleName, systemImage: cont.isBook ? "book.fill" : "play.tv.fill")
                } else {
                    Label(
                        isEn ? "ottline · \(snap.thisMonthDoneCount) kept" : "ottline · 이달 \(snap.thisMonthDoneCount)편",
                        systemImage: "sparkles"
                    )
                }
            }
            .ottlineClearWidgetBackground()
            .widgetURL(URL(string: "ottline://quick-record?quick=1"))

        default:
            homeWidgetBody(snap: snap, isEn: isEn)
        }
    }

    @ViewBuilder
    private func homeWidgetBody(snap: QuickLogWidgetSnapshot, isEn: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header row
            HStack {
                Text("ottline")
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(brandNavy)
                Spacer()
                Link(destination: URL(string: "ottline://timeline")!) {
                    Text(snap.monthBadge)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(brandNavy)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .background(cardWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
            }

            // Continue / Recent Item
            if let cont = snap.continueItem {
                let encodedId = cont.titleId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? cont.titleId
                let contextLine = [cont.statusBadge, cont.metaText].filter { !$0.isEmpty }.joined(separator: " · ")

                Link(destination: URL(string: "ottline://quick-record?quick=1&title_id=\(encodedId)")!) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(cont.isInProgress
                            ? (isEn ? "Continuing" : "이어가는 이야기")
                            : (isEn ? "Recent memory" : "최근 남긴 이야기")
                        )
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(brandNavy)

                        Text(cont.titleName)
                            .font(.system(size: 13.5, weight: .bold))
                            .foregroundStyle(ink)
                            .lineLimit(1)

                        if !contextLine.isEmpty {
                            Text(contextLine)
                                .font(.system(size: 10.5, weight: .medium))
                                .foregroundStyle(mutedInk)
                                .lineLimit(1)
                        }

                        if family != .systemSmall && !cont.noteSnippet.isEmpty {
                            Text(cont.noteSnippet)
                                .font(.system(size: 11))
                                .foregroundStyle(mutedInk)
                                .lineLimit(1)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(cardWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            } else {
                Text(isEn ? "Keep a film, series, or book." : "오늘 만난 이야기를 남겨보세요.")
                    .font(.system(size: 12.5, weight: .medium))
                    .foregroundStyle(mutedInk)
                    .padding(.vertical, 4)
            }

            Spacer(minLength: 0)

            // Action Shortcut Buttons
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
                    }

                    Link(destination: URL(string: "ottline://quick-record?quick=1&type=book")!) {
                        Text(isEn ? "Book" : "책")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 30)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
        .ottlineHomeWidgetBackground(warmCream)
        .widgetURL(URL(string: "ottline://quick-record?quick=1"))
    }
}

private extension View {
    @ViewBuilder
    func ottlineClearWidgetBackground() -> some View {
        if #available(iOSApplicationExtension 17.0, iOS 17.0, *) {
            self.containerBackground(.clear, for: .widget)
        } else {
            self
        }
    }

    @ViewBuilder
    func ottlineHomeWidgetBackground(_ color: Color) -> some View {
        if #available(iOSApplicationExtension 17.0, iOS 17.0, *) {
            self.containerBackground(color, for: .widget)
        } else {
            self
                .padding(14)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                .background(color)
        }
    }
}

@main
public struct QuickLogWidget: Widget {
    public let kind: String = "QuickLogWidget"

    public init() {}

    public var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickLogTimelineProvider()) { entry in
            QuickLogWidgetView(entry: entry)
        }
        .configurationDisplayName("ottline 빠른 기록")
        .description("홈·잠금 화면에서 바로 감상·독서 기록을 남기고 이어보는 작품을 확인해요.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
