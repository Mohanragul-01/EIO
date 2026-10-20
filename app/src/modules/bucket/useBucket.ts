/**
 * useBucket - the B-List's data, and every change to it, for the phone.
 *
 * The list screen used to hold its rows and write them itself. v3 adds a
 * dozen kinds of change - tick, memory, Now and Next, Not now, plan, steps -
 * and each needs the same care, so they live here once.
 *
 * OPTIMISTIC, AND HONEST ABOUT FAILURE. You tick this list in bursts, so
 * every change shows at once and the round trip happens behind it. A failure
 * puts back only what that change touched: the fields it wrote, on its own
 * row, as the database holds them. Restoring a snapshot of the whole list
 * would also undo every other tick made while this one was in flight.
 *
 * Edits made in the item sheet are the exception (`save`): they wait for the
 * database, because they can be refused - the same title twice in one
 * category - and the sheet must stay open to say so.
 *
 * ONE ROW, ONE WRITE AT A TIME. A tick and its Undo a moment later are two
 * writes to the same row; sent together, the network can deliver the Undo
 * first and leave the tick standing in the database while the screen shows
 * it undone. Writes to a row are therefore chained, so they land in the order
 * they were made. Different rows still go in parallel.
 *
 * Loading never sets state before its first await, so a screen can start it
 * from a focus effect without a synchronous render cascade.
 */
import { useCallback, useRef, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';

import * as api from './api';
import type { ItemPatch } from './api';
import { nextStepPosition, stepMoves } from './shelf';
import type { BucketInput, BucketItem, BucketStep } from './types';

const messageOf = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** A step shown before the database has given it an id. */
export const isPendingStep = (step: BucketStep) => step.id.startsWith('pending-');

export function useBucket() {
  const [items, setItems] = useState<BucketItem[]>([]);
  const [steps, setSteps] = useState<BucketStep[]>([]);
  // True from the first render, so the screen shows a spinner rather than a
  // misleading empty list before the first fetch lands.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin, isMounted } = useLatestRun();

  /** The last write queued for each row, so the next one waits for it. */
  const queues = useRef(new Map<string, Promise<unknown>>());

  /**
   * Each row as the database last said it is: loaded, then moved on by every
   * write that landed. A failed write puts back from here, not from the screen,
   * which may still be showing an earlier queued write that has not landed.
   */
  const confirmed = useRef(new Map<string, BucketItem>());

  /**
   * For each row, which write last changed each field on screen. A failure
   * puts back only the fields that are still its own: one that a later write
   * has changed again is that write's to confirm or put back.
   */
  const owners = useRef(new Map<string, Partial<Record<keyof ItemPatch, number>>>());
  const writeCount = useRef(0);

  /** Run a write after every earlier write to the same row has settled. */
  const inOrder = useCallback(<T,>(id: string, write: () => Promise<T>): Promise<T> => {
    const previous = queues.current.get(id) ?? Promise.resolve();
    // After the previous write whether it worked or not: a failed tick must
    // not stop its Undo from being sent.
    const next = previous.then(write, write);
    const settled = next.catch(() => undefined);
    queues.current.set(id, settled);
    void settled.then(() => {
      if (queues.current.get(id) === settled) queues.current.delete(id);
    });
    return next;
  }, []);

  const load = useCallback(async () => {
    const isCurrent = begin();
    try {
      const [rows, stepRows] = await Promise.all([api.listItems(), api.listSteps()]);
      if (!isCurrent()) return;
      confirmed.current = new Map(rows.map((row) => [row.id, row]));
      setItems(rows);
      setSteps(stepRows);
      setError(null);
    } catch (e) {
      if (isCurrent()) setError(messageOf(e, 'Could not load your list'));
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [begin]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    return load();
  }, [load]);

  /** The database took these fields: they are what a later failure puts back. */
  const landed = useCallback((id: string, fields: ItemPatch) => {
    const row = confirmed.current.get(id);
    if (row) confirmed.current.set(id, { ...row, ...fields });
  }, []);

  /**
   * Change some of an item's fields, optimistically.
   *
   * On failure each field goes back to what the database holds, and only if
   * this write is still the last to have changed it. Restoring what the row
   * showed just before this write was wrong when an earlier write to the same
   * row was still queued: a tick and its Undo both failing left the row
   * showing the tick, which the database never had.
   */
  const patch = useCallback(
    async (id: string, fields: ItemPatch): Promise<boolean> => {
      const keys = Object.keys(fields) as (keyof ItemPatch)[];
      const write = ++writeCount.current;
      const owned = owners.current.get(id) ?? {};
      keys.forEach((key) => (owned[key] = write));
      owners.current.set(id, owned);

      setItems((current) => current.map((row) => (row.id === id ? { ...row, ...fields } : row)));

      // Fields no later write has changed since, released from this write.
      const release = () => {
        const mine = keys.filter((key) => owned[key] === write);
        mine.forEach((key) => delete owned[key]);
        return mine;
      };

      try {
        await inOrder(id, () => api.patchItem(id, fields));
        landed(id, fields);
        release();
        return true;
      } catch (e) {
        const mine = release();
        const row = confirmed.current.get(id);
        if (isMounted()) {
          if (row && mine.length > 0) {
            const held = Object.fromEntries(mine.map((key) => [key, row[key]])) as ItemPatch;
            setItems((current) => current.map((r) => (r.id === id ? { ...r, ...held } : r)));
          }
          setError(messageOf(e, 'Could not save that'));
        }
        return false;
      }
    },
    [isMounted, inOrder, landed],
  );

  /** Change fields and wait for the answer. Throws, for the sheet to show. */
  const save = useCallback(
    async (id: string, fields: ItemPatch): Promise<void> => {
      await inOrder(id, () => api.patchItem(id, fields));
      landed(id, fields);
      setItems((current) => current.map((row) => (row.id === id ? { ...row, ...fields } : row)));
    },
    [inOrder, landed],
  );

  /**
   * Swap one item off the Now shelf for another.
   *
   * Two separate changes, demotion first, each rolling back only itself: if
   * the second fails, the first has really happened, and showing it undone
   * would be a lie the next refresh exposes.
   */
  const swapNow = useCallback(
    async (outId: string, inId: string): Promise<boolean> =>
      (await patch(outId, { focus: 'next' })) && patch(inId, { focus: 'now' }),
    [patch],
  );

  const create = useCallback(
    async (input: BucketInput & ItemPatch): Promise<BucketItem> => {
      const created = await api.createItem(input);
      await load();
      return created;
    },
    [load],
  );

  /** Delete an item and, by cascade, its steps. The caller has confirmed. */
  const remove = useCallback(
    async (item: BucketItem): Promise<boolean> => {
      let index = -1;
      let removedSteps: BucketStep[] = [];

      setItems((current) => {
        index = current.findIndex((row) => row.id === item.id);
        return current.filter((row) => row.id !== item.id);
      });
      setSteps((current) => {
        removedSteps = current.filter((step) => step.item_id === item.id);
        return current.filter((step) => step.item_id !== item.id);
      });

      try {
        await api.deleteItem(item.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setItems((current) => {
            if (current.some((row) => row.id === item.id)) return current;
            const restored = [...current];
            restored.splice(index < 0 ? restored.length : index, 0, item);
            return restored;
          });
          // Only the ones not already back: a reload may have landed while the
          // delete was failing, and doubling a step doubles its counts.
          setSteps((current) => [
            ...current,
            ...removedSteps.filter((step) => !current.some((s) => s.id === step.id)),
          ]);
          setError(messageOf(e, 'Could not remove that'));
        }
        return false;
      }
    },
    [isMounted],
  );

  /* STEPS ------------------------------------------------------------------ */

  const addStep = useCallback(
    async (itemId: string, title: string): Promise<boolean> => {
      // From this render's steps: two adds in one frame can share a position,
      // which sorts by creation time and is renumbered by the next move.
      const position = nextStepPosition(steps.filter((step) => step.item_id === itemId));
      const now = new Date().toISOString();
      const pendingId = `pending-${now}-${Math.random().toString(36).slice(2)}`;
      const pending: BucketStep = {
        id: pendingId,
        user_id: '',
        item_id: itemId,
        title,
        is_done: false,
        position,
        created_at: now,
        updated_at: now,
      };

      setSteps((current) => [...current, pending]);
      try {
        const saved = await api.addStep(itemId, title, position);
        if (isMounted()) {
          setSteps((current) => current.map((step) => (step.id === pendingId ? saved : step)));
        }
        return true;
      } catch (e) {
        if (isMounted()) {
          setSteps((current) => current.filter((step) => step.id !== pendingId));
          setError(messageOf(e, 'Could not add that step'));
        }
        return false;
      }
    },
    [steps, isMounted],
  );

  const toggleStep = useCallback(
    async (step: BucketStep): Promise<void> => {
      const next = !step.is_done;
      setSteps((current) => current.map((s) => (s.id === step.id ? { ...s, is_done: next } : s)));
      try {
        await api.updateStep(step.id, { is_done: next });
      } catch (e) {
        if (isMounted()) {
          setSteps((current) =>
            current.map((s) => (s.id === step.id ? { ...s, is_done: step.is_done } : s)),
          );
          setError(messageOf(e, 'Could not save that step'));
        }
      }
    },
    [isMounted],
  );

  const removeStep = useCallback(
    async (step: BucketStep): Promise<boolean> => {
      setSteps((current) => current.filter((s) => s.id !== step.id));
      try {
        await api.deleteStep(step.id);
        return true;
      } catch (e) {
        if (isMounted()) {
          setSteps((current) => (current.some((s) => s.id === step.id) ? current : [...current, step]));
          setError(messageOf(e, 'Could not remove that step'));
        }
        return false;
      }
    },
    [isMounted],
  );

  /** Undo a removal: the same step, same id, same place. */
  const restoreStep = useCallback(
    async (step: BucketStep): Promise<void> => {
      setSteps((current) => (current.some((s) => s.id === step.id) ? current : [...current, step]));
      try {
        await api.restoreStep(step);
      } catch (e) {
        if (isMounted()) {
          setSteps((current) => current.filter((s) => s.id !== step.id));
          setError(messageOf(e, 'Could not put that step back'));
        }
      }
    },
    [isMounted],
  );

  const moveStep = useCallback(
    async (step: BucketStep, direction: -1 | 1): Promise<void> => {
      const siblings = steps.filter((s) => s.item_id === step.item_id);
      // A step without an id yet cannot be renumbered, and moving its
      // neighbours alone would leave screen and database in different orders.
      if (siblings.some(isPendingStep)) return;
      const moves = stepMoves(siblings, step.id, direction);
      if (moves.length === 0) return;

      const before = new Map(siblings.map((s) => [s.id, s.position]));
      const after = new Map(moves.map((m) => [m.id, m.position]));

      setSteps((current) =>
        current.map((s) => (after.has(s.id) ? { ...s, position: after.get(s.id)! } : s)),
      );
      try {
        await api.reorderSteps(moves);
      } catch (e) {
        if (isMounted()) {
          setSteps((current) =>
            current.map((s) => (after.has(s.id) ? { ...s, position: before.get(s.id)! } : s)),
          );
          setError(messageOf(e, 'Could not move that step'));
        }
      }
    },
    [steps, isMounted],
  );

  return {
    items,
    steps,
    loading,
    refreshing,
    error,
    setError,
    load,
    refresh,
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

export type Bucket = ReturnType<typeof useBucket>;
