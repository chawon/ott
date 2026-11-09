import Foundation
import UserNotifications

/// Schedules gentle local weekly (Monday 20:30) and monthly (1st day 20:00) recap reminders
/// matching `apps/native/lib/notifications.ts`.
public final class RecapNotificationManager: NSObject, UNUserNotificationCenterDelegate, @unchecked Sendable {
    public static let shared = RecapNotificationManager()

    public static let weeklyIdentifier = "ottline.recap.weekly"
    public static let monthlyIdentifier = "ottline.recap.monthly"
    public static let managedIdentifiers = [weeklyIdentifier, monthlyIdentifier]

    public var onOpenRoute: ((String) -> Void)?

    private override init() {
        super.init()
    }

    public func configureDelegate() {
        UNUserNotificationCenter.current().delegate = self
    }

    public func setEnabled(_ enabled: Bool, locale: String, prefs: AppPreferences) async -> Bool {
        let center = UNUserNotificationCenter.current()
        if !enabled {
            center.removePendingNotificationRequests(withIdentifiers: Self.managedIdentifiers)
            prefs.setRecapNotificationsEnabled(false)
            return false
        }

        let granted = (try? await center.requestAuthorization(options: [.alert, .sound, .badge])) ?? false
        guard granted else {
            center.removePendingNotificationRequests(withIdentifiers: Self.managedIdentifiers)
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
            await scheduleRecapNotifications(locale: locale)
        }
    }

    private func scheduleRecapNotifications(locale: String) async {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: Self.managedIdentifiers)

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
        if let route = response.notification.request.content.userInfo["route"] as? String {
            DispatchQueue.main.async { [weak self] in
                self?.onOpenRoute?(route)
            }
        }
    }
}
