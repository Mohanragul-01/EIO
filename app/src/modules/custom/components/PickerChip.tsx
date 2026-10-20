/**
 * PickerChip - one selectable chip, for every choice in the module builder.
 *
 * The builder is mostly "pick one of these": a type, a default, a role, a
 * chart bucket. One chip for all of them keeps the screen reading as one
 * control repeated, rather than a dozen slightly different ones. Selected is
 * tinted in the module's colour AND weighted in text, never colour alone.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

type PickerChipProps = {
  text: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** 'radio' for one-of-many (the default), 'checkbox' for toggles. */
  role?: 'radio' | 'checkbox';
  accessibilityLabel?: string;
};

export function PickerChip({
  text,
  selected,
  accent,
  onPress,
  icon,
  role = 'radio',
  accessibilityLabel,
}: PickerChipProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        selected && { backgroundColor: accent + '26', borderColor: accent + '99' },
        pressed && styles.pressed,
      ]}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={accessibilityLabel ?? text}
    >
      {icon ? (
        <Ionicons name={icon} size={13} color={selected ? colors.text : colors.textMuted} />
      ) : null}
      <Text style={[styles.text, selected && styles.textSelected]} numberOfLines={1}>
        {text}
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
    maxWidth: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  textSelected: {
    color: colors.text,
    fontFamily: typography.title.fontFamily,
  },
}));
