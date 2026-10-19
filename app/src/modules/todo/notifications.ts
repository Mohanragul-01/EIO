/**
 * notifications.ts - task reminders and the daily "plan your day" digest.
 *
 * What to remind about and when lives here; HOW (permission, channels, the
 * Expo Go guard, buttons, routing a press) lives in core/notifications, which
 * every module with reminders shares. Nothing here reads the database: api.ts
 * owns that and hands rows in, which keeps this file free of a cycle with it
 * and lets the website import it harmlessly (there, every call is a no-op).
 *
 *  IDS
 * Every id starts with `task-`, so the launch resync can clear the module's
 * reminders in one sweep and rebuild them from the database. A task's
 * reminder is `task-<row id>`, derived rather than stored, so cancelling can
 * never miss. Digests are `task-digest-<day>`; row ids are uuids, so the two
 * cannot collide.
 *
 *  THE DIGEST
 * A daily trigger repeats one fixed text, and a digest that says "3 overdue"
 * on a day with none is worse than no digest. So it is scheduled as one dated
 * notification per day for the next week, each with that day's projected
 * counts (what is open now, if nothing more were done), and rebuilt whenever
 * tasks change in the app and at every launch. A day with nothing overdue or
 * due gets none. Projected counts go stale only if the app is not opened for
 * days, or tasks change on the website in between.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  canNotify,
  cancel,
  cancelPrefix,
  registerCategory,
  schedule,
  type Channel,
} from '../../core/notifications';
import { addDays, ruleOf, shortRule } from './recurrence';
import { formatTime } from './today';
import type { Todo } from './types';

export { ensurePermission, type PermissionState } from '../../core/notifications';

/** Its own channel, so task reminders can be muted without muting renewals. */
export const TASK_CHANNEL: Channel = { id: 'tasks', name: 'Task reminders' };

/** Category ids may not contain ':' or '-' (the library's rule). */
export const REMINDER_CATEGORY = 'task_reminder';
export const DIGEST_CATEGORY = 'task_digest';

export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';

/** Fixed, and named on the button, since there is no settings screen to change it. */
export const SNOOZE_MINUTES = 30;

export const REMINDER_PREFIX = 'task-';
const DIGEST_PREFIX = 'task-digest-';

export function reminderId(taskId: string): string {
  return `${REMINDER_PREFIX}${taskId}`;
}

/* WHEN A TASK REMINDS ------------------------------------------------------- */

/** The offsets the editor offers, in minutes before the due time. */
export const REMINDER_OFFSETS = [0, 5, 15, 30, 60, 1440] as const;

export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'At time';
  if (minutes < 60) return `${minutes} min before`;
  if (minutes === 60) return '1 hour before';
  if (minutes % 1440 === 0) return minutes === 1440 ? '1 day before' : `${minutes / 1440} days before`;
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} min before`;
}

/**
 * When a task's reminder fires, or null if it has none or the moment has
 * passed.
 *
 * A reminder needs a time: an all-day task has no moment to be reminded at,
 * and inventing one is a guess. The digest covers those.
 *
 * Built from the date's parts at local wall-clock time, minutes subtracted
 * through the Date constructor, so "1 day before 7 pm" is 7 pm the day before
 * even across a daylight-saving change.
 */
export function reminderDateFor(
  todo: Pick<Todo, 'is_done' | 'due_date' | 'due_time' | 'reminder_offset_min'>,
  now: Date = new Date(),
): Date | null {
  if (todo.is_done || !todo.due_date || !todo.due_time || todo.reminder_offset_min === null) {
    return null;
  }
  const [y, m, d] = todo.due_date.split('-').map(Number);
  const [h, mi] = todo.due_time.split(':').map(Number);
  const fireAt = new Date(y, m - 1, d, h, mi - todo.reminder_offset_min);
  return fireAt.getTime() > now.getTime() ? fireAt : null;
}

/** "Due 7 pm" or "Due 7 pm · Mon, Thu": the title is the task itself. */
export function reminderBody(
  todo: Pick<Todo, 'due_time' | 'is_repeat'> & Parameters<typeof ruleOf>[0],
): string {
  const due = todo.due_time ? `Due ${formatTime(todo.due_time)}` : 'Due today';
  return todo.is_repeat ? `${due} · ${shortRule(ruleOf(todo))}` : due;
}

/* THE DIGEST ---------------------------------------------------------------- */

export type DigestSettings = { enabled: boolean; hour: number; minute: number };

/** Off until turned on: asking for permission at launch is the prompt people refuse. */
export const DEFAULT_DIGEST: DigestSettings = { enabled: false, hour: 8, minute: 0 };

const DIGEST_KEY = 'eio.tasks.digest';

/** Per device, like the notifications themselves. A bad value reads as the default. */
export async function loadDigestSettings(): Promise<DigestSettings> {
  try {
    const raw = await AsyncStorage.getItem(DIGEST_KEY);
    if (!raw) return DEFAULT_DIGEST;
    const parsed = JSON.parse(raw) as Partial<DigestSettings>;
    const hour = Number(parsed.hour);
    const minute = Number(parsed.minute);
    return {
      enabled: parsed.enabled === true,
      hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_DIGEST.hour,
      minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : DEFAULT_DIGEST.minute,
    };
  } catch {
    return DEFAULT_DIGEST;
  }
}

export async function saveDigestSettings(settings: DigestSettings): Promise<void> {
  await AsyncStorage.setItem(DIGEST_KEY, JSON.stringify(settings));
}

export type DigestEntry = { id: string; day: string; date: Date; body: string };

export function digestBody(overdue: number, dueToday: number): string {
  if (overdue > 0 && dueToday > 0) return `${overdue} overdue · ${dueToday} today`;
  if (overdue > 0) return `${overdue} overdue`;
  return `${dueToday} today`;
}

/**
 * The digests for the next `days` days, from what is open now. On a given
 * day, everything due before it counts as overdue (if it is still open then,
 * it will be) and everything due on it as today's.
 */
export function digestPlan(
  open: readonly { due_date: string | null }[],
  settings: DigestSettings,
  today: string,
  now: Date = new Date(),
  days = 7,
): DigestEntry[] {
  if (!settings.enabled) return [];
  const entries: DigestEntry[] = [];
  for (let i = 0; i < days; i++) {
    const day = addDays(today, i);
    let overdue = 0;
    let dueToday = 0;
    for (const row of open) {
      if (!row.due_date) continue;
      if (row.due_date < day) overdue += 1;
      else if (row.due_date === day) dueToday += 1;
    }
    if (overdue === 0 && dueToday === 0) continue;
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(y, m - 1, d, settings.hour, settings.minute);
    if (date.getTime() <= now.getTime()) continue;
    entries.push({ id: `${DIGEST_PREFIX}${day}`, day, date, body: digestBody(overdue, dueToday) });
  }
  return entries;
}

/* SCHEDULING ---------------------------------------------------------------- */

/** The buttons on a task reminder. Registered before the first one is scheduled. */
function ensureCategory(): Promise<boolean> {
  return registerCategory(REMINDER_CATEGORY, [
    { id: ACTION_DONE, title: 'Done' },
    { id: ACTION_SNOOZE, title: `Snooze ${SNOOZE_MINUTES} min` },
  ]);
}

async function scheduleTask(todo: Todo, now: Date): Promise<void> {
  const at = reminderDateFor(todo, now);
  if (!at) return;
  await ensureCategory();
  await schedule({
    id: reminderId(todo.id),
    date: at,
    title: todo.title,
    body: reminderBody(todo),
    data: { taskId: todo.id },
    channel: TASK_CHANNEL,
    category: REMINDER_CATEGORY,
  });
}

/**
 * Bring each row's reminder in line with the row: cancel whatever is there,
 * then schedule again if the row still wants one. A closed row ends up with
 * none. Never throws (core's functions do not).
 */
export async function syncReminders(rows: readonly Todo[], now: Date = new Date()): Promise<void> {
  for (const row of rows) {
    await cancel(reminderId(row.id));
    await scheduleTask(row, now);
  }
}

export async function cancelReminders(ids: readonly string[]): Promise<void> {
  for (const id of ids) await cancel(reminderId(id));
}

/** Replace the digests with ones for `open`. */
export async function scheduleDigests(
  open: readonly { due_date: string | null }[],
  settings: DigestSettings,
  today: string,
  now: Date = new Date(),
): Promise<void> {
  await cancelPrefix(DIGEST_PREFIX);
  for (const entry of digestPlan(open, settings, today, now)) {
    await schedule({
      id: entry.id,
      date: entry.date,
      title: 'Plan your day',
      body: entry.body,
      data: { day: entry.day },
      channel: TASK_CHANNEL,
      // Routes a tap to Today. No buttons are registered for it: a tap is the
      // whole action.
      category: DIGEST_CATEGORY,
    });
  }
}

/**
 * Rebuild everything from the database's open tasks - the launch resync, run
 * only where reminders can fire (see core runResync).
 */
export async function rebuildAll(open: readonly Todo[], today: string, now: Date = new Date()): Promise<void> {
  await cancelPrefix(REMINDER_PREFIX);
  for (const row of open) await scheduleTask(row, now);
  await scheduleDigests(open, await loadDigestSettings(), today, now);
}

/** Show the same reminder again in SNOOZE_MINUTES, under the same id. */
export async function snooze(
  notificationId: string,
  content: { title: string | null; body: string | null; data: Record<string, unknown> },
  now: Date = new Date(),
): Promise<boolean> {
  await ensureCategory();
  return schedule({
    id: notificationId,
    date: new Date(now.getTime() + SNOOZE_MINUTES * 60_000),
    title: content.title ?? 'Task',
    body: content.body ?? '',
    data: content.data,
    channel: TASK_CHANNEL,
    category: REMINDER_CATEGORY,
  });
}

let digestTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Rebuild the digests shortly after a change, once for a burst of changes
 * (ticking five tasks is one rebuild, not five). Reads nothing at all where
 * reminders cannot fire or the digest is off.
 */
export function refreshDigestsSoon(
  loadOpen: () => Promise<{ due_date: string | null }[]>,
  today: () => string,
): void {
  if (digestTimer) clearTimeout(digestTimer);
  digestTimer = setTimeout(() => {
    digestTimer = null;
    void (async () => {
      try {
        const settings = await loadDigestSettings();
        if (!settings.enabled || !(await canNotify())) return;
        await scheduleDigests(await loadOpen(), settings, today());
      } catch {
        // No network: the next change or launch rebuilds them.
      }
    })();
  }, 1500);
}

/** Turning the digest off cancels what is already scheduled, straight away. */
export async function cancelDigests(): Promise<void> {
  await cancelPrefix(DIGEST_PREFIX);
}
