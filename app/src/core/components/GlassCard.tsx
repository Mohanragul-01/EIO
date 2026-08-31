/**
 * GlassCard
 *
 * The frosted surface used for every card and tile.
 *
 * Four layers, and it needs all four:
 *   1. BlurView blurring the aurora behind it
 *   2. a low-alpha tint so it reads as a material rather than a window
 *   3. a 1px near-white line along the top edge, catching an implied light
 *   4. a hairline border separating it from whatever it overlaps
 * Without layer 3 it looks flat; without layer 1 it is just a tinted rectangle.
 *
 * The blurTarget comes from Screen through context. On SDK 57 Android, a
 * BlurView without one renders no blur at all, so this is what makes the glass
 * actually glass.
 */
import { BlurView } from 'expo-blur';
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { motion, radius } from '../theme';
import { useBlurTarget } from './blurTarget';

type GlassCardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  /** Blur strength, 1 to 100. Lower lets more of the aurora through. */
  intensity?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner padding is opt-out for cards that need edge-to-edge content. */
  padded?: boolean;
};

export function GlassCard({
  children,
  onPress,
  intensity = 34,
  style,
  padded = true,
}: GlassCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const blurTarget = useBlurTarget();

  /**
   * Press feedback uses React Native's built-in Animated rather than
   * Reanimated: no Babel plugin, no native rebuild, works in Expo Go as-is.
   * useNativeDriver hands it to the UI thread, so it stays smooth while JS is
   * busy fetching.
   *
   * useRef, not useState, so the same Animated.Value survives every render.
   */
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, { toValue, useNativeDriver: true, ...motion.press }).start();
  };

  const content = (
    <View style={styles.clip}>
      <BlurView
        intensity={intensity}
        tint={colors.blurTint}
        blurMethod="dimezisBlurViewSdk31Plus"
        blurTarget={blurTarget ?? undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.tint]} />
      <View style={styles.highlight} pointerEvents="none" />
      <View style={padded ? styles.padding : undefined}>{children}</View>
    </View>
  );

  if (!onPress) {
    return <View style={[styles.shell, style]}>{content}</View>;
  }

  return (
    <Animated.View style={[styles.shell, { transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => animateTo(motion.scalePressed)}
        onPressOut={() => animateTo(1)}
        hitSlop={4}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  shell: {
    borderRadius: radius.xl,
    ...elevation.card,
  },
  clip: {
    borderRadius: radius.xl,
    // Forces the BlurView to respect the rounded corners. Without it you get a
    // blurred square behind a rounded card.
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: 'transparent',
  },
  tint: {
    backgroundColor: colors.glass,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.glassHighlight,
    opacity: 0.5,
  },
  padding: {
    padding: 18,
  },
}));
