import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { getUserProfile } from '../lib/api';
import { shareCardCopy, type NativeLocale } from '../lib/i18n';
import { defaultLogShareCardOptions } from '../lib/shareCard';
import type {
  LogShareCardAction,
  LogShareCardFormat,
  LogShareCardOptions,
} from '../lib/shareCard';
import type { ThemeColors } from '../constants/colors';
import { Typography } from '../constants/typography';
import type { UserProfile, WatchLog } from '../lib/types';

type ShareCardOptionsModalProps = {
  colors: ThemeColors;
  locale: NativeLocale;
  log: WatchLog | null;
  onCancel: () => void;
  onConfirm: (options: LogShareCardOptions, action: LogShareCardAction) => void;
  visible: boolean;
};

function hasCompleteProfile(profile: UserProfile | null) {
  return Boolean(profile?.nickname?.trim() && profile?.personaKey);
}

export function ShareCardOptionsModal({
  colors,
  locale,
  log,
  onCancel,
  onConfirm,
  visible,
}: ShareCardOptionsModalProps) {
  const copy = shareCardCopy[locale];
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [options, setOptions] = useState(() => defaultLogShareCardOptions(log));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOptions(defaultLogShareCardOptions(log));
    setProfile(null);
    setProfileLoading(true);
    getUserProfile()
      .then((nextProfile) => setProfile(nextProfile))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [log, visible]);

  const profileAvailable = hasCompleteProfile(profile);

  function updateFormat(format: LogShareCardFormat) {
    setOptions((current) => ({ ...current, format }));
  }

  function confirm(action: LogShareCardAction) {
    onConfirm(
      {
        ...options,
        profileNickname: options.showProfileSignature ? profile?.nickname ?? null : null,
        profilePersonaKey: options.showProfileSignature ? profile?.personaKey ?? null : null,
      },
      action,
    );
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.description}>{copy.description}</Text>
            </View>

            <View style={styles.optionGroup}>
              <OptionToggle
                colors={colors}
                label={copy.showRating}
                onValueChange={(value) =>
                  setOptions((current) => ({ ...current, showRatingLabel: value }))
                }
                value={options.showRatingLabel}
              />
              <OptionToggle
                colors={colors}
                disabled={!log?.note?.trim()}
                label={copy.showNote}
                onValueChange={(value) =>
                  setOptions((current) => ({ ...current, showNote: value }))
                }
                value={options.showNote}
              />
              {profileLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.onSurfaceVariant} size="small" />
                  <Text style={styles.helperText}>{copy.profileLoading}</Text>
                </View>
              ) : profileAvailable ? (
                <OptionToggle
                  colors={colors}
                  label={copy.profileSignature}
                  onValueChange={(value) =>
                    setOptions((current) => ({ ...current, showProfileSignature: value }))
                  }
                  value={options.showProfileSignature}
                />
              ) : null}
            </View>

            <View style={styles.formatGroup}>
              <Text style={styles.groupLabel}>{copy.formatLabel}</Text>
              <View style={styles.formatRow}>
                <FormatButton
                  colors={colors}
                  active={options.format === 'story'}
                  label={copy.formatStory}
                  onPress={() => updateFormat('story')}
                />
                <FormatButton
                  colors={colors}
                  active={options.format === 'feed'}
                  label={copy.formatFeed}
                  onPress={() => updateFormat('feed')}
                />
              </View>
            </View>

            <Text style={styles.saveHint}>{copy.imageSaveHint}</Text>

            <View style={styles.actions}>
              <Pressable onPress={onCancel} style={styles.cancelButton}>
                <Text style={styles.cancelText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable onPress={() => confirm('save')} style={styles.saveButton}>
                <Text style={styles.saveText}>{copy.imageSave}</Text>
              </Pressable>
              <Pressable onPress={() => confirm('share')} style={styles.shareButton}>
                <Text style={styles.shareText}>{copy.share}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function OptionToggle({
  colors,
  disabled = false,
  label,
  onValueChange,
  value,
}: {
  colors: ThemeColors;
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.optionRow, disabled && styles.disabled]}>
      <Text style={styles.optionLabel}>{label}</Text>
      <Switch
        disabled={disabled}
        ios_backgroundColor={colors.outlineVariant}
        onValueChange={onValueChange}
        thumbColor={value ? colors.surface : colors.onSurfaceVariant}
        trackColor={{ false: colors.outlineVariant, true: colors.link }}
        value={value}
      />
    </View>
  );
}

function FormatButton({
  active,
  colors,
  label,
  onPress,
}: {
  active: boolean;
  colors: ThemeColors;
  label: string;
  onPress: () => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.formatButton, active && styles.formatButtonActive]}
    >
      <Text style={[styles.formatText, active && styles.formatTextActive]}>{label}</Text>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0, 0, 0, 0.28)',
    },
    sheet: {
      maxHeight: '90%',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.surface,
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 4,
      marginTop: 10,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
    },
    content: {
      padding: 20,
      paddingBottom: 32,
      gap: 18,
    },
    header: { gap: 5 },
    title: { ...Typography.headlineMd, color: colors.onSurface },
    description: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    optionGroup: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surfaceMuted,
      paddingHorizontal: 14,
    },
    optionRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: 1,
      borderBottomColor: colors.outlineVariant,
    },
    optionLabel: { ...Typography.bodyLg, color: colors.onSurface },
    disabled: { opacity: 0.45 },
    loadingRow: {
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    helperText: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    formatGroup: { gap: 8 },
    groupLabel: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    formatRow: { flexDirection: 'row', gap: 8 },
    formatButton: {
      flex: 1,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 8,
    },
    formatButtonActive: {
      borderColor: colors.link,
      backgroundColor: colors.selectedSurface,
    },
    formatText: { ...Typography.labelLg, color: colors.onSurfaceVariant, textAlign: 'center' },
    formatTextActive: { color: colors.link },
    saveHint: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    actions: { flexDirection: 'row', gap: 8 },
    cancelButton: {
      minHeight: 52,
      flex: 0.8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    cancelText: { ...Typography.labelLg, color: colors.onSurface },
    saveButton: {
      minHeight: 52,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.link,
      backgroundColor: colors.surface,
    },
    saveText: { ...Typography.labelLg, color: colors.link },
    shareButton: {
      minHeight: 52,
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.action,
    },
    shareText: { ...Typography.labelLg, color: colors.onAction },
  });
}
