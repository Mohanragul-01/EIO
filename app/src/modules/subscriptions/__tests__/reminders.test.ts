/**
 * Renewal reminder scheduling.
 *
 * The part worth testing is the date maths, not the OS call. A reminder that
 * fires on the wrong day, or fires instantly because it was scheduled in the
 * past, is the failure people actually hit - and neither throws, so nothing
 * else would catch it.
 *
 * expo-notifications is mocked because importing it outside a native runtime
 * pulls in modules Jest cannot resolve. Only the pure helpers are exercised.
 *
 * The last block pins a real bug: the library resolves its native module at
 * import time and throws when it is absent, so a STATIC import of it here took
 * down the home screen in Expo Go. It is now require()d lazily, and the test
 * below fails if anyone reverts that.
 */
// Default: NOT Expo Go, so the loader takes the real path. Individual tests
// override this to exercise the bail-out.
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

import { REMINDER_LEAD_DAYS, reminderDateFor, reminderId } from '../notifications';

describe('reminderDateFor', () => {
  it('fires three days before the due date, in the morning', () => {
    const now = new Date(2026, 7, 1); // 1 August
    const fireAt = reminderDateFor('2026-08-20', now);

    expect(fireAt).not.toBeNull();
    expect(fireAt?.getFullYear()).toBe(2026);
    expect(fireAt?.getMonth()).toBe(7); // August
    expect(fireAt?.getDate()).toBe(17); // 20 minus 3
    expect(fireAt?.getHours()).toBe(9);
  });

  it('returns null when the reminder moment has already passed', () => {
    // The important case. Scheduling in the past either fires immediately or is
    // rejected outright, so an overdue subscription would buzz the instant you
    // saved it. Neither is a reminder.
    const now = new Date(2026, 7, 30);
    expect(reminderDateFor('2026-08-20', now)).toBeNull();
  });

  it('returns null when the due date is closer than the lead time', () => {
    // Due in two days: the three-day reminder is already behind us.
    const now = new Date(2026, 7, 30, 12, 0);
    expect(reminderDateFor('2026-09-01', now)).toBeNull();
  });

  it('still schedules when the reminder is later today', () => {
    // 08:00 now, reminder at 09:00 today. Same day, still in the future.
    const now = new Date(2026, 7, 30, 8, 0);
    const fireAt = reminderDateFor('2026-09-02', now);
    expect(fireAt).not.toBeNull();
    expect(fireAt?.getDate()).toBe(30);
  });

  it('crosses a month boundary backwards', () => {
    const now = new Date(2026, 7, 1);
    const fireAt = reminderDateFor('2026-09-02', now);
    expect(fireAt?.getMonth()).toBe(7); // August, not September
    expect(fireAt?.getDate()).toBe(30);
  });

  it('crosses a year boundary backwards', () => {
    const now = new Date(2026, 11, 1);
    const fireAt = reminderDateFor('2027-01-02', now);
    expect(fireAt?.getFullYear()).toBe(2026);
    expect(fireAt?.getMonth()).toBe(11); // December
    expect(fireAt?.getDate()).toBe(30);
  });

  it('handles the leap day without inventing a date', () => {
    const now = new Date(2024, 1, 1);
    const fireAt = reminderDateFor('2024-03-02', now);
    expect(fireAt?.getMonth()).toBe(1); // February
    expect(fireAt?.getDate()).toBe(28); // 2 March minus 3 days, in a leap year
  });

  it('uses the configured lead time', () => {
    const now = new Date(2026, 7, 1);
    expect(reminderDateFor('2026-08-20', now, 10)?.getDate()).toBe(10);
    expect(REMINDER_LEAD_DAYS).toBe(3);
  });
});

describe('reminderId', () => {
  it('is deterministic, so cancelling never needs a lookup', () => {
    // This is what makes reschedule-on-every-write safe: there is exactly one
    // possible id per subscription, so an edit cannot orphan the old reminder.
    expect(reminderId('abc')).toBe(reminderId('abc'));
  });

  it('differs per subscription', () => {
    expect(reminderId('abc')).not.toBe(reminderId('abd'));
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
    //
    // Importing the module and calling a pure helper must not require it.
    jest.resetModules();
    const notifications = require('../notifications');

    expect(notifications.reminderId('abc')).toBe('subscription-renewal-abc');
    expect(notifications.reminderDateFor('2099-01-10', new Date(2099, 0, 1))).not.toBeNull();
  });

  it('never requires the library at all in Expo Go', async () => {
    // THE SECOND REGRESSION, and the one the first version of this test missed.
    //
    // A try/catch around the require is not enough. expo-notifications throws
    // during module evaluation in Expo Go, and Metro's guardedLoadModule hands
    // that to ErrorUtils.reportFatalError rather than rethrowing - so the red
    // screen is already up before any catch here could run.
    //
    // The only fix is to not require it. This test fails if the require is
    // ever reached in Expo Go, regardless of what it is wrapped in.
    jest.resetModules();
    jest.doMock('expo', () => ({ isRunningInExpoGo: () => true }));

    const required = jest.fn(() => {
      throw new Error('expo-notifications must not be required in Expo Go');
    });
    jest.doMock('expo-notifications', required);

    const notifications = require('../notifications');

    await expect(notifications.ensurePermission()).resolves.toBe('unsupported');
    await expect(
      notifications.scheduleReminder({
        id: 'abc',
        name: 'Netflix',
        next_due_date: '2099-01-10',
        is_active: true,
        amount_minor: 64900,
      }),
    ).resolves.toBe(false);

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
    await expect(notifications.cancelReminder('abc')).resolves.toBeUndefined();
    await expect(
      notifications.scheduleReminder({
        id: 'abc',
        name: 'Netflix',
        next_due_date: '2099-01-10',
        is_active: true,
        amount_minor: 64900,
      }),
    ).resolves.toBe(false);
  });
});
