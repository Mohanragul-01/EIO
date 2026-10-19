/**
 * types.ts - the shapes this module works with.
 *
 * Each module owns its own types. Nothing here is exported to other modules,
 * and this file imports nothing from them. That's what "modules don't depend
 * on each other" looks like in practice.
 */

import type { RepeatFrom } from './recurrence';

export {
  describeRule,
  firstDueDate,
  nextDueDate,
  ruleOf,
  shortRule,
  toRule,
  upcomingDates,
  type RepeatFrom,
  type RepeatRule,
  type RuleInput,
} from './recurrence';

export type Priority = 'low' | 'normal' | 'high';

/** Which tab a task lives in. Also the interval a repeating task repeats on. */
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * How a closed task was closed. 'skipped' is a repeat deliberately passed over
 * (history stays honest: it was not done); 'wont_do' is a one-off abandoned.
 */
export type Outcome = 'done' | 'skipped' | 'wont_do';

/** One check item. The id is local to the task, only for list keys and edits. */
export type ChecklistItem = { id: string; text: string; done: boolean };

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
  /** Wall-clock 'HH:MM:SS' on the due date, or null for an all-day task. */
  due_time: string | null;
  /** Minutes before due_date + due_time to remind; null = no reminder. */
  reminder_offset_min: number | null;
  repeat_every: number;
  /** 0 = Sunday ... 6 = Saturday. See RepeatRule. */
  repeat_weekdays: number[] | null;
  repeat_anchor_day: number | null;
  repeat_nth: number | null;
  repeat_from: RepeatFrom;
  /**
   * Shared by every occurrence of a routine. Null on the first occurrence;
   * use seriesKey() rather than reading this directly.
   */
  series_id: string | null;
  /**
   * The date on the schedule this occurrence stands for. Rescheduling moves
   * due_date and leaves this, so the next occurrence steps from here and the
   * routine keeps its rhythm (see scheduleBase). Null on rows from v2.
   */
  scheduled_for: string | null;
  /** When it was closed. Null while open, and on rows closed by v2 before 0020. */
  completed_at: string | null;
  /** Null while open. Null on a done row means 'done' (v2 never set it). */
  outcome: Outcome | null;
  notes: string;
  checklist: ChecklistItem[];
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
  due_time?: string | null;
  reminder_offset_min?: number | null;
  repeat_every?: number;
  repeat_weekdays?: number[] | null;
  repeat_anchor_day?: number | null;
  repeat_nth?: number | null;
  repeat_from?: RepeatFrom;
  /** Settled by normalizeInput: a full edit puts the schedule where the due date is. */
  scheduled_for?: string | null;
  notes?: string;
  checklist?: ChecklistItem[];
};

/**
 * The key every occurrence of one routine shares. The first occurrence has no
 * series_id (its successors carry its id), so the key is whichever is set.
 */
export function seriesKey(todo: Pick<Todo, 'id' | 'series_id'>): string {
  return todo.series_id ?? todo.id;
}

/**
 * Where the schedule says an occurrence is - the base the next one is stepped
 * from. A rescheduled occurrence keeps its scheduled date, so moving
 * October's "every 2 months on the 15th" to 3 November still brings the next
 * one on 15 December, and pulling 1 November back to 28 October does not
 * bring 1 November straight back. Rows from v2 have only a due date.
 */
export function scheduleBase(todo: Pick<Todo, 'due_date' | 'scheduled_for'>): string | null {
  return todo.scheduled_for ?? todo.due_date;
}

/** How a closed row was closed, reading v2's done rows (no outcome) as done. */
export function outcomeOf(todo: Pick<Todo, 'is_done' | 'outcome'>): Outcome | null {
  if (!todo.is_done) return null;
  return todo.outcome ?? 'done';
}

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
