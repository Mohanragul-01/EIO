/**
 * notifications.ts - reorder reminders for products.
 *
 * WHAT and WHEN live in reminders.ts, as tested data. HOW - permission, the
 * Android channel, the Expo Go guard - lives in core/notifications, shared by
 * every module with reminders. This file only joins the two.
 *
 * Rebuilt, never patched: every change cancels all `product-` reminders and
 * schedules the plan again. A product's reminders depend on its siblings (a
 * spare silences one) and on every use logged, so working out which single
 * reminder changed would be more code than redoing a dozen.
 *
 * The launch resync is registered in api.ts, not here, because it has to read
 * the database and only api.ts may; registering here would make the two
 * files import each other.
 */
import { cancelPrefix, schedule, type Channel } from '../../core/notifications';
import type { Outlook } from './outlook';
import { planReminders, REMINDER_PREFIX } from './reminders';

export { ensurePermission, type PermissionState } from '../../core/notifications';

/** Its own channel, so reorder nudges can be muted without muting renewals. */
export const PRODUCTS_CHANNEL: Channel = { id: 'products', name: 'Reorder reminders' };

/**
 * One rebuild at a time. Two loads landing close together would otherwise
 * interleave - the second's cancel running between the first's schedules -
 * and leave whichever reminders happened to be scheduled last.
 */
let queue: Promise<void> = Promise.resolve();

/**
 * Replace every Products reminder with the plan for these outlooks. Never
 * throws: a reminder that cannot be scheduled (Expo Go, no permission, a past
 * moment) is a normal outcome, and the data it was planned from is already
 * saved either way.
 */
export function replaceReminders(outlooks: Outlook[], now: Date = new Date()): Promise<void> {
  const plan = planReminders(outlooks, now);
  queue = queue
    .then(async () => {
      await cancelPrefix(REMINDER_PREFIX);
      for (const reminder of plan) {
        await schedule({ ...reminder, channel: PRODUCTS_CHANNEL });
      }
    })
    .catch(() => {
      // core never throws, but a chain that rejected once would stay rejected.
    });
  return queue;
}
