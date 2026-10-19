/**
 * pickPrefs.ts - what Pick for me remembers on this device.
 *
 * Two things: how many times you shuffled today, so the picks you shuffled to
 * are still there when you come back this afternoon, and whether you folded
 * the card away. The shuffle resets with the day; the fold does not.
 *
 * Device-local on purpose. It is a view preference, not data - the phone and
 * the website can each show their own three without either being wrong - and
 * a database column for it would be a write on every shuffle.
 *
 * Reading never throws: storage can return nothing, garbage or a shape from an
 * older version, and a preference must never be why the list fails to open.
 * The parsing is pure and lives in picks.ts, where it is tested; this file is
 * only the storage around it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FRESH_PICK_PREFS,
  parsePickPrefs,
  serialisePickPrefs,
  type PickPrefs,
  type StoredPickPrefs,
} from './picks';

const KEY = 'eio.bucket.picks.v1';

export async function readPickPrefs(today: string): Promise<PickPrefs> {
  try {
    return parsePickPrefs(await AsyncStorage.getItem(KEY), today);
  } catch {
    return FRESH_PICK_PREFS;
  }
}

export async function writePickPrefs(prefs: StoredPickPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, serialisePickPrefs(prefs));
  } catch {
    // Not worth a word: the picks still work, they just will not be the same
    // three after a restart.
  }
}
