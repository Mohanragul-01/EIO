/**
 * BandsScreen - your resistance bands, remembered by colour.
 *
 * A banded set records WHICH band, because that is how you remember it ("the
 * red one"). Each band also carries roughly how much it helps, and that number
 * is required: records compare assisted sets by their assistance, so a band
 * with no figure would count as no help at all and could outrank honest work.
 * Any rough guess is better than none - it only has to rank your bands.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, GlassCard, Screen, useToast } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import type { Band } from '../types';

/**
 * Band colours are what the bands physically are, not theme colours, so they
 * are stored as data. The label always appears beside the dot.
 */
export const BAND_COLOURS: { name: string; hex: string }[] = [
  { name: 'Yellow', hex: '#F2C230' },
  { name: 'Red', hex: '#E5484D' },
  { name: 'Black', hex: '#2B2B2E' },
  { name: 'Purple', hex: '#8E4EC6' },
  { name: 'Green', hex: '#30A46C' },
  { name: 'Blue', hex: '#3E63DD' },
  { name: 'Orange', hex: '#F76B15' },
  { name: 'Grey', hex: '#8B8D98' },
];

export function BandsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [bands, setBands] = useState<Band[]>([]);
  const [label, setLabel] = useState('');
  const [colour, setColour] = useState(BAND_COLOURS[1]);
  const [kg, setKg] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setBands(await api.listBands());
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not load your bands' });
    }
  }, [toast]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const approx = Number(kg.replace(',', '.'));
  const valid = Number.isFinite(approx) && approx > 0 && approx < 200;

  const add = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const band = await api.saveBand({
        label: label.trim() || colour.name,
        color: colour.hex,
        approx_kg: approx,
        position: bands.length,
      });
      setBands((list) => [...list, band]);
      setLabel('');
      setKg('');
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not add that band' });
    } finally {
      setSaving(false);
    }
  };

  const remove = (band: Band) => {
    Alert.alert(
      `Delete the ${band.label} band?`,
      'Sets that used it keep their assistance in kg; they just stop naming the band.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteBand(band.id);
              setBands((list) => list.filter((b) => b.id !== band.id));
            } catch (e) {
              toast.show({
                message: e instanceof Error ? e.message : 'Could not delete that band',
              });
            }
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GlassCard>
          <Text style={styles.section}>Your bands</Text>
          {bands.length === 0 ? (
            <Text style={styles.empty}>None yet. Add the bands you use below.</Text>
          ) : null}
          {bands.map((band) => (
            <View key={band.id} style={styles.bandRow}>
              <View style={[styles.dot, { backgroundColor: band.color }]} />
              <Text style={styles.bandLabel}>{band.label}</Text>
              <Text style={styles.bandKg}>
                {band.approx_kg ? `≈ ${band.approx_kg} kg` : 'no figure'}
              </Text>
              <Pressable
                onPress={() => remove(band)}
                accessibilityRole="button"
                accessibilityLabel={`Delete the ${band.label} band`}
                style={styles.iconButton}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </GlassCard>

        <GlassCard style={styles.addCard}>
          <Text style={styles.section}>Add a band</Text>
          <View style={styles.swatches} accessibilityRole="radiogroup">
            {BAND_COLOURS.map((c) => {
              const selected = c.hex === colour.hex;
              return (
                <Pressable
                  key={c.hex}
                  onPress={() => setColour(c)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={c.name}
                  style={[styles.swatch, selected && styles.swatchSelected]}
                >
                  <View style={[styles.swatchDot, { backgroundColor: c.hex }]} />
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={colour.name}
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Band name"
          />
          <Text style={styles.fieldLabel}>Roughly how much it helps (kg)</Text>
          <TextInput
            value={kg}
            onChangeText={setKg}
            placeholder="e.g. 15"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            style={styles.input}
            accessibilityLabel="Approximate assistance in kilograms"
          />
          <Text style={styles.hint}>A guess is fine: it only has to put your bands in order.</Text>
          <Button
            label="Add band"
            icon="add"
            onPress={() => void add()}
            disabled={!valid}
            loading={saving}
            style={styles.addButton}
          />
        </GlassCard>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  section: { ...typography.overline, marginBottom: spacing.sm },
  empty: { ...typography.body },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 52 },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  bandLabel: { ...typography.title, flex: 1 },
  bandKg: { ...typography.caption, ...typography.numeric },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  addCard: { marginTop: spacing.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: { borderColor: colors.primary },
  swatchDot: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  fieldLabel: { ...typography.caption, marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    ...typography.title,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
  hint: { ...typography.caption, marginTop: spacing.xs },
  addButton: { marginTop: spacing.lg },
}));
