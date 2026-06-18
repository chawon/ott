import { StyleSheet, Text, View } from 'react-native';
import { Typography } from '../constants/typography';
import { accountCopy, type NativeLocale } from '../lib/i18n';

type PairingRecoveryCardProps = {
  code: string;
  locale: NativeLocale;
};

export function PairingRecoveryCard({ code, locale }: PairingRecoveryCardProps) {
  const normalizedCode = code.trim().toUpperCase();
  const copy = accountCopy[locale];

  return (
    <View style={styles.card}>
      <View style={styles.topBar} />
      <View style={styles.body}>
        <View style={styles.eyebrowPill}>
          <Text style={styles.eyebrow}>{copy.recoveryCardEyebrow}</Text>
        </View>
        <Text style={styles.title}>{copy.recoveryCardTitle}</Text>
        <Text style={styles.subtitle}>{copy.recoveryCardSubtitle}</Text>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{copy.recoveryCardCodeLabel}</Text>
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.code}>
            {normalizedCode}
          </Text>
          <Text style={styles.domain}>ottline.app</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{copy.recoveryCardInstructionsTitle}</Text>
          <Text style={styles.paragraph}>{copy.recoveryCardInstructionsBody}</Text>
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>{copy.recoveryCardWarningTitle}</Text>
          <Text style={styles.warningText}>{copy.recoveryCardWarningBody}</Text>
        </View>

        <View style={styles.divider} />
        <Text style={styles.footer}>{copy.recoveryCardFooter}</Text>
      </View>
      <View style={styles.bottomBar} />
    </View>
  );
}

export const recoveryCardCaptureSize = {
  width: 1080,
  height: 1440,
} as const;

const styles = StyleSheet.create({
  card: {
    width: 270,
    height: 360,
    borderRadius: 18,
    backgroundColor: '#f8f6f2',
    overflow: 'hidden',
  },
  topBar: { height: 5, backgroundColor: '#ff9933' },
  bottomBar: { height: 5, backgroundColor: '#1e4d8c' },
  body: {
    flex: 1,
    margin: 18,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 9,
  },
  eyebrowPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#fef9ee',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  eyebrow: { ...Typography.labelSm, color: '#ff9933' },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#0f0f0f' },
  subtitle: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: '#4a4a4a' },
  codeBox: {
    borderRadius: 12,
    backgroundColor: '#15120f',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: { fontSize: 9, fontWeight: '800', color: '#ff9933' },
  code: {
    width: '100%',
    textAlign: 'center',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#ffffff',
  },
  domain: { fontSize: 9, fontWeight: '500', color: '#d8cfc4' },
  section: { gap: 4 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: '#0f0f0f' },
  paragraph: { fontSize: 10, lineHeight: 15, fontWeight: '500', color: '#4a4a4a' },
  warningBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ff9933',
    backgroundColor: '#fef9ee',
    padding: 10,
    gap: 5,
  },
  warningTitle: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: '#0f0f0f' },
  warningText: { fontSize: 9, lineHeight: 13, fontWeight: '500', color: '#4a4a4a' },
  divider: { height: 1, backgroundColor: '#ecebe9', marginTop: 2 },
  footer: { fontSize: 8, lineHeight: 12, fontWeight: '500', color: '#4a4a4a' },
});
