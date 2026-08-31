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
 * REQUIRES A DEVELOPMENT BUILD. expo-notifications does not function in Expo
 * Go. Every call here is written to fail soft rather than throw, so running in
 * Expo Go degrades to "no reminders" instead of crashing the module.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fromISODate } from '../../core/date';

/**
 * How a reminder behaves when the app happens to be open at the time.
 *
 * Set at module scope so it is configured before anything can schedule. Without
 * a handler, a notification firing while the app is foregrounded is delivered
 * silently and you would never see it - which is precisely the case where you
 * are most likely to be looking at the app and wondering why nothing happened.
 *
 * Wrapped because expo-notifications is unavailable in Expo Go, and a throw at
 * module scope would take down every screen that imports this file.
 */
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {
  // Expo Go. Reminders are unavailable anyway; the banner in the module says so.
}

/** Days before the due date that the reminder fires. Fixed for v2. */
export const REMINDER_LEAD_DAYS = 3;

/** The hour it fires. Morning, so it lands before the day gets away from you. */
const REMINDER_HOUR = 9;

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
 * Pure, and takes `now`, so the tests need no clock fixture.
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
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('renewals', {
    name: 'Renewal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export type PermissionState = 'granted' | 'denied' | 'unsupported';

/**
 * Ask for permission if it has not been decided, and report where we stand.
 *
 * 'unsupported' is its own state rather than being folded into 'denied',
 * because they need different words: denied is something you can fix in
 * Settings, unsupported means you are in Expo Go and no setting will help.
 */
export async function ensurePermission(): Promise<PermissionState> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return 'granted';

    // Only prompt when the OS says asking is still allowed. Calling request on
    // a permanently denied permission does nothing on Android and is a no-op
    // dialog on iOS.
    if (current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted ? 'granted' : 'denied';
    }
    return 'denied';
  } catch {
    // expo-notifications throws in Expo Go rather than reporting a status.
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
  try {
    await Notifications.cancelScheduledNotificationAsync(reminderId(subscriptionId));
  } catch {
    // Nothing scheduled, or notifications unavailable. Either way there is
    // nothing to clean up and nothing worth telling the user.
  }
}

/**
 * Schedule the reminder for a subscription, replacing any existing one.
 *
 * Returns whether a reminder now exists. False is a normal outcome, not a
 * failure: an inactive subscription, a due date less than three days away, or
 * a device without permission all legitimately end up with no reminder.
 */
export async function scheduleReminder(subscription: {
  id: string;
  name: string;
  next_due_date: string;
  is_active: boolean;
  amount_minor: number;
}): Promise<boolean> {
  // Cancel first, unconditionally. Editing a subscription must not leave the
  // old date's reminder behind, and this is the only path that guarantees it.
  await cancelReminder(subscription.id);

  if (!subscription.is_active) return false;

  const fireAt = reminderDateFor(subscription.next_due_date);
  if (!fireAt) return false;

  try {
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: reminderId(subscription.id),
      content: {
        title: `${subscription.name} renews soon`,
        body: `Due in ${REMINDER_LEAD_DAYS} days.`,
        // Lets a future tap open straight to the subscription rather than the
        // home screen. Nothing reads it yet; it costs nothing to record now.
        data: { subscriptionId: subscription.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: 'renewals',
      },
    });
    return true;
  } catch {
    // Expo Go, or permission revoked between the check and the call. The
    // subscription itself saved fine, so this must not surface as an error.
    return false;
  }
}
