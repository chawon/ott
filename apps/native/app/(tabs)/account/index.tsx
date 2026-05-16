import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { deleteAccount } from '../../../lib/api';
import { clearLocalData } from '../../../lib/localDb';
import { syncNow } from '../../../lib/sync';
import { useAuthStore } from '../../../store/authStore';

export default function AccountScreen() {
  const { userId, deviceId, pairingCode, ensureRegistered, pairWithCode, clearCredentials } = useAuthStore();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function issueCode() {
    setBusy(true);
    setStatus(null);
    try {
      await ensureRegistered();
      setStatus('페어링 코드를 발급했어요.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '코드 발급에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!code.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      await pairWithCode(code);
      await syncNow();
      setCode('');
      setStatus('기기를 연결하고 타임라인을 가져왔어요.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '기기 연결에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await syncNow({ registerIfNeeded: !!pairingCode });
      setStatus(`동기화 완료: 업로드 ${result.pushed}, 가져오기 ${result.pulled}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '동기화에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  function resetLocal() {
    Alert.alert('로컬 데이터 초기화', '이 기기에 저장된 기록과 연결 정보를 비웁니다. 서버 데이터는 삭제하지 않습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: async () => {
          await clearLocalData();
          await clearCredentials();
          setStatus('이 기기 데이터를 초기화했어요.');
        },
      },
    ]);
  }

  function removeAccount() {
    Alert.alert('서버 데이터 전체 삭제', '현재 계정의 서버 기록, 댓글, 문의, 기기 연결을 모두 삭제합니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            await clearLocalData();
            await clearCredentials();
            setStatus('서버 데이터와 이 기기 데이터를 삭제했어요.');
          } catch (error) {
            setStatus(error instanceof Error ? error.message : '서버 데이터 삭제에 실패했습니다.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>계정과 기기 연결</Text>
        <Text style={styles.desc}>이메일 없이 페어링 코드로 같은 타임라인을 이어 씁니다.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>내 페어링 코드</Text>
        <View style={styles.codeBox}>
          <Text style={styles.codeText}>{pairingCode ?? '-'}</Text>
        </View>
        <Text style={styles.desc}>
          {pairingCode ? '다른 기기에서 이 코드를 입력하세요.' : '첫 기록을 저장하거나 아래 버튼으로 코드를 발급하세요.'}
        </Text>
        <Pressable disabled={busy} onPress={issueCode} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>코드 발급</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>기존 타임라인 연결</Text>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.toUpperCase())}
          placeholder="페어링 코드 입력"
          placeholderTextColor={Colors.onSurfaceVariant}
          autoCapitalize="characters"
          style={styles.input}
        />
        <Pressable disabled={busy || !code.trim()} onPress={connect} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>이 기기 연결</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>운영</Text>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>user</Text>
          <Text style={styles.identityValue}>{userId ? userId.slice(0, 8) : '-'}</Text>
        </View>
        <View style={styles.identityRow}>
          <Text style={styles.identityLabel}>device</Text>
          <Text style={styles.identityValue}>{deviceId ? deviceId.slice(0, 8) : '-'}</Text>
        </View>
        <Pressable disabled={busy} onPress={sync} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>지금 동기화</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/feedback')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>문의함 열기</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>데이터 관리</Text>
        <Pressable onPress={resetLocal} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>이 기기 로컬 초기화</Text>
        </Pressable>
        <Pressable disabled={!userId || !deviceId || busy} onPress={removeAccount} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>서버 데이터 전체 삭제</Text>
        </Pressable>
      </View>

      {status ? <Text style={styles.status}>{status}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 64, paddingBottom: 120, gap: 16 },
  header: { gap: 8 },
  kicker: { ...Typography.accent },
  title: { ...Typography.headlineLg, fontSize: 30 },
  desc: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    backgroundColor: Colors.surface,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { ...Typography.headlineSm },
  codeBox: {
    minHeight: 58,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
  },
  codeText: { ...Typography.headlineMd, letterSpacing: 4, color: Colors.primaryContainer },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    paddingHorizontal: 12,
    color: Colors.onSurface,
    ...Typography.bodyLg,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: Colors.onSurface, fontWeight: '800' },
  dangerButton: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: { color: Colors.error, fontWeight: '800' },
  identityRow: { flexDirection: 'row', justifyContent: 'space-between' },
  identityLabel: { ...Typography.labelLg },
  identityValue: { ...Typography.bodyMd, color: Colors.onSurfaceVariant },
  status: { ...Typography.bodyMd, color: Colors.secondary, paddingHorizontal: 4 },
});
