/**
 * Exercise picker grouping and search.
 *
 * This list replaced an Alert whose buttons were the exercise names, which
 * Android silently capped at three. The replacement is only an improvement if
 * it actually shows everything, so the case that matters most here is the one
 * asserting a long library survives intact.
 */
import { groupExercises } from '../exerciseSearch';
import type { Exercise } from '../types';

const exercise = (name: string, muscle_group: string | null = null): Exercise => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  user_id: 'u1',
  name,
  muscle_group,
  created_at: '2026-01-01T00:00:00Z',
});

describe('groupExercises', () => {
  it('keeps every exercise, well past the three an Alert could show', () => {
    // THE BUG THIS REPLACES. Android's alert has three button slots, so a
    // fourth exercise overwrote an earlier one instead of getting its own.
    const many = Array.from({ length: 40 }, (_, i) => exercise(`Lift ${i}`, 'Arms'));
    const sections = groupExercises(many, '');

    expect(sections.flatMap((section) => section.items)).toHaveLength(40);
  });

  it('groups by muscle group, alphabetically', () => {
    const sections = groupExercises(
      [exercise('Squat', 'Legs'), exercise('Bench', 'Chest'), exercise('Curl', 'Arms')],
      '',
    );
    expect(sections.map((section) => section.group)).toEqual(['Arms', 'Chest', 'Legs']);
  });

  it('sorts exercises alphabetically inside a group', () => {
    const sections = groupExercises(
      [exercise('Incline press', 'Chest'), exercise('Bench press', 'Chest')],
      '',
    );
    expect(sections[0].items.map((item) => item.name)).toEqual(['Bench press', 'Incline press']);
  });

  it('sinks "Other" to the bottom rather than sorting it under O', () => {
    const sections = groupExercises(
      [exercise('Plank', null), exercise('Squat', 'Legs'), exercise('Bench', 'Chest')],
      '',
    );
    expect(sections.map((section) => section.group)).toEqual(['Chest', 'Legs', 'Other']);
  });

  it('treats null, missing and whitespace muscle groups as one bucket', () => {
    // Otherwise you get several headers that look identical.
    const sections = groupExercises([exercise('Plank', null), exercise('Hang', '   ')], '');
    expect(sections).toHaveLength(1);
    expect(sections[0].group).toBe('Other');
    expect(sections[0].items).toHaveLength(2);
  });

  it('searches the name, case-insensitively', () => {
    const sections = groupExercises(
      [exercise('Bench press', 'Chest'), exercise('Squat', 'Legs')],
      'BENCH',
    );
    expect(sections.flatMap((s) => s.items).map((i) => i.name)).toEqual(['Bench press']);
  });

  it('searches the muscle group too, so "legs" finds the squat', () => {
    // People look for a lift by the body part when they cannot recall its name.
    const sections = groupExercises(
      [exercise('Bench press', 'Chest'), exercise('Squat', 'Legs')],
      'legs',
    );
    expect(sections.flatMap((s) => s.items).map((i) => i.name)).toEqual(['Squat']);
  });

  it('matches on a substring, not just a prefix', () => {
    const sections = groupExercises([exercise('Barbell row', 'Back')], 'row');
    expect(sections.flatMap((s) => s.items)).toHaveLength(1);
  });

  it('ignores surrounding whitespace in the query', () => {
    const sections = groupExercises([exercise('Deadlift', 'Back')], '  dead  ');
    expect(sections.flatMap((s) => s.items)).toHaveLength(1);
  });

  it('returns no sections when nothing matches, rather than empty groups', () => {
    // The component keys its "nothing matches" message off an empty array, so
    // a group with zero items would render a header above nothing.
    expect(groupExercises([exercise('Squat', 'Legs')], 'zzz')).toEqual([]);
  });

  it('does not mutate or reorder the array it was given', () => {
    const input = [exercise('Squat', 'Legs'), exercise('Bench', 'Legs')];
    const before = input.map((item) => item.name);
    groupExercises(input, '');
    expect(input.map((item) => item.name)).toEqual(before);
  });
});
