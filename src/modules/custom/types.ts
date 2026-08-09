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
export type FieldType = 'text' | 'longtext' | 'number' | 'money' | 'date' | 'boolean' | 'select';

export type CustomModule = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  position: number;
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
  /** Choices for a 'select' field; empty for every other type. */
  options: string[];
  position: number;
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
};

export const FIELD_TYPES: { type: FieldType; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'text', label: 'Text', hint: 'A short line', icon: 'text-outline' },
  { type: 'longtext', label: 'Long text', hint: 'A paragraph', icon: 'reorder-four-outline' },
  { type: 'number', label: 'Number', hint: 'Hours, pages, reps', icon: 'calculator-outline' },
  { type: 'money', label: 'Money', hint: 'Amount in ₹', icon: 'cash-outline' },
  { type: 'date', label: 'Date', hint: 'A calendar day', icon: 'calendar-outline' },
  { type: 'boolean', label: 'Yes / No', hint: 'A toggle', icon: 'toggle-outline' },
  { type: 'select', label: 'Choice', hint: 'Pick one of your options', icon: 'list-outline' },
];

/** A curated icon set - a full Ionicons picker would be thousands of entries. */
export const MODULE_ICONS: (keyof typeof Ionicons.glyphMap)[] = [
  'cube-outline', 'moon-outline', 'book-outline', 'film-outline',
  'car-outline', 'home-outline', 'shield-checkmark-outline', 'flag-outline',
  'heart-outline', 'water-outline', 'leaf-outline', 'paw-outline',
  'airplane-outline', 'camera-outline', 'musical-notes-outline', 'gift-outline',
  'briefcase-outline', 'school-outline', 'construct-outline', 'flask-outline',
];

/** Drawn from the theme accents so custom tiles match the built-in ones. */
export const MODULE_COLORS = [
  '#818CF8', '#FBBF24', '#34D399', '#22D3EE',
  '#FB7185', '#C084FC', '#FB923C', '#A3E635',
];

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

/** Does this field type need an options list? Only 'select' does. */
export function needsOptions(type: FieldType): boolean {
  return type === 'select';
}

/**
 * The field used as a row's headline in the list.
 *
 * Rule: the first text field, else the first field of any kind. Chosen
 * automatically rather than configured, because asking you to nominate a
 * title field while creating a module is a question most people can't answer
 * before they've seen the list.
 */
export function titleFieldOf(fields: CustomField[]): CustomField | null {
  return fields.find((f) => f.type === 'text') ?? fields[0] ?? null;
}

/** The field used as a row's subtitle: the first date, if there is one. */
export function subtitleFieldOf(fields: CustomField[], titleKey?: string): CustomField | null {
  return fields.find((f) => f.type === 'date' && f.key !== titleKey) ?? null;
}
