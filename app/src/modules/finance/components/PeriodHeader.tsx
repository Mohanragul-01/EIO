/**
 * PeriodHeader - ‹ October 2026 › with the days it covers underneath.
 *
 * The range line ("25 Sep – 24 Oct") appears whenever the month starts on a
 * day other than the 1st, so a salary-day month is never mistaken for the
 * calendar month. Away from the current month, the title becomes a button
 * back to it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { periodSubtitle, periodTitle, type Period } from '../period';

type PeriodHeaderProps = {
  period: Period;
  startDay: number;
  isCurrent: boolean;
  onStep: (delta: number) => void;
  onCurrent: () => void;
};

export function PeriodHeader({ period, startDay, isCurrent, onStep, onCurrent }: PeriodHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const range = periodSubtitle(period, startDay);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onStep(-1)}
        hitSlop={6}
        style={styles.arrow}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={isCurrent ? undefined : onCurrent}
        disabled={isCurrent}
        style={styles.titleBlock}
        accessibilityRole={isCurrent ? 'header' : 'button'}
        accessibilityLabel={`${periodTitle(period)}${range ? `, ${range}` : ''}`}
        accessibilityHint={isCurrent ? undefined : 'Goes back to this month'}
      >
        <Text style={styles.title}>{periodTitle(period)}</Text>
        {range ? <Text style={styles.range}>{range}</Text> : null}
        {!isCurrent ? <Text style={styles.back}>Back to this month</Text> : null}
      </Pressable>

      {/* Disabled in the current month: there is nothing in the future to look
          at, and wandering into empty months reads as a bug. */}
      <Pressable
        onPress={() => !isCurrent && onStep(1)}
        hitSlop={6}
        disabled={isCurrent}
        style={[styles.arrow, isCurrent && styles.arrowDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: isCurrent }}
      >
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  arrow: {
    // 36 drawn, 48 to the touch with the hit slop.
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  titleBlock: {
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.h2,
  },
  range: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11.5,
  },
  back: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.primary,
  },
}));
