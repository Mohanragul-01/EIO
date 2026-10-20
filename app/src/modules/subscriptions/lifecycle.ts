/**
 * lifecycle.ts - what a subscription's stored status means on a given day.
 *
 * v2 had one flag, is_active, which could not say "cancelled, but paid up
 * until the 30th" - exactly when a renewal reminder must NOT fire - or "a
 * trial that charges on the 4th unless I cancel".
 *
 * The status is what you chose. What it means TODAY is derived here, because
 * nothing runs in the background to flip a stored value on the day: a pause
 * whose resume date has come is active again, a cancellation past its access
 * date has ended, a trial past its end is waiting for you to decide. Derived
 * state cannot go stale; stored derived state would.
 *
 * Every function takes `today` ('YYYY-MM-DD'), so tests need no clock.
 */
import type { Subscription, SubscriptionStatus } from './types';

export type EffectiveState =
  | 'active'
  | 'trial'
  /** The trial's end date has passed with no decision: keep it, or cancelled? */
  | 'trial_over'
  | 'paused'
  /** Cancelled, still within the access you paid for. */
  | 'ending'
  /** Cancelled and past its access date (or it never had one). */
  | 'ended'
  | 'archived';

type Lifecycle = Pick<
  Subscription,
  'status' | 'next_due_date' | 'trial_ends_on' | 'ends_on' | 'resume_on'
>;

/**
 * Whole calendar days from `from` to `to` (negative when `to` is earlier).
 * Computed in UTC from the date parts, so a daylight-saving change in between
 * cannot turn a day into 23 hours and round it away.
 */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** When a trial ends: its own date, or the due date for a row without one. */
export function trialEndsOn(sub: Pick<Subscription, 'trial_ends_on' | 'next_due_date'>): string {
  return sub.trial_ends_on ?? sub.next_due_date;
}

export function effectiveState(sub: Lifecycle, today: string): EffectiveState {
  switch (sub.status) {
    case 'active':
      return 'active';
    case 'trial':
      return trialEndsOn(sub) >= today ? 'trial' : 'trial_over';
    case 'paused':
      return sub.resume_on && sub.resume_on <= today ? 'active' : 'paused';
    case 'cancelled':
      return sub.ends_on && sub.ends_on >= today ? 'ending' : 'ended';
    case 'archived':
      return 'archived';
  }
}

/**
 * Whether it is part of "what this costs me". Active, and a cancellation
 * still within its paid access (the spec: it drops from totals after). Never
 * a trial - it costs nothing until it converts - and never a pause.
 *
 * Nor a trial cancelled before it converted: "I cancelled" keeps access
 * until the trial's end, but that access was free, so a cancellation ending
 * on or before the trial's end date was never paid for.
 */
export function countsInTotals(sub: Lifecycle, today: string): boolean {
  const state = effectiveState(sub, today);
  if (state === 'ending') {
    return !(sub.trial_ends_on && sub.ends_on && sub.ends_on <= sub.trial_ends_on);
  }
  return state === 'active';
}

/**
 * Whether its next_due_date is a charge that will actually happen: an active
 * subscription, or a pause that resumes on a known date (pausing moves the due
 * date to it). A cancellation will not renew even while you still have
 * access, and a trial's end is shown as its own kind of event, not a charge.
 */
export function projectsCharges(sub: Lifecycle, today: string): boolean {
  const state = effectiveState(sub, today);
  if (state === 'active') return true;
  return state === 'paused' && !!sub.resume_on;
}

/** v2's is_active, written alongside status so the v2 app stays sensible. */
export function isActiveFlag(status: SubscriptionStatus): boolean {
  return status === 'active' || status === 'trial';
}

/** A trial on or past its end date, so the Keep / I cancelled choice is due. */
export function needsTrialDecision(sub: Lifecycle, today: string): boolean {
  return sub.status === 'trial' && trialEndsOn(sub) <= today;
}

export type Bucket = 'overdue' | 'week' | 'month' | 'later' | 'trials' | 'paused' | 'archive';

export const BUCKET_ORDER: Bucket[] = ['overdue', 'week', 'month', 'later', 'trials', 'paused'];

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue',
  week: 'This week',
  month: 'This month',
  later: 'Later',
  trials: 'Trials',
  paused: 'Paused & ending',
  archive: 'Archived & ended',
};

/**
 * Which section of the list it sits in.
 *
 * "This week" is the next seven days (today + 6), whatever the weekday, so it
 * means the same thing on a Sunday as on a Monday. "This month" is the rest of
 * the calendar month; "Later" is after that.
 */
export function bucketOf(sub: Lifecycle, today: string): Bucket {
  const state = effectiveState(sub, today);
  if (state === 'trial' || state === 'trial_over') return 'trials';
  if (state === 'paused' || state === 'ending') return 'paused';
  if (state === 'ended' || state === 'archived') return 'archive';

  const days = daysBetween(today, sub.next_due_date);
  if (days < 0) return 'overdue';
  if (days <= 6) return 'week';
  if (sub.next_due_date.slice(0, 7) === today.slice(0, 7)) return 'month';
  return 'later';
}

export type Tone = 'danger' | 'warning' | 'info' | 'muted';

/** "in 5 days", "in 3 wks", "in 4 months": days up to 13, then coarser. */
function relative(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 13) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} wks`;
  return `in ${Math.round(days / (365.25 / 12))} months`;
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The countdown on a row, with a tone for its colour. The words carry the
 * meaning on their own - "2 days overdue", not a red dot - so colour is never
 * the only signal.
 */
export function countdown(sub: Lifecycle, today: string): { text: string; tone: Tone } {
  const state = effectiveState(sub, today);

  switch (state) {
    case 'trial': {
      const days = daysBetween(today, trialEndsOn(sub));
      return { text: `Trial ends ${relative(days)}`, tone: days <= 3 ? 'warning' : 'info' };
    }
    case 'trial_over':
      return { text: 'Trial over · keep it?', tone: 'danger' };
    case 'paused':
      return sub.resume_on
        ? { text: `Resumes ${relative(daysBetween(today, sub.resume_on))}`, tone: 'muted' }
        : { text: 'Paused', tone: 'muted' };
    case 'ending':
      return { text: `Ends ${relative(daysBetween(today, sub.ends_on as string))}`, tone: 'muted' };
    case 'ended':
      return { text: 'Ended', tone: 'muted' };
    case 'archived':
      return { text: 'Archived', tone: 'muted' };
    case 'active': {
      const days = daysBetween(today, sub.next_due_date);
      if (days < 0) {
        const late = -days;
        return { text: `${late} ${late === 1 ? 'day' : 'days'} overdue`, tone: 'danger' };
      }
      // "Today" and "Tomorrow" stand alone; "in 5 days" reads as a phrase.
      const text = days <= 1 ? capitalise(relative(days)) : relative(days);
      return { text, tone: days <= 7 ? 'warning' : 'muted' };
    }
  }
}

/** The furthest ahead a renewal reminder can fire (OFFSET_CHOICES' largest). */
const REMINDER_WINDOW_DAYS = 14;

/**
 * Whether a notification's button still makes sense today.
 *
 * Notifications already in the tray outlive the state they were sent for:
 * pay from the same-day reminder and the 1-day one is still there; tap its
 * Mark paid and, without this, the NEXT cycle would be paid too. A trial's
 * Keep on a subscription already kept would move its due date backwards. So
 * Mark paid applies only to a subscription that charges and is due within
 * the reminder window (overdue included), and the trial buttons only to a
 * trial.
 */
export function notificationActionApplies(
  action: 'pay' | 'keep' | 'cancelled',
  sub: Lifecycle,
  today: string,
): boolean {
  if (action === 'pay') {
    return (
      effectiveState(sub, today) === 'active' &&
      daysBetween(today, sub.next_due_date) <= REMINDER_WINDOW_DAYS
    );
  }
  return sub.status === 'trial';
}
