import { buildAnalyticsProperties } from '../lib/analytics';

describe('native analytics context', () => {
  it('adds iOS native install, session, version, route, and theme dimensions', () => {
    expect(
      buildAnalyticsProperties(
        {
          appVersion: '1.0.0',
          buildNumber: '12',
          installId: 'install-1',
          locale: 'ko',
          route: '/timeline',
          sessionId: 'ios-session-1',
          theme: 'dark',
        },
        { source: 'test' },
      ),
    ).toEqual({
      platform: 'ios_native',
      deviceType: 'mobile',
      osFamily: 'iOS',
      installState: 'app_store_testflight',
      appVersion: '1.0.0',
      buildNumber: '12',
      sessionId: 'ios-session-1',
      installId: 'install-1',
      locale: 'ko',
      theme: 'dark',
      route: '/timeline',
      source: 'test',
    });
  });
});
