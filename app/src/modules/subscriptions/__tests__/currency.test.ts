/**
 * Per-subscription currency. ChatGPT, Claude, domains and cloud services bill
 * in dollars; typing a guessed rupee figure is wrong after every bank markup.
 * The amount stays in its own currency, totals convert at a rate set by hand,
 * and Mark paid logs the rupees actually charged.
 */
import {
  currencyDef,
  formatAmount,
  formatRate,
  rateFromPayment,
  toInrMinor,
} from '../currency';

describe('toInrMinor', () => {
  it('passes rupees through untouched', () => {
    expect(toInrMinor(64900, 'INR', null)).toBe(64900);
    // A stray rate on an INR row must not scale it.
    expect(toInrMinor(64900, 'INR', 2)).toBe(64900);
  });

  it('converts cents to paise at the rate', () => {
    // $20.00 at ₹86.50 = ₹1,730.00.
    expect(toInrMinor(2000, 'USD', 86.5)).toBe(173000);
  });

  it('rounds to whole paise', () => {
    // $9.99 at ₹86.4321 = ₹863.4566... -> 86346 paise.
    expect(toInrMinor(999, 'USD', 86.4321)).toBe(86346);
    expect(Number.isInteger(toInrMinor(333, 'EUR', 91.1111))).toBe(true);
  });

  it('refuses to guess without a rate', () => {
    // A total that silently counted $20 as ₹20 would be wrong by 86x.
    expect(toInrMinor(2000, 'USD', null)).toBeNull();
    expect(toInrMinor(2000, 'USD', 0)).toBeNull();
  });
});

describe('rateFromPayment', () => {
  it('works out the rate a payment actually used', () => {
    // Charged ₹1,742.40 for $20.00: the bank's rate with its markup.
    expect(rateFromPayment(174240, 2000)).toBe(87.12);
  });

  it('keeps four decimals, like the column', () => {
    expect(rateFromPayment(100000, 1100)).toBe(90.9091);
  });

  it('has no answer for a zero amount', () => {
    expect(rateFromPayment(174240, 0)).toBeNull();
  });
});

describe('formatting', () => {
  it('formats rupees with Indian grouping', () => {
    expect(formatAmount(15000000, 'INR', { compact: true })).toBe('₹1,50,000');
  });

  it('formats a foreign amount in its own currency', () => {
    expect(formatAmount(2000, 'USD')).toBe('$20.00');
    expect(formatAmount(2000, 'USD', { compact: true })).toBe('$20');
    expect(formatAmount(1999, 'USD', { compact: true })).toBe('$19.99');
  });

  it('states a rate per unit', () => {
    expect(formatRate(87.12, 'USD')).toBe('₹87.12 per $');
  });

  it('knows its currencies, and survives one it does not', () => {
    expect(currencyDef('EUR').symbol).toBe('€');
    expect(currencyDef('XYZ')).toEqual({ code: 'XYZ', symbol: 'XYZ', name: 'XYZ' });
  });
});
