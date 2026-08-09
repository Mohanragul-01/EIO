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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useStableCallback } from '../../core/useStableCallback';

import * as api from './api';
import type { Note } from './types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state.
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    setError(null);

    try {
      const rows = await api.listNotes();
      if (mounted.current) setNotes(rows);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
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

      // Search title, body and tags - people remember notes by any of the three.
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.includes(needle))
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
    setQuery,
    activeTag,
    setActiveTag,
    loading,
    refreshing,
    error,
    refresh,
    reload,
    remove,
  };
}
