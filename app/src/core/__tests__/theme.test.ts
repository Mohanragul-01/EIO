/**
 * Theming tests.
 *
 * These assert on pure functions rather than rendering a tree. React 19 removed
 * react-test-renderer, which the component-render harness still depends on, and
 * the only real branching in theming (mode -> palette) is pure anyway. Pulling
 * resolveIsDark out of the provider is what made that possible, and it put the
 * rule somewhere findable at the same time.
 */
import {
  darkColors,
  lightColors,
  makeElevation,
  makeTypography,
  paletteFor,
  resolveIsDark,
} from '../theme';

describe('palettes', () => {
  it('define exactly the same keys', () => {
    // A key in one palette but not the other renders as `undefined` in that
    // mode, which fails silently instead of loudly.
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('differ on every colour that carries meaning', () => {
    expect(darkColors.background).not.toBe(lightColors.background);
    expect(darkColors.text).not.toBe(lightColors.text);
    expect(darkColors.glass).not.toBe(lightColors.glass);
    expect(darkColors.blurTint).toBe('dark');
    expect(lightColors.blurTint).toBe('light');
  });

  it('brightened the dark canvas past the original near-black', () => {
    // The first version used #07080B, which read as murky on an OLED panel and
    // left nothing behind the glass worth blurring.
    const red = parseInt(darkColors.background.replace('#', '').slice(0, 2), 16);
    expect(red).toBeGreaterThan(0x0a);
  });

  it('keeps light text genuinely dark and dark text genuinely light', () => {
    const lum = (hex: string) => parseInt(hex.replace('#', '').slice(0, 2), 16);
    expect(lum(darkColors.text)).toBeGreaterThan(0xc0);
    expect(lum(lightColors.text)).toBeLessThan(0x40);
  });
});

describe('resolveIsDark', () => {
  it('honours an explicit choice regardless of the phone', () => {
    expect(resolveIsDark('dark', 'light')).toBe(true);
    expect(resolveIsDark('light', 'dark')).toBe(false);
  });

  it('follows the phone in system mode', () => {
    expect(resolveIsDark('system', 'light')).toBe(false);
    expect(resolveIsDark('system', 'dark')).toBe(true);
  });

  it('falls back to dark when the phone reports nothing', () => {
    // Android can return null before the scheme is known. Defaulting to the
    // app's primary look beats flashing light for a frame.
    expect(resolveIsDark('system', null)).toBe(true);
    expect(resolveIsDark('system', undefined)).toBe(true);
  });
});

describe('paletteFor', () => {
  it('maps the boolean to the right palette object', () => {
    expect(paletteFor(true)).toBe(darkColors);
    expect(paletteFor(false)).toBe(lightColors);
  });
});

describe('makeTypography', () => {
  it('takes its colour from the palette it is handed', () => {
    expect(makeTypography(darkColors).h1.color).toBe(darkColors.text);
    expect(makeTypography(lightColors).h1.color).toBe(lightColors.text);
  });

  it('tightens tracking as size grows, and inverts it for the micro label', () => {
    const t = makeTypography(darkColors);
    expect(t.display.letterSpacing).toBeLessThan(t.h2.letterSpacing);
    expect(t.overline.letterSpacing).toBeGreaterThan(0);
  });
});

describe('makeElevation', () => {
  it('softens shadows in light mode', () => {
    // The values that look right on a dark canvas become grey smudges on a
    // pale one.
    const dark = makeElevation(darkColors, true);
    const light = makeElevation(lightColors, false);
    expect(light.card.shadowOpacity).toBeLessThan(dark.card.shadowOpacity);
    expect(light.card.elevation).toBeLessThan(dark.card.elevation);
  });

  it('sets both iOS and Android shadow properties', () => {
    // Android reads `elevation`, iOS reads shadow*. Missing either gives a
    // flat card on one platform only, which is easy to miss.
    const e = makeElevation(darkColors, true).card;
    expect(e.elevation).toBeGreaterThan(0);
    expect(e.shadowRadius).toBeGreaterThan(0);
    expect(e.shadowColor).toBe(darkColors.shadow);
  });
});
