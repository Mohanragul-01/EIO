/**
 * Use-by: the printed expiry, the period after opening, and what happens when
 * the pace you use something at outlasts it.
 *
 * Sunscreen and actives can expire before they run out, and a "Plenty left"
 * badge on an expired sunscreen is wrong in the way that matters. The dates
 * here are month arithmetic and day boundaries - the two places a date bug
 * hides - so both are pinned.
 */
import {
  addMonthsISO,
  conflictMessage,
  expiryConflict,
  formatExpiryInput,
  parseExpiry,
  usableLabel,
  usableUntil,
  usableState,
} from '../useBy';

describe('addMonthsISO', () => {
  it('moves by calendar months', () => {
    expect(addMonthsISO('2026-01-15', 6)).toBe('2026-07-15');
  });

  it('clamps to the end of a shorter month rather than spilling into the next', () => {
    expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsISO('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('crosses years', () => {
    expect(addMonthsISO('2026-11-10', 3)).toBe('2027-02-10');
    expect(addMonthsISO('2026-01-10', 24)).toBe('2028-01-10');
  });
});

describe('usableUntil', () => {
  const base = { opened_on: '2026-01-10', finished_on: null, expires_on: null, pao_months: null };

  it('has none when neither date is known', () => {
    expect(usableUntil(base)).toBeNull();
  });

  it('is the printed date alone, or opening plus the period after opening alone', () => {
    expect(usableUntil({ ...base, expires_on: '2027-03-31' })).toBe('2027-03-31');
    expect(usableUntil({ ...base, pao_months: 6 })).toBe('2026-07-10');
  });

  it('is the earlier of the two: opening can only bring the end forward', () => {
    expect(usableUntil({ ...base, expires_on: '2026-05-01', pao_months: 6 })).toBe('2026-05-01');
    expect(usableUntil({ ...base, expires_on: '2027-05-01', pao_months: 6 })).toBe('2026-07-10');
  });

  it('starts no PAO clock on a spare', () => {
    expect(usableUntil({ ...base, opened_on: null, pao_months: 6 })).toBeNull();
    expect(usableUntil({ ...base, opened_on: null, pao_months: 6, expires_on: '2027-01-31' })).toBe(
      '2027-01-31',
    );
  });

  it('stops mattering once finished', () => {
    expect(usableUntil({ ...base, finished_on: '2026-02-01', expires_on: '2026-03-01' })).toBeNull();
  });
});

describe('usableState', () => {
  const today = '2026-10-19';

  it('says nothing more than 30 days out', () => {
    expect(usableState('2026-11-19', today)).toBeNull();
  });

  it('warns from exactly 30 days before', () => {
    expect(usableState('2026-11-18', today)).toBe('soon');
  });

  it('is still usable on the use-by day itself', () => {
    expect(usableState('2026-10-19', today)).toBe('soon');
  });

  it('is expired from the day after', () => {
    expect(usableState('2026-10-18', today)).toBe('expired');
  });

  it('has no state without a date', () => {
    expect(usableState(null, today)).toBeNull();
  });
});

describe('usableLabel', () => {
  const today = '2026-10-19';

  it('names the day, and the year only when it is not this one', () => {
    expect(usableLabel('2026-11-03', today)).toBe('Use by 3 Nov');
    expect(usableLabel('2027-01-03', today)).toBe('Use by 3 Jan 2027');
  });

  it('says today and tomorrow in words', () => {
    expect(usableLabel('2026-10-19', today)).toBe('Use by today');
    expect(usableLabel('2026-10-20', today)).toBe('Use by tomorrow');
  });

  it('says expired once past', () => {
    expect(usableLabel('2026-10-18', today)).toBe('Expired 18 Oct');
  });
});

describe('expiryConflict', () => {
  const today = '2026-10-19';

  it('flags a pace that outlasts the use-by date', () => {
    // 140 days of supply, 90 days of shelf life.
    expect(expiryConflict(140, '2027-01-17', today)).toEqual({ lastsDays: 140, expiresInDays: 90 });
  });

  it('is quiet when it runs out first, or on the same day', () => {
    expect(expiryConflict(89, '2027-01-17', today)).toBeNull();
    expect(expiryConflict(90, '2027-01-17', today)).toBeNull();
  });

  it('is quiet without a projection or a use-by date', () => {
    expect(expiryConflict(null, '2027-01-17', today)).toBeNull();
    expect(expiryConflict(140, null, today)).toBeNull();
  });

  it('leaves an already-expired product to its expired chip', () => {
    expect(expiryConflict(140, '2026-10-18', today)).toBeNull();
  });

  it('reads as the spec words it', () => {
    expect(conflictMessage({ lastsDays: 140, expiresInDays: 90 })).toBe(
      'At your pace this lasts 140 days; it expires in 90.',
    );
    expect(conflictMessage({ lastsDays: 12, expiresInDays: 0 })).toBe(
      'At your pace this lasts 12 days; it expires today.',
    );
    expect(conflictMessage({ lastsDays: 2, expiresInDays: 1 })).toBe(
      'At your pace this lasts 2 days; it expires tomorrow.',
    );
  });
});

describe('parseExpiry', () => {
  it('reads an empty field as no date', () => {
    expect(parseExpiry('')).toEqual({ ok: true, value: null });
    expect(parseExpiry('   ')).toEqual({ ok: true, value: null });
  });

  it('reads month and year as the last day of that month, the way packs print it', () => {
    expect(parseExpiry('03/2027')).toEqual({ ok: true, value: '2027-03-31' });
    expect(parseExpiry('3/27')).toEqual({ ok: true, value: '2027-03-31' });
    expect(parseExpiry('02/2028')).toEqual({ ok: true, value: '2028-02-29' });
  });

  it('reads a full date day first', () => {
    expect(parseExpiry('15/03/2027')).toEqual({ ok: true, value: '2027-03-15' });
    expect(parseExpiry('5-3-27')).toEqual({ ok: true, value: '2027-03-05' });
    expect(parseExpiry('05.03.2027')).toEqual({ ok: true, value: '2027-03-05' });
    expect(parseExpiry('05 03 2027')).toEqual({ ok: true, value: '2027-03-05' });
  });

  it('accepts an ISO date', () => {
    expect(parseExpiry('2027-03-15')).toEqual({ ok: true, value: '2027-03-15' });
  });

  it('refuses what is not a date', () => {
    expect(parseExpiry('13/2027').ok).toBe(false);
    expect(parseExpiry('31/04/2027').ok).toBe(false);
    expect(parseExpiry('0/2027').ok).toBe(false);
    expect(parseExpiry('soon').ok).toBe(false);
    expect(parseExpiry('15/03/2027/1').ok).toBe(false);
  });
});

describe('formatExpiryInput', () => {
  it('writes a month-end back as month and year, so what was typed comes back', () => {
    expect(formatExpiryInput('2027-03-31')).toBe('03/2027');
    expect(formatExpiryInput('2028-02-29')).toBe('02/2028');
  });

  it('writes any other day in full, day first', () => {
    expect(formatExpiryInput('2027-03-15')).toBe('15/03/2027');
  });

  it('is empty for no date', () => {
    expect(formatExpiryInput(null)).toBe('');
  });
});
