import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '../constants/colors';
import { Typography } from '../constants/typography';
import { commonCopy } from '../lib/i18n';
import { useNativePreferences } from '../lib/nativePreferences';

export type StaticInfoSection = {
  title: string;
  body?: string;
  bullets?: string[];
};

type StaticInfoScreenProps = {
  kicker: string;
  title: string;
  description: string;
  sections: StaticInfoSection[];
};

export function StaticInfoScreen({ kicker, title, description, sections }: StaticInfoScreenProps) {
  const { colors, locale } = useNativePreferences();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel={commonCopy[locale].back}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <View style={styles.headerBody}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{description}</Text>
        </View>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.card}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
          {section.bullets?.map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletMark}>•</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 56, paddingBottom: 100, gap: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerBody: { flex: 1, gap: 5 },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  backText: { fontSize: 28, color: colors.link, lineHeight: 32 },
  kicker: { ...Typography.accent, color: colors.onSurfaceVariant },
  title: { ...Typography.headlineLg, color: colors.onSurface, fontSize: 30 },
  desc: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
  },
  sectionTitle: { ...Typography.headlineSm, color: colors.onSurface },
  body: { ...Typography.bodyMd, color: colors.onSurfaceVariant },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletMark: { ...Typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 20 },
  bulletText: { ...Typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
});
}
