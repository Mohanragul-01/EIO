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

beforeEach(() => {
  mockDb = createFakeSupabase();
  jest.useFakeTimers({ now: new Date(2026, 9, 19, 12, 0, 0) });
});

afterEach(() => {
  jest.useRealTimers();
});

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

    expect(openRows().map((row) => row.id).sort()).toEqual([next.id, task.id].sort());
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
    expect(openRows().map((row) => row.id).sort()).toEqual([other.id, once.id].sort());
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

  it('keeps every occurrence in the first one\'s series', async () => {
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

describe('skip and won\'t do', () => {
  it('skipping records a skip and still brings the next one round', async () => {
    const task = await repeatingTask();
    const next = (await api.skipTask(task)) as Todo;

    expect(mockDb.rows().find((r) => r.id === task.id)!.outcome).toBe('skipped');
    expect(next.due_date).toBe('2026-10-20');
  });

  it('won\'t do closes a one-off without a successor', async () => {
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
    const overdue = await repeatingTask({ is_repeat: false, title: 'Late', due_date: '2026-10-10' });
    const today = await repeatingTask({ is_repeat: false, title: 'Now', due_date: '2026-10-19' });
    const later = await repeatingTask({ is_repeat: false, title: 'Later', due_date: '2026-10-25' });
    const done = await repeatingTask({ is_repeat: false, title: 'Done', due_date: '2026-10-19' });
    await api.createTodo({ title: 'Undated', due_date: null, priority: 'normal', frequency: 'daily', is_repeat: false });
    await api.completeTask(done);

    const result = await api.listToday('2026-10-19');

    expect(result.open.map((t) => t.id)).toEqual([overdue.id, today.id]);
    expect(result.closedToday.map((t) => t.id)).toEqual([done.id]);
    expect(result.next?.id).toBe(later.id);
  });
});
