/**
 * defaults.ts - what the add form fills in before you touch it.
 *
 * Logging speed decides whether the ledger is complete: a UPI payment that
 * takes eight taps to record is the one that never gets recorded. So the form
 * starts from what you did last, not from the first entry in a list:
 *
 *  - the category and account you last used for this kind (Food from Cash
 *    yesterday is Food from Cash today, more often than not);
 *  - a note you have written before brings back the category it had
 *    ("Metro" was Transport last time, so it is Transport now) - Cashew's
 *    "custom titles";
 *  - as you type a note, the matching notes you have used before, so a
 *    repeat purchase is one tap.
 *
 * Everything here reads `recent`, the newest rows first, as api.listRecent
 * returns them. No answer is returned as null rather than a guess: a wrong
 * default is a mis-filed entry nobody notices.
 */
import type { EntryKind, Transaction } from './types';

type Recent = Pick<
  Transaction,
  'kind' | 'category' | 'note' | 'account_id' | 'amount_minor' | 'transfer_group_id' | 'transfer_direction'
>;

/** The newest category, and the newest account, used for this kind. */
export function lastUsed(
  recent: Recent[],
  kind: EntryKind,
): { category: string | null; accountId: string | null } {
  const ofKind = recent.filter((row) => row.kind === kind);
  return {
    category: ofKind[0]?.category ?? null,
    // Separately, because the newest entry may have no account (an older row,
    // or one Subscriptions wrote) while the one before it does.
    accountId: ofKind.find((row) => row.account_id)?.account_id ?? null,
  };
}

/** The accounts of the newest transfer, as the default for the next one. */
export function lastTransfer(recent: Recent[]): { fromId: string | null; toId: string | null } | null {
  const first = recent.find((row) => row.kind === 'transfer' && row.transfer_group_id);
  if (!first) return null;
  const pair = recent.filter((row) => row.transfer_group_id === first.transfer_group_id);
  return {
    fromId: pair.find((row) => row.transfer_direction === 'out')?.account_id ?? null,
    toId: pair.find((row) => row.transfer_direction === 'in')?.account_id ?? null,
  };
}

/** "  Masala   Chai " and "masala chai" are the same note. */
export function normalizeNote(note: string): string {
  return note.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The category this note had the last time it was used for this kind. */
export function categoryForNote(note: string, recent: Recent[], kind: EntryKind): string | null {
  const needle = normalizeNote(note);
  if (!needle) return null;
  return recent.find((row) => row.kind === kind && normalizeNote(row.note) === needle)?.category ?? null;
}

export type NoteSuggestion = {
  note: string;
  category: string;
  amountMinor: number;
  accountId: string | null;
};

/**
 * Notes you have used before that match what you are typing: ones that START
 * with it first (you are typing a word from its beginning), then ones that
 * merely contain it. Each note once, as it was last logged. With nothing typed
 * yet, simply your most recent notes - the two-tap path for a repeat.
 */
export function noteSuggestions(
  typed: string,
  recent: Recent[],
  kind: EntryKind,
  limit = 4,
): NoteSuggestion[] {
  const needle = normalizeNote(typed);
  const seen = new Set<string>();
  const starts: NoteSuggestion[] = [];
  const contains: NoteSuggestion[] = [];

  recent.forEach((row) => {
    if (row.kind !== kind) return;
    const key = normalizeNote(row.note);
    if (!key || seen.has(key)) return;
    seen.add(key);
    // Suggesting exactly what is already typed is a button that does nothing.
    if (key === needle) return;

    const suggestion = {
      note: row.note.trim(),
      category: row.category,
      amountMinor: row.amount_minor,
      accountId: row.account_id,
    };
    if (key.startsWith(needle)) starts.push(suggestion);
    else if (key.includes(needle)) contains.push(suggestion);
  });

  return [...starts, ...contains].slice(0, limit);
}

/**
 * The category grid, most used first (Wallet's "most used categories"), so the
 * one you want is usually in the top row. Counted over `recent` for this kind;
 * ties and unused categories keep the catalogue's order. The form works this
 * out once when it opens, so a tile never moves under your finger.
 */
export function orderByUse<T extends { key: string }>(
  catalogue: T[],
  recent: Recent[],
  kind: EntryKind,
): T[] {
  const uses = new Map<string, number>();
  recent.forEach((row) => {
    if (row.kind === kind) uses.set(row.category, (uses.get(row.category) ?? 0) + 1);
  });
  return catalogue
    .map((item, index) => ({ item, index, count: uses.get(item.key) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ item }) => item);
}
