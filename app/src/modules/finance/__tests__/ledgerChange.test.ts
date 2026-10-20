/**
 * An Undo reaches every Finance screen that lists entries.
 *
 * The edit screen deletes, goes back, and only then offers Undo. The screen
 * beneath has already reloaded without the row by the time Undo puts it back,
 * so each list must listen for ledgerChanged() and look again (changes.ts).
 * Search and Category detail did not: after an Undo there they kept showing
 * one entry and its money fewer, which invites logging it again by hand.
 *
 * api.ts is mocked; focus is a plain mount.
 */
import { act, renderHook } from '@testing-library/react-native';

import { ledgerChanged } from '../changes';
import type { Transaction } from '../types';
import { useCategoryDetail } from '../useCategoryDetail';
import { useFinanceSearch } from '../useFinanceSearch';

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});

jest.mock('../api', () => ({
  getSettings: jest.fn(() => Promise.resolve({ month_start_day: 1 })),
  listAccounts: jest.fn(() => Promise.resolve([])),
  listAllTransactions: jest.fn(),
  listBudgets: jest.fn(() => Promise.resolve([])),
  listLedgerPoints: jest.fn(() => Promise.resolve([])),
  listTransactionsBetween: jest.fn(),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

function tx(id: string, amountMinor: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    user_id: 'u',
    amount_minor: amountMinor,
    kind: 'expense',
    category: 'food',
    note: 'Swiggy',
    date: '2026-10-12',
    created_at: `2026-10-12T10:00:0${id.length}Z`,
    account_id: null,
    transfer_group_id: null,
    transfer_direction: null,
    ...overrides,
  };
}

/** Let the mount's load, and anything it started, settle. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('after an Undo elsewhere', () => {
  const kept = tx('a', 25000);
  const restored = tx('bb', 30000);

  it('Search shows the restored entry and counts it in the total', async () => {
    api.listAllTransactions.mockResolvedValue([kept]);
    const { result } = await renderHook(() => useFinanceSearch());
    await settle();
    await act(async () => {
      result.current.setQuery('swiggy');
    });
    expect(result.current.totals.outMinor).toBe(25000);

    // The edit screen's Undo: the row is back on the server, then the nudge.
    api.listAllTransactions.mockResolvedValue([restored, kept]);
    await act(async () => {
      ledgerChanged();
    });
    await settle();

    expect(result.current.totals.outMinor).toBe(55000);
    expect(result.current.totals.count).toBe(2);
    expect(result.current.days.flatMap((d) => d.items.map((i) => i.key))).toContain('bb');
  });

  it("Category detail shows the restored entry and counts it in the month's total", async () => {
    api.listTransactionsBetween.mockResolvedValue([kept]);
    const { result } = await renderHook(() => useCategoryDetail('food', { year: 2026, month: 10 }));
    await settle();
    expect(result.current.spentMinor).toBe(25000);

    api.listTransactionsBetween.mockResolvedValue([restored, kept]);
    await act(async () => {
      ledgerChanged();
    });
    await settle();

    expect(result.current.spentMinor).toBe(55000);
    expect(result.current.days.flatMap((d) => d.items.map((i) => i.key))).toContain('bb');
  });
});
