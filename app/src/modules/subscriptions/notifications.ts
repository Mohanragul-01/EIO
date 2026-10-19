/**
 * notifications.ts - renewal reminders for subscriptions.
 *
 * What to remind about and when lives here; HOW (permission, channel, the
 * Expo Go guard, scheduling) lives in core/notifications, which every module
 * with reminders shares. See that file for why expo-notifications is never
 * imported directly.
 *
 * A reminder only exists on the phone that scheduled it, so a reinstall loses
 * them until something reschedules each one.
 */
import { fromISODate } from '../../core/date';
import { cancel, schedule, type Channel } from '../../core/notifications';

export { ensurePermission, type PermissionState } from '../../core/notifications';

/** Days before the due date that the reminder fires. Fixed for v2. */
export const REMINDER_LEAD_DAYS = 3;

/** The hour it fires. Morning, so it lands before the day gets away from you. */
const REMINDER_HOUR = 9;

/** The channel these have always used, kept so a phone that already has it
 *  keeps the person's settings for it. */
const RENEWALS: Channel = { id: 'renewals', name: 'Renewal reminders' };

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

/**
 * Cancel any existing reminder for this subscription.
 *
 * Always safe to call, including when nothing is scheduled: cancelling an
 * unknown identifier is a no-op. That is what lets every write path do
 * cancel-then-schedule without first checking whether a reminder exists.
 */
export async function cancelReminder(subscriptionId: string): Promise<void> {
  await cancel(reminderId(subscriptionId));
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
  // Cancel first, unconditionally. Editing a subscription must not leave the
  // old date's reminder behind, and this is the only path that guarantees it.
  await cancelReminder(subscription.id);

  if (!subscription.is_active) return false;

  const fireAt = reminderDateFor(subscription.next_due_date);
  if (!fireAt) return false;

  return schedule({
    id: reminderId(subscription.id),
    date: fireAt,
    title: `${subscription.name} renews soon`,
    body: `Due in ${REMINDER_LEAD_DAYS} days.`,
    // Lets a future tap open straight to the subscription rather than the
    // home screen. Nothing reads it yet; it costs nothing to record now.
    data: { subscriptionId: subscription.id },
    channel: RENEWALS,
  });
}
