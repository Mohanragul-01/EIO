/**
 * contrast.ts - WCAG 2.x contrast ratio between two colours.
 *
 * Exists so the palettes can be TESTED for readability rather than eyeballed.
 * "Looks fine" is how textFaint shipped at about 3.7:1 on the dark canvas:
 * readable on a good screen indoors, not in a dim gym or in sunlight, and below
 * the 4.5:1 floor for the small text it is actually used for.
 */

/** sRGB channel (0-255) to linear light, per the WCAG definition. */
function linear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Relative luminance of a '#rrggbb' colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * Contrast ratio from 1 (identical) to 21 (black on white). Order does not
 * matter: the lighter colour is always the numerator.
 *
 * Normal text needs 4.5:1; large text and non-text UI need 3:1.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The solid colour a translucent one becomes over a solid background, as
 * '#RRGGBB'. Contrast is only defined between solid colours, so a tint like
 * `completed` has to be flattened onto the surface it sits on before the text
 * over it can be checked. Accepts 'rgba(r, g, b, a)' or '#rrggbb' (opaque).
 */
export function blendOver(colour: string, background: string): string {
  const bg = channels(background);
  const rgba = colour.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/);
  const [fg, alpha] = rgba
    ? [[Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], rgba[4] === undefined ? 1 : Number(rgba[4])]
    : [channels(colour), 1];
  return (
    '#' +
    fg
      .map((c, i) =>
        Math.round(c * alpha + bg[i] * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
}

function channels(hex: string): number[] {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
}
