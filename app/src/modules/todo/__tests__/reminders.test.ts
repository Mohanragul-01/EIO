/**
 * Task reminders and the digest: when each fires, what it says, and that
 * scheduling goes through core with the right id, channel and category.
 *
 * Core is mocked; its own behaviour (Expo Go, permission, buttons) is tested
 * in core/__tests__. Times are local wall-clock, built from parts, in New
 * York, so the November change is exercised.
 *
 * (jest.mock calls are hoisted above the imports, so the module under test
 * sees the mocks.)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DEFAULT_DIGEST,
  digestBody,
  digestPlan,
  loadDigestSettings,
  offsetLabel,
  rebuildAll,
  reminderBody,
  reminderDateFor,
  reminderId,
  saveDigestSettings,
  snooze,
  syncReminders,
} from '../notifications';
import type { Todo } from '../types';

jest.mock('../../../core/notifications', () => ({
  canNotify: jest.fn(() => Promise.resolve(true)),
  cancel: jest.fn(() => Promise.resolve()),
  cancelPrefix: jest.fn(() => Promise.resolve()),
  registerCategory: jest.fn(() => Promise.resolve(true)),
  schedule: jest.fn((_input: unknown) => Promise.resolve(true)),
  ensurePermission: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      store,
      getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    },
  };
});

const core = jest.requireMock('../../../core/notifications') as {
  cancel: jest.Mock;
  cancelPrefix: jest.Mock;
  registerCategory: jest.Mock;
  schedule: jest.Mock;
};
const storage = (AsyncStorage as unknown as { store: Map<string, string> }).store;

function task(overrides: Partial<Todo>): Todo {
  return {
    id: 'abc',
    user_id: 'u',
    title: 'Call the bank',
    due_date: '2026-10-19',
    is_done: false,
    priority: 'normal',
    frequency: 'daily',
    is_repeat: false,
    position: 0,
    due_time: '19:00:00',
    reminder_offset_min: 0,
    repeat_every: 1,
    repeat_weekdays: null,
    repeat_anchor_day: null,
    repeat_nth: null,
    repeat_from: 'due',
    series_id: null,
    scheduled_for: null,
    completed_at: null,
    outcome: null,
    notes: '',
    checklist: [],
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

const NOON = new Date(2026, 9, 19, 12, 0);

beforeEach(() => {
  jest.clearAllMocks();
  storage.clear();
});

describe('reminderDateFor', () => {
  it('fires at the due time less the offset, in local time', () => {
    expect(reminderDateFor(task({}), NOON)).toEqual(new Date(2026, 9, 19, 19, 0));
    expect(reminderDateFor(task({ reminder_offset_min: 30 }), NOON)).toEqual(
      new Date(2026, 9, 19, 18, 30),
    );
  });

  it('a day before is the same wall-clock time the day before, across the clock change', () => {
    const result = reminderDateFor(
      task({ due_date: '2026-11-02', due_time: '19:00:00', reminder_offset_min: 1440 }),
      NOON,
    );
    expect(result).toEqual(new Date(2026, 10, 1, 19, 0));
    expect(result?.getHours()).toBe(19);
  });

  it('is null with no time, no date, no reminder, when closed, or once past', () => {
    expect(reminderDateFor(task({ due_time: null }), NOON)).toBeNull();
    expect(reminderDateFor(task({ due_date: null }), NOON)).toBeNull();
    expect(reminderDateFor(task({ reminder_offset_min: null }), NOON)).toBeNull();
    expect(reminderDateFor(task({ is_done: true }), NOON)).toBeNull();
    expect(reminderDateFor(task({ due_time: '09:00:00' }), NOON)).toBeNull();
  });
});

describe('words', () => {
  it('labels offsets', () => {
    expect([0, 5, 15, 30, 60, 1440, 120, 2880].map(offsetLabel)).toEqual([
      'At time',
      '5 min before',
      '15 min before',
      '30 min before',
      '1 hour before',
      '1 day before',
      '2 hours before',
      '2 days before',
    ]);
  });

  it('says when it is due, and the rule for a repeat', () => {
    expect(reminderBody(task({}))).toBe('Due 7 pm');
    expect(
      reminderBody(task({ is_repeat: true, frequency: 'weekly', repeat_weekdays: [1, 4] })),
    ).toBe('Due 7 pm · Mon, Thu');
  });

  it('counts the digest', () => {
    expect(digestBody(3, 6)).toBe('3 overdue · 6 today');
    expect(digestBody(3, 0)).toBe('3 overdue');
    expect(digestBody(0, 6)).toBe('6 today');
  });
});

describe('digestPlan', () => {
  const on = { enabled: true, hour: 8, minute: 0 };
  const open = [
    { due_date: '2026-10-15' },
    { due_date: '2026-10-20' },
    { due_date: '2026-10-20' },
    { due_date: null },
  ];

  it('plans one per day with that day\'s projected counts, skipping past times', () => {
    // At noon today's 8 am digest has passed, so the plan starts tomorrow.
    const plan = digestPlan(open, on, '2026-10-19', NOON, 3);
    expect(plan.map((e) => [e.day, e.body])).toEqual([
      ['2026-10-20', '1 overdue · 2 today'],
      ['2026-10-21', '3 overdue'],
    ]);
    expect(plan[0].id).toBe('task-digest-2026-10-20');
    expect(plan[0].date).toEqual(new Date(2026, 9, 20, 8, 0));
  });

  it('includes today when its time is still ahead', () => {
    const early = new Date(2026, 9, 19, 6, 0);
    expect(digestPlan(open, on, '2026-10-19', early, 1).map((e) => e.body)).toEqual(['1 overdue']);
  });

  it('skips days with nothing to say, and plans nothing when off', () => {
    expect(digestPlan([{ due_date: '2026-10-25' }], on, '2026-10-19', NOON, 7).map((e) => e.day)).toEqual([
      '2026-10-25',
    ]);
    expect(digestPlan(open, DEFAULT_DIGEST, '2026-10-19', NOON)).toEqual([]);
  });
});

describe('digest settings', () => {
  it('default to off at 8:00, and round-trip', async () => {
    await expect(loadDigestSettings()).resolves.toEqual(DEFAULT_DIGEST);
    await saveDigestSettings({ enabled: true, hour: 7, minute: 30 });
    await expect(loadDigestSettings()).resolves.toEqual({ enabled: true, hour: 7, minute: 30 });
  });

  it('read a corrupt or out-of-range value as the default', async () => {
    storage.set('eio.tasks.digest', '{not json');
    await expect(loadDigestSettings()).resolves.toEqual(DEFAULT_DIGEST);
    storage.set('eio.tasks.digest', JSON.stringify({ enabled: true, hour: 99, minute: -1 }));
    await expect(loadDigestSettings()).resolves.toEqual({ enabled: true, hour: 8, minute: 0 });
  });
});

describe('scheduling through core', () => {
  it('cancels then schedules a task reminder with its id, channel, category and task id', async () => {
    await syncReminders([task({})], NOON);

    expect(core.cancel).toHaveBeenCalledWith(reminderId('abc'));
    expect(core.registerCategory).toHaveBeenCalledWith('task_reminder', [
      { id: 'done', title: 'Done' },
      { id: 'snooze', title: 'Snooze 30 min' },
    ]);
    expect(core.schedule).toHaveBeenCalledWith({
      id: 'task-abc',
      date: new Date(2026, 9, 19, 19, 0),
      title: 'Call the bank',
      body: 'Due 7 pm',
      data: { taskId: 'abc' },
      channel: { id: 'tasks', name: 'Task reminders' },
      category: 'task_reminder',
    });
  });

  it('only cancels for a closed task', async () => {
    await syncReminders([task({ is_done: true })], NOON);
    expect(core.cancel).toHaveBeenCalledWith('task-abc');
    expect(core.schedule).not.toHaveBeenCalled();
  });

  it('rebuilds everything from scratch, digests included', async () => {
    await saveDigestSettings({ enabled: true, hour: 8, minute: 0 });
    await rebuildAll([task({}), task({ id: 'def', due_date: '2026-10-21', due_time: null })], '2026-10-19', NOON);

    expect(core.cancelPrefix).toHaveBeenCalledWith('task-');
    const ids = core.schedule.mock.calls.map((call) => (call[0] as { id: string }).id);
    // Today's 8 am has passed; every later day of the week has both tasks
    // still open, so each gets a digest.
    expect(ids).toEqual([
      'task-abc',
      'task-digest-2026-10-20',
      'task-digest-2026-10-21',
      'task-digest-2026-10-22',
      'task-digest-2026-10-23',
      'task-digest-2026-10-24',
      'task-digest-2026-10-25',
    ]);
  });

  it('snoozes under the same id, 30 minutes on', async () => {
    await snooze('task-abc', { title: 'Call the bank', body: 'Due 7 pm', data: { taskId: 'abc' } }, NOON);
    expect(core.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-abc',
        date: new Date(2026, 9, 19, 12, 30),
        category: 'task_reminder',
      }),
    );
  });
});

describe('a snooze survives the launch resync (found in review)', () => {
  const scheduledIds = () => core.schedule.mock.calls.map((call) => (call[0] as { id: string }).id);
  const snoozedTask = task({ id: 'abc', due_time: '07:00:00' });

  it('rebuildAll puts a pending snooze back after clearing every task- reminder', async () => {
    // Snoozed at 7:00 for 7:30; the app opens at 7:10 and resyncs.
    const at7 = new Date(2026, 9, 19, 7, 0);
    await snooze('task-abc', { title: 'Call the bank', body: 'Due 7 am', data: { taskId: 'abc' } }, at7);
    core.schedule.mockClear();

    await rebuildAll([snoozedTask], '2026-10-19', new Date(2026, 9, 19, 7, 10));

    expect(core.cancelPrefix).toHaveBeenCalledWith('task-');
    expect(core.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-abc', date: new Date(2026, 9, 19, 7, 30) }),
    );
  });

  it('forgets a snooze that has passed, or whose task is no longer open', async () => {
    const at7 = new Date(2026, 9, 19, 7, 0);
    await snooze('task-abc', { title: 't', body: 'b', data: { taskId: 'abc' } }, at7);
    core.schedule.mockClear();

    await rebuildAll([snoozedTask], '2026-10-19', new Date(2026, 9, 19, 8, 0));
    await rebuildAll([], '2026-10-19', new Date(2026, 9, 19, 7, 10));

    expect(scheduledIds()).not.toContain('task-abc');
  });

  it('a write to the task (an edit, a tick) ends its snooze', async () => {
    const at7 = new Date(2026, 9, 19, 7, 0);
    await snooze('task-abc', { title: 't', body: 'b', data: { taskId: 'abc' } }, at7);
    await syncReminders([task({ id: 'abc', is_done: true })], at7);
    core.schedule.mockClear();

    await rebuildAll([snoozedTask], '2026-10-19', new Date(2026, 9, 19, 7, 10));

    expect(scheduledIds()).not.toContain('task-abc');
  });
});
