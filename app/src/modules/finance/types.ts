/**
 * types.ts - shapes for the Finance module.
 *
 * The category catalogue used to live here. It moved to core/categories.ts
 * once Subscriptions also needed it - see the comment at the top of that file
 * for the reasoning. Finance still owns everything else about transactions.
 */

export type TransactionKind = 'expense' | 'income';

export type Transaction = {
  id: string;
  user_id: string;
  /** Paise, always positive. Direction comes from `kind`. */
  amount_minor: number;
  kind: TransactionKind;
  category: string;
  note: string;
  /** 'YYYY-MM-DD' - the day the money moved. */
  date: string;
  created_at: string;
};

export type TransactionInput = {
  amount_minor: number;
  kind: TransactionKind;
  category: string;
  note: string;
  date: string;
};

/**
 * The slice of a transaction the running balance and trend chart need.
 *
 * Deliberately narrower than Transaction: the figures never look at a note or
 * an id, and saying so in the type keeps the query honest about what it
 * selects.
 */
export type LedgerPoint = {
  date: string;
  kind: TransactionKind;
  amount_minor: number;
};
