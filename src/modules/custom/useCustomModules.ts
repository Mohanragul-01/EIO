/**
 * useCustomModules - the list of modules you've created, for the home screen.
 *
 * Deliberately lightweight: the home screen needs names, icons, colours and a
 * record count, nothing more. Field definitions are only loaded once you open
 * a module.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import * as api from './api';
import type { CustomModule } from './types';

export function useCustomModules() {
  const [modules, setModules] = useState<CustomModule[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Both requests are independent, so Promise.all runs them concurrently
      // rather than paying two round trips back to back.
      const [rows, recordCounts] = await Promise.all([
        api.listModules(),
        api.countRecordsByModule(),
      ]);
      if (mounted.current) {
        setModules(rows);
        setCounts(recordCounts);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not load your modules');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { modules, counts, loading, error, reload: load };
}
