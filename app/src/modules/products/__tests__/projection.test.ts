/**
 * Product projections.
 *
 * This is the module's only real logic and it is the kind that fails quietly:
 * a wrong "days left" still looks like a number, and you only find out when
 * you run out of whey on a Tuesday. The cases below pin the decisions that
 * could each plausibly have gone the other way.
 */
import {
  formatDaysLeft,
  project,
  urgencyOf,
  type Product,
  type ProductUse,
} from '../types';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  user_id: 'u1',
  name: 'Whey',
  category: 'supplement',
  unit: 'g',
  total_quantity: 1000,
  per_use: 30,
  price_minor: 300000,
  opened_on: '2026-01-01',
  finished_on: null,
  note: '',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...over,
});

const use = (used_on: string, quantity = 30): Pick<ProductUse, 'quantity' | 'used_on'> => ({
  used_on,
  quantity,
});

describe('project', () => {
  it('sums what has been used and leaves the rest', () => {
    const p = project(product(), [use('2026-01-01'), use('2026-01-02')], '2026-01-02');
    expect(p.used).toBe(60);
    expect(p.remaining).toBe(940);
    expect(p.percentUsed).toBe(6);
  });

  it('measures the rate from real days, not from per_use', () => {
    // THE DECISION THIS PINS. 30g per use with a 1000g tub implies 33 uses,
    // and computing "33 days left" assumes you never miss one. Used 3 times
    // over 10 days is 9g/day, so the honest answer is far longer.
    const uses = [use('2026-01-01'), use('2026-01-05'), use('2026-01-10')];
    const p = project(product(), uses, '2026-01-10');

    expect(p.daysOpen).toBe(10);
    expect(p.dailyRate).toBeCloseTo(9, 5);
    expect(p.daysLeft).toBe(Math.floor(910 / 9));
  });

  it('refuses to project from a single day', () => {
    // One use on day one implies one-per-day. For something used twice a week
    // that predicts an empty tub three times too soon, and a confident wrong
    // number is worse than admitting there is not enough data.
    const p = project(product(), [use('2026-01-01')], '2026-01-01');
    expect(p.dailyRate).toBeNull();
    expect(p.daysLeft).toBeNull();
    expect(p.emptyOn).toBeNull();
  });

  it('refuses to project when nothing has been used', () => {
    // A rate of zero would divide into an infinite lifespan.
    const p = project(product(), [], '2026-01-20');
    expect(p.dailyRate).toBeNull();
    expect(p.daysLeft).toBeNull();
  });

  it('never reports a negative remainder', () => {
    // Over-logging is a data-entry slip, not a container that owes you whey.
    const p = project(product({ total_quantity: 100 }), [use('2026-01-01', 150)], '2026-01-05');
    expect(p.remaining).toBe(0);
    expect(p.percentUsed).toBe(100);
  });

  it('projects an empty date from today, not from when it was opened', () => {
    const uses = [use('2026-01-01', 500)];
    const p = project(product(), uses, '2026-01-11');
    // 500 used over 11 days ≈ 45.45/day, 500 left ≈ 11 days.
    expect(p.daysLeft).toBe(11);
    expect(p.emptyOn).toBe('2026-01-22');
  });

  it('works out cost per day from the price of what is consumed', () => {
    // 3000 rupees for 1000g is 300 paise per gram; 50g a day is 15000 paise.
    const uses = [use('2026-01-01', 50), use('2026-01-02', 50)];
    const p = project(product(), uses, '2026-01-02');
    expect(p.dailyRate).toBe(50);
    expect(p.costPerDay).toBe(15000);
  });

  it('has no cost per day without a price', () => {
    const uses = [use('2026-01-01', 50), use('2026-01-02', 50)];
    const p = project(product({ price_minor: null }), uses, '2026-01-02');
    expect(p.costPerDay).toBeNull();
  });

  it('counts the opening day, so a product opened today is one day old', () => {
    const p = project(product({ opened_on: '2026-03-04' }), [], '2026-03-04');
    expect(p.daysOpen).toBe(1);
  });
});

describe('urgencyOf', () => {
  const at = (daysLeft: number | null) =>
    ({ remaining: 500, daysLeft }) as ReturnType<typeof project>;

  it('calls a finished product finished, whatever the numbers say', () => {
    expect(urgencyOf(product({ finished_on: '2026-02-01' }), at(90))).toBe('finished');
  });

  it('is critical inside a week, which is when ordering still arrives in time', () => {
    expect(urgencyOf(product(), at(7))).toBe('critical');
    expect(urgencyOf(product(), at(8))).toBe('soon');
  });

  it('is critical when it is already empty', () => {
    expect(urgencyOf(product(), { remaining: 0, daysLeft: 40 } as ReturnType<typeof project>)).toBe(
      'critical',
    );
  });

  it('says so rather than guessing when there is no rate', () => {
    expect(urgencyOf(product(), at(null))).toBe('unknown');
  });

  it('is ok beyond three weeks', () => {
    expect(urgencyOf(product(), at(22))).toBe('ok');
  });
});

describe('formatDaysLeft', () => {
  it('switches to months once days stop being useful', () => {
    // "67 days" is a number you have to convert in your head.
    expect(formatDaysLeft(12)).toBe('12 days');
    expect(formatDaysLeft(44)).toBe('44 days');
    expect(formatDaysLeft(67)).toBe('about 2 months');
  });

  it('handles the edges', () => {
    expect(formatDaysLeft(null)).toBe('Unknown');
    expect(formatDaysLeft(0)).toBe('Empty');
    expect(formatDaysLeft(1)).toBe('1 day');
  });
});
