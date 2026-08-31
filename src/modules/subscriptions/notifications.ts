/**
 * notifications.ts - renewal reminders for subscriptions.
 *
 * WHY THIS LIVES IN THE MODULE, NOT IN core/. Only Subscriptions needs
 * notifications today. The sharing rule says a thing moves down into core when
 * a SECOND module needs it, not in anticipation of one. When Todo reminders
 * arrive, the permission and channel handling here is what moves; the
 * subscription-specific scheduling stays.
 *
 * NO SERVER IS INVOLVED. These are local notifications, scheduled on the
 * device by the OS. Nothing fires while the app is uninstalled, and nothing is
 * pushed from anywhere. That also means a reminder only exists on the phone
 * that scheduled it: reinstall the app and the reminders are gone until each
 * subscription is edited again.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY expo-notifications IS REQUIRED LAZILY AND NEVER IMPORTED AT THE TOP
 * ══════════════════════════════════════════════════════════════════════════
 * The library resolves its native module at MODULE SCOPE:
 *
 *     export default requireNativeModule('ExpoNotificationScheduler');
 *
 * requireNativeModule throws when that native module is absent, which is the
 * case in Expo Go. A static `import` is hoisted and evaluated before any code
 * in this file runs, so a try/catch around the usage cannot catch it - the
 * throw escapes the module entirely.
 *
 * That mattered far beyond this module. useHomeSummaries imports
 * subscriptions/api, which imports this file, so a static import took down the
 * HOME SCREEN at app start in Expo Go, with an error naming notifications.
 *
 * So: types are imported with `import type`, which the compiler erases and
 * which therefore costs nothing at runtime, and the real module is require()d
 * inside a guarded loader at the moment it is first needed.
 *
 * AND A try/catch AROUND THAT require IS NOT ENOUGH EITHER. Two facts combine:
 *
 *   1. expo-notifications' DevicePushTokenAutoRegistration side-effect module
 *      calls warnOfExpoGoPushUsage at import, which on Android in Expo Go
 *      THROWS rather than warning.
 *   2. Metro's guardedLoadModule catches errors thrown during module evaluation
 *      and hands them to ErrorUtils.reportFatalError instead of rethrowing,
 *      then returns undefined.
 *
 * So the require never throws to the caller: Metro swallows it and raises a
 * red screen, and our catch only fires later on the resulting undefined. The
 * only way to avoid the crash is to never require the library at all where it
 * cannot work, which is what the Expo Go check below does. It uses the same
 * signal the library itself uses to decide to throw.
 */
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { fromISODate } from '../../core/date';

/** Days before the due date that the reminder fires. Fixed for v2. */
export const REMINDER_LEAD_DAYS = 3;

/** The hour it fires. Morning, so it lands before the day gets away from you. */
const REMINDER_HOUR = 9;

type Notifications = typeof NotificationsModule;

/**
 * Cached result of trying to load the library.
 *
 * `undefined` means not yet attempted, `null` means attempted and unavailable.
 * Distinguishing the two keeps us from retrying a require that has already
 * thrown once, on every single call.
 */
let cached: Notifications | null | undefined;

/** Whether the notification handler has been installed on the loaded module. */
let handlerInstalled = false;

/**
 * Load expo-notifications, or return null on a runtime that lacks it.
 *
 * The handler is installed here rather than at module scope, for the same
 * reason as the require: it can only run once the module actually exists.
 * Without a handler, a notification arriving while the app is foregrounded is
 * delivered silently - precisely the case where you are most likely to be
 * looking at the app and wondering why nothing happened.
 */
function loadNotifications(): Notifications | null {
  if (cached !== undefined) return cached;

  /**
   * Bail BEFORE the require, not inside a try around it. See the file header:
   * Metro reports a module-evaluation throw as a fatal error rather than
   * letting it propagate, so by the time any catch here could run, the red
   * screen has already been raised.
   *
   * isRunningInExpoGo comes from `expo` itself and is the same check
   * expo-notifications uses to decide whether to throw, so this cannot drift
   * out of step with it.
   */
  if (isRunningInExpoGo()) {
    cached = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file header
    const mod = require('expo-notifications') as Notifications;
    cached = mod;

    if (!handlerInstalled) {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      handlerInstalled = true;
    }
  } catch {
    // Expo Go, or a build without the native module. Reminders are simply off.
    cached = null;
  }

  return cached;
}

/**
 * Deterministic notification id for a subscription.
 *
 * Derived from the row id rather than stored, which means cancelling never
 * needs a lookup and can never miss: there is exactly one possible id per
 * subscription, so rescheduling cannot leave an orphan behind. Storing the id
 * returned by the OS would have needed a column, and would go stale the moment
 * a write failed halfway.
 */
export function reminderId(subscriptionId: string): string {
  return `subscription-renewal-${subscriptionId}`;
}

/**
 * When the reminder for a due date should fire, or null if that moment has
 * already passed.
 *
 * Returning null rather than a past date is the important part. Scheduling a
 * notification in the past either fires it immediately or is rejected,
 * depending on platform - so an overdue subscription would either buzz the
 * instant you saved it or silently fail. Neither is a reminder.
 *
 * Pure, and takes `now`, so the tests need no clock fixture. It is also the
 * only export here that does not touch the library at all, which is why it is
 * the part worth testing.
 */
export function reminderDateFor(
  nextDueDate: string,
  now: Date = new Date(),
  leadDays: number = REMINDER_LEAD_DAYS,
): Date | null {
  // fromISODate builds a LOCAL date, so the reminder lands on the intended day
  // rather than shifting across midnight by timezone.
  const due = fromISODate(nextDueDate);
  const fireAt = new Date(due);
  fireAt.setDate(fireAt.getDate() - leadDays);
  fireAt.setHours(REMINDER_HOUR, 0, 0, 0);

  return fireAt.getTime() > now.getTime() ? fireAt : null;
}

/** Android needs an explicit channel or scheduled notifications are silent. */
async function ensureChannel(mod: Notifications): Promise<void> {
  if (Platform.OS !== 'android') return;
  await mod.setNotificationChannelAsync('renewals', {
    name: 'Renewal reminders',
    importance: mod.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export type PermissionState = 'granted' | 'denied' | 'unsupported';

/**
 * Ask for permission if it has not been decided, and report where we stand.
 *
 * 'unsupported' is its own state rather than being folded into 'denied',
 * because they need different words: denied is something you can fix in
 * Settings, unsupported means this build cannot do reminders at all and no
 * setting will help.
 */
export async function ensurePermission(): Promise<PermissionState> {
  const mod = loadNotifications();
  if (!mod) return 'unsupported';

  try {
    const current = await mod.getPermissionsAsync();
    if (current.granted) return 'granted';

    // Only prompt when the OS says asking is still allowed. Requesting a
    // permanently denied permission does nothing on Android and shows a no-op
    // dialog on iOS.
    if (current.canAskAgain) {
      const requested = await mod.requestPermissionsAsync();
      return requested.granted ? 'granted' : 'denied';
    }
    return 'denied';
  } catch {
    // Present but non-functional, which Expo Go can also be.
    return 'unsupported';
  }
}

/**
 * Cancel any existing reminder for this subscription.
 *
 * Always safe to call, including when nothing is scheduled: cancelling an
 * unknown identifier is a no-op. That is what lets every write path do
 * cancel-then-schedule without first checking whether a reminder exists.
 */
export async function cancelReminder(subscriptionId: string): Promise<void> {
  const mod = loadNotifications();
  if (!mod) return;

  try {
    await mod.cancelScheduledNotificationAsync(reminderId(subscriptionId));
  } catch {
    // Nothing scheduled, or notifications unavailable. Either way there is
    // nothing to clean up and nothing worth telling the user.
  }
}

/**
 * Schedule the reminder for a subscription, replacing any existing one.
 *
 * Returns whether a reminder now exists. False is a normal outcome, not a
 * failure: an inactive subscription, a due date closer than the lead time, a
 * device without permission, and Expo Go all legitimately end up with no
 * reminder. The subscription itself has already saved either way, so this must
 * never throw.
 */
export async function scheduleReminder(subscription: {
  id: string;
  name: string;
  next_due_date: string;
  is_active: boolean;
  amount_minor: number;
}): Promise<boolean> {
  const mod = loadNotifications();
  if (!mod) return false;

  // Cancel first, unconditionally. Editing a subscription must not leave the
  // old date's reminder behind, and this is the only path that guarantees it.
  await cancelReminder(subscription.id);

  if (!subscription.is_active) return false;

  const fireAt = reminderDateFor(subscription.next_due_date);
  if (!fireAt) return false;

  try {
    await ensureChannel(mod);
    await mod.scheduleNotificationAsync({
      identifier: reminderId(subscription.id),
      content: {
        title: `${subscription.name} renews soon`,
        body: `Due in ${REMINDER_LEAD_DAYS} days.`,
        // Lets a future tap open straight to the subscription rather than the
        // home screen. Nothing reads it yet; it costs nothing to record now.
        data: { subscriptionId: subscription.id },
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'renewals',
      },
    });
    return true;
  } catch {
    // Permission revoked between the check and the call, or a scheduler that
    // exists but refuses. The subscription saved fine; this is not an error to
    // put in front of the user.
    return false;
  }
}
