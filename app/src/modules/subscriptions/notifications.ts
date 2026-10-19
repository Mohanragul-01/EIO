/**
 * notifications.ts - renewal and trial reminders for subscriptions.
 *
 * WHAT to remind about and when is reminders.ts (pure, tested). HOW -
 * permission, channel, the Expo Go guard, scheduling - is core/notifications,
 * which every module with reminders shares; see that file for why
 * expo-notifications is never imported directly. This file joins the two.
 *
 * A reminder only exists on the phone that scheduled it, so a reinstall, a
 * new phone or an edit made on the website leaves them stale. rescheduleAll()
 * is the cure: api.ts registers it as this module's launch resync, so every
 * signed-in launch rebuilds them from the database.
 */
import { cancel, cancelPrefix, schedule, type Category, type Channel } from '../../core/notifications';
import {
  RENEWAL_CATEGORY,
  REMINDER_PREFIX,
  TRIAL_CATEGORY,
  reminderId,
  reminderPlan,
  type ReminderContext,
} from './reminders';
import type { ReminderSettings, Subscription } from './types';

export { ensurePermission, type PermissionState } from '../../core/notifications';
export { reminderId } from './reminders';

/** The channel these have always used, kept so a phone that already has it
 *  keeps the person's settings for it. */
const RENEWALS: Channel = { id: 'renewals', name: 'Renewal reminders' };

/** "Mark paid" opens the payment sheet: the amount is worth a glance first. */
const RENEWAL_BUTTONS: Category = {
  id: RENEWAL_CATEGORY,
  actions: [{ id: 'mark_paid', title: 'Mark paid' }],
};

const TRIAL_BUTTONS: Category = {
  id: TRIAL_CATEGORY,
  actions: [
    { id: 'keep', title: 'Keep it' },
    { id: 'cancelled', title: 'I cancelled' },
  ],
};

/**
 * Cancel every reminder this subscription has. Always safe, including when
 * none is scheduled, which is what lets every write path cancel-then-schedule
 * without checking first.
 *
 * The bare id is v2's single reminder, still on phones that scheduled one;
 * the prefix covers each offset's own reminder.
 */
export async function cancelReminders(subscriptionId: string): Promise<void> {
  await cancel(reminderId(subscriptionId));
  await cancelPrefix(`${reminderId(subscriptionId)}-`);
}

/**
 * Replace this subscription's reminders with its current plan. Resolves how
 * many were scheduled. Zero is a normal outcome - a cancelled subscription, a
 * phone without permission, Expo Go - and the subscription has saved either
 * way, so this never throws.
 */
export async function scheduleReminders(
  sub: Subscription,
  settings: ReminderSettings,
  context: ReminderContext = {},
  now: Date = new Date(),
): Promise<number> {
  // Cancel first, unconditionally: an edited date or a pause must not leave
  // the old plan's reminders behind.
  await cancelReminders(sub.id);
  return scheduleAll(sub, settings, context, now);
}

async function scheduleAll(
  sub: Subscription,
  settings: ReminderSettings,
  context: ReminderContext,
  now: Date,
): Promise<number> {
  let scheduled = 0;
  for (const reminder of reminderPlan(sub, settings, now, context)) {
    const ok = await schedule({
      id: reminder.id,
      date: reminder.date,
      title: reminder.title,
      body: reminder.body,
      data: reminder.data,
      channel: RENEWALS,
      category: reminder.kind === 'trial' ? TRIAL_BUTTONS : RENEWAL_BUTTONS,
    });
    if (ok) scheduled++;
  }
  return scheduled;
}

/**
 * Rebuild every subscription reminder from scratch: cancel all of them, then
 * schedule each row's plan. Rebuilt rather than patched, so a subscription
 * deleted on the website loses its reminders too.
 */
export async function rescheduleAll(
  rows: Subscription[],
  settings: ReminderSettings,
  contextFor: (sub: Subscription) => ReminderContext = () => ({}),
  now: Date = new Date(),
): Promise<void> {
  await cancelPrefix(REMINDER_PREFIX);
  for (const sub of rows) {
    await scheduleAll(sub, settings, contextFor(sub), now);
  }
}
