/**
 * api.ts - every database call the product tracker makes.
 */
import { todayISO } from '../../core/date';
import { registerResync } from '../../core/notifications';
import { collectPages } from '../../core/paging';
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import { orderedSpare } from './containers';
import { replaceReminders } from './notifications';
import { buildOutlooks, reorderSummary } from './outlook';
import type { Product, ProductInput, ProductUse } from './types';

const PRODUCTS = 'products';
const USES = 'product_uses';

/** Postgres' unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * The one unique rule left is "one open container per name" (0024), so a
 * duplicate here always means opening a second one of something already open.
 * The message says what to do instead, because both ways out exist.
 */
function explain(error: { code?: string; message: string }, name?: string): Error {
  if (error.code === UNIQUE_VIOLATION || error.message.includes('duplicate')) {
    return new Error(
      `${name ? `You already have an open ${name}` : 'One of these is already open'}. ` +
        'Finish it first, or add this one as a spare (not opened yet).',
    );
  }
  return new Error(error.message);
}

/**
 * Everything you are tracking, open ones first.
 *
 * Finished products are kept and returned last rather than filtered out: how
 * long the last tub actually lasted is the best prediction available for the
 * next one, and that history is the whole point of keeping them.
 */
export async function listProducts(): Promise<Product[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(PRODUCTS)
    .select('*')
    .eq('user_id', ownerId)
    .order('finished_on', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Every use, for every product.
 *
 * One request rather than one per product. The list screen needs a projection
 * for each row, and each projection needs that product's whole history - so
 * per-product queries would be N round trips to render one screen. Usage rows
 * are two numbers and a date; a year of daily use is a few hundred of them.
 */
export async function listAllUses(): Promise<ProductUse[]> {
  const ownerId = await getOwnerId();

  // Every use, page by page: a single request stops at the server's row cap,
  // and a pace worked out from part of the history moves every reorder date.
  return collectPages<ProductUse>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(USES)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .order('used_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count };
  });
}

/**
 * One product, for its detail screen. Null when it no longer exists - deleted
 * from the edit screen that sits on top of the detail screen - which is a
 * normal outcome to handle, not an error to report.
 */
export async function getProduct(id: string): Promise<Product | null> {
  const { data, error } = await supabase.from(PRODUCTS).select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function listUses(productId: string): Promise<ProductUse[]> {
  return collectPages<ProductUse>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(USES)
      .select('*', { count: 'exact' })
      .eq('product_id', productId)
      .order('used_on', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    if (error) throw new Error(error.message);
    return { rows: data ?? [], total: count };
  });
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(PRODUCTS)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw explain(error, input.name);
  return data;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const { error } = await supabase.from(PRODUCTS).update(input).eq('id', id);
  if (error) throw explain(error, input.name);
}

/**
 * Mark a container finished on a given day, or reopen it with null.
 *
 * The day is chosen, not assumed to be today: a tub that ran out on Saturday
 * and was marked on Monday would otherwise have lived two days longer than it
 * did, and its lifespan is the next tub's estimate.
 *
 * Kept rather than deleted, so its real lifespan stays available. Deleting is
 * a separate, explicit action.
 */
export async function setFinished(id: string, finishedOn: string | null): Promise<void> {
  const { error } = await supabase.from(PRODUCTS).update({ finished_on: finishedOn }).eq('id', id);
  if (error) throw explain(error);
}

/**
 * Open a spare: the restock that was bought ahead.
 *
 * The container it replaces is finished FIRST, on the same day, because the
 * database allows one open container per name and opening the spare while
 * the old one is still open would be refused. If the second write fails, the
 * old one is finished and the spare still waits - visible, and one tap to
 * retry - rather than two open containers splitting today's uses.
 */
export async function openSpare(
  spareId: string,
  openedOn: string,
  replacingId: string | null,
): Promise<void> {
  if (replacingId) {
    const { error } = await supabase
      .from(PRODUCTS)
      .update({ finished_on: openedOn })
      .eq('id', replacingId)
      .is('finished_on', null);
    if (error) throw explain(error);
  }

  const { error } = await supabase.from(PRODUCTS).update({ opened_on: openedOn }).eq('id', spareId);
  if (error) throw explain(error);
}

/** Undo openSpare, in the opposite order for the same reason. */
export async function unopenSpare(spareId: string, replacedId: string | null): Promise<void> {
  const { error } = await supabase.from(PRODUCTS).update({ opened_on: null }).eq('id', spareId);
  if (error) throw explain(error);

  if (replacedId) {
    const { error: reopenError } = await supabase
      .from(PRODUCTS)
      .update({ finished_on: null })
      .eq('id', replacedId);
    if (reopenError) throw explain(reopenError);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  // product_uses cascades: deleting a product deletes its usage history. The
  // screens say how many before asking (countUses).
  const { error } = await supabase.from(PRODUCTS).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** How many uses deleting this product would take with it. */
export async function countUses(productId: string): Promise<number> {
  const { count, error } = await supabase
    .from(USES)
    .select('id', { count: 'exact', head: true })
    .eq('product_id', productId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Record one use.
 *
 * The quantity is passed in rather than read from the product at write time,
 * so correcting `per_use` later does not silently rewrite what you already
 * logged. The caller defaults it from the product; this only stores it.
 */
export async function logUse(
  productId: string,
  quantity: number,
  usedOn: string = todayISO(),
  note = '',
): Promise<ProductUse> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(USES)
    .insert({ product_id: productId, user_id: ownerId, quantity, used_on: usedOn, note })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Several uses in one insert, for "Log all". One request, so the batch lands
 * or fails as a whole rather than leaving half the morning logged.
 */
export async function logUses(
  entries: { productId: string; quantity: number; usedOn: string }[],
): Promise<ProductUse[]> {
  if (entries.length === 0) return [];
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(USES)
    .insert(
      entries.map((entry) => ({
        product_id: entry.productId,
        user_id: ownerId,
        quantity: entry.quantity,
        used_on: entry.usedOn,
        note: '',
      })),
    )
    .select();

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Correct a use in place: the day, the amount, the note.
 *
 * Before this, a wrong entry could only be deleted and re-added, which cost
 * two actions and lost the note - and a wrong entry is not harmless, because
 * the measured rate is built from exactly these rows.
 */
export async function updateUse(
  id: string,
  patch: { used_on: string; quantity: number; note: string },
): Promise<ProductUse> {
  const { data, error } = await supabase.from(USES).update(patch).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteUse(id: string): Promise<void> {
  const { error } = await supabase.from(USES).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteUses(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase.from(USES).delete().in('id', ids);
  if (error) throw new Error(error.message);
}

/**
 * Counts for the home tile: how many need reordering now.
 *
 * Reads the open containers and their uses only - finished ones cannot need
 * reordering, and their history is most of the table. The count comes from
 * the same outlook the module itself shows, so the tile and the list agree,
 * including a spare silencing a container that is running out.
 */
export async function overview(): Promise<{ inUse: number; toReorder: number; runningLow: number }> {
  const ownerId = await getOwnerId();

  const { data: products, error } = await supabase
    .from(PRODUCTS)
    .select('*')
    .eq('user_id', ownerId)
    .is('finished_on', null);
  if (error) throw new Error(error.message);

  const unfinished: Product[] = products ?? [];
  const open = unfinished.filter((product) => product.opened_on);
  if (open.length === 0) return { inUse: 0, toReorder: 0, runningLow: 0 };

  const uses = await collectPages<ProductUse>(async (from, to) => {
    const page = await supabase
      .from(USES)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .in(
        'product_id',
        open.map((product) => product.id),
      )
      .order('id', { ascending: true })
      .range(from, to);
    if (page.error) throw new Error(page.error.message);
    return { rows: page.data ?? [], total: page.count };
  });

  const summary = reorderSummary(buildOutlooks(unfinished, uses, todayISO()));
  return { inUse: summary.inUse, toReorder: summary.toReorder, runningLow: summary.runningLow };
}

/**
 * "Ordered", pressed on a reorder reminder: the next container goes on the
 * shelf as a spare, copied from this one (see orderedSpare). Read fresh,
 * because the press can come days after the reminder was planned. Resolves
 * the spare, or null when there was nothing to add.
 */
export async function addSpareFromReminder(productId: string): Promise<Product | null> {
  const [product, all] = await Promise.all([getProduct(productId), listProducts()]);
  const draft = orderedSpare(product, all, todayISO());
  return draft ? createProduct(draft) : null;
}

/**
 * Rebuild every reorder reminder from the database.
 *
 * Run at launch by core (local reminders live on the phone, so a reinstall or
 * a use logged on the website leaves them stale), and by the detail screen
 * after a change it made. The list screen rebuilds from the data it has just
 * loaded instead, which costs no extra query.
 */
export async function resyncReminders(): Promise<void> {
  const [products, uses] = await Promise.all([listProducts(), listAllUses()]);
  await replaceReminders(buildOutlooks(products, uses, todayISO()));
}

// Registered when this file is first imported. The navigator's static imports
// (the list, detail and edit screens) and the home summaries both reach it, so
// it is in place before the app's once-per-launch resync runs.
registerResync('products', resyncReminders);
