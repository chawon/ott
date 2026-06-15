import * as Notifications from 'expo-notifications';
import {
  recapNotificationCopy,
  type NativeLocale,
} from './i18n';
import { getSetting, setSetting } from './localDb';

const ENABLED_KEY = 'iosRecapNotifications.enabled';
const WEEKLY_RECAP_ID = 'ottline.recap.weekly';
const MONTHLY_RECAP_ID = 'ottline.recap.monthly';
const RECAP_ROUTE = '/me/report';
const RECAP_NOTIFICATION_IDS = [WEEKLY_RECAP_ID, MONTHLY_RECAP_ID];

export type RecapNotificationState = {
  enabled: boolean;
  granted: boolean;
  permissionStatus: string;
  scheduledCount: number;
  scheduledIds: string[];
};

export function configureNotificationPresentation() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function routeFromNotificationResponse(response: Notifications.NotificationResponse | null | undefined) {
  const route = response?.notification.request.content.data?.route;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

async function readEnabledPreference() {
  return (await getSetting(ENABLED_KEY)) === 'true';
}

async function writeEnabledPreference(enabled: boolean) {
  await setSetting(ENABLED_KEY, enabled ? 'true' : 'false');
}

async function recapScheduledIds() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled
    .map((item) => item.identifier)
    .filter((identifier) => RECAP_NOTIFICATION_IDS.includes(identifier));
}

export async function getRecapNotificationState(): Promise<RecapNotificationState> {
  const [enabled, permissions, scheduledIds] = await Promise.all([
    readEnabledPreference(),
    Notifications.getPermissionsAsync(),
    recapScheduledIds().catch(() => []),
  ]);

  return {
    enabled,
    granted: permissions.granted,
    permissionStatus: permissions.status,
    scheduledCount: scheduledIds.length,
    scheduledIds,
  };
}

async function cancelRecapNotifications() {
  await Promise.all(
    RECAP_NOTIFICATION_IDS.map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier).catch(() => null),
    ),
  );
}

async function scheduleRecapNotifications(locale: NativeLocale) {
  const copy = recapNotificationCopy[locale];
  await cancelRecapNotifications();
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_RECAP_ID,
    content: {
      title: copy.weeklyTitle,
      body: copy.weeklyBody,
      data: { route: RECAP_ROUTE, kind: 'weekly_recap' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1,
      hour: 20,
      minute: 30,
    },
  });
  await Notifications.scheduleNotificationAsync({
    identifier: MONTHLY_RECAP_ID,
    content: {
      title: copy.monthlyTitle,
      body: copy.monthlyBody,
      data: { route: RECAP_ROUTE, kind: 'monthly_recap' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: 20,
      minute: 0,
    },
  });
}

export async function enableRecapNotifications(locale: NativeLocale): Promise<RecapNotificationState> {
  let permissions = await Notifications.getPermissionsAsync();
  if (!permissions.granted) {
    permissions = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: false,
        allowBadge: false,
      },
    });
  }

  if (!permissions.granted) {
    await writeEnabledPreference(false);
    return getRecapNotificationState();
  }

  await scheduleRecapNotifications(locale);
  await writeEnabledPreference(true);
  return getRecapNotificationState();
}

export async function disableRecapNotifications(): Promise<RecapNotificationState> {
  await cancelRecapNotifications();
  await writeEnabledPreference(false);
  return getRecapNotificationState();
}
