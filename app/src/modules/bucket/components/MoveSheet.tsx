/**
 * MoveSheet - a target that has passed, and where it goes next.
 *
 * Three answers, each a fresh promise rather than a penalty: next month, next
 * year, or back to Someday with no date at all. Opened from a Now card's
 * "Target passed · Move to…"; the Plan tab offers the same three inline.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { formatTarget, moveOptions, type Target } from '../plan';
import type { BucketItem } from '../types';

type MoveSheetProps = {
  item: BucketItem | null;
  today: string;
  onMove: (item: BucketItem, target: Target, label: string) => void;
  onClose: () => void;
};

export function MoveSheet({ item, today, onMove, onClose }: MoveSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const was =
    item?.target_on && item.target_precision
      ? formatTarget(item.target_on, item.target_precision, today)
      : null;

  return (
    <Sheet
      visible={item !== null}
      title="Move the target"
      subtitle={item ? `${item.title}${was ? ` · was ${was}` : ''}` : undefined}
      onClose={onClose}
    >
      <View>
        {moveOptions(today).map((option) => {
          const label =
            option.target.target_on && option.target.target_precision
              ? `${option.label} · ${formatTarget(option.target.target_on, option.target.target_precision, today)}`
              : `${option.label} · no date`;
          return (
            <Pressable
              key={option.label}
              onPress={() => item && onMove(item, option.target, option.label)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ionicons
                name={option.target.target_on ? 'calendar-outline' : 'infinite-outline'}
                size={18}
                color={colors.textSecondary}
              />
              <Text style={styles.text}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  text: { ...typography.body, color: colors.text },
  pressed: { opacity: 0.6 },
}));
