/**
 * Streaks count WEEKS with training, not days. A daily streak breaks on every
 * planned rest day, which punishes you for following your plan.
 */
import { restDays, trainingDays, weeklyStreak } from '../streak';

describe('weeklyStreak', () => {
  it('counts consecutive weeks with at least one session', () => {
    // Mon 5 Oct, Wed 14 Oct, Mon 19 Oct 2026 (today): three weeks in a row.
    expect(weeklyStreak(['2026-10-05', '2026-10-14', '2026-10-19'], '2026-10-19')).toBe(3);
  });

  it('an empty current week does not break it until the week is over', () => {
    expect(weeklyStreak(['2026-10-07', '2026-10-14'], '2026-10-19')).toBe(2);
  });

  it('a whole week without training breaks it', () => {
    expect(weeklyStreak(['2026-09-30', '2026-10-19'], '2026-10-19')).toBe(1);
    expect(weeklyStreak(['2026-09-30'], '2026-10-19')).toBe(0);
  });

  it('crosses a year boundary', () => {
    expect(weeklyStreak(['2026-12-30', '2027-01-06'], '2027-01-08')).toBe(2);
  });

  it('several sessions in a week count once', () => {
    expect(weeklyStreak(['2026-10-19', '2026-10-20', '2026-10-21'], '2026-10-21')).toBe(1);
  });

  it('respects a Sunday week start', () => {
    // Sun 11 Oct and Sun 18 Oct are in different Sunday-weeks but the same
    // Monday-week as the days before them.
    expect(weeklyStreak(['2026-10-11', '2026-10-18'], '2026-10-18', 0)).toBe(2);
    expect(weeklyStreak(['2026-10-11', '2026-10-18'], '2026-10-18', 1)).toBe(2);
    expect(weeklyStreak(['2026-10-10', '2026-10-11'], '2026-10-12', 0)).toBe(2);
    expect(weeklyStreak(['2026-10-10', '2026-10-11'], '2026-10-12', 1)).toBe(1);
  });

  it('ignores sessions dated after today', () => {
    expect(weeklyStreak(['2026-10-26'], '2026-10-19')).toBe(0);
  });

  it('is zero with nothing logged', () => {
    expect(weeklyStreak([], '2026-10-19')).toBe(0);
  });
});

describe('restDays', () => {
  it('counts the days since the last session', () => {
    expect(restDays(['2026-10-15', '2026-10-12'], '2026-10-19')).toBe(4);
    expect(restDays(['2026-10-19'], '2026-10-19')).toBe(0);
  });

  it('is null before the first session ever', () => {
    expect(restDays([], '2026-10-19')).toBeNull();
  });

  it('ignores future-dated sessions', () => {
    expect(restDays(['2026-10-25', '2026-10-17'], '2026-10-19')).toBe(2);
  });
});

describe('trainingDays', () => {
  it('marks each day with the modes trained on it', () => {
    expect(
      trainingDays([
        { date: '2026-10-19', mode: 'gym' },
        { date: '2026-10-19', mode: 'calisthenics' },
        { date: '2026-10-17', mode: 'calisthenics' },
      ]),
    ).toEqual({
      '2026-10-19': { gym: true, calisthenics: true, count: 2 },
      '2026-10-17': { gym: false, calisthenics: true, count: 1 },
    });
  });
});
