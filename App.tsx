// App.tsx
// نقطة البداية — entry point: activation gate + RTL + navigation

import { useState, useEffect } from 'react';
import { I18nManager, StatusBar, View, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Tabs from './src/navigation/Tabs';
import ActivationScreen from './src/screens/ActivationScreen';
import { COLORS } from './src/theme';
import { syncNow, isSyncConfigured } from './src/sync';

const ACTIVATION_KEY = 'app_activated';

I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.background },
};

export default function App() {
  const [checking, setChecking] = useState(true);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    (async () => {
      const val = await AsyncStorage.getItem(ACTIVATION_KEY);
      setActivated(val === 'true');
      setChecking(false);
    })();
  }, []);

  const handleActivated = async () => {
    await AsyncStorage.setItem(ACTIVATION_KEY, 'true');
    setActivated(true);
  };

  if (checking) {
    return (
      <View style={styles.loading}>
        <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
      // مزامنة سحابية دورية كل 5 دقائق كشبكة أمان — periodic background sync
  useEffect(() => {
    if (!activated || !isSyncConfigured()) return;
    const interval = setInterval(() => { syncNow(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activated]);
  }

  if (!activated) {
    return <ActivationScreen onActivated={handleActivated} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <ExpoStatusBar style="light" />
        <StatusBar backgroundColor={COLORS.primaryDark} barStyle="light-content" />
        <Tabs />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.primaryDark, alignItems: 'center', justifyContent: 'center' },
});