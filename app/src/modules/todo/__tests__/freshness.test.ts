/**
 * The Tasks pager's pages stay current (found in review).
 *
 * Every page is mounted at once and used to reload only on navigation focus.
 * So a tick on Today left Daily showing the task open, and the app resumed
 * the next morning still showed yesterday - its date, its leftovers under
 * "Today", and none of today's tasks. What must hold:
 *  - the page on show reloads when the app comes back to the foreground, and
 *    Today re-reads the date then;
 *  - a page reloads when it is swiped to, not before;
 *  - the page on show reloads when a write made elsewhere lands, and the page
 *    that made it does not (it already shows it);
 *  - a reload keeps the list on screen rather than flashing a spinner.
 *
 * api.ts is mocked; AppState is the test's own, so it can say "active".
 */
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { announceChange } from '../changeSignal';
import type { Todo } from '../types';
import { useToday } from '../useToday';
import { useTodos } from '../useTodos';

jest.mock('../api', () => ({
  listToday: jest.fn(),
  listTodosByFrequency: jest.fn(),
  listCompletedByFrequency: jest.fn(),
  listSeriesHistory: jest.fn(() => Promise.resolve([])),
  completeTask: jest.fn(() => Promise.resolve(null)),
  reopenTask: jest.fn(),
  rescheduleTasks: jest.fn(() => Promise.resolve()),
  wontDoTask: jest.fn(() => Promise.resolve()),
  deleteTodo: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

const appStateListeners = new Set<(state: AppStateStatus) => void>();

async function foreground() {
  await act(async () => {
    appStateListeners.forEach((listener) => listener('active'));
  });
}

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
    now: new Date(2026, 9, 19, 21, 0),
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
  appStateListeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.add(listener as (state: AppStateStatus) => void);
    return { remove: () => appStateListeners.delete(listener as (state: AppStateStatus) => void) };
  });
  api.listToday.mockImplementation((today: string) =>
    Promise.resolve({
      open: [task(`due-${today}`, { due_date: today })],
      closedToday: [],
      next: null,
    }),
  );
  api.listTodosByFrequency.mockResolvedValue([task('gym')]);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Settles whatever the hook started: its fetch and the state it sets. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

async function todayPage(active = true) {
  const hook = await renderHook(({ on }: { on: boolean }) => useToday(on), {
    initialProps: { on: active },
  });
  await act(async () => {
    await hook.result.current.reload();
  });
  return hook;
}

async function dailyPage(active = true) {
  const hook = await renderHook(({ on }: { on: boolean }) => useTodos('daily', 'open', on), {
    initialProps: { on: active },
  });
  await act(async () => {
    await hook.result.current.reload();
  });
  return hook;
}

describe('coming back to the app', () => {
  it('reloads Today for the new day when the app is resumed the next morning', async () => {
    const { result } = await todayPage();
    expect(result.current.today).toBe('2026-10-19');

    jest.setSystemTime(new Date(2026, 9, 20, 7, 30));
    await foreground();
    await settle();

    expect(api.listToday).toHaveBeenLastCalledWith('2026-10-20');
    expect(result.current.today).toBe('2026-10-20');
    expect(result.current.sections.today.map((t) => t.id)).toEqual(['due-2026-10-20']);
  });

  it('reloads a frequency page on show', async () => {
    await dailyPage();
    api.listTodosByFrequency.mockClear();

    await foreground();
    await settle();

    expect(api.listTodosByFrequency).toHaveBeenCalledTimes(1);
  });

  it('leaves a page out of sight until it is swiped to', async () => {
    const { rerender } = await todayPage(false);
    api.listToday.mockClear();

    await foreground();
    await settle();
    expect(api.listToday).not.toHaveBeenCalled();

    await rerender({ on: true });
    await settle();
    expect(api.listToday).toHaveBeenCalledTimes(1);
  });
});

describe('a write made elsewhere', () => {
  it('a tick that lands after swiping on reloads the page now on show', async () => {
    // Ticked on Today, swiped to Daily before the server answered.
    const today = await todayPage(false);
    const daily = await dailyPage(true);
    api.listTodosByFrequency.mockClear();
    api.listToday.mockClear();

    await act(async () => {
      await today.result.current.complete(task('due-2026-10-19'));
    });
    await settle();

    expect(api.listTodosByFrequency).toHaveBeenCalledTimes(1);
    expect(api.listToday).not.toHaveBeenCalled();
    expect(daily.result.current.todos.map((t) => t.id)).toEqual(['gym']);
  });

  it('the page a write was made on does not reload for it', async () => {
    const { result } = await todayPage(true);
    api.listToday.mockClear();

    await act(async () => {
      await result.current.complete(task('due-2026-10-19'));
    });
    await settle();

    expect(api.listToday).not.toHaveBeenCalled();
  });

  it("a reminder's Done reloads the page on show", async () => {
    await dailyPage(true);
    api.listTodosByFrequency.mockClear();

    await act(async () => {
      announceChange(null);
    });
    await settle();

    expect(api.listTodosByFrequency).toHaveBeenCalledTimes(1);
  });
});

it('a reload keeps the list on screen instead of a spinner', async () => {
  // Swiping now reloads, so a reload that showed the spinner would flash it
  // on every swipe.
  const { result } = await dailyPage(true);
  let finish: (rows: Todo[]) => void = () => {};
  api.listTodosByFrequency.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );

  let reloading: Promise<void> = Promise.resolve();
  await act(async () => {
    reloading = result.current.reload();
  });
  expect(result.current.loading).toBe(false);
  expect(result.current.todos.map((t) => t.id)).toEqual(['gym']);

  await act(async () => {
    finish([task('gym')]);
    await reloading;
  });
});
