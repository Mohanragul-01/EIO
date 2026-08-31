/**
 * AuroraBackground
 *
 * The coloured light behind everything. Frosted glass is a relationship
 * between two layers, not a card style: a blur over a flat background just
 * looks like a slightly different flat background. These soft blooms are what
 * the cards actually blur.
 *
 * React Native has no CSS blur filter for arbitrary views, so the softness
 * comes from each gradient fading its own colour out to transparent, plus low
 * opacity.
 */
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Dimensions, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../ThemeContext';

const { width: SCREEN_W } = Dimensions.get('window');

export function AuroraBackground() {
  const { colors, isDark } = useTheme();

  return (
    // pointerEvents="none" matters: this layer must never swallow a tap meant
    // for the UI above it.
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[colors.backgroundElevated, colors.background]}
        style={StyleSheet.absoluteFill}
      />

      {/* Top left bloom, behind the header. */}
      <Blob
        color={colors.auroraA}
        size={SCREEN_W * 1.1}
        style={{ top: -SCREEN_W * 0.45, left: -SCREEN_W * 0.3 }}
        opacity={isDark ? 0.55 : 0.5}
      />

      {/* Right bloom, lower down, so the middle of the screen keeps some colour. */}
      <Blob
        color={colors.auroraB}
        size={SCREEN_W * 0.95}
        style={{ top: SCREEN_W * 0.35, right: -SCREEN_W * 0.42 }}
        opacity={isDark ? 0.42 : 0.42}
      />

      {/* Cool counterweight at the bottom, so it is not monochrome purple. */}
      <Blob
        color={colors.auroraC}
        size={SCREEN_W * 1.0}
        style={{ bottom: -SCREEN_W * 0.5, left: -SCREEN_W * 0.25 }}
        opacity={isDark ? 0.34 : 0.38}
      />

      {/* Knocks the blooms back so light text keeps its contrast. */}
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]} />
    </View>
  );
}

function Blob({
  color,
  size,
  style,
  opacity,
}: {
  color: string;
  size: number;
  style: ViewStyle;
  opacity: number;
}) {
  return (
    <LinearGradient
      // Fading the same colour to fully transparent is what gives the soft
      // edge. A hard-edged circle would read as a sticker.
      colors={[color, color + '00']}
      start={{ x: 0.5, y: 0.1 }}
      end={{ x: 0.5, y: 1 }}
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
