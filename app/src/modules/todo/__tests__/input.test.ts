/**
 * normalizeInput: every repeat is written with a complete rule, so a moved
 * occurrence comes back to its schedule and every repeat has a date to roll
 * forward from. 19 Oct 2026 is a Monday.
 */
import { normalizeInput, resetChecklist, type Saved } from '../input';
import { nextDueDate, ruleOf, type TodoInput } from '../types';

const TODAY = '2026-10-19';

function input(overrides: Partial<TodoInput>): TodoInput {
  return {
    title: '  Water the plants  ',
    due_date: '2026-10-21',
    priority: 'normal',
    frequency: 'daily',
    is_repeat: true,
    ...overrides,
  };
}

describe('normalizeInput', () => {
  it('trims the title of any task, and leaves a one-off rule alone', () => {
    const result = normalizeInput(input({ is_repeat: false, repeat_weekdays: [1] }), TODAY);
    expect(result.title).toBe('Water the plants');
    expect(result.repeat_weekdays).toEqual([1]);
  });

  it('weekly: takes the due date weekday when none is chosen, and sorts chosen ones', () => {
    expect(normalizeInput(input({ frequency: 'weekly' }), TODAY).repeat_weekdays).toEqual([3]);
    expect(
      normalizeInput(input({ frequency: 'weekly', repeat_weekdays: [0, 4, 1, 4] }), TODAY)
        .repeat_weekdays,
    ).toEqual([1, 4, 0]);
  });

  it('monthly by day: anchors on the due date day unless one is given', () => {
    const byDue = normalizeInput(input({ frequency: 'monthly', due_date: '2026-10-31' }), TODAY);
    expect(byDue.repeat_anchor_day).toBe(31);
    expect(byDue.repeat_weekdays).toBeNull();
    expect(
      normalizeInput(input({ frequency: 'monthly', repeat_anchor_day: 15 }), TODAY)
        .repeat_anchor_day,
    ).toBe(15);
  });

  it('monthly by weekday: keeps nth with one weekday and no anchor', () => {
    const result = normalizeInput(
      input({ frequency: 'monthly', due_date: '2026-10-10', repeat_nth: 2, repeat_anchor_day: 10 }),
      TODAY,
    );
    expect(result.repeat_nth).toBe(2);
    expect(result.repeat_weekdays).toEqual([6]);
    expect(result.repeat_anchor_day).toBeNull();
  });

  it('yearly: anchors on the due date day', () => {
    expect(
      normalizeInput(input({ frequency: 'yearly', due_date: '2024-02-29' }), TODAY)
        .repeat_anchor_day,
    ).toBe(29);
  });

  it('daily: carries no weekday, anchor or nth', () => {
    const result = normalizeInput(
      input({ repeat_weekdays: [1], repeat_anchor_day: 3, repeat_nth: 1 }),
      TODAY,
    );
    expect(result).toMatchObject({
      repeat_weekdays: null,
      repeat_anchor_day: null,
      repeat_nth: null,
    });
  });

  it('from completion: the interval alone', () => {
    const result = normalizeInput(
      input({ frequency: 'weekly', repeat_from: 'completion', repeat_weekdays: [1] }),
      TODAY,
    );
    expect(result).toMatchObject({ repeat_from: 'completion', repeat_weekdays: null });
  });

  it('gives a repeat with no due date the first date on its schedule', () => {
    expect(
      normalizeInput(input({ frequency: 'weekly', due_date: null, repeat_weekdays: [5] }), TODAY)
        .due_date,
    ).toBe('2026-10-23');
    expect(normalizeInput(input({ due_date: null }), TODAY).due_date).toBe(TODAY);
    expect(
      normalizeInput(input({ frequency: 'monthly', due_date: null, repeat_anchor_day: 1 }), TODAY)
        .due_date,
    ).toBe('2026-11-01');
  });

  it('keeps every at least 1', () => {
    expect(normalizeInput(input({ repeat_every: 0 }), TODAY).repeat_every).toBe(1);
    expect(normalizeInput(input({ repeat_every: 3 }), TODAY).repeat_every).toBe(3);
  });

  it('a new task is scheduled where its due date is', () => {
    expect(normalizeInput(input({}), TODAY).scheduled_for).toBe('2026-10-21');
  });
});

describe('normalizeInput, editing a saved task (found in review)', () => {
  // Monthly rent on the 1st, its 1 November pulled back to 28 October with
  // Reschedule: the date moved and the schedule stayed.
  const rent: Saved = {
    due_date: '2026-10-28',
    is_repeat: true,
    frequency: 'monthly',
    repeat_every: 1,
    repeat_weekdays: null,
    repeat_anchor_day: 1,
    repeat_nth: null,
    repeat_from: 'due',
  };
  const edit = (overrides: Partial<TodoInput>) =>
    input({
      frequency: 'monthly',
      due_date: '2026-10-28',
      repeat_every: 1,
      repeat_anchor_day: 1,
      repeat_from: 'due',
      ...overrides,
    });

  it('leaves the schedule alone when neither the date nor the rule changed', () => {
    // A note added in the editor must not turn 28 October into the schedule,
    // or ticking it brings another 1 November rent.
    const result = normalizeInput(edit({ notes: 'paid by UPI' }), TODAY, rent);
    expect('scheduled_for' in result).toBe(false);
  });

  it('puts the schedule at the new date when the date is changed', () => {
    expect(normalizeInput(edit({ due_date: '2026-10-30' }), TODAY, rent).scheduled_for).toBe(
      '2026-10-30',
    );
  });

  it('puts the schedule at the due date when the rule is changed', () => {
    expect(normalizeInput(edit({ repeat_every: 2 }), TODAY, rent).scheduled_for).toBe('2026-10-28');
    expect(normalizeInput(edit({ repeat_anchor_day: 28 }), TODAY, rent).scheduled_for).toBe(
      '2026-10-28',
    );
    expect(normalizeInput(edit({ is_repeat: false }), TODAY, rent).scheduled_for).toBe(
      '2026-10-28',
    );
  });

  it('yearly: the day follows a date changed in the editor, which has no day control', () => {
    // A birthday entered as 15 March, corrected to 20 April.
    const birthday: Saved = {
      ...rent,
      frequency: 'yearly',
      due_date: '2027-03-15',
      repeat_anchor_day: 15,
    };
    const result = normalizeInput(
      input({ frequency: 'yearly', due_date: '2027-04-20', repeat_anchor_day: 15 }),
      TODAY,
      birthday,
    );
    expect(result.repeat_anchor_day).toBe(20);
    expect(nextDueDate(result.scheduled_for ?? null, ruleOf(result), { today: TODAY })).toBe(
      '2028-04-20',
    );
  });

  it('yearly: a moved occurrence keeps its day when the date is not touched', () => {
    // 31 December moved to 2 January by Reschedule, then opened to add a note.
    const nye: Saved = {
      ...rent,
      frequency: 'yearly',
      due_date: '2027-01-02',
      repeat_anchor_day: 31,
    };
    const result = normalizeInput(
      input({ frequency: 'yearly', due_date: '2027-01-02', repeat_anchor_day: 31, notes: 'x' }),
      TODAY,
      nye,
    );
    expect(result.repeat_anchor_day).toBe(31);
    expect('scheduled_for' in result).toBe(false);
  });
});

describe('resetChecklist', () => {
  it('keeps the items and unticks every one', () => {
    expect(
      resetChecklist([
        { id: 'a', text: 'One', done: true },
        { id: 'b', text: 'Two', done: false },
      ]),
    ).toEqual([
      { id: 'a', text: 'One', done: false },
      { id: 'b', text: 'Two', done: false },
    ]);
  });
});
