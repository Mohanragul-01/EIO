/**
 * The library reads come back whole, not cut at the server's first thousand.
 *
 * Supabase stops a response at 1000 rows without saying so. A daily journal
 * and the notes beside it pass that in two or three years, and because the
 * live list is newest-first, the rows cut would be the oldest entries - the
 * ones On this day and the streak exist to show. The fake server here
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
const { supabase } = require('../../../core/supabase') as {
  supabase: { requests: { table: string; range: [number, number] | null }[] };
};

const N = 2345;

beforeEach(() => {
  supabase.requests.length = 0;
  // The fake ignores filters, so one table of rows stands in for whichever
  // slice a read asks for: what is under test is that it reads them all.
  mockTables.notes = manyRows(N, (i) => ({
    id: `note-${i}`,
    user_id: 'u',
    title: '',
    body: `Entry ${i}`,
    tags: [],
    note_type: 'journal',
    is_inbox: true,
    entry_date: '2026-10-01',
    checklist_items: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    pinned_at: null,
    archived_at: null,
    color: null,
  }));
});

it('returns every live note, for the tabs, search and the journal', async () => {
  await expect(api.listLive()).resolves.toHaveLength(N);
});

it('returns every note in the Trash and the Archive', async () => {
  await expect(api.listTrash()).resolves.toHaveLength(N);
  await expect(api.listArchive()).resolves.toHaveLength(N);
});

it('counts every live note for the home tile', async () => {
  await expect(api.notesOverview()).resolves.toEqual({ total: N, inbox: N });
});
