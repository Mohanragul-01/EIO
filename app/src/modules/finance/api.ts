/**
 * api.ts - every database call the Finance module makes.
 *
 * The list screens fetch ONE PERIOD at a time rather than everything. A
 * transaction list grows without limit - thousands of rows within a couple of
 * years - and the screen only ever shows one month, so pulling the lot for
 * the list would waste bandwidth and memory for data that is never rendered.
 *
 * The figures that span all time (account balances, the trend, last month's
 * deltas, a category's history) come from listLedgerPoints: every row, in six
 * narrow columns, paged past the server's row cap (see paging.ts).
 *
 * Tables: transactions (0004, extended by 0008), accounts and budgets (0008),
 * finance_templates and finance_settings (0022).
 */
import { monthBounds, todayISO } from '../../core/date';
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import { buildTransferRows, newUuid } from './accounts';
import { financeOverview, type FinanceOverview } from './overview';
import { collectPages } from '../../core/paging';
import { normalizeStartDay, type DateRange } from './period';
import {
  DEFAULT_SETTINGS,
  type Account,
  type AccountInput,
  type Budget,
  type FinanceSettings,
  type LedgerPoint,
  type QuickAdd,
  type QuickAddInput,
  type Transaction,
  type TransactionInput,
  type TransferInput,
} from './types';

const TABLE = 'transactions';
const POINT_COLUMNS = 'date, kind, amount_minor, category, account_id, transfer_direction';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// TRANSACTIONS ----------------------------------------------------------------

/**
 * Every transaction between two dates, newest first.
 *
 * Range filtering happens in Postgres (gte/lte), not by fetching everything
 * and filtering in JS - the database has an index on (user_id, date) and can
 * answer this without scanning the table. Paged, like every unbounded read: a
 * month is far below the cap today, but the cap fails silently.
 */
export async function listTransactionsBetween(
  range: DateRange,
  options: { category?: string } = {},
): Promise<Transaction[]> {
  const ownerId = await getOwnerId();

  return collectPages<Transaction>(async (from, to) => {
    let query = supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .gte('date', range.start)
      .lte('date', range.end);
    if (options.category) query = query.eq('category', options.category);

    const { data, error, count } = await query
      .order('date', { ascending: false })
      // Tie-breakers: several transactions on one day show newest-entered
      // first, and the id makes the order total so no row lands on two pages.
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    fail(error);
    return { rows: data ?? [], total: count };
  });
}

/** One calendar month, for the calendar and the home tile's fallbacks. */
export async function listTransactions(year: number, month: number): Promise<Transaction[]> {
  return listTransactionsBetween(monthBounds(year, month));
}

/**
 * Every transaction ever, reduced to the six fields the figures need.
 *
 * The balances, the trend, the deltas and a category's six-month history are
 * all derived from this one fetch rather than from separate aggregate queries.
 * PostgREST aggregates depend on a server setting that can be off, and a
 * silently-empty aggregate is worse than a larger payload. The numbers are
 * integer paise, so summing them in JavaScript is exact.
 *
 * The cost is fetching every row. Six narrow columns and no notes keeps that
 * cheap at personal scale; if it ever is not, this is the one function to
 * replace with an RPC.
 */
export async function listLedgerPoints(): Promise<LedgerPoint[]> {
  const ownerId = await getOwnerId();

  return collectPages<LedgerPoint>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select(POINT_COLUMNS, { count: 'exact' })
      .eq('user_id', ownerId)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    fail(error);
    return { rows: (data ?? []) as LedgerPoint[], total: count };
  });
}

/**
 * The most recently ENTERED rows, for the add form's defaults, note memory and
 * duplicate warning. By created_at, not date: "what did I log last" is about
 * when you typed it.
 */
export async function listRecent(limit = 300): Promise<Transaction[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(limit);
  fail(error);
  return data ?? [];
}

/** Every full row, newest first: for search. */
export async function listAllTransactions(): Promise<Transaction[]> {
  const ownerId = await getOwnerId();

  return collectPages<Transaction>(async (from, to) => {
    const { data, error, count } = await supabase
      .from(TABLE)
      .select('*', { count: 'exact' })
      .eq('user_id', ownerId)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to);
    fail(error);
    return { rows: data ?? [], total: count };
  });
}

/**
 * Full rows for CSV export, oldest first, optionally within a date range.
 *
 * Separate from listLedgerPoints because the export needs the note, which the
 * figures do not, and the figures need every row, which the export may not.
 */
export async function listForExport(range?: DateRange): Promise<Transaction[]> {
  const ownerId = await getOwnerId();

  return collectPages<Transaction>(async (from, to) => {
    let query = supabase.from(TABLE).select('*', { count: 'exact' }).eq('user_id', ownerId);
    if (range) query = query.gte('date', range.start).lte('date', range.end);
    const { data, error, count } = await query
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to);
    fail(error);
    return { rows: data ?? [], total: count };
  });
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  fail(error);
  return data;
}

/** Both halves of a transfer (or the one that is left). */
export async function getTransferRows(groupId: string): Promise<Transaction[]> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('transfer_group_id', groupId);
  fail(error);
  return data ?? [];
}

/**
 * Note this still inserts directly rather than calling core/ledger's
 * recordEntry(). The difference is what comes back: the Finance form needs
 * the saved row returned (via .select().single()), whereas ledger.recordEntry
 * is fire-and-forget for modules that just need the money recorded.
 */
export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  fail(error);
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

  fail(error);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  fail(error);
}

/**
 * Put deleted rows back exactly as they were - same id, same created_at - for
 * Undo. One insert, so a transfer's two halves come back together or not at
 * all.
 */
export async function restoreTransactions(rows: Transaction[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from(TABLE).insert(rows);
  fail(error);
}

/**
 * A transfer: two rows in ONE insert. A single statement is atomic, so a
 * dropped connection can never leave money that left one account and reached
 * none.
 */
export async function createTransfer(input: TransferInput): Promise<Transaction[]> {
  const ownerId = await getOwnerId();
  const rows = buildTransferRows(input, newUuid()).map((row) => ({ ...row, user_id: ownerId }));

  const { data, error } = await supabase.from(TABLE).insert(rows).select();
  fail(error);
  return data ?? [];
}

/**
 * Change a transfer: both rows in ONE upsert, for the same reason as above.
 * Each half keeps its id; a half that had gone missing is written fresh, which
 * mends a lone half rather than leaving it lonely.
 */
export async function updateTransfer(
  groupId: string,
  input: TransferInput,
  existing: Transaction[],
): Promise<void> {
  const ownerId = await getOwnerId();
  const idFor = (direction: 'out' | 'in') =>
    existing.find((row) => row.transfer_direction === direction)?.id ?? newUuid();

  const rows = buildTransferRows(input, groupId).map((row) => ({
    ...row,
    id: idFor(row.transfer_direction),
    user_id: ownerId,
  }));

  const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: 'id' });
  fail(error);
}

/**
 * Both halves in one statement, whatever their dates. Returns the rows it
 * deleted, so Undo puts back exactly those - not only the halves a list had
 * fetched, which miss one the v2 app moved into another month.
 */
export async function deleteTransfer(groupId: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('transfer_group_id', groupId)
    .select();
  fail(error);
  return data ?? [];
}

// ACCOUNTS --------------------------------------------------------------------

export async function listAccounts(): Promise<Account[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', ownerId)
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  fail(error);
  return data ?? [];
}

export async function createAccount(input: AccountInput, position: number): Promise<Account> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...input, position, user_id: ownerId })
    .select()
    .single();
  fail(error);
  return data;
}

export async function updateAccount(
  id: string,
  patch: Partial<AccountInput> & { is_active?: boolean },
): Promise<Account> {
  const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select().single();
  fail(error);
  return data;
}

/**
 * Only for an account with no entries - the screen offers it only then. 0008
 * sets a deleted account's entries to no account, which would quietly strip
 * their history; archiving is how a used account goes away.
 */
export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  fail(error);
}

// BUDGETS ---------------------------------------------------------------------

export async function listBudgets(): Promise<Budget[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', ownerId)
    .eq('is_active', true);
  fail(error);
  return data ?? [];
}

/**
 * Set a category's monthly limit. An upsert on (user_id, category), the
 * table's unique key, so setting it twice changes it rather than failing.
 */
export async function saveBudget(category: string, amountMinor: number): Promise<Budget> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: ownerId, category, amount_minor: amountMinor, is_active: true },
      { onConflict: 'user_id,category' },
    )
    .select()
    .single();
  fail(error);
  return data;
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  fail(error);
}

/** Undo for a deleted budget: the same row back, id and all. */
export async function restoreBudget(budget: Budget): Promise<void> {
  const { error } = await supabase.from('budgets').upsert(budget, { onConflict: 'user_id,category' });
  fail(error);
}

// QUICK-ADDS ------------------------------------------------------------------

export async function listQuickAdds(): Promise<QuickAdd[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('finance_templates')
    .select('*')
    .eq('user_id', ownerId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  fail(error);
  return data ?? [];
}

/**
 * Pin a quick-add. Without a position it goes after the last pin, which costs
 * one small read - the add form pins without having the list loaded.
 */
export async function createQuickAdd(input: QuickAddInput, position?: number): Promise<QuickAdd> {
  const ownerId = await getOwnerId();
  let at = position;
  if (at === undefined) {
    const { data: last, error: lastError } = await supabase
      .from('finance_templates')
      .select('position')
      .eq('user_id', ownerId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();
    fail(lastError);
    at = ((last?.position as number | undefined) ?? -1) + 1;
  }
  const { data, error } = await supabase
    .from('finance_templates')
    .insert({ ...input, position: at, user_id: ownerId })
    .select()
    .single();
  fail(error);
  return data;
}

export async function updateQuickAdd(id: string, patch: Partial<QuickAddInput>): Promise<QuickAdd> {
  const { data, error } = await supabase
    .from('finance_templates')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  fail(error);
  return data;
}

export async function deleteQuickAdd(id: string): Promise<void> {
  const { error } = await supabase.from('finance_templates').delete().eq('id', id);
  fail(error);
}

export async function restoreQuickAdd(row: QuickAdd): Promise<void> {
  const { error } = await supabase.from('finance_templates').insert(row);
  fail(error);
}

// SETTINGS --------------------------------------------------------------------

/** No row yet means every default. */
export async function getSettings(): Promise<FinanceSettings> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('finance_settings')
    .select('month_start_day')
    .eq('user_id', ownerId)
    .maybeSingle();
  fail(error);
  return data ? { ...DEFAULT_SETTINGS, ...data } : DEFAULT_SETTINGS;
}

export async function saveMonthStartDay(day: number): Promise<void> {
  const ownerId = await getOwnerId();
  const { error } = await supabase
    .from('finance_settings')
    .upsert({ user_id: ownerId, month_start_day: day }, { onConflict: 'user_id' });
  fail(error);
}

// HOME --------------------------------------------------------------------------

/**
 * Balance, this month's spending and budgets over, for the home tile and the
 * website's dashboard: the same figures the Finance screen shows, from the
 * same rules (overview.ts).
 */
export async function loadOverview(): Promise<FinanceOverview> {
  const [settings, accounts, points, budgets] = await Promise.all([
    getSettings(),
    listAccounts(),
    listLedgerPoints(),
    listBudgets(),
  ]);
  return financeOverview({
    accounts,
    points,
    budgets,
    startDay: normalizeStartDay(settings.month_start_day),
    today: todayISO(),
  });
}
