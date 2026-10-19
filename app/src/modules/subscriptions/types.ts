/**
 * types.ts - shapes for the Subscriptions module, and the v2 cycle maths kept
 * for callers that still speak in the four old cycles.
 *
 * The rules themselves live beside this file, one concern each, so each can
 * be tested on its own and read by the website unchanged:
 *   cycles.ts     every N days / weeks / months / years, or once
 *   currency.ts   a subscription's own currency, converted at a hand-set rate
 *   lifecycle.ts  what a stored status means today
 *   reminders.ts  which reminders a subscription gets, and when
 *   upcoming.ts   the 14-day strip, the calendar, the list's sections
 *   insights.ts   what a week, month or year costs, and where it goes
 *   prices.ts     price history and the "went up" badge
 *   catalogue.ts  the quick-add services
 */
import { addInterval } from '../../core/date';

/** The v2 column. Still written (nearest value) because the v2 app reads it. */
export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

/**
 * What you chose. What it MEANS today is derived (see lifecycle.ts): a pause
 * past its resume date is active again, a cancellation past its access date
 * has ended. Nothing flips a stored value on the day.
 */
export type SubscriptionStatus = 'active' | 'trial' | 'paused' | 'cancelled' | 'archived';

export type CycleUnit = 'day' | 'week' | 'month' | 'year' | 'once';

/** Every `count` units. A one-time charge is `{ unit: 'once', count: 1 }`. */
export type Cycle = {
  unit: CycleUnit;
  count: number;
  /**
   * Month and year cycles: the day of the month it bills on (31 for "the last
   * day"). A due date clamped into a short month comes back to it after.
   */
  anchorDay?: number;
};

/** How it is billed - which also decides how you cancel it. */
export type ChargeChannel =
  'card' | 'upi_autopay' | 'google_play' | 'apple' | 'netbanking' | 'wallet' | 'manual';

export const CHARGE_CHANNELS: ChargeChannel[] = [
  'card',
  'upi_autopay',
  'google_play',
  'apple',
  'netbanking',
  'wallet',
  'manual',
];

export const CHANNEL_LABEL: Record<ChargeChannel, string> = {
  card: 'Card',
  upi_autopay: 'UPI AutoPay',
  google_play: 'Google Play',
  apple: 'Apple',
  netbanking: 'Net-banking mandate',
  wallet: 'Wallet',
  manual: 'Paid by hand',
};

/** A stored channel the app no longer lists still reads as something. */
export function channelLabel(channel: string | null): string | null {
  if (!channel) return null;
  return (CHANNEL_LABEL as Record<string, string>)[channel] ?? 'Other';
}

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  /** Per billing cycle, in `currency`'s minor units (paise for INR). */
  amount_minor: number;
  /** v2's cycle. Read through cycleOf(), which prefers cycle_unit/count. */
  billing_cycle: BillingCycle;
  /** 'YYYY-MM-DD'. For a trial, its end date: the first charge if you keep it. */
  next_due_date: string;
  /** v2's flag, kept in step for the v2 app: active or trial. */
  is_active: boolean;
  /** Ledger category this subscription's payments are logged under. */
  category: string;
  note: string;
  created_at: string;
  updated_at: string;

  status: SubscriptionStatus;
  trial_ends_on: string | null;
  /** Cancelled: the last day you still have access. */
  ends_on: string | null;
  /** Paused: the day it charges again, if known. */
  resume_on: string | null;
  cancel_url: string | null;
  cancel_notes: string;

  /** The catalogue entry it was added from, if any. */
  service_key: string | null;
  /** '#RRGGBB' brand colour for its tile. */
  color: string | null;

  /** The Finance account it is charged to. */
  account_id: string | null;
  charge_channel: string | null;

  /** Days-before for this one; null = my defaults, [] = no reminders. */
  reminder_offsets: number[] | null;

  /** Null on rows a v2 app wrote: cycleOf() falls back to billing_cycle. */
  cycle_unit: CycleUnit | null;
  cycle_count: number | null;
  /**
   * The day of the month it bills on, set from the date picked in the form.
   * Null on rows a v2 app wrote: the due date's own day is used.
   */
  anchor_day: number | null;

  /** ISO code. INR unless set. */
  currency: string;
  /** Rupees per one unit of `currency`, set by hand. */
  fx_rate: number | null;
  fx_rate_on: string | null;
};

/**
 * What a form saves. The two v2 columns (is_active, billing_cycle) are not in
 * here: api.ts derives them from status and the cycle on every write, so they
 * can never disagree with what the v3 app shows.
 */
export type SubscriptionInput = {
  name: string;
  amount_minor: number;
  next_due_date: string;
  category: string;
  note: string;
  status: SubscriptionStatus;
  trial_ends_on: string | null;
  ends_on: string | null;
  resume_on: string | null;
  cancel_url: string | null;
  cancel_notes: string;
  service_key: string | null;
  color: string | null;
  account_id: string | null;
  charge_channel: string | null;
  reminder_offsets: number[] | null;
  cycle_unit: CycleUnit;
  cycle_count: number;
  anchor_day: number | null;
  currency: string;
  fx_rate: number | null;
  fx_rate_on: string | null;
};

/** One price change: written on an edit, or a confirmed new price at Mark paid. */
export type PriceChange = {
  id: string;
  user_id: string;
  subscription_id: string;
  old_amount_minor: number;
  new_amount_minor: number;
  currency: string;
  effective_on: string;
  created_at: string;
};

/** The defaults every subscription's reminders use unless it has its own. */
export type ReminderSettings = {
  /** Days before the due date. The same-day reminder is always added. */
  offsets: number[];
  /** Minutes after midnight, local time. */
  minutes: number;
};

/** A Finance account (0008), read from this module's own api.ts. */
export type Account = {
  id: string;
  name: string;
  type: 'bank' | 'cash' | 'wallet' | 'credit_card';
  is_liability: boolean;
  is_active: boolean;
};

/** A ledger row logged against a subscription. Always INR. */
export type Payment = {
  id: string;
  subscription_id: string;
  amount_minor: number;
  date: string;
  account_id: string | null;
  /** The ledger category it was filed under. */
  category: string;
  note: string;
};

/* -------------------------------------------------------------------------- */
/* v2 cycle maths, kept because older callers and tests still use it.         */
/* New code reads cycles.ts.                                                  */
/* -------------------------------------------------------------------------- */

export const BILLING_CYCLES: BillingCycle[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

export const CYCLE_LABEL: Record<BillingCycle, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

/** Short suffix for a price line: "₹499 / mo". */
export const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  weekly: '/ wk',
  monthly: '/ mo',
  quarterly: '/ qtr',
  yearly: '/ yr',
};

/**
 * Convert any cycle to a MONTHLY equivalent, so a weekly ₹200 and a yearly
 * ₹4,800 can be compared and added together.
 *
 * The weekly figure uses 52/12 weeks per month (~4.345), not 4. Using 4 would
 * under-count a weekly subscription by about 8% - roughly a month's payment
 * missing from the annual picture, which is exactly the kind of quiet error
 * that makes a budgeting number untrustworthy.
 */
const MONTHLY_FACTOR: Record<BillingCycle, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  yearly: 1 / 12,
};

export function toMonthlyMinor(amountMinor: number, cycle: BillingCycle): number {
  // Round to whole paise - a third of a quarterly bill isn't an integer, and
  // leaving fractions here would reintroduce the float drift that storing
  // integers was meant to avoid.
  return Math.round(amountMinor * MONTHLY_FACTOR[cycle]);
}

/**
 * Roll a due date forward by one v2 billing cycle. New code uses
 * cycles.addCycle, which also knows N-day and one-time cycles.
 */
export function advanceDueDate(iso: string, cycle: BillingCycle): string {
  return addInterval(iso, cycle);
}
