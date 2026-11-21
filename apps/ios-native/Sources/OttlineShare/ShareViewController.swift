import UIKit
import SwiftUI
import UniformTypeIdentifiers
import OttlineCore

@objc(ShareViewController)
public final class ShareViewController: UIViewController {
    private var hostingController: UIHostingController<AnyView>?

    public override func viewDidLoad() {
        super.viewDidLoad()

        let groupDefaults = UserDefaults(suiteName: AppPreferences.appGroupId)
        let prefs = AppPreferences(
            defaults: groupDefaults ?? .standard,
            groupDefaults: groupDefaults
        )
        let api = OttlineApiClient(prefs: prefs)

        let rootView = ShareExtensionRootView(
            extensionContext: extensionContext,
            prefs: prefs,
            api: api,
            onFinish: { [weak self] in
                self?.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
            },
            onCancel: { [weak self] in
                let err = NSError(domain: "app.ottline.ShareExtension", code: 0, userInfo: [NSLocalizedDescriptionKey: "Cancelled"])
                self?.extensionContext?.cancelRequest(withError: err)
            },
            onAttemptOpenUrl: { [weak self] url in
                self?.attemptOpenMainApp(url: url)
            }
        )

        let host = UIHostingController(rootView: AnyView(rootView))
        host.view.backgroundColor = UIColor(red: 0.973, green: 0.965, blue: 0.949, alpha: 1.0)
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
        host.didMove(toParent: self)
        self.hostingController = host
    }

    private func attemptOpenMainApp(url: URL) {
        let selector = sel_registerName("openURL:")
        var responder: UIResponder? = self
        while let current = responder {
            if current.responds(to: selector) {
                current.perform(selector, with: url)
                break
            }
            responder = current.next
        }
    }
}

private struct ShareExtensionRootView: View {
    let extensionContext: NSExtensionContext?
    let prefs: AppPreferences
    let api: OttlineApiClient
    let onFinish: () -> Void
    let onCancel: () -> Void
    let onAttemptOpenUrl: (URL) -> Void

    @Environment(\.colorScheme) private var colorScheme

    @State private var query: String = ""
    @State private var typeTab: String = "all"
    @State private var suggestedPlatform: String = ""
    @State private var extracting: Bool = true

    @State private var searching: Bool = false
    @State private var results: [TitleSearchItem] = []
    @State private var selectedItem: TitleSearchItem?

    @State private var chosenStatus: LogStatus = .done
    @State private var feelingRating: Double?
    @State private var noteText: String = ""
    @State private var saving: Bool = false
    @State private var statusBanner: String?

    var body: some View {
        let locale = prefs.snapshot.locale
        let isDark: Bool = {
            switch prefs.snapshot.themeMode {
            case .system: return colorScheme == .dark
            case .dark: return true
            case .light: return false
            }
        }()
        let palette = isDark ? OttlinePalette.dark : OttlinePalette.light

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let statusBanner {
                        Text(statusBanner)
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(10)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }

                    if let item = selectedItem {
                        selectedTitleRecordCard(item: item, palette: palette, locale: locale)
                    } else {
                        searchSection(palette: palette, locale: locale)
                    }
                }
                .padding(16)
            }
            .background(palette.background.ignoresSafeArea())
            .navigationTitle(OttlineStrings.tr("ottline에 기록 남기기", "Save to ottline", locale: locale))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) {
                        onCancel()
                    }
                }
            }
        }
        .environment(\.ottlinePalette, palette)
        .environment(\.appLocale, locale)
        .task {
            await extractSharedPayload()
        }
        .task(id: "\(query)|\(typeTab)") {
            await performSearch()
        }
    }

    @ViewBuilder
    private func searchSection(palette: OttlinePalette, locale: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                TextField(
                    OttlineStrings.tr("제목, 저자, ISBN으로 찾기", "Search title, author, or ISBN", locale: locale),
                    text: $query
                )
                .font(.system(size: 15))
                .textFieldStyle(.plain)
                .padding(.horizontal, 12)
                .frame(minHeight: 44)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        OttlineLucideIcon(kind: .x, size: 15, color: palette.mutedInk)
                            .frame(width: 40, height: 44)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 6) {
                ForEach([
                    ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                    ("movie", OttlineStrings.tr("영화", "Movie", locale: locale)),
                    ("series", OttlineStrings.tr("시리즈", "Series", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { key, label in
                    let active = typeTab == key
                    Button {
                        typeTab = key
                    } label: {
                        Text(label)
                            .font(.system(size: 13, weight: active ? .semibold : .medium))
                            .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                            .padding(.horizontal, 10)
                            .frame(minHeight: 34)
                            .background(active ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.4 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            if !suggestedPlatform.isEmpty {
                HStack(spacing: 6) {
                    Text(OttlineStrings.tr("감지된 서비스", "Detected service", locale: locale))
                        .font(.system(size: 12))
                        .foregroundStyle(palette.mutedInk)
                    Text(suggestedPlatform)
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(palette.paperStrong)
                        .clipShape(Capsule())
                }
            }

            if extracting || searching {
                HStack(spacing: 8) {
                    ProgressView()
                    Text(OttlineStrings.tr("작품을 찾고 있어요...", "Searching titles...", locale: locale))
                        .font(.system(size: 13.5))
                        .foregroundStyle(palette.mutedInk)
                }
                .padding(.vertical, 16)
            } else if results.isEmpty && !query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text(OttlineStrings.tr("일치하는 작품을 찾지 못했어요. 검색어를 살짝 다듬거나 앱에서 직접 이어서 찾아보세요.", "No exact matches. Refine the query or search directly in ottline.", locale: locale))
                        .font(.system(size: 13.5))
                        .foregroundStyle(palette.mutedInk)

                    openInMainAppButton(palette: palette, locale: locale)
                }
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            } else {
                VStack(spacing: 8) {
                    ForEach(results.prefix(12)) { item in
                        Button {
                            selectedItem = item
                        } label: {
                            HStack(spacing: 12) {
                                PosterImage(
                                    posterUrl: item.posterUrl,
                                    titleName: item.name,
                                    titleType: item.type,
                                    width: 44,
                                    height: 66,
                                    cornerRadius: 4
                                )
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.name)
                                        .font(.system(size: 15, weight: .semibold))
                                        .foregroundStyle(palette.ink)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.leading)

                                    Text([
                                        OttlineStrings.titleTypeLabel(item.type, locale: locale),
                                        item.year.map(String.init),
                                        item.author
                                    ].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.system(size: 12))
                                    .foregroundStyle(palette.mutedInk)
                                    .lineLimit(1)
                                }
                                Spacer()
                                OttlineLucideIcon(kind: .chevronRight, size: 15, color: palette.subtleInk)
                            }
                            .padding(10)
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

    @ViewBuilder
    private func selectedTitleRecordCard(item: TitleSearchItem, palette: OttlinePalette, locale: String) -> some View {
        let isBook = item.type == .book

        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 12) {
                PosterImage(
                    posterUrl: item.posterUrl,
                    titleName: item.name,
                    titleType: item.type,
                    width: 56,
                    height: 84,
                    cornerRadius: 4
                )
                VStack(alignment: .leading, spacing: 3) {
                    Text(OttlineStrings.titleTypeLabel(item.type, locale: locale))
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(palette.mutedInk)
                    Text(item.name)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundStyle(palette.ink)
                        .lineLimit(2)
                    if let y = item.year {
                        Text(String(y))
                            .font(.system(size: 12.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                }
                Spacer()
                Button {
                    selectedItem = nil
                } label: {
                    Text(OttlineStrings.tr("다시 검색", "Change", locale: locale))
                        .font(.system(size: 12.5, weight: .semibold))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }
            .padding(12)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // Status picker
            HStack(spacing: 8) {
                ForEach([LogStatus.done, LogStatus.inProgress, LogStatus.wishlist], id: \.self) { st in
                    let active = chosenStatus == st
                    Button {
                        chosenStatus = st
                    } label: {
                        Text(OttlineStrings.statusLabel(st, type: item.type, locale: locale))
                            .font(.system(size: 13.5, weight: active ? .semibold : .medium))
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(active ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.ink : palette.border, lineWidth: active ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            // Optional 3-level feeling pills
            HStack(spacing: 6) {
                ForEach(RecordFeelings.options(isBook: isBook, locale: locale), id: \.value) { opt in
                    let selected = RecordFeelings.ratingToFeelingValue(feelingRating) == opt.value
                    Button {
                        feelingRating = selected ? nil : RecordFeelings.feelingValueToRating(opt.value)
                    } label: {
                        Text(opt.label)
                            .font(.system(size: 12.5, weight: selected ? .semibold : .medium))
                            .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 38)
                            .background(selected ? palette.paperStrong : palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            // Platform field
            TextField(
                OttlineStrings.tr("플랫폼 / 읽은 곳 (예: 넷플릭스, 교보문고)", "Platform / where you read (optional)", locale: locale),
                text: $suggestedPlatform
            )
            .font(.system(size: 14))
            .padding(.horizontal, 12)
            .frame(minHeight: 42)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            // 1-line note
            TextField(
                OttlineStrings.tr("짧은 한 줄 메모 (선택)", "Quick one-line note (optional)", locale: locale),
                text: $noteText,
                axis: .vertical
            )
            .font(.system(size: 14.5))
            .lineLimit(2...4)
            .padding(12)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            Button {
                Task { await saveEntry(item: item, locale: locale) }
            } label: {
                HStack(spacing: 8) {
                    if saving {
                        ProgressView().tint(palette.onBrandOrange)
                    }
                    Text(saving
                        ? OttlineStrings.tr("저장 중...", "Saving...", locale: locale)
                        : OttlineStrings.tr("타임라인에 바로 남기기", "Keep on timeline", locale: locale)
                    )
                    .font(.system(size: 15.5, weight: .semibold))
                }
                .foregroundStyle(palette.onBrandOrange)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(palette.brandOrange)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(saving)

            openInMainAppButton(palette: palette, locale: locale)
        }
    }

    private func openInMainAppButton(palette: OttlinePalette, locale: String) -> some View {
        Button {
            var urlStr = "ottline://quick-record?quick=1&type=\(typeTab)"
            let trimmedPlat = suggestedPlatform.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedPlat.isEmpty,
               let encP = trimmedPlat.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                urlStr += "&platform=\(encP)"
            }
            let trimmedQ = (selectedItem?.name ?? query).trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedQ.isEmpty,
               let encQ = trimmedQ.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
                urlStr += "&q=\(encQ)"
            }
            prefs.setSharedExtensionPendingUrl(urlStr)
            if let url = URL(string: urlStr) {
                onAttemptOpenUrl(url)
            }
            onFinish()
        } label: {
            Text(OttlineStrings.tr("ottline 앱에서 자세히 열기", "Open in ottline app", locale: locale))
                .font(.system(size: 13.5, weight: .semibold))
                .foregroundStyle(palette.primaryAccent)
                .frame(maxWidth: .infinity, minHeight: 42)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.45), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func extractSharedPayload() async {
        defer { extracting = false }
        guard let items = extensionContext?.inputItems as? [NSExtensionItem] else { return }
        var collectedTexts: [String] = []
        var collectedSubject: String = ""

        for item in items {
            if let subject = item.attributedTitle?.string, !subject.isEmpty {
                collectedSubject = subject
            }
            if let body = item.attributedContentText?.string, !body.isEmpty {
                collectedTexts.append(body)
            }
            for provider in item.attachments ?? [] {
                if provider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier),
                   let dict = await loadItemAsync(provider: provider, typeId: UTType.propertyList.identifier) as? NSDictionary,
                   let results = dict[NSExtensionJavaScriptPreprocessingResultsKey] as? NSDictionary {
                    if let title = results["title"] as? String, !title.isEmpty {
                        collectedSubject = title
                    }
                    if let url = results["URL"] as? String, !url.isEmpty {
                        collectedTexts.append(url)
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier),
                          let loaded = await loadItemAsync(provider: provider, typeId: UTType.url.identifier) {
                    if let url = loaded as? URL {
                        collectedTexts.append(url.absoluteString)
                    } else if let str = loaded as? String {
                        collectedTexts.append(str)
                    }
                } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
                          let txt = await loadItemAsync(provider: provider, typeId: UTType.plainText.identifier) as? String {
                    collectedTexts.append(txt)
                }
            }
        }

        let parsed = ShareIntentParser.parse(
            sharedText: collectedTexts.joined(separator: "\n"),
            subject: collectedSubject
        )
        if !parsed.query.isEmpty {
            query = parsed.query
        }
        if !parsed.suggestedTypeTab.isEmpty {
            typeTab = parsed.suggestedTypeTab
        }
        if let plat = parsed.suggestedPlatform {
            suggestedPlatform = localizedPlatformLabel(plat, locale: prefs.snapshot.locale)
        }
    }

    private func localizedPlatformLabel(_ raw: String, locale: String) -> String {
        guard locale == "ko" else { return raw }
        switch raw {
        case "Netflix": return "넷플릭스"
        case "TVING": return "티빙"
        case "Wavve": return "웨이브"
        case "Coupang Play": return "쿠팡플레이"
        case "Disney+": return "디즈니플러스"
        case "Watcha": return "왓챠"
        case "Prime Video": return "프라임비디오"
        case "Apple TV+": return "애플티비"
        default: return raw
        }
    }

    private func loadItemAsync(provider: NSItemProvider, typeId: String) async -> NSSecureCoding? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: typeId, options: nil) { item, _ in
                continuation.resume(returning: item)
            }
        }
    }

    private func performSearch() async {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            results = []
            searching = false
            return
        }
        searching = true
        try? await Task.sleep(nanoseconds: 250_000_000)
        if Task.isCancelled { return }

        if typeTab == "all" {
            async let vTask = try? api.searchTitles(query: trimmed, typeFilter: nil)
            async let bTask = try? api.searchTitles(query: trimmed, typeFilter: "book")
            let (v, b) = await (vTask, bTask)
            if Task.isCancelled { return }
            results = (v ?? []) + (b ?? [])
        } else {
            let items = (try? await api.searchTitles(query: trimmed, typeFilter: typeTab)) ?? []
            if Task.isCancelled { return }
            results = items
        }
        searching = false
    }

    private func saveEntry(item: TitleSearchItem, locale: String) async {
        guard !saving else { return }
        saving = true
        let now = RecordDate.nowIso()
        let title = item.toNewTitle()
        let trimmedNote = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        let trimmedPlat = suggestedPlatform.trimmingCharacters(in: .whitespacesAndNewlines)

        let entry = SharedExtensionLogEntry(
            id: UUID().uuidString.lowercased(),
            title: title,
            status: chosenStatus,
            rating: feelingRating,
            note: trimmedNote.isEmpty ? nil : trimmedNote,
            ott: trimmedPlat.isEmpty ? nil : trimmedPlat,
            watchedAt: now,
            createdAt: now
        )
        prefs.enqueueSharedExtensionLog(entry)

        // Best-effort immediate push when the user already has a synced session in App Group
        if let userId = prefs.snapshot.userId, !userId.isEmpty,
           let deviceId = prefs.snapshot.deviceId, !deviceId.isEmpty {
            let titleChange = SyncTitleChange(
                id: title.id,
                op: "UPSERT",
                updatedAt: now,
                payload: SyncTitlePayload(
                    provider: title.provider.rawValue,
                    providerId: title.providerId ?? title.id,
                    type: title.type.rawValue,
                    name: title.name,
                    year: title.year,
                    posterUrl: title.posterUrl,
                    overview: title.overview,
                    author: title.author,
                    publisher: title.publisher,
                    isbn10: title.isbn10,
                    isbn13: title.isbn13,
                    pubdate: title.pubdate
                )
            )
            let logChange = SyncLogChange(
                id: entry.id,
                op: "UPSERT",
                updatedAt: now,
                payload: SyncLogPayload(
                    titleId: title.id,
                    status: entry.status.rawValue,
                    rating: entry.rating,
                    note: entry.note,
                    spoiler: false,
                    ott: entry.ott,
                    origin: LogOrigin.log.rawValue,
                    watchedAt: entry.watchedAt
                )
            )
            let pushReq = SyncPushRequest(
                userId: userId,
                deviceId: deviceId,
                changes: SyncPushRequest.SyncChanges(titles: [titleChange], logs: [logChange]),
                clientTime: now
            )
            let apiClient = api
            await withTaskGroup(of: Void.self) { group in
                group.addTask {
                    _ = try? await apiClient.syncPush(pushReq)
                }
                group.addTask {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                }
                _ = await group.next()
                group.cancelAll()
            }
        }

        statusBanner = OttlineStrings.tr("타임라인에 남겨두었어요.", "Kept on your timeline.", locale: locale)
        try? await Task.sleep(nanoseconds: 450_000_000)
        saving = false
        onFinish()
    }
}
