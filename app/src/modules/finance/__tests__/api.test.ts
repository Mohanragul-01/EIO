/**
 * api.ts: a deleted transfer comes back exactly as it was deleted.
 *
 * deleteTransfer removes every row in the group, wherever its date. Undo used
 * to put back only the halves the list had fetched - the month on screen - so
 * a half dated in another month (the v2 app can move one) was deleted for
 * good. The delete now returns what it removed, for Undo to restore.
 *
 * The database is stood in for: it records the query and answers with the
 * rows a delete ... returning would.
 */
import type { Transaction } from '../types';

const mockCalls: string[] = [];
let mockGroup: Transaction[] = [];

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      delete: () => ({
        eq: (column: string, value: string) => {
          mockCalls.push(`${table}.delete where ${column} = ${value}`);
          const done = { data: null, error: null };
          return {
            select: () => {
              mockCalls.push('returning *');
              return Promise.resolve({ data: mockGroup, error: null });
            },
            then: (resolve: (value: typeof done) => unknown) => Promise.resolve(done).then(resolve),
          };
        },
      }),
    }),
  },
}));

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');

function half(id: string, date: string, direction: 'out' | 'in'): Transaction {
  return {
    id,
    user_id: 'u',
    amount_minor: 200000,
    kind: 'transfer',
    category: 'transfer',
    note: 'ATM',
    date,
    created_at: '2026-10-03T10:00:00.000000+00:00',
    account_id: direction === 'out' ? 'hdfc' : 'cash',
    transfer_group_id: 'g',
    transfer_direction: direction,
  };
}

describe('deleteTransfer', () => {
  it('deletes the whole group and returns every row it deleted, in any month', async () => {
    // The "in" half was moved into September; the list only had October's.
    mockGroup = [half('out', '2026-10-03', 'out'), half('in', '2026-09-30', 'in')];

    const deleted = await api.deleteTransfer('g');

    expect(mockCalls).toEqual(['transactions.delete where transfer_group_id = g', 'returning *']);
    expect(deleted).toEqual(mockGroup);
  });
});
