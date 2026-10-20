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
import type { Todo, TodoInput } from './types';

/** What an editor loaded: the date and the rule, as saved. */
export type Saved = Pick<
  Todo,
  | 'due_date'
  | 'is_repeat'
  | 'frequency'
  | 'repeat_every'
  | 'repeat_weekdays'
  | 'repeat_anchor_day'
  | 'repeat_nth'
  | 'repeat_from'
>;

function sameDays(
  a: readonly number[] | null | undefined,
  b: readonly number[] | null | undefined,
) {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((day, i) => day === y[i]);
}

/** Whether an edit left the date and the rule as they were saved. */
function sameSchedule(values: TodoInput, saved: Saved): boolean {
  if ((values.due_date ?? null) !== (saved.due_date ?? null)) return false;
  if (values.is_repeat !== saved.is_repeat) return false;
  // A one-off's rule columns decide nothing.
  if (!values.is_repeat) return true;
  return (
    values.frequency === saved.frequency &&
    values.repeat_every === saved.repeat_every &&
    values.repeat_from === saved.repeat_from &&
    (values.repeat_anchor_day ?? null) === (saved.repeat_anchor_day ?? null) &&
    (values.repeat_nth ?? null) === (saved.repeat_nth ?? null) &&
    sameDays(values.repeat_weekdays, saved.repeat_weekdays)
  );
}

/**
 * Where the schedule goes. A new task, or an edit that changed the date or
 * the rule, is scheduled where its due date now is. An edit that changed
 * neither - a note, a title, a checklist - leaves the saved scheduled_for
 * alone (the key is left out, so the column is not written): a rescheduled
 * occurrence keeps its place on the schedule, and saving a note on rent
 * pulled back to 28 October does not bring another 1 November rent.
 */
function withSchedule(values: TodoInput, saved: Saved | null): TodoInput {
  if (saved && sameSchedule(values, saved)) {
    const kept = { ...values };
    delete kept.scheduled_for;
    return kept;
  }
  return { ...values, scheduled_for: values.due_date };
}

/**
 * `saved` is the row as the editor loaded it, for an edit; leave it out for a
 * new task. Only a reschedule (a partial write of due_date) moves the date
 * without the schedule; see withSchedule for what a full edit does.
 */
export function normalizeInput(
  input: TodoInput,
  today: string,
  saved: Saved | null = null,
): TodoInput {
  const title = input.title.trim();
  if (!input.is_repeat) return withSchedule({ ...input, title }, saved);

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
        // No editor has a control for a yearly rule's day: it is the due
        // date's. So when an edit moves the date the day goes with it (a
        // birthday corrected from 15 March to 20 April falls on 20 April
        // next year, not 15 April); otherwise the saved day stands, which
        // keeps a rescheduled occurrence's own.
        anchorDay =
          saved && (saved.due_date ?? null) !== (input.due_date ?? null)
            ? baseDay
            : (input.repeat_anchor_day ?? baseDay);
        break;
      case 'daily':
        break;
    }
  }

  const rule = toRule({ frequency: input.frequency, every, weekdays, anchorDay, nth, from });

  const dueDate = input.due_date ?? firstDueDate(rule, today);
  return withSchedule(
    {
      ...input,
      title,
      repeat_every: every,
      repeat_from: from,
      repeat_weekdays: weekdays,
      repeat_anchor_day: anchorDay,
      repeat_nth: nth,
      due_date: dueDate,
    },
    saved,
  );
}

/**
 * The rule columns for a task moved to another frequency on the board, from
 * its due date: the weekday for weekly, the day of the month for monthly and
 * yearly, nothing for daily. Without this a weekly Mon/Thu task dragged to
 * Monthly kept its weekdays and no anchor day, and drifted at month end.
 */
export function ruleColumnsFor(
  frequency: TodoInput['frequency'],
  dueDate: string | null,
  today: string,
): Pick<TodoInput, 'repeat_weekdays' | 'repeat_anchor_day' | 'repeat_nth'> {
  const base = dueDate ?? today;
  return {
    repeat_weekdays: frequency === 'weekly' ? [weekdayOf(base)] : null,
    repeat_anchor_day:
      frequency === 'monthly' || frequency === 'yearly' ? Number(base.slice(8, 10)) : null,
    repeat_nth: null,
  };
}

/** A checklist as a new occurrence starts it: the same items, none ticked. */
export function resetChecklist<T extends { done: boolean }>(items: readonly T[]): T[] {
  return items.map((item) => ({ ...item, done: false }));
}
