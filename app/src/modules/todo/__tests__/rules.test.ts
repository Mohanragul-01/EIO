/**
 * The repeat rules beyond the three bugs: every N, weekdays, day N / nth
 * weekday / last day, repeat from completion, alignment for a new repeat, the
 * editor's preview, and the words a rule is shown in.
 *
 * 19 Oct 2026 is a Monday. The suite runs in New York, where the clocks change
 * on 8 Mar and 1 Nov 2026.
 */
import {
  alignOnOrAfter,
  describeRule,
  firstDueDate,
  isSchedulePoint,
  nextDueDate,
  ordinal,
  ruleOf,
  shortRule,
  stepOnce,
  toRule,
  upcomingDates,
  weekdayOf,
} from '../recurrence';

describe('every N', () => {
  it('daily every 3 days', () => {
    expect(stepOnce('2026-10-19', toRule({ frequency: 'daily', every: 3 }))).toBe('2026-10-22');
  });

  it('weekly every 2 weeks on the due date weekday', () => {
    expect(stepOnce('2026-10-19', toRule({ frequency: 'weekly', every: 2 }))).toBe('2026-11-02');
  });

  it('monthly every 3 months keeps the anchor', () => {
    const rule = toRule({ frequency: 'monthly', every: 3, anchorDay: 31 });
    expect(stepOnce('2026-01-31', rule)).toBe('2026-04-30');
    expect(stepOnce('2026-04-30', rule)).toBe('2026-07-31');
  });

  it('yearly every 2 years', () => {
    expect(stepOnce('2026-10-19', toRule({ frequency: 'yearly', every: 2 }))).toBe('2028-10-19');
  });

  it('treats an every below 1 as 1', () => {
    expect(toRule({ frequency: 'daily', every: 0 }).every).toBe(1);
  });
});

describe('weekly on chosen weekdays', () => {
  const monThu = toRule({ frequency: 'weekly', weekdays: [1, 4] });

  it('goes to the next listed day this week, then wraps to next week', () => {
    expect(stepOnce('2026-10-19', monThu)).toBe('2026-10-22'); // Mon -> Thu
    expect(stepOnce('2026-10-22', monThu)).toBe('2026-10-26'); // Thu -> Mon
  });

  it('every 2 weeks on Mon and Thu skips the week between', () => {
    const rule = toRule({ frequency: 'weekly', every: 2, weekdays: [4, 1] });
    expect(stepOnce('2026-10-19', rule)).toBe('2026-10-22');
    expect(stepOnce('2026-10-22', rule)).toBe('2026-11-02');
  });

  it('counts Sunday as the end of the week, not the start', () => {
    const sunMon = toRule({ frequency: 'weekly', weekdays: [0, 1] });
    expect(stepOnce('2026-10-19', sunMon)).toBe('2026-10-25'); // Mon -> Sun
    expect(stepOnce('2026-10-25', sunMon)).toBe('2026-10-26'); // Sun -> Mon
  });

  it('from an off-schedule date returns to the schedule rather than moving it', () => {
    // A Monday/Thursday task rescheduled by hand to Wednesday.
    expect(stepOnce('2026-10-21', monThu)).toBe('2026-10-22');
    // A Monday task rescheduled to Saturday comes back on Monday.
    expect(stepOnce('2026-10-24', toRule({ frequency: 'weekly', weekdays: [1] }))).toBe(
      '2026-10-26',
    );
  });

  it('rolls an overdue twice-weekly task to the first listed day after today', () => {
    expect(
      nextDueDate('2026-10-01', { frequency: 'weekly', weekdays: [1, 4] }, { today: '2026-10-20' }),
    ).toBe('2026-10-22');
  });
});

describe('monthly', () => {
  it('on day N, clamped in short months and restored after', () => {
    const rule = toRule({ frequency: 'monthly', anchorDay: 30 });
    expect(stepOnce('2026-01-30', rule)).toBe('2026-02-28');
    expect(stepOnce('2026-02-28', rule)).toBe('2026-03-30');
  });

  it('the last day (anchor 31) is the last day of every month for a year', () => {
    const rule = toRule({ frequency: 'monthly', anchorDay: 31 });
    const dates: string[] = [];
    let date = '2026-01-31';
    for (let i = 0; i < 12; i++) {
      date = stepOnce(date, rule);
      dates.push(date);
    }
    expect(dates).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
      '2026-06-30',
      '2026-07-31',
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
      '2026-11-30',
      '2026-12-31',
      '2027-01-31',
    ]);
  });

  it('on the nth weekday', () => {
    // 2nd Saturday: 10 Oct, 14 Nov, 12 Dec 2026.
    const rule = toRule({ frequency: 'monthly', nth: 2, weekdays: [6] });
    expect(stepOnce('2026-10-10', rule)).toBe('2026-11-14');
    expect(stepOnce('2026-11-14', rule)).toBe('2026-12-12');
    // From earlier in a month, that month's one is next.
    expect(stepOnce('2026-10-01', rule)).toBe('2026-10-10');
  });

  it('on the last weekday of the month', () => {
    // Last Friday: 30 Oct, 27 Nov, 25 Dec 2026.
    const rule = toRule({ frequency: 'monthly', nth: -1, weekdays: [5] });
    expect(stepOnce('2026-10-30', rule)).toBe('2026-11-27');
    expect(stepOnce('2026-11-27', rule)).toBe('2026-12-25');
  });

  it('on the 1st Monday, every 2 months', () => {
    const rule = toRule({ frequency: 'monthly', every: 2, nth: 1, weekdays: [1] });
    expect(stepOnce('2026-10-05', rule)).toBe('2026-12-07');
  });

  it('rolls the year over', () => {
    expect(stepOnce('2026-12-15', toRule({ frequency: 'monthly', anchorDay: 15 }))).toBe(
      '2027-01-15',
    );
  });
});

describe('yearly', () => {
  it('keeps the month and the anchor day', () => {
    expect(stepOnce('2026-10-19', toRule({ frequency: 'yearly', anchorDay: 19 }))).toBe(
      '2027-10-19',
    );
  });
});

describe('repeat from completion', () => {
  it('counts the interval from the day it was done, whether early or late', () => {
    const rule = { frequency: 'daily' as const, every: 3, from: 'completion' as const };
    const on = { today: '2026-10-19', completedOn: '2026-10-19' };
    expect(nextDueDate('2026-10-10', rule, on)).toBe('2026-10-22');
    expect(nextDueDate('2026-10-25', rule, on)).toBe('2026-10-22');
  });

  it('uses today when no completion day is given', () => {
    const rule = { frequency: 'weekly' as const, from: 'completion' as const };
    expect(nextDueDate('2026-10-01', rule, { today: '2026-10-19' })).toBe('2026-10-26');
  });

  it('clamps a month from the completion day', () => {
    const rule = { frequency: 'monthly' as const, from: 'completion' as const };
    expect(nextDueDate(null, rule, { today: '2026-01-31' })).toBe('2026-02-28');
  });
});

describe('a repeat with no due date', () => {
  it('counts from today', () => {
    expect(nextDueDate(null, 'daily', { today: '2026-10-19' })).toBe('2026-10-20');
    expect(
      nextDueDate(null, { frequency: 'weekly', weekdays: [5] }, { today: '2026-10-19' }),
    ).toBe('2026-10-23');
  });
});

describe('every step is strictly later', () => {
  it('for every kind of rule and awkward starting dates', () => {
    const rules = [
      toRule('daily'),
      toRule('weekly'),
      toRule({ frequency: 'weekly', weekdays: [0, 3, 6] }),
      toRule({ frequency: 'monthly', anchorDay: 31 }),
      toRule({ frequency: 'monthly', nth: -1, weekdays: [0] }),
      toRule({ frequency: 'monthly', nth: 4, weekdays: [2] }),
      toRule({ frequency: 'yearly', anchorDay: 29 }),
    ];
    const starts = ['2026-01-31', '2026-02-28', '2024-02-29', '2026-03-08', '2026-11-01', '2026-12-31'];
    for (const rule of rules) {
      for (const from of starts) {
        expect(stepOnce(from, rule) > from).toBe(true);
      }
    }
  });
});

describe('daylight saving', () => {
  it('steps across both changes without losing or repeating a day', () => {
    expect(stepOnce('2026-03-07', toRule('daily'))).toBe('2026-03-08');
    expect(stepOnce('2026-03-08', toRule('daily'))).toBe('2026-03-09');
    expect(stepOnce('2026-10-31', toRule('daily'))).toBe('2026-11-01');
    expect(stepOnce('2026-11-01', toRule('daily'))).toBe('2026-11-02');
    expect(stepOnce('2026-10-26', toRule('weekly'))).toBe('2026-11-02');
    expect(weekdayOf('2026-11-01')).toBe(0);
  });
});

describe('schedule points and alignment', () => {
  it('knows which dates are on a schedule', () => {
    const mondays = toRule({ frequency: 'weekly', weekdays: [1] });
    const lastDay = toRule({ frequency: 'monthly', anchorDay: 31 });
    const secondSat = toRule({ frequency: 'monthly', nth: 2, weekdays: [6] });
    expect(isSchedulePoint('2026-10-19', mondays)).toBe(true);
    expect(isSchedulePoint('2026-10-20', mondays)).toBe(false);
    expect(isSchedulePoint('2026-02-28', lastDay)).toBe(true);
    expect(isSchedulePoint('2026-03-28', lastDay)).toBe(false);
    expect(isSchedulePoint('2026-10-10', secondSat)).toBe(true);
    expect(isSchedulePoint('2026-10-17', secondSat)).toBe(false);
    expect(isSchedulePoint('2026-10-17', toRule('daily'))).toBe(true);
  });

  it('aligns to the date itself or the next date on the schedule', () => {
    const mondays = toRule({ frequency: 'weekly', weekdays: [1] });
    expect(alignOnOrAfter('2026-10-19', mondays)).toBe('2026-10-19');
    expect(alignOnOrAfter('2026-10-20', mondays)).toBe('2026-10-26');
    expect(alignOnOrAfter('2026-10-19', toRule({ frequency: 'monthly', anchorDay: 15 }))).toBe(
      '2026-11-15',
    );
  });

  it('gives a new repeat its first due date', () => {
    expect(firstDueDate({ frequency: 'weekly', weekdays: [5] }, '2026-10-19')).toBe('2026-10-23');
    expect(firstDueDate('daily', '2026-10-19')).toBe('2026-10-19');
    expect(firstDueDate({ frequency: 'daily', from: 'completion', every: 3 }, '2026-10-19')).toBe(
      '2026-10-19',
    );
  });
});

describe('upcomingDates', () => {
  it('lists the due date and the two after it', () => {
    expect(upcomingDates('2026-01-31', { frequency: 'monthly', anchorDay: 31 })).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ]);
  });

  it('assumes on-time completion for a from-completion rule', () => {
    expect(
      upcomingDates('2026-10-19', { frequency: 'daily', every: 3, from: 'completion' }),
    ).toEqual(['2026-10-19', '2026-10-22', '2026-10-25']);
  });
});

describe('ruleOf', () => {
  it('reads a row, defaulting the columns v2 rows lack', () => {
    expect(ruleOf({ frequency: 'weekly' })).toEqual({
      frequency: 'weekly',
      every: 1,
      weekdays: null,
      anchorDay: null,
      nth: null,
      from: 'due',
    });
    expect(
      ruleOf({
        frequency: 'monthly',
        repeat_every: 2,
        repeat_weekdays: [6],
        repeat_anchor_day: null,
        repeat_nth: 2,
        repeat_from: 'due',
      }),
    ).toEqual({ frequency: 'monthly', every: 2, weekdays: [6], anchorDay: null, nth: 2, from: 'due' });
  });

  it('treats an empty weekday list as none', () => {
    expect(ruleOf({ frequency: 'weekly', repeat_weekdays: [] }).weekdays).toBeNull();
  });
});

describe('words', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '31st',
    ]);
  });

  it('describes each kind of rule in a sentence', () => {
    expect(describeRule('daily')).toBe('Every day');
    expect(describeRule({ frequency: 'daily', every: 2 })).toBe('Every other day');
    expect(describeRule({ frequency: 'daily', every: 5 })).toBe('Every 5 days');
    expect(describeRule({ frequency: 'weekly', weekdays: [4, 1] })).toBe('Every week on Mon, Thu');
    expect(describeRule({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describeRule({ frequency: 'weekly', weekdays: [0, 6] })).toBe('Every weekend');
    expect(describeRule({ frequency: 'weekly', every: 2, weekdays: [1] })).toBe(
      'Every other week on Mon',
    );
    expect(describeRule('weekly')).toBe('Every week');
    expect(describeRule({ frequency: 'monthly', anchorDay: 15 })).toBe('Every month on the 15th');
    expect(describeRule({ frequency: 'monthly', anchorDay: 31 })).toBe(
      'Every month on the last day',
    );
    expect(describeRule({ frequency: 'monthly', every: 3, anchorDay: 1 })).toBe(
      'Every 3 months on the 1st',
    );
    expect(describeRule({ frequency: 'monthly', nth: 2, weekdays: [6] })).toBe(
      'Every month on the 2nd Saturday',
    );
    expect(describeRule({ frequency: 'monthly', nth: -1, weekdays: [5] })).toBe(
      'Every month on the last Friday',
    );
    expect(describeRule({ frequency: 'yearly', anchorDay: 19 }, '2026-10-19')).toBe(
      'Every year on 19 Oct',
    );
    expect(describeRule('yearly')).toBe('Every year');
    expect(describeRule({ frequency: 'daily', every: 3, from: 'completion' })).toBe(
      '3 days after each completion',
    );
    expect(describeRule({ frequency: 'weekly', from: 'completion' })).toBe(
      'A week after each completion',
    );
  });

  it('shortens a rule for a row', () => {
    expect(shortRule('daily')).toBe('Daily');
    expect(shortRule({ frequency: 'daily', every: 2 })).toBe('Every 2 days');
    expect(shortRule({ frequency: 'weekly', weekdays: [4, 1] })).toBe('Mon, Thu');
    expect(shortRule({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(shortRule({ frequency: 'weekly', every: 2, weekdays: [1] })).toBe('Mon, every 2 wks');
    expect(shortRule({ frequency: 'monthly', anchorDay: 15 })).toBe('Monthly, 15th');
    expect(shortRule({ frequency: 'monthly', anchorDay: 31 })).toBe('Monthly, last day');
    expect(shortRule({ frequency: 'monthly', nth: -1, weekdays: [5] })).toBe('Monthly, last Fri');
    expect(shortRule('yearly')).toBe('Yearly');
    expect(shortRule({ frequency: 'daily', every: 3, from: 'completion' })).toBe(
      '3 days after done',
    );
    expect(shortRule({ frequency: 'daily', from: 'completion' })).toBe('A day after done');
  });
});
