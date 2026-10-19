/**
 * useBucketData - the B-List's items and steps on the desktop, and every
 * change to them.
 *
 * The same rules as the phone's useBucket, which this cannot import: a React
 * hook compiled from ../app would resolve the app's own copy of React. The
 * queries and every rule they feed are shared (api.ts and the pure files);
 * only this thin state layer is written twice.
 *
 * Each change shows at once and puts back only the fields it wrote, on its own
 * row, if the database refuses it. Restoring a snapshot of the whole list
 * would also undo every other tick made while this one was in flight. Writes
 * to one row are chained so a tick and its Undo land in the order made.
 */
import { useCallback, useRef, useState } from 'react';

import * as api from '@app/modules/bucket/api';
import type { ItemPatch } from '@app/modules/bucket/api';
import { nextStepPosition, stepMoves } from '@app/modules/bucket/shelf';
import type { BucketInput, BucketItem, BucketStep } from '@app/modules/bucket/types';

import { useAsync } from '../../lib/useAsync';

type Data = { items: BucketItem[]; steps: BucketStep[] };

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export const isPendingStep = (step: BucketStep) => step.id.startsWith('pending-');

async function loadAll(): Promise<Data> {
  const [items, steps] = await Promise.all([api.listItems(), api.listSteps()]);
  return { items, steps };
}

export function useBucketData() {
  const { data, loading, error, reload, set } = useAsync(loadAll, 'bucket');
  const [actionError, setActionError] = useState<string | null>(null);

  /** The last write queued for each row, so the next one waits for it. */
  const queues = useRef(new Map<string, Promise<unknown>>());
  const inOrder = useCallback(<T,>(id: string, write: () => Promise<T>): Promise<T> => {
    const previous = queues.current.get(id) ?? Promise.resolve();
    // After the previous write, whether it worked or not.
    const next = previous.then(write, write);
    const settled = next.catch(() => undefined);
    queues.current.set(id, settled);
    void settled.then(() => {
      if (queues.current.get(id) === settled) queues.current.delete(id);
    });
    return next;
  }, []);

  const clearActionError = useCallback(() => setActionError(null), []);

  const setItems = useCallback(
    (update: (items: BucketItem[]) => BucketItem[]) =>
      set((current) => ({ ...current, items: update(current.items) })),
    [set],
  );
  const setSteps = useCallback(
    (update: (steps: BucketStep[]) => BucketStep[]) =>
      set((current) => ({ ...current, steps: update(current.steps) })),
    [set],
  );

  /** Change some fields of an item, optimistically. */
  const patch = useCallback(
    async (id: string, fields: ItemPatch): Promise<boolean> => {
      const keys = Object.keys(fields) as (keyof ItemPatch)[];
      // Cast so TypeScript does not narrow it to null: it is assigned inside
      // the updater, which control-flow analysis cannot see.
      let before = null as ItemPatch | null;

      setActionError(null);
      setItems((items) =>
        items.map((row) => {
          if (row.id !== id) return row;
          before = Object.fromEntries(keys.map((key) => [key, row[key]])) as ItemPatch;
          return { ...row, ...fields };
        }),
      );

      try {
        await inOrder(id, () => api.patchItem(id, fields));
        return true;
      } catch (e) {
        const previous = before;
        if (previous) setItems((items) => items.map((row) => (row.id === id ? { ...row, ...previous } : row)));
        setActionError(messageOf(e, 'Could not save that'));
        return false;
      }
    },
    [setItems, inOrder],
  );

  /** Change fields and wait for the answer. Throws, for the dialog to show. */
  const save = useCallback(
    async (id: string, fields: ItemPatch) => {
      await inOrder(id, () => api.patchItem(id, fields));
      setItems((items) => items.map((row) => (row.id === id ? { ...row, ...fields } : row)));
    },
    [setItems, inOrder],
  );

  /** Demotion first, each rolling back only itself. See api.swapNow. */
  const swapNow = useCallback(
    async (outId: string, inId: string) =>
      (await patch(outId, { focus: 'next' })) && patch(inId, { focus: 'now' }),
    [patch],
  );

  const create = useCallback(
    async (input: BucketInput & ItemPatch) => {
      const created = await api.createItem(input);
      await reload();
      return created;
    },
    [reload],
  );

  const remove = useCallback(
    async (item: BucketItem) => {
      try {
        await api.deleteItem(item.id);
        await reload();
      } catch (e) {
        setActionError(messageOf(e, 'Could not delete that'));
      }
    },
    [reload],
  );

  const steps = data?.steps;

  const addStep = useCallback(
    async (itemId: string, title: string) => {
      const position = nextStepPosition((steps ?? []).filter((step) => step.item_id === itemId));
      const now = new Date().toISOString();
      const pendingId = `pending-${now}-${Math.random().toString(36).slice(2)}`;
      setSteps((rows) => [
        ...rows,
        {
          id: pendingId,
          user_id: '',
          item_id: itemId,
          title,
          is_done: false,
          position,
          created_at: now,
          updated_at: now,
        },
      ]);
      try {
        const saved = await api.addStep(itemId, title, position);
        setSteps((rows) => rows.map((row) => (row.id === pendingId ? saved : row)));
      } catch (e) {
        setSteps((rows) => rows.filter((row) => row.id !== pendingId));
        setActionError(messageOf(e, 'Could not add that step'));
      }
    },
    [steps, setSteps],
  );

  const toggleStep = useCallback(
    async (step: BucketStep) => {
      const next = !step.is_done;
      setSteps((rows) => rows.map((row) => (row.id === step.id ? { ...row, is_done: next } : row)));
      try {
        await api.updateStep(step.id, { is_done: next });
      } catch (e) {
        setSteps((rows) =>
          rows.map((row) => (row.id === step.id ? { ...row, is_done: step.is_done } : row)),
        );
        setActionError(messageOf(e, 'Could not save that step'));
      }
    },
    [setSteps],
  );

  const removeStep = useCallback(
    async (step: BucketStep) => {
      setSteps((rows) => rows.filter((row) => row.id !== step.id));
      try {
        await api.deleteStep(step.id);
      } catch (e) {
        setSteps((rows) => (rows.some((row) => row.id === step.id) ? rows : [...rows, step]));
        setActionError(messageOf(e, 'Could not remove that step'));
      }
    },
    [setSteps],
  );

  const restoreStep = useCallback(
    async (step: BucketStep) => {
      setSteps((rows) => (rows.some((row) => row.id === step.id) ? rows : [...rows, step]));
      try {
        await api.restoreStep(step);
      } catch (e) {
        setSteps((rows) => rows.filter((row) => row.id !== step.id));
        setActionError(messageOf(e, 'Could not put that step back'));
      }
    },
    [setSteps],
  );

  const moveStep = useCallback(
    async (step: BucketStep, direction: -1 | 1) => {
      const siblings = (steps ?? []).filter((row) => row.item_id === step.item_id);
      // A step without an id yet cannot be renumbered.
      if (siblings.some(isPendingStep)) return;
      const moves = stepMoves(siblings, step.id, direction);
      if (moves.length === 0) return;
      const before = new Map(siblings.map((row) => [row.id, row.position]));
      const after = new Map(moves.map((m) => [m.id, m.position]));

      setSteps((rows) =>
        rows.map((row) => (after.has(row.id) ? { ...row, position: after.get(row.id)! } : row)),
      );
      try {
        await api.reorderSteps(moves);
      } catch (e) {
        setSteps((rows) =>
          rows.map((row) => (after.has(row.id) ? { ...row, position: before.get(row.id)! } : row)),
        );
        setActionError(messageOf(e, 'Could not move that step'));
      }
    },
    [steps, setSteps],
  );

  return {
    items: data?.items ?? null,
    steps: data?.steps ?? null,
    loading,
    error: error ?? actionError,
    /** Errors from changes made on the page, for a dialog to show too. */
    actionError,
    clearActionError,
    reload,
    patch,
    save,
    swapNow,
    create,
    remove,
    addStep,
    toggleStep,
    removeStep,
    restoreStep,
    moveStep,
  };
}
