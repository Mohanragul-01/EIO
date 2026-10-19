/**
 * Account balances and transfers.
 *
 * A balance is a number you act on ("can I pay rent from HDFC?"), and a wrong
 * one looks exactly like a right one. The two ways it goes wrong are signs: a
 * credit card counts upwards (what you owe), and a transfer has to leave one
 * account and reach the other without ever being spending.
 */
import {
  buildTransferRows,
  describeTransfer,
  matchAccount,
  netBalance,
  signedFlow,
  summarizeAccounts,
  uuidV4,
} from '../accounts';
import type { Account, LedgerPoint } from '../types';

function account(over: Partial<Account> & { id: string }): Account {
  return {
    user_id: 'u',
    name: over.id.toUpperCase(),
    type: 'bank',
    opening_balance_minor: 0,
    is_liability: false,
    is_active: true,
    note: '',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function point(over: Partial<LedgerPoint>): LedgerPoint {
  return {
    date: '2026-10-01',
    kind: 'expense',
    amount_minor: 0,
    category: 'food',
    account_id: null,
    transfer_direction: null,
    ...over,
  };
}

const hdfc = account({ id: 'hdfc', opening_balance_minor: 100000 });
const cash = account({ id: 'cash', type: 'cash', position: 1 });
const card = account({ id: 'card', type: 'credit_card', is_liability: true, opening_balance_minor: 5000 });

describe('signedFlow', () => {
  it('adds income and transfers in, subtracts expenses and transfers out', () => {
    expect(signedFlow(point({ kind: 'income', amount_minor: 100 }))).toBe(100);
    expect(signedFlow(point({ kind: 'expense', amount_minor: 100 }))).toBe(-100);
    expect(signedFlow(point({ kind: 'transfer', transfer_direction: 'in', amount_minor: 100 }))).toBe(100);
    expect(signedFlow(point({ kind: 'transfer', transfer_direction: 'out', amount_minor: 100 }))).toBe(-100);
  });
});

describe('summarizeAccounts', () => {
  it('is the opening balance plus everything since, for an ordinary account', () => {
    const summary = summarizeAccounts([hdfc], [
      point({ account_id: 'hdfc', kind: 'income', amount_minor: 50000 }),
      point({ account_id: 'hdfc', kind: 'expense', amount_minor: 20000 }),
    ]);
    expect(summary.assets[0].balanceMinor).toBe(100000 + 50000 - 20000);
    expect(summary.assets[0].entryCount).toBe(2);
  });

  it('moves money between accounts on a transfer without changing the total', () => {
    const points = [
      point({ account_id: 'hdfc', kind: 'transfer', transfer_direction: 'out', amount_minor: 30000 }),
      point({ account_id: 'cash', kind: 'transfer', transfer_direction: 'in', amount_minor: 30000 }),
    ];
    const summary = summarizeAccounts([hdfc, cash], points);
    const byId = Object.fromEntries(summary.assets.map((b) => [b.account.id, b.balanceMinor]));
    expect(byId.hdfc).toBe(70000);
    expect(byId.cash).toBe(30000);
    expect(summary.netMinor).toBe(100000);
  });

  it('counts a credit card as what you owe: spending raises it, paying it off lowers it', () => {
    const points = [
      point({ account_id: 'card', kind: 'expense', amount_minor: 12000 }),
      // Paying the bill is a transfer from the bank to the card.
      point({ account_id: 'hdfc', kind: 'transfer', transfer_direction: 'out', amount_minor: 10000 }),
      point({ account_id: 'card', kind: 'transfer', transfer_direction: 'in', amount_minor: 10000 }),
      // A refund on the card lowers what you owe too.
      point({ account_id: 'card', kind: 'income', amount_minor: 1000 }),
    ];
    const summary = summarizeAccounts([hdfc, card], points);
    expect(summary.liabilities[0].balanceMinor).toBe(5000 + 12000 - 10000 - 1000);
    expect(summary.owedMinor).toBe(6000);
    expect(summary.assetsMinor).toBe(90000);
    expect(summary.netMinor).toBe(90000 - 6000);
  });

  it('keeps entries with no account in the net, counted once, on their own line', () => {
    const summary = summarizeAccounts([hdfc], [
      point({ account_id: null, kind: 'expense', amount_minor: 700 }),
      point({ account_id: null, kind: 'income', amount_minor: 200 }),
    ]);
    expect(summary.unassigned).toEqual({ flowMinor: -500, count: 2 });
    expect(summary.netMinor).toBe(100000 - 500);
  });

  it('treats an entry pointing at an account it does not know as unassigned', () => {
    const summary = summarizeAccounts([hdfc], [point({ account_id: 'gone', kind: 'expense', amount_minor: 100 })]);
    expect(summary.unassigned.count).toBe(1);
  });

  it('still counts an archived account, listed after the active ones', () => {
    const old = account({ id: 'old', is_active: false, opening_balance_minor: 2500, position: -1 });
    const summary = summarizeAccounts([old, hdfc], []);
    expect(summary.assets.map((b) => b.account.id)).toEqual(['hdfc', 'old']);
    expect(summary.netMinor).toBe(102500);
  });

  it('orders accounts by position, then name', () => {
    const a = account({ id: 'b-acc', name: 'Beta', position: 2 });
    const b = account({ id: 'a-acc', name: 'Alpha', position: 2 });
    const c = account({ id: 'c-acc', name: 'Zed', position: 1 });
    expect(summarizeAccounts([a, b, c], []).assets.map((x) => x.account.name)).toEqual([
      'Zed',
      'Alpha',
      'Beta',
    ]);
  });
});

describe('netBalance', () => {
  it('equals income minus expense plus the openings, whatever transfers happened', () => {
    const points = [
      point({ account_id: 'hdfc', kind: 'income', amount_minor: 80000 }),
      point({ account_id: 'cash', kind: 'expense', amount_minor: 3000 }),
      point({ account_id: 'card', kind: 'expense', amount_minor: 9000 }),
      point({ account_id: 'hdfc', kind: 'transfer', transfer_direction: 'out', amount_minor: 9000 }),
      point({ account_id: 'card', kind: 'transfer', transfer_direction: 'in', amount_minor: 9000 }),
      point({ account_id: null, kind: 'expense', amount_minor: 1000 }),
    ];
    const incomeMinusExpense = 80000 - 3000 - 9000 - 1000;
    const openings = 100000 + 0 - 5000; // the card's opening is owed
    expect(netBalance([hdfc, cash, card], points)).toBe(incomeMinusExpense + openings);
  });

  it('is zero with nothing at all, not NaN', () => {
    expect(netBalance([], [])).toBe(0);
  });
});

describe('buildTransferRows', () => {
  it('makes one row leaving the source and one reaching the destination, paired', () => {
    const [out, into] = buildTransferRows(
      { amount_minor: 25000, from_account_id: 'hdfc', to_account_id: 'cash', note: 'ATM', date: '2026-10-19' },
      'group-1',
    );
    expect(out).toEqual({
      amount_minor: 25000,
      kind: 'transfer',
      category: 'transfer',
      note: 'ATM',
      date: '2026-10-19',
      account_id: 'hdfc',
      transfer_group_id: 'group-1',
      transfer_direction: 'out',
    });
    expect(into).toMatchObject({ account_id: 'cash', transfer_direction: 'in', transfer_group_id: 'group-1' });
  });

  it('refuses a transfer to the same account, or of nothing', () => {
    const base = { amount_minor: 100, from_account_id: 'a', to_account_id: 'b', note: '', date: '2026-10-19' };
    expect(() => buildTransferRows({ ...base, to_account_id: 'a' }, 'g')).toThrow();
    expect(() => buildTransferRows({ ...base, amount_minor: 0 }, 'g')).toThrow();
  });
});

describe('uuidV4', () => {
  it('is a version 4 UUID the database column accepts', () => {
    const values = [0, 0.5, 0.999999, 0.25];
    let i = 0;
    const id = uuidV4(() => values[i++ % values.length]);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('differs between calls with real randomness', () => {
    expect(uuidV4()).not.toBe(uuidV4());
  });
});

describe('matchAccount', () => {
  const accounts = [
    account({ id: 'h', name: 'HDFC' }),
    account({ id: 's', name: 'SBI Savings' }),
    account({ id: 'c', name: 'Cash' }),
    account({ id: 'x', name: 'Old Wallet', is_active: false }),
  ];

  it('matches a name exactly, ignoring case and spaces at the ends', () => {
    expect(matchAccount('  hdfc ', accounts)?.id).toBe('h');
  });

  it('matches a unique prefix either way round', () => {
    expect(matchAccount('SBI', accounts)?.id).toBe('s');
    expect(matchAccount('HDFC Bank', accounts)?.id).toBe('h');
  });

  it('gives up rather than guess between two, and skips archived accounts', () => {
    const two = [...accounts, account({ id: 'h2', name: 'HDFC Credit' })];
    expect(matchAccount('HDF', two)).toBeNull();
    expect(matchAccount('Old Wallet', accounts)).toBeNull();
    expect(matchAccount('', accounts)).toBeNull();
  });
});

describe('describeTransfer', () => {
  it('reads "from → to", saying so when an account is gone', () => {
    const byId = new Map([
      ['h', account({ id: 'h', name: 'HDFC' })],
      ['c', account({ id: 'c', name: 'Cash' })],
    ]);
    expect(describeTransfer('h', 'c', byId)).toBe('HDFC → Cash');
    expect(describeTransfer('h', null, byId)).toBe('HDFC → No account');
  });
});
