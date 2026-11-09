import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public struct ShareCardDialog: View {
    public let log: WatchLog
    public let nickname: String?
    public let personaKey: PersonaKey?
    public var onDismiss: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var ratio: ShareCardRatio = .story9x16
    @State private var includeMoment: Bool = true
    @State private var includeNote: Bool = true
    @State private var includeSignature: Bool = false
    @State private var renderedImage: UIImage?
    @State private var shareFileUrl: URL?
    @State private var loading: Bool = true
    @State private var savedToast: String?

    public init(
        log: WatchLog,
        nickname: String?,
        personaKey: PersonaKey?,
        onDismiss: @escaping () -> Void
    ) {
        self.log = log
        self.nickname = nickname
        self.personaKey = personaKey
        self.onDismiss = onDismiss
    }

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Ratio Selector
                    HStack(spacing: 8) {
                        ratioChip(.story9x16, label: OttlineStrings.tr("스토리 9:16", "Story 9:16", locale: locale))
                        ratioChip(.feed4x5, label: OttlineStrings.tr("피드 4:5", "Feed 4:5", locale: locale))
                    }

                    // Preview
                    ZStack {
                        RoundedRectangle(cornerRadius: 12)
                            .fill(palette.paperStrong)
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                        if loading {
                            ProgressView()
                                .padding(48)
                        } else if let img = renderedImage {
                            Image(uiImage: img)
                                .resizable()
                                .scaledToFit()
                                .frame(maxHeight: 380)
                                .clipShape(RoundedRectangle(cornerRadius: 10))
                                .padding(12)
                        }
                    }
                    .frame(maxWidth: .infinity)

                    // Options
                    VStack(alignment: .leading, spacing: 10) {
                        Toggle(
                            OttlineStrings.tr("그날의 순간(여운·장소) 함께 담기", "Include moment & feeling", locale: locale),
                            isOn: $includeMoment
                        )
                        .font(OttlineFont.medium(14))
                        .tint(palette.brandNavy)

                        if !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) {
                            Toggle(
                                OttlineStrings.tr("남긴 문장 함께 담기", "Include note", locale: locale),
                                isOn: $includeNote
                            )
                            .font(OttlineFont.medium(14))
                            .tint(palette.brandNavy)
                        }

                        if !(nickname?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) {
                            Toggle(
                                OttlineStrings.tr("내 프로필 서명 넣기", "Include my profile signature", locale: locale),
                                isOn: $includeSignature
                            )
                            .font(OttlineFont.medium(14))
                            .tint(palette.brandNavy)
                        }
                    }
                    .padding(14)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10)
                            .stroke(palette.border, lineWidth: 1)
                    )

                    if let savedToast {
                        Text(savedToast)
                            .font(OttlineFont.medium(13))
                            .foregroundStyle(palette.success)
                    }

                    // Actions
                    HStack(spacing: 10) {
                        Button {
                            guard let img = renderedImage else { return }
                            CardExporter.saveImageToPhotos(img)
                            savedToast = OttlineStrings.tr("사진 보관함에 저장했어요.", "Saved to Photos.", locale: locale)
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: "square.and.arrow.down")
                                Text(OttlineStrings.tr("이미지 저장", "Save image", locale: locale))
                                    .font(OttlineFont.semiBold(14))
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

                        if let shareFileUrl {
                            ShareLink(item: shareFileUrl) {
                                HStack(spacing: 6) {
                                    Image(systemName: "square.and.arrow.up")
                                    Text(OttlineStrings.tr("공유하기", "Share", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.onBrandNavy)
                                .frame(maxWidth: .infinity, minHeight: 46)
                                .background(palette.brandNavy)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(18)
            }
            .background(palette.background)
            .navigationTitle(OttlineStrings.tr("공유 카드", "Share Card", locale: locale))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale), action: onDismiss)
                }
            }
            .task(id: "\(ratio.rawValue)-\(includeMoment)-\(includeNote)-\(includeSignature)") {
                loading = true
                let img = await CardExporter.renderShareCardImage(
                    log: log,
                    ratio: ratio,
                    includeMoment: includeMoment,
                    includeNote: includeNote,
                    includeSignature: includeSignature,
                    nickname: nickname,
                    personaKey: personaKey,
                    locale: locale
                )
                renderedImage = img
                shareFileUrl = CardExporter.writeTemporaryPng(img, fileName: "ottline-share-\(log.id).png")
                loading = false
            }
        }
    }

    private func ratioChip(_ target: ShareCardRatio, label: String) -> some View {
        let selected = ratio == target
        return Button {
            ratio = target
        } label: {
            Text(label)
                .font(selected ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                .frame(maxWidth: .infinity, minHeight: 40)
                .background(selected ? palette.brandNavy : palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(selected ? palette.brandNavy : palette.border, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}
