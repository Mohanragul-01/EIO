/**
 * bands.ts - resistance bands: their colours, and the figure each must carry.
 *
 * Band colours are what the bands physically are, not theme colours, so they
 * are data and stored as they are; the label is always shown beside the dot.
 * The same eight as the phone's Bands screen (which keeps its own copy until
 * it is pointed here), so a band added on either client looks the same on both.
 *
 * Every band needs roughly how much it helps. Records compare assisted sets by
 * their assistance, so a band with no figure would count as no help at all and
 * could outrank honest work. Any rough guess is better than none: it only has
 * to rank your bands.
 */

export const BAND_COLOURS: { name: string; hex: string }[] = [
  { name: 'Yellow', hex: '#F2C230' },
  { name: 'Red', hex: '#E5484D' },
  { name: 'Black', hex: '#2B2B2E' },
  { name: 'Purple', hex: '#8E4EC6' },
  { name: 'Green', hex: '#30A46C' },
  { name: 'Blue', hex: '#3E63DD' },
  { name: 'Orange', hex: '#F76B15' },
  { name: 'Grey', hex: '#8B8D98' },
];

/** The name of a stored colour, or null for one that is not in the set. */
export function bandColourName(hex: string): string | null {
  return BAND_COLOURS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name ?? null;
}

/** A band's approximate help in kg, or null when there is no usable figure. */
export function parseBandKg(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const kg = Number(trimmed);
  return Number.isFinite(kg) && kg > 0 && kg < 200 ? kg : null;
}
