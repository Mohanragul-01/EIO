/**
 * Insights and price history.
 *
 * A period's cost is what was actually paid in it plus what is still due in
 * it - "this year you'll pay ₹X" counts real occurrences, not monthly x 12.
 * Price history shows the stealth rises that make a fixed budget creep.
 */
import { breakdown, periodRange, periodTotals, perItemYearly } from '../insights';
import { priceSteps, recentIncrease } from '../prices';
import type { Payment, PriceChange, Subscription } from '../types';

const TODAY = '2026-10-21'; // a Wednesday

let seq = 0;
function sub(overrides: Partial<Subscription> = {}): Subscription {
  seq += 1;
  return {
    id: `s${seq}`,
    user_id: 'u',
    name: `Sub ${seq}`,
    amount_minor: 10000,
    billing_cycle: 'monthly',
    next_due_date: '2026-10-25',
    is_active: true,
    category: 'fun',
    note: '',
    created_at: '',
    updated_at: '',
    status: 'active',
    trial_ends_on: null,
    ends_on: null,
    resume_on: null,
    cancel_url: null,
    cancel_notes: '',
    service_key: null,
    color: null,
    account_id: null,
    charge_channel: null,
    reminder_offsets: null,
    cycle_unit: 'month',
    cycle_count: 1,
    currency: 'INR',
    fx_rate: null,
    fx_rate_on: null,
    ...overrides,
  };
}

const paid = (subscription_id: string, date: string, amount_minor: number, category = 'fun'): Payment => ({
  id: `p${date}${subscription_id}`,
  subscription_id,
  amount_minor,
  date,
  account_id: null,
  note: '',
  category,
});

describe('periodRange', () => {
  it('runs a week Monday to Sunday', () => {
    expect(periodRange('week', TODAY)).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    // A Sunday belongs to the week that started the Monday before.
    expect(periodRange('week', '2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('covers the calendar month and year', () => {
    expect(periodRange('month', TODAY)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('month', '2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(periodRange('year', TODAY)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('periodTotals', () => {
  it('adds what was paid in the period to what is still due in it', () => {
    const netflix = sub({ id: 'n', next_due_date: '2026-11-02', amount_minor: 64900 });
    const gym = sub({ id: 'g', next_due_date: '2026-10-28', amount_minor: 150000, category: 'health' });
    const result = periodTotals(
      [netflix, gym],
      [paid('n', '2026-10-02', 64900), paid('g', '2026-09-28', 150000, 'health')],
      'month',
      TODAY,
    );

    expect(result.paidMinor).toBe(64900);
    expect(result.dueMinor).toBe(150000);
    expect(result.totalMinor).toBe(214900);
    expect(result.byCategory.map((r) => [r.key, r.minor])).toEqual([
      ['health', 150000],
      ['fun', 64900],
    ]);
  });

  it('counts every occurrence left in the year, not monthly x 12', () => {
    const monthly = sub({ next_due_date: '2026-10-25', amount_minor: 10000 });
    const result = periodTotals([monthly], [], 'year', TODAY);
    // 25 Oct, 25 Nov, 25 Dec.
    expect(result.dueMinor).toBe(30000);
  });

  it('breaks down by charged-to account, with no account as its own row', () => {
    const card = sub({ account_id: 'hdfc', next_due_date: '2026-10-22', amount_minor: 300 });
    const none = sub({ account_id: null, next_due_date: '2026-10-23', amount_minor: 100 });
    const result = periodTotals([card, none], [], 'week', TODAY);
    expect(result.byAccount.map((r) => [r.key, r.minor])).toEqual([
      ['hdfc', 300],
      ['', 100],
    ]);
  });

  it('leaves trials and unpriced foreign charges out', () => {
    const trial = sub({ status: 'trial', trial_ends_on: '2026-10-24', amount_minor: 99900 });
    const noRate = sub({ currency: 'USD', fx_rate: null, next_due_date: '2026-10-23' });
    expect(periodTotals([trial, noRate], [], 'week', TODAY).totalMinor).toBe(0);
  });
});

describe('breakdown', () => {
  it('groups, sorts largest first, and makes the percentages add up to 100', () => {
    const rows = breakdown([
      { key: 'a', minor: 1 },
      { key: 'b', minor: 1 },
      { key: 'c', minor: 1 },
      { key: 'a', minor: 0 },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['a', 'b', 'c']);
    expect(rows.reduce((total, r) => total + r.pct, 0)).toBe(100);
  });

  it('is empty for nothing', () => {
    expect(breakdown([])).toEqual([]);
  });
});

describe('perItemYearly', () => {
  it('lists what each costs a year, dearest first', () => {
    const cheap = sub({ name: 'Cheap', amount_minor: 1000 });
    const dear = sub({ name: 'Dear', amount_minor: 100000, cycle_unit: 'year' });
    const pack = sub({ name: 'Pack', amount_minor: 29900, cycle_unit: 'day', cycle_count: 28 });
    expect(perItemYearly([cheap, dear, pack], TODAY).map((r) => [r.sub.name, r.perYearMinor])).toEqual([
      ['Pack', Math.round((29900 * 365) / 28)],
      ['Dear', 100000],
      ['Cheap', 12000],
    ]);
  });
});

describe('price history', () => {
  const change = (effective_on: string, old_amount_minor: number, new_amount_minor: number): PriceChange => ({
    id: effective_on,
    user_id: 'u',
    subscription_id: 's',
    old_amount_minor,
    new_amount_minor,
    currency: 'INR',
    effective_on,
    created_at: `${effective_on}T00:00:00Z`,
  });

  it('lists each step newest first, with its percentage', () => {
    const steps = priceSteps([change('2025-03-03', 49900, 64900), change('2026-01-10', 64900, 59900)]);
    expect(steps.map((s) => [s.change.effective_on, s.pct, s.direction])).toEqual([
      ['2026-01-10', -8, 'down'],
      ['2025-03-03', 30, 'up'],
    ]);
  });

  it('flags an increase for 60 days, then lets it go', () => {
    const rise = [change('2026-08-25', 49900, 64900)];
    expect(recentIncrease(rise, '2026-10-24')).toMatchObject({ pct: 30 });
    expect(recentIncrease(rise, '2026-10-25')).toBeNull();
  });

  it('does not flag a cut, or a rise that a later cut undid', () => {
    expect(recentIncrease([change('2026-10-01', 64900, 49900)], TODAY)).toBeNull();
    expect(
      recentIncrease([change('2026-10-01', 49900, 64900), change('2026-10-10', 64900, 49900)], TODAY),
    ).toBeNull();
  });

  it('ignores a change dated in the future', () => {
    expect(recentIncrease([change('2026-11-01', 100, 200)], TODAY)).toBeNull();
  });
});
