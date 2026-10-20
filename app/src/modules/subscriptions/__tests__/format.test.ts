/**
 * The words both clients use for prices and reminders, written once.
 */
import { offsetsLabel, priceParts, stripDayLabel, timeLabel } from '../format';
import type { Subscription } from '../types';
import type { Charge } from '../upcoming';

describe('timeLabel', () => {
  it('writes minutes after midnight as a 24-hour time', () => {
    expect(timeLabel(540)).toBe('09:00');
    expect(timeLabel(1290)).toBe('21:30');
    expect(timeLabel(0)).toBe('00:00');
  });
});

describe('offsetsLabel', () => {
  it('reads like a sentence, ending on the day', () => {
    expect(offsetsLabel([7, 3, 1, 0])).toBe('7 days, 3 days, 1 day before and on the day');
    expect(offsetsLabel([1, 0])).toBe('1 day before and on the day');
    expect(offsetsLabel([0])).toBe('On the day');
  });

  it('says Off for none', () => {
    expect(offsetsLabel([])).toBe('Off');
  });
});

describe('priceParts', () => {
  it('shows rupees on their own', () => {
    expect(priceParts({ amount_minor: 64900, currency: 'INR', fx_rate: null })).toEqual({
      main: '₹649',
      converted: null,
    });
  });

  it('shows a foreign price with its rupee value, or says the rate is missing', () => {
    expect(priceParts({ amount_minor: 2000, currency: 'USD', fx_rate: 86.5 })).toEqual({
      main: '$20',
      converted: '≈ ₹1,730',
    });
    expect(priceParts({ amount_minor: 2000, currency: 'USD', fx_rate: null })).toEqual({
      main: '$20',
      converted: 'No rate set',
    });
  });
});

describe('stripDayLabel (what TalkBack reads for a day on the strip)', () => {
  const charge = (kind: Charge['kind'], inrMinor = 64900): Charge => ({
    sub: {} as Subscription,
    date: '2026-10-19',
    inrMinor,
    kind,
  });
  const monday = new Date(2026, 9, 19).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  it('says today, and that nothing is due', () => {
    expect(stripDayLabel({ iso: '2026-10-19', charges: [], totalMinor: 0 }, true)).toBe(
      `Today, ${monday}, nothing due`,
    );
  });

  it('counts renewals with what leaves that day', () => {
    const day = {
      iso: '2026-10-19',
      charges: [charge('charge'), charge('charge')],
      totalMinor: 129800,
    };
    expect(stripDayLabel(day, false)).toBe(`${monday}, 2 renewals, ₹1,298`);
  });

  it('calls a trial ending a trial ending, not a renewal', () => {
    const trialOnly = { iso: '2026-10-19', charges: [charge('trial_end')], totalMinor: 0 };
    expect(stripDayLabel(trialOnly, false)).toBe(`${monday}, 1 trial ends`);

    const both = {
      iso: '2026-10-19',
      charges: [charge('charge'), charge('trial_end'), charge('trial_end')],
      totalMinor: 64900,
    };
    expect(stripDayLabel(both, false)).toBe(`${monday}, 1 renewal, ₹649, 2 trials end`);
  });
});
