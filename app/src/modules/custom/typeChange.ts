/**
 * typeChange.ts - what changing a field's type does to the entries you have.
 *
 * Changing a type never touches stored data: every value stays in its record
 * under the same key, and switching back shows it again. What CAN change is
 * whether a value shows. Airtable converts "best-effort" and can clear values;
 * EIO cannot lose them, and the guard says so, with a count:
 *
 *   "14 entries have a value here; 3 won't show as Number. Nothing is deleted."
 *
 * The count is built on readableAs, the same rule the list uses to decide what
 * to display, so the guard's promise and the screen afterwards cannot disagree.
 */
import { formatFieldValue, isEmptyValue, readableAs } from './format';
import type { CustomField, CustomRecord } from './types';

export type TypeChangeImpact = {
  /** Entries with any value in this field. */
  withValue: number;
  /** Of those, how many will not show as the new type. */
  unreadable: number;
  /** Up to three values as they show now, and after (null: won't show). */
  samples: { before: string; after: string | null }[];
};

/** A value as a field shows it, with a "no" spelled out: here it is an answer. */
function shown(field: Pick<CustomField, 'type'>, value: unknown): string | null {
  if (field.type === 'boolean' && typeof value === 'boolean') return value ? 'Yes' : 'No';
  return formatFieldValue(field, value);
}

export function typeChangeImpact(
  records: CustomRecord[],
  from: Pick<CustomField, 'key' | 'type'>,
  to: Pick<CustomField, 'type'>,
): TypeChangeImpact {
  const answered = [...records]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((record) => record.data[from.key])
    .filter((value) => !isEmptyValue(value));

  const lost = answered.filter((value) => !readableAs(to.type, value));
  const kept = answered.filter((value) => readableAs(to.type, value));

  // The values that will disappear are the ones worth seeing before you
  // commit, so they lead the preview; newest first within each.
  const samples = [...lost, ...kept].slice(0, 3).map((value) => ({
    before: shown(from, value) ?? String(value),
    after: shown(to, value),
  }));

  return { withValue: answered.length, unreadable: lost.length, samples };
}

/** The guard's sentence. The type label is the builder's own ("Number", "Tags"). */
export function typeChangeMessage(impact: TypeChangeImpact, typeLabel: string): string {
  const { withValue, unreadable } = impact;
  const one = withValue === 1;
  const head = one ? '1 entry has a value here' : `${withValue} entries have a value here`;

  let tail: string;
  if (unreadable === 0) tail = one ? `it shows as ${typeLabel}` : `all of them show as ${typeLabel}`;
  else if (unreadable === withValue) {
    tail = one ? `it won't show as ${typeLabel}` : `none of them will show as ${typeLabel}`;
  } else tail = `${unreadable} won't show as ${typeLabel}`;

  return `${head}; ${tail}. Nothing is deleted.`;
}
