import SwiftUI
import UIKit
import OttlineCore

// MARK: - 1. Adaptive Viewport & Metrics (`DESIGN.md` Section 8 + `.omd/preferences.md`)

private struct OttlineViewportWidthKey: EnvironmentKey {
    static let defaultValue: CGFloat = 390
}

public extension EnvironmentValues {
    var ottlineViewportWidth: CGFloat {
        get { self[OttlineViewportWidthKey.self] }
        set { self[OttlineViewportWidthKey.self] = newValue }
    }
}

public enum PadAdaptiveMode: String, Equatable, Sendable {
    case compact
    case tabletPortrait
    case tabletWide
}

public struct PadLayoutMetrics: Equatable, Sendable {
    public let mode: PadAdaptiveMode
    public let viewportWidth: CGFloat

    public init(mode: PadAdaptiveMode, viewportWidth: CGFloat) {
        self.mode = mode
        self.viewportWidth = viewportWidth
    }

    public static func resolve(isRegularHorizontalClass: Bool, viewportWidth: CGFloat) -> PadLayoutMetrics {
        let safeWidth = max(0, viewportWidth)
        let mode: PadAdaptiveMode
        if !isRegularHorizontalClass || safeWidth < 700 {
            mode = .compact
        } else if safeWidth < 1000 {
            mode = .tabletPortrait
        } else {
            mode = .tabletWide
        }
        return PadLayoutMetrics(mode: mode, viewportWidth: safeWidth)
    }

    public static func resolve(horizontalSizeClass: UserInterfaceSizeClass?, viewportWidth: CGFloat) -> PadLayoutMetrics {
        resolve(isRegularHorizontalClass: horizontalSizeClass == .regular, viewportWidth: viewportWidth)
    }

    public var isSpread: Bool { mode != .compact }
    public var isWideThreeColumnHome: Bool { mode == .tabletWide }
    public var maxContentWidth: CGFloat { isSpread ? 1180 : .infinity }
    public var horizontalPadding: CGFloat { isSpread ? 28 : 18 }
    public var togetherColumns: Int { isSpread ? 2 : 1 }
    public var activationPosterColumns: Int {
        switch mode {
        case .tabletWide: return 6
        case .tabletPortrait: return 4
        case .compact: return 0
        }
    }
    public var reportMetricColumns: Int { isSpread ? 3 : 2 }
    public var kdcOverviewColumns: Int {
        switch mode {
        case .tabletWide: return 5
        case .tabletPortrait: return 3
        case .compact: return 2
        }
    }
    public var mySpaceTwoColumns: Bool { isSpread && viewportWidth >= 820 }
    public var detailTwoColumns: Bool { isSpread && viewportWidth >= 900 }

    public static func deviceLabel(
        isPadIdiom: Bool = UIDevice.current.userInterfaceIdiom == .pad,
        locale: String
    ) -> String {
        if locale == "en" {
            return isPadIdiom ? "iPad" : "iPhone"
        }
        return isPadIdiom ? "아이패드" : "아이폰"
    }

    /// Extracts Kakao original high-resolution cover URL (`fname=...`) for books,
    /// or upgrades TMDB poster URL to `w780` for video titles.
    public static func originalBookCoverUrl(_ source: String) -> String? {
        guard let thumbnail = URLComponents(string: source),
              let scheme = thumbnail.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              thumbnail.user == nil,
              thumbnail.password == nil,
              thumbnail.port == nil,
              let host = thumbnail.host?.lowercased(),
              host.range(of: #"^search\d+\.kakaocdn\.net$"#, options: .regularExpression) != nil,
              thumbnail.path.range(of: #"^/thumb/R\d+x\d+(?:\.q\d+)?/?$"#, options: .regularExpression) != nil,
              let filename = thumbnail.queryItems?.first(where: { $0.name == "fname" })?.value,
              !filename.isEmpty,
              var original = URLComponents(string: filename),
              let origScheme = original.scheme?.lowercased(),
              origScheme == "http" || origScheme == "https",
              original.user == nil,
              original.password == nil,
              original.port == nil,
              original.host?.lowercased() == "t1.daumcdn.net",
              original.path.range(of: #"^/lbook/image/\d+$"#, options: .regularExpression) != nil
        else {
            return nil
        }
        original.scheme = "https"
        original.fragment = nil
        return original.url?.absoluteString
    }

    public static func resolveFeaturedPosterUrl(_ rawUrl: String?, isBook: Bool) -> String? {
        guard let raw = rawUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let httpsRaw = raw.hasPrefix("http://")
            ? "https://" + raw.dropFirst("http://".count)
            : raw
        if isBook {
            return originalBookCoverUrl(raw) ?? httpsRaw
        }
        return tmdbResizeUrl(raw, bucket: "w780") ?? httpsRaw
    }

    public static func featuredPosterCandidateUrls(posterUrl: String?, titleType: TitleType) -> [URL] {
        guard let raw = posterUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return []
        }
        let httpsRaw = raw.hasPrefix("http://")
            ? "https://" + raw.dropFirst("http://".count)
            : raw
        let primary = resolveFeaturedPosterUrl(raw, isBook: titleType == .book)
        let secondary: String? = titleType == .book
            ? httpsRaw
            : (tmdbResizeUrl(raw, bucket: "original") ?? httpsRaw)
        var seen = Set<String>()
        return [primary, secondary]
            .compactMap { $0 }
            .compactMap { candidate in
                guard seen.insert(candidate).inserted else { return nil }
                return URL(string: candidate)
            }
    }
}

public extension View {
    func ottlineContentContainer(_ metrics: PadLayoutMetrics) -> some View {
        self
            .frame(maxWidth: metrics.maxContentWidth, alignment: .leading)
            .padding(.horizontal, metrics.horizontalPadding)
            .frame(maxWidth: .infinity)
    }
}

// MARK: - 2. iPad Spread Top Header (`OttlinePadHeader` — Web Desktop / Mac Parity)

public struct OttlinePadHeader: View {
    public let repository: OttlineRepository
    public let activeTab: TopLevelTab
    public let themeMode: ThemeMode
    public let viewportWidth: CGFloat
    public let onSelectTab: (TopLevelTab) -> Void
    public let onQuickRecord: () -> Void
    public let onToggleTheme: () -> Void
    public let onSelectLocale: (String) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(
        repository: OttlineRepository,
        activeTab: TopLevelTab,
        themeMode: ThemeMode,
        viewportWidth: CGFloat,
        onSelectTab: @escaping (TopLevelTab) -> Void,
        onQuickRecord: @escaping () -> Void,
        onToggleTheme: @escaping () -> Void,
        onSelectLocale: @escaping (String) -> Void
    ) {
        self.repository = repository
        self.activeTab = activeTab
        self.themeMode = themeMode
        self.viewportWidth = viewportWidth
        self.onSelectTab = onSelectTab
        self.onQuickRecord = onQuickRecord
        self.onToggleTheme = onToggleTheme
        self.onSelectLocale = onSelectLocale
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let showTabIcons = viewportWidth >= 880
        let compactCta = viewportWidth < 800
        let themeIcon: OttlineLucideIconKind = {
            switch themeMode {
            case .system: return .monitor
            case .light: return .sun
            case .dark: return .moon
            }
        }()
        let themeA11yLabel: String = {
            switch themeMode {
            case .system: return OttlineStrings.tr("테마 변경 (현재: 시스템)", "Change theme (current: System)", locale: locale)
            case .light: return OttlineStrings.tr("테마 변경 (현재: 라이트)", "Change theme (current: Light)", locale: locale)
            case .dark: return OttlineStrings.tr("테마 변경 (현재: 다크)", "Change theme (current: Dark)", locale: locale)
            }
        }()

        VStack(spacing: 0) {
            HStack(spacing: viewportWidth >= 900 ? 18 : 10) {
                Button {
                    onSelectTab(.home)
                } label: {
                    HStack(spacing: 8) {
                        OttlineBrandMark(size: 38)
                            .frame(width: 38, height: 38)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("ottline")
                                .font(OttlineFont.bold(27))
                                .kerning(-0.7)
                                .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                            Text("ON THE TIMELINE")
                                .font(OttlineFont.semiBold(9))
                                .kerning(0.9)
                                .foregroundStyle(palette.brandOrange)
                        }
                    }
                    .fixedSize()
                }
                .buttonStyle(.plain)

                Spacer(minLength: 8)

                HStack(spacing: viewportWidth >= 960 ? 22 : 12) {
                    navLink(.home, icon: .home, label: OttlineStrings.tr("홈", "Home", locale: locale), showIcon: showTabIcons)
                    navLink(.timeline, icon: .clock, label: OttlineStrings.tr("타임라인", "Timeline", locale: locale), showIcon: showTabIcons)
                    navLink(.together, icon: .messageCircle, label: OttlineStrings.tr("함께", "Together", locale: locale), showIcon: showTabIcons)
                    navLink(.mySpace, icon: .userRound, label: OttlineStrings.tr("내 공간", "My space", locale: locale), showIcon: showTabIcons)
                }

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    if repository.outboxCount > 0 || repository.syncState.status == .syncing || repository.syncState.status == .failed {
                        Button {
                            repository.triggerSyncAsync()
                        } label: {
                            HStack(spacing: 4) {
                                OttlineLucideIcon(
                                    kind: .rotateCcw,
                                    size: 13,
                                    color: repository.syncState.status == .failed ? palette.danger : palette.primaryAccent
                                )
                                Text(repository.syncState.status == .syncing
                                    ? OttlineStrings.tr("동기화 중", "Syncing", locale: locale)
                                    : OttlineStrings.tr("대기 \(repository.outboxCount)", "Pending \(repository.outboxCount)", locale: locale)
                                )
                                .font(OttlineFont.medium(11.5))
                                .foregroundStyle(repository.syncState.status == .failed ? palette.danger : palette.mutedInk)
                            }
                            .padding(.horizontal, 10)
                            .frame(height: 36)
                            .background(palette.paperStrong)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                        }
                        .buttonStyle(.plain)
                    }

                    HStack(spacing: 0) {
                        localeButton("KO", value: "ko")
                        localeButton("EN", value: "en")
                    }

                    Button(action: onToggleTheme) {
                        OttlineLucideIcon(kind: themeIcon, size: 18, color: palette.ink, strokeWidth: 1.9)
                            .frame(width: 40, height: 40)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(themeA11yLabel)

                    Button(action: onQuickRecord) {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                            Text(compactCta
                                ? OttlineStrings.tr("기록", "Log", locale: locale)
                                : OttlineStrings.tr("기록 남기기", "Leave a record", locale: locale)
                            )
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.onBrandOrange)
                            .lineLimit(1)
                        }
                        .padding(.horizontal, compactCta ? 12 : 14)
                        .frame(height: 44)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .fixedSize()
                    }
                    .buttonStyle(.plain)

                    Button {
                        onSelectTab(.mySpace)
                    } label: {
                        PersonaAvatar(personaKey: snap.personaKey, size: 38, circular: false)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(OttlineStrings.tr("내 프로필", "My profile", locale: locale))
                }
            }
            .frame(maxWidth: 1180)
            .padding(.horizontal, 28)
            .frame(height: 72)
            .frame(maxWidth: .infinity)
            .background(palette.background.opacity(0.96))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
                .frame(maxWidth: .infinity)
        }
    }

    private func navLink(_ tab: TopLevelTab, icon: OttlineLucideIconKind, label: String, showIcon: Bool) -> some View {
        let active = activeTab == tab
        return Button {
            onSelectTab(tab)
        } label: {
            VStack(spacing: 5) {
                HStack(spacing: 6) {
                    if showIcon {
                        OttlineLucideIcon(
                            kind: icon,
                            size: 16,
                            color: active ? palette.primaryAccent : palette.mutedInk,
                            strokeWidth: active ? 2.2 : 1.8
                        )
                    }
                    Text(label)
                        .font(active ? OttlineFont.bold(14.5) : OttlineFont.medium(14.5))
                        .foregroundStyle(active ? palette.primaryAccent : palette.mutedInk)
                        .lineLimit(1)
                        .fixedSize()
                }

                Rectangle()
                    .fill(active ? palette.brandOrange : Color.clear)
                    .frame(width: 18, height: 2)
            }
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func localeButton(_ label: String, value: String) -> some View {
        let active = locale == value
        return Button {
            if !active {
                onSelectLocale(value)
            }
        } label: {
            VStack(spacing: 3) {
                Text(label)
                    .font(OttlineFont.semiBold(10.5))
                    .foregroundStyle(active ? palette.ink : palette.mutedInk)
                Rectangle()
                    .fill(active ? palette.ink : Color.clear)
                    .frame(width: 14, height: 1)
            }
            .frame(width: 28, height: 36)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 3. High-Resolution Featured Poster View (No Upscaling for Book Covers)

public struct PadFeaturedPosterView: View {
    public let posterUrl: String?
    public let titleName: String
    public let titleType: TitleType

    @Environment(\.ottlinePalette) private var palette
    @State private var loadedImage: UIImage?
    @State private var loadFinished: Bool = false

    public init(posterUrl: String?, titleName: String, titleType: TitleType) {
        self.posterUrl = posterUrl
        self.titleName = titleName
        self.titleType = titleType
    }

    private var hasPosterSource: Bool {
        !(posterUrl?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
    }

    public var body: some View {
        GeometryReader { proxy in
            let boxW = max(1, proxy.size.width)
            let boxH = max(1, proxy.size.height)

            Group {
                if let uiImage = loadedImage {
                    if titleType == .book {
                        let pixelW = CGFloat(uiImage.cgImage?.width ?? Int(round(uiImage.size.width * uiImage.scale)))
                        let pixelH = CGFloat(uiImage.cgImage?.height ?? Int(round(uiImage.size.height * uiImage.scale)))
                        let safeW = max(1, pixelW)
                        let safeH = max(1, pixelH)
                        // Keep small book covers within native pixel dimensions inside a crisp paper frame.
                        let scale = min(1.0, min(boxW / safeW, boxH / safeH))
                        ZStack {
                            palette.paperStrong
                            Image(uiImage: uiImage)
                                .resizable()
                                .interpolation(.high)
                                .frame(width: round(safeW * scale), height: round(safeH * scale))
                        }
                        .frame(width: boxW, height: boxH)
                    } else {
                        Image(uiImage: uiImage)
                            .resizable()
                            .interpolation(.high)
                            .scaledToFill()
                            .frame(width: boxW, height: boxH)
                            .clipped()
                    }
                } else {
                    ZStack {
                        palette.paperStrong
                        if loadFinished || !hasPosterSource {
                            fallbackContent
                        }
                    }
                    .frame(width: boxW, height: boxH)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .aspectRatio(2.0 / 3.0, contentMode: .fit)
        .task(id: "\(titleType.rawValue)|\(posterUrl ?? "")") {
            loadedImage = nil
            loadFinished = false
            let urls = PadLayoutMetrics.featuredPosterCandidateUrls(posterUrl: posterUrl, titleType: titleType)
            for url in urls {
                if Task.isCancelled { return }
                do {
                    let (data, response) = try await URLSession.shared.data(from: url)
                    if Task.isCancelled { return }
                    let ok = (response as? HTTPURLResponse).map { (200..<300).contains($0.statusCode) } ?? true
                    if ok, let image = UIImage(data: data) {
                        loadedImage = image
                        loadFinished = true
                        return
                    }
                } catch {
                    if Task.isCancelled { return }
                }
            }
            if !Task.isCancelled {
                loadFinished = true
            }
        }
    }

    private var fallbackContent: some View {
        VStack(spacing: 10) {
            Image(systemName: titleType == .book ? "book.closed" : (titleType == .series ? "tv" : "film"))
                .font(.system(size: 24))
                .foregroundStyle(palette.subtleInk)
            Text(titleName)
                .font(OttlineFont.regular(12))
                .foregroundStyle(palette.mutedInk)
                .multilineTextAlignment(.center)
                .lineLimit(3)
        }
        .padding(12)
    }
}
