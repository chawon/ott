import SwiftUI
import OttlineCore
#if canImport(UIKit)
import UIKit
#endif

public struct ShareCardDialog: View {
    public let log: WatchLog
    @ObservedObject public var repository: OttlineRepository
    public var onDismiss: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.ottlineViewportWidth) private var viewportWidth

    @State private var ratio: ShareCardRatio = .story9x16
    @State private var showRatingLabel: Bool = true
    @State private var showNote: Bool
    @State private var showProfileSignature: Bool = false
    @State private var renderedImage: UIImage?
    @State private var loading: Bool = true
    @State private var savedToast: String?

    public init(
        log: WatchLog,
        repository: OttlineRepository,
        onDismiss: (() -> Void)? = nil
    ) {
        self.log = log
        self._repository = ObservedObject(wrappedValue: repository)
        self.onDismiss = onDismiss
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)
        self._showNote = State(initialValue: hasNote)
    }

    public var body: some View {
        let snap = repository.prefs.snapshot
        let profileComplete = snap.isProfileComplete
        let nickname = snap.nickname
        let personaKey = snap.personaKey
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true)

        let effectiveWidth = viewportWidth > 0 ? viewportWidth : 390
        let previewWidth: CGFloat = effectiveWidth >= 700
            ? 260
            : min(240, max(196, effectiveWidth - 110))
        let previewHeight: CGFloat = ratio == .feed4x5
            ? (previewWidth * 5.0 / 4.0)
            : (previewWidth * 16.0 / 9.0)
        let sizeSpecLabel = ratio == .feed4x5 ? "1080×1350 (Feed)" : "1080×1920 (Story)"

        VStack(spacing: 0) {
            // 0. Compact Pinned Top Header (Title + Close on the same top bar)
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr("저장한 기록을 공유 카드로 나눠보세요.", "Share your saved record as a card.", locale: locale))
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                }

                Spacer(minLength: 8)

                Button {
                    if let onDismiss {
                        onDismiss()
                    } else {
                        dismiss()
                    }
                } label: {
                    OttlineLucideIcon(kind: .x, size: 18, color: palette.ink, strokeWidth: 2.0)
                        .frame(width: 36, height: 36)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("닫기", "Close", locale: locale))
            }
            .padding(.horizontal, 20)
            .padding(.top, 16)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) {
                Rectangle().fill(palette.border).frame(height: 1)
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    // 1. Preview Container (`aspect-[9/16]` or `aspect-[4/5]`)
                    ZStack {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(palette.mutedBg.opacity(0.6))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                        ZStack(alignment: .topTrailing) {
                            if let img = renderedImage {
                                Image(uiImage: img)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: previewWidth, height: previewHeight)
                                    .clipped()
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .shadow(color: Color.black.opacity(0.08), radius: 6, y: 2)
                            } else {
                                previewSkeleton
                                    .frame(width: previewWidth, height: previewHeight)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            if loading && renderedImage != nil {
                                ProgressView()
                                    .padding(8)
                                    .background(palette.card.opacity(0.85))
                                    .clipShape(Circle())
                                    .padding(10)
                            }
                        }
                        .padding(10)
                    }
                    .frame(maxWidth: .infinity)

                    // 2. Compact Single-Line Option Checkboxes (aggressively fits 1 row; wraps only if truly overflowed)
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 10) {
                            optionToggles(hasNote: hasNote, profileComplete: profileComplete, fontSize: 12.5, singleLine: true)
                        }

                        HStack(spacing: 6) {
                            optionToggles(hasNote: hasNote, profileComplete: profileComplete, fontSize: 11.5, singleLine: true)
                        }

                        FlowLayout(horizontalSpacing: 12, verticalSpacing: 4) {
                            optionToggles(hasNote: hasNote, profileComplete: profileComplete, fontSize: 12.5, singleLine: false)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    // 3. Ratio Segmented Control (`이미지 비율` + `스토리 9:16` / `피드 4:5`)
                    HStack(spacing: 10) {
                        Text(OttlineStrings.tr("이미지 비율", "Image ratio", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)

                        HStack(spacing: 4) {
                            ratioChip(.story9x16, label: OttlineStrings.tr("스토리 9:16", "Story 9:16", locale: locale))
                            ratioChip(.feed4x5, label: OttlineStrings.tr("피드 4:5", "Feed 4:5", locale: locale))
                        }
                        .padding(3)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }

                    if let savedToast {
                        Text(savedToast)
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(palette.success)
                    }

                    // 4. Stacked Full-Width Actions (`ShareBottomSheet.tsx`: Save image + Share)
                    VStack(alignment: .leading, spacing: 8) {
                        Button {
                            guard let img = renderedImage else { return }
                            CardExporter.saveImageToPhotos(img)
                            savedToast = OttlineStrings.tr("사진 보관함에 저장했어요.", "Saved to Photos.", locale: locale)
                        } label: {
                            HStack(spacing: 8) {
                                OttlineLucideIcon(kind: .download, size: 16, color: palette.ink, strokeWidth: 2.0)
                                Text(OttlineStrings.tr("이미지 저장", "Save image", locale: locale))
                                    .font(OttlineFont.medium(15))
                            }
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(renderedImage == nil)
                        .opacity(renderedImage == nil ? 0.5 : 1)

                        Button {
                            guard let img = renderedImage else { return }
                            CardExporter.presentImageShareSheet(img, title: "ottline · \(log.title.name)")
                        } label: {
                            HStack(spacing: 8) {
                                if renderedImage != nil {
                                    OttlineLucideIcon(kind: .share2, size: 16, color: palette.onBrandOrange, strokeWidth: 2.0)
                                    Text(OttlineStrings.tr("공유하기", "Share", locale: locale))
                                        .font(OttlineFont.semiBold(15))
                                } else {
                                    ProgressView()
                                        .tint(palette.onBrandOrange)
                                        .scaleEffect(0.85)
                                    Text(OttlineStrings.tr("준비 중…", "Preparing…", locale: locale))
                                        .font(OttlineFont.semiBold(15))
                                }
                            }
                            .foregroundStyle(palette.onBrandOrange)
                            .frame(maxWidth: .infinity, minHeight: 46)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .disabled(renderedImage == nil)
                        .opacity(renderedImage == nil ? 0.5 : 1)

                        Text(OttlineStrings.tr(
                            "이미지 크기: \(sizeSpecLabel)",
                            "Image size: \(sizeSpecLabel)",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(11.5))
                        .foregroundStyle(palette.mutedInk)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 20)
            }
        }
        .background(palette.card)
        .onChange(of: profileComplete) { isComplete in
            if !isComplete {
                showProfileSignature = false
            }
        }
        .task(id: "\(ratio.rawValue)-\(showRatingLabel)-\(showNote)-\(showProfileSignature)") {
            loading = true
            let img = await renderCard(
                nickname: nickname,
                personaKey: personaKey,
                hasNote: hasNote,
                profileComplete: profileComplete
            )
            renderedImage = img
            loading = false
        }
    }

    @ViewBuilder
    private func optionToggles(hasNote: Bool, profileComplete: Bool, fontSize: CGFloat, singleLine: Bool) -> some View {
        shareOptionToggle(
            isChecked: $showRatingLabel,
            label: OttlineStrings.tr("느낌 포함", "Feeling", locale: locale),
            fontSize: fontSize,
            singleLine: singleLine
        )

        shareOptionToggle(
            isChecked: $showNote,
            label: OttlineStrings.tr("한 줄 메모 포함", "Note", locale: locale),
            isDisabled: !hasNote,
            fontSize: fontSize,
            singleLine: singleLine
        )

        if profileComplete {
            shareOptionToggle(
                isChecked: $showProfileSignature,
                label: OttlineStrings.tr("아바타·닉네임 포함", "Avatar & name", locale: locale),
                fontSize: fontSize,
                singleLine: singleLine
            )
        }
    }

    private func shareOptionToggle(
        isChecked: Binding<Bool>,
        label: String,
        isDisabled: Bool = false,
        fontSize: CGFloat,
        singleLine: Bool
    ) -> some View {
        Button {
            isChecked.wrappedValue.toggle()
        } label: {
            HStack(alignment: .center, spacing: 5) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(isChecked.wrappedValue ? palette.brandOrange : palette.card)
                        .frame(width: 17, height: 17)
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(isChecked.wrappedValue ? palette.brandOrange : palette.border, lineWidth: 1.5)
                        .frame(width: 17, height: 17)
                    if isChecked.wrappedValue {
                        OttlineLucideIcon(kind: .check, size: 11, color: palette.onBrandOrange, strokeWidth: 2.5)
                    }
                }

                Text(label)
                    .font(OttlineFont.medium(fontSize))
                    .foregroundStyle(palette.ink)
                    .lineLimit(1)
                    .fixedSize(horizontal: singleLine, vertical: false)
            }
            .frame(minHeight: 34)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.45 : 1)
    }

    private var previewSkeleton: some View {
        VStack(alignment: .leading) {
            RoundedRectangle(cornerRadius: 8)
                .fill(palette.background.opacity(0.75))
                .frame(width: 64, height: 96)

            Spacer()

            VStack(alignment: .leading, spacing: 10) {
                RoundedRectangle(cornerRadius: 6)
                    .fill(palette.background.opacity(0.85))
                    .frame(height: 16)
                    .frame(maxWidth: 190)
                RoundedRectangle(cornerRadius: 6)
                    .fill(palette.background.opacity(0.75))
                    .frame(height: 12)
                    .frame(maxWidth: 130)
                RoundedRectangle(cornerRadius: 6)
                    .fill(palette.background.opacity(0.65))
                    .frame(height: 12)
                    .frame(maxWidth: 210)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        ProgressView()
                            .scaleEffect(0.8)
                        Text(OttlineStrings.tr("공유 카드 만드는 중", "Creating your share card", locale: locale))
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.ink)
                    }
                    Text(OttlineStrings.tr("공유 카드 미리보기를 만들고 있어요.", "Creating your share card preview.", locale: locale))
                        .font(OttlineFont.regular(11))
                        .foregroundStyle(palette.mutedInk)
                        .lineSpacing(3)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.background.opacity(0.9))
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            LinearGradient(
                colors: [palette.background, palette.mutedBg.opacity(0.85), palette.card],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private func ratioChip(_ target: ShareCardRatio, label: String) -> some View {
        let selected = ratio == target
        return Button {
            ratio = target
        } label: {
            Text(label)
                .font(selected ? OttlineFont.medium(13) : OttlineFont.regular(13))
                .foregroundStyle(selected ? palette.ink : palette.mutedInk)
                .padding(.horizontal, 12)
                .frame(minHeight: 36)
                .background(selected ? palette.paperStrong : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(selected ? palette.border : Color.clear, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }

    private func renderCard(
        nickname: String?,
        personaKey: PersonaKey?,
        hasNote: Bool,
        profileComplete: Bool
    ) async -> UIImage {
        let trimmedNick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
        let includeSignature = profileComplete && showProfileSignature && (trimmedNick?.isEmpty == false) && personaKey != nil

        // Render locally on-device (matching Android native) using cached poster art so preview & toggles finish in <150ms.
        return await CardExporter.renderShareCardImage(
            log: log,
            ratio: ratio,
            showRatingLabel: showRatingLabel,
            includeNote: showNote && hasNote,
            includeSignature: includeSignature,
            nickname: trimmedNick,
            personaKey: personaKey,
            locale: locale
        )
    }
}
