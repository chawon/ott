import { router, useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ViewShot, { releaseCapture } from 'react-native-view-shot';
import { PairingRecoveryCard, recoveryCardCaptureSize } from '../../../components/PairingRecoveryCard';
import { SwipeableTabScreen } from '../../../components/SwipeableTabScreen';
import type { ThemeColors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import {
  deleteAccount,
  getUserProfile,
  listDevices,
  revokeAllDevices,
  revokeDevice,
  trackEvent,
  updateUserProfile,
} from '../../../lib/api';
import { accountCopy, type NativeLocale } from '../../../lib/i18n';
import { avatarUri } from '../../../lib/avatar';
import { clearLocalData, listLogsLocal, setSetting } from '../../../lib/localDb';
import { useNativePreferences, type NativeThemePreference } from '../../../lib/nativePreferences';
import {
  disableRecapNotifications,
  enableRecapNotifications,
  getRecapNotificationState,
  type RecapNotificationState,
} from '../../../lib/notifications';
import { syncNow } from '../../../lib/sync';
import { buildTimelineCsv, timelineCsvFileName } from '../../../lib/timelineCsv';
import type { DeviceSummary, PersonaKey, TitleType, UserProfile } from '../../../lib/types';
import { useAuthStore } from '../../../store/authStore';

const PERSONAS: PersonaKey[] = [
  'cinema_keeper',
  'book_drifter',
  'deep_watcher',
  'midnight_logger',
  'weekend_curator',
  'archive_collector',
];
const THEME_PREFERENCES: NativeThemePreference[] = ['system', 'light', 'dark'];
const EXPORT_RANGES: Array<'ALL' | TitleType> = ['ALL', 'movie', 'series', 'book'];

type AccountCopy = (typeof accountCopy)[NativeLocale];

const DATE_LOCALE: Record<NativeLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

function shortId(value?: string | null) {
  return value ? value.slice(0, 8) : '-';
}

function formatCopy(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replace(`{${key}}`, String(value)),
    template,
  );
}

function personaLabel(value: PersonaKey, copy: AccountCopy) {
  switch (value) {
    case 'book_drifter':
      return copy.personaBookDrifter;
    case 'deep_watcher':
      return copy.personaDeepWatcher;
    case 'midnight_logger':
      return copy.personaMidnightLogger;
    case 'weekend_curator':
      return copy.personaWeekendCurator;
    case 'archive_collector':
      return copy.personaArchiveCollector;
    case 'cinema_keeper':
    default:
      return copy.personaCinemaKeeper;
  }
}

function formatDeviceLabel(device: DeviceSummary, copy: AccountCopy, isCurrent: boolean) {
  const label = [device.os, device.browser].filter(Boolean).join(' · ');
  if (label) return label;
  return isCurrent ? copy.deviceLabelNative : copy.deviceLabelFallback;
}

function formatProfileUpdated(profile: UserProfile | null, locale: NativeLocale, copy: AccountCopy) {
  if (!profile?.profileUpdatedAt) return copy.profileNeverSaved;
  return new Date(profile.profileUpdatedAt).toLocaleDateString(DATE_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
  });
}

function formatDeviceLastSeen(value: string | null | undefined, locale: NativeLocale) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString(DATE_LOCALE[locale]);
}

function themePreferenceLabel(value: NativeThemePreference, copy: AccountCopy) {
  if (value === 'light') return copy.themeLight;
  if (value === 'dark') return copy.themeDark;
  return copy.themeSystem;
}

function exportRangeLabel(value: 'ALL' | TitleType, copy: AccountCopy) {
  if (value === 'movie') return copy.exportMovies;
  if (value === 'series') return copy.exportSeries;
  if (value === 'book') return copy.exportBooks;
  return copy.exportAll;
}

export default function AccountScreen() {
  const { colorScheme, colors, locale, setThemePreference, themePreference } = useNativePreferences();
  const copy = accountCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { userId, deviceId, pairingCode, ensureRegistered, pairWithCode, clearCredentials } = useAuthStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [recoveryCardBusy, setRecoveryCardBusy] = useState(false);
  const [notificationBusy, setNotificationBusy] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportRange, setExportRange] = useState<'ALL' | TitleType>('ALL');
  const [status, setStatus] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nickname, setNickname] = useState('');
  const [personaKey, setPersonaKey] = useState<PersonaKey>('cinema_keeper');
  const [devices, setDevices] = useState<DeviceSummary[]>([]);
  const [notificationState, setNotificationState] = useState<RecapNotificationState | null>(null);
  const recoveryCardRef = useRef<ViewShot>(null);
  const avatarSource = avatarUri(personaKey);

  const loadAccountData = useCallback(async () => {
    const current = useAuthStore.getState();
    if (!current.userId || !current.deviceId) {
      setProfile(null);
      setNickname('');
      setDevices([]);
      return;
    }

    try {
      const [nextProfile, nextDevices] = await Promise.all([
        getUserProfile().catch(() => null),
        listDevices().catch(() => []),
      ]);
      setProfile(nextProfile);
      setNickname(nextProfile?.nickname ?? '');
      setPersonaKey(nextProfile?.personaKey ?? 'cinema_keeper');
      setDevices(nextDevices);
    } catch {
      setDevices([]);
    }
  }, []);

  const loadNotificationState = useCallback(async () => {
    try {
      setNotificationState(await getRecapNotificationState());
    } catch {
      setNotificationState(null);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccountData();
      loadNotificationState();
    }, [loadAccountData, loadNotificationState]),
  );

  async function issueCode() {
    setBusy(true);
    setStatus(null);
    try {
      await ensureRegistered();
      await loadAccountData();
      setStatus(copy.codeIssueSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.codeIssueError);
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!code.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      await pairWithCode(code);
      await setSetting('lastSyncAt', null);
      await syncNow();
      await loadAccountData();
      setCode('');
      setStatus(copy.connectSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.connectError);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    const normalizedNickname = nickname.trim();
    setStatus(null);
    if (!normalizedNickname) {
      setStatus(copy.nicknameRequired);
      return;
    }
    if (normalizedNickname.length > 32) {
      setStatus(copy.nicknameTooLong);
      return;
    }

    setProfileBusy(true);
    try {
      await ensureRegistered();
      const saved = await updateUserProfile({
        nickname: normalizedNickname,
        personaKey,
      });
      setProfile(saved);
      setNickname(saved.nickname ?? normalizedNickname);
      trackEvent({
        eventName: 'profile_update',
        properties: {
          source: 'ios_native_account',
          personaKey,
        },
      }).catch(() => null);
      setStatus(copy.profileSaveSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.profileSaveError);
    } finally {
      setProfileBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await syncNow({ registerIfNeeded: !!pairingCode });
      await loadAccountData();
      setStatus(formatCopy(copy.syncSuccess, { pushed: result.pushed, pulled: result.pulled }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.syncError);
    } finally {
      setBusy(false);
    }
  }

  async function shareRecoveryCard() {
    if (!pairingCode || recoveryCardBusy) return;

    setRecoveryCardBusy(true);
    setStatus(null);
    let capturedUri: string | null = null;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        setStatus(copy.recoveryUnavailable);
        return;
      }

      capturedUri = await recoveryCardRef.current?.capture?.() ?? null;
      if (!capturedUri) throw new Error(copy.recoveryCaptureError);

      await Sharing.shareAsync(capturedUri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: copy.recoveryDialogTitle,
      });
      trackEvent({
        eventName: 'recovery_card_share',
        properties: {
          source: 'ios_native_account',
        },
      }).catch(() => null);
      setStatus(copy.recoveryShareSuccess);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.recoveryShareError);
    } finally {
      if (capturedUri) releaseCapture(capturedUri);
      setRecoveryCardBusy(false);
    }
  }

  async function enableNotifications() {
    setNotificationBusy(true);
    setStatus(null);
    try {
      const nextState = await enableRecapNotifications(locale);
      setNotificationState(nextState);
      trackEvent({
        eventName: 'notification_permission',
        properties: {
          source: 'ios_native_account',
          granted: nextState.granted,
          permissionStatus: nextState.permissionStatus,
          enabled: nextState.enabled,
        },
      }).catch(() => null);
      setStatus(
        nextState.granted && nextState.enabled
          ? copy.notificationEnabled
          : copy.notificationDenied,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.notificationEnableError);
    } finally {
      setNotificationBusy(false);
    }
  }

  async function disableNotifications() {
    setNotificationBusy(true);
    setStatus(null);
    try {
      const nextState = await disableRecapNotifications();
      setNotificationState(nextState);
      trackEvent({
        eventName: 'notification_permission',
        properties: {
          source: 'ios_native_account',
          granted: nextState.granted,
          permissionStatus: nextState.permissionStatus,
          enabled: false,
        },
      }).catch(() => null);
      setStatus(copy.notificationDisabled);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.notificationDisableError);
    } finally {
      setNotificationBusy(false);
    }
  }

  async function changeThemePreference(nextPreference: NativeThemePreference) {
    if (themeBusy || nextPreference === themePreference) return;
    setThemeBusy(true);
    setStatus(null);
    try {
      await setThemePreference(nextPreference);
      setStatus(copy.themeSaved);
    } catch {
      setStatus(copy.themeSaveError);
    } finally {
      setThemeBusy(false);
    }
  }

  async function exportLogs() {
    setExportBusy(true);
    setStatus(null);
    try {
      const logs = await listLogsLocal();
      const selectedLogs = exportRange === 'ALL'
        ? logs
        : logs.filter((log) => log.title.type === exportRange);
      if (selectedLogs.length === 0) {
        setStatus(copy.exportEmpty);
        return;
      }

      const filename = timelineCsvFileName();
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      file.write(buildTimelineCsv(selectedLogs), {
        encoding: 'utf8',
      });
      await Sharing.shareAsync(file.uri, {
        dialogTitle: filename,
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      trackEvent({
        eventName: 'timeline_export',
        properties: {
          source: 'ios_native_account',
          count: selectedLogs.length,
          typeFilter: exportRange,
        },
      }).catch(() => null);
      setStatus(formatCopy(copy.exportSuccess, { count: selectedLogs.length }));
    } catch {
      setStatus(copy.exportError);
    } finally {
      setExportBusy(false);
    }
  }

  function resetLocal() {
    Alert.alert(copy.localResetTitle, copy.localResetMessage, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.localResetConfirm,
        style: 'destructive',
        onPress: async () => {
          await clearLocalData();
          await clearCredentials();
          setProfile(null);
          setDevices([]);
          setStatus(copy.localResetSuccess);
        },
      },
    ]);
  }

  function unlinkDevice(targetId: string) {
    const current = targetId === deviceId;
    Alert.alert(
      current ? copy.currentDeviceUnlinkTitle : copy.deviceUnlinkTitle,
      current ? copy.currentDeviceUnlinkMessage : copy.deviceUnlinkMessage,
      [
        { text: copy.cancel, style: 'cancel' },
        {
          text: copy.revokeConfirm,
          style: 'destructive',
          onPress: async () => {
            setDevicesBusy(true);
            try {
              await revokeDevice(targetId);
              if (current) {
                await clearLocalData();
                await clearCredentials();
                setProfile(null);
                setDevices([]);
              } else {
                await loadAccountData();
              }
              setStatus(copy.revokeSuccess);
            } catch (error) {
              setStatus(error instanceof Error ? error.message : copy.revokeError);
            } finally {
              setDevicesBusy(false);
            }
          },
        },
      ],
    );
  }

  function unlinkAllDevices() {
    Alert.alert(copy.allDevicesUnlinkTitle, copy.allDevicesUnlinkMessage, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.allDevicesUnlinkConfirm,
        style: 'destructive',
        onPress: async () => {
          setDevicesBusy(true);
          try {
            await revokeAllDevices();
            await clearLocalData();
            await clearCredentials();
            setProfile(null);
            setDevices([]);
            setStatus(copy.allDevicesUnlinkSuccess);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : copy.allDevicesUnlinkError);
          } finally {
            setDevicesBusy(false);
          }
        },
      },
    ]);
  }

  function removeAccount() {
    Alert.alert(copy.deleteAccountTitle, copy.deleteAccountMessage, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.deleteAccountConfirm,
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            await clearLocalData();
            await clearCredentials();
            setProfile(null);
            setDevices([]);
            setStatus(copy.deleteAccountSuccess);
          } catch (error) {
            setStatus(error instanceof Error ? error.message : copy.deleteAccountError);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <SwipeableTabScreen routeKey="/(tabs)/account">
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.desc}>{copy.desc}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.appearanceTitle}</Text>
        <Text style={styles.desc}>{copy.appearanceDesc}</Text>
        <View style={styles.optionRow}>
          {THEME_PREFERENCES.map((item) => (
            <Pressable
              key={item}
              disabled={themeBusy}
              onPress={() => changeThemePreference(item)}
              style={[styles.chip, themePreference === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, themePreference === item && styles.chipTextActive]}>
                {themePreferenceLabel(item, copy)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.desc}>
          {formatCopy(copy.appearanceCurrent, {
            theme: colorScheme === 'dark' ? copy.themeDark : copy.themeLight,
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.profileTitle}</Text>
        <Text style={styles.desc}>{copy.profileDesc}</Text>
        <View style={styles.profilePreview}>
          <Image source={{ uri: avatarSource }} style={styles.avatar} />
          <View style={styles.profilePreviewText}>
            <Text style={styles.profileNickname}>{nickname.trim() || copy.nicknamePlaceholder}</Text>
            <Text style={styles.profilePersona}>{personaLabel(personaKey, copy)}</Text>
          </View>
        </View>
        <TextInput
          value={nickname}
          onChangeText={setNickname}
          placeholder={copy.nicknamePlaceholder}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primaryContainer}
          maxLength={32}
          style={styles.input}
        />
        <View style={styles.optionRow}>
          {PERSONAS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPersonaKey(item)}
              style={[styles.chip, personaKey === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, personaKey === item && styles.chipTextActive]}>
                {personaLabel(item, copy)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.desc}>
          {formatCopy(copy.recentSaved, {
            date: formatProfileUpdated(profile, locale, copy),
          })}
        </Text>
        <Pressable
          disabled={profileBusy}
          onPress={saveProfile}
          style={[styles.primaryButton, profileBusy && styles.disabledButton]}
        >
          <Text style={styles.primaryButtonText}>
            {profileBusy ? copy.profileSaving : copy.profileSave}
          </Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.pairingTitle}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{pairingCode ?? '-'}</Text>
        </View>
        <Text style={styles.desc}>{pairingCode ? copy.pairingCodePresent : copy.pairingCodeAbsent}</Text>
        <Pressable disabled={busy} onPress={issueCode} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{copy.codeIssue}</Text>
        </Pressable>
        {pairingCode ? (
          <View style={styles.recoveryBox}>
            <Text style={styles.recoveryHelp}>{copy.recoveryHelp}</Text>
            <ViewShot
              ref={recoveryCardRef}
              options={{
                format: 'png',
                quality: 1,
                result: 'tmpfile',
                width: recoveryCardCaptureSize.width,
                height: recoveryCardCaptureSize.height,
              }}
              style={styles.recoveryPreview}
            >
              <PairingRecoveryCard code={pairingCode} locale={locale} />
            </ViewShot>
            <Pressable
              disabled={recoveryCardBusy}
              onPress={shareRecoveryCard}
              style={[styles.recoveryButton, recoveryCardBusy && styles.disabledButton]}
            >
              <Text style={styles.recoveryButtonText}>
                {recoveryCardBusy ? copy.recoveryBusy : copy.recoverySave}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.connectTitle}</Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          placeholder={copy.connectPlaceholder}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primaryContainer}
          autoCapitalize="characters"
          style={styles.input}
        />
        <Pressable disabled={busy || !code.trim()} onPress={connect} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{copy.connectAction}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.devicesTitle}</Text>
        {devices.length === 0 ? (
          <Text style={styles.desc}>{copy.deviceListEmpty}</Text>
        ) : (
          devices.map((device) => {
            const current = device.id === deviceId;
            return (
              <View key={device.id} style={styles.deviceItem}>
                <View style={styles.deviceBody}>
                  <Text style={styles.deviceTitle}>
                    {current ? copy.currentDevice : copy.linkedDevice} · {shortId(device.id)}
                  </Text>
                  <Text style={styles.desc}>{formatDeviceLabel(device, copy, current)}</Text>
                  <Text style={styles.date}>
                    {formatCopy(copy.lastSeen, {
                      date: formatDeviceLastSeen(device.lastSeenAt, locale),
                    })}
                  </Text>
                </View>
                <Pressable
                  disabled={devicesBusy}
                  onPress={() => unlinkDevice(device.id)}
                  style={styles.smallDangerButton}
                >
                  <Text style={styles.smallDangerText}>{copy.revokeAction}</Text>
                </Pressable>
              </View>
            );
          })
        )}
        <Pressable disabled={!userId || devicesBusy} onPress={loadAccountData} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.devicesRefresh}</Text>
        </Pressable>
        <Pressable disabled={!userId || devicesBusy} onPress={unlinkAllDevices} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>{copy.allDevicesUnlinkAction}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.operationsTitle}</Text>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>{copy.userIdLabel}</Text>
          <Text style={styles.identityValue}>{shortId(userId)}</Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>{copy.deviceIdLabel}</Text>
          <Text style={styles.identityValue}>{shortId(deviceId)}</Text>
        </View>
        <Pressable disabled={busy} onPress={sync} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.syncAction}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/me/report')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.reportAction}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/feedback')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.feedbackAction}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.notificationsTitle}</Text>
        <Text style={styles.desc}>{copy.notificationsDesc}</Text>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>{copy.permissionLabel}</Text>
          <Text style={styles.identityValue}>{notificationState?.permissionStatus ?? '-'}</Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>{copy.scheduledLabel}</Text>
          <Text style={styles.identityValue}>
            {notificationState?.enabled
              ? formatCopy(copy.scheduledCount, { count: notificationState.scheduledCount })
              : copy.scheduledOff}
          </Text>
        </View>
        {notificationState?.enabled ? (
          <Pressable
            disabled={notificationBusy}
            onPress={disableNotifications}
            style={[styles.secondaryButton, notificationBusy && styles.disabledButton]}
          >
            <Text style={styles.secondaryButtonText}>
              {notificationBusy ? copy.changing : copy.disableNotifications}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            disabled={notificationBusy}
            onPress={enableNotifications}
            style={[styles.primaryButton, notificationBusy && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {notificationBusy ? copy.checkingPermission : copy.enableNotifications}
            </Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.infoTitle}</Text>
        <Text style={styles.desc}>{copy.infoDesc}</Text>
        <View style={styles.infoGrid}>
          <Pressable onPress={() => router.push('/about')} style={styles.infoButton}>
            <Text style={styles.infoButtonText}>{copy.about}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/faq')} style={styles.infoButton}>
            <Text style={styles.infoButtonText}>{copy.faq}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/privacy')} style={styles.infoButton}>
            <Text style={styles.infoButtonText}>{copy.privacy}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/offline')} style={styles.infoButton}>
            <Text style={styles.infoButtonText}>{copy.offline}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{copy.dataTitle}</Text>
        <Text style={styles.desc}>{copy.exportDesc}</Text>
        <View style={styles.optionRow}>
          {EXPORT_RANGES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setExportRange(item)}
              style={[styles.chip, exportRange === item && styles.chipActive]}
            >
              <Text style={[styles.chipText, exportRange === item && styles.chipTextActive]}>
                {exportRangeLabel(item, copy)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          disabled={exportBusy}
          onPress={exportLogs}
          style={[styles.secondaryButton, exportBusy && styles.disabledButton]}
        >
          <Text style={styles.secondaryButtonText}>
            {exportBusy ? copy.exporting : copy.exportAction}
          </Text>
        </Pressable>
        <Pressable onPress={resetLocal} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{copy.localResetAction}</Text>
        </Pressable>
        <Pressable disabled={!userId || !deviceId || busy} onPress={removeAccount} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>{copy.deleteAccountAction}</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
      </ScrollView>
    </SwipeableTabScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { padding: 20, paddingTop: 24, paddingBottom: 120, gap: 14 },
    header: { gap: 5 },
    title: { ...Typography.headlineLg, color: colors.onSurface },
    desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
    profilePreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
    },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 14,
      backgroundColor: colors.surface,
    },
    profilePreviewText: { flex: 1, gap: 3 },
    profileNickname: { ...Typography.headlineSm, color: colors.onSurface },
    profilePersona: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    codeBox: {
      minHeight: 58,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    codeText: { ...Typography.headlineMd, letterSpacing: 4, color: colors.primaryContainer },
    input: {
      minHeight: 52,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 12,
      color: colors.onSurface,
      ...Typography.bodyLg,
    },
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceStrong },
    chipText: { ...Typography.labelLg, color: colors.onSurface },
    chipTextActive: { color: colors.primaryContainer },
    primaryButton: {
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: { color: colors.background, fontWeight: '800' },
    secondaryButton: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButtonText: { color: colors.onSurface, fontWeight: '800' },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    infoButton: {
      minHeight: 46,
      minWidth: '47%',
      flexGrow: 1,
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    infoButtonText: { ...Typography.labelLg, color: colors.onSurface, fontSize: 13 },
    dangerButton: {
      minHeight: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dangerButtonText: { color: colors.error, fontWeight: '800' },
    smallDangerButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.error,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    smallDangerText: { ...Typography.labelLg, color: colors.error },
    identityRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    identityLabel: { ...Typography.labelLg, color: colors.onSurface },
    identityValue: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    deviceItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: colors.outlineVariant,
      paddingTop: 12,
    },
    deviceBody: { flex: 1, gap: 3 },
    deviceTitle: { ...Typography.bodyLg, color: colors.onSurface, fontWeight: '700' },
    date: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    disabledButton: { opacity: 0.55 },
    recoveryBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      gap: 10,
    },
    recoveryHelp: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    recoveryPreview: {
      alignSelf: 'center',
      borderRadius: 18,
      backgroundColor: '#f8f6f2',
    },
    recoveryButton: {
      minHeight: 50,
      borderRadius: 14,
      backgroundColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recoveryButtonText: { color: colors.background, fontWeight: '800' },
    status: { ...Typography.bodyMd, color: colors.secondary, paddingHorizontal: 4 },
  });
}
