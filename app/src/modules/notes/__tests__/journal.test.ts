/**
 * The journal's re-reading features, all derived from entry_date.
 *
 * Dates here are calendar days ('YYYY-MM-DD'), never instants, and every test
 * builds them as strings so the result cannot depend on the machine's zone.
 * The suite runs in America/New_York, so the streak tests deliberately cross
 * both of its 2026 daylight-saving changes: day arithmetic done on instants
 * would skip or repeat a day there.
 */
import {
  JOURNAL_PROMPTS,
  journalStreak,
  onThisDay,
  promptFor,
  shiftISO,
  todaysEntry,
  weekStrip,
} from '../journal';
import type { Note } from '../types';

type Entry = Pick<Note, 'id' | 'entry_date' | 'created_at' | 'deleted_at' | 'archived_at'>;

let seq = 0;
function entry(entry_date: string | null, overrides: Partial<Entry> = {}): Entry {
  seq += 1;
  return {
    id: `j${seq}`,
    entry_date,
    created_at: `${entry_date ?? '2026-01-01'}T20:00:00.000Z`,
    deleted_at: null,
    archived_at: null,
    ...overrides,
  };
}

describe('shiftISO', () => {
  it('moves by calendar days across month, year and daylight-saving edges', () => {
    expect(shiftISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftISO('2028-03-01', -1)).toBe('2028-02-29');
    expect(shiftISO('2026-12-31', 1)).toBe('2027-01-01');
    // New York: clocks go forward 8 Mar 2026 and back 1 Nov 2026.
    expect(shiftISO('2026-03-09', -1)).toBe('2026-03-08');
    expect(shiftISO('2026-03-08', -1)).toBe('2026-03-07');
    expect(shiftISO('2026-11-02', -1)).toBe('2026-11-01');
    expect(shiftISO('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('onThisDay', () => {
  it('finds entries from this date in earlier years, newest first', () => {
    const a = entry('2025-10-19');
    const b = entry('2023-10-19');
    const notToday = entry('2025-10-18');
    const thisYear = entry('2026-10-19');
    expect(onThisDay([b, notToday, a, thisYear], '2026-10-19')).toEqual([
      { note: a, yearsAgo: 1 },
      { note: b, yearsAgo: 3 },
    ]);
  });

  it('shows 29 February entries on 28 February when this year has no 29th', () => {
    const leap = entry('2024-02-29');
    expect(onThisDay([leap], '2027-02-28')).toEqual([{ note: leap, yearsAgo: 3 }]);
    // In a leap year they wait for their own day.
    expect(onThisDay([leap], '2028-02-28')).toEqual([]);
    expect(onThisDay([leap], '2028-02-29')).toEqual([{ note: leap, yearsAgo: 4 }]);
  });

  it('ignores trashed, archived and undated entries', () => {
    const trashed = entry('2025-10-19', { deleted_at: '2026-10-01T00:00:00.000Z' });
    const archived = entry('2025-10-19', { archived_at: '2026-10-01T00:00:00.000Z' });
    expect(onThisDay([trashed, archived, entry(null)], '2026-10-19')).toEqual([]);
  });
});

describe('journalStreak', () => {
  it('counts consecutive days ending today', () => {
    const days = ['2026-10-19', '2026-10-18', '2026-10-17', '2026-10-15'].map((d) => entry(d));
    expect(journalStreak(days, '2026-10-19')).toBe(3);
  });

  it('keeps yesterday’s streak alive while today is still unwritten', () => {
    const days = ['2026-10-18', '2026-10-17'].map((d) => entry(d));
    expect(journalStreak(days, '2026-10-19')).toBe(2);
  });

  it('is zero once a whole day has been missed', () => {
    expect(journalStreak([entry('2026-10-17')], '2026-10-19')).toBe(0);
    expect(journalStreak([], '2026-10-19')).toBe(0);
  });

  it('counts a day once however many entries it has', () => {
    const days = [entry('2026-10-19'), entry('2026-10-19'), entry('2026-10-18')];
    expect(journalStreak(days, '2026-10-19')).toBe(2);
  });

  it('counts a backdated entry, since the day was journaled', () => {
    const days = [entry('2026-10-19'), entry('2026-10-17')];
    expect(journalStreak(days, '2026-10-19')).toBe(1);
    const filled = [...days, entry('2026-10-18', { created_at: '2026-10-19T08:00:00.000Z' })];
    expect(journalStreak(filled, '2026-10-19')).toBe(3);
  });

  it('runs across both daylight-saving changes without skipping a day', () => {
    const spring = ['2026-03-09', '2026-03-08', '2026-03-07', '2026-03-06'].map((d) => entry(d));
    expect(journalStreak(spring, '2026-03-09')).toBe(4);
    const autumn = ['2026-11-02', '2026-11-01', '2026-10-31'].map((d) => entry(d));
    expect(journalStreak(autumn, '2026-11-02')).toBe(3);
  });

  it('does not count trashed or archived entries', () => {
    const days = [
      entry('2026-10-19'),
      entry('2026-10-18', { deleted_at: '2026-10-19T00:00:00.000Z' }),
      entry('2026-10-17'),
    ];
    expect(journalStreak(days, '2026-10-19')).toBe(1);
  });
});

describe('weekStrip', () => {
  it('lists the last seven days, oldest first, marking today and entries', () => {
    const strip = weekStrip([entry('2026-10-19'), entry('2026-10-14')], '2026-10-19');
    expect(strip.map((d) => d.date)).toEqual([
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
    ]);
    expect(strip.map((d) => d.hasEntry)).toEqual([false, true, false, false, false, false, true]);
    expect(strip.map((d) => d.isToday)).toEqual([false, false, false, false, false, false, true]);
  });
});

describe('prompts', () => {
  it('has a list of distinct prompts', () => {
    expect(JOURNAL_PROMPTS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(JOURNAL_PROMPTS).size).toBe(JOURNAL_PROMPTS.length);
  });

  it('gives one prompt per day, the same all day', () => {
    expect(promptFor('2026-10-19', 0)).toBe(promptFor('2026-10-19', 0));
    expect(promptFor('2026-10-19', 0)).not.toBe(promptFor('2026-10-20', 0));
  });

  it('shuffles through different prompts and wraps around', () => {
    const seen = new Set<string>();
    for (let i = 0; i < JOURNAL_PROMPTS.length; i += 1) seen.add(promptFor('2026-10-19', i));
    expect(seen.size).toBe(JOURNAL_PROMPTS.length);
    expect(promptFor('2026-10-19', JOURNAL_PROMPTS.length)).toBe(promptFor('2026-10-19', 0));
  });
});

describe('todaysEntry', () => {
  it('finds today’s entry, the most recently written if there are several', () => {
    const morning = entry('2026-10-19', { created_at: '2026-10-19T03:00:00.000Z' });
    const evening = entry('2026-10-19', { created_at: '2026-10-19T16:00:00.000Z' });
    expect(todaysEntry([morning, entry('2026-10-18'), evening], '2026-10-19')).toBe(evening);
  });

  it('is null when today has none, or only a trashed one', () => {
    expect(todaysEntry([entry('2026-10-18')], '2026-10-19')).toBeNull();
    const trashed = entry('2026-10-19', { deleted_at: '2026-10-19T10:00:00.000Z' });
    expect(todaysEntry([trashed], '2026-10-19')).toBeNull();
  });
});
