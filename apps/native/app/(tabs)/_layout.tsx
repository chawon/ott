import { Tabs } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import type { ThemeColors } from '../../constants/colors';
import { tabLabels } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';

function TabBarIcon({ colors, name, active }: { colors: ThemeColors; name: string; active: boolean }) {
  const icons: Record<string, string> = {
    timeline: '▤',
    log: '+',
    together: '◌',
    account: '◎',
  };
  return (
    <Text style={[{ color: colors.onSurfaceVariant, fontSize: 22 }, active && { color: colors.secondary }]}>
      {icons[name] ?? '●'}
    </Text>
  );
}

export default function TabsLayout() {
  const { colors, locale } = useNativePreferences();
  const styles = createStyles(colors);
  const labels = tabLabels[locale];

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="log/index"
        options={{
          title: labels.log,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="log" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="timeline/index"
        options={{
          title: labels.timeline,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="timeline" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="together/index"
        options={{
          title: labels.together,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="together" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="account/index"
        options={{
          title: labels.account,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="account" active={focused} />,
        }}
      />
    </Tabs>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    right: 24,
    borderRadius: 999,
    height: 64,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarBg: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: colors.background === '#0f172a' ? 'rgba(9, 14, 25, 0.92)' : 'rgba(23, 31, 51, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  label: {
    display: 'none',
  },
});
}
