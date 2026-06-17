import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../constants/colors';
import { tabLabels } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';

type TabName = 'log' | 'timeline' | 'together' | 'account';

function TabBarIcon({ colors, name, active }: { colors: ThemeColors; name: TabName; active: boolean }) {
  const color = active ? '#FFFFFF' : colors.onSurfaceVariant;

  return (
    <View style={[iconStyles.box, active && iconStyles.boxActive]}>
      {name === 'log' ? (
        <>
          <View style={[iconStyles.pencilBody, { backgroundColor: color }]} />
          <View style={[iconStyles.pencilTip, { borderLeftColor: color }]} />
        </>
      ) : null}
      {name === 'timeline' ? (
        <>
          <View style={[iconStyles.clockFace, { borderColor: color }]} />
          <View style={[iconStyles.clockHour, { backgroundColor: color }]} />
          <View style={[iconStyles.clockMinute, { backgroundColor: color }]} />
        </>
      ) : null}
      {name === 'together' ? (
        <>
          <View style={[iconStyles.messageBubble, { borderColor: color }]} />
          <View style={[iconStyles.messageTail, { borderTopColor: color }]} />
        </>
      ) : null}
      {name === 'account' ? (
        <>
          <View style={[iconStyles.settingRing, { borderColor: color }]} />
          <View style={[iconStyles.settingDot, { backgroundColor: color }]} />
          <View style={[iconStyles.settingTooth, iconStyles.settingToothTop, { backgroundColor: color }]} />
          <View style={[iconStyles.settingTooth, iconStyles.settingToothBottom, { backgroundColor: color }]} />
          <View style={[iconStyles.settingToothSide, iconStyles.settingToothLeft, { backgroundColor: color }]} />
          <View style={[iconStyles.settingToothSide, iconStyles.settingToothRight, { backgroundColor: color }]} />
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
      fontSize: 10,
      lineHeight: 14,
      fontWeight: '700',
      letterSpacing: 0,
    },
  });
}

const iconStyles = StyleSheet.create({
  box: {
    width: 42,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  boxActive: {
    backgroundColor: '#FF9933',
  },
  pencilBody: {
    position: 'absolute',
    width: 16,
    height: 4,
    borderRadius: 2,
    transform: [{ rotate: '-34deg' }],
  },
  pencilTip: {
    position: 'absolute',
    right: 10,
    top: 9,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderLeftWidth: 6,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-34deg' }],
  },
  clockFace: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 9,
  },
  clockHour: {
    position: 'absolute',
    width: 2,
    height: 6,
    borderRadius: 1,
    top: 8,
  },
  clockMinute: {
    position: 'absolute',
    width: 6,
    height: 2,
    borderRadius: 1,
    top: 13,
    left: 20,
  },
  messageBubble: {
    position: 'absolute',
    width: 19,
    height: 15,
    borderWidth: 2,
    borderRadius: 5,
  },
  messageTail: {
    position: 'absolute',
    left: 17,
    top: 18,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderRightWidth: 5,
    borderRightColor: 'transparent',
  },
  settingRing: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderRadius: 7,
  },
  settingDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  settingTooth: {
    position: 'absolute',
    width: 3,
    height: 5,
    borderRadius: 2,
  },
  settingToothTop: {
    top: 4,
  },
  settingToothBottom: {
    bottom: 4,
  },
  settingToothSide: {
    position: 'absolute',
    width: 5,
    height: 3,
    borderRadius: 2,
  },
  settingToothLeft: {
    left: 9,
  },
  settingToothRight: {
    right: 9,
  },
});
