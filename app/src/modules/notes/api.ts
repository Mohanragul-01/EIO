/**
 * api.ts - every database call this module makes.
 *
 * Deliberately near-identical to the Todo module's api.ts. Same imports, same
 * error convention (supabase-js resolves `{ data, error }` instead of
 * throwing, so every call checks and throws), same owner-stamping on insert.
 *
 * THE TRASH. Since v3 a delete is a move to the Trash (deleted_at), and the
 * one rule every read here follows is that a trashed note comes back only
 * from listTrash. The archive is the same, one step milder: an archived note
 * comes back only from listArchive. Everything else - the tabs, the home
 * tile's counts, today's journal entry - asks for live notes, and the pure
 * filters in library.ts check again on the way to the screen.
 */
import { collectPages } from '../../core/paging';
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import { purgeCutoff } from './library';
import type { NoteColorKey } from './noteColors';
import type { ChecklistItem, Note, NoteInput } from './types';

const TABLE = 'notes';

/**
 * Every live note - not trashed, not archived - of every type.
 *
 * One query for all four tabs, rather than one per tab as before v3. The tab
 * pager mounts every tab at once, so the old four queries fetched most rows
 * twice (every checklist and every inbox note is also on Notes); and pin,
 * colour and trash now act across tabs, so one array is what keeps a change
 * and its undo right in all of them at once. Which tab shows what is decided
 * by viewNotes in library.ts, where it is tested.
 */
export async function listLive(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  return collectPages<Note>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .is('deleted_at', null)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count };
  });
}

/** The Trash, most recently deleted first. */
export async function listTrash(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  return collectPages<Note>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count };
  });
}

/** The Archive, most recently archived first. A trashed note is in the Trash, not here. */
export async function listArchive(): Promise<Note[]> {
  const ownerId = await getOwnerId();

  return collectPages<Note>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .not('archived_at', 'is', null)
      .is('deleted_at', null)
      .order('archived_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count };
  });
}

/** How many notes sit in the Trash and the Archive, for the buttons that open them. */
export async function shelfCounts(): Promise<{ trash: number; archive: number }> {
  const ownerId = await getOwnerId();

  const [trash, archive] = await Promise.all([
    supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .not('deleted_at', 'is', null),
    supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .not('archived_at', 'is', null)
      .is('deleted_at', null),
  ]);

  if (trash.error) throw new Error(trash.error.message);
  if (archive.error) throw new Error(archive.error.message);
  return { trash: trash.count ?? 0, archive: archive.count ?? 0 };
}

/**
 * Counts for the home screen tile, counted in Postgres.
 *
 * Head requests, as for the shelf counts: the tile needs to know how many
 * live notes exist and how many wait to be filed, not what any of them say,
 * so no rows come back at all. Counting fetched rows here instead stopped at
 * the server's 1000-row cap, and the tile would have read "1000 notes" for
 * ever after. A trashed or archived note is in neither number.
 */
export async function notesOverview(): Promise<{ total: number; inbox: number }> {
  const ownerId = await getOwnerId();

  const live = () =>
    supabase
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId)
      .is('deleted_at', null)
      .is('archived_at', null);

  const [total, inbox] = await Promise.all([live(), live().eq('is_inbox', true)]);

  if (total.error) throw new Error(total.error.message);
  if (inbox.error) throw new Error(inbox.error.message);
  return { total: total.count ?? 0, inbox: inbox.count ?? 0 };
}

/**
 * Today's journal entry, if one exists - the most recently written when there
 * are several. The create button opens it instead of starting a duplicate.
 */
export async function findJournalEntry(date: string): Promise<Note | null> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .eq('note_type', 'journal')
    .eq('entry_date', date)
    .is('deleted_at', null)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

/**
 * One note by id, whatever its state. The edit screen shows a trashed note
 * read-only with Restore rather than failing, in case it is reached from a
 * screen that has not caught up.
 */
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
export async function setChecklistItems(id: string, items: ChecklistItem[]): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ checklist_items: items }).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Overwrite a note's body - used by a tick on a `- [ ]` box in read mode,
 * which saves at once just as a checklist tick does.
 */
export async function setBody(id: string, body: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ body }).eq('id', id);
  if (error) throw new Error(error.message);
}

/* LIFECYCLE ----------------------------------------------------------------
 * Each takes several ids because selection mode acts on several notes at
 * once, and each takes the instant from the caller so the optimistic copy on
 * screen and the row in the database carry the same value.
 */

export async function trashNotes(ids: string[], at: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: at }).in('id', ids);
  if (error) throw new Error(error.message);
}

export async function restoreNotes(ids: string[]): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ deleted_at: null }).in('id', ids);
  if (error) throw new Error(error.message);
}

/**
 * The only hard delete. It names the Trash in its own query, so whatever a
 * caller passes, a live note can never be deleted for good by mistake: it has
 * to have been moved to the Trash first.
 */
export async function deleteForever(ids: string[]): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .in('id', ids)
    .not('deleted_at', 'is', null);
  if (error) throw new Error(error.message);
}

/** Delete everything in the Trash. Returns how many notes went. */
export async function emptyTrash(): Promise<number> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', ownerId)
    .not('deleted_at', 'is', null)
    .select('id');

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/**
 * Delete what has sat in the Trash for more than 30 days.
 *
 * Run when Notes or the Trash opens, rather than on a server schedule: it
 * needs nothing enabled on the database, and a note that outlives its 30 days
 * because Notes was not opened has lost nothing.
 */
export async function purgeExpiredTrash(now: Date = new Date()): Promise<void> {
  const ownerId = await getOwnerId();

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', ownerId)
    .lt('deleted_at', purgeCutoff(now));

  if (error) throw new Error(error.message);
}

/** Pin or unpin. Pinning leaves is_inbox alone: a pinned capture is still unfiled. */
export async function setPinned(ids: string[], pinnedAt: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ pinned_at: pinnedAt }).in('id', ids);
  if (error) throw new Error(error.message);
}

export async function setArchived(ids: string[], archivedAt: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ archived_at: archivedAt }).in('id', ids);
  if (error) throw new Error(error.message);
}

export async function setColor(ids: string[], color: NoteColorKey | null): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ color }).in('id', ids);
  if (error) throw new Error(error.message);
}
