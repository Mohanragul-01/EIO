/**
 * format.ts - the words both clients use for prices and reminders.
 *
 * Written once here so the phone and the website say the same thing in the
 * same way; screens only lay them out.
 */
import { formatMoney } from '../../core/money';
import { formatAmount, inrOf } from './currency';

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
