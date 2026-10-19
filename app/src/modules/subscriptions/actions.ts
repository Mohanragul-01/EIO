/**
 * actions.ts - what each button writes, as plain patches.
 *
 * Mark paid, pause, resume, cancel, archive, restore, and the two answers to
 * a trial that is ending. Each returns only the columns it changes, and
 * snapshot() captures every column any of them can change, so applying a
 * snapshot taken before an action is that action's Undo - one rule instead
 * of an undo per button.
 *
 * Pure, and tested: api.ts sends these and adds nothing of its own.
 */
import { addCycle, cycleOf } from './cycles';
import { effectiveState, trialEndsOn } from './lifecycle';
import type { Subscription, SubscriptionInput } from './types';

export type LifecyclePatch = Partial<
  Pick<
    SubscriptionInput,
    'status' | 'next_due_date' | 'ends_on' | 'resume_on' | 'amount_minor' | 'fx_rate' | 'fx_rate_on'
  >
>;

/** The later of two ISO dates. */
const later = (a: string, b: string) => (a > b ? a : b);

export type MarkPaidChoice = {
  /** A new price you confirmed, in the subscription's own currency. */
  newAmountMinor?: number | null;
  /** A new rate you confirmed (rupees per unit), for a foreign subscription. */
  newRate?: number | null;
};

/**
 * "I paid this one": the due date moves on by one cycle from the EXISTING due
 * date, never from today, so paying three days late does not shift the
 * billing day for good. A one-time charge has nothing to move on to, and goes
 * to the archive.
 */
export function markPaidPatch(
  sub: Subscription,
  choice: MarkPaidChoice,
  today: string,
): LifecyclePatch {
  const patch: LifecyclePatch = {};
  const next = addCycle(sub.next_due_date, cycleOf(sub));

  if (next === null) {
    patch.status = 'archived';
  } else {
    patch.next_due_date = next;
    // Paying a trial is keeping it; paying a pause that has come round is
    // resuming it. Either way it is simply active from here.
    if (sub.status === 'trial') patch.status = 'active';
    if (sub.status === 'paused' && effectiveState(sub, today) === 'active') {
      patch.status = 'active';
      patch.resume_on = null;
    }
  }

  if (choice.newAmountMinor && choice.newAmountMinor !== sub.amount_minor) {
    patch.amount_minor = choice.newAmountMinor;
  }
  if (choice.newRate && choice.newRate !== sub.fx_rate) {
    patch.fx_rate = choice.newRate;
    patch.fx_rate_on = today;
  }
  return patch;
}

/**
 * Pause, optionally until a date. With a date, that is when it next charges,
 * so the due date moves to it - unless it was already later.
 */
export function pausePatch(sub: Subscription, resumeOn: string | null): LifecyclePatch {
  if (!resumeOn) return { status: 'paused', resume_on: null };
  return {
    status: 'paused',
    resume_on: resumeOn,
    next_due_date: later(sub.next_due_date, resumeOn),
  };
}

/** Resume now. A due date that passed while paused becomes today. */
export function resumePatch(sub: Subscription, today: string): LifecyclePatch {
  return { status: 'active', resume_on: null, next_due_date: later(sub.next_due_date, today) };
}

/** Cancelled, with access until `endsOn` (it counts in totals until then). */
export function cancelPatch(endsOn: string): LifecyclePatch {
  return { status: 'cancelled', ends_on: endsOn };
}

export function archivePatch(): LifecyclePatch {
  return { status: 'archived' };
}

/** Back to active from the archive or a cancellation. */
export function restorePatch(sub: Subscription, today: string): LifecyclePatch {
  return {
    status: 'active',
    ends_on: null,
    resume_on: null,
    next_due_date: later(sub.next_due_date, today),
  };
}

/** Keep a trial: active, first charge on the day the trial ends. */
export function keepTrialPatch(sub: Subscription): LifecyclePatch {
  return { status: 'active', next_due_date: trialEndsOn(sub) };
}

/** "I cancelled" a trial: access until it ends, then it has ended. */
export function endTrialPatch(sub: Subscription): LifecyclePatch {
  return { status: 'cancelled', ends_on: trialEndsOn(sub) };
}

/** Every column any action above can change: applying it is the Undo. */
export function snapshot(sub: Subscription): Required<LifecyclePatch> {
  return {
    status: sub.status,
    next_due_date: sub.next_due_date,
    ends_on: sub.ends_on,
    resume_on: sub.resume_on,
    amount_minor: sub.amount_minor,
    fx_rate: sub.fx_rate,
    fx_rate_on: sub.fx_rate_on,
  };
}
