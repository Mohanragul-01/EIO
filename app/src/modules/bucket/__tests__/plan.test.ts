/**
 * Planning a Now item: when, and how the money gets there.
 *
 * Two promises worth pinning. A target says only as much as you decided -
 * "2027" is not "1 Jan 2027" - and passing it is a neutral fact with a way
 * forward, never an "overdue". And the money sentence does the arithmetic you
 * would otherwise do on a calculator: "₹38,000 to go · ₹3,200 a month reaches
 * it by Oct 2027", worked out in either direction.
 */
import {
  amountText,
  choiceOf,
  describeSavings,
  formatTarget,
  isTargetPassed,
  monthsUntil,
  moveOptions,
  roundUpToHundred,
  savingsAdvice,
  targetEnd,
  targetFor,
} from '../plan';

const today = '2026-10-19';
const rupees = (n: number) => n * 100;

describe('targetFor', () => {
  it('stores Someday as no target at all', () => {
    expect(targetFor({ kind: 'someday' })).toEqual({ target_on: null, target_precision: null });
  });

  it('stores each precision as what was decided', () => {
    expect(targetFor({ kind: 'year', year: 2027 })).toEqual({
      target_on: '2027-01-01',
      target_precision: 'year',
    });
    expect(targetFor({ kind: 'month', year: 2027, month: 3 })).toEqual({
      target_on: '2027-03-01',
      target_precision: 'month',
    });
    expect(targetFor({ kind: 'day', iso: '2027-03-14' })).toEqual({
      target_on: '2027-03-14',
      target_precision: 'day',
    });
  });

  it('round-trips through choiceOf', () => {
    expect(choiceOf('2027-03-01', 'month')).toEqual({ kind: 'month', year: 2027, month: 3 });
    expect(choiceOf('2027-01-01', 'year')).toEqual({ kind: 'year', year: 2027 });
    expect(choiceOf('2027-03-14', 'day')).toEqual({ kind: 'day', iso: '2027-03-14' });
    expect(choiceOf(null, null)).toEqual({ kind: 'someday' });
  });
});

describe('formatTarget', () => {
  it('says what was decided, and no more', () => {
    expect(formatTarget('2026-01-01', 'year', today)).toBe('This year');
    expect(formatTarget('2027-01-01', 'year', today)).toBe('2027');
    expect(formatTarget('2027-03-01', 'month', today)).toBe('Mar 2027');
    expect(formatTarget('2027-03-14', 'day', today)).toBe('14 Mar 2027');
  });
});

describe('targetEnd and isTargetPassed', () => {
  it('runs a year target to the end of December', () => {
    expect(targetEnd('2026-01-01', 'year')).toBe('2026-12-31');
    expect(isTargetPassed('2026-01-01', 'year', '2026-12-31')).toBe(false);
    expect(isTargetPassed('2026-01-01', 'year', '2027-01-01')).toBe(true);
  });

  it('runs a month target to its last day, leap years included', () => {
    expect(targetEnd('2028-02-01', 'month')).toBe('2028-02-29');
    expect(isTargetPassed('2026-10-01', 'month', today)).toBe(false);
    expect(isTargetPassed('2026-09-01', 'month', today)).toBe(true);
  });

  it('passes a day target the day after', () => {
    expect(isTargetPassed('2026-10-19', 'day', today)).toBe(false);
    expect(isTargetPassed('2026-10-18', 'day', today)).toBe(true);
  });

  it('never calls Someday passed', () => {
    expect(isTargetPassed(null, null, today)).toBe(false);
  });
});

describe('moveOptions', () => {
  it('offers next month, next year and Someday - never a scolding', () => {
    expect(moveOptions('2026-12-19')).toEqual([
      { label: 'Next month', target: { target_on: '2027-01-01', target_precision: 'month' } },
      { label: 'Next year', target: { target_on: '2027-01-01', target_precision: 'year' } },
      { label: 'Someday', target: { target_on: null, target_precision: null } },
    ]);
  });
});

describe('monthsUntil', () => {
  it('counts calendar months from this one to the target month', () => {
    expect(monthsUntil(today, '2027-10-01', 'month')).toBe(12);
    expect(monthsUntil(today, '2027-01-01', 'year')).toBe(14); // to December 2027
    expect(monthsUntil(today, '2026-10-30', 'day')).toBe(0);
  });
});

describe('roundUpToHundred', () => {
  it('rounds up to whole hundreds of rupees, so the plan never falls short', () => {
    expect(roundUpToHundred(rupees(3166.67))).toBe(rupees(3200));
    expect(roundUpToHundred(rupees(3000))).toBe(rupees(3000));
    expect(roundUpToHundred(1)).toBe(rupees(100));
  });
});

describe('savingsAdvice', () => {
  const base = {
    estMinor: rupees(50_000),
    savedMinor: rupees(12_000),
    targetOn: null,
    targetPrecision: null,
    monthlyMinor: null,
    today,
  };

  it("works out the month's amount from a target - the spec's own example", () => {
    const advice = savingsAdvice({ ...base, targetOn: '2027-10-01', targetPrecision: 'month' });
    expect(advice).toEqual({
      kind: 'by-target',
      toGoMinor: rupees(38_000),
      monthlyMinor: rupees(3_200),
      reach: 'Oct 2027',
    });
    expect(describeSavings(advice)).toBe('₹38,000 to go · ₹3,200 a month reaches it by Oct 2027');
  });

  it('works out the month it is reached from an amount, the other way round', () => {
    const advice = savingsAdvice({ ...base, monthlyMinor: rupees(3_200) });
    expect(advice).toEqual({
      kind: 'by-monthly',
      toGoMinor: rupees(38_000),
      monthlyMinor: rupees(3_200),
      reach: 'Oct 2027',
    });
    expect(describeSavings(advice)).toBe('₹38,000 to go · ₹3,200 a month reaches it by Oct 2027');
  });

  it('saves to the end of December for a year target', () => {
    const advice = savingsAdvice({ ...base, targetOn: '2027-01-01', targetPrecision: 'year' });
    // 38,000 over the 14 months to Dec 2027 is 2,714.29 - rounded up.
    expect(advice).toMatchObject({ kind: 'by-target', monthlyMinor: rupees(2_800), reach: 'Dec 2027' });
  });

  it('prefers the target over a typed amount, since the target is what you saved', () => {
    const advice = savingsAdvice({
      ...base,
      targetOn: '2027-10-01',
      targetPrecision: 'month',
      monthlyMinor: rupees(10_000),
    });
    expect(advice.kind).toBe('by-target');
  });

  it('says only what is left when the target is this month', () => {
    const advice = savingsAdvice({ ...base, targetOn: '2026-10-01', targetPrecision: 'month' });
    expect(advice).toEqual({ kind: 'too-close', toGoMinor: rupees(38_000), reach: 'Oct 2026' });
    expect(describeSavings(advice)).toBe('₹38,000 to go by Oct 2026');
  });

  it('does not plan towards a target that has passed', () => {
    const advice = savingsAdvice({ ...base, targetOn: '2026-09-01', targetPrecision: 'month' });
    expect(advice).toEqual({ kind: 'passed', toGoMinor: rupees(38_000) });
    expect(describeSavings(advice)).toBe('₹38,000 to go · target passed');
  });

  it('says what is left when there is neither a target nor an amount', () => {
    const advice = savingsAdvice(base);
    expect(advice).toEqual({ kind: 'to-go', toGoMinor: rupees(38_000) });
    expect(describeSavings(advice)).toBe('₹38,000 to go');
  });

  it('says so when it is saved in full', () => {
    const advice = savingsAdvice({ ...base, savedMinor: rupees(60_000) });
    expect(advice).toEqual({ kind: 'saved' });
    expect(describeSavings(advice)).toBe('Saved in full');
  });

  it('says nothing without an estimate', () => {
    expect(savingsAdvice({ ...base, estMinor: null })).toEqual({ kind: 'none' });
    expect(savingsAdvice({ ...base, estMinor: 0 })).toEqual({ kind: 'none' });
    expect(describeSavings({ kind: 'none' })).toBe('');
  });

  it('groups lakhs the Indian way', () => {
    const advice = savingsAdvice({ ...base, estMinor: rupees(2_00_000), savedMinor: rupees(50_000) });
    expect(describeSavings(advice)).toBe('₹1,50,000 to go');
  });
});

describe('amountText', () => {
  it('prefills whole rupees without paise, and keeps paise when there are some', () => {
    // "38000.00" in an edit field reads as a different, fussier number.
    expect(amountText(rupees(38_000))).toBe('38000');
    expect(amountText(rupees(1299.5))).toBe('1299.50');
    expect(amountText(null)).toBe('');
    expect(amountText(0)).toBe('');
  });
});
