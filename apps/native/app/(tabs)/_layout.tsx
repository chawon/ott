import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../constants/colors';
import { tabLabels } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';

type TabName = 'log' | 'timeline' | 'together' | 'account';

function TabBarIcon({ colors, name, active }: { colors: ThemeColors; name: TabName; active: boolean }) {
  const color = active ? colors.secondary : colors.onSurfaceVariant;

  return (
    <View style={[iconStyles.box, active && { backgroundColor: colors.surfaceMuted }]}>
      {name === 'log' ? (
        <>
          <View style={[iconStyles.plusHorizontal, { backgroundColor: color }]} />
          <View style={[iconStyles.plusVertical, { backgroundColor: color }]} />
        </>
      ) : null}
      {name === 'timeline' ? (
        <View style={iconStyles.timeline}>
          <View style={[iconStyles.timelineLine, { width: 16, backgroundColor: color }]} />
          <View style={[iconStyles.timelineLine, { width: 20, backgroundColor: color }]} />
          <View style={[iconStyles.timelineLine, { width: 13, backgroundColor: color }]} />
        </View>
      ) : null}
      {name === 'together' ? (
        <>
          <View style={[iconStyles.togetherCircle, iconStyles.togetherCircleLeft, { borderColor: color }]} />
          <View style={[iconStyles.togetherCircle, iconStyles.togetherCircleRight, { borderColor: color }]} />
        </>
      ) : null}
      {name === 'account' ? (
        <>
          <View style={[iconStyles.accountHead, { borderColor: color }]} />
          <View style={[iconStyles.accountBody, { borderColor: color }]} />
        </>
      ) : null}
    </View>
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
      height: 76,
      paddingTop: 8,
      paddingBottom: 8,
      backgroundColor: colors.surface,
      borderTopWidth: 0,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      borderRadius: 8,
      elevation: 8,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: colors.background === '#0f172a' ? 0.3 : 0.12,
      shadowRadius: 18,
    },
    item: {
      height: 60,
      marginHorizontal: 4,
      paddingTop: 4,
      paddingBottom: 3,
      borderRadius: 8,
    },
    iconSlot: {
      width: 32,
      height: 30,
      marginTop: 0,
    },
    label: {
      marginTop: 0,
      fontSize: 11,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0,
    },
  });
}

const iconStyles = StyleSheet.create({
  box: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  plusHorizontal: {
    position: 'absolute',
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  plusVertical: {
    position: 'absolute',
    width: 2,
    height: 16,
    borderRadius: 1,
  },
  timeline: {
    width: 22,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineLine: {
    height: 2,
    borderRadius: 1,
  },
  togetherCircle: {
    position: 'absolute',
    width: 13,
    height: 13,
    borderWidth: 2,
    borderRadius: 7,
  },
  togetherCircleLeft: {
    left: 6,
    top: 7,
  },
  togetherCircleRight: {
    right: 6,
    top: 10,
  },
  accountHead: {
    position: 'absolute',
    top: 6,
    width: 9,
    height: 9,
    borderWidth: 2,
    borderRadius: 5,
  },
  accountBody: {
    position: 'absolute',
    bottom: 6,
    width: 17,
    height: 9,
    borderWidth: 2,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomWidth: 0,
  },
});
