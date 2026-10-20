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
import type { Account, Budget, Transaction } from '../types';
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
  deleteTransaction: jest.fn(() => Promise.resolve()),
  deleteTransfer: jest.fn(),
  restoreTransactions: jest.fn(() => Promise.resolve()),
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
