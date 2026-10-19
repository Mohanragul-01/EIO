/**
 * The Today view's maths and the tile line. Built from calendar-day strings;
 * the suite runs in New York, so local-midnight instants are exercised in a
 * zone with daylight saving.
 */
import type { Todo } from '../types';
import {
  buildToday,
  compareForDay,
  daysBetween,
  dueLabel,
  formatTime,
  localDayOf,
  localDayStartISO,
  rescheduleTargets,
  summarizeOpen,
  tileLine,
} from '../today';

const TODAY = '2026-10-19'; // a Monday

let counter = 0;
function task(overrides: Partial<Todo>): Todo {
  counter += 1;
  return {
    id: `t${counter}`,
    user_id: 'u',
    title: `Task ${counter}`,
    due_date: TODAY,
    is_done: false,
    priority: 'normal',
    frequency: 'daily',
    is_repeat: false,
    position: 0,
    due_time: null,
    reminder_offset_min: null,
    repeat_every: 1,
    repeat_weekdays: null,
    repeat_anchor_day: null,
    repeat_nth: null,
    repeat_from: 'due',
    series_id: null,
    completed_at: null,
    outcome: null,
    notes: '',
    checklist: [],
    created_at: `2026-10-01T00:00:${String(counter).padStart(2, '0')}Z`,
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

describe('buildToday', () => {
  it('splits overdue, today and completed today, leaving out undated and future', () => {
    const late = task({ due_date: '2026-10-12' });
    const later = task({ due_date: '2026-10-15' });
    const now = task({});
    const future = task({ due_date: '2026-10-20' });
    const undated = task({ due_date: null });
    const done = task({ is_done: true, completed_at: '2026-10-19T09:00:00Z', outcome: 'done' });

    const sections = buildToday([later, now, future, undated, late], [done], TODAY);

    expect(sections.overdue.map((t) => t.id)).toEqual([late.id, later.id]);
    expect(sections.today.map((t) => t.id)).toEqual([now.id]);
    expect(sections.completed.map((t) => t.id)).toEqual([done.id]);
  });

  it('lists completed today most recent first', () => {
    const first = task({ is_done: true, completed_at: '2026-10-19T08:00:00Z' });
    const second = task({ is_done: true, completed_at: '2026-10-19T12:00:00Z' });
    expect(buildToday([], [first, second], TODAY).completed.map((t) => t.id)).toEqual([
      second.id,
      first.id,
    ]);
  });
});

describe('compareForDay', () => {
  it('orders timed tasks first by time, then priority, then position, then age', () => {
    const evening = task({ due_time: '19:00:00' });
    const morning = task({ due_time: '07:30:00' });
    const high = task({ priority: 'high', position: 5 });
    const lowFirst = task({ priority: 'low', position: 0 });
    const normalTwo = task({ position: 2 });
    const normalOne = task({ position: 1 });

    const sorted = [lowFirst, normalTwo, evening, high, normalOne, morning].sort(compareForDay);
    expect(sorted.map((t) => t.id)).toEqual([
      morning.id,
      evening.id,
      high.id,
      normalOne.id,
      normalTwo.id,
      lowFirst.id,
    ]);
  });
});

describe('summarizeOpen and tileLine', () => {
  it('counts overdue and due today', () => {
    const summary = summarizeOpen(
      [{ due_date: '2026-10-01' }, { due_date: TODAY }, { due_date: TODAY }, { due_date: null }, { due_date: '2026-11-01' }],
      TODAY,
    );
    expect(summary).toEqual({ open: 5, overdue: 1, dueToday: 2 });
  });

  it('speaks in Today terms', () => {
    expect(tileLine({ open: 0, overdue: 0, dueToday: 0 })).toBe('All clear');
    expect(tileLine({ open: 9, overdue: 2, dueToday: 5 })).toBe('2 overdue · 5 today');
    expect(tileLine({ open: 9, overdue: 2, dueToday: 0 })).toBe('2 overdue');
    expect(tileLine({ open: 9, overdue: 0, dueToday: 5 })).toBe('5 today');
    expect(tileLine({ open: 9, overdue: 0, dueToday: 0 })).toBe('9 open');
  });
});

describe('local days', () => {
  it('starts a day at local midnight, across the November change', () => {
    // New York is UTC-4 before 1 Nov 2026 and UTC-5 after.
    expect(localDayStartISO('2026-10-31')).toBe('2026-10-31T04:00:00.000Z');
    expect(localDayStartISO('2026-11-02')).toBe('2026-11-02T05:00:00.000Z');
  });

  it('reads an instant back as the local day', () => {
    expect(localDayOf('2026-10-20T03:00:00.000Z')).toBe('2026-10-19');
    expect(localDayOf('2026-10-20T05:00:00.000Z')).toBe('2026-10-20');
  });

  it('counts whole days between calendar days', () => {
    expect(daysBetween('2026-10-19', '2026-11-02')).toBe(14);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-19', '2026-10-12')).toBe(-7);
  });
});

describe('rescheduleTargets', () => {
  it('on a Monday: today, tomorrow, Saturday, next Monday', () => {
    expect(rescheduleTargets('2026-10-19').map((t) => t.date)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-24',
      '2026-10-26',
    ]);
  });

  it('once the weekend has started, this weekend is today', () => {
    expect(rescheduleTargets('2026-10-24')[2].date).toBe('2026-10-24');
    expect(rescheduleTargets('2026-10-25')[2].date).toBe('2026-10-25');
    // Sunday's "next week" is the very next day.
    expect(rescheduleTargets('2026-10-25')[3].date).toBe('2026-10-26');
  });
});

describe('labels', () => {
  it('formats times the way they are said', () => {
    expect(formatTime('19:00:00')).toBe('7 pm');
    expect(formatTime('07:30')).toBe('7:30 am');
    expect(formatTime('00:15:00')).toBe('12:15 am');
    expect(formatTime('12:00:00')).toBe('12 pm');
  });

  it('labels a due date relative to today', () => {
    expect(dueLabel(TODAY, null, TODAY)).toBe('Today');
    expect(dueLabel(TODAY, '19:00:00', TODAY)).toBe('Today, 7 pm');
    expect(dueLabel('2026-10-20', null, TODAY)).toBe('Tomorrow');
    expect(dueLabel('2026-10-18', null, TODAY)).toBe('Yesterday');
    expect(dueLabel('2026-10-12', null, TODAY)).toBe('7 days overdue');
    expect(dueLabel('2026-10-23', null, TODAY)).toBe('Fri');
    expect(dueLabel('2026-11-12', null, TODAY)).toBe('12 Nov');
    expect(dueLabel('2027-01-05', null, TODAY)).toBe('5 Jan 2027');
  });
});
