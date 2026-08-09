/**
 * ThemeContext.tsx
 *
 * Holds the active colour mode and hands the matching palette to every
 * component via useTheme().
 *
 * Three modes are offered rather than two. "System" follows the phone's own
 * light/dark setting, which is what most people expect by default; the two
 * explicit modes are for when you want the app to ignore that.
 *
 * The choice is saved to AsyncStorage so it survives a restart, and read back
 * before the first paint so the app never flashes the wrong palette.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import {
  makeElevation,
  makeTypography,
  paletteFor,
  resolveIsDark,
  type Elevation,
  type ThemeColors,
  type Typography,
} from './theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'eio.theme-mode';

type ThemeValue = {
  colors: ThemeColors;
  typography: Typography;
  elevation: Elevation;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Whatever the phone itself is set to. Updates live if the user changes
  // their system setting while the app is open.
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setModeState(stored);
        }
      })
      .catch(() => {
        // A failed read just means we keep the default. Not worth surfacing.
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    // Update state first so the UI responds immediately, then persist. Waiting
    // on the write would add a visible delay to a toggle.
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const isDark = resolveIsDark(mode, systemScheme);
    const colors = paletteFor(isDark);

    return {
      colors,
      typography: makeTypography(colors),
      elevation: makeElevation(colors, isDark),
      isDark,
      mode,
      setMode,
    };
  }, [mode, systemScheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside a <ThemeProvider>');
  }
  return context;
}

/**
 * makeStyles: the bridge between StyleSheet and a theme that changes at runtime.
 *
 * The usual React Native pattern is a module-level StyleSheet.create(...), but
 * that runs once at import and captures whichever palette was current then, so
 * it can never respond to a theme switch. Instead each file declares a factory:
 *
 *   const useStyles = makeStyles(({ colors, typography }) => ({
 *     card: { backgroundColor: colors.glass },
 *   }));
 *
 * and the component calls `const styles = useStyles()`. The result is memoised
 * per palette, so switching themes rebuilds the sheet once and normal renders
 * reuse it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- see note below */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  // This signature is copied from StyleSheet.create, `any` included, and the
  // `any` is load-bearing. It makes TypeScript treat the returned object as a
  // style sheet while inferring it, so `flexDirection: 'row'` stays the literal
  // 'row' rather than widening to string. Widened to string it would fail to
  // match ViewStyle at every call site; narrowed to `never` it loses the key
  // names instead. This is the one form that keeps both.
  factory: (theme: ThemeValue) => T & StyleSheet.NamedStyles<any>,
) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
