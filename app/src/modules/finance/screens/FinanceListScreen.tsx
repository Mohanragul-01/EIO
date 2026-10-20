/**
 * FinanceListScreen - Month, Calendar and Budgets over one ledger.
 *
 * Three questions about the same rows, so three swipeable tabs rather than
 * three screens: how is this month going (Month), what happened on which day
 * (Calendar), and am I on pace (Budgets). Search, accounts and settings are
 * actions on the whole module, so they sit in the header.
 *
 * Every reversible action - logging a quick add, deleting an entry, unpinning,
 * removing a budget - shows an Undo toast instead of asking first. Actions
 * started from a sheet close the sheet before the toast appears, because a
 * toast drawn while a sheet is open sits underneath it.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { FadeInView, GlassCard, Screen, SwipeTabs, useToast } from '../../../core/components';
import { success, tap } from '../../../core/haptics';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { exportTransactionsCsv } from '../export';
import type { ListItem } from '../summary';
import type { Budget, QuickAdd } from '../types';
import { useFinance } from '../useFinance';
import { BudgetSheet } from '../components/BudgetSheet';
import { BudgetsPage } from '../components/BudgetsPage';
import { CalendarPage } from '../components/CalendarPage';
import { EntryMenuSheet } from '../components/EntryMenuSheet';
import { MonthPage } from '../components/MonthPage';
import { QuickAddSheet } from '../components/QuickAddSheet';
import { SettingsSheet } from '../components/SettingsSheet';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceList'>;

type FinanceTab = 'month' | 'calendar' | 'budgets';
const TABS: FinanceTab[] = ['month', 'calendar', 'budgets'];
const TAB_LABEL: Record<FinanceTab, string> = { month: 'Month', calendar: 'Calendar', budgets: 'Budgets' };

/** What a toast calls an item: "₹250 · Swiggy". */
function describe(item: ListItem): string {
  if (item.type === 'transfer') return `${formatMoney(item.amountMinor, { compact: true })} transfer`;
  const label = item.tx.note || categoryDef(item.tx.category).label;
  return `${formatMoney(item.tx.amount_minor, { compact: true })} · ${label}`;
}

export function FinanceListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const data = useFinance();

  const [tab, setTab] = useState<FinanceTab>('month');
  const [menuItem, setMenuItem] = useState<ListItem | null>(null);
  const [quickAddEditing, setQuickAddEditing] = useState<QuickAdd | null>(null);
  const [budgetSheet, setBudgetSheet] = useState<{ budget: Budget | null; category: string | null } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(
    async (scope: 'month' | 'all') => {
      setExporting(true);
      try {
        const result = await exportTransactionsCsv(scope === 'month' ? data.range : undefined);
        if (result.status === 'empty') {
          toast.show({ message: 'Nothing to export in that range.' });
        } else if (result.status === 'unavailable') {
          // The file is written and valid; only the share sheet is missing, so
          // say where it went rather than reporting a failure.
          Alert.alert('Saved', `${result.rows} entries written, but this device cannot open a share sheet.\n\n${result.uri}`);
        }
        // A successful share needs no message: the OS sheet already appeared.
      } catch (e) {
        Alert.alert('Could not export', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [data.range, toast],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('FinanceSearch')}
            hitSlop={4}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Search entries"
          >
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('FinanceAccounts')}
            hitSlop={4}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Accounts"
          >
            <Ionicons name="wallet-outline" size={20} color={colors.text} />
          </Pressable>
          {exporting ? (
            <View style={styles.headerButton}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : (
            <Pressable
              onPress={() => setSettingsOpen(true)}
              hitSlop={4}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel="Finance settings and export"
            >
              <Ionicons name="options-outline" size={20} color={colors.text} />
            </Pressable>
          )}
        </View>
      ),
    });
  }, [navigation, colors.text, exporting, styles.headerActions, styles.headerButton]);

  const openItem = useCallback(
    (item: ListItem) =>
      item.type === 'transfer'
        ? navigation.navigate('TransactionEdit', { groupId: item.groupId })
        : navigation.navigate('TransactionEdit', { id: item.tx.id }),
    [navigation],
  );

  const openCategory = useCallback(
    (key: string) =>
      navigation.navigate('FinanceCategory', {
        category: key,
        year: data.period.year,
        month: data.period.month,
      }),
    [navigation, data.period.year, data.period.month],
  );

  // ACTIONS WITH UNDO ----------------------------------------------------------

  const logQuickAdd = async (quickAdd: QuickAdd) => {
    tap();
    const created = await data.logQuickAdd(quickAdd);
    if (!created) return;
    success();
    const account = created.account_id ? data.accountsById.get(created.account_id)?.name : null;
    toast.show({
      message: `Logged ${quickAdd.note} ${formatMoney(created.amount_minor, { compact: true })}${account ? ` · ${account}` : ''}`,
      actionLabel: 'Undo',
      onAction: () => void data.deleteItem({ type: 'entry', key: created.id, tx: created }),
    });
  };

  const deleteItem = async (item: ListItem) => {
    const gone = await data.deleteItem(item);
    if (!gone) return;
    toast.show({
      message: `Deleted ${describe(item)}`,
      actionLabel: 'Undo',
      onAction: () => void data.restoreRows(gone),
    });
  };

  const logAgain = async (item: ListItem) => {
    if (item.type !== 'entry') return;
    const created = await data.logAgainToday(item.tx);
    if (!created) return;
    success();
    toast.show({
      message: `Logged ${describe(item)} again today`,
      actionLabel: 'Undo',
      onAction: () => void data.deleteItem({ type: 'entry', key: created.id, tx: created }),
    });
  };

  const pinItem = async (item: ListItem) => {
    if (item.type !== 'entry') return;
    const tx = item.tx;
    if (tx.kind === 'transfer') return;
    const note = tx.note || categoryDef(tx.category).label;
    try {
      await data.createQuickAdd({
        note,
        amount_minor: tx.amount_minor,
        kind: tx.kind,
        category: tx.category,
        account_id: tx.account_id,
      });
      toast.show({ message: `Pinned ${note} to quick add` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not pin that' });
    }
  };

  const unpin = async (quickAdd: QuickAdd) => {
    if (!(await data.deleteQuickAdd(quickAdd))) return;
    toast.show({
      message: `Unpinned ${quickAdd.note}`,
      actionLabel: 'Undo',
      onAction: () => void data.restoreQuickAdd(quickAdd),
    });
  };

  const removeBudget = async (budget: Budget) => {
    if (!(await data.deleteBudget(budget))) return;
    toast.show({
      message: `Removed the ${categoryDef(budget.category).label} budget`,
      actionLabel: 'Undo',
      onAction: () => void data.restoreBudget(budget),
    });
  };

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <SwipeTabs
        options={TABS}
        value={tab}
        onChange={setTab}
        renderLabel={(t) => TAB_LABEL[t]}
        renderBadge={(t) => (t === 'budgets' && data.budgetTotals.overCount > 0 ? data.budgetTotals.overCount : null)}
        renderPage={(t) =>
          t === 'month' ? (
            <MonthPage
              data={data}
              onOpenItem={openItem}
              onItemMenu={setMenuItem}
              onLogQuickAdd={(q) => void logQuickAdd(q)}
              onEditQuickAdd={setQuickAddEditing}
              onOpenCategory={openCategory}
              onOpenAccounts={() => navigation.navigate('FinanceAccounts')}
              onAdd={() => navigation.navigate('TransactionEdit', {})}
            />
          ) : t === 'calendar' ? (
            <CalendarPage
              accountsById={data.accountsById}
              onOpenItem={openItem}
              onAdd={(date) => navigation.navigate('TransactionEdit', { date })}
            />
          ) : (
            <BudgetsPage
              data={data}
              onOpenCategory={openCategory}
              onEdit={(budget) => setBudgetSheet({ budget, category: budget.category })}
              onNew={(category) => setBudgetSheet({ budget: null, category })}
            />
          )
        }
      />

      {data.error ? (
        <FadeInView style={styles.errorWrap}>
          <Pressable
            onPress={data.dismissError}
            accessibilityRole="button"
            accessibilityLabel={`${data.error}. Dismiss`}
          >
            <GlassCard style={styles.errorCard}>
              <View style={styles.errorRow}>
                <Ionicons name="warning-outline" size={17} color={colors.danger} />
                <Text style={styles.errorText} numberOfLines={2}>
                  {data.error}
                </Text>
                <Ionicons name="close" size={16} color={colors.textMuted} />
              </View>
            </GlassCard>
          </Pressable>
        </FadeInView>
      ) : null}

      <FadeInView style={styles.fabWrap} delay={120}>
        <Pressable
          onPress={() => navigation.navigate('TransactionEdit', {})}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add an entry"
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      </FadeInView>

      <EntryMenuSheet
        item={menuItem}
        accountsById={data.accountsById}
        onClose={() => setMenuItem(null)}
        onEdit={openItem}
        onLogAgain={(item) => void logAgain(item)}
        onPin={(item) => void pinItem(item)}
        onDelete={(item) => void deleteItem(item)}
      />

      <QuickAddSheet
        quickAdd={quickAddEditing}
        accountName={
          quickAddEditing?.account_id ? data.accountsById.get(quickAddEditing.account_id)?.name ?? null : null
        }
        onClose={() => setQuickAddEditing(null)}
        onSave={data.updateQuickAdd}
        onUnpin={(q) => void unpin(q)}
      />

      <BudgetSheet
        visible={budgetSheet !== null}
        budget={budgetSheet?.budget ?? null}
        initialCategory={budgetSheet?.category ?? null}
        budgetedCategories={new Set(data.budgets.map((b) => b.category))}
        spentByCategory={new Map(data.summary.categoryTotals.map((c) => [c.key, c.totalMinor]))}
        onClose={() => setBudgetSheet(null)}
        onSave={data.saveBudget}
        onRemove={(budget) => void removeBudget(budget)}
      />

      <SettingsSheet
        visible={settingsOpen}
        startDay={data.startDay}
        onClose={() => setSettingsOpen(false)}
        onSaveStartDay={data.setMonthStart}
        onExport={(scope) => void handleExport(scope)}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  tabsTopSpacer: {
    // Clears the transparent nav header. SwipeTabs owns the tab row's own
    // padding, so this is only the gap above it.
    height: 96,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    // 40 drawn, 48 to the touch with the hit slop, 8 apart.
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: layout.fabInset,
  },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
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
    bottom: layout.aboveFab,
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
