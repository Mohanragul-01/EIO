/**
 * TransactionEditScreen - add or edit a transaction.
 *
 * Same create-or-edit-by-param pattern as the other modules. What's new:
 *
 *  • The AMOUNT FIELD is the first thing you touch and gets an oversized
 *    input. Logging a spend is a ten-second job done at a shop counter; the
 *    number is the whole point and everything else is optional.
 *  • Switching between Expense and Income CHANGES the category list, so the
 *    selected category has to be re-validated when the kind flips.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

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
import { todayISO } from '../../../core/date';
import { minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { fonts, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { categoriesFor } from '../../../core/categories';
import * as api from '../api';
import type { TransactionKind } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TransactionEdit'>;
type Route = RouteProp<RootStackParamList, 'TransactionEdit'>;

const KINDS: TransactionKind[] = ['expense', 'income'];

export function TransactionEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  const [amountText, setAmountText] = useState('');
  const [kind, setKind] = useState<TransactionKind>('expense');
  const [category, setCategory] = useState(categoriesFor('expense')[0].key);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());

  const [amountError, setAmountError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit transaction' : 'New transaction' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const transaction = await api.getTransaction(editingId);
        if (!active) return;
        setAmountText(minorToAmountString(transaction.amount_minor));
        setKind(transaction.kind);
        setCategory(transaction.category);
        setNote(transaction.note);
        setDate(transaction.date);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this transaction');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId]);

  /**
   * Expense and income have separate category lists, so flipping the kind can
   * leave `category` pointing at something that no longer exists in the
   * picker - a selected value with nothing highlighted. Reset to the first
   * valid option whenever the current one isn't in the new list.
   */
  const handleKindChange = (nextKind: TransactionKind) => {
    setKind(nextKind);
    const options = categoriesFor(nextKind);
    if (!options.some((c) => c.key === category)) {
      setCategory(options[0].key);
    }
  };

  const handleSave = async () => {
    const amountMinor = parseAmountToMinor(amountText);

    // parseAmountToMinor returns null for anything it can't parse, which is
    // why it returns null rather than 0 - a silent ₹0 transaction would be a
    // much worse outcome than a validation message.
    if (amountMinor === null || amountMinor <= 0) {
      setAmountError('Enter an amount like 250 or 249.50');
      return;
    }
    setAmountError(null);
    setSaving(true);

    try {
      const input = {
        amount_minor: amountMinor,
        kind,
        category,
        note: note.trim(),
        date: date ?? todayISO(),
      };

      if (isEditing) {
        await api.updateTransaction(editingId, input);
      } else {
        await api.createTransaction(input);
      }
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteTransaction(editingId);
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

  const categories = categoriesFor(kind);

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
          {/*  Amount: the hero field  */}
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
                  // 'decimal-pad' gives digits and a decimal point but no
                  // comma or +/- keys, which are meaningless here.
                  keyboardType="decimal-pad"
                  selectionColor={colors.primary}
                  style={styles.amountInput}
                  autoFocus={!isEditing}
                  maxLength={12}
                />
              </View>
              {amountError ? <Text style={styles.amountErrorText}>{amountError}</Text> : null}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={60}>
            <GlassCard style={styles.card}>
              <SegmentedControl
                label="Type"
                options={KINDS}
                value={kind}
                onChange={handleKindChange}
                renderLabel={(k) => (k === 'expense' ? 'Expense' : 'Income')}
                accentFor={(k) => (k === 'income' ? colors.success : colors.accentRose)}
              />

              <CategoryPicker
                label="Category"
                options={categories}
                value={category}
                onChange={setCategory}
                style={styles.field}
              />

              {/* mode="event" + allowClear={false}: a transaction records
                  something that already happened on a specific day, and the
                  DB column is NOT NULL. */}
              <DateField
                label={kind === 'income' ? 'Received on' : 'Paid on'}
                value={date}
                onChange={setDate}
                mode="event"
                allowClear={false}
                style={styles.field}
              />

              <TextField
                label="Note"
                value={note}
                onChangeText={setNote}
                placeholder="What was it for?"
                maxLength={200}
                style={styles.field}
              />
            </GlassCard>
          </FadeInView>

          <FadeInView delay={120}>
            <Button
              label={isEditing ? 'Save changes' : 'Add transaction'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete transaction"
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
    padding: 0, // Android adds default padding that misaligns it from the ₹
  },
  amountErrorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },

  card: {},
  field: {
    marginTop: spacing.xxl,
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
