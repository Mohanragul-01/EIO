/**
 * Chip - a pill you tap to choose something: a reschedule target, a weekday,
 * a reminder offset.
 *
 * 48dp tall where it is a control, because every one of these is a tap
 * target on a phone, and the visual pill stays slim inside that height. The
 * selected state is said three ways - fill, border, and a tick icon - so it
 * never rests on colour alone.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

type ChipProps = {
  label: string;
  /** A second line in smaller type, e.g. the date a target lands on. */
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
  /** Tone for a destructive or warning choice. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  detail,
  icon,
  selected = false,
  tone = 'default',
  disabled = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ChipProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const foreground = tone === 'danger' ? colors.danger : selected ? colors.primary : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={14} color={colors.primary} />
      ) : icon ? (
        <Ionicons name={icon} size={14} color={foreground} />
      ) : null}
      <View style={styles.texts}>
        <Text style={[styles.label, { color: foreground }]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  chip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  selected: {
    backgroundColor: colors.primary + '1F',
    borderColor: colors.primary + '80',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  texts: { flexShrink: 1 },
  label: {
    fontFamily: typography.title.fontFamily,
    fontSize: 13,
  },
  detail: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11,
    lineHeight: 14,
  },
}));
