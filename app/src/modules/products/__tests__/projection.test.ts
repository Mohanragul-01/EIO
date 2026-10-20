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
  previous_id: null,
  expires_on: null,
  pao_months: null,
  reorder_lead_days: null,
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
    const uses = [use('2026-01-01', 300), use('2026-01-02', 100), use('2026-01-03', 100)];
    const p = project(product(), uses, '2026-01-11');
    // 500 used over 11 days ≈ 45.45/day, 500 left ≈ 11 days.
    expect(p.daysLeft).toBe(11);
    expect(p.emptyOn).toBe('2026-01-22');
  });

  it('works out cost per day from the price of what is consumed', () => {
    // 3000 rupees for 1000g is 300 paise per gram; 50g a day is 15000 paise.
    const uses = [use('2026-01-01', 50), use('2026-01-02', 50), use('2026-01-03', 50)];
    const p = project(product(), uses, '2026-01-03');
    expect(p.dailyRate).toBe(50);
    expect(p.costPerDay).toBe(15000);
  });

  it('has no cost per day without a price', () => {
    const uses = [use('2026-01-01', 50), use('2026-01-02', 50), use('2026-01-03', 50)];
    const p = project(product({ price_minor: null }), uses, '2026-01-03');
    expect(p.dailyRate).toBe(50);
    expect(p.costPerDay).toBeNull();
  });

  it('counts the opening day, so a product opened today is one day old', () => {
    const p = project(product({ opened_on: '2026-03-04' }), [], '2026-03-04');
    expect(p.daysOpen).toBe(1);
  });

  it('projects nothing for a spare, which has not started emptying', () => {
    const p = project(product({ opened_on: null }), [], '2026-03-04');
    expect(p.daysOpen).toBe(0);
    expect(p.remaining).toBe(1000);
    expect(p.dailyRate).toBeNull();
    expect(p.daysLeft).toBeNull();
    expect(p.emptyOn).toBeNull();
  });

  it("ends a finished container's life on the day it was finished", () => {
    // v2 counted to TODAY, so "Lasted 10 days" grew by one every day the
    // finished card was looked at.
    const uses = [use('2026-01-01', 500), use('2026-01-10', 500)];
    const p = project(product({ finished_on: '2026-01-10' }), uses, '2026-03-01');
    expect(p.daysOpen).toBe(10);
    expect(p.dailyRate).toBe(100);
  });

  it('has no days left once finished, whatever was logged', () => {
    const uses = [use('2026-01-01', 100), use('2026-01-02', 100)];
    const p = project(product({ finished_on: '2026-01-02' }), uses, '2026-01-02');
    expect(p.daysLeft).toBeNull();
    expect(p.emptyOn).toBeNull();
  });
});

/*
 * Reminders are planned from these numbers, so a pace must rest on enough
 * evidence. Two cases v2 got confidently wrong: one scoop the morning after
 * opening a new tub replaced "~32 days (last one lasted 33)" with "about 2
 * months", and a tub added with its true opened date weeks ago and a first
 * log today projected 2004 days.
 */
describe('project, before there is enough evidence', () => {
  it('measures nothing from uses on one day', () => {
    const p = project(product({ opened_on: '2026-01-01' }), [use('2026-01-01')], '2026-01-02');
    expect(p.dailyRate).toBeNull();
    expect(p.daysLeft).toBeNull();
  });

  it('counts several uses on one day as one day of evidence', () => {
    const uses = [use('2026-01-01'), use('2026-01-01'), use('2026-01-02'), use('2026-01-02')];
    expect(project(product(), uses, '2026-01-05').dailyRate).toBeNull();
  });

  it('measures once uses are logged on three different days', () => {
    const uses = [use('2026-01-01'), use('2026-01-02'), use('2026-01-03')];
    const p = project(product(), uses, '2026-01-03');
    expect(p.dailyRate).toBe(30);
    expect(p.measuredDays).toBe(3);
    expect(p.daysLeft).toBe(30);
  });

  it('never counts an opened date with nothing logged after it as days of use', () => {
    // Opened in November, first logged in January: the weeks before the
    // first log are not weeks of nothing used, they are weeks not logged.
    const opened = product({ opened_on: '2025-11-01' });
    expect(project(opened, [use('2026-01-01')], '2026-01-01').daysLeft).toBeNull();

    const uses = [use('2026-01-01'), use('2026-01-02'), use('2026-01-03')];
    const p = project(opened, uses, '2026-01-03');
    expect(p.dailyRate).toBe(30);
    expect(p.measuredDays).toBe(3);
    expect(p.daysLeft).toBe(30);
    // The age of the container is still its age.
    expect(p.daysOpen).toBe(64);
  });

  it('counts the days since the last use, which are days nothing was used', () => {
    const uses = [use('2026-01-01'), use('2026-01-02'), use('2026-01-03')];
    const p = project(product(), uses, '2026-01-09');
    expect(p.measuredDays).toBe(9);
    expect(p.dailyRate).toBe(10);
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
    expect(urgencyOf(product(), at(21))).toBe('soon');
    expect(urgencyOf(product(), at(22))).toBe('ok');
  });

  it('calls a spare unopened, not unknown', () => {
    expect(urgencyOf(product({ opened_on: null }), at(null))).toBe('unopened');
  });

  it("moves both bands with the product's own lead time", () => {
    // Something that takes two weeks to arrive is "Reorder now" at 14 days,
    // and Running low two weeks before that.
    const slow = product({ reorder_lead_days: 14 });
    expect(urgencyOf(slow, at(14))).toBe('critical');
    expect(urgencyOf(slow, at(15))).toBe('soon');
    expect(urgencyOf(slow, at(28))).toBe('soon');
    expect(urgencyOf(slow, at(29))).toBe('ok');

    const fast = product({ reorder_lead_days: 2 });
    expect(urgencyOf(fast, at(2))).toBe('critical');
    expect(urgencyOf(fast, at(3))).toBe('soon');
    expect(urgencyOf(fast, at(16))).toBe('soon');
    expect(urgencyOf(fast, at(17))).toBe('ok');
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
