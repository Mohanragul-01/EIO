/**
 * useToday: the Today view's optimistic writes and their undo.
 *
 * What must hold: a tick moves a row to "Completed today" at once and back if
 * the server refuses; an Undo of a tick returns it; a reschedule takes rows
 * off Today, and its Undo brings them back (the bug this file was written
 * for - the undo only edited rows still listed, so moved rows never
 * returned). api.ts is mocked; its own behaviour is in api.test.ts.
 *
 * Only Date is faked (Monday 19 Oct 2026): the hook's promises and the
 * testing library's act() need real timers.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { Todo } from '../types';
import { useToday } from '../useToday';

jest.mock('../api', () => ({
  listToday: jest.fn(),
  listSeriesHistory: jest.fn(() => Promise.resolve([])),
  completeTask: jest.fn(),
  reopenTask: jest.fn(),
  rescheduleTasks: jest.fn(() => Promise.resolve()),
  wontDoTask: jest.fn(() => Promise.resolve()),
  deleteTodo: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

function task(id: string, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    user_id: 'u',
    title: `Task ${id}`,
    due_date: '2026-10-19',
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

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 19, 12, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

async function loaded(open: Todo[], closedToday: Todo[] = []) {
  api.listToday.mockResolvedValue({ open, closedToday, next: null });
  const hook = await renderHook(() => useToday());
  await act(async () => {
    await hook.result.current.reload();
  });
  return hook;
}

const ids = (rows: Todo[]) => rows.map((t) => t.id);

describe('useToday', () => {
  it('loads overdue and today into their sections', async () => {
    const { result } = await loaded([task('late', { due_date: '2026-10-12' }), task('now')]);
    expect(result.current.loading).toBe(false);
    expect(ids(result.current.sections.overdue)).toEqual(['late']);
    expect(ids(result.current.sections.today)).toEqual(['now']);
  });

  it('a tick moves the row to Completed today, and Undo brings it back', async () => {
    const now = task('now');
    api.completeTask.mockResolvedValue(null);
    api.reopenTask.mockResolvedValue({ reopened: now, removed: [] });
    const { result } = await loaded([now]);

    await act(async () => {
      await result.current.complete(now);
    });
    expect(ids(result.current.sections.today)).toEqual([]);
    expect(ids(result.current.sections.completed)).toEqual(['now']);

    await act(async () => {
      await result.current.reopen(now);
    });
    expect(ids(result.current.sections.today)).toEqual(['now']);
    expect(ids(result.current.sections.completed)).toEqual([]);
  });

  it('puts the row back if the server refuses the tick', async () => {
    const now = task('now');
    api.completeTask.mockRejectedValue(new Error('offline'));
    const { result } = await loaded([now, task('other')]);

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.complete(now);
    });

    expect(outcome).toBe(false);
    expect(ids(result.current.sections.today).sort()).toEqual(['now', 'other']);
    expect(result.current.error).toBe('offline');
  });

  it('a reschedule takes overdue rows off Today, and its undo brings them back', async () => {
    const a = task('a', { due_date: '2026-10-10' });
    const b = task('b', { due_date: '2026-10-12' });
    const { result } = await loaded([a, b, task('now')]);

    await act(async () => {
      await result.current.reschedule([a, b], '2026-10-20');
    });
    expect(ids(result.current.sections.overdue)).toEqual([]);

    // The undo in useTaskActions: each row back to its own date, passing the
    // rows as they are now (moved).
    await act(async () => {
      await result.current.reschedule([{ ...a, due_date: '2026-10-20' }], '2026-10-10');
      await result.current.reschedule([{ ...b, due_date: '2026-10-20' }], '2026-10-12');
    });
    expect(ids(result.current.sections.overdue)).toEqual(['a', 'b']);
  });

  it('a failed reschedule leaves the rows where they were', async () => {
    const a = task('a', { due_date: '2026-10-10' });
    api.rescheduleTasks.mockRejectedValueOnce(new Error('offline'));
    const { result } = await loaded([a]);

    await act(async () => {
      await result.current.reschedule([a], '2026-10-25');
    });

    expect(ids(result.current.sections.overdue)).toEqual(['a']);
  });
});
