/**
 * haptics.ts - a small vocabulary of physical feedback.
 *
 * Three words, not the whole API, so the same moment always feels the same:
 *   tap()      a choice registered - a chip, a toggle, a tab.
 *   success()  something worth noticing went right - a set ticked, a record.
 *   warning()  something needs a second look - a timer ran out.
 *
 * FIRE AND FORGET. Each returns nothing and can never throw or reject,
 * because haptics decorate an action and must not be able to break it. A tick
 * that saves a set calls success(); on a phone without a vibration motor, or
 * on the web, that call fails - and the set must save regardless.
 *
 * ANDROID GETS THE SYSTEM HAPTICS, not the vibrator. impactAsync and
 * notificationAsync drive Android's raw Vibrator, which the SDK 57 docs advise
 * against: performAndroidHapticsAsync goes through the view's haptic feedback
 * instead, so it feels like the rest of the phone, needs no VIBRATE permission
 * and follows the phone's own "touch feedback" setting. Platform is read at
 * call time rather than at import, so tests can exercise both paths.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function safely(run: () => Promise<void>): void {
  try {
    run().catch(() => {
      // Nothing to do: missing haptics are not worth a word to anyone.
    });
  } catch {
    // Some platforms throw before a promise exists.
  }
}

export function tap(): void {
  safely(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  );
}

export function success(): void {
  safely(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

export function warning(): void {
  safely(() =>
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  );
}
