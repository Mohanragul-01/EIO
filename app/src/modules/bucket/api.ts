/**
 * api.ts - every database call the B-List makes.
 *
 * Same conventions as every other module: check `error`, throw on failure,
 * stamp the owner id here so no screen deals with identity.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import type { BucketInput, BucketItem, BucketStep, Cost } from './types';

const TABLE = 'bucket_items';
const STEPS = 'bucket_steps';

/**
 * Every column a v3 screen writes after creation, any subset of them.
 *
 * One patch type rather than a function per feature (setFocus, snooze,
 * saveMemory...), because each of those would be the same three lines, and
 * the hook's per-field rollback works on exactly this shape.
 */
export type ItemPatch = Partial<
  Pick<
    BucketItem,
    | 'title'
    | 'category'
    | 'cost'
    | 'note'
    | 'is_done'
    | 'done_on'
    | 'done_precision'
    | 'memory'
    | 'place'
    | 'again'
    | 'snoozed_until'
    | 'focus'
    | 'target_on'
    | 'target_precision'
    | 'est_cost_minor'
    | 'saved_minor'
  >
>;

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
 * Change any of an item's fields.
 *
 * A tick goes through here too, as a whole DoneState (done, the day, and how
 * precisely the day is known) built by the caller from its own device's
 * today - not by a trigger, so the date is the day you pressed it rather than
 * whatever UTC day the server was having - and so Undo can put a backdated
 * date back exactly.
 */
export async function patchItem(id: string, patch: ItemPatch): Promise<void> {
  const { error } = await supabase.from(TABLE).update(patch).eq('id', id);
  if (error) {
    // Renaming onto an existing title in the same category, said plainly.
    if (error.message.includes('duplicate')) {
      throw new Error('That is already on the list in this category.');
    }
    throw new Error(error.message);
  }
}

/**
 * Swap one item off the Now shelf for another.
 *
 * Two writes and no transaction, so the order matters: the one leaving goes
 * to Next FIRST. Interrupted between the two, the shelf holds four, which you
 * can see and fix; the other order would leave six, past the cap.
 */
export async function swapNow(outId: string, inId: string): Promise<void> {
  await patchItem(outId, { focus: 'next' });
  await patchItem(inId, { focus: 'now' });
}

export async function createItem(input: BucketInput & ItemPatch): Promise<BucketItem> {
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

/** Deletes the item and, by cascade, its steps. Screens say so first. */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* STEPS -------------------------------------------------------------------- */

/**
 * Every step the owner has, in one request.
 *
 * Only planned items have steps, so this is a handful of rows, and the Now
 * cards need them all at once to show each one's next step and its bar.
 */
export async function listSteps(): Promise<BucketStep[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(STEPS)
    .select('*')
    .eq('user_id', ownerId)
    .order('item_id', { ascending: true })
    .order('position', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addStep(itemId: string, title: string, position: number): Promise<BucketStep> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(STEPS)
    .insert({ item_id: itemId, title, position, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateStep(
  id: string,
  patch: Partial<Pick<BucketStep, 'title' | 'is_done' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from(STEPS).update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase.from(STEPS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Put a removed step back - same id, same place - for Undo.
 *
 * The id is kept so that anything still holding the step (the open sheet)
 * refers to the row that comes back rather than a stranger with its title.
 */
export async function restoreStep(step: BucketStep): Promise<void> {
  const { error } = await supabase.from(STEPS).insert({
    id: step.id,
    item_id: step.item_id,
    user_id: step.user_id,
    title: step.title,
    is_done: step.is_done,
    position: step.position,
  });
  if (error) throw new Error(error.message);
}

/**
 * Write new positions for steps that moved.
 *
 * Only the rows whose position changed - usually two. Each write is
 * independent, so an interruption can leave two steps sharing a position,
 * which sorts by creation time and is fixed by the next move: an odd order,
 * never a lost step.
 */
export async function reorderSteps(moves: { id: string; position: number }[]): Promise<void> {
  await Promise.all(moves.map(({ id, position }) => updateStep(id, { position })));
}

/**
 * Counts for the home tile.
 *
 * COUNTED IN POSTGRES, not here. The previous version selected two columns for
 * all 818 rows and counted them in JavaScript, while its own comment claimed it
 * avoided exactly that - it fetched no titles, but it still pulled 818 rows
 * over mobile data every time the home screen loaded, to render one line.
 *
 * Head requests instead: `head: true` sends no rows at all, only the count
 * in a header, and they run in parallel so it is still one round trip's worth
 * of waiting.
 */
export async function overview(): Promise<{
  total: number;
  done: number;
  freeLeft: number;
  nowCount: number;
}> {
  const ownerId = await getOwnerId();

  const count = async (refine: (q: ReturnType<typeof baseQuery>) => typeof q = (q) => q) => {
    const { count: n, error } = await refine(baseQuery(ownerId));
    if (error) throw new Error(error.message);
    return n ?? 0;
  };

  const [total, done, freeLeft, nowCount] = await Promise.all([
    count(),
    count((q) => q.eq('is_done', true)),
    count((q) => q.eq('is_done', false).eq('cost', 'low' satisfies Cost)),
    // What is on the Now shelf - done ones have left it.
    count((q) => q.eq('is_done', false).eq('focus', 'now')),
  ]);

  return { total, done, freeLeft, nowCount };
}

/** A count-only query for this owner: no rows come back, just the number. */
function baseQuery(ownerId: string) {
  return supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerId);
}
