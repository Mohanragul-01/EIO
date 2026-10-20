/**
 * LadderEditScreen - build or change a ladder.
 *
 * A ladder is a name, a family (for grouping), and an ordered list of rungs.
 * Each rung is an exercise from your library with a graduation goal - so many
 * sets of so many reps (or seconds), optionally with added weight - plus
 * where to restart right after moving up to it, and a one-line cue for what
 * a clean rep looks like there.
 *
 * Rungs keep their identity through edits, so the dates you mastered them
 * survive renaming or reordering. Taking a rung out deletes its history of
 * moves, and the save asks before doing that.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  Button,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  useToast,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { PickerSheet } from '../components/PickerSheet';
import { visibleInMode } from '../mode';
import type { Exercise, Progression, ProgressionFamily } from '../types';
import { normaliseMuscle } from '../types';
import { FAMILIES, FAMILY_LABEL } from '../useLadders';

type Nav = NativeStackNavigationProp<RootStackParamList, 'LadderEdit'>;
type Route = RouteProp<RootStackParamList, 'LadderEdit'>;

type RungDraft = {
  key: string;
  id?: string;
  exercise_id: string;
  goalSets: string;
  goal: string;
  added: string;
  start: string;
  cue: string;
};

let keySeq = 0;
const newKey = () => `r${++keySeq}`;

const toInt = (text: string) => {
  const n = Number(text.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function LadderEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const progressionId = useRoute<Route>().params?.progressionId;
  const toast = useToast();

  const [loading, setLoading] = useState(!!progressionId);
  const [saving, setSaving] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [family, setFamily] = useState<ProgressionFamily>('pull');
  const [rule, setRule] = useState<Progression['level_up_rule']>('two_of_three');
  const [notes, setNotes] = useState('');
  const [rungs, setRungs] = useState<RungDraft[]>([]);
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  /** null: closed; 'add': appending; a key: replacing that rung's exercise. */
  const [picking, setPicking] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: progressionId ? 'Edit ladder' : 'New ladder' });
  }, [navigation, progressionId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [library, ladder] = await Promise.all([
          api.listExercises(),
          progressionId ? api.getLadder(progressionId) : Promise.resolve(null),
        ]);
        if (!active) return;
        setExercises(library);
        if (ladder) {
          setName(ladder.progression.name);
          setFamily(ladder.progression.family);
          setRule(ladder.progression.level_up_rule);
          setNotes(ladder.progression.notes);
          const ordered = [...ladder.steps].sort((a, b) => a.position - b.position);
          setOriginalIds(ordered.map((s) => s.id));
          setRungs(
            ordered.map((s) => ({
              key: newKey(),
              id: s.id,
              exercise_id: s.exercise_id,
              goalSets: String(s.goal_sets),
              goal: String(s.goal_seconds ?? s.goal_reps ?? ''),
              added: s.goal_added_kg ? String(s.goal_added_kg) : '',
              start: String(s.start_seconds ?? s.start_reps ?? ''),
              cue: s.cue,
            })),
          );
        }
      } catch (e) {
        if (active)
          toast.show({ message: e instanceof Error ? e.message : 'Could not load the ladder' });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [progressionId, toast]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const timed = (rung: RungDraft) => byId.get(rung.exercise_id)?.tracking_type === 'time';

  const update = (key: string, patch: Partial<RungDraft>) =>
    setRungs((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (key: string, delta: -1 | 1) =>
    setRungs((list) => {
      const i = list.findIndex((r) => r.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const problems = useMemo(() => {
    const list: string[] = [];
    if (!name.trim()) list.push('Give the ladder a name');
    if (rungs.length === 0) list.push('Add at least one rung');
    rungs.forEach((r, i) => {
      if (!toInt(r.goalSets) || !toInt(r.goal)) list.push(`Rung ${i + 1} needs a goal`);
    });
    return list;
  }, [name, rungs]);

  const save = async () => {
    if (problems.length > 0) {
      toast.show({ message: problems[0] });
      return;
    }
    const removed = originalIds.filter((id) => !rungs.some((r) => r.id === id));
    const proceed = async () => {
      setSaving(true);
      try {
        const id = await api.saveLadder(
          { id: progressionId, name: name.trim(), family, level_up_rule: rule, notes },
          rungs.map((r) => {
            const isTimed = timed(r);
            const added = Number(r.added.replace(',', '.'));
            return {
              id: r.id,
              exercise_id: r.exercise_id,
              goal_sets: toInt(r.goalSets) ?? 3,
              goal_reps: isTimed ? null : toInt(r.goal),
              goal_seconds: isTimed ? toInt(r.goal) : null,
              goal_added_kg: Number.isFinite(added) && added > 0 ? added : null,
              start_reps: isTimed ? null : toInt(r.start),
              start_seconds: isTimed ? toInt(r.start) : null,
              cue: r.cue.trim(),
            };
          }),
        );
        if (progressionId) navigation.goBack();
        else navigation.replace('Ladder', { progressionId: id });
      } catch (e) {
        toast.show({ message: e instanceof Error ? e.message : 'Could not save the ladder' });
      } finally {
        setSaving(false);
      }
    };
    if (removed.length > 0) {
      Alert.alert(
        `Remove ${removed.length} ${removed.length === 1 ? 'rung' : 'rungs'}?`,
        'Their history of moves on this ladder is deleted. Sets you logged are kept. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove and save', style: 'destructive', onPress: () => void proceed() },
        ],
      );
    } else {
      await proceed();
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
        <GlassCard>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Front lever"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Ladder name"
          />
          <Text style={[styles.label, styles.gap]}>Family</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {FAMILIES.map((f) => {
              const selected = f === family;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFamily(f)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {FAMILY_LABEL[f]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.label, styles.gap]}>Ask to move up after</Text>
          <SegmentedControl
            options={['two_of_three', 'one'] as Progression['level_up_rule'][]}
            value={rule}
            onChange={setRule}
            renderLabel={(r) => (r === 'two_of_three' ? '2 of the last 3' : '1 session')}
          />
          <Text style={styles.hint}>
            How many recent sessions on a rung must meet its goal, with clean sets, before you are
            asked.
          </Text>
        </GlassCard>

        <Text style={styles.section}>Rungs, easiest first</Text>
        {rungs.map((rung, index) => {
          const exercise = byId.get(rung.exercise_id);
          const isTimed = timed(rung);
          return (
            <GlassCard key={rung.key} style={styles.rung}>
              <View style={styles.rungHead}>
                <Text style={styles.rungNumber}>{index + 1}</Text>
                <Pressable
                  onPress={() => setPicking(rung.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Rung ${index + 1}: ${exercise?.name ?? 'pick an exercise'}. Change`}
                  style={styles.rungTitle}
                >
                  <Text style={styles.rungName} numberOfLines={2}>
                    {exercise?.name ?? 'Pick an exercise'}
                  </Text>
                  <Text style={styles.hint}>
                    {isTimed ? 'Held, in seconds' : 'Counted in reps'}
                  </Text>
                </Pressable>
                <IconButton
                  icon="arrow-up"
                  label="Move rung up"
                  disabled={index === 0}
                  onPress={() => move(rung.key, -1)}
                />
                <IconButton
                  icon="arrow-down"
                  label="Move rung down"
                  disabled={index === rungs.length - 1}
                  onPress={() => move(rung.key, 1)}
                />
                <IconButton
                  icon="close"
                  label="Remove rung"
                  onPress={() => setRungs((list) => list.filter((r) => r.key !== rung.key))}
                />
              </View>

              <View style={styles.fields}>
                <Field
                  label="Sets"
                  value={rung.goalSets}
                  onChange={(t) => update(rung.key, { goalSets: t })}
                />
                <Field
                  label={isTimed ? 'Seconds each' : 'Reps each'}
                  value={rung.goal}
                  onChange={(t) => update(rung.key, { goal: t })}
                />
                <Field
                  label="+kg (optional)"
                  value={rung.added}
                  decimal
                  onChange={(t) => update(rung.key, { added: t })}
                />
              </View>
              <View style={styles.fields}>
                <Field
                  label={isTimed ? 'Restart at (s)' : 'Restart at (reps)'}
                  value={rung.start}
                  onChange={(t) => update(rung.key, { start: t })}
                />
              </View>
              <TextInput
                value={rung.cue}
                onChangeText={(t) => update(rung.key, { cue: t })}
                placeholder="Cue: what a clean rep looks like here"
                placeholderTextColor={colors.textFaint}
                style={[styles.input, styles.cue]}
                accessibilityLabel={`Cue for rung ${index + 1}`}
              />
            </GlassCard>
          );
        })}

        <Button
          label="Add rung"
          icon="add"
          variant="glass"
          onPress={() => setPicking('add')}
          style={styles.add}
        />

        <GlassCard style={styles.gapTop}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything about this ladder"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.notes]}
            multiline
            accessibilityLabel="Ladder notes"
          />
        </GlassCard>

        <Button
          label="Save ladder"
          onPress={() => void save()}
          loading={saving}
          style={styles.save}
        />
      </FormScroll>

      <PickerSheet
        visible={picking !== null}
        title={picking === 'add' ? 'Add a rung' : 'Choose the exercise'}
        items={exercises
          .filter((e) => visibleInMode(e, 'calisthenics'))
          .map((e) => ({ id: e.id, label: e.name, group: normaliseMuscle(e.muscle_group) }))}
        emptyText="No calisthenics exercises yet. Add some in Skills, under Library."
        onSelect={([id]) => {
          if (!id) return;
          const exercise = byId.get(id);
          if (picking === 'add') {
            setRungs((list) => [
              ...list,
              {
                key: newKey(),
                exercise_id: id,
                goalSets: '3',
                goal: exercise?.tracking_type === 'time' ? '30' : '8',
                added: '',
                start: exercise?.tracking_type === 'time' ? '10' : '5',
                cue: '',
              },
            ]);
          } else if (picking) {
            update(picking, { exercise_id: id });
          }
        }}
        onClose={() => setPicking(null)}
      />
    </Screen>
  );
}

function Field({
  label,
  value,
  onChange,
  decimal = false,
}: {
  label: string;
  value: string;
  onChange: (text: string) => void;
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
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        placeholderTextColor={colors.textFaint}
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
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  label: { ...typography.overline, marginBottom: spacing.xs },
  gap: { marginTop: spacing.lg },
  gapTop: { marginTop: spacing.lg },
  hint: { ...typography.caption, marginTop: spacing.xs },
  section: { ...typography.overline, marginTop: spacing.xl, marginBottom: spacing.sm },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.accentCyan, borderColor: colors.accentCyan },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextSelected: { color: colors.onPrimary },
  rung: { marginBottom: spacing.md, gap: spacing.sm },
  rungHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rungNumber: { ...typography.h2, ...typography.numeric, width: 28, color: colors.accentCyan },
  rungTitle: { flex: 1, minHeight: 48, justifyContent: 'center' },
  rungName: { ...typography.title },
  iconButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.35 },
  fields: { flexDirection: 'row', gap: spacing.sm },
  field: { flex: 1 },
  fieldLabel: { ...typography.caption, marginBottom: 2 },
  cue: { fontFamily: typography.body.fontFamily },
  notes: { minHeight: 72, textAlignVertical: 'top', fontFamily: typography.body.fontFamily },
  add: { marginTop: spacing.xs },
  save: { marginTop: spacing.xl },
}));
