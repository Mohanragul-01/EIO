/**
 * Records, judged by what kind of exercise it is.
 *
 * The bug this replaces: records compared the WEIGHT lifted at a fixed rep
 * count, and a bodyweight set's weight is always 0, so "first time doing 11
 * pull-ups" could never be a record. Now each exercise type has the records
 * that mean something for it, and the old gym rule is kept where it belongs.
 *
 * The rules that make a badge trustworthy are unchanged and pinned here: the
 * first set at a measure is not a record (it beat nothing), a tie is not a
 * record, warm-ups never count, and a record is announced once per session.
 */
import type { SetFact } from '../load';
import { detectRecords, primaryRecord, sessionRecords } from '../records';

const bench = { load_mode: 'external' as const, tracking_type: 'reps' as const };
const pullUp = { load_mode: 'bodyweight' as const, tracking_type: 'reps' as const };
const lSit = { load_mode: 'bodyweight' as const, tracking_type: 'time' as const };

let seq = 0;
function s(partial: Partial<SetFact>): SetFact {
  seq += 1;
  return {
    id: `s${seq}`,
    exercise_id: 'x',
    session_id: 'old',
    set_type: 'normal',
    reps: null,
    duration_seconds: null,
    weight_kg: 0,
    assist_kg: null,
    clean: true,
    created_at: '2026-10-01T10:00:00Z',
    ...partial,
  };
}
const now = (partial: Partial<SetFact>) => s({ session_id: 'today', ...partial });
const kinds = (hits: { kind: string }[]) => hits.map((h) => h.kind).sort();

describe('bodyweight rep records', () => {
  it('fires for more reps at the same load (the bug: this never fired)', () => {
    const hits = detectRecords(pullUp, [s({ reps: 10 })], [], now({ reps: 11 }));
    expect(kinds(hits)).toEqual(['reps']);
    expect(hits[0]).toMatchObject({ value: 11, previous: 10 });
  });

  it('only sets at the same or a harder load are its baseline for reps', () => {
    // More reps WITH help proves nothing about reps without it, so 12 assisted
    // is not what 11 unassisted is measured against for reps. It is, however,
    // the first time 11+ reps were done with less help than ever: a load record.
    expect(kinds(detectRecords(pullUp, [s({ reps: 12, assist_kg: 20 })], [], now({ reps: 11 })))).toEqual([
      'load',
    ]);
    expect(kinds(detectRecords(pullUp, [s({ reps: 10, weight_kg: 10 })], [], now({ reps: 11 })))).toEqual([
      'reps',
    ]);
  });

  it('the first set at a new, harder load is not a reps record', () => {
    expect(detectRecords(pullUp, [s({ reps: 12 })], [], now({ reps: 8, weight_kg: 10 }))).toEqual(
      // Not "reps" (nothing at +10 or harder to beat), but it IS the most
      // weight ever added for 8+ reps, since 12 reps at +0 is in that baseline.
      [expect.objectContaining({ kind: 'load', value: 10, previous: 0 })],
    );
    expect(detectRecords(pullUp, [], [], now({ reps: 8, weight_kg: 10 }))).toEqual([]);
  });

  it('then more reps at that load is', () => {
    const hits = detectRecords(pullUp, [s({ reps: 8, weight_kg: 10 })], [], now({ reps: 9, weight_kg: 10 }));
    expect(kinds(hits)).toEqual(['reps']);
  });

  it('less assistance for the same reps is a record, and says so', () => {
    const hits = detectRecords(pullUp, [s({ reps: 10, assist_kg: 30 })], [], now({ reps: 10, assist_kg: 20 }));
    expect(kinds(hits)).toEqual(['load']);
    expect(hits[0].label).toBe('Less assistance');
    expect(hits[0]).toMatchObject({ value: -20, previous: -30 });
  });

  it('an assisted set never outranks an unassisted one', () => {
    const hits = detectRecords(pullUp, [s({ reps: 10 })], [], now({ reps: 9, assist_kg: 10 }));
    expect(hits).toEqual([]);
  });

  it('a tie is not a record', () => {
    expect(detectRecords(pullUp, [s({ reps: 10 })], [], now({ reps: 10 }))).toEqual([]);
  });
});

describe('external lift records (the gym rules, kept)', () => {
  const history = [s({ reps: 5, weight_kg: 80 }), s({ reps: 8, weight_kg: 70 })];

  it('heavier at the same rep count is a record', () => {
    const hits = detectRecords(bench, history, [], now({ reps: 8, weight_kg: 72.5 }));
    expect(kinds(hits)).toContain('repsAtWeight');
  });

  it('a first set at a new rep count is not a repsAtWeight record', () => {
    const hits = detectRecords(bench, history, [], now({ reps: 6, weight_kg: 75 }));
    expect(kinds(hits)).not.toContain('repsAtWeight');
  });

  it('the heaviest weight ever is a record at any reps', () => {
    // 95 x 1 beats the best estimated max (80 x 5 = 93.3) as well.
    const hits = detectRecords(bench, history, [], now({ reps: 1, weight_kg: 95 }));
    expect(kinds(hits)).toEqual(['e1rm', 'heaviest']);
  });

  it('estimated 1RM ignores sets above 12 reps, on both sides', () => {
    const light = [s({ reps: 15, weight_kg: 60 })];
    expect(kinds(detectRecords(bench, light, [], now({ reps: 5, weight_kg: 50 })))).toEqual([]);
    expect(kinds(detectRecords(bench, history, [], now({ reps: 20, weight_kg: 60 })))).toEqual([
      'setVolume',
    ]);
  });

  it('best set volume', () => {
    const hits = detectRecords(bench, history, [], now({ reps: 10, weight_kg: 60 }));
    expect(kinds(hits)).toContain('setVolume');
  });

  it('nothing on day one', () => {
    expect(detectRecords(bench, [], [], now({ reps: 5, weight_kg: 100 }))).toEqual([]);
  });
});

describe('holds', () => {
  it('a longer hold at the same load is a record', () => {
    expect(kinds(detectRecords(lSit, [s({ duration_seconds: 30 })], [], now({ duration_seconds: 31 })))).toEqual([
      'hold',
    ]);
  });

  it('an assisted hold does not count against an unassisted one', () => {
    // 35s with help is easier than 31s without: the baseline for an unassisted
    // hold is empty, so the 31s is the first of its kind - not a record.
    expect(
      detectRecords(lSit, [s({ duration_seconds: 35, assist_kg: 10 })], [], now({ duration_seconds: 31 })),
    ).toEqual([]);
  });
});

describe('what never counts', () => {
  it('a warm-up is never a record', () => {
    expect(
      detectRecords(bench, [s({ reps: 5, weight_kg: 80 })], [], now({ set_type: 'warmup', reps: 5, weight_kg: 90 })),
    ).toEqual([]);
  });

  it('a warm-up is never the baseline', () => {
    const hits = detectRecords(
      bench,
      [s({ set_type: 'warmup', reps: 5, weight_kg: 40 })],
      [],
      now({ reps: 5, weight_kg: 60 }),
    );
    expect(hits).toEqual([]);
  });

  it('a failed attempt with no reps is never a record', () => {
    expect(
      detectRecords(pullUp, [s({ reps: 1 })], [], now({ set_type: 'failure', reps: 0, weight_kg: 50 })),
    ).toEqual([]);
  });
});

describe('once per session', () => {
  const baseline = [s({ reps: 10 })];

  it('a second set equal to an earlier record this session is not announced again', () => {
    const first = now({ reps: 11 });
    const second = now({ reps: 11 });
    expect(detectRecords(pullUp, baseline, [first], second)).toEqual([]);
  });

  it('a later set that beats the earlier record this session is', () => {
    const first = now({ reps: 11 });
    const third = now({ reps: 12 });
    expect(detectRecords(pullUp, baseline, [first], third)).toEqual([
      expect.objectContaining({ kind: 'reps', value: 12, previous: 10 }),
    ]);
  });
});

describe('sessionRecords', () => {
  it('recomputes the same badges a live session showed, so they survive reopening', () => {
    const exercises = { x: pullUp };
    const baseline = { x: [s({ reps: 10 })] };
    const sets = [now({ reps: 9 }), now({ reps: 11 }), now({ reps: 11 }), now({ reps: 12 })];

    const live: Record<string, unknown> = {};
    sets.forEach((set, i) => {
      const hits = detectRecords(pullUp, baseline.x, sets.slice(0, i), set);
      if (hits.length > 0) live[set.id] = hits;
    });

    expect(sessionRecords(exercises, baseline, sets)).toEqual(live);
    expect(Object.keys(live)).toEqual([sets[1].id, sets[3].id]);
  });

  it('skips sets for an exercise it does not know', () => {
    expect(sessionRecords({}, {}, [now({ exercise_id: 'gone', reps: 5 })])).toEqual({});
  });
});

describe('primaryRecord', () => {
  it('picks the one to announce', () => {
    expect(
      primaryRecord([
        { kind: 'setVolume', value: 1, previous: 0, label: '' },
        { kind: 'heaviest', value: 1, previous: 0, label: '' },
      ])?.kind,
    ).toBe('heaviest');
    expect(primaryRecord([])).toBeNull();
  });
});
