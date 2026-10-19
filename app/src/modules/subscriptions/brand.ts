/**
 * brand.ts - the coloured tile and monogram every subscription row carries.
 *
 * A wall of identical rows is hard to scan; a brand colour and two letters
 * make Netflix findable at a glance. Logos are deliberately NOT used: they are
 * trademarks, fetching them means a network call per row, and a monogram on
 * the brand colour is what the best trackers fall back to anyway.
 *
 * The colours here are data, chosen from the row or the catalogue, never a
 * literal in a screen. The text colour on a tile is computed, because a fixed
 * white monogram vanishes on Swiggy orange.
 */
import { contrastRatio } from '../../core/contrast';
import { findService } from './catalogue';

/** Text on a dark tile. */
export const ON_BRAND_LIGHT = '#FFFFFF';
/** Text on a light tile: the app's own near-black. */
export const ON_BRAND_DARK = '#111827';

/**
 * Up to two characters for the tile: the first letters of the first two
 * words, or of a joined-up name's parts ("JioCinema" -> JC, "Zee5" -> Z5),
 * or one letter for a plain single word, which reads cleaner than "NE".
 */
export function monogram(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_.+&/]+/)
    .filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length === 0) return '?';
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();

  const word = words[0];
  // A capital or a digit after the first character starts a second part.
  const second = word.slice(1).match(/[A-Z0-9]/);
  return (word[0] + (second ? second[0] : '')).toUpperCase();
}

/** Whichever of white or near-black has more contrast on `hex`. */
export function readableOn(hex: string): string {
  return contrastRatio(ON_BRAND_LIGHT, hex) >= contrastRatio(ON_BRAND_DARK, hex)
    ? ON_BRAND_LIGHT
    : ON_BRAND_DARK;
}

/**
 * Colours for a subscription with none of its own: mid-tones that hold a
 * readable monogram in both themes. Picked by a hash of the name, so the same
 * subscription keeps the same colour on every screen and both clients.
 */
const FALLBACKS = [
  '#4F46E5',
  '#0E7490',
  '#047857',
  '#B45309',
  '#BE123C',
  '#7C3AED',
  '#2563EB',
  '#0F766E',
  '#9D174D',
  '#475569',
];

export function fallbackColor(name: string): string {
  let hash = 0;
  for (const char of name.trim().toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return FALLBACKS[hash % FALLBACKS.length];
}

/** The tile colour: the row's own, else its catalogue entry's, else a fallback. */
export function tileColor(sub: {
  color: string | null;
  service_key: string | null;
  name: string;
}): string {
  if (sub.color && /^#[0-9A-Fa-f]{6}$/.test(sub.color)) return sub.color.toUpperCase();
  const service = sub.service_key ? findService(sub.service_key) : undefined;
  return service?.color ?? fallbackColor(sub.name);
}
