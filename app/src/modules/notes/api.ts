/**
 * api.ts - every database call this module makes.
 *
 * Deliberately near-identical to the Todo module's api.ts. Same imports, same
 * error convention (supabase-js resolves `{ data, error }` instead of
 * throwing, so every call checks and throws), same owner-stamping on insert.
 *
 * The only real differences are the table name, the sort order, and the search
 * function at the bottom.
 */
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import type { Note, NoteInput } from './types';

const TABLE = 'notes';

/**
 * Notes and checklists, newest-edited first.
 *
 * Journals are excluded: they have their own feed, sorted by the day they are
 * about rather than the day they were touched. Including them here would put
 * an entry you backdated to last week at the top of today's list.
 *
 * Recency, not creation order: a note list is about what you were last working
 * on. This is why the set_updated_at trigger matters for this table.
 */
export async function listNotes(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .in('note_type', ['note', 'checklist'])
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The inbox: quick captures with no title and no tags yet.
 *
 * Oldest first, deliberately. The inbox is a queue to work through, and the
 * thing most at risk of being forgotten is the one that has sat there longest.
 */
export async function listInbox(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_inbox', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The journal feed, newest day first.
 *
 * Sorted by entry_date, the day the entry is ABOUT, not by when it was
 * written. created_at breaks ties so two entries for the same day keep a
 * stable order instead of shuffling between refreshes.
 */
export async function listJournal(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('note_type', 'journal')
    .order('entry_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Counts for the home screen tile, in one round trip.
 *
 * Two columns and no bodies: the tile needs to know how many of each kind
 * exist, not what any of them say. Calling listNotes and listInbox separately
 * would be two requests and would download every note body to count them.
 */
export async function notesOverview(): Promise<{ total: number; inbox: number }> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('note_type, is_inbox')
    .eq('user_id', ownerId);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    total: rows.length,
    inbox: rows.filter((row: { is_inbox: boolean }) => row.is_inbox).length,
  };
}

export async function getNote(id: string): Promise<Note> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createNote(input: NoteInput): Promise<Note> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateNote(id: string, input: Partial<NoteInput>): Promise<Note> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Overwrite a checklist's items.
 *
 * The whole array is written, not a patch. jsonb has no partial update that is
 * worth the complexity here, and a checklist is a handful of lines: sending
 * all of them is simpler and cannot leave the list half-applied.
 */
export async function setChecklistItems(
  id: string,
  items: { text: string; done: boolean }[],
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ checklist_items: items })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
