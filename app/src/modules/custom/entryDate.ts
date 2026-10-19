/**
 * entryDate.ts - which calendar day an entry belongs to, and the weeks and
 * months built from days.
 *
 * ONE DATE FIELD PER MODULE. The chart's time axis, the calendar view, the
 * This week / This month chips, the tile's period and "today already has an
 * entry" all ask "when was this?", and they must all get the same answer or
 * the calendar and the chart would disagree about the same entry. The answer
 * is the module's first date field, by position; a module without one, or an
 * entry that left it blank, uses the day the entry was logged.
 *
 * Every day here is a 'YYYY-MM-DD' string, and every step between days is
 * built from (year, month, day) rather than by adding 24 hours, which on a
 * daylight-saving change lands an hour off and can slip a whole day.
 */
import { fromISODate, toISODate } from '../../core/date';
import { isISODay } from './format';
import type { CustomField, CustomRecord, SummaryPeriod } from './types';

/** The module's date field: the first one by position, or null. */
export function dateFieldOf(fields: CustomField[]): CustomField | null {
  return [...fields].sort((a, b) => a.position - b.position).find((f) => f.type === 'date') ?? null;
}

/**
 * The day an entry is about. The date field when it holds a real day,
 * otherwise the LOCAL day it was logged - created_at is an instant, and its
 * UTC day is tomorrow for anything logged late in the evening in India.
 */
export function entryDateOf(record: CustomRecord, dateField: CustomField | null): string {
  if (dateField) {
    const value = record.data[dateField.key];
    if (isISODay(value)) return value;
  }
  return toISODate(new Date(record.created_at));
}

/** A day shifted by whole calendar days. */
export function addDaysTo(iso: string, days: number): string {
  const date = fromISODate(iso);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** The Monday of the week containing this day. */
export function weekStartISO(iso: string): string {
  const date = fromISODate(iso);
  // getDay counts from Sunday; this counts back to Monday.
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDaysTo(iso, -sinceMonday);
}

/** The 1st of the month containing this day. */
export function monthStartISO(iso: string): string {
  return `${iso.slice(0, 8)}01`;
}

/**
 * The first and last day of the calendar week or month containing `today`.
 * A calendar period, not "the last 7 days", so a plant to water on Friday
 * counts as this week on Monday.
 */
export function periodBounds(
  period: SummaryPeriod,
  today: string,
): { start: string; end: string } | null {
  if (period === 'week') {
    const start = weekStartISO(today);
    return { start, end: addDaysTo(start, 6) };
  }
  if (period === 'month') {
    const start = monthStartISO(today);
    const date = fromISODate(start);
    // Day 0 of the next month is the last day of this one.
    return {
      start,
      end: toISODate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
    };
  }
  return null;
}

/** Whether a day falls in the period around `today`. 'all' contains everything. */
export function inPeriod(iso: string, period: SummaryPeriod, today: string): boolean {
  const bounds = periodBounds(period, today);
  if (!bounds) return true;
  // 'YYYY-MM-DD' strings compare correctly as text.
  return iso >= bounds.start && iso <= bounds.end;
}
