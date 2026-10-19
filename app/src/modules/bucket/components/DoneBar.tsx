/**
 * DoneBar - "Done · today", then Add memory or Undo.
 *
 * Ticking stays one tap; remembering is offered afterwards, never demanded
 * first. A form in front of the tick would turn a burst of ten ticks into ten
 * forms, and most ticks will never get a memory - which is fine.
 *
 * WHY NOT THE CORE TOAST. The toast carries one action, and this bar needs
 * two. It is drawn the same way - inverse surface, the same place above the
 * add button, read out by TalkBack - so the two look like one family, and the
 * screen hides the toast while this is up so they never stack.
 *
 * The parent owns what the bar is about (`bar`) and its lifetime: each new
 * tick replaces the bar, and the timer belongs to the bar's own id, so an old
 * timer can never close a newer bar.
 */
import React, { useEffect } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, Text, useAnimatedValue, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';

/** Long enough to read the line and reach either button. */
export const DONE_BAR_MS = 6000;

export type DoneBarState = {
  id: number;
  /** "Done · today" */
  message: string;
  /** Spoken, so TalkBack says what was ticked rather than only "Done". */
  spoken: string;
};

type DoneBarProps = {
  bar: DoneBarState | null;
  onAddMemory: () => void;
  onUndo: () => void;
  onExpire: (id: number) => void;
};

export function DoneBar({ bar, onAddMemory, onUndo, onExpire }: DoneBarProps) {
  const styles = useStyles();
  const { elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useAnimatedValue(0);

  const id = bar?.id;
  const spoken = bar?.spoken;

  useEffect(() => {
    if (id === undefined) return;

    // From zero each time, so a second tick visibly replaces the first bar
    // rather than looking as if nothing happened.
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    if (spoken) AccessibilityInfo.announceForAccessibility(`${spoken}. Add memory or Undo available.`);

    const timer = setTimeout(() => onExpire(id), DONE_BAR_MS);
    return () => clearTimeout(timer);
  }, [id, spoken, opacity, onExpire]);

  if (!bar) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.dock, { bottom: insets.bottom + layout.aboveFab }]}
    >
      <Animated.View
        style={[styles.bar, elevation.floating, { opacity }]}
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.message} numberOfLines={1}>
          {bar.message}
        </Text>
        <Pressable
          onPress={onAddMemory}
          accessibilityRole="button"
          accessibilityLabel="Add memory"
          hitSlop={{ top: 8, bottom: 8 }}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>Add memory</Text>
        </Pressable>
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          hitSlop={{ top: 8, bottom: 8 }}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
        >
          <Text style={styles.actionLabel}>Undo</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  dock: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    minHeight: 52,
    paddingLeft: spacing.lg,
    paddingRight: spacing.xs,
    borderRadius: radius.md,
    // Solid and inverse, like the toast: it floats over arbitrary rows and
    // must stay legible whatever is behind it, in both themes.
    backgroundColor: colors.inverseSurface,
  },
  message: {
    ...typography.body,
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.onInverseSurface,
  },
  action: {
    minWidth: 48,
    minHeight: 48,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: colors.glassStrong },
  actionLabel: { ...typography.title, fontSize: 14.5, color: colors.inversePrimary },
}));
