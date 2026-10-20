/**
 * useFitnessMode - Gym or Calisthenics, remembered per browser.
 *
 * The phone remembers it per device; the browser's equivalent is
 * localStorage, under the same key, read through the app's parseMode so an
 * unreadable or missing value is the gym, the original look. Storage can be
 * blocked (a private window); the choice then simply lasts for the visit.
 */
import { useCallback, useState } from 'react';

import { MODE_STORAGE_KEY, parseMode } from '@app/modules/fitness/mode';
import type { FitnessMode } from '@app/modules/fitness/types';

function readMode(): FitnessMode {
  try {
    return parseMode(localStorage.getItem(MODE_STORAGE_KEY));
  } catch {
    return 'gym';
  }
}

export function useFitnessMode(): [FitnessMode, (mode: FitnessMode) => void] {
  const [mode, setModeState] = useState<FitnessMode>(readMode);

  const setMode = useCallback((next: FitnessMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // Blocked storage: the switch still applies for this visit.
    }
  }, []);

  return [mode, setMode];
}
