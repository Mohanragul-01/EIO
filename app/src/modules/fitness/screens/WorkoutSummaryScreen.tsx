/**
 * WorkoutSummaryScreen - what a session added up to.
 *
 * One scrolling page, in the order you want to know it: the numbers, the
 * records, how it compares with the last time you ran this routine, and - when
 * you strayed from the routine - the change spelled out, with the choice to
 * make the routine match. Nothing changes without that tap.
 *
 * Shown after Finish, and from a finished session's Summary button. Finish
 * only stamped the end time; every set was already saved.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Button, FadeInView, GlassCard, Screen, useToast } from '../../../core/components';
import { formatEventDate } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { toSetFact, type SetFact } from '../load';
import type { RecordHit } from '../records';
import {
  compareToLast,
  describeDeviation,
  routineDeviation,
  sessionSummary,
  type Comparison,
} from '../summary';
import { formatDuration, type RoutineExercise } from '../types';
import { useWorkoutSession } from '../useWorkoutSession';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorkoutSummary'>;
type Route = RouteProp<RootStackParamList, 'WorkoutSummary'>;

/** A record's value in its own unit. */
function recordValue(hit: RecordHit): string {
  const kg = (n: number) => `${Number.isInteger(n) ? n : Math.round(n * 10) / 10} kg`;
  switch (hit.kind) {
    case 'reps':
      return `${hit.value} reps`;
    case 'hold':
      return `${hit.value}s`;
    case 'load':
      return hit.value < 0 ? `−${kg(-hit.value)}` : `+${kg(hit.value)}`;
    default:
      return kg(hit.value);
  }
}

function durationLabel(ms: number | null): string {
  if (ms === null) return '—';
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  return hours > 0 ? `${hours}h ${Math.floor((seconds % 3600) / 60)}m` : formatDuration(seconds);
}

export function WorkoutSummaryScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { sessionId } = useRoute<Route>().params;
  const toast = useToast();
  const w = useWorkoutSession(sessionId);

  const [ordinal, setOrdinal] = useState<number | null>(null);
  const [lastSets, setLastSets] = useState<SetFact[] | null>(null);
  const [slots, setSlots] = useState<RoutineExercise[]>([]);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [routineDecided, setRoutineDecided] = useState(false);
  const [updating, setUpdating] = useState(false);

  const session = w.session;
  useEffect(() => {
    if (!session) return;
    let active = true;
    void (async () => {
      try {
        const [n, last, routineSlots, routines] = await Promise.all([
          api.sessionOrdinal(session.id),
          session.routine_id
            ? api.lastRoutineSessionSets({
                routineId: session.routine_id,
                excludeSessionId: session.id,
                date: session.date,
              })
            : Promise.resolve(null),
          session.routine_id ? api.listRoutineExercises(session.routine_id) : Promise.resolve([]),
          session.routine_id ? api.listRoutines() : Promise.resolve([]),
        ]);
        if (!active) return;
        setOrdinal(n);
        setLastSets(last);
        setSlots(routineSlots);
        setRoutineName(routines.find((r) => r.id === session.routine_id)?.name ?? null);
      } catch {
        // The summary still shows what this session itself holds.
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Summary' });
  }, [navigation]);

  const sets = useMemo(
    () =>
      w.blocks
        .flatMap((b) => b.rows.flatMap((r) => (r.kind === 'saved' ? [toSetFact(r.set)] : [])))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [w.blocks],
  );

  const summary = useMemo(
    () =>
      sessionSummary({
        sets,
        exercisesById: w.exercisesById,
        bodyweightKg: session?.bodyweight_kg ?? null,
        records: w.records,
        startedAt: session?.started_at ?? sets[0]?.created_at ?? null,
        endedAt: session?.ended_at ?? sets[sets.length - 1]?.created_at ?? null,
      }),
    [sets, w.exercisesById, w.records, session],
  );

  const comparisons = useMemo(
    () => compareToLast(sets, lastSets, w.exercisesById, session?.bodyweight_kg ?? null),
    [sets, lastSets, w.exercisesById, session],
  );

  const deviation = useMemo(
    () =>
      routineDeviation(
        slots,
        w.blocks.map((b) => ({
          exerciseId: b.exerciseId,
          workingSets: b.rows.filter((r) => r.kind === 'saved' && r.set.set_type !== 'warmup')
            .length,
        })),
      ),
    [slots, w.blocks],
  );
  const names = useMemo(
    () => Object.fromEntries(Object.values(w.exercisesById).map((e) => [e.id, e.name])),
    [w.exercisesById],
  );
  const deviationLines = session?.routine_id ? describeDeviation(deviation, names) : [];
  const canUpdate = deviation.added.length > 0 || deviation.setCounts.length > 0;

  if (w.loading || !session) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const updateRoutine = async () => {
    if (!session.routine_id) return;
    setUpdating(true);
    try {
      const counts = (id: string) =>
        w.blocks
          .find((b) => b.exerciseId === id)
          ?.rows.filter((r) => r.kind === 'saved' && r.set.set_type !== 'warmup').length ?? 1;
      await api.updateRoutineFromSession(session.routine_id, {
        setCounts: deviation.setCounts.map((c) => ({
          exercise_id: c.exerciseId,
          target_sets: c.to,
        })),
        added: deviation.added.map((id) => ({ exercise_id: id, target_sets: counts(id) })),
      });
      setRoutineDecided(true);
      toast.show({ message: `${routineName ?? 'Routine'} updated` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not update the routine' });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView>
          <Text style={styles.kicker}>
            {formatEventDate(session.date)}
            {routineName ? ` · ${routineName}` : ''}
          </Text>
          <Text style={styles.title}>{ordinal ? `Workout #${ordinal}` : 'Workout'}</Text>

          <View style={styles.grid}>
            <Tile label="Duration" value={durationLabel(summary.durationMs)} icon="time-outline" />
            <Tile
              label="Volume"
              value={`${summary.volume.toLocaleString('en-IN')} kg`}
              icon="barbell-outline"
            />
            <Tile label="Sets" value={String(summary.workingSets)} icon="layers-outline" />
            <Tile label="Records" value={String(summary.records.length)} icon="trophy-outline" />
          </View>
        </FadeInView>

        {summary.records.length > 0 ? (
          <FadeInView delay={60}>
            <GlassCard style={styles.card}>
              <Text style={styles.section}>Records</Text>
              {summary.records.map(({ setId, exerciseId, hit }) => (
                <View key={setId} style={styles.line}>
                  <Ionicons name="trophy" size={16} color={colors.warning} />
                  <View style={styles.lineText}>
                    <Text style={styles.lineTitle}>{names[exerciseId] ?? 'Exercise'}</Text>
                    <Text style={styles.lineDetail}>
                      {hit.label} · {recordValue(hit)} (was{' '}
                      {recordValue({ ...hit, value: hit.previous })})
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          </FadeInView>
        ) : null}

        {comparisons.length > 0 ? (
          <FadeInView delay={100}>
            <GlassCard style={styles.card}>
              <Text style={styles.section}>
                vs last time{routineName ? ` you did ${routineName}` : ''}
              </Text>
              {comparisons.map((c) => (
                <ComparisonLine key={c.exerciseId} comparison={c} />
              ))}
            </GlassCard>
          </FadeInView>
        ) : null}

        {deviationLines.length > 0 && !routineDecided ? (
          <FadeInView delay={140}>
            <GlassCard style={styles.card}>
              <Text style={styles.section}>Update {routineName ?? 'the routine'}?</Text>
              {deviationLines.map((line) => (
                <Text key={line} style={styles.bullet}>
                  • {line}
                </Text>
              ))}
              {deviation.skipped.length > 0 ? (
                <Text style={styles.hint}>Skipped exercises stay in the routine.</Text>
              ) : null}
              <View style={styles.actions}>
                {canUpdate ? (
                  <Button
                    label="Update routine"
                    onPress={() => void updateRoutine()}
                    loading={updating}
                    style={styles.action}
                  />
                ) : null}
                <Button
                  label="Keep it"
                  variant="glass"
                  onPress={() => setRoutineDecided(true)}
                  style={styles.action}
                />
              </View>
            </GlassCard>
          </FadeInView>
        ) : null}

        <Button label="Done" onPress={() => navigation.popTo('FitnessList')} style={styles.done} />
        <Button
          label="Reopen workout"
          variant="ghost"
          icon="arrow-undo-outline"
          onPress={async () => {
            await w.reopen();
            navigation.goBack();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

function Tile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <GlassCard style={styles.tile}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </GlassCard>
  );
}

function ComparisonLine({ comparison: c }: { comparison: Comparison }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const look = {
    up: { icon: 'arrow-up' as const, color: colors.success, word: 'Better' },
    down: { icon: 'arrow-down' as const, color: colors.warning, word: 'Lower' },
    same: { icon: 'remove' as const, color: colors.textMuted, word: 'Same' },
    new: { icon: 'add' as const, color: colors.info, word: 'New' },
  }[c.change];
  const delta =
    c.volumeDelta === null || c.volumeDelta === 0
      ? ''
      : ` · volume ${c.volumeDelta > 0 ? '+' : '−'}${Math.abs(c.volumeDelta).toLocaleString('en-IN')} kg`;
  return (
    <View style={styles.line}>
      <Ionicons name={look.icon} size={16} color={look.color} />
      <View style={styles.lineText}>
        <Text style={styles.lineTitle}>
          {c.name} <Text style={[styles.word, { color: look.color }]}>{look.word}</Text>
        </Text>
        <Text style={styles.lineDetail}>
          Best {c.best}
          {c.lastBest ? ` (last time ${c.lastBest})` : ''}
          {delta}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  kicker: { ...typography.overline },
  title: { ...typography.display, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  tile: { flexBasis: '47%', flexGrow: 1, gap: spacing.xs },
  tileValue: { ...typography.h1, ...typography.numeric },
  tileLabel: { ...typography.caption },
  card: { marginTop: spacing.lg, gap: spacing.sm },
  section: { ...typography.overline, marginBottom: spacing.xs },
  line: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  lineText: { flex: 1 },
  lineTitle: { ...typography.title },
  lineDetail: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  word: { ...typography.caption },
  bullet: { ...typography.body },
  hint: { ...typography.caption },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  action: { flex: 1 },
  done: { marginTop: spacing.xl, marginBottom: spacing.sm },
}));
