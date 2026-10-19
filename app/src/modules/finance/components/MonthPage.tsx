/**
 * MonthPage - the Finance screen's first tab: the balance, the month, and the
 * month's entries grouped by day.
 *
 * The header is substantial (balance, month switcher, quick adds, totals,
 * breakdown, trend), so it scrolls WITH the list as ListHeaderComponent rather
 * than sitting fixed above it. A pinned header would eat half the screen.
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';

import { Button, EmptyState, FadeInView } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, motion, spacing } from '../../../core/theme';
import { longMonth, shortMonth } from '../period';
import type { DayGroup, ListItem } from '../summary';
import type { QuickAdd } from '../types';
import type { FinanceData } from '../useFinance';
import { BalanceCard } from './BalanceCard';
import { DayHeader } from './DayHeader';
import { MonthSummary } from './MonthSummary';
import { PeriodHeader } from './PeriodHeader';
import { QuickAddRow } from './QuickAddRow';
import { TransactionRow } from './TransactionRow';
import { TrendChart } from './TrendChart';

type Row = { type: 'day'; key: string; day: DayGroup } | { type: 'item'; key: string; item: ListItem; index: number };

type MonthPageProps = {
  data: FinanceData;
  onOpenItem: (item: ListItem) => void;
  onItemMenu: (item: ListItem) => void;
  onLogQuickAdd: (quickAdd: QuickAdd) => void;
  onEditQuickAdd: (quickAdd: QuickAdd) => void;
  onOpenCategory: (key: string) => void;
  onOpenAccounts: () => void;
  onAdd: () => void;
};

export function MonthPage({
  data,
  onOpenItem,
  onItemMenu,
  onLogQuickAdd,
  onEditQuickAdd,
  onOpenCategory,
  onOpenAccounts,
  onAdd,
}: MonthPageProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  // One flat list of day headers and rows: a FlatList virtualises it, where a
  // SectionList would need a second shape for the same data.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let index = 0;
    data.days.forEach((day) => {
      out.push({ type: 'day', key: `day-${day.date}`, day });
      day.items.forEach((item) => {
        out.push({ type: 'item', key: item.key, item, index });
        index += 1;
      });
    });
    return out;
  }, [data.days]);

  const versus = shortMonth(data.previousPeriod);
  const versusLong = longMonth(data.previousPeriod);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={data.refreshing}
          onRefresh={data.refresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.backgroundElevated}
        />
      }
      ListHeaderComponent={
        <FadeInView>
          <BalanceCard summary={data.accountsSummary} onPress={onOpenAccounts} />
          <PeriodHeader
            period={data.period}
            startDay={data.startDay}
            isCurrent={data.isCurrentPeriod}
            onStep={data.stepPeriod}
            onCurrent={data.goToCurrent}
          />
          <QuickAddRow
            quickAdds={data.quickAdds}
            accountsById={data.accountsById}
            onLog={onLogQuickAdd}
            onEdit={onEditQuickAdd}
          />
          <MonthSummary
            summary={data.summary}
            deltas={data.deltas}
            versus={versus}
            versusLong={versusLong}
            onOpenCategory={onOpenCategory}
          />
          <TrendChart months={data.trend} />
          {rows.length > 0 ? <Text style={styles.sectionLabel}>Entries</Text> : null}
        </FadeInView>
      }
      ListEmptyComponent={
        // The month switcher stays usable while a month is empty, so this is a
        // compact inline message rather than a full-screen empty state.
        data.loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <EmptyState
              icon="wallet-outline"
              accent={colors.accentEmerald}
              title="Nothing this month"
              message="Add an entry and the totals, the breakdown and your budgets fill in on their own."
              action={<Button label="Add an entry" icon="add" onPress={onAdd} />}
            />
          </View>
        )
      }
      renderItem={({ item: row }) =>
        row.type === 'day' ? (
          <DayHeader day={row.day} />
        ) : (
          <FadeInView delay={Math.min(row.index, 6) * motion.stagger}>
            <TransactionRow
              item={row.item}
              accountsById={data.accountsById}
              onPress={() => onOpenItem(row.item)}
              onLongPress={() => onItemMenu(row.item)}
            />
          </FadeInView>
        )
      }
    />
  );
}

const useStyles = makeStyles(({ typography }) => ({
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    // Clears the add button and the toast above it.
    paddingBottom: layout.aboveFab + spacing.xxxl,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
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
}));
