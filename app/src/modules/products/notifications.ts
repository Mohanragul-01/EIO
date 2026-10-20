/**
 * notifications.ts - reorder reminders for products.
 *
 * WHAT and WHEN live in reminders.ts, as tested data. HOW - permission, the
 * Android channel, the Expo Go guard, buttons - lives in core/notifications,
 * shared by every module with reminders. This file only joins the two, and
 * keeps the one thing the database does not: when "In 3 days" was asked for.
 *
 * Rebuilt, never patched: every change cancels all `product-` reminders and
 * schedules the plan again. A product's reminders depend on its siblings (a
 * spare silences one) and on every use logged, so working out which single
 * reminder changed would be more code than redoing a dozen.
 *
 * The launch resync is registered in api.ts, not here, because it has to read
 * the database and only api.ts may; registering here would make the two
 * files import each other. What the buttons do is notificationRoutes.ts.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { cancelPrefix, schedule, type Category, type Channel } from '../../core/notifications';
import type { Outlook } from './outlook';
import {
  ACTION_LATER,
  ACTION_ORDERED,
  LATER_DAYS,
  laterDate,
  laterReminder,
  planLater,
  planReminders,
  REMINDER_PREFIX,
  REORDER_CATEGORY,
  type PlannedReminder,
} from './reminders';
import type { Product } from './types';

export { ensurePermission, type PermissionState } from '../../core/notifications';

/** Its own channel, so reorder nudges can be muted without muting renewals. */
export const PRODUCTS_CHANNEL: Channel = { id: 'products', name: 'Reorder reminders' };

/**
 * The buttons on a reorder reminder. Both act without opening the app: one
 * adds a spare, the other moves the reminder, and neither needs a screen.
 */
export const REORDER_BUTTONS: Category = {
  id: REORDER_CATEGORY,
  actions: [
    { id: ACTION_ORDERED, title: 'Ordered' },
    { id: ACTION_LATER, title: `In ${LATER_DAYS} days` },
  ],
  opensApp: false,
};

/**
 * Pending "In 3 days", product id -> when, kept on the device.
 *
 * A snooze reuses the reorder reminder's id, and every rebuild begins by
 * clearing every product- reminder - after the next log, or the next time
 * the list opens - from data where a snooze does not exist. Without a record
 * of it, the snooze would last only until then. planLater says which to put
 * back.
 */
const SNOOZE_KEY = 'eio.products.snoozes';

async function loadSnoozes(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

async function saveSnoozes(snoozes: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(snoozes));
  } catch {
    // A lost record costs one snooze at worst, never the product.
  }
}

function scheduleOne(reminder: PlannedReminder): Promise<boolean> {
  return schedule({
    id: reminder.id,
    date: reminder.date,
    title: reminder.title,
    body: reminder.body,
    data: reminder.data,
    channel: PRODUCTS_CHANNEL,
    ...(reminder.category === REORDER_CATEGORY ? { category: REORDER_BUTTONS } : {}),
  });
}

/**
 * One rebuild or snooze at a time. Two loads landing close together would
 * otherwise interleave - the second's cancel running between the first's
 * schedules - and a snooze scheduled during a rebuild could be cancelled by
 * it after the rebuild had read the snoozes.
 */
let queue: Promise<unknown> = Promise.resolve();

function inTurn<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  // core never throws, but a chain that rejected once would stay rejected.
  const next = queue.then(run).catch(() => fallback);
  queue = next;
  return next;
}

/**
 * Replace every Products reminder with the plan for these outlooks, and put
 * back the snoozes that still apply. Never throws: a reminder that cannot be
 * scheduled (Expo Go, no permission, a past moment) is a normal outcome, and
 * the data it was planned from is already saved either way.
 */
export function replaceReminders(outlooks: Outlook[], now: Date = new Date()): Promise<void> {
  const plan = planReminders(outlooks, now);
  return inTurn(async () => {
    await cancelPrefix(REMINDER_PREFIX);
    for (const reminder of plan) await scheduleOne(reminder);

    const later = planLater(outlooks, await loadSnoozes(), plan, now);
    for (const reminder of later) await scheduleOne(reminder);
    // Only those still meaning something are kept: a spare, a finish or a
    // passed moment ends a snooze for good.
    await saveSnoozes(
      Object.fromEntries(
        later.map((reminder) => [reminder.data.productId, reminder.date.getTime()]),
      ),
    );
  }, undefined);
}

/**
 * "In 3 days": the reorder reminder again at 09:00 on the third day, under
 * its own id, with its buttons. Recorded first, then scheduled, in turn with
 * the rebuilds (see the queue). Resolves whether it is scheduled.
 */
export function snoozeReorder(
  product: Pick<Product, 'id' | 'name'>,
  now: Date = new Date(),
): Promise<boolean> {
  const reminder = laterReminder(product, laterDate(now));
  return inTurn(async () => {
    const snoozes = await loadSnoozes();
    await saveSnoozes({ ...snoozes, [product.id]: reminder.date.getTime() });
    return scheduleOne(reminder);
  }, false);
}
