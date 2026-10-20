/**
 * types.ts - the shapes this module works with.
 *
 * Compare this to the Todo module's types.ts: same two-type structure (the
 * database row, and what the form collects). That symmetry is the point -
 * once you've read one module you can read them all.
 */

/**
 * What kind of thing a note is.
 *
 * One table rather than three, because all three share the same lifecycle,
 * the same tags, and the same search. They differ only in how the edit screen
 * renders and how the list groups them, which is presentation, not storage.
 */
export type NoteType = 'note' | 'checklist' | 'journal';

/** One line of a checklist. No id: items are only ever read and written as a whole list. */
export type ChecklistItem = {
  text: string;
  done: boolean;
};

/** A row exactly as it comes back from the `notes` table. */
export type Note = {
  id: string;
  user_id: string;
  /** May be empty: quick capture saves a body with no title. */
  title: string;
  body: string;
  tags: string[];
  note_type: NoteType;
  /** True while a quick-captured note has neither a title nor tags. */
  is_inbox: boolean;
  /** The day a journal entry is about. Null for every other type. */
  entry_date: string | null;
  /** Null for every type except checklist. */
  checklist_items: ChecklistItem[] | null;
  created_at: string;
  /** Moves on content edits only, never on pin, colour, archive or trash (0021). */
  updated_at: string;
  /** In the Trash since this instant; null while live. Purged after TRASH_DAYS. */
  deleted_at: string | null;
  /** Pinned since this instant; null when not pinned. Does not file a note out of the Inbox. */
  pinned_at: string | null;
  /** Archived since this instant; null when not archived. */
  archived_at: string | null;
  /** A key from NOTE_COLORS, or null. Read it through readNoteColor: old keys may linger. */
  color: string | null;
};

/**
 * What the FORM collects. The database owns id, user_id and the timestamps;
 * the user never types those.
 */
export type NoteInput = {
  title: string;
  body: string;
  tags: string[];
  note_type: NoteType;
  is_inbox: boolean;
  entry_date: string | null;
  checklist_items: ChecklistItem[] | null;
};

/**
 * Tags are typed as a comma-separated string and stored as an array, so these
 * two helpers are the boundary between those representations.
 *
 * Normalising on the way IN (rather than at display time) means the database
 * never accumulates 'Work', 'work' and 'work ' as three distinct tags.
 */
export function parseTags(input: string): string[] {
  const cleaned = input
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  // A Set removes duplicates - typing "work, work" should yield one tag.
  return Array.from(new Set(cleaned));
}

export function formatTags(tags: string[]): string {
  return tags.join(', ');
}

export const NOTE_TYPE_LABEL: Record<NoteType, string> = {
  note: 'Note',
  checklist: 'Checklist',
  journal: 'Journal',
};

/**
 * Does this note still belong in the inbox?
 *
 * The inbox is for things captured in a hurry and not yet filed, so a note
 * leaves it the moment it gains a title or a tag. Expressed as one pure
 * function rather than being computed at each call site, because the create
 * path and the edit path both need it and they must agree: if they disagreed,
 * a note could be filed on save and back in the inbox on the next edit.
 *
 * Journals and checklists are never inbox items. You reach for those
 * deliberately, so they are already filed by the act of choosing them.
 */
export function belongsInInbox(input: {
  title: string;
  tags: string[];
  note_type: NoteType;
}): boolean {
  if (input.note_type !== 'note') return false;
  return input.title.trim().length === 0 && input.tags.length === 0;
}

/**
 * Read checklist items off a row.
 *
 * The column is jsonb, so it arrives as `unknown` and can legitimately be null
 * (any note that is not a checklist) or malformed (a row written before this
 * shape settled). Everything that is not a well-formed item is dropped rather
 * than rendered as a blank row.
 */
export function readChecklistItems(value: unknown): ChecklistItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is ChecklistItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as ChecklistItem).text === 'string' &&
        typeof (item as ChecklistItem).done === 'boolean',
    )
    .map((item) => ({ text: item.text, done: item.done }));
}

/** How many of a checklist are ticked, for the row summary. */
export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length };
}

/** An item with the position it is stored at, which is its identity. */
export type IndexedItem = { item: ChecklistItem; index: number };

/**
 * What is left to do, and what is ticked, for the read view.
 *
 * A VIEW, not a reorder: the stored list keeps its order, and each item keeps
 * its stored index. So unticking an item puts it back where it was, rather
 * than at the bottom of the open items, and a tap on the ticked group still
 * reaches the right line.
 */
export function partitionChecklist(items: ChecklistItem[]): {
  open: IndexedItem[];
  ticked: IndexedItem[];
} {
  const open: IndexedItem[] = [];
  const ticked: IndexedItem[] = [];
  items.forEach((item, index) => (item.done ? ticked : open).push({ item, index }));
  return { open, ticked };
}

/*
 * The edits below never change the list they are given. A read-mode mass
 * action writes immediately and offers Undo, and Undo needs the list exactly
 * as it was to put back.
 */

export function toggleItem(items: ChecklistItem[], index: number): ChecklistItem[] {
  return items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
}

/**
 * Manual reset only. A checklist you reuse weekly should clear when YOU say
 * so, not on a schedule: an automatic reset would wipe the evidence of what
 * you had already done, at a moment you did not choose.
 */
export function uncheckAll(items: ChecklistItem[]): ChecklistItem[] {
  return items.map((item) => ({ ...item, done: false }));
}

/** Clear out what is done, for a list that is used up rather than reused. */
export function deleteTicked(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter((item) => !item.done);
}

/**
 * A change that can be taken back after others have landed on top of it.
 *
 * A read-mode tick saves at once, and on a weak signal its write can fail
 * seconds later - after more ticks, after Undo, after you have started editing
 * the note. Putting back the list as it was before the tick would throw all of
 * that away. So each change knows how to take back only itself: `revert`
 * touches only what `apply` wrote, and only where it still reads as `apply`
 * left it. Anywhere it does not, something later has changed it again, and
 * that later thing wins.
 */
export type Change<T> = {
  apply: (value: T) => T;
  revert: (value: T) => T;
};

/** The same change the other way round: what an Undo of it does. */
export function inverse<T>(change: Change<T>): Change<T> {
  return { apply: change.revert, revert: change.apply };
}

/** One item's tick to set, where that item still has this text and reads `from`. */
type Mark = { index: number; text: string; from: boolean; to: boolean };

function setMarks(items: ChecklistItem[], marks: Mark[]): ChecklistItem[] {
  const byIndex = new Map(marks.map((mark) => [mark.index, mark]));
  let changed = false;
  const next = items.map((item, index) => {
    const mark = byIndex.get(index);
    if (!mark || item.text !== mark.text || item.done !== mark.from) return item;
    changed = true;
    return { ...item, done: mark.to };
  });
  return changed ? next : items;
}

function markChange(marks: Mark[]): Change<ChecklistItem[]> {
  const back = marks.map((mark) => ({ ...mark, from: mark.to, to: mark.from }));
  return { apply: (items) => setMarks(items, marks), revert: (items) => setMarks(items, back) };
}

/** Tick or untick one item, by its stored index. Null when there is no such item. */
export function tickChange(items: ChecklistItem[], index: number): Change<ChecklistItem[]> | null {
  const item = items[index];
  if (!item) return null;
  return markChange([{ index, text: item.text, from: item.done, to: !item.done }]);
}

/** Uncheck all: its revert re-ticks exactly the items it unticked. */
export function uncheckAllChange(items: ChecklistItem[]): Change<ChecklistItem[]> {
  return markChange(
    items.flatMap((item, index) =>
      item.done ? [{ index, text: item.text, from: true, to: false }] : [],
    ),
  );
}

/** Delete ticked: its revert puts each deleted item back at its place. */
export function deleteTickedChange(items: ChecklistItem[]): Change<ChecklistItem[]> {
  const removed = items.flatMap((item, index) => (item.done ? [{ index, item }] : []));
  return {
    apply: (list) => {
      const next = [...list];
      // Last first, so each index still points where it did.
      [...removed].reverse().forEach(({ index, item }) => {
        const there = next[index];
        if (there && there.text === item.text && there.done === item.done) next.splice(index, 1);
      });
      return next;
    },
    revert: (list) => {
      const next = [...list];
      removed.forEach(({ index, item }) => next.splice(Math.min(index, next.length), 0, item));
      return next;
    },
  };
}

/**
 * The list with what is typed in "Add an item" added to the end, if anything.
 *
 * Add and the keyboard's done both do this; so does Save, because a line typed
 * and then saved without pressing Add was meant as an item, not thrown away.
 */
export function withDraftItem(items: ChecklistItem[], draft: string): ChecklistItem[] {
  const text = draft.trim();
  return text ? [...items, { text, done: false }] : items;
}
