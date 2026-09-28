/**
 * The muscle vocabulary.
 *
 * Two things matter and neither is obvious from reading the tables: that the
 * list stayed SHORT, and that an exercise tagged under the old twenty-two-muscle
 * vocabulary still lands somewhere sensible whether or not migration 0018 has
 * been run against the database.
 */
import {
  MUSCLES_BY_REGION,
  MUSCLE_GROUPS,
  MUSCLE_REGIONS,
  normaliseMuscle,
  regionOf,
} from '../types';

describe('the muscle vocabulary', () => {
  it('splits only arms and core', () => {
    const split = MUSCLE_REGIONS.filter((r) => MUSCLES_BY_REGION[r].length > 1);
    expect(split).toEqual(['Arms', 'Core', 'Other']);

    expect(MUSCLES_BY_REGION.Arms).toEqual(['Biceps', 'Triceps', 'Forearms']);
    expect(MUSCLES_BY_REGION.Core).toEqual(['Abs', 'Lower back']);
  });

  it('keeps the whole list short enough to pick from without thinking', () => {
    // It was 22. The point of the change was that a list you have to think
    // about before tagging is a list you will tag wrong.
    expect(MUSCLE_GROUPS.length).toBeLessThanOrEqual(12);
  });

  it('has no duplicate tags across regions', () => {
    expect(new Set(MUSCLE_GROUPS).size).toBe(MUSCLE_GROUPS.length);
  });

  it('puts every current tag in a real region', () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(MUSCLE_REGIONS).toContain(regionOf(muscle));
    }
  });
});

describe('normaliseMuscle', () => {
  it('folds the old finer tags into the ones that replaced them', () => {
    expect(normaliseMuscle('Upper chest')).toBe('Chest');
    expect(normaliseMuscle('Lower chest')).toBe('Chest');
    expect(normaliseMuscle('Lats')).toBe('Back');
    expect(normaliseMuscle('Traps')).toBe('Back');
    expect(normaliseMuscle('Rear delts')).toBe('Shoulders');
    expect(normaliseMuscle('Quads')).toBe('Legs');
    expect(normaliseMuscle('Glutes')).toBe('Legs');
    expect(normaliseMuscle('Calves')).toBe('Legs');
    expect(normaliseMuscle('Obliques')).toBe('Abs');
  });

  it('leaves the tags that survived alone', () => {
    // These were in the old vocabulary AND the new one. Mapping them would be
    // a silent no-op today and a bug the moment the tables diverge.
    for (const muscle of ['Biceps', 'Triceps', 'Forearms', 'Abs', 'Lower back', 'Cardio']) {
      expect(normaliseMuscle(muscle)).toBe(muscle);
    }
  });

  it('leaves a name you invented alone rather than rewriting it', () => {
    expect(normaliseMuscle('Grip')).toBe('Grip');
    expect(normaliseMuscle('')).toBe(null);
    expect(normaliseMuscle(null)).toBe(null);
  });

  it('maps every old tag onto one that currently exists', () => {
    const OLD = [
      'Upper chest', 'Mid chest', 'Lower chest',
      'Lats', 'Traps', 'Rhomboids',
      'Front delts', 'Side delts', 'Rear delts', 'Neck',
      'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Adductors',
      'Obliques', 'Lower abs',
    ];
    for (const old of OLD) {
      expect(MUSCLE_GROUPS).toContain(normaliseMuscle(old));
    }
  });
});

describe('regionOf', () => {
  it('routes an old tag to the region its replacement lives in', () => {
    // This is what stops a not-yet-migrated exercise stranding under "Other".
    expect(regionOf('Quads')).toBe('Legs');
    expect(regionOf('Lats')).toBe('Back');
    expect(regionOf('Obliques')).toBe('Core');
    expect(regionOf('Side delts')).toBe('Shoulders');
  });

  it('falls back to Other for anything it does not know', () => {
    expect(regionOf('Grip')).toBe('Other');
    expect(regionOf(null)).toBe('Other');
  });
});
