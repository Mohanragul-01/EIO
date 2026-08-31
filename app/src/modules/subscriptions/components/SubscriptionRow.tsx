/**
 * SubscriptionRow - one subscription, with an inline "renew" action.
 *
 * The renew button only appears when the renewal is actually near (or past).
 * Showing it on every row would train you to ignore it; showing it only when
 * it's actionable makes it mean something.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { daysUntil, formatDueDate } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import { CYCLE_SUFFIX, type Subscription } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type SubscriptionRowProps = {
  subscription: Subscription;
  onPress: () => void;
  onRenew: () => void;
};

export function SubscriptionRow({ subscription, onPress, onRenew }: SubscriptionRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const days = daysUntil(subscription.next_due_date);
  const inactive = !subscription.is_active;
  const overdue = !inactive && days < 0;
  const dueSoon = !inactive && days >= 0 && days <= 7;

  // One status color drives the dot, the date text and the border.
  const statusColor = overdue
    ? colors.danger
    : dueSoon
      ? colors.warning
      : colors.textMuted;

  return (
    <GlassCard
      onPress={onPress}
      style={[styles.card, inactive && styles.cardInactive]}
    >
      <View style={styles.row}>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            {!inactive ? <View style={[styles.dot, { backgroundColor: statusColor }]} /> : null}
            <Text style={[styles.name, inactive && styles.nameInactive]} numberOfLines={1}>
              {subscription.name}
            </Text>
            {inactive ? (
              <View style={styles.cancelledChip}>
                <Text style={styles.cancelledText}>Cancelled</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.due, { color: statusColor }]}>
            {inactive ? 'Not billing' : formatDueDate(subscription.next_due_date)}
          </Text>
        </View>

        <View style={styles.priceBlock}>
          <Text style={[styles.price, inactive && styles.nameInactive]}>
            {formatMoney(subscription.amount_minor, { compact: true })}
          </Text>
          <Text style={styles.cycle}>{CYCLE_SUFFIX[subscription.billing_cycle]}</Text>
        </View>
      </View>

      {(overdue || dueSoon) && !inactive ? (
        <Pressable
          onPress={onRenew}
          style={({ pressed }) => [styles.renew, pressed && styles.renewPressed]}
          hitSlop={6}
        >
          <Ionicons name="checkmark-circle-outline" size={15} color={colors.primary} />
          <Text style={styles.renewText}>Mark as paid</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  cardInactive: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  name: {
    ...typography.title,
    fontSize: 15,
    flexShrink: 1, // lets a long name truncate instead of pushing the chip out
  },
  nameInactive: {
    color: colors.textMuted,
  },
  cancelledChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cancelledText: {
    ...typography.caption,
    fontSize: 10,
  },
  due: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 4,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  price: {
    ...typography.title,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  cycle: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  renew: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    width: '100%',
  },
  renewPressed: {
    opacity: 0.6,
  },
  renewText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.primary,
  },
}));
