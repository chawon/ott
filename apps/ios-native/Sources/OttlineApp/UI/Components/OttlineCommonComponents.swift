import SwiftUI

public enum TopLevelTab: String, CaseIterable, Sendable {
    case home
    case timeline
    case together
    case mySpace
}

// MARK: - 1. Brand Mark (Open-Book + Play Triangle)

public struct OttlineBrandMark: View {
    public var size: CGFloat = 28
    public var strokeColor: Color? = nil
    public var progress: CGFloat = 1.0
    @Environment(\.ottlinePalette) private var palette

    public init(size: CGFloat = 28, strokeColor: Color? = nil, progress: CGFloat = 1.0) {
        self.size = size
        self.strokeColor = strokeColor
        self.progress = progress
    }

    public var body: some View {
        let resolvedColor = strokeColor ?? (palette.isDark ? palette.ink : palette.brandNavy)
        let accentOrange = palette.brandOrange
        Canvas { context, canvasSize in
            let sx = canvasSize.width / 96.0
            let sy = canvasSize.height / 96.0
            let strokeWidth = max(2.2, 8.0 * sx)

            var bookPath = Path()
            bookPath.move(to: CGPoint(x: 14 * sx, y: 34 * sy))
            bookPath.addLine(to: CGPoint(x: 14 * sx, y: 28 * sy))
            bookPath.addCurve(
                to: CGPoint(x: 24 * sx, y: 18 * sy),
                control1: CGPoint(x: 14 * sx, y: 22.477 * sy),
                control2: CGPoint(x: 18.477 * sx, y: 18 * sy)
            )
            bookPath.addCurve(
                to: CGPoint(x: 48 * sx, y: 27 * sy),
                control1: CGPoint(x: 34 * sx, y: 18 * sy),
                control2: CGPoint(x: 41.5 * sx, y: 21.8 * sy)
            )
            bookPath.addCurve(
                to: CGPoint(x: 77 * sx, y: 18 * sy),
                control1: CGPoint(x: 55.8 * sx, y: 21.8 * sy),
                control2: CGPoint(x: 65.5 * sx, y: 18 * sy)
            )
            bookPath.addCurve(
                to: CGPoint(x: 87 * sx, y: 28 * sy),
                control1: CGPoint(x: 82.523 * sx, y: 18 * sy),
                control2: CGPoint(x: 87 * sx, y: 22.477 * sy)
            )
            bookPath.addLine(to: CGPoint(x: 87 * sx, y: 64 * sy))
            bookPath.addCurve(
                to: CGPoint(x: 77 * sx, y: 74 * sy),
                control1: CGPoint(x: 87 * sx, y: 69.523 * sy),
                control2: CGPoint(x: 82.523 * sx, y: 74 * sy)
            )
            bookPath.addCurve(
                to: CGPoint(x: 51.5 * sx, y: 81 * sy),
                control1: CGPoint(x: 66.5 * sx, y: 74 * sy),
                control2: CGPoint(x: 57.2 * sx, y: 76.9 * sy)
            )

            var playPath = Path()
            playPath.move(to: CGPoint(x: 15 * sx, y: 49 * sy))
            playPath.addLine(to: CGPoint(x: 36.5 * sx, y: 62.75 * sy))
            playPath.addLine(to: CGPoint(x: 15 * sx, y: 76.5 * sy))
            playPath.closeSubpath()

            let style = StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round)
            let clampedBook = min(1.0, max(0.0, progress))
            let trimmedBook = bookPath.trimmedPath(from: 0, to: clampedBook)
            context.stroke(trimmedBook, with: .color(resolvedColor), style: style)

            let playProgress = min(1.0, max(0.0, (progress - 0.25) / 0.75))
            if playProgress > 0 {
                if playProgress >= 0.85 {
                    let fillAlpha = min(1.0, max(0.0, (playProgress - 0.85) / 0.15)) * 0.18
                    context.fill(playPath, with: .color(accentOrange.opacity(fillAlpha)))
                }
                let trimmedPlay = playPath.trimmedPath(from: 0, to: playProgress)
                context.stroke(trimmedPlay, with: .color(resolvedColor), style: style)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - 2. Animated Intro Splash Overlay (1:1 Android `OttlineIntroSplashOverlay` Parity)

public struct OttlineIntroSplashOverlay: View {
    public var nickname: String?
    public var onFinished: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var strokeProgress: CGFloat = 0.0
    @State private var copyProgress: CGFloat = 0.0
    @State private var timelineProgress: CGFloat = 0.0
    @State private var exitOpacity: Double = 1.0
    @State private var exitScale: CGFloat = 1.0
    @State private var isDismissing: Bool = false

    private let messageIndex: Int = {
        let dayOfYear = Calendar.current.ordinality(of: .day, in: .year, for: Date()) ?? 1
        return dayOfYear % 3
    }()

    public init(nickname: String? = nil, onFinished: @escaping () -> Void) {
        self.nickname = nickname
        self.onFinished = onFinished
    }

    public var body: some View {
        let trimmedNickname = (nickname ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let eyebrowText: String = {
            if !trimmedNickname.isEmpty {
                return locale == "en"
                    ? "\(trimmedNickname)'s timeline notebook"
                    : "\(trimmedNickname)님의 기록 수첩"
            } else {
                return locale == "en"
                    ? "Your personal timeline notebook"
                    : "나만의 감상 기록 수첩"
            }
        }()

        let splashMessage: String = {
            switch messageIndex {
            case 0:
                return OttlineStrings.tr(
                    "지나간 장면과 문장,\n그날의 온기를 다시 꺼내봅니다.",
                    "Revisiting the warmth of the scenes\nand lines you loved.",
                    locale: locale
                )
            case 1:
                return OttlineStrings.tr(
                    "보고 읽은 순간이 사라지지 않도록,\n나만의 타임라인에 남겨요.",
                    "Keep the moments you watch and read\non your own timeline.",
                    locale: locale
                )
            default:
                return OttlineStrings.tr(
                    "기억하고 싶은 이야기들이\n차곡차곡 쌓이는 공간",
                    "A quiet notebook where the stories\nyou love gather over time.",
                    locale: locale
                )
            }
        }()

        let markScale: CGFloat = 0.86 + 0.14 * strokeProgress
        let markAlpha: Double = min(1.0, max(0.0, Double(strokeProgress) * 1.4))

        ZStack {
            palette.background.ignoresSafeArea()

            // Subtle warm radial glow behind the brand symbol
            GeometryReader { geo in
                let radius = min(geo.size.width, geo.size.height) * 0.55
                let center = CGPoint(x: geo.size.width * 0.5, y: geo.size.height * 0.44)
                RadialGradient(
                    gradient: Gradient(colors: [
                        palette.brandOrange.opacity(0.10 * Double(strokeProgress)),
                        palette.brandNavy.opacity(0.05 * Double(strokeProgress)),
                        Color.clear
                    ]),
                    center: .center,
                    startRadius: 0,
                    endRadius: radius
                )
                .frame(width: radius * 2, height: radius * 2)
                .position(center)
            }
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 0) {
                // Animated Stroke-Drawing Brand Symbol
                ZStack {
                    OttlineBrandMark(size: 76, progress: strokeProgress)
                }
                .frame(width: 84, height: 84)
                .scaleEffect(markScale)
                .opacity(markAlpha)

                Spacer().frame(height: 14)

                // Wordmark & Tagline + Editorial Copy
                VStack(spacing: 0) {
                    Text("ottline")
                        .font(OttlineFont.bold(34))
                        .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                        .kerning(-0.8)

                    Spacer().frame(height: 4)

                    Text("ON THE TIMELINE")
                        .font(OttlineFont.semiBold(9.5))
                        .foregroundStyle(palette.brandOrange)
                        .kerning(1.8)

                    Spacer().frame(height: 26)

                    // Personalized eyebrow pill
                    HStack(spacing: 6) {
                        Circle()
                            .fill(palette.brandOrange)
                            .frame(width: 6, height: 6)
                        Text(eyebrowText)
                            .font(OttlineFont.medium(11.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 5)
                    .background(palette.paperStrong)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(palette.border, lineWidth: 1)
                    )

                    Spacer().frame(height: 14)

                    Text(splashMessage)
                        .font(OttlineFont.medium(15))
                        .foregroundStyle(palette.ink)
                        .lineSpacing(6)
                        .multilineTextAlignment(.center)

                    Spacer().frame(height: 32)

                    // Animated 3-dot timeline line (`● ─── ● ─── ●`)
                    TimelineSplashProgressLine(progress: timelineProgress)
                        .frame(width: 112, height: 10)
                }
                .opacity(Double(copyProgress))
                .offset(y: (1.0 - copyProgress) * 14)
            }
            .padding(.horizontal, 32)
            .frame(maxWidth: .infinity)
        }
        .opacity(exitOpacity)
        .scaleEffect(exitScale)
        .contentShape(Rectangle())
        .onTapGesture {
            triggerDismiss()
        }
        .task {
            try? await Task.sleep(nanoseconds: 150_000_000)
            if Task.isCancelled || isDismissing { return }

            withAnimation(.easeInOut(duration: 0.78)) {
                strokeProgress = 1.0
            }

            Task {
                try? await Task.sleep(nanoseconds: 220_000_000)
                if Task.isCancelled || isDismissing { return }
                withAnimation(.easeOut(duration: 0.62)) {
                    copyProgress = 1.0
                }
            }

            Task {
                try? await Task.sleep(nanoseconds: 300_000_000)
                if Task.isCancelled || isDismissing { return }
                withAnimation(.easeInOut(duration: 1.35)) {
                    timelineProgress = 1.0
                }
            }

            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if Task.isCancelled || isDismissing { return }
            triggerDismiss()
        }
    }

    private func triggerDismiss() {
        guard !isDismissing else { return }
        isDismissing = true
        withAnimation(.easeInOut(duration: 0.36)) {
            exitOpacity = 0.0
            exitScale = 1.03
        }
        Task {
            try? await Task.sleep(nanoseconds: 360_000_000)
            onFinished()
        }
    }
}

private struct TimelineSplashProgressLine: View {
    var progress: CGFloat
    @Environment(\.ottlinePalette) private var palette

    var body: some View {
        Canvas { context, size in
            let cy = size.height / 2.0
            let startX: CGFloat = 6.0
            let endX: CGFloat = size.width - 6.0
            let midX: CGFloat = size.width / 2.0
            let totalLen = endX - startX
            let lineProg = min(1.0, max(0.0, progress))

            // Base track
            var baseTrack = Path()
            baseTrack.move(to: CGPoint(x: startX, y: cy))
            baseTrack.addLine(to: CGPoint(x: endX, y: cy))
            context.stroke(
                baseTrack,
                with: .color(palette.border),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )

            // Active progress track
            var activeTrack = Path()
            activeTrack.move(to: CGPoint(x: startX, y: cy))
            activeTrack.addLine(to: CGPoint(x: startX + totalLen * lineProg, y: cy))
            context.stroke(
                activeTrack,
                with: .color(palette.brandOrange),
                style: StrokeStyle(lineWidth: 2, lineCap: .round)
            )

            let nodes: [(CGFloat, CGFloat)] = [
                (startX, 0.0),
                (midX, 0.5),
                (endX, 0.95)
            ]
            for (nx, threshold) in nodes {
                let active = lineProg >= threshold
                let radius: CGFloat = active ? 3.5 : 2.5
                let rect = CGRect(x: nx - radius, y: cy - radius, width: radius * 2, height: radius * 2)
                context.fill(
                    Path(ellipseIn: rect),
                    with: .color(active ? palette.brandOrange : palette.border)
                )
            }
        }
    }
}

// MARK: - 3. Top Header Bar (`AppHeader.tsx` + `AppShell.module.css` Mobile Parity)

public struct OttlineTopBar: View {
    public var nickname: String?
    public var personaKey: PersonaKey?
    public var onLogoTap: () -> Void
    public var onSelectLocale: (String) -> Void
    public var onToggleTheme: () -> Void
    public var onProfileTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(
        nickname: String?,
        personaKey: PersonaKey?,
        onLogoTap: @escaping () -> Void,
        onSelectLocale: @escaping (String) -> Void,
        onToggleTheme: @escaping () -> Void,
        onProfileTap: @escaping () -> Void
    ) {
        self.nickname = nickname
        self.personaKey = personaKey
        self.onLogoTap = onLogoTap
        self.onSelectLocale = onSelectLocale
        self.onToggleTheme = onToggleTheme
        self.onProfileTap = onProfileTap
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: onLogoTap) {
                    HStack(spacing: 10) {
                        OttlineBrandMark(size: 30)
                            .frame(width: 36, height: 36)
                        VStack(alignment: .leading, spacing: 1) {
                            Text("ottline")
                                .font(OttlineFont.extraBold(20))
                                .kerning(-0.6)
                                .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                            Text("ON THE TIMELINE")
                                .font(OttlineFont.bold(9))
                                .kerning(0.72)
                                .foregroundStyle(palette.brandOrange)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                // Language Switcher (`KO` / `EN`) matching `AppHeader.tsx`
                HStack(spacing: 2) {
                    ForEach([("ko", "KO"), ("en", "EN")], id: \.0) { code, label in
                        let active = locale == code
                        Button {
                            if !active {
                                onSelectLocale(code)
                            }
                        } label: {
                            VStack(spacing: 2) {
                                Text(label)
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(active ? palette.ink : palette.mutedInk)
                                Rectangle()
                                    .fill(active ? palette.ink : Color.clear)
                                    .frame(width: 18, height: 1.5)
                            }
                            .frame(minWidth: 28, minHeight: 34)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Theme Toggle (`Sun` / `Moon`) matching `AppHeader.tsx`
                Button(action: onToggleTheme) {
                    Image(systemName: palette.isDark ? "moon" : "sun.max")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(palette.mutedInk)
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("테마 변경", "Toggle theme", locale: locale))

                // Profile Link (`40x40` circle on mobile web)
                Button(action: onProfileTap) {
                    PersonaAvatar(personaKey: personaKey, size: 36, circular: true)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("내 프로필 꾸미기", "Edit my profile", locale: locale))
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 62)
            .background(palette.background.opacity(0.95))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
        }
    }
}

// MARK: - 4. Bottom Navigation Bar (`BottomNav.tsx` + `AppShell.module.css` Mobile Parity)

public struct OttlineBottomBar: View {
    public var activeTab: TopLevelTab
    public var onSelectTab: (TopLevelTab) -> Void
    public var onQuickRecordTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        HStack(spacing: 4) {
            navTabButton(
                tab: .home,
                label: OttlineStrings.tr("홈", "Home", locale: locale),
                systemImage: "house"
            )
            navTabButton(
                tab: .timeline,
                label: OttlineStrings.tr("타임라인", "Timeline", locale: locale),
                systemImage: "clock"
            )

            // Center Quick Record CTA (`QuickLogAction iconOnly` in `BottomNav.tsx` — no text label)
            Button(action: onQuickRecordTap) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(palette.brandOrange)
                        .frame(width: 48, height: 48)
                    Image(systemName: "plus")
                        .font(.system(size: 19, weight: .semibold))
                        .foregroundStyle(palette.onBrandOrange)
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))

            navTabButton(
                tab: .together,
                label: OttlineStrings.tr("함께", "Together", locale: locale),
                systemImage: "bubble.left"
            )
            navTabButton(
                tab: .mySpace,
                label: OttlineStrings.tr("내 공간", "My space", locale: locale),
                systemImage: "person"
            )
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 6)
        .background(palette.card.opacity(0.96))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(palette.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(palette.isDark ? 0.28 : 0.08), radius: 10, x: 0, y: 4)
        .padding(.horizontal, 14)
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    private func navTabButton(tab: TopLevelTab, label: String, systemImage: String) -> some View {
        let selected = activeTab == tab
        let activeColor = palette.isDark ? palette.ink : palette.brandNavy
        return Button {
            onSelectTab(tab)
        } label: {
            ZStack(alignment: .top) {
                Capsule()
                    .fill(selected ? palette.brandOrange : Color.clear)
                    .frame(width: 15, height: 2)
                    .offset(y: -6)

                VStack(spacing: 4) {
                    Image(systemName: systemImage)
                        .font(.system(size: 17, weight: selected ? .semibold : .medium))
                        .foregroundStyle(selected ? activeColor : palette.mutedInk)
                        .frame(height: 19)

                    Text(label)
                        .font(OttlineFont.semiBold(11))
                        .foregroundStyle(selected ? activeColor : palette.mutedInk)
                        .lineLimit(1)
                }
                .padding(.vertical, 4)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 5. Persona Avatar & Poster Image

public struct PersonaAvatar: View {
    public var personaKey: PersonaKey?
    public var size: CGFloat = 40
    public var circular: Bool = true
    @Environment(\.ottlinePalette) private var palette

    public init(personaKey: PersonaKey?, size: CGFloat = 40, circular: Bool = true) {
        self.personaKey = personaKey
        self.size = size
        self.circular = circular
    }

    public var body: some View {
        let preset = OttlineStrings.personaPreset(personaKey)
        let radius = circular ? size * 0.5 : max(8, size * 0.25)
        Image(preset.assetName)
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: radius))
            .overlay(
                RoundedRectangle(cornerRadius: radius)
                    .stroke(palette.border, lineWidth: 1)
            )
    }
}

public func tmdbResizeUrl(_ url: String?, bucket: String = "w342") -> String? {
    guard let raw = url?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
        return nil
    }
    var httpsUrl = raw.hasPrefix("http://")
        ? "https://" + raw.dropFirst("http://".count)
        : raw
    if httpsUrl.contains("image.tmdb.org/t/p/") {
        httpsUrl = httpsUrl.replacingOccurrences(
            of: #"image\.tmdb\.org/t/p/(original|w\d+)/"#,
            with: "image.tmdb.org/t/p/\(bucket)/",
            options: .regularExpression
        )
    }
    return httpsUrl
}

public struct PosterImage: View {
    public var posterUrl: String?
    public var titleName: String
    public var titleType: TitleType
    public var width: CGFloat = 68
    public var height: CGFloat = 98
    public var cornerRadius: CGFloat = 8
    public var widthBucket: String = "w342"

    @Environment(\.ottlinePalette) private var palette

    public init(
        posterUrl: String?,
        titleName: String,
        titleType: TitleType = .movie,
        width: CGFloat = 68,
        height: CGFloat = 98,
        cornerRadius: CGFloat = 8,
        widthBucket: String = "w342"
    ) {
        self.posterUrl = posterUrl
        self.titleName = titleName
        self.titleType = titleType
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
        self.widthBucket = widthBucket
    }

    public var body: some View {
        let resolvedUrl = tmdbResizeUrl(posterUrl, bucket: widthBucket).flatMap(URL.init(string:))
        Group {
            if let resolvedUrl {
                AsyncImage(url: resolvedUrl) { phase in
                    switch phase {
                    case .success(let img):
                        img.resizable().scaledToFill()
                    default:
                        fallbackBox
                    }
                }
            } else {
                fallbackBox
            }
        }
        .frame(width: width, height: height)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .overlay(
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private var fallbackBox: some View {
        ZStack {
            palette.paperStrong
            VStack(spacing: 4) {
                Image(systemName: titleType == .book ? "book.closed" : (titleType == .series ? "tv" : "film"))
                    .font(.system(size: min(width, height) * 0.25))
                    .foregroundStyle(palette.subtleInk)
                if width >= 54 {
                    Text(titleName)
                        .font(OttlineFont.medium(10))
                        .foregroundStyle(palette.mutedInk)
                        .multilineTextAlignment(.center)
                        .lineLimit(2)
                        .padding(.horizontal, 4)
                }
            }
        }
    }
}

// MARK: - 6. Feeling Icon & Badge (`FeelingIcon.tsx` + `RecordFeelings.tsx` parity)

public struct FeelingIcon: View {
    public var value: Int // 1 (Bad), 2 (Soso), 3 or 5 (Best)
    public var isBook: Bool = false
    public var size: CGFloat = 16
    public var tint: Color

    public init(value: Int, isBook: Bool = false, size: CGFloat = 16, tint: Color) {
        self.value = value
        self.isBook = isBook
        self.size = size
        self.tint = tint
    }

    public var body: some View {
        Canvas { context, canvasSize in
            let w = canvasSize.width
            let h = canvasSize.height
            let stroke = StrokeStyle(lineWidth: max(1.4, w * 0.095), lineCap: .round, lineJoin: .round)

            if value >= 3 && isBook {
                // Lucide `BookOpen`
                var leftPage = Path()
                leftPage.move(to: CGPoint(x: w * 0.5, y: h * 0.25))
                leftPage.addCurve(
                    to: CGPoint(x: w * 0.14, y: h * 0.20),
                    control1: CGPoint(x: w * 0.40, y: h * 0.18),
                    control2: CGPoint(x: w * 0.26, y: h * 0.18)
                )
                leftPage.addLine(to: CGPoint(x: w * 0.14, y: h * 0.76))
                leftPage.addCurve(
                    to: CGPoint(x: w * 0.5, y: h * 0.82),
                    control1: CGPoint(x: w * 0.26, y: h * 0.76),
                    control2: CGPoint(x: w * 0.40, y: h * 0.76)
                )
                leftPage.closeSubpath()
                context.stroke(leftPage, with: .color(tint), style: stroke)

                var rightPage = Path()
                rightPage.move(to: CGPoint(x: w * 0.5, y: h * 0.25))
                rightPage.addCurve(
                    to: CGPoint(x: w * 0.86, y: h * 0.20),
                    control1: CGPoint(x: w * 0.60, y: h * 0.18),
                    control2: CGPoint(x: w * 0.74, y: h * 0.18)
                )
                rightPage.addLine(to: CGPoint(x: w * 0.86, y: h * 0.76))
                rightPage.addCurve(
                    to: CGPoint(x: w * 0.5, y: h * 0.82),
                    control1: CGPoint(x: w * 0.74, y: h * 0.76),
                    control2: CGPoint(x: w * 0.60, y: h * 0.76)
                )
                rightPage.closeSubpath()
                context.stroke(rightPage, with: .color(tint), style: stroke)
            } else {
                // Lucide `Smile`, `Meh`, or `Frown`
                let circleRect = CGRect(x: w * 0.12, y: h * 0.12, width: w * 0.76, height: h * 0.76)
                context.stroke(Path(ellipseIn: circleRect), with: .color(tint), style: stroke)

                let eyeR = max(1.1, w * 0.055)
                let leftEye = CGRect(x: w * 0.36 - eyeR, y: h * 0.40 - eyeR, width: eyeR * 2, height: eyeR * 2)
                let rightEye = CGRect(x: w * 0.64 - eyeR, y: h * 0.40 - eyeR, width: eyeR * 2, height: eyeR * 2)
                context.fill(Path(ellipseIn: leftEye), with: .color(tint))
                context.fill(Path(ellipseIn: rightEye), with: .color(tint))

                var mouth = Path()
                if value >= 3 {
                    mouth.move(to: CGPoint(x: w * 0.34, y: h * 0.58))
                    mouth.addQuadCurve(
                        to: CGPoint(x: w * 0.66, y: h * 0.58),
                        control: CGPoint(x: w * 0.50, y: h * 0.73)
                    )
                } else if value == 2 {
                    mouth.move(to: CGPoint(x: w * 0.35, y: h * 0.63))
                    mouth.addLine(to: CGPoint(x: w * 0.65, y: h * 0.63))
                } else {
                    mouth.move(to: CGPoint(x: w * 0.34, y: h * 0.68))
                    mouth.addQuadCurve(
                        to: CGPoint(x: w * 0.66, y: h * 0.68),
                        control: CGPoint(x: w * 0.50, y: h * 0.54)
                    )
                }
                context.stroke(mouth, with: .color(tint), style: stroke)
            }
        }
        .frame(width: size, height: size)
    }
}

public struct RecordFeelingBadge: View {
    public var rating: Double?
    public var isBook: Bool
    public var compact: Bool = false

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(rating: Double?, isBook: Bool, compact: Bool = false) {
        self.rating = rating
        self.isBook = isBook
        self.compact = compact
    }

    public var body: some View {
        if let feeling = RecordFeelings.resolveFeeling(rating: rating, isBook: isBook, locale: locale) {
            HStack(spacing: 4) {
                FeelingIcon(
                    value: feeling.value,
                    isBook: isBook,
                    size: compact ? 13 : 14,
                    tint: palette.mutedInk
                )
                Text(compact ? feeling.shortLabel : feeling.label)
                    .font(OttlineFont.regular(compact ? 12 : 12.5))
                    .foregroundStyle(palette.mutedInk)
            }
        }
    }
}

// MARK: - 7. Sync Notice Banner (`HomeTimelineView.tsx` `.syncNotice` parity)

public struct SyncNoticeBanner: View {
    public var syncState: SyncState
    public var outboxCount: Int
    public var onRetryTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 3) {
                Text(bannerTitle)
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.ink)
                Text(bannerSubtitle)
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(2)
            }

            Spacer(minLength: 8)

            Button(action: onRetryTap) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.triangle.2.circlepath")
                        .font(.system(size: 13, weight: .semibold))
                    Text(syncState.status == .syncing
                        ? OttlineStrings.tr("동기화 중", "Syncing", locale: locale)
                        : OttlineStrings.tr("다시 시도", "Retry", locale: locale)
                    )
                    .font(OttlineFont.semiBold(12.5))
                }
                .foregroundStyle(palette.ink)
                .padding(.horizontal, 12)
                .frame(minHeight: 38)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)
            .disabled(syncState.status == .syncing)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(palette.paperStrong)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(palette.border, lineWidth: 1)
        )
    }

    private var bannerTitle: String {
        if syncState.status == .failed {
            return OttlineStrings.tr(
                "다른 기기로 아직 옮기지 못한 기록이 있어요.",
                "Some records haven’t reached your other devices yet.",
                locale: locale
            )
        }
        return OttlineStrings.tr(
            "다른 기기에 아직 반영되지 않은 기록이 있어요.",
            "Some changes haven’t synced yet.",
            locale: locale
        )
    }

    private var bannerSubtitle: String {
        switch syncState.status {
        case .syncing:
            return OttlineStrings.tr(
                "기록은 이 기기에 보관했어요. 지금 다른 기기와 맞추고 있어요.",
                "Your records are safe on this device. Syncing now.",
                locale: locale
            )
        case .failed:
            return OttlineStrings.tr(
                "기록은 이 기기에 안전하게 남아 있어요. 잠시 후 다시 시도해 주세요.",
                "Your records are safe on this device. Try again in a moment.",
                locale: locale
            )
        case .idle:
            return OttlineStrings.tr(
                "기록은 이 기기에 보관했어요. 동기화가 끝나면 다른 기기에서도 이어볼 수 있어요.",
                "Your records are safe on this device. They’ll appear on your other devices once sync finishes.",
                locale: locale
            )
        }
    }
}
