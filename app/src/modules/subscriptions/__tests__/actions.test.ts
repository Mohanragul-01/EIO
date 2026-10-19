/**
 * What each action writes: mark paid, pause, resume, cancel, archive,
 * restore, and the two trial decisions - and the snapshot that undoes any of
 * them.
 *
 * These are the state machine behind every button, so they are pure and
 * tested; api.ts only sends what they return.
 */
import {
  archivePatch,
  cancelPatch,
  endTrialPatch,
  keepTrialPatch,
  markPaidPatch,
  pausePatch,
  restorePatch,
  resumePatch,
  snapshot,
} from '../actions';
import type { Subscription } from '../types';

const TODAY = '2026-10-19';

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
    billing_cycle: 'monthly',
    next_due_date: '2026-10-19',
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

describe('markPaidPatch', () => {
  it('moves the due date on by one cycle from the OLD due date', () => {
    // Paying late must not shift the billing day.
    expect(markPaidPatch(sub({ next_due_date: '2026-10-10' }), {}, TODAY)).toEqual({
      next_due_date: '2026-11-10',
    });
  });

  it('follows N-day cycles', () => {
    expect(
      markPaidPatch(sub({ cycle_unit: 'day', cycle_count: 28, next_due_date: '2026-10-19' }), {}, TODAY),
    ).toEqual({ next_due_date: '2026-11-16' });
  });

  it('archives a one-time charge, which does not recur', () => {
    expect(markPaidPatch(sub({ cycle_unit: 'once' }), {}, TODAY)).toEqual({ status: 'archived' });
  });

  it('records a confirmed new price, and a new rate with its date', () => {
    expect(markPaidPatch(sub(), { newAmountMinor: 79900 }, TODAY)).toMatchObject({
      amount_minor: 79900,
    });
    expect(
      markPaidPatch(sub({ currency: 'USD', amount_minor: 2000, fx_rate: 86 }), { newRate: 87.12 }, TODAY),
    ).toMatchObject({ fx_rate: 87.12, fx_rate_on: TODAY });
  });

  it('turns a paid trial into an active subscription', () => {
    expect(
      markPaidPatch(sub({ status: 'trial', trial_ends_on: '2026-10-19' }), {}, TODAY),
    ).toEqual({ next_due_date: '2026-11-19', status: 'active' });
  });

  it('settles a pause whose resume date has come', () => {
    expect(
      markPaidPatch(sub({ status: 'paused', resume_on: '2026-10-19' }), {}, TODAY),
    ).toEqual({ next_due_date: '2026-11-19', status: 'active', resume_on: null });
  });
});

describe('pause and resume', () => {
  it('moves the next charge to the resume date', () => {
    expect(pausePatch(sub({ next_due_date: '2026-10-25' }), '2026-12-01')).toEqual({
      status: 'paused',
      resume_on: '2026-12-01',
      next_due_date: '2026-12-01',
    });
  });

  it('keeps a later due date, and pauses open-ended without one', () => {
    expect(pausePatch(sub({ next_due_date: '2026-12-25' }), '2026-12-01')).toEqual({
      status: 'paused',
      resume_on: '2026-12-01',
      next_due_date: '2026-12-25',
    });
    expect(pausePatch(sub(), null)).toEqual({ status: 'paused', resume_on: null });
  });

  it('resumes from today when the due date has passed', () => {
    expect(resumePatch(sub({ status: 'paused', next_due_date: '2026-09-01' }), TODAY)).toEqual({
      status: 'active',
      resume_on: null,
      next_due_date: TODAY,
    });
    expect(resumePatch(sub({ status: 'paused', next_due_date: '2026-11-01' }), TODAY)).toEqual({
      status: 'active',
      resume_on: null,
      next_due_date: '2026-11-01',
    });
  });
});

describe('cancel, archive, restore', () => {
  it('keeps access until the chosen day', () => {
    expect(cancelPatch('2026-10-30')).toEqual({ status: 'cancelled', ends_on: '2026-10-30' });
  });

  it('archives without touching anything else', () => {
    expect(archivePatch()).toEqual({ status: 'archived' });
  });

  it('restores to active, clearing the end and resume dates', () => {
    expect(restorePatch(sub({ status: 'archived', next_due_date: '2026-05-01' }), TODAY)).toEqual({
      status: 'active',
      ends_on: null,
      resume_on: null,
      next_due_date: TODAY,
    });
  });
});

describe('trial decisions', () => {
  it('keeps a trial as active, with its first charge on the end date', () => {
    expect(keepTrialPatch(sub({ status: 'trial', trial_ends_on: '2026-10-19', next_due_date: '2026-10-19' }))).toEqual({
      status: 'active',
      next_due_date: '2026-10-19',
    });
  });

  it('records "I cancelled" as access until the trial end', () => {
    expect(endTrialPatch(sub({ status: 'trial', trial_ends_on: '2026-10-19' }))).toEqual({
      status: 'cancelled',
      ends_on: '2026-10-19',
    });
  });
});

describe('snapshot (undo)', () => {
  it('captures every field an action can change', () => {
    const before = sub({
      status: 'paused',
      resume_on: '2026-11-01',
      ends_on: null,
      next_due_date: '2026-11-01',
      amount_minor: 100,
      fx_rate: null,
      fx_rate_on: null,
    });
    expect(snapshot(before)).toEqual({
      status: 'paused',
      resume_on: '2026-11-01',
      ends_on: null,
      next_due_date: '2026-11-01',
      amount_minor: 100,
      fx_rate: null,
      fx_rate_on: null,
    });
  });

  it('restores the row exactly when applied after any action', () => {
    const before = sub({ next_due_date: '2026-10-10' });
    const after = { ...before, ...markPaidPatch(before, { newAmountMinor: 99 }, TODAY) };
    expect({ ...after, ...snapshot(before) }).toEqual(before);
  });
});
