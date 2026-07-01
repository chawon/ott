import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { getPersonalReport, trackEvent } from '../lib/api';
import { appShellCopy } from '../lib/i18n';
import { getSetting, listLogsLocal, setSetting } from '../lib/localDb';
import { useNativePreferences } from '../lib/nativePreferences';
import { buildPersonalReport } from '../lib/report';
import type { PersonalReport } from '../lib/types';

const RECAP_KEY = '2026-H1';
const NOTICE_STORAGE_KEY = `ottline.recapNotice.dismissed.${RECAP_KEY}`;
const NOTICE_START_AT = new Date('2026-07-01T00:00:00+09:00').getTime();
const NOTICE_END_AT = new Date('2026-08-01T00:00:00+09:00').getTime();

function isNoticePeriod(now = new Date()) {
  const time = now.getTime();
  return time >= NOTICE_START_AT && time < NOTICE_END_AT;
}

async function loadReportWithLocalFallback(): Promise<PersonalReport> {
  try {
    return await getPersonalReport();
  } catch {
    const logs = await listLogsLocal();
    return buildPersonalReport(logs);
  }
}

async function markDismissed() {
  await setSetting(NOTICE_STORAGE_KEY, '1');
}

export function SeasonalRecapNotice() {
  const pathname = usePathname();
  const { colors, locale } = useNativePreferences();
  const copy = appShellCopy[locale];
  const stylesForTheme = createStyles(colors);
  const [visible, setVisible] = useState(false);
  const [recapMeta, setRecapMeta] = useState<{
    totalLogs: number;
    posterCount: number;
  } | null>(null);
  const impressionTracked = useRef(false);
  const isReportPage = pathname === '/me/report';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isNoticePeriod() || isReportPage) {
        setVisible(false);
        return;
      }

      const dismissed = await getSetting(NOTICE_STORAGE_KEY).catch(() => null);
      if (dismissed === '1') {
        setVisible(false);
        return;
      }

      const report = await loadReportWithLocalFallback().catch(() => null);
      const recap = report?.seasonalRecap;
      if (cancelled || !recap || recap.key !== RECAP_KEY) {
        setVisible(false);
        return;
      }

      const meta = {
        totalLogs: recap.totalLogs,
        posterCount: recap.posters.length,
      };
      setRecapMeta(meta);
      setVisible(true);

      if (!impressionTracked.current) {
        impressionTracked.current = true;
        trackEvent({
          eventName: 'h1_recap_notice_impression',
          properties: {
            source: 'ios_native_header',
            recapKey: recap.key,
            ...meta,
          },
        }).catch(() => null);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isReportPage]);

  if (!visible || !recapMeta) return null;

  function openRecap() {
    setVisible(false);
    markDismissed().catch(() => null);
    trackEvent({
      eventName: 'h1_recap_notice_click',
      properties: {
        source: 'ios_native_header',
        recapKey: RECAP_KEY,
        ...recapMeta,
      },
    }).catch(() => null);
    router.push('/me/report');
  }

  function dismiss() {
    setVisible(false);
    markDismissed().catch(() => null);
    trackEvent({
      eventName: 'h1_recap_notice_dismiss',
      properties: {
        source: 'ios_native_header',
        recapKey: RECAP_KEY,
        ...recapMeta,
      },
    }).catch(() => null);
  }

  return (
    <View style={stylesForTheme.wrapper}>
      <Text style={stylesForTheme.icon} accessibilityElementsHidden importantForAccessibility="no">
        ◔
      </Text>
      <Text numberOfLines={2} style={stylesForTheme.title}>
        {copy.h1RecapNoticeTitle}
      </Text>
      <Pressable
        onPress={openRecap}
        style={stylesForTheme.action}
        accessibilityRole="button"
        accessibilityLabel={copy.h1RecapNoticeAction}
      >
        <Text style={stylesForTheme.actionText}>{copy.h1RecapNoticeAction}</Text>
      </Pressable>
      <Pressable
        onPress={dismiss}
        style={stylesForTheme.dismiss}
        accessibilityRole="button"
        accessibilityLabel={copy.h1RecapNoticeDismiss}
      >
        <Text style={stylesForTheme.dismissText}>×</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: {
      minHeight: 62,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 11,
      backgroundColor: colors.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    icon: {
      ...Typography.bodyLg,
      flexShrink: 0,
      color: colors.primaryContainer,
      fontWeight: '800',
    },
    title: {
      ...Typography.bodyMd,
      flex: 1,
      color: colors.onSurface,
      fontWeight: '700',
    },
    action: {
      minHeight: 40,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.primaryContainer,
      paddingHorizontal: 14,
    },
    actionText: {
      ...Typography.labelLg,
      color: '#ffffff',
      fontWeight: '800',
    },
    dismiss: {
      width: 40,
      height: 40,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
    },
    dismissText: {
      ...Typography.headlineSm,
      color: colors.onSurfaceVariant,
      lineHeight: 22,
    },
  });
}
