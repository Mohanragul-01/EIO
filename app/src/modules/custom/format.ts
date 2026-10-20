/**
 * format.ts - turning stored jsonb values into display strings, and typed
 * defaults for a blank form.
 *
 * This file exists because `data` is jsonb: every value arrives as `unknown`,
 * and the FIELD DEFINITION is the only thing that says how to read it. Doing
 * that conversion in one place keeps the guards out of the components.
 *
 * ONE RULE FOR EVERY TYPE. A stored value either reads as the field's type or
 * it "won't show". readableAs is the single answer to which, and
 * formatFieldValue shows nothing exactly when it says no. Changing a field's
 * type never touches stored data, so this is how a value left over from the
 * old type behaves - and it is what the type-change guard counts, which is why
 * the two must never disagree.
 */
import { formatEventDate } from '../../core/date';
import { formatMoney } from '../../core/money';
import type { CustomField, FieldType } from './types';

/**
 * Read a numeric value from a jsonb field, or null if it is not one.
 *
 * Strings that look like numbers are accepted, because a field switched from
 * text to number leaves the old values as strings and silently dropping them
 * would understate a total without saying so.
 */
export function numericValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** "Not answered": null, missing, an empty string, or an empty list of tags. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day as 'YYYY-MM-DD' - not "next week", not 30 February. */
export function isISODay(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  // Date rolls 30 February into March; a real day survives the round trip.
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

/** A list of tags, or a single value left from a Choice field read as one tag. */
function tagsOf(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'string' || typeof item === 'number')
      ? value.map(String)
      : null;
  }
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  return null;
}

/**
 * Does this stored value show as this type?
 *
 * Asked of a value that is not empty; an empty value has nothing to show
 * whatever the type, and isEmptyValue answers that separately.
 */
export function readableAs(type: FieldType, value: unknown): boolean {
  switch (type) {
    case 'number':
    case 'money':
      return numericValue(value) !== null;
    case 'duration': {
      const minutes = numericValue(value);
      return minutes !== null && minutes >= 0;
    }
    case 'rating': {
      // Whole stars only, and only five of them. A 1-10 score switched to a
      // rating is kept as it was rather than squashed into a lie.
      const stars = numericValue(value);
      return stars !== null && Number.isInteger(stars) && stars >= 1 && stars <= 5;
    }
    case 'date':
      return isISODay(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'select':
      return typeof value === 'string' || typeof value === 'number';
    case 'multiselect':
      return tagsOf(value) !== null;
    case 'text':
    case 'longtext':
    default:
      // Text can show nearly anything a person typed under another type:
      // numbers, yes/no, a list. Only an object has no honest reading.
      return (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        tagsOf(value) !== null
      );
  }
}

/** A sensible empty value per type, used when opening a blank form. */
export function emptyValueFor(type: FieldType): unknown {
  switch (type) {
    case 'boolean':
      return false;
    case 'multiselect':
      return [];
    case 'number':
    case 'money':
    case 'date':
    case 'select':
    case 'rating':
    case 'duration':
      // null, not '' - "not filled in" is distinct from "filled in as empty",
      // and null is what we want stored for an untouched optional field.
      return null;
    default:
      return '';
  }
}

/**
 * "7 h 30 m", "45 m", "2 h". Durations are stored as whole minutes; an average
 * can land between minutes, so it is rounded to the nearest one first.
 */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} m`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  const hoursText = `${hours.toLocaleString('en-IN')} h`;
  return rest === 0 ? hoursText : `${hoursText} ${rest} m`;
}

/** Whole minutes into the two boxes the form shows. */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const whole = Math.max(0, Math.round(total));
  return { hours: Math.floor(whole / 60), minutes: whole % 60 };
}

/**
 * The two boxes back into minutes. One empty box counts as zero ("45" minutes
 * with no hours is 45 m); both empty is no answer at all. Minutes past 59 are
 * carried rather than refused, because "90 minutes" is a perfectly clear thing
 * to type.
 */
export function joinMinutes(hours: string, minutes: string): number | null {
  const h = hours.trim();
  const m = minutes.trim();
  if (h === '' && m === '') return null;
  const hoursValue = h === '' ? 0 : Number(h);
  const minutesValue = m === '' ? 0 : Number(m);
  if (!Number.isFinite(hoursValue) || !Number.isFinite(minutesValue)) return null;
  if (hoursValue < 0 || minutesValue < 0) return null;
  return Math.round(hoursValue * 60 + minutesValue);
}

/**
 * Render one value for display.
 *
 * Returns null when there's nothing to show - an empty value, a value that
 * won't read as this type, or a false yes/no - so callers can omit the line
 * entirely rather than printing an empty string or a stray dash.
 */
export function formatFieldValue(field: Pick<CustomField, 'type'>, value: unknown): string | null {
  if (isEmptyValue(value) || !readableAs(field.type, value)) return null;

  switch (field.type) {
    case 'money':
      // A numeric string is accepted, not just a number, because changing a
      // field's type is allowed: a text field holding "1500" becomes a money
      // field with a string still in it. summary.ts counts those, so
      // rejecting them here would show a total while every row behind it
      // displayed nothing.
      return formatMoney(Math.round(numericValue(value) ?? 0), { compact: true });

    case 'number':
      // toLocaleString gives Indian digit grouping for large numbers.
      return (numericValue(value) ?? 0).toLocaleString('en-IN');

    case 'duration':
      return formatDuration(numericValue(value) ?? 0);

    case 'rating':
      return `${numericValue(value)}/5`;

    case 'date':
      return formatEventDate(value as string);

    case 'boolean':
      // Only surface a boolean when it's true - a list peppered with "No" is
      // noise, whereas "Yes" carries information.
      return value === true ? 'Yes' : null;

    case 'multiselect':
      return (tagsOf(value) ?? []).join(', ');

    default: {
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      const text = Array.isArray(value) ? (tagsOf(value) ?? []).join(', ') : String(value);
      return text.replace(/\s+/g, ' ').trim() || null;
    }
  }
}

/**
 * What a Text or Long text box shows for a stored value.
 *
 * A string as it was typed, line breaks and all. Anything else Text can show
 * - a number kept from a Number field, a yes/no, a list of tags - as the row
 * shows it: an empty box for a value the row displays reads as the value
 * being gone. Left untouched, the stored value is saved back as it was.
 */
export function textBoxValue(value: unknown): string {
  if (typeof value === 'string') return value;
  return formatFieldValue({ type: 'text' }, value) ?? '';
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
      isEmptyValue(value) ||
      // Spaces are not an answer to a required title.
      (typeof value === 'string' && value.trim() === '') ||
      // An unchecked required toggle counts as unanswered.
      (field.type === 'boolean' && value === false);

    if (isEmpty) {
      errors[field.key] = `${field.label} is required`;
    }
  });

  return errors;
}
