/**
 * BudgetBar - one category's limit, how much of it is gone, and the pace tick.
 *
 * The thin vertical tick is where spending would be if it were spread evenly
 * over the month (budget.ts). Fill past it and the bar turns amber; past the
 * limit, red. The state is ALSO written beside an icon ("Over pace"), because
 * green and amber are the pair colour-blind eyes confuse most often.
 *
 * Tap the row for the category's month and history; the pencil edits the limit.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { BUDGET_STATE_WORDS, budgetLine, type BudgetState, type BudgetStatus } from '../budget';

const STATE_ICON: Record<BudgetState, React.ComponentProps<typeof Ionicons>['name']> = {
  under: 'checkmark-circle-outline',
  over_pace: 'speedometer-outline',
  over: 'alert-circle-outline',
};

type BudgetBarProps = {
  label: string;
  icon: string;
  color: string;
  status: BudgetStatus;
  onPress?: () => void;
  onEdit?: () => void;
};

export function BudgetBar({ label, icon, color, status, onPress, onEdit }: BudgetBarProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const stateColor =
    status.state === 'over' ? colors.danger : status.state === 'over_pace' ? colors.warning : colors.success;
  const words = BUDGET_STATE_WORDS[status.state];
  const line = budgetLine(status);
  const amounts = `${formatMoney(status.spentMinor, { compact: true })} of ${formatMoney(status.limitMinor, { compact: true })}`;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${label} budget. ${words}. ${amounts}. ${line}.`}
        accessibilityHint={onPress ? `Opens ${label} for this month and the last six` : undefined}
      >
        <View style={styles.top}>
          <View style={[styles.icon, { backgroundColor: color + '1F' }]}>
            <Ionicons name={icon as never} size={15} color={color} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.amounts}>{amounts}</Text>
        </View>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${status.fillShare * 100}%`, backgroundColor: stateColor }]} />
          {/* The pace tick sits over the fill, in the text colour, so it reads
              against green, amber and red alike. */}
          <View style={[styles.tick, { left: `${Math.min(99.5, status.tickShare * 100)}%` }]} />
        </View>

        <View style={styles.bottom}>
          <View style={styles.state}>
            <Ionicons name={STATE_ICON[status.state]} size={14} color={stateColor} />
            <Text style={[styles.stateText, { color: stateColor }]}>{words}</Text>
          </View>
          <Text style={styles.line} numberOfLines={1}>
            {line}
          </Text>
        </View>
      </Pressable>

      {onEdit ? (
        <Pressable
          onPress={onEdit}
          style={styles.edit}
          accessibilityRole="button"
          accessibilityLabel={`Change the ${label} budget`}
        >
          <Ionicons name="create-outline" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  main: {
    flex: 1,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  label: {
    ...typography.title,
    fontSize: 14,
    flex: 1,
  },
  amounts: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.pill,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: colors.text,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  state: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stateText: {
    ...typography.caption,
    fontSize: 12,
  },
  line: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
    textAlign: 'right',
  },
  edit: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginRight: -spacing.md,
  },
}));
