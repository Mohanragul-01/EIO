/**
 * The whole list comes back, not the server's first thousand rows.
 *
 * Supabase stops a response at 1000 rows without saying so. The B-List holds
 * 818 today, and one more batch of ideas would silently cut the categories
 * that sort last from the list and from every progress figure. The fake
 * server here truncates the same way.
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

const N = 1234;

beforeEach(() => {
  mockTables.bucket_items = manyRows(N, (i) => ({
    id: `item-${i}`,
    user_id: 'u',
    title: `Idea ${i}`,
    category: 'Travel',
    cost: 'low',
    position: i,
    is_done: false,
  }));
});

it('returns every item on the list', async () => {
  await expect(api.listItems()).resolves.toHaveLength(N);
});
