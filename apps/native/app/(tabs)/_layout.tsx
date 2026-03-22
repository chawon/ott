import { Tabs } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Colors } from '../../constants/colors';

function TabBarIcon({ name, active }: { name: string; active: boolean }) {
  const icons: Record<string, string> = {
    journey: '◈',
    log: '+',
    profile: '◉',
  };
  return (
    <Text style={[styles.icon, active && styles.iconActive]}>
      {icons[name] ?? '●'}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => <View style={styles.tabBarBg} />,
        tabBarActiveTintColor: Colors.secondary,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarLabelStyle: styles.label,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="journey/index"
        options={{
          title: '발자취',
          tabBarIcon: ({ focused }) => <TabBarIcon name="journey" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="log/index"
        options={{
          title: '기록',
          tabBarIcon: ({ focused }) => <TabBarIcon name="log" active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: '나',
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(23, 31, 51, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  icon: {
    fontSize: 22,
    color: Colors.onSurfaceVariant,
  },
  iconActive: {
    color: Colors.secondary,
  },
  label: {
    display: 'none',
  },
});
