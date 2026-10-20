/**
 * api.ts against an in-memory table.
 *
 * What matters about completing, skipping and reopening is which rows exist
 * afterwards, so these tests run the real functions over a fake that keeps
 * rows (see __fixtures__/fakeSupabase.ts) and then look at the table.
 *
 * "Today" is pinned to Monday 19 Oct 2026 with fake timers; only Date is
 * affected, since nothing here waits on a timer.
 */
import { createFakeSupabase, type FakeDatabase } from '../__fixtures__/fakeSupabase';
import * as api from '../api';
import type { Todo } from '../types';

let mockDb: FakeDatabase;

jest.mock('../../../core/supabase', () => ({
  get supabase() {
    return mockDb.client;
  },
}));
jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('user-1') }));
// Reminders are a side effect of writing; their own tests are in reminders.test.ts.
jest.mock('../notifications', () => ({
  syncReminders: jest.fn(() => Promise.resolve()),
  cancelReminders: jest.fn(() => Promise.resolve()),
  rebuildAll: jest.fn(() => Promise.resolve()),
  refreshDigestsSoon: jest.fn(),
}));
jest.mock('../../../core/notifications', () => ({ registerResync: jest.fn() }));

beforeEach(() => {
  mockDb = createFakeSupabase();
  jest.useFakeTimers({ now: new Date(2026, 9, 19, 12, 0, 0) });
});

afterEach(() => {
  jest.useRealTimers();
});

const reminders = jest.requireMock('../notifications') as {
  syncReminders: jest.Mock;
  cancelReminders: jest.Mock;
};

const openRows = () => mockDb.rows().filter((row) => !row.is_done);

async function repeatingTask(overrides: Partial<Parameters<typeof api.createTodo>[0]> = {}) {
  return api.createTodo({
    title: 'Water the plants',
    due_date: '2026-10-19',
    priority: 'normal',
    frequency: 'daily',
    is_repeat: true,
    ...overrides,
  });
}

describe('bug 3: reopening a completed repeat', () => {
  it('leaves exactly one open occurrence, the reopened one', async () => {
    const task = await repeatingTask();
    await api.completeTask(task);

    await api.reopenTask(task.id);

    // v2 flipped is_done back and left the successor it had created open
    // beside it: two copies of one routine.
    expect(openRows().map((row) => row.id)).toEqual([task.id]);
  });

  it('keeps a successor that was edited after it was created', async () => {
    // Deleting it would throw away whatever was changed on it. Two open rows
    // you can see beat one quietly lost edit.
    const task = await repeatingTask();
    const next = (await api.completeTask(task)) as Todo;
    await api.updateTodo(next.id, { title: 'Water the plants and the herbs' });

    await api.reopenTask(task.id);

    expect(
      openRows()
        .map((row) => row.id)
        .sort(),
    ).toEqual([next.id, task.id].sort());
  });

  it('reopening an old occurrence makes it the live one again', async () => {
    // A -> B -> C(open). Reopening A ("I didn't actually do that one") takes
    // away the untouched C, so the routine is open once, at A.
    const a = await repeatingTask({ due_date: '2026-10-17' });
    const b = (await api.completeTask(a)) as Todo;
    await api.completeTask(b);

    const { removed } = await api.reopenTask(a.id);

    expect(openRows().map((row) => row.id)).toEqual([a.id]);
    expect(removed).toHaveLength(1);
  });

  it('reopening a one-off task touches nothing else', async () => {
    const other = await repeatingTask({ title: 'Something else' });
    const once = await api.createTodo({
      title: 'Renew passport',
      due_date: null,
      priority: 'high',
      frequency: 'yearly',
      is_repeat: false,
    });
    await api.completeTask(once);

    const { removed } = await api.reopenTask(once.id);

    expect(removed).toEqual([]);
    expect(
      openRows()
        .map((row) => row.id)
        .sort(),
    ).toEqual([other.id, once.id].sort());
  });
});

describe('completeTask', () => {
  it('closes the row with an outcome and a completion time', async () => {
    const task = await repeatingTask({ is_repeat: false });
    await api.completeTask(task);

    const row = mockDb.rows().find((r) => r.id === task.id)!;
    expect(row.is_done).toBe(true);
    expect(row.outcome).toBe('done');
    expect(typeof row.completed_at).toBe('string');
  });

  it('creates the successor with the rule, the series and an unticked checklist', async () => {
    const task = await repeatingTask({
      frequency: 'weekly',
      due_date: '2026-10-19',
      repeat_weekdays: [1, 4],
      due_time: '07:30:00',
      reminder_offset_min: 15,
      priority: 'high',
      notes: 'Both balconies',
      checklist: [
        { id: 'a', text: 'Ferns', done: true },
        { id: 'b', text: 'Basil', done: false },
      ],
    });

    const next = (await api.completeTask(task)) as Todo;

    expect(next.due_date).toBe('2026-10-22'); // Mon -> Thu
    expect(next.series_id).toBe(task.id);
    expect(next.repeat_weekdays).toEqual([1, 4]);
    expect(next.due_time).toBe('07:30:00');
    expect(next.reminder_offset_min).toBe(15);
    expect(next.notes).toBe('Both balconies');
    expect(next.checklist.map((item) => item.done)).toEqual([false, false]);
    expect(next.priority).toBe('normal');
    expect(next.is_done).toBe(false);
  });

  it("keeps every occurrence in the first one's series", async () => {
    const a = await repeatingTask();
    const b = (await api.completeTask(a)) as Todo;
    const c = (await api.completeTask(b)) as Todo;
    expect(b.series_id).toBe(a.id);
    expect(c.series_id).toBe(a.id);
  });

  it('rolls a long-overdue repeat past today in one tick', async () => {
    const task = await repeatingTask({ due_date: '2026-09-28' });
    const next = (await api.completeTask(task)) as Todo;
    expect(next.due_date).toBe('2026-10-20');
  });

  it('reopens the task if the successor cannot be written', async () => {
    const task = await repeatingTask();
    mockDb.failNext('todos', 'insert');

    await expect(api.completeTask(task)).rejects.toThrow('network down');

    const rows = mockDb.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ is_done: false, outcome: null, completed_at: null });
  });
});

describe("skip and won't do", () => {
  it('skipping records a skip and still brings the next one round', async () => {
    const task = await repeatingTask();
    const next = (await api.skipTask(task)) as Todo;

    expect(mockDb.rows().find((r) => r.id === task.id)!.outcome).toBe('skipped');
    expect(next.due_date).toBe('2026-10-20');
  });

  it("won't do closes a one-off without a successor", async () => {
    const task = await repeatingTask({ is_repeat: false });
    await api.wontDoTask(task);

    expect(mockDb.rows()).toHaveLength(1);
    expect(mockDb.rows()[0]).toMatchObject({ is_done: true, outcome: 'wont_do' });
  });
});

describe('createTodo settles the rule', () => {
  it('gives a weekly repeat its weekday and a monthly one its anchor', async () => {
    const weekly = await repeatingTask({ frequency: 'weekly', due_date: '2026-10-21' });
    const monthly = await repeatingTask({ frequency: 'monthly', due_date: '2026-10-31' });
    expect(weekly.repeat_weekdays).toEqual([3]);
    expect(monthly.repeat_anchor_day).toBe(31);
  });

  it('gives a repeat with no date its first date on the schedule', async () => {
    const task = await repeatingTask({ frequency: 'weekly', due_date: null, repeat_weekdays: [5] });
    expect(task.due_date).toBe('2026-10-23');
  });
});

describe('rescheduleTasks', () => {
  it('moves every given task in one request', async () => {
    const a = await repeatingTask({ due_date: '2026-10-01' });
    const b = await repeatingTask({ title: 'Other', due_date: '2026-10-02' });
    const before = mockDb.calls.length;

    await api.rescheduleTasks([a.id, b.id], '2026-10-20');

    expect(mockDb.calls.length - before).toBe(1);
    expect(mockDb.rows().map((r) => r.due_date)).toEqual(['2026-10-20', '2026-10-20']);
  });
});

describe('completeById', () => {
  it('completes an open task once, and leaves a closed one alone', async () => {
    const task = await repeatingTask();
    await api.completeById(task.id);
    await api.completeById(task.id);

    expect(mockDb.rows()).toHaveLength(2);
    expect(openRows()).toHaveLength(1);
  });
});

describe('listToday', () => {
  it('returns open tasks due by today, what closed today, and the next task', async () => {
    const overdue = await repeatingTask({
      is_repeat: false,
      title: 'Late',
      due_date: '2026-10-10',
    });
    const today = await repeatingTask({ is_repeat: false, title: 'Now', due_date: '2026-10-19' });
    const later = await repeatingTask({ is_repeat: false, title: 'Later', due_date: '2026-10-25' });
    const done = await repeatingTask({ is_repeat: false, title: 'Done', due_date: '2026-10-19' });
    await api.createTodo({
      title: 'Undated',
      due_date: null,
      priority: 'normal',
      frequency: 'daily',
      is_repeat: false,
    });
    await api.completeTask(done);

    const result = await api.listToday('2026-10-19');

    expect(result.open.map((t) => t.id)).toEqual([overdue.id, today.id]);
    expect(result.closedToday.map((t) => t.id)).toEqual([done.id]);
    expect(result.next?.id).toBe(later.id);
  });
});

describe('reminders follow the writes', () => {
  it("completing a repeat cancels its reminder and schedules the successor's", async () => {
    const task = await repeatingTask({ due_time: '19:00:00', reminder_offset_min: 0 });
    reminders.syncReminders.mockClear();
    reminders.cancelReminders.mockClear();

    const next = (await api.completeTask(task)) as Todo;
    await Promise.resolve();

    expect(reminders.syncReminders).toHaveBeenCalledWith([next]);
    expect(reminders.cancelReminders).toHaveBeenCalledWith([task.id]);
  });

  it('undo reschedules the reopened task and cancels the removed successor', async () => {
    const task = await repeatingTask();
    const next = (await api.completeTask(task)) as Todo;
    reminders.syncReminders.mockClear();
    reminders.cancelReminders.mockClear();

    await api.reopenTask(task.id);
    await Promise.resolve();

    expect(reminders.syncReminders.mock.calls[0][0].map((t: Todo) => t.id)).toEqual([task.id]);
    expect(reminders.cancelReminders).toHaveBeenCalledWith([next.id]);
  });

  it('a reschedule reschedules every moved task', async () => {
    const a = await repeatingTask({ due_date: '2026-10-01' });
    reminders.syncReminders.mockClear();

    await api.rescheduleTasks([a.id], '2026-10-21');
    await Promise.resolve();

    expect(reminders.syncReminders.mock.calls[0][0][0]).toMatchObject({
      id: a.id,
      due_date: '2026-10-21',
    });
  });
});

describe('found in review', () => {
  const row = (id: string) => mockDb.rows().find((r) => r.id === id) as unknown as Todo;

  it('completing the same occurrence twice creates one successor, not two', async () => {
    // Done on the reminder, then a tick on the stale row in the app.
    const task = await repeatingTask();
    await api.completeTask(task);
    const second = await api.completeTask(task);

    expect(second).toBeNull();
    expect(openRows()).toHaveLength(1);
  });

  it('an occurrence moved to another day comes back to its schedule', async () => {
    // Every 2 months on the 15th; October's moved to 3 November.
    const task = await repeatingTask({
      frequency: 'monthly',
      repeat_every: 2,
      due_date: '2026-10-15',
    });
    expect(task.scheduled_for).toBe('2026-10-15');
    await api.rescheduleTasks([task.id], '2026-11-03');

    const next = (await api.completeTask(row(task.id))) as Todo;

    expect(next.due_date).toBe('2026-12-15');
    expect(next.scheduled_for).toBe('2026-12-15');
  });

  it('an occurrence pulled earlier does not come straight back', async () => {
    const task = await repeatingTask({ frequency: 'monthly', due_date: '2026-11-01' });
    await api.rescheduleTasks([task.id], '2026-10-19');

    const next = (await api.completeTask(row(task.id))) as Todo;

    expect(next.due_date).toBe('2026-12-01');
  });

  it('an editor save that only adds a note keeps a pulled-back occurrence from coming straight back', async () => {
    // Rent on the 1st; 1 November pulled back to 28 October, then opened in
    // the editor to add "paid by UPI" and saved.
    const task = await repeatingTask({ frequency: 'monthly', due_date: '2026-11-01' });
    await api.rescheduleTasks([task.id], '2026-10-28');
    const loaded = row(task.id);

    await api.updateTodo(
      task.id,
      {
        title: loaded.title,
        notes: 'paid by UPI',
        due_date: loaded.due_date,
        priority: loaded.priority,
        frequency: loaded.frequency,
        is_repeat: loaded.is_repeat,
        repeat_every: loaded.repeat_every,
        repeat_weekdays: loaded.repeat_weekdays,
        repeat_anchor_day: loaded.repeat_anchor_day,
        repeat_nth: loaded.repeat_nth,
        repeat_from: loaded.repeat_from,
      },
      loaded,
    );
    const next = (await api.completeTask(row(task.id))) as Todo;

    expect(row(task.id).notes).toBe('paid by UPI');
    expect(row(task.id).scheduled_for).toBe('2026-11-01');
    expect(next.due_date).toBe('2026-12-01');
  });

  it('a yearly occurrence moved into the next month stays a December routine', async () => {
    const task = await repeatingTask({ frequency: 'yearly', due_date: '2026-12-31' });
    await api.rescheduleTasks([task.id], '2027-01-02');

    const next = (await api.completeTask(row(task.id))) as Todo;

    expect(next.due_date).toBe('2027-12-31');
  });

  it('builds the next occurrence from the row as closed, not the copy a list was holding', async () => {
    // The phone sat on Tasks while the website moved "Gym" to 6 pm and gave
    // it a checklist; the tick then comes from the phone's old copy.
    const stale = await repeatingTask({ due_time: '19:00:00', reminder_offset_min: 0 });
    await api.updateTodo(stale.id, {
      due_time: '18:00:00',
      notes: 'Legs',
      checklist: [{ id: 'a', text: 'Squats', done: true }],
    });

    const next = (await api.completeTask(stale)) as Todo;

    expect(next.due_time).toBe('18:00:00');
    expect(next.notes).toBe('Legs');
    expect(next.checklist).toEqual([{ id: 'a', text: 'Squats', done: false }]);
  });

  it('a repeat turned on elsewhere brings its next one round, though the copy ticked says one-off', async () => {
    const stale = await repeatingTask({ is_repeat: false });
    await api.updateTodo(stale.id, { is_repeat: true });

    const next = await api.completeTask(stale);

    expect(next).not.toBeNull();
    expect(openRows()).toHaveLength(1);
  });

  it('reopening leaves a same-named routine of another frequency alone', async () => {
    // Migration 0020 joins v2 rows into series by title, so a daily and a
    // weekly "Water the plants" can share a key.
    const daily = await repeatingTask();
    const weekly = await repeatingTask({ frequency: 'weekly' });
    mockDb.patch(weekly.id, { series_id: daily.id });

    await api.completeTask(daily);
    await api.reopenTask(daily.id);

    expect(
      openRows()
        .map((r) => r.id)
        .sort(),
    ).toEqual([daily.id, weekly.id].sort());
  });

  it('dragging to another frequency re-settles the rule for the new unit', async () => {
    const task = await repeatingTask({
      frequency: 'weekly',
      due_date: '2026-10-22',
      repeat_weekdays: [1, 4],
    });

    await api.setFrequency(task.id, 'monthly', task.due_date);

    expect(row(task.id)).toMatchObject({
      frequency: 'monthly',
      repeat_weekdays: null,
      repeat_anchor_day: 22,
      repeat_nth: null,
      due_date: '2026-10-22',
    });
  });

  it("returns all of a series' closed occurrences, oldest first, and no one else's", async () => {
    // More than a page of it: the read used to stop at 1000 rows. The cap
    // itself is tested in history.test.ts; this checks the filter and order.
    const root = await repeatingTask();
    const other = await repeatingTask({ title: 'Something else' });
    await api.completeTask(other);
    let last = '';
    for (let i = 0; i < 1003; i++) {
      const day = new Date(2023, 0, 1 + i);
      last = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const occurrence = await api.createTodo({
        title: 'Water the plants',
        due_date: last,
        priority: 'normal',
        frequency: 'daily',
        is_repeat: false,
      });
      mockDb.patch(occurrence.id, { series_id: root.id, is_done: true, outcome: 'done' });
    }

    const history = await api.listSeriesHistory([root.id]);

    expect(history).toHaveLength(1003);
    expect(history.every((row) => row.series_id === root.id)).toBe(true);
    expect(history[history.length - 1].due_date).toBe(last);
    expect((history[0].due_date ?? '') < (history[1].due_date ?? '')).toBe(true);
  });
});

describe('Undo and then a quick re-tick (found in review)', () => {
  const row = (id: string) => mockDb.rows().find((r) => r.id === id) as unknown as Todo;

  it('a re-tick sent while the Undo is in flight waits for it, and the routine stays open once', async () => {
    // Undo puts the row back at once, so it can be ticked again before
    // reopenTask has finished. Without waiting, the re-tick's close and its
    // new successor landed between reopenTask's writes, and its sweep for
    // untouched occurrences deleted the new successor along with the old.
    const task = await repeatingTask();
    const first = (await api.completeTask(task)) as Todo;

    // The Undo's search for untouched occurrences is slow to come back...
    const release = mockDb.holdNext('todos', 'select');
    const undo = api.reopenTask(task.id);
    const retick = api.completeTask(task);
    // ...and everything else that is free to run, runs.
    for (let i = 0; i < 50; i++) await Promise.resolve();
    release();
    const [, second] = await Promise.all([undo, retick]);

    expect(second).not.toBeNull();
    expect(row(task.id).is_done).toBe(true);
    expect(openRows().map((r) => r.id)).toEqual([(second as Todo).id]);
    expect(openRows().map((r) => r.id)).not.toContain(first.id);
  });

  it('a write that fails does not hold up the next one on the same task', async () => {
    const task = await repeatingTask({ is_repeat: false });
    mockDb.failNext('todos', 'update');

    await expect(api.completeTask(task)).rejects.toThrow('network down');
    await expect(api.completeTask(task)).resolves.toBeNull();

    expect(row(task.id).is_done).toBe(true);
  });
});
