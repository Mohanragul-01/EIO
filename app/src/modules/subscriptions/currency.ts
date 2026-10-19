/**
 * currency.ts - a subscription's own currency, converted at a rate set by hand.
 *
 * Finance stays INR: 0008 decided that, and its "no price feed" principle -
 * values updated by hand, each with the date it was set, so a stale number is
 * visible rather than quietly wrong - applies to exchange rates too. So a
 * dollar subscription keeps its dollar price, totals convert it with the rate
 * you set, and Mark paid always logs the rupees you were actually charged.
 *
 * Only currencies with two decimals are offered, because core/money parses
 * amounts to two decimals. A yen subscription can be entered in rupees.
 */
import { formatMoney } from '../../core/money';

export type CurrencyDef = { code: string; symbol: string; name: string };

export const CURRENCIES: CurrencyDef[] = [
  { code: 'INR', symbol: '₹', name: 'Indian rupee' },
  { code: 'USD', symbol: '$', name: 'US dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British pound' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar' },
];

/** A currency's display details; an unknown code still reads as itself. */
export function currencyDef(code: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? { code, symbol: code, name: code };
}

/**
 * An amount in rupees (paise), or null when it cannot honestly be converted.
 *
 * Both sides are two-decimal minor units, so cents x (rupees per dollar) is
 * paise directly. Null without a rate rather than a guess: a total that
 * counted $20 as ₹20 would be wrong by a factor of 86, and look plausible.
 */
export function toInrMinor(
  amountMinor: number,
  currency: string,
  fxRate: number | null,
): number | null {
  if (currency === 'INR') return amountMinor;
  if (fxRate === null || !(fxRate > 0)) return null;
  return Math.round(amountMinor * fxRate);
}

/** A row's price in paise, or null when it is foreign and has no rate. */
export function inrOf(sub: {
  amount_minor: number;
  currency: string;
  fx_rate: number | null;
}): number | null {
  return toInrMinor(sub.amount_minor, sub.currency, sub.fx_rate);
}

/**
 * The rate a payment actually used: rupees charged / foreign amount. Mark
 * paid offers it as the new rate, because the bank's figure (with its markup)
 * is the honest one. Four decimals, the column's precision.
 */
export function rateFromPayment(inrMinor: number, amountMinor: number): number | null {
  if (!(amountMinor > 0)) return null;
  return Math.round((inrMinor / amountMinor) * 10_000) / 10_000;
}

/** "₹1,50,000", "$20.00", "$20" (compact drops .00 only). */
export function formatAmount(
  amountMinor: number,
  currency: string,
  options?: { compact?: boolean },
): string {
  if (currency === 'INR') return formatMoney(amountMinor, options);

  const major = amountMinor / 100;
  const showCents = !options?.compact || major % 1 !== 0;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: showCents ? 2 : 0,
      maximumFractionDigits: showCents ? 2 : 0,
    }).format(major);
  } catch {
    // An unknown code makes Intl throw; the number is still worth showing.
    return `${currency} ${major.toFixed(showCents ? 2 : 0)}`;
  }
}

/** "₹87.12 per $". */
export function formatRate(rate: number, currency: string): string {
  const rupees = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
  return `${rupees} per ${currencyDef(currency).symbol}`;
}
