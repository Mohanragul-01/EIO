/**
 * SubscriptionsListScreen - what you're paying, and what's due next.
 *
 * The headline is the MONTHLY EQUIVALENT total, not the sum of the raw
 * amounts. Adding a ₹4,800/year plan to a ₹199/month one gives a meaningless
 * number; normalising both to per-month is the only figure you can act on.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { formatDueDate } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { SubscriptionRow } from '../components/SubscriptionRow';
import { advanceDueDate, type Subscription } from '../types';
import { useSubscriptions } from '../useSubscriptions';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionsList'>;

export function SubscriptionsListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { subscriptions, summary, permission, loading, refreshing, error, refresh, reload, markPaid } =
    useSubscriptions();

  /**
   * Marking as paid does TWO things - moves the due date and writes an expense
   * into Finance. A side effect that touches your financial records shouldn't
   * be a surprise, so it's confirmed first with the exact amount and the new
   * date spelled out. The confirmation also prevents an accidental double-tap
   * from logging the same payment twice.
   */
  const handleMarkPaid = (subscription: Subscription) => {
    const nextDate = advanceDueDate(subscription.next_due_date, subscription.billing_cycle);

    Alert.alert(
      `Mark ${subscription.name} as paid?`,
      `Logs ${formatMoney(subscription.amount_minor, { compact: true })} to Finance as a bill, ` +
        `and moves the next due date to ${formatDueDate(nextDate)}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: async () => {
            const result = await markPaid(subscription);
            // Only warn on the half-succeeded case. Success needs no popup -
            // the row visibly moves down the list, which is confirmation
            // enough, and a "Done!" alert for every payment gets old fast.
            if (result && !result.logged) {
              Alert.alert(
                'Due date updated',
                `The payment couldn't be logged to Finance (${result.logError}). ` +
                  `Add it manually there if you need it in this month's totals - ` +
                  `tapping again would move the due date a second time.`,
              );
            }
          },
        },
      ],
    );
  };

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const hasData = subscriptions.length > 0;

  return (
    <Screen padded={false}>
      <FlatList
        data={subscriptions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, !hasData && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          hasData ? (
            <FadeInView>
              {/*
                Reminders failing silently is worse than not having them: you
                would assume you were covered. So when they cannot fire, the
                module says so rather than looking the same either way.
              */}
              {permission === 'denied' || permission === 'unsupported' ? (
                <Pressable
                  onPress={() => {
                    // Only Settings can undo a denial; nothing in-app can.
                    if (permission === 'denied') void Linking.openSettings();
                  }}
                  style={styles.permissionBanner}
                >
                  <Ionicons
                    name="notifications-off-outline"
                    size={16}
                    color={colors.warning}
                  />
                  <Text style={styles.permissionText}>
                    {permission === 'denied'
                      ? 'Reminders are off. Tap to enable notifications in Settings.'
                      : 'Reminders need the EIO app build, not Expo Go.'}
                  </Text>
                </Pressable>
              ) : null}

              <GlassCard style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Costing you</Text>
                <Text style={styles.summaryAmount}>
                  {formatMoney(summary.monthlyMinor, { compact: true })}
                  <Text style={styles.summaryPer}> / month</Text>
                </Text>
                <Text style={styles.summarySub}>
                  {formatMoney(summary.yearlyMinor, { compact: true })} a year across{' '}
                  {summary.activeCount} active{' '}
                  {summary.activeCount === 1 ? 'subscription' : 'subscriptions'}
                </Text>

                {/* Only render an alert row when there's something to alert
                    about - a permanent "0 due soon" line is just noise. */}
                {summary.overdue.length > 0 || summary.dueSoon.length > 0 ? (
                  <View style={styles.alertRow}>
                    <Ionicons
                      name={summary.overdue.length > 0 ? 'alert-circle' : 'time-outline'}
                      size={15}
                      color={summary.overdue.length > 0 ? colors.danger : colors.warning}
                    />
                    <Text
                      style={[
                        styles.alertText,
                        {
                          color:
                            summary.overdue.length > 0 ? colors.danger : colors.warning,
                        },
                      ]}
                    >
                      {summary.overdue.length > 0
                        ? `${summary.overdue.length} overdue`
                        : `${summary.dueSoon.length} due within a week`}
                    </Text>
                  </View>
                ) : null}
              </GlassCard>

              <Text style={styles.sectionLabel}>All subscriptions</Text>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="repeat-outline"
            accent={colors.accentCyan}
            title="No subscriptions tracked"
            message="Add the recurring things - streaming, phone, gym, cloud storage - and see what they add up to."
            action={
              <Button
                label="Add subscription"
                icon="add"
                onPress={() => navigation.navigate('SubscriptionEdit', {})}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <SubscriptionRow
              subscription={item}
              onPress={() => navigation.navigate('SubscriptionEdit', { id: item.id })}
              onRenew={() => handleMarkPaid(item)}
            />
          </FadeInView>
        )}
      />

      {error ? (
        <FadeInView style={styles.errorWrap}>
          <GlassCard style={styles.errorCard}>
            <View style={styles.errorRow}>
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
            </View>
          </GlassCard>
        </FadeInView>
      ) : null}

      {hasData ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('SubscriptionEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: 110,
  },
  listEmpty: {
    flexGrow: 1,
    paddingTop: 80,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.warning + '1A',
    borderWidth: 1,
    borderColor: colors.warning + '33',
  },
  permissionText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
    flex: 1,
  },
  summaryCard: {},
  summaryLabel: {
    ...typography.overline,
  },
  summaryAmount: {
    ...typography.display,
    fontSize: 28,
    marginTop: spacing.sm,
  },
  summaryPer: {
    ...typography.body,
    fontSize: 15,
    color: colors.textMuted,
  },
  summarySub: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  alertText: {
    ...typography.caption,
    fontSize: 12.5,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },
  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl + 70,
  },
  errorCard: {
    borderColor: colors.danger + '55',
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
