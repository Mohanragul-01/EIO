/**
 * Defaults, and when `+` logs at once.
 *
 * Most entries in a personal tracker repeat the last one: the same book, about
 * the same hours of sleep. One tap instead of a form is the difference between
 * logging every day and giving up - but only if the tap never logs something
 * you did not mean, which is what most of these tests are about.
 */
import { canQuickLog, defaultModesFor, hasDefaults, resolveDefaults } from '../defaults';
import { makeField, makeRecord } from '../testing';

const TODAY = '2026-10-19';

describe('defaultModesFor', () => {
  it('offers Today only for a date, and Fixed for everything else', () => {
    expect(defaultModesFor('date')).toEqual(['none', 'today', 'last']);
    expect(defaultModesFor('number')).toEqual(['none', 'fixed', 'last']);
    expect(defaultModesFor('multiselect')).toEqual(['none', 'fixed', 'last']);
  });
});

describe('resolveDefaults', () => {
  it('leaves a field with no default empty', () => {
    const fields = [makeField({ key: 'note', type: 'text' }), makeField({ key: 'n', type: 'number' })];
    expect(resolveDefaults(fields, [], TODAY).values).toEqual({ note: '', n: null });
  });

  it('fills today into a date field', () => {
    const fields = [makeField({ key: 'night', type: 'date', default_mode: 'today' })];
    expect(resolveDefaults(fields, [], TODAY).values.night).toBe(TODAY);
  });

  it('fills a fixed value', () => {
    const fields = [makeField({ key: 'status', type: 'select', options: ['To read'], default_mode: 'fixed', default_value: 'To read' })];
    expect(resolveDefaults(fields, [], TODAY).values.status).toBe('To read');
  });

  it('ignores a fixed value that no longer reads as the field type', () => {
    // A fixed "8" on a field later switched to Rating... 8 stars is not a thing.
    const fields = [makeField({ key: 'q', type: 'rating', default_mode: 'fixed', default_value: 8 })];
    expect(resolveDefaults(fields, [], TODAY).values.q).toBeNull();
  });

  it('ignores a mode the type does not offer', () => {
    const fields = [makeField({ key: 'n', type: 'number', default_mode: 'today' })];
    expect(resolveDefaults(fields, [], TODAY).values.n).toBeNull();
  });

  it('copies the newest entry that answered the field, by when it was logged', () => {
    const slept = makeField({ key: 'slept', type: 'duration', default_mode: 'last' });
    const records = [
      makeRecord({ slept: 420 }, [2026, 10, 15]),
      makeRecord({ slept: 465 }, [2026, 10, 18]),
      // The newest entry skipped it. One skipped field must not cost every
      // later quick log its value.
      makeRecord({ slept: null }, [2026, 10, 19, 8]),
      makeRecord({ slept: 390 }, [2026, 10, 10]),
    ];
    const resolved = resolveDefaults([slept], records, TODAY);
    expect(resolved.values.slept).toBe(465);
    expect(resolved.fromLast).toEqual(['slept']);
  });

  it('skips a last value that no longer reads as the type', () => {
    const n = makeField({ key: 'n', type: 'number', default_mode: 'last' });
    const records = [makeRecord({ n: 'lots' }, [2026, 10, 18]), makeRecord({ n: 3 }, [2026, 10, 17])];
    expect(resolveDefaults([n], records, TODAY).values.n).toBe(3);
  });

  it('carries a "no" forward as an answer', () => {
    const rested = makeField({ key: 'rested', type: 'boolean', default_mode: 'last' });
    const resolved = resolveDefaults([rested], [makeRecord({ rested: false })], TODAY);
    expect(resolved.values.rested).toBe(false);
    expect(resolved.fromLast).toEqual(['rested']);
  });

  it('copies tags rather than sharing the stored list', () => {
    const tags = makeField({ key: 'tags', type: 'multiselect', options: ['a', 'b'], default_mode: 'last' });
    const stored = ['a', 'b'];
    const resolved = resolveDefaults([tags], [makeRecord({ tags: stored })], TODAY);
    expect(resolved.values.tags).toEqual(['a', 'b']);
    expect(resolved.values.tags).not.toBe(stored);
  });

  it('does not tag a field as "last" when there was nothing to copy', () => {
    const n = makeField({ key: 'n', type: 'number', default_mode: 'last' });
    expect(resolveDefaults([n], [], TODAY).fromLast).toEqual([]);
  });

  it('lists the required fields still unanswered', () => {
    const fields = [
      makeField({ key: 'night', type: 'date', required: true, default_mode: 'today' }),
      makeField({ key: 'slept', type: 'duration', required: true, default_mode: 'last' }),
    ];
    expect(resolveDefaults(fields, [], TODAY).missingRequired).toEqual(['slept']);
  });
});

describe('canQuickLog', () => {
  const night = makeField({ key: 'night', type: 'date', required: true, default_mode: 'today' });
  const slept = makeField({ key: 'slept', type: 'duration', required: true, default_mode: 'last' });
  const note = makeField({ key: 'note', type: 'text' });

  it('logs at once when every required field has a value', () => {
    const fields = [night, slept, note];
    const records = [makeRecord({ night: '2026-10-18', slept: 450 })];
    expect(canQuickLog(fields, resolveDefaults(fields, records, TODAY))).toBe(true);
  });

  it('opens the form when a required field has nothing to fill it', () => {
    const fields = [night, slept, note];
    expect(canQuickLog(fields, resolveDefaults(fields, [], TODAY))).toBe(false);
  });

  it('never logs an empty entry for a module with no defaults at all', () => {
    // No required fields means "every required field has a default" is
    // trivially true - and a tap would save a blank row every time.
    const fields = [note, makeField({ key: 'n', type: 'number' })];
    expect(hasDefaults(fields)).toBe(false);
    expect(canQuickLog(fields, resolveDefaults(fields, [], TODAY))).toBe(false);
  });

  it('does not count a mode the type cannot use as a default', () => {
    expect(hasDefaults([makeField({ type: 'number', default_mode: 'today' })])).toBe(false);
  });

  it('needs at least one field', () => {
    expect(canQuickLog([], resolveDefaults([], [], TODAY))).toBe(false);
  });
});
