/**
 * The numbers behind an exercise's page: which charts make sense for it, one
 * point per session for each, and the rep-max table.
 */
import {
  historyBySession,
  metricsFor,
  repMaxTable,
  seriesFor,
  type DatedSet,
} from '../exerciseStats';

const bench = {
  load_mode: 'external' as const,
  tracking_type: 'reps' as const,
  bodyweight_factor: 1,
};
const pullUp = {
  load_mode: 'bodyweight' as const,
  tracking_type: 'reps' as const,
  bodyweight_factor: 1,
};
const plank = {
  load_mode: 'bodyweight' as const,
  tracking_type: 'time' as const,
  bodyweight_factor: 1,
};

let seq = 0;
function s(session: string, date: string, partial: Partial<DatedSet>): DatedSet {
  seq += 1;
  return {
    id: `s${seq}`,
    exercise_id: 'x',
    session_id: session,
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: `${date}T10:00:${String(seq % 60).padStart(2, '0')}Z`,
    date,
    bodyweight_kg: null,
    ...partial,
  };
}

describe('metricsFor', () => {
  it('offers the charts that mean something for each kind of exercise', () => {
    expect(metricsFor(bench)[0]).toBe('e1rm');
    expect(metricsFor(bench)).toContain('sessionVolume');
    expect(metricsFor(pullUp)[0]).toBe('mostReps');
    expect(metricsFor(pullUp)).toContain('bestAddedKg');
    expect(metricsFor(plank)).toEqual(['longestHold', 'totalTime']);
  });
});

describe('seriesFor', () => {
  const sets = [
    s('a', '2026-07-01', { reps: 5, weight_kg: 80 }),
    s('a', '2026-07-01', { reps: 5, weight_kg: 82.5 }),
    s('a', '2026-07-01', { reps: 10, weight_kg: 40, set_type: 'warmup' }),
    s('b', '2026-10-01', { reps: 3, weight_kg: 90 }),
    s('b', '2026-10-01', { reps: 15, weight_kg: 60 }),
  ];

  it('gives one point per session, oldest first', () => {
    const series = seriesFor('heaviest', sets, bench, 'all', '2026-10-19');
    expect(series.map((p) => [p.date, p.value])).toEqual([
      ['2026-07-01', 82.5],
      ['2026-10-01', 90],
    ]);
  });

  it('leaves warm-ups out of every metric', () => {
    const volume = seriesFor('sessionVolume', sets, bench, 'all', '2026-10-19');
    expect(volume[0].value).toBe(400 + 412.5);
  });

  it('estimated 1RM ignores sets above 12 reps', () => {
    const e1rm = seriesFor('e1rm', sets, bench, 'all', '2026-10-19');
    expect(e1rm[1].value).toBe(99);
  });

  it('filters by range', () => {
    expect(seriesFor('heaviest', sets, bench, '1m', '2026-10-19').map((p) => p.date)).toEqual([
      '2026-10-01',
    ]);
    expect(seriesFor('heaviest', sets, bench, '1y', '2026-10-19')).toHaveLength(2);
  });

  it('bodyweight: most reps at bodyweight or harder, and the most added weight', () => {
    const bw = [
      s('a', '2026-10-01', { reps: 12, assist_kg: 20 }),
      s('a', '2026-10-01', { reps: 9 }),
      s('b', '2026-10-08', { reps: 6, weight_kg: 10 }),
    ];
    expect(seriesFor('mostReps', bw, pullUp, 'all', '2026-10-19').map((p) => p.value)).toEqual([
      9, 6,
    ]);
    expect(seriesFor('bestAddedKg', bw, pullUp, 'all', '2026-10-19').map((p) => p.value)).toEqual([
      10,
    ]);
  });

  it("bodyweight 1RM needs the session's weigh-in, and skips sessions without one", () => {
    const bw = [
      s('a', '2026-10-01', { reps: 5, weight_kg: 10, bodyweight_kg: 70 }),
      s('b', '2026-10-08', { reps: 5, weight_kg: 10 }),
    ];
    const series = seriesFor('bwE1rm', bw, pullUp, 'all', '2026-10-19');
    expect(series).toEqual([expect.objectContaining({ date: '2026-10-01', value: 93.3 })]);
  });

  it('holds chart seconds', () => {
    const holds = [
      s('a', '2026-10-01', { duration_seconds: 30 }),
      s('a', '2026-10-01', { duration_seconds: 45 }),
    ];
    expect(seriesFor('longestHold', holds, plank, 'all', '2026-10-19')[0].value).toBe(45);
    expect(seriesFor('totalTime', holds, plank, 'all', '2026-10-19')[0].value).toBe(75);
  });
});

describe('repMaxTable', () => {
  const sets = [
    s('a', '2026-09-01', { reps: 5, weight_kg: 100 }),
    s('b', '2026-10-01', { reps: 1, weight_kg: 110 }),
    s('b', '2026-10-01', { reps: 8, weight_kg: 80, set_type: 'warmup' }),
  ];

  it('lists the heaviest you have done at each rep count, with the day', () => {
    const table = repMaxTable(sets);
    expect(table[0]).toMatchObject({ reps: 1, actual: { weight: 110, date: '2026-10-01' } });
    expect(table[4]).toMatchObject({ reps: 5, actual: { weight: 100, date: '2026-09-01' } });
    expect(table[7].actual).toBeNull();
  });

  it('predicts the rest from the best estimated max, rounded to 0.5 kg', () => {
    const table = repMaxTable(sets);
    // Best e1RM: 100 x 5 -> 116.7. At 8 reps: 116.7 / (1 + 8/30) = 92.1 -> 92.
    expect(table[7].predicted).toBe(92);
    expect(table).toHaveLength(12);
  });

  it('is empty-handed with nothing logged', () => {
    expect(repMaxTable([]).every((row) => row.actual === null && row.predicted === null)).toBe(
      true,
    );
  });
});

describe('historyBySession', () => {
  it('groups sets by session, newest first, sets in logged order', () => {
    const sets = [
      s('a', '2026-09-01', { reps: 5, weight_kg: 100 }),
      s('b', '2026-10-01', { reps: 1, weight_kg: 110 }),
      s('a', '2026-09-01', { reps: 4, weight_kg: 100 }),
    ];
    const history = historyBySession(sets);
    expect(history.map((h) => h.sessionId)).toEqual(['b', 'a']);
    expect(history[1].sets.map((x) => x.reps)).toEqual([5, 4]);
  });
});
