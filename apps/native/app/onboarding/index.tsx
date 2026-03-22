import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { register, pair } from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

export default function OnboardingScreen() {
  const [mode, setMode] = useState<'choice' | 'new' | 'pair'>('choice');
  const [pairCode, setPairCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setCredentials } = useAuthStore();

  const handleNew = async () => {
    setLoading(true);
    setError('');
    try {
      const { userId, deviceId } = await register();
      await setCredentials(userId, deviceId);
      router.replace('/(tabs)/journey');
    } catch {
      setError('계정 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handlePair = async () => {
    if (pairCode.trim().length < 4) {
      setError('올바른 페어링 코드를 입력해주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { userId, deviceId } = await pair(pairCode.trim());
      await setCredentials(userId, deviceId);
      router.replace('/(tabs)/journey');
    } catch {
      setError('페어링에 실패했습니다. 코드를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* 배경 글로우 */}
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />

      <View style={styles.content}>
        <Text style={styles.logo}>ottline</Text>
        <Text style={styles.tagline}>나의 발자취를 기록하세요</Text>

        {mode === 'choice' && (
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => setMode('new')}>
              <Text style={styles.primaryBtnText}>새로 시작하기</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.glassBtn} onPress={() => setMode('pair')}>
              <Text style={styles.glassBtnText}>기존 계정 연결</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'new' && (
          <View style={styles.buttons}>
            <Text style={styles.desc}>
              새 계정을 만들고 발자취 여정을 시작합니다.{'\n'}
              페어링 코드로 웹 계정과 연결할 수 있습니다.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={handleNew} disabled={loading}>
              {loading ? <ActivityIndicator color="#0b1326" /> : <Text style={styles.primaryBtnText}>시작하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => { setMode('choice'); setError(''); }}>
              <Text style={styles.textBtnText}>뒤로</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'pair' && (
          <View style={styles.buttons}>
            <Text style={styles.desc}>
              웹(ottline.app)의 계정 설정에서{'\n'}페어링 코드를 확인하세요.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="페어링 코드 입력"
              placeholderTextColor={Colors.outlineVariant}
              value={pairCode}
              onChangeText={setPairCode}
              autoCapitalize="characters"
              maxLength={12}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.primaryBtn} onPress={handlePair} disabled={loading}>
              {loading ? <ActivityIndicator color="#0b1326" /> : <Text style={styles.primaryBtnText}>연결하기</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.textBtn} onPress={() => { setMode('choice'); setError(''); setPairCode(''); }}>
              <Text style={styles.textBtnText}>뒤로</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  glowTop: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.primaryContainer,
    opacity: 0.08,
  },
  glowBottom: {
    position: 'absolute',
    bottom: -80,
    right: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: Colors.secondary,
    opacity: 0.06,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    ...Typography.displayMd,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  tagline: {
    ...Typography.bodyLg,
    color: Colors.onSurfaceVariant,
    marginBottom: 56,
  },
  buttons: {
    gap: 12,
  },
  desc: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.primaryContainer,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtnText: {
    ...Typography.bodyLg,
    color: Colors.primaryFixed,
    fontWeight: '700',
  },
  glassBtn: {
    backgroundColor: 'rgba(45, 52, 73, 0.4)',
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: `${Colors.outlineVariant}33`,
  },
  glassBtnText: {
    ...Typography.bodyLg,
    color: Colors.secondary,
    fontWeight: '600',
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textBtnText: {
    ...Typography.bodyMd,
    color: Colors.onSurfaceVariant,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    ...Typography.bodyLg,
    color: Colors.onSurface,
    borderWidth: 1.5,
    borderColor: `${Colors.outlineVariant}33`,
  },
  error: {
    ...Typography.bodyMd,
    color: Colors.error,
    textAlign: 'center',
  },
});
