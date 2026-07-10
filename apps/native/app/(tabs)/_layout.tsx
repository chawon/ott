import { Tabs } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { ThemeColors } from '../../constants/colors';
import { tabLabels } from '../../lib/i18n';
import { useNativePreferences } from '../../lib/nativePreferences';

type TabName = 'log' | 'timeline' | 'together' | 'account';

function TabBarIcon({ colors, name, active }: { colors: ThemeColors; name: TabName; active: boolean }) {
  const color = active ? colors.link : colors.onSurfaceVariant;
  const styles = createIconStyles(colors);

  return (
    <View style={[styles.box, active && styles.boxActive]}>
      {active ? <View style={styles.activeIndicator} /> : null}
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        {name === 'log' ? (
          <>
            <Path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
            <Path d="M13.5 6 18 10.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'timeline' ? (
          <>
            <Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={2} />
            <Line x1={12} y1={12} x2={12} y2={7.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={12} y1={12} x2={15.5} y2={14} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        ) : null}
        {name === 'together' ? (
          <Path
            d="M5 6.5h14v9H9l-4 3v-12Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {name === 'account' ? (
          <>
            <Line x1={5} y1={7} x2={19} y2={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={5} y1={17} x2={19} y2={17} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Circle cx={9} cy={7} r={2} fill={color} />
            <Circle cx={15} cy={12} r={2} fill={color} />
            <Circle cx={11} cy={17} r={2} fill={color} />
          </>
        ) : null}
      </Svg>
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
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarActiveBackgroundColor: colors.selectedSurface,
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
      shadowOpacity: colors.background === '#15120f' ? 0.3 : 0.12,
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

function createIconStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      width: 42,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    boxActive: {
      borderColor: colors.link,
      backgroundColor: colors.selectedSurface,
    },
    activeIndicator: {
      position: 'absolute',
      top: -4,
      left: 11,
      width: 20,
      height: 2,
      borderRadius: 1,
      backgroundColor: colors.action,
    },
  });
}
