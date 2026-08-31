/**
 * SegmentedControl
 *
 * Pick exactly one of a few options.
 *
 * Generic over the option type, so Todo can use it for priority and
 * Subscriptions for billing cycle, and in each case TypeScript knows the exact
 * union rather than plain string. That is the payoff for putting it in core
 * instead of writing a priority-specific control.
 *
 * The selected pill slides between positions rather than jumping, which is the
 * difference between a control and a nice control.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { motion, radius, spacing } from '../theme';

const PADDING = 4;

type SegmentedControlProps<T extends string> = {
  label?: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  renderLabel?: (option: T) => string;
  accentFor?: (option: T) => string;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  renderLabel = (o) => o,
  accentFor,
  style,
}: SegmentedControlProps<T>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const selectedIndex = Math.max(0, options.indexOf(value));

  // Measured at runtime: the pill width is not knowable until layout, and it
  // changes with screen width and option count.
  const trackWidth = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const [ready, setReady] = useState(false);

  const segmentWidth = trackWidth.current / options.length;

  useEffect(() => {
    if (!ready) return;
    Animated.spring(translateX, {
      toValue: selectedIndex * segmentWidth,
      useNativeDriver: true,
      ...motion.press,
    }).start();
  }, [selectedIndex, segmentWidth, ready, translateX]);

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width - PADDING * 2;
    // Jump rather than animate on first layout, so an already-selected value
    // does not visibly slide in from the left on mount.
    translateX.setValue(selectedIndex * (trackWidth.current / options.length));
    setReady(true);
  };

  const accent = accentFor ? accentFor(value) : colors.primary;

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.track} onLayout={onLayout}>
        {ready ? (
          <Animated.View
            style={[
              styles.pill,
              {
                width: segmentWidth,
                transform: [{ translateX }],
                backgroundColor: accent + '2E',
                borderColor: accent + '5C',
              },
            ]}
          />
        ) : null}

        {options.map((option) => {
          const isSelected = option === value;
          const optionAccent = accentFor ? accentFor(option) : colors.primary;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              style={styles.segment}
              // Tells screen readers this is a radio, not a plain button.
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: isSelected ? optionAccent : colors.textMuted },
                ]}
              >
                {renderLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: PADDING,
  },
  pill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  segment: {
    flex: 1, // equal share of the track, whatever the option count
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  segmentText: {
    fontFamily: typography.title.fontFamily,
    fontSize: 14,
  },
}));
