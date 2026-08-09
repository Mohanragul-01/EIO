/**
 * types.ts - the shapes this module works with.
 *
 * Compare this to the Todo module's types.ts: same two-type structure (the
 * database row, and what the form collects). That symmetry is the point -
 * once you've read one module you can read them all.
 */

/** A row exactly as it comes back from the `notes` table. */
export type Note = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tags: string[];
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
