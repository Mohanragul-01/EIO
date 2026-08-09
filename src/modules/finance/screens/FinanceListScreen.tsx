/**
 * FinanceListScreen - month summary on top, that month's transactions below.
 *
 * Same three-part screen pattern as every other list. The only structural
 * difference: the header is substantial (month switcher + totals + breakdown),
 * so it goes in ListHeaderComponent and scrolls WITH the list rather than
 * sitting fixed above it. A pinned header would eat half the screen on a
 * phone.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { MonthSummary } from '../components/MonthSummary';
import { TransactionRow } from '../components/TransactionRow';
import { useTransactions } from '../useTransactions';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceList'>;

export function FinanceListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    transactions,
    summary,
    year,
    month,
    stepMonth,
    isCurrentMonth,
    loading,
    refreshing,
    error,
    refresh,
    reload,
  } = useTransactions();

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const hasData = transactions.length > 0;

  return (
    <Screen padded={false}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
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
          <FadeInView>
            <MonthSummary
              year={year}
              month={month}
              spentMinor={summary.spentMinor}
              earnedMinor={summary.earnedMinor}
              netMinor={summary.netMinor}
              categoryTotals={summary.categoryTotals}
              isCurrentMonth={isCurrentMonth}
              onStepMonth={stepMonth}
            />
            {hasData ? <Text style={styles.sectionLabel}>Transactions</Text> : null}
          </FadeInView>
        }
        ListEmptyComponent={
          // The month switcher stays usable while a month is empty, so this
          // is a compact inline message rather than a full-screen empty state.
          loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.emptyBlock}>
              <EmptyState
                icon="wallet-outline"
                accent={colors.accentEmerald}
                title="Nothing this month"
                message="Add a transaction and the totals and category breakdown fill in automatically."
                action={
                  <Button
                    label="Add transaction"
                    icon="add"
                    onPress={() => navigation.navigate('TransactionEdit', {})}
                  />
                }
              />
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <TransactionRow
              transaction={item}
              onPress={() => navigation.navigate('TransactionEdit', { id: item.id })}
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
            onPress={() => navigation.navigate('TransactionEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add transaction"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: 110,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  loadingBlock: {
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  emptyBlock: {
    // A fixed height, not flex:1 - the summary above it must stay visible.
    height: 340,
    marginTop: spacing.lg,
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
