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
