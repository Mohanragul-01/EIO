/**
 * The quick-add grammar. Every rule the parser has is named here, because a
 * misread is silent: a task filed on the wrong day looks exactly like one
 * filed on the right day until you miss it.
 *
 * Today is Monday 19 Oct 2026, 10:00, unless a test says otherwise. Dates are
 * DAY FIRST: 19/10 is 19 October.
 */
import { parseQuickAdd, toTodoInput, type QuickAddContext } from '../quickAdd';

const CTX: QuickAddContext = {
  today: '2026-10-19',
  nowMinutes: 10 * 60,
  defaultFrequency: 'daily',
  defaultDueDate: null,
};

const parse = (text: string, overrides: Partial<QuickAddContext> = {}) =>
  parseQuickAdd(text, { ...CTX, ...overrides });

const dateOf = (text: string, overrides: Partial<QuickAddContext> = {}) =>
  parse(text, overrides).dueDate;

describe('plain text', () => {
  it('is all title, with nothing recognised', () => {
    const result = parse('Buy 2 apples and some bread');
    expect(result).toMatchObject({
      title: 'Buy 2 apples and some bread',
      dueDate: null,
      dueTime: null,
      priority: null,
      repeat: null,
      frequency: 'daily',
      tokens: [],
    });
  });

  it('takes the context default date and frequency', () => {
    const result = parse('Tidy desk', { defaultDueDate: '2026-10-19', defaultFrequency: 'weekly' });
    expect(result.dueDate).toBe('2026-10-19');
    expect(result.frequency).toBe('weekly');
  });

  it('collapses whitespace and trims leftover punctuation', () => {
    expect(parse('  Call   mum ,  tomorrow ').title).toBe('Call mum');
    expect(parse('Pay rent - fri').title).toBe('Pay rent');
  });
});

describe('relative dates', () => {
  it('today, tomorrow and its short forms, the day after tomorrow', () => {
    expect(dateOf('x today')).toBe('2026-10-19');
    expect(dateOf('x tomorrow')).toBe('2026-10-20');
    expect(dateOf('x tmrw')).toBe('2026-10-20');
    expect(dateOf('x tmr')).toBe('2026-10-20');
    expect(dateOf('x day after tomorrow')).toBe('2026-10-21');
  });

  it('a weekday is the nearest on or after today', () => {
    expect(dateOf('x fri')).toBe('2026-10-23');
    expect(dateOf('x friday')).toBe('2026-10-23');
    expect(dateOf('x this fri')).toBe('2026-10-23');
    expect(dateOf('x mon')).toBe('2026-10-19'); // today is Monday
    expect(dateOf('x sun')).toBe('2026-10-25');
    expect(dateOf('x tues')).toBe('2026-10-20');
    expect(dateOf('x thurs')).toBe('2026-10-22');
    expect(dateOf('x weds')).toBe('2026-10-21');
  });

  it('next <weekday> is that day of next calendar week', () => {
    expect(dateOf('x next fri')).toBe('2026-10-30');
    expect(dateOf('x next mon')).toBe('2026-10-26');
    // From a Saturday, next week is still the one starting Monday.
    expect(dateOf('x next mon', { today: '2026-10-24' })).toBe('2026-10-26');
  });

  it('next week, next month, the weekend', () => {
    expect(dateOf('x next week')).toBe('2026-10-26');
    expect(dateOf('x next month')).toBe('2026-11-01');
    expect(dateOf('x next month', { today: '2026-12-10' })).toBe('2027-01-01');
    expect(dateOf('x weekend')).toBe('2026-10-24');
    expect(dateOf('x this weekend')).toBe('2026-10-24');
    expect(dateOf('x weekend', { today: '2026-10-25' })).toBe('2026-10-25');
  });

  it('in N days, weeks, months, years', () => {
    expect(dateOf('x in 3 days')).toBe('2026-10-22');
    expect(dateOf('x in a week')).toBe('2026-10-26');
    expect(dateOf('x in 2 weeks')).toBe('2026-11-02');
    expect(dateOf('x in one month')).toBe('2026-11-19');
    expect(dateOf('x in 1 month', { today: '2026-01-31' })).toBe('2026-02-28');
    expect(dateOf('x in 2 years')).toBe('2028-10-19');
  });
});

describe('numeric dates are day first', () => {
  it('19/10 is 19 October, and 05/11 is 5 November', () => {
    expect(dateOf('x 19/10')).toBe('2026-10-19');
    expect(dateOf('x 05/11')).toBe('2026-11-05');
    expect(dateOf('x 5/11')).toBe('2026-11-05');
  });

  it('takes a two- or four-digit year', () => {
    expect(dateOf('x 19/10/2027')).toBe('2027-10-19');
    expect(dateOf('x 19-10-27')).toBe('2027-10-19');
    expect(dateOf('x 19.10.2027')).toBe('2027-10-19');
  });

  it('a day already past this year means next year', () => {
    expect(dateOf('x 18/10')).toBe('2027-10-18');
    expect(dateOf('x 1 jan')).toBe('2027-01-01');
  });

  it('reads ISO dates', () => {
    expect(dateOf('x 2026-12-25')).toBe('2026-12-25');
  });

  it('leaves impossible dates as words', () => {
    // 10/13 would be 13 October month-first; day first it is month 13.
    const result = parse('Read chapters 10/13');
    expect(result.dueDate).toBeNull();
    expect(result.title).toBe('Read chapters 10/13');
    expect(dateOf('x 31/04')).toBeNull();
    expect(dateOf('x 30/02/2027')).toBeNull();
  });

  it('a 29 February with no year waits for a leap year', () => {
    expect(dateOf('x 29/02')).toBe('2028-02-29');
    // Even when this year's has already passed.
    expect(dateOf('x 29/2', { today: '2028-03-10' })).toBe('2032-02-29');
  });

  it('reads a dash only with a year, so a range stays a range', () => {
    expect(parse('Read chapters 3-4').dueDate).toBeNull();
    expect(parse('Do 2-3 sets').title).toBe('Do 2-3 sets');
    expect(dateOf('x 19-10-2026')).toBe('2026-10-19');
  });

  it('does not read a dotted pair as a date without a year', () => {
    const result = parse('Update to 1.10 soon');
    expect(result.dueDate).toBeNull();
    expect(result.title).toBe('Update to 1.10 soon');
  });
});

describe('month names', () => {
  it('in either order, with or without a suffix, "of" or a year', () => {
    expect(dateOf('x 19 oct')).toBe('2026-10-19');
    expect(dateOf('x 19th october')).toBe('2026-10-19');
    expect(dateOf('x 1st of nov')).toBe('2026-11-01');
    expect(dateOf('x oct 25')).toBe('2026-10-25');
    expect(dateOf('x dec 3rd')).toBe('2026-12-03');
    expect(dateOf('x 5 may 2027')).toBe('2027-05-05');
    expect(dateOf('x march 3, 2027')).toBe('2027-03-03');
    expect(dateOf('x 3 sept')).toBe('2027-09-03');
  });

  it('does not take "may" without a day', () => {
    expect(parse('I may call').dueDate).toBeNull();
  });
});

describe('connectors', () => {
  it('on, by and due are taken with a date', () => {
    expect(parse('Submit report by fri')).toMatchObject({ title: 'Submit report', dueDate: '2026-10-23' });
    expect(parse('Meet on 25/10').title).toBe('Meet');
    expect(parse('Tax return due 31/12').title).toBe('Tax return');
  });

  it('at is taken with a time', () => {
    expect(parse('Call mum at 7pm').title).toBe('Call mum');
  });

  it('is left alone when nothing follows it', () => {
    expect(parse('Read a book on cooking').title).toBe('Read a book on cooking');
    expect(parse('Look at the atlas').title).toBe('Look at the atlas');
  });
});

describe('times', () => {
  it('12-hour with am/pm, with or without minutes and a space', () => {
    expect(parse('x tomorrow 7pm').dueTime).toBe('19:00:00');
    expect(parse('x tomorrow 7 pm').dueTime).toBe('19:00:00');
    expect(parse('x tomorrow 7:30am').dueTime).toBe('07:30:00');
    expect(parse('x tomorrow 7.30pm').dueTime).toBe('19:30:00');
    expect(parse('x tomorrow 12am').dueTime).toBe('00:00:00');
    expect(parse('x tomorrow 12pm').dueTime).toBe('12:00:00');
    expect(parse('x tomorrow noon').dueTime).toBe('12:00:00');
  });

  it('24-hour with a colon', () => {
    expect(parse('x tomorrow 19:00').dueTime).toBe('19:00:00');
    expect(parse('x tomorrow 07:30').dueTime).toBe('07:30:00');
    expect(parse('x tomorrow 0:15').dueTime).toBe('00:15:00');
  });

  it('a bare hour only after "at"', () => {
    expect(parse('Buy 7 apples').dueTime).toBeNull();
    expect(parse('x tomorrow at 9').dueTime).toBe('09:00:00');
    expect(parse('x tomorrow at 18').dueTime).toBe('18:00:00');
    expect(parse('x tomorrow at 7.45').dueTime).toBe('07:45:00');
  });

  it('rejects hours and minutes that do not exist', () => {
    expect(parse('x 13pm').dueTime).toBeNull();
    expect(parse('x 25:00').dueTime).toBeNull();
    expect(parse('x 7:75pm').dueTime).toBeNull();
  });

  it('a time with no date is today while it is still ahead, otherwise tomorrow', () => {
    expect(parse('x 7pm')).toMatchObject({ dueDate: '2026-10-19', dueTime: '19:00:00' });
    expect(parse('x 9am')).toMatchObject({ dueDate: '2026-10-20', dueTime: '09:00:00' });
  });

  it('an hour that could be either is the next one to come (TickTick)', () => {
    // At 10:00, "at 7" means this evening; at 06:00 it means this morning.
    expect(parse('x at 7')).toMatchObject({ dueDate: '2026-10-19', dueTime: '19:00:00' });
    expect(parse('x at 7', { nowMinutes: 6 * 60 })).toMatchObject({
      dueDate: '2026-10-19',
      dueTime: '07:00:00',
    });
    // At 21:00 both have passed: tomorrow morning.
    expect(parse('x at 7', { nowMinutes: 21 * 60 })).toMatchObject({
      dueDate: '2026-10-20',
      dueTime: '07:00:00',
    });
    expect(parse('x 7:30')).toMatchObject({ dueDate: '2026-10-19', dueTime: '19:30:00' });
    // On a later day, the morning.
    expect(parse('x fri at 7').dueTime).toBe('07:00:00');
    // "at 12" is noon.
    expect(parse('x at 12', { nowMinutes: 13 * 60 })).toMatchObject({
      dueDate: '2026-10-20',
      dueTime: '12:00:00',
    });
  });

  it('a typed "today" keeps its day even when the time has passed', () => {
    expect(parse('x today 9am')).toMatchObject({ dueDate: '2026-10-19', dueTime: '09:00:00' });
    expect(parse('x today at 7', { nowMinutes: 21 * 60 })).toMatchObject({
      dueDate: '2026-10-19',
      dueTime: '19:00:00',
    });
  });

  it('a passed time moves a task pre-filled with today to tomorrow', () => {
    expect(parse('x 9am', { defaultDueDate: '2026-10-19' }).dueDate).toBe('2026-10-20');
  });
});

describe('repeats', () => {
  it('daily, every day, everyday', () => {
    for (const text of ['x daily', 'x every day', 'x everyday']) {
      expect(parse(text).repeat).toMatchObject({ frequency: 'daily', every: 1, from: 'due' });
    }
  });

  it('every other and every N', () => {
    expect(parse('x every other day').repeat).toMatchObject({ frequency: 'daily', every: 2 });
    expect(parse('x every 3 days').repeat).toMatchObject({ frequency: 'daily', every: 3 });
    expect(parse('x every 2 weeks').repeat).toMatchObject({ frequency: 'weekly', every: 2 });
    expect(parse('x every 6 months').repeat).toMatchObject({ frequency: 'monthly', every: 6 });
    expect(parse('x every other year').repeat).toMatchObject({ frequency: 'yearly', every: 2 });
  });

  it('weekly, monthly, yearly, annually, every week/month/year', () => {
    expect(parse('x weekly').repeat?.frequency).toBe('weekly');
    expect(parse('x every week').repeat?.frequency).toBe('weekly');
    expect(parse('x monthly').repeat?.frequency).toBe('monthly');
    expect(parse('x every month').repeat?.frequency).toBe('monthly');
    expect(parse('x yearly').repeat?.frequency).toBe('yearly');
    expect(parse('x annually').repeat?.frequency).toBe('yearly');
  });

  it('on named weekdays, however they are joined', () => {
    expect(parse('x every mon').repeat).toMatchObject({ frequency: 'weekly', weekdays: [1] });
    expect(parse('x every mon, thu').repeat?.weekdays).toEqual([1, 4]);
    expect(parse('x every mon,thu').repeat?.weekdays).toEqual([1, 4]);
    expect(parse('x every mon and thu').repeat?.weekdays).toEqual([1, 4]);
    expect(parse('x every mon, wed and fri').repeat?.weekdays).toEqual([1, 3, 5]);
    expect(parse('x every tue & sat').repeat?.weekdays).toEqual([2, 6]);
  });

  it('weekdays and weekends', () => {
    expect(parse('x every weekday').repeat?.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(parse('x weekdays').repeat?.weekdays).toEqual([1, 2, 3, 4, 5]);
    expect(parse('x every weekend').repeat?.weekdays).toEqual([6, 0]);
  });

  it('monthly on a day, the nth weekday, the last weekday, the last day', () => {
    expect(parse('x every 15th').repeat).toMatchObject({ frequency: 'monthly', anchorDay: 15 });
    expect(parse('x every 1st').repeat).toMatchObject({ frequency: 'monthly', anchorDay: 1 });
    expect(parse('x every 2nd sat').repeat).toMatchObject({ frequency: 'monthly', nth: 2, weekdays: [6] });
    expect(parse('x every first monday').repeat).toMatchObject({ nth: 1, weekdays: [1] });
    expect(parse('x every last fri').repeat).toMatchObject({ nth: -1, weekdays: [5] });
    expect(parse('x every last day').repeat).toMatchObject({ frequency: 'monthly', anchorDay: 31 });
    expect(parse('x every 32nd').repeat).toBeNull();
    expect(parse('x every 0th').repeat).toBeNull();
  });

  it('from completion: every! and after', () => {
    expect(parse('Water plants every! 3 days').repeat).toMatchObject({
      frequency: 'daily',
      every: 3,
      from: 'completion',
    });
    expect(parse('x after 10 days').repeat).toMatchObject({ every: 10, from: 'completion' });
    expect(parse('x after 0 days').repeat).toBeNull();
    expect(parse('x every! week').repeat).toMatchObject({ frequency: 'weekly', from: 'completion' });
    expect(parse('x after two weeks').repeat).toMatchObject({ frequency: 'weekly', every: 2 });
    // "after" with no number is just a word.
    expect(parse('Nap after lunch').repeat).toBeNull();
  });

  it('chooses the tab, and the first date on the schedule when no date is typed', () => {
    const result = parse('Gym every mon, thu');
    expect(result.frequency).toBe('weekly');
    expect(result.dueDate).toBe('2026-10-19');
    expect(parse('x every fri').dueDate).toBe('2026-10-23');
    expect(parse('x every 1st').dueDate).toBe('2026-11-01');
  });

  it('a typed date starts the repeat there', () => {
    expect(parse('x every mon 2/11').dueDate).toBe('2026-11-02');
  });

  it('a daily repeat with a time already passed starts on the next day', () => {
    expect(parse('Pills every day at 8am')).toMatchObject({
      dueDate: '2026-10-20',
      dueTime: '08:00:00',
    });
  });

  it('a weekday repeat is not read as a date as well', () => {
    const result = parse('Gym every mon');
    expect(result.tokens.map((t) => t.kind)).toEqual(['repeat']);
    expect(result.title).toBe('Gym');
  });
});

describe('priority', () => {
  it('!high and its short forms, and p1-p3', () => {
    for (const text of ['x !high', 'x !h', 'x !1', 'x p1']) expect(parse(text).priority).toBe('high');
    for (const text of ['x !normal', 'x !medium', 'x !med', 'x !2', 'x p2']) {
      expect(parse(text).priority).toBe('normal');
    }
    for (const text of ['x !low', 'x !l', 'x !3', 'x p3']) expect(parse(text).priority).toBe('low');
  });

  it('only as its own word', () => {
    expect(parse('Fix p100 printer').priority).toBeNull();
    expect(parse('Wow!high').priority).toBeNull();
  });
});

describe('everything at once', () => {
  it('reads each kind and leaves the title', () => {
    const result = parse('Pay rent every 1st at 9am !high');
    expect(result).toMatchObject({
      title: 'Pay rent',
      dueDate: '2026-11-01',
      dueTime: '09:00:00',
      priority: 'high',
      frequency: 'monthly',
    });
    expect(result.tokens.map((t) => t.kind)).toEqual(['repeat', 'time', 'priority']);
  });

  it('the first of each kind wins; later ones stay in the title', () => {
    const result = parse('Call about sat plan fri');
    expect(result.dueDate).toBe('2026-10-24');
    expect(result.title).toBe('Call about plan fri');
  });

  it('records where each token is and what it was read as', () => {
    const result = parse('Call mum tomorrow at 7pm');
    expect(result.tokens).toEqual([
      { kind: 'date', start: 9, end: 17, text: 'tomorrow', label: 'Tue 20 Oct' },
      { kind: 'time', start: 18, end: 24, text: 'at 7pm', label: '7 pm' },
    ]);
  });

  it('keeps the original capitals in the title and in token text', () => {
    const result = parse('Call Mum TOMORROW');
    expect(result.title).toBe('Call Mum');
    expect(result.tokens[0].text).toBe('TOMORROW');
  });

  it('labels repeats and priority', () => {
    const result = parse('Gym every mon, thu !low');
    expect(result.tokens.map((t) => t.label)).toEqual(['Every week on Mon, Thu', 'Low priority']);
  });
});

describe('turning a token back into text', () => {
  it('ignores a tapped token by its text, including its connector', () => {
    const result = parse('Buy sun cream', { ignore: [] });
    expect(result.dueDate).toBe('2026-10-25');

    const kept = parse('Buy sun cream', { ignore: ['sun'] });
    expect(kept.dueDate).toBeNull();
    expect(kept.title).toBe('Buy sun cream');

    const at = parse('Meet at 7pm', { ignore: ['at 7pm'] });
    expect(at.dueTime).toBeNull();
    expect(at.title).toBe('Meet at 7pm');
  });

  it('lets a later token of the same kind take over', () => {
    const result = parse('Sun lounger delivery fri', { ignore: ['sun'] });
    expect(result.dueDate).toBe('2026-10-23');
    expect(result.title).toBe('Sun lounger delivery');
  });
});

describe('toTodoInput', () => {
  it('maps a parse onto the columns', () => {
    expect(toTodoInput(parse('Gym every mon, thu at 7am !high'))).toEqual({
      title: 'Gym',
      due_date: '2026-10-22',
      due_time: '07:00:00',
      priority: 'high',
      frequency: 'weekly',
      is_repeat: true,
      repeat_every: 1,
      repeat_weekdays: [1, 4],
      repeat_anchor_day: null,
      repeat_nth: null,
      repeat_from: 'due',
    });
  });

  it('defaults priority to normal and leaves a one-off unrepeated', () => {
    expect(toTodoInput(parse('Renew passport 19/11'))).toMatchObject({
      title: 'Renew passport',
      due_date: '2026-11-19',
      priority: 'normal',
      is_repeat: false,
    });
  });
});

describe('found in review', () => {
  it('needs a word boundary after every alternative, not only the last', () => {
    // "weekdaysfoo" is not "weekdays".
    expect(parse('weekdaysfoo bar').repeat).toBeNull();
    expect(parse('weekendsfoo bar').repeat).toBeNull();
    expect(parse('x tomorrowish').dueDate).toBeNull();
    expect(parse('p1x').priority).toBeNull();
  });

  it('refuses a repeat count the database would refuse (1-366)', () => {
    expect(parse('x every 400 days').repeat).toBeNull();
    expect(parse('x every 0 days').repeat).toBeNull();
    expect(parse('x every! 999 days').repeat).toBeNull();
    expect(parse('x every 366 days').repeat).toMatchObject({ every: 366 });
  });

  it("gives a repeat's ambiguous hour the morning reading, whenever it is typed", () => {
    // At noon, "at 9:30" would be 21:30 by the one-off rule - and every
    // occurrence of a daily standup would inherit it.
    expect(parse('Standup every weekday at 9:30')).toMatchObject({
      dueTime: '09:30:00',
      dueDate: '2026-10-20',
    });
    expect(parse('Gym every day at 6')).toMatchObject({ dueTime: '06:00:00', dueDate: '2026-10-20' });
    // Still ahead today: today.
    expect(parse('Gym every day at 6', { nowMinutes: 5 * 60 })).toMatchObject({
      dueTime: '06:00:00',
      dueDate: '2026-10-19',
    });
    // An explicit pm is kept.
    expect(parse('Gym every day at 6pm').dueTime).toBe('18:00:00');
  });
});
