/**
 * ExerciseDetailScreen - everything about one exercise.
 *
 *   Summary   the headline number and a chart, with a metric chosen to fit
 *             the exercise (exerciseStats.ts) and a range. Tap the chart for
 *             that day's sets.
 *   History   every session with it, newest first.
 *   Records   your bests with their dates and, for a lift, the rep-max
 *             table: what you have done at each rep count beside what your
 *             best estimated max says you could.
 *   How-to    your own instructions and pinned note, and the settings that
 *             decide how a set is logged (weights or bodyweight, one side at
 *             a time, which mode lists it...).
 */
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  FadeInView,
  GlassCard,
  Screen,
  SegmentedControl,
  Sheet,
  useToast,
} from '../../../core/components';
import { formatEventDate, todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { LineChart } from '../components/LineChart';
import {
  historyBySession,
  METRIC_LABEL,
  METRIC_UNIT,
  metricsFor,
  repMaxTable,
  seriesFor,
  type DatedSet,
  type Metric,
  type Range,
} from '../exerciseStats';
import { formatSetShort, setLabels } from '../load';
import type { Discipline, Equipment, Exercise, LoadMode, TrackingType } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ExerciseProgress'>;
type Route = RouteProp<RootStackParamList, 'ExerciseProgress'>;
type Tab = 'summary' | 'history' | 'records' | 'howto';
type Row = DatedSet & { band_id: string | null; side: 'left' | 'right' | null; rpe: number | null };

const RANGES: Range[] = ['1m', '3m', '1y', 'all'];
const RANGE_LABEL: Record<Range, string> = { '1m': '1M', '3m': '3M', '1y': '1Y', all: 'All' };

const EQUIPMENT: { key: Equipment; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbell', label: 'Dumbbell' },
  { key: 'kettlebell', label: 'Kettlebell' },
  { key: 'machine', label: 'Machine' },
  { key: 'cable', label: 'Cable' },
  { key: 'band', label: 'Band' },
  { key: 'pull_up_bar', label: 'Pull-up bar' },
  { key: 'rings', label: 'Rings' },
  { key: 'dip_bars', label: 'Dip bars' },
  { key: 'parallettes', label: 'Parallettes' },
  { key: 'other', label: 'Other' },
];

export function ExerciseDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { exerciseId, name } = useRoute<Route>().params;
  const toast = useToast();

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('summary');
  const [metric, setMetric] = useState<Metric | null>(null);
  const [range, setRange] = useState<Range>('3m');
  const [picked, setPicked] = useState<number | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: exercise?.name ?? name });
  }, [navigation, exercise?.name, name]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [row, rows] = await Promise.all([
          api.getExercise(exerciseId),
          api.listExerciseSets(exerciseId),
        ]);
        if (!active) return;
        setExercise(row);
        setSets(rows);
      } catch (e) {
        if (active)
          toast.show({ message: e instanceof Error ? e.message : 'Could not load this exercise' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [exerciseId, toast]);

  const metrics = useMemo(() => (exercise ? metricsFor(exercise) : []), [exercise]);
  const activeMetric = metric && metrics.includes(metric) ? metric : (metrics[0] ?? null);
  const series = useMemo(
    () =>
      exercise && activeMetric ? seriesFor(activeMetric, sets, exercise, range, todayISO()) : [],
    [exercise, activeMetric, sets, range],
  );
  const history = useMemo(() => historyBySession(sets), [sets]);

  if (loading || !exercise) {
    return (
      <Screen>
        <View style={styles.centered}>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.body}>Not found.</Text>
          )}
        </View>
      </Screen>
    );
  }

  const unit = activeMetric ? METRIC_UNIT[activeMetric] : '';
  const latest = series[series.length - 1];
  const best = series.length ? Math.max(...series.map((p) => p.value)) : null;
  const pickedPoint = picked !== null ? series[picked] : null;
  const pickedSets = pickedPoint ? sets.filter((s) => s.session_id === pickedPoint.sessionId) : [];

  return (
    <Screen padded={false}>
      <View style={styles.tabs}>
        <SegmentedControl
          options={['summary', 'history', 'records', 'howto'] as Tab[]}
          value={tab}
          onChange={setTab}
          renderLabel={(t) =>
            t === 'summary'
              ? 'Summary'
              : t === 'history'
                ? 'History'
                : t === 'records'
                  ? 'Records'
                  : 'How-to'
          }
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {tab === 'summary' && activeMetric ? (
          <FadeInView>
            <GlassCard>
              <Text style={styles.overline}>{METRIC_LABEL[activeMetric]}</Text>
              <Text style={styles.headline}>{latest ? `${trim(latest.value)} ${unit}` : '—'}</Text>
              {best !== null && latest && best > latest.value ? (
                <Text style={styles.caption}>
                  Best in range {trim(best)} {unit}
                </Text>
              ) : null}
              <View style={styles.chart}>
                <LineChart
                  points={series}
                  unit={unit}
                  label={METRIC_LABEL[activeMetric]}
                  color={exercise.load_mode === 'bodyweight' ? colors.accentCyan : colors.primary}
                  selectedIndex={picked}
                  onSelect={setPicked}
                />
              </View>
              <Chips
                options={metrics}
                value={activeMetric}
                label={(m) => METRIC_LABEL[m]}
                onChange={(m) => {
                  setMetric(m);
                  setPicked(null);
                }}
              />
              <Chips
                options={RANGES}
                value={range}
                label={(r) => RANGE_LABEL[r]}
                onChange={(r) => {
                  setRange(r);
                  setPicked(null);
                }}
              />
            </GlassCard>
            {sets.length === 0 ? (
              <Text style={[styles.body, styles.gapTop]}>
                No sets logged yet. Log one and it shows here.
              </Text>
            ) : null}
          </FadeInView>
        ) : null}

        {tab === 'history' ? (
          <FadeInView>
            {history.length === 0 ? <Text style={styles.body}>No sessions yet.</Text> : null}
            {history.map((group) => {
              const labels = setLabels(group.sets);
              return (
                <GlassCard key={group.sessionId} style={styles.card}>
                  <Text style={styles.title}>{formatEventDate(group.date)}</Text>
                  {group.sets.map((s, i) => (
                    <View key={s.id} style={styles.historyRow}>
                      <Text style={styles.setLabel}>{labels[i]}</Text>
                      <Text style={styles.historyText}>
                        {formatSetShort(
                          { ...s, band_id: (s as Row).band_id, side: (s as Row).side },
                          exercise,
                        )}
                        {(s as Row).rpe ? ` · RPE ${(s as Row).rpe}` : ''}
                      </Text>
                    </View>
                  ))}
                </GlassCard>
              );
            })}
          </FadeInView>
        ) : null}

        {tab === 'records' ? <Records exercise={exercise} sets={sets} /> : null}

        {tab === 'howto' ? (
          <HowTo
            exercise={exercise}
            onSaved={(next) => {
              setExercise(next);
              toast.show({ message: 'Saved' });
            }}
          />
        ) : null}
      </ScrollView>

      {pickedPoint ? (
        <Sheet
          visible
          title={formatEventDate(pickedPoint.date)}
          subtitle={`${exercise.name} · ${trim(pickedPoint.value)} ${unit}`}
          onClose={() => setPicked(null)}
        >
          {pickedSets.map((s, i) => (
            <View key={s.id} style={styles.historyRow}>
              <Text style={styles.setLabel}>{setLabels(pickedSets)[i]}</Text>
              <Text style={styles.historyText}>{formatSetShort(s, exercise)}</Text>
            </View>
          ))}
        </Sheet>
      ) : null}
    </Screen>
  );
}

function Records({ exercise, sets }: { exercise: Exercise; sets: Row[] }) {
  const styles = useStyles();
  const working = sets.filter((s) => s.set_type !== 'warmup');
  const table =
    exercise.load_mode === 'external' && exercise.tracking_type === 'reps'
      ? repMaxTable(sets)
      : null;

  /** The best set for a measure, with the day it happened. */
  const bestBy = (value: (s: Row) => number | null): { value: number; date: string } | null => {
    let best: { value: number; date: string } | null = null;
    for (const s of working) {
      const v = value(s);
      if (v !== null && v > 0 && (!best || v > best.value)) best = { value: v, date: s.date };
    }
    return best;
  };

  const lines: { label: string; best: { value: number; date: string } | null; unit: string }[] =
    exercise.tracking_type === 'time'
      ? [{ label: 'Longest hold', best: bestBy((s) => s.duration_seconds), unit: 's' }]
      : exercise.load_mode === 'bodyweight'
        ? [
            {
              label: 'Most reps (bodyweight or harder)',
              best: bestBy((s) => (s.weight_kg - (s.assist_kg ?? 0) >= 0 ? s.reps : null)),
              unit: 'reps',
            },
            {
              label: 'Most added weight',
              best: bestBy((s) => s.weight_kg - (s.assist_kg ?? 0)),
              unit: 'kg',
            },
          ]
        : [
            { label: 'Heaviest', best: bestBy((s) => (s.reps ? s.weight_kg : null)), unit: 'kg' },
            {
              label: 'Best est. 1RM',
              best: bestBy((s) =>
                s.reps && s.reps <= 12 && s.weight_kg > 0
                  ? Math.round(s.weight_kg * (1 + (s.reps === 1 ? 0 : s.reps / 30)) * 10) / 10
                  : null,
              ),
              unit: 'kg',
            },
            {
              label: 'Best set volume',
              best: bestBy((s) => (s.reps ? s.weight_kg * s.reps : null)),
              unit: 'kg',
            },
          ];

  return (
    <FadeInView>
      <GlassCard>
        {lines.map((line) => (
          <View key={line.label} style={styles.recordRow}>
            <Text style={styles.recordLabel}>{line.label}</Text>
            <View style={styles.recordValue}>
              <Text style={styles.title}>
                {line.best ? `${trim(line.best.value)} ${line.unit}` : '—'}
              </Text>
              {line.best ? (
                <Text style={styles.caption}>{formatEventDate(line.best.date)}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </GlassCard>

      {table ? (
        <GlassCard style={styles.card}>
          <Text style={styles.overline}>Rep maxes</Text>
          <View style={styles.tableHead}>
            <Text style={[styles.th, styles.colReps]}>REPS</Text>
            <Text style={[styles.th, styles.colBest]}>YOUR BEST</Text>
            <Text style={[styles.th, styles.colPred]}>EST.</Text>
          </View>
          {table.map((row) => (
            <View key={row.reps} style={styles.tableRow}>
              <Text style={[styles.td, styles.colReps]}>{row.reps}</Text>
              <Text style={[styles.td, styles.colBest]}>
                {row.actual
                  ? `${trim(row.actual.weight)} kg · ${formatEventDate(row.actual.date)}`
                  : '—'}
              </Text>
              <Text style={[styles.td, styles.colPred, styles.muted]}>
                {row.predicted !== null ? `${trim(row.predicted)} kg` : '—'}
              </Text>
            </View>
          ))}
          <Text style={styles.caption}>
            Est. comes from your best estimated max (Epley). Where it beats your best, a record is
            waiting.
          </Text>
        </GlassCard>
      ) : null}
    </FadeInView>
  );
}

function HowTo({ exercise, onSaved }: { exercise: Exercise; onSaved: (next: Exercise) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const toast = useToast();
  const [instructions, setInstructions] = useState(exercise.instructions);
  const [pinned, setPinned] = useState(exercise.pinned_note);
  const [equipment, setEquipment] = useState<Equipment | null>(exercise.equipment);
  const [tracking, setTracking] = useState<TrackingType>(exercise.tracking_type);
  const [loadMode, setLoadMode] = useState<LoadMode>(exercise.load_mode);
  const [factor, setFactor] = useState(String(exercise.bodyweight_factor));
  const [unilateral, setUnilateral] = useState(exercise.is_unilateral);
  const [discipline, setDiscipline] = useState<Discipline>(exercise.discipline);
  const [saving, setSaving] = useState(false);

  const factorValue = Number(factor.replace(',', '.'));
  const factorOk = Number.isFinite(factorValue) && factorValue > 0 && factorValue <= 1.5;

  const save = async () => {
    if (!factorOk) return;
    setSaving(true);
    const patch = {
      instructions: instructions.trim(),
      pinned_note: pinned.trim(),
      equipment,
      tracking_type: tracking,
      load_mode: loadMode,
      bodyweight_factor: factorValue,
      is_unilateral: unilateral,
      discipline,
    };
    try {
      await api.updateExercise(exercise.id, patch);
      onSaved({ ...exercise, ...patch });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeInView>
      <GlassCard>
        <Text style={styles.overline}>How to do it</Text>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          placeholder="Your own notes on form: setup, cues, what to feel"
          placeholderTextColor={colors.textFaint}
          multiline
          style={[styles.input, styles.multiline]}
          accessibilityLabel="How to do it"
        />
        <Text style={[styles.overline, styles.gapTop]}>Pinned note</Text>
        <TextInput
          value={pinned}
          onChangeText={setPinned}
          placeholder="Shown every time you log it, e.g. seat on 4"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          accessibilityLabel="Pinned note"
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <Text style={styles.overline}>How it is logged</Text>
        <SegmentedControl
          options={['reps', 'time'] as TrackingType[]}
          value={tracking}
          onChange={setTracking}
          renderLabel={(t) => (t === 'reps' ? 'Reps' : 'Held, in seconds')}
        />
        <View style={styles.gapTop}>
          <SegmentedControl
            options={['external', 'bodyweight'] as LoadMode[]}
            value={loadMode}
            onChange={setLoadMode}
            renderLabel={(m) => (m === 'external' ? 'Weights' : 'Bodyweight')}
          />
        </View>
        {loadMode === 'bodyweight' ? (
          <>
            <Text style={[styles.caption, styles.gapTop]}>
              Share of your bodyweight one rep moves (a push-up is about 0.65). Only used for volume
              and estimated maxes.
            </Text>
            <TextInput
              value={factor}
              onChangeText={setFactor}
              keyboardType="decimal-pad"
              style={[styles.input, !factorOk && styles.inputError]}
              accessibilityLabel="Bodyweight share"
            />
            {!factorOk ? <Text style={styles.error}>Between 0.1 and 1.5</Text> : null}
          </>
        ) : null}
        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.title}>One side at a time</Text>
            <Text style={styles.caption}>Each set is logged as a left and a right</Text>
          </View>
          <Switch
            value={unilateral}
            onValueChange={setUnilateral}
            accessibilityLabel="One side at a time"
            trackColor={{ true: colors.primary, false: colors.glassStrong }}
          />
        </View>
        <Text style={[styles.overline, styles.gapTop]}>Shows in</Text>
        <SegmentedControl
          options={['gym', 'calisthenics', 'both'] as Discipline[]}
          value={discipline}
          onChange={setDiscipline}
          renderLabel={(d) =>
            d === 'gym' ? 'Gym' : d === 'calisthenics' ? 'Calisthenics' : 'Both'
          }
        />
        <Text style={[styles.overline, styles.gapTop]}>Equipment</Text>
        <Chips
          options={EQUIPMENT.map((e) => e.key)}
          value={equipment ?? 'none'}
          label={(k) => EQUIPMENT.find((e) => e.key === k)?.label ?? k}
          onChange={setEquipment}
        />
      </GlassCard>

      <Button
        label="Save"
        onPress={() => void save()}
        loading={saving}
        disabled={!factorOk}
        style={styles.save}
      />
    </FadeInView>
  );
}

function Chips<T extends string>({
  options,
  value,
  label,
  onChange,
}: {
  options: T[];
  value: T;
  label: (option: T) => string;
  onChange: (option: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {label(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  overline: { ...typography.overline, marginBottom: spacing.xs },
  headline: { ...typography.display, ...typography.numeric },
  caption: { ...typography.caption },
  body: { ...typography.body },
  title: { ...typography.title, ...typography.numeric },
  chart: { marginVertical: spacing.lg },
  card: { marginTop: spacing.md },
  gapTop: { marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.onPrimary },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 32 },
  setLabel: { ...typography.title, ...typography.numeric, width: 24, textAlign: 'center' },
  historyText: { ...typography.body, ...typography.numeric, color: colors.text },
  recordRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: spacing.md },
  recordLabel: { ...typography.body, flex: 1 },
  recordValue: { alignItems: 'flex-end' },
  tableHead: { flexDirection: 'row', paddingVertical: spacing.xs },
  tableRow: { flexDirection: 'row', minHeight: 36, alignItems: 'center' },
  th: { ...typography.overline },
  td: { ...typography.caption, ...typography.numeric, color: colors.text },
  muted: { color: colors.textSecondary },
  colReps: { width: 48 },
  colBest: { flex: 1 },
  colPred: { width: 72, textAlign: 'right' },
  input: {
    ...typography.body,
    minHeight: 48,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  error: { ...typography.caption, color: colors.danger },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingVertical: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    marginTop: spacing.md,
  },
  flex: { flex: 1 },
  save: { marginTop: spacing.lg },
}));
