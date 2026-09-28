/**
 * Tabs - a row of filters over one list, with a sliding underline.
 *
 * This started as FrequencyTabs inside the Todo module and moved down here once
 * Notes needed the same thing, per the sharing rule in the README. Generic over
 * the option type, so each module keeps its own vocabulary: Todo passes
 * Frequency, Notes passes NotesView, and in both cases TypeScript knows the
 * exact union rather than plain string.
 *
 * NOT the same thing as SegmentedControl, despite looking related.
 * SegmentedControl is a form input that edits a value you are about to save;
 * this switches which slice of a list you are looking at. They read differently
 * on purpose, and merging them would mean one component with a `variant` prop
 * doing two unrelated jobs.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  Text,
  useAnimatedValue,
  View,
} from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { motion, radius, spacing } from '../theme';

type TabsProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** How each option is labelled. Defaults to the raw value. */
  renderLabel?: (option: T) => string;
  /** Optional count shown beside a label, e.g. an inbox backlog. */
  renderBadge?: (option: T) => number | null;
};

export function Tabs<T extends string>({
  options,
  value,
  onChange,
  renderLabel = (o) => o,
  renderBadge,
}: TabsProps<T>) {
  const styles = useStyles();
  const { colors } = useTheme();

  const selectedIndex = Math.max(0, options.indexOf(value));

  /**
   * Measured at runtime: tab width depends on screen width, which is not known
   * until layout has happened.
   *
   * STATE, NOT A REF. It was a ref read during render, which meant a second
   * layout - rotating the device, or a split-screen resize - updated the width
   * without re-rendering, because the setReady(true) beside it was a no-op by
   * then. The underline corrected itself on that layout and then jumped to the
   * OLD width the next time you changed tab.
   */
  const [trackWidth, setTrackWidth] = useState(0);
  const translateX = useAnimatedValue(0);
  /** Whether the underline has been placed once, so first paint does not slide. */
  const placed = useRef(false);

  const tabWidth = options.length > 0 ? trackWidth / options.length : 0;

  useEffect(() => {
    if (trackWidth === 0) return;

    // Jump rather than animate the first time, so the underline does not
    // visibly slide in from the left every time the screen mounts.
    if (!placed.current) {
      placed.current = true;
      translateX.setValue(selectedIndex * tabWidth);
      return;
    }

    Animated.spring(translateX, {
      toValue: selectedIndex * tabWidth,
      useNativeDriver: true,
      ...motion.press,
    }).start();
  }, [selectedIndex, tabWidth, trackWidth, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    // Same width means nothing moved; setting it anyway would re-render on
    // every layout pass.
    setTrackWidth((current) => (current === width ? current : width));
  };

  return (
    <View style={styles.track} onLayout={onLayout}>
      {options.map((option) => {
        const selected = option === value;
        const badge = renderBadge?.(option) ?? null;

        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <View style={styles.labelRow}>
              <Text
                style={[styles.label, { color: selected ? colors.text : colors.textMuted }]}
                numberOfLines={1}
              >
                {renderLabel(option)}
              </Text>

              {/* Only when there is something to report: a permanent "0" badge
                  is noise, and trains you to stop reading it. */}
              {badge && badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}

      {trackWidth > 0 ? (
        <Animated.View
          style={[styles.underline, { width: tabWidth, transform: [{ translateX }] }]}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  track: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  tab: {
    flex: 1, // equal share, which keeps the underline maths trivial
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  label: {
    fontFamily: typography.title.fontFamily,
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  badge: {
    minWidth: 17,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + '2E',
    alignItems: 'center',
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.primary,
  },
  underline: {
    position: 'absolute',
    bottom: -1, // sits on the border rather than floating above it
    left: 0,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
}));
