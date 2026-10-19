/**
 * ProductDetailScreen - one product: how much is left, what you used, and
 * logging a use for any day.
 *
 * It exists to fix two things the list could not do. You could not see what
 * you had logged - the website had a history dialog, the phone had nothing -
 * and you could only ever log TODAY, so a forgotten yesterday was simply lost,
 * and a lost day makes the measured rate look slower than it is.
 *
 * THE FORTNIGHT STRIP is the fix for the second one. Fourteen days, empty ones
 * included, so the day you forgot is visible as a gap; tapping a day points
 * the log form at it. Spotting the gap and filling it is one motion.
 *
 * The list keeps its one-tap "Log use" for today. This screen is for
 * everything that isn't today, and for looking back.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, Text, View } from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  TextField,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, fromISODate, todayISO } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import { useLatestRun } from '../../../core/useLatestRun';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import {
  CATEGORY_LABEL,
  URGENCY_LABEL,
  formatDaysLeft,
  formatQuantity,
  groupByDay,
  project,
  recentDays,
  urgencyOf,
  type Product,
  type ProductUse,
  type Urgency,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductDetail'>;
type Route = RouteProp<RootStackParamList, 'ProductDetail'>;

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function ProductDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { productId } = useRoute<Route>().params;

  const [product, setProduct] = useState<Product | null>(null);
  const [uses, setUses] = useState<ProductUse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The log form.
  const [amount, setAmount] = useState('');
  const [usedOn, setUsedOn] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const [busy, setBusy] = useState(false);

  const { begin } = useLatestRun();

  /**
   * Seed the amount from the product once it arrives - its per-use amount, or
   * 1 when it was never measured - and again whenever per_use is edited. Done
   * during render rather than in an effect, so the field never paints empty
   * first and then fills in.
   */
  const defaultAmount = product ? String(product.per_use ?? 1) : '';
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  if (product && seededFrom !== defaultAmount) {
    setSeededFrom(defaultAmount);
    setAmount(defaultAmount);
  }

  const load = useCallback(
    async (isRefresh = false) => {
      const isCurrent = begin();
      if (isRefresh) setRefreshing(true);
      setError(null);
      try {
        const [p, u] = await Promise.all([api.getProduct(productId), api.listUses(productId)]);
        if (!isCurrent()) return;
        // Deleted from the edit screen on top of this one: nothing is left to
        // show, so go back to the list rather than sit on a blank screen.
        if (!p) {
          navigation.goBack();
          return;
        }
        setProduct(p);
        setUses(u);
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: product?.name ?? '',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('ProductEdit', { productId })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Edit this product"
        >
          <Ionicons name="create-outline" size={20} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, product?.name, productId, colors.text]);

  const today = todayISO();

  const projection = useMemo(
    () => (product ? project(product, uses, today) : null),
    [product, uses, today],
  );
  const urgency: Urgency | null = product && projection ? urgencyOf(product, projection) : null;
  const strip = useMemo(() => recentDays(uses, today, 14), [uses, today]);
  const history = useMemo(() => groupByDay(uses), [uses]);
  const stripMax = Math.max(1, ...strip.map((d) => d.total));

  const colorFor = (value: Urgency | null) =>
    value === 'critical'
      ? colors.danger
      : value === 'soon'
        ? colors.warning
        : value === 'ok'
          ? colors.success
          : colors.textMuted;

  const handleLog = async () => {
    if (!product) return;

    const quantity = Number(amount.trim());
    const validAmount = Number.isFinite(quantity) && quantity > 0;
    setAmountError(validAmount ? null : 'How much did you use?');

    // A use before the container was opened would inflate the measured rate,
    // because the days it counts start from the opening date.
    const beforeOpening = !!usedOn && usedOn < product.opened_on;
    setDateError(
      !usedOn
        ? 'Which day?'
        : beforeOpening
          ? `That's before you opened it (${formatEventDate(product.opened_on)}). Change the opened date in Edit first.`
          : null,
    );
    if (!validAmount || !usedOn || beforeOpening) return;

    setLogging(true);
    try {
      await api.logUse(product.id, quantity, usedOn, note.trim());
      // Back to today for the next one: backdating is the exception, and a
      // form left pointing at last Tuesday is how the NEXT use goes astray.
      setUsedOn(todayISO());
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log that');
    } finally {
      setLogging(false);
    }
  };

  const removeUse = (use: ProductUse) => {
    if (!product) return;
    Alert.alert(
      'Delete this entry?',
      `${formatQuantity(use.quantity, product.unit)} on ${formatEventDate(use.used_on)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUse(use.id);
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not delete that');
            }
          },
        },
      ],
    );
  };

  const toggleFinished = async () => {
    if (!product) return;
    setBusy(true);
    try {
      await api.setFinished(product.id, !product.finished_on);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update this product');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !product || !projection) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          {error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </Screen>
    );
  }

  const tone = colorFor(urgency);
  const finished = !!product.finished_on;

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
              {CATEGORY_LABEL[product.category] ?? 'Other'}
            </Text>
            <View style={styles.statusRow}>
              <Text style={[styles.big, { color: tone }]}>
                {finished ? 'Finished' : formatDaysLeft(projection.daysLeft)}
              </Text>
              {!finished && urgency ? (
                <View style={[styles.badge, { borderColor: tone + '66', backgroundColor: tone + '1A' }]}>
                  <Text style={[styles.badgeText, { color: tone }]}>{URGENCY_LABEL[urgency]}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.meter}>
              <View
                style={[styles.meterFill, { width: `${projection.percentUsed}%`, backgroundColor: tone }]}
              />
            </View>

            <Text style={styles.line}>
              {formatQuantity(projection.remaining, product.unit)} left of{' '}
              {formatQuantity(product.total_quantity, product.unit)} · {projection.percentUsed}% used
            </Text>

            <Text style={styles.subtle}>
              {projection.dailyRate !== null
                ? `${formatQuantity(Math.round(projection.dailyRate * 10) / 10, product.unit)} a day` +
                  (projection.costPerDay !== null ? ` · ${formatMoney(projection.costPerDay)} a day` : '')
                : 'Log a couple of days of use to see the rate'}
            </Text>

            {projection.emptyOn && !finished ? (
              <Text style={styles.subtle}>Runs out around {formatEventDate(projection.emptyOn)}</Text>
            ) : null}

            <Text style={styles.subtle}>
              Opened {formatEventDate(product.opened_on)}
              {finished ? ` · finished ${formatEventDate(product.finished_on!)}` : ''}
              {` · open ${projection.daysOpen} ${projection.daysOpen === 1 ? 'day' : 'days'}`}
            </Text>
          </GlassCard>

          {/* LAST FOURTEEN DAYS ------------------------------------------ */}
          <GlassCard style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.overline}>Last 14 days</Text>
              <Text style={styles.subtle}>
                {strip.filter((d) => d.count > 0).length} of 14 days logged
              </Text>
            </View>

            <View style={styles.strip}>
              {strip.map((day) => {
                const selected = day.date === usedOn;
                const isToday = day.date === today;
                const height = day.total === 0 ? 0 : 0.25 + 0.75 * (day.total / stripMax);
                const weekday = WEEKDAY[fromISODate(day.date).getDay()];

                return (
                  <Pressable
                    key={day.date}
                    // Pointing the form at a day is all a tap does. Logging
                    // straight from here would be one stray tap away from a
                    // wrong entry on a day you cannot see the date of.
                    onPress={() => {
                      if (!finished) {
                        setUsedOn(day.date);
                        setDateError(null);
                      }
                    }}
                    style={({ pressed }) => [styles.dayColumn, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${formatEventDate(day.date)}, ${
                      day.count === 0
                        ? 'nothing logged'
                        : `${formatQuantity(day.total, product.unit)} logged`
                    }`}
                    accessibilityHint={finished ? undefined : 'Sets the day to log a use for'}
                  >
                    <View style={[styles.barTrack, selected && { borderColor: colors.primary }]}>
                      {day.total > 0 ? (
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.round(height * 100)}%`, backgroundColor: colors.accentCyan },
                          ]}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.dayLabel,
                        isToday && styles.dayLabelToday,
                        selected && { color: colors.primary },
                      ]}
                    >
                      {weekday}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!finished ? (
              <Text style={styles.hint}>Tap an empty day to log a use you forgot</Text>
            ) : null}
          </GlassCard>

          {/* LOG A USE --------------------------------------------------- */}
          {finished ? (
            <GlassCard style={styles.card}>
              <Text style={styles.line}>This one is used up.</Text>
              <Text style={styles.subtle}>
                Reopen it below if you finished it by mistake, or add a new one from the list.
              </Text>
            </GlassCard>
          ) : (
            <GlassCard style={styles.card}>
              <Text style={styles.overline}>Log a use</Text>

              <TextField
                label={`Amount (${product.unit})`}
                value={amount}
                error={amountError}
                onChangeText={(text) => {
                  setAmount(text);
                  if (amountError) setAmountError(null);
                }}
                keyboardType="decimal-pad"
                style={styles.spaced}
              />

              <DateField
                label="Day"
                value={usedOn}
                onChange={(value) => {
                  setUsedOn(value);
                  setDateError(null);
                }}
                mode="event"
                allowClear={false}
                style={styles.spaced}
              />
              {dateError ? <Text style={styles.error}>{dateError}</Text> : null}

              <TextField
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                style={styles.spaced}
              />

              <Button
                label={usedOn && usedOn !== today ? `Log for ${formatEventDate(usedOn)}` : 'Log it'}
                icon="add"
                onPress={() => void handleLog()}
                loading={logging}
                style={styles.spaced}
              />
            </GlassCard>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* HISTORY ----------------------------------------------------- */}
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
                  <Text style={styles.historyTotal}>{formatQuantity(day.total, product.unit)}</Text>
                </View>

                {day.uses.map((entry) => (
                  <View key={entry.id} style={styles.historyRow}>
                    <Text style={styles.historyAmount}>{formatQuantity(entry.quantity, product.unit)}</Text>
                    <Text style={styles.historyNote} numberOfLines={1}>
                      {entry.note}
                    </Text>
                    <Pressable
                      onPress={() => removeUse(entry)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${formatQuantity(entry.quantity, product.unit)} on ${formatEventDate(entry.used_on)}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ))
          )}

          <Pressable
            onPress={() => void toggleFinished()}
            disabled={busy}
            style={({ pressed }) => [styles.finish, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Text style={[styles.finishText, finished && { color: colors.primary }]}>
                {finished ? 'Reopen this product' : 'Mark as finished'}
              </Text>
            )}
          </Pressable>
        </FadeInView>
      </FormScroll>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  card: { marginTop: spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overline: { ...typography.overline },
  spaced: { marginTop: spacing.lg },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  big: { ...typography.display, fontSize: 30 },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeText: { ...typography.caption, fontSize: 11.5, fontWeight: '600' },
  meter: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.glassBorder,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  meterFill: { height: '100%' },
  line: { ...typography.body, marginTop: spacing.md },
  subtle: { ...typography.caption, fontSize: 12, color: colors.textFaint, marginTop: 4 },

  strip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: 3,
  },
  dayColumn: { flex: 1, alignItems: 'center', gap: 5 },
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
  historyTotal: { ...typography.caption, color: colors.textSecondary },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  historyAmount: { ...typography.caption, color: colors.textSecondary, minWidth: 64 },
  historyNote: { ...typography.caption, color: colors.textFaint, flex: 1 },

  finish: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.md },
  finishText: { ...typography.caption, color: colors.danger },
}));
