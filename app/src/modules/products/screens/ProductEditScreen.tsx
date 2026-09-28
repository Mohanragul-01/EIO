/**
 * ProductEditScreen - define what you are tracking.
 *
 * The two fields that matter are the size and, optionally, how much a use
 * takes. Everything else is convenience. The form says which is which, because
 * "per use" looks like it drives the projection and does not - the projection
 * is measured from what you actually use, and per_use only pre-fills the
 * amount when you log one.
 */
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

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
import { todayISO } from '../../../core/date';
import { minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { CATEGORY_LABEL, PRODUCT_CATEGORIES, UNITS } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ProductEdit'>;
type Route = RouteProp<RootStackParamList, 'ProductEdit'>;

export function ProductEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const productId = route.params?.productId;
  const isEditing = !!productId;

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>('other');
  const [unit, setUnit] = useState('g');
  const [total, setTotal] = useState('');
  const [perUse, setPerUse] = useState('');
  const [price, setPrice] = useState('');
  const [openedOn, setOpenedOn] = useState<string | null>(todayISO());
  const [note, setNote] = useState('');

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [totalError, setTotalError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit product' : 'New product' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!productId) return;

    let active = true;
    (async () => {
      try {
        const rows = await api.listProducts();
        const product = rows.find((p) => p.id === productId);
        if (!active || !product) return;

        setName(product.name);
        setCategory(product.category);
        setUnit(product.unit);
        setTotal(String(product.total_quantity));
        setPerUse(product.per_use !== null ? String(product.per_use) : '');
        setPrice(product.price_minor !== null ? minorToAmountString(product.price_minor) : '');
        setOpenedOn(product.opened_on);
        setNote(product.note);
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Could not load this product');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [productId]);

  const handleSave = async () => {
    const trimmed = name.trim();
    const totalValue = Number(total.trim());

    setNameError(trimmed ? null : 'Give it a name');
    setTotalError(
      Number.isFinite(totalValue) && totalValue > 0 ? null : 'How much is in the container?',
    );
    if (!trimmed || !Number.isFinite(totalValue) || totalValue <= 0) return;

    setSaving(true);
    setError(null);

    const input = {
      name: trimmed,
      category,
      unit: unit.trim() || 'g',
      total_quantity: totalValue,
      // Blank means "never measured", which is different from zero and has to
      // reach the database as null.
      per_use: perUse.trim() ? Number(perUse) : null,
      price_minor: price.trim() ? parseAmountToMinor(price) : null,
      opened_on: openedOn ?? todayISO(),
      note: note.trim(),
    };

    try {
      if (productId) await api.updateProduct(productId, input);
      else await api.createProduct(input);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this product');
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!productId) return;
    Alert.alert('Delete product', 'Its whole usage history goes too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteProduct(productId);
            navigation.goBack();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete this product');
          }
        },
      },
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

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        <FadeInView>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {PRODUCT_CATEGORIES.map((option) => {
                const selected = option === category;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {CATEGORY_LABEL[option]}
                    </Text>
                  </Pressable>
                );
              })}
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {UNITS.map((option) => {
                const selected = option === unit;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setUnit(option)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
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
            <Text style={styles.hint}>Used to work out what it costs you a day.</Text>

            <DateField
              label="Opened on"
              value={openedOn}
              onChange={setOpenedOn}
              // 'event': it was opened on a day that has happened.
              mode="event"
              allowClear={false}
              style={styles.spaced}
            />

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
            label={isEditing ? 'Save changes' : 'Start tracking'}
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            style={styles.save}
          />

          {isEditing ? (
            <Pressable onPress={handleDelete} style={styles.deleteWrap} hitSlop={8}>
              <Text style={styles.delete}>Delete this product</Text>
            </Pressable>
          ) : null}
        </FadeInView>
      </FormScroll>
    </Screen>
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
  label: { ...typography.overline },
  spaced: { marginTop: spacing.lg },
  hint: { ...typography.caption, fontSize: 12, marginTop: spacing.sm },

  chipRow: { gap: spacing.sm, paddingTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipActive: {
    backgroundColor: colors.accentCyan + '26',
    borderColor: colors.accentCyan + '59',
  },
  chipText: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary },
  chipTextActive: { color: colors.accentCyan },
  pressed: { opacity: 0.7 },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg },
  save: { marginTop: spacing.xl },
  deleteWrap: { alignItems: 'center', marginTop: spacing.xl },
  delete: { ...typography.caption, color: colors.danger },
}));
