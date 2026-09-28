/**
 * api.ts - every database call the product tracker makes.
 */
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import { todayISO } from '../../core/date';
import type { Product, ProductInput, ProductUse } from './types';

const PRODUCTS = 'products';
const USES = 'product_uses';

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

  const { data, error } = await supabase
    .from(USES)
    .select('*')
    .eq('user_id', ownerId)
    .order('used_on', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listUses(productId: string): Promise<ProductUse[]> {
  const { data, error } = await supabase
    .from(USES)
    .select('*')
    .eq('product_id', productId)
    .order('used_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(PRODUCTS)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) {
    if (error.message.includes('duplicate')) {
      throw new Error('You are already tracking something with that name.');
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const { error } = await supabase.from(PRODUCTS).update(input).eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Mark a product finished, or reopen it.
 *
 * Kept rather than deleted, so its real lifespan stays available. Deleting is
 * a separate, explicit action.
 */
export async function setFinished(id: string, finished: boolean): Promise<void> {
  const { error } = await supabase
    .from(PRODUCTS)
    .update({ finished_on: finished ? todayISO() : null })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  // product_uses cascades: deleting a product deletes its usage history.
  const { error } = await supabase.from(PRODUCTS).delete().eq('id', id);
  if (error) throw new Error(error.message);
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

export async function deleteUse(id: string): Promise<void> {
  const { error } = await supabase.from(USES).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Counts for the home tile: what needs reordering, without the detail. */
export async function overview(): Promise<{ tracked: number }> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(PRODUCTS)
    .select('id')
    .eq('user_id', ownerId)
    .is('finished_on', null);

  if (error) throw new Error(error.message);
  return { tracked: (data ?? []).length };
}
