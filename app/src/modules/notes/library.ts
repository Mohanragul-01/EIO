/**
 * library.ts - which notes a reader may see, and in what order.
 *
 * v3 gave notes three states besides "live": in the Trash, archived, and
 * pinned (which is not a state so much as a place at the top). Two of those
 * hide a note, and the rule that matters is that a trashed note is hidden from
 * EVERY read - each tab, the tag chips, search, the home tile. Before v3 a
 * delete was a hard delete, so nothing had to filter; now every list goes
 * through these functions rather than each screen remembering to.
 *
 * The queries in api.ts exclude the Trash and the Archive too. These checks
 * repeat that on purpose: a row that slipped through (an optimistic update, a
 * stale cache, a future query that forgot) still never reaches the screen.
 *
 * Pure and React-free, so both clients run it.
 */
import { readNoteColor, type NoteColorKey } from './noteColors';
import { readChecklistItems, type Note } from './types';

/** Which tab a list is showing. */
export type NotesView = 'notes' | 'inbox' | 'checklist' | 'journal';

/** How long a note stays in the Trash before it is deleted for good. */
export const TRASH_DAYS = 30;

const DAY_MS = 86_400_000;

type Lifecycle = Pick<Note, 'deleted_at' | 'archived_at'>;

export function isTrashed(note: Lifecycle): boolean {
  return note.deleted_at !== null;
}

/**
 * Archived and NOT trashed. Trashing an archived note keeps its archived_at,
 * so Restore takes it back to the Archive - but while it sits in the Trash it
 * is deleted, and shows only there.
 */
export function isArchived(note: Lifecycle): boolean {
  return note.archived_at !== null && note.deleted_at === null;
}

/** In the tabs, the search and the counts: neither trashed nor archived. */
export function isLive(note: Lifecycle): boolean {
  return note.deleted_at === null && note.archived_at === null;
}

/**
 * The notes one tab shows, in that tab's order.
 *
 *   notes     notes and checklists, newest-edited first: a list is about what
 *             you were last working on. Journals have their own tab, sorted by
 *             the day they are about, and would otherwise jump to the top when
 *             backdated.
 *   inbox     unfiled captures, OLDEST first: it is a queue to work through,
 *             and the capture most at risk is the one that has waited longest.
 *   checklist checklists only.
 *   journal   by the day an entry is about, newest first; created_at breaks
 *             ties so two entries for one day keep a stable order.
 */
export function viewNotes(notes: readonly Note[], view: NotesView): Note[] {
  const live = notes.filter(isLive);

  switch (view) {
    case 'notes':
      return live
        .filter((n) => n.note_type === 'note' || n.note_type === 'checklist')
        .sort(byUpdatedDesc);
    case 'inbox':
      return live
        .filter((n) => n.is_inbox)
        .sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'checklist':
      return live.filter((n) => n.note_type === 'checklist').sort(byUpdatedDesc);
    case 'journal':
      return live
        .filter((n) => n.note_type === 'journal')
        .sort(
          (a, b) =>
            (b.entry_date ?? '').localeCompare(a.entry_date ?? '') ||
            b.created_at.localeCompare(a.created_at),
        );
  }
}

function byUpdatedDesc(a: Note, b: Note): number {
  return b.updated_at.localeCompare(a.updated_at);
}

/**
 * Pinned notes out of a tab's list, most recently pinned first; everything
 * else keeps the tab's own order.
 *
 * Ordering by pin time keeps the pinned group stable without a reorder control:
 * the shopping list you pinned months ago does not drift as you edit others.
 */
export function splitPinned(notes: readonly Note[]): { pinned: Note[]; others: Note[] } {
  const pinned = notes
    .filter((n) => n.pinned_at !== null)
    .sort((a, b) => (b.pinned_at ?? '').localeCompare(a.pinned_at ?? ''));
  const others = notes.filter((n) => n.pinned_at === null);
  return { pinned, others };
}

export type NoteFilter = {
  query?: string;
  tag?: string | null;
  color?: NoteColorKey | null;
};

/**
 * Search, tag and colour, over live notes only.
 *
 * Searches the checklist items as well as the body: a checklist keeps its
 * content in checklist_items, so searching body alone would make every
 * checklist unfindable by what is actually written in it. Markdown is searched
 * as typed, which is what you remember typing.
 */
export function filterNotes(notes: readonly Note[], filter: NoteFilter): Note[] {
  return notes.filter((note) => isLive(note) && matchesFilter(note, filter));
}

/**
 * The search itself, whatever state the note is in - for the Trash and the
 * Archive, which search their own notes. Everything else goes through
 * filterNotes, which adds the live check.
 */
export function matchesFilter(note: Note, filter: NoteFilter): boolean {
  const needle = (filter.query ?? '').trim().toLowerCase();
  const tag = filter.tag ?? null;
  const color = filter.color ?? null;

  if (tag && !note.tags.includes(tag)) return false;
  if (color && readNoteColor(note.color)?.key !== color) return false;
  if (!needle) return true;

  return (
    note.title.toLowerCase().includes(needle) ||
    note.body.toLowerCase().includes(needle) ||
    note.tags.some((t) => t.includes(needle)) ||
    readChecklistItems(note.checklist_items).some((item) => item.text.toLowerCase().includes(needle))
  );
}

/**
 * Every tag in use on a live note, most used first, then alphabetical.
 *
 * Derived rather than stored: tags are free text on the note, so the only
 * honest list is the one the notes themselves produce - and a tag whose last
 * note went to the Trash disappears from the filter with it.
 */
export function tagCounts(notes: readonly Note[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  notes.filter(isLive).forEach((note) =>
    note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)),
  );
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}

/** The home tile's two numbers: live notes of every kind, and how many wait to be filed. */
export function overviewCounts(
  rows: readonly (Lifecycle & Pick<Note, 'is_inbox'>)[],
): { total: number; inbox: number } {
  const live = rows.filter(isLive);
  return { total: live.length, inbox: live.filter((row) => row.is_inbox).length };
}

/**
 * The instant before which a trashed note is purged.
 *
 * Elapsed time, not calendar days: deleted_at is an instant, and "30 days in
 * the Trash" is a duration. A daylight-saving change inside the window moves
 * the wall clock, not how long the note has waited.
 */
export function purgeCutoff(now: Date): string {
  return new Date(now.getTime() - TRASH_DAYS * DAY_MS).toISOString();
}

/** Whole days left before a trashed note is purged, rounded up; 0 once it is due. */
export function daysUntilPurge(deletedAt: string, now: Date): number {
  const purgeAt = new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / DAY_MS));
}

/** "Deletes in 12 days" - the Trash card's timestamp slot. */
export function purgeLabel(deletedAt: string, now: Date): string {
  const days = daysUntilPurge(deletedAt, now);
  if (days <= 1) return 'Deletes within a day';
  return `Deletes in ${days} days`;
}
