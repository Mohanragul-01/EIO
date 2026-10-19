/**
 * Scheduling renewal reminders: the join between the plan (reminderPlan.test)
 * and the OS.
 *
 * expo-notifications is mocked, because importing it outside a native runtime
 * pulls in modules Jest cannot resolve. What is tested here is what reaches
 * the scheduler: which ids, which moments, and that a rebuild starts clean.
 *
 * The last block pins a real bug: the library resolves its native module at
 * import time and throws when it is absent, so a STATIC import of it took
 * down the home screen in Expo Go. It is require()d lazily now, and the tests
 * below fail if anyone reverts that.
 */
import { DEFAULT_REMINDER_SETTINGS } from '../reminders';
import type { Subscription } from '../types';

type Native = ReturnType<typeof nativeMock>;

function nativeMock(scheduled: { identifier: string }[] = [], presented: string[] = []) {
  return {
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
    setNotificationCategoryAsync: jest.fn(() => Promise.resolve({})),
    scheduleNotificationAsync: jest.fn(
      (_request: { identifier: string; trigger: { date: Date } }) => Promise.resolve('id'),
    ),
    cancelScheduledNotificationAsync: jest.fn((_id: string) => Promise.resolve()),
    getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve(scheduled)),
    getPresentedNotificationsAsync: jest.fn(() =>
      Promise.resolve(presented.map((identifier) => ({ request: { identifier } }))),
    ),
    dismissNotificationAsync: jest.fn((_id: string) => Promise.resolve()),
    getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
    AndroidImportance: { DEFAULT: 3 },
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
}

function load(native: Native = nativeMock()) {
  jest.resetModules();
  jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
  jest.doMock('expo-notifications', () => native);
  return require('../notifications') as typeof import('../notifications');
}

/** 'YYYY-MM-DD' for today plus `days`, built from the local calendar. */
function inDays(days: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
    billing_cycle: 'monthly',
    next_due_date: inDays(20),
    is_active: true,
    category: 'fun',
    note: '',
    created_at: '',
    updated_at: '',
    status: 'active',
    trial_ends_on: null,
    ends_on: null,
    resume_on: null,
    cancel_url: null,
    cancel_notes: '',
    service_key: null,
    color: null,
    account_id: null,
    charge_channel: null,
    reminder_offsets: null,
    cycle_unit: 'month',
    cycle_count: 1,
    currency: 'INR',
    fx_rate: null,
    fx_rate_on: null,
    anchor_day: null,
    ...overrides,
  };
}

describe('a renewal close to its due date (the confirmed bug)', () => {
  /**
   * v2 had one reminder, three days ahead, and dropped it whenever that moment
   * had passed - so a subscription due in two days, the one closest to being
   * forgotten, got no reminder at all.
   */
  it('still reminds the day before and on the day', async () => {
    const native = nativeMock();
    const notifications = load(native);
    const due = inDays(2);

    await expect(
      notifications.scheduleReminders(sub({ next_due_date: due }), DEFAULT_REMINDER_SETTINGS),
    ).resolves.toBe(2);

    const fireDays = native.scheduleNotificationAsync.mock.calls.map(([request]) =>
      request.trigger.date.getDate(),
    );
    const [y, m, d] = due.split('-').map(Number);
    const dayBefore = new Date(y, m - 1, d - 1).getDate();
    expect(fireDays).toEqual([dayBefore, d]);
  });
});

describe('scheduleReminders', () => {
  it('clears every old reminder for the subscription first, v2s included', async () => {
    const native = nativeMock([
      { identifier: 'subscription-renewal-abc-d7' },
      { identifier: 'subscription-renewal-other-d3' },
    ]);
    const notifications = load(native);

    await notifications.scheduleReminders(sub(), DEFAULT_REMINDER_SETTINGS);

    const cancelled = native.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id);
    expect(cancelled).toContain('subscription-renewal-abc'); // v2's single id
    expect(cancelled).toContain('subscription-renewal-abc-d7');
    expect(cancelled).not.toContain('subscription-renewal-other-d3');
  });

  it('schedules nothing for a cancelled subscription, after clearing it', async () => {
    const native = nativeMock();
    const notifications = load(native);

    await expect(
      notifications.scheduleReminders(sub({ status: 'cancelled', ends_on: inDays(9) }), DEFAULT_REMINDER_SETTINGS),
    ).resolves.toBe(0);
    expect(native.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(native.cancelScheduledNotificationAsync).toHaveBeenCalledWith('subscription-renewal-abc');
  });

  it('keeps the renewals channel and attaches the Mark paid button', async () => {
    const native = nativeMock();
    const notifications = load(native);

    await notifications.scheduleReminders(sub({ next_due_date: inDays(1) }), DEFAULT_REMINDER_SETTINGS);

    const [request] = native.scheduleNotificationAsync.mock.calls[0] as unknown as [
      { trigger: { channelId: string }; content: { categoryIdentifier?: string } },
    ];
    expect(request.trigger.channelId).toBe('renewals');
    expect(request.content.categoryIdentifier).toBe('subscription_renewal');
  });
});

describe('cancelReminders', () => {
  it("takes this subscription's reminders out of the tray too, and no one else's", async () => {
    // A "renews tomorrow" still showing after you paid would offer Mark paid
    // for a cycle that is already settled.
    const native = nativeMock(
      [],
      ['subscription-renewal-abc-d1', 'subscription-renewal-abc-t0', 'subscription-renewal-other-d1'],
    );
    const notifications = load(native);

    await notifications.cancelReminders('abc');

    const dismissed = native.dismissNotificationAsync.mock.calls.map(([id]) => id);
    expect(dismissed.sort()).toEqual(['subscription-renewal-abc-d1', 'subscription-renewal-abc-t0']);
  });

  it('is not what the launch resync does: opening the app leaves unread reminders showing', async () => {
    const native = nativeMock([], ['subscription-renewal-abc-d1']);
    const notifications = load(native);

    await notifications.rescheduleAll([sub()], DEFAULT_REMINDER_SETTINGS);

    expect(native.dismissNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('rescheduleAll (the launch resync)', () => {
  it('cancels every subscription reminder, then schedules each row', async () => {
    // A subscription deleted on the website has no row any more; starting
    // clean is the only way its reminders go.
    const native = nativeMock([
      { identifier: 'subscription-renewal-deleted-d3' },
      { identifier: 'task-1' },
    ]);
    const notifications = load(native);

    await notifications.rescheduleAll(
      [sub({ id: 'one', next_due_date: inDays(10) }), sub({ id: 'two', next_due_date: inDays(10) })],
      DEFAULT_REMINDER_SETTINGS,
    );

    const cancelled = native.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id);
    expect(cancelled).toEqual(['subscription-renewal-deleted-d3']);
    const ids = native.scheduleNotificationAsync.mock.calls.map(([request]) => request.identifier);
    expect(ids).toEqual([
      'subscription-renewal-one-d3',
      'subscription-renewal-one-d1',
      'subscription-renewal-one-d0',
      'subscription-renewal-two-d3',
      'subscription-renewal-two-d1',
      'subscription-renewal-two-d0',
    ]);
  });

  it('puts the charged-to account in each reminder', async () => {
    const native = nativeMock();
    const notifications = load(native);

    await notifications.rescheduleAll([sub({ next_due_date: inDays(1) })], DEFAULT_REMINDER_SETTINGS, () => ({
      accountName: 'HDFC Card',
    }));

    const [request] = native.scheduleNotificationAsync.mock.calls[0] as unknown as [
      { content: { body: string } },
    ];
    expect(request.content.body).toContain('HDFC Card');
  });
});

describe('reminderId', () => {
  it('is deterministic, so cancelling never needs a lookup', () => {
    const notifications = load();
    expect(notifications.reminderId('abc')).toBe('subscription-renewal-abc');
  });

  it('differs per subscription', () => {
    const notifications = load();
    expect(notifications.reminderId('abc')).not.toBe(notifications.reminderId('abd'));
  });
});

describe('lazy loading of expo-notifications', () => {
  it('does not touch the library just by importing this module', () => {
    // THE REGRESSION. expo-notifications runs
    //   requireNativeModule('ExpoNotificationScheduler')
    // at module scope, which throws where that native module is absent. A
    // static import is hoisted above every try/catch in the file, so the throw
    // escaped the module and crashed the home screen at startup, because
    // useHomeSummaries imports subscriptions/api which imports this file.
    jest.resetModules();
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
    const required = jest.fn(() => nativeMock());
    jest.doMock('expo-notifications', required);

    const notifications = require('../notifications');

    expect(notifications.reminderId('abc')).toBe('subscription-renewal-abc');
    expect(required).not.toHaveBeenCalled();
  });

  it('never requires the library at all in Expo Go', async () => {
    // THE SECOND REGRESSION. expo-notifications throws during module
    // evaluation in Expo Go, and Metro's guardedLoadModule hands that to
    // ErrorUtils.reportFatalError rather than rethrowing - so the red screen
    // is up before any catch here could run. The only fix is to not require
    // it; this fails if the require is ever reached in Expo Go.
    jest.resetModules();
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));
    const required = jest.fn(() => {
      throw new Error('expo-notifications must not be required in Expo Go');
    });
    jest.doMock('expo-notifications', required);

    const notifications = require('../notifications');

    await expect(notifications.ensurePermission()).resolves.toBe('unsupported');
    await expect(
      notifications.scheduleReminders(sub({ next_due_date: '2099-01-10' }), DEFAULT_REMINDER_SETTINGS),
    ).resolves.toBe(0);
    await expect(
      notifications.rescheduleAll([sub({ next_due_date: '2099-01-10' })], DEFAULT_REMINDER_SETTINGS),
    ).resolves.toBeUndefined();

    expect(required).not.toHaveBeenCalled();
  });

  it('reports unsupported rather than throwing when the library is missing', async () => {
    jest.resetModules();
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => false }));
    // A build that is not Expo Go but still lacks the native module.
    jest.doMock('expo-notifications', () => {
      throw new Error('Cannot find native module ExpoNotificationScheduler');
    });

    const notifications = require('../notifications');

    await expect(notifications.ensurePermission()).resolves.toBe('unsupported');
    // And the write paths stay quiet, so a subscription still saves.
    await expect(notifications.cancelReminders('abc')).resolves.toBeUndefined();
    await expect(
      notifications.scheduleReminders(sub({ next_due_date: '2099-01-10' }), DEFAULT_REMINDER_SETTINGS),
    ).resolves.toBe(0);
  });
});
