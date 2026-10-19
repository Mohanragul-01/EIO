/**
 * journal.ts - what makes a journal worth re-reading.
 *
 * Journaling only pays off when you read it back, so the Journal tab offers
 * three nudges: entries from this date in earlier years ("On this day"), a
 * streak of consecutive days, and a prompt when today is still blank. All of
 * them derive from entry_date - the day an entry is ABOUT - which EIO already
 * stores, so none of this needs a column.
 *
 * Every date here is a calendar day, 'YYYY-MM-DD', moved with calendar
 * arithmetic (core/date), never with milliseconds: on the day the clocks
 * change, "24 hours ago" is not yesterday.
 */
import { fromISODate, toISODate } from '../../core/date';
import { isLive } from './library';
import type { Note } from './types';

type Entry = Pick<Note, 'entry_date' | 'created_at' | 'deleted_at' | 'archived_at'>;

/** A calendar day shifted by whole days, through local calendar fields. */
export function shiftISO(iso: string, days: number): string {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Entries from this month and day in earlier years, most recent year first.
 *
 * An entry from 29 February would otherwise surface once every four years,
 * so in a year without one it shows on the 28th.
 */
export function onThisDay<T extends Entry>(
  entries: readonly T[],
  today: string,
): { note: T; yearsAgo: number }[] {
  const year = Number(today.slice(0, 4));
  const monthDay = today.slice(5);
  const days = new Set([monthDay]);
  if (monthDay === '02-28' && !isLeapYear(year)) days.add('02-29');

  return entries
    .filter((e): e is T & { entry_date: string } => isLive(e) && e.entry_date !== null)
    .filter((e) => Number(e.entry_date.slice(0, 4)) < year && days.has(e.entry_date.slice(5)))
    .map((note) => ({ note, yearsAgo: year - Number(note.entry_date.slice(0, 4)) }))
    .sort((a, b) => a.yearsAgo - b.yearsAgo || b.note.created_at.localeCompare(a.note.created_at));
}

/**
 * Consecutive days with at least one entry, ending today - or ending
 * yesterday while today has not been written yet, since the day is not over
 * and a streak that read 0 every morning would punish journaling at night.
 *
 * A backdated entry counts: that day was journaled, whenever it was typed.
 */
export function journalStreak(entries: readonly Entry[], today: string): number {
  const days = entryDays(entries);
  let day = days.has(today) ? today : shiftISO(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = shiftISO(day, -1);
  }
  return streak;
}

/** The last seven days, oldest first: the dot strip beside the streak. */
export function weekStrip(
  entries: readonly Entry[],
  today: string,
): { date: string; hasEntry: boolean; isToday: boolean }[] {
  const days = entryDays(entries);
  return Array.from({ length: 7 }, (_, i) => {
    const date = shiftISO(today, i - 6);
    return { date, hasEntry: days.has(date), isToday: date === today };
  });
}

function entryDays(entries: readonly Entry[]): Set<string> {
  const days = new Set<string>();
  entries.forEach((e) => {
    if (isLive(e) && e.entry_date) days.add(e.entry_date);
  });
  return days;
}

/**
 * Today's entry, if one exists: the most recently written when there are
 * several. The create button opens it rather than starting a duplicate, the
 * way a daily note does.
 */
export function todaysEntry<T extends Entry>(entries: readonly T[], today: string): T | null {
  const found = entries
    .filter((e) => isLive(e) && e.entry_date === today)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return found[0] ?? null;
}

/**
 * Prompts for a blank page. Written for one person keeping their own record,
 * so they ask about the day rather than about "your brand" or "your team".
 */
export const JOURNAL_PROMPTS: readonly string[] = [
  'What took most of your attention today?',
  'What went better than you expected?',
  'What would you do differently if you had today again?',
  'Who did you talk to today, and what stayed with you?',
  'What are you looking forward to this week?',
  'What drained your energy today, and what gave it back?',
  'What did you learn today, however small?',
  'What are you grateful for right now?',
  'What are you putting off, and why?',
  'Describe a moment from today you want to remember.',
  'What did your body need today? Did it get it?',
  'What decision are you weighing at the moment?',
  'What made you laugh recently?',
  'What is worrying you, and how much of it is in your control?',
  'What did you spend on today that was worth it?',
  'What would make tomorrow a good day?',
  'Which habit is serving you well lately?',
  'Where did your time go today?',
  'What are you proud of this week?',
  'What is something you want to stop doing?',
  'Who would you like to thank, and for what?',
  'What surprised you today?',
  'What did you read, watch or hear that made you think?',
  'How did you move today: training, walking, stretching?',
  'What is one small thing you can finish tomorrow?',
  'What does a good week look like for you right now?',
  'What did you eat today, and how did it leave you feeling?',
  'Which conversation do you need to have?',
  'What is on your mind as the day ends?',
  'What would your future self thank you for doing today?',
  'What did you notice about your mood today?',
  'Which plan changed today, and how did you handle it?',
  'What are you curious about lately?',
  'What went unsaid today?',
  'What is the best thing that has happened since your last entry?',
  'What are you holding on to that you could let go of?',
  'Which goal moved forward today, even a little?',
  'What did today teach you about yourself?',
  'What are three things that went well today?',
  'If today had a title, what would it be?',
];

/**
 * The prompt for a day, `shuffle` steps further along the list.
 *
 * Chosen by the date rather than at random, so it stays the same all day -
 * on the phone, on the website and after a restart - and Shuffle walks the
 * list instead of rolling dice that might repeat. The day number is counted
 * in UTC from the date's own fields, so the machine's zone cannot move it.
 */
export function promptFor(today: string, shuffle: number): string {
  const [y, m, d] = today.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const n = JOURNAL_PROMPTS.length;
  return JOURNAL_PROMPTS[(((dayNumber + shuffle) % n) + n) % n];
}
