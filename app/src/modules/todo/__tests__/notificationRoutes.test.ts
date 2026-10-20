/**
 * What a press on a task reminder does, through the real core listener.
 *
 * Done and Snooze open the app (see ensureCategory), so the press that
 * launched it reaches JavaScript twice: the library keeps it as the "last
 * response", which the listener reads at start, and it also emits it to the
 * listener. Either way the task must be completed - or snoozed - once.
 *
 * The native module is a stand-in that keeps listeners and a last response,
 * as notificationResponses.test.ts does for core alone; api.ts and the
 * navigator are mocked.
 */
type Listener = (response: unknown) => void;

const mockNative = {
  listeners: [] as Listener[],
  last: null as unknown,
};

jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn((listener: Listener) => {
    mockNative.listeners.push(listener);
    return { remove: jest.fn() };
  }),
  getLastNotificationResponse: jest.fn(() => mockNative.last),
  clearLastNotificationResponse: jest.fn(() => {
    mockNative.last = null;
  }),
  DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api', () => ({ completeById: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../navigation/navigationRef', () => ({ navigateWhenReady: jest.fn() }));

type Core = typeof import('../../../core/notifications');

let core: Core;
let api: { completeById: jest.Mock };
let notifications: typeof import('../notifications');

beforeEach(() => {
  mockNative.listeners = [];
  mockNative.last = null;
  // Core remembers the responses it has handled for the life of the run, so
  // each test starts a new run.
  jest.resetModules();
  core = require('../../../core/notifications');
  notifications = require('../notifications');
  api = require('../api');
  require('../notificationRoutes');
});

function press(action: string, taskId = 't1', date = 1000) {
  return {
    actionIdentifier: action,
    notification: {
      date,
      request: {
        identifier: `task-${taskId}`,
        content: {
          title: 'Take medicine',
          body: 'Due 7 pm',
          data: { taskId },
          categoryIdentifier: 'task_reminder',
        },
      },
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

it('a Done that opened the app completes the task once, though it is reported twice', async () => {
  const launch = press('done');
  mockNative.last = launch;

  core.listenForResponses();
  mockNative.listeners[0](launch);
  await flush();

  expect(api.completeById).toHaveBeenCalledTimes(1);
  expect(api.completeById).toHaveBeenCalledWith('t1');
});

it('a Snooze that opened the app snoozes once', async () => {
  const snooze = jest.spyOn(notifications, 'snooze').mockResolvedValue(true);
  const launch = press('snooze');
  mockNative.last = launch;

  core.listenForResponses();
  mockNative.listeners[0](launch);
  await flush();

  expect(snooze).toHaveBeenCalledTimes(1);
  expect(snooze).toHaveBeenCalledWith(
    'task-t1',
    expect.objectContaining({ data: { taskId: 't1' } }),
  );
  expect(api.completeById).not.toHaveBeenCalled();
});

it('Done on two reminders completes both', async () => {
  core.listenForResponses();
  mockNative.listeners[0](press('done', 't1', 1000));
  mockNative.listeners[0](press('done', 't2', 2000));
  await flush();

  expect(api.completeById.mock.calls).toEqual([['t1'], ['t2']]);
});
