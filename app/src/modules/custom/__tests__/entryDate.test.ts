/**
 * Which day an entry belongs to, and the weeks and months built from days.
 *
 * Every v3 feature that looks at time - the chart, the calendar, the This
 * week chip, the tile period, "today already has an entry" - asks the same
 * question, so it is answered once. The suite runs in America/New_York, so
 * the week and month maths is exercised across a daylight-saving change.
 */
import {
  addDaysTo,
  dateFieldOf,
  entryDateOf,
  inPeriod,
  monthStartISO,
  periodBounds,
  weekStartISO,
} from '../entryDate';
import { makeField, makeRecord } from '../testing';

describe('entryDateOf', () => {
  const when = makeField({ key: 'when', type: 'date' });

  it('uses the date field when it holds a real day', () => {
    expect(entryDateOf(makeRecord({ when: '2026-03-02' }, [2026, 3, 9]), when)).toBe('2026-03-02');
  });

  it('falls back to the local day the entry was logged', () => {
    // Logged at 23:30 local: the local day, not the UTC one (which is the next).
    expect(entryDateOf(makeRecord({}, [2026, 3, 9, 23]), when)).toBe('2026-03-09');
    expect(entryDateOf(makeRecord({ when: 'soon' }, [2026, 3, 9]), when)).toBe('2026-03-09');
    expect(entryDateOf(makeRecord({ when: '2026-03-02' }, [2026, 3, 9]), null)).toBe('2026-03-09');
  });
});

describe('dateFieldOf', () => {
  it('is the first date field by position', () => {
    const fields = [
      makeField({ key: 'finished', type: 'date', position: 2 }),
      makeField({ key: 'title', type: 'text', position: 0 }),
      makeField({ key: 'started', type: 'date', position: 1 }),
    ];
    expect(dateFieldOf(fields)?.key).toBe('started');
    expect(dateFieldOf([makeField({ type: 'text' })])).toBeNull();
  });
});

describe('weeks and months', () => {
  it('starts a week on Monday', () => {
    expect(weekStartISO('2026-10-19')).toBe('2026-10-19'); // a Monday
    expect(weekStartISO('2026-10-25')).toBe('2026-10-19'); // the Sunday after
    expect(weekStartISO('2026-11-01')).toBe('2026-10-26'); // across the US DST change
  });

  it('starts a week across a month and a year', () => {
    expect(weekStartISO('2027-01-01')).toBe('2026-12-28');
  });

  it('starts a month on the 1st', () => {
    expect(monthStartISO('2026-02-17')).toBe('2026-02-01');
  });

  it('adds days by the calendar, not by 24 hours', () => {
    expect(addDaysTo('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDaysTo('2026-03-08', 1)).toBe('2026-03-09'); // the spring-forward day
    expect(addDaysTo('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('periods', () => {
  it('bounds a calendar week and a calendar month', () => {
    expect(periodBounds('week', '2026-10-21')).toEqual({ start: '2026-10-19', end: '2026-10-25' });
    expect(periodBounds('month', '2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodBounds('all', '2026-02-10')).toBeNull();
  });

  it('includes both ends', () => {
    expect(inPeriod('2026-10-19', 'week', '2026-10-21')).toBe(true);
    expect(inPeriod('2026-10-25', 'week', '2026-10-21')).toBe(true);
    expect(inPeriod('2026-10-18', 'week', '2026-10-21')).toBe(false);
    expect(inPeriod('1999-01-01', 'all', '2026-10-21')).toBe(true);
  });
});
