/**
 * The builder's rules, shared by the phone and the website.
 *
 * The builder edits drafts that may not have keys yet, while every module
 * setting stores a KEY. These tests pin the bridge between the two: keys
 * frozen once given, never colliding, and a setting that points at something
 * gone, or at a field that can no longer do the job, cleared rather than saved
 * as a promise the module cannot keep.
 */
import {
  assignKeys,
  blankDraft,
  blankState,
  retypeDraft,
  stateFromModule,
  stateFromTemplate,
  toModuleInput,
  validateBuilder,
  type BuilderState,
} from '../builder';
import { TEMPLATES } from '../templates';
import { makeField, makeModule } from '../testing';
import type { FieldDraft } from '../types';

let n = 0;
const nextId = () => `local-${(n += 1)}`;

const draft = (over: Partial<FieldDraft>): FieldDraft => ({ ...blankDraft(nextId()), ...over });

describe('assignKeys', () => {
  it('keeps a saved field key, whatever its label now says', () => {
    const keyed = assignKeys([draft({ id: 'f1', key: 'hours', label: 'Hours slept' })], ['hours']);
    expect(keyed[0].key).toBe('hours');
  });

  it('gives a new field a key from its label', () => {
    expect(assignKeys([draft({ label: 'Pages read' })], [])[0].key).toBe('pages_read');
  });

  it('never reuses a key the module already has, even for a field being removed', () => {
    // The removed field's values are still in every record under its key.
    const keyed = assignKeys([draft({ label: 'Notes' })], ['notes']);
    expect(keyed[0].key).toBe('notes_2');
  });

  it('keeps two new fields with the same label apart', () => {
    const keyed = assignKeys([draft({ label: 'Note' }), draft({ label: 'Note' })], []);
    expect(keyed.map((d) => d.key)).toEqual(['note', 'note_2']);
  });

  it('never collides with a saved key that appears later in the list', () => {
    const keyed = assignKeys(
      [draft({ label: 'Mood' }), draft({ id: 'f1', key: 'mood', label: 'Feeling' })],
      ['mood'],
    );
    expect(keyed.map((d) => d.key)).toEqual(['mood_2', 'mood']);
  });
});

describe('toModuleInput', () => {
  const base = (): BuilderState => ({
    ...blankState(nextId),
    name: '  Sleep  ',
    drafts: [
      draft({ localId: 'd-night', label: 'Night', type: 'date' }),
      draft({ localId: 'd-slept', label: 'Slept', type: 'duration' }),
      draft({ localId: 'd-note', label: 'Note', type: 'text' }),
      draft({ localId: 'd-good', label: 'Good', type: 'boolean' }),
    ],
  });

  it('turns draft references into keys', () => {
    const state: BuilderState = {
      ...base(),
      titleRef: 'd-night',
      badgeRef: 'd-slept',
      chartRef: 'd-slept',
      summaryRef: 'd-slept',
      summaryAgg: 'average',
      sortRef: 'd-night',
      groupRef: 'd-good',
      reminderFieldRef: 'd-night',
    };
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    expect(input).toMatchObject({
      name: 'Sleep',
      title_field_key: 'night',
      badge_field_key: 'slept',
      chart_field_key: 'slept',
      summary_field_key: 'slept',
      summary_agg: 'average',
      sort_field_key: 'night',
      group_field_key: 'good',
      reminder_field_key: 'night',
    });
  });

  it('clears a setting that points at a removed field', () => {
    const state = { ...base(), titleRef: 'gone', summaryRef: 'gone', summaryAgg: 'sum' as const };
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    expect(input.title_field_key).toBeNull();
    expect(input.summary_field_key).toBeNull();
    expect(input.summary_agg).toBeNull();
  });

  it('clears a setting whose field can no longer do the job', () => {
    const state: BuilderState = {
      ...base(),
      chartRef: 'd-note', // text cannot be charted
      groupRef: 'd-note', // nor grouped
      sortRef: 'd-good', // a yes/no is not worth sorting by
      summaryRef: 'd-note',
      summaryAgg: 'sum', // and cannot be totalled
      reminderFieldRef: 'd-slept', // reminders need a date
    };
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    expect(input.chart_field_key).toBeNull();
    expect(input.group_field_key).toBeNull();
    expect(input.sort_field_key).toBeNull();
    expect(input.summary_field_key).toBeNull();
    expect(input.summary_agg).toBeNull();
    expect(input.reminder_field_key).toBeNull();
  });

  it('saves a count with no field, as v2 did', () => {
    const state = { ...base(), summaryRef: 'd-slept', summaryAgg: 'count' as const };
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    expect(input.summary_field_key).toBeNull();
    expect(input.summary_agg).toBe('count');
  });

  it('tidies the reminder weekdays, and turns a nudge with no days off', () => {
    const on = { ...base(), reminderTime: '21:00', reminderDays: [5, 1, 1, 9, 3] };
    expect(toModuleInput(on, assignKeys(on.drafts, [])).reminder_days).toEqual([1, 3, 5]);

    const noDays = { ...base(), reminderTime: '21:00', reminderDays: [] };
    expect(toModuleInput(noDays, assignKeys(noDays.drafts, [])).reminder_time).toBeNull();
  });

  it('keeps the smoothing window and reminder offset in range', () => {
    const state = { ...base(), chartWindow: 90, reminderOffset: -3 };
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    expect(input.chart_window).toBe(30);
    expect(input.reminder_offset_days).toBe(0);
  });

  it('round-trips a saved module unchanged', () => {
    const fields = [
      makeField({ id: 'a', key: 'night', label: 'Night', type: 'date', position: 0 }),
      makeField({ id: 'b', key: 'slept', label: 'Slept', type: 'duration', position: 1 }),
    ];
    const module = makeModule({
      title_field_key: 'night',
      chart_field_key: 'slept',
      chart_bucket: 'week',
      chart_agg: 'average',
      chart_window: 7,
      summary_field_key: 'slept',
      summary_agg: 'average',
      summary_period: 'week',
      reminder_time: '09:00',
      reminder_days: [1, 2],
    });
    const state = stateFromModule(module, fields, nextId);
    const input = toModuleInput(state, assignKeys(state.drafts, fields.map((f) => f.key)));
    expect(input).toMatchObject({
      title_field_key: 'night',
      chart_field_key: 'slept',
      chart_bucket: 'week',
      chart_agg: 'average',
      chart_window: 7,
      summary_field_key: 'slept',
      summary_agg: 'average',
      summary_period: 'week',
      reminder_time: '09:00',
      reminder_days: [1, 2],
    });
  });
});

describe('retypeDraft', () => {
  it('keeps options between the two choice types, and drops them otherwise', () => {
    const choice = draft({ type: 'select', options: ['a', 'b'] });
    expect(retypeDraft(choice, 'multiselect').options).toEqual(['a', 'b']);
    expect(retypeDraft(choice, 'number').options).toEqual([]);
  });

  it('drops a default the new type cannot use', () => {
    const fixed = draft({ type: 'number', default_mode: 'fixed', default_value: 8 });
    const asDate = retypeDraft(fixed, 'date');
    expect(asDate.default_mode).toBe('none');
    expect(asDate.default_value).toBeNull();

    const asRating = retypeDraft(fixed, 'rating');
    expect(asRating.default_mode).toBe('fixed');
    expect(asRating.default_value).toBeNull(); // 8 stars is not a rating
  });

  it('keeps "last" across types, since it reads whatever the last entry said', () => {
    expect(retypeDraft(draft({ type: 'number', default_mode: 'last' }), 'duration').default_mode).toBe('last');
  });
});

describe('validateBuilder', () => {
  it('needs a name and at least one named field', () => {
    expect(validateBuilder({ ...blankState(nextId), name: ' ' })?.name).toBeTruthy();
    expect(validateBuilder({ ...blankState(nextId), name: 'X' })?.fields).toBeTruthy();
  });

  it('needs options for a choice or tags field', () => {
    const state = { ...blankState(nextId), name: 'X', drafts: [draft({ label: 'Mood', type: 'multiselect' })] };
    expect(validateBuilder(state)?.fields).toContain('Mood');
  });

  it('needs a day for a nudge', () => {
    const state = {
      ...blankState(nextId),
      name: 'X',
      drafts: [draft({ label: 'A' })],
      reminderTime: '09:00',
      reminderDays: [],
    };
    expect(validateBuilder(state)?.reminders).toBeTruthy();
  });

  it('passes a sound module', () => {
    expect(validateBuilder({ ...blankState(nextId), name: 'X', drafts: [draft({ label: 'A' })] })).toBeNull();
  });
});

describe('templates fill the builder', () => {
  it.each(TEMPLATES.map((t) => [t.name, t] as const))('%s resolves every setting it names', (_, template) => {
    const state = stateFromTemplate(template, nextId);
    const byLabel = (label?: string) =>
      label ? state.drafts.find((d) => d.label === label)?.localId : undefined;

    if (template.title) expect(state.titleRef).toBe(byLabel(template.title));
    if (template.subtitle) expect(state.subtitleRef).toBe(byLabel(template.subtitle));
    if (template.badge) expect(state.badgeRef).toBe(byLabel(template.badge));
    if (template.group) expect(state.groupRef).toBe(byLabel(template.group));
    if (template.chart) expect(state.chartRef).toBe(byLabel(template.chart));
    if (template.summary?.field) expect(state.summaryRef).toBe(byLabel(template.summary.field));
    if (template.sort) expect(state.sortRef).toBe(byLabel(template.sort.field));
    if (template.dateReminder) expect(state.reminderFieldRef).toBe(byLabel(template.dateReminder.field));

    // And every one survives the save-time checks, so nothing a template sets
    // is silently dropped when you press Create.
    expect(validateBuilder(state)).toBeNull();
    const input = toModuleInput(state, assignKeys(state.drafts, []));
    if (template.group) expect(input.group_field_key).not.toBeNull();
    if (template.chart) expect(input.chart_field_key).not.toBeNull();
    if (template.summary?.field) expect(input.summary_field_key).not.toBeNull();
    if (template.sort) expect(input.sort_field_key).not.toBeNull();
    if (template.dateReminder) expect(input.reminder_field_key).not.toBeNull();
    if (template.nudge) expect(input.reminder_time).toBe(template.nudge.time);
  });

  it('never saves anything by itself: a template is only a state', () => {
    const state = stateFromTemplate(TEMPLATES[0], nextId);
    expect(state.drafts.every((d) => !d.id && !d.key)).toBe(true);
  });
});
