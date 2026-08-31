/**
 * theme.ts
 *
 * Design tokens for the whole app. Two palettes (dark and light) plus the
 * values that don't change between them: spacing, radii, fonts, motion.
 *
 * Nothing here is read directly by components. They call useTheme() from
 * ThemeContext, which hands back the palette for the currently active mode.
 * That indirection is what lets the app switch themes at runtime instead of
 * baking one palette in at import time.
 */

export type ThemeColors = {
  background: string;
  backgroundElevated: string;

  glass: string;
  glassStrong: string;
  glassBorder: string;
  glassBorderStrong: string;
  glassHighlight: string;

  auroraA: string;
  auroraB: string;
  auroraC: string;
  /** Sits over the aurora so text keeps its contrast. */
  scrim: string;
  /** Which BlurView tint suits this palette. */
  blurTint: 'dark' | 'light';

  accentIndigo: string;
  accentAmber: string;
  accentEmerald: string;
  accentCyan: string;
  accentRose: string;

  primary: string;
  onPrimary: string;

  success: string;
  warning: string;
  danger: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  shadow: string;
};

/**
 * Dark palette.
 *
 * Lifted a step brighter than the first version, which read as murky on an
 * OLED phone: the canvas moved from near-black to a soft charcoal, the glass
 * fills and borders gained alpha, and secondary text is lighter. Pure black
 * backgrounds also make the frosted panels disappear, since there is nothing
 * behind them with enough light to blur.
 */
export const darkColors: ThemeColors = {
  background: '#12141B',
  backgroundElevated: '#191C25',

  glass: 'rgba(255,255,255,0.085)',
  glassStrong: 'rgba(255,255,255,0.13)',
  glassBorder: 'rgba(255,255,255,0.15)',
  glassBorderStrong: 'rgba(255,255,255,0.24)',
  glassHighlight: 'rgba(255,255,255,0.30)',

  auroraA: '#4F46E5',
  auroraB: '#7C3AED',
  auroraC: '#0D9488',
  scrim: 'rgba(18,20,27,0.55)',
  blurTint: 'dark',

  accentIndigo: '#8E97FF',
  accentAmber: '#FCC53D',
  accentEmerald: '#4ADEA9',
  accentCyan: '#3FDCF2',
  accentRose: '#FF8497',

  primary: '#8E97FF',
  onPrimary: '#12141B',

  success: '#4ADEA9',
  warning: '#FCC53D',
  danger: '#FF8497',

  text: '#F7F8FA',
  textSecondary: '#BFC5D2',
  textMuted: '#8B93A5',
  textFaint: '#646C7E',

  shadow: '#000000',
};

/**
 * Light palette.
 *
 * Glass in light mode is white at high alpha over a pale canvas, with a much
 * softer border. Reusing the dark values with the colours flipped produces
 * grey mud, so the two palettes are tuned separately rather than derived from
 * one another.
 */
export const lightColors: ThemeColors = {
  background: '#F4F6FA',
  backgroundElevated: '#FFFFFF',

  glass: 'rgba(255,255,255,0.72)',
  glassStrong: 'rgba(255,255,255,0.92)',
  glassBorder: 'rgba(17,24,39,0.09)',
  glassBorderStrong: 'rgba(17,24,39,0.16)',
  glassHighlight: 'rgba(255,255,255,0.95)',

  auroraA: '#A5B4FC',
  auroraB: '#C4B5FD',
  auroraC: '#5EEAD4',
  scrim: 'rgba(244,246,250,0.62)',
  blurTint: 'light',

  accentIndigo: '#4F46E5',
  accentAmber: '#B45309',
  accentEmerald: '#047857',
  accentCyan: '#0E7490',
  accentRose: '#BE123C',

  primary: '#4F46E5',
  onPrimary: '#FFFFFF',

  success: '#047857',
  warning: '#B45309',
  danger: '#BE123C',

  text: '#111827',
  textSecondary: '#3F4757',
  textMuted: '#606B7E',
  textFaint: '#8B94A6',

  shadow: '#1E293B',
};

/** 4pt scale. Every gap in the app comes from here. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

/**
 * Font families map to the Inter weights loaded in App.tsx. With custom fonts
 * you pick the specific file rather than setting fontWeight, which on Android
 * would synthesise a muddy fake bold.
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

/** Shared motion constants, so every animation feels like one hand. */
export const motion = {
  press: { friction: 7, tension: 180 },
  scalePressed: 0.965,
  enterDuration: 420,
  stagger: 65,
} as const;

export type Typography = ReturnType<typeof makeTypography>;

/**
 * Text presets. Built from a palette rather than exported as a constant,
 * because each one carries a colour and the colour depends on the mode.
 *
 * Negative letter-spacing that tightens as size grows is the main thing
 * separating this from default system styling; the uppercase micro-label
 * inverts that rule and gets positive tracking.
 */
export function makeTypography(colors: ThemeColors) {
  return {
    display: {
      fontFamily: fonts.bold,
      fontSize: 32,
      letterSpacing: -0.8,
      color: colors.text,
    },
    h1: {
      fontFamily: fonts.semibold,
      fontSize: 24,
      letterSpacing: -0.5,
      color: colors.text,
    },
    h2: {
      fontFamily: fonts.semibold,
      fontSize: 18,
      letterSpacing: -0.3,
      color: colors.text,
    },
    title: {
      fontFamily: fonts.semibold,
      fontSize: 15.5,
      letterSpacing: -0.2,
      color: colors.text,
    },
    body: {
      fontFamily: fonts.regular,
      fontSize: 14.5,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    caption: {
      fontFamily: fonts.regular,
      fontSize: 12.5,
      lineHeight: 18,
      color: colors.textMuted,
    },
    overline: {
      fontFamily: fonts.medium,
      fontSize: 10.5,
      letterSpacing: 1.1,
      textTransform: 'uppercase' as const,
      color: colors.textMuted,
    },
  } as const;
}

export type Elevation = ReturnType<typeof makeElevation>;

/**
 * Android reads `elevation`, iOS reads the shadow* props, so a cross-platform
 * shadow sets both. Light mode needs a softer, tighter shadow: the same values
 * that look right on a dark canvas turn into visible grey smudges on a pale one.
 */
export function makeElevation(colors: ThemeColors, isDark: boolean) {
  return {
    card: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: isDark ? 8 : 4 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: isDark ? 20 : 12,
      elevation: isDark ? 8 : 3,
    },
    floating: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: isDark ? 12 : 6 },
      shadowOpacity: isDark ? 0.45 : 0.14,
      shadowRadius: isDark ? 28 : 16,
      elevation: isDark ? 14 : 6,
    },
  } as const;
}

/**
 * Resolve the active mode against the phone's own setting.
 *
 * Extracted from the provider because this is the one piece of theming with
 * real branching, and a pure function is both easier to reason about and
 * testable without rendering anything.
 *
 * "system" follows the phone. Anything other than an explicit 'light' from the
 * OS counts as dark, so an unknown or null scheme lands on the app's primary
 * look rather than flipping to light unexpectedly.
 */
export function resolveIsDark(
  mode: 'system' | 'light' | 'dark',
  // Matches React Native's ColorSchemeName, which includes 'unspecified'
  // on some platforms alongside null.
  systemScheme: 'light' | 'dark' | 'unspecified' | null | undefined,
): boolean {
  if (mode === 'light') return false;
  if (mode === 'dark') return true;
  return systemScheme !== 'light';
}

export function paletteFor(isDark: boolean): ThemeColors {
  return isDark ? darkColors : lightColors;
}
