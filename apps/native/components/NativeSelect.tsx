import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../constants/colors';
import { Typography } from '../constants/typography';

export type NativeSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type NativeSelectSection = {
  label?: string;
  options: NativeSelectOption[];
};

type NativeSelectProps = {
  colors: ThemeColors;
  label: string;
  selectedValue: string | null;
  valueLabel: string | null;
  placeholder: string;
  sections: NativeSelectSection[];
  onChange: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  disabled?: boolean;
  helperText?: string | null;
};

export function NativeSelect({
  colors,
  label,
  selectedValue,
  valueLabel,
  placeholder,
  sections,
  onChange,
  onClear,
  clearLabel,
  disabled,
  helperText,
}: NativeSelectProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const hasValue = Boolean(valueLabel);

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.control, disabled && styles.disabledControl]}
      >
        <Text style={[styles.controlText, !hasValue && styles.placeholder]}>
          {valueLabel ?? placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => null}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              {onClear ? (
                <Pressable
                  onPress={() => {
                    onClear();
                    setOpen(false);
                  }}
                  style={styles.clearButton}
                >
                  <Text style={styles.clearText}>{clearLabel ?? 'Clear'}</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
              {sections.map((section, sectionIndex) => (
                <View key={`${section.label ?? 'section'}-${sectionIndex}`} style={styles.section}>
                  {section.label ? <Text style={styles.sectionLabel}>{section.label}</Text> : null}
                  <View style={styles.optionList}>
                    {section.options.map((option) => {
                      const selected = option.value === (selectedValue ?? '');
                      return (
                        <Pressable
                          key={option.value}
                          disabled={option.disabled}
                          onPress={() => {
                            onChange(option.value);
                            setOpen(false);
                          }}
                          style={[
                            styles.option,
                            selected && styles.optionActive,
                            option.disabled && styles.optionDisabled,
                          ]}
                        >
                          <Text style={[styles.optionText, selected && styles.optionTextActive]}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => setOpen(false)} style={styles.doneButton}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { gap: 6 },
    label: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    control: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    disabledControl: { opacity: 0.5 },
    controlText: { ...Typography.bodyLg, color: colors.onSurface, flex: 1 },
    placeholder: { color: colors.onSurfaceVariant },
    chevron: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
    helper: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.36)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '78%',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderColor: colors.outlineVariant,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 16,
      gap: 12,
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    sheetTitle: { ...Typography.headlineSm, color: colors.onSurface },
    clearButton: {
      minHeight: 36,
      borderRadius: 999,
      backgroundColor: colors.surfaceMuted,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    clearText: { ...Typography.labelLg, color: colors.onSurface },
    sheetContent: { paddingBottom: 8, gap: 12 },
    section: { gap: 8 },
    sectionLabel: { ...Typography.labelSm, color: colors.onSurfaceVariant },
    optionList: { gap: 8 },
    option: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      justifyContent: 'center',
    },
    optionActive: { borderColor: colors.primaryContainer, backgroundColor: colors.surfaceMuted },
    optionDisabled: { opacity: 0.4 },
    optionText: { ...Typography.bodyMd, color: colors.onSurface },
    optionTextActive: { color: colors.primaryContainer, fontWeight: '700' },
    doneButton: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: colors.primaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: { ...Typography.labelLg, color: colors.background, fontWeight: '800' },
  });
}
