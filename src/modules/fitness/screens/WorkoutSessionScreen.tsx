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
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate } from '../../../core/date';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { PickerSheet } from '../components/PickerSheet';
import { RestTimer } from '../components/RestTimer';
import { formatSet, type SessionSet } from '../types';
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
    reload,
    setExerciseOrder,
    addExerciseToSession,
    logSet,
    removeSet,
    saveNotes,
  } = useWorkoutSession(sessionId);

  const [notes, setNotes] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);
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

  useEffect(() => {
    if (session && !notesLoaded) {
      setNotes(session.notes);
      setNotesLoaded(true);
    }
  }, [session, notesLoaded]);

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
          </FadeInView>

          {blocks.map((block, index) => (
            <FadeInView key={block.exerciseId} delay={Math.min(index, 6) * 50}>
              <ExerciseBlock
                name={block.exercise?.name ?? 'Exercise'}
                sets={block.sets}
                prSetIds={prs}
                onLog={(reps, weight, rpe) =>
                  logSet({
                    exercise_id: block.exerciseId,
                    reps,
                    weight_kg: weight,
                    rpe,
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
        </ScrollView>
      </KeyboardAvoidingView>

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
          group: exercise.muscle_group,
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
  sets,
  prSetIds,
  onLog,
  onRemoveSet,
}: {
  name: string;
  sets: SessionSet[];
  prSetIds: Record<string, { previousBest: number | null }>;
  onLog: (reps: number, weight: number, rpe: number | null) => Promise<unknown>;
  onRemoveSet: (id: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const last = sets[sets.length - 1];
  const [weight, setWeight] = useState(last ? String(last.weight_kg) : '');
  const [reps, setReps] = useState(last ? String(last.reps) : '');
  const [saving, setSaving] = useState(false);

  const handleLog = async () => {
    const parsedWeight = Number(weight.trim());
    const parsedReps = Number(reps.trim());
    // Weight of 0 is valid (bodyweight); reps of 0 is not a set.
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0) return;
    if (!Number.isInteger(parsedReps) || parsedReps <= 0) return;

    setSaving(true);
    await onLog(parsedReps, parsedWeight, null);
    setSaving(false);
  };

  return (
    <GlassCard style={styles.block}>
      <Text style={styles.blockTitle}>{name}</Text>

      {sets.map((set, index) => {
        const pr = prSetIds[set.id];
        return (
          <View key={set.id} style={styles.setRow}>
            {/*
              Position in the list, not set.set_number. The stored number only
              has to order the sets and never be reused; deleting a middle set
              leaves a gap in it, and showing "1, 3, 4" would read as a bug.
            */}
            <Text style={styles.setNumber}>{index + 1}</Text>
            <Text style={styles.setText}>{formatSet(set.weight_kg, set.reps)}</Text>

            {pr ? (
              <View style={styles.prBadge}>
                <Ionicons name="trophy" size={11} color={colors.warning} />
                <Text style={styles.prText}>
                  PR{pr.previousBest !== null ? ` · was ${pr.previousBest}` : ''}
                </Text>
              </View>
            ) : null}

            <Pressable onPress={() => onRemoveSet(set.id)} hitSlop={10}>
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
          selectionColor={colors.primary}
          style={styles.entryInput}
          maxLength={6}
        />
        <Text style={styles.times}>x</Text>
        <TextInput
          value={reps}
          onChangeText={setReps}
          placeholder="reps"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          selectionColor={colors.primary}
          style={styles.entryInput}
          onSubmitEditing={handleLog}
          maxLength={3}
        />
        <Pressable
          onPress={handleLog}
          disabled={saving}
          style={({ pressed }) => [styles.logButton, pressed && styles.pressed]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Ionicons name="checkmark" size={17} color={colors.onPrimary} />
          )}
        </Pressable>
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
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
