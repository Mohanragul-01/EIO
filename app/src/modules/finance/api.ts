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
import type { LedgerPoint, Transaction, TransactionInput } from './types';

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

/**
 * Every transaction ever, reduced to the three fields the figures need.
 *
 * The running balance and the monthly trend are both derived from this one
 * fetch rather than from two aggregate queries. Two reasons:
 *
 * PostgREST aggregates (`amount_minor.sum()`) would push the work to Postgres,
 * which is the textbook answer, but they depend on a server setting that can be
 * off, and a silently-empty aggregate is worse than a slightly larger payload.
 *
 * And the numbers are integer paise, so summing them in JavaScript is exact.
 * This is only true because of that: summing rupees as floats would drift.
 *
 * The cost is fetching every row. Three small columns and no notes keeps that
 * cheap, and at personal scale (thousands of rows, not millions) it is not
 * measurable. If it ever is, this is the one function to replace with an RPC.
 */
export async function listLedgerPoints(): Promise<LedgerPoint[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('date, kind, amount_minor')
    .eq('user_id', ownerId)
    .order('date', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Full rows for CSV export, optionally within a date range.
 *
 * Separate from listLedgerPoints because the export needs the note and the
 * category, which the figures do not, and the figures need every row, which
 * the export may not.
 */
export async function listForExport(range?: {
  start: string;
  end: string;
}): Promise<Transaction[]> {
  const ownerId = await getOwnerId();

  let query = supabase.from(TABLE).select('*').eq('user_id', ownerId);
  if (range) query = query.gte('date', range.start).lte('date', range.end);

  const { data, error } = await query.order('date', { ascending: true });

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
