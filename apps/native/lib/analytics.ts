export const IOS_NATIVE_PLATFORM = 'ios_native' as const;

type AnalyticsBaseContext = {
  appVersion?: string | null;
  buildNumber?: string | null;
  installId: string;
  locale: string;
  route?: string | null;
  sessionId: string;
  theme?: string | null;
};

export function buildAnalyticsProperties(
  context: AnalyticsBaseContext,
  properties: Record<string, unknown> = {},
) {
  return {
    platform: IOS_NATIVE_PLATFORM,
    deviceType: 'mobile',
    osFamily: 'ios',
    installState: 'app_store_testflight',
    appVersion: context.appVersion ?? null,
    buildNumber: context.buildNumber ?? null,
    sessionId: context.sessionId,
    installId: context.installId,
    locale: context.locale,
    theme: context.theme ?? 'light',
    route: context.route ?? null,
    ...properties,
  };
}
