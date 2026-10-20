/**
 * useFitnessMode - which lens Fitness is looking through, Gym or Calisthenics.
 *
 * Held by the Fitness home screen and shared with its tabs through context,
 * so switching it changes every tab at once rather than each tab keeping its
 * own copy. Saved to the device, and read back before the first paint where
 * possible; until it arrives the screen shows the gym, the original look.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { MODE_STORAGE_KEY, parseMode } from './mode';
import type { FitnessMode } from './types';

type ModeValue = { mode: FitnessMode; setMode: (mode: FitnessMode) => void };

const ModeContext = createContext<ModeValue>({ mode: 'gym', setMode: () => {} });

export function FitnessModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<FitnessMode>('gym');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(MODE_STORAGE_KEY)
      .then((stored) => {
        if (active) setModeState(parseMode(stored));
      })
      .catch(() => {
        // Unreadable storage keeps the default.
      });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback((next: FitnessMode) => {
    setModeState(next);
    AsyncStorage.setItem(MODE_STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

/** Outside a provider this reads as the gym, which is what every screen did before modes. */
export function useFitnessMode(): ModeValue {
  return useContext(ModeContext);
}
