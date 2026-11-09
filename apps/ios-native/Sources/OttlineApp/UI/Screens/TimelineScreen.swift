import SwiftUI

public struct TimelineScreen: View {
    public let repository: OttlineRepository
    public var initialPlaceFilter: Place?
    public var initialOccasionFilter: Occasion?
    public var onClearInitialMomentFilter: () -> Void
    public var onOpenQuickRecord: (QuickRecordRequest) -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenReport: () -> Void
    public var onOpenBookshelf: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var typeFilter: String = "all" // "all" | "video" | "book"
    @State private var statusFilter: LogStatus?
    @State private var platformFilter: String = ""
    @State private var placeFilter: Place?
    @State private var occasionFilter: Occasion?
    @State private var originFilter: LogOrigin?
    @State private var searchQuery: String = ""
    @State private var filterExpanded: Bool = false

    // Server cursor pagination (`GET /api/logs/page`)
    @State private var nextCursor: String?
    @State private var hasMorePages: Bool = false
    @State private var loadingMore: Bool = false

    // "내 미래는?" (`futureMode` matching `app/[locale]/timeline/page.tsx`)
    @State private var futureMode: Bool = false
    @State private var nextWatchLoading: Bool = false
    @State private var nextWatchError: String?
    @State private var nextWatchResponse: NextWatchRecommendResponse?
    @State private var dismissedNextWatch: Set<String> = []

    @State private var shareCardLog: WatchLog?
    @State private var sharedNoteLogIds: Set<String> = []
    @State private var sharingNoteLogId: String?

    public var body: some View {
        let allLogs = repository.logs
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle: String? = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }

        let filteredLogs = allLogs.filter { log in
            if typeFilter == "video" && log.title.type == .book { return false }
            if typeFilter == "book" && log.title.type != .book { return false }
            if let sf = statusFilter, log.status != sf { return false }
            if !platformFilter.isEmpty, (log.ott ?? "") != platformFilter { return false }
            if let pf = placeFilter, log.place != pf { return false }
            if let of = occasionFilter, log.occasion != of { return false }
            if let orf = originFilter, log.origin != orf { return false }
            let trimmed = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                let hay = "\(log.title.name) \(log.note ?? "") \(log.ott ?? "")".lowercased()
                if !hay.contains(trimmed.lowercased()) { return false }
            }
            return true
        }
        let monthGroups = TimelineMoments.groupLogsByMonth(filteredLogs)
        let momentFilterCount = [
            statusFilter != nil,
            !platformFilter.isEmpty,
            placeFilter != nil,
            occasionFilter != nil,
            originFilter != nil
        ].filter { $0 }.count
        let hasActiveFilters = momentFilterCount > 0 || !searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || typeFilter != "all"

        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                // 1. Page Heading (`app/[locale]/timeline/page.tsx` `.pageHeading` parity)
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(OttlineStrings.tr("남겨둔 이야기", "THE STORIES YOU KEPT", locale: locale))
                            .font(OttlineFont.medium(11))
                            .kerning(0.88)
                            .foregroundStyle(palette.mutedInk)

                        Text(headerTitle(nickname: nickname))
                            .font(OttlineFont.semiBold(25))
                            .kerning(-0.7)
                            .foregroundStyle(palette.ink)

                        Text(headerSubtitle(personaTitle: personaTitle))
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)
                    }

                    // Tools row (`.timelineTools`)
                    HStack(spacing: 8) {
                        if !futureMode {
                            Button {
                                onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "plus")
                                        .font(.system(size: 13, weight: .bold))
                                    Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 42)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)

                            if !(snap.userId ?? "").isEmpty {
                                Button {
                                    futureMode = true
                                    if nextWatchResponse == nil {
                                        Task { await fetchNextWatch(forceRefresh: false) }
                                    }
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 13, weight: .semibold))
                                        Text(!nickname.isEmpty
                                            ? OttlineStrings.tr("\(nickname)의 미래는?", "\(nickname)'s future?", locale: locale)
                                            : OttlineStrings.tr("내 미래는?", "What's my future?", locale: locale)
                                        )
                                        .font(OttlineFont.semiBold(13.5))
                                    }
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 13)
                                    .frame(minHeight: 42)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.primaryAccent.opacity(0.35), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }

                            if !allLogs.isEmpty {
                                let csvString = CsvExporter.buildCsv(filteredLogs)
                                ShareLink(
                                    item: csvString,
                                    subject: Text("ottline timeline export"),
                                    message: Text("ottline CSV")
                                ) {
                                    Image(systemName: "arrow.down.to.line")
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(palette.ink)
                                        .frame(width: 42, height: 42)
                                        .background(palette.card)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(palette.border, lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel(OttlineStrings.tr("CSV 다운로드", "Download CSV", locale: locale))
                            }
                        } else {
                            Button {
                                futureMode = false
                            } label: {
                                Text(OttlineStrings.tr("← 현재로 돌아오기", "← Back to present", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 42)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.border, lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)

                            if allLogs.count >= 5 {
                                Button {
                                    Task { await fetchNextWatch(forceRefresh: true) }
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "sparkles")
                                            .font(.system(size: 13))
                                        Text(OttlineStrings.tr("다른 작품 추천받기", "Explore other stories", locale: locale))
                                            .font(OttlineFont.semiBold(13.5))
                                    }
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 42)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.primaryAccent.opacity(0.35), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .disabled(nextWatchLoading)
                            }
                        }
                    }
                }
                .padding(.bottom, 14)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                // 2. Shortcuts Row (`.timelineShortcuts`: `내 이용 리포트 →`, `서가 보기 →`)
                if !futureMode {
                    HStack(spacing: 18) {
                        Button(action: onOpenReport) {
                            HStack(spacing: 6) {
                                Image(systemName: "chart.bar")
                                    .font(.system(size: 13.5, weight: .semibold))
                                Text(OttlineStrings.tr("내 이용 리포트", "My Usage Report", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                Text("→")
                                    .font(OttlineFont.semiBold(13.5))
                            }
                            .foregroundStyle(palette.primaryAccent)
                        }
                        .buttonStyle(.plain)

                        if locale == "ko" {
                            Button(action: onOpenBookshelf) {
                                HStack(spacing: 6) {
                                    Image(systemName: "book")
                                        .font(.system(size: 13.5, weight: .semibold))
                                    Text("서가 보기")
                                        .font(OttlineFont.semiBold(13.5))
                                    Text("→")
                                        .font(OttlineFont.semiBold(13.5))
                                }
                                .foregroundStyle(palette.primaryAccent)
                            }
                            .buttonStyle(.plain)
                        }

                        Spacer()
                    }
                }

                // 3. Sync Notice Banner
                if !futureMode && (repository.outboxCount > 0 || repository.syncState.status != .idle) {
                    SyncNoticeBanner(
                        syncState: repository.syncState,
                        outboxCount: repository.outboxCount,
                        onRetryTap: { repository.triggerSyncAsync() }
                    )
                }

                // 4. Future Timeline Mode vs Present Timeline Mode
                if futureMode {
                    futureTimelineContent(allLogsCount: allLogs.count)
                } else {
                    // FiltersBar (`FiltersBar.tsx` 1:1 parity)
                    filtersBarSection(momentFilterCount: momentFilterCount)

                    // Timeline Month Groups (`LogCard.tsx` `.recordRow` parity)
                    if filteredLogs.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(hasActiveFilters
                                ? OttlineStrings.tr("검색 결과가 없어요.", "No search results.", locale: locale)
                                : OttlineStrings.tr("첫 기록을 남겨보세요. 타임라인이 시작됩니다.", "Leave your first record. Your timeline starts here.", locale: locale)
                            )
                            .font(OttlineFont.regular(15))
                            .foregroundStyle(palette.mutedInk)

                            if !hasActiveFilters {
                                Button {
                                    onOpenQuickRecord(QuickRecordRequest(autoFocusSearch: true))
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "plus")
                                            .font(.system(size: 13, weight: .bold))
                                        Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                            .font(OttlineFont.semiBold(14.5))
                                    }
                                    .foregroundStyle(palette.onBrandOrange)
                                    .padding(.horizontal, 18)
                                    .frame(minHeight: 46)
                                    .background(palette.brandOrange)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 24)
                    } else {
                        VStack(alignment: .leading, spacing: 26) {
                            ForEach(monthGroups) { group in
                                VStack(alignment: .leading, spacing: 0) {
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                            .font(OttlineFont.semiBold(19))
                                            .foregroundStyle(palette.ink)
                                        Spacer()
                                        Text(OttlineStrings.tr("최근 기록·수정한 날 기준", "By last recorded or updated", locale: locale))
                                            .font(OttlineFont.regular(12))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    .padding(.bottom, 10)
                                    .overlay(alignment: .bottom) {
                                        Rectangle().fill(palette.border).frame(height: 1)
                                    }

                                    ForEach(group.logs) { log in
                                        timelineRecordRow(log)
                                        Rectangle()
                                            .fill(palette.border)
                                            .frame(height: 1)
                                    }
                                }
                            }
                        }

                        // Server cursor infinite scroll button
                        if hasMorePages {
                            Button {
                                Task { await loadNextPage() }
                            } label: {
                                HStack {
                                    Spacer()
                                    if loadingMore {
                                        ProgressView()
                                    } else {
                                        Text(OttlineStrings.tr("이전 기록 더 보기", "Show earlier records", locale: locale))
                                            .font(OttlineFont.semiBold(14))
                                            .foregroundStyle(palette.primaryAccent)
                                    }
                                    Spacer()
                                }
                                .frame(minHeight: 46)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                            .task {
                                await loadNextPage()
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .sheet(item: $shareCardLog) { log in
            ShareCardDialog(
                log: log,
                nickname: repository.prefs.snapshot.nickname,
                personaKey: repository.prefs.snapshot.personaKey,
                onDismiss: { shareCardLog = nil }
            )
        }
        .onAppear {
            if initialPlaceFilter != nil || initialOccasionFilter != nil {
                placeFilter = initialPlaceFilter
                occasionFilter = initialOccasionFilter
                filterExpanded = true
                onClearInitialMomentFilter()
            }
            dismissedNextWatch = repository.prefs.dismissedNextWatchSignatures()
        }
        .task {
            await loadFirstServerPage()
            let books = repository.logs.map(\.title).filter { $0.type == .book }
            if !books.isEmpty {
                await repository.ensureBookClassificationsCached(titles: books)
            }
        }
    }

    private func headerTitle(nickname: String) -> String {
        if futureMode {
            return OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale)
        }
        if !nickname.isEmpty {
            return OttlineStrings.tr("\(nickname)의 타임라인", "\(nickname)'s Timeline", locale: locale)
        }
        return OttlineStrings.tr("내 타임라인", "My Timeline", locale: locale)
    }

    private func headerSubtitle(personaTitle: String?) -> String {
        if futureMode {
            return OttlineStrings.tr(
                "지금까지 쌓인 기록의 결로 다음 이야기를 펼쳐봐요",
                "The records you keep now will help us choose your next stories.",
                locale: locale
            )
        }
        if let personaTitle, !personaTitle.isEmpty {
            return OttlineStrings.tr(
                "\(personaTitle)로 쌓아가는 기록이에요",
                "Recorded with your \(personaTitle) point of view",
                locale: locale
            )
        }
        return OttlineStrings.tr(
            "내가 본 것들이 시간 순서로 모여요",
            "Your records are gathered in chronological order",
            locale: locale
        )
    }

    // MARK: - FiltersBar (`FiltersBar.tsx` 1:1 Parity)

    private func filtersBarSection(momentFilterCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // 3 equal-width segmented tabs: `전체` | `영상` | `책`
            HStack(spacing: 8) {
                ForEach([
                    ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                    ("video", OttlineStrings.tr("영상", "Video", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { key, label in
                    let selected = typeFilter == key
                    Button {
                        typeFilter = key
                    } label: {
                        Text(label)
                            .font(selected ? OttlineFont.semiBold(14.5) : OttlineFont.medium(14.5))
                            .foregroundStyle(selected ? palette.primaryAccent : palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(selected ? palette.card : Color.clear)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            // Search Input (`제목, 메모, 플랫폼`)
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 14))
                    .foregroundStyle(palette.mutedInk)
                TextField(
                    OttlineStrings.tr("제목, 메모, 플랫폼", "Title, note, platform", locale: locale),
                    text: $searchQuery
                )
                .font(OttlineFont.regular(14.5))
                .foregroundStyle(palette.ink)

                if !searchQuery.isEmpty {
                    Button {
                        searchQuery = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 42)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )

            // Collapsible Toggle (`그날의 순간으로 찾기` / `Find a moment`)
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    filterExpanded.toggle()
                }
            } label: {
                HStack(spacing: 6) {
                    Text(OttlineStrings.tr("그날의 순간으로 찾기", "Find a moment", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.primaryAccent)
                    if momentFilterCount > 0 {
                        Text("\(momentFilterCount)")
                            .font(OttlineFont.semiBold(11.5))
                            .foregroundStyle(palette.primaryAccent)
                            .frame(minWidth: 20, minHeight: 20)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule().stroke(palette.border, lineWidth: 1)
                            )
                    }
                    Image(systemName: filterExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(palette.primaryAccent)
                }
                .padding(.vertical, 4)
            }
            .buttonStyle(.plain)

            if filterExpanded {
                let availablePlaces = typeFilter == "book"
                    ? Place.bookCases
                    : (typeFilter == "video" ? Place.videoCases : Place.allCases)
                let availablePlatforms = typeFilter == "book"
                    ? OttlineStrings.bookPlatforms(locale)
                    : OttlineStrings.videoPlatforms(locale)

                LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                    // 1. Status
                    filterMenuBox(
                        title: OttlineStrings.tr("상태", "Status", locale: locale),
                        valueLabel: statusFilter.map { OttlineStrings.statusLabel($0, type: typeFilter == "book" ? .book : .movie, locale: locale) }
                            ?? OttlineStrings.tr("전체", "All", locale: locale)
                    ) {
                        Button(OttlineStrings.tr("전체", "All", locale: locale)) { statusFilter = nil }
                        ForEach(LogStatus.allCases, id: \.self) { st in
                            Button(OttlineStrings.statusLabel(st, type: typeFilter == "book" ? .book : .movie, locale: locale)) {
                                statusFilter = st
                            }
                        }
                    }

                    // 2. Platform
                    filterMenuBox(
                        title: OttlineStrings.tr("플랫폼", "Platform", locale: locale),
                        valueLabel: platformFilter.isEmpty
                            ? OttlineStrings.tr("전체", "All", locale: locale)
                            : platformFilter
                    ) {
                        Button(OttlineStrings.tr("전체", "All", locale: locale)) { platformFilter = "" }
                        ForEach(availablePlatforms, id: \.self) { plat in
                            Button(plat) { platformFilter = plat }
                        }
                    }

                    // 3. Place (`어디서`)
                    filterMenuBox(
                        title: OttlineStrings.tr("어디서", "Where", locale: locale),
                        valueLabel: placeFilter.map { OttlineStrings.placeLabel($0, locale: locale) }
                            ?? OttlineStrings.tr("모든 장소", "All places", locale: locale)
                    ) {
                        Button(OttlineStrings.tr("모든 장소", "All places", locale: locale)) { placeFilter = nil }
                        ForEach(availablePlaces, id: \.self) { p in
                            Button(OttlineStrings.placeLabel(p, locale: locale)) { placeFilter = p }
                        }
                    }

                    // 4. Occasion (`누구와·어떤 상황`)
                    filterMenuBox(
                        title: OttlineStrings.tr("누구와·어떤 상황", "Who or what moment", locale: locale),
                        valueLabel: occasionFilter.map { OttlineStrings.occasionLabel($0, locale: locale) }
                            ?? OttlineStrings.tr("모든 상황", "All moments", locale: locale)
                    ) {
                        Button(OttlineStrings.tr("모든 상황", "All moments", locale: locale)) { occasionFilter = nil }
                        ForEach(Occasion.allCases, id: \.self) { occ in
                            Button(OttlineStrings.occasionLabel(occ, locale: locale)) { occasionFilter = occ }
                        }
                    }

                    // 5. Category (`구분`)
                    filterMenuBox(
                        title: OttlineStrings.tr("구분", "Category", locale: locale),
                        valueLabel: originFilter == nil
                            ? OttlineStrings.tr("전체", "All", locale: locale)
                            : (originFilter == .comment
                                ? OttlineStrings.tr("함께 남긴 기록", "From a conversation", locale: locale)
                                : OttlineStrings.tr("내 기록", "My record", locale: locale))
                    ) {
                        Button(OttlineStrings.tr("전체", "All", locale: locale)) { originFilter = nil }
                        Button(OttlineStrings.tr("내 기록", "My record", locale: locale)) { originFilter = .log }
                        Button(OttlineStrings.tr("함께 남긴 기록", "From a conversation", locale: locale)) { originFilter = .comment }
                    }
                }
                .padding(14)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
        }
        .padding(.bottom, 12)
        .overlay(alignment: .bottom) {
            Rectangle().fill(palette.border).frame(height: 1)
        }
    }

    private func filterMenuBox<MenuContent: View>(
        title: String,
        valueLabel: String,
        @ViewBuilder content: () -> MenuContent
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(OttlineFont.regular(11.5))
                .foregroundStyle(palette.mutedInk)
            Menu {
                content()
            } label: {
                HStack {
                    Text(valueLabel)
                        .font(OttlineFont.medium(13.5))
                        .foregroundStyle(palette.ink)
                        .lineLimit(1)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(palette.mutedInk)
                }
                .padding(.horizontal, 10)
                .frame(minHeight: 38)
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

    // MARK: - Timeline Record Row (`LogCard.tsx` `.recordRow` 1:1 Parity)

    private func timelineRecordRow(_ log: WatchLog) -> some View {
        let isBook = log.title.type == .book
        let isbn13 = isBook ? BookshelfBuilder.normalizeBookIsbn13(log.title) : nil
        let cls = isbn13.flatMap { repository.bookClassifications[$0] }
        let kdcMajor = (cls?.status == "CLASSIFIED") ? cls?.kdcMajor : nil
        let dateIso = log.watchedAt.isEmpty ? log.createdAt : log.watchedAt
        let displayYear = log.seasonYear ?? log.title.year

        let editionText: String? = {
            if isBook {
                let parts = [log.title.author, log.title.publisher].compactMap { $0 }.filter { !$0.isEmpty }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            } else {
                let parts = [
                    log.seasonNumber.map { locale == "en" ? "Season \($0)" : "시즌 \($0)" },
                    log.episodeNumber.map { locale == "en" ? "Ep \($0)" : "\($0)화" }
                ].compactMap { $0 }
                return parts.isEmpty ? nil : parts.joined(separator: " · ")
            }
        }()

        return HStack(alignment: .top, spacing: 14) {
            // Left Date Column (`recordDate`: Month on top + large Day below)
            VStack(alignment: .leading, spacing: 1) {
                Text(RecordDate.formatTimelineMonth(dateIso, locale: locale))
                    .font(OttlineFont.regular(11.5))
                    .foregroundStyle(palette.mutedInk)
                Text(RecordDate.formatTimelineDay(dateIso))
                    .font(OttlineFont.semiBold(22))
                    .foregroundStyle(palette.ink)
                if log.watchedAt.isEmpty {
                    Text(OttlineStrings.tr("기록한 날", "Recorded", locale: locale))
                        .font(OttlineFont.regular(10.5))
                        .foregroundStyle(palette.mutedInk)
                }
            }
            .frame(width: 48, alignment: .leading)

            // Middle Poster (`58x87`)
            Button {
                onOpenTitleDetail(log.title.id)
            } label: {
                PosterImage(
                    posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                    titleName: log.title.name,
                    titleType: log.title.type,
                    width: 58,
                    height: 87
                )
            }
            .buttonStyle(.plain)

            // Right Content (`recordContent`)
            VStack(alignment: .leading, spacing: 6) {
                // Meta line (`영화 · 2026`, edition, origin)
                HStack(spacing: 6) {
                    Text([
                        OttlineStrings.titleTypeLabel(log.title.type, locale: locale),
                        displayYear.map(String.init)
                    ].compactMap { $0 }.joined(separator: " · "))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)

                    if let editionText {
                        Text("· \(editionText)")
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                            .lineLimit(1)
                    }

                    if log.origin == .comment {
                        Text(OttlineStrings.tr("함께 남긴 기록", "Shared note", locale: locale))
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                }

                // Title
                Button {
                    onOpenTitleDetail(log.title.id)
                } label: {
                    Text(log.title.name)
                        .font(OttlineFont.semiBold(17.5))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                }
                .buttonStyle(.plain)

                // Status + Feeling
                HStack(spacing: 8) {
                    Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                        .font(OttlineFont.semiBold(12.5))
                        .foregroundStyle(palette.primaryAccent)
                    RecordFeelingBadge(rating: log.rating, isBook: isBook, compact: true)
                }

                // Moment (`ott`, `place`, `occasion`)
                let momentParts = [
                    log.ott,
                    log.place.map { OttlineStrings.placeLabel($0, locale: locale) },
                    log.occasion.map { OttlineStrings.occasionLabel($0, locale: locale) }
                ].compactMap { $0 }.filter { !$0.isEmpty }

                if !momentParts.isEmpty {
                    Text(momentParts.joined(separator: " · "))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                }

                // Note with left vertical border
                if let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                    HStack(spacing: 10) {
                        Rectangle()
                            .fill(palette.border)
                            .frame(width: 2)
                        Text(note)
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.ink)
                            .lineLimit(4)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(.vertical, 2)
                }

                // Actions row (`기록 펼치기 →`, `공유 카드 만들기`, `함께 나누기`, KDC shelf badge)
                FlowLayoutRow(spacing: 12) {
                    Button {
                        onOpenTitleDetail(log.title.id)
                    } label: {
                        Text(OttlineStrings.tr("기록 펼치기 →", "Open record →", locale: locale))
                            .font(OttlineFont.semiBold(12.5))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .buttonStyle(.plain)

                    Button {
                        shareCardLog = log
                    } label: {
                        Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .buttonStyle(.plain)

                    if let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                        let alreadyShared = sharedNoteLogIds.contains(log.id)
                        Button {
                            Task { await shareNoteToTogether(log: log, note: note) }
                        } label: {
                            Text(alreadyShared
                                ? OttlineStrings.tr("함께에 나눴어요", "Shared", locale: locale)
                                : (sharingNoteLogId == log.id
                                    ? OttlineStrings.tr("나누는 중…", "Sharing…", locale: locale)
                                    : OttlineStrings.tr("함께 나누기", "Keep it with others", locale: locale))
                            )
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                        .buttonStyle(.plain)
                        .disabled(alreadyShared || sharingNoteLogId == log.id)
                    }

                    if isBook, locale == "ko", let kdcMajor {
                        Button(action: onOpenBookshelf) {
                            Text("\(BookshelfBuilder.kdcSectionName(major: kdcMajor, locale: locale)) 서가")
                                .font(OttlineFont.medium(11.5))
                                .foregroundStyle(palette.mutedInk)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 16)
    }

    // MARK: - Future Timeline Mode (`app/[locale]/timeline/page.tsx` `futureMode` parity)

    @ViewBuilder
    private func futureTimelineContent(allLogsCount: Int) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            if allLogsCount < 5 {
                Text(OttlineStrings.tr(
                    "기록이 다섯 개 쌓이면, 다음에 만날 이야기를 함께 찾아볼 수 있어요.",
                    "With five records, you can explore a few stories to meet next.",
                    locale: locale
                ))
                .font(OttlineFont.regular(15))
                .foregroundStyle(palette.mutedInk)
                .padding(.vertical, 16)
            } else if nextWatchLoading {
                HStack(spacing: 10) {
                    ProgressView()
                    Text(OttlineStrings.tr(
                        "남겨둔 기록의 결을 따라 다음 이야기를 찾고 있어요.",
                        "Finding a few stories through the records you kept.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                }
                .padding(.vertical, 20)
            } else if let nextWatchError {
                Text(nextWatchError)
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.danger)
                    .padding(.vertical, 16)
            } else if let resp = nextWatchResponse {
                let visibleItems = resp.items.filter { !dismissedNextWatch.contains("\($0.provider.rawValue):\($0.providerId)") }
                if visibleItems.isEmpty {
                    Text(OttlineStrings.tr(
                        "아직 펼쳐볼 이야기가 없어요. 잠시 후 다시 들러주세요.",
                        "No stories to open just yet. Come back another time.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .padding(.vertical, 16)
                } else {
                    ForEach(visibleItems) { item in
                        VStack(alignment: .leading, spacing: 12) {
                            HStack(alignment: .top, spacing: 14) {
                                PosterImage(
                                    posterUrl: item.posterUrl,
                                    titleName: item.name,
                                    titleType: item.type,
                                    width: 64,
                                    height: 96
                                )
                                VStack(alignment: .leading, spacing: 6) {
                                    Text([
                                        OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                        item.year.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.mutedInk)

                                    Text(item.name)
                                        .font(OttlineFont.semiBold(17))
                                        .foregroundStyle(palette.ink)

                                    Text(item.reason)
                                        .font(OttlineFont.regular(13.5))
                                        .foregroundStyle(palette.ink)
                                        .lineSpacing(2)

                                    HStack(spacing: 14) {
                                        Button {
                                            let candidate = Title(
                                                id: item.titleId ?? UUID().uuidString.lowercased(),
                                                provider: item.provider,
                                                providerId: item.providerId,
                                                type: item.type,
                                                name: item.name,
                                                year: item.year,
                                                posterUrl: item.posterUrl,
                                                overview: item.overview
                                            )
                                            onOpenQuickRecord(
                                                QuickRecordRequest(
                                                    preselectedTitle: candidate,
                                                    preferredStatus: .wishlist,
                                                    selectSource: "next_watch_recommend",
                                                    prefilledPlatform: item.recommendedOtt,
                                                    autoFocusSearch: false
                                                )
                                            )
                                        } label: {
                                            Text(item.type == .book
                                                ? OttlineStrings.tr("읽고 싶어요", "Want to read", locale: locale)
                                                : OttlineStrings.tr("보고 싶어요", "Want to watch", locale: locale)
                                            )
                                            .font(OttlineFont.semiBold(13))
                                            .foregroundStyle(palette.primaryAccent)
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            let sig = "\(item.provider.rawValue):\(item.providerId)"
                                            repository.prefs.dismissNextWatchRecommendation(signature: sig)
                                            dismissedNextWatch.insert(sig)
                                        } label: {
                                            Text(OttlineStrings.tr("이미 본 작품이에요", "Already seen or read", locale: locale))
                                                .font(OttlineFont.regular(12.5))
                                                .foregroundStyle(palette.mutedInk)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .padding(.top, 2)
                                }
                                Spacer()
                            }
                            Rectangle()
                                .fill(palette.border)
                                .frame(height: 1)
                        }
                    }
                }
            }

            // OpenAI data usage disclosure (`futureDataNotice` in `timeline/page.tsx`)
            VStack(alignment: .leading, spacing: 6) {
                Text(OttlineStrings.tr(
                    "추천을 요청하면 최근 기록한 작품 제목·유형·장르·느낌, 남긴 경우 메모와 장소·상황, 제외 작품 목록을 OpenAI에 전송해 다음 작품을 추천받아요.",
                    "When you request new stories, OpenAI receives your recent titles, types, genres, feelings, any notes, places or occasions, and excluded titles.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
                .lineSpacing(2)
            }
            .padding(14)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
    }

    // MARK: - Pagination & Actions

    private func loadFirstServerPage() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        if let page = try? await repository.api.getLogsPage(limit: 50, cursor: nil) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
    }

    private func loadNextPage() async {
        guard hasMorePages, !loadingMore, let cursor = nextCursor else { return }
        loadingMore = true
        if let page = try? await repository.api.getLogsPage(limit: 50, cursor: cursor) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
        loadingMore = false
    }

    private func fetchNextWatch(forceRefresh: Bool) async {
        nextWatchLoading = true
        nextWatchError = nil
        _ = try? await repository.ensureAuthenticated()
        do {
            nextWatchResponse = try await repository.api.getNextWatchRecommendations(forceRefresh: forceRefresh)
        } catch {
            nextWatchError = OttlineStrings.tr(
                "다음 이야기를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
                "Could not bring in the next stories. Please try again in a little while.",
                locale: locale
            )
        }
        nextWatchLoading = false
    }

    private func shareNoteToTogether(log: WatchLog, note: String) async {
        sharingNoteLogId = log.id
        _ = try? await repository.ensureAuthenticated()
        if (try? await repository.api.createComment(
            titleId: log.title.id,
            payload: CreateCommentRequest(
                body: note,
                authorName: repository.prefs.snapshot.nickname,
                userId: repository.prefs.snapshot.userId,
                syncToLog: false
            )
        )) != nil {
            sharedNoteLogIds.insert(log.id)
        }
        sharingNoteLogId = nil
    }
}

private struct FlowLayoutRow<Content: View>: View {
    var spacing: CGFloat = 12
    @ViewBuilder var content: () -> Content

    var body: some View {
        HStack(spacing: spacing) {
            content()
        }
    }
}
