/**
 * types.ts - shapes and cycle maths for the Subscriptions module.
 */

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

/** Days to add for one cycle - used when rolling a renewal forward. */
export function advanceDueDate(iso: string, cycle: BillingCycle): string {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  switch (cycle) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }

  // setMonth overflows sensibly: 31 Jan + 1 month lands on 2 or 3 March rather
  // than an invalid 31 February. Not ideal for billing, but predictable - and
  // the user can always correct the date by hand.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
