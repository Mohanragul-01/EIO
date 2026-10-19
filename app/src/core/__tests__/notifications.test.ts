/**
 * The notifications core: permission, scheduling, and the launch resync.
 *
 * Local notifications live on the phone, not in the database, so a reinstall
 * or a new phone loses every one of them. The resync is what puts them back:
 * each module registers how to rebuild its own, and the app runs them all once
 * per launch. Two things must hold for that to be safe to run on every start:
 *  - one module's failure cannot stop the others' reminders being rebuilt;
 *  - where notifications cannot work (Expo Go, permission refused), it does
 *    nothing at all, quietly, and never prompts.
 *
 * The module keeps state (the loaded library, the registry), so every test
 * loads a fresh copy with its own mocks.
 */
type Core = typeof import('../notifications');

type NativeMock = {
  setNotificationHandler: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  AndroidImportance: { DEFAULT: number };
  SchedulableTriggerInputTypes: { DATE: string };
  setNotificationCategoryAsync: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
  clearLastNotificationResponseAsync: jest.Mock;
  DEFAULT_ACTION_IDENTIFIER: string;
};

function nativeMock(granted = true): NativeMock {
  return {
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
    cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted })),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
    setNotificationCategoryAsync: jest.fn(() => Promise.resolve({})),
    addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
    getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
    clearLastNotificationResponseAsync: jest.fn(() => Promise.resolve()),
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
  };
}

/** A fresh copy of the module, on a runtime that has notifications. */
function load(native: NativeMock = nativeMock()): Core {
  jest.resetModules();
  jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
  jest.doMock('expo-notifications', () => native);
  return require('../notifications');
}

/** A fresh copy in Expo Go, where requiring the library at all would crash. */
function loadInExpoGo(): { core: Core; required: jest.Mock } {
  jest.resetModules();
  jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
  const required = jest.fn(() => {
    throw new Error('expo-notifications must not be required in Expo Go');
  });
  jest.doMock('expo-notifications', required);
  return { core: require('../notifications'), required };
}

const inOneHour = () => new Date(Date.now() + 3_600_000);

describe('in Expo Go', () => {
  it('reports unsupported and never loads the library', async () => {
    const { core, required } = loadInExpoGo();
    await expect(core.ensurePermission()).resolves.toBe('unsupported');
    await expect(
      core.schedule({ id: 'x', date: inOneHour(), title: 't', body: 'b' }),
    ).resolves.toBe(false);
    await expect(core.cancel('x')).resolves.toBeUndefined();
    await expect(core.cancelPrefix('x')).resolves.toBeUndefined();
    expect(required).not.toHaveBeenCalled();
  });

  it('runs no resync, and finishes without throwing', async () => {
    const { core, required } = loadInExpoGo();
    const run = jest.fn(() => Promise.resolve());
    core.registerResync('subscriptions', run);

    await expect(core.runResync()).resolves.toBeUndefined();
    expect(run).not.toHaveBeenCalled();
    expect(required).not.toHaveBeenCalled();
  });
});

describe('schedule', () => {
  it('does not schedule a moment that has already passed', async () => {
    // Android fires a past-dated notification immediately, so an overdue
    // reminder would buzz the instant it was saved.
    const native = nativeMock();
    const core = load(native);
    const past = new Date(Date.now() - 60_000);

    await expect(core.schedule({ id: 'x', date: past, title: 't', body: 'b' })).resolves.toBe(
      false,
    );
    expect(native.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a future moment under the given id, on a channel', async () => {
    const native = nativeMock();
    const core = load(native);
    const date = inOneHour();

    await expect(
      core.schedule({ id: 'task-1', date, title: 'Call', body: 'Today', data: { taskId: '1' } }),
    ).resolves.toBe(true);

    expect(native.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const request = native.scheduleNotificationAsync.mock.calls[0][0];
    expect(request.identifier).toBe('task-1');
    expect(request.content).toMatchObject({ title: 'Call', body: 'Today', data: { taskId: '1' } });
    expect(request.trigger).toMatchObject({ type: 'date', date });
    expect(request.trigger.channelId).toEqual(expect.any(String));
  });

  it('reports false rather than throwing when the scheduler refuses', async () => {
    const native = nativeMock();
    native.scheduleNotificationAsync.mockImplementation(() => Promise.reject(new Error('no')));
    const core = load(native);

    await expect(
      core.schedule({ id: 'x', date: inOneHour(), title: 't', body: 'b' }),
    ).resolves.toBe(false);
  });
});

describe('cancelPrefix', () => {
  it('cancels only the scheduled ids that start with the prefix', async () => {
    const native = nativeMock();
    native.getAllScheduledNotificationsAsync.mockImplementation(() =>
      Promise.resolve([{ identifier: 'sub-1' }, { identifier: 'task-1' }, { identifier: 'sub-2' }]),
    );
    const core = load(native);

    await core.cancelPrefix('sub-');

    const cancelled = native.cancelScheduledNotificationAsync.mock.calls.map((call) => call[0]);
    expect(cancelled.sort()).toEqual(['sub-1', 'sub-2']);
  });
});

describe('runResync', () => {
  it('runs every registered resync, and a failure does not stop the next', async () => {
    const core = load();
    const order: string[] = [];
    core.registerResync('first', () => {
      order.push('first');
      return Promise.reject(new Error('database unreachable'));
    });
    core.registerResync('second', () => {
      order.push('second');
      return Promise.resolve();
    });

    await expect(core.runResync()).resolves.toBeUndefined();
    expect(order).toEqual(['first', 'second']);
  });

  it('survives a resync that throws before returning a promise', async () => {
    const core = load();
    const second = jest.fn(() => Promise.resolve());
    core.registerResync('first', () => {
      throw new Error('sync throw');
    });
    core.registerResync('second', second);

    await expect(core.runResync()).resolves.toBeUndefined();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does nothing, and never prompts, when permission is not granted', async () => {
    // A permission prompt at launch, before you have done anything that needs
    // one, is the prompt people refuse. Asking belongs to the moment you turn
    // a reminder on.
    const native = nativeMock(false);
    const core = load(native);
    const run = jest.fn(() => Promise.resolve());
    core.registerResync('subscriptions', run);

    await core.runResync();

    expect(run).not.toHaveBeenCalled();
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('registering a key again replaces it rather than running it twice', async () => {
    const core = load();
    const old = jest.fn(() => Promise.resolve());
    const replacement = jest.fn(() => Promise.resolve());
    core.registerResync('subscriptions', old);
    core.registerResync('subscriptions', replacement);

    await core.runResync();

    expect(old).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledTimes(1);
  });
});

describe('categories (action buttons)', () => {
  const category = {
    id: 'subscription_renewal',
    actions: [{ id: 'mark_paid', title: 'Mark paid' }],
  };

  it('registers the category once, then names it on the notification', async () => {
    const native = nativeMock();
    const core = load(native);

    await core.schedule({ id: 'a', date: inOneHour(), title: 't', body: 'b', category });
    await core.schedule({ id: 'b', date: inOneHour(), title: 't', body: 'b', category });

    expect(native.setNotificationCategoryAsync).toHaveBeenCalledTimes(1);
    expect(native.setNotificationCategoryAsync).toHaveBeenCalledWith('subscription_renewal', [
      { identifier: 'mark_paid', buttonTitle: 'Mark paid', options: { opensAppToForeground: true } },
    ]);
    const request = native.scheduleNotificationAsync.mock.calls[0][0];
    expect(request.content.categoryIdentifier).toBe('subscription_renewal');
  });

  it('still schedules the reminder when the buttons cannot be registered', async () => {
    // A reminder without its button is still a reminder; none at all is the
    // failure this whole file exists to avoid.
    const native = nativeMock();
    native.setNotificationCategoryAsync.mockImplementation(() => Promise.reject(new Error('no')));
    const core = load(native);

    await expect(
      core.schedule({ id: 'a', date: inOneHour(), title: 't', body: 'b', category }),
    ).resolves.toBe(true);
    const request = native.scheduleNotificationAsync.mock.calls[0][0];
    expect(request.content.categoryIdentifier).toBeUndefined();
  });
});

describe('onResponse', () => {
  const response = (actionIdentifier: string, data: Record<string, unknown> = { x: 1 }) => ({
    actionIdentifier,
    notification: { request: { identifier: 'n-1', content: { data } } },
  });

  it('hands over a tap as no action, and a button by its id', async () => {
    const native = nativeMock();
    const core = load(native);
    const seen: unknown[] = [];

    core.onResponse((r) => seen.push(r));
    await Promise.resolve();
    const deliver = native.addNotificationResponseReceivedListener.mock.calls[0][0];
    deliver(response('expo.modules.notifications.actions.DEFAULT'));
    deliver(response('mark_paid'));

    expect(seen).toEqual([
      { id: 'n-1', actionId: null, data: { x: 1 } },
      { id: 'n-1', actionId: 'mark_paid', data: { x: 1 } },
    ]);
  });

  it('delivers the response that launched the app, once', async () => {
    const native = nativeMock();
    native.getLastNotificationResponseAsync.mockImplementation(() =>
      Promise.resolve(response('mark_paid')),
    );
    const core = load(native);
    const listener = jest.fn();

    core.onResponse(listener);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(listener).toHaveBeenCalledWith({ id: 'n-1', actionId: 'mark_paid', data: { x: 1 } });
    // Cleared, so the next launch does not replay it.
    expect(native.clearLastNotificationResponseAsync).toHaveBeenCalled();
  });

  it('stops listening when unsubscribed', () => {
    const native = nativeMock();
    const remove = jest.fn();
    native.addNotificationResponseReceivedListener.mockImplementation(() => ({ remove }));
    const core = load(native);

    const stop = core.onResponse(jest.fn());
    stop();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does nothing in Expo Go, and never loads the library', () => {
    const { core, required } = loadInExpoGo();
    const stop = core.onResponse(jest.fn());
    expect(() => stop()).not.toThrow();
    expect(required).not.toHaveBeenCalled();
  });
});

describe('permissionState', () => {
  it('reports without ever prompting', async () => {
    // Opening a screen that shows "reminders are off" must not itself ask:
    // asking belongs to the moment you turn a reminder on.
    const native = nativeMock(false);
    const core = load(native);

    await expect(core.permissionState()).resolves.toBe('denied');
    expect(native.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports granted, and unsupported in Expo Go', async () => {
    await expect(load(nativeMock(true)).permissionState()).resolves.toBe('granted');
    const { core, required } = loadInExpoGo();
    await expect(core.permissionState()).resolves.toBe('unsupported');
    expect(required).not.toHaveBeenCalled();
  });
});
