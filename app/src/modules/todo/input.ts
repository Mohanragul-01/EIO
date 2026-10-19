/**
 * input.ts - settle a task's repeat columns before they are written.
 *
 * The editor, quick add and the website all build a TodoInput, and each could
 * leave the rule half-specified: a weekly repeat with no weekdays, a monthly
 * one with no anchor day, a repeat with no due date at all. Filling those in
 * at write time, in one pure function, is what makes a rescheduled occurrence
 * come back to its schedule (the weekday and anchor live in their own columns,
 * not only in the due date you just moved) and gives every repeat a date to
 * roll forward from.
 */
import { firstDueDate, toRule, weekdayOf, weekdayOrder } from './recurrence';
import type { TodoInput } from './types';

export function normalizeInput(input: TodoInput, today: string): TodoInput {
  const title = input.title.trim();
  if (!input.is_repeat) return { ...input, title };

  const every = Math.max(1, Math.floor(input.repeat_every ?? 1));
  const from = input.repeat_from ?? 'due';
  const base = input.due_date ?? today;
  const baseDay = Number(base.slice(8, 10));

  let weekdays: number[] | null = null;
  let anchorDay: number | null = null;
  let nth: number | null = null;

  // A from-completion rule is the interval alone, so it keeps none of these:
  // leaving a stale weekday behind would make the editor show an option that
  // does nothing.
  if (from === 'due') {
    switch (input.frequency) {
      case 'weekly':
        weekdays =
          input.repeat_weekdays && input.repeat_weekdays.length > 0
            ? weekdayOrder(input.repeat_weekdays)
            : [weekdayOf(base)];
        break;
      case 'monthly':
        if (input.repeat_nth !== null && input.repeat_nth !== undefined) {
          nth = input.repeat_nth;
          weekdays = [input.repeat_weekdays?.[0] ?? weekdayOf(base)];
        } else {
          anchorDay = input.repeat_anchor_day ?? baseDay;
        }
        break;
      case 'yearly':
        anchorDay = input.repeat_anchor_day ?? baseDay;
        break;
      case 'daily':
        break;
    }
  }

  const rule = toRule({ frequency: input.frequency, every, weekdays, anchorDay, nth, from });

  return {
    ...input,
    title,
    repeat_every: every,
    repeat_from: from,
    repeat_weekdays: weekdays,
    repeat_anchor_day: anchorDay,
    repeat_nth: nth,
    due_date: input.due_date ?? firstDueDate(rule, today),
  };
}

/** A checklist as a new occurrence starts it: the same items, none ticked. */
export function resetChecklist<T extends { done: boolean }>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item, done: false }));
}
