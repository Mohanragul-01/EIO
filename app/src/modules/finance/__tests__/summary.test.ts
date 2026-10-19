/**
 * The month's figures.
 *
 * The rule that matters most here is the one the spec states twice: a
 * transfer is never income, never spending, and never a slice of the pie. It
 * is tested in every function that adds money up, because each one is a
 * separate place the rule can be forgotten.
 */
import {
  compareToPrevious,
  dayTotals,
  deltaShort,
  deltaSpoken,
  expenseByCategory,
  groupByDay,
  searchTotals,
  searchTransactions,
  spendLevels,
  summarize,
  toListItems,
} from '../summary';
import type { Account, Transaction } from '../types';

let seq = 0;
function tx(over: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `t${seq}`,
    user_id: 'u',
    amount_minor: 1000,
    kind: 'expense',
    category: 'food',
    note: '',
    date: '2026-10-16',
    created_at: `2026-10-16T10:00:${String(seq % 60).padStart(2, '0')}Z`,
    account_id: 'hdfc',
    transfer_group_id: null,
    transfer_direction: null,
    ...over,
  };
}

function transfer(amount: number, group: string, date = '2026-10-16'): Transaction[] {
  return [
    tx({ kind: 'transfer', category: 'transfer', amount_minor: amount, transfer_group_id: group, transfer_direction: 'out', account_id: 'hdfc', date }),
    tx({ kind: 'transfer', category: 'transfer', amount_minor: amount, transfer_group_id: group, transfer_direction: 'in', account_id: 'cash', date }),
  ];
}

describe('summarize', () => {
  it('leaves transfers out of spent, received, the category totals and their counts', () => {
    const rows = [
      tx({ kind: 'expense', category: 'food', amount_minor: 30000 }),
      tx({ kind: 'expense', category: 'transport', amount_minor: 10000 }),
      tx({ kind: 'income', category: 'salary', amount_minor: 500000 }),
      ...transfer(200000, 'g1'),
    ];
    const summary = summarize(rows);
    expect(summary.spentMinor).toBe(40000);
    expect(summary.earnedMinor).toBe(500000);
    expect(summary.netMinor).toBe(460000);
    expect(summary.categoryTotals.map((c) => c.key)).toEqual(['food', 'transport']);
    expect(summary.categoryTotals.reduce((n, c) => n + c.count, 0)).toBe(2);
  });

  it('gives shares that add up to one, biggest first', () => {
    const summary = summarize([
      tx({ category: 'food', amount_minor: 300 }),
      tx({ category: 'rent', amount_minor: 600 }),
      tx({ category: 'food', amount_minor: 100 }),
    ]);
    expect(summary.categoryTotals.map((c) => [c.key, c.totalMinor, c.count])).toEqual([
      ['rent', 600, 1],
      ['food', 400, 2],
    ]);
    expect(summary.categoryTotals.reduce((n, c) => n + c.share, 0)).toBeCloseTo(1);
  });

  it('is all zeroes for a month of nothing but transfers', () => {
    const summary = summarize(transfer(5000, 'g2'));
    expect(summary).toEqual({ spentMinor: 0, earnedMinor: 0, netMinor: 0, categoryTotals: [] });
  });
});

describe('expenseByCategory', () => {
  it('sums expenses only', () => {
    const totals = expenseByCategory([
      tx({ category: 'food', amount_minor: 100 }),
      tx({ kind: 'income', category: 'refund', amount_minor: 50 }),
      ...transfer(999, 'g3'),
    ]);
    expect(Object.fromEntries(totals)).toEqual({ food: 100 });
  });
});

describe('compareToPrevious', () => {
  it('is a percentage against a real base', () => {
    expect(compareToPrevious(118000, 100000)).toEqual({ kind: 'percent', direction: 'up', percent: 18 });
    expect(compareToPrevious(88000, 100000)).toEqual({ kind: 'percent', direction: 'down', percent: 12 });
  });

  it('is the rupee difference when last time was under ₹500, because +900% says nothing', () => {
    expect(compareToPrevious(45000, 4500)).toEqual({ kind: 'amount', direction: 'up', diffMinor: 40500 });
  });

  it('says new when there was nothing last time, and nothing when there is nothing either time', () => {
    expect(compareToPrevious(100, 0)).toEqual({ kind: 'new' });
    expect(compareToPrevious(0, 0)).toBeNull();
  });

  it('calls a change that rounds to 0% the same', () => {
    expect(compareToPrevious(100200, 100000)).toEqual({ kind: 'same' });
    expect(compareToPrevious(5000, 5000)).toEqual({ kind: 'same' });
  });

  it('can fall to nothing', () => {
    expect(compareToPrevious(0, 100000)).toEqual({ kind: 'percent', direction: 'down', percent: 100 });
  });
});

describe('delta wording', () => {
  it('carries the direction in the words, not only in an arrow or a colour', () => {
    expect(deltaShort({ kind: 'percent', direction: 'up', percent: 18 }, 'Sep')).toBe('+18% vs Sep');
    expect(deltaShort({ kind: 'percent', direction: 'down', percent: 12 }, 'Sep')).toBe('−12% vs Sep');
    expect(deltaShort({ kind: 'amount', direction: 'up', diffMinor: 12000 }, 'Sep')).toBe('+₹120 vs Sep');
    expect(deltaShort({ kind: 'new' }, 'Sep')).toBe('none in Sep');
    expect(deltaShort({ kind: 'same' }, 'Sep')).toBe('same as Sep');
  });

  it('reads as a sentence for TalkBack', () => {
    expect(deltaSpoken({ kind: 'percent', direction: 'up', percent: 18 }, 'September')).toBe(
      '18% more than September',
    );
    expect(deltaSpoken({ kind: 'amount', direction: 'down', diffMinor: 12000 }, 'September')).toBe(
      '₹120 less than September',
    );
  });
});

describe('toListItems', () => {
  it('shows a transfer pair as one item, where its first half was', () => {
    const lunch = tx({ note: 'Lunch' });
    const pair = transfer(25000, 'g4');
    const salary = tx({ kind: 'income', category: 'salary' });
    const items = toListItems([lunch, pair[0], salary, pair[1]]);

    expect(items.map((i) => i.type)).toEqual(['entry', 'transfer', 'entry']);
    const moved = items[1];
    expect(moved.type === 'transfer' && moved).toMatchObject({
      groupId: 'g4',
      amountMinor: 25000,
      fromAccountId: 'hdfc',
      toAccountId: 'cash',
    });
  });

  it('keeps a lone half visible rather than dropping money from the list', () => {
    const [out] = transfer(700, 'g5');
    const items = toListItems([out]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'transfer', fromAccountId: 'hdfc', toAccountId: null });
  });
});

describe('groupByDay', () => {
  it('groups by date in the order given, with day totals that ignore transfers', () => {
    const items = toListItems([
      tx({ date: '2026-10-16', amount_minor: 500 }),
      ...transfer(9000, 'g6', '2026-10-16'),
      tx({ date: '2026-10-16', kind: 'income', category: 'refund', amount_minor: 200 }),
      tx({ date: '2026-10-15', amount_minor: 300 }),
    ]);
    const days = groupByDay(items);
    expect(days.map((d) => [d.date, d.outMinor, d.inMinor, d.items.length])).toEqual([
      ['2026-10-16', 500, 200, 3],
      ['2026-10-15', 300, 0, 1],
    ]);
  });
});

describe('dayTotals and spendLevels', () => {
  it('totals each day, transfers excluded', () => {
    const totals = dayTotals([
      tx({ date: '2026-10-01', amount_minor: 100 }),
      tx({ date: '2026-10-01', amount_minor: 50 }),
      tx({ date: '2026-10-02', kind: 'income', amount_minor: 900 }),
      ...transfer(5000, 'g7', '2026-10-03'),
    ]);
    expect(totals.get('2026-10-01')).toEqual({ outMinor: 150, inMinor: 0 });
    expect(totals.get('2026-10-02')).toEqual({ outMinor: 0, inMinor: 900 });
    expect(totals.has('2026-10-03')).toBe(false);
  });

  it('tints relative to a typical spending day, capped at the top level', () => {
    const totals = new Map([
      ['2026-10-01', { outMinor: 100, inMinor: 0 }],
      ['2026-10-02', { outMinor: 1000, inMinor: 0 }],
      ['2026-10-03', { outMinor: 1000, inMinor: 0 }],
      ['2026-10-04', { outMinor: 2000, inMinor: 0 }],
      ['2026-10-05', { outMinor: 90000, inMinor: 0 }],
      ['2026-10-06', { outMinor: 0, inMinor: 500 }],
    ]);
    const levels = spendLevels(totals);
    expect(levels.get('2026-10-01')).toBe(1);
    expect(levels.get('2026-10-02')).toBe(2);
    expect(levels.get('2026-10-04')).toBe(3);
    expect(levels.get('2026-10-05')).toBe(4);
    expect(levels.get('2026-10-06')).toBe(0);
  });

  it('puts a lone spending day in the middle, not at either extreme', () => {
    expect(spendLevels(new Map([['2026-10-09', { outMinor: 4000, inMinor: 0 }]])).get('2026-10-09')).toBe(2);
  });
});

describe('search', () => {
  const accounts = new Map<string, Account>([
    ['hdfc', { id: 'hdfc', name: 'HDFC' } as Account],
    ['cash', { id: 'cash', name: 'Cash' } as Account],
    ['card', { id: 'card', name: 'Amex' } as Account],
  ]);

  const rows = [
    tx({ note: 'Swiggy dinner', amount_minor: 45000 }),
    tx({ note: 'swiggy lunch', amount_minor: 25000, account_id: 'card' }),
    tx({ note: 'Uber', category: 'transport', amount_minor: 25000 }),
    tx({ kind: 'income', category: 'refund', note: 'Swiggy refund', amount_minor: 5000 }),
    ...transfer(100000, 'g8'),
  ];

  it('matches notes regardless of case', () => {
    expect(searchTransactions(rows, 'SWIGGY', accounts).map((t) => t.note)).toEqual([
      'Swiggy dinner',
      'swiggy lunch',
      'Swiggy refund',
    ]);
  });

  it('matches a category by its label, an account by its name, and an exact amount', () => {
    expect(searchTransactions(rows, 'transport', accounts).map((t) => t.note)).toEqual(['Uber']);
    expect(searchTransactions(rows, 'amex', accounts).map((t) => t.note)).toEqual(['swiggy lunch']);
    expect(searchTransactions(rows, '₹250', accounts).map((t) => t.note)).toEqual([
      'swiggy lunch',
      'Uber',
    ]);
  });

  it('brings both halves of a transfer when either matches', () => {
    // "Cash" names only the receiving half's account.
    const found = searchTransactions(rows, 'cash', accounts);
    expect(found).toHaveLength(2);
    expect(toListItems(found)).toHaveLength(1);
  });

  it('finds nothing for an empty query', () => {
    expect(searchTransactions(rows, '   ', accounts)).toEqual([]);
  });

  it('totals the results without the transfers, counting a pair once', () => {
    const items = toListItems([...rows]);
    expect(searchTotals(items)).toEqual({ count: 5, outMinor: 95000, inMinor: 5000 });
  });
});
