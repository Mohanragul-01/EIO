/**
 * useCustomModules - your own modules, plus the summary each tile shows.
 *
 * The counterpart to the app's hook of the same name, and it calls the very
 * same api.ts and the very same `summarise()`. Only the React plumbing differs.
 *
 * Three queries in parallel rather than one per module: a personal app can
 * easily have a dozen modules, and a query each would be a dozen round trips
 * every time the sidebar mounts.
 */
import { useCallback } from 'react';

import * as api from '@app/modules/custom/api';
import { summarise, type Summary } from '@app/modules/custom/summary';
import type { CustomModule } from '@app/modules/custom/types';

import { useAsync } from '../../lib/useAsync';

type Loaded = {
  modules: CustomModule[];
  summaries: Record<string, Summary>;
};

export function useCustomModules() {
  const load = useCallback(async (): Promise<Loaded> => {
    const [modules, grouped, fields] = await Promise.all([
      api.listModules(),
      api.recordsByModule(),
      api.allFields(),
    ]);

    return {
      modules,
      // Computed here rather than in a component: it is derived data, and a
      // tile should render a line, not work one out.
      summaries: Object.fromEntries(
        modules.map((module) => [
          module.id,
          summarise(
            module,
            fields.find(
              (field) => field.module_id === module.id && field.key === module.summary_field_key,
            ) ?? null,
            grouped[module.id] ?? [],
          ),
        ]),
      ),
    };
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'custom-modules');

  return {
    modules: data?.modules ?? [],
    summaries: data?.summaries ?? {},
    loading,
    error,
    reload,
  };
}
