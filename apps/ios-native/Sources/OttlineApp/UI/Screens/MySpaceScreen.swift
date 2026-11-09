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
    @State private var pairingExpanded: Bool = false
    @State private var editNickname: String = ""
    @State private var editPersonaKey: PersonaKey = .cinemaKeeper
    @State private var savingProfile: Bool = false

    @State private var inputPairingCode: String = ""
    @State private var showPairConfirmAlert: Bool = false
    @State private var pairingBusy: Bool = false
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
        let activePreset = OttlineStrings.personaPreset(snap.personaKey)

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(OttlineStrings.tr("내 공간", "My Space", locale: locale))
                    .font(OttlineFont.semiBold(24))
                    .foregroundStyle(palette.ink)

                if let toastMessage {
                    Text(toastMessage)
                        .font(OttlineFont.medium(13))
                        .foregroundStyle(palette.success)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(palette.successSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                // 1. Progressive-Disclosure Storybook Profile Card
                VStack(alignment: .leading, spacing: 14) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            profileExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 14) {
                            PersonaAvatar(personaKey: snap.personaKey, size: 54)
                            VStack(alignment: .leading, spacing: 4) {
                                Text((snap.nickname?.isEmpty == false)
                                    ? snap.nickname!
                                    : OttlineStrings.tr("이름 없는 기록자", "Quiet Recorder", locale: locale)
                                )
                                .font(OttlineFont.semiBold(17))
                                .foregroundStyle(palette.ink)

                                Text(activePreset.title(locale))
                                    .font(OttlineFont.medium(13))
                                    .foregroundStyle(palette.primaryAccent)
                            }
                            Spacer()
                            Image(systemName: profileExpanded ? "chevron.up" : "chevron.down")
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .buttonStyle(.plain)

                    if profileExpanded {
                        Divider().overlay(palette.border)

                        TextField(
                            OttlineStrings.tr("부르고 싶은 이름 (최대 24자)", "Nickname (up to 24 chars)", locale: locale),
                            text: $editNickname
                        )
                        .font(OttlineFont.regular(14))
                        .padding(11)
                        .background(palette.paperStrong)
                        .clipShape(RoundedRectangle(cornerRadius: 8))

                        Text(OttlineStrings.tr("스토리북 캐릭터 고르기", "Choose your storybook persona", locale: locale))
                            .font(OttlineFont.semiBold(13))
                            .foregroundStyle(palette.ink)

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                            ForEach(OttlineStrings.personaPresets, id: \.key) { preset in
                                let selected = editPersonaKey == preset.key
                                Button {
                                    editPersonaKey = preset.key
                                } label: {
                                    HStack(spacing: 10) {
                                        PersonaAvatar(personaKey: preset.key, size: 40)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(preset.title(locale))
                                                .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.medium(12.5))
                                                .foregroundStyle(palette.ink)
                                                .lineLimit(2)
                                                .multilineTextAlignment(.leading)
                                        }
                                        Spacer()
                                    }
                                    .padding(10)
                                    .background(selected ? palette.paperStrong : palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(selected ? palette.primaryAccent : palette.border, lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        Button {
                            Task { await saveProfile() }
                        } label: {
                            Text(savingProfile
                                ? OttlineStrings.tr("저장 중...", "Saving...", locale: locale)
                                : OttlineStrings.tr("프로필 저장", "Save profile", locale: locale)
                            )
                            .font(OttlineFont.semiBold(14))
                            .foregroundStyle(palette.onBrandNavy)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(palette.brandNavy)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                        .disabled(savingProfile)
                    }
                }
                .padding(16)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 2. Quick Destinations: Report & KDC Bookshelf
                VStack(spacing: 10) {
                    navCardRow(
                        icon: "chart.bar.doc.horizontal",
                        title: OttlineStrings.tr("개인 이용 리포트 · 리캡 카드", "Personal Report & Recap Studio", locale: locale),
                        subtitle: OttlineStrings.tr("주간·월간·상반기 기록을 포스터 카드로 돌아봐요", "Look back on your records with poster cards", locale: locale),
                        action: onOpenReport
                    )

                    if locale == "ko" {
                        navCardRow(
                            icon: "books.vertical",
                            title: "내 서가 (한국십진분류법 000~900)",
                            subtitle: "남긴 책들을 주제별 서가 칸으로 정리해 보여드려요",
                            action: onOpenBookshelf
                        )
                    }
                }

                // 3. Foldable Device Pairing & Recovery Card Section
                VStack(alignment: .leading, spacing: 14) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            pairingExpanded.toggle()
                        }
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(OttlineStrings.tr("연결 코드 · 기기 관리", "Connection Code & Devices", locale: locale))
                                    .font(OttlineFont.semiBold(16))
                                    .foregroundStyle(palette.ink)
                                Text(OttlineStrings.tr(
                                    "회원가입 없이 웹·아이폰·아이패드·안드로이드를 하나로 이어줘요",
                                    "Link Web, iPhone, iPad, and Android without an account",
                                    locale: locale
                                ))
                                .font(OttlineFont.regular(12.5))
                                .foregroundStyle(palette.mutedInk)
                            }
                            Spacer()
                            Image(systemName: pairingExpanded ? "chevron.up" : "chevron.down")
                                .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .buttonStyle(.plain)

                    if pairingExpanded {
                        Divider().overlay(palette.border)

                        if let code = snap.pairingCode, !code.isEmpty {
                            VStack(alignment: .leading, spacing: 10) {
                                Text(OttlineStrings.tr("내 연결 코드", "My connection code", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.mutedInk)

                                HStack {
                                    Text(code)
                                        .font(.system(size: 20, weight: .bold, design: .monospaced))
                                        .foregroundStyle(palette.ink)
                                    Spacer()
                                    Button {
                                        #if canImport(UIKit)
                                        UIPasteboard.general.string = code
                                        #endif
                                        toastMessage = OttlineStrings.tr("연결 코드를 복사했어요.", "Copied connection code.", locale: locale)
                                    } label: {
                                        Text(OttlineStrings.tr("복사", "Copy", locale: locale))
                                            .font(OttlineFont.semiBold(13))
                                            .foregroundStyle(palette.primaryAccent)
                                    }
                                    .buttonStyle(.plain)
                                }
                                .padding(12)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                                Button {
                                    #if canImport(UIKit)
                                    let img = CardExporter.renderRecoveryCardImage(
                                        pairingCode: code,
                                        nickname: snap.nickname,
                                        locale: locale
                                    )
                                    CardExporter.saveImageToPhotos(img)
                                    toastMessage = OttlineStrings.tr(
                                        "개인 보관용 연결 코드 카드를 사진함에 저장했어요.",
                                        "Saved private recovery card to Photos.",
                                        locale: locale
                                    )
                                    #endif
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "photo.badge.arrow.down")
                                        Text(OttlineStrings.tr("연결 코드 보관 카드(PNG) 저장", "Save private recovery card (PNG)", locale: locale))
                                            .font(OttlineFont.semiBold(13.5))
                                    }
                                    .foregroundStyle(palette.primaryAccent)
                                    .frame(maxWidth: .infinity, minHeight: 42)
                                    .background(palette.card)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 8)
                                            .stroke(palette.primaryAccent, lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        } else {
                            Button {
                                Task {
                                    _ = try? await repository.ensureAuthenticated()
                                    await loadProfileAndDevices()
                                }
                            } label: {
                                Text(OttlineStrings.tr("내 연결 코드 발급받기", "Issue my connection code", locale: locale))
                                    .font(OttlineFont.semiBold(14))
                                    .foregroundStyle(palette.onBrandNavy)
                                    .frame(maxWidth: .infinity, minHeight: 42)
                                    .background(palette.brandNavy)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                            .buttonStyle(.plain)
                        }

                        // Link another device's code
                        VStack(alignment: .leading, spacing: 8) {
                            Text(OttlineStrings.tr("다른 기기의 연결 코드로 이어받기", "Restore or merge with another code", locale: locale))
                                .font(OttlineFont.semiBold(13))
                                .foregroundStyle(palette.ink)

                            HStack(spacing: 8) {
                                TextField(
                                    OttlineStrings.tr("연결 코드 입력", "Enter connection code", locale: locale),
                                    text: $inputPairingCode
                                )
                                .textInputAutocapitalization(.characters)
                                .font(.system(size: 14, weight: .medium, design: .monospaced))
                                .padding(10)
                                .background(palette.paperStrong)
                                .clipShape(RoundedRectangle(cornerRadius: 8))

                                Button {
                                    showPairConfirmAlert = true
                                } label: {
                                    Text(OttlineStrings.tr("연결", "Link", locale: locale))
                                        .font(OttlineFont.semiBold(13.5))
                                        .foregroundStyle(palette.onBrandNavy)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 10)
                                        .background(palette.brandNavy)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                                .buttonStyle(.plain)
                                .disabled(inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || pairingBusy)
                            }
                        }

                        // Linked Devices List
                        if !devices.isEmpty {
                            VStack(alignment: .leading, spacing: 8) {
                                Text(OttlineStrings.tr("연결된 기기 (\(devices.count))", "Linked devices (\(devices.count))", locale: locale))
                                    .font(OttlineFont.semiBold(13))
                                    .foregroundStyle(palette.mutedInk)

                                ForEach(devices) { dev in
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(dev.name)
                                                .font(OttlineFont.medium(13.5))
                                                .foregroundStyle(palette.ink)
                                            Text(RecordDate.formatDisplayDate(dev.lastSeenAt, locale: locale))
                                                .font(OttlineFont.regular(11.5))
                                                .foregroundStyle(palette.mutedInk)
                                        }
                                        Spacer()
                                        if dev.id == snap.deviceId {
                                            Text(OttlineStrings.tr("현재 기기", "This device", locale: locale))
                                                .font(OttlineFont.semiBold(11.5))
                                                .foregroundStyle(palette.primaryAccent)
                                        } else {
                                            Button {
                                                Task {
                                                    try? await repository.api.unlinkDevice(targetDeviceId: dev.id)
                                                    await loadProfileAndDevices()
                                                }
                                            } label: {
                                                Text(OttlineStrings.tr("해제", "Unlink", locale: locale))
                                                    .font(OttlineFont.medium(12))
                                                    .foregroundStyle(palette.danger)
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                    .padding(10)
                                    .background(palette.paperStrong)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                    }
                }
                .padding(16)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 4. Preferences (Language, Theme, Recap Notifications, CSV Export)
                VStack(alignment: .leading, spacing: 14) {
                    Text(OttlineStrings.tr("화면 및 알림 설정", "Display & Notifications", locale: locale))
                        .font(OttlineFont.semiBold(16))
                        .foregroundStyle(palette.ink)

                    // Language
                    HStack {
                        Text(OttlineStrings.tr("언어 (Language)", "Language", locale: locale))
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.ink)
                        Spacer()
                        HStack(spacing: 6) {
                            ForEach([("ko", "한국어"), ("en", "English")], id: \.0) { code, label in
                                let selected = snap.locale == code
                                Button {
                                    repository.prefs.setLocale(code)
                                    RecapNotificationManager.shared.syncScheduleIfEnabled(prefs: repository.prefs)
                                } label: {
                                    Text(label)
                                        .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                                        .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(selected ? palette.brandNavy : palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Theme
                    HStack {
                        Text(OttlineStrings.tr("화면 테마", "Appearance", locale: locale))
                            .font(OttlineFont.medium(14))
                            .foregroundStyle(palette.ink)
                        Spacer()
                        HStack(spacing: 6) {
                            ForEach([
                                (ThemeMode.light, OttlineStrings.tr("따뜻한 종이", "Warm Paper", locale: locale)),
                                (ThemeMode.dark, OttlineStrings.tr("밤의 서재", "Night Study", locale: locale))
                            ], id: \.0) { mode, label in
                                let selected = snap.themeMode == mode
                                Button {
                                    repository.prefs.setThemeMode(mode)
                                } label: {
                                    Text(label)
                                        .font(selected ? OttlineFont.semiBold(12.5) : OttlineFont.regular(12.5))
                                        .foregroundStyle(selected ? palette.onBrandNavy : palette.ink)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(selected ? palette.brandNavy : palette.paperStrong)
                                        .clipShape(RoundedRectangle(cornerRadius: 6))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    // Weekly/Monthly Recap Notification Toggle
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
                                .font(OttlineFont.medium(14))
                                .foregroundStyle(palette.ink)
                            Text(OttlineStrings.tr(
                                "월요일 저녁과 매달 1일에 남긴 기록을 돌아볼 수 있게 알려드려요",
                                "Gentle local reminders on Monday evenings and the 1st of each month",
                                locale: locale
                            ))
                            .font(OttlineFont.regular(12))
                            .foregroundStyle(palette.mutedInk)
                        }
                    }
                    .tint(palette.brandNavy)

                    // CSV Export
                    if !repository.logs.isEmpty {
                        let csvString = CsvExporter.buildCsv(repository.logs)
                        ShareLink(
                            item: csvString,
                            subject: Text("ottline timeline export"),
                            message: Text("ottline CSV")
                        ) {
                            HStack {
                                Image(systemName: "tablecells")
                                Text(OttlineStrings.tr("내 기록 CSV로 내보내기", "Export timeline as CSV", locale: locale))
                                    .font(OttlineFont.semiBold(13.5))
                                Spacer()
                                Image(systemName: "square.and.arrow.up")
                            }
                            .foregroundStyle(palette.primaryAccent)
                            .padding(12)
                            .background(palette.paperStrong)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
                .background(palette.card)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(palette.border, lineWidth: 1)
                )

                // 5. Support & Guides
                VStack(spacing: 10) {
                    navCardRow(
                        icon: "bubble.left.and.text.bubble.right",
                        title: OttlineStrings.tr("내 문의함 · 의견 보내기", "Feedback & Support", locale: locale),
                        subtitle: OttlineStrings.tr("궁금한 점이나 기능 제안을 남겨주세요", "Send questions, bug reports, or ideas", locale: locale),
                        action: onOpenFeedback
                    )
                    navCardRow(
                        icon: "book.pages",
                        title: OttlineStrings.tr("기록 가이드 · 개인정보 안내", "Guides & Privacy", locale: locale),
                        subtitle: OttlineStrings.tr("오프라인 보관과 비공개 기본 원칙 안내", "How local-first storage and privacy work", locale: locale),
                        action: onOpenGuides
                    )
                }

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
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(palette.border, lineWidth: 1)
                )
                #endif

                // 6. Data Management ("낙장불입" policy: separate local reset vs permanent server deletion)
                VStack(alignment: .leading, spacing: 10) {
                    Text(OttlineStrings.tr("데이터 관리", "Data Management", locale: locale))
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)

                    Button {
                        showLocalResetAlert = true
                    } label: {
                        Text(OttlineStrings.tr("이 기기 로컬 데이터만 초기화", "Reset local device cache only", locale: locale))
                            .font(OttlineFont.medium(13.5))
                            .foregroundStyle(palette.ink)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(palette.card)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(palette.border, lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button {
                        deleteConfirmInput = ""
                        showServerDeleteSheet = true
                    } label: {
                        Text(OttlineStrings.tr("서버 계정 및 모든 기록 영구 삭제", "Permanently delete server account & all records", locale: locale))
                            .font(OttlineFont.semiBold(13.5))
                            .foregroundStyle(palette.danger)
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(palette.dangerSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 36)
        }
        .background(palette.background)
        .alert(
            OttlineStrings.tr("연결 코드로 기기를 이어받을까요?", "Link with this connection code?", locale: locale),
            isPresented: $showPairConfirmAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("연결하기", "Link", locale: locale)) {
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
            OttlineStrings.tr("이 기기의 로컬 기록을 비울까요?", "Clear local device data?", locale: locale),
            isPresented: $showLocalResetAlert
        ) {
            Button(OttlineStrings.tr("취소", "Cancel", locale: locale), role: .cancel) {}
            Button(OttlineStrings.tr("비우기", "Reset", locale: locale), role: .destructive) {
                repository.resetLocalData()
                toastMessage = OttlineStrings.tr("이 기기의 로컬 데이터를 초기화했어요.", "Local data has been reset.", locale: locale)
            }
        } message: {
            Text(OttlineStrings.tr(
                "서버에 동기화된 데이터는 유지되며, 연결 코드로 언제든 다시 불러올 수 있어요.",
                "Server data remains safe and can be restored anytime using your connection code.",
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
                pairingExpanded = true
                onConsumeAutoExpandPairing()
            }
        }
        .task {
            await loadProfileAndDevices()
        }
    }

    private func navCardRow(icon: String, title: String, subtitle: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                    .foregroundStyle(palette.primaryAccent)
                    .frame(width: 32)
                VStack(alignment: .leading, spacing: 3) {
                    Text(title)
                        .font(OttlineFont.semiBold(15))
                        .foregroundStyle(palette.ink)
                    Text(subtitle)
                        .font(OttlineFont.regular(12.5))
                        .foregroundStyle(palette.mutedInk)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(palette.mutedInk)
            }
            .padding(14)
            .background(palette.card)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(palette.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var serverDeleteConfirmationSheet: some View {
        let requiredWord = locale == "en" ? "DELETE" : "삭제"
        let canDelete = deleteConfirmInput.trimmingCharacters(in: .whitespacesAndNewlines) == requiredWord && !deletingAccount

        return NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Text(OttlineStrings.tr(
                    "서버에 저장된 모든 감상·독서 기록, 댓글, 문의 내역, 기기 연결 정보가 즉시 영구 삭제되며 복구할 수 없어요.",
                    "All records, comments, support threads, and linked devices on the server will be permanently deleted and cannot be recovered.",
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
                        toastMessage = OttlineStrings.tr("서버 계정과 모든 데이터를 영구 삭제했어요.", "Deleted account and all server data.", locale: locale)
                    }
                } label: {
                    Text(deletingAccount
                        ? OttlineStrings.tr("삭제 중...", "Deleting...", locale: locale)
                        : OttlineStrings.tr("영구 삭제 실행", "Permanently delete everything", locale: locale)
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
            .navigationTitle(OttlineStrings.tr("서버 데이터 전체 삭제", "Delete Server Data", locale: locale))
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
        toastMessage = OttlineStrings.tr("프로필을 저장했어요.", "Profile saved.", locale: locale)
    }

    private func performPairWithCode() async {
        let code = inputPairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }
        pairingBusy = true
        do {
            let resp = try await repository.pairWithCode(code)
            inputPairingCode = ""
            await loadProfileAndDevices()
            let merged = resp.mergedLogsCount ?? 0
            toastMessage = merged > 0
                ? OttlineStrings.tr("기기를 연결하고 \(merged)건의 기록을 합쳤어요.", "Linked device and merged \(merged) records.", locale: locale)
                : OttlineStrings.tr("연결 코드로 기기를 연결했어요.", "Successfully linked with connection code.", locale: locale)
        } catch {
            toastMessage = error.localizedDescription
        }
        pairingBusy = false
    }
}
