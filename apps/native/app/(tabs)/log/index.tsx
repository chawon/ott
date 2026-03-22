import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';

export default function LogScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.icon}>✍️</Text>
        <Text style={styles.title}>기록하기</Text>
        <Text style={styles.desc}>Quick Log 화면 — 곧 구현될 예정입니다</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  icon: { fontSize: 48 },
  title: { ...Typography.headlineMd },
  desc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
});
