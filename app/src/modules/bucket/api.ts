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
 * Counts for the home tile.
 *
 * COUNTED IN POSTGRES, not here. The previous version selected two columns for
 * all 818 rows and counted them in JavaScript, while its own comment claimed it
 * avoided exactly that - it fetched no titles, but it still pulled 818 rows
 * over mobile data every time the home screen loaded, to render one line.
 *
 * Three head requests instead: `head: true` sends no rows at all, only the
 * count in a header, and they run in parallel so it is still one round trip's
 * worth of waiting.
 */
export async function overview(): Promise<{ total: number; done: number; freeLeft: number }> {
  const ownerId = await getOwnerId();

  const count = async (refine: (q: ReturnType<typeof baseQuery>) => typeof q = (q) => q) => {
    const { count: n, error } = await refine(baseQuery(ownerId));
    if (error) throw new Error(error.message);
    return n ?? 0;
  };

  const [total, done, freeLeft] = await Promise.all([
    count(),
    count((q) => q.eq('is_done', true)),
    count((q) => q.eq('is_done', false).eq('cost', 'low' satisfies Cost)),
  ]);

  return { total, done, freeLeft };
}

/** A count-only query for this owner: no rows come back, just the number. */
function baseQuery(ownerId: string) {
  return supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId);
}
