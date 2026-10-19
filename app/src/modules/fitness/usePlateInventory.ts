/**
 * usePlateInventory - the bar and plates you own, kept on this phone.
 *
 * On the device rather than in the database: your plates are where you
 * train, and a second phone at a second gym has a different set.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_INVENTORY, type Inventory } from './plates';

const KEY = 'eio.fitness.plates';

function parse(text: string | null): Inventory | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text) as Inventory;
    if (typeof value.barKg !== 'number' || !Array.isArray(value.plates)) return null;
    return {
      barKg: value.barKg,
      plates: value.plates
        .filter(
          (p) =>
            typeof p.kg === 'number' && typeof p.pairs === 'number' && p.kg > 0 && p.pairs >= 0,
        )
        .sort((a, b) => b.kg - a.kg),
    };
  } catch {
    return null;
  }
}

export function usePlateInventory() {
  const [inventory, setInventory] = useState<Inventory>(DEFAULT_INVENTORY);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((text) => {
        const stored = parse(text);
        if (active && stored) setInventory(stored);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback((next: Inventory) => {
    const sorted = { ...next, plates: [...next.plates].sort((a, b) => b.kg - a.kg) };
    setInventory(sorted);
    AsyncStorage.setItem(KEY, JSON.stringify(sorted)).catch(() => {});
  }, []);

  return { inventory, save };
}
