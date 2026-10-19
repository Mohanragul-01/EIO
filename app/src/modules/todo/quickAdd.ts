/**
 * quickAdd.ts - read a one-line task the way it was typed.
 *
 *     "Pay rent every month on the 1st !high"   -> no, see below
 *     "Pay rent every 1st !high"                -> monthly on the 1st, high
 *     "Call mum tomorrow at 7pm"                -> tomorrow, 19:00
 *     "Renew insurance 19/10"                   -> 19 October (DAY FIRST)
 *
 * A small hand-written grammar rather than a library: the vocabulary is EIO's
 * (four frequencies, three priorities, day-first dates), every rule here is
 * one the tests name, and a misread costs a tap on its chip to turn it back
 * into text - so the grammar can afford to be simple and predictable rather
 * than clever. Todoist's parser is praised for exactly that escape hatch.
 *
 * Pure. `today` and the current minute are passed in, so "at 7" can mean the
 * next 7 o'clock and the tests need no clock.
 *
 * HOW IT READS. The text is scanned word by word. At each word start the
 * matchers are tried in turn - repeat, date, time, priority - each a regex
 * anchored at that position and required to end at a word boundary. A
 * connector ("on", "at", "by", "due") directly before a date or time is taken
 * with it, so "Call at 7pm" leaves "Call", not "Call at". The first token of
 * each kind wins; later ones stay in the title. Whatever is left, tidied, is
 * the title.
 */
import { addMonths } from '../../core/date';
import {
  addDays,
  describeRule,
  firstDueDate,
  mondayIndex,
  stepOnce,
  toRule,
  weekdayOf,
  WEEKDAY_SHORT,
  type RepeatRule,
} from './recurrence';
import { formatTime } from './today';
import type { Frequency, Priority, TodoInput } from './types';

export type QuickTokenKind = 'date' | 'time' | 'repeat' | 'priority';

/** A recognised stretch of the text, drawn as a tappable chip. */
export type QuickToken = {
  kind: QuickTokenKind;
  start: number;
  end: number;
  /** The text as typed, including a connector taken with it. */
  text: string;
  /** What it was read as: "Tue 20 Oct", "7 pm", "Every week on Mon". */
  label: string;
};

export type QuickAddContext = {
  /** 'YYYY-MM-DD'. */
  today: string;
  /** Minutes since local midnight, for "at 7" and a time with no date. */
  nowMinutes: number;
  /** The tab the sheet was opened from: one-off tasks are filed there. */
  defaultFrequency: Frequency;
  /** Pre-filled from where you are looking: today in the Today view, else none. */
  defaultDueDate: string | null;
  /**
   * Token texts the person tapped to turn back into words, lower-cased. Kept
   * by text rather than position so they survive editing elsewhere in the line.
   */
  ignore?: readonly string[];
};

export type QuickAddResult = {
  title: string;
  dueDate: string | null;
  /** 'HH:MM:00', or null. */
  dueTime: string | null;
  /** Null when none was typed; the caller's default applies. */
  priority: Priority | null;
  repeat: RepeatRule | null;
  frequency: Frequency;
  tokens: QuickToken[];
};

/* VOCABULARY ---------------------------------------------------------------- */

const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tues: 2,
  tue: 2,
  wednesday: 3,
  weds: 3,
  wed: 3,
  thursday: 4,
  thurs: 4,
  thur: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTH_WORDS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const NUMBER_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const ORDINAL_WORDS: Record<string, number> = {
  first: 1,
  '1st': 1,
  second: 2,
  '2nd': 2,
  third: 3,
  '3rd': 3,
  fourth: 4,
  '4th': 4,
  last: -1,
};

const UNIT_WORDS: Record<string, Frequency> = {
  day: 'daily',
  days: 'daily',
  week: 'weekly',
  weeks: 'weekly',
  month: 'monthly',
  months: 'monthly',
  year: 'yearly',
  years: 'yearly',
};

/** Longest first, so the regex alternation never stops at a prefix. */
const alternation = (words: string[]) => [...words].sort((a, b) => b.length - a.length).join('|');

const WD = `(${alternation(Object.keys(WEEKDAY_WORDS))})`;
const MON = `(${alternation(Object.keys(MONTH_WORDS))})`;
const UNIT = '(days?|weeks?|months?|years?)';
const ORD = `(${alternation(Object.keys(ORDINAL_WORDS))})`;
/** Ends at the end of the text, whitespace, or closing punctuation. An apostrophe counts as part of a word. */
const END = `(?=$|[\\s,;:!?)\\]]|\\.(?:\\s|$))`;
const CONNECTORS = ['on', 'at', 'by', 'due'];

/* MATCHERS ------------------------------------------------------------------ */

type Value =
  | { kind: 'date'; date: string }
  | { kind: 'time'; hour: number; minute: number; ambiguous: boolean }
  | { kind: 'repeat'; rule: RepeatRule }
  | { kind: 'priority'; priority: Priority };

type Matcher = {
  kind: QuickTokenKind;
  regex: RegExp;
  read: (m: RegExpExecArray, ctx: QuickAddContext) => Value | null;
};

function sticky(source: string): RegExp {
  return new RegExp(source + END, 'y');
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(y, m, 0).getDate()) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** A day and month with no year: this year, or next year once this one's has passed. */
function nextDayMonth(day: number, month: number, today: string): string | null {
  const year = Number(today.slice(0, 4));
  const thisYear = isoOf(year, month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return isoOf(year + 1, month, day) ?? (thisYear ? null : isoOf(year + 4 - (year % 4), month, day));
}

function withYear(day: number, month: number, yearText: string | undefined, today: string): string | null {
  if (yearText === undefined) return nextDayMonth(day, month, today);
  const year = yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText);
  return isoOf(year, month, day);
}

function count(word: string): number {
  return NUMBER_WORDS[word] ?? Number(word);
}

const date = (d: string | null): Value | null => (d ? { kind: 'date', date: d } : null);
const repeat = (input: Parameters<typeof toRule>[0]): Value => ({ kind: 'repeat', rule: toRule(input) });

const MATCHERS: Matcher[] = [
  /* Repeats come first: "every mon" must not be read as the date "mon". */
  {
    kind: 'repeat',
    regex: sticky('(?:daily|everyday|every day)'),
    read: () => repeat('daily'),
  },
  {
    kind: 'repeat',
    regex: sticky('(?:weekly|monthly|yearly|annually)'),
    read: (m) =>
      repeat(
        m[0].startsWith('week') ? 'weekly' : m[0].startsWith('month') ? 'monthly' : 'yearly',
      ),
  },
  {
    kind: 'repeat',
    regex: sticky('(?:every )?weekdays|every weekday'),
    read: () => repeat({ frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] }),
  },
  {
    kind: 'repeat',
    regex: sticky('(?:every )?weekends|every weekend'),
    read: () => repeat({ frequency: 'weekly', weekdays: [6, 0] }),
  },
  {
    kind: 'repeat',
    // "every! 3 days" and "after 3 days" both count from completion (Todoist's
    // every! and "after"). The number may be a word: "every! two weeks".
    regex: sticky(`(?:every!|after) (\\d{1,3}|a|an|one|two|three|four|five|six) ${UNIT}`),
    read: (m) => repeat({ frequency: UNIT_WORDS[m[2]], every: count(m[1]), from: 'completion' }),
  },
  {
    kind: 'repeat',
    regex: sticky(`every! ${UNIT}`),
    read: (m) => repeat({ frequency: UNIT_WORDS[m[1]], from: 'completion' }),
  },
  {
    kind: 'repeat',
    regex: sticky(`every other ${UNIT}`),
    read: (m) => repeat({ frequency: UNIT_WORDS[m[1]], every: 2 }),
  },
  {
    kind: 'repeat',
    regex: sticky(`every (\\d{1,3}) ${UNIT}`),
    read: (m) => repeat({ frequency: UNIT_WORDS[m[2]], every: Number(m[1]) }),
  },
  {
    kind: 'repeat',
    regex: sticky(`every ${UNIT}`),
    read: (m) => repeat(UNIT_WORDS[m[1]]),
  },
  {
    kind: 'repeat',
    regex: sticky(`every ${ORD} ${WD}`),
    read: (m) =>
      repeat({ frequency: 'monthly', nth: ORDINAL_WORDS[m[1]], weekdays: [WEEKDAY_WORDS[m[2]]] }),
  },
  {
    kind: 'repeat',
    regex: sticky('every last day(?: of the month)?'),
    read: () => repeat({ frequency: 'monthly', anchorDay: 31 }),
  },
  {
    kind: 'repeat',
    regex: sticky('every (\\d{1,2})(?:st|nd|rd|th)'),
    read: (m) => {
      const day = Number(m[1]);
      return day >= 1 && day <= 31 ? repeat({ frequency: 'monthly', anchorDay: day }) : null;
    },
  },
  {
    kind: 'repeat',
    // "every mon", "every mon, thu", "every mon and thu", "every mon & fri".
    regex: sticky(`every ${WD}((?:(?:\\s*,\\s*(?:and\\s+)?|\\s+and\\s+|\\s*&\\s*)${WD})*)`),
    read: (m) => {
      const words = m[0].slice('every '.length).split(/\s*,\s*(?:and\s+)?|\s+and\s+|\s*&\s*/);
      return repeat({ frequency: 'weekly', weekdays: words.map((w) => WEEKDAY_WORDS[w]) });
    },
  },

  /* Dates. */
  {
    kind: 'date',
    regex: sticky('today'),
    read: (_m, ctx) => date(ctx.today),
  },
  {
    kind: 'date',
    regex: sticky('day after tomorrow'),
    read: (_m, ctx) => date(addDays(ctx.today, 2)),
  },
  {
    kind: 'date',
    regex: sticky('(?:tomorrow|tmrw|tmr)'),
    read: (_m, ctx) => date(addDays(ctx.today, 1)),
  },
  {
    kind: 'date',
    // Next week starts on Monday.
    regex: sticky('next week'),
    read: (_m, ctx) => date(addDays(ctx.today, 7 - mondayIndex(weekdayOf(ctx.today)))),
  },
  {
    kind: 'date',
    regex: sticky('next month'),
    read: (_m, ctx) => {
      const next = addMonths(Number(ctx.today.slice(0, 4)), Number(ctx.today.slice(5, 7)), 1);
      return date(isoOf(next.year, next.month, 1));
    },
  },
  {
    kind: 'date',
    regex: sticky('(?:this )?weekend'),
    read: (_m, ctx) => {
      const weekday = weekdayOf(ctx.today);
      return date(weekday === 6 || weekday === 0 ? ctx.today : addDays(ctx.today, 6 - weekday));
    },
  },
  {
    kind: 'date',
    // "next fri": Friday of next calendar week (Monday-first).
    regex: sticky(`next ${WD}`),
    read: (m, ctx) => {
      const monday = addDays(ctx.today, 7 - mondayIndex(weekdayOf(ctx.today)));
      return date(addDays(monday, mondayIndex(WEEKDAY_WORDS[m[1]])));
    },
  },
  {
    kind: 'date',
    // "fri", "this fri": the nearest on or after today - today if it is Friday.
    regex: sticky(`(?:this )?${WD}`),
    read: (m, ctx) => {
      const target = WEEKDAY_WORDS[m[1]];
      return date(addDays(ctx.today, (target - weekdayOf(ctx.today) + 7) % 7));
    },
  },
  {
    kind: 'date',
    regex: sticky(`in (\\d{1,3}|a|an|one|two|three|four|five|six) ${UNIT}`),
    read: (m, ctx) => {
      const n = count(m[1]);
      const unit = UNIT_WORDS[m[2]];
      if (unit === 'daily') return date(addDays(ctx.today, n));
      if (unit === 'weekly') return date(addDays(ctx.today, 7 * n));
      return date(
        stepOnce(ctx.today, toRule({ frequency: unit, every: n })),
      );
    },
  },
  {
    kind: 'date',
    regex: sticky('(\\d{4})-(\\d{2})-(\\d{2})'),
    read: (m) => date(isoOf(Number(m[1]), Number(m[2]), Number(m[3]))),
  },
  {
    kind: 'date',
    // DAY FIRST: 19/10 is 19 October. 10/13 is not a date and stays text.
    regex: sticky('(\\d{1,2})[/-](\\d{1,2})(?:[/-](\\d{4}|\\d{2}))?'),
    read: (m, ctx) => date(withYear(Number(m[1]), Number(m[2]), m[3], ctx.today)),
  },
  {
    kind: 'date',
    // Dots only with a year: "1.10" is as often a version number as a date.
    regex: sticky('(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})'),
    read: (m, ctx) => date(withYear(Number(m[1]), Number(m[2]), m[3], ctx.today)),
  },
  {
    kind: 'date',
    regex: sticky(`(\\d{1,2})(?:st|nd|rd|th)? (?:of )?${MON}(?:,? (\\d{4}))?`),
    read: (m, ctx) => date(withYear(Number(m[1]), MONTH_WORDS[m[2]], m[3], ctx.today)),
  },
  {
    kind: 'date',
    regex: sticky(`${MON} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))?`),
    read: (m, ctx) => date(withYear(Number(m[2]), MONTH_WORDS[m[1]], m[3], ctx.today)),
  },

  /* Times. */
  {
    kind: 'time',
    regex: sticky('noon'),
    read: () => ({ kind: 'time', hour: 12, minute: 0, ambiguous: false }),
  },
  {
    kind: 'time',
    regex: sticky('(\\d{1,2})(?:[:.](\\d{2}))? ?(am|pm)'),
    read: (m) => {
      const hour = Number(m[1]);
      const minute = m[2] ? Number(m[2]) : 0;
      if (hour < 1 || hour > 12 || minute > 59) return null;
      return { kind: 'time', hour: (hour % 12) + (m[3] === 'pm' ? 12 : 0), minute, ambiguous: false };
    },
  },
  {
    kind: 'time',
    // A colon time with no am/pm. 13:00-23:59 and a leading zero are 24-hour;
    // 7:30 could be either, and is settled by nearest-future below.
    regex: sticky('(\\d{1,2}):(\\d{2})'),
    read: (m) => {
      const hour = Number(m[1]);
      const minute = Number(m[2]);
      if (hour > 23 || minute > 59) return null;
      const ambiguous = hour >= 1 && hour <= 12 && !m[1].startsWith('0');
      return { kind: 'time', hour, minute, ambiguous };
    },
  },

  /* Priority. */
  {
    kind: 'priority',
    regex: sticky('(?:!(high|h|1)|p1)'),
    read: () => ({ kind: 'priority', priority: 'high' }),
  },
  {
    kind: 'priority',
    regex: sticky('(?:!(normal|medium|med|n|m|2)|p2)'),
    read: () => ({ kind: 'priority', priority: 'normal' }),
  },
  {
    kind: 'priority',
    regex: sticky('(?:!(low|l|3)|p3)'),
    read: () => ({ kind: 'priority', priority: 'low' }),
  },
];

/**
 * Times that only count after "at": a bare hour ("at 7") or a dot time
 * ("at 7.30"). Without the connector, "buy 7 apples" would gain a time.
 */
const AFTER_AT: Matcher[] = [
  {
    kind: 'time',
    regex: sticky('(\\d{1,2})(?:\\.(\\d{2}))?'),
    read: (m) => {
      const hour = Number(m[1]);
      const minute = m[2] ? Number(m[2]) : 0;
      if (hour > 23 || minute > 59) return null;
      return { kind: 'time', hour, minute, ambiguous: hour >= 1 && hour <= 12 && !m[1].startsWith('0') };
    },
  },
];

/* SCANNING ------------------------------------------------------------------ */

type Found = { start: number; end: number; value: Value; matcher: Matcher };

function tryAt(lower: string, pos: number, matchers: Matcher[], ctx: QuickAddContext) {
  for (const matcher of matchers) {
    matcher.regex.lastIndex = pos;
    const m = matcher.regex.exec(lower);
    if (!m) continue;
    const value = matcher.read(m, ctx);
    if (value) return { end: pos + m[0].length, value, matcher };
  }
  return null;
}

function isWordStart(text: string, i: number): boolean {
  return i === 0 || /[\s([{,;]/.test(text[i - 1]);
}

function scan(lower: string, ctx: QuickAddContext): Found[] {
  const found: Found[] = [];
  let pos = 0;
  while (pos < lower.length) {
    if (!isWordStart(lower, pos) || /\s/.test(lower[pos])) {
      pos += 1;
      continue;
    }

    let hit: Found | null = null;

    // A connector followed by a date or time is taken together.
    const connector = /^(on|at|by|due)\s+/.exec(lower.slice(pos));
    if (connector && CONNECTORS.includes(connector[1])) {
      const next = pos + connector[0].length;
      const pool = connector[1] === 'at' ? [...MATCHERS, ...AFTER_AT] : MATCHERS;
      const inner = tryAt(lower, next, pool, ctx);
      if (inner && (inner.matcher.kind === 'date' || inner.matcher.kind === 'time')) {
        hit = { start: pos, ...inner };
      }
    }
    if (!hit) {
      const plain = tryAt(lower, pos, MATCHERS, ctx);
      if (plain) hit = { start: pos, ...plain };
    }

    if (hit) {
      found.push(hit);
      pos = hit.end;
    } else {
      // Skip to the end of this word.
      while (pos < lower.length && !/\s/.test(lower[pos])) pos += 1;
    }
  }
  return found;
}

/* RESOLVING ----------------------------------------------------------------- */

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(iso)]} ${d} ${MONTH_SHORT[m - 1]}`;
}

function timeText(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}:00`;
}

export function parseQuickAdd(text: string, ctx: QuickAddContext): QuickAddResult {
  const lower = text.toLowerCase();
  const ignore = new Set((ctx.ignore ?? []).map((t) => t.trim().toLowerCase()));

  const tokens: QuickToken[] = [];
  const taken = new Set<QuickTokenKind>();
  let explicitDate: string | null = null;
  let time: { hour: number; minute: number; ambiguous: boolean } | null = null;
  let repeatRule: RepeatRule | null = null;
  let priority: Priority | null = null;

  for (const hit of scan(lower, ctx)) {
    const raw = text.slice(hit.start, hit.end);
    // A tapped chip stays words, and so does a second date or time: the first
    // of each kind is the one that was meant.
    if (ignore.has(raw.toLowerCase()) || taken.has(hit.value.kind)) continue;
    taken.add(hit.value.kind);

    const v = hit.value;
    if (v.kind === 'date') explicitDate = v.date;
    else if (v.kind === 'time') time = v;
    else if (v.kind === 'repeat') repeatRule = v.rule;
    else priority = v.priority;

    tokens.push({ kind: v.kind, start: hit.start, end: hit.end, text: raw, label: '' });
  }

  // The date: as typed; else from the repeat; else from the time (today if it
  // is still ahead, otherwise tomorrow); else wherever the sheet was opened.
  let dueDate: string | null = explicitDate;
  if (!dueDate && repeatRule) dueDate = firstDueDate(repeatRule, ctx.today);
  if (!dueDate && time) dueDate = ctx.today;
  if (!dueDate) dueDate = ctx.defaultDueDate;

  // The time, by TickTick's rule: an hour that could be morning or evening
  // ("at 7", "7:30") is whichever comes next. Today, that is the first of the
  // two still ahead of now; if both have passed and no date was typed, the
  // task moves on to its next day and takes the morning. A typed date keeps
  // its day - "today 7am" at noon is a late task, not tomorrow's - and a later
  // day takes the morning reading.
  let dueTime: string | null = null;
  if (time) {
    const { minute } = time;
    const readings =
      time.ambiguous && time.hour !== 12 ? [time.hour, time.hour + 12] : [time.hour];
    let hour = readings[0];
    if (dueDate === ctx.today) {
      const ahead = readings.find((h) => h * 60 + minute > ctx.nowMinutes);
      if (ahead !== undefined) hour = ahead;
      else if (!explicitDate) {
        dueDate = repeatRule ? stepOnce(ctx.today, repeatRule) : addDays(ctx.today, 1);
      } else hour = readings[readings.length - 1];
    }
    dueTime = timeText(hour, minute);
  }

  const labelled = tokens.map((token) => ({
    ...token,
    label:
      token.kind === 'date'
        ? dateLabel(explicitDate as string)
        : token.kind === 'time'
          ? formatTime(dueTime as string)
          : token.kind === 'repeat'
            ? describeRule(repeatRule as RepeatRule, dueDate)
            : `${priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Normal'} priority`,
  }));

  return {
    title: titleWithout(text, tokens),
    dueDate,
    dueTime,
    priority,
    repeat: repeatRule,
    frequency: (repeatRule as RepeatRule | null)?.frequency ?? ctx.defaultFrequency,
    tokens: labelled,
  };
}

/** The text with the recognised stretches taken out and the seams tidied. */
function titleWithout(text: string, tokens: QuickToken[]): string {
  let out = '';
  let last = 0;
  for (const token of [...tokens].sort((a, b) => a.start - b.start)) {
    out += text.slice(last, token.start) + ' ';
    last = token.end;
  }
  out += text.slice(last);
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.])/g, '$1')
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, '')
    .trim();
}

/**
 * The parse as something createTodo accepts. Priority falls back to normal; a
 * repeat's rule goes into the repeat columns, and input.ts settles the rest.
 */
export function toTodoInput(result: QuickAddResult): TodoInput {
  const rule = result.repeat;
  return {
    title: result.title,
    due_date: result.dueDate,
    due_time: result.dueTime,
    priority: result.priority ?? 'normal',
    frequency: result.frequency,
    is_repeat: rule !== null,
    repeat_every: rule?.every ?? 1,
    repeat_weekdays: rule?.weekdays ?? null,
    repeat_anchor_day: rule?.anchorDay ?? null,
    repeat_nth: rule?.nth ?? null,
    repeat_from: rule?.from ?? 'due',
  };
}
