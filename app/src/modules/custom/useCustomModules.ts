/**
 * useCustomModules - the list of modules you've created, for the home screen.
 *
 * The home screen needs names, icons, colours, the line each tile shows and
 * the sparkline under it - nothing more. Field definitions are only loaded
 * per module once you open one.
 *
 * NO FETCH ON MOUNT. The home screen reloads on focus, and focus fires on the
 * first mount too, so a mount effect here fetched everything twice.
 */
import { useCallback, useState } from 'react';

import { todayISO } from '../../core/date';
import { useLatestRun } from '../../core/useLatestRun';

import * as api from './api';
import { dateFieldOf } from './entryDate';
// Imported for its side effect as much as its exports: loading this file
// registers the module-reminder resync, and the home screen is on the launch
// path. See notifications.ts.
import './notifications';
import { summarise, type Summary } from './summary';
import { sparklineFor } from './trend';
import type { CustomModule } from './types';

export function useCustomModules() {
  const [modules, setModules] = useState<CustomModule[]>([]);
  /** The line each tile shows, already computed. Keyed by module id. */
  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  /** Each tile's sparkline, or nothing to draw. Keyed by module id. */
  const [sparklines, setSparklines] = useState<Record<string, number[] | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      // Three independent requests, so Promise.all runs them concurrently
      // rather than paying three round trips back to back.
      const [rows, grouped, fields] = await Promise.all([
        api.listModules(),
        api.recordsByModule(),
        api.allFields(),
      ]);

      if (!isCurrent()) return;

      const today = todayISO();
      const nextSummaries: Record<string, Summary> = {};
      const nextSparklines: Record<string, number[] | null> = {};

      rows.forEach((module) => {
        const own = fields.filter((field) => field.module_id === module.id);
        const records = grouped[module.id] ?? [];
        // Summarised here rather than in the screen: it is derived data, and
        // the home screen should render a line, not work one out.
        nextSummaries[module.id] = summarise(
          module,
          own.find((field) => field.key === module.summary_field_key) ?? null,
          records,
          { today, dateField: dateFieldOf(own) },
        );
        nextSparklines[module.id] = sparklineFor(module, own, records);
      });

      setModules(rows);
      setSummaries(nextSummaries);
      setSparklines(nextSparklines);
    } catch (e) {
      if (isCurrent()) setError(e instanceof Error ? e.message : 'Could not load your modules');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [begin]);

  return { modules, summaries, sparklines, loading, error, reload: load };
}
