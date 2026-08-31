/**
 * Screen
 *
 * The wrapper every screen sits inside. It paints the aurora, keeps content
 * clear of the notch and gesture bar, applies the standard side gutter, and
 * publishes the blur target that GlassCard needs.
 */
import { BlurTargetView } from 'expo-blur';
import React, { useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../ThemeContext';
import { spacing } from '../theme';
import { AuroraBackground } from './AuroraBackground';
import { BlurTargetProvider } from './blurTarget';

type ScreenProps = {
  children: React.ReactNode;
  /** Set false when the screen owns its padding, e.g. a full-bleed list. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Screen({ children, padded = true, style }: ScreenProps) {
  const { colors } = useTheme();

  /**
   * The view BlurView samples from. It wraps only the background, not the
   * content: if it wrapped the cards too, each card would blur the other cards
   * and you would get feedback rather than frosted glass.
   */
  const blurTargetRef = useRef<View>(null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <BlurTargetView ref={blurTargetRef} style={StyleSheet.absoluteFill}>
        <AuroraBackground />
      </BlurTargetView>

      <BlurTargetProvider value={blurTargetRef}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
          <View style={[styles.content, padded && styles.padded, style]}>{children}</View>
        </SafeAreaView>
      </BlurTargetProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safe: {
    flex: 1,
    // Transparent so the aurora shows through, including under the status bar.
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
});
