/**
 * The library rules: what is live, which tab shows what, pins, search, tags,
 * the home tile's counts and the Trash's countdown.
 *
 * The test that matters most is the first: a note in the Trash must vanish
 * from EVERY read - each tab, the tag chips, search and the home tile. Before
 * v3 a delete was a hard delete, so nothing had to filter; now every reader
 * goes through these functions, and one that forgot would show a deleted note
 * as if nothing had happened.
 */
import {
  daysUntilPurge,
  filterNotes,
  isArchived,
  isLive,
  isTrashed,
  overviewCounts,
  purgeCutoff,
  splitPinned,
  tagCounts,
  viewNotes,
  type NotesView,
} from '../library';
import type { Note } from '../types';

let seq = 0;
function note(overrides: Partial<Note> = {}): Note {
  seq += 1;
  return {
    id: `n${seq}`,
    user_id: 'u',
    title: `Note ${seq}`,
    body: '',
    tags: [],
    note_type: 'note',
    is_inbox: false,
    entry_date: null,
    checklist_items: null,
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    deleted_at: null,
    pinned_at: null,
    archived_at: null,
    color: null,
    ...overrides,
  };
}

const VIEWS: NotesView[] = ['notes', 'inbox', 'checklist', 'journal'];

describe('trashed and archived notes are hidden from every read', () => {
  const trashed = [
    note({ title: 'Gone note', tags: ['work'], deleted_at: '2026-10-10T00:00:00.000Z' }),
    note({ title: '', is_inbox: true, body: 'gone capture', deleted_at: '2026-10-10T00:00:00.000Z' }),
    note({
      note_type: 'checklist',
      title: 'Gone list',
      checklist_items: [{ text: 'gone milk', done: false }],
      deleted_at: '2026-10-10T00:00:00.000Z',
    }),
    note({ note_type: 'journal', entry_date: '2026-10-09', deleted_at: '2026-10-10T00:00:00.000Z' }),
  ];
  const archived = [
    note({ title: 'Old trip', tags: ['travel'], archived_at: '2026-10-10T00:00:00.000Z' }),
    note({ title: '', is_inbox: true, body: 'old capture', archived_at: '2026-10-10T00:00:00.000Z' }),
  ];
  const live = [
    note({ title: 'Kept', tags: ['work'] }),
    note({ title: '', is_inbox: true, body: 'a capture' }),
    note({ note_type: 'checklist', title: 'Groceries', checklist_items: [{ text: 'milk', done: false }] }),
    note({ note_type: 'journal', entry_date: '2026-10-11' }),
  ];
  const all = [...trashed, ...archived, ...live];

  it.each(VIEWS)('the %s tab', (view) => {
    const shown = viewNotes(all, view);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every(isLive)).toBe(true);
  });

  it('tag counts', () => {
    // 'work' is on one live and one trashed note; 'travel' only on an archived one.
    expect(tagCounts(all)).toEqual([{ tag: 'work', count: 1 }]);
  });

  it('search', () => {
    expect(filterNotes(all, { query: 'gone' })).toEqual([]);
    expect(filterNotes(all, { query: 'old' })).toEqual([]);
    expect(filterNotes(all, { query: 'milk' }).map((n) => n.title)).toEqual(['Groceries']);
  });

  it('the home tile counts', () => {
    expect(overviewCounts(all)).toEqual({ total: 4, inbox: 1 });
  });

  it('classifies each state once', () => {
    expect(trashed.every(isTrashed)).toBe(true);
    expect(archived.every(isArchived)).toBe(true);
    // A note that is both archived and trashed is in the Trash, not the Archive:
    // Restore takes it back to the Archive, but until then it is deleted.
    const both = note({ archived_at: '2026-10-01T00:00:00.000Z', deleted_at: '2026-10-02T00:00:00.000Z' });
    expect(isTrashed(both)).toBe(true);
    expect(isArchived(both)).toBe(false);
    expect(isLive(both)).toBe(false);
  });
});

describe('viewNotes', () => {
  it('Notes holds notes and checklists, newest-edited first', () => {
    const a = note({ updated_at: '2026-10-01T00:00:00.000Z' });
    const b = note({ note_type: 'checklist', updated_at: '2026-10-03T00:00:00.000Z' });
    const j = note({ note_type: 'journal', entry_date: '2026-10-02' });
    expect(viewNotes([a, b, j], 'notes')).toEqual([b, a]);
  });

  it('the Inbox is a queue: oldest capture first', () => {
    const older = note({ is_inbox: true, title: '', created_at: '2026-09-01T00:00:00.000Z' });
    const newer = note({ is_inbox: true, title: '', created_at: '2026-10-01T00:00:00.000Z' });
    const filed = note({ title: 'Filed' });
    expect(viewNotes([newer, filed, older], 'inbox')).toEqual([older, newer]);
  });

  it('Lists holds checklists only', () => {
    const list = note({ note_type: 'checklist' });
    expect(viewNotes([note(), list], 'checklist')).toEqual([list]);
  });

  it('the Journal is ordered by the day an entry is about, ties by creation', () => {
    const backdated = note({
      note_type: 'journal',
      entry_date: '2026-10-05',
      created_at: '2026-10-11T08:00:00.000Z',
    });
    const first = note({ note_type: 'journal', entry_date: '2026-10-10', created_at: '2026-10-10T08:00:00.000Z' });
    const second = note({ note_type: 'journal', entry_date: '2026-10-10', created_at: '2026-10-10T21:00:00.000Z' });
    expect(viewNotes([backdated, first, second], 'journal')).toEqual([second, first, backdated]);
  });

  it('does not reorder the array it was given', () => {
    const input = [note({ updated_at: '2026-10-01T00:00:00.000Z' }), note({ updated_at: '2026-10-02T00:00:00.000Z' })];
    const copy = [...input];
    viewNotes(input, 'notes');
    expect(input).toEqual(copy);
  });
});

describe('splitPinned', () => {
  it('lifts pinned notes out, most recently pinned first, and keeps the rest in order', () => {
    const a = note();
    const b = note({ pinned_at: '2026-10-01T00:00:00.000Z' });
    const c = note();
    const d = note({ pinned_at: '2026-10-05T00:00:00.000Z' });
    expect(splitPinned([a, b, c, d])).toEqual({ pinned: [d, b], others: [a, c] });
  });

  it('has nothing pinned when nothing is', () => {
    const a = note();
    expect(splitPinned([a])).toEqual({ pinned: [], others: [a] });
  });

  it('pinning does not file a note out of the Inbox', () => {
    const capture = note({ title: '', is_inbox: true, pinned_at: '2026-10-05T00:00:00.000Z' });
    const inbox = viewNotes([capture], 'inbox');
    expect(inbox).toEqual([capture]);
    expect(splitPinned(inbox).pinned).toEqual([capture]);
  });
});

describe('filterNotes', () => {
  const shopping = note({
    note_type: 'checklist',
    title: 'Shopping',
    tags: ['home'],
    color: 'green',
    checklist_items: [{ text: 'Oat milk', done: false }],
  });
  const plan = note({ title: 'Trip plan', body: '- [ ] book **trains**', tags: ['travel'], color: 'blue' });
  const all = [shopping, plan];

  it('matches title, body, tags and checklist items, ignoring case', () => {
    expect(filterNotes(all, { query: 'SHOP' })).toEqual([shopping]);
    expect(filterNotes(all, { query: 'trains' })).toEqual([plan]);
    expect(filterNotes(all, { query: 'travel' })).toEqual([plan]);
    expect(filterNotes(all, { query: 'oat' })).toEqual([shopping]);
  });

  it('filters by tag and by colour, and combines them', () => {
    expect(filterNotes(all, { tag: 'home' })).toEqual([shopping]);
    expect(filterNotes(all, { color: 'blue' })).toEqual([plan]);
    expect(filterNotes(all, { tag: 'home', color: 'blue' })).toEqual([]);
  });

  it('returns everything for an empty filter', () => {
    expect(filterNotes(all, { query: '   ', tag: null, color: null })).toEqual(all);
  });
});

describe('tagCounts', () => {
  it('counts each tag, most used first, then alphabetical', () => {
    const notes = [note({ tags: ['b', 'a'] }), note({ tags: ['b'] }), note({ tags: ['c'] })];
    expect(tagCounts(notes)).toEqual([
      { tag: 'b', count: 2 },
      { tag: 'a', count: 1 },
      { tag: 'c', count: 1 },
    ]);
  });
});

describe('the 30-day Trash', () => {
  it('purges whatever was trashed before the cutoff', () => {
    const now = new Date(Date.UTC(2026, 9, 31, 12));
    expect(purgeCutoff(now)).toBe(new Date(Date.UTC(2026, 9, 1, 12)).toISOString());
  });

  it('counts down whole days, never below zero', () => {
    const deleted = new Date(Date.UTC(2026, 9, 20, 12)).toISOString();
    expect(daysUntilPurge(deleted, new Date(Date.UTC(2026, 9, 20, 12)))).toBe(30);
    // An hour in, a full 30 days have not passed, and 30 is still honest.
    expect(daysUntilPurge(deleted, new Date(Date.UTC(2026, 9, 20, 13)))).toBe(30);
    expect(daysUntilPurge(deleted, new Date(Date.UTC(2026, 10, 19, 11)))).toBe(1);
    expect(daysUntilPurge(deleted, new Date(Date.UTC(2026, 10, 19, 12)))).toBe(0);
    expect(daysUntilPurge(deleted, new Date(Date.UTC(2026, 11, 25)))).toBe(0);
  });

  it('is measured in elapsed time, so a daylight-saving change does not shift it', () => {
    // New York leaves daylight saving on 1 Nov 2026, inside this window.
    const deleted = new Date(2026, 9, 25, 9).toISOString();
    expect(daysUntilPurge(deleted, new Date(2026, 10, 4, 9))).toBe(20);
  });
});
