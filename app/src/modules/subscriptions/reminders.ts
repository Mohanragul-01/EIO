/**
 * reminders.ts - which reminders a subscription gets, when, and what they say.
 *
 * Pure: it takes `now` and returns a plan, and touches no notification
 * library. notifications.ts turns the plan into scheduled notifications. The
 * split exists because the failures that matter - a reminder on the wrong day,
 * or none at all - never throw, so only a test of the plan catches them.
 *
 * THE RULES
 *  - Every chosen offset whose moment is still ahead is scheduled, and the
 *    morning-of is ALWAYS added. v2 had one reminder three days ahead and
 *    dropped it once that moment had passed, so the subscription closest to
 *    renewing got nothing. Now the floor is "on the day", whatever else passed.
 *  - A subscription can use the defaults, its own offsets, or none ([]).
 *  - A trial gets 3 days, 1 day and the morning of its end, whatever the
 *    defaults: a trial converting silently is the most expensive miss.
 *  - Nothing for what will not charge: cancelled, archived, paused with no
 *    resume date, overdue.
 */
import { formatMoney } from '../../core/money';
import { fromISODate, toISODate } from '../../core/date';
import { cycleOf, cycleSuffix } from './cycles';
import { formatAmount, inrOf } from './currency';
import { effectiveState, trialEndsOn } from './lifecycle';
import type { ReminderSettings, Subscription } from './types';

/** Three days and one day ahead, at nine - v2's three-day reminder, plus the fix. */
export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = { offsets: [3, 1], minutes: 540 };

/** What the settings offer as chips. Same day is always on, so not a choice. */
export const OFFSET_CHOICES = [14, 7, 3, 1] as const;

const TRIAL_OFFSETS = [3, 1, 0];

/** Android category ids: no ':' or '-' allowed (expo-notifications). */
export const RENEWAL_CATEGORY = 'subscription_renewal';
export const TRIAL_CATEGORY = 'subscription_trial';

/**
 * The subscription's notification id prefix. Derived from the row id rather
 * than stored, so cancelling never needs a lookup: every reminder for a
 * subscription starts with this, and one prefix cancels them all.
 *
 * The bare id itself is what v2 scheduled (one reminder per subscription);
 * cancelling still clears it on phones that have one.
 */
export function reminderId(subscriptionId: string): string {
  return `subscription-renewal-${subscriptionId}`;
}

/** The prefix every scheduled subscription reminder starts with. */
export const REMINDER_PREFIX = 'subscription-renewal-';

/** Where a tap, or an action button, should take you. */
export type RouteTarget = { route: string; params: Record<string, string> };

export type PlannedReminder = {
  id: string;
  date: Date;
  title: string;
  body: string;
  offset: number;
  kind: 'renewal' | 'trial';
  categoryId: string;
  data: {
    subscriptionId: string;
    route: string;
    params: Record<string, string>;
    actions: Record<string, RouteTarget>;
  };
};

export type ReminderContext = {
  /** The charged-to account's name, for the body. */
  accountName?: string | null;
};

/**
 * The offsets this subscription uses, most days-ahead first, with the
 * morning-of always included. [] when its reminders are off.
 */
export function effectiveOffsets(
  sub: Pick<Subscription, 'reminder_offsets'>,
  settings: ReminderSettings,
): number[] {
  const chosen = sub.reminder_offsets ?? settings.offsets;
  // An explicit empty override is "no reminders for this one". Empty
  // DEFAULTS are different: the morning-of still applies.
  if (sub.reminder_offsets && sub.reminder_offsets.length === 0) return [];
  const valid = chosen.filter((n) => Number.isInteger(n) && n >= 0 && n <= 60);
  return [...new Set([...valid, 0])].sort((a, b) => b - a);
}

/**
 * What an edit form stores for its reminder choice: null follows the
 * defaults, [] is Off, and Custom always carries the same day (0) - so a
 * Custom choice with no days ticked still reminds on the morning, rather than
 * being stored as [] and read back as Off.
 */
export function offsetsToSave(
  mode: 'default' | 'custom' | 'off',
  custom: readonly number[],
): number[] | null {
  if (mode === 'default') return null;
  if (mode === 'off') return [];
  return [...new Set([...custom, 0])].sort((a, b) => b - a);
}

/** Local wall-clock time `minutes` after midnight, `offset` days before `iso`. */
function fireAt(iso: string, offset: number, minutes: number): Date {
  const [y, m, d] = iso.split('-').map(Number);
  // Built from parts, so 09:00 stays 09:00 across a daylight-saving change.
  return new Date(y, m - 1, d - offset, Math.floor(minutes / 60), minutes % 60, 0, 0);
}

function when(offset: number): string {
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  return `in ${offset} days`;
}

/** "₹649", or "$20 (≈₹1,730)" for a foreign price with a rate. */
function priceText(sub: Subscription): string {
  if (sub.currency === 'INR') return formatMoney(sub.amount_minor, { compact: true });
  const own = formatAmount(sub.amount_minor, sub.currency, { compact: true });
  const inr = inrOf(sub);
  return inr === null ? own : `${own} (≈${formatMoney(inr, { compact: true })})`;
}

/**
 * The reminders to schedule for this subscription, soonest first. Moments
 * already past are left out, never moved: a reminder scheduled in the past
 * fires the instant it is saved.
 */
export function reminderPlan(
  sub: Subscription,
  settings: ReminderSettings,
  now: Date,
  context: ReminderContext = {},
): PlannedReminder[] {
  const today = toISODate(now);
  const state = effectiveState(sub, today);
  const detail = { route: 'SubscriptionDetail', params: { id: sub.id } };
  const to = (action: string): RouteTarget => ({
    route: 'SubscriptionDetail',
    params: { id: sub.id, action },
  });

  if (state === 'trial') {
    if (effectiveOffsets(sub, settings).length === 0) return [];
    const ends = trialEndsOn(sub);
    const then = `${priceText(sub)} ${cycleSuffix(cycleOf(sub))}`;
    return TRIAL_OFFSETS.map((offset) => ({
      id: `${reminderId(sub.id)}-t${offset}`,
      date: fireAt(ends, offset, settings.minutes),
      title: `${sub.name} trial ends ${when(offset)}`,
      body: `Then ${then}. Keep it, or cancel before it charges.`,
      offset,
      kind: 'trial' as const,
      categoryId: TRIAL_CATEGORY,
      data: {
        subscriptionId: sub.id,
        ...detail,
        actions: { keep: to('keep'), cancelled: to('cancelled') },
      },
    })).filter((r) => r.date.getTime() > now.getTime());
  }

  const resumes = state === 'paused' && !!sub.resume_on;
  if (state !== 'active' && !resumes) return [];

  // Pausing moves the due date to the resume date; if an older row has them
  // apart, the later of the two is when it actually charges.
  const due =
    resumes && sub.resume_on && sub.resume_on > sub.next_due_date ? sub.resume_on : sub.next_due_date;
  const verb = resumes ? 'resumes' : cycleOf(sub).unit === 'once' ? 'is due' : 'renews';
  const dueLabel = fromISODate(due).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const body = `Due ${dueLabel}${context.accountName ? ` · ${context.accountName}` : ''}`;

  return effectiveOffsets(sub, settings)
    .map((offset) => ({
      id: `${reminderId(sub.id)}-d${offset}`,
      date: fireAt(due, offset, settings.minutes),
      title: `${sub.name} ${verb} ${when(offset)} · ${priceText(sub)}`,
      body,
      offset,
      kind: 'renewal' as const,
      categoryId: RENEWAL_CATEGORY,
      data: { subscriptionId: sub.id, ...detail, actions: { mark_paid: to('pay') } },
    }))
    .filter((r) => r.date.getTime() > now.getTime());
}
