/**
 * WorkoutSessionScreen - logging a session, set by set.
 *
 * The loop, which everything here serves: look at last time, lift, tick. A
 * row's ghost values are last time's (or the routine's target), ticking saves
 * the set at once and starts the rest timer, and the rest bar floats where a
 * thumb can reach it. Records announce themselves with a toast and a medal.
 *
 * SAVE AS YOU GO is kept from v2: every set is written the moment it is
 * ticked, so a killed app or a dropped phone loses nothing. Finish is optional
 * and only stamps the end time; an unfinished session simply ends at its last
 * set.
 *
 * The screen stays awake while it is open (expo-keep-awake): a phone that
 * locks between every set is the most common complaint about gym loggers.
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  useToast,
} from '../../../core/components';
import { success, tap } from '../../../core/haptics';
import { ensurePermission } from '../../../core/notifications';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate } from '../../../core/date';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

import { supersetLabels, supersetNext } from '../blocks';
import { ExerciseBlock } from '../components/ExerciseBlock';
import { HoldDial } from '../components/HoldDial';
import { PickerSheet } from '../components/PickerSheet';
import { REST_BAR_HEIGHT, RestBar } from '../components/RestBar';
import { BlockMenu, LoadSheet, RestSheet, SetTypeSheet } from '../components/SessionSheets';
import { visibleInMode } from '../mode';
import { warmupSets } from '../plates';
import { primaryRecord } from '../records';
import { adjustRest, startRest, type RestState } from '../restTimer';
import { settleLoad } from '../sessionState';
import { formatDuration, normaliseMuscle, type SetType } from '../types';
import { usePlateInventory } from '../usePlateInventory';
import { useWorkoutSession } from '../useWorkoutSession';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorkoutSession'>;
type Route = RouteProp<RootStackParamList, 'WorkoutSession'>;

/** Asked once, the first time a rest timer runs: the end alert needs it. */
const REST_PERMISSION_ASKED = 'eio.fitness.rest-permission-asked';

type RowTarget = { blockId: string; key: string };

export function WorkoutSessionScreen() {
  useKeepAwake();
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { sessionId } = useRoute<Route>().params;
  const toast = useToast();
  const w = useWorkoutSession(sessionId);
  const { inventory } = usePlateInventory();

  const [picking, setPicking] = useState(false);
  /** Block whose superset partner is being picked, or whose exercise is being replaced. */
  const [supersetFor, setSupersetFor] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);
  /** Each block's top within the scroll content, for jumping to a superset partner. */
  const blockY = useRef<Record<string, number>>({});
  const [rest, setRestState] = useState<RestState>(null);
  const [setMenu, setSetMenu] = useState<RowTarget | null>(null);
  const [loadFor, setLoadFor] = useState<RowTarget | null>(null);
  const [blockMenu, setBlockMenu] = useState<string | null>(null);
  const [restFor, setRestFor] = useState<string | null>(null);
  const [holdFor, setHoldFor] = useState<RowTarget | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSeededFor, setNotesSeededFor] = useState<string | null>(null);

  // Seed the notes field once per session, during render: an effect would
  // paint an empty field first and then fill it.
  if (w.session && notesSeededFor !== w.session.id) {
    setNotesSeededFor(w.session.id);
    setNotes(w.session.notes);
  }

  const bandsById = useMemo(() => Object.fromEntries(w.bands.map((b) => [b.id, b])), [w.bands]);

  const confirmDelete = useCallback(() => {
    Alert.alert('Delete this workout', 'Every set in it is deleted too. This cannot be undone.', [
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
      title: w.session ? formatEventDate(w.session.date) : 'Workout',
      headerRight: () => (
        <Pressable
          onPress={confirmDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Delete this workout"
        >
          <Ionicons name="trash-outline" size={19} color={colors.textMuted} />
        </Pressable>
      ),
    });
  }, [navigation, w.session, confirmDelete, colors.textMuted]);

  // Back from the summary, which can reopen the session: take its end time
  // again, so the strip counts on and Finish works without leaving the screen.
  const { refreshSession } = w;
  useFocusEffect(
    useCallback(() => {
      void refreshSession();
    }, [refreshSession]),
  );

  // A session deleted elsewhere (the website) has nothing to show.
  useEffect(() => {
    if (w.missing) navigation.goBack();
  }, [w.missing, navigation]);

  const beginRest = useCallback(async (seconds: number, exerciseId: string) => {
    setRestState(startRest(Date.now(), seconds, exerciseId));
    // The first rest ever is the moment the alert's purpose is obvious, so
    // that is when to ask - once.
    try {
      if (!(await AsyncStorage.getItem(REST_PERMISSION_ASKED))) {
        await AsyncStorage.setItem(REST_PERMISSION_ASKED, '1');
        await ensurePermission();
      }
    } catch {
      // Without permission the rest still ends with a vibration.
    }
  }, []);

  const onTick = useCallback(
    async (blockId: string, key: string, override?: { seconds: string }) => {
      const result = await w.tick(blockId, key, override);
      if (!result.ok) {
        if (result.reason) toast.show({ message: result.reason });
        return;
      }
      const record = primaryRecord(result.records);
      if (record) {
        success();
        const name = w.exercisesById[result.exerciseId]?.name ?? '';
        toast.show({ message: `New record · ${record.label}${name ? ` · ${name}` : ''}` });
      } else {
        tap();
      }
      // In a superset, ticking moves on to the partner and rests only after
      // the round; outside one, rest after every set and stay put.
      const flow = supersetNext(
        w.blocks.map((b) => ({
          id: b.id,
          supersetGroup: b.sessionExercise?.superset_group ?? null,
          rows: b.rows.map((r) => ({
            done: r.kind === 'saved' || (b.id === blockId && r.key === key),
          })),
        })),
        blockId,
        0,
      );
      if (result.restSeconds > 0 && flow.restAfter) {
        void beginRest(result.restSeconds, result.exerciseId);
      }
      if (flow.nextBlockId && flow.nextBlockId !== blockId) {
        const y = blockY.current[flow.nextBlockId];
        if (y !== undefined)
          scrollRef.current?.scrollTo({ y: Math.max(0, y - spacing.lg), animated: true });
      }
    },
    [w, toast, beginRest],
  );

  const onDelete = useCallback(
    (blockId: string, key: string) => {
      const undo = w.removeRow(blockId, key);
      if (undo) toast.show({ message: 'Set removed', actionLabel: 'Undo', onAction: undo });
    },
    [w, toast],
  );

  const onRestFinished = useCallback(() => setRestState(null), []);

  // SHEET TARGETS ---------------------------------------------------------------

  const menuBlock = w.blocks.find((b) => b.id === setMenu?.blockId);
  const menuRowIndex = menuBlock?.rows.findIndex((r) => r.key === setMenu?.key) ?? -1;
  const menuRow = menuBlock?.rows[menuRowIndex];
  const menuValues = menuRow
    ? menuRow.kind === 'saved'
      ? { set_type: menuRow.set.set_type, rpe: menuRow.set.rpe, clean: menuRow.set.clean }
      : { set_type: menuRow.draft.set_type, rpe: menuRow.draft.rpe, clean: menuRow.draft.clean }
    : null;

  const loadBlock = w.blocks.find((b) => b.id === loadFor?.blockId);
  const loadRow = loadBlock?.rows.find((r) => r.key === loadFor?.key);
  const loadDraft = loadRow && loadRow.kind === 'draft' ? loadRow.draft : null;

  const menuForBlock = w.blocks.find((b) => b.id === blockMenu);
  const menuBlockIndex = w.blocks.findIndex((b) => b.id === blockMenu);
  const restBlock = w.blocks.find((b) => b.id === restFor);

  // The hold timer's row: its goal (ghost), your best, and last time's.
  const holdBlock = w.blocks.find((b) => b.id === holdFor?.blockId);
  const holdIndex = holdBlock?.rows.findIndex((r) => r.key === holdFor?.key) ?? -1;
  const holdGhost = holdBlock && holdIndex >= 0 ? w.ghostFor(holdBlock, holdIndex) : null;
  const holdPrevious = holdBlock && holdIndex >= 0 ? w.previousFor(holdBlock, holdIndex) : null;
  const holdBest = holdBlock
    ? Math.max(
        0,
        ...(w.baseline[holdBlock.exerciseId] ?? [])
          .filter((s) => s.set_type !== 'warmup')
          .map((s) => s.duration_seconds ?? 0),
      )
    : 0;

  /** A block's working weight: the first working row's typed, saved or ghost weight. */
  const workingWeight = (block: (typeof w.blocks)[number]): number | null => {
    const index = block.rows.findIndex((r) =>
      r.kind === 'saved' ? r.set.set_type !== 'warmup' : r.draft.set_type !== 'warmup',
    );
    if (index < 0) return null;
    const row = block.rows[index];
    const typed =
      row.kind === 'saved' ? row.set.weight_kg : Number(row.draft.weight.replace(',', '.')) || null;
    const value = typed || w.ghostFor(block, index).weight;
    return value && value > 0 ? value : null;
  };

  const supersetTags = supersetLabels(
    w.blocks.map((b) => ({ id: b.id, supersetGroup: b.sessionExercise?.superset_group ?? null })),
  );

  const restExerciseName = rest ? (w.exercisesById[rest.exerciseId]?.name ?? '') : '';

  if (w.loading) {
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
      <LiveStrip
        startedAt={w.stats.startedAt}
        endedAt={w.stats.endedAt}
        volume={w.stats.volume}
        sets={w.stats.workingSets}
        finished={!!w.session?.ended_at}
        onFinish={async () => {
          if (w.session?.ended_at) {
            navigation.navigate('WorkoutSummary', { sessionId });
            return;
          }
          if (await w.finish()) {
            setRestState(null);
            navigation.navigate('WorkoutSummary', { sessionId });
          }
        }}
      />

      <FormScroll
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: spacing.xxxl + (rest ? REST_BAR_HEIGHT + spacing.lg : 0) },
        ]}
      >
        {w.session ? (
          <FadeInView>
            <GlassCard style={styles.dateCard}>
              <DateField
                label="Workout date"
                value={w.session.date}
                onChange={(next) => {
                  if (next) void w.setDate(next);
                }}
                mode="event"
                allowClear={false}
              />
            </GlassCard>
          </FadeInView>
        ) : null}

        {w.blocks.length === 0 ? (
          <Text style={styles.empty}>Add an exercise to start logging.</Text>
        ) : null}

        {w.blocks.map((block, index) => (
          <View
            key={block.id}
            onLayout={(e) => {
              blockY.current[block.id] = e.nativeEvent.layout.y;
            }}
          >
            <FadeInView delay={Math.min(index, 6) * 40}>
              <ExerciseBlock
                block={block}
                exercise={w.exercisesById[block.exerciseId]}
                bandsById={bandsById}
                records={w.records}
                restSeconds={w.restFor(block)}
                supersetLabel={supersetTags[block.id] ?? null}
                targetReason={w.targetFor(block).reason}
                previousFor={(i) => w.previousFor(block, i)}
                ghostFor={(i) => w.ghostFor(block, i)}
                onOpenExercise={() =>
                  navigation.navigate('ExerciseProgress', {
                    exerciseId: block.exerciseId,
                    name: w.exercisesById[block.exerciseId]?.name ?? 'Exercise',
                  })
                }
                onMenu={() => setBlockMenu(block.id)}
                onRest={() => setRestFor(block.id)}
                onTick={(key) => void onTick(block.id, key)}
                onUntick={(key) => void w.untick(block.id, key)}
                onSetMenu={(key) => setSetMenu({ blockId: block.id, key })}
                onLoad={(key) => {
                  // The sheet edits the load the row shows: write last time's
                  // into the cells first, so clearing one there means none.
                  const index = block.rows.findIndex((r) => r.key === key);
                  const row = block.rows[index];
                  if (row?.kind === 'draft' && !row.draft.loadTyped) {
                    w.updateDraft(block.id, key, settleLoad(row.draft, w.ghostFor(block, index)));
                  }
                  setLoadFor({ blockId: block.id, key });
                }}
                onChangeDraft={(key, patch) => w.updateDraft(block.id, key, patch)}
                onDelete={(key) => onDelete(block.id, key)}
                onHold={(key) => setHoldFor({ blockId: block.id, key })}
                onAddSet={() => w.addRow(block.id)}
                onNoteBlur={(note) => void w.setBlockNote(block.id, note)}
              />
            </FadeInView>
          </View>
        ))}

        <Button
          label="Add exercise"
          icon="add"
          variant="glass"
          onPress={() => setPicking(true)}
          style={styles.addExercise}
        />

        <GlassCard style={styles.notesCard}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            onBlur={() => void w.saveNotes(notes)}
            placeholder="How did it go?"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            style={styles.notesInput}
            multiline
            accessibilityLabel="Workout notes"
          />
        </GlassCard>

        {w.error ? (
          <Pressable
            onPress={w.clearError}
            accessibilityRole="button"
            accessibilityLabel={`${w.error}. Dismiss`}
          >
            <Text style={styles.error}>{w.error}</Text>
          </Pressable>
        ) : null}
      </FormScroll>

      <RestBar
        state={rest}
        label={restExerciseName}
        onAdjust={(delta) => setRestState((r) => adjustRest(r, Date.now(), delta))}
        onSkip={() => setRestState(null)}
        onFinished={onRestFinished}
      />

      <PickerSheet
        visible={picking}
        title="Add an exercise"
        // The session's mode lists its own library ('both' shows in either),
        // so a calisthenics day is not a scroll past every machine.
        items={w.exercises
          .filter((e) => !w.session || visibleInMode(e, w.session.mode))
          .map((exercise) => {
            const added = w.blocks.some((b) => b.exerciseId === exercise.id);
            return {
              id: exercise.id,
              label: exercise.name,
              group: normaliseMuscle(exercise.muscle_group),
              disabled: added,
              note: added ? 'Already added' : undefined,
            };
          })}
        emptyText="No exercises yet. Add some in the Exercises tab."
        onSelect={(ids) => ids.forEach((id) => void w.addExercise(id))}
        onClose={() => setPicking(false)}
      />

      <PickerSheet
        visible={supersetFor !== null}
        title="Superset with"
        items={w.blocks
          .filter((b) => b.id !== supersetFor)
          .map((b) => ({
            id: b.id,
            label: w.exercisesById[b.exerciseId]?.name ?? 'Exercise',
            note: b.sessionExercise?.superset_group
              ? `Joins superset ${b.sessionExercise.superset_group}`
              : undefined,
          }))}
        emptyText="Add another exercise first."
        onSelect={([id]) => {
          if (supersetFor && id) void w.setSuperset(supersetFor, id);
        }}
        onClose={() => setSupersetFor(null)}
      />

      <PickerSheet
        visible={replaceFor !== null}
        title="Replace with"
        items={w.exercises
          .filter((e) => !w.session || visibleInMode(e, w.session.mode))
          .map((exercise) => {
            const added = w.blocks.some((b) => b.exerciseId === exercise.id);
            return {
              id: exercise.id,
              label: exercise.name,
              group: normaliseMuscle(exercise.muscle_group),
              disabled: added,
              note: added ? 'Already in this workout' : undefined,
            };
          })}
        emptyText="No other exercises in this mode."
        onSelect={([id]) => {
          if (replaceFor && id) void w.replaceExercise(replaceFor, id);
        }}
        onClose={() => setReplaceFor(null)}
      />

      {holdBlock && holdFor ? (
        <HoldDial
          visible
          exerciseName={w.exercisesById[holdBlock.exerciseId]?.name ?? 'Hold'}
          goalSeconds={holdGhost?.seconds ?? null}
          bestSeconds={holdBest || null}
          lastSeconds={holdPrevious?.duration_seconds ?? null}
          onSave={(seconds) => void onTick(holdBlock.id, holdFor.key, { seconds: String(seconds) })}
          onClose={() => setHoldFor(null)}
        />
      ) : null}

      {menuBlock && menuRow && menuValues ? (
        <SetTypeSheet
          visible
          title={`Set ${menuRowIndex + 1}`}
          setType={menuValues.set_type}
          rpe={menuValues.rpe}
          clean={menuValues.clean}
          showClean={w.exercisesById[menuBlock.exerciseId]?.load_mode === 'bodyweight'}
          onPickType={(set_type: SetType) => {
            void w.updateRow(menuBlock.id, menuRow.key, { set_type });
            setSetMenu(null);
          }}
          onPickRpe={(rpe) => {
            void w.updateRow(menuBlock.id, menuRow.key, { rpe });
            setSetMenu(null);
          }}
          onToggleClean={(clean) => void w.updateRow(menuBlock.id, menuRow.key, { clean })}
          onRemove={() => {
            // Close first: a toast under an open sheet would hide its Undo.
            setSetMenu(null);
            onDelete(menuBlock.id, menuRow.key);
          }}
          onClose={() => setSetMenu(null)}
        />
      ) : null}

      {loadBlock && loadDraft ? (
        <LoadSheet
          visible
          exerciseName={w.exercisesById[loadBlock.exerciseId]?.name ?? 'Exercise'}
          weight={loadDraft.weight}
          assist={loadDraft.assist}
          bandId={loadDraft.band_id}
          bands={w.bands}
          onChange={(patch) => w.updateDraft(loadBlock.id, loadDraft.key, patch)}
          onManageBands={() => {
            setLoadFor(null);
            navigation.navigate('Bands');
          }}
          onClose={() => setLoadFor(null)}
        />
      ) : null}

      {restBlock ? (
        <RestSheet
          visible
          exerciseName={w.exercisesById[restBlock.exerciseId]?.name ?? 'this exercise'}
          seconds={w.restFor(restBlock)}
          onPick={(seconds) => {
            void w.setRest(restBlock.id, seconds);
            setRestFor(null);
          }}
          onClose={() => setRestFor(null)}
        />
      ) : null}

      {menuForBlock ? (
        <BlockMenu
          visible
          exerciseName={w.exercisesById[menuForBlock.exerciseId]?.name ?? 'Exercise'}
          onClose={() => setBlockMenu(null)}
          actions={[
            {
              key: 'up',
              label: 'Move up',
              icon: 'arrow-up',
              disabled: menuBlockIndex <= 0,
              onPress: () => void w.moveExercise(menuForBlock.id, -1),
            },
            {
              key: 'down',
              label: 'Move down',
              icon: 'arrow-down',
              disabled: menuBlockIndex >= w.blocks.length - 1,
              onPress: () => void w.moveExercise(menuForBlock.id, 1),
            },
            {
              key: 'superset',
              label: menuForBlock.sessionExercise?.superset_group
                ? `Take out of superset ${menuForBlock.sessionExercise.superset_group}`
                : 'Superset with…',
              icon: 'git-merge-outline',
              disabled: w.blocks.length < 2,
              onPress: () => {
                setBlockMenu(null);
                if (menuForBlock.sessionExercise?.superset_group) {
                  void w.setSuperset(menuForBlock.id, null);
                } else {
                  setSupersetFor(menuForBlock.id);
                }
              },
            },
            {
              key: 'replace',
              label: menuForBlock.rows.some((r) => r.kind === 'saved')
                ? 'Replace (only before logging)'
                : 'Replace exercise',
              icon: 'swap-horizontal',
              disabled: menuForBlock.rows.some((r) => r.kind === 'saved'),
              onPress: () => {
                setBlockMenu(null);
                setReplaceFor(menuForBlock.id);
              },
            },
            {
              key: 'warmup',
              label: 'Add warm-up sets',
              icon: 'flame-outline',
              onPress: () => {
                setBlockMenu(null);
                const work = workingWeight(menuForBlock);
                const exercise = w.exercisesById[menuForBlock.exerciseId];
                const sets =
                  exercise?.load_mode === 'external' && work ? warmupSets(work, inventory) : [];
                if (sets.length === 0) {
                  w.addRow(menuForBlock.id, 'warmup', 0);
                  return;
                }
                // 40, 60 and 80 percent of the working weight, on plates you own.
                sets.forEach((set, i) =>
                  w.addRow(menuForBlock.id, 'warmup', i, {
                    weight: String(set.kg),
                    reps: String(set.reps),
                  }),
                );
              },
            },
            ...(w.exercisesById[menuForBlock.exerciseId]?.load_mode === 'external' &&
            w.exercisesById[menuForBlock.exerciseId]?.tracking_type === 'reps'
              ? [
                  {
                    key: 'plates',
                    label: 'Plate calculator',
                    icon: 'barbell-outline' as const,
                    onPress: () => {
                      setBlockMenu(null);
                      const work = workingWeight(menuForBlock);
                      navigation.navigate('PlateCalculator', work ? { targetKg: work } : undefined);
                    },
                  },
                ]
              : []),
            {
              key: 'rest',
              label: 'Rest time',
              icon: 'timer-outline',
              onPress: () => {
                setBlockMenu(null);
                setRestFor(menuForBlock.id);
              },
            },
            {
              key: 'remove',
              label: 'Remove exercise',
              icon: 'trash-outline',
              danger: true,
              onPress: () => {
                setBlockMenu(null);
                const saved = menuForBlock.rows.filter((r) => r.kind === 'saved').length;
                const name = w.exercisesById[menuForBlock.exerciseId]?.name ?? 'this exercise';
                if (saved === 0) {
                  void w.removeExercise(menuForBlock.id);
                  return;
                }
                Alert.alert(
                  `Remove ${name}?`,
                  `Deletes the ${saved} set${saved === 1 ? '' : 's'} logged for it in this workout. This cannot be undone.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => void w.removeExercise(menuForBlock.id),
                    },
                  ],
                );
              },
            },
          ]}
        />
      ) : null}
    </Screen>
  );
}

/**
 * Duration · Volume · Sets, and Finish. Its own component so the once-a-second
 * clock re-renders this strip and nothing else.
 */
function LiveStrip({
  startedAt,
  endedAt,
  volume,
  sets,
  finished,
  onFinish,
}: {
  startedAt: number | null;
  endedAt: number | null;
  volume: number;
  sets: number;
  finished: boolean;
  onFinish: () => void;
}) {
  const styles = useStyles();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [endedAt]);

  const elapsed = startedAt === null ? 0 : Math.max(0, ((endedAt ?? now) - startedAt) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const duration =
    hours > 0
      ? `${hours}:${formatDuration(elapsed % 3600).padStart(5, '0')}`
      : formatDuration(elapsed);

  return (
    <View style={styles.strip}>
      <Stat label="Duration" value={startedAt === null ? '—' : duration} />
      <Stat label="Volume" value={`${volume.toLocaleString('en-IN')} kg`} />
      <Stat label="Sets" value={String(sets)} />
      <Pressable
        onPress={onFinish}
        accessibilityRole="button"
        accessibilityLabel={finished ? 'See the summary' : 'Finish workout'}
        style={({ pressed }) => [styles.finish, pressed && styles.finishPressed]}
      >
        <Text style={styles.finishLabel}>{finished ? 'Summary' : 'Finish'}</Text>
      </Pressable>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
    backgroundColor: colors.background,
  },
  stat: { flex: 1 },
  statLabel: { ...typography.overline },
  statValue: { ...typography.title, ...typography.numeric },
  finish: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishPressed: { opacity: 0.85 },
  finishLabel: { ...typography.title, color: colors.onPrimary },
  dateCard: { marginBottom: spacing.xs },
  empty: { ...typography.body, textAlign: 'center', marginTop: spacing.xl },
  addExercise: { marginTop: spacing.lg },
  notesCard: { marginTop: spacing.lg },
  label: { ...typography.overline, marginBottom: spacing.xs },
  notesInput: { ...typography.body, color: colors.text, minHeight: 64, textAlignVertical: 'top' },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
    textAlign: 'center',
  },
}));
