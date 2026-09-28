/**
 * api.ts - every database call the B-List makes.
 *
 * Same conventions as every other module: check `error`, throw on failure,
 * stamp the owner id here so no screen deals with identity.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import { todayISO } from '../../core/date';
import type { BucketInput, BucketItem, Cost } from './types';

const TABLE = 'bucket_items';

/**
 * The whole list.
 *
 * All 818 rows in one request, deliberately. They are small, every view of
 * this module needs the totals, and paginating would mean the progress figures
 * were computed from a page rather than from the list - which is the one thing
 * they must never be.
 */
export async function listItems(): Promise<BucketItem[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('category', { ascending: true })
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Tick or untick an item.
 *
 * `done_on` is written here rather than by a trigger, so the date is the day
 * you pressed it on your device rather than whatever UTC day the server was
 * having. Unticking clears it: a date for something not done is a loose end
 * that would later read as fact.
 */
export async function setDone(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_done: isDone, done_on: isDone ? todayISO() : null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function createItem(input: BucketInput): Promise<BucketItem> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) {
    if (error.message.includes('duplicate')) {
      throw new Error('That is already on the list in this category.');
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateItem(id: string, input: Partial<BucketInput>): Promise<void> {
  const { error } = await supabase.from(TABLE).update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Counts for the home tile, in one round trip.
 *
 * Two columns and no titles: the tile needs to know how many are done and how
 * many cheap ones are left, not what any of them say. Fetching the whole list
 * to count it would download 818 rows to render one line.
 */
export async function overview(): Promise<{ total: number; done: number; freeLeft: number }> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('is_done, cost')
    .eq('user_id', ownerId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as { is_done: boolean; cost: Cost }[];
  return {
    total: rows.length,
    done: rows.filter((row) => row.is_done).length,
    freeLeft: rows.filter((row) => !row.is_done && row.cost === 'low').length,
  };
}
