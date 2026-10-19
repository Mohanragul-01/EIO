/**
 * Resistance bands: their colours, and the one number every band must carry.
 */
import { BAND_COLOURS, bandColourName, parseBandKg } from '../bands';

describe('BAND_COLOURS', () => {
  it('has distinct names and colours', () => {
    expect(new Set(BAND_COLOURS.map((c) => c.name)).size).toBe(BAND_COLOURS.length);
    expect(new Set(BAND_COLOURS.map((c) => c.hex.toLowerCase())).size).toBe(BAND_COLOURS.length);
  });

  it('names a stored colour, whatever its case', () => {
    expect(bandColourName(BAND_COLOURS[1].hex.toLowerCase())).toBe(BAND_COLOURS[1].name);
    expect(bandColourName('#123456')).toBeNull();
  });
});

describe('parseBandKg', () => {
  it('reads a positive figure, with a comma or a point', () => {
    expect(parseBandKg('15')).toBe(15);
    expect(parseBandKg(' 7,5 ')).toBe(7.5);
    expect(parseBandKg('22.5')).toBe(22.5);
  });

  it('refuses a band with no figure, or a figure no band could be', () => {
    expect(parseBandKg('')).toBeNull();
    expect(parseBandKg('0')).toBeNull();
    expect(parseBandKg('-5')).toBeNull();
    expect(parseBandKg('200')).toBeNull();
    expect(parseBandKg('heavy')).toBeNull();
  });
});
