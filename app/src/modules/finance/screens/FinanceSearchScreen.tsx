/**
 * FinanceSearchScreen - every entry ever, filtered as you type, with a total.
 *
 * "How much did I spend on Swiggy this year?" is the question a personal
 * ledger has to answer, and a list of matches without a sum leaves the
 * adding up to you. So the first line is the total: "23 results · ₹6,480
 * spent" (Money Manager's search does the same). Transfers can match - by an
 * account name, say - and are listed, but never added to the money.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { Screen } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import type { DayGroup, ListItem } from '../summary';
import { useFinanceSearch } from '../useFinanceSearch';
import { DayHeader } from '../components/DayHeader';
import { TransactionRow } from '../components/TransactionRow';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceSearch'>;

type Row = { type: 'day'; key: string; day: DayGroup } | { type: 'item'; key: string; item: ListItem };

export function FinanceSearchScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { query, setQuery, days, totals, accountsById, loading, error } = useFinanceSearch();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    days.forEach((day) => {
      out.push({ type: 'day', key: `day-${day.date}`, day });
      day.items.forEach((item) => out.push({ type: 'item', key: item.key, item }));
    });
    return out;
  }, [days]);

  const hasQuery = query.trim().length > 0;
  const summary = [
    `${totals.count} ${totals.count === 1 ? 'result' : 'results'}`,
    totals.outMinor > 0 ? `${formatMoney(totals.outMinor, { compact: true })} spent` : null,
    totals.inMinor > 0 ? `${formatMoney(totals.inMinor, { compact: true })} received` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Notes, categories, accounts, or 250"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoFocus
            returnKeyType="search"
            selectionColor={colors.primary}
            accessibilityLabel="Search entries"
          />
          {hasQuery ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={4}
              style={styles.clear}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {hasQuery && !loading ? (
          <Text style={styles.totals} accessibilityLiveRegion="polite">
            {summary}
          </Text>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : error ? (
        <Text style={styles.message}>{error}</Text>
      ) : !hasQuery ? (
        <Text style={styles.message}>
          Search every entry you have ever logged. An amount like 250 finds every ₹250.
        </Text>
      ) : rows.length === 0 ? (
        <Text style={styles.message}>Nothing matches “{query.trim()}”.</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          renderItem={({ item: row }) =>
            row.type === 'day' ? (
              <DayHeader day={row.day} />
            ) : (
              <TransactionRow
                item={row.item}
                accountsById={accountsById}
                onPress={() =>
                  row.item.type === 'transfer'
                    ? navigation.navigate('TransactionEdit', { groupId: row.item.groupId })
                    : navigation.navigate('TransactionEdit', { id: row.item.tx.id })
                }
              />
            )
          }
        />
      )}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  top: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  clear: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },
  totals: {
    ...typography.title,
    ...typography.numeric,
    marginTop: spacing.lg,
  },
  loading: {
    marginTop: spacing.xxxl,
  },
  message: {
    ...typography.body,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
}));
