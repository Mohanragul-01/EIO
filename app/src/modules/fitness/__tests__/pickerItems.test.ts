/**
 * Picker sheet grouping and search.
 *
 * The sheet replaced Alert.alert calls whose buttons were the list items, which
 * Android silently capped at three. The replacement is only an improvement if
 * it actually shows everything, so the case that matters most here is the one
 * asserting a long list survives intact.
 */
import { groupItems, isFlat, UNGROUPED, type PickerItem } from '../pickerItems';

const item = (label: string, group: string | null = null, note?: string): PickerItem => ({
  id: label.toLowerCase().replace(/\s+/g, '-'),
  label,
  group,
  note,
});

describe('groupItems', () => {
  it('keeps every item, well past the three an Alert could show', () => {
    // THE BUG THIS REPLACES. Android's alert has three button slots, so a
    // fourth item overwrote an earlier one instead of getting its own.
    const many = Array.from({ length: 40 }, (_, i) => item(`Lift ${i}`, 'Arms'));
    expect(groupItems(many, '').flatMap((section) => section.items)).toHaveLength(40);
  });

  it('groups alphabetically', () => {
    const sections = groupItems(
      [item('Squat', 'Legs'), item('Bench', 'Chest'), item('Curl', 'Arms')],
      '',
    );
    expect(sections.map((section) => section.group)).toEqual(['Arms', 'Chest', 'Legs']);
  });

  it('sorts items alphabetically inside a group', () => {
    const sections = groupItems(
      [item('Incline press', 'Chest'), item('Bench press', 'Chest')],
      '',
    );
    expect(sections[0].items.map((i) => i.label)).toEqual(['Bench press', 'Incline press']);
  });

  it('sinks "Other" to the bottom rather than sorting it under O', () => {
    const sections = groupItems(
      [item('Plank', null), item('Squat', 'Legs'), item('Bench', 'Chest')],
      '',
    );
    expect(sections.map((section) => section.group)).toEqual(['Chest', 'Legs', UNGROUPED]);
  });

  it('treats null, missing and whitespace groups as one bucket', () => {
    // Otherwise you get several headers that look identical.
    const sections = groupItems([item('Plank', null), item('Hang', '   ')], '');
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBe(UNGROUPED);
    expect(sections[0].items).toHaveLength(2);
  });

  it('searches the label, case-insensitively', () => {
    const sections = groupItems([item('Bench press', 'Chest'), item('Squat', 'Legs')], 'BENCH');
    expect(sections.flatMap((s) => s.items).map((i) => i.label)).toEqual(['Bench press']);
  });

  it('searches the group too, so "legs" finds the squat', () => {
    // People look for a lift by the body part when they cannot recall its name.
    const sections = groupItems([item('Bench press', 'Chest'), item('Squat', 'Legs')], 'legs');
    expect(sections.flatMap((s) => s.items).map((i) => i.label)).toEqual(['Squat']);
  });

  it('searches the note, so a routine is findable by what is in it', () => {
    const sections = groupItems(
      [item('Push day', null, '5 exercises'), item('Pull day', null, '4 exercises')],
      '5 exercises',
    );
    expect(sections.flatMap((s) => s.items).map((i) => i.label)).toEqual(['Push day']);
  });

  it('matches on a substring, not just a prefix', () => {
    expect(groupItems([item('Barbell row', 'Back')], 'row').flatMap((s) => s.items)).toHaveLength(1);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(groupItems([item('Deadlift', 'Back')], '  dead  ').flatMap((s) => s.items)).toHaveLength(
      1,
    );
  });

  it('returns no sections when nothing matches, rather than empty groups', () => {
    // The sheet keys its "nothing matches" message off an empty array, so a
    // group with zero items would render a header above nothing.
    expect(groupItems([item('Squat', 'Legs')], 'zzz')).toEqual([]);
  });

  it('does not mutate or reorder the array it was given', () => {
    const input = [item('Squat', 'Legs'), item('Bench', 'Legs')];
    const before = input.map((i) => i.label);
    groupItems(input, '');
    expect(input.map((i) => i.label)).toEqual(before);
  });
});

describe('isFlat', () => {
  it('is true when nothing carries a group, so the sheet skips headers', () => {
    // A lone "Other" heading labels nothing, because there is nothing to tell
    // it apart from. This is the routine list.
    expect(isFlat([item('Push day'), item('Pull day')])).toBe(true);
  });

  it('is true when every group is only whitespace', () => {
    expect(isFlat([item('Push day', '  ')])).toBe(true);
  });

  it('is false as soon as one item is grouped', () => {
    // A partly grouped list still needs headers, or the grouped rows would
    // look arbitrarily ordered.
    expect(isFlat([item('Squat', 'Legs'), item('Plank')])).toBe(false);
  });

  it('is true for an empty list', () => {
    expect(isFlat([])).toBe(true);
  });
});
