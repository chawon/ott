import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ThemeColors } from '../constants/colors';
import { Typography } from '../constants/typography';
import type { NativeLocale } from '../lib/i18n';
import type { TitleType } from '../lib/types';

export type RatingOption = {
  value: 5 | 3 | 1;
  label: string;
};

type RatingSelectorProps = {
  colors: ThemeColors;
  disabled?: boolean;
  noneLabel: string;
  onChange: (value: number | null) => void;
  options: RatingOption[];
  value: number | null;
};

type DateOverrideFieldProps = {
  activeLabel: string;
  colors: ThemeColors;
  enabled: boolean;
  label: string;
  locale: NativeLocale;
  modalTitle?: string;
  onChange: (value: string) => void;
  onToggle: (enabled: boolean) => void;
  value: string;
};

const DATE_LOCALE: Record<NativeLocale, string> = {
  ko: 'ko-KR',
  en: 'en-US',
};

const DATE_COPY = {
  ko: {
    cancel: '취소',
    nextMonth: '다음 달',
    previousMonth: '이전 달',
    today: '오늘',
    weekdays: ['일', '월', '화', '수', '목', '금', '토'],
  },
  en: {
    cancel: 'Cancel',
    nextMonth: 'Next month',
    previousMonth: 'Previous month',
    today: 'Today',
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
} as const satisfies Record<NativeLocale, Record<string, string | readonly string[]>>;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateInput(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function monthDays(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: lastDate }, (_, index) => new Date(year, month, index + 1)),
  ];
}

function monthTitle(cursor: Date, locale: NativeLocale) {
  return cursor.toLocaleDateString(DATE_LOCALE[locale], {
    month: 'long',
    year: 'numeric',
  });
}

function readableDate(value: string, locale: NativeLocale) {
  return parseDateInput(value).toLocaleDateString(DATE_LOCALE[locale], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ratingOptionsForType(type: TitleType | undefined, locale: NativeLocale): RatingOption[] {
  if (type === 'book') {
    return locale === 'ko'
      ? [
          { value: 5, label: '📚 인생책' },
          { value: 3, label: '🙂 무난해요' },
          { value: 1, label: '😕 아쉬워요' },
        ]
      : [
          { value: 5, label: '📚 Life-changing' },
          { value: 3, label: '🙂 Not bad' },
          { value: 1, label: '😕 Disappointing' },
        ];
  }

  return locale === 'ko'
    ? [
        { value: 5, label: '😍 최고예요' },
        { value: 3, label: '🙂 볼만해요' },
        { value: 1, label: '😕 아쉬워요' },
      ]
    : [
        { value: 5, label: '😍 Excellent' },
        { value: 3, label: '🙂 Worth watching' },
        { value: 1, label: '😕 Disappointing' },
      ];
}

export function RatingSelector({
  colors,
  disabled = false,
  noneLabel,
  onChange,
  options,
  value,
}: RatingSelectorProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.optionRow, disabled && styles.disabled]}>
      <Pressable
        disabled={disabled}
        onPress={() => onChange(null)}
        style={[styles.chip, value == null && styles.chipActive]}
      >
        <Text style={[styles.chipText, value == null && styles.chipTextActive]}>{noneLabel}</Text>
      </Pressable>
      {options.map((option) => (
        <Pressable
          key={option.value}
          disabled={disabled}
          onPress={() => onChange(value === option.value ? null : option.value)}
          style={[styles.chip, value === option.value && styles.chipActive]}
        >
          <Text style={[styles.chipText, value === option.value && styles.chipTextActive]}>
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DateOverrideField({
  activeLabel,
  colors,
  enabled,
  label,
  locale,
  modalTitle,
  onChange,
  onToggle,
  value,
}: DateOverrideFieldProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  function activate() {
    if (enabled) {
      onToggle(false);
      return;
    }
    onToggle(true);
    setOpen(true);
  }

  return (
    <View style={styles.dateField}>
      <Pressable onPress={activate} style={styles.dateToggle}>
        <View style={[styles.checkbox, enabled && styles.checkboxActive]}>
          {enabled ? <Text style={styles.checkboxText}>✓</Text> : null}
        </View>
        <Text style={[styles.dateToggleText, enabled && styles.dateToggleTextActive]}>
          {enabled ? activeLabel : label}
        </Text>
      </Pressable>

      {enabled ? (
        <Pressable onPress={() => setOpen(true)} style={styles.dateButton}>
          <Text style={styles.dateButtonText}>{readableDate(value, locale)}</Text>
        </Pressable>
      ) : null}

      <DatePickerModal
        colors={colors}
        locale={locale}
        onClose={() => setOpen(false)}
        onSelect={(nextValue) => {
          onChange(nextValue);
          setOpen(false);
        }}
        title={modalTitle}
        value={value}
        visible={open}
      />
    </View>
  );
}

function DatePickerModal({
  colors,
  locale,
  onClose,
  onSelect,
  title,
  value,
  visible,
}: {
  colors: ThemeColors;
  locale: NativeLocale;
  onClose: () => void;
  onSelect: (value: string) => void;
  title?: string;
  value: string;
  visible: boolean;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const copy = DATE_COPY[locale];
  const selectedDate = useMemo(() => parseDateInput(value), [value]);
  const [cursor, setCursor] = useState(selectedDate);

  useEffect(() => {
    if (visible) setCursor(selectedDate);
  }, [selectedDate, visible]);

  const days = useMemo(() => monthDays(cursor), [cursor]);
  const selectedInput = toDateInput(selectedDate);
  const todayInput = toDateInput(new Date());

  function moveMonth(offset: number) {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Pressable
              accessibilityLabel={copy.previousMonth as string}
              onPress={() => moveMonth(-1)}
              style={styles.monthButton}
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </Pressable>
            <View style={styles.modalTitleBox}>
              {title ? <Text style={styles.modalKicker}>{title}</Text> : null}
              <Text style={styles.modalTitle}>{monthTitle(cursor, locale)}</Text>
            </View>
            <Pressable
              accessibilityLabel={copy.nextMonth as string}
              onPress={() => moveMonth(1)}
              style={styles.monthButton}
            >
              <Text style={styles.monthButtonText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {(copy.weekdays as readonly string[]).map((day) => (
              <Text key={day} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.dayGrid}>
            {days.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const inputValue = toDateInput(day);
              const selected = inputValue === selectedInput;
              const today = inputValue === todayInput;
              return (
                <Pressable
                  key={inputValue}
                  onPress={() => onSelect(inputValue)}
                  style={[
                    styles.dayCell,
                    styles.dayButton,
                    today && styles.dayToday,
                    selected && styles.daySelected,
                  ]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                    {day.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.modalFooter}>
            <Pressable onPress={() => onSelect(todayInput)} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>{copy.today as string}</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.footerButton}>
              <Text style={styles.footerButtonText}>{copy.cancel as string}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.link,
      backgroundColor: colors.selectedSurface,
    },
    chipText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    chipTextActive: { color: colors.link },
    disabled: { opacity: 0.5 },
    dateField: { gap: 8 },
    dateToggle: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      paddingHorizontal: 2,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.outline,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    checkboxActive: {
      borderColor: colors.link,
      backgroundColor: colors.selectedSurface,
    },
    checkboxText: { color: colors.link, fontWeight: '900', lineHeight: 18 },
    dateToggleText: { ...Typography.labelLg, color: colors.onSurfaceVariant },
    dateToggleTextActive: { color: colors.link },
    dateButton: {
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    dateButtonText: { ...Typography.bodyMd, color: colors.onSurface },
    modalOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitleBox: { flex: 1, alignItems: 'center', gap: 2 },
    modalKicker: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    modalTitle: { ...Typography.headlineSm, color: colors.onSurface },
    monthButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    monthButtonText: { color: colors.link, fontSize: 28, lineHeight: 30 },
    weekRow: { flexDirection: 'row', gap: 4 },
    weekday: {
      flex: 1,
      textAlign: 'center',
      ...Typography.labelSm,
      color: colors.onSurfaceVariant,
    },
    dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    dayCell: {
      width: '13.75%',
      aspectRatio: 1,
    },
    dayButton: {
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    dayToday: { borderWidth: 1, borderColor: colors.outline },
    daySelected: { backgroundColor: colors.selectedSurface, borderWidth: 1, borderColor: colors.link },
    dayText: { ...Typography.labelLg, color: colors.onSurface },
    dayTextSelected: { color: colors.link },
    modalFooter: { flexDirection: 'row', gap: 8 },
    footerButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceMuted,
    },
    footerButtonText: { ...Typography.labelLg, color: colors.onSurface },
  });
}
