/**
 * The history reads return EVERY set, not the server's first thousand.
 *
 * Supabase stops a response at 1000 rows without saying so. Six exercises in a
 * routine at a few hundred sets a year each pass that within months, and then
 * the baseline used for record checks is missing sets - a lift that is not a
 * record gets called one - and an exercise's charts stop at whatever the
 * first thousand happened to be. The fake server here truncates the same way.
 */
import { manyRows } from '../../../core/__fixtures__/cappedSupabase';

const mockTables: Record<string, Record<string, unknown>[]> = {};

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/supabase', () => {
  const { cappedSupabase } = jest.requireActual('../../../core/__fixtures__/cappedSupabase');
  return { supabase: cappedSupabase((table: string) => mockTables[table] ?? []) };
});

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');

const N = 2345;
const stamp = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString();

beforeEach(() => {
  mockTables.session_sets = manyRows(N, (i) => ({
    id: `set-${i}`,
    exercise_id: i % 2 ? 'e1' : 'e2',
    session_id: `s-${Math.floor(i / 6)}`,
    set_type: 'normal',
    reps: 5,
    duration_seconds: null,
    weight_kg: 100,
    assist_kg: null,
    clean: true,
    band_id: null,
    side: null,
    rpe: null,
    created_at: stamp(i),
    workout_sessions: { date: '2026-10-01', bodyweight_kg: 80, created_at: stamp(i) },
  }));
  mockTables.workout_sessions = manyRows(N, (i) => ({
    id: `w-${i}`,
    date: '2026-10-01',
    created_at: stamp(i),
  }));
});

it("returns an exercise's whole history for record checks", async () => {
  await expect(api.listExerciseHistory('e1')).resolves.toHaveLength(N);
});

it('returns every set of a routine\'s exercises for the baseline', async () => {
  const baseline = await api.listBaseline(['e1', 'e2'], 'current');
  expect(Object.values(baseline).flat()).toHaveLength(N);
});

it("returns every set for an exercise's page and chart", async () => {
  await expect(api.listExerciseSets('e1')).resolves.toHaveLength(N);
  await expect(api.listExerciseProgress('e1')).resolves.toHaveLength(N);
});

it('numbers a workout past the thousandth', async () => {
  await expect(api.sessionOrdinal('w-2000')).resolves.toBe(2001);
});
