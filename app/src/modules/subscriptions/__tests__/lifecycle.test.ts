/**
 * Lifecycle: what a stored status means on a given day.
 *
 * The status you chose is stored; what it means today is derived, because
 * nothing runs in the background to flip "paused" to "active" on the resume
 * date. Every function takes `today`, so these tests need no clock.
 */
import { endTrialPatch } from '../actions';
import {
  bucketOf,
  countdown,
  countsInTotals,
  daysBetween,
  effectiveState,
  isActiveFlag,
  needsTrialDecision,
  projectsCharges,
  notificationActionApplies,
  staleActionMessage,
} from '../lifecycle';
import type { Subscription } from '../types';

const TODAY = '2026-10-19'; // a Monday

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'id',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
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

describe('daysBetween', () => {
  it('counts calendar days, across a daylight-saving change', () => {
    expect(daysBetween('2026-10-19', '2026-10-19')).toBe(0);
    expect(daysBetween('2026-10-19', '2026-10-20')).toBe(1);
    expect(daysBetween('2026-10-20', '2026-10-19')).toBe(-1);
    // 1 November is the autumn change in New York, where these tests run.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('effectiveState', () => {
  it('reads an active subscription as active', () => {
    expect(effectiveState(sub(), TODAY)).toBe('active');
  });

  it('wakes a pause up on its resume date', () => {
    expect(effectiveState(sub({ status: 'paused', resume_on: '2026-10-20' }), TODAY)).toBe(
      'paused',
    );
    expect(effectiveState(sub({ status: 'paused', resume_on: TODAY }), TODAY)).toBe('active');
    expect(effectiveState(sub({ status: 'paused', resume_on: null }), TODAY)).toBe('paused');
  });

  it('keeps a cancellation running until its access date, inclusive', () => {
    expect(effectiveState(sub({ status: 'cancelled', ends_on: TODAY }), TODAY)).toBe('ending');
    expect(effectiveState(sub({ status: 'cancelled', ends_on: '2026-10-18' }), TODAY)).toBe(
      'ended',
    );
    // No access date: it has simply ended (how v2's inactive rows arrive).
    expect(effectiveState(sub({ status: 'cancelled', ends_on: null }), TODAY)).toBe('ended');
  });

  it('turns a trial past its end into a decision', () => {
    expect(effectiveState(sub({ status: 'trial', trial_ends_on: TODAY }), TODAY)).toBe('trial');
    expect(effectiveState(sub({ status: 'trial', trial_ends_on: '2026-10-18' }), TODAY)).toBe(
      'trial_over',
    );
  });

  it('falls back to the due date for a trial with no end date', () => {
    expect(
      effectiveState(sub({ status: 'trial', trial_ends_on: null, next_due_date: '2026-10-10' }), TODAY),
    ).toBe('trial_over');
  });

  it('leaves archived alone', () => {
    expect(effectiveState(sub({ status: 'archived' }), TODAY)).toBe('archived');
  });
});

describe('totals and projections', () => {
  it('counts active and still-running cancellations, never trials or pauses', () => {
    expect(countsInTotals(sub(), TODAY)).toBe(true);
    expect(countsInTotals(sub({ status: 'cancelled', ends_on: '2026-10-30' }), TODAY)).toBe(true);
    expect(countsInTotals(sub({ status: 'cancelled', ends_on: '2026-10-01' }), TODAY)).toBe(false);
    expect(countsInTotals(sub({ status: 'trial', trial_ends_on: '2026-10-30' }), TODAY)).toBe(false);
    expect(countsInTotals(sub({ status: 'paused' }), TODAY)).toBe(false);
    expect(countsInTotals(sub({ status: 'archived' }), TODAY)).toBe(false);
  });

  it('never counts a trial cancelled before it charged', () => {
    // "I cancelled" keeps access until the trial ends, but nothing was paid
    // for it: the spec keeps a trial out of totals until it converts.
    const trial = sub({
      status: 'trial',
      trial_ends_on: '2026-10-25',
      next_due_date: '2026-10-25',
    });
    expect(countsInTotals({ ...trial, ...endTrialPatch(trial) }, TODAY)).toBe(false);
    // A trial kept, paid for, then cancelled counts until its access ends.
    const paidUp = sub({ status: 'cancelled', trial_ends_on: '2026-09-25', ends_on: '2026-11-25' });
    expect(countsInTotals(paidUp, TODAY)).toBe(true);
  });

  it('projects charges only for what will actually renew', () => {
    expect(projectsCharges(sub(), TODAY)).toBe(true);
    // A cancellation will not renew, even while you still have access.
    expect(projectsCharges(sub({ status: 'cancelled', ends_on: '2026-10-30' }), TODAY)).toBe(false);
    // A pause with a resume date charges again on that date.
    expect(projectsCharges(sub({ status: 'paused', resume_on: '2026-11-01' }), TODAY)).toBe(true);
    expect(projectsCharges(sub({ status: 'paused', resume_on: null }), TODAY)).toBe(false);
    expect(projectsCharges(sub({ status: 'trial', trial_ends_on: '2026-10-30' }), TODAY)).toBe(false);
  });

  it('writes v2s flag as active-or-trial', () => {
    expect(isActiveFlag('active')).toBe(true);
    expect(isActiveFlag('trial')).toBe(true);
    expect(isActiveFlag('paused')).toBe(false);
    expect(isActiveFlag('cancelled')).toBe(false);
    expect(isActiveFlag('archived')).toBe(false);
  });
});

describe('bucketOf', () => {
  it('puts active subscriptions in time buckets', () => {
    expect(bucketOf(sub({ next_due_date: '2026-10-18' }), TODAY)).toBe('overdue');
    expect(bucketOf(sub({ next_due_date: TODAY }), TODAY)).toBe('week');
    expect(bucketOf(sub({ next_due_date: '2026-10-25' }), TODAY)).toBe('week'); // 6 days
    expect(bucketOf(sub({ next_due_date: '2026-10-26' }), TODAY)).toBe('month'); // 7 days, still October
    expect(bucketOf(sub({ next_due_date: '2026-11-02' }), TODAY)).toBe('later');
  });

  it('lets this week run into next month', () => {
    expect(bucketOf(sub({ next_due_date: '2026-11-02' }), '2026-10-30')).toBe('week');
  });

  it('groups the rest by state', () => {
    expect(bucketOf(sub({ status: 'trial', trial_ends_on: '2026-10-30' }), TODAY)).toBe('trials');
    expect(bucketOf(sub({ status: 'trial', trial_ends_on: '2026-10-01' }), TODAY)).toBe('trials');
    expect(bucketOf(sub({ status: 'paused' }), TODAY)).toBe('paused');
    expect(bucketOf(sub({ status: 'cancelled', ends_on: '2026-10-30' }), TODAY)).toBe('paused');
    expect(bucketOf(sub({ status: 'cancelled', ends_on: null }), TODAY)).toBe('archive');
    expect(bucketOf(sub({ status: 'archived' }), TODAY)).toBe('archive');
  });

  it('files a resumed pause by its due date', () => {
    expect(
      bucketOf(sub({ status: 'paused', resume_on: '2026-10-19', next_due_date: '2026-10-19' }), TODAY),
    ).toBe('week');
  });
});

describe('countdown', () => {
  const at = (next_due_date: string) => countdown(sub({ next_due_date }), TODAY);

  it('speaks in days up to 13, then weeks, then months', () => {
    expect(at(TODAY).text).toBe('Today');
    expect(at('2026-10-20').text).toBe('Tomorrow');
    expect(at('2026-10-24').text).toBe('in 5 days');
    expect(at('2026-11-01').text).toBe('in 13 days');
    expect(at('2026-11-09').text).toBe('in 3 wks');
    expect(at('2027-01-19').text).toBe('in 3 months');
  });

  it('says how overdue, with a word, not only a colour', () => {
    expect(at('2026-10-18')).toEqual({ text: '1 day overdue', tone: 'danger' });
    expect(at('2026-10-17').text).toBe('2 days overdue');
  });

  it('marks the coming week as needing attention', () => {
    expect(at('2026-10-26').tone).toBe('warning');
    expect(at('2026-10-27').tone).toBe('muted');
  });

  it('describes trials, pauses and endings in their own words', () => {
    expect(countdown(sub({ status: 'trial', trial_ends_on: TODAY }), TODAY)).toEqual({
      text: 'Trial ends today',
      tone: 'warning',
    });
    expect(countdown(sub({ status: 'trial', trial_ends_on: '2026-10-29' }), TODAY).text).toBe(
      'Trial ends in 10 days',
    );
    expect(countdown(sub({ status: 'trial', trial_ends_on: '2026-10-18' }), TODAY)).toEqual({
      text: 'Trial over · keep it?',
      tone: 'danger',
    });
    expect(countdown(sub({ status: 'paused', resume_on: '2026-10-20' }), TODAY).text).toBe(
      'Resumes tomorrow',
    );
    expect(countdown(sub({ status: 'paused' }), TODAY).text).toBe('Paused');
    expect(countdown(sub({ status: 'cancelled', ends_on: '2026-10-28' }), TODAY).text).toBe(
      'Ends in 9 days',
    );
    expect(countdown(sub({ status: 'cancelled', ends_on: null }), TODAY).text).toBe('Ended');
    expect(countdown(sub({ status: 'archived' }), TODAY).text).toBe('Archived');
  });
});

describe('needsTrialDecision', () => {
  it('asks on the end date and after, not before', () => {
    expect(needsTrialDecision(sub({ status: 'trial', trial_ends_on: '2026-10-20' }), TODAY)).toBe(
      false,
    );
    expect(needsTrialDecision(sub({ status: 'trial', trial_ends_on: TODAY }), TODAY)).toBe(true);
    expect(needsTrialDecision(sub({ status: 'trial', trial_ends_on: '2026-10-01' }), TODAY)).toBe(
      true,
    );
    expect(needsTrialDecision(sub(), TODAY)).toBe(false);
  });
});

describe('notificationActionApplies', () => {
  const base = { trial_ends_on: null, ends_on: null, resume_on: null };

  it('Mark paid applies to an active subscription due within the reminder window', () => {
    expect(
      notificationActionApplies('pay', { ...base, status: 'active', next_due_date: '2026-10-21' }, '2026-10-19'),
    ).toBe(true);
    // Overdue still counts: it has not been paid.
    expect(
      notificationActionApplies('pay', { ...base, status: 'active', next_due_date: '2026-10-10' }, '2026-10-19'),
    ).toBe(true);
  });

  it('Mark paid on an old reminder after the cycle was paid does nothing', () => {
    // Paid from the same-day reminder: the due date has moved a month on.
    expect(
      notificationActionApplies('pay', { ...base, status: 'active', next_due_date: '2026-11-19' }, '2026-10-19'),
    ).toBe(false);
  });

  it('Mark paid does nothing for a cancelled, archived or trial subscription', () => {
    for (const status of ['cancelled', 'archived', 'trial'] as const) {
      expect(
        notificationActionApplies('pay', { ...base, status, next_due_date: '2026-10-20' }, '2026-10-19'),
      ).toBe(false);
    }
  });

  it('the trial buttons apply only while it is still a trial', () => {
    const trial = { ...base, status: 'trial' as const, next_due_date: '2026-10-20', trial_ends_on: '2026-10-20' };
    expect(notificationActionApplies('keep', trial, '2026-10-19')).toBe(true);
    expect(notificationActionApplies('cancelled', trial, '2026-10-19')).toBe(true);
    expect(notificationActionApplies('keep', { ...trial, status: 'active' }, '2026-10-19')).toBe(false);
  });
});

describe('staleActionMessage', () => {
  // What a reminder's button says when it no longer applies: what is true of
  // the subscription now, never "already paid" for something nobody paid.
  it('says a cycle paid already was paid', () => {
    expect(staleActionMessage('pay', sub({ next_due_date: '2026-11-19' }), TODAY)).toBe(
      'Already paid for this cycle',
    );
  });

  it('says a pause is a pause', () => {
    expect(
      staleActionMessage('pay', sub({ status: 'paused', resume_on: '2026-10-20' }), TODAY),
    ).toBe('Paused · resumes tomorrow, nothing to pay yet');
    expect(staleActionMessage('pay', sub({ status: 'paused', resume_on: null }), TODAY)).toBe(
      'Paused · nothing to pay',
    );
  });

  it('says a cancellation, an archive or a trial is what it is', () => {
    expect(
      staleActionMessage('pay', sub({ status: 'cancelled', ends_on: '2026-10-30' }), TODAY),
    ).toBe('Cancelled · nothing more to pay');
    expect(staleActionMessage('pay', sub({ status: 'cancelled', ends_on: null }), TODAY)).toBe(
      'Cancelled · nothing more to pay',
    );
    expect(staleActionMessage('pay', sub({ status: 'archived' }), TODAY)).toBe(
      'Archived · nothing to pay',
    );
    expect(
      staleActionMessage('pay', sub({ status: 'trial', trial_ends_on: '2026-10-25' }), TODAY),
    ).toBe('Still a trial · nothing to pay yet');
  });

  it('says a trial decision was already made', () => {
    expect(staleActionMessage('keep', sub(), TODAY)).toBe('Already decided');
    expect(staleActionMessage('cancelled', sub({ status: 'cancelled' }), TODAY)).toBe(
      'Already decided',
    );
  });
});
