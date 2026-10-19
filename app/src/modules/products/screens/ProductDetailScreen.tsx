/**
 * ProductDetailScreen - one container: how much is left, what you used, and
 * everything that is not "log today".
 *
 * THE FORTNIGHT STRIP shows the last fourteen days, empty ones included, so a
 * forgotten day is visible as a gap: an outlined, hollow bar since the day it
 * was opened, nothing before. Tapping any day opens the log sheet already set
 * to it, so spotting the gap and filling it is one motion.
 *
 * HISTORY ROWS ARE EDITABLE. Tap one to change its day, amount or note, or to
 * delete just that use - a wrong entry skews the measured rate, and fixing it
 * used to mean deleting it and typing it again. Every change offers Undo.
 *
 * A CONTAINER'S LIFE is managed here: finish it on the day it ran out (that
 * lifespan is the next one's estimate), start the next one or open the spare,
 * add a spare when you buy ahead, and see how long the previous ones lasted.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';

import { Button, FadeInView, FormScroll, GlassCard, Screen, useToast } from '../../../core/components';
import { formatEventDate, fromISODate, todayISO } from '../../../core/date';
import { success, tap } from '../../../core/haptics';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { useLatestRun } from '../../../core/useLatestRun';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { onProductsChanged, productsChanged } from '../changes';
import {
  LIFECYCLE_LABEL,
  activeSibling,
  estimateLabel,
  lifespanDays,
  previousContainers,
} from '../containers';
import {
  buildOutlooks,
  chipsFor,
  loggedMessage,
  removedMessage,
  remainingFraction,
  reorderMarker,
} from '../outlook';
import {
  CATEGORY_LABEL,
  daysBetween,
  formatDayMonth,
  formatDaysLeft,
  formatQuantity,
  groupByDay,
  recentDays,
  type Product,
  type ProductUse,
} from '../types';
import { conflictMessage, usableLabel } from '../useBy';
import { DaySheet, type DayAction } from '../components/DaySheet';
import { StatusChips, SupplyBar, toneOf } from '../components/StatusChips';
import { UseSheet, type UseDraft, type UseSheetMode } from '../components/UseSheet';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Route = RouteProp<RootStackParamList, 'ProductDetail'>;

type SheetState =
  | { kind: 'use'; mode: UseSheetMode }
  | { kind: 'finish' }
  | { kind: 'open' }
  | null;

/** "today", "yesterday", "on 3 Oct" - a day in the middle of a sentence. */
function onDay(day: string, today: string): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `on ${formatDayMonth(day, today)}`;
}

/** Reorder reminders are rebuilt after every change made here. Never throws. */
function resync() {
  api.resyncReminders().catch(() => {
    // The list rebuilds them on its next load, and the app on its next launch.
  });
}

export function ProductDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { productId } = useRoute<Route>().params;

  const [products, setProducts] = useState<Product[]>([]);
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);

  const { begin } = useLatestRun();
  /** Who this page is, to the change signal: its own writes are already shown. */
  const [owner] = useState(() => ({}));

  /**
   * Every product, not just this one: whether a spare is waiting, which
   * container came before and how long it lasted all live in its siblings.
   */
  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const [all, own] = await Promise.all([api.listProducts(), api.listUses(productId)]);
        if (!isCurrent()) return;
        // Deleted from the edit screen on top of this one: nothing is left to
        // show, so go back to the list rather than sit on a blank screen.
        if (!all.some((p) => p.id === productId)) {
          navigation.goBack();
          return;
        }
        setProducts(all);
        setUses(own);
      } catch (e) {
        if (!isCurrent()) return;
        setError(e instanceof Error ? e.message : 'Could not load this product');
      } finally {
        if (isCurrent()) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [begin, productId, navigation],
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The list's toast can undo a use this page is showing.
  useEffect(() => onProductsChanged(owner, () => void load()), [owner, load]);

  const today = todayISO();
  const outlook = useMemo(() => {
    const product = products.find((p) => p.id === productId);
    if (!product) return null;
    return buildOutlooks(products, uses, today).find((o) => o.product.id === productId) ?? null;
  }, [products, uses, productId, today]);
  const product = outlook?.product ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: product?.name ?? '',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ProductEdit', { productId })}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Edit this product"
        >
          <Ionicons name="create-outline" size={20} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, product?.name, productId, colors.text]);

  const strip = useMemo(() => recentDays(uses, today, 14), [uses, today]);
  const history = useMemo(() => groupByDay(uses), [uses]);
  const loggedDays = useMemo(() => new Set(uses.map((u) => u.used_on)), [uses]);
  const stripMax = Math.max(1, ...strip.map((d) => d.total));
  const earlier = useMemo(
    () => (product ? previousContainers(product, products) : []),
    [product, products],
  );
  const sibling = useMemo(
    () => (product && outlook?.lifecycle === 'unopened' ? activeSibling(product, products) : null),
    [product, products, outlook?.lifecycle],
  );

  /**
   * Run a write, reload, rebuild reminders. Resolves the write's result, or
   * undefined when it failed - having said why on screen.
   */
  const write = useCallback(
    async <T,>(run: () => Promise<T>, failure: string): Promise<T | undefined> => {
      try {
        const result = await run();
        await load();
        resync();
        // An Undo tapped after leaving this page still runs here; the list
        // that is on screen by then hears about it.
        productsChanged(owner);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : failure);
        return undefined;
      }
    },
    [load, owner],
  );

  if (loading || !outlook || !product) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      </Screen>
    );
  }

  const { projection, lifecycle } = outlook;
  const chips = chipsFor(outlook, today);
  const supply = chips.find((chip) => chip.kind !== 'use-by' && chip.kind !== 'expired') ?? chips[0];
  const tone = toneOf(colors, supply.kind);
  const inUse = lifecycle === 'in_use';
  const lasted = lifespanDays(product);

  const headline =
    lifecycle === 'finished'
      ? 'Finished'
      : lifecycle === 'unopened'
        ? 'Not opened yet'
        : projection.daysLeft !== null
          ? formatDaysLeft(projection.daysLeft)
          : outlook.estimate
            ? `~${formatDaysLeft(outlook.estimate.daysLeft)}`
            : projection.remaining <= 0
              ? 'Empty'
              : 'Just opened';

  /* --- uses ------------------------------------------------------------ */

  const submitUse = async (mode: UseSheetMode, draft: UseDraft): Promise<boolean> => {
    if (mode.kind === 'log') {
      const logged = await write(
        () => api.logUse(product.id, draft.quantity, draft.usedOn, draft.note),
        'Could not log that',
      );
      if (!logged) return false;
      // Closed before the toast, which would otherwise sit under the sheet.
      setSheet(null);
      tap();
      toast.show({
        message: loggedMessage({ quantity: logged.quantity, unit: product.unit, usedOn: logged.used_on }),
        actionLabel: 'Undo',
        onAction: () => void write(() => api.deleteUse(logged.id), 'Could not undo that'),
      });
      return true;
    }

    const before = mode.use;
    const changed = await write(
      () => api.updateUse(before.id, { used_on: draft.usedOn, quantity: draft.quantity, note: draft.note }),
      'Could not save that',
    );
    if (!changed) return false;
    setSheet(null);
    toast.show({
      message: `Changed to ${formatQuantity(draft.quantity, product.unit)} · ${formatEventDate(draft.usedOn)}`,
      actionLabel: 'Undo',
      onAction: () =>
        void write(
          () =>
            api.updateUse(before.id, {
              used_on: before.used_on,
              quantity: before.quantity,
              note: before.note,
            }),
          'Could not undo that',
        ),
    });
    return true;
  };

  /** A void write, reported as whether it worked. */
  const did = async (run: () => Promise<void>, failure: string) =>
    (await write(async () => {
      await run();
      return true;
    }, failure)) === true;

  /** Only that one use, and Undo puts it back - so no "are you sure". */
  const deleteUse = async (use: ProductUse) => {
    setSheet(null);
    const ok = await did(() => api.deleteUse(use.id), 'Could not delete that');
    if (!ok) return;
    toast.show({
      message: removedMessage({ quantity: use.quantity, unit: product.unit, usedOn: use.used_on }),
      actionLabel: 'Undo',
      onAction: () =>
        void write(
          () => api.logUse(use.product_id, use.quantity, use.used_on, use.note),
          'Could not undo that',
        ),
    });
  };

  /* --- the container's life -------------------------------------------- */

  const lastedLine = (day: string) => {
    if (!product.opened_on) return null;
    const days = Math.max(1, daysBetween(product.opened_on, day) + 1);
    return `It lasted ${days} ${days === 1 ? 'day' : 'days'}. That becomes the next one's first estimate.`;
  };

  const finishActions: DayAction[] = [
    outlook.spare
      ? {
          key: 'open-spare',
          label: 'Finish and open the spare',
          icon: 'cube-outline',
          run: async (day) => {
            const spare = outlook.spare!;
            const ok = await did(() => api.openSpare(spare.id, day, product.id), 'Could not open the spare');
            if (!ok) return false;
            setSheet(null);
            success();
            toast.show({
              message: `Finished · the next ${product.name} is open`,
              actionLabel: 'Undo',
              onAction: () => void write(() => api.unopenSpare(spare.id, product.id), 'Could not undo that'),
            });
            return true;
          },
        }
      : {
          key: 'restock',
          label: 'Finish and start a new one',
          icon: 'refresh',
          run: async (day) => {
            const ok = await did(() => api.setFinished(product.id, day), 'Could not finish it');
            if (!ok) return false;
            setSheet(null);
            navigation.navigate('ProductEdit', { restockFrom: product.id });
            return true;
          },
        },
    {
      key: 'finish',
      label: 'Just mark it finished',
      variant: 'glass',
      run: async (day) => {
        const ok = await did(() => api.setFinished(product.id, day), 'Could not finish it');
        if (!ok) return false;
        setSheet(null);
        toast.show({
          message: `${product.name} finished ${onDay(day, today)}`,
          actionLabel: 'Undo',
          onAction: () => void write(() => api.setFinished(product.id, null), 'Could not undo that'),
        });
        return true;
      },
    },
  ];

  const openActions: DayAction[] = [
    {
      key: 'open',
      label: 'Open it',
      icon: 'cube-outline',
      run: async (day) => {
        const replacing = sibling;
        const ok = await did(
          () => api.openSpare(product.id, day, replacing?.id ?? null),
          'Could not open it',
        );
        if (!ok) return false;
        setSheet(null);
        success();
        toast.show({
          message: replacing
            ? `Opened ${onDay(day, today)} · the last one is finished`
            : `Opened ${onDay(day, today)}`,
          actionLabel: 'Undo',
          onAction: () =>
            void write(() => api.unopenSpare(product.id, replacing?.id ?? null), 'Could not undo that'),
        });
        return true;
      },
    },
  ];

  const reopen = async () => {
    setBusy(true);
    await did(() => api.setFinished(product.id, null), 'Could not reopen it');
    setBusy(false);
  };

  return (
    <Screen padded={false}>
      <FormScroll
        contentContainerStyle={styles.scroll}
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
        <FadeInView>
          {/* STATUS ------------------------------------------------------ */}
          <GlassCard>
            <Text style={styles.overline}>
              {CATEGORY_LABEL[product.category] ?? 'Other'} · {LIFECYCLE_LABEL[lifecycle]}
            </Text>
            <Text
              style={[
                styles.big,
                { color: inUse && projection.daysLeft === null ? colors.textSecondary : tone },
              ]}
            >
              {headline}
            </Text>

            <View style={styles.chips}>
              <StatusChips chips={chips} />
            </View>

            {inUse ? (
              <View style={styles.bar}>
                <SupplyBar
                  fraction={remainingFraction(outlook)}
                  marker={reorderMarker(outlook)}
                  tone={tone}
                  thick
                />
              </View>
            ) : null}

            <Text style={styles.line}>
              {lifecycle === 'unopened'
                ? `${formatQuantity(product.total_quantity, product.unit)}, bought ahead`
                : `${formatQuantity(projection.remaining, product.unit)} left of ${formatQuantity(product.total_quantity, product.unit)}`}
            </Text>

            {lifecycle !== 'unopened' ? (
              <Text style={styles.subtle}>
                {projection.dailyRate !== null
                  ? `${formatQuantity(Math.round(projection.dailyRate * 10) / 10, product.unit)} a day` +
                    (projection.costPerDay !== null ? ` · ${formatMoney(projection.costPerDay)} a day` : '')
                  : 'Log a couple of days of use to measure the rate'}
              </Text>
            ) : null}

            {outlook.estimate ? (
              <Text style={styles.estimate}>{estimateLabel(outlook.estimate, product.unit)}</Text>
            ) : null}

            {inUse && projection.emptyOn ? (
              <Text style={styles.subtle}>
                Runs out around {formatDayMonth(projection.emptyOn, today)}
                {outlook.reorderOn && outlook.reorderOn > today && !outlook.spare
                  ? ` · reorder by ${formatDayMonth(outlook.reorderOn, today)}`
                  : ''}
              </Text>
            ) : null}

            {outlook.conflict ? (
              <View style={styles.conflict}>
                <Ionicons name="time-outline" size={14} color={colors.warning} />
                <Text style={styles.conflictText}>{conflictMessage(outlook.conflict)}</Text>
              </View>
            ) : outlook.useBy && !outlook.useByState ? (
              <Text style={styles.subtle}>{usableLabel(outlook.useBy, today)}</Text>
            ) : null}

            <Text style={styles.subtle}>
              {product.opened_on
                ? `Opened ${formatEventDate(product.opened_on)}`
                : 'Not opened yet'}
              {product.finished_on
                ? ` · finished ${formatEventDate(product.finished_on)}${lasted !== null ? ` · lasted ${lasted} ${lasted === 1 ? 'day' : 'days'}` : ''}`
                : product.opened_on
                  ? ` · open ${projection.daysOpen} ${projection.daysOpen === 1 ? 'day' : 'days'}`
                  : ''}
            </Text>

            {outlook.spare && inUse ? (
              <View style={styles.spareNote}>
                <Ionicons name="cube-outline" size={14} color={colors.info} />
                <Text style={styles.spareText}>A spare is waiting, so there is nothing to reorder.</Text>
              </View>
            ) : null}
          </GlassCard>

          {/* ACTIONS ----------------------------------------------------- */}
          {inUse ? (
            <Button
              label="Log a use"
              icon="add"
              onPress={() => setSheet({ kind: 'use', mode: { kind: 'log', day: today } })}
              style={styles.primary}
            />
          ) : lifecycle === 'unopened' ? (
            <Button
              label="Open it"
              icon="cube-outline"
              onPress={() => setSheet({ kind: 'open' })}
              style={styles.primary}
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* LAST FOURTEEN DAYS ------------------------------------------ */}
          {inUse ? (
            <GlassCard style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.overline}>Last 14 days</Text>
                <Text style={styles.subtleInline}>
                  {strip.filter((d) => d.count > 0).length} of {strip.filter((d) => !product.opened_on || d.date >= product.opened_on).length} days logged
                </Text>
              </View>

              <View style={styles.strip}>
                {strip.map((day) => {
                  const isToday = day.date === today;
                  const beforeOpening = !!product.opened_on && day.date < product.opened_on;
                  const height = day.total === 0 ? 0 : 0.25 + 0.75 * (day.total / stripMax);
                  const weekday = fromISODate(day.date).toLocaleDateString(undefined, { weekday: 'narrow' });

                  return (
                    <Pressable
                      key={day.date}
                      disabled={beforeOpening}
                      // Opens the log sheet set to that day. Logging straight
                      // from a tap would be one stray touch away from a wrong
                      // entry on a day whose date you cannot see.
                      onPress={() => setSheet({ kind: 'use', mode: { kind: 'log', day: day.date } })}
                      style={({ pressed }) => [styles.dayColumn, pressed && styles.pressed]}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: beforeOpening }}
                      accessibilityLabel={`${formatEventDate(day.date)}, ${
                        beforeOpening
                          ? 'before it was opened'
                          : day.count === 0
                            ? 'nothing logged'
                            : `${formatQuantity(day.total, product.unit)} logged`
                      }`}
                      accessibilityHint={beforeOpening ? undefined : 'Logs a use for this day'}
                    >
                      <View
                        style={[
                          styles.barTrack,
                          beforeOpening
                            ? styles.barBefore
                            : day.total === 0
                              ? styles.barEmpty
                              : null,
                        ]}
                      >
                        {day.total > 0 ? (
                          <View
                            style={[
                              styles.barFill,
                              { height: `${Math.round(height * 100)}%`, backgroundColor: colors.accentCyan },
                            ]}
                          />
                        ) : null}
                      </View>
                      <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{weekday}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.hint}>Hollow days have nothing logged. Tap one to fill it in.</Text>
            </GlassCard>
          ) : null}

          {/* HISTORY ----------------------------------------------------- */}
          {lifecycle !== 'unopened' ? (
            <>
              <Text style={styles.sectionTitle}>
                History · {uses.length} {uses.length === 1 ? 'use' : 'uses'}
              </Text>

              {history.length === 0 ? (
                <Text style={styles.subtle}>Nothing logged yet.</Text>
              ) : (
                history.map((day) => (
                  <View key={day.date} style={styles.historyDay}>
                    <View style={styles.historyHead}>
                      <Text style={styles.historyDate}>{formatEventDate(day.date)}</Text>
                      <Text style={styles.historyTotal}>
                        {day.uses.length > 1 ? `${day.uses.length} uses · ` : ''}
                        {formatQuantity(day.total, product.unit)}
                      </Text>
                    </View>

                    {day.uses.map((entry) => (
                      <Pressable
                        key={entry.id}
                        onPress={() => setSheet({ kind: 'use', mode: { kind: 'edit', use: entry } })}
                        style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`${formatQuantity(entry.quantity, product.unit)} on ${formatEventDate(entry.used_on)}${entry.note ? `, ${entry.note}` : ''}`}
                        accessibilityHint="Edit or delete this use"
                      >
                        <Text style={styles.historyAmount}>{formatQuantity(entry.quantity, product.unit)}</Text>
                        <Text style={styles.historyNote} numberOfLines={1}>
                          {entry.note}
                        </Text>
                        <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </>
          ) : null}

          {/* EARLIER CONTAINERS ------------------------------------------ */}
          {earlier.length > 0 ? (
            <GlassCard style={styles.card}>
              <Text style={styles.overline}>Before this one</Text>
              <Text style={styles.lifespans}>
                Lasted{' '}
                {earlier
                  .slice(0, 5)
                  .map((p) => lifespanDays(p))
                  .filter((d): d is number => d !== null)
                  .join(' · ')}{' '}
                days
              </Text>
              {earlier.slice(0, 5).map((container) => {
                const days = lifespanDays(container);
                return (
                  <Pressable
                    key={container.id}
                    onPress={() => navigation.push('ProductDetail', { productId: container.id })}
                    style={({ pressed }) => [styles.earlierRow, pressed && styles.pressed]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.earlierDates}>
                      {container.opened_on ? formatDayMonth(container.opened_on, today) : '—'} –{' '}
                      {formatDayMonth(container.finished_on!, today)}
                    </Text>
                    <Text style={styles.earlierMeta}>
                      {[
                        days !== null ? `${days} d` : null,
                        container.price_minor !== null ? formatMoney(container.price_minor) : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Pressable>
                );
              })}
            </GlassCard>
          ) : null}

          {/* LIFECYCLE --------------------------------------------------- */}
          <View style={styles.lifeActions}>
            {inUse ? (
              <>
                <LinkButton
                  label="Add a spare"
                  icon="cube-outline"
                  onPress={() => navigation.navigate('ProductEdit', { restockFrom: product.id, spare: true })}
                />
                <LinkButton
                  label="Mark as finished…"
                  icon="checkmark-done-outline"
                  tone={colors.danger}
                  onPress={() => setSheet({ kind: 'finish' })}
                />
              </>
            ) : lifecycle === 'finished' ? (
              <>
                <LinkButton
                  label="Start a new one"
                  icon="refresh"
                  onPress={() => navigation.navigate('ProductEdit', { restockFrom: product.id })}
                />
                <LinkButton
                  label={busy ? 'Reopening…' : 'Reopen this one'}
                  icon="arrow-undo-outline"
                  onPress={() => void reopen()}
                  disabled={busy}
                />
              </>
            ) : null}
          </View>
        </FadeInView>
      </FormScroll>

      {sheet?.kind === 'use' ? (
        <UseSheet
          visible
          product={product}
          mode={sheet.mode}
          today={today}
          logged={loggedDays}
          onClose={() => setSheet(null)}
          onSubmit={(draft) => submitUse(sheet.mode, draft)}
          onDelete={(use) => void deleteUse(use)}
        />
      ) : null}

      <DaySheet
        visible={sheet?.kind === 'finish'}
        title={`Finished ${product.name}?`}
        subtitle={product.opened_on ? `Opened ${formatEventDate(product.opened_on)}` : undefined}
        question="When did it run out?"
        today={today}
        min={product.opened_on}
        detail={lastedLine}
        actions={finishActions}
        onClose={() => setSheet(null)}
      />

      <DaySheet
        visible={sheet?.kind === 'open'}
        title={`Open this ${product.name}?`}
        subtitle={sibling ? `Your open one was started ${formatEventDate(sibling.opened_on!)}` : undefined}
        question="When did you open it?"
        today={today}
        min={sibling?.opened_on ?? null}
        detail={(day) =>
          sibling ? `Your open ${product.name} will be marked finished ${onDay(day, today)}.` : null
        }
        actions={openActions}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

function LinkButton({
  label,
  icon,
  onPress,
  tone,
  disabled,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone ?? colors.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.linkText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl * 3,
  },
  card: { marginTop: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overline: { ...typography.overline },

  big: { ...typography.display, ...typography.numeric, fontSize: 30, marginTop: spacing.sm },
  chips: { marginTop: spacing.sm },
  bar: { marginTop: spacing.md },
  line: { ...typography.body, ...typography.numeric, marginTop: spacing.md },
  subtle: { ...typography.caption, ...typography.numeric, fontSize: 12, color: colors.textFaint, marginTop: 4 },
  subtleInline: { ...typography.caption, ...typography.numeric, fontSize: 12, color: colors.textFaint },
  estimate: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: 4 },
  conflict: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: spacing.sm },
  conflictText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  spareNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  spareText: { ...typography.caption, color: colors.textSecondary, flex: 1 },

  primary: { marginTop: spacing.md },

  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: 3,
  },
  dayColumn: { flex: 1, alignItems: 'center', gap: 5, minHeight: 64 },
  barTrack: {
    width: '100%',
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  // Since opening, nothing logged: an outline you can see as MISSING.
  barEmpty: { backgroundColor: 'transparent', borderColor: colors.textFaint },
  // Before opening there was nothing to log, so nothing is drawn.
  barBefore: { backgroundColor: 'transparent', borderColor: 'transparent' },
  barFill: { width: '100%', borderRadius: radius.sm },
  dayLabel: { ...typography.caption, fontSize: 10.5, color: colors.textFaint },
  dayLabelToday: { color: colors.text, fontWeight: '700' },
  hint: { ...typography.caption, fontSize: 11, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
  pressed: { opacity: 0.6 },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },

  sectionTitle: { ...typography.overline, marginTop: spacing.xl, marginBottom: spacing.sm },
  historyDay: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  historyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  historyDate: { ...typography.body, fontWeight: '600' },
  historyTotal: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  historyAmount: { ...typography.caption, ...typography.numeric, color: colors.textSecondary, minWidth: 64 },
  historyNote: { ...typography.caption, color: colors.textFaint, flex: 1 },

  lifespans: { ...typography.body, ...typography.numeric, color: colors.text, marginTop: spacing.sm },
  earlierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    marginTop: spacing.xs,
  },
  earlierDates: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  earlierMeta: { ...typography.caption, ...typography.numeric, color: colors.textMuted },

  lifeActions: { marginTop: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  linkText: { ...typography.caption, fontWeight: '600' },
}));
