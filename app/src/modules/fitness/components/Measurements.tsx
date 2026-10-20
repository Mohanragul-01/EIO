/**
 * Measurements - tape measurements on the Body tab.
 *
 * A card with each site you have measured, its latest value and the change
 * since the time before (an arrow AND the word "up" or "down", never colour
 * alone - and no judgement either: a bigger arm and a smaller waist are both
 * just changes). "Add measurements" opens every site at once, last values
 * as placeholders and left/right pairs side by side; leave any blank. Tap a
 * site for its chart.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button, DateField, GlassCard, Sheet, useToast } from '../../../core/components';
import { formatEventDate, todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import {
  latestValues,
  MEASUREMENT_SITES,
  seriesForSite,
  siteName,
  type Site,
  type SiteKey,
} from '../measurements';
import type { BodyMeasurement } from '../types';
import { LineChart } from './LineChart';

const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

export function Measurements() {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [rows, setRows] = useState<BodyMeasurement[]>([]);
  const [adding, setAdding] = useState(false);
  const [chartFor, setChartFor] = useState<Site | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.listMeasurements());
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not load measurements' });
    }
  }, [toast]);

  useEffect(() => {
    // Starts a fetch rather than computing derived state - see useTodos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const latest = latestValues(rows);
  const measured = MEASUREMENT_SITES.filter((s) => latest[s.key]);

  return (
    <GlassCard style={styles.card}>
      <Text style={styles.overline}>Measurements</Text>
      {measured.length === 0 ? (
        <Text style={styles.caption}>
          Waist, chest, arms and the rest: a tape measure shows changes the scale hides.
        </Text>
      ) : (
        measured.map((site) => {
          const entry = latest[site.key]!;
          const diff = entry.previous === null ? null : entry.value - entry.previous;
          const unit = site.unit === '%' ? '%' : ' cm';
          return (
            <Pressable
              key={site.key}
              onPress={() => setChartFor(site)}
              accessibilityRole="button"
              accessibilityLabel={`${siteName(site)} ${trim(entry.value)}${unit}, ${
                diff === null || diff === 0
                  ? 'no change'
                  : `${diff > 0 ? 'up' : 'down'} ${trim(Math.abs(diff))}${unit}`
              }, measured ${formatEventDate(entry.date)}. Open its chart`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.site}>{siteName(site)}</Text>
              <View style={styles.values}>
                <Text style={styles.value}>
                  {trim(entry.value)}
                  {unit}
                </Text>
                {diff !== null && diff !== 0 ? (
                  <View style={styles.change}>
                    <Ionicons
                      name={diff > 0 ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.changeText}>
                      {diff > 0 ? 'up' : 'down'} {trim(Math.abs(diff))}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
            </Pressable>
          );
        })
      )}
      <Button
        label="Add measurements"
        icon="add"
        variant="glass"
        onPress={() => setAdding(true)}
        style={styles.add}
      />

      {adding ? (
        <AddSheet
          latest={latest}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            void load();
            toast.show({ message: 'Measurements saved' });
          }}
        />
      ) : null}

      {chartFor ? (
        <Sheet
          visible
          title={siteName(chartFor)}
          subtitle={`${seriesForSite(rows, chartFor.key).length} measurements`}
          onClose={() => setChartFor(null)}
        >
          <LineChart
            points={seriesForSite(rows, chartFor.key)}
            unit={chartFor.unit === '%' ? '%' : 'cm'}
            label={siteName(chartFor)}
          />
        </Sheet>
      ) : null}
    </GlassCard>
  );
}

function AddSheet({
  latest,
  onClose,
  onSaved,
}: {
  latest: ReturnType<typeof latestValues>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<SiteKey, string>>>({});
  const [saving, setSaving] = useState(false);

  const parsed = Object.entries(values).flatMap(([key, text]) => {
    const n = Number((text ?? '').replace(',', '.'));
    return text && text.trim() ? [[key, n] as const] : [];
  });
  const invalid = parsed.some(([key, n]) =>
    key === 'body_fat_pct' ? !(n > 0 && n < 75) : !(n > 0 && n < 300),
  );

  const save = async () => {
    if (parsed.length === 0 || invalid) return;
    setSaving(true);
    try {
      await api.saveMeasurement(date, Object.fromEntries(parsed));
      onSaved();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  // Pairs (left/right) share a row.
  const rows: Site[][] = [];
  for (const site of MEASUREMENT_SITES) {
    const last = rows[rows.length - 1];
    if (site.side === 'right' && last?.[0]?.side === 'left' && last[0].label === site.label)
      last.push(site);
    else rows.push([site]);
  }

  return (
    <Sheet
      visible
      title="Add measurements"
      subtitle="Leave any blank. Last values are shown faintly."
      onClose={onClose}
      footer={
        <Button
          label="Save"
          onPress={() => void save()}
          loading={saving}
          disabled={parsed.length === 0 || invalid}
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
        <DateField
          label="Day"
          value={date}
          onChange={(d) => d && setDate(d)}
          mode="event"
          allowClear={false}
        />
        {rows.map((pair) => (
          <View key={pair[0].key} style={styles.fieldRow}>
            {pair.map((site) => (
              <View key={site.key} style={styles.field}>
                <Text style={styles.fieldLabel}>
                  {siteName(site)} ({site.unit})
                </Text>
                <TextInput
                  value={values[site.key] ?? ''}
                  onChangeText={(text) => setValues((v) => ({ ...v, [site.key]: text }))}
                  placeholder={latest[site.key] ? trim(latest[site.key]!.value) : ''}
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  accessibilityLabel={`${siteName(site)} in ${site.unit === '%' ? 'percent' : 'centimetres'}`}
                />
              </View>
            ))}
          </View>
        ))}
        {invalid ? (
          <Text style={styles.error}>Check the numbers: they look out of range.</Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginTop: spacing.md },
  overline: { ...typography.overline, marginBottom: spacing.xs },
  caption: { ...typography.caption },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.glass },
  site: { ...typography.body, color: colors.text, flex: 1 },
  values: { alignItems: 'flex-end' },
  value: { ...typography.title, ...typography.numeric },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeText: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  add: { marginTop: spacing.md },
  sheetScroll: { maxHeight: 460 },
  fieldRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  field: { flex: 1 },
  fieldLabel: { ...typography.caption, marginBottom: 2 },
  input: {
    ...typography.title,
    ...typography.numeric,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
}));
