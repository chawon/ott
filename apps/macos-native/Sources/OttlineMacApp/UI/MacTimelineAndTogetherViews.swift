import SwiftUI
import OttlineCore

// MARK: - Mac Timeline Spread View (2-Column Grid + Future Timeline `gpt-6-luna`)

public struct MacTimelineSpreadView: View {
    public let repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var typeFilter: String = "all"
    @State private var statusFilter: LogStatus?
    @State private var placeFilter: Place?
    @State private var occasionFilter: Occasion?
    @State private var searchQuery: String = ""

    @State private var nextCursor: String?
    @State private var hasMorePages: Bool = false
    @State private var loadingMore: Bool = false

    @State private var futureMode: Bool = false
    @State private var recState = RecommendationState()
    @State private var recLoading: Bool = false
    @State private var recGenerating: Bool = false
    @State private var recError: String?
    @State private var showExcludedSheet: Bool = false
    @State private var editionCandidates: [TitleSearchItem] = []
    @State private var editionPickerTitle: String = ""
    @State private var showEditionPicker: Bool = false

    public var body: some View {
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }

        let filteredLogs = repository.logs.filter { log in
            if typeFilter == "movie" && log.title.type != .movie { return false }
            if typeFilter == "series" && log.title.type != .series { return false }
            if typeFilter == "book" && log.title.type != .book { return false }
            if let sf = statusFilter, log.status != sf { return false }
            if let pf = placeFilter, log.place != pf { return false }
            if let of = occasionFilter, log.occasion != of { return false }
            let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if !q.isEmpty {
                let hay = [log.title.name, log.title.author ?? "", log.title.publisher ?? "", log.note ?? "", log.ott ?? ""].joined(separator: " ").lowercased()
                if !hay.contains(q) { return false }
            }
            return true
        }
        let sortedLogs = filteredLogs.sorted {
            RecordDate.parseInstantMillis(TimelineMoments.timelineSortKey($0)) >
                RecordDate.parseInstantMillis(TimelineMoments.timelineSortKey($1))
        }
        let monthGroups = TimelineMoments.groupLogsByMonth(sortedLogs)

        GeometryReader { scrollGeo in
            ScrollView {
                OttlineStickyFooterLayout(
                    minHeight: scrollGeo.size.height,
                    topPadding: 24,
                    bottomPadding: 28,
                    minSpacing: 24
                ) {
                    VStack(alignment: .leading, spacing: 22) {
                        // Header
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(OttlineStrings.tr("남겨둔 이야기", "THE STORIES YOU KEPT", locale: locale))
                            .font(OttlineFont.medium(11))
                            .kerning(0.9)
                            .foregroundStyle(palette.mutedInk)

                        Text(nickname.isEmpty
                            ? OttlineStrings.tr("내 타임라인", "My Timeline", locale: locale)
                            : OttlineStrings.tr("\(nickname)의 타임라인", "\(nickname)'s Timeline", locale: locale)
                        )
                        .font(OttlineFont.semiBold(28))
                        .foregroundStyle(palette.ink)

                        if let personaTitle {
                            Text(OttlineStrings.tr("\(personaTitle)의 시선으로 남긴 기록", "Recorded with your \(personaTitle) point of view", locale: locale))
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }

                    Spacer()

                    FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                        if !futureMode {
                            Button {
                                appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                            } label: {
                                HStack(spacing: 5) {
                                    OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange)
                                    Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                                        .font(OttlineFont.semiBold(13.5))
                                        .foregroundStyle(palette.onBrandOrange)
                                }
                                .padding(.horizontal, 14)
                                .frame(height: 38)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)

                            if !(snap.userId ?? "").isEmpty {
                                Button {
                                    futureMode = true
                                    Task { await loadRecommendationState() }
                                } label: {
                                    HStack(spacing: 5) {
                                        OttlineLucideIcon(kind: .sparkles, size: 14, color: palette.primaryAccent)
                                        Text(!nickname.isEmpty
                                            ? OttlineStrings.tr("\(nickname)의 미래는?", "\(nickname)'s future?", locale: locale)
                                            : OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale)
                                        )
                                        .font(OttlineFont.semiBold(13.5))
                                        .foregroundStyle(palette.primaryAccent)
                                    }
                                    .padding(.horizontal, 14)
                                    .frame(height: 38)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.4), lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }

                            Button {
                                appState.overlayStack.append(.report)
                            } label: {
                                Text(OttlineStrings.tr("이용 리포트", "Usage Report", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 12)
                                    .frame(height: 38)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)

                            if locale == "ko" {
                                Button {
                                    appState.overlayStack.append(.bookshelf(nil))
                                } label: {
                                    HStack(spacing: 5) {
                                        OttlineLucideIcon(kind: .bookOpen, size: 14, color: palette.ink)
                                        Text("내 서가")
                                            .font(OttlineFont.medium(13.5))
                                            .foregroundStyle(palette.ink)
                                    }
                                    .padding(.horizontal, 12)
                                    .frame(height: 38)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }

                            Button {
                                let csv = CsvExporter.buildCsv(filteredLogs, locale: locale)
                                MacImageExportHelper.saveCsvWithPanel(csv, defaultName: "ottline-timeline.csv")
                            } label: {
                                HStack(spacing: 5) {
                                    OttlineLucideIcon(kind: .download, size: 14, color: palette.ink)
                                    Text(OttlineStrings.tr("CSV 저장", "Export CSV", locale: locale))
                                        .font(OttlineFont.medium(13.5))
                                        .foregroundStyle(palette.ink)
                                }
                                .padding(.horizontal, 12)
                                .frame(height: 38)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .disabled(filteredLogs.isEmpty)
                        } else {
                            Button {
                                futureMode = false
                            } label: {
                                Text(OttlineStrings.tr("← 타임라인으로 돌아오기", "← Back to timeline", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 14)
                                    .frame(height: 38)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)

                            Button {
                                showExcludedSheet = true
                            } label: {
                                Text(OttlineStrings.tr("제외한 작품 (\(recState.exclusions.count))", "Excluded (\(recState.exclusions.count))", locale: locale))
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.mutedInk)
                                    .padding(.horizontal, 12)
                                    .frame(height: 38)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(.bottom, 14)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                if futureMode {
                    futureTimelineDesktopSection
                } else {
                    filterDesktopBar

                    if repository.logs.isEmpty {
                        VStack(alignment: .leading, spacing: 14) {
                            Text(OttlineStrings.tr("첫 기록을 남겨보세요. 타임라인이 바로 시작돼요.", "Leave your first record. Your timeline starts here.", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)

                            Button {
                                appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                            } label: {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                                    Text(OttlineStrings.tr("새로운 기록 남기기", "Leave a new record", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.onBrandOrange)
                                }
                                .padding(.horizontal, 16)
                                .frame(height: 44)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    } else if monthGroups.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text(OttlineStrings.tr("조건에 맞는 기록이 아직 없어요.", "No matching records yet.", locale: locale))
                                .font(OttlineFont.regular(15))
                                .foregroundStyle(palette.mutedInk)

                            Button {
                                typeFilter = "all"
                                statusFilter = nil
                                placeFilter = nil
                                occasionFilter = nil
                                searchQuery = ""
                            } label: {
                                Text(OttlineStrings.tr("필터 초기화", "Reset filters", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 14)
                                    .frame(height: 36)
                                    .background(palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(24)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    } else {
                        ForEach(monthGroups) { group in
                            VStack(alignment: .leading, spacing: 12) {
                                Text(RecordDate.formatMonthLabel(group.monthKey, locale: locale))
                                    .font(OttlineFont.bold(18))
                                    .foregroundStyle(palette.ink)

                                LazyVGrid(
                                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                                    spacing: 16
                                ) {
                                    ForEach(group.logs) { log in
                                        timelineDesktopCard(log)
                                    }
                                }
                            }
                        }

                        if hasMorePages {
                            Button {
                                Task { await loadNextPage() }
                            } label: {
                                HStack(spacing: 6) {
                                    if loadingMore { ProgressView() }
                                    Text(OttlineStrings.tr("이전 기록 더 보기", "Load earlier records", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .frame(maxWidth: .infinity, minHeight: 42)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                            .disabled(loadingMore)
                        }
                    }
                }
                    }

                    OttlineAppFooter(bottomPadding: 0)
                }
                .frame(maxWidth: 1120, alignment: .leading)
                .padding(.horizontal, 28)
                .frame(maxWidth: .infinity)
            }
        }
        .onAppear {
            if let pf = appState.pendingPlaceFilter {
                placeFilter = pf
                appState.pendingPlaceFilter = nil
            }
            if let of = appState.pendingOccasionFilter {
                occasionFilter = of
                appState.pendingOccasionFilter = nil
            }
        }
        .task(id: "\(typeFilter)-\(statusFilter?.rawValue ?? "")-\(placeFilter?.rawValue ?? "")-\(occasionFilter?.rawValue ?? "")-\(searchQuery)") {
            await loadFirstServerPage()
        }
        .sheet(isPresented: $showExcludedSheet) {
            excludedDesktopSheet
        }
        .sheet(isPresented: $showEditionPicker) {
            editionPickerDesktopSheet
        }
    }

    private var filterDesktopBar: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                TextField(
                    OttlineStrings.tr("제목, 저자, 출판사, 메모 검색", "Search title, author, publisher, or note", locale: locale),
                    text: $searchQuery
                )
                .textFieldStyle(.plain)
                .font(OttlineFont.regular(14.5))
                .padding(.horizontal, 12)
                .frame(height: 40)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                HStack(spacing: 6) {
                    ForEach([
                        ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                        ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                        ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
                        ("book", OttlineStrings.tr("책", "Book", locale: locale))
                    ], id: \.0) { key, label in
                        let selected = typeFilter == key
                        Button {
                            typeFilter = key
                        } label: {
                            Text(label)
                                .font(selected ? OttlineFont.semiBold(13) : OttlineFont.regular(13))
                                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                .padding(.horizontal, 12)
                                .frame(height: 38)
                                .background(selected ? palette.paperStrong : palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                filterStatusChip(nil, OttlineStrings.tr("전체 상태", "All states", locale: locale))
                filterStatusChip(.done, OttlineStrings.tr("봤어요·읽었어요", "Watched/Read", locale: locale))
                filterStatusChip(.inProgress, OttlineStrings.tr("보는 중·읽는 중", "In progress", locale: locale))
                filterStatusChip(.wishlist, OttlineStrings.tr("보고 싶어요", "Want to", locale: locale))

                if let pf = placeFilter {
                    Button {
                        placeFilter = nil
                    } label: {
                        Text("\(OttlineStrings.placeLabel(pf, locale: locale)) ×")
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 10)
                            .frame(height: 30)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
                if let of = occasionFilter {
                    Button {
                        occasionFilter = nil
                    } label: {
                        Text("\(OttlineStrings.occasionLabel(of, locale: locale)) ×")
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 10)
                            .frame(height: 30)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func filterStatusChip(_ value: LogStatus?, _ label: String) -> some View {
        let active = statusFilter == value
        return Button {
            statusFilter = value
        } label: {
            Text(label)
                .font(active ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                .padding(.horizontal, 10)
                .frame(height: 30)
                .background(active ? palette.paperStrong : palette.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.4 : 1))
        }
        .buttonStyle(.plain)
    }

    private func timelineDesktopCard(_ log: WatchLog) -> some View {
        let dateStr = RecordDate.formatDisplayDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt, locale: locale)
        let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        return VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 14) {
                Button {
                    appState.overlayStack.append(.titleDetail(log.title.id))
                } label: {
                    PosterImage(
                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                        titleName: log.title.name,
                        titleType: log.title.type,
                        width: 72,
                        height: 108,
                        cornerRadius: 4
                    )
                }
                .buttonStyle(.plain)

                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(OttlineStrings.titleTypeLabel(log.title.type, locale: locale))
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                        Spacer()
                        Text(dateStr)
                            .font(OttlineFont.regular(11.5))
                            .foregroundStyle(palette.subtleInk)
                    }

                    Button {
                        appState.overlayStack.append(.titleDetail(log.title.id))
                    } label: {
                        Text(log.title.name)
                            .font(OttlineFont.bold(16))
                            .foregroundStyle(palette.ink)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }
                    .buttonStyle(.plain)

                    HStack(spacing: 6) {
                        Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                            .font(OttlineFont.semiBold(11.5))
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                        RecordFeelingBadge(rating: log.rating, isBook: log.title.type == .book, compact: true)
                    }

                    RecordMomentList(ott: log.ott, place: log.place, occasion: log.occasion, compact: true)
                }
            }

            if !log.spoiler && !note.isEmpty {
                InlineNoteText(text: note, fontSize: 15, lineLimit: 3, preserveNewlines: true)
            }

            HStack {
                Button {
                    appState.overlayStack.append(.titleDetail(log.title.id))
                } label: {
                    Text(OttlineStrings.tr("상세 보기 →", "Open detail →", locale: locale))
                        .font(OttlineFont.semiBold(12.5))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    appState.shareCardLog = log
                } label: {
                    HStack(spacing: 4) {
                        OttlineLucideIcon(kind: .share2, size: 13, color: palette.mutedInk)
                        Text(OttlineStrings.tr("공유 카드", "Share card", locale: locale))
                            .font(OttlineFont.medium(12))
                            .foregroundStyle(palette.mutedInk)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    @ViewBuilder
    private var futureTimelineDesktopSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("미래의 타임라인", "Future timeline", locale: locale))
                        .font(OttlineFont.bold(20))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr(
                        "지금까지 남긴 기록의 결을 바탕으로 다음으로 어울릴 만한 작품을 골라드려요. (오늘 \(recState.quota.used)/\(recState.quota.limit)회)",
                        "Suggestions drawn from the stories you've kept. (Today: \(recState.quota.used)/\(recState.quota.limit))",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                }

                Spacer()

                Button {
                    Task { await generateRecommendations() }
                } label: {
                    HStack(spacing: 6) {
                        if recGenerating || recState.generating { ProgressView() }
                        Text(OttlineStrings.tr("새로운 추천 받기", "Generate suggestions", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.onBrandOrange)
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 40)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(recGenerating || recState.generating || recState.quota.remaining <= 0)
            }
            .padding(16)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            if let recError {
                Text(recError)
                    .font(OttlineFont.medium(13))
                    .foregroundStyle(palette.danger)
            }

            if recLoading {
                ProgressView().frame(maxWidth: .infinity, minHeight: 120)
            } else if recState.items.isEmpty {
                Text(OttlineStrings.tr("‘새로운 추천 받기’를 누르면 지금 타임라인과 어울리는 작품들을 보여드려요.", "Tap Generate suggestions to discover titles matching your timeline.", locale: locale))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .padding(20)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            } else {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                    spacing: 16
                ) {
                    ForEach(recState.items) { item in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .top, spacing: 12) {
                                PosterImage(
                                    posterUrl: item.catalogTitle?.posterUrl,
                                    titleName: item.name,
                                    titleType: item.type,
                                    width: 60,
                                    height: 90,
                                    cornerRadius: 4
                                )
                                VStack(alignment: .leading, spacing: 4) {
                                    Text([
                                        OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                        item.year.map(String.init),
                                        item.author
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.medium(11.5))
                                    .foregroundStyle(palette.mutedInk)

                                    Text(item.name)
                                        .font(OttlineFont.bold(16))
                                        .foregroundStyle(palette.ink)

                                    Text(item.reason)
                                        .font(OttlineFont.regular(13.5))
                                        .foregroundStyle(palette.mutedInk)
                                }
                            }

                            HStack(spacing: 8) {
                                Button {
                                    Task { await connectRecommendation(item) }
                                } label: {
                                    Text(OttlineStrings.tr("타임라인에 담기", "Save to timeline", locale: locale))
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(palette.onBrandOrange)
                                        .padding(.horizontal, 12)
                                        .frame(height: 34)
                                        .background(palette.brandOrange)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)

                                Button {
                                    Task { await excludeRecommendation(item) }
                                } label: {
                                    Text(OttlineStrings.tr("제외하기", "Exclude", locale: locale))
                                        .font(OttlineFont.medium(12.5))
                                        .foregroundStyle(palette.mutedInk)
                                        .padding(.horizontal, 10)
                                        .frame(height: 34)
                                        .background(palette.background)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                }
            }
        }
    }

    private var excludedDesktopSheet: some View {
        NavigationStack {
            List(recState.exclusions) { ex in
                HStack {
                    Text(ex.name)
                        .font(OttlineFont.medium(14))
                    Spacer()
                    Button(OttlineStrings.tr("되돌리기", "Restore", locale: locale)) {
                        Task {
                            try? await repository.api.restoreRecommendationExclusion(key: ex.key)
                            if let refreshed = try? await repository.api.getRecommendationState() {
                                recState = refreshed
                            }
                        }
                    }
                }
            }
            .navigationTitle(OttlineStrings.tr("제외한 작품", "Excluded titles", locale: locale))
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) { showExcludedSheet = false }
                }
            }
        }
        .frame(minWidth: 420, minHeight: 360)
    }

    private var editionPickerDesktopSheet: some View {
        NavigationStack {
            List(editionCandidates) { item in
                Button {
                    showEditionPicker = false
                    appState.quickRecordRequest = QuickRecordRequest(
                        preselectedSearchItem: item,
                        preferredStatus: .wishlist,
                        selectSource: "future_timeline",
                        autoFocusSearch: false
                    )
                } label: {
                    HStack(spacing: 12) {
                        PosterImage(posterUrl: item.posterUrl, titleName: item.name, titleType: item.type, width: 40, height: 58)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.name).font(OttlineFont.semiBold(14.5))
                            Text([item.author, item.publisher, item.year.map(String.init)].compactMap { $0 }.joined(separator: " · "))
                                .font(OttlineFont.regular(12))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .navigationTitle(editionPickerTitle)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) { showEditionPicker = false }
                }
            }
        }
        .frame(minWidth: 460, minHeight: 400)
    }

    private func loadFirstServerPage() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        let ct = typeFilter == "all" ? nil : typeFilter
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: nil,
            contentType: ct,
            status: statusFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: q.isEmpty ? nil : q
        ) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
    }

    private func loadNextPage() async {
        guard hasMorePages, !loadingMore, let cursor = nextCursor else { return }
        loadingMore = true
        let ct = typeFilter == "all" ? nil : typeFilter
        let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if let page = try? await repository.api.getLogsPage(
            limit: 50,
            cursor: cursor,
            contentType: ct,
            status: statusFilter,
            place: placeFilter,
            occasion: occasionFilter,
            query: q.isEmpty ? nil : q
        ) {
            repository.upsertLogsFromServerPage(page.items)
            nextCursor = page.nextCursor
            hasMorePages = page.hasMore
        }
        loadingMore = false
    }

    private func loadRecommendationState() async {
        recLoading = true
        recError = nil
        do {
            _ = try await repository.ensureAuthenticated()
            recState = try await repository.api.getRecommendationState()
        } catch {
            recError = OttlineStrings.tr("추천 상태를 불러오지 못했어요.", "Couldn't load recommendations.", locale: locale)
        }
        recLoading = false
    }

    private func generateRecommendations() async {
        recGenerating = true
        recError = nil
        do {
            _ = try await repository.ensureAuthenticated()
            let (status, state) = try await repository.api.generateRecommendations(requestId: UUID().uuidString.lowercased())
            recState = state
            if status == 429 {
                recError = OttlineStrings.tr("오늘 생성 횟수를 모두 썼어요.", "You've reached today's generation limit.", locale: locale)
            }
        } catch {
            recError = OttlineStrings.tr("새로운 추천을 만들지 못했어요.", "Could not generate suggestions.", locale: locale)
        }
        recGenerating = false
    }

    private func excludeRecommendation(_ item: RecommendationItem) async {
        if let _ = try? await repository.api.excludeRecommendation(item),
           let refreshed = try? await repository.api.getRecommendationState() {
            recState = refreshed
        }
    }

    private func connectRecommendation(_ item: RecommendationItem) async {
        if let cat = item.catalogTitle {
            appState.quickRecordRequest = QuickRecordRequest(
                preselectedSearchItem: cat,
                preferredStatus: .wishlist,
                selectSource: "future_timeline",
                autoFocusSearch: false
            )
            return
        }
        let results = (try? await repository.api.searchRecommendationCatalog(
            name: item.name,
            type: item.type,
            year: item.year,
            author: item.author
        )) ?? []
        if results.isEmpty {
            appState.quickRecordRequest = QuickRecordRequest(
                initialQuery: item.name,
                initialTypeTab: item.type.rawValue,
                preferredStatus: .wishlist,
                autoFocusSearch: false
            )
        } else if results.count == 1 && item.type != .book {
            appState.quickRecordRequest = QuickRecordRequest(
                preselectedSearchItem: results[0],
                preferredStatus: .wishlist,
                selectSource: "future_timeline",
                autoFocusSearch: false
            )
        } else {
            editionPickerTitle = item.name
            editionCandidates = results
            showEditionPicker = true
        }
    }
}

// MARK: - Mac Together Split Reader View (2-Column Desktop Reader)

public struct MacTogetherSpreadView: View {
    public let repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState
    public var initialDiscussionId: String? = nil

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var curated: [CuratedContentItem] = []
    @State private var discussions: [DiscussionListItem] = []
    @State private var selectedDiscussion: DiscussionListItem?
    @State private var reactionState = DiscussionReactionState()
    @State private var reactionBusy: Bool = false
    @State private var searchQuery: String = ""
    @State private var loading: Bool = true

    public var body: some View {
        let filtered = discussions.filter { disc in
            let q = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return q.isEmpty || disc.titleName.lowercased().contains(q)
        }

        VStack(spacing: 0) {
            HStack(alignment: .top, spacing: 20) {
                // Left Pane: Curated Prompts & Discussion List
                VStack(alignment: .leading, spacing: 12) {
                    Text(OttlineStrings.tr("함께 기록", "TOGETHER", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.9)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("모두의 감상과 이야기", "Shared thoughts & stories", locale: locale))
                        .font(OttlineFont.bold(22))
                        .foregroundStyle(palette.ink)

                    TextField(
                        OttlineStrings.tr("작품명 검색", "Filter by title", locale: locale),
                        text: $searchQuery
                    )
                    .textFieldStyle(.plain)
                    .font(OttlineFont.regular(13.5))
                    .padding(.horizontal, 12)
                    .frame(height: 38)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                    ScrollView {
                        VStack(alignment: .leading, spacing: 10) {
                            if !curated.isEmpty && searchQuery.isEmpty {
                                Text(OttlineStrings.tr("오늘의 글감", "Curated prompts", locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.primaryAccent)
                                ForEach(curated.prefix(3)) { item in
                                    Button {
                                        appState.overlayStack.append(.titleDetail(item.titleId))
                                    } label: {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(item.titleName)
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.ink)
                                            Text(item.body)
                                                .font(OttlineFont.regular(12.5))
                                                .foregroundStyle(palette.mutedInk)
                                                .lineLimit(2)
                                        }
                                        .padding(10)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }

                            if loading && discussions.isEmpty {
                                ProgressView().frame(maxWidth: .infinity, minHeight: 120)
                            } else {
                                ForEach(filtered) { disc in
                                    let active = selectedDiscussion?.id == disc.id
                                    Button {
                                        selectedDiscussion = disc
                                        Task { await loadReactions(for: disc.id) }
                                    } label: {
                                        HStack(spacing: 10) {
                                            PosterImage(
                                                posterUrl: disc.posterUrl,
                                                titleName: disc.titleName,
                                                titleType: disc.titleType,
                                                width: 42,
                                                height: 62,
                                                cornerRadius: 4
                                            )
                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(disc.titleName)
                                                    .font(OttlineFont.semiBold(14))
                                                    .foregroundStyle(palette.ink)
                                                    .lineLimit(1)
                                                Text([
                                                    OttlineStrings.titleTypeLabel(disc.titleType, locale: locale),
                                                    disc.titleYear.map(String.init),
                                                    locale == "en" ? "\(disc.commentCount) comments" : "이야기 \(disc.commentCount)"
                                                ].compactMap { $0 }.joined(separator: " · "))
                                                .font(OttlineFont.regular(12))
                                                .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                                            }
                                            Spacer()
                                        }
                                        .padding(10)
                                        .background(active ? palette.paperStrong : palette.card)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.5 : 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                }
                .frame(width: 360)

                // Right Pane: Selected Title & Full Comments Reader
                ScrollView {
                    if let disc = selectedDiscussion {
                        let discTitle = Title(
                            id: disc.titleId,
                            provider: disc.titleProvider ?? .local,
                            providerId: disc.titleProviderId,
                            type: disc.titleType,
                            name: disc.titleName,
                            year: disc.titleYear,
                            posterUrl: disc.posterUrl
                        )

                        VStack(alignment: .leading, spacing: 18) {
                            HStack(alignment: .top, spacing: 18) {
                                PosterImage(
                                    posterUrl: disc.posterUrl,
                                    titleName: disc.titleName,
                                    titleType: disc.titleType,
                                    width: 96,
                                    height: 144,
                                    cornerRadius: 5
                                )
                                VStack(alignment: .leading, spacing: 8) {
                                    Text([
                                        OttlineStrings.titleTypeLabel(disc.titleType, locale: locale),
                                        disc.titleYear.map(String.init)
                                    ].compactMap { $0 }.joined(separator: " · "))
                                    .font(OttlineFont.medium(12))
                                    .foregroundStyle(palette.mutedInk)

                                    Text(disc.titleName)
                                        .font(OttlineFont.bold(24))
                                        .foregroundStyle(palette.ink)

                                    DiscussionReactionChipsView(
                                        titleType: disc.titleType,
                                        state: reactionState,
                                        isBusy: reactionBusy
                                    ) { type in
                                        Task {
                                            reactionBusy = true
                                            if let updated = try? await repository.toggleReactionAndAutoLog(
                                                discussionId: disc.id,
                                                title: discTitle,
                                                type: type
                                            ) {
                                                reactionState = updated
                                            }
                                            reactionBusy = false
                                        }
                                    }

                                    HStack(spacing: 8) {
                                        Button {
                                            appState.quickRecordRequest = QuickRecordRequest(
                                                preselectedTitle: discTitle,
                                                selectSource: "together",
                                                autoFocusSearch: false
                                            )
                                        } label: {
                                            Text(OttlineStrings.tr("이 작품 기록하기", "Log this title", locale: locale))
                                                .font(OttlineFont.semiBold(13))
                                                .foregroundStyle(palette.onBrandOrange)
                                                .padding(.horizontal, 14)
                                                .frame(height: 36)
                                                .background(palette.brandOrange)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            appState.overlayStack.append(.titleDetail(disc.titleId))
                                        } label: {
                                            Text(OttlineStrings.tr("상세 보기", "Open detail", locale: locale))
                                                .font(OttlineFont.medium(13))
                                                .foregroundStyle(palette.primaryAccent)
                                                .padding(.horizontal, 12)
                                                .frame(height: 36)
                                                .background(palette.card)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }
                            .padding(18)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                            CommentsPanelView(
                                title: discTitle,
                                initialDiscussionId: disc.id,
                                repository: repository,
                                showSyncLogCheckbox: true,
                                onSelectTitle: { tid in appState.overlayStack.append(.titleDetail(tid)) }
                            )

                            OttlineAppFooter()
                        }
                    } else {
                        Text(OttlineStrings.tr("왼쪽에서 이야기를 선택해 읽어보세요.", "Select a conversation from the left list.", locale: locale))
                            .font(OttlineFont.regular(15))
                            .foregroundStyle(palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 240)
                    }
                }
            }
            .frame(maxWidth: 1120)
            .padding(.horizontal, 28)
            .padding(.top, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .task(id: initialDiscussionId ?? "root") {
            await loadTogetherFeed()
        }
    }

    private func loadTogetherFeed() async {
        loading = true
        async let cTask = try? repository.api.getCuratedContents(limit: 6)
        async let dTask = try? repository.api.getAllDiscussions(limit: 100)
        curated = (await cTask) ?? []
        discussions = (await dTask) ?? []
        if let initialId = initialDiscussionId {
            if let match = discussions.first(where: { $0.id == initialId }) {
                selectedDiscussion = match
            } else if let direct = try? await repository.api.getDiscussionById(initialId) {
                selectedDiscussion = direct
            }
        } else if selectedDiscussion == nil {
            selectedDiscussion = discussions.first
        }
        if let sel = selectedDiscussion {
            await loadReactions(for: sel.id)
        }
        loading = false
    }

    private func loadReactions(for discussionId: String) async {
        if let state = try? await repository.api.getMyDiscussionReactions(discussionId: discussionId) {
            reactionState = state
        }
    }
}
