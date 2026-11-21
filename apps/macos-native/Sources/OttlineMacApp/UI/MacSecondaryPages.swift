import SwiftUI
import AppKit
import OttlineCore

// MARK: - Shared Secondary Page Helpers (Web `v2-secondary-page` 1:1 Desktop Parity)

public enum MacInfoMode: Equatable {
    case guides, about, faq, privacy
}

private struct MacSecondaryRemoteImage: View {
    let urlString: String
    let height: CGFloat
    var contentMode: ContentMode = .fill

    @Environment(\.ottlinePalette) private var palette
    @State private var image: NSImage?

    var body: some View {
        let resolvedUrl = URL(string: urlString)
        let display = resolvedUrl.flatMap { OttlinePosterImageCache.shared.cachedImage(for: $0) } ?? image

        ZStack {
            palette.mutedBg
            if let display {
                Image(nsImage: display)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .frame(maxWidth: .infinity, maxHeight: height, alignment: .top)
            } else {
                VStack(spacing: 8) {
                    OttlineBrandMark(size: 32)
                    Text("ottline")
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.subtleInk)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
        .clipped()
        .task(id: urlString) {
            guard let url = resolvedUrl else { return }
            if let hit = OttlinePosterImageCache.shared.cachedImage(for: url) {
                image = hit
                return
            }
            image = await OttlinePosterImageCache.shared.loadFirstAvailable(urls: [url])
        }
    }
}

private func macOpenExternalUrl(_ raw: String) {
    if let url = URL(string: raw) {
        NSWorkspace.shared.open(url)
    }
}

private func macFormatShortTimestamp(_ iso: String, locale: String) -> String {
    let f1 = ISO8601DateFormatter()
    f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    let f2 = ISO8601DateFormatter()
    f2.formatOptions = [.withInternetDateTime]
    guard let date = f1.date(from: iso) ?? f2.date(from: iso) else {
        return RecordDate.formatDisplayDate(iso, locale: locale)
    }
    let out = DateFormatter()
    out.locale = Locale(identifier: locale == "en" ? "en_US" : "ko_KR")
    out.dateFormat = locale == "en" ? "MMM d, h:mm a" : "M월 d일 a h:mm"
    return out.string(from: date)
}

// MARK: - 1. Feedback Inbox (`FeedbackInbox.tsx` 1:1 Desktop Parity)

public struct MacFeedbackView: View {
    @ObservedObject public var repository: OttlineRepository
    public var prefilledBody: String?
    public let onBack: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var threads: [FeedbackThreadSummary] = []
    @State private var selectedId: String?
    @State private var detail: FeedbackThreadDetail?
    @State private var category: FeedbackCategory = .question
    @State private var subject: String = ""
    @State private var bodyText: String = ""
    @State private var loading: Bool = true
    @State private var loadingDetail: Bool = false
    @State private var submitting: Bool = false
    @State private var statusMessage: String?
    @State private var statusIsError: Bool = false

    public init(
        repository: OttlineRepository,
        prefilledBody: String? = nil,
        onBack: @escaping () -> Void
    ) {
        self._repository = ObservedObject(wrappedValue: repository)
        self.prefilledBody = prefilledBody
        self.onBack = onBack
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Button(action: onBack) {
                    HStack(spacing: 6) {
                        OttlineLucideIcon(kind: .arrowLeft, size: 15, color: palette.primaryAccent)
                        Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                // Header
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "envelope.open")
                            .font(.system(size: 19, weight: .semibold))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr("내 문의함", "My inbox", locale: locale))
                            .font(OttlineFont.bold(28))
                            .foregroundStyle(palette.ink)
                    }
                    Text(OttlineStrings.tr(
                        "질문이나 불편한 점, 아이디어를 남겨주세요. ottline의 답변도 여기에서 확인할 수 있어요.",
                        "Send a question, report a problem, or share an idea. Replies from the ottline team appear here.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(15))
                    .foregroundStyle(palette.mutedInk)
                }

                // Compose Card
                VStack(alignment: .leading, spacing: 16) {
                    HStack(spacing: 8) {
                        OttlineLucideIcon(kind: .messageCircle, size: 16, color: palette.ink)
                        Text(OttlineStrings.tr("문의 남기기", "Send a message", locale: locale))
                            .font(OttlineFont.semiBold(15))
                            .foregroundStyle(palette.ink)
                    }

                    HStack(alignment: .top, spacing: 14) {
                        // Category Selector
                        VStack(alignment: .leading, spacing: 6) {
                            Text(OttlineStrings.tr("문의 유형", "Category", locale: locale))
                                .font(OttlineFont.medium(13))
                                .foregroundStyle(palette.ink)
                            OttlineSelectDropdown(
                                selection: $category,
                                options: FeedbackCategory.allCases.map { item in
                                    OttlineSelectOption(
                                        value: item,
                                        label: OttlineStrings.feedbackCategoryLabel(item, locale: locale)
                                    )
                                },
                                compact: false,
                                fullWidth: true,
                                backgroundStyle: .background
                            )
                        }
                        .frame(width: 200)

                        // Subject Input
                        VStack(alignment: .leading, spacing: 6) {
                            Text(OttlineStrings.tr("제목", "Subject", locale: locale))
                                .font(OttlineFont.medium(13))
                                .foregroundStyle(palette.ink)
                            TextField(
                                OttlineStrings.tr("예: 기록 연결 코드가 보이지 않아요", "Example: I can’t find my connection code", locale: locale),
                                text: $subject
                            )
                            .textFieldStyle(.plain)
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 12)
                            .frame(height: 44)
                            .background(palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            .onChange(of: subject) { _, next in
                                if next.count > 120 { subject = String(next.prefix(120)) }
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }

                    // Body Input
                    VStack(alignment: .leading, spacing: 6) {
                        Text(OttlineStrings.tr("내용", "Message", locale: locale))
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(palette.ink)
                        ZStack(alignment: .topLeading) {
                            if bodyText.isEmpty {
                                Text(OttlineStrings.tr(
                                    "무엇이 궁금한지, 어떤 상황에서 문제가 발생했는지 자세히 남겨주세요.",
                                    "Tell us what you are trying to do and what went wrong.",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.subtleInk)
                                .padding(.horizontal, 14)
                                .padding(.vertical, 12)
                                .allowsHitTesting(false)
                            }
                            TextEditor(text: $bodyText)
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.ink)
                                .scrollContentBackground(.hidden)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 8)
                                .frame(minHeight: 130, maxHeight: 220)
                        }
                        .background(palette.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }

                    HStack(alignment: .center) {
                        Text(OttlineStrings.tr("답변은 이 문의함에서 확인할 수 있어요.", "Replies will appear in this inbox.", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)

                        Spacer()

                        Button {
                            Task { await submitThread() }
                        } label: {
                            Text(
                                submitting
                                    ? OttlineStrings.tr("보내는 중…", "Sending…", locale: locale)
                                    : OttlineStrings.tr("문의 보내기", "Send message", locale: locale)
                            )
                            .font(OttlineFont.semiBold(14.5))
                            .foregroundStyle(palette.onBrandOrange)
                            .padding(.horizontal, 22)
                            .frame(minWidth: 140, minHeight: 46)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .disabled(submitting || bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .opacity(submitting || bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1)
                    }

                    if let statusMessage {
                        Text(statusMessage)
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(statusIsError ? palette.danger : palette.primaryAccent)
                    }
                }
                .padding(24)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                // Bottom 2-Column Split: My Threads List (340pt) + Thread Detail Reader
                HStack(alignment: .top, spacing: 20) {
                    // Left: Thread List
                    VStack(alignment: .leading, spacing: 12) {
                        Text(OttlineStrings.tr("내 문의 목록", "My messages", locale: locale))
                            .font(OttlineFont.semiBold(15))
                            .foregroundStyle(palette.ink)

                        if loading {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text(OttlineStrings.tr("불러오는 중…", "Loading…", locale: locale))
                                    .font(OttlineFont.regular(13.5))
                                    .foregroundStyle(palette.mutedInk)
                            }
                            .padding(.vertical, 20)
                        } else if threads.isEmpty {
                            Text(OttlineStrings.tr("아직 보낸 문의가 없어요.", "You haven’t sent any messages yet.", locale: locale))
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.mutedInk)
                                .padding(20)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                                )
                        } else {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(threads) { thread in
                                    let isSelected = selectedId == thread.id
                                    Button {
                                        Task { await openThread(thread.id) }
                                    } label: {
                                        VStack(alignment: .leading, spacing: 6) {
                                            HStack {
                                                Text(OttlineStrings.feedbackCategoryLabel(thread.category, locale: locale))
                                                    .font(OttlineFont.semiBold(11.5))
                                                    .foregroundStyle(palette.primaryAccent)
                                                Spacer()
                                                Text(OttlineStrings.feedbackStatusLabel(thread.status, locale: locale))
                                                    .font(OttlineFont.medium(11.5))
                                                    .foregroundStyle(thread.status == .answered ? palette.success : palette.mutedInk)
                                            }
                                            Text((thread.subject?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? thread.subject! : OttlineStrings.tr("제목 없음", "Untitled", locale: locale)))
                                                .font(OttlineFont.semiBold(14))
                                                .foregroundStyle(palette.ink)
                                                .lineLimit(1)
                                            Text(thread.lastMessagePreview ?? OttlineStrings.tr("메시지가 없어요.", "No messages yet.", locale: locale))
                                                .font(OttlineFont.regular(12.5))
                                                .foregroundStyle(palette.mutedInk)
                                                .lineLimit(2)
                                            Text(macFormatShortTimestamp(thread.updatedAt, locale: locale))
                                                .font(OttlineFont.regular(11.5))
                                                .foregroundStyle(palette.subtleInk)
                                        }
                                        .padding(14)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(isSelected ? palette.paperStrong : palette.background)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(isSelected ? palette.primaryAccent : palette.border, lineWidth: isSelected ? 1.5 : 1)
                                        )
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                        }
                    }
                    .padding(20)
                    .frame(width: 340, alignment: .topLeading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                    // Right: Selected Thread Detail Conversation
                    VStack(alignment: .leading, spacing: 16) {
                        if loadingDetail {
                            HStack(spacing: 8) {
                                ProgressView().controlSize(.small)
                                Text(OttlineStrings.tr("불러오는 중…", "Loading…", locale: locale))
                                    .font(OttlineFont.regular(13.5))
                                    .foregroundStyle(palette.mutedInk)
                            }
                            .frame(maxWidth: .infinity, minHeight: 240)
                        } else if let detail {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 8) {
                                    Text(OttlineStrings.feedbackCategoryLabel(detail.category, locale: locale))
                                        .font(OttlineFont.semiBold(12))
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 4)
                                        .background(palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                    Text(OttlineStrings.feedbackStatusLabel(detail.status, locale: locale))
                                        .font(OttlineFont.medium(12))
                                        .foregroundStyle(palette.mutedInk)
                                }
                                Text((detail.subject?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? detail.subject! : OttlineStrings.tr("제목 없음", "Untitled", locale: locale)))
                                    .font(OttlineFont.bold(19))
                                    .foregroundStyle(palette.ink)
                                let dateStr = macFormatShortTimestamp(detail.updatedAt, locale: locale)
                                Text(OttlineStrings.tr("최근 소식 \(dateStr)", "Last activity \(dateStr)", locale: locale))
                                    .font(OttlineFont.regular(12))
                                    .foregroundStyle(palette.subtleInk)
                            }
                            .padding(.bottom, 12)
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(palette.border).frame(height: 1)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                ForEach(detail.messages) { msg in
                                    let mine = msg.authorRole == .user
                                    VStack(alignment: .leading, spacing: 8) {
                                        HStack {
                                            Text(
                                                mine
                                                    ? OttlineStrings.tr("내 문의", "My message", locale: locale)
                                                    : OttlineStrings.tr("ottline 답변", "ottline team", locale: locale)
                                            )
                                            .font(OttlineFont.semiBold(12.5))
                                            .foregroundStyle(mine ? palette.primaryAccent : palette.ink)
                                            Spacer()
                                            Text(macFormatShortTimestamp(msg.createdAt, locale: locale))
                                                .font(OttlineFont.regular(11.5))
                                                .foregroundStyle(palette.subtleInk)
                                        }
                                        Text(msg.body)
                                            .font(OttlineFont.regular(14.5))
                                            .foregroundStyle(palette.ink)
                                            .lineSpacing(5)
                                            .textSelection(.enabled)
                                    }
                                    .padding(16)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(mine ? palette.paperStrong : palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(mine ? palette.primaryAccent.opacity(0.25) : palette.border, lineWidth: 1)
                                    )
                                }
                            }
                        } else {
                            Text(
                                loading
                                    ? OttlineStrings.tr("불러오는 중…", "Loading…", locale: locale)
                                    : OttlineStrings.tr(
                                        "목록에서 문의를 선택하면 대화 내용을 볼 수 있어요.",
                                        "Select a message from the list to view the conversation.",
                                        locale: locale
                                    )
                            )
                            .font(OttlineFont.regular(14))
                            .foregroundStyle(palette.mutedInk)
                            .frame(maxWidth: .infinity, minHeight: 240)
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                            )
                        }
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }

                OttlineAppFooter()
            }
            .frame(maxWidth: 1280, alignment: .leading)
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .onAppear {
            if let p = prefilledBody, !p.isEmpty, bodyText.isEmpty {
                bodyText = p
            }
        }
        .task {
            await bootstrapThreads()
        }
    }

    @MainActor
    private func bootstrapThreads() async {
        loading = true
        statusMessage = nil
        do {
            if (repository.prefs.snapshot.userId ?? "").isEmpty {
                _ = try await repository.ensureAuthenticated()
            }
            let items = try await repository.api.getFeedbackThreads()
            threads = items
            if let first = items.first {
                selectedId = first.id
                detail = try? await repository.api.getFeedbackThreadDetail(threadId: first.id)
            } else {
                selectedId = nil
                detail = nil
            }
        } catch {
            statusIsError = true
            statusMessage = OttlineStrings.tr(
                "문의 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
                "Could not load your messages. Please try again shortly.",
                locale: locale
            )
            threads = []
            detail = nil
        }
        loading = false
    }

    @MainActor
    private func openThread(_ id: String) async {
        selectedId = id
        loadingDetail = true
        do {
            detail = try await repository.api.getFeedbackThreadDetail(threadId: id)
        } catch {
            statusIsError = true
            statusMessage = OttlineStrings.tr(
                "문의 내용을 불러오지 못했어요. 다시 선택해 주세요.",
                "Could not open this message. Select it again to try.",
                locale: locale
            )
        }
        loadingDetail = false
    }

    @MainActor
    private func submitThread() async {
        let trimmedBody = bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedBody.isEmpty, !submitting else { return }
        submitting = true
        statusMessage = nil
        do {
            _ = try await repository.ensureAuthenticated()
            let trimmedSubject = subject.trimmingCharacters(in: .whitespacesAndNewlines)
            let created = try await repository.api.createFeedbackThread(
                category: category,
                subject: trimmedSubject.isEmpty ? nil : trimmedSubject,
                body: trimmedBody
            )
            category = .question
            subject = ""
            bodyText = ""
            let items = try await repository.api.getFeedbackThreads()
            threads = items
            selectedId = created.id
            detail = created
            statusIsError = false
            statusMessage = OttlineStrings.tr(
                "문의가 전해졌어요. 답변은 이 문의함에서 확인해 주세요.",
                "Message sent. Check this inbox for a reply.",
                locale: locale
            )
        } catch {
            statusIsError = true
            statusMessage = OttlineStrings.tr(
                "문의를 보내지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.",
                "Could not send your message. Check your connection and try again.",
                locale: locale
            )
        }
        submitting = false
    }
}

// MARK: - 2. Secondary Info Pages Hub (Guides, About, FAQ, Privacy — Web 1:1 Parity)

public struct MacGuideInfoView: View {
    public var initialSlug: String? = nil
    public let mode: MacInfoMode
    public let onBack: () -> Void
    public var onOpenQuickRecord: (String) -> Void = { _ in }
    public var onOpenOverlay: (ActiveOverlayScreen) -> Void = { _ in }
    public var onOpenMySpace: () -> Void = {}

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @State private var activeGuideSlug: String?

    public init(
        initialSlug: String? = nil,
        mode: MacInfoMode,
        onBack: @escaping () -> Void,
        onOpenQuickRecord: @escaping (String) -> Void = { _ in },
        onOpenOverlay: @escaping (ActiveOverlayScreen) -> Void = { _ in },
        onOpenMySpace: @escaping () -> Void = {}
    ) {
        self.initialSlug = initialSlug
        self.mode = mode
        self.onBack = onBack
        self.onOpenQuickRecord = onOpenQuickRecord
        self.onOpenOverlay = onOpenOverlay
        self.onOpenMySpace = onOpenMySpace
        self._activeGuideSlug = State(initialValue: initialSlug)
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                if mode == .guides, let slug = activeGuideSlug, let doc = MacGuideCatalog.document(slug: slug, locale: locale) {
                    guideArticleContent(doc)
                } else {
                    Button(action: onBack) {
                        HStack(spacing: 6) {
                            OttlineLucideIcon(kind: .arrowLeft, size: 15, color: palette.primaryAccent)
                            Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    switch mode {
                    case .guides:
                        guidesHubContent
                    case .about:
                        aboutContent
                    case .faq:
                        faqContent
                    case .privacy:
                        privacyContent
                    }
                }

                OttlineAppFooter()
            }
            .frame(maxWidth: 1280, alignment: .leading)
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .onChange(of: initialSlug) { _, next in
            activeGuideSlug = next
        }
    }

    // MARK: Guides Hub (`guide/page.tsx`)

    private var guidesHubContent: some View {
        let isEn = locale == "en"
        let docs = MacGuideCatalog.allDocuments(locale: locale)

        return VStack(alignment: .leading, spacing: 32) {
            VStack(alignment: .leading, spacing: 12) {
                Text(isEn ? "ottline guides" : "ottline 기록 안내")
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
                Text(isEn ? "A quieter way to remember what you watched and read" : "가볍게 남긴 기록이, 나중의 기억이 돼요")
                    .font(OttlineFont.bold(32))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "Save the details that matter now and leave the rest for later. These guides walk through the simple path from finding a title to seeing it on your timeline."
                     : "방금 본 작품도, 오래 곁에 둔 책도 필요한 만큼만 적어두세요. 검색부터 타임라인까지, ottline의 기록 흐름을 차근차근 안내할게요.")
                    .font(OttlineFont.regular(16))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(5)
                    .frame(maxWidth: 740, alignment: .leading)
            }

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 20),
                    GridItem(.flexible(), spacing: 20),
                    GridItem(.flexible(), spacing: 20)
                ],
                spacing: 20
            ) {
                ForEach(docs) { doc in
                    Button {
                        activeGuideSlug = doc.slug
                    } label: {
                        VStack(alignment: .leading, spacing: 0) {
                            MacSecondaryRemoteImage(
                                urlString: "https://ottline.app\(doc.imagePath)",
                                height: 210,
                                contentMode: .fill
                            )
                            .overlay(alignment: .bottom) {
                                Rectangle().fill(palette.border).frame(height: 1)
                            }

                            VStack(alignment: .leading, spacing: 12) {
                                HStack(spacing: 6) {
                                    Image(systemName: doc.symbolName)
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(palette.primaryAccent)
                                    Text(doc.eyebrow)
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(palette.primaryAccent)
                                }

                                Text(doc.cardTitle)
                                    .font(OttlineFont.semiBold(18))
                                    .foregroundStyle(palette.ink)
                                    .lineSpacing(3)
                                    .multilineTextAlignment(.leading)

                                Text(doc.cardDescription)
                                    .font(OttlineFont.regular(14.5))
                                    .foregroundStyle(palette.mutedInk)
                                    .lineSpacing(4)
                                    .multilineTextAlignment(.leading)

                                Spacer(minLength: 4)

                                HStack(spacing: 6) {
                                    Text(isEn ? "Read the guide" : "안내 보기")
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.primaryAccent)
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 13, weight: .semibold))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(.top, 4)
                            }
                            .padding(20)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                        }
                        .frame(maxWidth: .infinity, minHeight: 430, alignment: .topLeading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            VStack(alignment: .leading, spacing: 8) {
                Text(isEn ? "Your records can be as simple as you like" : "정답 없이, 내 방식대로 남겨요")
                    .font(OttlineFont.semiBold(20))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "A title and a status are enough. You can add a feeling or a note whenever you like."
                     : "느낌이나 메모는 선택이에요. 제목과 상태만 남겨도 타임라인이 시작돼요.")
                    .font(OttlineFont.regular(15))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(4)
            }
            .padding(26)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
    }

    // MARK: Guide Article (`guide/[slug]/page.tsx`)

    private func guideArticleContent(_ doc: MacGuideDocument) -> some View {
        let isEn = locale == "en"
        let related = MacGuideCatalog.allDocuments(locale: locale).filter { $0.slug != doc.slug }

        return VStack(alignment: .leading, spacing: 28) {
            Button {
                activeGuideSlug = nil
            } label: {
                HStack(spacing: 6) {
                    OttlineLucideIcon(kind: .arrowLeft, size: 15, color: palette.primaryAccent)
                    Text(isEn ? "Movie, series, and book log guides" : "영상·책 기록 가이드")
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.primaryAccent)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 12) {
                Text(doc.eyebrow)
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
                Text(doc.title)
                    .font(OttlineFont.bold(32))
                    .foregroundStyle(palette.ink)
                Text(doc.summary)
                    .font(OttlineFont.regular(16.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(6)
                Text(doc.updatedLabel)
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.subtleInk)
            }

            // Framed Guide Screenshot
            VStack(alignment: .leading, spacing: 12) {
                MacSecondaryRemoteImage(
                    urlString: "https://ottline.app\(doc.imagePath)",
                    height: 440,
                    contentMode: .fit
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                Text(doc.imageCaption)
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(4)
            }
            .padding(18)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // Sections
            VStack(alignment: .leading, spacing: 32) {
                ForEach(doc.sections) { section in
                    VStack(alignment: .leading, spacing: 12) {
                        Text(section.title)
                            .font(OttlineFont.semiBold(22))
                            .foregroundStyle(palette.ink)

                        ForEach(section.paragraphs, id: \.self) { para in
                            Text(para)
                                .font(OttlineFont.regular(15.5))
                                .foregroundStyle(palette.mutedInk)
                                .lineSpacing(6)
                        }

                        if !section.items.isEmpty {
                            LazyVGrid(
                                columns: [
                                    GridItem(.flexible(), spacing: 14),
                                    GridItem(.flexible(), spacing: 14),
                                    GridItem(.flexible(), spacing: 14)
                                ],
                                spacing: 14
                            ) {
                                ForEach(Array(section.items.enumerated()), id: \.element.title) { idx, item in
                                    VStack(alignment: .leading, spacing: 8) {
                                        if section.ordered {
                                            Text(String(format: "%02d", idx + 1))
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.primaryAccent)
                                        }
                                        Text(item.title)
                                            .font(OttlineFont.semiBold(15.5))
                                            .foregroundStyle(section.ordered ? palette.ink : palette.primaryAccent)
                                        Text(item.description)
                                            .font(OttlineFont.regular(14))
                                            .foregroundStyle(palette.mutedInk)
                                            .lineSpacing(4)
                                    }
                                    .padding(18)
                                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                                }
                            }
                            .padding(.top, 4)
                        }
                    }
                }
            }

            // Record Action CTA
            VStack(alignment: .leading, spacing: 12) {
                Text(doc.ctaTitle)
                    .font(OttlineFont.semiBold(22))
                    .foregroundStyle(palette.ink)
                Text(doc.ctaDescription)
                    .font(OttlineFont.regular(15))
                    .foregroundStyle(palette.mutedInk)
                Button {
                    onOpenQuickRecord(doc.contentType)
                } label: {
                    Text(doc.ctaLabel)
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.onBrandOrange)
                        .padding(.horizontal, 22)
                        .frame(height: 46)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }
            .padding(26)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // Related Guides
            VStack(alignment: .leading, spacing: 14) {
                Text(isEn ? "Explore another guide" : "다른 기록 안내")
                    .font(OttlineFont.semiBold(19))
                    .foregroundStyle(palette.ink)

                HStack(alignment: .top, spacing: 16) {
                    ForEach(related) { rel in
                        Button {
                            activeGuideSlug = rel.slug
                        } label: {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(rel.cardTitle)
                                    .font(OttlineFont.semiBold(16))
                                    .foregroundStyle(palette.primaryAccent)
                                Text(rel.cardDescription)
                                    .font(OttlineFont.regular(14))
                                    .foregroundStyle(palette.mutedInk)
                                    .lineSpacing(4)
                                HStack(spacing: 6) {
                                    Text(isEn ? "Read the guide" : "안내 보기")
                                        .font(OttlineFont.semiBold(13.5))
                                        .foregroundStyle(palette.primaryAccent)
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 12.5, weight: .semibold))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(.top, 6)
                            }
                            .padding(20)
                            .frame(maxWidth: .infinity, alignment: .topLeading)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    // MARK: About Page (`about/page.tsx`)

    private var aboutContent: some View {
        let isEn = locale == "en"
        let platforms: [(num: String, icon: String, title: String, desc: String, linkLabel: String?, linkUrl: String?, status: String?)] = [
            (
                "01", "globe",
                isEn ? "Web and installable PWA" : "웹과 설치형 PWA",
                isEn ? "Use it directly in the browser, then install it on your home screen or desktop to reopen it like an app."
                     : "브라우저에서 바로 쓰고, 홈 화면이나 데스크톱에 설치해 앱처럼 다시 열 수 있어요.",
                isEn ? "Open the web app" : "웹에서 열기",
                isEn ? "https://ottline.app/en" : "https://ottline.app/ko",
                nil
            ),
            (
                "02", "iphone",
                isEn ? "Android app" : "Android 앱",
                isEn ? "Install from Google Play to reach the record window from your home screen, widget, or watch reminder settings."
                     : "Google Play에서 설치해 홈 화면, 위젯, 시청 기록 알림 설정으로 더 빠르게 기록 화면에 들어갈 수 있어요.",
                isEn ? "Install ottline from Google Play" : "Google Play에서 ottline 설치",
                "https://play.google.com/store/apps/details?id=app.ottline",
                nil
            ),
            (
                "03", "apple.logo",
                isEn ? "iOS app" : "iOS 앱",
                isEn ? "Install from the App Store and continue the same records and timeline on iPhone."
                     : "App Store에서 설치해 iPhone에서도 같은 기록 흐름과 타임라인을 이어갈 수 있어요.",
                isEn ? "Download ottline on the App Store" : "App Store에서 ottline 설치",
                isEn ? "https://apps.apple.com/us/app/ottline/id6780318110" : "https://apps.apple.com/kr/app/ottline/id6780318110",
                nil
            ),
            (
                "04", "desktopcomputer",
                isEn ? "Windows app" : "Windows 앱",
                isEn ? "The native Windows app keeps your records on your device for offline viewing. Use Windows 11 widgets or Ctrl+Shift+O to start a record, and connect your existing OTT watch history with your record connection code."
                     : "기기에 기록을 보관해 오프라인에서도 꺼내 볼 수 있는 Windows 네이티브 앱이에요. Windows 11 위젯과 Ctrl+Shift+O로 빠르게 기록하고, 기록 연결 코드로 기존 OTT 시청 기록도 이어가요.",
                "Microsoft Store",
                "https://apps.microsoft.com/detail/9NSVNZGDMGF5",
                nil
            ),
            (
                "05", "wallet.pass",
                isEn ? "Toss in-app" : "토스 인앱",
                isEn ? "Open your OTT timeline directly inside Toss without installing another app."
                     : "내 OTT 타임라인을 앱 설치 없이 토스에서 바로 열 수 있어요.",
                isEn ? "Open in Toss" : "토스에서 열기",
                "https://minion.toss.im/XYvjpUB2",
                nil
            ),
            (
                "06", "sparkles",
                isEn ? "ChatGPT connection" : "ChatGPT 연결",
                isEn ? "A read-only ChatGPT connection is still in preparation for bringing recent records into the conversation."
                     : "ChatGPT 대화에 최근 기록을 불러오는 읽기 전용 연결을 준비 중이에요.",
                nil, nil,
                isEn ? "Coming soon" : "준비 중"
            )
        ]

        return VStack(alignment: .leading, spacing: 32) {
            // Intro
            VStack(alignment: .leading, spacing: 10) {
                Text(isEn ? "Movie, series, and book timelines without sign-up" : "가입 없이 남기는 영화·시리즈·책 기록 타임라인")
                    .font(OttlineFont.bold(28))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "ottline helps you keep OTT watch history from services like Netflix, TVING, and Disney+, along with films, series, and books, on your own timeline. Start on the web without signing up, then continue on the installable PWA, Android app, iOS app, Windows app, macOS app, or Toss in-app mini app."
                     : "ottline은 넷플릭스, 티빙, 디즈니+ 같은 OTT의 시청 기록과 영화·시리즈·책 감상 기록을 빠르게 남겨 내 타임라인에 모으는 서비스예요. 번거로운 가입 없이 바로 시작하고, 웹·PWA·Android·iOS·Windows·macOS·토스 인앱에서도 같은 기록을 이어볼 수 있어요.")
                    .font(OttlineFont.regular(15.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(6)
            }

            // Pairing Highlight Callout
            VStack(alignment: .leading, spacing: 8) {
                Text(isEn ? "Once you start recording, your timeline keeps going." : "기록은 한 번 시작하면 계속 이어져요.")
                    .font(OttlineFont.semiBold(18))
                    .foregroundStyle(palette.primaryAccent)
                Text(isEn
                     ? "Use your record connection code on the web, in Toss, or in an installed app to open the same timeline and keep recording."
                     : "웹, 토스, 설치형 앱 어디에서 열어도 기록 연결 코드를 입력하면 같은 타임라인을 이어서 기록하고 살펴볼 수 있어요.")
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(5)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.25), lineWidth: 1))

            // Platforms 2-Column Grid
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(isEn ? "Started on the web, opened in more places" : "웹에서 시작해, 더 다양한 곳으로")
                        .font(OttlineFont.semiBold(21))
                        .foregroundStyle(palette.ink)
                    Text(isEn
                         ? "The web timeline is at the heart of ottline. Open the same records wherever it suits you."
                         : "ottline의 중심은 웹 타임라인이에요. 같은 기록을 상황에 맞는 여러 곳에서 이어갈 수 있어요.")
                        .font(OttlineFont.regular(14.5))
                        .foregroundStyle(palette.mutedInk)
                }
                .padding(.bottom, 8)
                .overlay(alignment: .bottom) { Rectangle().fill(palette.border).frame(height: 1) }

                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 16), GridItem(.flexible(), spacing: 16)],
                    spacing: 16
                ) {
                    ForEach(platforms, id: \.num) { item in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text(item.num)
                                    .font(OttlineFont.semiBold(12))
                                    .kerning(1.8)
                                    .foregroundStyle(palette.subtleInk)
                                Spacer()
                                Image(systemName: item.icon)
                                    .font(.system(size: 14, weight: .medium))
                                    .foregroundStyle(palette.ink)
                                    .frame(width: 34, height: 34)
                                    .background(palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            }

                            Text(item.title)
                                .font(OttlineFont.semiBold(16))
                                .foregroundStyle(palette.ink)

                            Text(item.desc)
                                .font(OttlineFont.regular(14))
                                .foregroundStyle(palette.mutedInk)
                                .lineSpacing(5)

                            Spacer(minLength: 4)

                            if let label = item.linkLabel, let url = item.linkUrl {
                                Button {
                                    macOpenExternalUrl(url)
                                } label: {
                                    HStack(spacing: 6) {
                                        Text(label)
                                            .font(OttlineFont.medium(12.5))
                                            .foregroundStyle(palette.ink)
                                        OttlineLucideIcon(kind: .externalLink, size: 12, color: palette.mutedInk)
                                    }
                                    .padding(.horizontal, 12)
                                    .frame(height: 34)
                                    .background(palette.background)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            } else if let status = item.status {
                                Text(status)
                                    .font(OttlineFont.medium(12))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(palette.paperStrong)
                                    .clipShape(Capsule())
                            }
                        }
                        .padding(20)
                        .frame(maxWidth: .infinity, minHeight: 190, alignment: .topLeading)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                }
            }

            // Companion Tools
            VStack(alignment: .leading, spacing: 12) {
                Text(isEn ? "Companion tools" : "보조 도구")
                    .font(OttlineFont.semiBold(19))
                    .foregroundStyle(palette.ink)
                    .padding(.bottom, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .bottom) { Rectangle().fill(palette.border).frame(height: 1) }

                VStack(alignment: .leading, spacing: 10) {
                    HStack(spacing: 8) {
                        Image(systemName: "puzzlepiece.extension")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(palette.ink)
                        Text(isEn ? "Desktop browser extension" : "데스크톱 브라우저 확장")
                            .font(OttlineFont.semiBold(15.5))
                            .foregroundStyle(palette.ink)
                    }
                    Text(isEn
                         ? "Bring a title from a supported streaming page into the record window. If you have the Windows app, you can send the title straight there to record it. The macOS app connection will be available after its Mac App Store release."
                         : "지원하는 OTT 페이지에서 작품 제목을 가져와 기록 창을 열어요. Windows 앱이 있으면 작품을 앱으로 넘겨 바로 기록할 수 있어요. macOS 앱 연결은 Mac App Store 출시 후 지원해요.")
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(5)

                    HStack(spacing: 18) {
                        externalTextLink("Chrome Web Store", "https://chromewebstore.google.com/detail/ottline-helper/pbbkgfcmkpfmefngkhmlggckjjlljkhf")
                        externalTextLink("Edge Add-ons", "https://microsoftedge.microsoft.com/addons/detail/ottline-helper/eodpkekdfhnmhlnjfjmkpddmlddfnhll")
                        externalTextLink("Whale Store", "https://store.whale.naver.com/detail/cjkdbefdhkcgpmnjhnhghlbgdhfkbgcd")
                    }
                    .padding(.top, 2)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }

            // How It Works + Good to Know (2-column desktop pairing)
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    Text(isEn ? "How it works" : "어떻게 사용하나요?")
                        .font(OttlineFont.semiBold(20))
                        .foregroundStyle(palette.ink)
                        .padding(.bottom, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .bottom) { Rectangle().fill(palette.border).frame(height: 1) }

                    aboutStepRow(
                        badge: "1",
                        title: isEn ? "Find a title" : "작품 검색",
                        desc: isEn ? "Select the record button on Home (or press ⌘N) to search for a film, series, or book."
                                   : "홈에서 기록 버튼을 누르거나 ⌘N을 눌러 검색창을 열고, 영화·시리즈·책 제목을 찾아보세요."
                    )
                    aboutStepRow(
                        badge: "2",
                        title: isEn ? "Choose a status and keep it" : "상태를 골라 기록 남기기",
                        desc: isEn ? "Choose whether you finished, are still watching or reading, or want to watch or read it later. Then tap ‘Keep this record’ below."
                                   : "다 봤는지·읽었는지, 이어가는 중인지, 나중에 보고·읽고 싶은지 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요."
                    )
                    aboutStepRow(
                        badge: "3",
                        title: isEn ? "Add a little more if you like" : "더 기억하고 싶을 때 덧붙이기",
                        desc: isEn ? "Your record is kept on this device first. Add a date, place, platform, or note, choose one of three feelings, or leave it as it is."
                                   : "기록은 먼저 이 기기에 보관돼요. 날짜·장소·플랫폼·메모를 더하거나 세 가지 느낌 중 하나를 골라도, 이대로 두어도 괜찮아요."
                    )
                }
                .padding(22)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                VStack(alignment: .leading, spacing: 16) {
                    Text(isEn ? "Good to know" : "더 편하게 쓰는 방법")
                        .font(OttlineFont.semiBold(20))
                        .foregroundStyle(palette.ink)
                        .padding(.bottom, 6)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .overlay(alignment: .bottom) { Rectangle().fill(palette.border).frame(height: 1) }

                    aboutStepRow(
                        badge: "+",
                        title: isEn ? "Quick menu bar & shortcut" : "메뉴 막대와 단축키로 빠르게 기록",
                        desc: isEn ? "Keep the menu bar icon on in My Space or press ⌘N anytime to capture what you just watched or read."
                                   : "내 공간에서 상단 메뉴 막대 아이콘을 켜 두거나 ⌘N 단축키로 언제든 빠르게 기록을 남길 수 있어요."
                    )
                    aboutStepRow(
                        badge: "+",
                        title: isEn ? "Export to CSV" : "내 기록 CSV로 내보내기",
                        desc: isEn ? "Download a CSV from My space to view your records in Excel, Numbers, or another spreadsheet app."
                                   : "내 공간에서 CSV 파일을 내려받아 엑셀, Numbers 같은 스프레드시트 앱으로 살펴볼 수 있어요."
                    )
                    aboutStepRow(
                        badge: "+",
                        title: isEn ? "Share a record as a card" : "공유 카드로 기록 나누기",
                        desc: isEn ? "After keeping a record, choose “Create a share card” to preview it instantly, save PNG, copy, or share."
                                   : "기록을 남긴 뒤 ‘공유 카드 만들기’를 누르면 미리보기가 바로 열려요. 담고 싶은 내용을 고른 뒤 저장하거나 공유해 보세요."
                    )
                }
                .padding(22)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }

            // Guide Links Card
            VStack(alignment: .leading, spacing: 14) {
                Text(isEn ? "Find a recording rhythm that feels like yours" : "어떤 기록부터 남길지 천천히 살펴보세요")
                    .font(OttlineFont.semiBold(20))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "See how to keep OTT watch history, films, series, and books through real ottline screens."
                     : "OTT 시청 기록과 영화·시리즈, 책 기록을 남기는 흐름을 실제 화면과 함께 살펴봐요.")
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.mutedInk)

                VStack(spacing: 8) {
                    aboutGuideLinkRow(
                        label: isEn ? "Streaming watch history guide" : "OTT 시청 기록 가이드",
                        slug: "ott-watch-log"
                    )
                    aboutGuideLinkRow(
                        label: isEn ? "Film and series record guide" : "영화·시리즈 시청 기록 가이드",
                        slug: "movie-series-log"
                    )
                    aboutGuideLinkRow(
                        label: isEn ? "Book record guide" : "책·독서 기록 가이드",
                        slug: "book-log"
                    )
                }

                Button {
                    onOpenOverlay(.guides(nil))
                } label: {
                    HStack(spacing: 6) {
                        Text(isEn ? "Browse all recording guides" : "모든 기록 가이드 보기")
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.primaryAccent)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .padding(.top, 4)
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // Closing Quote
            Text(isEn ? "\"Memories fade, but records remain on the timeline.\"" : "\"기억은 흐릿해져도, 기록은 타임라인에 남아요.\"")
                .font(OttlineFont.medium(16))
                .italic()
                .foregroundStyle(palette.mutedInk)
                .padding(24)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
    }

    private func externalTextLink(_ label: String, _ url: String) -> some View {
        Button {
            macOpenExternalUrl(url)
        } label: {
            HStack(spacing: 5) {
                Text(label)
                    .font(OttlineFont.medium(13.5))
                    .underline()
                    .foregroundStyle(palette.primaryAccent)
                OttlineLucideIcon(kind: .externalLink, size: 12, color: palette.primaryAccent)
            }
        }
        .buttonStyle(.plain)
    }

    private func aboutStepRow(badge: String, title: String, desc: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Text(badge)
                .font(OttlineFont.bold(13.5))
                .foregroundStyle(palette.card)
                .frame(width: 28, height: 28)
                .background(palette.ink)
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(OttlineFont.semiBold(15))
                    .foregroundStyle(palette.ink)
                Text(desc)
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(5)
            }
        }
    }

    private func aboutGuideLinkRow(label: String, slug: String) -> some View {
        Button {
            onOpenOverlay(.guides(slug))
        } label: {
            HStack {
                Text(label)
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
                Spacer()
                Image(systemName: "arrow.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(palette.primaryAccent)
            }
            .padding(.horizontal, 16)
            .frame(height: 44)
            .background(palette.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: FAQ Page (`faq/page.tsx`)

    private var faqContent: some View {
        let isEn = locale == "en"
        let qaItems: [(q: String, a: String)] = isEn
            ? [
                (
                    "Q. How are records kept without signing up?",
                    "ottline uses **Local-first** storage. Your records are kept in your device’s local storage first, so you can return to them without signing up. To move to another device, let your records sync and keep your **record connection code**."
                ),
                (
                    "Q. Can I see my records on a different device?",
                    "Yes! Find your **record connection code** in My space on a device that has your records, then enter it on the new device. Records from your devices can share the same timeline."
                ),
                (
                    "Q. How are records merged when I connect a device?",
                    "If both devices have a record for the same title, the **most recently edited content** is kept. This may replace the earlier content."
                ),
                (
                    "Q. How do I delete records?",
                    "Individual record deletion is not supported, but you can remove synced account data at once in **My space > Delete all server data**. If you only want to clear the current device, use **My space > Reset local data**."
                ),
                (
                    "Q. Can I download my records?",
                    "Yes. You can download a CSV file in **My space > Export my records** and organize it in Excel, Numbers, or Spreadsheets."
                ),
                (
                    "Q. Is there a usage fee?",
                    "All features are free. Keep your records at your own pace."
                )
            ]
            : [
                (
                    "Q. 가입 없이 기록은 어떻게 보관되나요?",
                    "ottline은 **로컬 퍼스트(Local-first)** 방식으로 기록을 먼저 기기 내부 저장소에 보관해요. 가입하지 않아도 같은 기기에서 기록을 이어볼 수 있어요. 다른 기기로 옮기려면 기록을 동기화한 뒤 **기록 연결 코드**를 보관해 주세요."
                ),
                (
                    "Q. 기기를 변경해도 기록을 볼 수 있나요?",
                    "네. 기록이 남아 있는 기기의 내 공간에서 **기록 연결 코드**를 확인한 뒤, 새 기기에 입력해 주세요. 여러 기기의 기록을 같은 타임라인으로 이어볼 수 있어요."
                ),
                (
                    "Q. 기기를 연결하면 기록은 어떻게 합쳐지나요?",
                    "같은 작품의 기록이 양쪽에 있으면 **더 최근에 수정된 내용**이 남아요. 따라서 이전 내용은 최근 내용으로 바뀔 수 있어요."
                ),
                (
                    "Q. 기록을 삭제하고 싶으면 어떻게 하나요?",
                    "개별 기록 삭제는 제공하지 않지만, **내 공간 > 서버 데이터 전체 삭제**로 계정에 연결된 서버 기록을 한 번에 삭제할 수 있어요. 현재 기기만 비우고 싶다면 **내 공간 > 로컬 데이터 초기화**를 사용해 주세요."
                ),
                (
                    "Q. 내 기록을 파일로 내려받을 수 있나요?",
                    "네. **내 공간 > 내 기록 내보내기**에서 CSV 파일로 내려받아 엑셀이나 Numbers 같은 스프레드시트 앱으로 정리할 수 있어요."
                ),
                (
                    "Q. 서비스 이용료가 있나요?",
                    "모든 기능을 무료로 사용할 수 있어요. 편하게 기록을 남겨보세요."
                )
            ]

        return VStack(alignment: .leading, spacing: 26) {
            VStack(alignment: .leading, spacing: 8) {
                Text(isEn ? "FAQ" : "자주 묻는 질문")
                    .font(OttlineFont.bold(28))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "Find answers about data storage and sign-up free usage of ottline."
                     : "ottline의 기록 보관 방식과 가입 없이 사용하는 방법을 살펴보세요.")
                    .font(OttlineFont.regular(15))
                    .foregroundStyle(palette.mutedInk)
            }

            LazyVGrid(
                columns: [GridItem(.flexible(), spacing: 18), GridItem(.flexible(), spacing: 18)],
                spacing: 18
            ) {
                ForEach(qaItems, id: \.q) { item in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(item.q)
                            .font(OttlineFont.bold(16.5))
                            .foregroundStyle(palette.ink)
                        Text((try? AttributedString(markdown: item.a)) ?? AttributedString(item.a.replacingOccurrences(of: "**", with: "")))
                            .font(OttlineFont.regular(14.5))
                            .foregroundStyle(palette.mutedInk)
                            .lineSpacing(6)
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }
            }

            // Bottom Guide CTA Card
            VStack(alignment: .leading, spacing: 10) {
                Text(isEn ? "Looking for a little more detail?" : "조금 더 자세한 기록 방법이 궁금한가요?")
                    .font(OttlineFont.semiBold(20))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "Explore calm, step-by-step guides for OTT watch logs, movies and series, and books."
                     : "OTT 시청 기록, 영화·시리즈와 독서 기록을 가볍게 시작하는 흐름을 모아두었어요.")
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.mutedInk)
                Button {
                    onOpenOverlay(.guides(nil))
                } label: {
                    HStack(spacing: 6) {
                        Text(isEn ? "Browse the recording guides" : "기록 가이드 둘러보기")
                            .font(OttlineFont.semiBold(14.5))
                            .foregroundStyle(palette.primaryAccent)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .padding(.top, 6)
                }
                .buttonStyle(.plain)
            }
            .padding(24)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
    }

    // MARK: Privacy Policy Page (`privacy/page.tsx`)

    private var privacyContent: some View {
        let isEn = locale == "en"
        let s1 = isEn
            ? [
                "Record data: Title, type, genres, watching or reading status, feeling, note, date, platform, place or occasion, season and episode",
                "Sync data: Internal account and client identifiers used for pairing and synchronization",
                "Recommendation data: Suggested titles and reasons, excluded titles, daily usage counts and request status",
                "Service usage data: Session identifier, feature events, initial landing path, referring origin, and UTM source, medium, campaign, term, and content",
                "Environment data: Device, browser, OS, and PWA or native app installation status"
            ]
            : [
                "기록 데이터: 작품명·종류·장르, 감상·독서 상태, 느낌, 메모, 날짜, 플랫폼, 장소·상황, 시즌·회차",
                "동기화 정보: 기기 연결과 동기화를 위한 계정·클라이언트 내부 식별자",
                "추천 이용 정보: 추천 결과와 이유, 추천에서 제외한 작품, 날짜별 추천 횟수와 요청 처리 상태",
                "서비스 이용 정보: 세션 식별자, 기능 이용 이벤트, 최초 진입 경로, referrer 출처 도메인, UTM source·medium·campaign·term·content",
                "이용 환경 정보: 기기·브라우저·OS 유형과 설치 상태"
            ]
        let s2 = isEn
            ? [
                "Storing and viewing records, building timelines, and providing sync",
                "Providing requested title recommendations, applying exclusions, and managing daily recommendation usage",
                "Analyzing errors and improving service stability",
                "Aggregating acquisition paths and feature usage to improve the experience"
            ]
            : [
                "기록 저장·조회, 타임라인 구성, 기기 간 동기화 제공",
                "이용자가 요청한 작품 추천 제공, 제외한 작품 반영과 날짜별 추천 횟수 관리",
                "오류 분석과 서비스 안정성 개선",
                "유입 경로와 기능 이용 현황을 집계해 이용 경험 개선"
            ]
        let s3 = isEn
            ? [
                "Synced records and account data are kept until you request My space > Delete all server data.",
                "First-party analytics events are automatically deleted 180 days after collection.",
                "Deleting an account also deletes analytics events that store its account identifier. Anonymous events without an account identifier cannot be matched to a specific person for selective deletion and are automatically deleted after 180 days.",
                "Data sent to Google Analytics 4 and Microsoft Clarity (on web) is retained and deleted under each provider's configured settings and policies.",
                "When the law requires retention, information is kept only for the required period."
            ]
            : [
                "동기화된 기록과 계정 정보는 이용자가 서버 데이터 전체 삭제를 요청할 때까지 보관합니다.",
                "서비스가 직접 수집한 분석 이벤트는 수집일로부터 180일 후 자동으로 파기합니다.",
                "계정 삭제 시 계정 식별자가 저장된 분석 이벤트도 함께 삭제합니다. 계정 식별자가 없는 익명 이벤트는 특정 이용자를 확인해 선별 삭제할 수 없으며 180일 후 자동으로 파기합니다.",
                "Google Analytics 4와 Microsoft Clarity(웹)에 전송된 데이터는 각 제공자의 보존 설정과 정책에 따라 보관·파기됩니다.",
                "법령상 보관 의무가 있는 경우 필요한 기간 동안만 보관합니다."
            ]

        return VStack(alignment: .leading, spacing: 24) {
            VStack(alignment: .leading, spacing: 8) {
                Text(isEn ? "Privacy Policy" : "개인정보처리방침")
                    .font(OttlineFont.bold(28))
                    .foregroundStyle(palette.ink)
                Text(isEn ? "Last updated: November 8, 2026" : "최종 업데이트: 2026-11-08")
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.subtleInk)
                Text(isEn
                     ? "ottline (\"the Service\") values your privacy and complies with relevant laws. This policy guides you through the items of information processed, purposes, storage methods, and user rights."
                     : "ottline(이하 \"서비스\")는 이용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. 본 방침은 서비스 이용 중 처리되는 정보의 항목, 목적, 보관 방식, 이용자 권리를 안내합니다.")
                    .font(OttlineFont.regular(15))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(6)
                    .padding(.top, 4)
            }

            privacyBulletSection(title: isEn ? "1. Information Collected" : "1. 수집하는 정보", items: s1)
            privacyBulletSection(title: isEn ? "2. Purpose of Usage" : "2. 정보 이용 목적", items: s2)
            privacyBulletSection(title: isEn ? "3. Retention and Destruction" : "3. 보관 및 파기", items: s3)

            // Section 4 + OpenAI Future Timeline Disclosure
            VStack(alignment: .leading, spacing: 14) {
                Text(isEn ? "4. Third-party Disclosure" : "4. 제3자 제공 및 처리 위탁")
                    .font(OttlineFont.semiBold(18))
                    .foregroundStyle(palette.ink)
                Text(isEn
                     ? "The Service uses Google Analytics 4 from Google and Clarity from Microsoft (on web) to aggregate visits and usage flows. Online identifiers such as cookies and environment information may be processed under each provider’s policy. Title recommendations use OpenAI as described below. The Service does not sell user information."
                     : "서비스는 방문과 이용 흐름을 집계하기 위해 웹에서 Google의 Google Analytics 4와 Microsoft의 Clarity를 사용합니다. 이 과정에서 각 제공자의 정책에 따라 쿠키 등 온라인 식별자와 이용 환경 정보가 처리될 수 있습니다. 작품 추천에는 아래와 같이 OpenAI를 이용합니다. 서비스는 이용자 정보를 판매하지 않습니다.")
                    .font(OttlineFont.regular(14.5))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(6)

                VStack(alignment: .leading, spacing: 8) {
                    Text(isEn ? "Future timeline · OpenAI title recommendations" : "미래의 타임라인 · OpenAI 작품 추천")
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.primaryAccent)
                    Text(isEn
                         ? "When you request new stories in Future timeline, we send OpenAI the titles, types, genres, feelings, and any notes, places or occasions from up to 50 selected records, plus excluded titles. OpenAI returns suggested titles and reasons. Record connection codes and internal account or device identifiers are not included as recommendation input fields."
                         : "미래의 타임라인에서 새 추천을 요청하면, 추천에 사용할 기록 최대 50개의 작품명·종류·장르·느낌과 적어둔 메모·장소·상황, 추천에서 제외한 작품명을 OpenAI에 보내 다음에 만날 작품과 추천 이유를 받습니다. 기록 연결 코드나 계정·기기 내부 식별자를 추천 입력 항목에 포함하지 않습니다.")
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(5)
                    Text(isEn
                         ? "Suggested titles and reasons, excluded titles, daily usage counts and request status are kept with your account for connected devices. They are deleted when you choose My space > Delete all server data. OpenAI processes and retains data under its applicable policies and settings."
                         : "추천 결과·이유, 제외한 작품과 날짜별 이용 횟수·요청 처리 상태는 연결된 기기에서 이어볼 수 있도록 계정에 보관하며, 내 공간의 서버 데이터 전체 삭제 시 함께 삭제합니다. OpenAI에서의 데이터 처리·보관에는 해당 제공자의 정책과 적용 설정이 따릅니다.")
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(5)
                }
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }
            .padding(22)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // Section 5 & 6 Side-by-Side
            HStack(alignment: .top, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(isEn ? "5. User Rights" : "5. 이용자 권리")
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)
                    let s5md = isEn
                        ? "Users may request access, correction, or deletion of their data. This can be done through **My space > Delete all server data** or by contacting the operator."
                        : "이용자는 자신의 기록 데이터에 대해 열람, 정정, 삭제를 요청할 수 있습니다. 서비스 내 **내 공간 > 서버 데이터 전체 삭제** 기능 또는 운영자 문의를 통해 요청할 수 있습니다."
                    Text((try? AttributedString(markdown: s5md)) ?? AttributedString(s5md.replacingOccurrences(of: "**", with: "")))
                        .font(OttlineFont.regular(14.5))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(6)

                    Button(action: onOpenMySpace) {
                        HStack(spacing: 5) {
                            Text(isEn ? "Open My space" : "내 공간 열기")
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .padding(.top, 4)
                    }
                    .buttonStyle(.plain)
                }
                .padding(22)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                VStack(alignment: .leading, spacing: 10) {
                    Text(isEn ? "6. Inquiry" : "6. 문의")
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)
                    Text(isEn
                         ? "Please submit privacy-related inquiries through our service channels. We will process them without delay after verification."
                         : "개인정보 관련 문의는 서비스 운영 채널을 통해 접수해 주세요. 접수된 문의는 확인 후 지체 없이 처리합니다.")
                        .font(OttlineFont.regular(14.5))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(6)

                    Button {
                        onOpenOverlay(.feedback(nil))
                    } label: {
                        HStack(spacing: 5) {
                            Text(isEn ? "Open My inbox" : "내 문의함 열기")
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.primaryAccent)
                            Image(systemName: "arrow.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .padding(.top, 4)
                    }
                    .buttonStyle(.plain)
                }
                .padding(22)
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }
        }
    }

    private func privacyBulletSection(title: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(OttlineFont.semiBold(18))
                .foregroundStyle(palette.ink)
            VStack(alignment: .leading, spacing: 8) {
                ForEach(items, id: \.self) { bullet in
                    HStack(alignment: .top, spacing: 10) {
                        Text("•")
                            .font(OttlineFont.bold(14))
                            .foregroundStyle(palette.primaryAccent)
                        Text(bullet)
                            .font(OttlineFont.regular(14.5))
                            .foregroundStyle(palette.mutedInk)
                            .lineSpacing(5)
                    }
                }
            }
        }
        .padding(22)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }
}

// MARK: - 3. Guide Catalog Data (`apps/web/lib/guides.ts` 1:1 Mirror)

private struct MacGuideSectionItem {
    let title: String
    let description: String
}

private struct MacGuideSection: Identifiable {
    let id = UUID()
    let title: String
    let paragraphs: [String]
    let items: [MacGuideSectionItem]
    let ordered: Bool
}

private struct MacGuideDocument: Identifiable {
    var id: String { slug }
    let slug: String
    let contentType: String
    let symbolName: String
    let eyebrow: String
    let title: String
    let summary: String
    let updatedLabel: String
    let imagePath: String
    let imageCaption: String
    let cardTitle: String
    let cardDescription: String
    let sections: [MacGuideSection]
    let ctaTitle: String
    let ctaDescription: String
    let ctaLabel: String
}

private enum MacGuideCatalog {
    static func allDocuments(locale: String) -> [MacGuideDocument] {
        locale == "en" ? enDocs : koDocs
    }

    static func document(slug: String, locale: String) -> MacGuideDocument? {
        allDocuments(locale: locale).first { $0.slug == slug }
    }

    private static let koDocs: [MacGuideDocument] = [
        MacGuideDocument(
            slug: "ott-watch-log",
            contentType: "video",
            symbolName: "film",
            eyebrow: "OTT 시청 기록",
            title: "보고 난 순간을, 한곳에 가볍게 남겨요",
            summary: "어느 OTT에서 봤는지 흩어져 있어도 괜찮아요. 작품을 찾고 지금의 상태를 고른 뒤, 본 날짜나 플랫폼처럼 기억하고 싶은 것만 더해보세요. 여러 OTT의 기록이 한 타임라인에 모여요.",
            updatedLabel: "2026년 11월 11일 업데이트",
            imagePath: "/guides/v2-brand-ko-home.png",
            imageCaption: "홈에서 기록 버튼을 누르면 작품 검색창이 열려요. 처음에는 인기 작품 포스터에서 바로 골라도 좋아요.",
            cardTitle: "OTT 시청 기록을 시작하는 방법",
            cardDescription: "여러 OTT에서 본 영화와 시리즈를 하나의 타임라인에 모으는 흐름을 살펴봐요.",
            sections: [
                MacGuideSection(
                    title: "어디서 봤든, 작품을 한곳에 모아요",
                    paragraphs: [
                        "OTT마다 시청 이력은 따로 남아요. ottline에서는 여러 서비스에서 본 작품을 모으고, 원하면 어디서 봤는지도 함께 남길 수 있어요.",
                        "플랫폼을 적지 않아도 괜찮아요. 제목과 상태만으로도 같은 타임라인에서 기록을 이어갈 수 있어요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "상태를 고른 뒤 기록을 남겨요",
                    paragraphs: ["홈에서 기록 버튼을 누르면 작품 검색창이 열려요. 긴 감상을 준비하지 않아도 괜찮아요."],
                    items: [
                        MacGuideSectionItem(title: "작품 찾기", description: "검색창에서 ‘영상’을 고르고 영화나 시리즈 제목을 검색해 작품을 선택해요."),
                        MacGuideSectionItem(title: "지금의 상태 남기기", description: "봤어요, 보는 중, 보고 싶어요 가운데 지금과 가까운 상태를 고른 뒤, 아래의 ‘기록 남기기’를 눌러요."),
                        MacGuideSectionItem(title: "원할 때 더 적기", description: "기록한 뒤 ‘그날의 순간’에 날짜·플랫폼·장소·상황을 더하거나, 느낌과 짧은 메모를 남길 수 있어요. 지금 더하지 않아도 기록은 남아 있어요.")
                    ],
                    ordered: true
                ),
                MacGuideSection(
                    title: "개인 기록이 기본이고, 공유는 선택이에요",
                    paragraphs: [
                        "기록은 내 타임라인에 먼저 남아요. 메모를 적는 것만으로 공개되지는 않아요. ‘함께 나누기’를 직접 선택하면 작품과 메모가 ‘함께’ 화면에 공개되고, 날짜·장소·상황은 공개되지 않아요.",
                        "공유 카드도 원할 때 따로 만들 수 있어요. 나만 다시 읽을 기록은 개인 타임라인에 그대로 두어도 괜찮아요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "날짜와 작은 단서가 기억을 불러와요",
                    paragraphs: [
                        "타임라인에는 영화, 시리즈, 책 기록이 날짜순으로 이어져요. 포스터와 제목만으로도 그때의 장면이 떠오르고, 함께 적은 장소나 상황, 메모는 기억을 조금 더 또렷하게 해줘요."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "방금 본 작품부터 남겨볼까요?",
            ctaDescription: "제목을 찾은 뒤, 지금 기억나는 만큼만 적어도 충분해요.",
            ctaLabel: "영상 기록 시작하기"
        ),
        MacGuideDocument(
            slug: "movie-series-log",
            contentType: "video",
            symbolName: "tv",
            eyebrow: "영화·시리즈 기록",
            title: "영화와 시리즈 시청 기록을 한곳에 남겨요",
            summary: "같은 작품을 봐도 남는 기억은 저마다 달라요. 어디까지 봤는지, 누구와 있었는지, 어떤 마음이었는지 기억하고 싶은 만큼 적어두면 다시 만날 때 그 순간이 떠올라요.",
            updatedLabel: "2026년 11월 11일 업데이트",
            imagePath: "/guides/v2-brand-ko-recording.png",
            imageCaption: "상태를 고른 뒤 아래의 ‘기록 남기기’를 눌러요. ‘그날의 순간’은 원할 때 펼쳐 더할 수 있어요.",
            cardTitle: "영화·시리즈를 더 또렷하게 기억하는 방법",
            cardDescription: "상태와 시즌·에피소드부터 그날의 장소와 메모까지, 기억하고 싶은 것만 남겨요.",
            sections: [
                MacGuideSection(
                    title: "영화와 시리즈에 맞는 상태를 골라요",
                    paragraphs: [
                        "홈의 기록 버튼으로 작품을 찾은 뒤, 봤어요·보는 중·보고 싶어요 가운데 지금과 가까운 상태를 골라요. 아래의 ‘기록 남기기’를 누르면 타임라인에 남아요.",
                        "시리즈는 시즌과 에피소드도 함께 남길 수 있어요. 어디까지 봤는지 적어두면 다음에 이어볼 곳을 찾기 쉬워져요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "그날의 순간을 더해도 좋아요",
                    paragraphs: ["집에서 혼자 본 날, 가족과 함께한 주말처럼 장소와 상황을 남겨보세요. ‘그날의 순간’에서 날짜와 플랫폼도 더할 수 있어요. 모두 원할 때 적으면 되고, 느낌이나 메모가 없어도 충분한 기록이에요."],
                    items: [
                        MacGuideSectionItem(title: "날짜와 장소", description: "실제로 본 날짜와 집·극장처럼 기억의 배경이 된 장소를 남길 수 있어요."),
                        MacGuideSectionItem(title: "함께한 상황", description: "혼자, 가족과, 친구와처럼 그날의 분위기를 떠올릴 단서를 더해도 좋아요."),
                        MacGuideSectionItem(title: "느낌과 한 줄 메모", description: "느낌을 남기고 싶다면 최고예요, 볼만해요, 아쉬워요 가운데 하나를 고를 수 있어요. 메모도 선택이에요. 둘 다 나중에 더하거나 비워두어도 괜찮아요.")
                    ],
                    ordered: false
                ),
                MacGuideSection(
                    title: "생각이 달라지면 기록을 이어 고쳐요",
                    paragraphs: [
                        "보는 중이던 시리즈를 다 봤거나, 시간이 지나 느낌과 메모가 달라졌다면 기존 기록을 수정할 수 있어요. 바뀐 내용은 히스토리에 남아, 처음의 인상과 나중의 마음을 함께 돌아볼 수 있어요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "공개 기록은 가까운 흔적처럼 만나요",
                    paragraphs: [
                        "‘함께 나누기’를 선택하면 작품과 메모가 ‘함께’ 화면에 공개돼요. 다른 사람들이 같은 작품에 남긴 짧은 이야기도 이곳에서 둘러볼 수 있어요. 개인 기록에 메모를 쓰는 것만으로 공개되지는 않아요."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "기억에 남은 장면이 있나요?",
            ctaDescription: "작품을 찾고, 그 장면을 떠올릴 작은 단서 하나만 남겨보세요.",
            ctaLabel: "영화·시리즈 기록하기"
        ),
        MacGuideDocument(
            slug: "book-log",
            contentType: "book",
            symbolName: "book.closed",
            eyebrow: "독서 기록",
            title: "책과 함께한 시간을 천천히 이어 적어요",
            summary: "읽기 시작한 날의 기대도, 덮고 난 뒤 남은 한 문장도 좋은 기록이 돼요. 완성된 서평을 쓰지 않아도 책과 함께한 시간이 타임라인에 자연스럽게 이어져요.",
            updatedLabel: "2026년 11월 11일 업데이트",
            imagePath: "/guides/v2-brand-ko-space.png",
            imageCaption: "첫 기록이 서버와 동기화되면 ‘내 공간’에 기록 연결 코드가 생겨요. 다른 기기에서도 같은 기록을 이어볼 수 있어요.",
            cardTitle: "부담 없이 독서 기록을 이어가는 방법",
            cardDescription: "읽는 중의 마음부터 다 읽은 뒤의 메모까지, 책과 함께한 시간을 모아봐요.",
            sections: [
                MacGuideSection(
                    title: "읽는 과정도 한 권의 기록이에요",
                    paragraphs: [
                        "책은 다 읽은 뒤에만 기록할 필요는 없어요. 읽기 시작할 때는 ‘읽는 중’, 나중을 위해 담아둘 때는 ‘읽고 싶어요’, 마지막 장을 덮은 뒤에는 ‘읽었어요’를 고르면 돼요.",
                        "상태가 달라지면 기록을 고쳐 이어갈 수 있어요. 처음의 기대와 읽은 뒤의 마음이 한 권의 시간으로 쌓여요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "책 제목이나 저자부터 찾아요",
                    paragraphs: ["홈에서 기록 버튼을 눌러 검색창을 열고 ‘책’을 골라요. 제목이나 저자로 검색한 뒤 표지와 책 정보를 확인해 기록할 책을 선택해요."],
                    items: [
                        MacGuideSectionItem(title: "읽기 상태 고르기", description: "읽었어요, 읽는 중, 읽고 싶어요 가운데 지금과 가까운 상태를 고른 뒤, 아래의 ‘기록 남기기’를 눌러요."),
                        MacGuideSectionItem(title: "그날의 순간 더하기", description: "원하면 날짜와 집·카페·이동 중처럼 책을 펼친 장소, 함께한 상황을 더할 수 있어요. 나중에 더해도 괜찮아요."),
                        MacGuideSectionItem(title: "느낌이나 한 문장 더하기", description: "인생책, 무난해요, 아쉬워요 가운데 느낌을 고르거나 마음에 남은 생각을 메모할 수 있어요. 느낌과 메모는 모두 선택이에요.")
                    ],
                    ordered: true
                ),
                MacGuideSection(
                    title: "영상과 책을 같은 타임라인에서 돌아봐요",
                    paragraphs: [
                        "영화와 시리즈, 책 기록이 날짜순으로 함께 놓여 그 시기에 무엇을 보고 읽었는지 돌아볼 수 있어요. 종류별로 나누어 보고 싶을 때는 타임라인 필터를 사용할 수 있어요."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "내 기록은 이어보고, 필요할 때 내보내요",
                    paragraphs: [
                        "첫 기록이 서버와 동기화되면 ‘내 공간’에서 기록 연결 코드를 확인할 수 있어요. 다른 기기의 ‘내 공간’에 이 코드를 입력하면 같은 기록을 이어볼 수 있어요. ‘내 기록 내보내기’에서는 기록을 CSV 파일로 보관할 수도 있어요.",
                        "기록을 공개하는 일은 선택이에요. 메모를 적는 것만으로 공개되지는 않으니, 나만 다시 읽을 기록은 개인 타임라인에 그대로 두어도 괜찮아요."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "지금 곁에 있는 책부터 적어볼까요?",
            ctaDescription: "읽는 중이어도 괜찮아요. 제목과 지금의 상태만 먼저 남겨보세요.",
            ctaLabel: "책 기록 시작하기"
        )
    ]

    private static let enDocs: [MacGuideDocument] = [
        MacGuideDocument(
            slug: "ott-watch-log",
            contentType: "video",
            symbolName: "film",
            eyebrow: "OTT watch records",
            title: "Keep the moment, wherever you watched it",
            summary: "Bring titles from different streaming services into one personal timeline. Find a title, choose its current status, and add a date, platform, or any other details you want to remember.",
            updatedLabel: "Updated November 11, 2026",
            imagePath: "/guides/v2-brand-en-home.png",
            imageCaption: "Open title search with the record button on Home, or start with one of the popular titles shown here.",
            cardTitle: "Keep viewing records across streaming services",
            cardDescription: "See how movies and series from different services can meet in one personal timeline.",
            sections: [
                MacGuideSection(
                    title: "Bring titles from different services together",
                    paragraphs: [
                        "Each streaming service keeps its own viewing history. In ottline, you can keep those titles together and add where you watched them if you like.",
                        "The platform is optional. A title and a status are enough to keep your records together on the same timeline."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Choose a status, then keep your record",
                    paragraphs: ["Use the record button on Home to open title search. You can keep a record with just the title and its current status."],
                    items: [
                        MacGuideSectionItem(title: "Find the movie or series", description: "Choose Video in search, find the title, and select the movie or series you want to keep."),
                        MacGuideSectionItem(title: "Choose its current status", description: "Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below to add it to your timeline."),
                        MacGuideSectionItem(title: "Add more whenever you like", description: "After saving, you can add a date, platform, place, or occasion in The moment, or leave a feeling and a short note.")
                    ],
                    ordered: true
                ),
                MacGuideSection(
                    title: "Private first, shared when you choose",
                    paragraphs: [
                        "Records start on your personal timeline. Adding a note does not make it public. If you choose to share in Together, the title and note become public. The date, place, and occasion stay private.",
                        "You can also create a share card whenever you like. Records meant just for you can stay on your personal timeline."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Dates and details help the memory return",
                    paragraphs: [
                        "Movies, series, and books appear together in time order. A poster may bring back the scene on its own; a place, occasion, or one-line note can make the memory clearer years later."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "Have something fresh in mind?",
            ctaDescription: "Find the title and keep only the details you can remember right now.",
            ctaLabel: "Keep a video record"
        ),
        MacGuideDocument(
            slug: "movie-series-log",
            contentType: "video",
            symbolName: "tv",
            eyebrow: "Movie and series records",
            title: "Keep movie and series watch history in one place",
            summary: "The part that stays with you may be an episode, a room, or the person beside you. A few small details make it easier to return to a series and to remember how a film met you at the time.",
            updatedLabel: "Updated November 11, 2026",
            imagePath: "/guides/v2-brand-en-recording.png",
            imageCaption: "Choose a status, then tap ‘Keep this record’ below. Open ‘The moment’ whenever you want to add a date, platform, place, or occasion.",
            cardTitle: "Remember the details of a movie or series",
            cardDescription: "Keep your status, season or episode, and the small details that bring a viewing moment back.",
            sections: [
                MacGuideSection(
                    title: "Use a status that fits the way you watch",
                    paragraphs: [
                        "Use the record button on Home to find a movie or series. Choose Watched, Watching, or Want to watch, then tap ‘Keep this record’ below.",
                        "For a series, you can also keep season and episode details to help you find where to continue."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Add a few details from the day",
                    paragraphs: ["A day at home, a weekend with family, or a cinema trip with a friend can bring the memory back. Your record is complete even without a feeling or a note."],
                    items: [
                        MacGuideSectionItem(title: "Date and place", description: "If you like, keep the day you watched and the place that became part of the memory."),
                        MacGuideSectionItem(title: "Who you were with", description: "You can note whether it was time alone, with family, or with friends."),
                        MacGuideSectionItem(title: "A feeling and a short note", description: "Choose Excellent, Worth watching, or Disappointing, or leave a short note. Both are optional.")
                    ],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Let the record change as your thoughts do",
                    paragraphs: [
                        "When you finish a series or your feelings change over time, you can update the existing record. Its history keeps the changes, so you can look back at your first impression and your later thoughts."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Find other people's stories in Together",
                    paragraphs: [
                        "If you choose to share in Together, your title and note appear beside other people's stories about the same work. Adding a note to a personal record does not share it automatically."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "Is there a scene you still remember?",
            ctaDescription: "Find the title and keep one small detail that can bring the scene back.",
            ctaLabel: "Keep a movie or series record"
        ),
        MacGuideDocument(
            slug: "book-log",
            contentType: "book",
            symbolName: "book.closed",
            eyebrow: "Reading records",
            title: "Keep the time you spent with a book",
            summary: "The anticipation at the first page and the thought that remains after the last are both worth keeping. Your reading records can grow along the way, with as much or as little detail as you like.",
            updatedLabel: "Updated November 11, 2026",
            imagePath: "/guides/v2-brand-en-space.png",
            imageCaption: "Your record connection code appears in My space after your first record syncs. Use it to continue with the same records on another device.",
            cardTitle: "A simple place for your reading records",
            cardDescription: "Save the feeling of starting, the details along the way, and a note after the final page.",
            sections: [
                MacGuideSection(
                    title: "Keep a record while you read",
                    paragraphs: [
                        "A book does not need to be finished before it becomes a record. Choose Reading when you begin, Want to read when you are saving it for later, and Read after the final page.",
                        "Update the status as it changes. The anticipation at the start and your thoughts at the end can stay connected as one stretch of time with the book."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Begin with a title or author",
                    paragraphs: ["Use the record button on Home to open search and choose Book. Search by title or author, then check the cover and book details to select the right edition."],
                    items: [
                        MacGuideSectionItem(title: "Choose your reading status", description: "Choose Read, Reading, or Want to read, then tap ‘Keep this record’ below to add it to your timeline."),
                        MacGuideSectionItem(title: "Add details in The moment", description: "If you like, add the date, where you read, and who you were with. You can come back to these details later."),
                        MacGuideSectionItem(title: "Add a feeling or a thought", description: "You can choose Life-changing, Not bad, or Disappointing, or leave a note. Both are optional.")
                    ],
                    ordered: true
                ),
                MacGuideSection(
                    title: "See books and viewing memories on one timeline",
                    paragraphs: [
                        "Books, films, and series sit together in date order, showing what you were watching and reading during the same season of life. Timeline filters are there when you want to focus on one kind of record."
                    ],
                    items: [],
                    ordered: false
                ),
                MacGuideSection(
                    title: "Continue your records and keep a copy",
                    paragraphs: [
                        "After your first record syncs, you can find your record connection code in My space. Enter it in My space on another device to continue with the same records. Export my records also lets you keep a CSV copy.",
                        "Sharing is optional. Adding a note does not make it public, so records meant just for you can stay on your personal timeline."
                    ],
                    items: [],
                    ordered: false
                )
            ],
            ctaTitle: "What book is beside you now?",
            ctaDescription: "It is fine to be partway through. Start with the title and your current status.",
            ctaLabel: "Keep a reading record"
        )
    ]
}
