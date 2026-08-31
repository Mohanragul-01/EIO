/**
 * useCustomRecords - one module's definition plus its entries.
 *
 * Loads three things together: the module, its field definitions, and its
 * records. The list screen can't render anything without all three - the
 * fields are what tell it how to read the jsonb - so they're fetched as one
 * unit rather than as three separate loading states.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import { sortRecords } from './summary';
import type { CustomField, CustomModule, CustomRecord } from './types';

export function useCustomRecords(moduleId: string) {
  const [module, setModule] = useState<CustomModule | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [records, setRecords] = useState<CustomRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true);
      setError(null);

      try {
        const [moduleRow, fieldRows, recordRows] = await Promise.all([
          api.getModule(moduleId),
          api.listFields(moduleId),
          api.listRecords(moduleId),
        ]);

        if (mounted.current) {
          setModule(moduleRow);
          setFields(fieldRows);
          // Sorted here rather than in SQL. Ordering by a jsonb value in
          // Postgres means data->>'key', which compares everything as TEXT:
          // that puts 100 before 9 for a number field, and it is not obviously
          // wrong until you look closely.
          setRecords(
            sortRecords(
              recordRows,
              moduleRow,
              fieldRows.find((field) => field.key === moduleRow.sort_field_key) ?? null,
            ),
          );
        }
      } catch (e) {
        if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [moduleId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const remove = useCallback(
    async (record: CustomRecord) => {
      const snapshot = records;
      setRecords((current) => current.filter((r) => r.id !== record.id));

      try {
        await api.deleteRecord(record.id);
      } catch (e) {
        setRecords(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [records],
  );


  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    module,
    fields,
    records,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    remove,
  };
}
