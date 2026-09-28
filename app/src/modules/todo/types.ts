/**
 * types.ts - the shapes this module works with.
 *
 * Each module owns its own types. Nothing here is exported to other modules,
 * and this file imports nothing from them. That's what "modules don't depend
 * on each other" looks like in practice.
 */

import { addInterval, todayISO } from '../../core/date';

export type Priority = 'low' | 'normal' | 'high';

/** Which tab a task lives in. Also the interval a repeating task repeats on. */
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** A row exactly as it comes back from the `todos` table. */
export type Todo = {
  id: string;
  user_id: string;
  title: string;
  /** ISO calendar date, 'YYYY-MM-DD'. Null when no due date is set. */
  due_date: string | null;
  is_done: boolean;
  priority: Priority;
  /** Which tab this task belongs to. */
  frequency: Frequency;
  /** When true, completing this task creates the next occurrence. */
  is_repeat: boolean;
  /**
   * Manual order within its frequency column, lowest first.
   *
   * Set by dragging on the web board and by nothing else. The phone does not
   * offer reordering, but it reads the column so both clients show the same
   * order - which is the point of storing it rather than keeping it local.
   */
  position: number;
  created_at: string;
  updated_at: string;
};

/**
 * What the FORM collects - deliberately not the same as `Todo`.
 *
 * The database owns id, user_id, created_at and updated_at; the user never
 * types them. Keeping the input type separate means TypeScript stops us from
 * accidentally trying to send a server-managed column in an insert.
 */
export type TodoInput = {
  title: string;
  due_date: string | null;
  priority: Priority;
  frequency: Frequency;
  is_repeat: boolean;
};

/** Ordered for use in a segmented picker; also drives the color lookup below. */
export const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

/**
 * Priority to colour: red for high, blue for normal, green for low.
 *
 * A function rather than a constant map, because the palette changes with the
 * theme and a module-scope map would freeze whichever one was loaded first.
 *
 * ALL THREE ARE COLOURED. An earlier version coloured only "high", reasoning
 * that colouring everything makes nothing stand out - true of decorative
 * colour, but priority is a SCALE, and a scale you can read one third of is
 * not a scale. It also makes an uncoloured row mean something is wrong rather
 * than "probably normal". The web client uses the same three.
 */
export function priorityColor(
  priority: Priority,
  colors: { priorityHigh: string; priorityNormal: string; priorityLow: string },
): string {
  switch (priority) {
    case 'high':
      return colors.priorityHigh;
    case 'low':
      return colors.priorityLow;
    default:
      return colors.priorityNormal;
  }
}

export const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

/**
 * The due date of the NEXT occurrence of a repeating task.
 *
 * THE RULE THAT MATTERS: the next date is computed from the task's OWN due
 * date, never from today or from when you ticked it off. Anchoring to the
 * completion moment would make a daily task drift by a day every time you
 * finished it late, so a habit you keep imperfectly would slowly slide across
 * the calendar. Anchoring to the original due date means a Monday task stays a
 * Monday task no matter when you actually got to it.
 *
 * A repeating task with no due date has nothing to anchor to, so it falls back
 * to today. That case only arises because a due date is optional while a
 * frequency is required.
 *
 * Pure, and separate from the database call, so the arithmetic can be tested
 * without a network or a clock fixture.
 */
export function nextDueDate(currentDueDate: string | null, frequency: Frequency): string {
  return addInterval(currentDueDate ?? todayISO(), frequency);
}
