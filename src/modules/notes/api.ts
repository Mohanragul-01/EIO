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
 * Newest-edited first. Notes differ from tasks here: a task list is about
 * what's URGENT (due date), a note list is about what's RECENT. Sorting by
 * updated_at is why the set_updated_at trigger matters for this table.
 */
export async function listNotes(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
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

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
