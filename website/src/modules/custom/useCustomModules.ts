/**
 * useCustomModules - your own modules, plus the summary and sparkline each
 * tile shows.
 *
 * The counterpart to the app's hook of the same name, and it calls the very
 * same api.ts, `summarise()` and `sparklineFor()`. Only the React plumbing
 * differs.
 *
 * Three queries in parallel rather than one per module: a personal app can
 * easily have a dozen modules, and a query each would be a dozen round trips
 * every time the sidebar mounts.
 */
import { useCallback } from 'react';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/custom/api';
import { dateFieldOf } from '@app/modules/custom/entryDate';
import { summarise, type Summary } from '@app/modules/custom/summary';
import { sparklineFor } from '@app/modules/custom/trend';
import type { CustomModule } from '@app/modules/custom/types';

import { useAsync } from '../../lib/useAsync';

type Loaded = {
  modules: CustomModule[];
  summaries: Record<string, Summary>;
  sparklines: Record<string, number[] | null>;
};

export function useCustomModules() {
  const load = useCallback(async (): Promise<Loaded> => {
    const [modules, grouped, fields] = await Promise.all([
      api.listModules(),
      api.recordsByModule(),
      api.allFields(),
    ]);

    const today = todayISO();
    const summaries: Record<string, Summary> = {};
    const sparklines: Record<string, number[] | null> = {};

    // Computed here rather than in a component: it is derived data, and a
    // tile should render a line, not work one out.
    modules.forEach((module) => {
      const own = fields.filter((field) => field.module_id === module.id);
      const records = grouped[module.id] ?? [];
      summaries[module.id] = summarise(
        module,
        own.find((field) => field.key === module.summary_field_key) ?? null,
        records,
        { today, dateField: dateFieldOf(own) },
      );
      sparklines[module.id] = sparklineFor(module, own, records);
    });

    return { modules, summaries, sparklines };
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'custom-modules');

  return {
    modules: data?.modules ?? [],
    summaries: data?.summaries ?? {},
    sparklines: data?.sparklines ?? {},
    loading,
    error,
    reload,
  };
}
