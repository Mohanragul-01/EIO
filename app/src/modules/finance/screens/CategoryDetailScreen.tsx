/**
 * CategoryDetailScreen - one category in one finance month, and its last six.
 *
 * Reached from a budget bar or from "Where it went". After "₹4,200 on Food",
 * the next two questions are "on what?" and "is that normal?", so this shows
 * the month's entries and six months of the same category, against the limit
 * when there is one.
 */
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useLayoutEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { FadeInView, GlassCard, Screen } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { formatRange, periodTitle } from '../period';
import { useCategoryDetail } from '../useCategoryDetail';
import { BudgetBar } from '../components/BudgetBar';
import { DayHeader } from '../components/DayHeader';
import { HistoryBars } from '../components/HistoryBars';
import { TransactionRow } from '../components/TransactionRow';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceCategory'>;
type Route = RouteProp<RootStackParamList, 'FinanceCategory'>;

export function CategoryDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { category, year, month } = useRoute<Route>().params;
  const def = categoryDef(category);
  const detail = useCategoryDetail(category, { year, month });

  useLayoutEffect(() => {
    navigation.setOptions({ title: def.label });
  }, [navigation, def.label]);

  const entryCount = detail.days.reduce((n, d) => n + d.items.length, 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <FadeInView>
          <GlassCard>
            <Text style={styles.overline}>{periodTitle({ year, month })}</Text>
            <Text style={styles.range}>{formatRange(detail.range)}</Text>
            <Text style={styles.total}>{formatMoney(detail.spentMinor, { compact: true })}</Text>
            <Text style={styles.caption}>
              {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
            </Text>

            {detail.status ? (
              <View style={styles.budget}>
                <BudgetBar label={def.label} icon={def.icon} color={def.color} status={detail.status} />
              </View>
            ) : (
              <Text style={styles.noBudget}>No budget for {def.label}. Set one on the Budgets tab.</Text>
            )}
          </GlassCard>

          <Text style={styles.section}>Last six months</Text>
          <GlassCard>
            <HistoryBars
              history={detail.history}
              limitMinor={detail.budget?.amount_minor ?? null}
              color={def.color}
            />
          </GlassCard>

          <Text style={styles.section}>Entries</Text>
        </FadeInView>

        {detail.loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : detail.error ? (
          <Text style={styles.caption}>{detail.error}</Text>
        ) : entryCount === 0 ? (
          <Text style={styles.caption}>Nothing on {def.label} in this month.</Text>
        ) : (
          detail.days.map((day) => (
            <View key={day.date}>
              <DayHeader day={day} />
              {day.items.map((item) => (
                <TransactionRow
                  key={item.key}
                  item={item}
                  accountsById={detail.accountsById}
                  onPress={() =>
                    item.type === 'transfer'
                      ? navigation.navigate('TransactionEdit', { groupId: item.groupId })
                      : navigation.navigate('TransactionEdit', { id: item.tx.id })
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  overline: {
    ...typography.overline,
  },
  range: {
    ...typography.caption,
    ...typography.numeric,
  },
  total: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 30,
    marginTop: spacing.sm,
  },
  caption: {
    ...typography.caption,
  },
  budget: {
    marginTop: spacing.lg,
    marginBottom: -spacing.lg,
  },
  noBudget: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  section: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
}));
