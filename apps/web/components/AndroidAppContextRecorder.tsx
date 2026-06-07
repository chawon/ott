"use client";

import { useEffect } from "react";
import {
  readAndroidInstallTokenFromCurrentUrl,
  recordAndroidAppContextFromCurrentUrl,
  removeAndroidInstallTokenFromCurrentUrl,
} from "@/lib/androidAppContext";
import { bindAndroidNotificationDevice } from "@/lib/androidNotifications";

export default function AndroidAppContextRecorder() {
  useEffect(() => {
    const installToken = readAndroidInstallTokenFromCurrentUrl();
    const context = recordAndroidAppContextFromCurrentUrl();
    if (installToken) {
      removeAndroidInstallTokenFromCurrentUrl();
      bindAndroidNotificationDevice(installToken, context).catch(() => {
        // Binding must not block the app shell. The next Android launch can retry.
      });
    }
  }, []);

  return null;
}
