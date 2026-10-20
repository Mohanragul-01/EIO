/**
 * RoutineEditScreen - build or edit a routine template.
 *
 * A routine holds no training. It is a named, ordered list of slots, and its
 * only job is to lay out a session. Keeping that separation is what lets you
 * skip a planned exercise without the log claiming you did it.
 *
 * A SLOT is an exercise, or a LADDER. A ladder slot becomes the ladder's
 * current rung each time a session starts, so a calisthenics routine written
 * once never needs editing as you progress. Targets are ranges ("8-12 reps",
 * "20-30 s"): the bottom is what you aim for first, the top is what earns the
 * next step - more weight for a lift (by the increment), the next rung for a
 * ladder. Rest and a superset letter are per slot too.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  Button,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  TextField,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { PickerSheet } from '../components/PickerSheet';
import { visibleInMode } from '../mode';
import { formatDuration, normaliseMuscle, type Exercise, type FitnessMode } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'RoutineEdit'>;
type Route = RouteProp<RootStackParamList, 'RoutineEdit'>;

/** One slot being edited. Text fields hold exactly what was typed. */
type SlotDraft = {
  key: string;
  exercise_id: string | null;
  progression_id: string | null;
  sets: string;
  min: string;
  max: string;
  rest: string;
  increment: string;
  pair: string | null;
};

const PAIRS = ['A', 'B', 'C'];
let keySeq = 0;
const newKey = () => `s${++keySeq}`;

/** '' -> null, otherwise a positive whole number or NaN. */
function wholeOrNull(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

export function RoutineEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const routineId = route.params?.routineId;
  const isEditing = !!routineId;

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [mode, setMode] = useState<FitnessMode>(route.params?.mode ?? 'gym');
  const [slots, setSlots] = useState<SlotDraft[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [ladders, setLadders] = useState<api.Ladder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<'exercise' | 'ladder' | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit routine' : 'New routine' });
  }, [navigation, isEditing]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [library, ladderRows, routines, rows] = await Promise.all([
          api.listExercises(),
          api.listLadders(),
          routineId ? api.listRoutines() : Promise.resolve([]),
          routineId ? api.listRoutineExercises(routineId) : Promise.resolve([]),
        ]);
        if (!active) return;
        setExercises(library);
        setLadders(ladderRows);
        if (routineId) {
          const routine = routines.find((r) => r.id === routineId);
          setName(routine?.name ?? '');
          if (routine) setMode(routine.mode);
          setSlots(
            rows.map((row) => {
              const timed = row.target_seconds_max !== null || row.target_seconds_min !== null;
              const text = (n: number | null) => (n === null ? '' : String(n));
              return {
                key: newKey(),
                exercise_id: row.exercise_id,
                progression_id: row.progression_id,
                sets: text(row.target_sets),
                min: timed ? text(row.target_seconds_min) : text(row.target_reps_min),
                max: timed ? text(row.target_seconds_max) : text(row.target_reps),
                rest: text(row.rest_seconds),
                increment: text(row.increment_kg),
                pair: row.pair_group,
              };
            }),
          );
        }
      } catch (e) {
        if (active)
          Alert.alert('Could not load', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [routineId]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const ladderById = useMemo(() => new Map(ladders.map((l) => [l.progression.id, l])), [ladders]);

  /** A slot's measure: an exercise's own, or the ladder's current rung's. */
  const isTimed = (slot: SlotDraft): boolean => {
    if (slot.exercise_id) return byId.get(slot.exercise_id)?.tracking_type === 'time';
    const ladder = slot.progression_id ? ladderById.get(slot.progression_id) : undefined;
    const rung = ladder?.steps.find((s) => s.id === ladder.progression.current_step_id);
    return !!rung && rung.goal_seconds !== null;
  };

  const update = (key: string, patch: Partial<SlotDraft>) =>
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (key: string, delta: -1 | 1) =>
    setSlots((list) => {
      const i = list.findIndex((s) => s.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const blank = (patch: Partial<SlotDraft>): SlotDraft => ({
    key: newKey(),
    exercise_id: null,
    progression_id: null,
    sets: '3',
    min: '',
    max: '',
    rest: '',
    increment: '',
    pair: null,
    ...patch,
  });

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the routine a name');
      return;
    }
    if (slots.length === 0) {
      Alert.alert('Add an exercise', 'A routine with nothing in it would lay out nothing.');
      return;
    }
    const parsed = slots.map((slot) => {
      const timed = isTimed(slot);
      const min = wholeOrNull(slot.min);
      const max = wholeOrNull(slot.max);
      const sets = wholeOrNull(slot.sets);
      const rest = slot.rest.trim() ? Number(slot.rest) : null;
      const increment = slot.increment.trim() ? Number(slot.increment.replace(',', '.')) : null;
      return { slot, timed, min, max, sets, rest, increment };
    });
    const bad = parsed.find(
      (p) =>
        Number.isNaN(p.min) ||
        Number.isNaN(p.max) ||
        Number.isNaN(p.sets) ||
        (p.min !== null && p.max !== null && p.min > p.max) ||
        (p.rest !== null && !(Number.isInteger(p.rest) && p.rest >= 0 && p.rest <= 900)) ||
        (p.increment !== null && !(p.increment > 0 && p.increment < 100)),
    );
    if (bad) {
      const label = bad.slot.exercise_id
        ? (byId.get(bad.slot.exercise_id)?.name ?? 'A slot')
        : (ladderById.get(bad.slot.progression_id ?? '')?.progression.name ?? 'A slot');
      Alert.alert('Check the targets', `${label}: use whole numbers, with the low end first.`);
      return;
    }

    setNameError(null);
    setSaving(true);
    try {
      await api.saveRoutine(
        { id: routineId, name: trimmed, mode },
        parsed.map(({ slot, timed, min, max, sets, rest, increment }) => ({
          exercise_id: slot.exercise_id,
          progression_id: slot.progression_id,
          target_sets: sets,
          target_reps: timed ? null : max,
          target_reps_min: timed ? null : min,
          target_seconds_min: timed ? min : null,
          target_seconds_max: timed ? max : null,
          rest_seconds: rest,
          increment_kg: increment,
          pair_group: slot.pair,
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
      <FormScroll contentContainerStyle={styles.scroll}>
        <FadeInView>
          <GlassCard>
            <TextField
              label="Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (nameError) setNameError(null);
              }}
              placeholder={
                mode === 'calisthenics' ? 'Day A, Skills, Pull' : 'Push day, Legs, Full body'
              }
              error={nameError}
              autoFocus={!isEditing}
              maxLength={60}
            />
            <Text style={styles.hint}>
              {mode === 'calisthenics' ? 'A calisthenics routine.' : 'A gym routine.'} Ranges are
              optional: the low end is what to aim for, the top earns the next step.
            </Text>
          </GlassCard>
        </FadeInView>

        <Text style={styles.sectionLabel}>Slots</Text>

        {slots.map((slot, index) => {
          const ladder = slot.progression_id ? ladderById.get(slot.progression_id) : undefined;
          const rung = ladder?.steps.find((s) => s.id === ladder.progression.current_step_id);
          const exercise = slot.exercise_id ? byId.get(slot.exercise_id) : undefined;
          const timed = isTimed(slot);
          const title = ladder ? ladder.progression.name : (exercise?.name ?? 'Exercise');
          const unit = timed ? 's' : 'reps';
          return (
            <GlassCard key={slot.key} style={styles.slot}>
              <View style={styles.slotHead}>
                <View style={styles.slotTitle}>
                  <Text style={styles.slotName} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={styles.slotKind}>
                    {ladder
                      ? `Ladder · now ${rung ? (byId.get(rung.exercise_id)?.name ?? 'a rung') : 'not started'}`
                      : timed
                        ? 'Held'
                        : exercise?.load_mode === 'bodyweight'
                          ? 'Bodyweight'
                          : 'Weights'}
                  </Text>
                </View>
                <IconButton
                  icon="arrow-up"
                  label="Move up"
                  disabled={index === 0}
                  onPress={() => move(slot.key, -1)}
                />
                <IconButton
                  icon="arrow-down"
                  label="Move down"
                  disabled={index === slots.length - 1}
                  onPress={() => move(slot.key, 1)}
                />
                <IconButton
                  icon="close"
                  label={`Remove ${title} from this routine`}
                  onPress={() => setSlots((list) => list.filter((s) => s.key !== slot.key))}
                />
              </View>

              <View style={styles.fields}>
                <Field
                  label="Sets"
                  value={slot.sets}
                  onChange={(t) => update(slot.key, { sets: t })}
                />
                {ladder ? (
                  <View style={[styles.field, styles.ladderNote]}>
                    <Text style={styles.hint}>
                      Targets follow the rung
                      {rung
                        ? `: ${rung.goal_seconds ?? rung.goal_reps}${rung.goal_seconds ? 's' : ''} to master it`
                        : ''}
                      .
                    </Text>
                  </View>
                ) : (
                  <>
                    <Field
                      label={`From (${unit})`}
                      value={slot.min}
                      onChange={(t) => update(slot.key, { min: t })}
                    />
                    <Field
                      label={`To (${unit})`}
                      value={slot.max}
                      onChange={(t) => update(slot.key, { max: t })}
                    />
                  </>
                )}
              </View>
              <View style={styles.fields}>
                <Field
                  label="Rest (s)"
                  value={slot.rest}
                  placeholder={
                    exercise?.default_rest_seconds ? String(exercise.default_rest_seconds) : '90'
                  }
                  onChange={(t) => update(slot.key, { rest: t })}
                />
                {exercise && exercise.load_mode === 'external' && !timed ? (
                  <Field
                    label="+kg when earned"
                    value={slot.increment}
                    placeholder="2.5"
                    decimal
                    onChange={(t) => update(slot.key, { increment: t })}
                  />
                ) : (
                  <View style={styles.field} />
                )}
              </View>

              <View style={styles.pairRow}>
                <Text style={styles.fieldLabel}>Superset</Text>
                {[null, ...PAIRS].map((letter) => {
                  const selected = slot.pair === letter;
                  return (
                    <Pressable
                      key={letter ?? 'none'}
                      onPress={() => update(slot.key, { pair: letter })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={letter ? `Superset ${letter}` : 'Not in a superset'}
                      style={[styles.pairChip, selected && styles.pairChipSelected]}
                    >
                      <Text style={[styles.pairText, selected && styles.pairTextSelected]}>
                        {letter ?? 'None'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {slot.rest.trim() && Number(slot.rest) > 0 ? (
                <Text style={styles.hint}>
                  Rest {formatDuration(Number(slot.rest))} after each set.
                </Text>
              ) : null}
            </GlassCard>
          );
        })}

        <View style={styles.addRow}>
          <Button
            label="Add exercise"
            icon="add"
            variant="glass"
            onPress={() => setPicking('exercise')}
            style={styles.addButton}
          />
          {ladders.length > 0 ? (
            <Button
              label="Add ladder"
              icon="git-commit-outline"
              variant="glass"
              onPress={() => setPicking('ladder')}
              style={styles.addButton}
            />
          ) : null}
        </View>

        <Button
          label={isEditing ? 'Save routine' : 'Create routine'}
          icon="checkmark"
          onPress={() => void handleSave()}
          loading={saving}
          style={styles.save}
        />
      </FormScroll>

      {/*
        Multi-select: building a routine means picking six exercises at once,
        and reopening the sheet for each would be six times the taps.
      */}
      <PickerSheet
        visible={picking === 'exercise'}
        title="Add to routine"
        multiple
        items={exercises
          .filter((e) => visibleInMode(e, mode))
          .map((exercise) => {
            const already = slots.some((s) => s.exercise_id === exercise.id);
            return {
              id: exercise.id,
              label: exercise.name,
              group: normaliseMuscle(exercise.muscle_group),
              disabled: already,
              note: already ? 'Already added' : undefined,
            };
          })}
        emptyText="No exercises in this mode yet."
        onSelect={(ids) =>
          setSlots((list) => [
            ...list,
            ...ids.map((id) => {
              const exercise = byId.get(id);
              const timed = exercise?.tracking_type === 'time';
              return blank({
                exercise_id: id,
                min: timed ? '20' : exercise?.load_mode === 'bodyweight' ? '5' : '8',
                max: timed ? '30' : exercise?.load_mode === 'bodyweight' ? '10' : '12',
              });
            }),
          ])
        }
        onClose={() => setPicking(null)}
      />
      <PickerSheet
        visible={picking === 'ladder'}
        title="Follow a ladder"
        items={ladders.map((l) => {
          const already = slots.some((s) => s.progression_id === l.progression.id);
          return {
            id: l.progression.id,
            label: l.progression.name,
            disabled: already,
            note: already ? 'Already added' : 'Uses whichever rung you are on',
          };
        })}
        emptyText="No ladders yet. Make one in Skills."
        onSelect={(ids) =>
          setSlots((list) => [...list, ...ids.map((id) => blank({ progression_id: id }))])
        }
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  decimal?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        style={styles.input}
        accessibilityLabel={label}
      />
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.iconButton, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  sectionLabel: { ...typography.overline, marginTop: spacing.xl, marginBottom: spacing.md },
  hint: { ...typography.caption, marginTop: spacing.xs },
  slot: { marginBottom: spacing.md, gap: spacing.sm },
  slotHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  slotTitle: { flex: 1 },
  slotName: { ...typography.title },
  slotKind: { ...typography.caption },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  fields: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  ladderNote: { flex: 2, justifyContent: 'flex-end', paddingBottom: spacing.sm },
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
  pairRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  pairChip: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pairText: { ...typography.caption, color: colors.textSecondary },
  pairTextSelected: { color: colors.onPrimary },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  addButton: { flex: 1 },
  save: { marginTop: spacing.xl },
}));
