/**
 * A routine's history comes back whole, not cut at the server's first
 * thousand rows.
 *
 * Supabase stops a response at 1000 rows without saying so, and a list asks
 * for every routine's history at once: five daily routines pass that in about
 * 200 days, after which streaks are counted from part of the history and the
 * editor's History shows wrong totals. The fake server here truncates the
 * same way (see core/__fixtures__/cappedSupabase.ts).
 */
import { manyRows } from '../../../core/__fixtures__/cappedSupabase';

const mockTables: Record<string, Record<string, unknown>[]> = {};

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/notifications', () => ({ registerResync: jest.fn() }));
jest.mock('../notifications', () => ({
  syncReminders: jest.fn(() => Promise.resolve()),
  cancelReminders: jest.fn(() => Promise.resolve()),
  rebuildAll: jest.fn(() => Promise.resolve()),
  refreshDigestsSoon: jest.fn(),
}));
jest.mock('../../../core/supabase', () => {
  const { cappedSupabase } = jest.requireActual('../../../core/__fixtures__/cappedSupabase');
  return { supabase: cappedSupabase((table: string) => mockTables[table] ?? []) };
});

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');
const { supabase } = require('../../../core/supabase') as {
  supabase: { requests: { table: string; range: [number, number] | null }[] };
};

const N = 2345;

beforeEach(() => {
  supabase.requests.length = 0;
  mockTables.todos = manyRows(N, (i) => ({
    id: `occurrence-${i}`,
    user_id: 'u',
    series_id: 'root',
    due_date: new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10),
    is_done: true,
    outcome: 'done',
    frequency: 'daily',
  }));
});

it('returns every closed occurrence of a series, past the cap', async () => {
  await expect(api.listSeriesHistory(['root'])).resolves.toHaveLength(N);
});

it('asks page by page', async () => {
  await api.listSeriesHistory(['root', 'other']);
  const reads = supabase.requests.filter((r) => r.table === 'todos');
  // An unwindowed request is the one the server cuts short.
  expect(reads.length).toBeGreaterThanOrEqual(Math.ceil(N / 1000));
  expect(reads.every((r) => r.range !== null)).toBe(true);
});
