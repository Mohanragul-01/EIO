/**
 * reminders.ts - which reorder reminders to schedule, as plain data.
 *
 * Two per container in use with a measured projection:
 *
 *   the REORDER morning - the day it crosses into "Reorder now" (projected
 *   empty minus its lead time), so ordering then still arrives in time;
 *
 *   the EMPTY day - the day the projection says it runs out.
 *
 * Urgency bands only help when you open the screen, and running out of
 * creatine happens precisely when you are not looking.
 *
 * Both carry two buttons, which act without opening the app
 * (notificationRoutes.ts): ORDERED puts the next one on the shelf as a spare,
 * and IN 3 DAYS brings the reorder reminder back at 09:00 three days on.
 *
 * Only moments still ahead are planned. A crossing that has already passed is
 * not re-armed for the next morning: the card is already red, and a reminder
 * that came back every morning would nag until restocked. In 3 days is the
 * way to be asked again.
 *
 * A spare on the shelf means there is nothing to order, so it silences the
 * reorder morning and turns the empty day into "your next one is ready",
 * which needs no buttons.
 *
 * Pure: notifications.ts does the scheduling, through core.
 */
import { toISODate } from '../../core/date';
import type { Outlook } from './outlook';
import { addDays, formatDayMonth, leadDaysOf, type Product } from './types';

/** Morning, so it lands before the day gets away from you. */
export const REMINDER_HOUR = 9;

/** Every Products reminder id starts with this, so a resync can clear them all. */
export const REMINDER_PREFIX = 'product-';

/** Category ids may not contain ':' or '-' (the library's rule). */
export const REORDER_CATEGORY = 'product_reorder';

export const ACTION_ORDERED = 'ordered';
export const ACTION_LATER = 'later';

/** Fixed, and named on the button, since there is no settings screen to change it. */
export const LATER_DAYS = 3;

/**
 * What a reminder carries for a tap. One with buttons names only the product:
 * the app-wide router reads route/params for a button press too, and would
 * open the product for "In 3 days", so the Products handler opens it for a tap
 * instead (as Tasks does). One without buttons keeps route/params.
 */
export type ReminderData =
  | { productId: string; name: string }
  | { productId: string; route: 'ProductDetail'; params: { productId: string } };

export type PlannedReminder = {
  id: string;
  date: Date;
  title: string;
  body: string;
  /** REORDER_CATEGORY for Ordered and In 3 days, or null for no buttons. */
  category: string | null;
  data: ReminderData;
};

/**
 * Derived from the row id rather than stored, so cancelling never needs a
 * lookup and rescheduling can never leave an orphan behind.
 */
export function reminderIdsFor(productId: string): { reorder: string; empty: string } {
  return {
    reorder: `${REMINDER_PREFIX}${productId}-reorder`,
    empty: `${REMINDER_PREFIX}${productId}-empty`,
  };
}

/**
 * 09:00 local on a calendar day, built from (y, m, d) so the hour holds on
 * the day the clocks change.
 */
function morningOf(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day, REMINDER_HOUR, 0, 0, 0);
}

export function planReminders(outlooks: Outlook[], now: Date): PlannedReminder[] {
  const plan: PlannedReminder[] = [];

  outlooks.forEach((outlook) => {
    const { product, projection, reorderOn, spare } = outlook;
    // Measured projections only: an estimate is a guess, and a notification
    // built on a guess interrupts you with it.
    if (outlook.lifecycle !== 'in_use' || !projection.emptyOn) return;

    const ids = reminderIdsFor(product.id);
    const withButtons = {
      category: REORDER_CATEGORY,
      data: { productId: product.id, name: product.name },
    };

    if (reorderOn && !spare) {
      const date = morningOf(reorderOn);
      if (date.getTime() > now.getTime()) {
        const lead = leadDaysOf(product);
        plan.push({
          id: ids.reorder,
          date,
          title: `Time to reorder ${product.name}`,
          body: `About ${lead} ${lead === 1 ? 'day' : 'days'} left at your pace, empty around ${formatDayMonth(projection.emptyOn)}.`,
          ...withButtons,
        });
      }
    }

    const emptyDate = morningOf(projection.emptyOn);
    if (emptyDate.getTime() > now.getTime()) {
      plan.push({
        id: ids.empty,
        date: emptyDate,
        title: `${product.name} is about empty`,
        ...(spare
          ? {
              body: 'Your next one is ready to open.',
              category: null,
              data: {
                productId: product.id,
                route: 'ProductDetail' as const,
                params: { productId: product.id },
              },
            }
          : {
              body: 'At your pace it runs out today. Finish it and start the next one in EIO.',
              ...withButtons,
            }),
      });
    }
  });

  return plan;
}

/** When "In 3 days" brings a reminder back: 09:00 on the third day from now. */
export function laterDate(now: Date): Date {
  return morningOf(addDays(toISODate(now), LATER_DAYS));
}

/** The reorder reminder again, under its own id, as In 3 days shows it. */
export function laterReminder(product: Pick<Product, 'id' | 'name'>, date: Date): PlannedReminder {
  return {
    id: reminderIdsFor(product.id).reorder,
    date,
    title: `Time to reorder ${product.name}`,
    body: 'You asked to be reminded today. Ordered it? Tap Ordered.',
    category: REORDER_CATEGORY,
    data: { productId: product.id, name: product.name },
  };
}

/**
 * The snoozes to put back after a rebuild, which clears every Products
 * reminder first. `snoozes` maps a product id to when it comes back.
 *
 * Kept only while it still means something: the moment is ahead, the
 * container is still open with nothing waiting to replace it, and the plan
 * has no reorder reminder of its own for it (a slower pace moved the
 * crossing ahead again, and that reminder stands instead).
 */
export function planLater(
  outlooks: Outlook[],
  snoozes: Record<string, number>,
  plan: PlannedReminder[],
  now: Date,
): PlannedReminder[] {
  const planned = new Set(plan.map((reminder) => reminder.id));
  return outlooks.flatMap((outlook) => {
    const at = snoozes[outlook.product.id];
    if (typeof at !== 'number' || at <= now.getTime()) return [];
    if (outlook.lifecycle !== 'in_use' || outlook.spare) return [];
    if (planned.has(reminderIdsFor(outlook.product.id).reorder)) return [];
    return [laterReminder(outlook.product, new Date(at))];
  });
}
