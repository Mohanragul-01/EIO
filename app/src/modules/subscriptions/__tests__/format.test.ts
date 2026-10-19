/**
 * The words both clients use for prices and reminders, written once.
 */
import { offsetsLabel, priceParts, timeLabel } from '../format';

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
