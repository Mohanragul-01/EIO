/**
 * SubscriptionEditScreen - add or change a subscription.
 *
 * Opened from the catalogue it arrives filled in - name, colour, category,
 * usual cycle, currency, the manage link - and only the price is left, with
 * the keyboard on it. As you type, the cost reads back per month and per
 * year: a ₹4,788 yearly plan means little until it says ₹399 a month.
 *
 * What the form holds is one object, so "have you changed anything" is one
 * comparison, and leaving with unsaved changes asks first (Back, the arrow
 * and the gesture all pass through beforeRemove).
 *
 * Lifecycle (pause, cancel, archive) is not edited here: those are actions
 * with an Undo, on the subscription and its long-press menu. Only a trial is
 * set here, because it is part of what you are adding.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import { DEFAULT_SUBSCRIPTION_CATEGORY, EXPENSE_CATEGORIES } from '../../../core/categories';
import {
  Button,
  CategoryPicker,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { addDaysISO, todayISO } from '../../../core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { readableOn, tileColor, TILE_COLOURS } from '../brand';
import { findService, type Service } from '../catalogue';
import { BrandTile } from '../components/BrandTile';
import { Chip } from '../components/Chip';
import { OffsetChips } from '../components/OffsetChips';
import { cycleLabel, cycleOf, perMonthMinor, perYearMinor } from '../cycles';
import { CURRENCIES, currencyDef, formatRate, toInrMinor } from '../currency';
import { offsetsLabel, timeLabel } from '../format';
import { ensurePermission } from '../notifications';
import { DEFAULT_REMINDER_SETTINGS, effectiveOffsets } from '../reminders';
import {
  CHANNEL_LABEL,
  CHARGE_CHANNELS,
  type Account,
  type CycleUnit,
  type ReminderSettings,
  type Subscription,
  type SubscriptionInput,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionEdit'>;
type Route = RouteProp<RootStackParamList, 'SubscriptionEdit'>;

type ReminderMode = 'default' | 'custom' | 'off';
const REMINDER_MODES: ReminderMode[] = ['default', 'custom', 'off'];
const REMINDER_MODE_LABEL: Record<ReminderMode, string> = {
  default: 'My defaults',
  custom: 'Its own',
  off: 'Off',
};

type RepeatUnit = Exclude<CycleUnit, 'once'>;
const REPEAT_UNITS: RepeatUnit[] = ['day', 'week', 'month', 'year'];
const REPEAT_LABEL: Record<RepeatUnit, string> = {
  day: 'Days',
  week: 'Weeks',
  month: 'Months',
  year: 'Years',
};

/** One-tap cycles, the Indian prepaid packs among them. */
const PRESETS: { label: string; unit: CycleUnit; count: number }[] = [
  { label: 'Monthly', unit: 'month', count: 1 },
  { label: 'Yearly', unit: 'year', count: 1 },
  { label: 'Quarterly', unit: 'month', count: 3 },
  { label: 'Weekly', unit: 'week', count: 1 },
  { label: '28 days', unit: 'day', count: 28 },
  { label: '84 days', unit: 'day', count: 84 },
  { label: 'One-time', unit: 'once', count: 1 },
];

type Form = {
  name: string;
  amountText: string;
  currency: string;
  rateText: string;
  isTrial: boolean;
  trialEnds: string | null;
  unit: CycleUnit;
  countText: string;
  nextDue: string | null;
  category: string;
  accountId: string | null;
  channel: string | null;
  reminderMode: ReminderMode;
  customOffsets: number[];
  cancelUrl: string;
  cancelNotes: string;
  color: string | null;
  serviceKey: string | null;
  note: string;
};

function emptyForm(): Form {
  return {
    name: '',
    amountText: '',
    currency: 'INR',
    rateText: '',
    isTrial: false,
    trialEnds: addDaysISO(7),
    unit: 'month',
    countText: '1',
    // A month out: most people add a subscription just after paying it.
    nextDue: addDaysISO(30),
    category: DEFAULT_SUBSCRIPTION_CATEGORY,
    accountId: null,
    channel: null,
    reminderMode: 'default',
    customOffsets: DEFAULT_REMINDER_SETTINGS.offsets,
    cancelUrl: '',
    cancelNotes: '',
    color: null,
    serviceKey: null,
    note: '',
  };
}

function formFromService(service: Service): Form {
  return {
    ...emptyForm(),
    name: service.name,
    currency: service.currency ?? 'INR',
    unit: service.cycle.unit,
    countText: String(service.cycle.count),
    category: service.category,
    cancelUrl: service.manageUrl,
    color: service.color,
    serviceKey: service.key,
  };
}

function formFromSubscription(sub: Subscription): Form {
  const cycle = cycleOf(sub);
  return {
    name: sub.name,
    amountText: minorToAmountString(sub.amount_minor).replace(/\.00$/, ''),
    currency: sub.currency,
    rateText: sub.fx_rate ? String(sub.fx_rate) : '',
    isTrial: sub.status === 'trial',
    trialEnds: sub.trial_ends_on ?? sub.next_due_date,
    unit: cycle.unit,
    countText: String(cycle.count),
    nextDue: sub.next_due_date,
    category: sub.category || DEFAULT_SUBSCRIPTION_CATEGORY,
    accountId: sub.account_id,
    channel: sub.charge_channel,
    reminderMode:
      sub.reminder_offsets === null ? 'default' : sub.reminder_offsets.length === 0 ? 'off' : 'custom',
    customOffsets: (sub.reminder_offsets ?? DEFAULT_REMINDER_SETTINGS.offsets).filter((n) => n > 0),
    cancelUrl: sub.cancel_url ?? '',
    cancelNotes: sub.cancel_notes,
    color: sub.color,
    serviceKey: sub.service_key,
    note: sub.note,
  };
}

/** "4 decimals at most, above zero", or null. */
function parseRate(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,4})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return value > 0 ? value : null;
}

export function SubscriptionEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const presetKey = route.params?.serviceKey;
  const isEditing = !!editingId;

  const [form, setForm] = useState<Form>(() => {
    const service = presetKey ? findService(presetKey) : undefined;
    return service ? formFromService(service) : emptyForm();
  });
  /** What the form held when it opened, for "discard changes?". */
  const [baseline, setBaseline] = useState(() => JSON.stringify(form));
  const [original, setOriginal] = useState<Subscription | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER_SETTINGS);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'amount' | 'count' | 'rate' | 'url', string>>>({});
  const [loading, setLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [customCycle, setCustomCycle] = useState(false);
  const justSaved = useRef(false);

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }));

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit subscription' : 'New subscription' });
  }, [navigation, isEditing]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Accounts and reminder defaults decorate the form; neither failing
      // should stop you adding a subscription.
      const [accountRows, saved] = await Promise.all([
        api.listAccounts().catch(() => [] as Account[]),
        api.getReminderSettings().catch(() => DEFAULT_REMINDER_SETTINGS),
      ]);
      if (!active) return;
      setAccounts(accountRows);
      setSettings(saved);

      if (!editingId) return;
      try {
        const sub = await api.getSubscription(editingId);
        if (!active) return;
        const loaded = formFromSubscription(sub);
        setOriginal(sub);
        setForm(loaded);
        setBaseline(JSON.stringify(loaded));
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this subscription');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editingId]);

  // Leaving with unsaved changes asks first: the back arrow, the hardware
  // back button and the gesture all arrive here.
  const dirty = JSON.stringify(form) !== baseline;
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!dirty || justSaved.current) return;
      event.preventDefault();
      Alert.alert('Discard changes?', 'What you typed here will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(event.data.action),
        },
      ]);
    });
    return unsubscribe;
  }, [navigation, dirty]);

  const count = Number(form.countText);
  const countValid = form.unit === 'once' || (Number.isInteger(count) && count >= 1 && count <= 366);
  const cycle = { unit: form.unit, count: form.unit === 'once' ? 1 : countValid ? count : 1 };
  const amountMinor = parseAmountToMinor(form.amountText);
  const rate = form.currency === 'INR' ? null : parseRate(form.rateText);
  const inrMinor = amountMinor ? toInrMinor(amountMinor, form.currency, rate) : null;
  const presetIndex = PRESETS.findIndex((p) => p.unit === cycle.unit && p.count === cycle.count);
  const showCustom = customCycle || (presetIndex < 0 && form.unit !== 'once');
  const symbol = currencyDef(form.currency).symbol;

  // Two multiplications: cheaper to redo each render than to memoise.
  const preview =
    inrMinor && inrMinor > 0 && form.unit !== 'once'
      ? { month: perMonthMinor(inrMinor, cycle), year: perYearMinor(inrMinor, cycle) }
      : null;

  const swatches = useMemo(() => {
    const service = form.serviceKey ? findService(form.serviceKey) : undefined;
    // The brand's own colour first, then whatever it has now, then the rest.
    return [
      ...new Set([
        ...(service ? [service.color] : []),
        ...(form.color ? [form.color.toUpperCase()] : []),
        ...TILE_COLOURS,
      ]),
    ];
  }, [form.serviceKey, form.color]);
  const currentColour = tileColor({ color: form.color, service_key: form.serviceKey, name: form.name || '?' });

  const save = async () => {
    const name = form.name.trim();
    let url = form.cancelUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

    const next: typeof errors = {};
    if (!name) next.name = 'Give it a name';
    if (amountMinor === null || amountMinor <= 0) next.amount = 'Enter an amount like 199 or 499.50';
    if (!countValid) next.count = 'A whole number from 1 to 366';
    if (form.currency !== 'INR' && form.rateText.trim() && rate === null) next.rate = 'A rate like 86.50';
    if (url && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) next.url = 'That does not look like a link';
    setErrors(next);
    if (Object.keys(next).length > 0 || amountMinor === null) return;

    const today = todayISO();
    const rateChanged = rate !== (original?.fx_rate ?? null);
    const status = form.isTrial
      ? 'trial'
      : original && original.status !== 'trial'
        ? original.status
        : 'active';

    const input: SubscriptionInput = {
      name,
      amount_minor: amountMinor,
      next_due_date: (form.isTrial ? form.trialEnds : form.nextDue) ?? addDaysISO(30),
      category: form.category,
      note: form.note.trim(),
      status,
      trial_ends_on: form.isTrial ? form.trialEnds : (original?.trial_ends_on ?? null),
      ends_on: original?.ends_on ?? null,
      resume_on: original?.resume_on ?? null,
      cancel_url: url || null,
      cancel_notes: form.cancelNotes.trim(),
      service_key: form.serviceKey,
      color: form.color,
      account_id: form.accountId,
      charge_channel: form.channel,
      reminder_offsets:
        form.reminderMode === 'default' ? null : form.reminderMode === 'off' ? [] : form.customOffsets,
      cycle_unit: cycle.unit,
      cycle_count: cycle.count,
      currency: form.currency,
      fx_rate: rate,
      fx_rate_on: rate === null ? null : rateChanged ? today : (original?.fx_rate_on ?? today),
    };

    setSaving(true);
    try {
      if (editingId && original) {
        await api.updateSubscription(editingId, input, original);
      } else {
        await api.createSubscription(input);
        // Adding a subscription is turning its reminders on: the moment to
        // ask, not at launch. Whatever the answer, it has saved.
        if (form.reminderMode !== 'off') void ensurePermission().catch(() => {});
      }
      justSaved.current = true;
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.loadError}>{loadError}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  const choices = accounts.filter((a) => a.is_active || a.id === form.accountId);
  const defaultsText = `${offsetsLabel(effectiveOffsets({ reminder_offsets: null }, settings))}, at ${timeLabel(settings.minutes)}`;

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        {/* WHAT AND HOW MUCH ------------------------------------------- */}
        <FadeInView>
          <GlassCard>
            <View style={styles.identity}>
              <BrandTile
                sub={{ name: form.name || '?', color: form.color, service_key: form.serviceKey }}
                size={48}
              />
              <View style={styles.flex}>
                <TextField
                  label="Name"
                  value={form.name}
                  onChangeText={(name) => update({ name })}
                  placeholder="Netflix, Jio, the gym…"
                  error={errors.name}
                  maxLength={100}
                />
              </View>
            </View>

            <Text style={[styles.label, styles.field]}>
              {form.isTrial ? 'Then costs' : 'Amount'} ({symbol})
            </Text>
            <View style={styles.amountRow}>
              <Text style={styles.currency}>{symbol}</Text>
              <TextInput
                value={form.amountText}
                onChangeText={(amountText) => update({ amountText })}
                placeholder="0"
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.amountInput}
                autoFocus={!isEditing}
                maxLength={12}
                accessibilityLabel={`Amount in ${currencyDef(form.currency).name}`}
              />
            </View>
            {errors.amount ? (
              <Text style={styles.error}>{errors.amount}</Text>
            ) : preview ? (
              <Text style={styles.preview}>
                ≈ {formatMoney(preview.month, { compact: true })} a month ·{' '}
                {formatMoney(preview.year, { compact: true })} a year
              </Text>
            ) : null}

            <Text style={[styles.label, styles.field]}>Currency</Text>
            <View style={styles.chips}>
              {CURRENCIES.map((c) => (
                <Chip
                  key={c.code}
                  label={c.code}
                  accessibilityLabel={c.name}
                  selected={form.currency === c.code}
                  onPress={() => update({ currency: c.code })}
                />
              ))}
            </View>
            {form.currency !== 'INR' ? (
              <View style={styles.field}>
                <TextField
                  label={`Rate: rupees per 1 ${form.currency}`}
                  value={form.rateText}
                  onChangeText={(rateText) => update({ rateText })}
                  keyboardType="decimal-pad"
                  placeholder="86.50"
                  error={errors.rate}
                  maxLength={12}
                />
                <Text style={styles.hint}>
                  {rate && amountMinor && inrMinor !== null
                    ? `${formatRate(rate, form.currency)}: each charge is about ${formatMoney(inrMinor)}. Mark paid can update it from what the bank actually took.`
                    : 'Set by hand. Without a rate it is left out of your totals.'}
                </Text>
              </View>
            ) : null}
          </GlassCard>
        </FadeInView>

        {/* WHEN ------------------------------------------------------------ */}
        <FadeInView delay={60}>
          <GlassCard style={styles.card}>
            {!isEditing || original?.status === 'trial' ? (
              <Pressable
                onPress={() => update({ isTrial: !form.isTrial })}
                style={styles.toggle}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: form.isTrial }}
                accessibilityLabel="This is a free trial"
              >
                <Ionicons
                  name={form.isTrial ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={form.isTrial ? colors.primary : colors.textMuted}
                />
                <View style={styles.flex}>
                  <Text style={styles.toggleTitle}>This is a free trial</Text>
                  <Text style={styles.hint}>
                    Not in your totals until you keep it. Reminders 3 days and 1 day before it ends,
                    and that morning.
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {form.isTrial ? (
              <DateField
                label="Trial ends on"
                value={form.trialEnds}
                onChange={(trialEnds) => update({ trialEnds })}
                allowClear={false}
                style={styles.field}
              />
            ) : null}

            <Text style={[styles.label, styles.field]}>Billed</Text>
            <View style={styles.chips}>
              {PRESETS.map((preset, index) => (
                <Chip
                  key={preset.label}
                  label={preset.label}
                  selected={!showCustom && presetIndex === index}
                  onPress={() => {
                    setCustomCycle(false);
                    update({ unit: preset.unit, countText: String(preset.count) });
                  }}
                />
              ))}
              <Chip
                label="Every…"
                accessibilityLabel="Custom cycle"
                selected={showCustom}
                onPress={() => {
                  setCustomCycle(true);
                  if (form.unit === 'once') update({ unit: 'day', countText: '28' });
                }}
              />
            </View>

            {showCustom ? (
              <View style={styles.custom}>
                <View style={styles.countRow}>
                  <Text style={styles.every}>Every</Text>
                  <TextInput
                    value={form.countText}
                    onChangeText={(countText) => update({ countText: countText.replace(/\D/g, '') })}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={styles.countInput}
                    selectionColor={colors.primary}
                    accessibilityLabel="How many"
                  />
                </View>
                <SegmentedControl
                  options={REPEAT_UNITS}
                  value={form.unit === 'once' ? 'day' : form.unit}
                  onChange={(unit) => update({ unit })}
                  renderLabel={(u) => REPEAT_LABEL[u]}
                  style={styles.fieldSmall}
                />
                {errors.count ? <Text style={styles.error}>{errors.count}</Text> : null}
              </View>
            ) : null}
            <Text style={styles.hint}>{cycleLabel(cycle)}</Text>

            {!form.isTrial ? (
              <DateField
                label={form.unit === 'once' ? 'Due on' : 'Next due'}
                value={form.nextDue}
                onChange={(nextDue) => update({ nextDue })}
                allowClear={false}
                style={styles.field}
              />
            ) : null}
          </GlassCard>
        </FadeInView>

        {/* WHERE IT GOES -------------------------------------------------- */}
        <FadeInView delay={120}>
          <GlassCard style={styles.card}>
            {/* Expense categories only: this is what the payment is filed
                under in Finance when you mark it paid. */}
            <CategoryPicker
              label="Logs to Finance as"
              options={EXPENSE_CATEGORIES}
              value={form.category}
              onChange={(category) => update({ category })}
            />

            <Text style={[styles.label, styles.field]}>Charged to</Text>
            {choices.length === 0 ? (
              <Text style={styles.hint}>
                No Finance accounts yet. Add them in Finance and pick one here, so a payment comes
                off the right balance.
              </Text>
            ) : (
              <View style={styles.chips}>
                <Chip label="None" selected={form.accountId === null} onPress={() => update({ accountId: null })} />
                {choices.map((account) => (
                  <Chip
                    key={account.id}
                    label={account.name}
                    icon={account.type === 'credit_card' ? 'card-outline' : 'wallet-outline'}
                    selected={form.accountId === account.id}
                    onPress={() => update({ accountId: account.id })}
                  />
                ))}
              </View>
            )}

            <Text style={[styles.label, styles.field]}>Billed through</Text>
            <View style={styles.chips}>
              {CHARGE_CHANNELS.map((channel) => (
                <Chip
                  key={channel}
                  label={CHANNEL_LABEL[channel]}
                  selected={form.channel === channel}
                  onPress={() => update({ channel: form.channel === channel ? null : channel })}
                />
              ))}
            </View>
          </GlassCard>
        </FadeInView>

        {/* REMINDERS ------------------------------------------------------ */}
        <FadeInView delay={160}>
          <GlassCard style={styles.card}>
            <SegmentedControl
              label="Reminders"
              options={REMINDER_MODES}
              value={form.reminderMode}
              onChange={(reminderMode) => update({ reminderMode })}
              renderLabel={(m) => REMINDER_MODE_LABEL[m]}
            />
            {form.reminderMode === 'default' ? (
              <Text style={styles.hint}>{defaultsText}. Change the defaults from the bell on the list.</Text>
            ) : form.reminderMode === 'off' ? (
              <Text style={styles.hint}>No reminders for this one, trial or renewal.</Text>
            ) : (
              <View style={styles.fieldSmall}>
                <OffsetChips
                  value={form.customOffsets}
                  onChange={(customOffsets) => update({ customOffsets })}
                />
                <Text style={styles.hint}>At {timeLabel(settings.minutes)}, like the rest.</Text>
              </View>
            )}
          </GlassCard>
        </FadeInView>

        {/* HOW TO CANCEL, AND THE REST -------------------------------------- */}
        <FadeInView delay={200}>
          <GlassCard style={styles.card}>
            <TextField
              label="Manage or cancel at"
              value={form.cancelUrl}
              onChangeText={(cancelUrl) => update({ cancelUrl })}
              placeholder="https://…"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              error={errors.url}
              maxLength={300}
            />
            <TextField
              label="How to cancel"
              value={form.cancelNotes}
              onChangeText={(cancelNotes) => update({ cancelNotes })}
              placeholder="e.g. cancel in the Play Store, not the app"
              multiline
              maxLength={500}
              style={styles.field}
            />

            <Text style={[styles.label, styles.field]}>Colour</Text>
            <View style={styles.swatches}>
              {swatches.map((colour, index) => {
                const selected = colour === currentColour;
                return (
                  <Pressable
                    key={colour}
                    onPress={() => update({ color: colour })}
                    hitSlop={4}
                    style={[styles.swatch, { backgroundColor: colour }, selected && styles.swatchSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`Colour ${index + 1} of ${swatches.length}${index === 0 && form.serviceKey ? ', the brand colour' : ''}`}
                  >
                    {selected ? <Ionicons name="checkmark" size={18} color={readableOn(colour)} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <TextField
              label="Note"
              value={form.note}
              onChangeText={(note) => update({ note })}
              placeholder="Plan, who shares it, anything useful"
              maxLength={200}
              style={styles.field}
            />
          </GlassCard>
        </FadeInView>

        <Button
          label={isEditing ? 'Save changes' : 'Add subscription'}
          icon="checkmark"
          onPress={() => void save()}
          loading={saving}
          style={styles.save}
        />
      </FormScroll>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  card: {
    marginTop: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  field: {
    marginTop: spacing.xl,
  },
  fieldSmall: {
    marginTop: spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currency: {
    fontFamily: fonts.semibold,
    fontSize: 28,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -1,
    color: colors.text,
    padding: 0,
    minHeight: 48,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  preview: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 48,
  },
  toggleTitle: {
    ...typography.title,
    fontSize: 14,
  },
  custom: {
    marginTop: spacing.md,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  every: {
    ...typography.body,
    color: colors.text,
  },
  countInput: {
    ...typography.title,
    ...typography.numeric,
    minWidth: 72,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    textAlign: 'center',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  save: {
    marginTop: spacing.xxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loadError: {
    ...typography.body,
    textAlign: 'center',
  },
}));
