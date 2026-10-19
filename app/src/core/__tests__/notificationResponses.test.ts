/**
 * Acting on a notification: buttons (categories) and what happens when one is
 * pressed or the notification is tapped.
 *
 * A module registers its buttons once (registerCategory) and a handler for its
 * category (onResponse); the app root starts one listener for everyone
 * (listenForResponses). What must hold:
 *  - in Expo Go nothing loads the library, exactly like the rest of the file;
 *  - a response reaches the handler for ITS category and no other;
 *  - a button press dismisses the notification (Android leaves it in the tray
 *    otherwise), a plain tap does not need to;
 *  - the response that launched the app is handled once, not again when the
 *    listener reports it too, and not again on the next sign-in;
 *  - a handler that throws or rejects cannot take the listener down.
 */
type Core = typeof import('../notifications');

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

type Listener = (response: unknown) => void;

function nativeMock(granted = true) {
  const listeners: Listener[] = [];
  // What the library keeps as "the last response": the launch response, or
  // the most recent one this run.
  const state: { last: unknown } = { last: null };
  return {
    listeners,
    state,
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    setNotificationCategoryAsync: jest.fn(() => Promise.resolve({})),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted })),
    dismissNotificationAsync: jest.fn(() => Promise.resolve()),
    addNotificationResponseReceivedListener: jest.fn((listener: Listener) => {
      listeners.push(listener);
      return { remove: jest.fn(() => listeners.splice(listeners.indexOf(listener), 1)) };
    }),
    getLastNotificationResponse: jest.fn(() => state.last),
    clearLastNotificationResponse: jest.fn(() => {
      state.last = null;
    }),
    DEFAULT_ACTION_IDENTIFIER: DEFAULT_ACTION,
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
}

let mock: ReturnType<typeof nativeMock>;

function load(native = nativeMock()): Core {
  mock = native;
  jest.resetModules();
  jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
  jest.doMock('expo-notifications', () => native);
  return require('../notifications');
}

function response(
  category: string | null,
  action: string = DEFAULT_ACTION,
  overrides: { id?: string; date?: number; data?: Record<string, unknown> } = {},
) {
  return {
    actionIdentifier: action,
    notification: {
      date: overrides.date ?? 1000,
      request: {
        identifier: overrides.id ?? 'task-1',
        content: {
          title: 'Water the plants',
          body: 'Due 7 pm',
          data: overrides.data ?? { taskId: '1' },
          categoryIdentifier: category,
        },
      },
    },
  };
}

/** Lets fire-and-forget handler promises settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('in Expo Go', () => {
  it('registers nothing, listens to nothing, and never loads the library', async () => {
    jest.resetModules();
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
    const required = jest.fn(() => {
      throw new Error('expo-notifications must not be required in Expo Go');
    });
    jest.doMock('expo-notifications', required);
    const core: Core = require('../notifications');

    await expect(core.registerCategory('tasks', [{ id: 'done', title: 'Done' }])).resolves.toBe(false);
    const stop = core.listenForResponses();
    expect(typeof stop).toBe('function');
    stop();
    await expect(core.canNotify()).resolves.toBe(false);
    expect(required).not.toHaveBeenCalled();
  });
});

describe('registerCategory', () => {
  it('registers buttons that act without opening the app, once per run', async () => {
    const core = load();
    const buttons = [
      { id: 'done', title: 'Done' },
      { id: 'snooze', title: 'Snooze 30 min' },
    ];

    await expect(core.registerCategory('task_reminder', buttons)).resolves.toBe(true);
    await expect(core.registerCategory('task_reminder', buttons)).resolves.toBe(true);

    expect(mock.setNotificationCategoryAsync).toHaveBeenCalledTimes(1);
    expect(mock.setNotificationCategoryAsync).toHaveBeenCalledWith('task_reminder', [
      { identifier: 'done', buttonTitle: 'Done', options: { opensAppToForeground: false } },
      { identifier: 'snooze', buttonTitle: 'Snooze 30 min', options: { opensAppToForeground: false } },
    ]);
  });

  it('reports false rather than throwing when the platform refuses', async () => {
    const native = nativeMock();
    native.setNotificationCategoryAsync.mockImplementation(() => Promise.reject(new Error('no')));
    const core = load(native);
    await expect(core.registerCategory('x', [{ id: 'a', title: 'A' }])).resolves.toBe(false);
  });
});

describe('schedule with a category', () => {
  it('puts the category on the content so the buttons appear', async () => {
    const core = load();
    await core.schedule({
      id: 'task-1',
      date: new Date(Date.now() + 60_000),
      title: 't',
      body: 'b',
      category: 'task_reminder',
    });
    const request = (mock.scheduleNotificationAsync.mock.calls[0] as unknown[])[0] as {
      content: { categoryIdentifier?: string };
    };
    expect(request.content.categoryIdentifier).toBe('task_reminder');
  });

  it('leaves the category off when none is given', async () => {
    const core = load();
    await core.schedule({ id: 'x', date: new Date(Date.now() + 60_000), title: 't', body: 'b' });
    const request = (mock.scheduleNotificationAsync.mock.calls[0] as unknown[])[0] as {
      content: Record<string, unknown>;
    };
    expect('categoryIdentifier' in request.content).toBe(false);
  });
});

describe('listenForResponses', () => {
  it('routes a button press to its category\'s handler and dismisses the notification', async () => {
    const core = load();
    const tasks = jest.fn();
    const other = jest.fn();
    core.onResponse('task_reminder', tasks);
    core.onResponse('renewal', other);
    core.listenForResponses();

    mock.listeners[0](response('task_reminder', 'done'));
    await flush();

    expect(tasks).toHaveBeenCalledWith({
      action: 'done',
      notificationId: 'task-1',
      title: 'Water the plants',
      body: 'Due 7 pm',
      data: { taskId: '1' },
    });
    expect(other).not.toHaveBeenCalled();
    expect(mock.dismissNotificationAsync).toHaveBeenCalledWith('task-1');
  });

  it('reports a plain tap as no action, and leaves dismissing it to the system', async () => {
    const core = load();
    const handler = jest.fn();
    core.onResponse('task_digest', handler);
    core.listenForResponses();

    mock.listeners[0](response('task_digest'));
    await flush();

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ action: null }));
    expect(mock.dismissNotificationAsync).not.toHaveBeenCalled();
  });

  it('ignores a response with no category or no handler', async () => {
    const core = load();
    const handler = jest.fn();
    core.onResponse('task_reminder', handler);
    core.listenForResponses();

    mock.listeners[0](response(null));
    mock.listeners[0](response('unknown'));
    await flush();

    expect(handler).not.toHaveBeenCalled();
  });

  it('handles the response that launched the app once, even when the listener repeats it', async () => {
    const native = nativeMock();
    const launch = response('task_reminder', 'done', { id: 'task-7', date: 5 });
    const core = load(native);
    native.state.last = launch;
    const handler = jest.fn();
    core.onResponse('task_reminder', handler);

    core.listenForResponses();
    native.listeners[0](launch);
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(native.clearLastNotificationResponse).toHaveBeenCalled();
  });

  it('does not handle an old response again when listening restarts (a new sign-in)', async () => {
    const core = load();
    const handler = jest.fn();
    core.onResponse('task_reminder', handler);

    const stop = core.listenForResponses();
    const pressed = response('task_reminder', 'snooze');
    mock.listeners[0](pressed);
    // The library also keeps it as the "last response".
    mock.state.last = pressed;
    stop();
    core.listenForResponses();
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('survives a handler that throws or rejects', async () => {
    const core = load();
    const after = jest.fn();
    core.onResponse('a', () => {
      throw new Error('sync');
    });
    core.onResponse('b', () => Promise.reject(new Error('async')));
    core.onResponse('c', after);
    core.listenForResponses();

    expect(() => mock.listeners[0](response('a'))).not.toThrow();
    mock.listeners[0](response('b', DEFAULT_ACTION, { id: 'n2' }));
    mock.listeners[0](response('c', DEFAULT_ACTION, { id: 'n3' }));
    await flush();

    expect(after).toHaveBeenCalledTimes(1);
  });

  it('stops listening when asked', () => {
    const core = load();
    const stop = core.listenForResponses();
    expect(mock.listeners).toHaveLength(1);
    stop();
    expect(mock.listeners).toHaveLength(0);
  });
});

describe('canNotify', () => {
  it('is true only where notifications load and permission is granted, and never prompts', async () => {
    await expect(load(nativeMock(true)).canNotify()).resolves.toBe(true);
    const refused = nativeMock(false);
    await expect(load(refused).canNotify()).resolves.toBe(false);
    expect(refused.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
