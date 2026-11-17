import SwiftUI
import OttlineCore
#if canImport(UIKit)
import UIKit
#endif

public struct ShareCardDialog: View {
    public let log: WatchLog
    public let repository: OttlineRepository
    public var onDismiss: (() -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

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
        self.repository = repository
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

        let previewWidth: CGFloat = min(280, max(220, UIScreen.main.bounds.width - 72))
        let previewHeight: CGFloat = ratio == .feed4x5
            ? (previewWidth * 5.0 / 4.0)
            : (previewWidth * 16.0 / 9.0)
        let sizeSpecLabel = ratio == .feed4x5 ? "1080×1350 (Feed)" : "1080×1920 (Story)"

        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    // 0. Header matching ShareBottomSheet.tsx
                    VStack(alignment: .leading, spacing: 4) {
                        Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                            .font(OttlineFont.semiBold(20))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr("저장한 기록을 공유 카드로 나눠보세요.", "Share your saved record as a card.", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }

                    // 1. Large 280pt Preview Container (`aspect-[9/16]` or `aspect-[4/5]`)
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
                        .padding(16)
                    }
                    .frame(maxWidth: .infinity)

                    // 2. Option Checkboxes (`ShareBottomSheet.tsx` exact options & order)
                    FlowLayout(horizontalSpacing: 16, verticalSpacing: 4) {
                        OttlineCheckbox(
                            isChecked: $showRatingLabel,
                            label: OttlineStrings.tr("느낌 포함", "Include feeling", locale: locale)
                        )

                        OttlineCheckbox(
                            isChecked: $showNote,
                            label: OttlineStrings.tr("한 줄 메모 포함", "Include note", locale: locale),
                            isDisabled: !hasNote
                        )

                        if profileComplete {
                            OttlineCheckbox(
                                isChecked: $showProfileSignature,
                                label: OttlineStrings.tr("아바타와 닉네임 포함", "Include avatar and nickname", locale: locale)
                            )
                        }
                    }

                    // 3. Ratio Segmented Control (`이미지 비율` + `스토리 9:16` / `피드 4:5`)
                    HStack(spacing: 12) {
                        Text(OttlineStrings.tr("이미지 비율", "Image ratio", locale: locale))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)

                        HStack(spacing: 6) {
                            ratioChip(.story9x16, label: OttlineStrings.tr("스토리 9:16", "Story 9:16", locale: locale))
                            ratioChip(.feed4x5, label: OttlineStrings.tr("피드 4:5", "Feed 4:5", locale: locale))
                        }
                        .padding(4)
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
                    VStack(alignment: .leading, spacing: 10) {
                        Button {
                            guard let img = renderedImage else { return }
                            CardExporter.saveImageToPhotos(img)
                            savedToast = OttlineStrings.tr("사진 보관함에 저장했어요.", "Saved to Photos.", locale: locale)
                        } label: {
                            HStack(spacing: 8) {
                                OttlineLucideIcon(kind: .download, size: 16, color: palette.ink, strokeWidth: 2.0)
                                Text(OttlineStrings.tr("이미지 저장", "Save image", locale: locale))
                                    .font(OttlineFont.medium(15.5))
                            }
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 48)
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
                                        .font(OttlineFont.semiBold(15.5))
                                } else {
                                    ProgressView()
                                        .tint(palette.onBrandOrange)
                                        .scaleEffect(0.85)
                                    Text(OttlineStrings.tr("준비 중…", "Preparing…", locale: locale))
                                        .font(OttlineFont.semiBold(15.5))
                                }
                            }
                            .foregroundStyle(palette.onBrandOrange)
                            .frame(maxWidth: .infinity, minHeight: 48)
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
                .padding(.bottom, 24)
            }
            .background(palette.card)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        if let onDismiss {
                            onDismiss()
                        } else {
                            dismiss()
                        }
                    } label: {
                        OttlineLucideIcon(kind: .x, size: 18, color: palette.ink, strokeWidth: 2.0)
                    }
                }
            }
            .onChange(of: profileComplete) { _, isComplete in
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
                .font(selected ? OttlineFont.medium(13.5) : OttlineFont.regular(13.5))
                .foregroundStyle(selected ? palette.ink : palette.mutedInk)
                .padding(.horizontal, 14)
                .frame(minHeight: 40)
                .background(selected ? palette.paperStrong : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selected ? palette.border : Color.clear, lineWidth: 1)
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
        let isBook = log.title.type == .book
        let feeling = showRatingLabel
            ? RecordFeelings.resolveFeeling(rating: log.rating, isBook: isBook, locale: locale)
            : nil
        let ratingValueInt: Int? = feeling.map {
            switch $0.value {
            case 3: return 5
            case 2: return 3
            default: return 1
            }
        }
        let trimmedNote = log.note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let effectiveNote = (showNote && hasNote) ? trimmedNote : nil
        let trimmedNick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
        let includeSignature = profileComplete && showProfileSignature && (trimmedNick?.isEmpty == false) && personaKey != nil
        let avatarUrl = includeSignature ? personaKey.map { "/avatars/storybook/\($0.rawValue).webp" } : nil
        let formattedDate = RecordDate.formatDotDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt)

        let payload = LogShareCardRequestPayload(
            title: log.title.name,
            titleType: log.title.type.rawValue,
            format: ratio == .feed4x5 ? "feed" : "story",
            note: effectiveNote,
            statusLabel: OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale),
            ratingLabel: feeling?.label,
            ratingValue: ratingValueInt,
            date: formattedDate,
            posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
            showProfileSignature: includeSignature,
            profileNickname: includeSignature ? trimmedNick : nil,
            profileAvatarUrl: avatarUrl,
            profilePersonaKey: includeSignature ? personaKey?.rawValue : nil
        )

        if let data = try? await repository.api.renderServerShareCard(payload),
           let serverImage = UIImage(data: data) {
            return serverImage
        }

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
