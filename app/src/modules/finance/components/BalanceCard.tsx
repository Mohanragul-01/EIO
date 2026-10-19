/**
 * BalanceCard - what you have across your accounts, less what you owe.
 *
 * Outside the month on purpose: everything below it changes when you step a
 * month, this does not. Tapping it opens the accounts it adds up.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { formatBalance } from '../analytics';
import type { AccountsSummary } from '../accounts';

export function BalanceCard({ summary, onPress }: { summary: AccountsSummary; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const count = summary.assets.length + summary.liabilities.length;

  const caption =
    count === 0
      ? 'Everything in, minus everything out'
      : summary.owedMinor > 0
        ? `Across ${count} ${count === 1 ? 'account' : 'accounts'}, after ${formatMoney(summary.owedMinor, { compact: true })} owed on cards`
        : `Across ${count} ${count === 1 ? 'account' : 'accounts'}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`Balance ${formatBalance(summary.netMinor)}. ${caption}.`}
      accessibilityHint="Opens your accounts"
    >
      <GlassCard>
        <View style={styles.row}>
          <View style={styles.body}>
            <Text style={styles.label}>Balance</Text>
            {/* The minus sign says it is negative; the colour only repeats it. */}
            <Text style={[styles.value, summary.netMinor < 0 && { color: colors.danger }]}>
              {formatBalance(summary.netMinor)}
            </Text>
            <Text style={styles.caption}>{caption}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  card: {
    marginBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
  },
  label: {
    ...typography.overline,
  },
  value: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 30,
    marginTop: spacing.xs,
  },
  caption: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 2,
  },
}));
