import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { NativeTabIcon } from '../../components/NativeTabIcon';
import type { ThemeColors } from '../../constants/colors';
import { tabLabels } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';

type TabName = 'log' | 'timeline' | 'together' | 'account';

function TabBarIcon({ colors, name, active }: { colors: ThemeColors; name: TabName; active: boolean }) {
  return <NativeTabIcon active={active} colors={colors} name={name} />;
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
        tabBarActiveTintColor: colors.secondary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarActiveBackgroundColor: colors.surfaceMuted,
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarIconStyle: styles.iconSlot,
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: styles.label,
        tabBarLabelPosition: 'below-icon',
        tabBarShowLabel: true,
      }}
    >
      <Tabs.Screen
        name="log/index"
        options={{
          title: labels.log,
          tabBarLabel: labels.log,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="log" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="timeline/index"
        options={{
          title: labels.timeline,
          tabBarLabel: labels.timeline,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="timeline" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="together/index"
        options={{
          title: labels.together,
          tabBarLabel: labels.together,
          tabBarIcon: ({ focused }) => <TabBarIcon colors={colors} name="together" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="account/index"
        options={{
          title: labels.account,
          tabBarLabel: labels.account,
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
      bottom: 16,
      left: 16,
      right: 16,
      height: 88,
      paddingTop: 8,
      paddingBottom: 9,
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 8,
      elevation: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: colors.background === '#15120f' ? 0.3 : 0.12,
      shadowRadius: 18,
    },
    item: {
      height: 72,
      marginHorizontal: 4,
      paddingTop: 3,
      paddingBottom: 5,
      borderRadius: 8,
      justifyContent: 'center',
    },
    iconSlot: {
      width: 52,
      height: 40,
      marginTop: 0,
      marginBottom: 0,
    },
    label: {
      marginTop: 4,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: '600',
      letterSpacing: 0,
    },
  });
}
