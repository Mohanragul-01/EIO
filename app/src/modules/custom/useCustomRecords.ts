/**
 * useCustomRecords - one module's definition plus its entries.
 *
 * Loads three things together: the module, its field definitions, and its
 * records. The list screen can't render anything without all three - the
 * fields are what tell it how to read the jsonb - so they're fetched as one
 * unit rather than as three separate loading states.
 *
 * NO FETCH ON MOUNT. The list screen loads on focus, and focus fires on the
 * first mount too, so a mount effect here fetched everything twice on every
 * visit. The screen's focus effect is the one trigger.
 *
 * Every load also rebuilds the module's reminders from the rows it fetched,
 * which is how logging today's entry cancels today's nudge.
 */
import { useCallback, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import { syncModuleReminders } from './notifications';
import { sortRecords } from './summary';
import type { CustomField, CustomModule, CustomRecord } from './types';

type LoadMode = 'initial' | 'refresh' | 'silent';

/** The module's own order, re-applied whenever a row is added or changed. */
function ordered(records: CustomRecord[], module: CustomModule | null, fields: CustomField[]) {
  if (!module) return records;
  // Sorted here rather than in SQL. Ordering by a jsonb value in Postgres
  // means data->>'key', which compares everything as TEXT: that puts 100
  // before 9 for a number field, and it is not obviously wrong until you look.
  return sortRecords(
    records,
    module,
    fields.find((field) => field.key === module.sort_field_key) ?? null,
  );
}

export function useCustomRecords(moduleId: string) {
  const [module, setModule] = useState<CustomModule | null>(null);
  const [fields, setFields] = useState<CustomField[]>([]);
  const [records, setRecords] = useState<CustomRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin } = useLatestRun();

  const load = useCallback(
    async (mode: LoadMode) => {
      const isCurrent = begin();
      if (mode === 'refresh') setRefreshing(true);
      setError(null);

      try {
        const [moduleRow, fieldRows, recordRows] = await Promise.all([
          api.getModule(moduleId),
          api.listFields(moduleId),
          api.listRecords(moduleId),
        ]);

        if (isCurrent()) {
          setModule(moduleRow);
          setFields(fieldRows);
          setRecords(ordered(recordRows, moduleRow, fieldRows));
          // Fire and forget: a reminder that cannot be scheduled (Expo Go, no
          // permission) is a normal outcome and must not touch the screen.
          void syncModuleReminders(moduleRow, fieldRows, recordRows).catch(() => {});
        }
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [moduleId, begin],
  );

  /**
   * Log an entry from values already resolved (a quick log). The row appears
   * at once; a quiet reload then confirms it and moves the reminders.
   */
  const add = useCallback(
    async (data: Record<string, unknown>): Promise<CustomRecord> => {
      const created = await api.createRecord(moduleId, data);
      setRecords((current) => ordered([created, ...current], module, fields));
      void load('silent');
      return created;
    },
    [moduleId, module, fields, load],
  );

  /**
   * Remove one entry. Optimistic, and a failure puts back THIS row only:
   * restoring a whole-list snapshot would also resurrect anything else
   * deleted while this delete was in flight.
   */
  const remove = useCallback(
    async (record: CustomRecord) => {
      let index = -1;
      setRecords((current) => {
        index = current.findIndex((r) => r.id === record.id);
        return current.filter((r) => r.id !== record.id);
      });

      try {
        await api.deleteRecord(record.id);
        void load('silent');
      } catch (e) {
        setRecords((current) => {
          if (current.some((r) => r.id === record.id)) return current;
          const next = [...current];
          next.splice(index < 0 ? next.length : index, 0, record);
          return next;
        });
        setError(e instanceof Error ? e.message : 'Could not delete');
      }
    },
    [load],
  );

  /**
   * Set one value on one entry in place - the row's yes/no toggle. The row
   * changes at once; a failure puts back that one value on that one row, and
   * leaves every other row (and every other value on this one) alone.
   */
  const setValue = useCallback(
    async (record: CustomRecord, key: string, value: unknown) => {
      const previous = record.data[key];
      const patch = (rows: CustomRecord[], next: unknown) =>
        rows.map((row) =>
          row.id === record.id ? { ...row, data: { ...row.data, [key]: next } } : row,
        );

      setRecords((current) => patch(current, value));
      try {
        await api.updateRecord(record.id, { ...record.data, [key]: value });
      } catch (e) {
        setRecords((current) => patch(current, previous));
        setError(e instanceof Error ? e.message : 'Could not save that');
      }
    },
    [],
  );

  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load('refresh'));
  const reload = useStableCallback(() => load('initial'));

  return {
    module,
    fields,
    records,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    add,
    remove,
    setValue,
  };
}
