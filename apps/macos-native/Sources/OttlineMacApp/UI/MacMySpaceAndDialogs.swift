import SwiftUI
import AppKit
import UniformTypeIdentifiers
import OttlineCore

// MARK: - Mac My Space Spread View (2-Column Desktop Workspace)

public struct MacMySpaceSpreadView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var editNickname: String = ""
    @State private var editPersonaKey: PersonaKey = .cinemaKeeper
    @State private var savingProfile: Bool = false

    @State private var inputPairingCode: String = ""
    @State private var pairingBusy: Bool = false
    @State private var devices: [DeviceItem] = []
    @State private var exportRange: String = "all"
    @State private var toastMessage: String?

    @State private var showPairConfirmAlert: Bool = false
    @State private var showLocalResetAlert: Bool = false
    @State private var showServerDeleteSheet: Bool = false
    @State private var deleteConfirmInput: String = ""
    @State private var deletingAccount: Bool = false
    @State private var serverDeleteError: String? = nil

    public var body: some View {
        let snap = repository.prefs.snapshot
        let exportLogs = repository.logs.filter { log in
            if exportRange == "video" { return log.title.type != .book }
            if exportRange == "book" { return log.title.type == .book }
            return true
        }

        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(OttlineStrings.tr("나의 공간", "MY SPACE", locale: locale))
                        .font(OttlineFont.medium(11))
                        .kerning(0.9)
                        .foregroundStyle(palette.mutedInk)
                    Text(OttlineStrings.tr("어디서든, 나의 기록", "Your records, wherever you are", locale: locale))
                        .font(OttlineFont.semiBold(28))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr("계정을 외우는 대신, 내 기록을 이어가는 방법.", "A simple way to carry your records with you.", locale: locale))
                        .font(OttlineFont.regular(14))
                        .foregroundStyle(palette.mutedInk)
                }
                .padding(.bottom, 14)
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
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }

                HStack(alignment: .top, spacing: 20) {
                    // Left Column: Profile + Pairing & Recovery + Connected Devices
                    VStack(alignment: .leading, spacing: 18) {
                        profileDesktopCard(snap: snap)
                        pairingDesktopCard(snap: snap)
                    }
                    .frame(maxWidth: .infinity)

                    // Right Column: Reminders & macOS Controls + Export + Guides + Danger Zone
                    VStack(alignment: .leading, spacing: 18) {
                        macFeaturesCard(snap: snap)
                        exportDesktopCard(exportLogs: exportLogs)
                        helpAndDataCard
                    }
                    .frame(maxWidth: .infinity)
                }

                OttlineAppFooter()
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .padding(.top, 24)
            .frame(maxWidth: .infinity)
        }
        .alert(
            OttlineStrings.tr("연결 코드로 기기를 이어받을까요?", "Link with this connection code?", locale: locale),
            isPresented: $showPairConfirmAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("연결하기", "Connect", locale: locale)) {
                Task { await performPair() }
            }
        }
        .alert(
            OttlineStrings.tr("이 Mac의 로컬 데이터를 초기화할까요?", "Clear local data on this Mac?", locale: locale),
            isPresented: $showLocalResetAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("초기화", "Reset", locale: locale), role: .destructive) {
                repository.resetLocalData()
                editNickname = ""
                editPersonaKey = .cinemaKeeper
                devices = []
                toastMessage = OttlineStrings.tr("로컬 데이터를 초기화했어요.", "Local data cleared.", locale: locale)
            }
        }
        .sheet(isPresented: $showServerDeleteSheet) {
            serverDeleteSheet
        }
        .onAppear {
            editNickname = snap.nickname ?? ""
            editPersonaKey = snap.personaKey ?? .cinemaKeeper
            if appState.autoExpandPairing {
                appState.autoExpandPairing = false
            }
        }
        .task {
            await loadProfileAndDevices()
        }
        .onChange(of: repository.prefs.snapshot.userId) { _, _ in
            editNickname = repository.prefs.snapshot.nickname ?? ""
            editPersonaKey = repository.prefs.snapshot.personaKey ?? .cinemaKeeper
            Task { await loadProfileAndDevices() }
        }
        .onChange(of: repository.prefs.snapshot.pairingCode) { _, _ in
            editNickname = repository.prefs.snapshot.nickname ?? ""
            editPersonaKey = repository.prefs.snapshot.personaKey ?? .cinemaKeeper
        }
    }

    private func profileDesktopCard(snap: PreferencesSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 14) {
                PersonaAvatar(personaKey: editPersonaKey, size: 68, circular: false)
                VStack(alignment: .leading, spacing: 3) {
                    Text(OttlineStrings.tr("나의 프로필", "MY PROFILE", locale: locale))
                        .font(OttlineFont.medium(11))
                        .foregroundStyle(palette.mutedInk)
                    Text(editNickname.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                        ? OttlineStrings.tr("나의 타임라인에, 나다운 모습", "A familiar face for your timeline", locale: locale)
                        : editNickname
                    )
                    .font(OttlineFont.bold(18))
                    .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr("닉네임과 아바타는 내 화면에서만 보여요.", "Only shown on your own screens.", locale: locale))
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                }
            }

            TextField(
                OttlineStrings.tr("닉네임 (예: 기록하는 밤)", "Nickname", locale: locale),
                text: $editNickname
            )
            .textFieldStyle(.plain)
            .font(OttlineFont.regular(14))
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(palette.background)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) {
                ForEach(OttlineStrings.personaPresets, id: \.key) { preset in
                    let selected = editPersonaKey == preset.key
                    Button {
                        editPersonaKey = preset.key
                    } label: {
                        VStack(spacing: 6) {
                            PersonaAvatar(personaKey: preset.key, size: 40, circular: false)
                            Text(preset.title(locale))
                                .font(selected ? OttlineFont.semiBold(12) : OttlineFont.regular(12))
                                .foregroundStyle(selected ? palette.primaryAccent : palette.ink)
                                .lineLimit(1)
                        }
                        .padding(10)
                        .frame(maxWidth: .infinity)
                        .background(selected ? palette.paperStrong : palette.background)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(selected ? palette.primaryAccent : palette.border, lineWidth: selected ? 1.5 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                Task { await saveProfile() }
            } label: {
                Text(savingProfile ? OttlineStrings.tr("저장 중...", "Saving...", locale: locale) : OttlineStrings.tr("프로필 저장", "Save profile", locale: locale))
                    .font(OttlineFont.semiBold(14))
                    .foregroundStyle(palette.onBrandOrange)
                    .padding(.horizontal, 16)
                    .frame(height: 40)
                    .background(palette.brandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(savingProfile)
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func pairingDesktopCard(snap: PreferencesSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(OttlineStrings.tr("기기 연결 · 복구 코드", "Device connection & recovery", locale: locale))
                .font(OttlineFont.bold(17))
                .foregroundStyle(palette.ink)

            if let code = snap.pairingCode, !code.isEmpty {
                Text(code)
                    .font(.system(size: 20, weight: .semibold, design: .monospaced))
                    .kerning(1.4)
                    .foregroundStyle(palette.ink)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                HStack(spacing: 8) {
                    Button {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(code, forType: .string)
                        toastMessage = OttlineStrings.tr("연결 코드를 클립보드에 복사했어요.", "Copied connection code.", locale: locale)
                    } label: {
                        Text(OttlineStrings.tr("코드 복사", "Copy code", locale: locale))
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(palette.ink)
                            .padding(.horizontal, 12)
                            .frame(height: 36)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)

                    Button {
                        let image = MacImageExportHelper.renderRecoveryCardImage(
                            pairingCode: code,
                            nickname: snap.nickname,
                            locale: locale
                        )
                        if MacImageExportHelper.savePngWithPanel(image, defaultName: "ottline-recovery-card.png") {
                            toastMessage = OttlineStrings.tr("보관 카드 이미지를 저장했어요.", "Saved recovery card PNG.", locale: locale)
                        }
                    } label: {
                        Text(OttlineStrings.tr("보관 카드 PNG 저장…", "Save recovery card PNG…", locale: locale))
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(palette.primaryAccent)
                            .padding(.horizontal, 12)
                            .frame(height: 36)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.primaryAccent.opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                Text(OttlineStrings.tr("첫 기록이 동기화되면 연결 코드가 생겨요.", "Your connection code appears once your first record syncs.", locale: locale))
                    .font(OttlineFont.regular(13))
                    .foregroundStyle(palette.mutedInk)
            }

            Rectangle().fill(palette.border).frame(height: 1)

            Button {
                appState.startBrowserHandoff(repository: repository)
            } label: {
                HStack(spacing: 8) {
                    OttlineLucideIcon(kind: .externalLink, size: 15, color: palette.primaryAccent)
                    Text(OttlineStrings.tr(
                        "웹(Safari/Chrome)에서 쓰던 기록 가져오기 →",
                        "Bring records from web browser (Safari/Chrome) →",
                        locale: locale
                    ))
                    .font(OttlineFont.medium(13))
                    .foregroundStyle(palette.primaryAccent)
                }
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, minHeight: 40, alignment: .leading)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            HStack(spacing: 8) {
                TextField(
                    OttlineStrings.tr("다른 기기 연결 코드 입력", "Enter connection code", locale: locale),
                    text: $inputPairingCode
                )
                .textFieldStyle(.plain)
                .font(.system(size: 13.5, design: .monospaced))
                .padding(.horizontal, 12)
                .frame(height: 38)
                .background(palette.background)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

                Button {
                    showPairConfirmAlert = true
                } label: {
                    Text(pairingBusy ? OttlineStrings.tr("연결 중...", "Connecting...", locale: locale) : OttlineStrings.tr("연결", "Connect", locale: locale))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(palette.onBrandOrange)
                        .padding(.horizontal, 16)
                        .frame(height: 38)
                        .background(palette.brandOrange)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pairingBusy)
            }

            if !devices.isEmpty {
                Rectangle().fill(palette.border).frame(height: 1)
                Text(OttlineStrings.tr("연결된 기기 (\(devices.count))", "Linked devices (\(devices.count))", locale: locale))
                    .font(OttlineFont.semiBold(13.5))
                    .foregroundStyle(palette.ink)
                ForEach(devices) { dev in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dev.displayName.isEmpty ? "ottline" : dev.displayName)
                                .font(OttlineFont.medium(13))
                                .foregroundStyle(palette.ink)
                            Text(RecordDate.formatDisplayDate(dev.lastSeenAt, locale: locale))
                                .font(OttlineFont.regular(11.5))
                                .foregroundStyle(palette.subtleInk)
                        }
                        Spacer()
                        if dev.id == snap.deviceId {
                            Text(OttlineStrings.tr("현재 Mac", "This Mac", locale: locale))
                                .font(OttlineFont.semiBold(11))
                                .foregroundStyle(palette.primaryAccent)
                        } else {
                            Button(OttlineStrings.tr("연결 해제", "Unlink", locale: locale)) {
                                Task {
                                    try? await repository.api.unlinkDevice(targetDeviceId: dev.id)
                                    await loadProfileAndDevices()
                                }
                            }
                            .font(OttlineFont.medium(12))
                        }
                    }
                }
            }
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func macFeaturesCard(snap: PreferencesSnapshot) -> some View {
        let calendar = Calendar(identifier: .gregorian)
        let currentReminderDate = calendar.date(
            bySettingHour: snap.eveningReminderHour,
            minute: snap.eveningReminderMinute,
            second: 0,
            of: Date()
        ) ?? Date()

        return VStack(alignment: .leading, spacing: 14) {
            Text(OttlineStrings.tr("알림 · macOS 맞춤 기능", "Reminders & macOS features", locale: locale))
                .font(OttlineFont.bold(17))
                .foregroundStyle(palette.ink)

            Toggle(
                isOn: Binding(
                    get: { snap.macosMenuBarEnabled },
                    set: { repository.prefs.setMacosMenuBarEnabled($0) }
                )
            ) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(OttlineStrings.tr("상단 메뉴바 빠른 기록 표시", "Show Menu Bar Quick Log", locale: locale))
                        .font(OttlineFont.semiBold(14.5))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr("작업 중에도 Mac 상단 메뉴바에서 한 번에 작품을 찾고 남길 수 있어요", "Search and save records right from the macOS menu bar", locale: locale))
                        .font(OttlineFont.regular(12))
                        .foregroundStyle(palette.mutedInk)
                }
            }
            .tint(palette.brandNavy)

            Rectangle().fill(palette.border).frame(height: 1)

            Toggle(
                isOn: Binding(
                    get: { snap.recapNotificationsEnabled },
                    set: { next in
                        Task {
                            _ = await RecapNotificationManager.shared.setEnabled(next, locale: snap.locale, prefs: repository.prefs)
                        }
                    }
                )
            ) {
                Text(OttlineStrings.tr("주간·월간 리캡 알림", "Weekly & Monthly recap reminders", locale: locale))
                    .font(OttlineFont.medium(14))
                    .foregroundStyle(palette.ink)
            }
            .tint(palette.brandNavy)

            Toggle(
                isOn: Binding(
                    get: { snap.eveningReminderEnabled },
                    set: { next in
                        Task {
                            _ = await RecapNotificationManager.shared.setEveningReminder(
                                enabled: next,
                                hour: snap.eveningReminderHour,
                                minute: snap.eveningReminderMinute,
                                logs: repository.logs,
                                prefs: repository.prefs
                            )
                        }
                    }
                )
            ) {
                Text(OttlineStrings.tr("저녁 감상 리마인더", "Evening memory reminder", locale: locale))
                    .font(OttlineFont.medium(14))
                    .foregroundStyle(palette.ink)
            }
            .tint(palette.brandNavy)

            if snap.eveningReminderEnabled {
                HStack {
                    Text(OttlineStrings.tr("알림 시각", "Reminder time", locale: locale))
                        .font(OttlineFont.medium(13))
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
                }
                .padding(10)
                .background(palette.paperStrong)
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }

            Text(OttlineStrings.tr(
                "단축키: ⌘N 새 기록 · ⌘1~4 화면 이동 · ⌘R 동기화 · macOS Spotlight에서도 기록을 바로 검색할 수 있어요.",
                "Shortcuts: ⌘N New Record · ⌘1-4 Navigate · ⌘R Sync · Also indexed in macOS Spotlight.",
                locale: locale
            ))
            .font(OttlineFont.regular(12))
            .foregroundStyle(palette.mutedInk)
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func exportDesktopCard(exportLogs: [WatchLog]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(OttlineStrings.tr("내 기록 내보내기", "Export my records", locale: locale))
                .font(OttlineFont.bold(17))
                .foregroundStyle(palette.ink)

            HStack(spacing: 8) {
                ForEach([
                    ("all", OttlineStrings.tr("전체", "All", locale: locale)),
                    ("video", OttlineStrings.tr("영상", "Video", locale: locale)),
                    ("book", OttlineStrings.tr("책", "Book", locale: locale))
                ], id: \.0) { key, label in
                    let active = exportRange == key
                    Button {
                        exportRange = key
                    } label: {
                        Text(label)
                            .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                            .foregroundStyle(active ? palette.primaryAccent : palette.ink)
                            .padding(.horizontal, 12)
                            .frame(height: 32)
                            .background(active ? palette.paperStrong : palette.background)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.primaryAccent : palette.border, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }

                Spacer()

                Button {
                    let csv = CsvExporter.buildCsv(exportLogs, locale: locale)
                    if MacImageExportHelper.saveCsvWithPanel(csv, defaultName: "ottline-timeline-\(exportRange).csv") {
                        toastMessage = OttlineStrings.tr("CSV 파일을 저장했어요.", "Saved CSV file.", locale: locale)
                    }
                } label: {
                    HStack(spacing: 5) {
                        OttlineLucideIcon(kind: .download, size: 14, color: palette.ink)
                        Text(OttlineStrings.tr("CSV로 저장…", "Save CSV…", locale: locale))
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(palette.ink)
                    }
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(exportLogs.isEmpty)
            }
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private var helpAndDataCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(OttlineStrings.tr("도움말 · 데이터 관리", "Help & data", locale: locale))
                .font(OttlineFont.bold(17))
                .foregroundStyle(palette.ink)

            FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                helpPill(OttlineStrings.tr("내 문의함", "Inbox", locale: locale)) { appState.overlayStack.append(.feedback(nil)) }
                helpPill(OttlineStrings.tr("기록 가이드", "Guides", locale: locale)) { appState.overlayStack.append(.guides(nil)) }
                helpPill(OttlineStrings.tr("서비스 소개", "About", locale: locale)) { appState.overlayStack.append(.about) }
                helpPill(OttlineStrings.tr("자주 묻는 질문", "FAQ", locale: locale)) { appState.overlayStack.append(.faq) }
                helpPill(OttlineStrings.tr("개인정보처리방침", "Privacy", locale: locale)) { appState.overlayStack.append(.privacy) }
            }

            Rectangle().fill(palette.border).frame(height: 1)

            HStack(spacing: 10) {
                Button {
                    showLocalResetAlert = true
                } label: {
                    Text(OttlineStrings.tr("로컬 데이터 초기화", "Reset local data", locale: locale))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(palette.danger)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.danger.opacity(0.45), lineWidth: 1))
                }
                .buttonStyle(.plain)

                let hasServerAccount = !(repository.prefs.snapshot.userId ?? "").isEmpty
                    && !(repository.prefs.snapshot.deviceId ?? "").isEmpty
                Button {
                    deleteConfirmInput = ""
                    serverDeleteError = nil
                    showServerDeleteSheet = true
                } label: {
                    Text(OttlineStrings.tr("서버 데이터 전체 삭제…", "Delete all server data…", locale: locale))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(hasServerAccount ? palette.danger : palette.subtleInk)
                        .padding(.horizontal, 12)
                        .frame(height: 36)
                        .background(hasServerAccount ? palette.card : palette.mutedBg)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(hasServerAccount ? palette.danger.opacity(0.45) : palette.border, lineWidth: 1))
                }
                .buttonStyle(.plain)
                .disabled(!hasServerAccount)
                .help(hasServerAccount
                    ? OttlineStrings.tr("연결된 서버 계정과 모든 기기 데이터를 삭제합니다.", "Delete linked server account and synced data.", locale: locale)
                    : OttlineStrings.tr("연결된 서버 계정이 있을 때 사용할 수 있어요.", "Available when linked to a server account.", locale: locale)
                )
            }
        }
        .padding(18)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }

    private func helpPill(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(OttlineFont.medium(12.5))
                .foregroundStyle(palette.ink)
                .padding(.horizontal, 11)
                .frame(height: 32)
                .background(palette.background)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var serverDeleteSheet: some View {
        let word = locale == "en" ? "DELETE" : "삭제"
        let ready = deleteConfirmInput.trimmingCharacters(in: .whitespacesAndNewlines) == word && !deletingAccount
        return NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text(OttlineStrings.tr(
                    "계속하려면 아래에 ‘\(word)’를 입력해 주세요. 연결된 서버 기록과 모든 기기 세션이 삭제됩니다.",
                    "Type '\(word)' to permanently delete all synced server records.",
                    locale: locale
                ))
                .font(OttlineFont.regular(13.5))
                TextField(word, text: $deleteConfirmInput)
                    .textFieldStyle(.plain)
                    .font(OttlineFont.regular(14))
                    .foregroundStyle(palette.ink)
                    .padding(.horizontal, 12)
                    .frame(height: 42)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                if let serverDeleteError, !serverDeleteError.isEmpty {
                    Text(serverDeleteError)
                        .font(OttlineFont.regular(13))
                        .foregroundStyle(palette.danger)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.danger.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.danger.opacity(0.4), lineWidth: 1))
                }
                Button {
                    Task {
                        guard !deletingAccount else { return }
                        deletingAccount = true
                        serverDeleteError = nil
                        let outcome = await repository.performServerAccountDeletion(locale: locale)
                        deletingAccount = false
                        switch outcome {
                        case .deleted(let msg):
                            devices = []
                            editNickname = ""
                            editPersonaKey = .cinemaKeeper
                            deleteConfirmInput = ""
                            serverDeleteError = nil
                            showServerDeleteSheet = false
                            toastMessage = msg
                        case .notConnected(let msg), .failed(let msg):
                            serverDeleteError = msg
                        }
                    }
                } label: {
                    Text(deletingAccount
                        ? OttlineStrings.tr("삭제 중...", "Deleting...", locale: locale)
                        : (serverDeleteError != nil
                            ? OttlineStrings.tr("다시 시도", "Try again", locale: locale)
                            : OttlineStrings.tr("영구 삭제", "Delete permanently", locale: locale))
                    )
                        .font(OttlineFont.semiBold(14))
                        .foregroundStyle(Color.white)
                        .padding(.horizontal, 18)
                        .frame(height: 42)
                        .background(palette.danger)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)
                .disabled(!ready)
                .opacity(ready ? 1 : 0.45)
            }
            .padding(20)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(OttlineStrings.tr("닫기", "Close", locale: locale)) { showServerDeleteSheet = false }
                }
            }
        }
        .frame(minWidth: 420, minHeight: 240)
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
        toastMessage = OttlineStrings.tr("내 모습을 저장했어요.", "Profile saved.", locale: locale)
    }

    private func performPair() async {
        let code = inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        pairingBusy = true
        do {
            _ = try await repository.pairWithCode(code)
            inputPairingCode = ""
            await loadProfileAndDevices()
            toastMessage = OttlineStrings.tr("기록을 연결했어요.", "Records connected.", locale: locale)
        } catch {
            toastMessage = OttlineStrings.tr("연결 코드를 다시 확인해 주세요.", "Could not connect with that code.", locale: locale)
        }
        pairingBusy = false
    }
}

// MARK: - Mac Bookshelf, Report, Feedback, Guide Views & Menu Bar Popover

public struct MacBookshelfView: View {
    @ObservedObject public var repository: OttlineRepository
    public var initialKdcMajor: Int?
    public let onBack: () -> Void
    public let onOpenTitleDetail: (String) -> Void
    public let onOpenQuickRecordBook: () -> Void

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    public var body: some View {
        let (sections, unclassified) = BookshelfBuilder.buildShelfGrid(
            logs: repository.logs,
            classificationsByIsbn: repository.bookClassifications
        )
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack {
                    Button(action: onBack) {
                        HStack(spacing: 5) {
                            OttlineLucideIcon(kind: .arrowLeft, size: 15, color: palette.mutedInk)
                            Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                                .font(OttlineFont.medium(13.5))
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .buttonStyle(.plain)
                    Spacer()
                    Button(action: onOpenQuickRecordBook) {
                        Text(OttlineStrings.tr("+ 책 기록하기", "+ Log a book", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.onBrandOrange)
                            .padding(.horizontal, 14)
                            .frame(height: 36)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }

                Text(OttlineStrings.tr("내 서가 (KDC)", "My Bookshelf", locale: locale))
                    .font(OttlineFont.bold(24))
                    .foregroundStyle(palette.ink)

                if sections.isEmpty && unclassified.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(OttlineStrings.tr(
                            "아직 서가에 꽂힌 책이 없어요. 첫 책 기록을 남겨보세요.",
                            "No books on your shelf yet. Leave your first book record.",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(15.5))
                        .foregroundStyle(palette.ink)

                        Button(action: onOpenQuickRecordBook) {
                            HStack(spacing: 6) {
                                OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                                Text(OttlineStrings.tr("첫 책 기록 남기기", "Leave your first book record", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.onBrandOrange)
                            }
                            .padding(.horizontal, 16)
                            .frame(height: 44)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                } else {
                    ForEach(sections) { sec in
                        VStack(alignment: .leading, spacing: 10) {
                            Text("\(sec.codeLabel) · \(locale == "en" ? sec.titleEn : sec.titleKo) (\(sec.books.count))")
                                .font(OttlineFont.bold(16))
                                .foregroundStyle(palette.ink)

                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 12)], spacing: 12) {
                                ForEach(sec.books, id: \.representativeLog.id) { item in
                                    Button {
                                        onOpenTitleDetail(item.representativeLog.title.id)
                                    } label: {
                                        VStack(alignment: .leading, spacing: 6) {
                                            PosterImage(
                                                posterUrl: item.representativeLog.title.posterUrl,
                                                titleName: item.representativeLog.title.name,
                                                titleType: .book,
                                                width: 120,
                                                height: 174,
                                                cornerRadius: 4
                                            )
                                            Text(item.representativeLog.title.name)
                                                .font(OttlineFont.semiBold(13.5))
                                                .foregroundStyle(palette.ink)
                                                .lineLimit(2)
                                        }
                                        .padding(10)
                                        .frame(maxWidth: .infinity, alignment: .leading)
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
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
    }
}

public struct MacReportView: View {
    @ObservedObject public var repository: OttlineRepository
    public let onBack: () -> Void
    public let onOpenTitleDetail: (String) -> Void
    public var onOpenQuickRecord: (() -> Void)? = nil

    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale
    @State private var report = PersonalReport()

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Button(action: onBack) {
                    HStack(spacing: 5) {
                        OttlineLucideIcon(kind: .arrowLeft, size: 15, color: palette.mutedInk)
                        Text(OttlineStrings.tr("뒤로", "Back", locale: locale))
                            .font(OttlineFont.medium(13.5))
                            .foregroundStyle(palette.mutedInk)
                    }
                }
                .buttonStyle(.plain)

                Text(OttlineStrings.tr("내 이용 리포트", "My usage report", locale: locale))
                    .font(OttlineFont.bold(24))
                    .foregroundStyle(palette.ink)

                if repository.logs.isEmpty {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(OttlineStrings.tr(
                            "아직 쌓인 기록이 없어요. 첫 기록을 남기면 나의 시간과 취향 흐름이 이곳에 채워져요.",
                            "No records yet. Leave your first record to see your personal timeline report here.",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(15.5))
                        .foregroundStyle(palette.ink)

                        if let onOpenQuickRecord {
                            Button(action: onOpenQuickRecord) {
                                HStack(spacing: 6) {
                                    OttlineLucideIcon(kind: .plus, size: 15, color: palette.onBrandOrange, strokeWidth: 2.2)
                                    Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                                        .font(OttlineFont.semiBold(14))
                                        .foregroundStyle(palette.onBrandOrange)
                                }
                                .padding(.horizontal, 16)
                                .frame(height: 44)
                                .background(palette.brandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(22)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }

                HStack(spacing: 14) {
                    statCard(label: OttlineStrings.tr("전체 기록", "Total logs", locale: locale), value: "\(report.totalLogs)")
                    statCard(label: OttlineStrings.tr("이달 기록", "This month", locale: locale), value: "\(report.thisMonthLogs)")
                    statCard(label: OttlineStrings.tr("완료율", "Completion", locale: locale), value: "\(Int(report.doneRatePct))%")
                    statCard(label: OttlineStrings.tr("주 이용 플랫폼", "Top platform", locale: locale), value: report.topOtt)
                }

                if !report.topGenres.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(OttlineStrings.tr("자주 만난 장르", "Top genres", locale: locale))
                            .font(OttlineFont.bold(16))
                            .foregroundStyle(palette.ink)
                        FlowLayout(horizontalSpacing: 8, verticalSpacing: 8) {
                            ForEach(report.topGenres.prefix(8), id: \.name) { g in
                                Text("\(g.name) · \(g.count)")
                                    .font(OttlineFont.medium(13))
                                    .padding(.horizontal, 12)
                                    .frame(height: 32)
                                    .background(palette.paperStrong)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.card)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                }
            }
            .frame(maxWidth: 1280)
            .padding(.horizontal, 32)
            .padding(.vertical, 24)
            .frame(maxWidth: .infinity)
        }
        .task {
            let local = PersonalReportBuilder.buildFromLocalLogs(repository.logs)
            report = local
            if let remote = try? await repository.api.getPersonalReport() {
                report = PersonalReportBuilder.merging(remote: remote, localLogs: repository.logs)
            }
        }
    }

    private func statCard(label: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(OttlineFont.regular(12)).foregroundStyle(palette.mutedInk)
            Text(value).font(OttlineFont.bold(22)).foregroundStyle(palette.ink)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.card)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
    }
}

// MARK: - Mac Share Card Dialog (`NSSharingServicePicker` + Drag-and-Drop + PNG Pasteboard/File Export)

public struct MacShareCardDialog: View {
    public let log: WatchLog
    @ObservedObject public var repository: OttlineRepository

    @Environment(\.dismiss) private var dismiss
    @Environment(\.ottlinePalette) private var palette
    @Environment(\.appLocale) private var locale

    @State private var ratioKey: String = "9:16"
    @State private var includeRating: Bool = true
    @State private var includeNote: Bool
    @State private var includeSignature: Bool = false
    @State private var renderedImage: NSImage?
    @State private var renderedPngData: Data?
    @State private var dragTempFileUrl: URL?
    @State private var rendering: Bool = false
    @State private var toast: String?
    @State private var shareAnchorNsView: NSView?
    @State private var activeSharePicker: NSSharingServicePicker?

    public init(log: WatchLog, repository: OttlineRepository) {
        self.log = log
        self._repository = ObservedObject(wrappedValue: repository)
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) && !log.spoiler
        self._includeNote = State(initialValue: hasNote)
    }

    public var body: some View {
        let isVertical = ratioKey == "9:16"
        let snap = repository.prefs.snapshot
        let profileComplete = snap.isProfileComplete
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) && !log.spoiler
        let sizeSpecLabel = isVertical ? "1080×1920 (Story)" : "1080×1350 (Feed)"

        VStack(alignment: .leading, spacing: 18) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(OttlineStrings.tr("공유 카드 만들기", "Create a share card", locale: locale))
                        .font(OttlineFont.bold(18))
                        .foregroundStyle(palette.ink)
                    Text(OttlineStrings.tr("저장한 기록을 SNS·메신저용 카드로 나눠보세요.", "Share your saved record as a social card.", locale: locale))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                }
                Spacer()
                Button {
                    dismiss()
                } label: {
                    OttlineLucideIcon(kind: .x, size: 18, color: palette.ink, strokeWidth: 2.0)
                        .frame(width: 34, height: 34)
                        .background(palette.card)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(OttlineStrings.tr("닫기", "Close", locale: locale))
            }

            HStack(alignment: .top, spacing: 22) {
                ZStack(alignment: .topTrailing) {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(palette.mutedBg)
                    if let renderedImage {
                        Image(nsImage: renderedImage)
                            .resizable()
                            .scaledToFit()
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .onDrag {
                                if let url = dragTempFileUrl,
                                   let provider = NSItemProvider(contentsOf: url) {
                                    return provider
                                }
                                return NSItemProvider(object: renderedImage)
                            }
                    } else {
                        ProgressView()
                    }

                    if rendering && renderedImage != nil {
                        ProgressView()
                            .controlSize(.small)
                            .padding(8)
                            .background(palette.card.opacity(0.9))
                            .clipShape(Circle())
                            .padding(10)
                    }
                }
                .frame(width: 280, height: isVertical ? 498 : 350)
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(palette.border, lineWidth: 1))

                VStack(alignment: .leading, spacing: 14) {
                    Text(OttlineStrings.tr("이미지 비율", "Image ratio", locale: locale))
                        .font(OttlineFont.semiBold(13.5))
                        .foregroundStyle(palette.ink)

                    HStack(spacing: 8) {
                        ratioBtn("9:16", OttlineStrings.tr("스토리 (9:16)", "Story (9:16)", locale: locale))
                        ratioBtn("4:5", OttlineStrings.tr("피드 (4:5)", "Feed (4:5)", locale: locale))
                    }

                    OttlineCheckbox(
                        isChecked: $includeRating,
                        label: OttlineStrings.tr("느낌 포함", "Include feeling", locale: locale)
                    )
                    OttlineCheckbox(
                        isChecked: $includeNote,
                        label: OttlineStrings.tr("한 줄 메모 포함", "Include note", locale: locale),
                        isDisabled: !hasNote
                    )
                    if profileComplete {
                        OttlineCheckbox(
                            isChecked: $includeSignature,
                            label: OttlineStrings.tr("아바타와 닉네임 포함", "Include avatar & nickname", locale: locale)
                        )
                    }

                    Text(OttlineStrings.tr(
                        "공유하기로 맥에 설치된 메시지·메모·SNS 앱에 바로 보내거나, 미리보기 카드를 브라우저·메신저 창으로 끌어다 놓을 수 있어요.",
                        "Share directly to Messages, Notes, AirDrop, and Mac social apps, or drag the preview card into any app or browser.",
                        locale: locale
                    ))
                    .font(OttlineFont.regular(12))
                    .foregroundStyle(palette.mutedInk)
                    .lineSpacing(3)

                    if let toast {
                        Text(toast)
                            .font(OttlineFont.medium(12.5))
                            .foregroundStyle(palette.primaryAccent)
                    }

                    Spacer()

                    Button {
                        shareCardViaMacSheet()
                    } label: {
                        HStack(spacing: 7) {
                            OttlineLucideIcon(kind: .share2, size: 15, color: palette.onBrandOrange, strokeWidth: 2.1)
                            Text(OttlineStrings.tr("공유하기…", "Share…", locale: locale))
                                .font(OttlineFont.semiBold(14.5))
                                .foregroundStyle(palette.onBrandOrange)
                        }
                        .frame(maxWidth: .infinity, minHeight: 46)
                        .background(
                            ZStack {
                                palette.brandOrange
                                MacShareAnchorView { nsView in
                                    shareAnchorNsView = nsView
                                }
                            }
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .disabled(renderedImage == nil)

                    HStack(spacing: 8) {
                        Button {
                            guard let data = resolvedPngData() else { return }
                            if MacImageExportHelper.savePngDataWithPanel(data, defaultName: "\(log.title.name)-ottline.png") {
                                toast = OttlineStrings.tr("PNG 파일로 저장했어요.", "Saved as PNG.", locale: locale)
                            }
                        } label: {
                            HStack(spacing: 5) {
                                OttlineLucideIcon(kind: .download, size: 14, color: palette.ink, strokeWidth: 2.0)
                                Text(OttlineStrings.tr("PNG 저장…", "Save PNG…", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.ink)
                            }
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(renderedImage == nil)

                        Button {
                            guard let img = renderedImage, let data = resolvedPngData() else { return }
                            MacImageExportHelper.copyPngToPasteboard(data: data, image: img)
                            toast = OttlineStrings.tr("클립보드에 복사했어요. SNS에 ⌘V로 붙여넣으세요.", "Copied! Press ⌘V in any social app.", locale: locale)
                        } label: {
                            HStack(spacing: 5) {
                                OttlineLucideIcon(kind: .copy, size: 14, color: palette.ink, strokeWidth: 2.0)
                                Text(OttlineStrings.tr("이미지 복사", "Copy image", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.ink)
                            }
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(renderedImage == nil)
                    }

                    Text(OttlineStrings.tr("이미지 크기: \(sizeSpecLabel)", "Image size: \(sizeSpecLabel)", locale: locale))
                        .font(OttlineFont.regular(11.5))
                        .foregroundStyle(palette.subtleInk)
                }
                .frame(width: 274)
            }
        }
        .padding(24)
        .frame(minWidth: 620, minHeight: 590)
        .background(palette.background)
        .task(id: "\(ratioKey)-\(includeRating)-\(includeNote)-\(includeSignature)") {
            await renderCard()
        }
    }

    private func ratioBtn(_ key: String, _ title: String) -> some View {
        let active = ratioKey == key
        return Button {
            ratioKey = key
        } label: {
            Text(title)
                .font(active ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                .foregroundStyle(active ? palette.primaryAccent : palette.ink)
                .padding(.horizontal, 12)
                .frame(height: 36)
                .background(active ? palette.paperStrong : palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(active ? palette.primaryAccent : palette.border, lineWidth: active ? 1.5 : 1))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func resolvedPngData() -> Data? {
        if let renderedPngData { return renderedPngData }
        if let renderedImage { return MacImageExportHelper.pngData(from: renderedImage) }
        return nil
    }

    @MainActor
    private func shareCardViaMacSheet() {
        guard let data = resolvedPngData(),
              let fileUrl = MacImageExportHelper.writeTempSharePng(data: data, titleName: log.title.name) else {
            return
        }
        dragTempFileUrl = fileUrl

        let picker = NSSharingServicePicker(items: [fileUrl])
        activeSharePicker = picker

        if let anchor = shareAnchorNsView, anchor.window != nil {
            picker.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
        } else if let contentView = NSApp.keyWindow?.contentView {
            let rect = NSRect(x: contentView.bounds.midX, y: contentView.bounds.midY, width: 1, height: 1)
            picker.show(relativeTo: rect, of: contentView, preferredEdge: .minY)
        }
    }

    @MainActor
    private func renderCard() async {
        rendering = true
        let snap = repository.prefs.snapshot
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) && !log.spoiler
        let trimmedNick = snap.nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
        let signatureEnabled = snap.isProfileComplete && includeSignature && (trimmedNick?.isEmpty == false) && snap.personaKey != nil

        // Render locally on-device (matching iOS & Android native) using cached poster art so preview & toggles finish in <150ms.
        let image = await MacImageExportHelper.renderShareCardImage(
            log: log,
            ratioKey: ratioKey,
            showRatingLabel: includeRating,
            includeNote: includeNote && hasNote,
            includeSignature: signatureEnabled,
            nickname: trimmedNick,
            personaKey: snap.personaKey,
            locale: locale
        )
        renderedImage = image

        let titleName = log.title.name
        let encoded: (Data?, URL?) = await Task.detached(priority: .userInitiated) {
            let png = MacImageExportHelper.pngData(from: image)
            let url = png.flatMap { MacImageExportHelper.writeTempSharePng(data: $0, titleName: titleName) }
            return (png, url)
        }.value

        renderedPngData = encoded.0
        dragTempFileUrl = encoded.1
        rendering = false
    }
}

private struct MacShareAnchorView: NSViewRepresentable {
    let onResolve: (NSView) -> Void

    func makeNSView(context: Context) -> NSView {
        let view = NSView(frame: .zero)
        DispatchQueue.main.async {
            onResolve(view)
        }
        return view
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        DispatchQueue.main.async {
            onResolve(nsView)
        }
    }
}

public enum MacImageExportHelper {
    private static func nsColor(hex: UInt32, alpha: CGFloat = 1.0) -> NSColor {
        NSColor(
            srgbRed: CGFloat((hex >> 16) & 0xFF) / 255.0,
            green: CGFloat((hex >> 8) & 0xFF) / 255.0,
            blue: CGFloat(hex & 0xFF) / 255.0,
            alpha: alpha
        )
    }

    private static func drawBitmapImage(
        pointSize: CGSize,
        scale: CGFloat = 2.0,
        draw: (CGContext, CGRect) -> Void
    ) -> NSImage {
        let pixelW = max(1, Int((pointSize.width * scale).rounded()))
        let pixelH = max(1, Int((pointSize.height * scale).rounded()))
        guard let rep = NSBitmapImageRep(
            bitmapDataPlanes: nil,
            pixelsWide: pixelW,
            pixelsHigh: pixelH,
            bitsPerSample: 8,
            samplesPerPixel: 4,
            hasAlpha: true,
            isPlanar: false,
            colorSpaceName: .deviceRGB,
            bytesPerRow: 0,
            bitsPerPixel: 0
        ) else {
            return NSImage(size: pointSize)
        }
        rep.size = pointSize
        if let baseCtx = NSGraphicsContext(bitmapImageRep: rep) {
            let cg = baseCtx.cgContext
            cg.saveGState()
            cg.translateBy(x: 0, y: pointSize.height)
            cg.scaleBy(x: 1, y: -1)
            let flippedCtx = NSGraphicsContext(cgContext: cg, flipped: true)
            NSGraphicsContext.saveGraphicsState()
            NSGraphicsContext.current = flippedCtx
            draw(cg, CGRect(origin: .zero, size: pointSize))
            NSGraphicsContext.restoreGraphicsState()
            cg.restoreGState()
        }
        let img = NSImage(size: pointSize)
        img.addRepresentation(rep)
        return img
    }

    @MainActor
    public static func renderRecoveryCardImage(pairingCode: String, nickname: String?, locale: String) -> NSImage {
        let size = CGSize(width: 520, height: 260)
        return drawBitmapImage(pointSize: size) { _, bounds in
            nsColor(hex: 0xF8F6F2).setFill()
            bounds.fill()

            let pad: CGFloat = 28
            let contentWidth = bounds.width - pad * 2
            var cursorY: CGFloat = 28

            let brandAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 13, weight: .bold),
                .foregroundColor: nsColor(hex: 0x1E4D8C)
            ]
            ("ottline · ON THE TIMELINE" as NSString).draw(
                in: CGRect(x: pad, y: cursorY, width: contentWidth, height: 20),
                withAttributes: brandAttrs
            )
            cursorY += 28

            let heading = locale == "en" ? "Record Connection Card" : "기록 연결 보관 카드"
            let headingAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 20, weight: .bold),
                .foregroundColor: nsColor(hex: 0x0F0F0F)
            ]
            (heading as NSString).draw(
                in: CGRect(x: pad, y: cursorY, width: contentWidth, height: 28),
                withAttributes: headingAttrs
            )
            cursorY += 34

            if let nick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines), !nick.isEmpty {
                let nickAttrs: [NSAttributedString.Key: Any] = [
                    .font: NSFont.systemFont(ofSize: 14, weight: .medium),
                    .foregroundColor: nsColor(hex: 0x4A4A4A)
                ]
                (nick as NSString).draw(
                    in: CGRect(x: pad, y: cursorY, width: contentWidth, height: 22),
                    withAttributes: nickAttrs
                )
                cursorY += 30
            }

            let boxRect = CGRect(x: pad, y: cursorY + 4, width: contentWidth, height: 64)
            let boxPath = NSBezierPath(roundedRect: boxRect, xRadius: 8, yRadius: 8)
            nsColor(hex: 0xFEF9EE).setFill()
            boxPath.fill()

            let para = NSMutableParagraphStyle()
            para.alignment = .center
            let codeAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.monospacedSystemFont(ofSize: 26, weight: .bold),
                .foregroundColor: nsColor(hex: 0x0F0F0F),
                .paragraphStyle: para
            ]
            let codeRect = CGRect(x: boxRect.minX + 12, y: boxRect.minY + 16, width: boxRect.width - 24, height: 34)
            (pairingCode as NSString).draw(in: codeRect, withAttributes: codeAttrs)
        }
    }

    private static func pretendardFont(name: String, size: CGFloat, weight: NSFont.Weight) -> NSFont {
        NSFont(name: name, size: size) ?? NSFont.systemFont(ofSize: size, weight: weight)
    }

    private static func extractAdaptiveDarkColors(from image: NSImage?) -> (top: NSColor, content: NSColor) {
        let fallbackTop = nsColor(hex: 0x0B0C10)
        let fallbackContent = nsColor(hex: 0x0B1224)
        guard let cg = image?.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            return (fallbackTop, fallbackContent)
        }
        var pixel = [UInt8](repeating: 0, count: 4)
        guard let ctx = CGContext(
            data: &pixel,
            width: 1,
            height: 1,
            bitsPerComponent: 8,
            bytesPerRow: 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            return (fallbackTop, fallbackContent)
        }
        ctx.interpolationQuality = .medium
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: 1, height: 1))
        let r = CGFloat(pixel[0]) / 255.0
        let g = CGFloat(pixel[1]) / 255.0
        let b = CGFloat(pixel[2]) / 255.0
        if r + g + b < 0.05 {
            return (fallbackTop, fallbackContent)
        }
        let top = NSColor(srgbRed: max(0.04, r * 0.20), green: max(0.04, g * 0.20), blue: max(0.06, b * 0.20), alpha: 1.0)
        let content = NSColor(srgbRed: max(0.04, r * 0.25), green: max(0.05, g * 0.25), blue: max(0.08, b * 0.25), alpha: 1.0)
        return (top, content)
    }

    private static func drawAspectFill(image: NSImage, in box: CGRect, verticalAnchor: CGFloat, cg: CGContext) {
        let imgSize = image.size
        guard imgSize.width > 0, imgSize.height > 0 else { return }
        let scale = max(box.width / imgSize.width, box.height / imgSize.height)
        let drawW = imgSize.width * scale
        let drawH = imgSize.height * scale
        let dx = box.minX + (box.width - drawW) * 0.5
        let dy = box.minY - max(0, drawH - box.height) * verticalAnchor
        cg.saveGState()
        cg.addRect(box)
        cg.clip()
        image.draw(
            in: CGRect(x: dx, y: dy, width: drawW, height: drawH),
            from: .zero,
            operation: .sourceOver,
            fraction: 1.0,
            respectFlipped: true,
            hints: [.interpolation: NSImageInterpolation.high]
        )
        cg.restoreGState()
    }

    private static func drawWrappedText(
        _ text: String,
        font: NSFont,
        color: NSColor,
        x: CGFloat,
        y: CGFloat,
        maxWidth: CGFloat,
        maxHeight: CGFloat
    ) -> CGRect {
        let style = NSMutableParagraphStyle()
        style.lineBreakMode = .byWordWrapping
        style.lineSpacing = 6
        let attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: style
        ]
        let ns = text as NSString
        let bound = ns.boundingRect(
            with: CGSize(width: maxWidth, height: maxHeight),
            options: [.usesLineFragmentOrigin, .usesFontLeading],
            attributes: attrs
        )
        let drawRect = CGRect(x: x, y: y, width: maxWidth, height: min(maxHeight, ceil(bound.height)))
        ns.draw(in: drawRect, withAttributes: attrs)
        return drawRect
    }

    /// Instant on-device share card renderer (`1080×1920` Story or `1080×1350` Feed) using `OttlinePosterImageCache`.
    public static func renderShareCardImage(
        log: WatchLog,
        ratioKey: String,
        showRatingLabel: Bool = true,
        includeNote: Bool = true,
        includeSignature: Bool = false,
        nickname: String? = nil,
        personaKey: PersonaKey? = nil,
        locale: String = "ko"
    ) async -> NSImage {
        let rawPoster = (log.seasonPosterUrl?.isEmpty == false ? log.seasonPosterUrl : log.title.posterUrl)
        let candidateUrls = MacFeaturedPosterView.candidateUrls(posterUrl: rawPoster, titleType: log.title.type)
        let posterImage = await OttlinePosterImageCache.shared.loadFirstAvailable(urls: candidateUrls)
        return await MainActor.run {
            drawShareCard(
                log: log,
                posterImage: posterImage,
                ratioKey: ratioKey,
                showRatingLabel: showRatingLabel,
                includeNote: includeNote,
                includeSignature: includeSignature,
                nickname: nickname,
                personaKey: personaKey,
                locale: locale
            )
        }
    }

    @MainActor
    public static func renderFallbackShareCard(log: WatchLog, ratioKey: String, locale: String) -> NSImage {
        let hasNote = !(log.note?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ?? true) && !log.spoiler
        return drawShareCard(
            log: log,
            posterImage: nil,
            ratioKey: ratioKey,
            showRatingLabel: true,
            includeNote: hasNote,
            includeSignature: false,
            nickname: nil,
            personaKey: nil,
            locale: locale
        )
    }

    @MainActor
    private static func drawShareCard(
        log: WatchLog,
        posterImage: NSImage?,
        ratioKey: String,
        showRatingLabel: Bool,
        includeNote: Bool,
        includeSignature: Bool,
        nickname: String?,
        personaKey: PersonaKey?,
        locale: String
    ) -> NSImage {
        let isFeed = ratioKey != "9:16"
        let w: CGFloat = 1080
        let h: CGFloat = isFeed ? 1350 : 1920
        let scale: CGFloat = isFeed ? 0.8 : 1.0
        func s(_ val: CGFloat) -> CGFloat { (val * scale).rounded() }
        let isBook = log.title.type == .book

        let (topColor, contentBgColor) = extractAdaptiveDarkColors(from: posterImage)

        return drawBitmapImage(pointSize: CGSize(width: w, height: h), scale: 1.0) { cg, _ in
            let topHeight = h * 0.70

            topColor.setFill()
            cg.fill(CGRect(x: 0, y: 0, width: w, height: topHeight))
            contentBgColor.setFill()
            cg.fill(CGRect(x: 0, y: topHeight, width: w, height: h - topHeight))

            if let posterImage {
                drawAspectFill(
                    image: posterImage,
                    in: CGRect(x: 0, y: 0, width: w, height: topHeight),
                    verticalAnchor: isBook ? 0.0 : 0.12,
                    cg: cg
                )
            } else {
                let fallbackFont = pretendardFont(name: "Pretendard-Bold", size: s(52), weight: .bold)
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: fallbackFont,
                    .foregroundColor: NSColor.white.withAlphaComponent(0.35)
                ]
                (log.title.name as NSString).draw(
                    in: CGRect(x: s(88), y: topHeight * 0.4, width: w - s(176), height: s(200)),
                    withAttributes: attrs
                )
            }

            // Gradient fade at bottom 36% of poster area
            let gradTop = topHeight * 0.64
            let colors = [contentBgColor.withAlphaComponent(0.0).cgColor, contentBgColor.cgColor] as CFArray
            if let gradient = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0.0, 1.0]) {
                cg.saveGState()
                cg.addRect(CGRect(x: 0, y: gradTop, width: w, height: topHeight - gradTop + 2))
                cg.clip()
                cg.drawLinearGradient(
                    gradient,
                    start: CGPoint(x: 0, y: gradTop),
                    end: CGPoint(x: 0, y: topHeight + 2),
                    options: []
                )
                cg.restoreGState()
            }

            // Content Stack
            let contentLeft = s(88)
            let maxWidth = w - s(176)
            var cursorY = topHeight + s(64)

            let titleFont = pretendardFont(name: "Pretendard-Bold", size: s(isBook ? 64 : 84), weight: .bold)
            let titleText = String(log.title.name.prefix(60))
            let titleRect = drawWrappedText(
                titleText,
                font: titleFont,
                color: .white,
                x: contentLeft,
                y: cursorY,
                maxWidth: maxWidth,
                maxHeight: s(190)
            )
            cursorY += titleRect.height + s(18)

            if includeNote, !log.spoiler, let note = log.note?.trimmingCharacters(in: .whitespacesAndNewlines), !note.isEmpty {
                let clamped = "“\(String(note.replacingOccurrences(of: "\n", with: " ").prefix(isBook ? 120 : 80)))”"
                let noteFont = pretendardFont(name: "Pretendard-Medium", size: s(isBook ? 40 : 38), weight: .medium)
                let noteColor = nsColor(hex: 0xDBE4FF)
                let noteRect = drawWrappedText(
                    clamped,
                    font: noteFont,
                    color: noteColor,
                    x: contentLeft,
                    y: cursorY,
                    maxWidth: maxWidth,
                    maxHeight: s(130)
                )
                cursorY += noteRect.height + s(18)
            }

            // Capsule pills
            let statusLabel = OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale)
            let feelingLabel = showRatingLabel
                ? RecordFeelings.resolveFeeling(rating: log.rating, isBook: isBook, locale: locale)?.label
                : nil
            let dateStr = RecordDate.formatDotDate(log.watchedAt.isEmpty ? log.createdAt : log.watchedAt)

            var pills = [statusLabel]
            if let feelingLabel { pills.append(feelingLabel) }
            pills.append(dateStr)

            let pillFont = pretendardFont(name: "Pretendard-SemiBold", size: s(isBook ? 26 : 28), weight: .semibold)
            let pillTextColor = nsColor(hex: 0xCBD5F5)
            var pillX = contentLeft
            let pillH = s(48)

            for pill in pills {
                let textSize = (pill as NSString).size(withAttributes: [.font: pillFont])
                let pillW = textSize.width + s(32)
                let rect = CGRect(x: pillX, y: cursorY, width: pillW, height: pillH)
                let path = NSBezierPath(roundedRect: rect, xRadius: pillH / 2, yRadius: pillH / 2)
                NSColor.white.withAlphaComponent(0.08).setFill()
                path.fill()
                (pill as NSString).draw(
                    at: CGPoint(x: pillX + s(16), y: cursorY + (pillH - textSize.height) / 2),
                    withAttributes: [.font: pillFont, .foregroundColor: pillTextColor]
                )
                pillX += pillW + s(12)
            }

            // Footer signature with real persona avatar asset when available
            let footerY = h - s(92)
            let wmFont = pretendardFont(name: "Pretendard-Medium", size: s(26), weight: .medium)
            var textX = contentLeft
            let trimmedNick = nickname?.trimmingCharacters(in: .whitespacesAndNewlines)
            let showSig = includeSignature && (trimmedNick?.isEmpty == false)
            if showSig,
               let pKey = personaKey,
               let preset = OttlineStrings.personaPresets.first(where: { $0.key == pKey }),
               let avatarImg = NSImage(named: NSImage.Name(preset.assetName)) {
                let avatarSize = s(40)
                let avatarRect = CGRect(x: contentLeft, y: footerY - s(6), width: avatarSize, height: avatarSize)
                cg.saveGState()
                NSBezierPath(roundedRect: avatarRect, xRadius: s(12), yRadius: s(12)).addClip()
                avatarImg.draw(
                    in: avatarRect,
                    from: .zero,
                    operation: .sourceOver,
                    fraction: 1.0,
                    respectFlipped: true,
                    hints: [.interpolation: NSImageInterpolation.high]
                )
                cg.restoreGState()
                textX += avatarSize + s(16)
            }
            let footerText: String = {
                if showSig, let nick = trimmedNick {
                    return "\(nick) · by ottline.app"
                }
                return "ottline.app"
            }()
            (footerText as NSString).draw(
                at: CGPoint(x: textX, y: footerY),
                withAttributes: [.font: wmFont, .foregroundColor: NSColor.white.withAlphaComponent(0.75)]
            )
        }
    }

    public static func pngData(from image: NSImage) -> Data? {
        if let directRep = image.representations.compactMap({ $0 as? NSBitmapImageRep }).first,
           let data = directRep.representation(using: .png, properties: [:]) {
            return data
        }
        guard let tiff = image.tiffRepresentation,
              let rep = NSBitmapImageRep(data: tiff) else {
            return nil
        }
        return rep.representation(using: .png, properties: [:])
    }

    public static func writeTempSharePng(data: Data, titleName: String) -> URL? {
        let invalid = CharacterSet(charactersIn: "/:\\\n\r\t")
        let cleaned = titleName
            .components(separatedBy: invalid)
            .joined(separator: " ")
            .split(whereSeparator: { $0.isWhitespace })
            .joined(separator: "-")
        let safeStem = cleaned.isEmpty ? "record" : String(cleaned.prefix(60))
        let fileUrl = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(safeStem)-ottline.png")
        do {
            try data.write(to: fileUrl, options: .atomic)
            return fileUrl
        } catch {
            return nil
        }
    }

    @MainActor
    public static func copyPngToPasteboard(data: Data, image: NSImage) {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.writeObjects([image])
        pb.setData(data, forType: .png)
    }

    @MainActor
    @discardableResult
    public static func savePngDataWithPanel(_ pngData: Data, defaultName: String) -> Bool {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.png]
        panel.nameFieldStringValue = defaultName
        guard panel.runModal() == .OK, let url = panel.url else {
            return false
        }
        do {
            try pngData.write(to: url)
            return true
        } catch {
            return false
        }
    }

    @MainActor
    @discardableResult
    public static func savePngWithPanel(_ image: NSImage, defaultName: String) -> Bool {
        guard let data = pngData(from: image) else { return false }
        return savePngDataWithPanel(data, defaultName: defaultName)
    }

    @MainActor
    @discardableResult
    public static func saveCsvWithPanel(_ csvString: String, defaultName: String) -> Bool {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.commaSeparatedText]
        panel.nameFieldStringValue = defaultName
        guard panel.runModal() == .OK, let url = panel.url else {
            return false
        }
        do {
            try csvString.write(to: url, atomically: true, encoding: .utf8)
            return true
        } catch {
            return false
        }
    }
}

// MARK: - Mac Menu Bar Quick Log Popover

public struct MacMenuBarQuickLogView: View {
    @ObservedObject public var repository: OttlineRepository
    @Bindable public var appState: OttlineMacAppState

    @Environment(\.openWindow) private var openWindow
    @Environment(\.colorScheme) private var colorScheme

    @State private var query: String = ""
    @State private var results: [TitleSearchItem] = []
    @State private var searching: Bool = false
    @State private var feedbackMsg: String?

    public var body: some View {
        let snap = repository.prefs.snapshot
        let locale = snap.locale
        let isDark: Bool = {
            switch snap.themeMode {
            case .system: return colorScheme == .dark
            case .dark: return true
            case .light: return false
            }
        }()
        let palette = isDark ? OttlinePalette.dark : OttlinePalette.light
        let continuing = repository.logs.first(where: { $0.status == .inProgress })

        VStack(alignment: .leading, spacing: 12) {
            HStack {
                HStack(spacing: 6) {
                    OttlineBrandMark(size: 22)
                    Text("ottline")
                        .font(OttlineFont.bold(16))
                        .foregroundStyle(palette.primaryAccent)
                }
                Spacer()
                Button {
                    NSApp.activate(ignoringOtherApps: true)
                    openWindow(id: "main")
                } label: {
                    Text(OttlineStrings.tr("기록장 열기 ↗", "Open window ↗", locale: locale))
                        .font(OttlineFont.semiBold(12))
                        .foregroundStyle(palette.primaryAccent)
                }
                .buttonStyle(.plain)
            }

            if let feedbackMsg {
                Text(feedbackMsg)
                    .font(OttlineFont.medium(12))
                    .foregroundStyle(palette.primaryAccent)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
            }

            if let continuing {
                HStack(spacing: 10) {
                    PosterImage(posterUrl: continuing.seasonPosterUrl ?? continuing.title.posterUrl, titleName: continuing.title.name, titleType: continuing.title.type, width: 34, height: 50, cornerRadius: 3)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(OttlineStrings.tr("아직 못다 한 이야기", "Stories still unfolding", locale: locale))
                            .font(OttlineFont.semiBold(10.5))
                            .foregroundStyle(palette.primaryAccent)
                        Text(continuing.title.name)
                            .font(OttlineFont.bold(13.5))
                            .foregroundStyle(palette.ink)
                            .lineLimit(1)
                    }
                    Spacer()
                    Button(OttlineStrings.tr("완료", "Done", locale: locale)) {
                        Task {
                            let draft = LogDraft(
                                status: .done,
                                rating: continuing.rating,
                                note: continuing.note,
                                ott: continuing.ott,
                                seasonNumber: continuing.seasonNumber,
                                episodeNumber: continuing.episodeNumber,
                                seasonPosterUrl: continuing.seasonPosterUrl,
                                seasonYear: continuing.seasonYear,
                                watchedAt: RecordDate.todayIsoDateTime(),
                                place: continuing.place,
                                occasion: continuing.occasion
                            )
                            _ = await repository.saveLogForTitle(
                                candidateTitle: continuing.title,
                                draft: draft,
                                existingLogId: continuing.id,
                                source: "macos_menubar"
                            )
                            feedbackMsg = OttlineStrings.tr("‘\(continuing.title.name)’ 완료로 남겼어요.", "Marked ‘\(continuing.title.name)’ done.", locale: locale)
                        }
                    }
                    .buttonStyle(.plain)
                    .font(OttlineFont.semiBold(11.5))
                    .padding(.horizontal, 10)
                    .frame(height: 28)
                    .background(palette.brandOrange)
                    .foregroundStyle(palette.onBrandOrange)
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .padding(8)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            }

            TextField(
                OttlineStrings.tr("빠른 검색 후 1초 만에 남기기…", "Search to quick log…", locale: locale),
                text: $query
            )
            .textFieldStyle(.plain)
            .font(OttlineFont.regular(13))
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))

            let trimmedQuery = query.trimmingCharacters(in: .whitespacesAndNewlines)
            if searching {
                ProgressView().frame(maxWidth: .infinity, minHeight: 80)
            } else if trimmedQuery.isEmpty {
                if repository.logs.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(OttlineStrings.tr(
                            "첫 기록을 남겨보세요. 타임라인이 바로 시작돼요.",
                            "Leave your first record. Your timeline starts here.",
                            locale: locale
                        ))
                        .font(OttlineFont.semiBold(13))
                        .foregroundStyle(palette.ink)

                        Text(OttlineStrings.tr(
                            "위 검색창에서 작품을 바로 찾거나, 기록장을 열어 첫 순간을 남겨보세요.",
                            "Search a title above, or open the logbook to leave your first moment.",
                            locale: locale
                        ))
                        .font(OttlineFont.regular(11.5))
                        .foregroundStyle(palette.mutedInk)

                        Button {
                            NSApp.activate(ignoringOtherApps: true)
                            openWindow(id: "main")
                            appState.quickRecordRequest = QuickRecordRequest(autoFocusSearch: true)
                        } label: {
                            HStack(spacing: 4) {
                                OttlineLucideIcon(kind: .plus, size: 13, color: palette.onBrandOrange, strokeWidth: 2.2)
                                Text(OttlineStrings.tr("첫 기록 남기기", "Leave your first record", locale: locale))
                                    .font(OttlineFont.semiBold(12))
                                    .foregroundStyle(palette.onBrandOrange)
                            }
                            .padding(.horizontal, 12)
                            .frame(height: 34)
                            .background(palette.brandOrange)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .padding(.top, 2)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(palette.paperStrong)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
                } else {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(OttlineStrings.tr("최근 남긴 기록", "Recent records", locale: locale))
                            .font(OttlineFont.semiBold(11))
                            .foregroundStyle(palette.mutedInk)

                        ForEach(Array(repository.logs.prefix(3))) { log in
                            Button {
                                NSApp.activate(ignoringOtherApps: true)
                                openWindow(id: "main")
                                appState.overlayStack = [.titleDetail(log.title.id)]
                            } label: {
                                HStack(spacing: 8) {
                                    PosterImage(
                                        posterUrl: log.seasonPosterUrl ?? log.title.posterUrl,
                                        titleName: log.title.name,
                                        titleType: log.title.type,
                                        width: 26,
                                        height: 38,
                                        cornerRadius: 3
                                    )
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(log.title.name)
                                            .font(OttlineFont.medium(12.5))
                                            .foregroundStyle(palette.ink)
                                            .lineLimit(1)
                                        Text(OttlineStrings.statusLabel(log.status, type: log.title.type, locale: locale))
                                            .font(OttlineFont.regular(11))
                                            .foregroundStyle(palette.mutedInk)
                                    }
                                    Spacer()
                                    Text("→")
                                        .font(OttlineFont.semiBold(11.5))
                                        .foregroundStyle(palette.primaryAccent)
                                }
                                .padding(7)
                                .background(palette.card)
                                .clipShape(RoundedRectangle(cornerRadius: 7))
                                .overlay(RoundedRectangle(cornerRadius: 7).stroke(palette.border, lineWidth: 1))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            } else if results.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text(OttlineStrings.tr("일치하는 작품을 찾지 못했어요.", "No matching titles found.", locale: locale))
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)

                    Button {
                        NSApp.activate(ignoringOtherApps: true)
                        openWindow(id: "main")
                        appState.quickRecordRequest = QuickRecordRequest(initialQuery: trimmedQuery, autoFocusSearch: true)
                    } label: {
                        Text(OttlineStrings.tr("기록장에서 자세히 찾기 →", "Search in logbook →", locale: locale))
                            .font(OttlineFont.semiBold(12))
                            .foregroundStyle(palette.primaryAccent)
                    }
                    .buttonStyle(.plain)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(palette.border, lineWidth: 1))
            } else {
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(results.prefix(5)) { item in
                            HStack(spacing: 8) {
                                Text(item.name)
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.ink)
                                    .lineLimit(1)
                                Spacer()
                                Button(OttlineStrings.statusLabel(.done, type: item.type, locale: locale)) {
                                    Task {
                                        let draft = LogDraft(status: .done, watchedAt: RecordDate.todayIsoDateTime())
                                        _ = await repository.saveLogForTitle(
                                            candidateTitle: item.toNewTitle(),
                                            draft: draft,
                                            source: "macos_menubar"
                                        )
                                        query = ""
                                        results = []
                                        feedbackMsg = OttlineStrings.tr("‘\(item.name)’ 기록을 남겼어요.", "Saved ‘\(item.name)’.", locale: locale)
                                    }
                                }
                                .buttonStyle(.plain)
                                .font(OttlineFont.semiBold(11.5))
                                .padding(.horizontal, 9)
                                .frame(height: 26)
                                .background(palette.brandOrange)
                                .foregroundStyle(palette.onBrandOrange)
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            .padding(8)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 7))
                        }
                    }
                }
                .frame(maxHeight: 210)
            }
        }
        .padding(14)
        .frame(width: 360)
        .background(palette.background)
        .task(id: query) {
            let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else {
                results = []
                searching = false
                return
            }
            searching = true
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            results = (try? await repository.api.searchTitles(query: trimmed, typeFilter: nil)) ?? []
            searching = false
        }
    }
}
