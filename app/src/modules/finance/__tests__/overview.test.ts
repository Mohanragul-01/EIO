/**
 * The home tile's figures: one line on the phone, one card on the website,
 * computed once. It has to honour the same two rules as the Finance screen -
 * transfers are not spending, and "this month" follows the month start - or
 * the tile and the screen it opens would disagree.
 */
import { financeOverview } from '../overview';
import type { Account, Budget, LedgerPoint } from '../types';

const point = (date: string, kind: LedgerPoint['kind'], amount: number, over: Partial<LedgerPoint> = {}): LedgerPoint => ({
  date,
  kind,
  amount_minor: amount,
  category: 'food',
  account_id: 'h',
  transfer_direction: null,
  ...over,
});

const hdfc = { id: 'h', name: 'HDFC', opening_balance_minor: 100000, is_liability: false, is_active: true, position: 0 } as Account;
const food = { id: 'b', category: 'food', amount_minor: 10000, is_active: true } as Budget;

describe('financeOverview', () => {
  const points = [
    point('2026-10-01', 'expense', 6000),
    point('2026-10-02', 'transfer', 50000, { transfer_direction: 'out' }),
    point('2026-10-02', 'transfer', 50000, { transfer_direction: 'in', account_id: null }),
    point('2026-09-20', 'expense', 999),
  ];

  it('gives the balance across accounts and this month without transfers', () => {
    const result = financeOverview({ accounts: [hdfc], points, budgets: [], startDay: 1, today: '2026-10-19' });
    expect(result.spentMinor).toBe(6000);
    expect(result.balanceMinor).toBe(100000 - 6000 - 999);
  });

  it('follows the month start', () => {
    // From the 15th, October is 15 Oct - 14 Nov, so 1 and 2 October are September's.
    const result = financeOverview({ accounts: [hdfc], points, budgets: [], startDay: 15, today: '2026-10-19' });
    expect(result.spentMinor).toBe(0);
  });

  it('counts budgets over their limit', () => {
    const over = [...points, point('2026-10-05', 'expense', 5000)];
    expect(
      financeOverview({ accounts: [hdfc], points: over, budgets: [food], startDay: 1, today: '2026-10-19' }).overBudget,
    ).toBe(1);
    expect(
      financeOverview({ accounts: [hdfc], points, budgets: [food], startDay: 1, today: '2026-10-19' }).overBudget,
    ).toBe(0);
  });
});
