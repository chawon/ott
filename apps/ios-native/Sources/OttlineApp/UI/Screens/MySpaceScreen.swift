import SwiftUI
import OttlineCore
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
    public var onOpenAbout: () -> Void = {}
    public var onStartBrowserHandoff: () -> Void = {}

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @Environment(\.openURL) private var openURL
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.ottlineViewportWidth) private var viewportWidth

    private var metrics: PadLayoutMetrics {
        PadLayoutMetrics.resolve(horizontalSizeClass: horizontalSizeClass, viewportWidth: viewportWidth)
    }

    @State private var profileExpanded: Bool = false
    @State private var editNickname: String = ""
    @State private var editPersonaKey: PersonaKey = .cinemaKeeper
    @State private var savingProfile: Bool = false

    @State private var pairingSectionExpanded: Bool = false
    @State private var copiedCode: Bool = false
    @State private var inputPairingCode: String = ""
    @State private var showPairConfirmAlert: Bool = false
    @State private var pairingBusy: Bool = false
    @State private var lostCodeExpanded: Bool = false
    @State private var accountInfoExpanded: Bool = false
    @State private var dataManageExpanded: Bool = false
    @State private var exportRange: String = "all" // "all" | "video" | "book"
    @State private var devices: [DeviceItem] = []
    @State private var showUnlinkAllAlert: Bool = false
    @State private var unlinkingAll: Bool = false
    @State private var toastMessage: String?

    @State private var showLocalResetAlert: Bool = false
    @State private var showServerDeleteSheet: Bool = false
    @State private var deleteConfirmInput: String = ""
    @State private var deletingAccount: Bool = false
    @State private var shortcutsGuideExpanded: Bool = false

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
                        .font(OttlineFont.semiBold(metrics.isSpread ? 30 : 25))
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

                if metrics.mySpaceTwoColumns {
                    HStack(alignment: .top, spacing: 20) {
                        VStack(alignment: .leading, spacing: 20) {
                            myProfileCard(snap: snap, nickname: nickname, personaTitle: personaTitle)
                            pairingAndDevicesCard(snap: snap)
                            accountInfoCard(snap: snap)
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)

                        VStack(alignment: .leading, spacing: 20) {
                            remindersAndFeaturesCard(snap: snap)
                            helpLinksCard
                            exportCsvCard(exportLogs: exportLogs)
                            debugServerSection(snap: snap)
                            dataManagementCard
                        }
                        .frame(maxWidth: .infinity, alignment: .topLeading)
                    }
                } else {
                    myProfileCard(snap: snap, nickname: nickname, personaTitle: personaTitle)
                    pairingAndDevicesCard(snap: snap)
                    accountInfoCard(snap: snap)
                    helpLinksCard
                    exportCsvCard(exportLogs: exportLogs)
                    remindersAndFeaturesCard(snap: snap)
                    debugServerSection(snap: snap)
                    dataManagementCard
                }

                OttlineAppFooter()
            }
            .ottlineContentContainer(metrics)
            .padding(.top, metrics.isSpread ? 24 : 20)
            .padding(.bottom, 16)
        }
        .background(palette.background)
        .alert(
            OttlineStrings.tr("모든 기기 연결을 해제할까요?", "Unlink all devices?", locale: locale),
            isPresented: $showUnlinkAllAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("모든 기기 연결 해제", "Unlink all devices", locale: locale), role: .destructive) {
                Task { await performUnlinkAll() }
            }
        } message: {
            Text(OttlineStrings.tr(
                "이 기기의 기록 캐시도 비워지고 연결된 모든 기기 세션이 끊어집니다.",
                "This clears local cached data on this device and disconnects all linked devices.",
                locale: locale
            ))
        }
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
                profileExpanded = false
                editNickname = ""
                editPersonaKey = .cinemaKeeper
                devices = []
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
                pairingSectionExpanded = true
                onConsumeAutoExpandPairing()
            } else if snap.pairingCode?.isEmpty ?? true {
                pairingSectionExpanded = true
            }
        }
        .onChange(of: autoExpandPairing) { _, next in
            if next {
                pairingSectionExpanded = true
                onConsumeAutoExpandPairing()
            }
        }
        .task {
            await loadProfileAndDevices()
        }
    }

    @ViewBuilder
    private func myProfileCard(snap: PreferencesSnapshot, nickname: String, personaTitle: String?) -> some View {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .center, spacing: 16) {
                        PersonaAvatar(
                            personaKey: profileExpanded ? editPersonaKey : snap.personaKey,
                            size: 76,
                            circular: false
                        )

                        VStack(alignment: .leading, spacing: 4) {
                            Text(OttlineStrings.tr("나의 프로필", "MY PROFILE", locale: locale))
                                .font(OttlineFont.medium(11))
                                .kerning(0.7)
                                .foregroundStyle(palette.mutedInk)

                            Text(snap.isProfileComplete
                                ? nickname
                                : OttlineStrings.tr("나의 타임라인에, 나다운 모습", "A familiar face for your timeline", locale: locale)
                            )
                            .font(OttlineFont.semiBold(18))
                            .foregroundStyle(palette.ink)

                            Text(snap.isProfileComplete
                                ? (personaTitle ?? OttlineStrings.tr("닉네임과 아바타로 내 공간을 꾸며보세요.", "Make this space yours with a nickname and avatar.", locale: locale))
                                : OttlineStrings.tr("닉네임과 아바타로 내 공간을 꾸며보세요.", "Make this space yours with a nickname and avatar.", locale: locale)
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
                            .frame(minHeight: 44)
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
                            .padding(.horizontal, 12)
                            .frame(minHeight: 48)
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

                        let avatarColumns = Array(
                            repeating: GridItem(.flexible(), spacing: 8),
                            count: metrics.isSpread ? 3 : 2
                        )
                        LazyVGrid(columns: avatarColumns, spacing: 8) {
                            ForEach(OttlineStrings.personaPresets, id: \.key) { preset in
                                let selected = editPersonaKey == preset.key
                                Button {
                                    editPersonaKey = preset.key
                                } label: {
                                    VStack(alignment: .leading, spacing: 8) {
                                        PersonaAvatar(personaKey: preset.key, size: 44, circular: false)
                                        Text(preset.title(locale))
                                            .font(selected ? OttlineFont.semiBold(13.5) : OttlineFont.medium(13.5))
                                            .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                            .lineLimit(1)
                                        Text(preset.desc(locale))
                                            .font(OttlineFont.regular(11.5))
                                            .foregroundStyle(palette.mutedInk)
                                            .lineLimit(3)
                                            .multilineTextAlignment(.leading)
                                        Spacer(minLength: 0)
                                    }
                                    .padding(12)
                                    .frame(maxWidth: .infinity, minHeight: 136, alignment: .topLeading)
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
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .check, size: 16, color: palette.onBrandOrange)
                                    Text(savingProfile
                                        ? OttlineStrings.tr("저장 중…", "Saving…", locale: locale)
                                        : OttlineStrings.tr("이 모습으로 저장", "Keep this profile", locale: locale)
                                    )
                                    .font(OttlineFont.semiBold(14.5))
                                }
                                .foregroundStyle(palette.onBrandOrange)
                                .padding(.horizontal, 16)
                                .frame(minHeight: 48)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(savingProfile)

                            Button {
                                profileExpanded = false
                            } label: {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .clock3, size: 16, color: palette.ink)
                                    Text(OttlineStrings.tr("나중에 정하기", "Decide later", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                }
                                .foregroundStyle(palette.ink)
                                .padding(.horizontal, 14)
                                .frame(minHeight: 48)
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
    }

    @ViewBuilder
    private func pairingAndDevicesCard(snap: PreferencesSnapshot) -> some View {
                // 3. Collapsible Pairing & Connected Devices (`기기 연결 · 복구 코드`)
                DisclosureGroup(isExpanded: $pairingSectionExpanded) {
                    VStack(alignment: .leading, spacing: 14) {
                        if let code = snap.pairingCode, !code.isEmpty {
                            Text(OttlineStrings.tr(
                                "다른 기기의 내 공간에서 이 코드를 입력하면 같은 기록을 열 수 있어요.",
                                "Enter this code in My Space on another device to open the same records.",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(13.5))
                            .foregroundStyle(palette.mutedInk)
                            .padding(.top, 10)

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
                                        OttlineLucideIcon(kind: copiedCode ? .check : .copy, size: 15, color: palette.ink)
                                        Text(copiedCode
                                            ? OttlineStrings.tr("복사됨", "Copied", locale: locale)
                                            : OttlineStrings.tr("코드 복사", "Copy code", locale: locale)
                                        )
                                        .font(OttlineFont.semiBold(13.5))
                                    }
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
                                        OttlineLucideIcon(kind: .download, size: 15, color: palette.ink)
                                        Text(OttlineStrings.tr("보관 카드 저장", "Save recovery card", locale: locale))
                                            .font(OttlineFont.semiBold(13.5))
                                    }
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
                            .padding(.top, 10)
                        }

                        Rectangle()
                            .fill(palette.border)
                            .frame(height: 1)
                            .padding(.vertical, 2)

                        // Stacked Connect Form (`다른 기기에 기록이 있나요?`)
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

                            TextField(
                                OttlineStrings.tr("기록 연결 코드 입력", "Enter record connection code", locale: locale),
                                text: $inputPairingCode
                            )
                            .textInputAutocapitalization(.characters)
                            .font(.system(size: 14.5, weight: .medium, design: .monospaced))
                            .padding(.horizontal, 12)
                            .frame(minHeight: 48)
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
                                .frame(maxWidth: .infinity, minHeight: 48)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                            .disabled(inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pairingBusy)

                            Button(action: onStartBrowserHandoff) {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .externalLink, size: 15, color: palette.primaryAccent)
                                    Text(OttlineStrings.tr("웹(Safari·Chrome) 기록 가져오기", "Bring records from browser", locale: locale))
                                        .font(OttlineFont.semiBold(13.5))
                                }
                                .foregroundStyle(palette.primaryAccent)
                                .frame(maxWidth: .infinity, minHeight: 46)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(palette.primaryAccent.opacity(0.45), lineWidth: 1)
                                )
                            }
                            .buttonStyle(.plain)

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

                        Rectangle().fill(palette.border).frame(height: 1)

                        // Connected Devices
                        VStack(alignment: .leading, spacing: 10) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(OttlineStrings.tr("연결된 기기", "Connected devices", locale: locale))
                                    .font(OttlineFont.semiBold(16))
                                    .foregroundStyle(palette.ink)
                                Spacer()
                                Text(locale == "en" ? "\(devices.count) linked" : "\(devices.count)개")
                                    .font(OttlineFont.regular(12.5))
                                    .foregroundStyle(palette.mutedInk)
                            }

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
                                            OttlineLucideIcon(kind: .smartphone, size: 17, color: palette.mutedInk)
                                                .padding(.top, 2)

                                            VStack(alignment: .leading, spacing: 3) {
                                                Text(dev.id == snap.deviceId
                                                    ? OttlineStrings.tr("현재 기기", "Current device", locale: locale)
                                                    : OttlineStrings.tr("연결된 기기", "Linked device", locale: locale)
                                                )
                                                .font(OttlineFont.semiBold(14.5))
                                                .foregroundStyle(palette.ink)

                                                Text(dev.displayName.isEmpty ? "ottline" : dev.displayName)
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

                                Button {
                                    showUnlinkAllAlert = true
                                } label: {
                                    Text(unlinkingAll
                                        ? OttlineStrings.tr("연결 해제 중…", "Unlinking…", locale: locale)
                                        : OttlineStrings.tr("모든 기기 연결 해제", "Unlink all devices", locale: locale)
                                    )
                                    .font(OttlineFont.semiBold(13.5))
                                    .foregroundStyle(palette.danger)
                                    .padding(.horizontal, 14)
                                    .frame(minHeight: 42)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.danger.opacity(0.45), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .disabled(unlinkingAll)
                            }
                        }
                    }
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(OttlineStrings.tr("기기 연결 · 복구 코드", "Device connection & recovery", locale: locale))
                            .font(OttlineFont.semiBold(16))
                            .foregroundStyle(palette.ink)
                        Text(OttlineStrings.tr(
                            "다른 기기에서 같은 타임라인을 이어서 볼 수 있어요.",
                            "Keep the same timeline across your devices.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                    }
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

    @ViewBuilder
    private func accountInfoCard(snap: PreferencesSnapshot) -> some View {
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
    }

    @ViewBuilder
    private var helpLinksCard: some View {
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
                        label: OttlineStrings.tr("ottline과 함께하는 방법", "About ottline", locale: locale),
                        action: onOpenAbout
                    )
                }
                .padding(18)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(palette.border, lineWidth: 1)
                )
    }

    @ViewBuilder
    private func exportCsvCard(exportLogs: [WatchLog]) -> some View {
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

                    if let csvUrl = CsvExporter.writeTemporaryCsvFile(logs: exportLogs, locale: locale) {
                        ShareLink(
                            item: csvUrl,
                            subject: Text("ottline timeline export"),
                            message: Text("ottline CSV")
                        ) {
                            HStack(spacing: 6) {
                                OttlineLucideIcon(kind: .download, size: 15, color: palette.ink)
                                Text(OttlineStrings.tr("CSV 다운로드", "Download CSV", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                            }
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 44)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(exportLogs.isEmpty)
                    } else {
                        let csvString = CsvExporter.buildCsv(exportLogs, locale: locale)
                        ShareLink(
                            item: csvString,
                            subject: Text("ottline timeline export"),
                            message: Text("ottline CSV")
                        ) {
                            HStack(spacing: 6) {
                                OttlineLucideIcon(kind: .download, size: 15, color: palette.ink)
                                Text(OttlineStrings.tr("CSV 다운로드", "Download CSV", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                            }
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 16)
                            .frame(minHeight: 44)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(exportLogs.isEmpty)
                    }

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
    }

    @ViewBuilder
    private func remindersAndFeaturesCard(snap: PreferencesSnapshot) -> some View {
                // 8. Reminders & iOS Native Features (Recap, Evening Reminder, Shortcuts Automation, Widgets & Spotlight)
                VStack(alignment: .leading, spacing: 14) {
                    Text(OttlineStrings.tr("알림 · iOS 맞춤 기능", "Reminders & iOS features", locale: locale))
                        .font(OttlineFont.semiBold(18))
                        .foregroundStyle(palette.ink)

                    Toggle(
                        isOn: Binding(
                            get: { snap.recapNotificationsEnabled },
                            set: { next in
                                Task {
                                    let granted = await RecapNotificationManager.shared.setEnabled(
                                        next,
                                        locale: snap.locale,
                                        prefs: repository.prefs
                                    )
                                    if next && !granted {
                                        let devLabel = PadLayoutMetrics.deviceLabel(locale: "ko")
                                        toastMessage = OttlineStrings.tr(
                                            "\(devLabel) 설정 → 알림 → ottline에서 알림을 허용해 주세요.",
                                            "Please allow notifications in Settings → Notifications → ottline.",
                                            locale: locale
                                        )
                                    }
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

                    Rectangle().fill(palette.border).frame(height: 1)

                    VStack(alignment: .leading, spacing: 10) {
                        Toggle(
                            isOn: Binding(
                                get: { snap.eveningReminderEnabled },
                                set: { next in
                                    Task {
                                        let granted = await RecapNotificationManager.shared.setEveningReminder(
                                            enabled: next,
                                            hour: snap.eveningReminderHour,
                                            minute: snap.eveningReminderMinute,
                                            logs: repository.logs,
                                            prefs: repository.prefs
                                        )
                                        if next && !granted {
                                            let devLabel = PadLayoutMetrics.deviceLabel(locale: "ko")
                                            toastMessage = OttlineStrings.tr(
                                                "\(devLabel) 설정 → 알림 → ottline에서 알림을 허용해 주세요.",
                                                "Please allow notifications in Settings → Notifications → ottline.",
                                                locale: locale
                                            )
                                        }
                                    }
                                }
                            )
                        ) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(OttlineStrings.tr("저녁 감상 리마인더", "Evening memory reminder", locale: locale))
                                    .font(OttlineFont.semiBold(15))
                                    .foregroundStyle(palette.ink)
                                Text(OttlineStrings.tr(
                                    "설정한 시각에 이어보는 작품이나 오늘의 한 줄을 조용히 떠올려 드려요",
                                    "A gentle daily nudge at your chosen time for stories in progress or a quick note",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)
                            }
                        }
                        .tint(palette.brandNavy)

                        if snap.eveningReminderEnabled {
                            let calendar = Calendar(identifier: .gregorian)
                            let currentReminderDate = calendar.date(
                                bySettingHour: snap.eveningReminderHour,
                                minute: snap.eveningReminderMinute,
                                second: 0,
                                of: Date()
                            ) ?? Date()

                            HStack {
                                Text(OttlineStrings.tr("알림 시각", "Reminder time", locale: locale))
                                    .font(OttlineFont.medium(13.5))
                                    .foregroundStyle(palette.mutedInk)
                                Spacer()
                                DatePicker(
                                    "",
                                    selection: Binding(
                                        get: { currentReminderDate },
                                        set: { nextDate in
                                            let comps = calendar.dateComponents([.hour, .minute], from: nextDate)
                                            Task {
                                                _ = await RecapNotificationManager.shared.setEveningReminder(
                                                    enabled: true,
                                                    hour: comps.hour ?? 22,
                                                    minute: comps.minute ?? 0,
                                                    logs: repository.logs,
                                                    prefs: repository.prefs
                                                )
                                            }
                                        }
                                    ),
                                    displayedComponents: .hourAndMinute
                                )
                                .labelsHidden()
                                .tint(palette.brandNavy)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                        }
                    }

                    Rectangle().fill(palette.border).frame(height: 1)

                    DisclosureGroup(isExpanded: $shortcutsGuideExpanded) {
                        VStack(alignment: .leading, spacing: 10) {
                            VStack(alignment: .leading, spacing: 6) {
                                let devLabelKo = PadLayoutMetrics.deviceLabel(locale: "ko")
                                Text(OttlineStrings.tr(
                                    "1. \(devLabelKo) ‘단축어’ 앱 → 하단 ‘자동화’ → ‘+’ → ‘앱’ 선택",
                                    "1. Open Apple ‘Shortcuts’ → Automation → ‘+’ → App",
                                    locale: locale
                                ))
                                Text(OttlineStrings.tr(
                                    "2. 넷플릭스·티빙·밀리의서재 등 원하는 앱과 ‘닫혔을 때’·‘즉시 실행’ 선택",
                                    "2. Choose streaming or reading apps, ‘Is Closed’, and ‘Run Immediately’",
                                    locale: locale
                                ))
                                Text(OttlineStrings.tr(
                                    "3. ‘새 자동화’ → ‘ottline’ 검색 → ‘시청·독서 후 기록 알림 보내기’ 연결",
                                    "3. Pick ‘New Blank Automation’ → search ‘ottline’ → ‘Send Watch/Read Prompt Notification’",
                                    locale: locale
                                ))
                            }
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )

                            FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                                Button {
                                    Task {
                                        let scheduled = await RecapNotificationManager.shared.scheduleWatchPromptNotification(
                                            platformLabel: locale == "en" ? "Netflix" : "넷플릭스",
                                            typeTab: "all",
                                            locale: locale,
                                            respectCooldown: false,
                                            delaySeconds: 1.0
                                        )
                                        let devLabelKo = PadLayoutMetrics.deviceLabel(locale: "ko")
                                        toastMessage = scheduled
                                            ? OttlineStrings.tr("테스트 기록 알림을 보냈어요.", "Sent a sample prompt notification.", locale: locale)
                                            : OttlineStrings.tr(
                                                "\(devLabelKo) 설정 → 알림 → ottline에서 알림을 허용해 주세요.",
                                                "Please allow notifications in Settings → Notifications → ottline.",
                                                locale: locale
                                            )
                                    }
                                } label: {
                                    Text(OttlineStrings.tr("테스트 알림 보내기", "Send test prompt", locale: locale))
                                        .font(OttlineFont.semiBold(13))
                                        .foregroundStyle(palette.primaryAccent)
                                        .padding(.horizontal, 12)
                                        .frame(minHeight: 40)
                                        .background(palette.card)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8)
                                                .stroke(palette.primaryAccent.opacity(0.45), lineWidth: 1)
                                        )
                                }
                                .buttonStyle(.plain)

                                Button {
                                    if let url = URL(string: "shortcuts://") {
                                        openURL(url)
                                    }
                                } label: {
                                    HStack(spacing: 5) {
                                        Text(OttlineStrings.tr("단축어 앱 열기", "Open Shortcuts", locale: locale))
                                            .font(OttlineFont.semiBold(13))
                                        OttlineLucideIcon(kind: .externalLink, size: 13, color: palette.ink)
                                    }
                                    .foregroundStyle(palette.ink)
                                    .padding(.horizontal, 12)
                                    .frame(minHeight: 40)
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
                        .padding(.top, 10)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(OttlineStrings.tr("OTT·독서 앱 닫을 때 기록 알림 받기 (단축어)", "Prompt after closing OTT or reading apps", locale: locale))
                                .font(OttlineFont.semiBold(15))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr(
                                "넷플릭스·티빙·밀리의서재 등을 닫을 때 바로 기록 알림을 띄울 수 있어요",
                                "Connect Apple Shortcuts to get a quick prompt when closing streaming or reading apps",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(12.5))
                            .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .tint(palette.ink)

                    let devLabelKo = PadLayoutMetrics.deviceLabel(locale: "ko")
                    let devLabelEn = PadLayoutMetrics.deviceLabel(locale: "en")
                    Text(OttlineStrings.tr(
                        "홈·잠금 화면 위젯과 \(devLabelKo) Spotlight 검색에서도 내 타임라인 작품을 바로 찾을 수 있어요.",
                        "Your timeline is also available in Home & Lock Screen widgets and \(devLabelEn) Spotlight search.",
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
    }

    @ViewBuilder
    private func debugServerSection(snap: PreferencesSnapshot) -> some View {
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
                #else
                EmptyView()
                #endif
    }

    @ViewBuilder
    private var dataManagementCard: some View {
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
                        profileExpanded = false
                        editNickname = ""
                        editPersonaKey = .cinemaKeeper
                        devices = []
                        deleteConfirmInput = ""
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
        repository.prefs.saveProfile(nickname: nick.isEmpty ? nil : nick, personaKey: editPersonaKey)
        _ = try? await repository.ensureAuthenticated()
        _ = try? await repository.api.updateProfile(nickname: nick, personaKey: editPersonaKey)
        savingProfile = false
        profileExpanded = false
        toastMessage = OttlineStrings.tr("내 모습을 저장했어요.", "Your new look is here.", locale: locale)
    }

    private func performUnlinkAll() async {
        guard !unlinkingAll else { return }
        unlinkingAll = true
        do {
            try await repository.unlinkAllDevices()
            profileExpanded = false
            editNickname = ""
            editPersonaKey = .cinemaKeeper
            inputPairingCode = ""
            devices = []
            toastMessage = OttlineStrings.tr("모든 기기 연결을 해제했어요.", "All devices unlinked.", locale: locale)
        } catch {
            toastMessage = OttlineStrings.tr("기기 연결을 해제하지 못했어요.", "Could not unlink all devices.", locale: locale)
        }
        unlinkingAll = false
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
