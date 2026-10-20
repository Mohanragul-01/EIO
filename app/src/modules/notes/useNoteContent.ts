/**
 * useNoteContent - the body and checklist of the note open in NoteEditScreen,
 * and the read-mode writes that save a tick the moment it is made.
 *
 * Read mode and edit mode share this text: a tick in read mode and the words
 * typed after pressing Edit are the same body. That is what made a failed
 * tick dangerous. It used to put back the whole body as it was before the
 * tick, and on a weak signal the failure could arrive after you had pressed
 * Edit and written two paragraphs - which went with it.
 *
 * So every immediate change here is a Change (types.ts), which takes back
 * only itself, and the screen and the database are each kept as their own
 * copy:
 *
 *   shown   what the screen shows, read and written synchronously, so a
 *           change builds on the latest text even before React re-renders;
 *   kept    what the note holds once every queued write lands - the screen
 *           minus unsaved edits, which is what "is anything unsaved" asks;
 *   target  what the database is being brought to, one write at a time;
 *   saved   what the database holds, as far as any answer has said.
 *
 * ONE WRITE PER NOTE AT A TIME. Each tick writes the whole list (or body). Two
 * quick ticks sent together could land the wrong way round and leave only the
 * first in the database; and a first tick that failed used to roll the screen
 * back past the second. Writes to a note are therefore queued, and each is
 * built when its turn comes: this change applied to what the writes before it
 * left, so order cannot matter, and a failure takes back only its own change
 * while the queue carries on. The queue belongs to the note, not the screen,
 * so a note reopened while its writes are in flight is read after they land
 * (see writesSettled), and its own ticks queue behind them.
 *
 * A write that settles after the screen has gone tells the list to look again
 * (notesChanged), since the list may have read the note before it landed.
 */
import { useCallback, useRef, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';

import * as api from './api';
import { notesChanged } from './notesEvents';
import { inverse, type Change, type ChecklistItem } from './types';

export type NoteContent = { body: string; items: ChecklistItem[] };

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const sameItems = (a: ChecklistItem[], b: ChecklistItem[]) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** The last write queued for each note, so the next one waits for it. */
const queues = new Map<string, Promise<unknown>>();

/** Run after every write already queued for this note has settled. */
function afterWrites<T>(id: string, run: () => Promise<T>): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  // Whether the previous one worked or not: a failed tick must not stop the
  // next tick, or its Undo, from being sent.
  const next = previous.then(run, run);
  const settled = next.catch(() => undefined);
  queues.set(id, settled);
  void settled.then(() => {
    if (queues.get(id) === settled) queues.delete(id);
  });
  return next;
}

/**
 * Resolves once the writes queued for this note have settled, or after `ms`,
 * whichever is first: a note opened again just after leaving it is read after
 * its ticks land, but a write that hangs on a dead connection cannot keep the
 * note from opening at all.
 */
export function writesSettled(id: string, ms: number): Promise<void> {
  const pending = queues.get(id);
  if (!pending) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void pending.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

const onItems = (change: Change<ChecklistItem[]>): Change<NoteContent> => ({
  apply: (content) => ({ ...content, items: change.apply(content.items) }),
  revert: (content) => ({ ...content, items: change.revert(content.items) }),
});

const onBody = (change: Change<string>): Change<NoteContent> => ({
  apply: (content) => ({ ...content, body: change.apply(content.body) }),
  revert: (content) => ({ ...content, body: change.revert(content.body) }),
});

/**
 * @param id      the note, or undefined for a new one (nothing is written).
 * @param initial what a new note starts with.
 * @param report  where a failed write is said, and cleared (null).
 */
export function useNoteContent(
  id: string | undefined,
  initial: NoteContent,
  report: (error: string | null) => void,
) {
  const [body, setBodyState] = useState(initial.body);
  const [items, setItemsState] = useState(initial.items);

  const shown = useRef(initial);
  const kept = useRef(initial);
  const target = useRef(initial);
  const saved = useRef(initial);

  const { isMounted } = useLatestRun();

  const show = useCallback((next: NoteContent) => {
    shown.current = next;
    setBodyState(next.body);
    setItemsState(next.items);
  }, []);

  /** Typing in edit mode: on screen only, until Save. */
  const setBody = useCallback((text: string) => show({ ...shown.current, body: text }), [show]);
  const setItems = useCallback(
    (list: ChecklistItem[]) => show({ ...shown.current, items: list }),
    [show],
  );

  /** The note as loaded, which is what the database holds. */
  const loaded = useCallback(
    (content: NoteContent) => {
      kept.current = content;
      target.current = content;
      saved.current = content;
      show(content);
    },
    [show],
  );

  /** Bring the database to `target`, writing only what differs. */
  const flush = useCallback(async (noteId: string) => {
    const want = target.current;
    if (!sameItems(want.items, saved.current.items)) {
      await api.setChecklistItems(noteId, want.items);
      saved.current = { ...saved.current, items: want.items };
    }
    if (want.body !== saved.current.body) {
      await api.setBody(noteId, want.body);
      saved.current = { ...saved.current, body: want.body };
    }
  }, []);

  /**
   * Show a change at once and queue its write. Resolves whether it landed; a
   * failure takes back this change alone, on screen and in what later writes
   * will send.
   */
  const run = useCallback(
    (change: Change<NoteContent>, failure: string): Promise<boolean> => {
      if (!id) return Promise.resolve(false);
      report(null);
      kept.current = change.apply(kept.current);
      show(change.apply(shown.current));

      return afterWrites(id, () => {
        target.current = change.apply(target.current);
        return flush(id);
      })
        .then(
          () => true,
          (e: unknown) => {
            target.current = change.revert(target.current);
            kept.current = change.revert(kept.current);
            if (isMounted()) {
              show(change.revert(shown.current));
              report(message(e, failure));
            }
            return false;
          },
        )
        .finally(() => {
          if (!isMounted()) notesChanged();
        });
    },
    [id, report, show, flush, isMounted],
  );

  /**
   * Change the checklist, built from what the screen shows now. Resolves to
   * the change once it has landed (for an Undo to take back), or null.
   */
  const changeItems = useCallback(
    async (
      build: (list: ChecklistItem[]) => Change<ChecklistItem[]> | null,
      failure: string,
    ): Promise<Change<ChecklistItem[]> | null> => {
      const change = build(shown.current.items);
      if (!change) return null;
      return (await run(onItems(change), failure)) ? change : null;
    },
    [run],
  );

  /** Change the body - a tick on a `- [ ]` box - built from what the screen shows now. */
  const changeBody = useCallback(
    async (build: (text: string) => Change<string> | null, failure: string) => {
      const change = build(shown.current.body);
      return change ? run(onBody(change), failure) : false;
    },
    [run],
  );

  /**
   * Undo a checklist change that landed. It may run in edit mode, where it is
   * merged into what you are editing rather than replacing it, or after the
   * screen has gone, where it builds on what Save stored.
   */
  const undoItems = useCallback(
    (change: Change<ChecklistItem[]>) => void run(onItems(inverse(change)), 'Could not undo that'),
    [run],
  );

  /**
   * Save from edit mode: after every queued tick, so none can land on top of
   * it, and then the base any later Undo builds on.
   */
  const commit = useCallback(
    async (content: NoteContent, write: () => Promise<unknown>) => {
      if (!id) {
        await write();
        return;
      }
      await afterWrites(id, async () => {
        await write();
        saved.current = content;
        target.current = content;
        kept.current = content;
      });
    },
    [id],
  );

  /** Whether the screen holds edits that only Save would keep. */
  const isEdited = useCallback(
    () =>
      shown.current.body !== kept.current.body ||
      !sameItems(shown.current.items, kept.current.items),
    [],
  );

  return {
    body,
    items,
    setBody,
    setItems,
    loaded,
    changeItems,
    changeBody,
    undoItems,
    commit,
    isEdited,
  };
}
