/**
 * types.ts - the shapes this module works with.
 *
 * Each module owns its own types. Nothing here is exported to other modules,
 * and this file imports nothing from them. That's what "modules don't depend
 * on each other" looks like in practice.
 */

export type Priority = 'low' | 'normal' | 'high';

/** A row exactly as it comes back from the `todos` table. */
export type Todo = {
  id: string;
  user_id: string;
  title: string;
  /** ISO calendar date, 'YYYY-MM-DD'. Null when no due date is set. */
  due_date: string | null;
  is_done: boolean;
  priority: Priority;
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
};

/** Ordered for use in a segmented picker; also drives the color lookup below. */
export const PRIORITIES: Priority[] = ['low', 'normal', 'high'];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
};

/**
 * Priority to accent colour, resolved against the active palette.
 *
 * A function rather than a constant map, because the palette changes with the
 * theme and a module-scope map would freeze whichever one was loaded first.
 *
 * Only "high" gets a loud colour. If every priority were coloured, none of
 * them would read as urgent.
 */
export function priorityColor(
  priority: Priority,
  colors: { textMuted: string; accentIndigo: string; accentRose: string },
): string {
  switch (priority) {
    case 'high':
      return colors.accentRose;
    case 'low':
      return colors.textMuted;
    default:
      return colors.accentIndigo;
  }
}
