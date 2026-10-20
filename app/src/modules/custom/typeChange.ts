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
 *
 * SHOWING IS NOT THE SAME AS MEANING THE SAME. Duration stores minutes and
 * Money stores paise, so a number moving into or out of either shows, but as
 * something else: a Sleep field's 7.5 hours becomes "8 m", and 1500 becomes
 * "₹15". Those are counted apart and said plainly, with one of the person's
 * own values: "all of them will be read as minutes: 7.5 becomes 8 m".
 */
import { formatFieldValue, isEmptyValue, numericValue, readableAs } from './format';
import type { CustomField, CustomRecord, FieldType } from './types';

export type TypeChangeImpact = {
  /** Entries with any value in this field. */
  withValue: number;
  /** Of those, how many will not show as the new type. */
  unreadable: number;
  /** Of those that show, how many will mean something else: hours read as minutes. */
  reread: number;
  /** How they will be read, in words, with the newest as the example. Null when none are. */
  rereadAs: { words: string; before: string; after: string } | null;
  /** Up to three values as they show now, and after (null: won't show). */
  samples: { before: string; after: string | null }[];
};

/** What a stored number counts, for the types where it is not just a number. */
const UNIT: Partial<Record<FieldType, string>> = { duration: 'minutes', money: 'paise' };

/** How a number is read differently after this change, or null if it is not. */
function rereadWords(from: FieldType, to: FieldType): string | null {
  const before = UNIT[from];
  const after = UNIT[to];
  if (before === after) return null;
  return after ? `will be read as ${after}` : `will show the stored ${before}`;
}

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

  const words = rereadWords(from.type, to.type);
  const isReread = (value: unknown) => words !== null && numericValue(value) !== null;

  const lost = answered.filter((value) => !readableAs(to.type, value));
  const kept = answered.filter((value) => readableAs(to.type, value));
  const reread = kept.filter(isReread);
  const same = kept.filter((value) => !isReread(value));

  const sample = (value: unknown) => ({
    before: shown(from, value) ?? String(value),
    after: shown(to, value),
  });

  // The values that will disappear are the ones worth seeing before you
  // commit, so they lead the preview, then the ones that will read
  // differently; newest first within each.
  const samples = [...lost, ...reread, ...same].slice(0, 3).map(sample);

  const example = reread.length > 0 ? sample(reread[0]) : null;
  const rereadAs =
    words && example
      ? { words, before: example.before, after: example.after ?? String(reread[0]) }
      : null;

  return {
    withValue: answered.length,
    unreadable: lost.length,
    reread: reread.length,
    rereadAs,
    samples,
  };
}

/** The guard's sentence. The type label is the builder's own ("Number", "Tags"). */
export function typeChangeMessage(impact: TypeChangeImpact, typeLabel: string): string {
  const { withValue, unreadable, reread, rereadAs } = impact;
  const one = withValue === 1;
  const head = one ? '1 entry has a value here' : `${withValue} entries have a value here`;

  let tail: string;
  if (unreadable === 0 && (reread === 0 || !rereadAs)) {
    tail = one ? `it shows as ${typeLabel}` : `all of them show as ${typeLabel}`;
  } else if (unreadable === withValue) {
    tail = one ? `it won't show as ${typeLabel}` : `none of them will show as ${typeLabel}`;
  } else {
    const parts: string[] = [];
    if (unreadable > 0) parts.push(`${unreadable} won't show as ${typeLabel}`);
    if (reread > 0 && rereadAs) {
      const who = reread === withValue ? (one ? 'it' : 'all of them') : String(reread);
      parts.push(`${who} ${rereadAs.words}: ${rereadAs.before} becomes ${rereadAs.after}`);
    }
    tail = parts.join(', and ');
  }

  return `${head}; ${tail}. Nothing is deleted.`;
}
