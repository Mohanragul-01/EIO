/**
 * TodayChecklist - the things you use every day, one tap each.
 *
 * Which products appear, and why the rows never move, is decided in
 * checklist.ts. Here: a tap logs today's usual amount and a second tap takes
 * it back (each with an undo toast from the screen), and "Log all" does every
 * row not yet ticked in one write.
 *
 * A ticked row tints with `completed` and keeps its text in `text` /
 * `textSecondary`, the two colours that stay readable on that tint.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { ChecklistRow } from '../checklist';
import { formatQuantity } from '../types';

type TodayChecklistProps = {
  rows: ChecklistRow[];
  /** Rows with a write in flight: a second tap would race the first. */
  busy: Set<string>;
  onToggle: (row: ChecklistRow) => void;
  onLogAll: () => void;
  loggingAll: boolean;
};

function timeOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TodayChecklist({ rows, busy, onToggle, onLogAll, loggingAll }: TodayChecklistProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const remaining = rows.filter((row) => !row.done).length;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.overline} accessibilityRole="header">
            Today
          </Text>
          <Text style={styles.count}>
            {remaining === 0 ? 'All logged' : `${rows.length - remaining} of ${rows.length} logged`}
          </Text>
        </View>
        {remaining > 0 ? (
          <Pressable
            onPress={onLogAll}
            disabled={loggingAll}
            style={({ pressed }) => [styles.logAll, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Log all ${remaining} for today`}
          >
            {loggingAll ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.logAllText}>Log all ({remaining})</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {rows.map((row) => {
        const isBusy = busy.has(row.product.id);
        const last = row.todayUses[0];
        return (
          <Pressable
            key={row.product.id}
            onPress={() => onToggle(row)}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.row,
              row.done && { backgroundColor: colors.completed },
              pressed && styles.pressed,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: row.done, busy: isBusy }}
            accessibilityLabel={`${row.product.name}, ${formatQuantity(row.amount, row.product.unit)}`}
            accessibilityHint={row.done ? "Takes back today's use" : 'Logs it for today'}
          >
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {row.product.name}
              </Text>
              <Text style={[styles.amount, row.done && styles.amountDone]}>
                {row.done && last
                  ? `Logged ${formatQuantity(last.quantity, row.product.unit)} at ${timeOf(last.created_at)}`
                  : formatQuantity(row.amount, row.product.unit)}
              </Text>
            </View>
            <View
              style={[
                styles.check,
                row.done && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              {isBusy ? (
                <ActivityIndicator size="small" color={row.done ? colors.onPrimary : colors.primary} />
              ) : row.done ? (
                <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  headText: { flex: 1 },
  overline: { ...typography.overline },
  count: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  logAll: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    marginRight: -spacing.sm,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  logAllText: { ...typography.title, fontSize: 14, color: colors.primary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.md,
  },
  rowText: { flex: 1 },
  name: { ...typography.body, color: colors.text },
  amount: { ...typography.caption, ...typography.numeric, color: colors.textMuted },
  // On the completed tint only text / textSecondary keep 4.5:1.
  amountDone: { color: colors.textSecondary },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    // textMuted, not a glass border: an empty circle is the control itself
    // and needs 3:1 against the card to be seen as one.
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
}));
