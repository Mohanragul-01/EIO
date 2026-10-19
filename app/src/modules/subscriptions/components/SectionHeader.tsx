/**
 * SectionHeader - "This week · 3 · ₹1,247".
 *
 * Each section says how many and how much, so "what leaves this week" is read
 * off the header without adding up the rows. Overdue gets an icon as well as
 * its colour.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatMoney } from '../../../core/money';
import { spacing } from '../../../core/theme';
import { BUCKET_LABEL, type Bucket } from '../lifecycle';

export function SectionHeader({
  bucket,
  count,
  totalMinor,
}: {
  bucket: Bucket;
  count: number;
  totalMinor: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const overdue = bucket === 'overdue';

  return (
    <View
      style={styles.row}
      accessibilityRole="header"
      accessible
      accessibilityLabel={`${BUCKET_LABEL[bucket]}, ${count}, ${formatMoney(totalMinor, { compact: true })}`}
    >
      {overdue ? <Ionicons name="alert-circle" size={14} color={colors.danger} /> : null}
      <Text style={[styles.label, overdue && { color: colors.danger }]}>
        {BUCKET_LABEL[bucket]}
      </Text>
      <Text style={styles.meta}>
        {count} · {formatMoney(totalMinor, { compact: true })}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.overline,
  },
  meta: {
    ...typography.overline,
    ...typography.numeric,
    letterSpacing: 0.4,
  },
}));
