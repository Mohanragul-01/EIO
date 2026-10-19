/**
 * Theming tests.
 *
 * These assert on pure functions rather than rendering a tree. React 19 removed
 * react-test-renderer, which the component-render harness still depends on, and
 * the only real branching in theming (mode -> palette) is pure anyway. Pulling
 * resolveIsDark out of the provider is what made that possible, and it put the
 * rule somewhere findable at the same time.
 */
import { blendOver, contrastRatio } from '../contrast';
import {
  darkColors,
  layout,
  lightColors,
  spacing,
  makeElevation,
  makeTypography,
  paletteFor,
  resolveIsDark,
  type ThemeColors,
} from '../theme';

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the maximum', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('is 1:1 for a colour against itself', () => {
    expect(contrastRatio('#8B93A5', '#8B93A5')).toBe(1);
  });

  it('does not care which colour is the foreground', () => {
    expect(contrastRatio('#12141B', '#F4F6FA')).toBeCloseTo(contrastRatio('#F4F6FA', '#12141B'), 10);
  });

  it('blends a translucent colour over a solid one', () => {
    expect(blendOver('rgba(255, 255, 255, 0.5)', '#000000')).toBe('#808080');
    expect(blendOver('rgba(0,0,0,0)', '#123456')).toBe('#123456');
    expect(blendOver('#ABCDEF', '#000000')).toBe('#ABCDEF');
  });

  it('matches a published reference pair', () => {
    // #767676 on white is the well-known lightest grey that passes AA: 4.54:1.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

/**
 * Every text colour is used for small text somewhere - captions, hints, the
 * date under a row - so all four must clear WCAG AA for NORMAL text, 4.5:1, on
 * both surfaces text is drawn on. textFaint used to be about 3.7:1 on the dark
 * canvas and 3.1:1 on the light one.
 */
describe.each([
  ['dark', darkColors],
  ['light', lightColors],
] as [string, ThemeColors][])('%s palette text contrast', (_name, palette) => {
  const TEXT_TOKENS = ['text', 'textSecondary', 'textMuted', 'textFaint'] as const;

  it.each(TEXT_TOKENS)('%s reaches 4.5:1 on the background', (token) => {
    expect(contrastRatio(palette[token], palette.background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(TEXT_TOKENS)('%s reaches 4.5:1 on an elevated surface', (token) => {
    expect(contrastRatio(palette[token], palette.backgroundElevated)).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps faint text fainter than muted text, so the hierarchy survives', () => {
    expect(contrastRatio(palette.textFaint, palette.background)).toBeLessThan(
      contrastRatio(palette.textMuted, palette.background),
    );
  });

  it.each(['text', 'textSecondary'] as const)(
    '%s stays readable on a completed row, over either surface',
    (token) => {
      // The tint lifts the surface toward green, so the dimmer text tokens
      // fall below 4.5:1 on it (faint to about 3.5 in dark). Text on a ticked
      // row therefore uses text or textSecondary, and this pins that both pass.
      for (const surface of [palette.background, palette.backgroundElevated]) {
        expect(
          contrastRatio(palette[token], blendOver(palette.completed, surface)),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

  it('has an inverse surface that stands out, with readable text and action on it', () => {
    // The toast's pill: light on the dark theme and dark on the light one, so
    // it reads as a layer above the page in either.
    expect(contrastRatio(palette.inverseSurface, palette.background)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(palette.onInverseSurface, palette.inverseSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(palette.inversePrimary, palette.inverseSurface)).toBeGreaterThanOrEqual(4.5);
  });

  it('has an info colour and a completed tint distinct from success', () => {
    expect(palette.info).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(palette.completed).toBeTruthy();
    expect(palette.info).not.toBe(palette.success);
    expect(palette.completed).not.toBe(palette.success);
  });
});

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

  it('offers tabular figures for numbers that line up in columns', () => {
    // "60" and "57.5" in a set table, or rupee amounts down a list, wobble
    // left and right with proportional digits.
    expect(makeTypography(darkColors).numeric.fontVariant).toEqual(['tabular-nums']);
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

describe('layout', () => {
  it('floats toasts and banners clear of the add button, with a gap', () => {
    expect(layout.aboveFab - (layout.fabInset + layout.fabSize)).toBeGreaterThanOrEqual(spacing.sm);
  });
});
