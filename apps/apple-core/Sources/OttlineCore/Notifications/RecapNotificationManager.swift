import Foundation
import UserNotifications

/// Schedules gentle local weekly (Monday 20:30), monthly (1st day 20:00),
/// daily evening memory reminders, and Shortcuts watch-end prompts.
public final class RecapNotificationManager: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    public static let shared = RecapNotificationManager()

    public static let weeklyIdentifier = "ottline.recap.weekly"
    public static let monthlyIdentifier = "ottline.recap.monthly"
    public static let recapIdentifiers = [weeklyIdentifier, monthlyIdentifier]
    public static let managedIdentifiers = recapIdentifiers

    public static let eveningIdentifier = "ottline.reminder.evening"
    public static let watchPromptIdentifier = "ottline.reminder.watch.latest"
    private static let lastWatchPromptEpochKey = "ottline.v2.last_watch_prompt_epoch"

    public var onOpenRoute: ((String) -> Void)?
    public var onOpenUrl: ((URL) -> Void)?

    private override init() {
        super.init()
    }

    public func configureDelegate() {
        UNUserNotificationCenter.current().delegate = self
    }

    // MARK: - Weekly & Monthly Recap Notifications

    public func setEnabled(_ enabled: Bool, locale: String, prefs: AppPreferences) async -> Bool {
        let center = UNUserNotificationCenter.current()
        if !enabled {
            center.removePendingNotificationRequests(withIdentifiers: Self.recapIdentifiers)
            prefs.setRecapNotificationsEnabled(false)
            return false
        }

        let granted = await ensureAuthorization(center: center, promptIfNeeded: true)
        guard granted else {
            center.removePendingNotificationRequests(withIdentifiers: Self.recapIdentifiers)
            prefs.setRecapNotificationsEnabled(false)
            return false
        }

        await scheduleRecapNotifications(locale: locale)
        prefs.setRecapNotificationsEnabled(true)
        return true
    }

    public func syncScheduleIfEnabled(prefs: AppPreferences) {
        guard prefs.snapshot.recapNotificationsEnabled else { return }
        let locale = prefs.snapshot.locale
        Task {
            let granted = await ensureAuthorization(center: UNUserNotificationCenter.current(), promptIfNeeded: false)
            guard granted else { return }
            await scheduleRecapNotifications(locale: locale)
        }
    }

    private func scheduleRecapNotifications(locale: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: Self.recapIdentifiers)

        let isEn = locale == "en"

        // 1. Weekly Recap (Monday 20:30 local time)
        let weeklyContent = UNMutableNotificationContent()
        weeklyContent.title = isEn ? "Weekly OTT Recap" : "이번 주 기록 리캡"
        weeklyContent.body = isEn
            ? "Look back on what you watched or read over the past week."
            : "지난주에 남긴 감상과 독서 기록을 가볍게 돌아보세요."
        weeklyContent.sound = .default
        weeklyContent.userInfo = ["route": "/me/report"]

        var weeklyDate = DateComponents()
        weeklyDate.weekday = 2 // Monday in Gregorian calendar
        weeklyDate.hour = 20
        weeklyDate.minute = 30
        let weeklyTrigger = UNCalendarNotificationTrigger(dateMatching: weeklyDate, repeats: true)
        let weeklyReq = UNNotificationRequest(
            identifier: Self.weeklyIdentifier,
            content: weeklyContent,
            trigger: weeklyTrigger
        )
        try? await center.add(weeklyReq)

        // 2. Monthly Recap (1st of month 20:00 local time)
        let monthlyContent = UNMutableNotificationContent()
        monthlyContent.title = isEn ? "Monthly OTT Recap" : "월간 기록 리캡"
        monthlyContent.body = isEn
            ? "Your monthly viewing and reading summary is ready."
            : "이번 달 나의 감상·독서 리포트를 확인해 보세요."
        monthlyContent.sound = .default
        monthlyContent.userInfo = ["route": "/me/report"]

        var monthlyDate = DateComponents()
        monthlyDate.day = 1
        monthlyDate.hour = 20
        monthlyDate.minute = 0
        let monthlyTrigger = UNCalendarNotificationTrigger(dateMatching: monthlyDate, repeats: true)
        let monthlyReq = UNNotificationRequest(
            identifier: Self.monthlyIdentifier,
            content: monthlyContent,
            trigger: monthlyTrigger
        )
        try? await center.add(monthlyReq)
    }

    // MARK: - Evening Memory Reminder

    public static func buildEveningReminderContent(
        logs: [WatchLog],
        locale: String
    ) -> (title: String, body: String, urlString: String) {
        let isEn = locale == "en"
        if let inProg = logs.first(where: { $0.status == .inProgress }) {
            let isBook = inProg.title.type == .book
            let encodedId = inProg.title.id.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? inProg.title.id
            let title = isEn
                ? "Still with ‘\(inProg.title.name)’ tonight?"
                : (isBook
                    ? "요즘 읽고 있는 ‘\(inProg.title.name)’, 오늘도 펼쳤나요?"
                    : "요즘 이어보는 ‘\(inProg.title.name)’, 오늘도 함께했나요?")
            let body = isEn
                ? "Leave a quick line if a scene or sentence stayed with you."
                : "기억하고 싶은 장면이나 문장이 있다면 가볍게 한 줄로 남겨두세요."
            return (
                title: title,
                body: body,
                urlString: "ottline://quick-record?quick=1&title_id=\(encodedId)"
            )
        }

        return (
            title: isEn ? "Did a story stay with you today?" : "오늘 보고 읽은 이야기가 있나요?",
            body: isEn
                ? "Even keeping just the title on your timeline is plenty."
                : "잊기 전에 제목만 먼저 타임라인에 가볍게 남겨두어도 좋아요.",
            urlString: "ottline://quick-record?quick=1"
        )
    }

    public func setEveningReminder(
        enabled: Bool,
        hour: Int,
        minute: Int,
        logs: [WatchLog],
        prefs: AppPreferences
    ) async -> Bool {
        let center = UNUserNotificationCenter.current()
        let clampedHour = min(max(hour, 0), 23)
        let clampedMinute = min(max(minute, 0), 59)

        if !enabled {
            center.removePendingNotificationRequests(withIdentifiers: [Self.eveningIdentifier])
            prefs.setEveningReminder(enabled: false, hour: clampedHour, minute: clampedMinute)
            return false
        }

        let granted = await ensureAuthorization(center: center, promptIfNeeded: true)
        guard granted else {
            center.removePendingNotificationRequests(withIdentifiers: [Self.eveningIdentifier])
            prefs.setEveningReminder(enabled: false, hour: clampedHour, minute: clampedMinute)
            return false
        }

        prefs.setEveningReminder(enabled: true, hour: clampedHour, minute: clampedMinute)
        await scheduleEveningNotification(
            hour: clampedHour,
            minute: clampedMinute,
            logs: logs,
            locale: prefs.snapshot.locale
        )
        return true
    }

    public func refreshEveningReminderIfEnabled(logs: [WatchLog], prefs: AppPreferences) {
        let snap = prefs.snapshot
        guard snap.eveningReminderEnabled else { return }
        Task {
            let granted = await ensureAuthorization(center: UNUserNotificationCenter.current(), promptIfNeeded: false)
            guard granted else { return }
            await scheduleEveningNotification(
                hour: snap.eveningReminderHour,
                minute: snap.eveningReminderMinute,
                logs: logs,
                locale: snap.locale
            )
        }
    }

    private func scheduleEveningNotification(
        hour: Int,
        minute: Int,
        logs: [WatchLog],
        locale: String
    ) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.eveningIdentifier])

        let built = Self.buildEveningReminderContent(logs: logs, locale: locale)
        let content = UNMutableNotificationContent()
        content.title = built.title
        content.body = built.body
        content.sound = .default
        content.userInfo = ["url": built.urlString]

        var dateComponents = DateComponents()
        dateComponents.hour = min(max(hour, 0), 23)
        dateComponents.minute = min(max(minute, 0), 59)

        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(
            identifier: Self.eveningIdentifier,
            content: content,
            trigger: trigger
        )
        try? await center.add(request)
    }

    // MARK: - Shortcuts Watch / Read End Prompt

    @discardableResult
    public func scheduleWatchPromptNotification(
        platformLabel: String?,
        typeTab: String = "all",
        locale: String,
        respectCooldown: Bool,
        delaySeconds: TimeInterval = 1.0
    ) async -> Bool {
        if respectCooldown {
            let lastEpoch = UserDefaults.standard.double(forKey: Self.lastWatchPromptEpochKey)
            if lastEpoch > 0 && (Date().timeIntervalSince1970 - lastEpoch) < 7200 {
                return false
            }
        }

        let center = UNUserNotificationCenter.current()
        let granted = await ensureAuthorization(center: center, promptIfNeeded: true)
        guard granted else { return false }

        let isEn = locale == "en"
        let trimmedPlatform = platformLabel?.trimmingCharacters(in: .whitespacesAndNewlines)

        let content = UNMutableNotificationContent()
        if let platform = trimmedPlatform, !platform.isEmpty {
            content.title = isEn ? "Just finished on \(platform)?" : "방금 \(platform)에서 본 작품이 있나요?"
            content.body = isEn
                ? "Keep just the title on your timeline before it slips away."
                : "잊기 전에 제목만 먼저 타임라인에 가볍게 남겨두세요."
        } else {
            content.title = isEn ? "Finished something worth remembering?" : "방금 보고 읽은 이야기가 있나요?"
            content.body = isEn
                ? "Drop the title or a quick thought onto your timeline."
                : "기억하고 싶은 장면이나 감상을 한 줄로 남겨두세요."
        }
        content.sound = .default

        var urlStr = "ottline://quick-record?quick=1&type=\(typeTab)"
        if let platform = trimmedPlatform,
           !platform.isEmpty,
           let encodedPlatform = platform.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) {
            urlStr += "&platform=\(encodedPlatform)"
        }
        content.userInfo = ["url": urlStr]

        center.removePendingNotificationRequests(withIdentifiers: [Self.watchPromptIdentifier])
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: max(1.0, delaySeconds), repeats: false)
        let request = UNNotificationRequest(
            identifier: Self.watchPromptIdentifier,
            content: content,
            trigger: trigger
        )
        do {
            try await center.add(request)
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: Self.lastWatchPromptEpochKey)
            return true
        } catch {
            return false
        }
    }

    private func ensureAuthorization(
        center: UNUserNotificationCenter,
        promptIfNeeded: Bool
    ) async -> Bool {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            return true
        case .notDetermined:
            guard promptIfNeeded else { return false }
            return (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        default:
            return false
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    public func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        if let urlStr = userInfo["url"] as? String, let url = URL(string: urlStr) {
            DispatchQueue.main.async { [weak self] in
                self?.onOpenUrl?(url)
            }
            return
        }
        if let route = userInfo["route"] as? String {
            DispatchQueue.main.async { [weak self] in
                self?.onOpenRoute?(route)
            }
        }
    }
}
