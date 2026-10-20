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
  deleteTicked,
  deleteTickedChange,
  inverse,
  partitionChecklist,
  readChecklistItems,
  tickChange,
  toggleItem,
  uncheckAll,
  uncheckAllChange,
  withDraftItem,
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

describe('checklist upgrades', () => {
  const items: ChecklistItem[] = [
    { text: 'Milk', done: true },
    { text: 'Bread', done: false },
    { text: 'Eggs', done: true },
    { text: 'Rice', done: false },
  ];

  it('splits open from ticked without reordering what is stored', () => {
    // The ticked group is a view: each item keeps its stored index, so
    // unticking puts it back where it was and a tap still finds its line.
    expect(partitionChecklist(items)).toEqual({
      open: [
        { item: items[1], index: 1 },
        { item: items[3], index: 3 },
      ],
      ticked: [
        { item: items[0], index: 0 },
        { item: items[2], index: 2 },
      ],
    });
    expect(items.map((i) => i.text)).toEqual(['Milk', 'Bread', 'Eggs', 'Rice']);
  });

  it('toggles one item by its stored index', () => {
    expect(toggleItem(items, 1)[1]).toEqual({ text: 'Bread', done: true });
    expect(toggleItem(items, 1).filter((i) => i.done)).toHaveLength(3);
    expect(toggleItem(items, 99)).toEqual(items);
  });

  it('unchecks everything, keeping the order', () => {
    expect(uncheckAll(items)).toEqual(items.map((i) => ({ ...i, done: false })));
  });

  it('deletes only the ticked items', () => {
    expect(deleteTicked(items)).toEqual([
      { text: 'Bread', done: false },
      { text: 'Rice', done: false },
    ]);
  });

  it('never changes the list it was given, so an undo can restore it', () => {
    const before = JSON.stringify(items);
    uncheckAll(items);
    deleteTicked(items);
    toggleItem(items, 0);
    withDraftItem(items, 'Tea');
    expect(JSON.stringify(items)).toBe(before);
  });

  it('adds a typed line to the end, trimmed, and nothing for a blank one', () => {
    expect(withDraftItem(items, '  Tea ').slice(-2)).toEqual([
      { text: 'Rice', done: false },
      { text: 'Tea', done: false },
    ]);
    expect(withDraftItem(items, '   ')).toBe(items);
  });
});

describe('checklist changes that can be taken back on their own', () => {
  const milk = { text: 'Milk', done: false };
  const bread = { text: 'Bread', done: true };

  it('a tick reverts only itself, after another tick has landed on top', () => {
    const tick = tickChange([milk, bread], 0)!;
    const ticked = tick.apply([milk, bread]);
    expect(ticked).toEqual([{ text: 'Milk', done: true }, bread]);
    // Bread unticked since: taking back the milk tick leaves that alone.
    const later = [ticked[0], { text: 'Bread', done: false }];
    expect(tick.revert(later)).toEqual([milk, { text: 'Bread', done: false }]);
  });

  it('a tick reverts nothing where the item has changed since', () => {
    const tick = tickChange([milk], 0)!;
    // Unticked again already: nothing of this tick is left to take back.
    expect(tick.revert([milk])).toEqual([milk]);
    // Renamed in edit mode: a different item now, so it is left alone.
    expect(tick.revert([{ text: 'Oat milk', done: true }])).toEqual([
      { text: 'Oat milk', done: true },
    ]);
    expect(tickChange([milk], 5)).toBeNull();
  });

  it('Uncheck all reverts by re-ticking what it unticked, keeping items added since', () => {
    const change = uncheckAllChange([bread, { text: 'Eggs', done: true }, milk]);
    const unticked = change.apply([bread, { text: 'Eggs', done: true }, milk]);
    expect(unticked.every((i) => !i.done)).toBe(true);
    expect(change.revert([...unticked, { text: 'Tea', done: false }])).toEqual([
      bread,
      { text: 'Eggs', done: true },
      milk,
      { text: 'Tea', done: false },
    ]);
  });

  it('Delete ticked reverts by putting each item back in its place', () => {
    const list = [milk, bread, { text: 'Rice', done: false }, { text: 'Eggs', done: true }];
    const change = deleteTickedChange(list);
    const left = change.apply(list);
    expect(left).toEqual([milk, { text: 'Rice', done: false }]);
    expect(change.revert(left)).toEqual(list);
    // Its Undo, failing, takes them out again.
    expect(inverse(change).revert(list)).toEqual(left);
  });
});
