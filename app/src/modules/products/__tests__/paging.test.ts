/**
 * Usage logs come back whole, not cut at the server's first thousand.
 *
 * Supabase stops a response at 1000 rows without saying so. A handful of
 * products used daily passes that inside a year, and from then on the pace
 * every reorder date is built on is computed from part of the history. The
 * fake server here truncates the same way.
 */
import { manyRows } from '../../../core/__fixtures__/cappedSupabase';

const mockTables: Record<string, Record<string, unknown>[]> = {};

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/notifications', () => ({ registerResync: jest.fn() }));
jest.mock('../notifications', () => ({ replaceReminders: jest.fn(() => Promise.resolve()) }));
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
  mockTables.product_uses = manyRows(N, (i) => ({
    id: `use-${i}`,
    user_id: 'u',
    product_id: 'p1',
    used_on: '2026-10-01',
    amount: 1,
    created_at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
  }));
  mockTables.products = [
    { id: 'p1', user_id: 'u', name: 'Toothpaste', opened_on: '2026-01-01', finished_on: null },
  ];
});

it('returns every use, for the list and the pace', async () => {
  await expect(api.listAllUses()).resolves.toHaveLength(N);
  await expect(api.listUses('p1')).resolves.toHaveLength(N);
});

it("reads every open product's uses for the home summary", async () => {
  await api.overview();
  const uses = supabase.requests.filter((r) => r.table === 'product_uses');
  // Page by page: an unwindowed request is the one the server cuts short.
  expect(uses.length).toBeGreaterThanOrEqual(Math.ceil(N / 1000));
  expect(uses.every((r) => r.range !== null)).toBe(true);
});
