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
        Canvas { context, canvasSize in
            let s = min(canvasSize.width, canvasSize.height) / 100.0
            let strokeWidth = max(2.2, 8.0 * s)

            var bookPath = Path()
            bookPath.move(to: CGPoint(x: 14 * s, y: 34 * s))
            bookPath.addLine(to: CGPoint(x: 14 * s, y: 28 * s))
            bookPath.addCurve(
                to: CGPoint(x: 24 * s, y: 18 * s),
                control1: CGPoint(x: 14 * s, y: 22.477 * s),
                control2: CGPoint(x: 18.477 * s, y: 18 * s)
            )
            bookPath.addCurve(
                to: CGPoint(x: 48 * s, y: 27 * s),
                control1: CGPoint(x: 34 * s, y: 18 * s),
                control2: CGPoint(x: 41.5 * s, y: 21.8 * s)
            )
            bookPath.addCurve(
                to: CGPoint(x: 77 * s, y: 18 * s),
                control1: CGPoint(x: 55.8 * s, y: 21.8 * s),
                control2: CGPoint(x: 65.5 * s, y: 18 * s)
            )
            bookPath.addCurve(
                to: CGPoint(x: 87 * s, y: 28 * s),
                control1: CGPoint(x: 82.523 * s, y: 18 * s),
                control2: CGPoint(x: 87 * s, y: 22.477 * s)
            )
            bookPath.addLine(to: CGPoint(x: 87 * s, y: 64 * s))
            bookPath.addCurve(
                to: CGPoint(x: 77 * s, y: 74 * s),
                control1: CGPoint(x: 87 * s, y: 69.523 * s),
                control2: CGPoint(x: 82.523 * s, y: 74 * s)
            )
            bookPath.addCurve(
                to: CGPoint(x: 51.5 * s, y: 81 * s),
                control1: CGPoint(x: 66.5 * s, y: 74 * s),
                control2: CGPoint(x: 57.2 * s, y: 76.9 * s)
            )

            var playPath = Path()
            playPath.move(to: CGPoint(x: 15 * s, y: 49 * s))
            playPath.addLine(to: CGPoint(x: 36.5 * s, y: 62.75 * s))
            playPath.addLine(to: CGPoint(x: 15 * s, y: 76.5 * s))
            playPath.closeSubpath()

            let style = StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round)
            let trimmedBook = bookPath.trimmedPath(from: 0, to: min(1.0, progress * 1.15))
            context.stroke(trimmedBook, with: .color(resolvedColor), style: style)

            if progress > 0.35 {
                let playProgress = min(1.0, (progress - 0.35) / 0.65)
                let trimmedPlay = playPath.trimmedPath(from: 0, to: playProgress)
                context.stroke(trimmedPlay, with: .color(resolvedColor), style: style)
            }
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

// MARK: - 2. Animated Intro Splash Overlay

public struct OttlineIntroSplashOverlay: View {
    public var onFinished: () -> Void
    @Environment(\.ottlinePalette) private var palette
    @State private var strokeProgress: CGFloat = 0.0
    @State private var textOpacity: Double = 0.0
    @State private var containerOpacity: Double = 1.0

    public init(onFinished: @escaping () -> Void) {
        self.onFinished = onFinished
    }

    public var body: some View {
        ZStack {
            palette.background.ignoresSafeArea()
            VStack(spacing: 14) {
                OttlineBrandMark(size: 72, progress: strokeProgress)
                VStack(spacing: 3) {
                    Text("ottline")
                        .font(OttlineFont.extraBold(28))
                        .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                        .kerning(-0.8)
                    Text("ON THE TIMELINE")
                        .font(OttlineFont.bold(10.5))
                        .foregroundStyle(palette.brandOrange)
                        .kerning(1.2)
                }
                .opacity(textOpacity)
            }
        }
        .opacity(containerOpacity)
        .task {
            withAnimation(.easeInOut(duration: 0.45)) {
                strokeProgress = 1.0
            }
            try? await Task.sleep(nanoseconds: 180_000_000)
            withAnimation(.easeOut(duration: 0.25)) {
                textOpacity = 1.0
            }
            try? await Task.sleep(nanoseconds: 380_000_000)
            withAnimation(.easeOut(duration: 0.22)) {
                containerOpacity = 0.0
            }
            try? await Task.sleep(nanoseconds: 220_000_000)
            onFinished()
        }
    }
}

// MARK: - 3. Top Header Bar (`DESIGN.md` Wordmark Lockup)

public struct OttlineTopBar: View {
    public var nickname: String?
    public var personaKey: PersonaKey?
    public var onLogoTap: () -> Void
    public var onQuickRecordTap: () -> Void
    public var onProfileTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Button(action: onLogoTap) {
                    HStack(spacing: 9) {
                        OttlineBrandMark(size: 28)
                        VStack(alignment: .leading, spacing: 0) {
                            Text("ottline")
                                .font(OttlineFont.extraBold(20))
                                .kerning(-0.6)
                                .foregroundStyle(palette.isDark ? palette.ink : palette.brandNavy)
                            Text("ON THE TIMELINE")
                                .font(OttlineFont.bold(8.5))
                                .kerning(0.7)
                                .foregroundStyle(palette.brandOrange)
                        }
                    }
                }
                .buttonStyle(.plain)

                Spacer()

                Button(action: onQuickRecordTap) {
                    HStack(spacing: 4) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                        Text(OttlineStrings.tr("기록 남기기", "Keep a story", locale: locale))
                            .font(OttlineFont.semiBold(12.5))
                    }
                    .foregroundStyle(palette.primaryAccent)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(palette.border, lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)

                Button(action: onProfileTap) {
                    PersonaAvatar(personaKey: personaKey, size: 32)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(palette.background.opacity(0.96))

            Rectangle()
                .fill(palette.border)
                .frame(height: 1)
        }
    }
}

// MARK: - 4. Bottom Navigation Bar (`DESIGN.md` 5-item bar with center `#FF9933` `+` CTA & 15×2pt top marker)

public struct OttlineBottomBar: View {
    public var activeTab: TopLevelTab
    public var onSelectTab: (TopLevelTab) -> Void
    public var onQuickRecordTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(palette.border)
                .frame(height: 1)

            HStack(spacing: 0) {
                navTabButton(
                    tab: .home,
                    label: OttlineStrings.tr("홈", "Home", locale: locale),
                    systemImage: activeTab == .home ? "house.fill" : "house"
                )
                navTabButton(
                    tab: .timeline,
                    label: OttlineStrings.tr("타임라인", "Timeline", locale: locale),
                    systemImage: activeTab == .timeline ? "clock.fill" : "clock"
                )

                // Center Quick Record CTA (`#FF9933` with `#0F0F0F` icon)
                Button(action: onQuickRecordTap) {
                    VStack(spacing: 3) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(palette.brandOrange)
                                .frame(width: 42, height: 32)
                            Image(systemName: "plus")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(palette.onBrandOrange)
                        }
                        Text(OttlineStrings.tr("기록", "Record", locale: locale))
                            .font(OttlineFont.semiBold(10.5))
                            .foregroundStyle(palette.ink)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("빠른 기록 열기", "Open Quick Record", locale: locale))

                navTabButton(
                    tab: .together,
                    label: OttlineStrings.tr("함께", "Together", locale: locale),
                    systemImage: activeTab == .together ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right"
                )
                navTabButton(
                    tab: .mySpace,
                    label: OttlineStrings.tr("내 공간", "My Space", locale: locale),
                    systemImage: activeTab == .mySpace ? "person.fill" : "person"
                )
            }
            .padding(.horizontal, 6)
            .padding(.bottom, 2)
            .background(palette.background.opacity(0.97))
        }
    }

    private func navTabButton(tab: TopLevelTab, label: String, systemImage: String) -> some View {
        let selected = activeTab == tab
        return Button {
            onSelectTab(tab)
        } label: {
            VStack(spacing: 4) {
                Capsule()
                    .fill(selected ? palette.brandOrange : Color.clear)
                    .frame(width: 15, height: 2)
                    .padding(.top, 4)

                Image(systemName: systemImage)
                    .font(.system(size: 18, weight: selected ? .semibold : .regular))
                    .foregroundStyle(selected ? palette.ink : palette.mutedInk)
                    .frame(height: 20)

                Text(label)
                    .font(selected ? OttlineFont.semiBold(11) : OttlineFont.medium(11))
                    .foregroundStyle(selected ? palette.ink : palette.mutedInk)
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 5. Persona Avatar & Poster Image

public struct PersonaAvatar: View {
    public var personaKey: PersonaKey?
    public var size: CGFloat = 40
    @Environment(\.ottlinePalette) private var palette

    public init(personaKey: PersonaKey?, size: CGFloat = 40) {
        self.personaKey = personaKey
        self.size = size
    }

    public var body: some View {
        let preset = OttlineStrings.personaPreset(personaKey)
        Image(preset.assetName)
            .resizable()
            .scaledToFill()
            .frame(width: size, height: size)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: max(8, size * 0.25)))
            .overlay(
                RoundedRectangle(cornerRadius: max(8, size * 0.25))
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

// MARK: - 6. Feeling Icon & Badge (`RecordFeelings.tsx` parity)

public struct FeelingIcon: View {
    public var value: Int // 1, 2, 3
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
            let stroke = StrokeStyle(lineWidth: max(1.5, w * 0.1), lineCap: .round, lineJoin: .round)

            if isBook {
                // Book page bars (1, 2, or 3 horizontal lines inside an open bookmark/page)
                var frame = Path()
                frame.addRoundedRect(
                    in: CGRect(x: w * 0.18, y: h * 0.14, width: w * 0.64, height: h * 0.72),
                    cornerSize: CGSize(width: w * 0.12, height: w * 0.12)
                )
                context.stroke(frame, with: .color(tint), style: stroke)

                let count = min(max(value, 1), 3)
                for i in 0..<count {
                    let y = h * (0.34 + CGFloat(i) * 0.16)
                    var line = Path()
                    line.move(to: CGPoint(x: w * 0.32, y: y))
                    line.addLine(to: CGPoint(x: w * 0.68, y: y))
                    context.stroke(line, with: .color(tint), style: stroke)
                }
            } else {
                // Concentric / warm wave rings (1, 2, or 3 dots/rings)
                let count = min(max(value, 1), 3)
                let spacing = w / CGFloat(count + 1)
                for i in 1...count {
                    let cx = spacing * CGFloat(i)
                    let cy = h * 0.5
                    let r = w * 0.11
                    let rect = CGRect(x: cx - r, y: cy - r, width: r * 2, height: r * 2)
                    context.fill(Path(ellipseIn: rect), with: .color(tint))
                }
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
            HStack(spacing: 5) {
                FeelingIcon(
                    value: feeling.value,
                    isBook: isBook,
                    size: compact ? 13 : 15,
                    tint: palette.primaryAccent
                )
                Text(compact ? feeling.shortLabel : feeling.label)
                    .font(OttlineFont.medium(compact ? 11.5 : 12.5))
                    .foregroundStyle(palette.ink)
            }
            .padding(.horizontal, compact ? 8 : 10)
            .padding(.vertical, compact ? 4 : 5)
            .background(palette.paperStrong)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
    }
}

// MARK: - 7. Sync Notice Banner

public struct SyncNoticeBanner: View {
    public var syncState: SyncState
    public var outboxCount: Int
    public var onRetryTap: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        let isFailed = syncState.status == .failed
        let bg = isFailed ? palette.dangerSoft : palette.paperStrong
        let border = isFailed ? palette.danger.opacity(0.4) : palette.border

        HStack(spacing: 10) {
            if syncState.status == .syncing {
                ProgressView()
                    .controlSize(.small)
            } else {
                Image(systemName: isFailed ? "exclamationmark.circle" : "icloud.and.arrow.up")
                    .foregroundStyle(isFailed ? palette.danger : palette.primaryAccent)
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(bannerTitle)
                    .font(OttlineFont.semiBold(13))
                    .foregroundStyle(palette.ink)
                if let sub = bannerSubtitle {
                    Text(sub)
                        .font(OttlineFont.regular(11.5))
                        .foregroundStyle(palette.mutedInk)
                }
            }

            Spacer()

            if syncState.status != .syncing {
                Button(action: onRetryTap) {
                    Text(OttlineStrings.tr("지금 맞추기", "Sync now", locale: locale))
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.primaryAccent)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
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
        .padding(12)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(border, lineWidth: 1)
        )
    }

    private var bannerTitle: String {
        switch syncState.status {
        case .syncing:
            return OttlineStrings.tr("기록을 서버와 맞추고 있어요...", "Syncing your timeline...", locale: locale)
        case .failed:
            return OttlineStrings.tr(
                "이 기기에 안전하게 보관 중이에요 (\(outboxCount)건 대기)",
                "Saved safely on this device (\(outboxCount) pending)",
                locale: locale
            )
        case .idle:
            return OttlineStrings.tr(
                "연결이 돌아오면 자동으로 맞춰둘게요 (\(outboxCount)건)",
                "Will sync automatically when online (\(outboxCount))",
                locale: locale
            )
        }
    }

    private var bannerSubtitle: String? {
        if syncState.status == .failed {
            return OttlineStrings.tr(
                "네트워크 연결이 불안정해도 남긴 기록은 사라지지 않아요.",
                "Your records are kept locally even offline.",
                locale: locale
            )
        }
        return nil
    }
}
