/**
 * CategoryGrid - the add form's category picker: four to a row, most used
 * first (the order comes from defaults.orderByUse).
 *
 * Its own grid rather than core's CategoryPicker chips, for two reasons. Tiles
 * in fixed columns put the same category in the same place every time, which
 * is what lets a thumb find Food without reading. And each tile is at least
 * 56dp tall, where the chips are about 36dp - under the 48dp a touch target
 * needs.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import type { CategoryDef } from '../../../core/categories';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

type CategoryGridProps = {
  label: string;
  options: CategoryDef[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function CategoryGrid({ label, options, value, onChange, style }: CategoryGridProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  // Category colours are picked for a dark canvas; on light they need a touch
  // more fill to stay visible without going muddy (as in CategoryPicker).
  const tint = isDark ? '26' : '1F';

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <View key={option.key} style={styles.cell}>
              <Pressable
                onPress={() => onChange(option.key)}
                style={({ pressed }) => [
                  styles.tile,
                  selected && { backgroundColor: option.color + tint, borderColor: option.color + '80' },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={option.label}
              >
                <Ionicons name={option.icon} size={19} color={selected ? option.color : colors.textMuted} />
                <Text
                  style={[styles.tileText, selected && styles.tileTextSelected]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
              </Pressable>
            </View>
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
    // Negative margin plus padding per cell: an even 8dp gutter between tiles
    // with four exact columns, which `gap` cannot give with percentage widths.
    marginHorizontal: -spacing.xs,
  },
  cell: {
    width: '25%',
    padding: spacing.xs,
  },
  tile: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  tileText: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 15,
    color: colors.textSecondary,
  },
  tileTextSelected: {
    color: colors.text,
  },
}));
