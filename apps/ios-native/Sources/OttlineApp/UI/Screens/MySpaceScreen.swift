import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

public struct MySpaceScreen: View {
    public let repository: OttlineRepository
    public var autoExpandPairing: Bool = false
    public var onConsumeAutoExpandPairing: () -> Void
    public var onOpenReport: () -> Void
    public var onOpenBookshelf: () -> Void
    public var onOpenFeedback: () -> Void
    public var onOpenGuides: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var profileExpanded: Bool = false
    @State private var editNickname: String = ""
    @State private var editPersonaKey: PersonaKey = .cinemaKeeper
    @State private var savingProfile: Bool = false

    @State private var copiedCode: Bool = false
    @State private var inputPairingCode: String = ""
    @State private var showPairConfirmAlert: Bool = false
    @State private var pairingBusy: Bool = false
    @State private var lostCodeExpanded: Bool = false
    @State private var accountInfoExpanded: Bool = false
    @State private var dataManageExpanded: Bool = false
    @State private var exportRange: String = "all" // "all" | "video" | "book"
    @State private var devices: [DeviceItem] = []
    @State private var toastMessage: String?

    @State private var showLocalResetAlert: Bool = false
    @State private var showServerDeleteSheet: Bool = false
    @State private var deleteConfirmInput: String = ""
    @State private var deletingAccount: Bool = false

    #if DEBUG
    @State private var customServerUrl: String = ""
    #endif

    public var body: some View {
        let snap = repository.prefs.snapshot
        let nickname = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let personaTitle: String? = snap.personaKey.map { OttlineStrings.personaPreset($0).title(locale) }
        let exportLogs = repository.logs.filter { log in
            if exportRange == "video" { return log.title.type != .book }
            if exportRange == "book" { return log.title.type == .book }
            return true
        }

        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // 1. Header (`app/[locale]/account/page.tsx` `.header` 1:1 parity)
                VStack(alignment: .leading, spacing: 6) {
                    Text(OttlineStrings.tr("나의 공간", "MY SPACE", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.88)
                        .foregroundStyle(palette.mutedInk)

                    Text(OttlineStrings.tr("어디서든, 나의 기록", "Your records, wherever you are", locale: locale))
                        .font(OttlineFont.semiBold(25))
                        .kerning(-0.7)
                        .foregroundStyle(palette.ink)

                    Text(OttlineStrings.tr(
                        "계정을 외우는 대신, 내 기록을 이어가는 방법.",
                        "A simple way to carry your records with you.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.mutedInk)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.bottom, 16)
                .overlay(alignment: .bottom) {
                    Rectangle().fill(palette.border).frame(height: 1)
                }

                if let toastMessage {
                    Text(toastMessage)
                        .font(OttlineFont.medium(13.5))
                        .foregroundStyle(palette.primaryAccent)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                }

                // 2. My Profile Panel (`나의 프로필` / `My profile`)
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center, spacing: 16) {
                        PersonaAvatar(personaKey: snap.personaKey, size: 76, circular: true)

                        VStack(alignment: .leading, spacing: 4) {
                            Text(OttlineStrings.tr("나의 프로필", "MY PROFILE", locale: locale))
                                .font(OttlineFont.medium(11))
                                .kerning(0.7)
                                .foregroundStyle(palette.mutedInk)

                            Text(!nickname.isEmpty
                                ? nickname
                                : OttlineStrings.tr("나의 타임라인에, 나다운 모습", "A familiar face for your timeline", locale: locale)
                            )
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)

                            Text(personaTitle
                                ?? OttlineStrings.tr("닉네임과 아바타로 내 공간을 꾸며보세요.", "Make this space yours with a nickname and avatar.", locale: locale)
                            )
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)

                            Text(OttlineStrings.tr(
                                "닉네임과 아바타는 내 화면에서만 보여요.",
                                "Your nickname and avatar only appear on your screens.",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                        }
                        Spacer(minLength: 0)
                    }

                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            profileExpanded.toggle()
                        }
                    } label: {
                        Text(OttlineStrings.tr("내 모습 고르기", "Choose my look", locale: locale))
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 42)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    if profileExpanded {
                        Rectangle().fill(palette.border).frame(height: 1)

                        VStack(alignment: .leading, spacing: 6) {
                            Text(OttlineStrings.tr("닉네임", "Nickname", locale: locale))
                                .font(OttlineFont.medium(12.5))
                                .foregroundStyle(palette.mutedInk)

                            TextField(
                                OttlineStrings.tr("예: 기록하는 밤", "Example: Night logger", locale: locale),
                                text: $editNickname
                            )
                            .font(OttlineFont.regular(14.5))
                            .padding(11)
                            .background(palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }

                        Text(OttlineStrings.tr("나와 닮은 아바타", "An avatar that feels like you", locale: locale))
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.mutedInk)

                        LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                            ForEach(OttlineStrings.personaPresets, id: \.key) { preset in
                                let selected = editPersonaKey == preset.key
                                Button {
                                    editPersonaKey = preset.key
                                } label: {
                                    HStack(spacing: 10) {
                                        PersonaAvatar(personaKey: preset.key, size: 40, circular: true)
                                        Text(preset.title(locale))
                                            .font(selected ? OttlineFont.semiBold(13) : OttlineFont.medium(13))
                                            .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                        Spacer(minLength: 0)
                                    }
                                    .padding(10)
                                    .background(selected ? palette.paperStrong : palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        HStack(spacing: 8) {
                            Button {
                                Task { await saveProfile() }
                            } label: {
                                Text(savingProfile
                                    ? OttlineStrings.tr("저장 중…", "Saving…", locale: locale)
                                    : OttlineStrings.tr("이 모습으로 저장", "Keep this profile", locale: locale)
                                )
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 18)
                                .frame(minHeight: 44)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(savingProfile)

                            Button {
                                profileExpanded = false
                            } label: {
                                Text(OttlineStrings.tr("나중에", "Later", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 44)
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
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 3. Keep Your Records With You (`내 기록 이어보기` / `Keep your records with you` — Always visible like Web)
                VStack(alignment: .leading, spacing: 14) {
                    HStack(spacing: 8) {
                        Image(systemName: "link")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(palette.primaryAccent)
                        Text(OttlineStrings.tr("내 기록 이어보기", "Keep your records with you", locale: locale))
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)
                    }

                    if let code = snap.pairingCode, !code.isEmpty {
                        Text(OttlineStrings.tr(
                            "다른 기기의 내 공간에서 이 코드를 입력하면 같은 기록을 열 수 있어요.",
                            "Enter this code in My Space on another device to open the same records.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)

                        Text(code)
                            .font(.system(size: 22, weight: .semibold, design: .monospaced))
                            .kerning(1.5)
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                        Text(OttlineStrings.tr(
                            "이 코드를 아는 사람은 내 기록을 열 수 있어요. 나만 볼 수 있는 곳에 보관해 주세요.",
                            "Anyone with this code can open your records. Keep it somewhere private.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)

                        HStack(spacing: 8) {
                            Button {
                                #if canImport(UIKit)
                                UIPasteboard.general.string = code
                                #endif
                                copiedCode = true
                                toastMessage = OttlineStrings.tr("연결 코드를 복사했어요.", "Copied connection code.", locale: locale)
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: copiedCode ? "checkmark" : "doc.on.doc")
                                        .font(.system(size: 13.5, weight: .semibold))
                                    Text(copiedCode
                                        ? OttlineStrings.tr("복사됨", "Copied", locale: locale)
                                        : OttlineStrings.tr("코드 복사", "Copy code", locale: locale)
                                    )
                                    .font(OttlineFont.semiBold(13.5))
                                }
                                .foregroundStyle(palette.ink)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 42)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)

                            Button {
                                #if canImport(UIKit)
                                let img = CardExporter.renderRecoveryCardImage(
                                    pairingCode: code,
                                    nickname: snap.nickname,
                                    locale: locale
                                )
                                CardExporter.saveImageToPhotos(img)
                                toastMessage = OttlineStrings.tr("보관 카드를 저장했어요.", "Recovery card saved.", locale: locale)
                                #endif
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.down.to.line")
                                        .font(.system(size: 13.5, weight: .semibold))
                                    Text(OttlineStrings.tr("보관 카드 저장", "Save recovery card", locale: locale))
                                        .font(OttlineFont.semiBold(13.5))
                                }
                                .foregroundStyle(palette.ink)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 42)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.border, lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        if devices.count <= 1 {
                            Text(OttlineStrings.tr(
                                "아직 다른 기기가 연결되어 있지 않아요. 기기를 바꾸기 전에 연결 코드를 보관해 두세요.",
                                "No other devices are connected yet. Save your code before switching devices.",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                    } else {
                        Text(OttlineStrings.tr(
                            "첫 기록이 동기화되면 기록 연결 코드가 표시돼요.",
                            "Your record connection code appears after your first record syncs.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)
                    }

                    Rectangle()
                        .fill(palette.border)
                        .frame(height: 1)
                        .padding(.vertical, 2)

                    // Connect Form (`다른 기기에 기록이 있나요?`)
                    VStack(alignment: .leading, spacing: 10) {
                        Text(OttlineStrings.tr("다른 기기에 기록이 있나요?", "Have records on another device?", locale: locale))
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "그 기기의 내 공간에서 코드를 확인해 여기서 이어보세요.",
                            "Find the code in My Space on that device and enter it here.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(13.5))
                        .foregroundStyle(palette.mutedInk)

                        Text(OttlineStrings.tr("기록 연결 코드", "Record connection code", locale: locale))
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.mutedInk)

                        HStack(spacing: 8) {
                            TextField(
                                OttlineStrings.tr("기록 연결 코드 입력", "Enter record connection code", locale: locale),
                                text: $inputPairingCode
                            )
                            .textInputAutocapitalization(.characters)
                            .font(.system(size: 14.5, weight: .medium, design: .monospaced))
                            .padding(.horizontal, 12)
                            .frame(minHeight: 44)
                            .background(palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                            Button {
                                showPairConfirmAlert = true
                            } label: {
                                Text(pairingBusy
                                    ? OttlineStrings.tr("연결 중…", "Connecting…", locale: locale)
                                    : OttlineStrings.tr("연결하기", "Connect", locale: locale)
                                )
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 44)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pairingBusy)
                        }

                        DisclosureGroup(isExpanded: $lostCodeExpanded) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(OttlineStrings.tr(
                                    "• 아직 열려 있는 기기가 있다면 그 기기의 내 공간에서 코드를 다시 확인할 수 있어요.",
                                    "• If you still have another device open, check My Space there.",
                                    locale: locale
                                ))
                                Text(OttlineStrings.tr(
                                    "• 저장해 둔 보관 카드 이미지나 복사해 둔 메모가 있는지도 확인해 보세요.",
                                    "• Look for a saved recovery card image or note.",
                                    locale: locale
                                ))
                                Text(OttlineStrings.tr(
                                    "• 모든 기기에서 접근할 수 없다면 아래의 내 문의함으로 알려 주세요.",
                                    "• If you cannot access any device, contact us through your inbox below.",
                                    locale: locale
                                ))
                            }
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                            .padding(.top, 8)
                        } label: {
                            Text(OttlineStrings.tr("코드를 잃어버렸어요", "I lost my code", locale: locale))
                                .font(OttlineFont.semiBold(13))
                                .foregroundStyle(palette.primaryAccent)
                        }
                        .tint(palette.primaryAccent)
                    }
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 4. Connected Devices (`연결된 기기` / `Connected devices`)
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(OttlineStrings.tr("연결된 기기", "Connected devices", locale: locale))
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)
                        Spacer()
                        Text(locale == "en" ? "\(devices.count) linked" : "\(devices.count)개")
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                    }

                    Text(OttlineStrings.tr(
                        "이 계정에 연결된 기기를 확인하고 정리할 수 있어요.",
                        "Review and clean up devices connected to this account.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)

                    if devices.isEmpty {
                        Text(OttlineStrings.tr("연결된 기기가 없습니다.", "No connected devices.", locale: locale))
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)
                    } else {
                        VStack(spacing: 0) {
                            ForEach(Array(devices.enumerated()), id: \.element.id) { idx, dev in
                                if idx > 0 {
                                    Rectangle().fill(palette.border).frame(height: 1)
                                }
                                HStack(alignment: .top, spacing: 12) {
                                    Image(systemName: "iphone")
                                        .font(.system(size: 16))
                                        .foregroundStyle(palette.mutedInk)
                                        .padding(.top, 2)

                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(dev.id == snap.deviceId
                                            ? OttlineStrings.tr("현재 기기", "Current device", locale: locale)
                                            : OttlineStrings.tr("연결된 기기", "Linked device", locale: locale)
                                        )
                                        .font(OttlineFont.semiBold(14.5))
                                        .foregroundStyle(palette.ink)

                                        Text(dev.name)
                                            .font(OttlineFont.regular(12.5))
                                            .foregroundStyle(palette.mutedInk)

                                        Text("\(OttlineStrings.tr("생성", "Created", locale: locale)) \(RecordDate.formatDisplayDate(dev.createdAt, locale: locale)) · \(OttlineStrings.tr("최근", "Last active", locale: locale)) \(RecordDate.formatDisplayDate(dev.lastSeenAt, locale: locale))")
                                            .font(OttlineFont.regular(11.5))
                                            .foregroundStyle(palette.mutedInk)
                                    }

                                    Spacer()

                                    if dev.id == snap.deviceId {
                                        Text(OttlineStrings.tr("현재", "Current", locale: locale))
                                            .font(OttlineFont.semiBold(11.5))
                                            .foregroundStyle(palette.primaryAccent)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(palette.paperStrong)
                                            .clipShape(Capsule())
                                    } else {
                                        Button {
                                            Task {
                                                try? await repository.api.unlinkDevice(targetDeviceId: dev.id)
                                                await loadProfileAndDevices()
                                            }
                                        } label: {
                                            Text(OttlineStrings.tr("연결 해제", "Unlink", locale: locale))
                                                .font(OttlineFont.semiBold(12.5))
                                                .foregroundStyle(palette.primaryAccent)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.vertical, 12)
                            }
                        }
                    }
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 5. Collapsible Account Info (`내 계정 정보`)
                DisclosureGroup(isExpanded: $accountInfoExpanded) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 12) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("User ID")
                                    .font(OttlineFont.regular(11.5))
                                    .foregroundStyle(palette.mutedInk)
                                Text(snap.userId.map { "\($0.prefix(8))..." } ?? "-")
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundStyle(palette.ink)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)

                            VStack(alignment: .leading, spacing: 2) {
                                Text("Device ID")
                                    .font(OttlineFont.regular(11.5))
                                    .foregroundStyle(palette.mutedInk)
                                Text(snap.deviceId.map { "\($0.prefix(8))..." } ?? "-")
                                    .font(.system(size: 13, design: .monospaced))
                                    .foregroundStyle(palette.ink)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .padding(.top, 8)

                        Text(OttlineStrings.tr(
                            "첫 기록 전에는 계정 정보가 비어 있을 수 있어요.",
                            "Account info may be empty before your first record.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                    }
                } label: {
                    Text(OttlineStrings.tr("내 계정 정보", "My account info", locale: locale))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                }
                .tint(palette.ink)
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 6. Help Links (`기록을 더 잘 이어가도록` / `A little help with your records`)
                VStack(alignment: .leading, spacing: 10) {
                    Text(OttlineStrings.tr("기록을 더 잘 이어가도록", "A little help with your records", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)
                        .padding(.bottom, 2)

                    helpLinkRow(
                        label: OttlineStrings.tr("내 문의함 열기", "Open my inbox", locale: locale),
                        action: onOpenFeedback
                    )
                    Rectangle().fill(palette.border).frame(height: 1)
                    helpLinkRow(
                        label: OttlineStrings.tr("기록 가이드", "Recording guides", locale: locale),
                        action: onOpenGuides
                    )
                    Rectangle().fill(palette.border).frame(height: 1)
                    helpLinkRow(
                        label: OttlineStrings.tr("ottline과 함께하는 방법", "How to use ottline", locale: locale),
                        action: onOpenGuides
                    )
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 7. Export My Records (`내 기록 내보내기` / `Export my records`)
                VStack(alignment: .leading, spacing: 12) {
                    Text(OttlineStrings.tr("내 기록 내보내기", "Export my records", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)

                    Text(repository.logs.isEmpty
                        ? OttlineStrings.tr("첫 기록을 남기면 파일로도 보관할 수 있어요.", "After your first record, you can keep a copy as a file.", locale: locale)
                        : OttlineStrings.tr("이 기기에 저장된 타임라인을 CSV로 저장할 수 있어요.", "Download your timeline as a CSV file.", locale: locale)
                    )
                    .font(OttlineFont.regular(13.5))
                    .foregroundStyle(palette.mutedInk)

                    HStack(spacing: 8) {
                        ForEach([
                            ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                            ("video", OttlineStrings.tr("영상(영화/시리즈)", "Video (movie/series)", locale: locale)),
                            ("book", OttlineStrings.tr("책", "Book", locale: locale))
                        ], id: \.0) { key, label in
                            let selected = exportRange == key
                            Button {
                                exportRange = key
                            } label: {
                                Text(label)
                                    .font(selected ? OttlineFont.semiBold(13) : OttlineFont.regular(13))
                                    .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                    .padding(.horizontal, 12)
                                    .frame(minHeight: 38)
                                    .background(selected ? palette.paperStrong : palette.background)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }

                    let csvString = CsvExporter.buildCsv(exportLogs)
                    ShareLink(
                        item: csvString,
                        subject: Text("ottline timeline export"),
                        message: Text("ottline CSV")
                    ) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.down.to.line")
                                .font(.system(size: 13.5, weight: .semibold))
                            Text(OttlineStrings.tr("CSV 다운로드", "Download CSV", locale: locale))
                                .font(OttlineFont.semiBold(14))
                        }
                        .foregroundStyle(palette.ink)
                        .padding(.horizontal, 16)
                        .frame(minHeight: 42)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(palette.border, lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .disabled(exportLogs.isEmpty)

                    Text(OttlineStrings.tr(
                        "최신 기록을 포함하려면 동기화가 완료된 상태에서 내보내기 해주세요.",
                        "Let your records finish syncing before downloading the latest copy.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 8. iOS Local Recap Reminder Toggle
                VStack(alignment: .leading, spacing: 10) {
                    Toggle(
                        isOn: Binding(
                            get: { snap.recapNotificationsEnabled },
                            set: { next in
                                Task {
                                    _ = await RecapNotificationManager.shared.setEnabled(
                                        next,
                                        locale: snap.locale,
                                        prefs: repository.prefs
                                    )
                                }
                            }
                        )
                    ) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(OttlineStrings.tr("주간·월간 리캡 알림", "Weekly & Monthly recap reminders", locale: locale))
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr(
                                "월요일 저녁과 매달 1일에 남긴 기록을 돌아볼 수 있게 알려드려요",
                                "Gentle local reminders on Monday evenings and the 1st of each month",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .tint(palette.brandNavy)
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )

                #if DEBUG
                // Debug API Server Switcher
                VStack(alignment: .leading, spacing: 10) {
                    Text("개발용 서버 전환 (DEBUG ONLY)")
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(palette.brandNavy)
                    Text("현재 API: \(snap.apiBaseUrl)")
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                    HStack(spacing: 8) {
                        Button("운영 서버(ottline.app)") {
                            repository.prefs.setApiBaseUrl(AppPreferences.productionApiBaseUrl)
                            customServerUrl = AppPreferences.productionApiBaseUrl
                        }
                        .font(OttlineFont.medium(12))
                        .padding(8)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 6))

                        Button("로컬(localhost:8080)") {
                            repository.prefs.setApiBaseUrl("http://localhost:8080")
                            customServerUrl = "http://localhost:8080"
                        }
                        .font(OttlineFont.medium(12))
                        .padding(8)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                    }
                }
                .padding(14)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
                #endif

                // 9. Collapsible Data Management (`기록과 연결 데이터 관리`)
                DisclosureGroup(isExpanded: $dataManageExpanded) {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("로컬 데이터 초기화", "Reset local data", locale: locale))
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr(
                                "이 기기에 보관된 기록과 캐시를 비워요. 서버 데이터는 삭제되지 않아요.",
                                "Clear the records and cache kept on this device. Your server data stays safe.",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(13))
                            .foregroundStyle(palette.mutedInk)

                            Button {
                                showLocalResetAlert = true
                            } label: {
                                Text(OttlineStrings.tr("로컬 데이터 초기화", "Reset local data", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.danger)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 40)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.danger.opacity(0.45), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                        .padding(.top, 10)

                        Rectangle().fill(palette.border).frame(height: 1)

                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("서버 데이터 전체 삭제", "Delete all server data", locale: locale))
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr(
                                "이 계정에 연결된 서버 기록, 댓글, 문의, 분석 데이터와 모든 기기 연결을 함께 삭제해요. 현재 기기 로컬 데이터도 같이 초기화돼요.",
                                "Delete synced records, comments, inbox messages, analytics data, and all linked devices for this account. Local data on this device will also be cleared.",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(13))
                            .foregroundStyle(palette.mutedInk)

                            Button {
                                deleteConfirmInput = ""
                                showServerDeleteSheet = true
                            } label: {
                                Text(OttlineStrings.tr("서버 데이터 전체 삭제", "Delete all server data", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.danger)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 40)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.danger.opacity(0.45), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                } label: {
                    Text(OttlineStrings.tr("기록과 연결 데이터 관리", "Manage records and connection data", locale: locale))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                }
                .tint(palette.ink)
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
            }
            .padding(.horizontal, 18)
            .padding(.top, 20)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .alert(
            OttlineStrings.tr("연결 코드로 기기를 이어받을까요?", "Link with this connection code?", locale: locale),
            isPresented: $showPairConfirmAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("연결하기", "Connect", locale: locale)) {
                Task { await performPairWithCode() }
            }
        } message: {
            Text(OttlineStrings.tr(
                "이 기기에 남아 있던 기록도 함께 병합되어 하나의 타임라인으로 이어집니다.",
                "Records on this device will be merged into your linked timeline.",
                locale: locale
            ))
        }
        .alert(
            OttlineStrings.tr("이 기기에 보관된 기록을 초기화할까요?", "Clear local device data?", locale: locale),
            isPresented: $showLocalResetAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("로컬 데이터 초기화", "Reset local data", locale: locale), role: .destructive) {
                repository.resetLocalData()
                toastMessage = OttlineStrings.tr("로컬 데이터를 초기화했어요.", "Local data reset.", locale: locale)
            }
        } message: {
            Text(OttlineStrings.tr(
                "이 기기에 보관된 기록과 캐시를 비워요. 서버 데이터는 삭제되지 않아요.",
                "Clear the records and cache kept on this device. Your server data stays safe.",
                locale: locale
            ))
        }
        .sheet(isPresented: $showServerDeleteSheet) {
            serverDeleteConfirmationSheet
        }
        .onAppear {
            editNickname = snap.nickname ?? ""
            editPersonaKey = snap.personaKey ?? .cinemaKeeper
            if autoExpandPairing {
                onConsumeAutoExpandPairing()
            }
        }
        .task {
            await loadProfileAndDevices()
        }
    }

    private func helpLinkRow(label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack {
                Text(label)
                    .font(OttlineFont.medium(14.5))
                    .foregroundStyle(palette.ink)
                Spacer()
                Text("→")
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.primaryAccent)
            }
            .padding(.vertical, 6)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var serverDeleteConfirmationSheet: some View {
        let requiredWord = locale == "en" ? "DELETE" : "삭제"
        let canDelete = deleteConfirmInput.trimmingCharacters(in: .whitespacesAndNewlines) == requiredWord && !deletingAccount

        return NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(OttlineStrings.tr(
                    "이 계정에 연결된 서버 기록, 댓글, 문의, 분석 데이터와 모든 기기 연결을 영구 삭제합니다. 삭제 후에는 복구할 수 없어요.",
                    "This will permanently delete synced records, comments, inbox messages, analytics data, and all linked devices for this account. This cannot be undone.",
                    locale: locale
                ))
                .font(OttlineFont.regular(14))
                .foregroundStyle(palette.ink)

                Text(OttlineStrings.tr(
                    "계속하려면 아래에 ‘\(requiredWord)’를 입력해 주세요.",
                    "Type '\(requiredWord)' below to confirm permanent deletion.",
                    locale: locale
                ))
                .font(OttlineFont.semiBold(13.5))
                .foregroundStyle(palette.danger)

                TextField(requiredWord, text: $deleteConfirmInput)
                    .font(OttlineFont.medium(15))
                    .padding(12)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))

                Button {
                    Task {
                        deletingAccount = true
                        try? await repository.deleteServerAccountAndLocalData()
                        deletingAccount = false
                        showServerDeleteSheet = false
                        toastMessage = OttlineStrings.tr("서버 데이터를 모두 삭제했어요.", "All server data deleted.", locale: locale)
                    }
                } label: {
                    Text(deletingAccount
                        ? OttlineStrings.tr("삭제 중...", "Deleting...", locale: locale)
                        : OttlineStrings.tr("서버 데이터 전체 삭제", "Delete all server data", locale: locale)
                    )
                    .font(OttlineFont.semiBold(14.5))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(canDelete ? palette.danger : palette.mutedBg)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(!canDelete)

                Spacer()
            }
            .padding(20)
            .background(palette.background)
            .navigationTitle(OttlineStrings.tr("서버 데이터 전체 삭제", "Delete all server data", locale: locale))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) {
                        showServerDeleteSheet = false
                    }
                }
            }
        }
    }

    private func loadProfileAndDevices() async {
        guard !(repository.prefs.snapshot.userId ?? "").isEmpty else { return }
        if let prof = try? await repository.api.getProfile() {
            repository.prefs.saveProfile(nickname: prof.nickname, personaKey: prof.personaKey)
            editNickname = prof.nickname ?? ""
            editPersonaKey = prof.personaKey ?? .cinemaKeeper
        }
        if let devs = try? await repository.api.getDevices() {
            devices = devs
        }
    }

    private func saveProfile() async {
        savingProfile = true
        let nick = editNickname.trimmingCharacters(in: .whitespacesAndNewlines)
        repository.prefs.saveProfile(nickname: nick, personaKey: editPersonaKey)
        _ = try? await repository.ensureAuthenticated()
        _ = try? await repository.api.updateProfile(nickname: nick.isEmpty ? nil : nick, personaKey: editPersonaKey)
        savingProfile = false
        profileExpanded = false
        toastMessage = OttlineStrings.tr("내 모습을 저장했어요.", "Your new look is here.", locale: locale)
    }

    private func performPairWithCode() async {
        let code = inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        pairingBusy = true
        do {
            _ = try await repository.pairWithCode(code)
            inputPairingCode = ""
            await loadProfileAndDevices()
            toastMessage = OttlineStrings.tr(
                "기록이 연결되었어요. 같은 타임라인에서 이어서 볼 수 있어요.",
                "Your records are connected. You can continue on the same timeline.",
                locale: locale
            )
        } catch {
            toastMessage = OttlineStrings.tr(
                "기록을 연결하지 못했어요. 코드를 다시 확인해 주세요.",
                "Could not connect your records. Check the code and try again.",
                locale: locale
            )
        }
        pairingBusy = false
    }
}
