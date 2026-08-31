/**
 * SubscriptionEditScreen - add or edit a recurring bill.
 *
 * The one bit of extra thought here: as you type an amount and pick a cycle,
 * a live "~ ₹X / month" line appears. A yearly ₹4,788 plan doesn't mean much
 * on its own; ₹399/month does. Showing the derived figure while you're still
 * entering it is more useful than making you find it on the list afterwards.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DEFAULT_SUBSCRIPTION_CATEGORY, EXPENSE_CATEGORIES } from '../../../core/categories';
import {
  Button,
  CategoryPicker,
  DateField,
  FadeInView,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../core/components';
import { addDaysISO } from '../../../core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { BILLING_CYCLES, CYCLE_LABEL, toMonthlyMinor, type BillingCycle } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SubscriptionEdit'>;
type Route = RouteProp<RootStackParamList, 'SubscriptionEdit'>;

export function SubscriptionEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  // Default a month out - most people add a subscription just after paying it.
  const [nextDue, setNextDue] = useState<string | null>(addDaysISO(30));
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState(DEFAULT_SUBSCRIPTION_CATEGORY);
  const [note, setNote] = useState('');

  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit subscription' : 'New subscription' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const sub = await api.getSubscription(editingId);
        if (!active) return;
        setName(sub.name);
        setAmountText(minorToAmountString(sub.amount_minor));
        setCycle(sub.billing_cycle);
        setNextDue(sub.next_due_date);
        setIsActive(sub.is_active);
        setCategory(sub.category || DEFAULT_SUBSCRIPTION_CATEGORY);
        setNote(sub.note);
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

  /** Live monthly equivalent, recomputed as the amount or cycle changes. */
  const monthlyPreview = useMemo(() => {
    const minor = parseAmountToMinor(amountText);
    if (minor === null || minor <= 0) return null;
    // Nothing to show for a monthly plan - it would just repeat the input.
    if (cycle === 'monthly') return null;
    return toMonthlyMinor(minor, cycle);
  }, [amountText, cycle]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const amountMinor = parseAmountToMinor(amountText);

    // Validate everything BEFORE returning, so the user sees all the problems
    // at once rather than fixing one and discovering another.
    let valid = true;
    if (!trimmedName) {
      setNameError('Give it a name');
      valid = false;
    }
    if (amountMinor === null || amountMinor <= 0) {
      setAmountError('Enter an amount like 199 or 499.50');
      valid = false;
    }
    if (!valid || amountMinor === null) return;

    setNameError(null);
    setAmountError(null);
    setSaving(true);

    try {
      const input = {
        name: trimmedName,
        amount_minor: amountMinor,
        billing_cycle: cycle,
        next_due_date: nextDue ?? addDaysISO(30),
        is_active: isActive,
        category,
        note: note.trim(),
      };

      if (isEditing) {
        await api.updateSubscription(editingId, input);
      } else {
        await api.createSubscription(input);
      }
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('Delete subscription', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSubscription(editingId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
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

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView>
            <GlassCard style={styles.amountCard}>
              <Text style={styles.amountLabel}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  value={amountText}
                  onChangeText={(text) => {
                    setAmountText(text);
                    if (amountError) setAmountError(null);
                  }}
                  placeholder="0"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  selectionColor={colors.primary}
                  style={styles.amountInput}
                  autoFocus={!isEditing}
                  maxLength={12}
                />
              </View>

              {amountError ? (
                <Text style={styles.amountErrorText}>{amountError}</Text>
              ) : monthlyPreview !== null ? (
                <Text style={styles.preview}>
                  ~ {formatMoney(monthlyPreview, { compact: true })} per month
                </Text>
              ) : null}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={60}>
            <GlassCard>
              <TextField
                label="Name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError(null);
                }}
                placeholder="Netflix, gym, phone plan..."
                error={nameError}
                maxLength={100}
              />

              <SegmentedControl
                label="Billing cycle"
                options={BILLING_CYCLES}
                value={cycle}
                onChange={setCycle}
                renderLabel={(c) => CYCLE_LABEL[c]}
                accentFor={() => colors.accentCyan}
                style={styles.field}
              />

              {/* Expense categories only - a subscription is money going out.
                  This is what the payment gets filed under in Finance when you
                  mark it paid. */}
              <CategoryPicker
                label="Logs to Finance as"
                options={EXPENSE_CATEGORIES}
                value={category}
                onChange={setCategory}
                style={styles.field}
              />

              <DateField
                label="Next due"
                value={nextDue}
                onChange={setNextDue}
                style={styles.field}
              />

              <TextField
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder="Plan tier, shared with, anything useful"
                maxLength={200}
                style={styles.field}
              />

              {/* Active toggle: keeps a cancelled subscription on record
                  without counting it in the monthly total. */}
              <Pressable
                onPress={() => setIsActive(!isActive)}
                style={[styles.toggle, styles.field]}
              >
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Currently billing</Text>
                  <Text style={styles.toggleCaption}>
                    Turn off to keep it listed but excluded from totals
                  </Text>
                </View>
                <View style={[styles.switch, isActive && styles.switchOn]}>
                  <View style={[styles.knob, isActive && styles.knobOn]} />
                </View>
              </Pressable>
            </GlassCard>
          </FadeInView>

          <FadeInView delay={120}>
            <Button
              label={isEditing ? 'Save changes' : 'Add subscription'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete subscription"
                icon="trash-outline"
                variant="ghost"
                onPress={handleDelete}
                style={styles.delete}
              />
            ) : null}
          </FadeInView>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  amountCard: {
    marginBottom: spacing.lg,
  },
  amountLabel: {
    ...typography.overline,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  currency: {
    fontFamily: fonts.semibold,
    fontSize: 30,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 34,
    letterSpacing: -1,
    color: colors.text,
    padding: 0,
  },
  amountErrorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  preview: {
    ...typography.caption,
    color: colors.accentCyan,
    marginTop: spacing.sm,
  },
  field: {
    marginTop: spacing.xxl,
  },

  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleText: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  toggleTitle: {
    ...typography.title,
    fontSize: 14,
  },
  toggleCaption: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 2,
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: {
    backgroundColor: colors.primary + '4D',
    borderColor: colors.primary + '99',
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  knobOn: {
    backgroundColor: colors.primary,
    // A 46px track with 3px padding and a 19px knob leaves 19px of travel.
    transform: [{ translateX: 19 }],
  },

  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
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
