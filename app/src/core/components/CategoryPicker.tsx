/**
 * CategoryPicker
 *
 * The wrapping grid of category chips, extracted into core once a second form
 * needed it (transactions, then subscriptions). Writing it inline the first
 * time was right; copying it into the second form would have been the mistake.
 *
 * A wrapping grid rather than a dropdown: there are about a dozen categories,
 * seeing them all is one tap instead of two, and nothing covers the form you
 * are filling in.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import type { CategoryDef } from '../categories';
import { radius, spacing } from '../theme';

type CategoryPickerProps = {
  label?: string;
  options: CategoryDef[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function CategoryPicker({ label, options, value, onChange, style }: CategoryPickerProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.grid}>
        {options.map((option) => {
          const selected = option.key === value;
          // Category colours are picked for a dark canvas; on light they need
          // a touch more fill to stay visible without going muddy.
          const tint = isDark ? '26' : '1F';
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.chip,
                // Tinted with the category's own colour, so the picker teaches
                // the colour coding used in the list and the breakdown bars.
                selected && {
                  backgroundColor: option.color + tint,
                  borderColor: option.color + '6B',
                },
                pressed && styles.pressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={selected ? option.color : colors.textMuted}
              />
              <Text style={[styles.chipText, selected && { color: option.color }]}>
                {option.label}
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
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  chipText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
}));
