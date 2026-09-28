/**
 * App.tsx
 *
 * The entry point, deliberately tiny. It loads fonts, wraps everything in the
 * providers the rest of the app depends on, and hands off to the navigator.
 * All real UI lives under src/.
 *
 * Custom fonts load at runtime, asynchronously. For the first frames they do
 * not exist, so text styled with Inter would fall back to the system font and
 * then visibly reflow once Inter arrives. Holding the splash until they are
 * ready avoids that flash.
 *
 * Provider order matters. SafeAreaProvider, KeyboardProvider and ThemeProvider
 * all sit outside the navigator, because screens inside read insets, keyboard
 * frames and colours from them.
 */
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/core/auth';
import { ThemeProvider, useTheme } from './src/core/ThemeContext';
import { RootNavigator } from './src/navigation/RootNavigator';

// Stop the splash hiding the moment JS boots. Called at module scope so it
// takes effect before the first render.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Throws harmlessly on fast refresh, when the splash is already gone.
});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Keep the splash up rather than rendering unstyled text. If loading fails
  // we still render: degraded typography beats a permanently stuck splash.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {/*
        KeyboardProvider tracks the real keyboard frame from the OS. It has to
        sit above the navigator, because the screens that need it are inside.
      */}
      <KeyboardProvider>
        <ThemeProvider>
          <AuthProvider>
            <Root ready={fontsLoaded || !!fontError} />
          </AuthProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split out so it can call useTheme, which is only available below the
 * provider. It also owns hiding the splash, on the first laid-out frame rather
 * than in an effect, so there is no blank gap between splash and content.
 */
function Root({ ready }: { ready: boolean }) {
  const { colors, isDark } = useTheme();

  const onLayoutRootView = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
      {/* Status bar icons invert with the theme, or they vanish into it. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </View>
  );
}
