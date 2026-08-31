/**
 * types.ts - shapes and cycle maths for the Subscriptions module.
 */
import { addInterval } from '../../core/date';

export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export type Subscription = {
  id: string;
  user_id: string;
  name: string;
  /** Paise, per billing cycle (not per month). */
  amount_minor: number;
  billing_cycle: BillingCycle;
  /** 'YYYY-MM-DD'. */
  next_due_date: string;
  is_active: boolean;
  /** Ledger category this subscription's payments are logged under. */
  category: string;
  note: string;
  created_at: string;
  updated_at: string;
};

export type SubscriptionInput = {
  name: string;
  amount_minor: number;
  billing_cycle: BillingCycle;
  next_due_date: string;
  is_active: boolean;
  category: string;
  note: string;
};

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
 * Roll a due date forward by one billing cycle.
 *
 * The arithmetic moved to core/date.ts once Todo needed the same thing for
 * repeating tasks. This stays as a thin wrapper because BillingCycle is this
 * module's vocabulary, and core should not know what a billing cycle is.
 *
 * One behaviour change came with the move: month-end now clamps rather than
 * overflows. A bill due on the 31st used to advance to 2 or 3 March, skipping
 * February entirely; it now lands on the 28th.
 */
export function advanceDueDate(iso: string, cycle: BillingCycle): string {
  return addInterval(iso, cycle);
}
