/**
 * Chip - one choice in a row of them: an account, a channel, a currency, a
 * reminder offset.
 *
 * 40dp tall with hitSlop to a 48dp target, and selection shown by a filled
 * background AND a check icon, so it never rests on colour alone. `role`
 * says whether the row is pick-one (radio) or pick-any (checkbox).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { tap } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

export function Chip({
  label,
  selected,
  onPress,
  role = 'radio',
  icon,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  role?: 'radio' | 'checkbox';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked: selected, disabled }}
    >
      {selected ? (
        <Ionicons name="checkmark" size={14} color={colors.primary} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={colors.textSecondary} />
      ) : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  selected: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  labelSelected: {
    color: colors.text,
  },
}));
