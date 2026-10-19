/**
 * useNotes - the data hooks for this module.
 *
 * useNotesLibrary holds EVERY live note in one array, for all four tabs at
 * once. Before v3 each tab had its own copy of a hook and its own query; with
 * pins, colours, archive and trash acting across tabs, four copies would
 * disagree for a moment after every action (pin a list on Lists and Notes
 * would not know). One array, read by every tab through the pure viewNotes,
 * cannot disagree with itself.
 *
 * TRASHED ROWS STAY IN THE ARRAY with deleted_at set, and viewNotes hides
 * them. That is what makes Undo exact: putting deleted_at back to null brings
 * the note back in the very place it left, with no refetch and no jump.
 *
 * Every action is optimistic and rolls back ONLY the rows it touched, never a
 * snapshot of the whole list: a failed pin must not also undo the tick that
 * landed while it was in flight.
 *
 * There is no fetch-on-mount effect: each screen reloads on focus, and the
 * first focus is the mount.
 */
import { useCallback, useEffect, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import type { NoteColorKey } from './noteColors';
import { notesChanged, onNotesChanged } from './notesEvents';
import type { Note } from './types';

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export function useNotesLibrary() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [counts, setCounts] = useState({ trash: 0, archive: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { begin } = useLatestRun();

  const load = useCallback(
    async (showSpinner: boolean) => {
      const isCurrent = begin();
      if (showSpinner) setRefreshing(true);
      setError(null);

      try {
        // Housekeeping first, and never fatal: a purge that fails leaves old
        // notes in the Trash a little longer, which loses nothing.
        await api.purgeExpiredTrash().catch(() => undefined);
        const [rows, shelves] = await Promise.all([api.listLive(), api.shelfCounts()]);
        if (isCurrent()) {
          setNotes(rows);
          setCounts(shelves);
        }
      } catch (e) {
        if (isCurrent()) setError(message(e, 'Something went wrong'));
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin],
  );

  const refreshCounts = useCallback(() => {
    api
      .shelfCounts()
      .then(setCounts)
      .catch(() => undefined); // the badge is a hint; a stale one is harmless
  }, []);

  /**
   * Patch some rows on screen, write, and on failure restore exactly those
   * rows as they were. Returns whether the write landed, so the caller only
   * offers Undo for something that happened.
   */
  const patch = useCallback(
    async (ids: string[], change: Partial<Note>, write: () => Promise<void>, failure: string) => {
      const wanted = new Set(ids);
      const before = new Map(notes.filter((n) => wanted.has(n.id)).map((n) => [n.id, n]));
      setNotes((current) => current.map((n) => (wanted.has(n.id) ? { ...n, ...change } : n)));
      setError(null);

      try {
        await write();
        return true;
      } catch (e) {
        setNotes((current) => current.map((n) => before.get(n.id) ?? n));
        setError(message(e, failure));
        return false;
      }
    },
    [notes],
  );

  const trash = useCallback(
    async (ids: string[]) => {
      const at = new Date().toISOString();
      const ok = await patch(ids, { deleted_at: at }, () => api.trashNotes(ids, at), 'Could not move that to the Trash');
      if (ok) refreshCounts();
      return ok;
    },
    [patch, refreshCounts],
  );

  const restore = useCallback(
    async (ids: string[]) => {
      const ok = await patch(ids, { deleted_at: null }, () => api.restoreNotes(ids), 'Could not restore that');
      if (ok) refreshCounts();
      return ok;
    },
    [patch, refreshCounts],
  );

  const archive = useCallback(
    async (ids: string[], archived: boolean) => {
      const at = archived ? new Date().toISOString() : null;
      const ok = await patch(
        ids,
        { archived_at: at },
        () => api.setArchived(ids, at),
        archived ? 'Could not archive that' : 'Could not unarchive that',
      );
      if (ok) refreshCounts();
      return ok;
    },
    [patch, refreshCounts],
  );

  const pin = useCallback(
    (ids: string[], pinned: boolean) => {
      const at = pinned ? new Date().toISOString() : null;
      return patch(ids, { pinned_at: at }, () => api.setPinned(ids, at), 'Could not change the pin');
    },
    [patch],
  );

  const color = useCallback(
    (ids: string[], value: NoteColorKey | null) =>
      patch(ids, { color: value }, () => api.setColor(ids, value), 'Could not change the colour'),
    [patch],
  );

  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  // An undo pressed after leaving a note's screen lands here.
  useEffect(() => onNotesChanged(() => void reload()), [reload]);

  // Stable, and always reaching the latest rows: an Undo runs from a toast
  // seconds later, and an action captured back then would roll back to the
  // list as it was then rather than as it is now.
  return {
    /** Every row loaded, trashed-this-session ones included: read it through viewNotes. */
    notes,
    counts,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    trash: useStableCallback(trash),
    restore: useStableCallback(restore),
    archive: useStableCallback(archive),
    pin: useStableCallback(pin),
    color: useStableCallback(color),
  };
}

export type Shelf = 'trash' | 'archive';

/**
 * The Trash or the Archive: the only two lists that show notes the tabs hide.
 *
 * Restoring, unarchiving and deleting forever take a row OFF this list, so
 * here the optimistic step is a removal, and a failure puts back just that
 * row in its place.
 */
export function useNotesShelf(shelf: Shelf) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { begin } = useLatestRun();

  const load = useCallback(async () => {
    const isCurrent = begin();
    setError(null);
    try {
      if (shelf === 'trash') await api.purgeExpiredTrash().catch(() => undefined);
      const rows = shelf === 'trash' ? await api.listTrash() : await api.listArchive();
      if (isCurrent()) setNotes(rows);
    } catch (e) {
      if (isCurrent()) setError(message(e, 'Something went wrong'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [shelf, begin]);

  const removeWhile = useCallback(
    async (ids: string[], write: () => Promise<void>, failure: string) => {
      const wanted = new Set(ids);
      const removed = notes
        .map((note, index) => ({ note, index }))
        .filter(({ note }) => wanted.has(note.id));
      setNotes((current) => current.filter((n) => !wanted.has(n.id)));
      setError(null);

      try {
        await write();
        return true;
      } catch (e) {
        setNotes((current) => {
          const next = [...current];
          removed.forEach(({ note, index }) => next.splice(Math.min(index, next.length), 0, note));
          return next;
        });
        setError(message(e, failure));
        return false;
      }
    },
    [notes],
  );

  /** Put rows back on this shelf - the Undo of a removal that did land. */
  const putBack = useCallback(
    (rows: Note[], write: () => Promise<void>) => {
      setNotes((current) => {
        const ids = new Set(rows.map((r) => r.id));
        const key = shelf === 'trash' ? 'deleted_at' : 'archived_at';
        return [...current.filter((n) => !ids.has(n.id)), ...rows].sort((a, b) =>
          (b[key] ?? '').localeCompare(a[key] ?? ''),
        );
      });
      // notesChanged: an Undo can be pressed after this screen has gone, and
      // the list it went back to must hear that the note moved again.
      write()
        .then(notesChanged)
        .catch((e) => setError(message(e, 'Could not undo that')));
    },
    [shelf],
  );

  const restore = useCallback(
    (ids: string[]) => removeWhile(ids, () => api.restoreNotes(ids), 'Could not restore that'),
    [removeWhile],
  );

  const deleteForever = useCallback(
    (ids: string[]) => removeWhile(ids, () => api.deleteForever(ids), 'Could not delete that'),
    [removeWhile],
  );

  const unarchive = useCallback(
    (ids: string[]) => removeWhile(ids, () => api.setArchived(ids, null), 'Could not unarchive that'),
    [removeWhile],
  );

  const trash = useCallback(
    (ids: string[]) =>
      removeWhile(ids, () => api.trashNotes(ids, new Date().toISOString()), 'Could not move that to the Trash'),
    [removeWhile],
  );

  const emptyTrash = useCallback(async () => {
    const all = notes;
    setNotes([]);
    setError(null);
    try {
      await api.emptyTrash();
      return true;
    } catch (e) {
      // Nothing was deleted if the call failed, so every row comes back.
      setNotes(all);
      setError(message(e, 'Could not empty the Trash'));
      return false;
    }
  }, [notes]);

  const reload = useStableCallback(() => load());

  useEffect(() => onNotesChanged(() => void reload()), [reload]);

  return {
    notes,
    loading,
    error,
    reload,
    restore: useStableCallback(restore),
    deleteForever: useStableCallback(deleteForever),
    unarchive: useStableCallback(unarchive),
    trash: useStableCallback(trash),
    putBack,
    emptyTrash: useStableCallback(emptyTrash),
  };
}
