/**
 * CategoryIcon - a category's glyph, drawn with Ionicons.
 *
 * The map from category to glyph is shared with the website (categories.ts);
 * this file only says how the phone draws each glyph. It is a Record over
 * every glyph, so a glyph added there without an icon here fails the type
 * check instead of rendering a blank square.
 *
 * Monochrome on purpose. Sixty-one categories in sixty-one colours would be a
 * rainbow with no meaning, and colour on this screen already means cost.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius } from '../../../core/theme';
import { glyphFor, type CategoryGlyph } from '../categories';

type IconName = keyof typeof Ionicons.glyphMap;

const GLYPH_ICON: Record<CategoryGlyph, IconName> = {
  camera: 'camera-outline',
  bolt: 'flash-outline',
  home: 'home-outline',
  paw: 'paw-outline',
  body: 'body-outline',
  care: 'medkit-outline',
  balloon: 'balloon-outline',
  civic: 'business-outline',
  collection: 'albums-outline',
  gem: 'diamond-outline',
  target: 'locate-outline',
  food: 'restaurant-outline',
  festival: 'sparkles-outline',
  debate: 'chatbubbles-outline',
  sighting: 'binoculars-outline',
  stopwatch: 'stopwatch-outline',
  rocket: 'rocket-outline',
  leaf: 'leaf-outline',
  etiquette: 'wine-outline',
  terrain: 'earth-outline',
  growth: 'trending-up-outline',
  dice: 'dice-outline',
  work: 'briefcase-outline',
  groom: 'cut-outline',
  heart: 'heart-outline',
  admin: 'clipboard-outline',
  journey: 'train-outline',
  language: 'language-outline',
  legacy: 'book-outline',
  mind: 'bulb-outline',
  recovery: 'pulse-outline',
  money: 'cash-outline',
  motorsport: 'speedometer-outline',
  music: 'musical-notes-outline',
  speaking: 'mic-outline',
  novelty: 'color-wand-outline',
  giving: 'gift-outline',
  pilgrimage: 'footsteps-outline',
  safety: 'shield-checkmark-outline',
  sailing: 'boat-outline',
  sky: 'telescope-outline',
  sculpture: 'shapes-outline',
  senses: 'ear-outline',
  signals: 'key-outline',
  social: 'people-outline',
  space: 'planet-outline',
  spectator: 'ticket-outline',
  sport: 'trophy-outline',
  tech: 'hardware-chip-outline',
  trades: 'construct-outline',
  travel: 'compass-outline',
  naturalist: 'fish-outline',
  vehicle: 'car-outline',
  art: 'color-palette-outline',
  water: 'water-outline',
  wild: 'bonfire-outline',
  snow: 'snow-outline',
  // Ionicons has no bird; the paw is the nearest honest picture.
  falconry: 'paw-outline',
  cafe: 'cafe-outline',
  wellness: 'flower-outline',
  landmark: 'location-outline',
  flag: 'flag-outline',
};

export function categoryIconName(category: string): IconName {
  return GLYPH_ICON[glyphFor(category)];
}

type CategoryIconProps = {
  category: string;
  size?: number;
  color?: string;
  /** Draw it on a small tinted tile, for headers and cards. */
  tile?: boolean;
};

/**
 * Decorative: whatever it sits beside already names the category, so it is
 * hidden from screen readers rather than read out as "image".
 */
export function CategoryIcon({ category, size = 14, color, tile = false }: CategoryIconProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const icon = (
    <Ionicons
      name={categoryIconName(category)}
      size={size}
      color={color ?? colors.textMuted}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );

  if (!tile) return icon;
  return (
    <View
      style={[styles.tile, { width: size + 12, height: size + 12 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icon}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: {
    borderRadius: radius.sm,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
