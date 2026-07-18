// src/screens/ActivationScreen.tsx
// شاشة التفعيل — one-time activation gate (8-box passcode)

import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, Animated,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '../theme';
import { ACTIVATION_CODE } from '../config';

export default function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [shakeAnim] = useState(new Animated.Value(0));
  const inputRef = useRef<TextInput>(null);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 8);
    setError(false);
    setCode(cleaned);
  };

  useEffect(() => {
    if (code.length === 8) {
      if (code.toUpperCase() === ACTIVATION_CODE.toUpperCase()) {
        onActivated();
      } else {
        setError(true);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start();
        const t = setTimeout(() => { setCode(''); setError(false); inputRef.current?.focus(); }, 700);
        return () => clearTimeout(t);
      }
    }
  }, [code]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />

      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Ionicons name="cube" size={44} color="#fff" />
        </View>
        <Text style={styles.appName}>إدارة المخزون</Text>
        <Text style={styles.tagline}>نظام إدارة المخزون والديون</Text>
      </View>

      <Text style={styles.welcome}>مرحباً بك 👋</Text>
      <Text style={styles.instruction}>أدخل رمز التفعيل المكون من 8 خانات للمتابعة</Text>

      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxArea}>
        <Animated.View style={[styles.boxRow, { transform: [{ translateX: shakeAnim }], direction: 'ltr' }]}>
          {[0, 1, 2, 3].map(i => (
            <Box key={i} char={code[i]} error={error} active={code.length === i} />
          ))}
          <View style={styles.divider} />
          {[4, 5, 6, 7].map(i => (
            <Box key={i} char={code[i]} error={error} active={code.length === i} />
          ))}
        </Animated.View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={code}
          onChangeText={handleChange}
          maxLength={8}
          autoFocus
          keyboardType="default"
          autoCapitalize="characters"
          autoCorrect={false}
          textContentType="oneTimeCode"
        />
      </Pressable>

      <Text style={[styles.errorMsg, { opacity: error ? 1 : 0 }]}>❌ رمز التفعيل غير صحيح</Text>

      <Text style={styles.footer}>للحصول على رمز التفعيل، تواصل مع مالك التطبيق</Text>
    </KeyboardAvoidingView>
  );
}

function Box({ char, error, active }: { char?: string; error: boolean; active: boolean }) {
  return (
    <View style={[styles.box, error && styles.boxError, active && styles.boxActive, char && styles.boxFilled]}>
      <Text style={styles.boxChar}>{char || ''}</Text>
    </View>
  );
}

const BOX_SIZE = 38;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg },
  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoCircle: { width: 90, height: 90, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  appName: { color: '#fff', fontSize: 26, fontWeight: '800' },
  tagline: { color: '#99f6e4', fontSize: 13, marginTop: 4 },
  welcome: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  instruction: { color: '#ccfbf1', fontSize: 13, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  boxArea: { position: 'relative' },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: { width: BOX_SIZE, height: BOX_SIZE, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  boxFilled: { backgroundColor: 'rgba(255,255,255,0.22)', borderColor: 'rgba(255,255,255,0.5)' },
  boxActive: { borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.15)' },
  boxError: { borderColor: COLORS.red, backgroundColor: 'rgba(239,68,68,0.18)' },
  boxChar: { color: '#fff', fontSize: 22, fontWeight: '800' },
  divider: { width: 14, height: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)', marginHorizontal: 2 },
  hiddenInput: { position: 'absolute', opacity: 0, width: '100%', height: '100%', top: 0, left: 0 },
  errorMsg: { color: '#fecaca', fontSize: 13, marginTop: 18, fontWeight: '600', height: 18 },
  footer: { color: 'rgba(204,251,241,0.6)', fontSize: 11, marginTop: 40, textAlign: 'center', lineHeight: 18 },
});