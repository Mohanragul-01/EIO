/**
 * RoutineEditScreen - build or edit a routine template.
 *
 * A routine holds no training. It is a named, ordered list of exercises with
 * target sets and reps, and its only job is to pre-fill a session. Keeping that
 * separation is what lets you skip a planned exercise without the log claiming
 * you did it.
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
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, FadeInView, GlassCard, Screen, TextField } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import type { Exercise } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RoutineEdit'>;
type Route = RouteProp<RootStackParamList, 'RoutineEdit'>;

/** One row being edited. exercise_id is the identity; position is the order. */
type Entry = {
  exercise_id: string;
  target_sets: string;
  target_reps: string;
};

export function RoutineEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const routineId = route.params?.routineId;
  const isEditing = !!routineId;

  const [name, setName] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit routine' : 'New routine' });
  }, [navigation, isEditing]);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const exerciseRows = await api.listExercises();
        if (!active) return;
        setExercises(exerciseRows);

        if (routineId) {
          const [routines, routineExercises] = await Promise.all([
            api.listRoutines(),
            api.listRoutineExercises(routineId),
          ]);
          if (!active) return;

          setName(routines.find((r) => r.id === routineId)?.name ?? '');
          setEntries(
            routineExercises.map((row) => ({
              exercise_id: row.exercise_id,
              target_sets: row.target_sets ? String(row.target_sets) : '',
              target_reps: row.target_reps ? String(row.target_reps) : '',
            })),
          );
        }
      } catch (e) {
        if (active) {
          Alert.alert('Could not load', e instanceof Error ? e.message : 'Please try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [routineId]);

  const addEntry = () => {
    // Only exercises not already in the routine: the same lift twice in one
    // template is almost always a mis-tap, and it would make the pre-filled
    // session show two identical blocks.
    const available = exercises.filter(
      (exercise) => !entries.some((entry) => entry.exercise_id === exercise.id),
    );

    if (available.length === 0) {
      Alert.alert(
        exercises.length === 0 ? 'No exercises' : 'All added',
        exercises.length === 0
          ? 'Add some exercises in the Plan tab first.'
          : 'Every exercise you have is already in this routine.',
      );
      return;
    }

    Alert.alert('Add to routine', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...available.slice(0, 8).map((exercise) => ({
        text: exercise.name,
        onPress: () =>
          setEntries((current) => [
            ...current,
            { exercise_id: exercise.id, target_sets: '', target_reps: '' },
          ]),
      })),
    ]);
  };

  const updateEntry = (index: number, patch: Partial<Entry>) =>
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );

  const removeEntry = (index: number) =>
    setEntries((current) => current.filter((_, i) => i !== index));

  /** Move a row up or down. Position is the only ordering, so this is the edit. */
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    setEntries((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the routine a name');
      return;
    }
    if (entries.length === 0) {
      Alert.alert('Add an exercise', 'A routine with nothing in it would pre-fill nothing.');
      return;
    }

    setNameError(null);
    setSaving(true);

    try {
      await api.saveRoutine(
        { id: routineId, name: trimmed },
        entries.map((entry) => ({
          exercise_id: entry.exercise_id,
          // Blank means "no target", which is different from zero. Null keeps
          // that distinction in the database rather than flattening it.
          target_sets: entry.target_sets.trim() ? Number(entry.target_sets) : null,
          target_reps: entry.target_reps.trim() ? Number(entry.target_reps) : null,
        })),
      );
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
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
            <GlassCard>
              <TextField
                label="Name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError(null);
                }}
                placeholder="Push day, Legs, Full body"
                error={nameError}
                autoFocus={!isEditing}
                maxLength={60}
              />
            </GlassCard>
          </FadeInView>

          <FadeInView delay={60}>
            <Text style={styles.sectionLabel}>Exercises</Text>

            {entries.map((entry, index) => {
              const exercise = exercises.find((e) => e.id === entry.exercise_id);
              return (
                <GlassCard key={entry.exercise_id} style={styles.entryCard}>
                  <View style={styles.entryHeader}>
                    <Text style={styles.entryName}>{exercise?.name ?? 'Exercise'}</Text>
                    <View style={styles.entryActions}>
                      <Pressable onPress={() => move(index, -1)} hitSlop={8}>
                        <Ionicons
                          name="chevron-up"
                          size={16}
                          color={index === 0 ? colors.textFaint : colors.textSecondary}
                        />
                      </Pressable>
                      <Pressable onPress={() => move(index, 1)} hitSlop={8}>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={
                            index === entries.length - 1 ? colors.textFaint : colors.textSecondary
                          }
                        />
                      </Pressable>
                      <Pressable onPress={() => removeEntry(index)} hitSlop={8}>
                        <Ionicons name="close" size={16} color={colors.textMuted} />
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.targetRow}>
                    <TextInput
                      value={entry.target_sets}
                      onChangeText={(text) => updateEntry(index, { target_sets: text })}
                      placeholder="sets"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="number-pad"
                      selectionColor={colors.primary}
                      style={styles.targetInput}
                      maxLength={2}
                    />
                    <Text style={styles.times}>x</Text>
                    <TextInput
                      value={entry.target_reps}
                      onChangeText={(text) => updateEntry(index, { target_reps: text })}
                      placeholder="reps"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="number-pad"
                      selectionColor={colors.primary}
                      style={styles.targetInput}
                      maxLength={3}
                    />
                    <Text style={styles.targetHint}>Targets are optional</Text>
                  </View>
                </GlassCard>
              );
            })}

            <Button
              label="Add exercise"
              icon="add"
              variant="glass"
              onPress={addEntry}
              style={styles.addButton}
            />
          </FadeInView>

          <FadeInView delay={120}>
            <Button
              label={isEditing ? 'Save routine' : 'Create routine'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  entryCard: {
    marginBottom: spacing.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryName: {
    ...typography.title,
    fontSize: 14.5,
    flex: 1,
  },
  entryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  targetInput: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.glass,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    minWidth: 62,
    textAlign: 'center',
  },
  times: {
    ...typography.caption,
    color: colors.textMuted,
  },
  targetHint: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    flex: 1,
    textAlign: 'right',
  },
  addButton: {
    marginTop: spacing.sm,
  },
  save: {
    marginTop: spacing.xxl,
  },
}));
