/**
 * SubscriptionsListScreen - what you pay, and what leaves next.
 *
 * Three views of one list, switched by tabs (not a swipe pager: the 14-day
 * strip scrolls sideways, and two horizontal gestures in one place fight):
 *
 *   Upcoming  the next 14 days as a strip, then the list split into Overdue,
 *             This week, This month, Later, Trials and Paused & ending, each
 *             header with its count and total
 *   Calendar  the month: paid days and charges to come
 *   Insights  a week, month or year: where the money goes
 *
 * The headline is a NORMALISED total, switchable per week, month or year:
 * adding a yearly ₹4,800 to a monthly ₹199 as if they were alike gives a
 * number nobody can act on.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Screen,
  Tabs,
} from '../../../core/components';
import { tap } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatMoney } from '../../../core/money';
import { layout, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { CalendarView } from '../components/CalendarView';
import { InsightsView } from '../components/InsightsView';
import { ReminderSettingsSheet } from '../components/ReminderSettingsSheet';
import { SectionHeader } from '../components/SectionHeader';
import { SubscriptionRow } from '../components/SubscriptionRow';
import { UpcomingStrip } from '../components/UpcomingStrip';
import { useSubscriptionActions } from '../components/useSubscriptionActions';
import { shortDate } from '../format';
import type { Bucket } from '../lifecycle';
import type { Subscription } from '../types';
import { useSubscriptions } from '../useSubscriptions';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionsList'>;

type ViewKey = 'upcoming' | 'calendar' | 'insights';
const VIEWS: ViewKey[] = ['upcoming', 'calendar', 'insights'];
const VIEW_LABEL: Record<ViewKey, string> = {
  upcoming: 'Upcoming',
  calendar: 'Calendar',
  insights: 'Insights',
};

type Cadence = 'week' | 'month' | 'year';
const NEXT_CADENCE: Record<Cadence, Cadence> = { week: 'month', month: 'year', year: 'week' };
const CADENCE_SUFFIX: Record<Cadence, string> = { week: '/ wk', month: '/ mo', year: '/ yr' };
const CADENCE_WORD: Record<Cadence, string> = { week: 'week', month: 'month', year: 'year' };

/** One line of the list: a section header, a row, or the archive toggle. */
type Item =
  | { type: 'header'; key: string; bucket: Bucket; count: number; totalMinor: number | null }
  | { type: 'row'; key: string; sub: Subscription }
  | { type: 'archive'; key: string; count: number };

export function SubscriptionsListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const data = useSubscriptions();
  const {
    subscriptions,
    sections,
    archived,
    strip,
    totals,
    today,
    rises,
    accountName,
    permission,
    loading,
    refreshing,
    error,
    refresh,
    reload,
  } = data;

  const [view, setView] = useState<ViewKey>('upcoming');
  const [cadence, setCadence] = useState<Cadence>('month');
  const [day, setDay] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const open = useCallback(
    (sub: Subscription) => navigation.navigate('SubscriptionDetail', { id: sub.id }),
    [navigation],
  );
  const actions = useSubscriptionActions({
    today,
    accounts: data.accounts,
    markPaid: data.markPaid,
    undoMarkPaid: data.undoMarkPaid,
    applyPatch: data.applyPatch,
    undoPatch: data.undoPatch,
    remove: data.remove,
    onOpen: open,
    onEdit: (sub) => navigation.navigate('SubscriptionEdit', { id: sub.id }),
  });

  // An action on the whole module, so it lives in the header and does not
  // scroll away.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setSettingsOpen(true)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Reminder settings"
        >
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, colors.text, styles.iconButton]);

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const items = useMemo<Item[]>(() => {
    if (view !== 'upcoming') return [];

    // A day picked on the strip narrows the list to what happens that day.
    if (day) {
      const picked = strip.find((d) => d.iso === day);
      return (picked?.charges ?? []).map((c, i) => ({
        type: 'row' as const,
        key: `day-${c.sub.id}-${i}`,
        sub: c.sub,
      }));
    }

    const list: Item[] = [];
    for (const section of sections) {
      list.push({
        type: 'header',
        key: `h-${section.bucket}`,
        bucket: section.bucket,
        count: section.count,
        totalMinor: section.totalMinor,
      });
      section.items.forEach((sub) => list.push({ type: 'row', key: sub.id, sub }));
    }
    if (archived.length > 0) {
      list.push({ type: 'archive', key: 'archive', count: archived.length });
      if (showArchived) archived.forEach((sub) => list.push({ type: 'row', key: sub.id, sub }));
    }
    return list;
  }, [view, day, strip, sections, archived, showArchived]);

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
  const overdue = sections.find((s) => s.bucket === 'overdue');
  const thisWeek = sections.find((s) => s.bucket === 'week');
  const headline =
    cadence === 'week'
      ? totals.perWeekMinor
      : cadence === 'year'
        ? totals.perYearMinor
        : totals.perMonthMinor;
  const pickedDay = day ? strip.find((d) => d.iso === day) : undefined;

  const header = hasData ? (
    <FadeInView>
      {/*
        Reminders failing silently is worse than not having them: you would
        assume you were covered. So when they cannot fire, the module says so.
        Tapping asks for permission - the moment you are turning them on - and
        only Settings can undo a denial asked twice.
      */}
      {permission === 'denied' || permission === 'unsupported' ? (
        <Pressable
          onPress={async () => {
            if (permission !== 'denied') return;
            const state = await data.turnOnReminders();
            if (state === 'denied') void Linking.openSettings();
          }}
          style={styles.notice}
          accessibilityRole={permission === 'denied' ? 'button' : 'text'}
        >
          <Ionicons name="notifications-off-outline" size={16} color={colors.warning} />
          <Text style={styles.noticeText}>
            {permission === 'denied'
              ? 'Reminders are off. Tap to turn them on.'
              : 'Reminders need the EIO app build, not Expo Go.'}
          </Text>
        </Pressable>
      ) : null}

      <GlassCard>
        <Text style={styles.overline}>Costing you</Text>
        <View style={styles.headlineRow}>
          <Text style={styles.headline}>{formatMoney(headline, { compact: true })}</Text>
          <Pressable
            onPress={() => {
              tap();
              setCadence(NEXT_CADENCE[cadence]);
            }}
            style={({ pressed }) => [styles.cadence, pressed && styles.pressed]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Per ${CADENCE_WORD[cadence]}. Tap for per ${CADENCE_WORD[NEXT_CADENCE[cadence]]}`}
          >
            <Text style={styles.cadenceText}>{CADENCE_SUFFIX[cadence]}</Text>
            <Ionicons name="swap-vertical" size={13} color={colors.textSecondary} />
          </Pressable>
        </View>
        <Text style={styles.sub}>
          {totals.count} active
          {totals.trialCount > 0
            ? ` · ${totals.trialCount} on trial (not counted)`
            : ''}
        </Text>
        {totals.missingRate > 0 ? (
          <View style={styles.alertRow}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.warning} />
            <Text style={[styles.alertText, { color: colors.warning }]}>
              {totals.missingRate} foreign {totals.missingRate === 1 ? 'price has' : 'prices have'} no
              rate set, so {totals.missingRate === 1 ? 'it is' : 'they are'} left out
            </Text>
          </View>
        ) : null}
        {overdue || thisWeek ? (
          <View style={styles.alertRow}>
            <Ionicons
              name={overdue ? 'alert-circle' : 'time-outline'}
              size={15}
              color={overdue ? colors.danger : colors.warning}
            />
            <Text style={[styles.alertText, { color: overdue ? colors.danger : colors.warning }]}>
              {overdue
                ? `${overdue.count} overdue · ${formatMoney(overdue.totalMinor ?? 0, { compact: true })}`
                : `${thisWeek?.count} due this week · ${formatMoney(thisWeek?.totalMinor ?? 0, { compact: true })}`}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <View style={styles.tabs}>
        <Tabs options={VIEWS} value={view} onChange={setView} renderLabel={(v) => VIEW_LABEL[v]} />
      </View>

      {view === 'upcoming' ? (
        <>
          <Text style={styles.overlineGap}>Next 14 days</Text>
          <UpcomingStrip days={strip} selected={day} onSelect={setDay} />
          {pickedDay ? (
            <View style={styles.dayFilter}>
              <Text style={styles.dayFilterText}>
                {shortDate(pickedDay.iso, today)} · {pickedDay.charges.length} ·{' '}
                {formatMoney(pickedDay.totalMinor, { compact: true })}
              </Text>
              <Pressable
                onPress={() => setDay(null)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Show every subscription"
                style={styles.clear}
              >
                <Text style={styles.clearText}>Show all</Text>
              </Pressable>
            </View>
          ) : null}
          {pickedDay && pickedDay.charges.length === 0 ? (
            <Text style={styles.emptyDay}>Nothing renews that day.</Text>
          ) : null}
        </>
      ) : view === 'calendar' ? (
        <View style={styles.view}>
          <CalendarView
            subscriptions={subscriptions}
            today={today}
            paymentsVersion={data.paymentsVersion}
            onOpen={open}
          />
        </View>
      ) : (
        <View style={styles.view}>
          <InsightsView
            subscriptions={subscriptions}
            accountName={accountName}
            today={today}
            paymentsVersion={data.paymentsVersion}
            onOpen={open}
          />
        </View>
      )}
    </FadeInView>
  ) : null;

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
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
        ListHeaderComponent={header}
        ListEmptyComponent={
          hasData ? null : (
            <EmptyState
              icon="repeat-outline"
              accent={colors.accentCyan}
              title="No subscriptions tracked"
              message="Add the things that renew on their own - streaming, your phone pack, cloud storage, the gym - and see when each one leaves your account."
              action={
                <Button
                  label="Add a subscription"
                  icon="add"
                  onPress={() => navigation.navigate('SubscriptionCatalogue')}
                />
              }
            />
          )
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <SectionHeader bucket={item.bucket} count={item.count} totalMinor={item.totalMinor} />
            );
          }
          if (item.type === 'archive') {
            return (
              <Pressable
                onPress={() => setShowArchived(!showArchived)}
                style={({ pressed }) => [styles.archive, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityState={{ expanded: showArchived }}
                accessibilityLabel={`Archived and ended, ${item.count}`}
              >
                <Ionicons name="archive-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.archiveText}>Archived & ended ({item.count})</Text>
                <Ionicons
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textSecondary}
                />
              </Pressable>
            );
          }
          return (
            <SubscriptionRow
              subscription={item.sub}
              today={today}
              accountName={accountName(item.sub.account_id)}
              rise={rises.get(item.sub.id) ?? null}
              onPress={() => open(item.sub)}
              onLongPress={() => actions.openMenu(item.sub)}
              onMarkPaid={() => actions.run('pay', item.sub)}
              onDecideTrial={() => actions.run('keep', item.sub)}
            />
          );
        }}
      />

      {error ? (
        <FadeInView style={styles.errorWrap}>
          <GlassCard style={styles.errorCard}>
            <Pressable
              onPress={data.clearError}
              style={styles.errorRow}
              accessibilityRole="button"
              accessibilityLabel={`${error}. Dismiss`}
            >
              <Ionicons name="warning-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText} numberOfLines={2}>
                {error}
              </Text>
              <Ionicons name="close" size={16} color={colors.textMuted} />
            </Pressable>
          </GlassCard>
        </FadeInView>
      ) : null}

      {hasData ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('SubscriptionCatalogue')}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add subscription"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}

      {actions.sheets}
      <ReminderSettingsSheet
        visible={settingsOpen}
        settings={data.settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(next) => {
          setSettingsOpen(false);
          void data.saveSettings(next);
        }}
      />
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
    paddingBottom: layout.aboveFab + spacing.xxl,
  },
  listEmpty: {
    flexGrow: 1,
    paddingTop: 80,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  noticeText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.text,
    flex: 1,
  },
  overline: {
    ...typography.overline,
  },
  overlineGap: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  headline: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 30,
  },
  cadence: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cadenceText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pressed: {
    opacity: 0.7,
  },
  sub: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  alertText: {
    ...typography.caption,
    fontSize: 12.5,
    flex: 1,
  },
  tabs: {
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  view: {
    marginBottom: spacing.lg,
  },
  dayFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  dayFilterText: {
    ...typography.overline,
    ...typography.numeric,
    flex: 1,
  },
  clear: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  clearText: {
    ...typography.caption,
    color: colors.primary,
  },
  emptyDay: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  archive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginTop: spacing.lg,
  },
  archiveText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
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
    borderColor: colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));
