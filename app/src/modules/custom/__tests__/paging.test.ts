/**
 * A module's entries come back whole, not cut at the server's first thousand.
 *
 * Supabase stops a response at 1000 rows without saying so. A couple of daily
 * trackers pass that inside a year; after that the list, the streaks and the
 * home tiles are worked out from part of the history. The fake server here
 * truncates the same way.
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

beforeEach(() => {
  mockTables.user_records = manyRows(N, (i) => ({
    id: `r-${i}`,
    user_id: 'u',
    module_id: i % 3 ? 'm1' : 'm2',
    data: {},
    created_at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
  }));
});

it("returns every one of a module's entries", async () => {
  // The fake ignores filters, so every row comes back for any module.
  await expect(api.listRecords('m1')).resolves.toHaveLength(N);
});

it('returns every entry across modules for the home tiles', async () => {
  const grouped = await api.recordsByModule();
  expect(Object.values(grouped).flat()).toHaveLength(N);
});
