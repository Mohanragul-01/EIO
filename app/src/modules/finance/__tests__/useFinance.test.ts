/**
 * useFinance: the Month and Budgets tabs' data, and what each action does to
 * it while the server is still answering.
 *
 * The ledger below is the server: api.ts is mocked to answer from it, the way
 * the real queries would (a month's rows by date, the newest entered first for
 * listRecent). Focus is a plain mount. Only Date is faked - Tuesday 20 October
 * 2026 - because the hook's promises and act() need real timers.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { DateRange } from '../period';
import type { Account, Budget, QuickAdd, Transaction } from '../types';
import { useFinance } from '../useFinance';

jest.mock('@react-navigation/native', () => {
  const { useEffect } = jest.requireActual('react');
  return { useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});

jest.mock('../api', () => ({
  getSettings: jest.fn(),
  listTransactionsBetween: jest.fn(),
  listLedgerPoints: jest.fn(),
  listAccounts: jest.fn(),
  listBudgets: jest.fn(),
  listQuickAdds: jest.fn(),
  listRecent: jest.fn(),
  createTransaction: jest.fn(),
  deleteTransaction: jest.fn(),
  deleteTransfer: jest.fn(),
  restoreTransactions: jest.fn(),
  saveMonthStartDay: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

// THE SERVER -------------------------------------------------------------------

let ledger: Transaction[] = [];
let accounts: Account[] = [];
let budgets: Budget[] = [];

function tx(id: string, date: string, amountMinor: number, overrides: Partial<Transaction> = {}) {
  return {
    id,
    user_id: 'u',
    amount_minor: amountMinor,
    kind: 'expense',
    category: 'food',
    note: id,
    date,
    created_at: `${date}T12:00:00.000000+00:00`,
    account_id: null,
    transfer_group_id: null,
    transfer_direction: null,
    ...overrides,
  } satisfies Transaction;
}

function budget(category: string, amountMinor: number): Budget {
  return {
    id: `b-${category}`,
    user_id: 'u',
    category,
    amount_minor: amountMinor,
    rollover: false,
    starts_on: '2026-01-01',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

function account(id: string, overrides: Partial<Account> = {}): Account {
  return {
    id,
    user_id: 'u',
    name: id.toUpperCase(),
    type: 'bank',
    opening_balance_minor: 0,
    is_liability: false,
    is_active: true,
    note: '',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function quickAdd(id: string, overrides: Partial<QuickAdd> = {}): QuickAdd {
  return {
    id,
    user_id: 'u',
    note: 'Chai',
    amount_minor: 2000,
    kind: 'expense',
    category: 'food',
    account_id: null,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** What the server sends back for an insert. */
function inserted(
  input: Omit<
    Transaction,
    'id' | 'user_id' | 'created_at' | 'transfer_group_id' | 'transfer_direction'
  >,
  id: string,
): Transaction {
  return {
    ...input,
    id,
    user_id: 'u',
    created_at: '2026-10-20T06:30:00.123456+00:00',
    transfer_group_id: null,
    transfer_direction: null,
  };
}

const between = (range: DateRange) =>
  ledger
    .filter((r) => r.date >= range.start && r.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 20, 12, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  jest.clearAllMocks();
  ledger = [];
  accounts = [];
  budgets = [];

  api.getSettings.mockImplementation(() => Promise.resolve({ month_start_day: 1 }));
  api.listTransactionsBetween.mockImplementation((range: DateRange) =>
    Promise.resolve(between(range)),
  );
  api.listLedgerPoints.mockImplementation(() =>
    Promise.resolve(
      [...ledger]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(({ date, kind, amount_minor, category, account_id, transfer_direction }) => ({
          date,
          kind,
          amount_minor,
          category,
          account_id,
          transfer_direction,
        })),
    ),
  );
  api.listAccounts.mockImplementation(() => Promise.resolve(accounts));
  api.listBudgets.mockImplementation(() => Promise.resolve(budgets));
  api.listQuickAdds.mockImplementation(() => Promise.resolve([]));
  api.listRecent.mockImplementation(() =>
    Promise.resolve([...ledger].sort((a, b) => b.created_at.localeCompare(a.created_at))),
  );
  // Writes change the server, so the reload every write triggers sees them.
  api.deleteTransaction.mockImplementation((id: string) => {
    ledger = ledger.filter((r) => r.id !== id);
    return Promise.resolve();
  });
  api.deleteTransfer.mockImplementation((groupId: string) => {
    const gone = ledger.filter((r) => r.transfer_group_id === groupId);
    ledger = ledger.filter((r) => r.transfer_group_id !== groupId);
    return Promise.resolve(gone);
  });
  api.restoreTransactions.mockImplementation((rows: Transaction[]) => {
    ledger = [...ledger, ...rows];
    return Promise.resolve();
  });
  let serial = 0;
  api.createTransaction.mockImplementation((input) =>
    Promise.resolve(inserted(input, `t-new-${(serial += 1)}`)),
  );
});

afterEach(() => {
  jest.useRealTimers();
});

/** Let every load that has started, and anything it started, land. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function loaded() {
  const hook = await renderHook(() => useFinance());
  await settle();
  return hook;
}

const entryIds = (days: { items: { key: string }[] }[]) =>
  days.flatMap((d) => d.items.map((i) => i.key));

// STEPPING MONTHS --------------------------------------------------------------

describe('stepping to another month', () => {
  beforeEach(() => {
    ledger = [tx('oct', '2026-10-05', 50000), tx('sep', '2026-09-10', 20000)];
    budgets = [budget('food', 100000)];
  });

  it("never shows the month you left under the new month's title", async () => {
    const { result } = await loaded();
    expect(result.current.summary.spentMinor).toBe(50000);

    const september = deferred<Transaction[]>();
    api.listTransactionsBetween.mockImplementationOnce(() => september.promise);
    await act(async () => {
      result.current.stepPeriod(-1);
    });

    // Titled September while September is still on its way: none of
    // October's entries, Spent or budget spending may show under it.
    expect(result.current.period).toEqual({ year: 2026, month: 9 });
    expect(entryIds(result.current.days)).toEqual([]);
    expect(result.current.summary.spentMinor).toBe(0);
    expect(result.current.budgetTotals.budgetedSpentMinor).toBe(0);
    expect(result.current.periodReady).toBe(false);

    await act(async () => {
      september.resolve(between({ start: '2026-09-01', end: '2026-09-30' }));
    });
    expect(result.current.periodReady).toBe(true);
    expect(entryIds(result.current.days)).toEqual(['sep']);
    expect(result.current.summary.spentMinor).toBe(20000);
    expect(result.current.budgetTotals.budgetedSpentMinor).toBe(20000);
  });

  it("does the same while a new month start's period loads", async () => {
    const { result } = await loaded();

    const reloaded = deferred<Transaction[]>();
    api.listTransactionsBetween.mockImplementationOnce(() => reloaded.promise);
    api.getSettings.mockImplementation(() => Promise.resolve({ month_start_day: 25 }));
    await act(async () => {
      await result.current.setMonthStart(25);
    });

    // 25 Sep - 24 Oct, titled October: the 1-31 October rows are not it.
    expect(result.current.range).toEqual({ start: '2026-09-25', end: '2026-10-24' });
    expect(entryIds(result.current.days)).toEqual([]);
    expect(result.current.periodReady).toBe(false);

    await act(async () => {
      reloaded.resolve(between({ start: '2026-09-25', end: '2026-10-24' }));
    });
    await settle();
    expect(result.current.periodReady).toBe(true);
    expect(entryIds(result.current.days)).toEqual(['oct']);
  });

  it('fetches only the new month, not every row again', async () => {
    const { result } = await loaded();
    expect(api.listLedgerPoints).toHaveBeenCalledTimes(1);
    expect(api.getSettings).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.stepPeriod(-1);
    });
    await settle();
    await act(async () => {
      result.current.stepPeriod(-1);
    });
    await settle();

    // The balances, the trend and last month's figures span all time, and a
    // step does not change them.
    expect(api.listLedgerPoints).toHaveBeenCalledTimes(1);
    expect(api.listTransactionsBetween).toHaveBeenLastCalledWith({
      start: '2026-08-01',
      end: '2026-08-31',
    });
    expect(result.current.period).toEqual({ year: 2026, month: 8 });
    expect(result.current.periodReady).toBe(true);
  });

  it('keeps the newest step when two answers land out of order', async () => {
    const { result } = await loaded();

    const september = deferred<Transaction[]>();
    api.listTransactionsBetween.mockImplementationOnce(() => september.promise);
    await act(async () => {
      result.current.stepPeriod(-1);
    });
    await act(async () => {
      result.current.goToCurrent();
    });
    await settle();
    expect(entryIds(result.current.days)).toEqual(['oct']);

    // September's answer arrives late; it must not replace October's.
    await act(async () => {
      september.resolve(between({ start: '2026-09-01', end: '2026-09-30' }));
    });
    expect(result.current.period).toEqual({ year: 2026, month: 10 });
    expect(entryIds(result.current.days)).toEqual(['oct']);
  });
});

// QUICK ADDS -------------------------------------------------------------------

describe('a quick-add pill', () => {
  it('ignores a second tap while its first is still logging', async () => {
    const chai = quickAdd('q-chai');
    const { result } = await loaded();

    const saving = deferred<Transaction>();
    api.createTransaction.mockImplementationOnce(() => saving.promise);
    let second: Promise<Transaction | null> | undefined;
    await act(async () => {
      void result.current.logQuickAdd(chai);
      second = result.current.logQuickAdd(chai);
    });
    expect(api.createTransaction).toHaveBeenCalledTimes(1);

    await act(async () => {
      saving.resolve(inserted({ ...api.createTransaction.mock.calls[0][0] }, 't-1'));
    });
    // Nothing logged, so no toast and no Undo for it.
    await expect(second).resolves.toBeNull();

    // Once the first has landed, the next tap is a real one.
    api.createTransaction.mockImplementationOnce((input) =>
      Promise.resolve(inserted(input, 't-2')),
    );
    await act(async () => {
      await result.current.logQuickAdd(chai);
    });
    expect(api.createTransaction).toHaveBeenCalledTimes(2);
  });

  it('with no account of its own, logs to the account you last entered, if it is still in use', async () => {
    accounts = [
      account('cash', { position: 0 }),
      account('hdfc', { position: 1 }),
      account('old', { position: 2, is_active: false }),
    ];
    // The month on screen is ordered by date; what you last ENTERED is not
    // in it. Entered most recently: one on an archived account, and before
    // that one from HDFC, dated last month.
    ledger = [
      tx('oct', '2026-10-02', 5000, {
        account_id: 'cash',
        created_at: '2026-10-02T09:00:00.000000+00:00',
      }),
      tx('late', '2026-09-28', 5000, {
        account_id: 'hdfc',
        created_at: '2026-10-19T09:00:00.000000+00:00',
      }),
      tx('closed', '2026-09-27', 5000, {
        account_id: 'old',
        created_at: '2026-10-20T05:00:00.000000+00:00',
      }),
    ];
    const { result } = await loaded();

    await act(async () => {
      await result.current.logQuickAdd(quickAdd('q-chai'));
    });
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: 'hdfc', date: '2026-10-20' }),
    );
  });

  it('with no account and no history, logs to your first account', async () => {
    accounts = [account('hdfc', { position: 1 }), account('cash', { position: 0 })];
    const { result } = await loaded();

    await act(async () => {
      await result.current.logQuickAdd(quickAdd('q-chai'));
    });
    expect(api.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: 'cash' }),
    );
  });

  it('logs two different pills tapped together', async () => {
    const { result } = await loaded();

    await act(async () => {
      await Promise.all([
        result.current.logQuickAdd(quickAdd('q-chai')),
        result.current.logQuickAdd(quickAdd('q-metro', { note: 'Metro', category: 'transport' })),
      ]);
    });
    expect(api.createTransaction).toHaveBeenCalledTimes(2);
  });
});

// DELETE AND UNDO --------------------------------------------------------------

describe('deleting a transfer', () => {
  it('Undo puts back both halves, even one dated outside the month on screen', async () => {
    const out = tx('out', '2026-10-03', 200000, {
      kind: 'transfer',
      category: 'transfer',
      account_id: 'hdfc',
      transfer_group_id: 'g',
      transfer_direction: 'out',
    });
    // Moved into September by the v2 app: not in October's rows.
    const back = {
      ...out,
      id: 'in',
      date: '2026-09-30',
      account_id: 'cash',
      transfer_direction: 'in' as const,
    };
    ledger = [out, back];
    const { result } = await loaded();

    const item = result.current.days[0].items[0];
    expect(item.type === 'transfer' && item.rows.map((r) => r.id)).toEqual(['out']);

    let gone: Transaction[] | null = null;
    await act(async () => {
      gone = await result.current.deleteItem(item);
    });
    expect(api.deleteTransfer).toHaveBeenCalledWith('g');
    expect(entryIds(result.current.days)).toEqual([]);

    await act(async () => {
      await result.current.restoreRows(gone!);
    });
    expect(api.restoreTransactions).toHaveBeenCalledWith([out, back]);
    // Only October's half goes back into October's list.
    expect(result.current.rows.map((r) => r.id)).toEqual(['out']);
  });
});

// THE COMPARISON WITH LAST MONTH -----------------------------------------------

describe('the comparison with last month', () => {
  beforeEach(() => {
    ledger = [
      tx('oct', '2026-10-05', 100000),
      tx('sep-early', '2026-09-10', 100000),
      tx('sep-late', '2026-09-25', 400000),
      tx('aug', '2026-08-30', 250000),
    ];
  });

  it('while this month runs, holds it against as many days of the last one', async () => {
    const { result } = await loaded();

    // 20 days of October against 1-20 September, not all thirty: the same
    // spending so far is "same", not "-80%".
    expect(result.current.deltas.spent).toEqual({ kind: 'same' });
    expect(result.current.deltas.byCategory.get('food')).toEqual({ kind: 'same' });
    // And the label says which days, so it never claims all of September.
    expect(result.current.versus).toBe('1–20 Sep');
    expect(result.current.versusLong).toBe('1 to 20 September');
  });

  it('holds a finished month against the whole of the one before', async () => {
    const { result } = await loaded();
    await act(async () => {
      result.current.stepPeriod(-1);
    });
    await settle();

    expect(result.current.deltas.spent).toEqual({ kind: 'percent', direction: 'up', percent: 100 });
    expect(result.current.versus).toBe('Aug');
    expect(result.current.versusLong).toBe('August');
  });
});
