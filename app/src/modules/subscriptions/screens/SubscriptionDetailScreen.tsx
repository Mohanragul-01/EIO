/**
 * SubscriptionDetailScreen - one subscription, everything about it.
 *
 * The hero says what it costs and when it next charges; under it, the
 * history that only a ledger-connected tracker can show: what you actually
 * paid, and how the price moved. Then reminders, where it is charged, and how
 * to get out of it - a link to the service's own page and your notes, because
 * how you cancel depends on how you are billed.
 *
 * A reminder's "Mark paid" button (or a trial's "Keep it" / "I cancelled")
 * lands here with an action, and the matching sheet opens once the
 * subscription has loaded.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { Button, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, todayISO } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { layout, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { BrandTile } from '../components/BrandTile';
import { useSubscriptionActions } from '../components/useSubscriptionActions';
import { cycleLabel, cycleOf, cycleSuffix, perYearMinor } from '../cycles';
import { formatAmount, formatRate, inrOf } from '../currency';
import { offsetsLabel, priceParts, shortDate, timeLabel } from '../format';
import {
  countdown,
  effectiveState,
  needsTrialDecision,
  projectsCharges,
  trialEndsOn,
  type Tone,
} from '../lifecycle';
import { priceSteps } from '../prices';
import { effectiveOffsets } from '../reminders';
import { channelLabel, type PriceChange } from '../types';
import { useSubscription } from '../useSubscription';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionDetail'>;
type Route = RouteProp<RootStackParamList, 'SubscriptionDetail'>;

export function SubscriptionDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { id, action } = route.params;
  const today = todayISO();
  const d = useSubscription(id);
  const sub = d.subscription;

  const actions = useSubscriptionActions({
    today,
    accounts: d.accounts,
    markPaid: d.markPaid,
    undoMarkPaid: d.undoMarkPaid,
    applyPatch: d.applyPatch,
    undoPatch: d.undoPatch,
    remove: async (target) => {
      try {
        await api.deleteSubscription(target.id);
        return true;
      } catch (e) {
        Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
        return false;
      }
    },
    onOpen: () => {},
    onEdit: (target) => navigation.navigate('SubscriptionEdit', { id: target.id }),
    onDeleted: () => navigation.goBack(),
  });

  /**
   * An action from a notification, handled once per arrival. Done during
   * render, React's pattern for adjusting state to new props, rather than in
   * an effect: it only opens a sheet, which is this screen's own state.
   */
  const actionKey = action && sub ? `${sub.id}:${action}:${route.key}` : null;
  const [handled, setHandled] = useState<string | null>(null);
  if (actionKey && handled !== actionKey && sub) {
    setHandled(actionKey);
    actions.run(action === 'pay' ? 'pay' : 'keep', sub);
  }

  // openMenu is a state setter, so this does not re-run on every render.
  const { openMenu } = actions;
  useLayoutEffect(() => {
    navigation.setOptions({
      title: sub?.name ?? '',
      headerRight: () =>
        sub ? (
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => navigation.navigate('SubscriptionEdit', { id: sub.id })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit"
            >
              <Ionicons name="create-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => openMenu(sub)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="More actions"
            >
              <Ionicons name="ellipsis-horizontal" size={21} color={colors.text} />
            </Pressable>
          </View>
        ) : null,
    });
  }, [navigation, sub, colors.text, openMenu, styles.headerButtons]);

  const { reload } = d;
  useFocusEffect(
    // Back from the editor: show what was saved.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (d.loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (d.loadError || !sub) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.body}>{d.loadError ?? 'This subscription is gone.'}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  const state = effectiveState(sub, today);
  const cycle = cycleOf(sub);
  const price = priceParts(sub);
  const inr = inrOf(sub);
  const due = countdown(sub, today);
  const toneColor: Record<Tone, string> = {
    danger: colors.danger,
    warning: colors.warning,
    info: colors.info,
    muted: colors.textMuted,
  };
  const accountName = sub.account_id
    ? (d.accounts.find((a) => a.id === sub.account_id)?.name ?? 'An account no longer listed')
    : null;
  const offsets = effectiveOffsets(sub, d.settings);
  const steps = priceSteps(d.priceChanges);
  const category = categoryDef(sub.category);

  const nextLine =
    state === 'trial' || state === 'trial_over'
      ? `Trial ends ${shortDate(trialEndsOn(sub), today)} · then ${price.main} ${cycleSuffix(cycle)}`
      : projectsCharges(sub, today) || state === 'active'
        ? `Next charge ${shortDate(sub.next_due_date, today)}`
        : state === 'ending' && sub.ends_on
          ? `Access until ${shortDate(sub.ends_on, today)} · will not renew`
          : null;

  // The one thing to do next, as a full-width button.
  const primary =
    needsTrialDecision(sub, today) || state === 'trial'
      ? { label: 'Keep it or cancel?', icon: 'help-circle-outline' as const, key: 'keep' as const }
      : state === 'active'
        ? { label: 'Mark paid', icon: 'checkmark-circle-outline' as const, key: 'pay' as const }
        : state === 'paused'
          ? { label: 'Resume now', icon: 'play' as const, key: 'resume' as const }
          : { label: state === 'ending' ? 'Undo cancellation' : 'Restore', icon: 'arrow-undo' as const, key: 'restore' as const };

  const removeChange = (change: PriceChange) => {
    Alert.alert(
      'Remove this price change?',
      `${formatAmount(change.old_amount_minor, change.currency)} → ${formatAmount(change.new_amount_minor, change.currency)} on ${formatEventDate(change.effective_on)}. The current price stays as it is.`,
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => void d.deletePriceChange(change) },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView>
          {/* HERO ------------------------------------------------------ */}
          <GlassCard>
            <View style={styles.heroTop}>
              <BrandTile sub={sub} size={64} />
              <View style={styles.flex}>
                <Text style={styles.price}>
                  {price.main}
                  <Text style={styles.per}> {cycleSuffix(cycle)}</Text>
                </Text>
                {price.converted ? <Text style={styles.converted}>{price.converted}</Text> : null}
                {inr !== null && cycle.unit !== 'once' ? (
                  <Text style={styles.caption}>
                    {formatMoney(perYearMinor(inr, cycle), { compact: true })} a year
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.statusRow}>
              <Text style={[styles.status, { color: toneColor[due.tone] }]}>{due.text}</Text>
              {nextLine ? <Text style={styles.caption}> · {nextLine}</Text> : null}
            </View>
            <Button
              label={primary.label}
              icon={primary.icon}
              onPress={() => actions.run(primary.key, sub)}
              style={styles.primary}
            />
          </GlassCard>
        </FadeInView>

        {/* PAYMENTS -------------------------------------------------- */}
        <Text style={styles.section}>Payments</Text>
        <GlassCard>
          {d.payments.length === 0 ? (
            <Text style={styles.caption}>
              Nothing marked paid yet. Mark paid logs each payment to Finance and lists it here.
            </Text>
          ) : (
            d.payments.slice(0, 12).map((payment) => (
              <View key={payment.id} style={styles.line}>
                <Text style={styles.lineMain}>{formatEventDate(payment.date)}</Text>
                <Text style={styles.lineMeta} numberOfLines={1}>
                  {payment.account_id
                    ? (d.accounts.find((a) => a.id === payment.account_id)?.name ?? '')
                    : 'No account'}
                </Text>
                <Text style={styles.lineAmount}>{formatMoney(payment.amount_minor)}</Text>
              </View>
            ))
          )}
        </GlassCard>

        {/* PRICE HISTORY --------------------------------------------- */}
        {steps.length > 0 ? (
          <>
            <Text style={styles.section}>Price history</Text>
            <GlassCard>
              {steps.map((step) => (
                <View key={step.change.id} style={styles.line}>
                  <Ionicons
                    name={step.direction === 'up' ? 'arrow-up' : 'arrow-down'}
                    size={14}
                    color={step.direction === 'up' ? colors.warning : colors.success}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.lineMain}>
                      {formatAmount(step.change.old_amount_minor, step.change.currency, { compact: true })} →{' '}
                      {formatAmount(step.change.new_amount_minor, step.change.currency, { compact: true })}
                    </Text>
                    <Text style={styles.lineMeta}>
                      {formatEventDate(step.change.effective_on)} · {step.pct > 0 ? '+' : ''}
                      {step.pct}% ({step.direction === 'up' ? 'up' : 'down'})
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => removeChange(step.change)}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Remove this price change"
                  >
                    <Ionicons name="trash-outline" size={17} color={colors.textMuted} />
                  </Pressable>
                </View>
              ))}
            </GlassCard>
          </>
        ) : null}

        {/* DETAILS --------------------------------------------------- */}
        <Text style={styles.section}>Details</Text>
        <GlassCard>
          <Detail icon="repeat-outline" label="Billed" value={cycleLabel(cycle)} />
          <Detail
            icon="notifications-outline"
            label="Reminders"
            value={
              offsets.length === 0
                ? 'Off'
                : `${offsetsLabel(offsets)}, at ${timeLabel(d.settings.minutes)}${sub.reminder_offsets === null ? ' (your defaults)' : ''}`
            }
          />
          <Detail
            icon="wallet-outline"
            label="Charged to"
            value={
              [accountName, channelLabel(sub.charge_channel)].filter(Boolean).join(' · ') ||
              'Not set'
            }
          />
          <Detail icon={category.icon} label="Logs to Finance as" value={category.label} />
          {sub.currency !== 'INR' ? (
            <Detail
              icon="swap-horizontal-outline"
              label="Rate"
              value={
                sub.fx_rate
                  ? `${formatRate(sub.fx_rate, sub.currency)}${sub.fx_rate_on ? `, set ${formatEventDate(sub.fx_rate_on)}` : ''}`
                  : 'Not set - left out of totals'
              }
            />
          ) : null}
          {sub.note ? <Detail icon="document-text-outline" label="Note" value={sub.note} /> : null}
        </GlassCard>

        {/* HOW TO CANCEL --------------------------------------------- */}
        <Text style={styles.section}>How to cancel</Text>
        <GlassCard>
          {sub.cancel_notes ? <Text style={styles.body}>{sub.cancel_notes}</Text> : null}
          {sub.cancel_url ? (
            <Button
              label="Open the manage page"
              icon="open-outline"
              variant="glass"
              onPress={() => void Linking.openURL(sub.cancel_url as string)}
              style={sub.cancel_notes ? styles.gap : undefined}
            />
          ) : null}
          {!sub.cancel_url && !sub.cancel_notes ? (
            <Text style={styles.caption}>
              Nothing noted yet. Add the manage link and your notes in Edit, so the day you
              want out you know where to go.
            </Text>
          ) : null}
        </GlassCard>

        <Button
          label="More actions"
          icon="ellipsis-horizontal"
          variant="ghost"
          onPress={() => actions.openMenu(sub)}
          style={styles.more}
        />
      </ScrollView>

      {d.error ? (
        <View style={styles.errorWrap}>
          <GlassCard style={styles.errorCard}>
            <Pressable
              onPress={d.clearError}
              style={styles.errorRow}
              accessibilityRole="button"
              accessibilityLabel={`${d.error}. Dismiss`}
            >
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {d.error}
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      ) : null}

      {actions.sheets}
    </Screen>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.detail} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={17} color={colors.textSecondary} />
      <View style={styles.flex}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: layout.aboveFab,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  price: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 28,
  },
  per: {
    ...typography.body,
    color: colors.textMuted,
  },
  converted: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  caption: {
    ...typography.caption,
  },
  body: {
    ...typography.body,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  status: {
    ...typography.title,
    fontSize: 14,
  },
  primary: {
    marginTop: spacing.lg,
  },
  section: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  lineMain: {
    ...typography.body,
    ...typography.numeric,
    color: colors.text,
  },
  lineMeta: {
    ...typography.caption,
    flex: 1,
  },
  lineAmount: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 14,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    ...typography.overline,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
    marginTop: 2,
  },
  gap: {
    marginTop: spacing.md,
  },
  more: {
    marginTop: spacing.xl,
  },
  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: layout.aboveFab,
  },
  errorCard: {
    borderColor: colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));
