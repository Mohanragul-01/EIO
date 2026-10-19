/**
 * Which reminders a subscription gets, and when.
 *
 * "Reminders are the product": a missed one is a charge you did not want.
 * The plan is pure - it takes `now` and returns dates and words - so the
 * failure people actually hit (a reminder on the wrong day, or none at all)
 * is caught here rather than on a phone. Tests run in America/New_York, so
 * the fire times cross a daylight-saving change.
 */
import {
  DEFAULT_REMINDER_SETTINGS,
  effectiveOffsets,
  offsetsToSave,
  reminderId,
  reminderPlan,
} from '../reminders';
import type { ReminderSettings, Subscription } from '../types';

// Monday 19 October 2026, 08:00 local.
const NOW = new Date(2026, 9, 19, 8, 0);
const SETTINGS: ReminderSettings = { offsets: [7, 3, 1], minutes: 9 * 60 };

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
    billing_cycle: 'monthly',
    next_due_date: '2026-10-26',
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

/** [day of month, hours, minutes] for each planned reminder, in plan order. */
const when = (plan: { date: Date }[]) =>
  plan.map((r) => [r.date.getDate(), r.date.getHours(), r.date.getMinutes()]);

describe('effectiveOffsets', () => {
  it('uses the defaults, always adds the same day, newest last', () => {
    expect(effectiveOffsets(sub(), SETTINGS)).toEqual([7, 3, 1, 0]);
    expect(effectiveOffsets(sub(), { offsets: [], minutes: 540 })).toEqual([0]);
  });

  it('lets a subscription choose its own, or none', () => {
    expect(effectiveOffsets(sub({ reminder_offsets: [1] }), SETTINGS)).toEqual([1, 0]);
    expect(effectiveOffsets(sub({ reminder_offsets: [] }), SETTINGS)).toEqual([]);
  });

  it('drops duplicates and nonsense', () => {
    expect(effectiveOffsets(sub({ reminder_offsets: [3, 3, 0, -2, 1.5] }), SETTINGS)).toEqual([
      3, 0,
    ]);
  });

  it('defaults to three days and one day ahead, at nine', () => {
    expect(DEFAULT_REMINDER_SETTINGS).toEqual({ offsets: [3, 1], minutes: 540 });
  });
});

describe('offsetsToSave (what the edit form stores)', () => {
  it('stores null for the defaults and [] for Off', () => {
    expect(offsetsToSave('default', [7])).toBeNull();
    expect(offsetsToSave('off', [7])).toEqual([]);
  });

  it('keeps the same-day reminder when Custom has no days ticked', () => {
    // [] is how Off is stored; a Custom choice with nothing ticked is not Off.
    const saved = offsetsToSave('custom', []);
    expect(saved).toEqual([0]);
    expect(effectiveOffsets(sub({ reminder_offsets: saved }), SETTINGS)).toEqual([0]);
  });

  it('stores the ticked days with the same day, most days ahead first', () => {
    expect(offsetsToSave('custom', [1, 7])).toEqual([7, 1, 0]);
    expect(offsetsToSave('custom', [0, 3])).toEqual([3, 0]);
  });
});

describe('reminderPlan: renewals', () => {
  it('schedules every chosen offset, plus the morning of', () => {
    const plan = reminderPlan(sub({ next_due_date: '2026-10-26' }), SETTINGS, NOW);
    expect(when(plan)).toEqual([
      [19, 9, 0],
      [23, 9, 0],
      [25, 9, 0],
      [26, 9, 0],
    ]);
  });

  it('never skips: due in two days still gets the morning-of', () => {
    // THE BUG. 7 and 3 days ahead have both passed; v2 stopped there.
    const plan = reminderPlan(sub({ next_due_date: '2026-10-21' }), { offsets: [7, 3], minutes: 540 }, NOW);
    expect(when(plan)).toEqual([[21, 9, 0]]);
  });

  it('keeps a reminder later today, and drops one earlier today', () => {
    // 08:00 now: 09:00 today is still ahead.
    expect(when(reminderPlan(sub({ next_due_date: '2026-10-19' }), SETTINGS, NOW))).toEqual([
      [19, 9, 0],
    ]);
    const tenAm = new Date(2026, 9, 19, 10, 0);
    expect(reminderPlan(sub({ next_due_date: '2026-10-19' }), SETTINGS, tenAm)).toEqual([]);
  });

  it('honours the time of day', () => {
    const plan = reminderPlan(sub({ next_due_date: '2026-10-21' }), { offsets: [1], minutes: 21 * 60 + 30 }, NOW);
    expect(when(plan)).toEqual([
      [20, 21, 30],
      [21, 21, 30],
    ]);
  });

  it('fires at the same wall-clock time across a daylight-saving change', () => {
    // Clocks go back on 1 November in New York.
    const plan = reminderPlan(sub({ next_due_date: '2026-11-02' }), { offsets: [3, 1], minutes: 540 }, NOW);
    expect(when(plan)).toEqual([
      [30, 9, 0],
      [1, 9, 0],
      [2, 9, 0],
    ]);
  });

  it('respects a subscription whose reminders are off', () => {
    expect(reminderPlan(sub({ reminder_offsets: [] }), SETTINGS, NOW)).toEqual([]);
  });

  it('plans nothing for an overdue renewal', () => {
    expect(reminderPlan(sub({ next_due_date: '2026-10-10' }), SETTINGS, NOW)).toEqual([]);
  });

  it('plans nothing for what will not charge', () => {
    for (const overrides of [
      { status: 'cancelled' as const, ends_on: '2026-10-30' },
      { status: 'cancelled' as const, ends_on: null },
      { status: 'archived' as const },
      { status: 'paused' as const, resume_on: null },
    ]) {
      expect(reminderPlan(sub(overrides), SETTINGS, NOW)).toEqual([]);
    }
  });

  it('gives each reminder its own id under the subscription', () => {
    const ids = reminderPlan(sub(), SETTINGS, NOW).map((r) => r.id);
    expect(ids).toEqual([
      'subscription-renewal-abc-d7',
      'subscription-renewal-abc-d3',
      'subscription-renewal-abc-d1',
      'subscription-renewal-abc-d0',
    ]);
    ids.forEach((id) => expect(id.startsWith(`${reminderId('abc')}-`)).toBe(true));
  });
});

describe('reminderPlan: wording', () => {
  it('names the service, the day and the amount in the title', () => {
    const plan = reminderPlan(sub({ next_due_date: '2026-10-21' }), { offsets: [1], minutes: 540 }, NOW);
    expect(plan.map((r) => r.title)).toEqual([
      'Netflix renews tomorrow · ₹649',
      'Netflix renews today · ₹649',
    ]);
  });

  it('counts days for earlier reminders', () => {
    const [first] = reminderPlan(sub({ next_due_date: '2026-10-26' }), SETTINGS, NOW);
    expect(first.title).toBe('Netflix renews in 7 days · ₹649');
  });

  it('puts the account in the body', () => {
    const [first] = reminderPlan(sub(), SETTINGS, NOW, { accountName: 'HDFC Card' });
    expect(first.body).toContain('HDFC Card');
    expect(first.body).toMatch(/^Due /);
  });

  it('shows a foreign price with its rupee value', () => {
    const plan = reminderPlan(
      sub({ name: 'ChatGPT', next_due_date: '2026-10-19', currency: 'USD', amount_minor: 2000, fx_rate: 86.5 }),
      SETTINGS,
      NOW,
    );
    expect(plan[0].title).toBe('ChatGPT renews today · $20 (≈₹1,730)');
  });

  it('says "is due" for a one-time charge, which does not renew', () => {
    const plan = reminderPlan(sub({ cycle_unit: 'once', next_due_date: '2026-10-19' }), SETTINGS, NOW);
    expect(plan[0].title).toBe('Netflix is due today · ₹649');
  });

  it('says "resumes" for a pause with a resume date', () => {
    const plan = reminderPlan(
      sub({ status: 'paused', resume_on: '2026-10-20', next_due_date: '2026-10-20' }),
      SETTINGS,
      NOW,
    );
    expect(plan.map((r) => r.title)).toEqual([
      'Netflix resumes tomorrow · ₹649',
      'Netflix resumes today · ₹649',
    ]);
  });

  it('routes a tap to the subscription, and the Mark paid action to its payment', () => {
    const [first] = reminderPlan(sub(), SETTINGS, NOW);
    expect(first.data).toEqual({
      subscriptionId: 'abc',
      route: 'SubscriptionDetail',
      params: { id: 'abc' },
      actions: { mark_paid: { route: 'SubscriptionDetail', params: { id: 'abc', action: 'pay' } } },
    });
    expect(first.categoryId).toBe('subscription_renewal');
  });
});

describe('reminderPlan: trials', () => {
  const trial = sub({ status: 'trial', trial_ends_on: '2026-10-25', next_due_date: '2026-10-25' });

  it('reminds 3 days and 1 day before, and the morning of, whatever the defaults', () => {
    const plan = reminderPlan(trial, { offsets: [7], minutes: 540 }, NOW);
    expect(when(plan)).toEqual([
      [22, 9, 0],
      [24, 9, 0],
      [25, 9, 0],
    ]);
    expect(plan.map((r) => r.id)).toEqual([
      'subscription-renewal-abc-t3',
      'subscription-renewal-abc-t1',
      'subscription-renewal-abc-t0',
    ]);
  });

  it('says what it costs after, and offers the decision', () => {
    const plan = reminderPlan(trial, SETTINGS, NOW);
    expect(plan[1].title).toBe('Netflix trial ends tomorrow');
    expect(plan[1].body).toBe('Then ₹649 / mo. Keep it, or cancel before it charges.');
    expect(plan[1].categoryId).toBe('subscription_trial');
    expect(plan[1].data.actions).toEqual({
      keep: { route: 'SubscriptionDetail', params: { id: 'abc', action: 'keep' } },
      cancelled: { route: 'SubscriptionDetail', params: { id: 'abc', action: 'cancelled' } },
    });
  });

  it('stays quiet for a trial whose reminders are off', () => {
    expect(reminderPlan({ ...trial, reminder_offsets: [] }, SETTINGS, NOW)).toEqual([]);
  });

  it('plans nothing once the trial is over', () => {
    expect(
      reminderPlan(sub({ status: 'trial', trial_ends_on: '2026-10-10' }), SETTINGS, NOW),
    ).toEqual([]);
  });
});
