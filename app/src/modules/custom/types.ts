/**
 * types.ts - the shapes behind user-created modules.
 *
 *  THE IDEA IN ONE LINE
 * A built-in module is CODE that describes a thing. A custom module is DATA
 * that describes a thing, plus one generic renderer that can draw any of them.
 *
 * The five built-in modules each have hand-written screens. These share two:
 * a list and a form, both assembled at runtime from the field definitions
 * below. That's the whole trick - no code is generated or compiled on the
 * phone, which a React Native app can't do anyway.
 */
import type { Ionicons } from '@expo/vector-icons';

/**
 * The field types a custom module can use.
 *
 * Each one maps to a specific input widget and a specific way of storing its
 * value, so this list is fixed rather than user-extensible - a type with no
 * widget would have nothing to render it. It's also CHECK-constrained in the
 * database for the same reason.
 */
export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'money'
  | 'date'
  | 'boolean'
  | 'select'
  /** A whole number of stars, 1 to 5. */
  | 'rating'
  /** Several of the field's options, stored as a jsonb list. */
  | 'multiselect'
  /** Whole minutes, entered as hours and minutes, so it sums like a number. */
  | 'duration';

/**
 * How a new entry fills a field before you touch it.
 *
 *   none   blank, as every field was before v3
 *   fixed  the field's default_value
 *   today  today's date (date fields only)
 *   last   whatever the most recent entry that answered this field said
 */
export type DefaultMode = 'none' | 'fixed' | 'today' | 'last';

/** How the trend chart groups entries before it draws them. */
export type ChartBucket = 'entry' | 'day' | 'week' | 'month';
export type ChartAgg = 'sum' | 'average';

/** Which stretch of time the home tile's statistic covers. */
export type SummaryPeriod = 'all' | 'week' | 'month';

/**
 * How the home tile summarises a module.
 *
 * 'count' is here as an explicit choice as well as the fallback, so "I want a
 * count" and "I have not chosen" are different states rather than the same one.
 */
export type SummaryAgg = 'sum' | 'average' | 'count' | 'latest';

export type SortDirection = 'asc' | 'desc';

export type CustomModule = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  position: number;
  /** Field KEY, not id: keys are frozen, so a renamed field keeps its summary. */
  summary_field_key: string | null;
  summary_agg: SummaryAgg | null;
  /** Null means order by created_at, which is what every module did before. */
  sort_field_key: string | null;
  sort_direction: SortDirection;
  /**
   * Row roles. Null means the automatic rule (first text field, first date
   * field, first rating field), which is what every v2 module did.
   */
  title_field_key: string | null;
  subtitle_field_key: string | null;
  badge_field_key: string | null;
  /** Group the list by this field. Null is one flat list. */
  group_field_key: string | null;
  /** Null charts the first number-like field; chart_hidden turns it off. */
  chart_field_key: string | null;
  chart_bucket: ChartBucket;
  chart_agg: ChartAgg;
  /** Points in the trailing moving average; null is off. */
  chart_window: number | null;
  chart_hidden: boolean;
  summary_period: SummaryPeriod;
  /** 'HH:MM', local, 24-hour. Null means no nudge. */
  reminder_time: string | null;
  /** Weekdays the nudge runs on, 0 = Sunday, as JavaScript counts them. */
  reminder_days: number[];
  /** A date field whose dates each get a reminder. */
  reminder_field_key: string | null;
  reminder_offset_days: number;
  created_at: string;
  updated_at: string;
};

export type CustomField = {
  id: string;
  module_id: string;
  user_id: string;
  /** Stable jsonb key. Generated from the label once, then never changed. */
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /** Choices for a 'select' or 'multiselect' field; empty for every other type. */
  options: string[];
  position: number;
  default_mode: DefaultMode;
  /** The value a 'fixed' default fills in, stored as a record would store it. */
  default_value: unknown;
  /** One line under the label in the form. Empty means none. */
  hint: string;
  created_at: string;
};

/** A saved entry. `data` is keyed by field key. */
export type CustomRecord = {
  id: string;
  module_id: string;
  user_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

/** A field being defined in the builder, before it has been saved. */
export type FieldDraft = {
  /** Local-only id so React can key the list while editing. */
  localId: string;
  /** Present once saved - used to tell updates from inserts. */
  id?: string;
  key?: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  default_mode: DefaultMode;
  default_value: unknown;
  hint: string;
};

/**
 * The module settings the builder writes. Every *_field_key is a field KEY,
 * for the reason summary_field_key is: keys survive a rename.
 */
export type ModuleInput = Pick<
  CustomModule,
  | 'name'
  | 'icon'
  | 'color'
  | 'summary_field_key'
  | 'summary_agg'
  | 'summary_period'
  | 'sort_field_key'
  | 'sort_direction'
  | 'title_field_key'
  | 'subtitle_field_key'
  | 'badge_field_key'
  | 'group_field_key'
  | 'chart_field_key'
  | 'chart_bucket'
  | 'chart_agg'
  | 'chart_window'
  | 'chart_hidden'
  | 'reminder_time'
  | 'reminder_days'
  | 'reminder_field_key'
  | 'reminder_offset_days'
>;

export const FIELD_TYPES: { type: FieldType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'text', label: 'Text', hint: 'A short line', icon: 'text-outline' },
  { type: 'longtext', label: 'Long text', hint: 'A paragraph', icon: 'reorder-four-outline' },
  { type: 'number', label: 'Number', hint: 'Hours, pages, reps', icon: 'calculator-outline' },
  { type: 'money', label: 'Money', hint: 'Amount in ₹', icon: 'cash-outline' },
  { type: 'duration', label: 'Duration', hint: 'Hours and minutes', icon: 'time-outline' },
  { type: 'rating', label: 'Rating', hint: 'Stars, 1 to 5', icon: 'star-outline' },
  { type: 'date', label: 'Date', hint: 'A calendar day', icon: 'calendar-outline' },
  { type: 'boolean', label: 'Yes / No', hint: 'Tick it off in the list', icon: 'checkmark-circle-outline' },
  { type: 'select', label: 'Choice', hint: 'Pick one of your options', icon: 'list-outline' },
  { type: 'multiselect', label: 'Tags', hint: 'Pick several', icon: 'pricetags-outline' },
];

/** The type's name as the builder shows it: "Number", "Tags". */
export function fieldTypeLabel(type: FieldType): string {
  return FIELD_TYPES.find((option) => option.type === type)?.label ?? type;
}

/** A curated icon set - a full Ionicons picker would be thousands of entries. */
export const MODULE_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'cube-outline', 'moon-outline', 'book-outline', 'film-outline',
  'car-outline', 'home-outline', 'shield-checkmark-outline', 'flag-outline',
  'heart-outline', 'water-outline', 'leaf-outline', 'paw-outline',
  'airplane-outline', 'camera-outline', 'musical-notes-outline', 'gift-outline',
  'briefcase-outline', 'school-outline', 'construct-outline', 'flask-outline',
  // Added for the v3 templates: habits, weight, sleep.
  'flame-outline', 'scale-outline', 'bed-outline', 'time-outline',
];

/** Drawn from the theme accents so custom tiles match the built-in ones. */
export const MODULE_COLORS = [
  '#818CF8', '#FBBF24', '#34D399', '#22D3EE',
  '#FB7185', '#C084FC', '#FB923C', '#A3E635',
];

/** What each colour is called, for screen readers: a hex code is not a name. */
export const MODULE_COLOR_NAMES: Record<string, string> = {
  '#818CF8': 'Indigo',
  '#FBBF24': 'Amber',
  '#34D399': 'Emerald',
  '#22D3EE': 'Cyan',
  '#FB7185': 'Rose',
  '#C084FC': 'Violet',
  '#FB923C': 'Orange',
  '#A3E635': 'Lime',
};

/**
 * Turn a human label into a stable jsonb key: "Hours slept" -> "hours_slept".
 *
 * Generated ONCE when the field is created and then frozen. If it were
 * re-derived from the label on every save, renaming a field would silently
 * orphan every value already stored under the old key.
 */
export function toFieldKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'field';

  // Two fields can't share a key - the second would overwrite the first in
  // the record's jsonb.
  if (!existingKeys.includes(base)) return base;

  let suffix = 2;
  while (existingKeys.includes(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

/** Does this field type need an options list? The two choice types do. */
export function needsOptions(type: FieldType): boolean {
  return type === 'select' || type === 'multiselect';
}

/**
 * Types whose values are numbers underneath, and so can be totalled,
 * averaged, sorted numerically and charted. A duration is minutes and a rating
 * is a count of stars; both add up like any other number.
 */
export function isNumericType(type: FieldType): boolean {
  return type === 'number' || type === 'money' || type === 'duration' || type === 'rating';
}

/**
 * Types a list can be grouped by. Tags are left out on purpose: an entry with
 * two tags would sit in two groups and be counted twice in the totals.
 */
export function isGroupableType(type: FieldType): boolean {
  return type === 'select' || type === 'boolean' || type === 'rating';
}

/**
 * The field used as a row's headline in the list.
 *
 * Rule: the first text field, else the first field of any kind. This is the
 * FALLBACK now that a title can be chosen (see roles.ts): asking you to
 * nominate a title field while creating a module is a question most people
 * can't answer before they've seen the list, so not choosing must still work.
 */
export function titleFieldOf(fields: CustomField[]): CustomField | null {
  return fields.find((f) => f.type === 'text') ?? fields[0] ?? null;
}

/** The field used as a row's subtitle: the first date, if there is one. */
export function subtitleFieldOf(fields: CustomField[], titleKey?: string): CustomField | null {
  return fields.find((f) => f.type === 'date' && f.key !== titleKey) ?? null;
}

export const SUMMARY_AGGS: SummaryAgg[] = ['count', 'sum', 'average', 'latest'];

export const SUMMARY_AGG_LABEL: Record<SummaryAgg, string> = {
  count: 'How many',
  sum: 'Total',
  average: 'Average',
  latest: 'Most recent',
};

/**
 * Which aggregations make sense for a field type.
 *
 * You cannot total a date or average a piece of text, and offering it would
 * produce a tile showing NaN. 'count' and 'latest' work on anything, because
 * they never do arithmetic on the value.
 */
export function aggsForFieldType(type: FieldType): SummaryAgg[] {
  return isNumericType(type) ? ['sum', 'average', 'count', 'latest'] : ['count', 'latest'];
}

/**
 * Field types worth sorting by. Booleans sort into two heaps, which is
 * useless, and a list of tags has no single value to put in order.
 */
export function isSortableFieldType(type: FieldType): boolean {
  return type !== 'boolean' && type !== 'multiselect';
}

export const SUMMARY_PERIOD_LABEL: Record<SummaryPeriod, string> = {
  all: 'All time',
  week: 'This week',
  month: 'This month',
};

export const CHART_BUCKET_LABEL: Record<ChartBucket, string> = {
  entry: 'Each entry',
  day: 'By day',
  week: 'By week',
  month: 'By month',
};

/** Weekday letters for the reminder picker, Sunday first, as JavaScript counts. */
export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];
