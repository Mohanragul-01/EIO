/**
 * The budget pace marker.
 *
 * A budget only changes behaviour if you can see mid-month that you are ahead
 * of pace, so the tick, the state and the per-day figure are the whole
 * feature. Each boundary is pinned: exactly at pace, exactly at the limit, the
 * first paisa over either.
 */
import { BUDGET_STATE_WORDS, budgetHistory, budgetLine, budgetStatus } from '../budget';
import type { LedgerPoint } from '../types';

const day17of31 = { days: 31, elapsed: 17, daysLeft: 15 };

describe('budgetStatus', () => {
  it('puts the tick at the days gone over the days in the month, times the limit', () => {
    const status = budgetStatus({ limitMinor: 31000, spentMinor: 0, progress: day17of31 });
    expect(status.paceMinor).toBe(17000);
    expect(status.tickShare).toBeCloseTo(17 / 31);
  });

  it('is on track at exactly the pace, and over pace one paisa past it', () => {
    expect(budgetStatus({ limitMinor: 31000, spentMinor: 17000, progress: day17of31 }).state).toBe('under');
    expect(budgetStatus({ limitMinor: 31000, spentMinor: 17001, progress: day17of31 }).state).toBe('over_pace');
  });

  it('is over budget only past the limit; at the limit it is over pace with nothing left', () => {
    const atLimit = budgetStatus({ limitMinor: 31000, spentMinor: 31000, progress: day17of31 });
    expect(atLimit.state).toBe('over_pace');
    expect(atLimit.leftMinor).toBe(0);
    const over = budgetStatus({ limitMinor: 31000, spentMinor: 31041, progress: day17of31 });
    expect(over.state).toBe('over');
    expect(over.overMinor).toBe(41);
  });

  it('spreads what is left over today and the days after, rounded down to whole rupees', () => {
    // ₹2,350 over 15 days is ₹156.67: ₹156 is the most you can spend daily
    // and still land inside the limit.
    const status = budgetStatus({ limitMinor: 500000, spentMinor: 265000, progress: day17of31 });
    expect(status.perDayMinor).toBe(15600);
  });

  it('caps the fill at a full bar when over', () => {
    expect(budgetStatus({ limitMinor: 1000, spentMinor: 5000, progress: day17of31 }).fillShare).toBe(1);
  });

  it('does not divide by zero on a zero-day period', () => {
    const status = budgetStatus({ limitMinor: 1000, spentMinor: 0, progress: { days: 0, elapsed: 0, daysLeft: 0 } });
    expect(Number.isFinite(status.tickShare)).toBe(true);
    expect(Number.isFinite(status.paceMinor)).toBe(true);
  });

  it('has a word for every state, so colour is never the only signal', () => {
    expect(BUDGET_STATE_WORDS).toEqual({ under: 'On track', over_pace: 'Over pace', over: 'Over budget' });
  });
});

describe('budgetLine', () => {
  it('reads like the spec', () => {
    const status = budgetStatus({ limitMinor: 500000, spentMinor: 266000, progress: day17of31 });
    expect(budgetLine(status)).toBe('₹2,340 left · ₹156/day for 15 days');
  });

  it('says one day, not one days', () => {
    const status = budgetStatus({ limitMinor: 50000, spentMinor: 10000, progress: { days: 31, elapsed: 31, daysLeft: 1 } });
    expect(budgetLine(status)).toBe('₹400 left · ₹400/day for 1 day');
  });

  it('gives the overspend when over', () => {
    const status = budgetStatus({ limitMinor: 100000, spentMinor: 141000, progress: day17of31 });
    expect(budgetLine(status)).toBe('Over by ₹410');
  });

  it('has no per-day figure once the month is over', () => {
    const status = budgetStatus({ limitMinor: 500000, spentMinor: 266000, progress: { days: 30, elapsed: 30, daysLeft: 0 } });
    expect(budgetLine(status)).toBe('₹2,340 under the limit');
  });

  it('says the limit is reached at exactly the limit', () => {
    const status = budgetStatus({ limitMinor: 1000, spentMinor: 1000, progress: day17of31 });
    expect(budgetLine(status)).toBe('Limit reached · ₹0 left');
  });

  it('drops the per-day figure when it would round to nothing', () => {
    const status = budgetStatus({ limitMinor: 100500, spentMinor: 100000, progress: day17of31 });
    expect(budgetLine(status)).toBe('₹5 left · 15 days to go');
  });
});

describe('budgetHistory', () => {
  const point = (date: string, amount: number, over: Partial<LedgerPoint> = {}): LedgerPoint => ({
    date,
    kind: 'expense',
    amount_minor: amount,
    category: 'food',
    account_id: null,
    transfer_direction: null,
    ...over,
  });

  it('totals one category per finance month, honouring the start day', () => {
    const points = [
      point('2026-09-20', 100), // September (25 Aug - 24 Sep)
      point('2026-09-26', 200), // October (25 Sep - 24 Oct)
      point('2026-10-24', 300), // October
      point('2026-10-25', 999), // November: outside the window
      point('2026-10-01', 50, { category: 'rent' }),
      point('2026-10-01', 70, { kind: 'income' }),
    ];
    expect(
      budgetHistory(points, 'food', [
        { year: 2026, month: 9 },
        { year: 2026, month: 10 },
      ], 25),
    ).toEqual([
      { period: { year: 2026, month: 9 }, spentMinor: 100 },
      { period: { year: 2026, month: 10 }, spentMinor: 500 },
    ]);
  });
});
