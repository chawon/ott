import type { AndroidAppContext } from "./androidAppContext";
import { api, ensureAuthIds } from "./api";

export type AndroidNotificationDeviceBindResponse = {
  bound: boolean;
  revisitRemindersEnabled: boolean;
};

export async function bindAndroidNotificationDevice(
  installToken: string,
  context: AndroidAppContext | null,
) {
  await ensureAuthIds({ register: true });
  return api<AndroidNotificationDeviceBindResponse>(
    "/android/notification-devices/bind",
    {
      method: "POST",
      body: JSON.stringify({
        installToken,
        versionName: context?.versionName ?? null,
        versionCode: parseVersionCode(context?.versionCode),
        notificationPermissionGranted: notificationPermissionGranted(),
        revisitRemindersEnabled: true,
      }),
    },
  );
}

function notificationPermissionGranted() {
  if (typeof Notification === "undefined") return false;
  return Notification.permission === "granted";
}

function parseVersionCode(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
