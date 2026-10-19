/**
 * Upcoming charges: the 14-day strip, the month calendar, the list's
 * sections and the headline totals.
 *
 * Knowing that ₹6,000 leaves in the first week of the month matters more to
 * one person's cash flow than any chart, so these are the numbers to get
 * exactly right: what is counted, what is only shown, and what is neither.
 */
import { monthCharges, projectedCharges, sections, summaryTotals, upcomingDays } from '../upcoming';
import type { Payment, Subscription } from '../types';

const TODAY = '2026-10-19'; // Monday

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
    anchor_day: null,
    ...overrides,
  };
}

function payment(subscription_id: string, date: string, amount_minor: number): Payment {
  return { id: `p-${subscription_id}-${date}`, subscription_id, amount_minor, date, account_id: null, note: '', category: 'fun' };
}

describe('projectedCharges', () => {
  it('repeats each renewal through the window, in date order', () => {
    const weekly = sub({ name: 'Weekly', cycle_unit: 'week', next_due_date: '2026-10-20', amount_minor: 5000 });
    const monthly = sub({ name: 'Monthly', next_due_date: '2026-10-22' });
    const charges = projectedCharges([monthly, weekly], '2026-10-19', '2026-11-02', TODAY);
    expect(charges.map((c) => [c.date, c.sub.name])).toEqual([
      ['2026-10-20', 'Weekly'],
      ['2026-10-22', 'Monthly'],
      ['2026-10-27', 'Weekly'],
    ]);
  });

  it('shows a trial ending as its own kind of event', () => {
    const trial = sub({ status: 'trial', trial_ends_on: '2026-10-23', next_due_date: '2026-10-23' });
    const [event] = projectedCharges([trial], TODAY, '2026-11-01', TODAY);
    expect(event.kind).toBe('trial_end');
    expect(event.date).toBe('2026-10-23');
  });

  it('projects nothing for a cancellation, even inside its access', () => {
    const cancelled = sub({ status: 'cancelled', ends_on: '2026-10-30' });
    expect(projectedCharges([cancelled], TODAY, '2026-11-30', TODAY)).toEqual([]);
  });

  it('projects a paused plan from its resume date', () => {
    const paused = sub({ status: 'paused', resume_on: '2026-10-28', next_due_date: '2026-10-28' });
    expect(projectedCharges([paused], TODAY, '2026-11-30', TODAY).map((c) => c.date)).toEqual([
      '2026-10-28',
      '2026-11-28',
    ]);
  });

  it('converts a foreign price, and leaves it unpriced without a rate', () => {
    const usd = sub({ currency: 'USD', amount_minor: 2000, fx_rate: 86.5, next_due_date: '2026-10-20' });
    const noRate = sub({ currency: 'USD', amount_minor: 2000, fx_rate: null, next_due_date: '2026-10-21' });
    const charges = projectedCharges([usd, noRate], TODAY, '2026-10-21', TODAY);
    expect(charges.map((c) => c.inrMinor)).toEqual([173000, null]);
  });
});

describe('upcomingDays (the 14-day strip)', () => {
  it('gives fourteen days from today, each with its charges and total', () => {
    const a = sub({ next_due_date: '2026-10-19', amount_minor: 64900 });
    const b = sub({ next_due_date: '2026-10-19', amount_minor: 19900 });
    const c = sub({ next_due_date: '2026-11-01', amount_minor: 29900 });
    const days = upcomingDays([a, b, c], TODAY);

    expect(days).toHaveLength(14);
    expect(days[0]).toMatchObject({ iso: '2026-10-19', totalMinor: 84800 });
    expect(days[0].charges).toHaveLength(2);
    expect(days[13]).toMatchObject({ iso: '2026-11-01', totalMinor: 29900 });
    expect(days[1]).toMatchObject({ iso: '2026-10-20', totalMinor: 0, charges: [] });
  });

  it('marks a trial end without adding it to the day total', () => {
    const trial = sub({ status: 'trial', trial_ends_on: '2026-10-20', amount_minor: 49900 });
    const day = upcomingDays([trial], TODAY)[1];
    expect(day.charges).toHaveLength(1);
    expect(day.totalMinor).toBe(0);
  });

  it('leaves overdue charges to the Overdue section', () => {
    const overdue = sub({ next_due_date: '2026-10-15' });
    const days = upcomingDays([overdue], TODAY);
    // Its next renewal after the overdue one is 15 Nov, outside the strip.
    expect(days.every((d) => d.charges.length === 0)).toBe(true);
  });
});

describe('monthCharges (the calendar)', () => {
  it('shows payments on past days and projections from each due date', () => {
    const netflix = sub({ id: 'n', next_due_date: '2026-10-25', amount_minor: 64900 });
    const month = monthCharges([netflix], [payment('n', '2026-10-02', 64900)], 2026, 10, TODAY);

    expect(month.days.get('2026-10-02')?.map((c) => c.kind)).toEqual(['paid']);
    expect(month.days.get('2026-10-25')?.map((c) => c.kind)).toEqual(['charge']);
    expect(month.paidMinor).toBe(64900);
    expect(month.stillToPayMinor).toBe(64900);
  });

  it('counts an overdue charge as still to pay', () => {
    const overdue = sub({ next_due_date: '2026-10-10', amount_minor: 30000 });
    const month = monthCharges([overdue], [], 2026, 10, TODAY);
    expect(month.stillToPayMinor).toBe(30000);
    expect(month.days.get('2026-10-10')).toHaveLength(1);
  });

  it('ignores payments outside the month and for deleted subscriptions', () => {
    const s = sub({ id: 'k', next_due_date: '2026-12-01' });
    const month = monthCharges(
      [s],
      [payment('k', '2026-09-30', 100), payment('gone', '2026-10-05', 999)],
      2026,
      10,
      TODAY,
    );
    expect(month.paidMinor).toBe(0);
    expect(month.days.size).toBe(0);
  });
});

describe('sections', () => {
  it('splits the list by urgency, each with a count and a total', () => {
    const rows = [
      sub({ next_due_date: '2026-10-10', amount_minor: 100 }), // overdue
      sub({ next_due_date: '2026-10-20', amount_minor: 200 }), // week
      sub({ next_due_date: '2026-10-21', amount_minor: 300 }), // week
      sub({ next_due_date: '2026-10-30', amount_minor: 400 }), // month
      sub({ next_due_date: '2026-12-01', amount_minor: 500 }), // later
      sub({ status: 'trial', trial_ends_on: '2026-10-28', amount_minor: 600 }),
      sub({ status: 'paused', amount_minor: 700 }),
      sub({ status: 'archived', amount_minor: 800 }),
    ];
    const result = sections(rows, TODAY);

    expect(result.sections.map((s) => [s.bucket, s.count, s.totalMinor])).toEqual([
      ['overdue', 1, 100],
      ['week', 2, 500],
      ['month', 1, 400],
      ['later', 1, 500],
      // Not charging: a trial costs nothing yet, and a pause or a cancellation
      // running out will not charge again. A total there reads as spending.
      ['trials', 1, null],
      ['paused', 1, null],
    ]);
    expect(result.archived).toHaveLength(1);
  });

  it('orders each section by its date', () => {
    const late = sub({ name: 'Late', next_due_date: '2026-10-24' });
    const early = sub({ name: 'Early', next_due_date: '2026-10-20' });
    const [week] = sections([late, early], TODAY).sections;
    expect(week.items.map((s) => s.name)).toEqual(['Early', 'Late']);
  });

  it('omits empty sections', () => {
    expect(sections([sub({ next_due_date: '2026-12-01' })], TODAY).sections.map((s) => s.bucket)).toEqual([
      'later',
    ]);
  });
});

describe('summaryTotals', () => {
  it('normalises what counts, per week, month and year', () => {
    const monthly = sub({ amount_minor: 12000 });
    const yearly = sub({ amount_minor: 120000, cycle_unit: 'year' });
    const trial = sub({ status: 'trial', trial_ends_on: '2026-10-30', amount_minor: 99900 });
    const paused = sub({ status: 'paused', amount_minor: 99900 });
    const totals = summaryTotals([monthly, yearly, trial, paused], TODAY);

    expect(totals.perMonthMinor).toBe(12000 + 10000);
    expect(totals.perYearMinor).toBe(144000 + 120000);
    expect(totals.perWeekMinor).toBe(Math.round((12000 * 12) / 52) + Math.round(120000 / 52));
    expect(totals.count).toBe(2);
    expect(totals.trialCount).toBe(1);
  });

  it('counts foreign subscriptions without a rate separately rather than guessing', () => {
    const noRate = sub({ currency: 'USD', amount_minor: 2000, fx_rate: null });
    const totals = summaryTotals([noRate, sub({ amount_minor: 100 })], TODAY);
    expect(totals.perMonthMinor).toBe(100);
    expect(totals.missingRate).toBe(1);
  });

  it('leaves one-time charges out of recurring cost', () => {
    expect(summaryTotals([sub({ cycle_unit: 'once' })], TODAY).perMonthMinor).toBe(0);
  });
});
