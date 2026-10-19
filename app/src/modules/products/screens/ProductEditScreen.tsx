/**
 * ProductEditScreen - define a container: a new product, the next one of a
 * product you already use, a spare, or changes to one.
 *
 * The two fields that matter are the size and, optionally, how much a use
 * takes. Everything else is convenience. The form says which is which, because
 * "per use" looks like it drives the projection and does not - the projection
 * is measured from what you actually use, and per_use only pre-fills the
 * amount when you log one.
 *
 * "START A NEW ONE" opens this pre-filled from the container it replaces -
 * same name, size, unit, per use, period after opening and lead time, with
 * the last price ready to edit - and shows the estimate the new one will
 * start with. "ADD A SPARE" is the same, not opened yet.
 *
 * Expiry is typed as the pack prints it ("03/2027", day first for a full
 * date), and the use-by date it implies is shown as you type.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  TextField,
  useToast,
} from '../../../core/components';
import { formatEventDate, todayISO } from '../../../core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { estimateLabel, lifespanDays, priorEstimate, restockDraft } from '../containers';
import { ensurePermission } from '../notifications';
import { deleteSummary } from '../outlook';
import {
  CATEGORY_LABEL,
  DEFAULT_LEAD_DAYS,
  PRODUCT_CATEGORIES,
  UNITS,
  formatDayMonth,
  type Product,
  type ProductInput,
} from '../types';
import { formatExpiryInput, parseExpiry, usableUntil } from '../useBy';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductEdit'>;
type Route = RouteProp<RootStackParamList, 'ProductEdit'>;

/** The open-jar marks packs actually print. */
const PAO_OPTIONS = [3, 6, 12, 18, 24] as const;
/** Lead times worth a tap: a local shop, a week's delivery, two, three. */
const LEAD_OPTIONS = [3, 7, 14, 21] as const;

function resync() {
  api.resyncReminders().catch(() => {
    // Rebuilt again on the list's next load and the app's next launch.
  });
}

export function ProductEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const route = useRoute<Route>();

  const productId = route.params?.productId;
  const restockFrom = route.params?.restockFrom;
  const asSpare = !!route.params?.spare;
  const isEditing = !!productId;
  const today = todayISO();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [unit, setUnit] = useState('g');
  const [total, setTotal] = useState('');
  const [perUse, setPerUse] = useState('');
  const [price, setPrice] = useState('');
  const [unopened, setUnopened] = useState(asSpare);
  const [openedOn, setOpenedOn] = useState<string | null>(today);
  const [expiry, setExpiry] = useState('');
  const [pao, setPao] = useState<number | null>(null);
  const [lead, setLead] = useState<number | null>(null);
  const [note, setNote] = useState('');

  /** What this was loaded as: the row being edited, or the one it replaces. */
  const [original, setOriginal] = useState<Product | null>(null);
  const [from, setFrom] = useState<Product | null>(null);

  const [loading, setLoading] = useState(isEditing || !!restockFrom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [totalError, setTotalError] = useState<string | null>(null);
  const [expiryError, setExpiryError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing
        ? 'Edit product'
        : restockFrom
          ? asSpare
            ? 'Add a spare'
            : 'Start a new one'
          : 'New product',
    });
  }, [navigation, isEditing, restockFrom, asSpare]);

  useEffect(() => {
    const sourceId = productId ?? restockFrom;
    if (!sourceId) return;

    let active = true;
    (async () => {
      try {
        const product = await api.getProduct(sourceId);
        if (!active || !product) return;

        // Editing shows the row as it is; a restock shows the draft of the
        // next container, which keeps the product's facts and drops the tub's.
        const input: ProductInput = productId ? product : restockDraft(product, todayISO(), asSpare);
        if (productId) setOriginal(product);
        else setFrom(product);

        setName(input.name);
        setCategory(input.category);
        setUnit(input.unit);
        setTotal(String(input.total_quantity));
        setPerUse(input.per_use !== null ? String(input.per_use) : '');
        setPrice(input.price_minor !== null ? minorToAmountString(input.price_minor) : '');
        setUnopened(!input.opened_on);
        setOpenedOn(input.opened_on ?? todayISO());
        setExpiry(formatExpiryInput(input.expires_on));
        setPao(input.pao_months);
        setLead(input.reorder_lead_days);
        setNote(input.note);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load this product');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [productId, restockFrom, asSpare]);

  const parsedExpiry = useMemo(() => parseExpiry(expiry), [expiry]);
  const useBy = useMemo(
    () =>
      parsedExpiry.ok
        ? usableUntil({
            opened_on: unopened ? null : openedOn,
            finished_on: null,
            expires_on: parsedExpiry.value,
            pao_months: pao,
          })
        : null,
    [parsedExpiry, unopened, openedOn, pao],
  );

  /** The estimate the new container starts with, previewed while you fill it in. */
  const preview = useMemo(() => {
    const size = Number(total.trim());
    if (!from || unopened || !openedOn || !Number.isFinite(size) || size <= 0) return null;
    const draft: Product = {
      ...from,
      id: 'draft',
      previous_id: from.id,
      finished_on: null,
      total_quantity: size,
      unit,
      opened_on: openedOn,
    };
    return priorEstimate(draft, from, today);
  }, [from, unopened, openedOn, total, unit, today]);

  // An open container that already has uses cannot be turned back into a
  // spare here: its uses would lose the opening day their rate counts from.
  const canBeSpare = !isEditing || !original?.opened_on;

  const handleSave = async () => {
    const trimmed = name.trim();
    const totalValue = Number(total.trim().replace(',', '.'));

    setNameError(trimmed ? null : 'Give it a name');
    setTotalError(
      Number.isFinite(totalValue) && totalValue > 0 ? null : 'How much is in the container?',
    );
    setExpiryError(parsedExpiry.ok ? null : 'Write it as printed: 03/2027, or 15/03/2027');
    if (!trimmed || !Number.isFinite(totalValue) || totalValue <= 0 || !parsedExpiry.ok) return;

    setSaving(true);
    setError(null);

    const input: ProductInput = {
      name: trimmed,
      category,
      unit: unit.trim() || 'g',
      total_quantity: totalValue,
      // Blank means "never measured", which is different from zero and has to
      // reach the database as null.
      per_use: perUse.trim() ? Number(perUse.replace(',', '.')) : null,
      price_minor: price.trim() ? parseAmountToMinor(price) : null,
      opened_on: unopened ? null : (openedOn ?? todayISO()),
      note: note.trim(),
      expires_on: parsedExpiry.value,
      pao_months: pao,
      reorder_lead_days: lead,
    };

    let created: Product | null = null;
    try {
      if (productId) await api.updateProduct(productId, input);
      else created = await api.createProduct({ ...input, previous_id: from?.id ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this product');
      setSaving(false);
      return;
    }

    resync();

    // This is the moment a reorder reminder is set up, so it is the moment to
    // ask - never at launch. Only a refusal is worth a word: 'unsupported'
    // (Expo Go) is a development build's problem, not the person's.
    const permission = await ensurePermission();
    if (permission === 'denied') {
      toast.show({
        message: 'Reorder reminders are off for EIO in Android settings',
        actionLabel: 'Settings',
        onAction: () => void Linking.openSettings(),
        durationMs: 7000,
      });
    }

    // A new container replacing a finished one opens on its own page, so the
    // estimate it starts with is the first thing you see. Everything else
    // goes back to where it came from.
    if (created && restockFrom && !asSpare) {
      navigation.popTo('ProductsList');
      navigation.navigate('ProductDetail', { productId: created.id });
    } else {
      navigation.goBack();
    }
  };

  /**
   * Deleting takes every logged use with it (on delete cascade), so the
   * question says how many before it is asked - and offers what is usually
   * meant instead: marking it finished keeps the history and the lifespan
   * the next container is estimated from.
   */
  const handleDelete = async () => {
    if (!productId || !original) return;

    let count: number;
    try {
      count = await api.countUses(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check its history');
      return;
    }

    const remove = async () => {
      try {
        await api.deleteProduct(productId);
        resync();
        // Straight to the list. The product's detail screen sits under this
        // one, and going back to it would show a product that is gone.
        navigation.popTo('ProductsList');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not delete this product');
      }
    };

    const finishInstead = async () => {
      try {
        await api.setFinished(productId, todayISO());
        resync();
        navigation.goBack();
        toast.show({
          message: `${original.name} finished today`,
          actionLabel: 'Undo',
          onAction: () => {
            api
              .setFinished(productId, null)
              .then(resync)
              .catch(() => {
                // The detail screen shows it finished; Reopen is right there.
              });
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not finish it');
      }
    };

    const keepHistory =
      count > 0 ? ' To keep its history - and how long it lasted - mark it finished instead.' : '';

    Alert.alert(`Delete ${original.name}?`, `${deleteSummary(count)}${keepHistory} This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      ...(count > 0 && original.opened_on && !original.finished_on
        ? [{ text: 'Mark finished', onPress: () => void finishInstead() }]
        : []),
      { text: 'Delete', style: 'destructive' as const, onPress: () => void remove() },
    ]);
  };

  if (loading) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const lastLasted = from ? lifespanDays(from) : null;

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        <FadeInView>
          {from ? (
            <GlassCard style={styles.fromCard}>
              <Ionicons name={asSpare ? 'cube-outline' : 'refresh'} size={16} color={colors.info} />
              <Text style={styles.fromText}>
                {asSpare
                  ? `A spare ${from.name}, bought ahead. It waits unopened, and while it does there is nothing to reorder.`
                  : preview
                    ? `Starts with an estimate: ${estimateLabel(preview, unit)}.`
                    : lastLasted !== null
                      ? `The last one lasted ${lastLasted} days.`
                      : `Copied from your ${from.name}.`}
              </Text>
            </GlassCard>
          ) : null}

          <GlassCard>
            <TextField
              label="Name"
              value={name}
              error={nameError}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(null);
              }}
              placeholder="Whey protein, face wash, sunscreen…"
              maxLength={80}
            />

            <Text style={[styles.label, styles.spaced]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {PRODUCT_CATEGORIES.map((option) => (
                <Chip
                  key={option}
                  label={CATEGORY_LABEL[option]}
                  selected={option === category}
                  onPress={() => setCategory(option)}
                />
              ))}
            </ScrollView>
          </GlassCard>

          <GlassCard style={styles.card}>
            <TextField
              label="How much is in it"
              value={total}
              error={totalError}
              onChangeText={(text) => {
                setTotal(text);
                if (totalError) setTotalError(null);
              }}
              placeholder="1000"
              keyboardType="decimal-pad"
            />

            <Text style={[styles.label, styles.spaced]}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {UNITS.map((option) => (
                <Chip key={option} label={option} selected={option === unit} onPress={() => setUnit(option)} />
              ))}
            </ScrollView>

            <TextField
              label="Per use"
              value={perUse}
              onChangeText={setPerUse}
              placeholder="Optional"
              keyboardType="decimal-pad"
              style={styles.spaced}
            />
            <Text style={styles.hint}>
              Only pre-fills the amount when you log a use. How long it lasts is measured from what
              you actually use, not from this.
            </Text>
          </GlassCard>

          <GlassCard style={styles.card}>
            <TextField
              label="What it cost"
              value={price}
              onChangeText={setPrice}
              placeholder="Optional"
              keyboardType="decimal-pad"
            />
            <Text style={styles.hint}>
              {from && from.price_minor !== null
                ? `The last one cost ${formatMoney(from.price_minor)}. Change it if the price moved.`
                : 'Used to work out what it costs you a day.'}
            </Text>

            {canBeSpare ? (
              <Pressable
                onPress={() => setUnopened(!unopened)}
                style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: unopened }}
              >
                <Ionicons
                  name={unopened ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={unopened ? colors.primary : colors.textMuted}
                />
                <View style={styles.checkText}>
                  <Text style={styles.checkLabel}>Not opened yet</Text>
                  <Text style={styles.hintInline}>A spare: bought ahead, waiting on the shelf.</Text>
                </View>
              </Pressable>
            ) : null}

            {!unopened ? (
              <DateField
                label="Opened on"
                value={openedOn}
                onChange={setOpenedOn}
                // 'event': it was opened on a day that has happened.
                mode="event"
                allowClear={false}
                style={styles.spaced}
              />
            ) : null}
          </GlassCard>

          <GlassCard style={styles.card}>
            <TextField
              label="Expiry date"
              value={expiry}
              error={expiryError}
              onChangeText={(text) => {
                setExpiry(text);
                if (expiryError) setExpiryError(null);
              }}
              placeholder="As printed: 03/2027"
              keyboardType="numbers-and-punctuation"
              maxLength={12}
            />

            <Text style={[styles.label, styles.spaced]}>Use within, once opened</Text>
            <View style={styles.wrapRow}>
              <Chip label="Not printed" selected={pao === null} onPress={() => setPao(null)} />
              {PAO_OPTIONS.map((months) => (
                <Chip
                  key={months}
                  label={`${months}M`}
                  accessibilityLabel={`${months} months`}
                  selected={pao === months}
                  onPress={() => setPao(months)}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              {useBy
                ? `Use by ${formatDayMonth(useBy, today)}${
                    pao && parsedExpiry.ok && parsedExpiry.value
                      ? ' - the earlier of the printed date and the months after opening.'
                      : '.'
                  }`
                : pao && unopened
                  ? `${pao} months from the day you open it.`
                  : 'The open-jar mark on the pack, like 12M. Leave both empty if it does not matter.'}
            </Text>
          </GlassCard>

          <GlassCard style={styles.card}>
            <Text style={styles.label}>Remind me to reorder</Text>
            <View style={styles.wrapRow}>
              {LEAD_OPTIONS.map((days) => {
                const selected = (lead ?? DEFAULT_LEAD_DAYS) === days;
                return (
                  <Chip
                    key={days}
                    label={`${days} days before`}
                    selected={selected}
                    onPress={() => setLead(days === DEFAULT_LEAD_DAYS ? null : days)}
                  />
                );
              })}
            </View>
            <Text style={styles.hint}>
              About how long a new one takes to arrive. You get a notification that morning, and
              another on the day it is projected to run out.
            </Text>

            <TextField
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              style={styles.spaced}
            />
          </GlassCard>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={
              isEditing
                ? 'Save changes'
                : restockFrom
                  ? asSpare
                    ? 'Add the spare'
                    : 'Start it'
                  : 'Start tracking'
            }
            icon="checkmark"
            onPress={() => void handleSave()}
            loading={saving}
            style={styles.save}
          />

          {isEditing && original?.opened_on ? (
            <Text style={styles.openedNote}>
              Opened {formatEventDate(original.opened_on)}
              {original.finished_on ? ` · finished ${formatEventDate(original.finished_on)}` : ''}
            </Text>
          ) : null}

          {isEditing ? (
            <Pressable
              onPress={() => void handleDelete()}
              style={styles.deleteWrap}
              accessibilityRole="button"
            >
              <Text style={styles.delete}>Delete this product</Text>
            </Pressable>
          ) : null}
        </FadeInView>
      </FormScroll>
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  card: { marginTop: spacing.md },
  fromCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  fromText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  label: { ...typography.overline },
  spaced: { marginTop: spacing.lg },
  hint: { ...typography.caption, fontSize: 12, marginTop: spacing.sm },
  hintInline: { ...typography.caption, fontSize: 12 },

  chipRow: { gap: spacing.sm, paddingTop: spacing.sm },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipActive: {
    backgroundColor: colors.accentCyan + '26',
    borderColor: colors.accentCyan + '59',
  },
  chipText: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
  chipTextActive: { color: colors.accentCyan, fontWeight: '600' },
  pressed: { opacity: 0.7 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    marginTop: spacing.md,
  },
  checkText: { flex: 1 },
  checkLabel: { ...typography.body, color: colors.text },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg },
  save: { marginTop: spacing.xl },
  openedNote: { ...typography.caption, fontSize: 12, color: colors.textFaint, textAlign: 'center', marginTop: spacing.md },
  deleteWrap: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: spacing.md },
  delete: { ...typography.caption, color: colors.danger },
}));
