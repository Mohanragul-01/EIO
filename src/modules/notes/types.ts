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
  updated_at: string;
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
