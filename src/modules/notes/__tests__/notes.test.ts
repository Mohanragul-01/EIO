/**
 * Notes v2 helpers.
 *
 * The inbox rule is the one worth pinning: it runs on both create and edit, and
 * if those two paths ever disagreed a note would file itself on save and then
 * reappear in the inbox on the next edit. The checklist reader matters because
 * it parses a jsonb column, which arrives as `unknown` and can legitimately be
 * null on every note that is not a checklist.
 */
import {
  belongsInInbox,
  checklistProgress,
  readChecklistItems,
  type ChecklistItem,
} from '../types';

describe('belongsInInbox', () => {
  it('claims a note with neither title nor tags', () => {
    expect(belongsInInbox({ title: '', tags: [], note_type: 'note' })).toBe(true);
    // Whitespace is not a title. Otherwise a stray space would file a note that
    // is still, to the user, untitled.
    expect(belongsInInbox({ title: '   ', tags: [], note_type: 'note' })).toBe(true);
  });

  it('releases a note as soon as it gains a title or a tag', () => {
    expect(belongsInInbox({ title: 'Plumber', tags: [], note_type: 'note' })).toBe(false);
    expect(belongsInInbox({ title: '', tags: ['home'], note_type: 'note' })).toBe(false);
    expect(belongsInInbox({ title: 'Plumber', tags: ['home'], note_type: 'note' })).toBe(false);
  });

  it('never claims a checklist or a journal entry', () => {
    // You reach for those deliberately, so choosing one already files it.
    expect(belongsInInbox({ title: '', tags: [], note_type: 'checklist' })).toBe(false);
    expect(belongsInInbox({ title: '', tags: [], note_type: 'journal' })).toBe(false);
  });

  it('is stable across a save-then-edit round trip', () => {
    // The actual bug this guards: create files it one way, edit files it the
    // other, and the note flickers in and out of the inbox.
    const captured = { title: '', tags: [] as string[], note_type: 'note' as const };
    expect(belongsInInbox(captured)).toBe(true);
    expect(belongsInInbox(captured)).toBe(true);

    const filed = { ...captured, title: 'Now it has a title' };
    expect(belongsInInbox(filed)).toBe(false);
    expect(belongsInInbox(filed)).toBe(false);
  });
});

describe('readChecklistItems', () => {
  it('reads a well-formed list', () => {
    const items = [
      { text: 'Milk', done: false },
      { text: 'Bread', done: true },
    ];
    expect(readChecklistItems(items)).toEqual(items);
  });

  it('returns an empty list for anything that is not one', () => {
    // null is the normal case: every note that is not a checklist has it.
    expect(readChecklistItems(null)).toEqual([]);
    expect(readChecklistItems(undefined)).toEqual([]);
    expect(readChecklistItems('not a list')).toEqual([]);
    expect(readChecklistItems({ text: 'lonely', done: false })).toEqual([]);
  });

  it('drops malformed entries rather than rendering blank rows', () => {
    const mixed = [
      { text: 'Keep me', done: false },
      { text: 'No done flag' },
      { done: true },
      null,
      'a bare string',
      { text: 42, done: false },
    ];
    expect(readChecklistItems(mixed)).toEqual([{ text: 'Keep me', done: false }]);
  });

  it('keeps only text and done, discarding anything extra', () => {
    const withJunk = [{ text: 'Milk', done: false, id: 'stale', legacy: true }];
    expect(readChecklistItems(withJunk)).toEqual([{ text: 'Milk', done: false }]);
  });
});

describe('checklistProgress', () => {
  it('counts ticked against total', () => {
    const items: ChecklistItem[] = [
      { text: 'a', done: true },
      { text: 'b', done: false },
      { text: 'c', done: true },
    ];
    expect(checklistProgress(items)).toEqual({ done: 2, total: 3 });
  });

  it('handles an empty list without dividing by anything', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0 });
  });
});
