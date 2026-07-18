import { I18nManager, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import Tabs from './src/navigation/Tabs';
import { COLORS } from './src/theme';

I18nManager.forceRTL(true);
I18nManager.allowRTL(true);

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.background },
};

export default function App() {
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