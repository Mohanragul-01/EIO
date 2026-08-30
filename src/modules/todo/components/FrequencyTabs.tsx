/**
 * FrequencyTabs - Daily / Weekly / Monthly / Yearly.
 *
 * Four fixed tabs rather than a navigator: they select a filter over one list,
 * they never stack, and nothing navigates to an individual tab. A tab navigator
 * would mount four copies of the list screen and fetch all four on open, to
 * show one.
 *
 * The underline slides between tabs instead of cutting, matching the pill in
 * core's SegmentedControl. This is not that component reused: SegmentedControl
 * is a form input that edits a value, this is navigation over a list, and they
 * want to look different for exactly that reason.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { motion, radius, spacing } from '../../../core/theme';
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency } from '../types';

type FrequencyTabsProps = {
  value: Frequency;
  onChange: (frequency: Frequency) => void;
};

export function FrequencyTabs({ value, onChange }: FrequencyTabsProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const selectedIndex = Math.max(0, FREQUENCIES.indexOf(value));

  // Measured at runtime: tab width depends on screen width, which is not known
  // until layout.
  const trackWidth = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  const tabWidth = trackWidth.current / FREQUENCIES.length;

  useEffect(() => {
    if (!ready) return;
    Animated.spring(translateX, {
      toValue: selectedIndex * tabWidth,
      useNativeDriver: true,
      ...motion.press,
    }).start();
  }, [selectedIndex, tabWidth, ready, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
    // Jump rather than animate on first layout, so the underline does not
    // visibly slide in from the left every time the screen mounts.
    translateX.setValue(selectedIndex * (trackWidth.current / FREQUENCIES.length));
    setReady(true);
  };

  return (
    <View style={styles.track} onLayout={onLayout}>
      {FREQUENCIES.map((frequency) => {
        const selected = frequency === value;
        return (
          <Pressable
            key={frequency}
            onPress={() => onChange(frequency)}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text
              style={[styles.label, { color: selected ? colors.text : colors.textMuted }]}
              numberOfLines={1}
            >
              {FREQUENCY_LABEL[frequency]}
            </Text>
          </Pressable>
        );
      })}

      {ready ? (
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
    flex: 1, // equal share, so the underline maths stays simple
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  label: {
    fontFamily: typography.title.fontFamily,
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  underline: {
    position: 'absolute',
    bottom: -1, // sits on the border rather than above it
    left: 0,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
}));
