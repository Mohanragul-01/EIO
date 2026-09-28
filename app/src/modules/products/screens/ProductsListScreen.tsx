/**
 * ProductsListScreen - what you use daily, and what needs reordering.
 *
 * Sorted by urgency rather than by name, because the only reason to open this
 * is to find out what is about to run out. Alphabetical order treats "three
 * days left" and "four months left" as equally interesting.
 *
 * The primary action on every row is "log a use", which is the thing you do
 * every day - so it is a button on the row rather than something behind a tap
 * into a detail screen.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';

import { Button, EmptyState, FadeInView, FormScroll, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, todayISO } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import {
  CATEGORY_LABEL,
  URGENCY_LABEL,
  formatDaysLeft,
  formatQuantity,
  project,
  urgencyOf,
  type Product,
  type ProductUse,
  type Urgency,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductsList'>;

/** What needs acting on, first. */
const RANK: Record<Urgency, number> = {
  critical: 0,
  soon: 1,
  unknown: 2,
  ok: 3,
  finished: 4,
};

export function ProductsListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [products, setProducts] = useState<Product[]>([]);
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      const [p, u] = await Promise.all([api.listProducts(), api.listAllUses()]);
      setProducts(p);
      setUses(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const today = todayISO();

  const rows = useMemo(() => {
    const byProduct = new Map<string, ProductUse[]>();
    uses.forEach((use) => {
      (byProduct.get(use.product_id) ?? byProduct.set(use.product_id, []).get(use.product_id)!).push(
        use,
      );
    });

    return products
      .map((product) => {
        const projection = project(product, byProduct.get(product.id) ?? [], today);
        return { product, projection, urgency: urgencyOf(product, projection) };
      })
      .sort(
        (a, b) =>
          RANK[a.urgency] - RANK[b.urgency] ||
          (a.projection.daysLeft ?? 9999) - (b.projection.daysLeft ?? 9999) ||
          a.product.name.localeCompare(b.product.name),
      );
  }, [products, uses, today]);

  const needsReorder = rows.filter(
    (r) => !r.product.finished_on && (r.urgency === 'critical' || r.urgency === 'soon'),
  ).length;

  const colorFor = (urgency: Urgency) =>
    urgency === 'critical'
      ? colors.danger
      : urgency === 'soon'
        ? colors.warning
        : urgency === 'ok'
          ? colors.success
          : colors.textMuted;

  /**
   * Mark a container as used up.
   *
   * Errors surface rather than being dropped: the old version fired the write
   * and reloaded off the back of it with no catch, so a failed write looked
   * exactly like a successful one until the next refresh contradicted it.
   */
  const markFinished = useCallback(
    async (product: Product) => {
      setBusyId(product.id);
      setError(null);
      try {
        await api.setFinished(product.id, true);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : `Could not finish ${product.name}`);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const logUse = useCallback(
    async (product: Product) => {
      setBusyId(product.id);
      try {
        // Falls back to 1 when the amount was never measured: recording THAT
        // you used it is what the rate is built from.
        await api.logUse(product.id, product.per_use ?? 1);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not log that');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (loading) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

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
        {rows.length === 0 ? (
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
                <Text style={styles.summaryBig}>
                  {needsReorder > 0 ? needsReorder : 'All'}
                </Text>
                <Text style={styles.summaryLabel}>
                  {needsReorder > 0
                    ? `to reorder within three weeks`
                    : 'stocked up for now'}
                </Text>
                {/*
                  Marking something finished used to live only on a long press
                  of Log use, with nothing on screen to suggest it existed. A
                  gesture nobody can see is a feature nobody has.
                */}
                <Text style={styles.summaryHint}>
                  Tap a card to edit · hold Log use when one runs out
                </Text>
              </GlassCard>
            </FadeInView>

            {rows.map(({ product, projection, urgency }, index) => (
              <FadeInView key={product.id} delay={Math.min(index, 6) * 40}>
                <GlassCard
                  style={styles.card}
                  onPress={() =>
                    navigation.navigate('ProductEdit', { productId: product.id })
                  }
                >
                  <View style={styles.cardHead}>
                    <View style={[styles.dot, { backgroundColor: colorFor(urgency) }]} />
                    {/* Truncated: the days-left label to its right is the
                        thing you scan for, and a long product name would push
                        it out of line. */}
                    <Text style={styles.name} numberOfLines={1}>
                      {product.name}
                    </Text>
                    <Text style={[styles.days, { color: colorFor(urgency) }]}>
                      {product.finished_on
                        ? URGENCY_LABEL.finished
                        : formatDaysLeft(projection.daysLeft)}
                    </Text>
                  </View>

                  <Text style={styles.sub}>
                    {formatQuantity(projection.remaining, product.unit)} left of{' '}
                    {formatQuantity(product.total_quantity, product.unit)}
                    {' · '}
                    {CATEGORY_LABEL[product.category] ?? 'Other'}
                  </Text>

                  <View style={styles.meter}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          width: `${projection.percentUsed}%`,
                          backgroundColor: colorFor(urgency),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.cardFoot}>
                    <Text style={styles.rate}>
                      {projection.dailyRate !== null
                        ? `${formatQuantity(
                            Math.round(projection.dailyRate * 10) / 10,
                            product.unit,
                          )} a day${
                            projection.costPerDay !== null
                              ? ` · ${formatMoney(projection.costPerDay)}/day`
                              : ''
                          }`
                        : product.finished_on
                          ? `Lasted ${projection.daysOpen} days`
                          : 'Log a few uses to see the rate'}
                    </Text>

                    {!product.finished_on ? (
                      <Pressable
                        onPress={() => void logUse(product)}
                        onLongPress={() =>
                          Alert.alert('Finished?', `Mark ${product.name} as used up?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Finished',
                              onPress: () => void markFinished(product),
                            },
                          ])
                        }
                        disabled={busyId === product.id}
                        style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
                        accessibilityRole="button"
                        accessibilityLabel={`Log a use of ${product.name}`}
                        accessibilityHint="Long press to mark it finished"
                      >
                        {busyId === product.id ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="add" size={14} color={colors.primary} />
                            <Text style={styles.logText}>Log use</Text>
                          </>
                        )}
                      </Pressable>
                    ) : (
                      <Text style={styles.finishedOn}>
                        {formatEventDate(product.finished_on)}
                      </Text>
                    )}
                  </View>
                </GlassCard>
              </FadeInView>
            ))}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </FormScroll>

      {rows.length > 0 ? (
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
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    paddingBottom: 110,
  },

  summary: { marginBottom: spacing.lg, alignItems: 'flex-start' },
  summaryBig: { ...typography.display, fontSize: 32 },
  summaryLabel: { ...typography.caption },
  summaryHint: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.md,
  },

  card: { marginBottom: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  name: { ...typography.title, fontSize: 15, flex: 1 },
  days: { ...typography.caption, fontWeight: '600' },
  sub: { ...typography.caption, fontSize: 12, marginTop: 4 },

  meter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  meterFill: { height: '100%' },

  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  rate: { ...typography.caption, fontSize: 11.5, color: colors.textFaint, flex: 1 },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '1A',
  },
  logText: { ...typography.caption, color: colors.primary },
  finishedOn: { ...typography.caption, fontSize: 11.5, color: colors.textFaint },
  pressed: { opacity: 0.6 },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },

  fabWrap: { position: 'absolute', right: spacing.xl, bottom: spacing.xxl },
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
  fabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
}));
