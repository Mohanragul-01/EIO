/**
 * BudgetsPage - the Finance screen's third tab: each category's limit against
 * how far through the month you are.
 *
 * Worst first (useFinance sorts them), so the budget that needs you is at the
 * top. Spending in categories without a budget is totalled at the bottom, so
 * the bars never look like the whole story when they are not.
 *
 * With no budgets yet, the empty state offers the categories you actually
 * spent most on this month, each one tap from a limit - an empty state that
 * shows what will be here (research §6.21).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { EXPENSE_CATEGORIES } from '../../../core/categories';
import { Button, GlassCard } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import type { Budget } from '../types';
import type { FinanceData } from '../useFinance';
import { BudgetBar } from './BudgetBar';
import { PeriodHeader } from './PeriodHeader';

type BudgetsPageProps = {
  data: FinanceData;
  onOpenCategory: (key: string) => void;
  onEdit: (budget: Budget) => void;
  onNew: (category: string | null) => void;
};

export function BudgetsPage({ data, onOpenCategory, onEdit, onNew }: BudgetsPageProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { budgetRows, budgetTotals, budgetSuggestions, progress } = data;
  // Budgets are for spending, so every expense category budgeted means done.
  const allBudgeted = budgetRows.length >= EXPENSE_CATEGORIES.length;

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={data.refreshing}
          onRefresh={data.refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.backgroundElevated}
        />
      }
    >
      <PeriodHeader
        period={data.period}
        startDay={data.startDay}
        isCurrent={data.isCurrentPeriod}
        onStep={data.stepPeriod}
        onCurrent={data.goToCurrent}
      />

      {budgetRows.length > 0 ? (
        <>
          <GlassCard style={styles.overview}>
            <Text style={styles.overviewLabel}>Budgeted spending</Text>
            <Text style={styles.overviewValue}>
              {formatMoney(budgetTotals.budgetedSpentMinor, { compact: true })}
              <Text style={styles.overviewOf}> of {formatMoney(budgetTotals.limitMinor, { compact: true })}</Text>
            </Text>
            <Text style={styles.overviewNote}>
              {progress.daysLeft > 0
                ? `${progress.daysLeft} ${progress.daysLeft === 1 ? 'day' : 'days'} left in this month`
                : 'This month is over'}
              {budgetTotals.overCount > 0 ? ` · ${budgetTotals.overCount} over budget` : ''}
            </Text>
          </GlassCard>

          {budgetRows.map((row) => (
            <BudgetBar
              key={row.budget.id}
              label={row.label}
              icon={row.icon}
              color={row.color}
              status={row.status}
              onPress={() => onOpenCategory(row.budget.category)}
              onEdit={() => onEdit(row.budget)}
            />
          ))}

          {budgetTotals.unbudgetedMinor > 0 ? (
            <Text style={styles.unbudgeted}>
              {formatMoney(budgetTotals.unbudgetedMinor, { compact: true })} spent in categories without a
              budget.
            </Text>
          ) : null}

          {!allBudgeted ? (
            <Button
              label="Set another budget"
              icon="add"
              variant="glass"
              onPress={() => onNew(null)}
              style={styles.add}
            />
          ) : null}

          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={styles.legendTick} />
              <Text style={styles.legendText}>
                The line is where you would be if you spread the limit evenly over the month.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <GlassCard>
          <Text style={styles.emptyTitle}>Set a monthly limit for a category</Text>
          <Text style={styles.emptyText}>
            Each budget gets a bar with a line for where you should be today, so you see you are
            spending fast on the 12th, not on the 28th.
          </Text>
          {budgetSuggestions.map((category) => (
            <Pressable
              key={category.key}
              onPress={() => onNew(category.key)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Set a limit for ${category.label}. ${formatMoney(category.totalMinor, { compact: true })} spent this month.`}
            >
              <View style={[styles.suggestionIcon, { backgroundColor: category.color + '1F' }]}>
                <Ionicons name={category.icon as never} size={16} color={category.color} />
              </View>
              <View style={styles.suggestionBody}>
                <Text style={styles.suggestionLabel}>{category.label}</Text>
                <Text style={styles.suggestionMeta}>
                  {formatMoney(category.totalMinor, { compact: true })} spent this month
                </Text>
              </View>
              <Text style={styles.suggestionAction}>Set limit</Text>
            </Pressable>
          ))}
          <Button
            label={budgetSuggestions.length > 0 ? 'Another category' : 'Set a budget'}
            icon="add"
            variant={budgetSuggestions.length > 0 ? 'glass' : 'primary'}
            onPress={() => onNew(null)}
            style={styles.add}
          />
        </GlassCard>
      )}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: layout.aboveFab + spacing.xxxl,
  },
  overview: {
    marginBottom: spacing.xl,
  },
  overviewLabel: {
    ...typography.overline,
  },
  overviewValue: {
    ...typography.h1,
    ...typography.numeric,
    marginTop: spacing.xs,
  },
  overviewOf: {
    ...typography.body,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  overviewNote: {
    ...typography.caption,
    marginTop: 2,
  },
  unbudgeted: {
    ...typography.caption,
    ...typography.numeric,
    marginTop: spacing.xs,
  },
  add: {
    marginTop: spacing.xl,
  },
  legend: {
    marginTop: spacing.xl,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  legendTick: {
    width: 2,
    height: 14,
    backgroundColor: colors.text,
  },
  legendText: {
    ...typography.caption,
    flex: 1,
  },
  emptyTitle: {
    ...typography.title,
  },
  emptyText: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    gap: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBody: {
    flex: 1,
  },
  suggestionLabel: {
    ...typography.body,
    color: colors.text,
  },
  suggestionMeta: {
    ...typography.caption,
    ...typography.numeric,
  },
  suggestionAction: {
    ...typography.caption,
    color: colors.primary,
  },
}));
