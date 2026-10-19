/**
 * types.ts - shapes for the Finance module.
 *
 * The category catalogue used to live here. It moved to core/categories.ts
 * once Subscriptions also needed it - see the comment at the top of that file
 * for the reasoning. Finance still owns everything else about transactions.
 */

/** What you log by hand: money that left you or reached you. */
export type EntryKind = 'expense' | 'income';

/**
 * A transfer is money moving between two of your own accounts. It is stored as
 * two rows (one out, one in) and is never spending or income: counting it as
 * either would double-count every rupee you move around.
 */
export type TransactionKind = EntryKind | 'transfer';

export type TransferDirection = 'out' | 'in';

export type Transaction = {
  id: string;
  user_id: string;
  /** Paise, always positive. Direction comes from `kind` (and, for a transfer, `transfer_direction`). */
  amount_minor: number;
  kind: TransactionKind;
  category: string;
  note: string;
  /** 'YYYY-MM-DD' - the day the money moved. */
  date: string;
  created_at: string;
  /**
   * Null for rows written before accounts existed, by the v2 app, or by a
   * writer that does not know about accounts (Subscriptions' mark-paid goes
   * through core/ledger). They still count; they just sit in no account.
   */
  account_id: string | null;
  /** Shared by the two halves of a transfer. */
  transfer_group_id: string | null;
  /** Which half of a transfer this row is; null on everything else. */
  transfer_direction: TransferDirection | null;
};

/** An expense or income, as the form saves it. Transfers have their own input. */
export type TransactionInput = {
  amount_minor: number;
  kind: EntryKind;
  category: string;
  note: string;
  date: string;
  account_id: string | null;
};

export type TransferInput = {
  amount_minor: number;
  from_account_id: string;
  to_account_id: string;
  note: string;
  date: string;
};

/**
 * The slice of a transaction the all-time figures need: balances per account,
 * the trend, deltas and budget history.
 *
 * Deliberately narrower than Transaction: the figures never look at a note or
 * an id, and saying so in the type keeps the query honest about what it
 * selects. `category` is here because last month's category totals (the
 * deltas) and six months of one category (budget history) come from it rather
 * than from six more queries.
 */
export type LedgerPoint = {
  date: string;
  kind: TransactionKind;
  amount_minor: number;
  category: string;
  account_id: string | null;
  transfer_direction: TransferDirection | null;
};

export type AccountType = 'bank' | 'cash' | 'wallet' | 'credit_card';

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  /**
   * For an ordinary account, what was in it before the first entry you logged.
   * For a liability (a credit card), what you OWED then: positive means owed.
   */
  opening_balance_minor: number;
  is_liability: boolean;
  /** False once archived: hidden from pickers, still counted in balances. */
  is_active: boolean;
  note: string;
  position: number;
  created_at: string;
  updated_at: string;
};

export type AccountInput = {
  name: string;
  type: AccountType;
  opening_balance_minor: number;
  is_liability: boolean;
};

/** A standing monthly limit for one expense category (0008's `budgets`). */
export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount_minor: number;
  rollover: boolean;
  starts_on: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

/** A pinned quick-add ("Chai ₹20 · Cash"), from `finance_templates`. */
export type QuickAdd = {
  id: string;
  user_id: string;
  /** The pill's label, and the note the logged entry gets. */
  note: string;
  amount_minor: number;
  kind: EntryKind;
  category: string;
  account_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type QuickAddInput = {
  note: string;
  amount_minor: number;
  kind: EntryKind;
  category: string;
  account_id: string | null;
};

export type FinanceSettings = {
  /** 1-31. The day a finance month begins; see period.ts. */
  month_start_day: number;
};

export const DEFAULT_SETTINGS: FinanceSettings = { month_start_day: 1 };

/**
 * The category a transfer row is filed under. The column is NOT NULL and a
 * transfer has no spending category; this value is never shown or totalled.
 */
export const TRANSFER_CATEGORY = 'transfer';
