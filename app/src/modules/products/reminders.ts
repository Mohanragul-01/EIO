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
 * Only moments still ahead are planned. A crossing that has already passed is
 * not re-armed for the next morning: with no "Ordered" action to silence it
 * yet, that would nag every day until restocked. The card is already red.
 *
 * A spare on the shelf means there is nothing to order, so it silences the
 * reorder morning and turns the empty day into "your next one is ready".
 *
 * Pure: notifications.ts does the scheduling, through core.
 */
import type { Outlook } from './outlook';
import { formatDayMonth, leadDaysOf } from './types';

/** Morning, so it lands before the day gets away from you. */
export const REMINDER_HOUR = 9;

/** Every Products reminder id starts with this, so a resync can clear them all. */
export const REMINDER_PREFIX = 'product-';

export type PlannedReminder = {
  id: string;
  date: Date;
  title: string;
  body: string;
  data: { productId: string };
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
    const data = { productId: product.id };

    if (reorderOn && !spare) {
      const date = morningOf(reorderOn);
      if (date.getTime() > now.getTime()) {
        const lead = leadDaysOf(product);
        plan.push({
          id: ids.reorder,
          date,
          title: `Time to reorder ${product.name}`,
          body: `About ${lead} ${lead === 1 ? 'day' : 'days'} left at your pace, empty around ${formatDayMonth(projection.emptyOn)}.`,
          data,
        });
      }
    }

    const emptyDate = morningOf(projection.emptyOn);
    if (emptyDate.getTime() > now.getTime()) {
      plan.push({
        id: ids.empty,
        date: emptyDate,
        title: `${product.name} is about empty`,
        body: spare
          ? 'Your next one is ready to open.'
          : 'At your pace it runs out today. Finish it and start the next one in EIO.',
        data,
      });
    }
  });

  return plan;
}
