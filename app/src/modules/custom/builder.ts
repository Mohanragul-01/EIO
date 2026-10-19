/**
 * builder.ts - the module builder's state and rules, for both clients.
 *
 * The builder edits DRAFTS, some of which have no key yet, while every module
 * setting (title, chart, group, tile, sort, reminder field) stores a field
 * KEY. So the builder holds settings as references to drafts - their local
 * ids - and turns them into keys only at save time, after every new field has
 * been given one. That is what lets a template pre-fill a chart on a field
 * that does not exist yet, and lets you pick a field you added a second ago.
 *
 * At save, a setting that points at a removed field, or at a field whose type
 * can no longer do the job (a chart on text, a reminder on a number), is
 * cleared rather than saved. A setting you cannot see in the builder is one
 * you cannot change, and a module promising a chart it cannot draw falls back
 * silently anyway.
 */
import { defaultModesFor, isUsableFixedValue } from './defaults';
import type { ModuleTemplate } from './templates';
import {
  aggsForFieldType,
  fieldTypeLabel,
  isGroupableType,
  isNumericType,
  isSortableFieldType,
  MODULE_COLORS,
  MODULE_ICONS,
  needsOptions,
  toFieldKey,
  type ChartAgg,
  type ChartBucket,
  type CustomField,
  type CustomModule,
  type FieldDraft,
  type FieldType,
  type ModuleInput,
  type SortDirection,
  type SummaryAgg,
  type SummaryPeriod,
} from './types';

/** A reference to a draft: its localId. */
export type DraftRef = string | null;

export type BuilderState = {
  name: string;
  icon: string;
  color: string;
  drafts: FieldDraft[];

  titleRef: DraftRef;
  subtitleRef: DraftRef;
  badgeRef: DraftRef;
  groupRef: DraftRef;

  /** Null charts the first number-like field. */
  chartRef: DraftRef;
  chartHidden: boolean;
  chartBucket: ChartBucket;
  chartAgg: ChartAgg;
  chartWindow: number | null;

  summaryRef: DraftRef;
  summaryAgg: SummaryAgg | null;
  summaryPeriod: SummaryPeriod;

  sortRef: DraftRef;
  sortDirection: SortDirection;

  /** 'HH:MM', or null for no nudge. */
  reminderTime: string | null;
  reminderDays: number[];
  reminderFieldRef: DraftRef;
  reminderOffset: number;
};

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export function blankDraft(localId: string): FieldDraft {
  return {
    localId,
    label: '',
    type: 'text',
    required: false,
    options: [],
    default_mode: 'none',
    default_value: null,
    hint: '',
  };
}

/** A saved field as an editable draft. Columns a v2 row lacks get v3 defaults. */
export function draftFromField(field: CustomField, localId: string): FieldDraft {
  return {
    localId,
    id: field.id,
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options ?? [],
    default_mode: field.default_mode ?? 'none',
    default_value: field.default_value ?? null,
    hint: field.hint ?? '',
  };
}

const BLANK_SETTINGS: Omit<BuilderState, 'name' | 'icon' | 'color' | 'drafts'> = {
  titleRef: null,
  subtitleRef: null,
  badgeRef: null,
  groupRef: null,
  chartRef: null,
  chartHidden: false,
  chartBucket: 'day',
  chartAgg: 'sum',
  chartWindow: null,
  summaryRef: null,
  summaryAgg: null,
  summaryPeriod: 'all',
  sortRef: null,
  sortDirection: 'desc',
  reminderTime: null,
  reminderDays: EVERY_DAY,
  reminderFieldRef: null,
  reminderOffset: 0,
};

/** A new module: one empty text field, so it is never empty. */
export function blankState(nextId: () => string): BuilderState {
  return {
    name: '',
    icon: MODULE_ICONS[0],
    color: MODULE_COLORS[0],
    drafts: [blankDraft(nextId())],
    ...BLANK_SETTINGS,
  };
}

/** An existing module, ready to edit. Keys pointing at deleted fields resolve to null. */
export function stateFromModule(
  module: CustomModule,
  fields: CustomField[],
  nextId: () => string,
): BuilderState {
  const drafts = fields.length > 0
    ? fields.map((field) => draftFromField(field, nextId()))
    : [blankDraft(nextId())];
  const ref = (key: string | null | undefined): DraftRef =>
    key ? drafts.find((d) => d.key === key)?.localId ?? null : null;

  return {
    name: module.name,
    icon: module.icon,
    color: module.color,
    drafts,
    titleRef: ref(module.title_field_key),
    subtitleRef: ref(module.subtitle_field_key),
    badgeRef: ref(module.badge_field_key),
    groupRef: ref(module.group_field_key),
    chartRef: ref(module.chart_field_key),
    chartHidden: module.chart_hidden ?? false,
    chartBucket: module.chart_bucket ?? 'day',
    chartAgg: module.chart_agg ?? 'sum',
    chartWindow: module.chart_window ?? null,
    summaryRef: ref(module.summary_field_key),
    summaryAgg: module.summary_agg,
    summaryPeriod: module.summary_period ?? 'all',
    sortRef: ref(module.sort_field_key),
    sortDirection: module.sort_direction,
    reminderTime: module.reminder_time ?? null,
    reminderDays: module.reminder_days ?? EVERY_DAY,
    reminderFieldRef: ref(module.reminder_field_key),
    reminderOffset: module.reminder_offset_days ?? 0,
  };
}

/** A template, filled in for review. Nothing is saved, and no draft has a key. */
export function stateFromTemplate(template: ModuleTemplate, nextId: () => string): BuilderState {
  const drafts: FieldDraft[] = template.fields.map((field) => ({
    ...blankDraft(nextId()),
    label: field.label,
    type: field.type,
    required: field.required ?? false,
    options: field.options ? [...field.options] : [],
    default_mode: field.default_mode ?? 'none',
    default_value: field.default_value ?? null,
    hint: field.hint ?? '',
  }));
  const ref = (label: string | undefined): DraftRef =>
    label ? drafts.find((d) => d.label === label)?.localId ?? null : null;

  return {
    ...BLANK_SETTINGS,
    name: template.name,
    icon: template.icon,
    color: template.color,
    drafts,
    titleRef: ref(template.title),
    subtitleRef: ref(template.subtitle),
    badgeRef: ref(template.badge),
    groupRef: ref(template.group),
    chartRef: ref(template.chart),
    chartBucket: template.chartBucket ?? 'day',
    chartAgg: template.chartAgg ?? 'sum',
    chartWindow: template.chartWindow ?? null,
    summaryRef: ref(template.summary?.field),
    summaryAgg: template.summary?.agg ?? null,
    summaryPeriod: template.summary?.period ?? 'all',
    sortRef: ref(template.sort?.field),
    sortDirection: template.sort?.direction ?? 'desc',
    reminderTime: template.nudge?.time ?? null,
    reminderDays: template.nudge?.days ?? EVERY_DAY,
    reminderFieldRef: ref(template.dateReminder?.field),
    reminderOffset: template.dateReminder?.offsetDays ?? 0,
  };
}

/**
 * Change a draft's type, keeping what still makes sense.
 *
 * Options survive between Choice and Tags (the same list either way) and are
 * dropped otherwise, so stale choices cannot reappear later. A default mode
 * the new type does not offer goes back to None, and a fixed value that no
 * longer reads as the type is cleared - "8" is fine as a number and nonsense
 * as a rating.
 */
export function retypeDraft(draft: FieldDraft, type: FieldType): FieldDraft {
  const modeAllowed = defaultModesFor(type).includes(draft.default_mode);
  return {
    ...draft,
    type,
    options: needsOptions(type) ? draft.options : [],
    default_mode: modeAllowed ? draft.default_mode : 'none',
    default_value:
      modeAllowed && isUsableFixedValue(type, draft.default_value) ? draft.default_value : null,
  };
}

/** Drafts that will be saved: a field with no label has no key to give. */
export function usableDrafts(drafts: FieldDraft[]): FieldDraft[] {
  return drafts.filter((draft) => draft.label.trim().length > 0);
}

export type BuilderErrors = { name?: string; fields?: string; reminders?: string };

/** What stops a save, in words. Null means it can be saved. */
export function validateBuilder(state: BuilderState): BuilderErrors | null {
  if (!state.name.trim()) return { name: 'Give the module a name' };

  const usable = usableDrafts(state.drafts);
  if (usable.length === 0) {
    return { fields: 'Add at least one field. A module with no fields can store nothing.' };
  }

  // A choice field with no options would render as a row you cannot answer.
  const noOptions = usable.find((d) => needsOptions(d.type) && d.options.length === 0);
  if (noOptions) {
    return {
      fields: `"${noOptions.label.trim()}" is a ${fieldTypeLabel(noOptions.type)} field, so it needs at least one option.`,
    };
  }

  if (state.reminderTime && state.reminderDays.length === 0) {
    return { reminders: 'Pick at least one day for the reminder, or turn it off.' };
  }

  return null;
}

/**
 * Give every draft a key. A saved field keeps its own, forever. A new one gets
 * one from its label that collides with nothing: not another draft, and not
 * any key the module already has - including fields being removed in this
 * same save, whose values are still sitting in every record under that key.
 */
export function assignKeys(drafts: FieldDraft[], existingKeys: string[]): FieldDraft[] {
  const taken = [...existingKeys, ...drafts.filter((d) => d.key).map((d) => d.key as string)];
  return drafts.map((draft) => {
    if (draft.key) return draft;
    const key = toFieldKey(draft.label, taken);
    taken.push(key);
    return { ...draft, key };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * The module row to save, with every reference turned into a key and checked
 * against what the field can actually do. `keyed` is the output of assignKeys
 * over the drafts being saved.
 */
export function toModuleInput(state: BuilderState, keyed: FieldDraft[]): ModuleInput {
  const draftOf = (ref: DraftRef) => (ref ? keyed.find((d) => d.localId === ref) ?? null : null);
  const keyIf = (ref: DraftRef, ok: (type: FieldType) => boolean = () => true) => {
    const draft = draftOf(ref);
    return draft && ok(draft.type) ? draft.key ?? null : null;
  };

  // The tile: a count needs no field; anything else needs a field that can
  // produce it, or it is no setting at all.
  let summaryKey: string | null = null;
  let summaryAgg: SummaryAgg | null = state.summaryAgg;
  if (summaryAgg && summaryAgg !== 'count') {
    summaryKey = keyIf(state.summaryRef, (type) => aggsForFieldType(type).includes(summaryAgg as SummaryAgg));
    if (!summaryKey) summaryAgg = null;
  }

  const days = [...new Set(state.reminderDays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort((a, b) => a - b);

  return {
    name: state.name.trim(),
    icon: state.icon,
    color: state.color,
    summary_field_key: summaryKey,
    summary_agg: summaryAgg,
    summary_period: state.summaryPeriod,
    sort_field_key: keyIf(state.sortRef, isSortableFieldType),
    sort_direction: state.sortDirection,
    title_field_key: keyIf(state.titleRef),
    subtitle_field_key: keyIf(state.subtitleRef),
    badge_field_key: keyIf(state.badgeRef),
    group_field_key: keyIf(state.groupRef, isGroupableType),
    chart_field_key: keyIf(state.chartRef, isNumericType),
    chart_bucket: state.chartBucket,
    chart_agg: state.chartAgg,
    chart_window: state.chartWindow === null ? null : clamp(state.chartWindow, 2, 30),
    chart_hidden: state.chartHidden,
    // A nudge on no days is no nudge.
    reminder_time: state.reminderTime && days.length > 0 ? state.reminderTime : null,
    reminder_days: days.length > 0 ? days : EVERY_DAY,
    reminder_field_key: keyIf(state.reminderFieldRef, (type) => type === 'date'),
    reminder_offset_days: clamp(state.reminderOffset, 0, 30),
  };
}
