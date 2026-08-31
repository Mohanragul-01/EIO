/**
 * Money is the highest-risk logic in the app: it is the only place where a
 * silent rounding error would corrupt data you rely on. These tests exist to
 * pin down the exact behaviour that motivated storing paise as integers.
 */
import { formatMoney, minorToAmountString, parseAmountToMinor, sumMinor } from '../money';

describe('parseAmountToMinor', () => {
  it('converts rupees to paise', () => {
    expect(parseAmountToMinor('250')).toBe(25000);
    expect(parseAmountToMinor('249.50')).toBe(24950);
    expect(parseAmountToMinor('0.05')).toBe(5);
  });

  it('accepts pasted amounts with symbols and separators', () => {
    expect(parseAmountToMinor('Rs 1,299.50'.replace('Rs ', '₹'))).toBe(129950);
    expect(parseAmountToMinor(' 1,00,000 ')).toBe(10000000);
  });

  it('rounds rather than truncating the float multiply', () => {
    // 12.29 * 100 is 1228.9999... in binary floating point. Math.floor here
    // would silently lose a paisa on perfectly valid input.
    expect(parseAmountToMinor('12.29')).toBe(1229);
    expect(parseAmountToMinor('8.07')).toBe(807);
  });

  it('returns null for anything unparseable, never 0', () => {
    // A transaction that silently saves as zero is far worse than one that
    // refuses to save, so the caller must be able to tell the difference.
    expect(parseAmountToMinor('')).toBeNull();
    expect(parseAmountToMinor('abc')).toBeNull();
    expect(parseAmountToMinor('12.345')).toBeNull(); // more than 2 decimals
    expect(parseAmountToMinor('-50')).toBeNull();
  });
});

describe('sumMinor', () => {
  it('adds without floating point drift', () => {
    // The whole reason for integer paise: as rupees, 1650.30 + 249.70 gives
    // 1900.0000000000002.
    expect(sumMinor([165030, 24970])).toBe(190000);
    expect(sumMinor([10, 20])).toBe(30);
    expect(sumMinor([])).toBe(0);
  });

  it('stays exact across many values', () => {
    const values = Array.from({ length: 1000 }, () => 10);
    expect(sumMinor(values)).toBe(10000);
  });
});

describe('formatMoney', () => {
  it('round-trips through the parser', () => {
    const minor = parseAmountToMinor('1299.50');
    expect(minor).not.toBeNull();
    expect(minorToAmountString(minor as number)).toBe('1299.50');
  });

  it('drops paise in compact mode only for whole amounts', () => {
    expect(formatMoney(25000, { compact: true })).not.toContain('.00');
    expect(formatMoney(24950, { compact: true })).toContain('.50');
  });
});
