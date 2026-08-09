/**
 * api.ts - every database call the Finance module makes.
 *
 * The new idea here versus todos/notes: this module fetches ONE MONTH at a
 * time rather than everything. A transaction list grows without limit -
 * thousands of rows within a couple of years - and the screen only ever shows
 * one month, so pulling the lot would waste bandwidth and memory for data
 * that's never rendered.
 */
import { monthBounds } from '../../core/date';
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import type { Transaction, TransactionInput } from './types';

const TABLE = 'transactions';


/**
 * All transactions in one month.
 *
 * Range filtering happens in Postgres (gte/lte), not by fetching everything
 * and filtering in JS - the database has an index on (user_id, date) and can
 * answer this without scanning the table.
 */
export async function listTransactions(year: number, month: number): Promise<Transaction[]> {
  const ownerId = await getOwnerId();
  const { start, end } = monthBounds(year, month);

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: false })
    // Tie-breaker: several transactions on one day should show newest-entered
    // first, otherwise their order shuffles between refreshes.
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Note this still inserts directly rather than calling core/ledger's
 * recordEntry(). The difference is what comes back: the Finance form needs
 * the saved row returned (via .select().single()), whereas ledger.recordEntry
 * is fire-and-forget for modules that just need the money recorded.
 *
 * Two call paths, one table - which is fine, because the shape lives in one
 * type (TransactionInput / LedgerEntry) and both go through the same RLS
 * policies. If a third writer appears, that's the point to consolidate.
 */
export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateTransaction(
  id: string,
  input: Partial<TransactionInput>,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
