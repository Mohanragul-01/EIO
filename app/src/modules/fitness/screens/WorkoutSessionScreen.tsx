/**
 * WorkoutSessionScreen - logging a session, set by set.
 *
 * The session row already exists before this screen opens. Holding an unsaved
 * workout in memory and writing it on "finish" would lose the whole thing if
 * the app were killed mid-session, which on a phone in a gym is not a remote
 * possibility. Every set is written as it is entered.
 *
 * There is no "finish" button for the same reason: nothing is pending, so there
 * is nothing to commit. You leave when you are done.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, FadeInView, GlassCard, Screen,
  FormScroll,
  DateField,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate } from '../../../core/date';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { PickerSheet } from '../components/PickerSheet';
import { RestTimer } from '../components/RestTimer';
import { formatSet, normaliseMuscle, type SessionSet,
  type TrackingType,
} from '../types';
import { useWorkoutSession } from '../useWorkoutSession';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorkoutSession'>;
type Route = RouteProp<RootStackParamList, 'WorkoutSession'>;

export function WorkoutSessionScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { sessionId, routineId } = route.params;

  const {
    session,
    blocks,
    exercises,
    volume,
    prs,
    loading,
    error,
    setDate,
    setExerciseOrder,
    addExerciseToSession,
    logSet,
    removeSet,
    saveNotes,
  } = useWorkoutSession(sessionId);

  const [notes, setNotes] = useState('');
  /** Which session's notes the field below has already been seeded from. */
  const [notesSeededFor, setNotesSeededFor] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this workout', 'Every set in it is deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteSession(sessionId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
          }
        },
      },
    ]);
  }, [sessionId, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: session ? formatEventDate(session.date) : 'Workout',
      headerRight: () => (
        <Pressable onPress={confirmDelete} hitSlop={10} accessibilityLabel="Delete session">
          <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
        </Pressable>
      ),
    });
    // confirmDelete is stable (useCallback on sessionId and navigation), so
    // declaring it here does not reset the header on every keystroke in the
    // notes field. Declared rather than suppressed.
  }, [navigation, session, confirmDelete, colors.textMuted]);

  /**
   * Seed the notes field from the loaded session, once per session.
   *
   * Done during render rather than in an effect. This is the case React's own
   * docs call "adjusting state when a prop changes": an effect would paint an
   * empty field first and then replace it, which is a visible flash of the
   * wrong content on a field you may already be reading.
   *
   * Safe from looping because the very next line makes the condition false.
   */
  if (session && notesSeededFor !== session.id) {
    setNotesSeededFor(session.id);
    setNotes(session.notes);
  }

  /**
   * Pre-fill the exercise list from the routine, once.
   *
   * This only sets which blocks appear; it logs nothing. A routine says what you
   * intend to do, and the sets record what you actually did - conflating the two
   * would mean a routine you skipped still showing as training you completed.
   */
  useEffect(() => {
    if (!routineId || loading) return;

    let active = true;
    api
      .listRoutineExercises(routineId)
      .then((rows) => {
        if (active) setExerciseOrder(rows.map((row) => row.exercise_id));
      })
      .catch(() => {
        // A deleted routine leaves the session ad-hoc, which is fine.
      });

    return () => {
      active = false;
    };
  }, [routineId, loading, setExerciseOrder]);

  const pickExercise = useCallback(() => {
    if (exercises.length === 0) {
      Alert.alert('No exercises', 'Add some in the Plan tab first.');
      return;
    }
    setPicking(true);
  }, [exercises]);

  if (loading) {
    return (
      <Screen>
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
            <GlassCard style={styles.timerCard}>
              <View style={styles.timerRow}>
                <View>
                  <Text style={styles.label}>Rest</Text>
                  {volume > 0 ? (
                    <Text style={styles.volume}>{volume.toLocaleString('en-IN')} kg moved</Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.timerControls}>
                <RestTimer />
              </View>
            </GlassCard>

            {session ? (
              <GlassCard style={styles.dateCard}>
                <DateField
                  label="Workout date"
                  value={session.date}
                  onChange={(next) => {
                    if (next) void setDate(next);
                  }}
                  // 'event': a workout happened on a day, so the quick picks
                  // offer today and yesterday rather than future deadlines.
                  mode="event"
                  allowClear={false}
                />
              </GlassCard>
            ) : null}
          </FadeInView>

          {blocks.map((block, index) => (
            <FadeInView key={block.exerciseId} delay={Math.min(index, 6) * 50}>
              <ExerciseBlock
                name={block.exercise?.name ?? 'Exercise'}
                trackingType={block.exercise?.tracking_type ?? 'reps'}
                sets={block.sets}
                prSetIds={prs}
                onLog={(value, weight) =>
                  logSet({
                    exercise_id: block.exerciseId,
                    // Exactly one of the two, decided by the exercise. The
                    // database enforces the same rule, so a mismatch here is
                    // rejected rather than silently stored.
                    reps: block.exercise?.tracking_type === 'time' ? null : value,
                    duration_seconds:
                      block.exercise?.tracking_type === 'time' ? value : null,
                    weight_kg: weight,
                    rpe: null,
                  })
                }
                onRemoveSet={removeSet}
              />
            </FadeInView>
          ))}

          <FadeInView delay={120}>
            <Button
              label="Add exercise"
              icon="add"
              variant="glass"
              onPress={pickExercise}
              style={styles.addExercise}
            />

            <GlassCard style={styles.notesCard}>
              <Text style={styles.label}>Notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                // Saved on blur rather than per keystroke: a write per character
                // would be dozens of requests for one sentence.
                onBlur={() => void saveNotes(notes)}
                placeholder="How did it go?"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.primary}
                style={styles.notesInput}
                multiline
              />
            </GlassCard>
          </FadeInView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </FormScroll>

      {/*
        Blocks already in the session are shown disabled rather than hidden, so
        you can see the lift is present instead of hunting for a missing row.
        Single-select: mid-session you add one exercise, do it, then add the
        next - there is nothing to batch.
      */}
      <PickerSheet
        visible={picking}
        title="Add an exercise"
        items={exercises.map((exercise) => ({
          id: exercise.id,
          label: exercise.name,
          group: normaliseMuscle(exercise.muscle_group),
          disabled: blocks.some((block) => block.exerciseId === exercise.id),
          note: blocks.some((block) => block.exerciseId === exercise.id)
            ? 'Already added'
            : undefined,
        }))}
        emptyText="No exercises yet. Add some in the Plan tab."
        onSelect={(ids) => ids.forEach(addExerciseToSession)}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

/**
 * One exercise and its sets, with the entry row underneath.
 *
 * Weight and reps default to the previous set's values, because the second set
 * is usually the same as the first. Retyping identical numbers five times is
 * the fastest way to stop logging.
 */
function ExerciseBlock({
  name,
  trackingType,
  sets,
  prSetIds,
  onLog,
  onRemoveSet,
}: {
  name: string;
  trackingType: TrackingType;
  sets: SessionSet[];
  prSetIds: Record<string, { previousBest: number | null }>;
  /** `value` is reps for a counted exercise and seconds for a held one. */
  onLog: (value: number, weight: number) => Promise<unknown>;
  onRemoveSet: (id: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const timed = trackingType === 'time';
  const last = sets[sets.length - 1];

  // Seeded from the previous set, because the next one is usually the same.
  const [weight, setWeight] = useState(last ? String(last.weight_kg) : '');
  const [value, setValue] = useState(
    last ? String(timed ? (last.duration_seconds ?? '') : (last.reps ?? '')) : '',
  );
  const [saving, setSaving] = useState(false);

  const parse = () => {
    const parsedWeight = Number(weight.trim());
    const parsedValue = Number(value.trim());

    // Weight of 0 is valid - bodyweight - but a set of nothing is not.
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) return null;
    if (!Number.isInteger(parsedValue) || parsedValue <= 0) return null;

    return { parsedWeight, parsedValue };
  };

  const handleLog = async () => {
    const parsed = parse();
    if (!parsed) return;

    setSaving(true);
    await onLog(parsed.parsedValue, parsed.parsedWeight);
    setSaving(false);
  };

  /**
   * Log another set identical to the last one.
   *
   * Three sets of the same thing is the ordinary case, and retyping the same
   * two numbers three times is the part that made per-set logging feel like
   * paperwork. This keeps every set its own row - which is what makes personal
   * records honest - while costing one tap instead of two fields.
   */
  const repeatLast = async () => {
    if (!last) return;
    const lastValue = timed ? last.duration_seconds : last.reps;
    if (lastValue == null) return;

    setSaving(true);
    await onLog(lastValue, last.weight_kg);
    setSaving(false);
  };

  return (
    <GlassCard style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle}>{name}</Text>
        {timed ? (
          <View style={styles.timedTag}>
            <Ionicons name="timer-outline" size={11} color={colors.accentCyan} />
            <Text style={styles.timedTagText}>Timed</Text>
          </View>
        ) : null}
      </View>

      {sets.map((set, index) => {
        const pr = prSetIds[set.id];
        return (
          <View key={set.id} style={styles.setRow}>
            {/* Position in the list, not set.set_number. The stored number only
                has to order the sets and never be reused; deleting a middle set
                leaves a gap in it, and showing "1, 3, 4" would read as a bug. */}
            <Text style={styles.setNumber}>{index + 1}</Text>
            <Text style={styles.setText}>
              {formatSet(set.weight_kg, set.reps, set.duration_seconds)}
            </Text>

            {pr ? (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={11} color={colors.warning} />
                <Text style={styles.prText}>
                  PR{pr.previousBest !== null ? ` · was ${pr.previousBest}` : ''}
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => onRemoveSet(set.id)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Delete this set"
            >
              <Ionicons name="close" size={15} color={colors.textMuted} />
            </Pressable>
          </View>
        );
      })}

      <View style={styles.entryRow}>
        <TextInput
          value={weight}
          onChangeText={setWeight}
          placeholder="kg"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          style={styles.entryInput}
        />
        <Text style={styles.times}>×</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={timed ? 'sec' : 'reps'}
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          style={styles.entryInput}
        />

        <Pressable
          onPress={handleLog}
          disabled={saving}
          style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Log this set"
        >
          <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
        </Pressable>
      </View>

      {last ? (
        <Pressable
          onPress={repeatLast}
          disabled={saving}
          style={({ pressed }) => [styles.repeatRow, pressed && styles.repeatRowPressed]}
          accessibilityRole="button"
        >
          <Ionicons name="repeat" size={13} color={colors.primary} />
          <Text style={styles.repeatText}>
            Repeat {formatSet(last.weight_kg, last.reps, last.duration_seconds)}
          </Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  dateCard: {
    marginTop: spacing.md,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  timedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.accentCyan + '1F',
  },
  timedTagText: {
    ...typography.caption,
    fontSize: 10.5,
    color: colors.accentCyan,
  },
  repeatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.primary + '14',
  },
  repeatRowPressed: {
    opacity: 0.6,
  },
  repeatText: {
    ...typography.caption,
    color: colors.primary,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.overline,
  },

  timerCard: {
    marginBottom: spacing.lg,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerControls: {
    marginTop: spacing.md,
  },
  volume: {
    ...typography.caption,
    marginTop: 2,
  },

  block: {
    marginBottom: spacing.md,
  },
  blockTitle: {
    ...typography.title,
    fontSize: 15,
    marginBottom: spacing.md,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 5,
  },
  setNumber: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    width: 16,
  },
  setText: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontVariant: ['tabular-nums'],
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.warning + '1F',
  },
  prText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.warning,
  },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  entryInput: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.glass,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  times: {
    ...typography.caption,
    color: colors.textMuted,
  },
  logButton: {
    width: 40,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },

  addExercise: {
    marginTop: spacing.sm,
  },
  notesCard: {
    marginTop: spacing.lg,
  },
  notesInput: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    marginTop: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
}));
