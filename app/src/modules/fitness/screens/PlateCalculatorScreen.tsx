/**
 * PlateCalculatorScreen - what goes on each side of the bar.
 *
 * Type a weight and see the bar drawn with its plates, heaviest innermost,
 * each plate labelled with its weight (colour is only a second cue). When the
 * weight cannot be made with the plates you own, it says what the closest
 * load below it is. Your bar and plates are edited below and kept on the
 * phone.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { platesFor, warmupSets } from '../plates';
import { usePlateInventory } from '../usePlateInventory';

type Route = RouteProp<RootStackParamList, 'PlateCalculator'>;

const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

export function PlateCalculatorScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const initial = useRoute<Route>().params?.targetKg;
  const { inventory, save } = usePlateInventory();
  const [target, setTarget] = useState(initial ? trim(initial) : '');
  const [newPlate, setNewPlate] = useState('');
  /** The bar field while it is being edited; null shows the saved value. */
  const [barText, setBarText] = useState<string | null>(null);

  const targetKg = Number(target.replace(',', '.'));
  const valid = Number.isFinite(targetKg) && targetKg > 0 && targetKg < 1000;
  const loading = valid ? platesFor(targetKg, inventory) : null;
  const warmups = valid ? warmupSets(targetKg, inventory) : [];

  /** One accent per common plate size; the kilo label is always printed too. */
  const plateColour = (kg: number) =>
    kg >= 25
      ? colors.accentRose
      : kg >= 20
        ? colors.accentIndigo
        : kg >= 15
          ? colors.accentAmber
          : kg >= 10
            ? colors.accentEmerald
            : colors.textMuted;
  const plateHeight = (kg: number) => Math.max(36, Math.min(132, 36 + kg * 4));

  const setPairs = (kg: number, pairs: number) =>
    save({
      ...inventory,
      plates: inventory.plates.map((p) => (p.kg === kg ? { ...p, pairs: Math.max(0, pairs) } : p)),
    });

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GlassCard>
          <Text style={styles.overline}>Target</Text>
          <View style={styles.targetRow}>
            <TextInput
              value={target}
              onChangeText={setTarget}
              placeholder="100"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              style={styles.targetInput}
              accessibilityLabel="Target weight in kilograms"
              autoFocus={!initial}
            />
            <Text style={styles.unit}>kg</Text>
          </View>

          {loading ? (
            <>
              <View
                style={styles.bar}
                accessible
                accessibilityLabel={
                  loading.perSide.length === 0
                    ? `Just the ${trim(inventory.barKg)} kilo bar`
                    : `Each side: ${loading.perSide.map(trim).join(', ')} kilos`
                }
              >
                <View style={styles.sleeve} />
                {loading.perSide.map((kg, i) => (
                  <View
                    key={`${kg}-${i}`}
                    style={[
                      styles.plate,
                      { height: plateHeight(kg), backgroundColor: plateColour(kg) },
                    ]}
                  >
                    <Text style={styles.plateLabel}>{trim(kg)}</Text>
                  </View>
                ))}
                <View style={styles.collar} />
              </View>
              <Text style={styles.result}>
                {loading.perSide.length === 0
                  ? `Just the bar (${trim(inventory.barKg)} kg)`
                  : `Each side: ${loading.perSide.map(trim).join(' + ')} kg`}
              </Text>
              {!loading.exact ? (
                <View style={styles.notice}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.info} />
                  <Text style={styles.noticeText}>
                    {targetKg < inventory.barKg
                      ? `Lighter than the bar (${trim(inventory.barKg)} kg).`
                      : `Your plates cannot make ${trim(targetKg)} kg. Closest: ${trim(loading.achievedKg)} kg.`}
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </GlassCard>

        {warmups.length > 0 ? (
          <GlassCard style={styles.card}>
            <Text style={styles.overline}>Warm-up</Text>
            {warmups.map((w) => (
              <Text key={w.kg} style={styles.warmup}>
                {trim(w.kg)} kg × {w.reps}
                <Text style={styles.warmupPlates}>
                  {'  '}
                  {platesFor(w.kg, inventory).perSide.map(trim).join(' + ') || 'bar'}
                </Text>
              </Text>
            ))}
          </GlassCard>
        ) : null}

        <GlassCard style={styles.card}>
          <Text style={styles.overline}>Your bar and plates</Text>
          <View style={styles.invRow}>
            <Text style={styles.invLabel}>Bar</Text>
            <TextInput
              value={barText ?? trim(inventory.barKg)}
              onChangeText={setBarText}
              // Saved when you leave the field, so clearing it to retype does
              // not snap the bar to 0 halfway.
              onBlur={() => {
                const kg = Number((barText ?? '').replace(',', '.'));
                if (barText !== null && Number.isFinite(kg) && kg > 0 && kg < 100) {
                  save({ ...inventory, barKg: kg });
                }
                setBarText(null);
              }}
              keyboardType="decimal-pad"
              style={styles.smallInput}
              accessibilityLabel="Bar weight in kilograms"
            />
            <Text style={styles.unit}>kg</Text>
          </View>
          {inventory.plates.map((p) => (
            <View key={p.kg} style={styles.invRow}>
              <View style={[styles.swatch, { backgroundColor: plateColour(p.kg) }]} />
              <Text style={styles.invLabel}>{trim(p.kg)} kg</Text>
              <Stepper
                value={p.pairs}
                label={`${trim(p.kg)} kilo pairs`}
                onChange={(pairs) => setPairs(p.kg, pairs)}
              />
              <Text style={styles.pairs}>{p.pairs === 1 ? 'pair' : 'pairs'}</Text>
            </View>
          ))}
          <View style={styles.invRow}>
            <TextInput
              value={newPlate}
              onChangeText={setNewPlate}
              placeholder="Add a plate (kg)"
              placeholderTextColor={colors.textFaint}
              keyboardType="decimal-pad"
              style={[styles.smallInput, styles.flex]}
              accessibilityLabel="New plate weight in kilograms"
            />
            <Pressable
              onPress={() => {
                const kg = Number(newPlate.replace(',', '.'));
                if (!(kg > 0 && kg < 100) || inventory.plates.some((p) => p.kg === kg)) return;
                save({ ...inventory, plates: [...inventory.plates, { kg, pairs: 1 }] });
                setNewPlate('');
              }}
              accessibilityRole="button"
              accessibilityLabel="Add plate"
              style={styles.addButton}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

function Stepper({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (n: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stepper} accessible accessibilityLabel={`${label}: ${value}`}>
      <Pressable
        onPress={() => onChange(value - 1)}
        accessibilityRole="button"
        accessibilityLabel={`One fewer pair of ${label}`}
        style={styles.stepButton}
      >
        <Ionicons name="remove" size={18} color={colors.textSecondary} />
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        onPress={() => onChange(value + 1)}
        accessibilityRole="button"
        accessibilityLabel={`One more pair of ${label}`}
        style={styles.stepButton}
      >
        <Ionicons name="add" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  overline: { ...typography.overline, marginBottom: spacing.xs },
  targetRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  targetInput: {
    ...typography.display,
    ...typography.numeric,
    minWidth: 120,
    padding: 0,
    color: colors.text,
  },
  unit: { ...typography.body, color: colors.textSecondary },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 140,
    marginTop: spacing.lg,
    gap: 3,
  },
  sleeve: { width: 48, height: 12, borderRadius: 3, backgroundColor: colors.glassBorderStrong },
  plate: { width: 22, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  plateLabel: {
    ...typography.overline,
    ...typography.numeric,
    fontSize: 9,
    letterSpacing: 0,
    color: colors.background,
    transform: [{ rotate: '-90deg' }],
    width: 40,
    textAlign: 'center',
  },
  collar: { width: 10, height: 22, borderRadius: 2, backgroundColor: colors.textMuted },
  result: { ...typography.h2, ...typography.numeric, marginTop: spacing.md },
  notice: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center', marginTop: spacing.sm },
  noticeText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  card: { marginTop: spacing.md },
  warmup: { ...typography.title, ...typography.numeric, minHeight: 32 },
  warmupPlates: { ...typography.caption, color: colors.textSecondary },
  invRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  invLabel: { ...typography.title, ...typography.numeric, width: 72 },
  swatch: { width: 12, height: 24, borderRadius: 3 },
  smallInput: {
    ...typography.title,
    ...typography.numeric,
    minWidth: 72,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
  flex: { flex: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
  stepValue: { ...typography.title, ...typography.numeric, minWidth: 24, textAlign: 'center' },
  pairs: { ...typography.caption },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
  },
}));
