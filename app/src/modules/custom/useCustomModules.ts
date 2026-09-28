/**
 * useCustomModules - the list of modules you've created, for the home screen.
 *
 * Deliberately lightweight: the home screen needs names, icons, colours and a
 * record count, nothing more. Field definitions are only loaded once you open
 * a module.
 */
import { useCallback, useEffect, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';

import * as api from './api';
import { summarise, type Summary } from './summary';
import type { CustomModule } from './types';

export function useCustomModules() {
  const [modules, setModules] = useState<CustomModule[]>([]);
  /** The line each tile shows, already computed. Keyed by module id. */
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    setLoading(true);
    try {
      // Both requests are independent, so Promise.all runs them concurrently
      // rather than paying two round trips back to back.
      const [rows, grouped, fields] = await Promise.all([
        api.listModules(),
        api.recordsByModule(),
        api.allFields(),
      ]);

      if (!isCurrent()) return;

      setModules(rows);
      // Summarised here rather than in the screen: it is derived data, and the
      // home screen should render a line, not work one out.
      setSummaries(
        Object.fromEntries(
          rows.map((module) => [
            module.id,
            summarise(
              module,
              fields.find(
                (field) =>
                  field.module_id === module.id && field.key === module.summary_field_key,
              ) ?? null,
              grouped[module.id] ?? [],
            ),
          ]),
        ),
      );
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load your modules');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { modules, summaries, loading, error, reload: load };
}
