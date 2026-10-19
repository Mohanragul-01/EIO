/**
 * defaults.ts - what a new entry starts with, and when `+` can log at once.
 *
 * Each field can fill itself in: nothing, a fixed value, today's date, or the
 * same as last time. When every required field can, the module screen's `+`
 * logs a whole entry in one tap and offers Undo, instead of opening a form.
 * Most entries in a personal log repeat the last one, so this is the feature
 * that decides whether logging survives the second week.
 *
 * Nothing here is stored for 'last': the newest record already holds the
 * value, which is also why changing a default never rewrites old entries.
 */
import { emptyValueFor, isEmptyValue, readableAs, validateRecord } from './format';
import type { CustomField, CustomRecord, DefaultMode, FieldType } from './types';

export const DEFAULT_MODE_LABEL: Record<DefaultMode, string> = {
  none: 'None',
  fixed: 'Fixed',
  today: 'Today',
  last: 'Last entry',
};

/**
 * The modes the builder offers for a type. Today only means something for a
 * date, and a FIXED date is never what a repeating log wants - it would stamp
 * every entry with the same day.
 */
export function defaultModesFor(type: FieldType): DefaultMode[] {
  return type === 'date' ? ['none', 'today', 'last'] : ['none', 'fixed', 'last'];
}

/** The field's mode if its type offers it, else none. */
function effectiveMode(field: CustomField): DefaultMode {
  const mode = field.default_mode ?? 'none';
  return defaultModesFor(field.type).includes(mode) ? mode : 'none';
}

/** Whether a fixed value can actually fill this field. */
export function isUsableFixedValue(type: FieldType, value: unknown): boolean {
  return !isEmptyValue(value) && readableAs(type, value);
}

/** A stored value, copied so the form can never edit a record's list in place. */
function copyOf(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value;
}

export type ResolvedDefaults = {
  /** A complete form, keyed by field key. */
  values: Record<string, unknown>;
  /** Fields whose value came from the last entry, for the "↺ last" tag. */
  fromLast: string[];
  /** Required fields that still have no answer. */
  missingRequired: string[];
};

/**
 * Fill every field with its default.
 *
 * "Last" is the newest entry - by when it was logged - that ANSWERED the
 * field, with a value that still reads as the field's type. Not simply the
 * newest entry: one entry that skipped an optional field would otherwise
 * blank it for every quick log after.
 */
export function resolveDefaults(
  fields: CustomField[],
  records: CustomRecord[],
  today: string,
): ResolvedDefaults {
  const newestFirst = [...records].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const values: Record<string, unknown> = {};
  const fromLast: string[] = [];

  fields.forEach((field) => {
    const mode = effectiveMode(field);
    let value: unknown = emptyValueFor(field.type);

    if (mode === 'today') {
      value = today;
    } else if (mode === 'fixed') {
      if (isUsableFixedValue(field.type, field.default_value)) value = copyOf(field.default_value);
    } else if (mode === 'last') {
      const source = newestFirst.find((record) => {
        const stored = record.data[field.key];
        return !isEmptyValue(stored) && readableAs(field.type, stored);
      });
      if (source) {
        value = copyOf(source.data[field.key]);
        fromLast.push(field.key);
      }
    }

    values[field.key] = value;
  });

  return {
    values,
    fromLast,
    // The form's own rule for "required and unanswered", so a quick log can
    // never save something the form would have refused.
    missingRequired: Object.keys(validateRecord(fields, values)),
  };
}

/** Whether any field fills itself in at all. */
export function hasDefaults(fields: CustomField[]): boolean {
  return fields.some((field) => effectiveMode(field) !== 'none');
}

/**
 * Whether `+` logs at once.
 *
 * Two conditions, and the first matters as much as the second. "Every required
 * field has a default" is trivially true for a module with no required fields,
 * and without the first condition such a module would save a blank entry on
 * every tap. So a quick log needs at least one default to be in use - you set
 * one up on purpose - and nothing required left empty.
 */
export function canQuickLog(fields: CustomField[], resolved: ResolvedDefaults): boolean {
  return fields.length > 0 && hasDefaults(fields) && resolved.missingRequired.length === 0;
}
