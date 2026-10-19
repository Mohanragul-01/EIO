/**
 * ProductsListScreen - what you use daily, and what needs reordering.
 *
 * Sorted by urgency rather than by name, because the only reason to open this
 * is to find out what is about to run out (or go off). Alphabetical order
 * treats "three days left" and "four months left" as equally interesting.
 *
 * THE DAILY ACT IS ONE TAP. "Log use" on a card logs today's usual amount,
 * and the toast that follows names the day - "Logged 5 g · Today" - with an
 * Undo. Holding it asks WHEN: Today, Yesterday, or a day from a calendar,
 * with the amount pre-filled. Things you use every day sit at the top as the
 * Today checklist, so a morning of five supplements is five taps on one card,
 * or one "Log all".
 *
 * A finished container lives on under Finished, stacked with its repeat
 * purchases ("Whey ×3"), because how long each one lasted is the estimate for
 * the next. Finishing itself is one level down, on the product's page, where
 * its day can be chosen - it used to be the long-press here, a destructive
 * gesture sharing a button with the most frequent one.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  useToast,
} from '../../../core/components';
import { formatEventDate } from '../../../core/date';
import { success, tap } from '../../../core/haptics';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { todayChecklist, type ChecklistRow } from '../checklist';
import {
  LIFECYCLE_LABEL,
  estimateLabel,
  finishedGroups,
  lifespanDays,
  type Lifecycle,
} from '../containers';
import {
  chipsFor,
  loggedAllMessage,
  loggedMessage,
  removedMessage,
  remainingFraction,
  reorderMarker,
  reorderSummary,
  type Outlook,
} from '../outlook';
import { CATEGORY_LABEL, formatDaysLeft, formatQuantity, type Product, type Urgency } from '../types';
import { conflictMessage } from '../useBy';
import { useProducts } from '../useProducts';
import { StatusChips, SupplyBar, toneOf } from '../components/StatusChips';
import { TodayChecklist } from '../components/TodayChecklist';
import { UseSheet, type UseDraft } from '../components/UseSheet';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductsList'>;

const LIFECYCLES: Lifecycle[] = ['unopened', 'in_use', 'finished'];

/** What needs acting on, first. */
const RANK: Record<Urgency, number> = {
  critical: 0,
  soon: 1,
  unknown: 2,
  ok: 3,
  unopened: 4,
  finished: 5,
};

function rankOf(outlook: Outlook): number {
  // Expired leads whatever is left in it; a container with a spare waiting
  // has nothing to order, so it sorts with the ones that are fine.
  if (outlook.useByState === 'expired') return -1;
  if (outlook.spare && (outlook.urgency === 'critical' || outlook.urgency === 'soon')) return RANK.ok;
  return RANK[outlook.urgency];
}

/** "12 days", or "~42 days" when it is the previous container's estimate. */
function headlineOf(outlook: Outlook): string {
  if (outlook.lifecycle === 'finished') return 'Finished';
  if (outlook.lifecycle === 'unopened') return 'Spare';
  if (outlook.projection.daysLeft !== null) return formatDaysLeft(outlook.projection.daysLeft);
  if (outlook.estimate) return `~${formatDaysLeft(outlook.estimate.daysLeft)}`;
  if (outlook.projection.remaining <= 0) return 'Empty';
  return 'New';
}

export function ProductsListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();

  const { products, uses, outlooks, today, loading, refreshing, error, load, logUse, logMany, removeUses } =
    useProducts();

  const [lifecycle, setLifecycle] = useState<Lifecycle>('in_use');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [loggingAll, setLoggingAll] = useState(false);
  const [sheetFor, setSheetFor] = useState<Product | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const summary = useMemo(() => reorderSummary(outlooks), [outlooks]);
  const checklist = useMemo(() => todayChecklist(products, uses, today), [products, uses, today]);
  const groups = useMemo(() => finishedGroups(products), [products]);

  const counts = useMemo(() => {
    const result: Record<Lifecycle, number> = { unopened: 0, in_use: 0, finished: 0 };
    outlooks.forEach((o) => {
      result[o.lifecycle] += 1;
    });
    return result;
  }, [outlooks]);

  const visible = useMemo(
    () =>
      outlooks
        .filter((o) => o.lifecycle === lifecycle)
        .sort(
          (a, b) =>
            rankOf(a) - rankOf(b) ||
            (a.projection.daysLeft ?? a.estimate?.daysLeft ?? 9999) -
              (b.projection.daysLeft ?? b.estimate?.daysLeft ?? 9999) ||
            a.product.name.localeCompare(b.product.name),
        ),
    [outlooks, lifecycle],
  );

  const setRowBusy = useCallback((id: string, on: boolean) => {
    setBusy((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Log, then offer to take it back - naming the day it landed on. `onSaved`
   * runs between the two, which is where a sheet closes: a toast raised while
   * a sheet is still open sits under it, Undo and all.
   */
  const logAndOffer = useCallback(
    async (product: Product, draft: UseDraft, name?: string, onSaved?: () => void) => {
      const saved = await logUse(product.id, draft.quantity, draft.usedOn, draft.note);
      if (!saved) return false;
      onSaved?.();
      tap();
      toast.show({
        message: loggedMessage({ quantity: saved.quantity, unit: product.unit, usedOn: saved.used_on, name }),
        actionLabel: 'Undo',
        onAction: () => void removeUses([saved]),
      });
      return true;
    },
    [logUse, removeUses, toast],
  );

  const quickLog = (product: Product) =>
    void logAndOffer(
      product,
      { quantity: product.per_use ?? 1, usedOn: today, note: '' },
      product.name,
    );

  const toggleChecklist = async (row: ChecklistRow) => {
    const id = row.product.id;
    setRowBusy(id, true);
    try {
      if (!row.done) {
        await logAndOffer(row.product, { quantity: row.amount, usedOn: today, note: '' }, row.product.name);
        return;
      }
      // Tapping a ticked row takes back the most recent use today - the one
      // the tick most likely made.
      const latest = row.todayUses[0];
      if (!latest || latest.id.startsWith('pending-')) return;
      if (!(await removeUses([latest]))) return;
      tap();
      toast.show({
        message: removedMessage({ quantity: latest.quantity, unit: row.product.unit, usedOn: latest.used_on, name: row.product.name }),
        actionLabel: 'Undo',
        onAction: () => void logUse(latest.product_id, latest.quantity, latest.used_on, latest.note),
      });
    } finally {
      setRowBusy(id, false);
    }
  };

  const logAll = async () => {
    const open = checklist.filter((row) => !row.done);
    if (open.length === 0) return;
    setLoggingAll(true);
    try {
      const saved = await logMany(
        open.map((row) => ({ productId: row.product.id, quantity: row.amount })),
        today,
      );
      if (!saved) return;
      success();
      toast.show({
        message: loggedAllMessage(saved.length),
        actionLabel: 'Undo',
        onAction: () => void removeUses(saved),
      });
    } finally {
      setLoggingAll(false);
    }
  };

  const loggedDays = useMemo(() => {
    if (!sheetFor) return new Set<string>();
    return new Set(uses.filter((u) => u.product_id === sheetFor.id).map((u) => u.used_on));
  }, [uses, sheetFor]);

  if (loading) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const showLifecycles = counts.unopened > 0 || counts.finished > 0;

  return (
    <Screen padded={false}>
      <FormScroll
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      >
        {products.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            accent={colors.accentCyan}
            title="Nothing tracked yet"
            message="Add a product with its size and how much you use at a time. Log each use and it works out how long it will last from what you actually use."
            action={
              <Button
                label="Add a product"
                icon="add"
                onPress={() => navigation.navigate('ProductEdit', {})}
              />
            }
          />
        ) : (
          <>
            <FadeInView>
              <GlassCard style={styles.summary}>
                <Text style={[styles.summaryBig, summary.toReorder > 0 && { color: colors.danger }]}>
                  {summary.toReorder > 0 ? summary.toReorder : 'All'}
                </Text>
                <Text style={styles.summaryLabel}>
                  {summary.toReorder > 0 ? 'to reorder now' : 'stocked up for now'}
                </Text>
                {summary.runningLow > 0 || summary.spares > 0 ? (
                  <Text style={styles.summarySub}>
                    {[
                      summary.runningLow > 0 ? `${summary.runningLow} running low` : null,
                      summary.spares > 0
                        ? `${summary.spares} ${summary.spares === 1 ? 'spare' : 'spares'} on the shelf`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                <Text style={styles.summaryHint}>
                  Tap a card for its history · hold Log use to pick the day
                </Text>
              </GlassCard>
            </FadeInView>

            {/*
              Only once there is more than one kind to filter between. Before
              that every option says the same thing, and a segmented control
              with one real answer is furniture.
            */}
            {showLifecycles ? (
              <SegmentedControl
                options={LIFECYCLES}
                value={lifecycle}
                onChange={setLifecycle}
                renderLabel={(o) =>
                  counts[o] > 0 ? `${LIFECYCLE_LABEL[o]} ${counts[o]}` : LIFECYCLE_LABEL[o]
                }
                style={styles.states}
              />
            ) : null}

            {lifecycle === 'in_use' && checklist.length > 0 ? (
              <FadeInView delay={40}>
                <TodayChecklist
                  rows={checklist}
                  busy={busy}
                  onToggle={(row) => void toggleChecklist(row)}
                  onLogAll={() => void logAll()}
                  loggingAll={loggingAll}
                />
              </FadeInView>
            ) : null}

            {lifecycle === 'finished' ? (
              groups.length === 0 ? (
                <Text style={styles.noneHere}>Nothing finished yet.</Text>
              ) : (
                groups.map((group, index) => {
                  const open = expanded === group.key;
                  const latest = group.containers[0];
                  return (
                    <FadeInView key={group.key} delay={Math.min(index, 6) * 40}>
                      <GlassCard style={styles.card}>
                        <Pressable
                          onPress={() => setExpanded(open ? null : group.key)}
                          style={styles.groupHead}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: open }}
                          accessibilityLabel={`${group.name}, ${group.containers.length} finished`}
                        >
                          <Text style={styles.name} numberOfLines={1}>
                            {group.name}
                            {group.containers.length > 1 ? (
                              <Text style={styles.times}>{`  ×${group.containers.length}`}</Text>
                            ) : null}
                          </Text>
                          <Text style={styles.groupMeta}>
                            last {formatEventDate(latest.finished_on!)}
                          </Text>
                          <Ionicons
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.textMuted}
                          />
                        </Pressable>

                        {open
                          ? group.containers.map((container) => {
                              const lasted = lifespanDays(container);
                              return (
                                <Pressable
                                  key={container.id}
                                  onPress={() =>
                                    navigation.navigate('ProductDetail', { productId: container.id })
                                  }
                                  style={({ pressed }) => [styles.containerRow, pressed && styles.pressed]}
                                  accessibilityRole="button"
                                >
                                  <View style={styles.containerText}>
                                    <Text style={styles.containerDates}>
                                      {container.opened_on ? formatEventDate(container.opened_on) : '—'}
                                      {' – '}
                                      {formatEventDate(container.finished_on!)}
                                    </Text>
                                    <Text style={styles.containerMeta}>
                                      {[
                                        lasted !== null
                                          ? `lasted ${lasted} ${lasted === 1 ? 'day' : 'days'}`
                                          : null,
                                        formatQuantity(container.total_quantity, container.unit),
                                        container.price_minor !== null
                                          ? formatMoney(container.price_minor)
                                          : null,
                                      ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                    </Text>
                                  </View>
                                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                </Pressable>
                              );
                            })
                          : null}
                      </GlassCard>
                    </FadeInView>
                  );
                })
              )
            ) : visible.length === 0 ? (
              <Text style={styles.noneHere}>
                {lifecycle === 'unopened'
                  ? 'No spares. Add one from a product’s page when you buy ahead.'
                  : 'Nothing in use right now.'}
              </Text>
            ) : (
              visible.map((outlook, index) => (
                <FadeInView key={outlook.product.id} delay={Math.min(index, 6) * 40}>
                  <ProductCard
                    outlook={outlook}
                    today={today}
                    onOpen={() =>
                      navigation.navigate('ProductDetail', { productId: outlook.product.id })
                    }
                    onLog={() => quickLog(outlook.product)}
                    onChooseDay={() => setSheetFor(outlook.product)}
                  />
                </FadeInView>
              ))
            )}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </FormScroll>

      {products.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('ProductEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a product"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}

      {sheetFor ? (
        <UseSheet
          visible
          product={sheetFor}
          mode={{ kind: 'log', day: today }}
          today={today}
          logged={loggedDays}
          onClose={() => setSheetFor(null)}
          onSubmit={(draft) =>
            logAndOffer(sheetFor, draft, sheetFor.name, () => setSheetFor(null))
          }
        />
      ) : null}
    </Screen>
  );
}

/** One container in use, or a spare. */
function ProductCard({
  outlook,
  today,
  onOpen,
  onLog,
  onChooseDay,
}: {
  outlook: Outlook;
  today: string;
  onOpen: () => void;
  onLog: () => void;
  onChooseDay: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { product, projection } = outlook;

  const chips = chipsFor(outlook, today);
  // The bar and the headline speak for the supply, so they take the supply
  // chip's colour even when a use-by chip leads.
  const supply = chips.find((chip) => chip.kind !== 'use-by' && chip.kind !== 'expired') ?? chips[0];
  const tone = toneOf(colors, supply.kind);
  // An estimate or a brand-new container has no measured figure to colour.
  const headTone =
    outlook.projection.daysLeft === null && outlook.lifecycle === 'in_use' ? colors.textSecondary : tone;
  const marker = reorderMarker(outlook);

  return (
    <GlassCard style={styles.card} onPress={onOpen}>
      <View style={styles.cardHead}>
        {/* Truncated: the days-left label to its right is what you scan for,
            and a long name would push it out of line. */}
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        <Text style={[styles.days, { color: headTone }]}>{headlineOf(outlook)}</Text>
      </View>

      <Text style={styles.sub}>
        {outlook.lifecycle === 'unopened'
          ? `Not opened · ${formatQuantity(product.total_quantity, product.unit)}`
          : `${formatQuantity(projection.remaining, product.unit)} left of ${formatQuantity(product.total_quantity, product.unit)}`}
        {' · '}
        {CATEGORY_LABEL[product.category] ?? 'Other'}
      </Text>

      {outlook.lifecycle === 'in_use' ? (
        <View style={styles.bar}>
          <SupplyBar fraction={remainingFraction(outlook)} marker={marker} tone={tone} />
        </View>
      ) : null}

      <View style={styles.chips}>
        <StatusChips chips={chips} />
      </View>

      {outlook.estimate ? (
        <Text style={styles.estimate}>{estimateLabel(outlook.estimate, product.unit)}</Text>
      ) : null}

      {outlook.conflict ? (
        <View style={styles.conflict}>
          <Ionicons name="time-outline" size={13} color={colors.warning} />
          <Text style={styles.conflictText}>{conflictMessage(outlook.conflict)}</Text>
        </View>
      ) : null}

      {outlook.lifecycle === 'in_use' ? (
        <View style={styles.cardFoot}>
          <Text style={styles.rate}>
            {projection.dailyRate !== null
              ? `${formatQuantity(Math.round(projection.dailyRate * 10) / 10, product.unit)} a day${
                  projection.costPerDay !== null ? ` · ${formatMoney(projection.costPerDay)}/day` : ''
                }`
              : 'Log a few days to measure the rate'}
          </Text>

          <Pressable
            onPress={onLog}
            onLongPress={onChooseDay}
            accessibilityActions={[{ name: 'longpress', label: 'Log for another day' }]}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'longpress') onChooseDay();
            }}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`Log ${formatQuantity(product.per_use ?? 1, product.unit)} of ${product.name} for today`}
            accessibilityHint="Long press to choose the day and amount"
          >
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={styles.logText}>Log use</Text>
          </Pressable>
        </View>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    // Clear of the add button and the toast that floats above it.
    paddingBottom: layout.aboveFab + spacing.xxxl,
  },

  summary: { marginBottom: spacing.lg, alignItems: 'flex-start' },
  states: { marginBottom: spacing.lg },
  noneHere: { ...typography.caption, marginBottom: spacing.lg },
  summaryBig: { ...typography.display, ...typography.numeric, fontSize: 32 },
  summaryLabel: { ...typography.caption },
  summarySub: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  summaryHint: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.md,
  },

  card: { marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.title, fontSize: 15, flex: 1 },
  times: { ...typography.caption, color: colors.textSecondary },
  days: { ...typography.caption, ...typography.numeric, fontWeight: '600' },
  sub: { ...typography.caption, ...typography.numeric, fontSize: 12, marginTop: 4 },
  bar: { marginTop: spacing.md },
  chips: { marginTop: spacing.sm },
  estimate: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
  conflict: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  conflictText: { ...typography.caption, fontSize: 12, color: colors.textSecondary, flex: 1 },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  rate: { ...typography.caption, ...typography.numeric, fontSize: 11.5, color: colors.textFaint, flex: 1 },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '1A',
  },
  logText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  pressed: { opacity: 0.6 },

  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  groupMeta: { ...typography.caption, fontSize: 12, color: colors.textFaint },
  containerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  containerText: { flex: 1 },
  containerDates: { ...typography.body, ...typography.numeric, color: colors.text },
  containerMeta: { ...typography.caption, ...typography.numeric, color: colors.textMuted },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },

  fabWrap: { position: 'absolute', right: spacing.xl, bottom: layout.fabInset },
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
  fabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
}));
