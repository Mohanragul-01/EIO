/**
 * TransactionRow - one transaction in the list.
 *
 * Income and expense are distinguished by SIGN and COLOR rather than by two
 * different layouts - the eye can scan a column of amounts far faster when
 * they're aligned in the same place.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { GlassCard } from '../../../core/components';
// formatEventDate, not formatDueDate: this date is when the money moved, so
// "Yesterday" is right and "3 days overdue" would be meaningless.
import { formatEventDate } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import type { Transaction } from '../types';
import { makeStyles } from '../../../core/ThemeContext';

type TransactionRowProps = {
  transaction: Transaction;
  onPress: () => void;
};

export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const styles = useStyles();
  const category = categoryDef(transaction.category);
  const isIncome = transaction.kind === 'income';

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: category.color + '1F' }]}>
          <Ionicons name={category.icon as never} size={17} color={category.color} />
        </View>

        <View style={styles.body}>
          {/* The note is the headline when there is one - "Coffee with Ravi"
              is more identifiable than "Food". The category becomes context. */}
          <Text style={styles.title} numberOfLines={1}>
            {transaction.note || category.label}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {transaction.note ? `${category.label} · ` : ''}
            {formatEventDate(transaction.date)}
          </Text>
        </View>

        <Text style={[styles.amount, isIncome && styles.amountIncome]}>
          {isIncome ? '+' : '-'}
          {formatMoney(transaction.amount_minor, { compact: true })}
        </Text>
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 14.5,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    ...typography.title,
    fontSize: 14.5,
    // Tabular figures make every digit the same width, so a column of amounts
    // lines up instead of jittering. Small detail, very visible in a list.
    fontVariant: ['tabular-nums'],
  },
  amountIncome: {
    color: colors.success,
  },
}));
