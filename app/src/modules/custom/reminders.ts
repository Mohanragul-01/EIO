/**
 * reminders.ts - which reminders a module wants, as plain data.
 *
 * Two kinds, both set in the builder:
 *
 *   NUDGE  "Log sleep" at a set time on chosen weekdays, skipped on a day that
 *          already has an entry. A log is only as good as its consistency, and
 *          a nudge is the cheapest fix - but one that nags after you have
 *          already logged teaches you to ignore it.
 *   DATE   a reminder on each entry's date in a chosen date field ("Water the
 *          fern", "Return the library book"), on the day or N days before.
 *
 * Core notifications schedule one-off DATE triggers only, so a nudge is
 * planned as one dated reminder per day for the next 14 days, rebuilt on every
 * launch and every visit to the module. "Skip today if there is an entry" is
 * then just "do not plan today". Someone who opens nothing for two weeks stops
 * being nudged until they open the app; a repeating trigger could not be
 * skipped for one day at all.
 *
 * Pure, with `now` passed in, so every rule is tested without a clock or a
 * phone. notifications.ts does the scheduling.
 */
import { fromISODate, toISODate } from '../../core/date';
import { addDaysTo, dateFieldOf, entryDateOf } from './entryDate';
import { formatFieldValue, isISODay } from './format';
import { rowRoles } from './roles';
import type { CustomField, CustomModule, CustomRecord } from './types';

/** How far ahead nudges are planned. */
export const NUDGE_DAYS_AHEAD = 14;

/**
 * Date reminders scheduled per module. Android caps an app at about 500
 * pending alarms, shared by every module; the furthest dates wait for a later
 * rebuild rather than crowding everything else out.
 */
export const MAX_DATE_REMINDERS = 40;

/** When a date reminder fires if the module has no nudge time: Subscriptions' hour. */
const DATE_REMINDER_HOUR = 9;

export type PlannedReminder = {
  id: string;
  date: Date;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

/** Every id this module schedules starts with this, so it can cancel its own. */
export function modulePrefix(moduleId: string): string {
  return `custom-${moduleId}-`;
}

export function nudgeId(moduleId: string, day: string): string {
  return `${modulePrefix(moduleId)}nudge-${day}`;
}

export function dateReminderId(moduleId: string, recordId: string): string {
  return `${modulePrefix(moduleId)}date-${recordId}`;
}

/** 'HH:MM', 24-hour, exactly as the database checks it. */
export function parseReminderTime(text: string | null | undefined): { hour: number; minute: number } | null {
  if (!text) return null;
  const match = /^([01][0-9]|2[0-3]):([0-5][0-9])$/.exec(text);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
}

/** A local moment on a calendar day, built from parts so DST cannot shift it. */
function at(day: string, hour: number, minute: number): Date {
  const date = fromISODate(day);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
}

export function planReminders(
  module: Pick<
    CustomModule,
    | 'id'
    | 'name'
    | 'reminder_time'
    | 'reminder_days'
    | 'reminder_field_key'
    | 'reminder_offset_days'
    | 'title_field_key'
    | 'subtitle_field_key'
    | 'badge_field_key'
  >,
  fields: CustomField[],
  records: CustomRecord[],
  now: Date,
): PlannedReminder[] {
  const planned: PlannedReminder[] = [];
  const today = toISODate(now);
  const time = parseReminderTime(module.reminder_time);

  // NUDGES
  const days = module.reminder_days ?? [];
  if (time && days.length > 0) {
    const dateField = dateFieldOf(fields);
    // Logged today, or dated today: either way, today is done. Logging last
    // night's sleep this morning counts; so does ticking a habit dated today.
    const doneToday = records.some(
      (record) =>
        toISODate(new Date(record.created_at)) === today ||
        entryDateOf(record, dateField) === today,
    );

    for (let offset = 0; offset < NUDGE_DAYS_AHEAD; offset += 1) {
      const day = addDaysTo(today, offset);
      if (!days.includes(fromISODate(day).getDay())) continue;
      if (offset === 0 && doneToday) continue;
      const fireAt = at(day, time.hour, time.minute);
      if (fireAt.getTime() <= now.getTime()) continue;
      planned.push({
        id: nudgeId(module.id, day),
        date: fireAt,
        title: module.name,
        body: 'Nothing logged yet today.',
        // route/params: what the app-wide router opens on a tap.
        data: {
          moduleId: module.id,
          route: 'CustomModuleList',
          params: { moduleId: module.id },
        },
      });
    }
  }

  // DATE-FIELD REMINDERS
  const reminderField = fields.find(
    (field) => field.key === module.reminder_field_key && field.type === 'date',
  );
  if (reminderField) {
    const offset = module.reminder_offset_days ?? 0;
    const hour = time?.hour ?? DATE_REMINDER_HOUR;
    const minute = time?.minute ?? 0;
    const title = rowRoles(module, fields).title;
    const when = offset === 0 ? 'today' : `in ${offset} ${offset === 1 ? 'day' : 'days'}`;

    const upcoming = records
      .map((record) => {
        const value = record.data[reminderField.key];
        if (!isISODay(value)) return null;
        const fireAt = at(addDaysTo(value, -offset), hour, minute);
        return fireAt.getTime() > now.getTime() ? { record, fireAt } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
      .slice(0, MAX_DATE_REMINDERS);

    upcoming.forEach(({ record, fireAt }) => {
      planned.push({
        id: dateReminderId(module.id, record.id),
        date: fireAt,
        title: (title && formatFieldValue(title, record.data[title.key])) || module.name,
        body: `${reminderField.label.trim()}: ${when}`,
        data: {
          moduleId: module.id,
          recordId: record.id,
          route: 'CustomRecordEdit',
          params: { moduleId: module.id, recordId: record.id },
        },
      });
    });
  }

  return planned;
}
