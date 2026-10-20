/**
 * format.ts - the words both clients use for prices and reminders.
 *
 * Written once here so the phone and the website say the same thing in the
 * same way; screens only lay them out.
 */
import { fromISODate } from '../../core/date';
import { formatMoney } from '../../core/money';
import { formatAmount, inrOf } from './currency';
import type { StripDay } from './upcoming';

/** Minutes after midnight as "09:00". */
export function timeLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** [7, 3, 1, 0] as "7 days, 3 days, 1 day before and on the day". */
export function offsetsLabel(offsets: number[]): string {
  if (offsets.length === 0) return 'Off';
  const before = offsets
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
    .map((n) => `${n} ${n === 1 ? 'day' : 'days'}`);
  const onTheDay = offsets.includes(0);
  if (before.length === 0) return onTheDay ? 'On the day' : 'Off';
  return `${before.join(', ')} before${onTheDay ? ' and on the day' : ''}`;
}

/**
 * A price for a row or a hero: the amount in its own currency, and for a
 * foreign one its rupee value - or the fact that there is no rate yet, which
 * is why it is missing from the totals.
 */
export function priceParts(sub: {
  amount_minor: number;
  currency: string;
  fx_rate: number | null;
}): { main: string; converted: string | null } {
  const main = formatAmount(sub.amount_minor, sub.currency, { compact: true });
  if (sub.currency === 'INR') return { main, converted: null };
  const inr = inrOf(sub);
  return {
    main,
    converted: inr === null ? 'No rate set' : `≈ ${formatMoney(inr, { compact: true })}`,
  };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * A day on the 14-day strip, spoken: "Today, Monday 19 October, 1 renewal,
 * ₹649, 1 trial ends". A trial ending is not a renewal - it charges only if
 * you keep it - and the rupees are the renewals' alone.
 */
export function stripDayLabel(day: StripDay, isToday: boolean): string {
  const date = fromISODate(day.iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const renewals = day.charges.filter((c) => c.kind === 'charge').length;
  const trials = day.charges.filter((c) => c.kind === 'trial_end').length;
  const parts = [
    isToday ? 'Today' : null,
    date,
    renewals > 0 ? count(renewals, 'renewal', 'renewals') : null,
    day.totalMinor > 0 ? formatMoney(day.totalMinor, { compact: true }) : null,
    trials > 0 ? count(trials, 'trial ends', 'trials end') : null,
    renewals + trials === 0 ? 'nothing due' : null,
  ];
  return parts.filter(Boolean).join(', ');
}

/** "Fri 24 Oct", with the year only when it is not this one. */
export function shortDate(iso: string, today: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : 'numeric',
  });
}
