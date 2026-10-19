/**
 * noteColors.ts - the swatches a note can wear.
 *
 * Colour is how you find the three notes you open every day without reading:
 * the green shopping list, the blue trip plan. It shows as a faint tint over
 * the card plus a solid stripe down its left edge, and it doubles as a filter.
 *
 * ONE SWATCH PER COLOUR, used on both themes, as the ledger categories do.
 * Each is a muted mid-tone chosen so the stripe stays visible on the dark and
 * the light canvas alike, and so the tint is too faint to cost any text its
 * contrast (both are tested). The card's text colour never changes.
 *
 * Stored as a KEY, not a hex value, so a swatch can be retuned here without
 * touching a single row; a key this file no longer knows reads as no colour.
 */

export type NoteColorKey = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple';

export type NoteColor = {
  key: NoteColorKey;
  /** Spoken and shown wherever the swatch alone would be colour-only. */
  label: string;
  swatch: string;
};

export const NOTE_COLORS: readonly NoteColor[] = [
  { key: 'red', label: 'Red', swatch: '#CF5B63' },
  { key: 'orange', label: 'Orange', swatch: '#C97538' },
  { key: 'yellow', label: 'Yellow', swatch: '#A8831A' },
  { key: 'green', label: 'Green', swatch: '#3F9468' },
  { key: 'teal', label: 'Teal', swatch: '#2F8E91' },
  { key: 'blue', label: 'Blue', swatch: '#5482D6' },
  { key: 'purple', label: 'Purple', swatch: '#8E6CD0' },
];

/** The colour for a stored value, or null for none / unknown. */
export function readNoteColor(value: unknown): NoteColor | null {
  if (typeof value !== 'string') return null;
  return NOTE_COLORS.find((c) => c.key === value) ?? null;
}

/**
 * The card tint: the swatch at 12% over whatever surface the card has.
 * rgba() rather than an 8-digit hex so the same string works in React Native
 * and in CSS, and so the contrast test can flatten it.
 */
export function noteTint(swatch: string): string {
  const value = swatch.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, 0.12)`;
}
