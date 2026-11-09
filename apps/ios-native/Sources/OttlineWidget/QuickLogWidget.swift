import SwiftUI
import WidgetKit

// Shared model mirroring `SharedWidgetSnapshot` in `AppPreferences.swift`
public struct QuickLogWidgetSnapshot: Codable, Sendable {
    public struct ContinueItem: Codable, Sendable {
        public var titleId: String
        public var titleName: String
        public var isBook: Bool
        public var isInProgress: Bool
        public var metaText: String
        public var noteSnippet: String
    }

    public struct RecentItem: Codable, Sendable {
        public var titleId: String
        public var titleName: String
        public var statusLabel: String
    }

    public var isEnglish: Bool
    public var monthBadge: String
    public var continueItem: ContinueItem?
    public var recentItems: [RecentItem]

    public static let placeholder = QuickLogWidgetSnapshot(
        isEnglish: false,
        monthBadge: "타임라인",
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
    private let borderBeige = Color(red: 0.898, green: 0.882, blue: 0.855) // #E5E1DA
    private let brandNavy = Color(red: 0.118, green: 0.302, blue: 0.549) // #1E4D8C
    private let brandOrange = Color(red: 1.0, green: 0.6, blue: 0.2) // #FF9933
    private let ink = Color(red: 0.059, green: 0.059, blue: 0.059) // #0F0F0F
    private let mutedInk = Color(red: 0.29, green: 0.29, blue: 0.29) // #4A4A4A

    public var body: some View {
        let snap = entry.snapshot
        let isEn = snap.isEnglish

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
                Link(destination: URL(string: "ottline://quick-record?quick=1&title_id=\(cont.titleId)")!) {
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
                    .clipShape(RoundedRectangle(cornerRadius: 7))
                }

                if family != .systemSmall {
                    Link(destination: URL(string: "ottline://quick-record?quick=1&type=movie")!) {
                        Text(isEn ? "Video" : "영상")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 30)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }

                    Link(destination: URL(string: "ottline://quick-record?quick=1&type=book")!) {
                        Text(isEn ? "Book" : "책")
                            .font(.system(size: 11.5, weight: .semibold))
                            .foregroundStyle(ink)
                            .padding(.horizontal, 12)
                            .frame(minHeight: 30)
                            .background(cardWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                    }
                }
            }
        }
        .containerBackground(warmCream, for: .widget)
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
        .description("홈 화면에서 바로 감상·독서 기록을 남기고 이어보는 작품을 확인해요.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
