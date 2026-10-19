/**
 * Gym and Calisthenics are a lens over one library, not two libraries. These
 * pin what the lens shows and what a new exercise starts as in each.
 */
import { defaultsForMode, parseMode, visibleInMode } from '../mode';

describe('visibleInMode', () => {
  it('shows an exercise in its own mode only', () => {
    expect(visibleInMode({ discipline: 'gym' }, 'gym')).toBe(true);
    expect(visibleInMode({ discipline: 'gym' }, 'calisthenics')).toBe(false);
    expect(visibleInMode({ discipline: 'calisthenics' }, 'gym')).toBe(false);
  });

  it('shows "both" in both: a pull-up belongs to either day', () => {
    expect(visibleInMode({ discipline: 'both' }, 'gym')).toBe(true);
    expect(visibleInMode({ discipline: 'both' }, 'calisthenics')).toBe(true);
  });
});

describe('defaultsForMode', () => {
  it('a new gym exercise is an external lift counted in reps', () => {
    expect(defaultsForMode('gym')).toEqual({
      discipline: 'gym',
      load_mode: 'external',
      tracking_type: 'reps',
    });
  });

  it('a new calisthenics exercise is bodyweight', () => {
    expect(defaultsForMode('calisthenics')).toMatchObject({
      discipline: 'calisthenics',
      load_mode: 'bodyweight',
    });
  });
});

describe('parseMode', () => {
  it('reads a stored mode, and falls back to gym for anything else', () => {
    expect(parseMode('calisthenics')).toBe('calisthenics');
    expect(parseMode('gym')).toBe('gym');
    expect(parseMode(null)).toBe('gym');
    expect(parseMode('yoga')).toBe('gym');
  });
});
