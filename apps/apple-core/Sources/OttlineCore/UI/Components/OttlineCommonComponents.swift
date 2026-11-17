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
    public var themeMode: ThemeMode
    public var onLogoTap: () -> Void
    public var onSelectLocale: (String) -> Void
    public var onToggleTheme: () -> Void
    public var onProfileTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(
        nickname: String?,
        personaKey: PersonaKey?,
        themeMode: ThemeMode = .system,
        onLogoTap: @escaping () -> Void,
        onSelectLocale: @escaping (String) -> Void,
        onToggleTheme: @escaping () -> Void,
        onProfileTap: @escaping () -> Void
    ) {
        self.nickname = nickname
        self.personaKey = personaKey
        self.themeMode = themeMode
        self.onLogoTap = onLogoTap
        self.onSelectLocale = onSelectLocale
        self.onToggleTheme = onToggleTheme
        self.onProfileTap = onProfileTap
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Button(action: onLogoTap) {
                    HStack(spacing: 8) {
                        OttlineBrandMark(size: 40)
                            .frame(width: 40, height: 40)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("ottline")
                                .font(OttlineFont.bold(30))
                                .kerning(-0.75)
                                .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                            Text("ON THE TIMELINE")
                                .font(OttlineFont.semiBold(9))
                                .kerning(0.9)
                                .foregroundStyle(palette.brandOrange)
                                .padding(.top, 1)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                // Language Switcher (`KO` / `EN`) matching `AppHeader.tsx` + `AppShell.module.css`
                HStack(spacing: 0) {
                    ForEach([("ko", "KO"), ("en", "EN")], id: \.0) { code, label in
                        let active = locale == code
                        Button {
                            if !active {
                                onSelectLocale(code)
                            }
                        } label: {
                            VStack(spacing: 3) {
                                Text(label)
                                    .font(OttlineFont.semiBold(10))
                                    .foregroundStyle(active ? palette.ink : palette.mutedInk)
                                Rectangle()
                                    .fill(active ? palette.ink : Color.clear)
                                    .frame(width: 14, height: 1)
                            }
                            .frame(minWidth: 32, minHeight: 40)
                        }
                        .buttonStyle(.plain)
                    }
                }

                // Theme Toggle (`Monitor` / `Sun` / `Moon`) matching `AppHeader.tsx` (`system` -> `light` -> `dark`)
                let themeLucideIcon: OttlineLucideIconKind = {
                    switch themeMode {
                    case .system: return .monitor
                    case .light: return .sun
                    case .dark: return .moon
                    }
                }()
                let themeA11yLabel: String = {
                    switch themeMode {
                    case .system:
                        return OttlineStrings.tr("테마 변경 (현재: 시스템)", "Change theme (current: System)", locale: locale)
                    case .light:
                        return OttlineStrings.tr("테마 변경 (현재: 라이트)", "Change theme (current: Light)", locale: locale)
                    case .dark:
                        return OttlineStrings.tr("테마 변경 (현재: 다크)", "Change theme (current: Dark)", locale: locale)
                    }
                }()
                Button(action: onToggleTheme) {
                    OttlineLucideIcon(kind: themeLucideIcon, size: 18, color: palette.mutedInk, strokeWidth: 2.0)
                        .frame(width: 40, height: 40)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(themeA11yLabel)

                // Profile Link (`40x40` rounded-lg on mobile web `ProfileAvatar.tsx`)
                Button(action: onProfileTap) {
                    PersonaAvatar(personaKey: personaKey, size: 40, circular: false)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("내 프로필", "My profile", locale: locale))
            }
            .padding(.horizontal, 18)
            .frame(minHeight: 68)
            .background(palette.background.opacity(0.95))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
        }
    }
}

// MARK: - 3B. Exact 24x24 Lucide Vector Icons (`AppHeader.tsx` + `BottomNav.tsx` + `ProfileAvatar.tsx` 1:1 Parity)

public enum OttlineLucideIconKind: Sendable {
    case home
    case clock
    case plus
    case messageCircle
    case userRound
    case monitor
    case sun
    case moon
    case x
    case tv
    case mapPin
    case users
    case check
    case clock3
    case bookOpen
    case sparkles
    case rotateCcw
    case share2
    case download
    case chevronDown
    case chevronUp
    case chevronLeft
    case chevronRight
    case externalLink
    case slidersHorizontal
    case trash2
    case copy
    case smartphone
    case arrowUp
    case arrowLeft
    case pencil
    case search
    case calendar
}

public struct OttlineLucideIcon: View {
    public var kind: OttlineLucideIconKind
    public var size: CGFloat = 20
    public var color: Color
    public var strokeWidth: CGFloat = 2.0

    public init(
        kind: OttlineLucideIconKind,
        size: CGFloat = 20,
        color: Color,
        strokeWidth: CGFloat = 2.0
    ) {
        self.kind = kind
        self.size = size
        self.color = color
        self.strokeWidth = strokeWidth
    }

    public var body: some View {
        Canvas { context, canvasSize in
            let s = min(canvasSize.width, canvasSize.height) / 24.0
            let style = StrokeStyle(
                lineWidth: strokeWidth * s,
                lineCap: .round,
                lineJoin: .round
            )
            func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * s, y: y * s)
            }

            switch kind {
            case .home:
                var door = Path()
                door.move(to: pt(15, 21))
                door.addLine(to: pt(15, 13))
                door.addQuadCurve(to: pt(14, 12), control: pt(15, 12))
                door.addLine(to: pt(10, 12))
                door.addQuadCurve(to: pt(9, 13), control: pt(9, 12))
                door.addLine(to: pt(9, 21))
                context.stroke(door, with: .color(color), style: style)

                var house = Path()
                house.move(to: pt(3, 10))
                house.addQuadCurve(to: pt(3.709, 8.472), control: pt(3, 9.08))
                house.addLine(to: pt(10.709, 2.473))
                house.addQuadCurve(to: pt(13.291, 2.473), control: pt(12, 1.37))
                house.addLine(to: pt(20.291, 8.472))
                house.addQuadCurve(to: pt(21, 10), control: pt(21, 9.08))
                house.addLine(to: pt(21, 19))
                house.addQuadCurve(to: pt(19, 21), control: pt(21, 21))
                house.addLine(to: pt(5, 21))
                house.addQuadCurve(to: pt(3, 19), control: pt(3, 21))
                house.closeSubpath()
                context.stroke(house, with: .color(color), style: style)

            case .clock:
                let circle = Path(ellipseIn: CGRect(x: 2 * s, y: 2 * s, width: 20 * s, height: 20 * s))
                context.stroke(circle, with: .color(color), style: style)

                var hands = Path()
                hands.move(to: pt(12, 6))
                hands.addLine(to: pt(12, 12))
                hands.addLine(to: pt(16, 14))
                context.stroke(hands, with: .color(color), style: style)

            case .plus:
                var p = Path()
                p.move(to: pt(5, 12))
                p.addLine(to: pt(19, 12))
                p.move(to: pt(12, 5))
                p.addLine(to: pt(12, 19))
                context.stroke(p, with: .color(color), style: style)

            case .messageCircle:
                // Lucide `MessageCircle`: `M7.9 20A9 9 0 1 0 4 16.1L2 22Z`
                var bubble = Path()
                let startAngle = atan2(4.1, -8.0) // (4, 16.1) relative to (12, 12)
                let endAngle = atan2(8.0, -4.1) + 2.0 * .pi // (7.9, 20) going around top/right/bottom
                let steps = 36
                bubble.move(to: pt(4.0, 16.1))
                for i in 1...steps {
                    let t = startAngle + (endAngle - startAngle) * (Double(i) / Double(steps))
                    let x = 12.0 + 9.0 * cos(t)
                    let y = 12.0 + 9.0 * sin(t)
                    bubble.addLine(to: pt(CGFloat(x), CGFloat(y)))
                }
                bubble.addLine(to: pt(2.0, 22.0))
                bubble.closeSubpath()
                context.stroke(bubble, with: .color(color), style: style)

            case .userRound:
                // Lucide `UserRound`: head circle (cx: 12, cy: 8, r: 5) + shoulders `M20 21a8 8 0 0 0-16 0`
                let head = Path(ellipseIn: CGRect(x: 7 * s, y: 3 * s, width: 10 * s, height: 10 * s))
                context.stroke(head, with: .color(color), style: style)

                var shoulders = Path()
                let steps = 28
                shoulders.move(to: pt(4, 21))
                for i in 1...steps {
                    let t = Double.pi + Double.pi * (Double(i) / Double(steps))
                    let x = 12.0 + 8.0 * cos(t)
                    let y = 21.0 + 8.0 * sin(t)
                    shoulders.addLine(to: pt(CGFloat(x), CGFloat(y)))
                }
                context.stroke(shoulders, with: .color(color), style: style)

            case .monitor:
                let screen = Path(roundedRect: CGRect(x: 2 * s, y: 3 * s, width: 20 * s, height: 14 * s), cornerRadius: 2 * s)
                context.stroke(screen, with: .color(color), style: style)

                var stand = Path()
                stand.move(to: pt(8, 21))
                stand.addLine(to: pt(16, 21))
                stand.move(to: pt(12, 17))
                stand.addLine(to: pt(12, 21))
                context.stroke(stand, with: .color(color), style: style)

            case .sun:
                let center = Path(ellipseIn: CGRect(x: 8 * s, y: 8 * s, width: 8 * s, height: 8 * s))
                context.stroke(center, with: .color(color), style: style)

                var rays = Path()
                let segments: [(CGFloat, CGFloat, CGFloat, CGFloat)] = [
                    (12, 2, 12, 4),
                    (12, 20, 12, 22),
                    (4.93, 4.93, 6.34, 6.34),
                    (17.66, 17.66, 19.07, 19.07),
                    (2, 12, 4, 12),
                    (20, 12, 22, 12),
                    (6.34, 17.66, 4.93, 19.07),
                    (19.07, 4.93, 17.66, 6.34)
                ]
                for (x1, y1, x2, y2) in segments {
                    rays.move(to: pt(x1, y1))
                    rays.addLine(to: pt(x2, y2))
                }
                context.stroke(rays, with: .color(color), style: style)

            case .moon:
                // Lucide `Moon`: `M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z`
                var moon = Path()
                let innerR = 4.5 * sqrt(2.0)
                let innerStart = -0.75 * Double.pi // (12, 3) from center (16.5, 7.5)
                let innerEnd = -1.75 * Double.pi   // (21, 12) going through (12, 12)
                let innerSteps = 24
                moon.move(to: pt(12, 3))
                for i in 1...innerSteps {
                    let t = innerStart + (innerEnd - innerStart) * (Double(i) / Double(innerSteps))
                    let x = 16.5 + innerR * cos(t)
                    let y = 7.5 + innerR * sin(t)
                    moon.addLine(to: pt(CGFloat(x), CGFloat(y)))
                }
                let outerSteps = 32
                for i in 1...outerSteps {
                    let t = 1.5 * Double.pi * (Double(i) / Double(outerSteps)) // 0 -> 270°
                    let x = 12.0 + 9.0 * cos(t)
                    let y = 12.0 + 9.0 * sin(t)
                    moon.addLine(to: pt(CGFloat(x), CGFloat(y)))
                }
                moon.closeSubpath()
                context.stroke(moon, with: .color(color), style: style)

            case .x:
                var cross = Path()
                cross.move(to: pt(18, 6))
                cross.addLine(to: pt(6, 18))
                cross.move(to: pt(6, 6))
                cross.addLine(to: pt(18, 18))
                context.stroke(cross, with: .color(color), style: style)

            case .tv:
                let rect = Path(roundedRect: CGRect(x: 2 * s, y: 7 * s, width: 20 * s, height: 15 * s), cornerRadius: 2 * s)
                context.stroke(rect, with: .color(color), style: style)
                var ant = Path()
                ant.move(to: pt(17, 2))
                ant.addLine(to: pt(12, 7))
                ant.addLine(to: pt(7, 2))
                context.stroke(ant, with: .color(color), style: style)

            case .mapPin:
                var pin = Path()
                pin.move(to: pt(20, 10))
                pin.addQuadCurve(to: pt(12, 22), control: pt(20, 16))
                pin.addQuadCurve(to: pt(4, 10), control: pt(4, 16))
                pin.addArc(center: pt(12, 10), radius: 8 * s, startAngle: .degrees(180), endAngle: .degrees(0), clockwise: false)
                context.stroke(pin, with: .color(color), style: style)
                let dot = Path(ellipseIn: CGRect(x: 9 * s, y: 7 * s, width: 6 * s, height: 6 * s))
                context.stroke(dot, with: .color(color), style: style)

            case .users:
                let p1 = Path(ellipseIn: CGRect(x: 5 * s, y: 3 * s, width: 8 * s, height: 8 * s))
                context.stroke(p1, with: .color(color), style: style)
                var b1 = Path()
                b1.move(to: pt(2, 21))
                b1.addQuadCurve(to: pt(6, 15), control: pt(2, 16.5))
                b1.addLine(to: pt(12, 15))
                b1.addQuadCurve(to: pt(16, 21), control: pt(16, 16.5))
                context.stroke(b1, with: .color(color), style: style)
                var p2 = Path()
                p2.addArc(center: pt(16, 7), radius: 3.5 * s, startAngle: .degrees(-60), endAngle: .degrees(60), clockwise: false)
                context.stroke(p2, with: .color(color), style: style)
                var b2 = Path()
                b2.move(to: pt(22, 21))
                b2.addQuadCurve(to: pt(19, 15.2), control: pt(22, 17))
                context.stroke(b2, with: .color(color), style: style)

            case .check:
                var p = Path()
                p.move(to: pt(20, 6))
                p.addLine(to: pt(9, 17))
                p.addLine(to: pt(4, 12))
                context.stroke(p, with: .color(color), style: style)

            case .clock3:
                let c = Path(ellipseIn: CGRect(x: 2 * s, y: 2 * s, width: 20 * s, height: 20 * s))
                context.stroke(c, with: .color(color), style: style)
                var p = Path()
                p.move(to: pt(12, 6))
                p.addLine(to: pt(12, 12))
                p.addLine(to: pt(16.5, 12))
                context.stroke(p, with: .color(color), style: style)

            case .bookOpen:
                var p = Path()
                p.move(to: pt(12, 7))
                p.addLine(to: pt(12, 21))
                p.move(to: pt(3, 18))
                p.addLine(to: pt(3, 5))
                p.addQuadCurve(to: pt(12, 7), control: pt(7, 3.5))
                p.addQuadCurve(to: pt(21, 5), control: pt(17, 3.5))
                p.addLine(to: pt(21, 18))
                p.addQuadCurve(to: pt(12, 21), control: pt(17, 17))
                p.addQuadCurve(to: pt(3, 18), control: pt(7, 17))
                context.stroke(p, with: .color(color), style: style)

            case .sparkles:
                var p = Path()
                p.move(to: pt(12, 3))
                p.addLine(to: pt(14.2, 9.8))
                p.addLine(to: pt(21, 12))
                p.addLine(to: pt(14.2, 14.2))
                p.addLine(to: pt(12, 21))
                p.addLine(to: pt(9.8, 14.2))
                p.addLine(to: pt(3, 12))
                p.addLine(to: pt(9.8, 9.8))
                p.closeSubpath()
                context.stroke(p, with: .color(color), style: style)
                var d = Path()
                d.move(to: pt(19, 3))
                d.addLine(to: pt(19, 6))
                d.move(to: pt(17.5, 4.5))
                d.addLine(to: pt(20.5, 4.5))
                context.stroke(d, with: .color(color), style: style)

            case .rotateCcw:
                var arc = Path()
                arc.addArc(center: pt(12, 12), radius: 9 * s, startAngle: .degrees(-135), endAngle: .degrees(160), clockwise: false)
                context.stroke(arc, with: .color(color), style: style)
                var arrow = Path()
                arrow.move(to: pt(3, 3))
                arrow.addLine(to: pt(3, 8))
                arrow.addLine(to: pt(8, 8))
                context.stroke(arrow, with: .color(color), style: style)

            case .share2:
                let top = Path(ellipseIn: CGRect(x: 15 * s, y: 2 * s, width: 6 * s, height: 6 * s))
                let left = Path(ellipseIn: CGRect(x: 3 * s, y: 9 * s, width: 6 * s, height: 6 * s))
                let bot = Path(ellipseIn: CGRect(x: 15 * s, y: 16 * s, width: 6 * s, height: 6 * s))
                context.stroke(top, with: .color(color), style: style)
                context.stroke(left, with: .color(color), style: style)
                context.stroke(bot, with: .color(color), style: style)
                var lines = Path()
                lines.move(to: pt(8.59, 13.51))
                lines.addLine(to: pt(15.42, 17.49))
                lines.move(to: pt(15.41, 6.51))
                lines.addLine(to: pt(8.59, 10.49))
                context.stroke(lines, with: .color(color), style: style)

            case .download:
                var p = Path()
                p.move(to: pt(21, 15))
                p.addLine(to: pt(21, 19))
                p.addQuadCurve(to: pt(19, 21), control: pt(21, 21))
                p.addLine(to: pt(5, 21))
                p.addQuadCurve(to: pt(3, 19), control: pt(3, 21))
                p.addLine(to: pt(3, 15))
                p.move(to: pt(7, 10))
                p.addLine(to: pt(12, 15))
                p.addLine(to: pt(17, 10))
                p.move(to: pt(12, 15))
                p.addLine(to: pt(12, 3))
                context.stroke(p, with: .color(color), style: style)

            case .chevronDown:
                var p = Path()
                p.move(to: pt(6, 9))
                p.addLine(to: pt(12, 15))
                p.addLine(to: pt(18, 9))
                context.stroke(p, with: .color(color), style: style)

            case .chevronUp:
                var p = Path()
                p.move(to: pt(18, 15))
                p.addLine(to: pt(12, 9))
                p.addLine(to: pt(6, 15))
                context.stroke(p, with: .color(color), style: style)

            case .chevronLeft:
                var p = Path()
                p.move(to: pt(15, 18))
                p.addLine(to: pt(9, 12))
                p.addLine(to: pt(15, 6))
                context.stroke(p, with: .color(color), style: style)

            case .chevronRight:
                var p = Path()
                p.move(to: pt(9, 18))
                p.addLine(to: pt(15, 12))
                p.addLine(to: pt(9, 6))
                context.stroke(p, with: .color(color), style: style)

            case .externalLink:
                var p = Path()
                p.move(to: pt(15, 3))
                p.addLine(to: pt(21, 3))
                p.addLine(to: pt(21, 9))
                p.move(to: pt(10, 14))
                p.addLine(to: pt(21, 3))
                p.move(to: pt(18, 13))
                p.addLine(to: pt(18, 19))
                p.addQuadCurve(to: pt(16, 21), control: pt(18, 21))
                p.addLine(to: pt(5, 21))
                p.addQuadCurve(to: pt(3, 19), control: pt(3, 21))
                p.addLine(to: pt(3, 8))
                p.addQuadCurve(to: pt(5, 6), control: pt(3, 6))
                p.addLine(to: pt(11, 6))
                context.stroke(p, with: .color(color), style: style)

            case .slidersHorizontal:
                var p = Path()
                p.move(to: pt(21, 4)); p.addLine(to: pt(14, 4))
                p.move(to: pt(10, 4)); p.addLine(to: pt(3, 4))
                p.move(to: pt(21, 12)); p.addLine(to: pt(12, 12))
                p.move(to: pt(8, 12)); p.addLine(to: pt(3, 12))
                p.move(to: pt(21, 20)); p.addLine(to: pt(16, 20))
                p.move(to: pt(12, 20)); p.addLine(to: pt(3, 20))
                p.move(to: pt(14, 2)); p.addLine(to: pt(14, 6))
                p.move(to: pt(8, 10)); p.addLine(to: pt(8, 14))
                p.move(to: pt(16, 18)); p.addLine(to: pt(16, 22))
                context.stroke(p, with: .color(color), style: style)

            case .trash2:
                var p = Path()
                p.move(to: pt(3, 6)); p.addLine(to: pt(21, 6))
                p.move(to: pt(19, 6)); p.addLine(to: pt(19, 20))
                p.addQuadCurve(to: pt(17, 22), control: pt(19, 22))
                p.addLine(to: pt(7, 22))
                p.addQuadCurve(to: pt(5, 20), control: pt(5, 22))
                p.addLine(to: pt(5, 6))
                p.move(to: pt(8, 6)); p.addLine(to: pt(8, 4))
                p.addQuadCurve(to: pt(10, 2), control: pt(8, 2))
                p.addLine(to: pt(14, 2))
                p.addQuadCurve(to: pt(16, 4), control: pt(16, 2))
                p.addLine(to: pt(16, 6))
                p.move(to: pt(10, 11)); p.addLine(to: pt(10, 17))
                p.move(to: pt(14, 11)); p.addLine(to: pt(14, 17))
                context.stroke(p, with: .color(color), style: style)

            case .copy:
                let r1 = Path(roundedRect: CGRect(x: 8 * s, y: 8 * s, width: 14 * s, height: 14 * s), cornerRadius: 2 * s)
                context.stroke(r1, with: .color(color), style: style)
                var r2 = Path()
                r2.move(to: pt(4, 16))
                r2.addQuadCurve(to: pt(2, 14), control: pt(2, 16))
                r2.addLine(to: pt(2, 4))
                r2.addQuadCurve(to: pt(4, 2), control: pt(2, 2))
                r2.addLine(to: pt(14, 2))
                r2.addQuadCurve(to: pt(16, 4), control: pt(16, 2))
                context.stroke(r2, with: .color(color), style: style)

            case .smartphone:
                let r = Path(roundedRect: CGRect(x: 5 * s, y: 2 * s, width: 14 * s, height: 20 * s), cornerRadius: 2 * s)
                context.stroke(r, with: .color(color), style: style)
                var dot = Path()
                dot.move(to: pt(12, 18))
                dot.addLine(to: pt(12.01, 18))
                context.stroke(dot, with: .color(color), style: style)

            case .arrowUp:
                var p = Path()
                p.move(to: pt(12, 19))
                p.addLine(to: pt(12, 5))
                p.move(to: pt(5, 12))
                p.addLine(to: pt(12, 5))
                p.addLine(to: pt(19, 12))
                context.stroke(p, with: .color(color), style: style)

            case .arrowLeft:
                var p = Path()
                p.move(to: pt(19, 12))
                p.addLine(to: pt(5, 12))
                p.move(to: pt(12, 19))
                p.addLine(to: pt(5, 12))
                p.addLine(to: pt(12, 5))
                context.stroke(p, with: .color(color), style: style)

            case .pencil:
                var p = Path()
                p.move(to: pt(2, 22))
                p.addLine(to: pt(3.5, 16.5))
                p.addLine(to: pt(17, 3))
                p.addQuadCurve(to: pt(21, 7), control: pt(21.5, 2.5))
                p.addLine(to: pt(7.5, 20.5))
                p.closeSubpath()
                p.move(to: pt(15, 5))
                p.addLine(to: pt(19, 9))
                context.stroke(p, with: .color(color), style: style)

            case .search:
                let c = Path(ellipseIn: CGRect(x: 3 * s, y: 3 * s, width: 16 * s, height: 16 * s))
                context.stroke(c, with: .color(color), style: style)
                var p = Path()
                p.move(to: pt(21, 21))
                p.addLine(to: pt(16.65, 16.65))
                context.stroke(p, with: .color(color), style: style)

            case .calendar:
                let rect = CGRect(x: 3 * s, y: 4 * s, width: 18 * s, height: 18 * s)
                context.stroke(Path(roundedRect: rect, cornerRadius: 2 * s), with: .color(color), style: style)
                var ticks = Path()
                ticks.move(to: pt(16, 2))
                ticks.addLine(to: pt(16, 6))
                ticks.move(to: pt(8, 2))
                ticks.addLine(to: pt(8, 6))
                ticks.move(to: pt(3, 10))
                ticks.addLine(to: pt(21, 10))
                context.stroke(ticks, with: .color(color), style: style)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - 4. Bottom Navigation Bar (`BottomNav.tsx` + `AppShell.module.css` Mobile Parity)

public struct OttlineBottomBar: View {
    public var activeTab: TopLevelTab
    public var onSelectTab: (TopLevelTab) -> Void
    public var onQuickRecordTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(
        activeTab: TopLevelTab,
        onSelectTab: @escaping (TopLevelTab) -> Void,
        onQuickRecordTap: @escaping () -> Void
    ) {
        self.activeTab = activeTab
        self.onSelectTab = onSelectTab
        self.onQuickRecordTap = onQuickRecordTap
    }

    public var body: some View {
        HStack(spacing: 2) {
            navTabButton(
                tab: .home,
                label: OttlineStrings.tr("홈", "Home", locale: locale),
                icon: .home
            )
            navTabButton(
                tab: .timeline,
                label: OttlineStrings.tr("타임라인", "Timeline", locale: locale),
                icon: .clock
            )

            // Center Quick Record CTA (`QuickLogAction iconOnly` in `BottomNav.tsx` — 53x53, 24px Plus icon)
            Button(action: onQuickRecordTap) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(palette.brandOrange)
                        .frame(width: 53, height: 53)
                    OttlineLucideIcon(
                        kind: .plus,
                        size: 24,
                        color: palette.onBrandOrange,
                        strokeWidth: 2.2
                    )
                }
                .padding(.horizontal, 5)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))

            navTabButton(
                tab: .together,
                label: OttlineStrings.tr("함께", "Together", locale: locale),
                icon: .messageCircle
            )
            navTabButton(
                tab: .mySpace,
                label: OttlineStrings.tr("내 공간", "My space", locale: locale),
                icon: .userRound
            )
        }
        .padding(.horizontal, 6)
        .padding(.vertical, 7)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(palette.border, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(palette.isDark ? 0.28 : 0.10), radius: 14, x: 0, y: 6)
        .padding(.horizontal, 14)
        .padding(.top, 4)
        .padding(.bottom, 6)
    }

    private func navTabButton(tab: TopLevelTab, label: String, icon: OttlineLucideIconKind) -> some View {
        let selected = activeTab == tab
        let activeColor = palette.isDark ? palette.ink : palette.brandNavy
        let tintColor = selected ? activeColor : palette.mutedInk
        return Button {
            onSelectTab(tab)
        } label: {
            ZStack(alignment: .top) {
                Rectangle()
                    .fill(selected ? palette.brandOrange : Color.clear)
                    .frame(width: 15, height: 2)
                    .offset(y: -2)

                VStack(spacing: 5) {
                    OttlineLucideIcon(
                        kind: icon,
                        size: 20,
                        color: tintColor,
                        strokeWidth: 2.0
                    )

                    Text(label)
                        .font(selected ? OttlineFont.bold(10) : OttlineFont.medium(10))
                        .foregroundStyle(tintColor)
                        .lineLimit(1)
                }
                .padding(.vertical, 3)
            }
            .frame(maxWidth: .infinity, minHeight: 54)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 5. Persona Avatar & Poster Image (`ProfileAvatar.tsx` 1:1 Parity)

public struct PersonaAvatar: View {
    public var personaKey: PersonaKey?
    public var size: CGFloat = 40
    public var circular: Bool = false
    @Environment(\.ottlinePalette) private var palette

    public init(personaKey: PersonaKey?, size: CGFloat = 40, circular: Bool = false) {
        self.personaKey = personaKey
        self.size = size
        self.circular = circular
    }

    public var body: some View {
        let radius = circular ? size * 0.5 : 8.0
        if let personaKey,
           let preset = OttlineStrings.personaPresets.first(where: { $0.key == personaKey }) {
            Image(preset.assetName)
                .resizable()
                .scaledToFit()
                .frame(width: size, height: size)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: radius))
        } else {
            let iconTint = palette.isDark ? palette.ink : palette.brandNavy
            ZStack {
                palette.paperStrong
                OttlineLucideIcon(
                    kind: .userRound,
                    size: round(size * 0.45),
                    color: iconTint,
                    strokeWidth: 1.5
                )
            }
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: radius))
        }
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
                        if titleType == .book {
                            ZStack {
                                palette.mutedBg
                                img.resizable().scaledToFit()
                            }
                        } else {
                            img.resizable().scaledToFill()
                        }
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

    public init(syncState: SyncState, outboxCount: Int, onRetryTap: @escaping () -> Void) {
        self.syncState = syncState
        self.outboxCount = outboxCount
        self.onRetryTap = onRetryTap
    }

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

// MARK: - 8. Shared App Navigation Routes & Environment Keys

public enum ActiveOverlayScreen: Equatable, Sendable {
    case titleDetail(String)
    case publicDiscussion(String)
    case report
    case bookshelf(Int?)
    case feedback(String?)
    case guides(String?)
    case about
    case faq
    case privacy
}

private struct OttlineOpenOverlayKey: EnvironmentKey {
    static let defaultValue: (ActiveOverlayScreen) -> Void = { _ in }
}

private struct OttlineOpenTabKey: EnvironmentKey {
    static let defaultValue: (TopLevelTab) -> Void = { _ in }
}

public extension EnvironmentValues {
    var openOttlineOverlay: (ActiveOverlayScreen) -> Void {
        get { self[OttlineOpenOverlayKey.self] }
        set { self[OttlineOpenOverlayKey.self] = newValue }
    }

    var openOttlineTab: (TopLevelTab) -> Void {
        get { self[OttlineOpenTabKey.self] }
        set { self[OttlineOpenTabKey.self] = newValue }
    }
}

// MARK: - 9. Shared v2 Components (`RecordFeelingsPicker`, `RecordMomentList`, `InlineNoteText`, `FlowLayout`, Footer, Reactions, Comments)

public struct FlowLayout: Layout {
    public var horizontalSpacing: CGFloat = 8
    public var verticalSpacing: CGFloat = 8

    public init(horizontalSpacing: CGFloat = 8, verticalSpacing: CGFloat = 8) {
        self.horizontalSpacing = horizontalSpacing
        self.verticalSpacing = verticalSpacing
    }

    public func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var usedWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX > 0 && currentX + size.width > maxWidth {
                currentX = 0
                currentY += lineHeight + verticalSpacing
                lineHeight = 0
            }
            usedWidth = max(usedWidth, currentX + size.width)
            currentX += size.width + horizontalSpacing
            lineHeight = max(lineHeight, size.height)
        }
        return CGSize(
            width: maxWidth.isFinite ? maxWidth : usedWidth,
            height: currentY + lineHeight
        )
    }

    public func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX = bounds.minX
        var currentY = bounds.minY
        var lineHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX > bounds.minX && currentX + size.width > bounds.maxX {
                currentX = bounds.minX
                currentY += lineHeight + verticalSpacing
                lineHeight = 0
            }
            subview.place(
                at: CGPoint(x: currentX, y: currentY),
                anchor: .topLeading,
                proposal: ProposedViewSize(size)
            )
            currentX += size.width + horizontalSpacing
            lineHeight = max(lineHeight, size.height)
        }
    }
}

public struct OttlineCheckbox: View {
    @Binding public var isChecked: Bool
    public var label: String
    public var subtitle: String? = nil
    public var isDisabled: Bool = false

    @Environment(\.ottlinePalette) private var palette

    public init(isChecked: Binding<Bool>, label: String, subtitle: String? = nil, isDisabled: Bool = false) {
        self._isChecked = isChecked
        self.label = label
        self.subtitle = subtitle
        self.isDisabled = isDisabled
    }

    public var body: some View {
        Button {
            isChecked.toggle()
        } label: {
            HStack(alignment: .top, spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isChecked ? palette.brandOrange : palette.card)
                        .frame(width: 20, height: 20)
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(isChecked ? palette.brandOrange : palette.border, lineWidth: 1.5)
                        .frame(width: 20, height: 20)
                    if isChecked {
                        OttlineLucideIcon(kind: .check, size: 13, color: palette.onBrandOrange, strokeWidth: 2.5)
                    }
                }
                .padding(.top, 2)

                VStack(alignment: .leading, spacing: 3) {
                    Text(label)
                        .font(OttlineFont.medium(14))
                        .foregroundStyle(palette.ink)
                        .multilineTextAlignment(.leading)
                    if let subtitle, !subtitle.isEmpty {
                        Text(subtitle)
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                            .lineSpacing(3)
                            .multilineTextAlignment(.leading)
                    }
                }
                Spacer(minLength: 0)
            }
            .frame(minHeight: 48)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.45 : 1.0)
    }
}

public struct RecordFeelingsPicker: View {
    @Binding public var rating: Double?
    public var isBook: Bool

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(rating: Binding<Double?>, isBook: Bool) {
        self._rating = rating
        self.isBook = isBook
    }

    public var body: some View {
        let selectedValue = RecordFeelings.ratingToFeelingValue(rating)
        let options = RecordFeelings.options(isBook: isBook, locale: locale)

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ForEach(options, id: \.value) { option in
                    let active = selectedValue == option.value
                    Button {
                        rating = active ? nil : option.score
                    } label: {
                        VStack(spacing: 7) {
                            FeelingIcon(
                                value: option.value,
                                isBook: isBook,
                                size: 22,
                                tint: active ? palette.ink : palette.mutedInk
                            )
                            Text(option.label)
                                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                                .foregroundStyle(active ? palette.ink : palette.mutedInk)
                                .lineLimit(1)
                                .minimumScaleFactor(0.85)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 86)
                        .background(active ? palette.paperStrong : palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(active ? palette.ink : palette.border, lineWidth: active ? 1.5 : 1)
                        )
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }

            if selectedValue != nil {
                Button {
                    rating = nil
                } label: {
                    Text(OttlineStrings.tr("느낌 선택 지우기", "Clear feeling", locale: locale))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.subtleInk)
                        .underline()
                }
                .buttonStyle(.plain)
            }
        }
    }
}

public struct RecordMomentList: View {
    public var ott: String?
    public var place: Place?
    public var occasion: Occasion?
    public var compact: Bool = false

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(ott: String? = nil, place: Place? = nil, occasion: Occasion? = nil, compact: Bool = false) {
        self.ott = ott
        self.place = place
        self.occasion = occasion
        self.compact = compact
    }

    public var body: some View {
        let trimmedOtt = ott?.trimmingCharacters(in: .whitespacesAndNewlines)
        let hasAny = (trimmedOtt?.isEmpty == false) || place != nil || occasion != nil
        if hasAny {
            VStack(alignment: .leading, spacing: compact ? 4 : 6) {
                if let trimmedOtt, !trimmedOtt.isEmpty {
                    momentRow(icon: .tv, text: trimmedOtt)
                }
                if let place {
                    momentRow(icon: .mapPin, text: OttlineStrings.placeLabel(place, locale: locale))
                }
                if let occasion {
                    momentRow(icon: .users, text: OttlineStrings.occasionLabel(occasion, locale: locale))
                }
            }
        }
    }

    private func momentRow(icon: OttlineLucideIconKind, text: String) -> some View {
        HStack(spacing: 6) {
            OttlineLucideIcon(kind: icon, size: 13, color: palette.subtleInk, strokeWidth: 1.9)
            Text(text)
                .font(OttlineFont.regular(compact ? 12.5 : 13))
                .foregroundStyle(palette.mutedInk)
                .lineLimit(1)
        }
    }
}

public struct InlineNoteText: View {
    public var text: String
    public var fontSize: CGFloat = 14
    public var lineLimit: Int? = nil
    public var preserveNewlines: Bool = false

    @Environment(\.ottlinePalette) private var palette

    public init(text: String, fontSize: CGFloat = 14, lineLimit: Int? = nil, preserveNewlines: Bool = false) {
        self.text = text
        self.fontSize = fontSize
        self.lineLimit = lineLimit
        self.preserveNewlines = preserveNewlines
    }

    public var body: some View {
        let crlfNormalized = text.replacingOccurrences(of: "\r\n", with: "\n")
        let normalized = preserveNewlines
            ? crlfNormalized
            : crlfNormalized.replacingOccurrences(of: "\n", with: " ⏎ ")
        Text(attributedNote(normalized))
            .font(OttlineFont.regular(fontSize))
            .lineSpacing(preserveNewlines ? 5 : 4)
            .lineLimit(lineLimit)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func attributedNote(_ raw: String) -> AttributedString {
        var result = AttributedString(raw)
        result.foregroundColor = palette.ink
        if let regex = try? NSRegularExpression(pattern: #"@[^\s@#⏎]{1,36}"#) {
            let ns = raw as NSString
            let matches = regex.matches(in: raw, range: NSRange(location: 0, length: ns.length))
            for match in matches {
                if let range = Range(match.range, in: raw),
                   let attrRange = Range(range, in: result) {
                    result[attrRange].foregroundColor = palette.primaryAccent
                    result[attrRange].font = OttlineFont.semiBold(fontSize)
                }
            }
        }
        return result
    }
}

public struct GoogleBooksAttributionView: View {
    public var urlString: String?
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.openURL) private var openURL

    public init(urlString: String? = nil) {
        self.urlString = urlString
    }

    public var body: some View {
        HStack(spacing: 8) {
            Image("google_books_powered_by")
                .resizable()
                .scaledToFit()
                .frame(height: 18)

            if let urlString, let url = URL(string: urlString) {
                Spacer()
                Button {
                    openURL(url)
                } label: {
                    HStack(spacing: 4) {
                        Text(OttlineStrings.tr("Google 도서에서 보기", "View on Google Books", locale: locale))
                            .font(OttlineFont.medium(12))
                        OttlineLucideIcon(kind: .externalLink, size: 12, color: palette.primaryAccent, strokeWidth: 2.0)
                    }
                    .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.vertical, 4)
    }
}

public struct OttlineAppFooter: View {
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.openOttlineOverlay) private var openOverlay
    @Environment(\.openURL) private var openURL

    public init() {}

    private var currentYearString: String {
        String(Calendar(identifier: .gregorian).component(.year, from: Date()))
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Rectangle()
                .fill(palette.border)
                .frame(height: 1)

            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text("ottline")
                        .font(OttlineFont.bold(15))
                        .foregroundStyle(palette.primaryAccent)
                    Text("·")
                        .foregroundStyle(palette.subtleInk)
                    Text("ON THE TIMELINE")
                        .font(OttlineFont.semiBold(9.5))
                        .kerning(0.8)
                        .foregroundStyle(palette.brandOrange)
                }
                Text(OttlineStrings.tr(
                    "보고 읽은 순간을 나의 타임라인에.",
                    "What you watch and read, kept on your timeline.",
                    locale: locale
                ))
                .font(OttlineFont.regular(12.5))
                .foregroundStyle(palette.mutedInk)
                .lineSpacing(3)
            }

            FlowLayout(horizontalSpacing: 14, verticalSpacing: 8) {
                footerLink(OttlineStrings.tr("기록 가이드", "Guides", locale: locale)) {
                    openOverlay(.guides(nil))
                }
                footerLink(OttlineStrings.tr("서비스 소개", "About", locale: locale)) {
                    openOverlay(.about)
                }
                footerLink(OttlineStrings.tr("자주 묻는 질문", "FAQ", locale: locale)) {
                    openOverlay(.faq)
                }
                footerLink(OttlineStrings.tr("개인정보처리방침", "Privacy", locale: locale)) {
                    openOverlay(.privacy)
                }
                footerLink(OttlineStrings.tr("문의하기", "Contact", locale: locale)) {
                    openOverlay(.feedback(nil))
                }
            }

            HStack(spacing: 12) {
                Text("© \(currentYearString) ottline. All rights reserved.")
                    .font(OttlineFont.regular(11.5))
                    .foregroundStyle(palette.subtleInk)
                Button {
                    if let url = URL(string: "mailto:contact@ottline.app") {
                        openURL(url)
                    }
                } label: {
                    Text("contact@ottline.app")
                        .font(OttlineFont.regular(11.5))
                        .foregroundStyle(palette.mutedInk)
                        .underline()
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 20)
        .padding(.bottom, 110)
    }

    private func footerLink(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(OttlineFont.medium(12.5))
                .foregroundStyle(palette.mutedInk)
                .frame(minHeight: 32)
        }
        .buttonStyle(.plain)
    }
}

public struct DiscussionReactionChipsView: View {
    public var titleType: TitleType
    public var state: DiscussionReactionState
    public var isBusy: Bool = false
    public var indented: Bool = false
    public var onToggle: (DiscussionReactionType) -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public init(
        titleType: TitleType,
        state: DiscussionReactionState,
        isBusy: Bool = false,
        indented: Bool = false,
        onToggle: @escaping (DiscussionReactionType) -> Void
    ) {
        self.titleType = titleType
        self.state = state
        self.isBusy = isBusy
        self.indented = indented
        self.onToggle = onToggle
    }

    public var body: some View {
        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
            ForEach(DiscussionReactionType.allCases, id: \.self) { type in
                let selected = state.selectedTypes.contains(type)
                let count = state.summary.count(for: type)
                Button {
                    onToggle(type)
                } label: {
                    HStack(spacing: 5) {
                        if selected {
                            OttlineLucideIcon(kind: .check, size: 12, color: palette.primaryAccent, strokeWidth: 2.3)
                        }
                        Text(OttlineStrings.reactionLabel(type, titleType: titleType, locale: locale))
                            .font(selected ? OttlineFont.semiBold(12) : OttlineFont.medium(12))
                        if count > 0 {
                            Text("\(count)")
                                .font(OttlineFont.semiBold(11.5))
                        }
                    }
                    .foregroundStyle(selected ? palette.primaryAccent : palette.mutedInk)
                    .padding(.horizontal, 12)
                    .frame(minHeight: 34)
                    .background(selected ? palette.paperStrong : palette.card)
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
                .disabled(isBusy)
            }
        }
        .padding(.leading, indented ? 64 : 0)
    }
}

public struct CommentsPanelView: View {
    public var title: Title
    public var initialDiscussionId: String?
    public let repository: OttlineRepository
    public var showSyncLogCheckbox: Bool = true
    public var onSelectTitle: ((String) -> Void)? = nil
    public var onDiscussionResolved: ((String) -> Void)? = nil

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var discussionId: String?
    @State private var comments: [TitleCommentItem] = []
    @State private var isLoading = false
    @State private var sortOrder = "oldest"
    @State private var visibleCount = 5
    @State private var composerBody = ""
    @State private var syncLog = true
    @State private var isPosting = false
    @State private var errorMessage: String?

    // Mention search state
    @State private var mentionSheetPresented = false
    @State private var mentionQuery = ""
    @State private var mentionTypeFilter = "all"
    @State private var mentionResults: [TitleSearchItem] = []
    @State private var mentionSearching = false
    @State private var selectedMentions: [MentionCandidateDto] = []

    public init(
        title: Title,
        initialDiscussionId: String? = nil,
        repository: OttlineRepository,
        showSyncLogCheckbox: Bool = true,
        onSelectTitle: ((String) -> Void)? = nil,
        onDiscussionResolved: ((String) -> Void)? = nil
    ) {
        self.title = title
        self.initialDiscussionId = initialDiscussionId
        self.repository = repository
        self.showSyncLogCheckbox = showSyncLogCheckbox
        self.onSelectTitle = onSelectTitle
        self.onDiscussionResolved = onDiscussionResolved
    }

    private var sortedComments: [TitleCommentItem] {
        comments.sorted { lhs, rhs in
            let left = RecordDate.parseInstantMillis(lhs.createdAt)
            let right = RecordDate.parseInstantMillis(rhs.createdAt)
            return sortOrder == "latest" ? (left > right) : (left < right)
        }
    }

    private var visibleComments: [TitleCommentItem] {
        Array(sortedComments.prefix(visibleCount))
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(OttlineStrings.tr("함께 기록", "Together Records", locale: locale))
                    .font(OttlineFont.bold(17))
                    .foregroundStyle(palette.ink)
                Text(comments.isEmpty
                    ? OttlineStrings.tr(
                        "아직 나눈 이야기가 없어요. 첫 한 줄을 남겨보세요.",
                        "No stories shared yet. Leave the first line.",
                        locale: locale
                    )
                    : OttlineStrings.tr(
                        "한 줄 남기면 내 타임라인에도 함께 기록돼요.",
                        "Leave a line and it becomes part of your timeline too.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.mutedInk)
            }

            // Muted comments well
            VStack(alignment: .leading, spacing: 10) {
                if isLoading {
                    ProgressView()
                        .frame(maxWidth: .infinity, minHeight: 120)
                } else if comments.isEmpty {
                    Text(OttlineStrings.tr("아직 댓글이 없어요.", "No comments yet.", locale: locale))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                        .frame(maxWidth: .infinity, minHeight: 120)
                } else {
                    HStack {
                        Text(OttlineStrings.tr(
                            "\(comments.count) 개의 이야기들",
                            "\(comments.count) stories",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(12.5))
                        .foregroundStyle(palette.mutedInk)

                        Spacer()

                        Menu {
                            Button {
                                sortOrder = "oldest"
                                visibleCount = 5
                            } label: {
                                HStack {
                                    Text(OttlineStrings.tr("오래된 순", "Oldest", locale: locale))
                                    if sortOrder == "oldest" {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                            Button {
                                sortOrder = "latest"
                                visibleCount = 5
                            } label: {
                                HStack {
                                    Text(OttlineStrings.tr("최신 순", "Latest", locale: locale))
                                    if sortOrder == "latest" {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Text("\(OttlineStrings.tr("정렬", "Sort", locale: locale)): \(sortOrder == "oldest" ? OttlineStrings.tr("오래된 순", "Oldest", locale: locale) : OttlineStrings.tr("최신 순", "Latest", locale: locale))")
                                    .font(OttlineFont.medium(12))
                                    .foregroundStyle(palette.ink)
                                OttlineLucideIcon(kind: .chevronDown, size: 13, color: palette.mutedInk, strokeWidth: 2)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                            .overlay(
                                RoundedRectangle(cornerRadius: 7)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                    }

                    let currentUserId = repository.prefs.snapshot.userId
                    ForEach(visibleComments, id: \.id) { comment in
                        let isMine = (currentUserId != nil && !(currentUserId ?? "").isEmpty && comment.userId == currentUserId)
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 6) {
                                Text(comment.authorName.isEmpty ? OttlineStrings.tr("익명", "Anonymous", locale: locale) : comment.authorName)
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.ink)
                                if isMine {
                                    Text(OttlineStrings.tr("내 댓글", "My Comment", locale: locale))
                                        .font(OttlineFont.semiBold(10.5))
                                        .foregroundStyle(palette.success)
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 2)
                                        .background(palette.successSoft)
                                        .clipShape(Capsule())
                                }
                                Spacer()
                                Text(RecordDate.formatCommentDateTime(comment.createdAt, locale: locale))
                                    .font(OttlineFont.regular(11.5))
                                    .foregroundStyle(palette.subtleInk)
                            }
                            InlineNoteText(text: comment.body, fontSize: 14, preserveNewlines: true)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(isMine ? palette.successSoft.opacity(0.45) : palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(isMine ? palette.success.opacity(0.45) : palette.border, lineWidth: 1)
                        )
                    }

                    if sortedComments.count > visibleCount {
                        Button {
                            visibleCount += 5
                        } label: {
                            Text(OttlineStrings.tr("더 보기", "View More", locale: locale))
                                .font(OttlineFont.semiBold(13))
                                .foregroundStyle(palette.ink)
                                .frame(maxWidth: .infinity, minHeight: 38)
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
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(palette.mutedBg)
            .clipShape(RoundedRectangle(cornerRadius: 10))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)

            // Bottom composer
            VStack(alignment: .leading, spacing: 10) {
                Text(OttlineStrings.tr("의견 남기기", "Leave Opinion", locale: locale))
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.ink)

                TextField(
                    OttlineStrings.tr("이 작품에 대한 한 줄을 남겨주세요.", "Leave a line about this title.", locale: locale),
                    text: $composerBody,
                    axis: .vertical
                )
                .font(OttlineFont.regular(14))
                .lineLimit(3...6)
                .padding(12)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                if showSyncLogCheckbox {
                    OttlineCheckbox(
                        isChecked: $syncLog,
                        label: OttlineStrings.tr("내 타임라인에도 기록 남기기", "Also keep in my timeline", locale: locale)
                    )
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text(OttlineStrings.tr("작품 멘션", "Mention Title", locale: locale))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(palette.ink)

                    Button {
                        mentionSheetPresented = true
                    } label: {
                        HStack {
                            Text(title.type == .book
                                ? OttlineStrings.tr("@로 추가할 책을 검색", "Search book with @", locale: locale)
                                : OttlineStrings.tr("@로 추가할 작품을 검색", "Search title with @", locale: locale))
                                .font(OttlineFont.regular(13.5))
                                .foregroundStyle(palette.subtleInk)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    if !selectedMentions.isEmpty {
                        FlowLayout(horizontalSpacing: 6, verticalSpacing: 6) {
                            ForEach(Array(selectedMentions.enumerated()), id: \.offset) { idx, m in
                                Button {
                                    selectedMentions.remove(at: idx)
                                } label: {
                                    HStack(spacing: 4) {
                                        Text("@\(m.name)")
                                            .font(OttlineFont.medium(12))
                                        OttlineLucideIcon(kind: .x, size: 11, color: palette.primaryAccent, strokeWidth: 2.2)
                                    }
                                    .foregroundStyle(palette.primaryAccent)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 5)
                                    .background(palette.paperStrong)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(palette.border, lineWidth: 1))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if let errorMessage, !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.danger)
                }

                Button {
                    Task { await submitComment() }
                } label: {
                    Text(isPosting
                        ? OttlineStrings.tr("등록 중...", "Posting...", locale: locale)
                        : OttlineStrings.tr("댓글 등록", "Post Comment", locale: locale))
                        .font(OttlineFont.semiBold(14.5))
                        .foregroundStyle(palette.card)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(palette.ink)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(composerBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting)
                .opacity((composerBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isPosting) ? 0.5 : 1)
            }
        }
        .padding(16)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(palette.border, lineWidth: 1)
        )
        .task(id: "\(title.id):\(initialDiscussionId ?? "")") {
            await loadComments()
        }
        .sheet(isPresented: $mentionSheetPresented) {
            NavigationStack {
                VStack(spacing: 12) {
                    HStack(spacing: 8) {
                        ForEach([("all", "전체", "All"), ("movie", "영화", "Movie"), ("series", "시리즈", "Series"), ("book", "책", "Book")], id: \.0) { code, ko, en in
                            let active = mentionTypeFilter == code
                            Button {
                                mentionTypeFilter = code
                                Task { await searchMentions() }
                            } label: {
                                Text(locale == "en" ? en : ko)
                                    .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                                    .foregroundStyle(active ? palette.ink : palette.mutedInk)
                                    .padding(.horizontal, 12)
                                    .frame(minHeight: 34)
                                    .background(active ? palette.paperStrong : palette.card)
                                    .clipShape(Capsule())
                                    .overlay(Capsule().stroke(active ? palette.ink : palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                        Spacer()
                    }

                    HStack(spacing: 8) {
                        TextField(
                            OttlineStrings.tr("작품이나 책 이름 검색", "Search movie, series, or book", locale: locale),
                            text: $mentionQuery
                        )
                        .font(OttlineFont.regular(14))
                        .padding(.horizontal, 12)
                        .frame(height: 44)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        .onSubmit { Task { await searchMentions() } }

                        Button {
                            Task { await searchMentions() }
                        } label: {
                            Text(OttlineStrings.tr("검색", "Search", locale: locale))
                                .font(OttlineFont.semiBold(13.5))
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 14)
                                .frame(height: 44)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }

                    if mentionSearching {
                        ProgressView().padding(.top, 20)
                    } else {
                        List(mentionResults) { item in
                            Button {
                                let candidate = MentionCandidateDto(
                                    provider: item.provider,
                                    providerId: item.providerId,
                                    type: item.type,
                                    name: item.name,
                                    year: item.year,
                                    posterUrl: item.posterUrl,
                                    overview: item.overview
                                )
                                if !selectedMentions.contains(where: { $0.providerId == candidate.providerId && $0.provider == candidate.provider }) {
                                    selectedMentions.append(candidate)
                                }
                                let token = "@\(item.name)"
                                if !composerBody.contains(token) {
                                    composerBody = composerBody.isEmpty ? "\(token) " : "\(composerBody) \(token) "
                                }
                                mentionSheetPresented = false
                            } label: {
                                HStack(spacing: 10) {
                                    PosterImage(
                                        posterUrl: item.posterUrl,
                                        titleName: item.name,
                                        titleType: item.type,
                                        width: 40,
                                        height: 58
                                    )
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(item.name)
                                            .font(OttlineFont.semiBold(14))
                                            .foregroundStyle(palette.ink)
                                        Text([OttlineStrings.titleTypeLabel(item.type, locale: locale), item.year.map(String.init)].compactMap { $0 }.joined(separator: " · "))
                                            .font(OttlineFont.regular(12))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    Spacer()
                                }
                            }
                            .buttonStyle(.plain)
                        }
                        .listStyle(.plain)
                    }
                    Spacer()
                }
                .padding(16)
                .background(palette.background.ignoresSafeArea())
                .navigationTitle(OttlineStrings.tr("작품 언급하기", "Mention a title", locale: locale))
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button(OttlineStrings.tr("닫기", "Close", locale: locale)) {
                            mentionSheetPresented = false
                        }
                    }
                }
            }
        }
    }

    private func loadComments() async {
        isLoading = true
        visibleCount = 5
        defer { isLoading = false }
        do {
            let resolvedId: String? = {
                if let initialDiscussionId, !initialDiscussionId.isEmpty {
                    return initialDiscussionId
                }
                return discussionId
            }()
            if let did = resolvedId {
                discussionId = did
                let list = try await repository.api.getDiscussionComments(discussionId: did, limit: 200)
                comments = list.sorted { RecordDate.parseInstantMillis($0.createdAt) < RecordDate.parseInstantMillis($1.createdAt) }
            } else if let dto = try await repository.api.getDiscussionByTitle(titleId: title.id) {
                discussionId = dto.id
                onDiscussionResolved?(dto.id)
                let list = try await repository.api.getDiscussionComments(discussionId: dto.id, limit: 200)
                comments = list.sorted { RecordDate.parseInstantMillis($0.createdAt) < RecordDate.parseInstantMillis($1.createdAt) }
            } else {
                comments = []
            }
        } catch {
            // Non-blocking
        }
    }

    private func searchMentions() async {
        let q = mentionQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        mentionSearching = true
        defer { mentionSearching = false }
        if let items = try? await repository.api.searchTitles(query: q, typeFilter: mentionTypeFilter == "all" ? nil : mentionTypeFilter) {
            mentionResults = items
        }
    }

    private func submitComment() async {
        let trimmed = composerBody.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isPosting else { return }
        isPosting = true
        errorMessage = nil
        defer { isPosting = false }
        do {
            _ = try await repository.ensureAuthenticated()
            let targetDid: String
            if let existing = discussionId, !existing.isEmpty {
                targetDid = existing
            } else {
                let created = try await repository.api.ensureDiscussion(titleId: title.id)
                discussionId = created.id
                onDiscussionResolved?(created.id)
                targetDid = created.id
            }
            let payload = CreateCommentRequest(
                body: trimmed,
                mentions: selectedMentions.map(\.mentionRef),
                syncLog: showSyncLogCheckbox ? syncLog : false
            )
            let posted = try await repository.api.createDiscussionComment(discussionId: targetDid, payload: payload)
            comments.append(posted)
            visibleCount = max(visibleCount, comments.count)
            composerBody = ""
            selectedMentions = []
            if showSyncLogCheckbox && syncLog {
                if repository.findMatchingLocalTitle(title) == nil {
                    _ = await repository.saveLogForTitle(
                        candidateTitle: title,
                        draft: LogDraft(status: .done, watchedAt: RecordDate.todayIsoDateTime()),
                        source: "discussion_comment"
                    )
                } else {
                    repository.triggerSyncAsync()
                }
            }
        } catch {
            errorMessage = OttlineStrings.tr(
                "이야기를 남기지 못했어요. 잠시 후 다시 시도해 주세요.",
                "Couldn't post your comment. Please try again.",
                locale: locale
            )
        }
    }
}
