/**
 * format.ts - turning stored jsonb values into display strings, and typed
 * defaults for a blank form.
 *
 * This file exists because `data` is jsonb: every value arrives as `unknown`,
 * and the FIELD DEFINITION is the only thing that says how to read it. Doing
 * that conversion in one place keeps the guards out of the components.
 */
import { formatEventDate } from '../../core/date';
import { formatMoney } from '../../core/money';
import type { CustomField, FieldType } from './types';

/** A sensible empty value per type, used when opening a blank form. */
export function emptyValueFor(type: FieldType): unknown {
  switch (type) {
    case 'boolean':
      return false;
    case 'number':
    case 'money':
    case 'date':
    case 'select':
      // null, not '' - "not filled in" is distinct from "filled in as empty",
      // and null is what we want stored for an untouched optional field.
      return null;
    default:
      return '';
  }
}

/**
 * Render one value for display.
 *
 * Returns null when there's nothing to show, so callers can omit the line
 * entirely rather than printing an empty string or a stray dash.
 */
export function formatFieldValue(field: CustomField, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;

  switch (field.type) {
    case 'money':
      return typeof value === 'number' ? formatMoney(value, { compact: true }) : null;

    case 'number':
      // toLocaleString gives Indian digit grouping for large numbers.
      return typeof value === 'number' ? value.toLocaleString('en-IN') : String(value);

    case 'date':
      return typeof value === 'string' ? formatEventDate(value) : null;

    case 'boolean':
      // Only surface a boolean when it's true - a list peppered with "No" is
      // noise, whereas "Yes" carries information.
      return value === true ? 'Yes' : null;

    default:
      return String(value).replace(/\s+/g, ' ').trim() || null;
  }
}

/**
 * Validate a record against its field definitions.
 *
 * Returns a map of field key -> error message; empty means valid. Required is
 * the only rule - types are already constrained by the input widgets, so a
 * number field can't contain letters by the time it gets here.
 */
export function validateRecord(
  fields: CustomField[],
  data: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  fields.forEach((field) => {
    if (!field.required) return;

    const value = data[field.key];
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      // An unchecked required toggle counts as unanswered.
      (field.type === 'boolean' && value === false);

    if (isEmpty) {
      errors[field.key] = `${field.label} is required`;
    }
  });

  return errors;
}
