/**
 * SubscriptionRow - one subscription: its tile, what it costs, when it next
 * charges, and the one action that is due, if any.
 *
 * Brand and urgency are kept apart, so they never fight: the tile carries the
 * brand colour, and the countdown carries the urgency - in words ("2 days
 * overdue"), with colour only reinforcing them.
 *
 * Tap opens the subscription; long-press opens its actions. No swipe: a row
 * can sit in a scrolling list, and every action has a button elsewhere too.
 * The inline action shows only when it is actionable - renewal near or past,
 * or a trial that needs an answer - so it means something when it appears.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { cycleLabel, cycleOf, cycleSuffix } from '../cycles';
import { priceParts } from '../format';
import {
  countdown,
  daysBetween,
  effectiveState,
  needsTrialDecision,
  type Tone,
} from '../lifecycle';
import type { PriceStep } from '../prices';
import { channelLabel, type Subscription } from '../types';
import { BrandTile } from './BrandTile';

type SubscriptionRowProps = {
  subscription: Subscription;
  today: string;
  accountName: string | null;
  /** A price rise in the last 60 days, for the "↑" badge. */
  rise?: PriceStep | null;
  onPress: () => void;
  onLongPress: () => void;
  onMarkPaid: () => void;
  onDecideTrial: () => void;
};

export function SubscriptionRow({
  subscription: sub,
  today,
  accountName,
  rise,
  onPress,
  onLongPress,
  onMarkPaid,
  onDecideTrial,
}: SubscriptionRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const state = effectiveState(sub, today);
  const cycle = cycleOf(sub);
  const price = priceParts(sub);
  const due = countdown(sub, today);
  const toneColor: Record<Tone, string> = {
    danger: colors.danger,
    warning: colors.warning,
    info: colors.info,
    muted: colors.textMuted,
  };

  const charged = accountName ?? channelLabel(sub.charge_channel);
  const secondLine =
    state === 'trial' || state === 'trial_over'
      ? `Trial · then ${price.main} ${cycleSuffix(cycle)}`
      : [cycleLabel(cycle), charged].filter(Boolean).join(' · ');

  const payable = state === 'active' && daysBetween(today, sub.next_due_date) <= 7;
  const decide = needsTrialDecision(sub, today);

  const label = [
    sub.name,
    `${price.main} ${cycleLabel(cycle).toLowerCase()}`,
    price.converted,
    due.text,
    charged ? `charged to ${charged}` : null,
    rise ? `price up ${rise.pct}%` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <GlassCard style={styles.card} padded={false}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens it. Long-press for actions."
      >
        <BrandTile sub={sub} />

        <View style={styles.middle}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {sub.name}
            </Text>
            {rise ? (
              <View style={styles.rise}>
                <Ionicons name="arrow-up" size={11} color={colors.warning} />
                <Text style={styles.riseText}>{rise.pct}%</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.secondary} numberOfLines={1}>
            {secondLine}
          </Text>
        </View>

        <View style={styles.right}>
          <Text style={styles.price}>{price.main}</Text>
          {price.converted ? (
            <Text style={styles.converted} numberOfLines={1}>
              {price.converted}
            </Text>
          ) : null}
          <Text style={[styles.countdown, { color: toneColor[due.tone] }]} numberOfLines={1}>
            {due.text}
          </Text>
        </View>
      </Pressable>

      {payable || decide ? (
        <Pressable
          onPress={decide ? onDecideTrial : onMarkPaid}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={
            decide ? `Keep or cancel the ${sub.name} trial` : `Mark ${sub.name} paid`
          }
        >
          <Ionicons
            name={decide ? 'help-circle-outline' : 'checkmark-circle-outline'}
            size={16}
            color={colors.primary}
          />
          <Text style={styles.actionText}>{decide ? 'Keep it or cancel?' : 'Mark paid'}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    minHeight: 72,
  },
  pressed: {
    opacity: 0.7,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.title,
    fontSize: 15,
    flexShrink: 1,
  },
  rise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  riseText: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    lineHeight: 14,
    color: colors.warning,
  },
  secondary: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 3,
  },
  right: {
    alignItems: 'flex-end',
    maxWidth: '42%',
  },
  price: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 15,
  },
  converted: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11,
    color: colors.textFaint,
  },
  countdown: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 3,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  actionText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.primary,
  },
}));
