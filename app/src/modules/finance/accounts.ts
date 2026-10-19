/**
 * accounts.ts - where the money sits, as pure functions.
 *
 * A balance is never stored. It is the opening balance plus every entry since,
 * worked out here from the rows, because a stored balance drifts the moment
 * one write fails halfway (0008 makes the same point).
 *
 * TWO SIGNS. Every entry has an effect on its account "as money you hold":
 * income and a transfer in add, an expense and a transfer out subtract. An
 * ordinary account's balance is its opening balance plus those effects. A
 * liability - a credit card - is shown as what you OWE, positive, the way the
 * card's own statement shows it; so the same effects are subtracted from its
 * opening amount owed. Spending on the card raises what you owe; paying the bill
 * (a transfer in) lowers it.
 *
 * TRANSFERS. One transfer is two rows, so across all accounts it nets to zero
 * by construction, and the headline balance never moves when you shuffle money
 * between your own accounts.
 */
import {
  TRANSFER_CATEGORY,
  type Account,
  type AccountType,
  type LedgerPoint,
  type TransferInput,
} from './types';

export const ACCOUNT_TYPES: AccountType[] = ['bank', 'cash', 'wallet', 'credit_card'];

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: 'Bank',
  cash: 'Cash',
  wallet: 'Wallet',
  credit_card: 'Credit card',
};

/** What an entry does to the money in its account, from the holder's side. */
export function signedFlow(
  point: Pick<LedgerPoint, 'kind' | 'amount_minor' | 'transfer_direction'>,
): number {
  if (point.kind === 'income') return point.amount_minor;
  if (point.kind === 'expense') return -point.amount_minor;
  // The database refuses a transfer without a direction (0008), so the last
  // case is unreachable; zero is the safe answer if it ever is reached.
  if (point.transfer_direction === 'in') return point.amount_minor;
  if (point.transfer_direction === 'out') return -point.amount_minor;
  return 0;
}

export type AccountBalance = {
  account: Account;
  /** For a liability, what you owe (positive = owed). */
  balanceMinor: number;
  entryCount: number;
};

export type AccountsSummary = {
  /** Ordinary accounts: active ones by position and name, then archived ones. */
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  /** Entries in no account (older rows, the v2 app, Subscriptions' mark-paid). */
  unassigned: { flowMinor: number; count: number };
  /** Sum of the ordinary accounts. */
  assetsMinor: number;
  /** Sum of what you owe on liabilities. */
  owedMinor: number;
  /** What you have, less what you owe, plus entries in no account. */
  netMinor: number;
};

function byOrder(a: AccountBalance, b: AccountBalance): number {
  // Archived accounts sink to the bottom: still counted, rarely looked at.
  if (a.account.is_active !== b.account.is_active) return a.account.is_active ? -1 : 1;
  if (a.account.position !== b.account.position) return a.account.position - b.account.position;
  return a.account.name.localeCompare(b.account.name);
}

export function summarizeAccounts(accounts: Account[], points: LedgerPoint[]): AccountsSummary {
  const flows = new Map<string, { flow: number; count: number }>();
  const unassigned = { flowMinor: 0, count: 0 };
  const known = new Set(accounts.map((a) => a.id));

  points.forEach((point) => {
    const effect = signedFlow(point);
    // An id the list does not know (an account deleted elsewhere since the
    // list loaded) is reported as unassigned rather than dropped, so the net
    // still adds up to the rows.
    if (!point.account_id || !known.has(point.account_id)) {
      unassigned.flowMinor += effect;
      unassigned.count += 1;
      return;
    }
    const current = flows.get(point.account_id) ?? { flow: 0, count: 0 };
    flows.set(point.account_id, { flow: current.flow + effect, count: current.count + 1 });
  });

  const assets: AccountBalance[] = [];
  const liabilities: AccountBalance[] = [];
  accounts.forEach((account) => {
    const { flow, count } = flows.get(account.id) ?? { flow: 0, count: 0 };
    if (account.is_liability) {
      liabilities.push({ account, balanceMinor: account.opening_balance_minor - flow, entryCount: count });
    } else {
      assets.push({ account, balanceMinor: account.opening_balance_minor + flow, entryCount: count });
    }
  });
  assets.sort(byOrder);
  liabilities.sort(byOrder);

  const assetsMinor = assets.reduce((sum, b) => sum + b.balanceMinor, 0);
  const owedMinor = liabilities.reduce((sum, b) => sum + b.balanceMinor, 0);

  return {
    assets,
    liabilities,
    unassigned,
    assetsMinor,
    owedMinor,
    netMinor: assetsMinor - owedMinor + unassigned.flowMinor,
  };
}

/**
 * The headline balance. With no opening balances entered it is exactly the
 * old "income minus expense"; with them it is what you actually have.
 */
export function netBalance(accounts: Account[], points: LedgerPoint[]): number {
  return summarizeAccounts(accounts, points).netMinor;
}

export type TransferRow = {
  amount_minor: number;
  kind: 'transfer';
  category: string;
  note: string;
  date: string;
  account_id: string;
  transfer_group_id: string;
  transfer_direction: 'out' | 'in';
};

/**
 * The two rows of one transfer. They are inserted in ONE statement, which is
 * atomic, so there is never half a transfer in the ledger.
 */
export function buildTransferRows(input: TransferInput, groupId: string): [TransferRow, TransferRow] {
  if (input.from_account_id === input.to_account_id) {
    throw new Error('A transfer needs two different accounts');
  }
  if (!(input.amount_minor > 0)) throw new Error('A transfer needs an amount');

  const shared = {
    amount_minor: input.amount_minor,
    kind: 'transfer' as const,
    category: TRANSFER_CATEGORY,
    note: input.note,
    date: input.date,
    transfer_group_id: groupId,
  };
  return [
    { ...shared, account_id: input.from_account_id, transfer_direction: 'out' },
    { ...shared, account_id: input.to_account_id, transfer_direction: 'in' },
  ];
}

/**
 * A version 4 UUID from a source of randomness.
 *
 * The group id has to exist before the insert, so both rows can carry it in
 * the one statement. It only pairs two rows of one person's ledger; it is not
 * a secret, so Math.random is good enough where the platform has no
 * crypto.randomUUID.
 */
export function uuidV4(random: () => number = Math.random): string {
  const hex = (n: number) => Math.floor(n).toString(16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.min(15, random() * 16);
    // The variant nibble is 10xx: 8, 9, a or b.
    return c === 'x' ? hex(r) : hex(8 + (r % 4));
  });
}

export function newUuid(): string {
  const native = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID;
  return native ? native.call((globalThis as { crypto?: object }).crypto) : uuidV4();
}

/** Active accounts, in picker order. */
export function activeAccounts(accounts: Account[]): Account[] {
  return accounts
    .filter((a) => a.is_active)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
}

/**
 * The account a name from outside refers to - the capture link's `account`.
 *
 * Exact first (case and edge spaces ignored), then a prefix either way round,
 * so "HDFC Bank" from a bank SMS finds an account called "HDFC". Two candidates
 * is no answer: guessing the wrong account is worse than leaving the choice to
 * the form, where it is one tap.
 */
export function matchAccount(name: string, accounts: Account[]): Account | null {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;
  const active = activeAccounts(accounts);

  const exact = active.filter((a) => a.name.trim().toLowerCase() === needle);
  if (exact.length === 1) return exact[0];

  const prefix = active.filter((a) => {
    const candidate = a.name.trim().toLowerCase();
    return candidate.startsWith(needle) || needle.startsWith(candidate);
  });
  return prefix.length === 1 ? prefix[0] : null;
}

/** 'HDFC → Cash'. */
export function describeTransfer(
  fromId: string | null,
  toId: string | null,
  accountsById: Map<string, Account>,
): string {
  const name = (id: string | null) => (id && accountsById.get(id)?.name) || 'No account';
  return `${name(fromId)} → ${name(toId)}`;
}
