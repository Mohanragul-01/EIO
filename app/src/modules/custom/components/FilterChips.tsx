/**
 * FilterChips - the row of quick filters under a module's header.
 *
 * Built from the module's own fields (filters.ts), so it appears without any
 * setup: a reading list gets To read / Reading / Done, a habit log gets its
 * yes/no fields. All comes first and clears everything.
 *
 * A horizontal scroll, which is safe here: the module screen is not inside
 * the swipeable tab pager, so this is the only sideways gesture in the region.
 * A selected chip is tinted in the module colour AND carries a tick, so the
 * state never rests on colour alone.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { ActiveFilters, FilterChip } from '../filters';

type FilterChipsProps = {
  chips: FilterChip[];
  active: ActiveFilters;
  accent: string;
  onChange: (next: ActiveFilters) => void;
};

function isOn(chip: FilterChip, active: ActiveFilters): boolean {
  if (chip.kind === 'period') return active.period === chip.period;
  const value = active.value;
  return (
    value !== null &&
    value.kind === chip.value.kind &&
    value.fieldKey === chip.value.fieldKey &&
    value.value === chip.value.value
  );
}

export function FilterChips({ chips, active, accent, onChange }: FilterChipsProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const none = active.value === null && active.period === null;

  const press = (chip: FilterChip) => {
    const on = isOn(chip, active);
    if (chip.kind === 'period') onChange({ ...active, period: on ? null : chip.period });
    else onChange({ ...active, value: on ? null : chip.value });
  };

  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        on && { borderColor: accent, backgroundColor: accent + '2E' },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={on && key !== 'all' ? `${label}, filter on` : label}
    >
      {on ? <Ionicons name="checkmark" size={13} color={colors.text} /> : null}
      <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}
    >
      {chip('all', 'All', none, () => onChange({ value: null, period: null }))}
      {chips.map((c) => chip(c.id, c.label, isOn(c, active), () => press(c)))}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    // Bleeds to the screen edge so chips scroll under it rather than
    // stopping short at the list's padding.
    marginHorizontal: -spacing.xl,
    marginBottom: spacing.md,
  },
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  textOn: {
    color: colors.text,
  },
}));
