import SwiftUI
import OttlineCore
#if canImport(UIKit)
import UIKit
#endif

// MARK: - 1. PERSONAL REPORT & RECAP STUDIO SCREEN

public struct ReportScreen: View {
    public let repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenTitleDetail: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var report: PersonalReport = PersonalReport()
    @State private var loading: Bool = true
    @State private var selectedRecapKind: RecapCardKind = .weekly
    @State private var recapImage: UIImage?
    @State private var renderingRecap: Bool = false
    @State private var savedToast: String?

    public var body: some View {
        let logs = repository.logs
        let nowMonth = RecordDate.monthKey(nil)
        let monthPosters: [SeasonalRecapPoster] = logs
            .filter { RecordDate.monthKey($0.watchedAt.isEmpty ? $0.createdAt : $0.watchedAt) == nowMonth }
            .prefix(6)
            .map {
                SeasonalRecapPoster(
                    titleId: $0.title.id,
                    title: $0.title.name,
                    titleType: $0.title.type.rawValue,
                    posterUrl: $0.seasonPosterUrl ?? $0.title.posterUrl,
                    count: 1,
                    lastLoggedAt: $0.watchedAt
                )
            }

        let nickname = (repository.prefs.snapshot.nickname ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let headerTitle = nickname.isEmpty
            ? OttlineStrings.tr("내 이용 리포트", "My usage report", locale: locale)
            : OttlineStrings.tr("\(nickname)의 이용 리포트", "\(nickname)'s usage report", locale: locale)
        let showH1Tab = PersonalReportBuilder.isH1RecapVisible() && report.seasonalRecap != nil

        VStack(spacing: 0) {
            subScreenHeader(title: headerTitle, onBack: onBack)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Summary Metrics Grid (6 cards)
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        metricCard(
                            label: OttlineStrings.tr("총 기록", "Total records", locale: locale),
                            value: "\(report.totalLogs)"
                        )
                        metricCard(
                            label: OttlineStrings.tr("이번 달 기록", "This month", locale: locale),
                            value: "\(report.thisMonthLogs)"
                        )
                        metricCard(
                            label: OttlineStrings.tr("다 본 비율", "Completion rate", locale: locale),
                            value: "\(Int(report.doneRatePct.rounded()))%"
                        )
                        metricCard(
                            label: OttlineStrings.tr("메모 남긴 비율", "With a note", locale: locale),
                            value: "\(Int(report.noteFillPct.rounded()))%"
                        )
                        metricCard(
                            label: OttlineStrings.tr("자주 남긴 유형", "Top type", locale: locale),
                            value: formattedTopType(report.topType)
                        )
                        metricCard(
                            label: OttlineStrings.tr("자주 찾은 플랫폼", "Top platform", locale: locale),
                            value: report.topOtt.isEmpty ? "-" : report.topOtt
                        )
                    }

                    // Revisit & Moment Insights (4 cards)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(OttlineStrings.tr("기록의 흐름", "Record highlights", locale: locale))
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)

                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                            metricCard(
                                label: OttlineStrings.tr("지난주 기록", "Last week", locale: locale),
                                value: locale == "en" ? "\(report.previousWeekLogs) logs" : "\(report.previousWeekLogs)편"
                            )
                            metricCard(
                                label: OttlineStrings.tr("이번 달 장르", "Monthly genre", locale: locale),
                                value: (report.monthlyTopGenre?.isEmpty == false) ? report.monthlyTopGenre! : "-"
                            )
                            metricCard(
                                label: OttlineStrings.tr("마지막 기록 후", "Days since last", locale: locale),
                                value: report.daysSinceLastLog.map { locale == "en" ? "\($0)d" : "\($0)일" } ?? "-"
                            )
                            if let seriesId = report.continueSeriesTitleId, let seriesName = report.continueSeriesTitle {
                                Button {
                                    onOpenTitleDetail(seriesId)
                                } label: {
                                    VStack(alignment: .leading, spacing: 6) {
                                        Text(OttlineStrings.tr("이어볼 시리즈", "Continue series", locale: locale))
                                            .font(OttlineFont.regular(12))
                                            .foregroundStyle(palette.mutedInk)
                                        Text(seriesName)
                                            .font(OttlineFont.semiBold(15))
                                            .foregroundStyle(palette.primaryAccent)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                    }
                                    .padding(14)
                                    .frame(maxWidth: .infinity, minHeight: 82, alignment: .topLeading)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.border, lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            } else {
                                metricCard(
                                    label: OttlineStrings.tr("연속 기록", "Streak", locale: locale),
                                    value: locale == "en" ? "\(report.streakDays)d" : "\(report.streakDays)일"
                                )
                            }
                        }
                    }

                    // 9:16 Recap Share Card Studio
                    VStack(alignment: .leading, spacing: 14) {
                        Text(OttlineStrings.tr("다시 열어볼 이유", "Reasons to revisit", locale: locale))
                            .font(OttlineFont.semiBold(17))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr(
                            "주간 회고, 월간 장르, 기록 공백, 시리즈 이어보기를 한곳에 모았습니다.",
                            "Weekly recaps, monthly genres, record gaps, and series reminders live here.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)

                        HStack(spacing: 8) {
                            recapTabButton(.weekly, label: OttlineStrings.tr("지난주 기록 회고", "Weekly recap", locale: locale))
                            recapTabButton(.monthly, label: OttlineStrings.tr("이번 달 장르 회고", "Monthly recap", locale: locale))
                            if showH1Tab {
                                recapTabButton(.halfYear, label: OttlineStrings.tr("2026 상반기", "2026 H1", locale: locale))
                            }
                        }

                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(palette.paperStrong)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            if renderingRecap {
                                ProgressView()
                                    .padding(48)
                            } else if let img = recapImage {
                                Image(uiImage: img)
                                    .resizable()
                                    .scaledToFit()
                                    .frame(maxHeight: 390)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .padding(12)
                            }
                        }

                        if let savedToast {
                            Text(savedToast)
                                .font(OttlineFont.medium(13))
                                .foregroundStyle(palette.success)
                        }

                        HStack(spacing: 10) {
                            Button {
                                guard let img = recapImage else { return }
                                CardExporter.saveImageToPhotos(img)
                                savedToast = OttlineStrings.tr("리캡 카드를 사진함에 저장했어요.", "Saved recap card to Photos.", locale: locale)
                            } label: {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .download, size: 15, color: palette.ink)
                                    Text(OttlineStrings.tr("카드 저장", "Save card", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.ink)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)

                            Button {
                                guard let img = recapImage else { return }
                                CardExporter.presentImageShareSheet(
                                    img,
                                    title: OttlineStrings.tr("ottline 리캡 카드", "ottline recap card", locale: locale)
                                )
                            } label: {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .share2, size: 15, color: palette.onBrandOrange)
                                    Text(OttlineStrings.tr("공유하기", "Share", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.onBrandOrange)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(recapImage == nil)
                        }
                    }
                    .padding(16)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )

                    // Breakdown Sections (Status, Type, Top Platforms, Top Genres)
                    if !report.byStatus.isEmpty {
                        breakdownCard(
                            title: OttlineStrings.tr("상태별 기록", "By status", locale: locale),
                            rows: report.byStatus.map { (statusDisplay($0.status), $0.count) }
                        )
                    }

                    if !report.byType.isEmpty {
                        breakdownCard(
                            title: OttlineStrings.tr("유형별 기록", "By type", locale: locale),
                            rows: report.byType.map { (formattedTopType($0.type), $0.count) }
                        )
                    }

                    if !report.topOtts.isEmpty {
                        breakdownCard(
                            title: OttlineStrings.tr("자주 찾은 플랫폼", "Top platforms", locale: locale),
                            rows: report.topOtts.map { ($0.name, $0.count) }
                        )
                    }

                    if !report.topGenres.isEmpty {
                        breakdownCard(
                            title: OttlineStrings.tr("자주 만난 장르", "Top genres", locale: locale),
                            rows: report.topGenres.map { ($0.name, $0.count) }
                        )
                    }

                    OttlineAppFooter()
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
            }
        }
        .background(palette.background)
        .task {
            loading = true
            let localReport = PersonalReportBuilder.buildFromLocalLogs(logs)
            report = localReport
            if !(repository.prefs.snapshot.userId ?? "").isEmpty,
               let remote = try? await repository.api.getPersonalReport() {
                report = PersonalReportBuilder.merging(remote: remote, localLogs: logs)
            }
            if !PersonalReportBuilder.isH1RecapVisible() && selectedRecapKind == .halfYear {
                selectedRecapKind = .weekly
            }
            loading = false
            await renderCurrentRecap(monthPosters: monthPosters)
        }
        .onChange(of: selectedRecapKind) { _, _ in
            Task { await renderCurrentRecap(monthPosters: monthPosters) }
        }
    }

    @ViewBuilder
    private func metricCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
            Text(value)
                .font(OttlineFont.bold(19))
                .foregroundStyle(palette.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 82, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func breakdownCard(title: String, rows: [(String, Int)]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(OttlineFont.semiBold(16))
                .foregroundStyle(palette.ink)

            VStack(spacing: 0) {
                ForEach(Array(rows.enumerated()), id: \.offset) { idx, row in
                    if idx > 0 {
                        Rectangle().fill(palette.border).frame(height: 1)
                    }
                    HStack {
                        Text(row.0)
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.ink)
                        Spacer()
                        Text("\(row.1)")
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .padding(.vertical, 11)
                    .padding(.horizontal, 14)
                }
            }
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
    }

    private func formattedTopType(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "-" }
        if let type = TitleType(rawValue: raw.lowercased()) {
            return OttlineStrings.titleTypeLabel(type, locale: locale)
        }
        return raw
    }

    private func statusDisplay(_ raw: String) -> String {
        switch raw.uppercased() {
        case "DONE": return OttlineStrings.tr("봤어요·읽었어요", "Completed", locale: locale)
        case "IN_PROGRESS": return OttlineStrings.tr("보는 중·읽는 중", "In progress", locale: locale)
        case "WISHLIST": return OttlineStrings.tr("보고 싶어요·읽고 싶어요", "Wishlist", locale: locale)
        default: return raw
        }
    }

    private func recapTabButton(_ kind: RecapCardKind, label: String) -> some View {
        let selected = selectedRecapKind == kind
        return Button {
            selectedRecapKind = kind
        } label: {
            Text(label)
                .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                .padding(.horizontal, 10)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(selected ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private func renderCurrentRecap(monthPosters: [SeasonalRecapPoster]) async {
        renderingRecap = true
        let snap = repository.prefs.snapshot
        let isEn = locale == "en"
        let rawTopGenre = (report.monthlyTopGenre ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        let posters: [RecapShareCardPosterPayload] = {
            switch selectedRecapKind {
            case .weekly:
                return (report.previousWeekPosters ?? []).prefix(6).map {
                    RecapShareCardPosterPayload(title: $0.title, titleType: $0.titleType, posterUrl: $0.posterUrl, count: $0.count)
                }
            case .monthly:
                return monthPosters.prefix(6).map {
                    RecapShareCardPosterPayload(title: $0.title, titleType: $0.titleType, posterUrl: $0.posterUrl, count: $0.count)
                }
            case .halfYear:
                return (report.seasonalRecap?.posters ?? monthPosters).prefix(6).map {
                    RecapShareCardPosterPayload(title: $0.title, titleType: $0.titleType, posterUrl: $0.posterUrl, count: $0.count)
                }
            }
        }()

        let wireKind: String
        let titleText: String
        let subtitleText: String
        let periodLabel: String?
        let stats: [RecapShareCardStatPayload]

        switch selectedRecapKind {
        case .weekly:
            wireKind = "weekly"
            titleText = isEn ? "Weekly record recap" : "지난주 기록 회고"
            subtitleText = isEn
                ? "\(report.previousWeekLogs) records from last week, gathered into one card."
                : "지난주 남긴 \(report.previousWeekLogs)개의 기록을 한 장에 모았습니다."
            periodLabel = nil
            stats = [
                RecapShareCardStatPayload(label: isEn ? "Last week's records" : "지난주 기록", value: "\(report.previousWeekLogs)"),
                RecapShareCardStatPayload(label: isEn ? "Total records" : "총 기록", value: "\(report.totalLogs)"),
                RecapShareCardStatPayload(label: isEn ? "Recording streak" : "연속 기록", value: "\(report.streakDays)")
            ]
        case .monthly:
            wireKind = "monthly"
            titleText = isEn ? "Monthly genre recap" : "이번 달 장르 회고"
            subtitleText = rawTopGenre.isEmpty
                ? (isEn ? "Log more this month to make your genre card richer." : "이번 달 기록을 더 남기면 장르 회고 카드가 풍성해집니다.")
                : (isEn ? "Your most logged genre this month is \(rawTopGenre), with \(report.monthlyTopGenreCount) records." : "이번 달 가장 많이 남긴 장르는 \(rawTopGenre)입니다. 총 \(report.monthlyTopGenreCount)회 기록했어요.")
            periodLabel = RecordDate.formatMonthLabel(RecordDate.monthKey(nil), locale: locale)
            stats = [
                RecapShareCardStatPayload(label: isEn ? "Records this month" : "이번 달 기록", value: "\(report.thisMonthLogs)"),
                RecapShareCardStatPayload(label: isEn ? "Top genre this month" : "이번 달 최다 장르", value: rawTopGenre.isEmpty ? "-" : rawTopGenre),
                RecapShareCardStatPayload(label: isEn ? "Records with a note" : "메모 남긴 비율", value: "\(Int(report.noteFillPct.rounded()))%")
            ]
        case .halfYear:
            wireKind = "half-year"
            let h1Count = report.seasonalRecap?.totalLogs ?? report.totalLogs
            titleText = isEn ? "2026 first-half recap" : "2026년 상반기 돌아보기"
            subtitleText = isEn
                ? "A poster recap of your \(h1Count) records from the first half of 2026."
                : "상반기에 남긴 \(h1Count)개의 기록을 포스터 카드로 모았어요."
            periodLabel = isEn ? "Jan 1 - Jun 30, 2026" : "2026.01.01 - 2026.06.30"
            stats = [
                RecapShareCardStatPayload(label: isEn ? "First-half records" : "상반기 기록", value: "\(h1Count)"),
                RecapShareCardStatPayload(label: isEn ? "Most recorded type" : "가장 많이 남긴 종류", value: formattedTopType(report.seasonalRecap?.topType ?? report.topType)),
                RecapShareCardStatPayload(label: isEn ? "Records with a note" : "메모 남긴 비율", value: "\(Int((report.seasonalRecap?.noteFillPct ?? report.noteFillPct).rounded()))%")
            ]
        }

        let payload = RecapShareCardRequestPayload(
            recapKind: wireKind,
            format: "story",
            title: titleText,
            subtitle: subtitleText,
            periodLabel: periodLabel,
            posterItems: posters,
            stats: stats,
            footer: selectedRecapKind == .halfYear
                ? (isEn ? "A first half of watching, reading, and remembering" : "보고, 읽고, 남긴 상반기")
                : "ottline.app"
        )

        var rendered: UIImage?
        if let pngData = try? await repository.api.renderServerShareCard(payload),
           let serverImg = UIImage(data: pngData) {
            rendered = serverImg
        }

        let finalImage: UIImage
        if let rendered {
            finalImage = rendered
        } else {
            finalImage = await CardExporter.renderRecapCardImage(
                kind: selectedRecapKind,
                report: report,
                monthPosters: monthPosters,
                nickname: snap.nickname,
                locale: locale
            )
        }
        recapImage = finalImage
        renderingRecap = false
    }
}

// MARK: - 2. KDC BOOKSHELF SCREEN (`000`~`900`)

public struct BookshelfScreen: View {
    public let repository: OttlineRepository
    public var initialKdcMajor: Int? = nil
    public var onBack: () -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecordBook: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var selectedMajor: Int? = nil
    @State private var retrying: Bool = false

    public var body: some View {
        let (gridShelves, unclassified) = BookshelfBuilder.buildShelfGrid(
            logs: repository.logs,
            classificationsByIsbn: repository.bookClassifications
        )
        let totalBooks = gridShelves.reduce(0) { $0 + $1.books.count } + unclassified.count
        let visibleShelves: [BookshelfSection] = {
            if let selectedMajor {
                return gridShelves.filter { $0.major == selectedMajor }
            }
            return gridShelves.filter { !$0.books.isEmpty }
        }()

        VStack(spacing: 0) {
            subScreenHeader(
                title: OttlineStrings.tr("내 서가 (KDC 000~900)", "My Bookshelf (KDC 000-900)", locale: locale),
                onBack: onBack
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text(OttlineStrings.tr(
                        "한국십진분류법(KDC) 대분류 기준으로 정리한 \(totalBooks)권의 책이에요.",
                        "\(totalBooks) books organized by Korean Decimal Classification (000–900).",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)

                    // 2-Column 10-Cell KDC Overview Grid
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                        ForEach(gridShelves) { shelf in
                            let isSelected = selectedMajor != nil && selectedMajor == shelf.major
                            Button {
                                if selectedMajor == shelf.major {
                                    selectedMajor = nil
                                } else {
                                    selectedMajor = shelf.major
                                }
                            } label: {
                                HStack(spacing: 8) {
                                    Text(shelf.codeLabel)
                                        .font(.system(size: 12.5, weight: .bold, design: .monospaced))
                                        .foregroundStyle(isSelected ? palette.onBrandNavy : palette.primaryAccent)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 4)
                                        .background(isSelected ? palette.brandNavy : palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))

                                    Text(locale == "en" ? shelf.titleEn : shelf.titleKo)
                                        .font(isSelected ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(1)

                                    Spacer(minLength: 4)

                                    Text("\(shelf.books.count)")
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(shelf.books.isEmpty ? palette.subtleInk : palette.primaryAccent)
                                }
                                .padding(.horizontal, 12)
                                .frame(minHeight: 48)
                                .background(isSelected ? palette.paperStrong : palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(isSelected ? palette.primaryAccent : palette.border, lineWidth: isSelected ? 1.5 : 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    if totalBooks == 0 {
                        VStack(spacing: 12) {
                            Text(OttlineStrings.tr("아직 서가에 꽂힌 책이 없어요.", "No books on your shelf yet.", locale: locale))
                                .font(OttlineFont.medium(15))
                                .foregroundStyle(palette.mutedInk)
                            Button(action: onOpenQuickRecordBook) {
                                Text(OttlineStrings.tr("첫 책 기록 남기기", "Log your first book", locale: locale))
                                    .font(OttlineFont.semiBold(14.5))
                                    .foregroundStyle(palette.onBrandOrange)
                                    .padding(.horizontal, 20)
                                    .frame(minHeight: 48)
                                    .background(palette.brandOrange)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    } else {
                        if selectedMajor != nil {
                            Button {
                                selectedMajor = nil
                            } label: {
                                Text(OttlineStrings.tr("모든 책칸 보기", "Show all shelves", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            .buttonStyle(.plain)
                        }

                        ForEach(visibleShelves) { sec in
                            shelfSectionCard(
                                codeLabel: sec.codeLabel,
                                title: locale == "en" ? sec.titleEn : sec.titleKo,
                                books: sec.books
                            )
                        }

                        // Unclassified / Waiting Area
                        if selectedMajor == nil && !unclassified.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 4) {
                                        Text(BookshelfBuilder.waitingCopy(locale: locale))
                                            .font(OttlineFont.semiBold(15))
                                            .foregroundStyle(palette.ink)
                                        Text(OttlineStrings.tr(
                                            "분류 정보가 확인되면 해당 KDC 책칸으로 자동 이동해요.",
                                            "Once classification resolves, these move to their KDC shelf automatically.",
                                            locale: locale
                                        ))
                                        .font(OttlineFont.regular(12.5))
                                        .foregroundStyle(palette.mutedInk)
                                    }
                                    Spacer()
                                    Button {
                                        Task { await retryClassifications() }
                                    } label: {
                                        HStack(spacing: 5) {
                                            if retrying {
                                                ProgressView().scaleEffect(0.75)
                                            } else {
                                                OttlineLucideIcon(kind: .rotateCcw, size: 13.5, color: palette.primaryAccent)
                                            }
                                            Text(OttlineStrings.tr("분류 다시 확인", "Recheck", locale: locale))
                                                .font(OttlineFont.semiBold(13))
                                        }
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.horizontal, 12)
                                        .frame(minHeight: 38)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(retrying)
                                }

                                shelfBooksRow(unclassified)
                            }
                            .padding(16)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                    }

                    OttlineAppFooter()
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
            }
        }
        .background(palette.background)
        .onAppear {
            if selectedMajor == nil {
                selectedMajor = initialKdcMajor
            }
            repository.trackEvent("bookshelf_open")
        }
        .task {
            let books = repository.logs.map(\.title).filter { $0.type == .book }
            await repository.ensureBookClassificationsCached(titles: books)
        }
    }

    @ViewBuilder
    private func shelfSectionCard(codeLabel: String, title: String, books: [BookshelfBookItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(codeLabel)
                    .font(.system(size: 13, weight: .bold, design: .monospaced))
                    .foregroundStyle(palette.primaryAccent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 6))

                Text(title)
                    .font(OttlineFont.semiBold(17))
                    .foregroundStyle(palette.ink)

                Spacer()

                Text("\(books.count)")
                    .font(OttlineFont.medium(13))
                    .foregroundStyle(palette.mutedInk)
            }

            if books.isEmpty {
                Text(OttlineStrings.tr("이 책칸에는 아직 책이 없어요.", "No books in this shelf yet.", locale: locale))
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.subtleInk)
                    .padding(.vertical, 8)
            } else {
                shelfBooksRow(books)
            }
        }
        .padding(16)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func shelfBooksRow(_ books: [BookshelfBookItem]) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 14) {
                ForEach(books) { book in
                    Button {
                        onOpenTitleDetail(book.representativeLog.title.id)
                    } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            PosterImage(
                                posterUrl: book.representativeLog.title.posterUrl,
                                titleName: book.representativeLog.title.name,
                                titleType: .book,
                                width: 84,
                                height: 122,
                                cornerRadius: 6
                            )
                            Text(book.representativeLog.title.name)
                                .font(OttlineFont.semiBold(13))
                                .foregroundStyle(palette.ink)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                                .frame(width: 84, alignment: .leading)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func retryClassifications() async {
        guard !retrying else { return }
        retrying = true
        let books = repository.logs.map(\.title).filter { $0.type == .book }
        await repository.ensureBookClassificationsCached(titles: books, forceRetryNotFound: true)
        retrying = false
    }
}

// MARK: - 3. FEEDBACK & SUPPORT THREADS SCREEN

public struct FeedbackScreen: View {
    public let repository: OttlineRepository
    public var prefilledBody: String?
    public var onConsumePrefill: () -> Void
    public var onBack: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var threads: [FeedbackThreadSummary] = []
    @State private var activeDetail: FeedbackThreadDetail?
    @State private var loading: Bool = true
    @State private var category: FeedbackCategory = .idea
    @State private var subject: String = ""
    @State private var bodyText: String = ""
    @State private var submitting: Bool = false

    public var body: some View {
        VStack(spacing: 0) {
            subScreenHeader(
                title: activeDetail?.subject ?? OttlineStrings.tr("내 문의함", "My inbox", locale: locale),
                onBack: {
                    if activeDetail != nil {
                        activeDetail = nil
                    } else {
                        onBack()
                    }
                }
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let detail = activeDetail {
                        HStack {
                            Text(OttlineStrings.feedbackCategoryLabel(detail.category, locale: locale))
                                .font(OttlineFont.medium(12))
                                .foregroundStyle(palette.mutedInk)
                            Spacer()
                            Text(OttlineStrings.feedbackStatusLabel(detail.status, locale: locale))
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.primaryAccent)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 4)
                                .background(palette.paperStrong)
                                .clipShape(Capsule())
                        }

                        ForEach(detail.messages) { msg in
                            let isAdmin = msg.authorRole == .admin
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(isAdmin
                                        ? OttlineStrings.tr("ottline 답변", "ottline team", locale: locale)
                                        : OttlineStrings.tr("내 문의", "My message", locale: locale)
                                    )
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.primaryAccent)
                                    Spacer()
                                    Text(RecordDate.formatDisplayDate(msg.createdAt, locale: locale))
                                        .font(OttlineFont.regular(11.5))
                                        .foregroundStyle(palette.subtleInk)
                                }

                                Text(msg.body)
                                    .font(OttlineFont.regular(14))
                                    .foregroundStyle(palette.ink)
                                    .lineSpacing(3)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(isAdmin ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }

                        Text(OttlineStrings.tr(
                            "ottline 팀의 답변이 등록되면 이 화면에서 바로 확인할 수 있어요. 추가 문의가 필요하면 새 문의를 남겨주세요.",
                            "When the ottline team replies, it will appear right here. Start a new message if you need anything else.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    } else {
                        Text(OttlineStrings.tr(
                            "질문이나 불편한 점, 아이디어를 남겨주세요. ottline의 답변도 여기에서 확인할 수 있어요.",
                            "Send a question, report a problem, or share an idea. Replies from the ottline team appear here.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.mutedInk)

                        // Composer
                        VStack(alignment: .leading, spacing: 10) {
                            Text(OttlineStrings.tr("문의 남기기", "Send a message", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 8) {
                                    ForEach(FeedbackCategory.allCases, id: \.self) { cat in
                                        let selected = category == cat
                                        Button {
                                            category = cat
                                        } label: {
                                            Text(OttlineStrings.feedbackCategoryLabel(cat, locale: locale))
                                                .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                                                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                                .padding(.horizontal, 12)
                                                .frame(minHeight: 36)
                                                .background(selected ? palette.brandNavy : palette.paperStrong)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            TextField(
                                OttlineStrings.tr("예: 기록 연결 코드가 보이지 않아요", "Example: I can’t find my connection code", locale: locale),
                                text: $subject
                            )
                            .font(OttlineFont.regular(14))
                            .padding(12)
                            .background(palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                            TextField(
                                OttlineStrings.tr(
                                    "무엇이 궁금한지, 어떤 상황에서 문제가 발생했는지 자세히 남겨주세요.",
                                    "Tell us what you are trying to do and what went wrong.",
                                    locale: locale
                                ),
                                text: $bodyText,
                                axis: .vertical
                            )
                            .lineLimit(3...6)
                            .font(OttlineFont.regular(14))
                            .padding(12)
                            .background(palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                            Button {
                                Task { await createThread() }
                            } label: {
                                Text(submitting
                                    ? OttlineStrings.tr("보내는 중…", "Sending…", locale: locale)
                                    : OttlineStrings.tr("문의 보내기", "Send message", locale: locale)
                                )
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.onBrandOrange)
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || submitting)
                        }
                        .padding(16)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )

                        Text(OttlineStrings.tr("내 문의 목록", "My messages", locale: locale))
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)
                            .padding(.top, 4)

                        if threads.isEmpty && !loading {
                            Text(OttlineStrings.tr("아직 보낸 문의가 없어요.", "You haven’t sent any messages yet.", locale: locale))
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.vertical, 12)
                        }

                        ForEach(threads) { t in
                            Button {
                                Task {
                                    activeDetail = try? await repository.api.getFeedbackThreadDetail(threadId: t.id)
                                }
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    HStack {
                                        Text((t.subject?.isEmpty == false)
                                            ? t.subject!
                                            : OttlineStrings.feedbackCategoryLabel(t.category, locale: locale)
                                        )
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)
                                        Spacer()
                                        Text(OttlineStrings.feedbackStatusLabel(t.status, locale: locale))
                                            .font(OttlineFont.semiBold(12))
                                            .foregroundStyle(palette.primaryAccent)
                                    }
                                    if let preview = t.lastMessagePreview, !preview.isEmpty {
                                        Text(preview)
                                            .font(OttlineFont.regular(13))
                                            .foregroundStyle(palette.mutedInk)
                                            .lineLimit(2)
                                    }
                                }
                                .padding(14)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    OttlineAppFooter()
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
            }
        }
        .background(palette.background)
        .onAppear {
            if let pre = prefilledBody, !pre.isEmpty {
                category = .bug
                subject = locale == "en" ? "Content Report" : "콘텐츠 신고"
                bodyText = pre
                onConsumePrefill()
            }
        }
        .task {
            await reloadThreads()
        }
    }

    private func reloadThreads() async {
        loading = true
        _ = try? await repository.ensureAuthenticated()
        threads = (try? await repository.api.getFeedbackThreads()) ?? []
        loading = false
    }

    private func createThread() async {
        let trimmed = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !submitting else { return }
        submitting = true
        _ = try? await repository.ensureAuthenticated()
        if let created = try? await repository.api.createFeedbackThread(category: category, subject: subject, body: trimmed) {
            subject = ""
            bodyText = ""
            activeDetail = created
            await reloadThreads()
        }
        submitting = false
    }
}

// MARK: - 4. GUIDES, ABOUT, FAQ & PRIVACY SCREEN

public enum GuideInfoMode: Equatable, Sendable {
    case guides
    case about
    case faq
    case privacy
}

private struct GuideArticleItem: Identifiable {
    let slug: String
    let titleKo: String
    let titleEn: String
    let summaryKo: String
    let summaryEn: String
    let bodyKo: String
    let bodyEn: String
    var id: String { slug }
}

private let canonicalGuideArticles: [GuideArticleItem] = [
    GuideArticleItem(
        slug: "ott-watch-log-guide",
        titleKo: "OTT 시청 기록 남기기 가이드",
        titleEn: "How to keep a calm OTT watch log",
        summaryKo: "별점이나 긴 리뷰 없이 10초 안에 작품을 남기는 방법",
        summaryEn: "Log what you watched in seconds without star pressure",
        bodyKo: "ottline은 영화, 시리즈, 책을 3가지 상태(봤어요·보는 중·보고 싶어요)로 먼저 가볍게 남깁니다. 날짜, 플랫폼, 장소와 함께한 사람, 짧은 한 줄 메모는 남기고 싶을 때만 덧붙이면 됩니다.",
        bodyEn: "Start by tapping Watched, Watching, or Want to watch. Add the date, platform, place, company, or a one-line note only when you feel like remembering it."
    ),
    GuideArticleItem(
        slug: "netflix-watch-history-log",
        titleKo: "넷플릭스·티빙 기록 한곳에 모으기",
        titleEn: "Unify records across Netflix and other platforms",
        summaryKo: "플랫폼이 달라도 하나의 타임라인에서 이어서 보는 법",
        summaryEn: "Keep records from multiple services in one personal timeline",
        bodyKo: "서비스가 바뀌거나 구독을 해지해도 내 타임라인에는 그대로 남습니다. 그날의 플랫폼을 함께 기록해 두면 나중에 어디에서 무엇을 즐겼는지 바로 찾을 수 있어요.",
        bodyEn: "Even if you pause a subscription or switch apps, your timeline stays intact. Tagging the platform helps you remember where each story happened."
    ),
    GuideArticleItem(
        slug: "series-season-episode-tracker",
        titleKo: "시리즈 시즌·에피소드 이어보기",
        titleEn: "Tracking series seasons and episodes",
        summaryKo: "몇 화까지 봤는지 기억나지 않을 때 시즌·에피소드 남기기",
        summaryEn: "Keep your place across long series and returning seasons",
        bodyKo: "시리즈를 선택하면 시즌과 에피소드 번호를 함께 기록할 수 있어요. 홈 화면의 ‘이어보는 이야기’에서 최근 보던 작품을 바로 열어 다음 회차로 고쳐 남길 수 있습니다.",
        bodyEn: "When logging a series, pick the current season and episode. Active series appear under Continuing Stories on Home for quick updates."
    ),
    GuideArticleItem(
        slug: "book-movie-unified-log",
        titleKo: "영화·시리즈·책 함께 기록하고 KDC 서가로 보기",
        titleEn: "Movies, series, and books together + KDC shelf",
        summaryKo: "원작 책과 영상 작품을 하나의 흐름으로 정리하는 방법",
        summaryEn: "Keep books and screen stories on one timeline with KDC shelves",
        bodyKo: "한 작품의 소설과 영화를 나란히 기록하고, 책 기록은 한국십진분류법(KDC 000~900) 기준의 내 서가에서 분야별로 모아볼 수 있습니다.",
        bodyEn: "Log adaptations side-by-side with books. Korean Decimal Classification (KDC 000-900) automatically organizes your books on My Bookshelf."
    ),
    GuideArticleItem(
        slug: "watch-log-with-context",
        titleKo: "언제 어디서 누구와 — 맥락 있는 기록",
        titleEn: "Recording the moment: when, where, with whom",
        summaryKo: "작품과 함께 그날의 공기를 기억하는 방법",
        summaryEn: "Preserve the setting and company around what you watched",
        bodyKo: "홈 화면의 ‘그날의 순간 다시 보기’나 타임라인의 맥락 필터로 집, 극장, 카페, 혼자 혹은 친구와 함께했던 기록만 골라 다시 꺼내 볼 수 있어요.",
        bodyEn: "Add optional place and companion context so you can revisit quiet nights at home, theater trips, or weekend watches with friends."
    ),
    GuideArticleItem(
        slug: "multi-device-sync-without-login",
        titleKo: "회원가입 없이 여러 기기 연결하기",
        titleEn: "Sync devices with a pairing code (no login)",
        summaryKo: "연결 코드 하나로 웹·iOS·Android 기록 이어보기",
        summaryEn: "Carry one timeline across Web, iOS, and Android via code",
        bodyKo: "나의 공간에서 발급된 기록 연결 코드를 다른 기기에 입력하면 기존 기록이 하나로 합쳐지고 실시간으로 동기화됩니다.",
        bodyEn: "Open My Space on any device to view or enter your connection code and merge records onto one shared timeline."
    )
]

public struct GuideInfoScreen: View {
    public var initialSlug: String? = nil
    public var mode: GuideInfoMode = .guides
    public var onBack: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @State private var activeSlug: String?

    private var headerTitle: String {
        switch mode {
        case .guides: return OttlineStrings.tr("기록 가이드", "Recording guides", locale: locale)
        case .about: return OttlineStrings.tr("ottline 소개", "About ottline", locale: locale)
        case .faq: return OttlineStrings.tr("자주 묻는 질문", "FAQ", locale: locale)
        case .privacy: return OttlineStrings.tr("개인정보처리방침", "Privacy Policy", locale: locale)
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            subScreenHeader(title: headerTitle, onBack: onBack)

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    switch mode {
                    case .guides:
                        guidesBody
                    case .about:
                        aboutBody
                    case .faq:
                        faqBody
                    case .privacy:
                        privacyBody
                    }

                    OttlineAppFooter()
                }
                .padding(.horizontal, 18)
                .padding(.top, 16)
            }
        }
        .background(palette.background)
        .onAppear {
            if activeSlug == nil {
                activeSlug = initialSlug
            }
        }
    }

    @ViewBuilder
    private var guidesBody: some View {
        if let slug = activeSlug, let article = canonicalGuideArticles.first(where: { $0.slug == slug }) {
            Button {
                activeSlug = nil
            } label: {
                HStack(spacing: 4) {
                    OttlineLucideIcon(kind: .chevronLeft, size: 16, color: palette.primaryAccent)
                    Text(OttlineStrings.tr("가이드 목록으로", "All guides", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.primaryAccent)
                }
            }
            .buttonStyle(.plain)

            infoCard(
                title: locale == "en" ? article.titleEn : article.titleKo,
                body: locale == "en" ? article.bodyEn : article.bodyKo
            )
        } else {
            ForEach(canonicalGuideArticles) { article in
                Button {
                    activeSlug = article.slug
                } label: {
                    HStack(alignment: .top, spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text(locale == "en" ? article.titleEn : article.titleKo)
                                .font(OttlineFont.semiBold(15.5))
                                .foregroundStyle(palette.primaryAccent)
                                .multilineTextAlignment(.leading)
                            Text(locale == "en" ? article.summaryEn : article.summaryKo)
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .multilineTextAlignment(.leading)
                        }
                        Spacer(minLength: 0)
                        OttlineLucideIcon(kind: .chevronRight, size: 16, color: palette.subtleInk)
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private var aboutBody: some View {
        infoCard(
            title: OttlineStrings.tr("한 손 수첩처럼 가벼운 기록장", "A pocket notebook for stories", locale: locale),
            body: OttlineStrings.tr(
                "ottline은 오늘 본 영화·시리즈·책과 그날의 순간을 조용히 모아두는 개인 기록 서비스입니다. 로그인이나 별점 부담 없이 바로 남기고, 연결 코드 하나로 어떤 기기에서든 이어볼 수 있어요.",
                "ottline is a calm personal notebook for movies, series, and books you want to remember—no account wall or star-rating pressure.",
                locale: locale
            )
        )

        VStack(alignment: .leading, spacing: 10) {
            Text(OttlineStrings.tr("만날 수 있는 곳", "Available channels", locale: locale))
                .font(OttlineFont.semiBold(16))
                .foregroundStyle(palette.ink)

            let channels: [(String, String, String?)] = [
                ("Web / PWA", "https://ottline.app", "https://ottline.app"),
                ("Android (Google Play)", "app.ottline", "https://play.google.com/store/apps/details?id=app.ottline"),
                ("iOS (App Store)", "ottline", "https://apps.apple.com/app/ottline/id6780318110"),
                ("Windows (Microsoft Store)", "On the Timeline", nil),
                (OttlineStrings.tr("브라우저 확장", "Browser Extensions", locale: locale), "Chrome · Edge · Whale", nil),
                (OttlineStrings.tr("토스 미니앱", "Toss Mini App", locale: locale), OttlineStrings.tr("내 OTT 타임라인", "My OTT Timeline", locale: locale), nil),
                ("ChatGPT", OttlineStrings.tr("준비 중", "Coming soon", locale: locale), nil)
            ]

            VStack(spacing: 0) {
                ForEach(Array(channels.enumerated()), id: \.offset) { idx, ch in
                    if idx > 0 {
                        Rectangle().fill(palette.border).frame(height: 1)
                    }
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(ch.0)
                                .font(OttlineFont.semiBold(14))
                                .foregroundStyle(palette.ink)
                            Text(ch.1)
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)
                        }
                        Spacer()
                        if let raw = ch.2, let url = URL(string: raw) {
                            Link(destination: url) {
                                OttlineLucideIcon(kind: .externalLink, size: 15, color: palette.primaryAccent)
                            }
                        }
                    }
                    .padding(.vertical, 10)
                }
            }
        }
        .padding(16)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var faqBody: some View {
        let faqs: [(String, String)] = [
            (
                OttlineStrings.tr("Q1. 회원가입 없이 어떻게 기기를 연결하나요?", "Q1. How do devices sync without a login?", locale: locale),
                OttlineStrings.tr("첫 기록 후 자동 발급되는 영문·숫자 연결 코드를 다른 기기의 ‘나의 공간’에 입력하면 기존 기록이 합쳐지고 동기화됩니다.", "Your first sync issues a private connection code. Enter it in My Space on another device to link and merge timelines.", locale: locale)
            ),
            (
                OttlineStrings.tr("Q2. 남긴 기록은 왜 삭제 버튼이 없나요?", "Q2. Why is there no delete button per record?", locale: locale),
                OttlineStrings.tr("ottline은 ‘낙장불입’ 원칙으로 개별 기록 삭제 대신 상태·느낌·메모 수정과 변경 히스토리를 쌓아 기록의 흐름을 남깁니다. 전체 정리는 나의 공간에서 가능해요.", "Records evolve through edits and saved history snapshots rather than per-item deletion. Full resets are available in My Space.", locale: locale)
            ),
            (
                OttlineStrings.tr("Q3. 내 메모가 다른 사람에게 보이나요?", "Q3. Are my notes public?", locale: locale),
                OttlineStrings.tr("아니요. 날짜, 플랫폼, 장소, 메모는 기본적으로 내 타임라인에만 저장되며 ‘함께 나누기’를 직접 체크했을 때만 공개 대화방에 글이 올라갑니다.", "No. Dates, moments, and notes stay private on your timeline unless you explicitly opt in to share to Together.", locale: locale)
            ),
            (
                OttlineStrings.tr("Q4. 오프라인에서도 기록할 수 있나요?", "Q4. Can I log offline?", locale: locale),
                OttlineStrings.tr("네. 기기 내 SQLite와 동기화 보관함(Outbox)에 즉시 저장되고, 네트워크가 돌아오면 자동으로 서버와 맞춰집니다.", "Yes. Logs save immediately to local SQLite and queue in the Outbox to sync when back online.", locale: locale)
            ),
            (
                OttlineStrings.tr("Q5. 내 서가(KDC)는 어떻게 분류되나요?", "Q5. How does My Bookshelf sort books?", locale: locale),
                OttlineStrings.tr("기록한 책의 ISBN 판본을 기준으로 한국십진분류법(000~900) 대분류 책칸에 자동 정리됩니다.", "Books are grouped by ISBN-13 and automatically shelved under Korean Decimal Classification (000–900).", locale: locale)
            ),
            (
                OttlineStrings.tr("Q6. 로컬 초기화와 서버 전체 삭제의 차이는 무엇인가요?", "Q6. Local reset vs. delete all server data?", locale: locale),
                OttlineStrings.tr("로컬 초기화는 현재 기기의 캐시와 기록만 비워 서버 데이터는 그대로 유지하며, 서버 데이터 전체 삭제는 계정의 모든 서버 기록·댓글·문의·연결을 영구 삭제합니다.", "Reset local data clears only this device. Delete all server data permanently erases all synced records, comments, messages, and device links.", locale: locale)
            )
        ]

        ForEach(faqs, id: \.0) { q, a in
            infoCard(title: q, body: a)
        }
    }

    @ViewBuilder
    private var privacyBody: some View {
        let sections: [(String, String)] = [
            (
                OttlineStrings.tr("수집 항목 최소화 (무로그인)", "Minimal data, no account required", locale: locale),
                OttlineStrings.tr("이메일, 전화번호, 실명을 요구하지 않습니다. 기기 식별자, 임의 생성 사용자 ID, 연결 코드, 사용자가 남긴 작품·감상·문의 내용만 저장합니다.", "No email or phone number is collected. Only anonymous device/user IDs, pairing codes, and records you save are stored.", locale: locale)
            ),
            (
                OttlineStrings.tr("미래의 타임라인(OpenAI) 안내", "Future Timeline & OpenAI processing", locale: locale),
                OttlineStrings.tr("사용자가 타임라인에서 ‘미래의 타임라인’ 생성을 직접 실행할 때만 최근 기록 요약과 제외 목록을 OpenAI API에 전달해 다음 작품 후보를 만듭니다. 일반 기록 저장·동기화에는 외부 AI를 호출하지 않습니다.", "Only when you explicitly trigger Future Timeline generation are recent log summaries and exclusions sent to OpenAI to generate candidates.", locale: locale)
            ),
            (
                OttlineStrings.tr("데이터 관리 및 삭제 권리", "Your control & permanent deletion", locale: locale),
                OttlineStrings.tr("나의 공간에서 언제든 기기 연결을 해제하거나, 로컬 초기화 또는 계정 단위 서버 데이터 전체 삭제를 즉시 실행할 수 있습니다.", "You can unlink devices, reset local storage, or permanently delete all server data anytime from My Space.", locale: locale)
            )
        ]

        ForEach(sections, id: \.0) { title, body in
            infoCard(title: title, body: body)
        }

        if let privacyUrl = URL(string: "https://ottline.app/privacy") {
            Link(destination: privacyUrl) {
                HStack {
                    Text(OttlineStrings.tr("웹에서 개인정보처리방침 전문 보기", "Read full privacy policy", locale: locale))
                        .font(OttlineFont.semiBold(14))
                    Spacer()
                    OttlineLucideIcon(kind: .externalLink, size: 15, color: palette.primaryAccent)
                }
                .foregroundStyle(palette.primaryAccent)
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
        }
    }

    @ViewBuilder
    private func infoCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(OttlineFont.semiBold(15))
                .foregroundStyle(palette.primaryAccent)
            Text(body)
                .font(OttlineFont.regular(13.5))
                .foregroundStyle(palette.mutedInk)
                .lineSpacing(4)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }
}

private func subScreenHeader(title: String, onBack: @escaping () -> Void) -> some View {
    HStack(spacing: 10) {
        Button(action: onBack) {
            OttlineLucideIcon(kind: .chevronLeft, size: 20, color: .primary)
                .frame(width: 36, height: 36)
        }
        .buttonStyle(.plain)

        Text(title)
            .font(OttlineFont.semiBold(19))
            .lineLimit(1)

        Spacer()
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 10)
}
