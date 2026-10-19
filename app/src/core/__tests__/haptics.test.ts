/**
 * Haptics are a nicety, so they must never be able to break the thing they
 * decorate. A tick that saves a set calls haptics.success() - if that call
 * threw, or left a rejected promise unhandled, the set would still save but
 * the screen could crash or log an error on a phone without a vibration motor.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { success, tap, warning } from '../haptics';

// Hoisted above the imports by babel-jest, so the module under test sees it.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: { Virtual_Key: 'virtual-key', Confirm: 'confirm', Reject: 'reject' },
}));

const impact = Haptics.impactAsync as jest.Mock;
const notify = Haptics.notificationAsync as jest.Mock;
const android = Haptics.performAndroidHapticsAsync as jest.Mock;

beforeEach(() => {
  impact.mockReset().mockImplementation(() => Promise.resolve());
  notify.mockReset().mockImplementation(() => Promise.resolve());
  android.mockReset().mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('on Android', () => {
  // The SDK 57 docs advise against impactAsync/notificationAsync on Android:
  // they drive the raw Vibrator. performAndroidHapticsAsync goes through the
  // view's haptic feedback instead, which needs no VIBRATE permission and
  // follows the phone's own haptics setting.
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it('uses the system haptics, not the vibrator', () => {
    tap();
    success();
    warning();
    expect(android.mock.calls.map((call) => call[0])).toEqual([
      Haptics.AndroidHaptics.Virtual_Key,
      Haptics.AndroidHaptics.Confirm,
      Haptics.AndroidHaptics.Reject,
    ]);
    expect(impact).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('still swallows a failure', () => {
    android.mockImplementation(() => {
      throw new Error('no haptics here');
    });
    expect(() => success()).not.toThrow();
  });
});

describe('haptics', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('tap is a light impact', () => {
    tap();
    expect(impact).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('success and warning are notification feedback of that kind', () => {
    success();
    warning();
    expect(notify).toHaveBeenNthCalledWith(1, Haptics.NotificationFeedbackType.Success);
    expect(notify).toHaveBeenNthCalledWith(2, Haptics.NotificationFeedbackType.Warning);
  });

  it('returns nothing, so callers cannot accidentally await it', () => {
    expect(tap()).toBeUndefined();
    expect(success()).toBeUndefined();
  });

  it('swallows a synchronous throw', () => {
    // An unsupported platform can throw before a promise even exists.
    impact.mockImplementation(() => {
      throw new Error('no haptics here');
    });
    expect(() => tap()).not.toThrow();
  });

  it('handles a rejected promise instead of leaving it unhandled', () => {
    // Watching for an 'unhandledRejection' event cannot prove this under
    // jest-expo, which never emits one: the earlier version of this test
    // passed even with the .catch deleted. So check the contract directly:
    // whatever promise the library returns gets a rejection handler.
    const handled = { catch: jest.fn() };
    notify.mockImplementation(() => handled);

    success();

    expect(handled.catch).toHaveBeenCalledTimes(1);
  });
});
