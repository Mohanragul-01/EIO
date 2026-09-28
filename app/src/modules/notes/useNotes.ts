/**
 * useNotes - the data-fetching hook for this module.
 *
 * Structurally the same as useTodos: state, a stable `load` callback, an
 * unmount guard, and separate refresh/reload flavours.
 *
 * What's DIFFERENT is what belongs in a hook vs a screen. Notes get client-
 * side search and tag filtering, and those live here rather than in the screen
 * because they're derived data - the screen should just render what it's
 * given.
 *
 * Why filter on the client at all: this is a personal notes list, realistically
 * hundreds of rows, already fully in memory. A network round trip per keystroke
 * would be slower and would break while offline. If this ever grew to
 * thousands of notes, the fix is a Postgres full-text index and a query in
 * api.ts - and again, only this file would change.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useLatestRun } from '../../core/useLatestRun';
import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import { readChecklistItems, type Note } from './types';

/** Which view the list is showing. */
export type NotesView = 'notes' | 'inbox' | 'checklist' | 'journal';

const LOADERS: Record<NotesView, () => Promise<Note[]>> = {
  notes: api.listNotes,
  inbox: api.listInbox,
  checklist: api.listChecklists,
  journal: api.listJournal,
};

/**
 * Search and tag filter can be OWNED BY THE CALLER.
 *
 * Each swipeable page has its own copy of this hook, so filter state kept in
 * here would be per-page: type a search, swipe, and it would be gone - and the
 * one search box in the header would only drive whichever page happened to be
 * showing. Passing them in lets the screen hold one copy for all four.
 *
 * Left optional so callers that render a single list still get the old
 * self-contained behaviour.
 */
type Filters = { query?: string; activeTag?: string | null };

export function useNotes(view: NotesView = 'notes', filters?: Filters) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state, used only when the caller does not supply its own.
  const [ownQuery, setOwnQuery] = useState('');
  const [ownTag, setOwnTag] = useState<string | null>(null);

  const query = filters?.query ?? ownQuery;
  const activeTag = filters !== undefined ? (filters.activeTag ?? null) : ownTag;

  const { begin } = useLatestRun();

  const load = useCallback(
    async (showSpinner = false) => {
      const isCurrent = begin();
      if (showSpinner) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const rows = await LOADERS[view]();
        if (isCurrent()) setNotes(rows);
      } catch (e) {
        if (isCurrent()) setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
      // Depends on the view, so switching tabs rebuilds the loader and refetches.
    },
    [view, begin],
  );

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  /** Every tag in use, deduped and alphabetical - drives the filter row. */
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((note) => note.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [notes]);

  /**
   * The filtered list the screen actually renders.
   *
   * useMemo matters here: this runs on every keystroke, and without it we'd
   * re-filter the whole array on every unrelated re-render too.
   */
  const visibleNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return notes.filter((note) => {
      if (activeTag && !note.tags.includes(activeTag)) return false;
      if (!needle) return true;

      // Title, body, tags, and checklist lines. A checklist keeps its content
      // in checklist_items rather than body, so searching body alone would make
      // every checklist unfindable by what is actually written in it.
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.includes(needle)) ||
        readChecklistItems(note.checklist_items).some((item) =>
          item.text.toLowerCase().includes(needle),
        )
      );
    });
  }, [notes, query, activeTag]);

  /** Optimistic delete: remove locally, restore the list if the server says no. */
  const remove = useCallback(
    async (note: Note) => {
      const snapshot = notes;
      setNotes((current) => current.filter((n) => n.id !== note.id));

      try {
        await api.deleteNote(note.id);
      } catch (e) {
        setNotes(snapshot);
        setError(e instanceof Error ? e.message : 'Could not delete the note');
      }
    },
    [notes],
  );


  /**
   * Stable identities that always reach the CURRENT load closure. The focus
   * effect in each screen holds one of these forever, so it must not close over
   * a stale copy. See core/useStableCallback for the bug this prevents.
   */
  const refresh = useStableCallback(() => load(true));
  const reload = useStableCallback(() => load(false));

  return {
    notes: visibleNotes,
    /** Unfiltered count, so the screen can tell "no notes" from "no matches". */
    totalCount: notes.length,
    allTags,
    query,
    setQuery: setOwnQuery,
    activeTag,
    setActiveTag: setOwnTag,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    remove,
  };
}
