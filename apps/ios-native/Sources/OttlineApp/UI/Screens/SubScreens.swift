import SwiftUI
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
    @State private var recapShareUrl: URL?
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
                    posterUrl: $0.seasonPosterUrl ?? $0.title.posterUrl,
                    type: $0.title.type.rawValue,
                    watchedAt: $0.watchedAt
                )
            }

        VStack(spacing: 0) {
            subScreenHeader(title: OttlineStrings.tr("개인 이용 리포트", "Personal Report", locale: locale), onBack: onBack)

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    // Summary Metrics Grid
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        metricCard(
                            label: OttlineStrings.tr("전체 기록", "Total", locale: locale),
                            value: "\(report.totalLogs)"
                        )
                        metricCard(
                            label: OttlineStrings.tr("이번 달", "This month", locale: locale),
                            value: "\(report.thisMonthLogs)"
                        )
                        metricCard(
                            label: OttlineStrings.tr("메모 비율", "With note", locale: locale),
                            value: "\(report.noteFillPct)%"
                        )
                    }

                    // 9:16 Recap Share Card Studio (`WEEKLY` / `MONTHLY` / `HALF_YEAR`)
                    VStack(alignment: .leading, spacing: 14) {
                        Text(OttlineStrings.tr("9:16 리캡 스토리 카드", "9:16 Story Recap Studio", locale: locale))
                            .font(OttlineFont.semiBold(17))
                            .foregroundStyle(palette.ink)

                        HStack(spacing: 8) {
                            recapTabButton(.weekly, label: OttlineStrings.tr("주간 회고", "Weekly", locale: locale))
                            recapTabButton(.monthly, label: OttlineStrings.tr("월간 장르", "Monthly", locale: locale))
                            if report.seasonalRecap != nil {
                                recapTabButton(.halfYear, label: OttlineStrings.tr("상반기", "H1 Recap", locale: locale))
                            }
                        }

                        ZStack {
                            RoundedRectangle(cornerRadius: 12)
                                .fill(palette.paperStrong)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
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
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
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
                                    Image(systemName: "square.and.arrow.down")
                                    Text(OttlineStrings.tr("카드 저장", "Save card", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.ink)
                                .frame(maxWidth: .infinity, minHeight: 44)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)

                            if let recapShareUrl {
                                ShareLink(item: recapShareUrl) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "square.and.arrow.up")
                                        Text(OttlineStrings.tr("공유하기", "Share", locale: locale))
                                            .font(OttlineFont.semiBold(14))
                                    }
                                    .foregroundStyle(palette.onBrandNavy)
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .background(palette.brandNavy)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .padding(16)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(palette.border, lineWidth: 1)
                    )

                    // Top Platforms & Genres
                    if !report.topOtts.isEmpty {
                        VStack(alignment: .leading, spacing: 10) {
                            Text(OttlineStrings.tr("자주 찾은 플랫폼", "Top platforms", locale: locale))
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)
                            ForEach(report.topOtts, id: \.name) { item in
                                HStack {
                                    Text(item.name)
                                        .font(OttlineFont.medium(14))
                                        .foregroundStyle(palette.ink)
                                    Spacer()
                                    Text("\(item.count)")
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(12)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }
                }
                .padding(18)
            }
        }
        .background(palette.background)
        .task {
            loading = true
            let localReport = PersonalReportBuilder.buildFromLocalLogs(logs)
            report = localReport
            if !(repository.prefs.snapshot.userId ?? "").isEmpty,
               let remote = try? await repository.api.getPersonalReport() {
                report = remote
            }
            loading = false
            await renderCurrentRecap(monthPosters: monthPosters)
        }
        .onChange(of: selectedRecapKind) { _, _ in
            Task { await renderCurrentRecap(monthPosters: monthPosters) }
        }
    }

    private func metricCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
            Text(value)
                .font(OttlineFont.bold(20))
                .foregroundStyle(palette.ink)
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

    private func recapTabButton(_ kind: RecapCardKind, label: String) -> some View {
        let selected = selectedRecapKind == kind
        return Button {
            selectedRecapKind = kind
        } label: {
            Text(label)
                .font(selected ? OttlineFont.semiBold(13) : OttlineFont.medium(13))
                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                .frame(maxWidth: .infinity, minHeight: 38)
                .background(selected ? palette.brandNavy : palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private func renderCurrentRecap(monthPosters: [SeasonalRecapPoster]) async {
        renderingRecap = true
        let img = await CardExporter.renderRecapCardImage(
            kind: selectedRecapKind,
            report: report,
            monthPosters: monthPosters,
            nickname: repository.prefs.snapshot.nickname,
            locale: locale
        )
        recapImage = img
        recapShareUrl = CardExporter.writeTemporaryPng(img, fileName: "ottline-recap-\(selectedRecapKind.rawValue.lowercased()).png")
        renderingRecap = false
    }
}

// MARK: - 2. KDC BOOKSHELF SCREEN (`000`~`900`)

public struct BookshelfScreen: View {
    public let repository: OttlineRepository
    public var onBack: () -> Void
    public var onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecordBook: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        let sections = BookshelfBuilder.buildBookshelf(
            logs: repository.logs,
            classificationsByIsbn: repository.bookClassifications
        )
        let totalBooks = sections.reduce(0) { $0 + $1.books.count }

        VStack(spacing: 0) {
            subScreenHeader(
                title: OttlineStrings.tr("내 서가 (KDC 000~900)", "My Bookshelf (KDC 000-900)", locale: locale),
                onBack: onBack
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack {
                        Text(OttlineStrings.tr(
                            "한국십진분류법(KDC) 대분류 기준으로 정리한 \(totalBooks)권의 책이에요.",
                            "\(totalBooks) books organized by Korean Decimal Classification (000–900).",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                        Spacer()
                    }

                    if sections.isEmpty {
                        VStack(spacing: 12) {
                            Text(OttlineStrings.tr("아직 서가에 꽂힌 책이 없어요.", "No books on your shelf yet.", locale: locale))
                                .font(OttlineFont.medium(15))
                                .foregroundStyle(palette.mutedInk)
                            Button(action: onOpenQuickRecordBook) {
                                Text(OttlineStrings.tr("첫 책 기록 남기기", "Log your first book", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.onBrandOrange)
                                    .padding(.horizontal, 18)
                                    .padding(.vertical, 11)
                                    .background(palette.brandOrange)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 48)
                    } else {
                        ForEach(sections) { sec in
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Text(sec.codeLabel)
                                        .font(.system(size: 13, weight: .bold, design: .monospaced))
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))

                                    Text(locale == "en" ? sec.titleEn : sec.titleKo)
                                        .font(OttlineFont.semiBold(17))
                                        .foregroundStyle(palette.ink)

                                    Spacer()

                                    Text("\(sec.books.count)")
                                        .font(OttlineFont.medium(13))
                                        .foregroundStyle(palette.mutedInk)
                                }

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 14) {
                                        ForEach(sec.books) { book in
                                            Button {
                                                onOpenTitleDetail(book.representativeLog.title.id)
                                            } label: {
                                                VStack(alignment: .leading, spacing: 6) {
                                                    PosterImage(
                                                        posterUrl: book.representativeLog.title.posterUrl,
                                                        titleName: book.representativeLog.title.name,
                                                        titleType: .book,
                                                        width: 84,
                                                        height: 122
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
                            .padding(16)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                    }
                }
                .padding(18)
            }
        }
        .background(palette.background)
        .task {
            let books = repository.logs.map(\.title).filter { $0.type == .book }
            await repository.ensureBookClassificationsCached(titles: books)
        }
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
    @State private var replyText: String = ""
    @State private var submitting: Bool = false

    public var body: some View {
        VStack(spacing: 0) {
            subScreenHeader(
                title: activeDetail?.subject ?? OttlineStrings.tr("내 문의함", "Feedback & Support", locale: locale),
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
                        ForEach(detail.messages) { msg in
                            let isAdmin = msg.authorRole == .admin
                            VStack(alignment: .leading, spacing: 6) {
                                Text(isAdmin
                                    ? OttlineStrings.tr("ottline 운영팀", "ottline Team", locale: locale)
                                    : OttlineStrings.tr("내가 남긴 글", "You", locale: locale)
                                )
                                .font(OttlineFont.semiBold(12))
                                .foregroundStyle(palette.primaryAccent)

                                Text(msg.body)
                                    .font(OttlineFont.regular(14))
                                    .foregroundStyle(palette.ink)
                            }
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(isAdmin ? palette.sageAccent : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }

                        HStack(spacing: 8) {
                            TextField(
                                OttlineStrings.tr("추가 메시지 남기기", "Write a reply", locale: locale),
                                text: $replyText
                            )
                            .font(OttlineFont.regular(14))
                            .padding(10)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            Button {
                                Task { await sendReply(threadId: detail.id) }
                            } label: {
                                Text(OttlineStrings.tr("전송", "Send", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.onBrandNavy)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                                    .background(palette.brandNavy)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || submitting)
                        }
                    } else {
                        // Composer
                        VStack(alignment: .leading, spacing: 10) {
                            Text(OttlineStrings.tr("새 의견 또는 문의 남기기", "Send a message", locale: locale))
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
                                                .padding(.vertical, 6)
                                                .background(selected ? palette.brandNavy : palette.paperStrong)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                            }

                            TextField(
                                OttlineStrings.tr("제목 (선택)", "Subject (optional)", locale: locale),
                                text: $subject
                            )
                            .font(OttlineFont.regular(14))
                            .padding(10)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            TextField(
                                OttlineStrings.tr("내용을 입력해 주세요", "Write your message", locale: locale),
                                text: $bodyText,
                                axis: .vertical
                            )
                            .lineLimit(3...6)
                            .font(OttlineFont.regular(14))
                            .padding(10)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))

                            Button {
                                Task { await createThread() }
                            } label: {
                                Text(OttlineStrings.tr("보내기", "Submit", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.onBrandNavy)
                                    .frame(maxWidth: .infinity, minHeight: 44)
                                    .background(palette.brandNavy)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || submitting)
                        }
                        .padding(16)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(palette.border, lineWidth: 1)
                        )

                        // Thread list
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
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(18)
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

    private func sendReply(threadId: String) async {
        let trimmed = replyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !submitting else { return }
        submitting = true
        if let updated = try? await repository.api.sendFeedbackMessage(threadId: threadId, body: trimmed) {
            activeDetail = updated
            replyText = ""
        }
        submitting = false
    }
}

// MARK: - 4. GUIDES & PRIVACY SCREEN

public struct GuideInfoScreen: View {
    public var onBack: () -> Void
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        let sections: [(String, String)] = [
            (
                OttlineStrings.tr("한 손 수첩처럼 가볍게", "Like a pocket notebook", locale: locale),
                OttlineStrings.tr(
                    "작품 제목을 고르고 ‘봤어요·보는 중·보고 싶어요’ 중 하나만 누르면 즉시 이 기기에 저장돼요. 날짜나 장소, 함께한 순간, 문장은 기억하고 싶을 때만 골라 적으면 충분해요.",
                    "Tap Watched, Watching, or Want to watch and your record is saved immediately on-device. Details of the moment are always optional.",
                    locale: locale
                )
            ),
            (
                OttlineStrings.tr("오프라인에서도 끊기지 않는 보관", "Offline-first & calm sync", locale: locale),
                OttlineStrings.tr(
                    "지하철이나 비행기 안에서도 기록을 남길 수 있어요. 기기 내부 데이터베이스(SQLite)와 동기화 보관함(Outbox)에 먼저 담은 뒤 연결이 돌아오면 자동으로 맞춰둬요.",
                    "Log stories on subways or flights. Everything is stored locally first and synced automatically once you're back online.",
                    locale: locale
                )
            ),
            (
                OttlineStrings.tr("비공개가 기본인 기록", "Private by default", locale: locale),
                OttlineStrings.tr(
                    "남겨둔 날짜, 장소, 메모는 오직 내 타임라인에만 남아요. ‘함께 화면에도 나누기’를 직접 체크했을 때만 공개 대화방에 생각이 공유돼요.",
                    "Your timeline notes and moments are private unless you explicitly check 'Also share in Together'.",
                    locale: locale
                )
            ),
            (
                OttlineStrings.tr("개인정보 및 계정 안내", "Privacy & Connection Code", locale: locale),
                OttlineStrings.tr(
                    "이메일·전화번호를 수집하지 않으며 연결 코드로만 기기를 이어줘요. 설정에서 언제든 이 기기 데이터만 비우거나 서버 데이터를 영구 삭제할 수 있어요.",
                    "No email or phone number is collected. You can reset local data or permanently delete all server data anytime in My Space.",
                    locale: locale
                )
            )
        ]

        VStack(spacing: 0) {
            subScreenHeader(
                title: OttlineStrings.tr("기록 가이드 · 개인정보 안내", "Guides & Privacy", locale: locale),
                onBack: onBack
            )

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(sections, id: \.0) { title, desc in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(title)
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.primaryAccent)
                            Text(desc)
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .lineSpacing(4)
                        }
                        .padding(16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }

                    if let privacyUrl = URL(string: "https://ottline.app/privacy") {
                        Link(destination: privacyUrl) {
                            HStack {
                                Text(OttlineStrings.tr("웹에서 개인정보처리방침 전문 보기", "Read full privacy policy", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                Spacer()
                                Image(systemName: "arrow.up.right.square")
                            }
                            .foregroundStyle(palette.primaryAccent)
                            .padding(14)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                    }
                }
                .padding(18)
            }
        }
        .background(palette.background)
    }
}

private func subScreenHeader(title: String, onBack: @escaping () -> Void) -> some View {
    HStack(spacing: 10) {
        Button(action: onBack) {
            Image(systemName: "chevron.left")
                .font(.system(size: 17, weight: .semibold))
                .frame(width: 32, height: 32)
        }
        .buttonStyle(.plain)

        Text(title)
            .font(OttlineFont.semiBold(19))
            .lineLimit(1)

        Spacer()
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 12)
}
