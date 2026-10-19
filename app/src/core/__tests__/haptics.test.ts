/**
 * Haptics are a nicety, so they must never be able to break the thing they
 * decorate. A tick that saves a set calls haptics.success() - if that call
 * threw, or left a rejected promise unhandled, the set would still save but
 * the screen could crash or log an error on a phone without a vibration motor.
 */
import * as Haptics from 'expo-haptics';

import { success, tap, warning } from '../haptics';

// Hoisted above the imports by babel-jest, so the module under test sees it.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const impact = Haptics.impactAsync as jest.Mock;
const notify = Haptics.notificationAsync as jest.Mock;

beforeEach(() => {
  impact.mockReset().mockImplementation(() => Promise.resolve());
  notify.mockReset().mockImplementation(() => Promise.resolve());
});

describe('haptics', () => {
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

  it('swallows a rejected promise instead of leaving it unhandled', async () => {
    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    notify.mockImplementation(() => Promise.reject(new Error('vibrator busy')));

    success();
    // Let the rejection settle; an unhandled one is reported on the next tick.
    await new Promise((resolve) => setTimeout(resolve, 0));

    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
