/**
 * FitnessListScreen - Log, Plan and Body over one module.
 *
 * Three tabs rather than three destinations, for the same reason as Notes: they
 * are three views of one thing, and none of them is somewhere you navigate TO.
 * Only a session and a routine are real destinations, because both are things
 * you open, work on, and come back from.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SwipeTabs,
  SegmentedControl,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, todayISO, addDaysISO} from '../../../core/date';
import { fonts, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { PickerSheet } from '../components/PickerSheet';
import { WeekStrip } from '../components/WeekStrip';
import { bmiLabel, MUSCLE_GROUPS, type Routine, type WorkoutSession,
  MUSCLE_REGIONS,
  TRACKING_LABEL,
  regionOf,
  type MuscleRegion,
  type TrackingType,
} from '../types';
import { useBody, useFitnessHome, usePlan } from '../useFitness';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;

/**
 * Four tabs, not three.
 *
 * Routines and exercises were stacked in one "Plan" screen, separated by a
 * heading - so adding an exercise meant scrolling past every routine, and the
 * two things you do here were competing for the same scroll position. They are
 * different jobs: a routine is a template you write occasionally, the library
 * is a list you browse constantly.
 */
type FitnessView = 'log' | 'routines' | 'exercises' | 'body';
const VIEWS: FitnessView[] = ['log', 'routines', 'exercises', 'body'];
const VIEW_LABEL: Record<FitnessView, string> = {
  log: 'Log',
  routines: 'Routines',
  exercises: 'Exercises',
  body: 'Body',
};

export function FitnessListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [view, setView] = useState<FitnessView>('log');

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <SwipeTabs
        options={VIEWS}
        value={view}
        onChange={setView}
        renderLabel={(v) => VIEW_LABEL[v]}
        // Each tab already owns its data, which is what makes them pageable:
        // a pager mounts every page, so a tab that only loaded when selected
        // would swipe onto a blank screen.
        renderPage={(v) =>
          v === 'log' ? (
            <LogTab />
          ) : v === 'routines' ? (
            <RoutinesTab />
          ) : v === 'exercises' ? (
            <ExercisesTab />
          ) : (
            <BodyTab />
          )
        }
      />
    </Screen>
  );
}

// LOG ---------------------------------------------------------------------------

function LogTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { sessions, summary, loading, refreshing, error, refresh, reload } = useFitnessHome();
  const [starting, setStarting] = useState(false);
  const [routineChoices, setRoutineChoices] = useState<Routine[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /**
   * Start a session, optionally from a routine.
   *
   * The session row is created BEFORE the screen opens, so every set has a
   * parent to attach to. The alternative - holding an unsaved session in memory
   * and writing it on finish - loses the whole workout if the app is killed
   * mid-session, which on a phone in a gym is not a remote possibility.
   */
  const startSession = useCallback(
    async (routineId: string | null, date: string = todayISO()) => {
      setStarting(true);
      try {
        const session = await api.createSession({
          date,
          routine_id: routineId,
          notes: '',
        });
        navigation.navigate('WorkoutSession', { sessionId: session.id, routineId });
      } catch (e) {
        Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setStarting(false);
      }
    },
    [navigation],
  );

  /**
   * Start a session on a day other than today.
   *
   * Three taps deep would be wrong for something you reach for whenever you
   * forget to log, so yesterday gets its own entry rather than hiding behind a
   * date picker. Anything older is set from inside the session.
   */
  const startBackdated = useCallback(() => {
    Alert.alert('Log a past workout', 'Which day?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yesterday', onPress: () => void startSession(null, addDaysISO(-1)) },
      { text: 'Today', onPress: () => void startSession(null) },
    ]);
  }, [startSession]);

  const chooseStart = useCallback(async () => {
    try {
      const routines = await api.listRoutines();
      if (routines.length === 0) {
        void startSession(null);
        return;
      }

      // A sheet, not an Alert. Android gives an alert three button slots, and
      // Cancel plus Freestyle already used two, so the third routine onwards
      // overwrote an earlier button instead of adding one. The slice(0, 2) that
      // used to be here was hiding the problem, not fixing it: with more than
      // two routines the rest were simply unreachable from this screen.
      setRoutineChoices(routines);
    } catch {
      void startSession(null);
    }
  }, [startSession]);

  /** 'freestyle' is a sentinel id: a session belonging to no routine. */
  const FREESTYLE = 'freestyle';

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, sessions.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          <FadeInView>
            <WeekStrip
              week={summary.week}
              weekSessions={summary.weekSessions}
              weekVolume={summary.weekVolume}
              weekMax={summary.weekMax}
              streak={summary.streak}
            />
            {sessions.length > 0 ? (
              <Text style={styles.sectionLabel}>
                History · {summary.totalSessions}{' '}
                {summary.totalSessions === 1 ? 'session' : 'sessions'}
              </Text>
            ) : null}
          </FadeInView>
        }
        ListEmptyComponent={
          <EmptyState
            icon="barbell-outline"
            accent={colors.accentRose}
            title="No workouts yet"
            message="Start a session and log sets as you go. Personal records are worked out from what you log."
            action={<Button label="Start a workout" icon="add" onPress={chooseStart} />}
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <SessionRow
              session={item}
              onPress={() =>
                navigation.navigate('WorkoutSession', {
                  sessionId: item.id,
                  routineId: item.routine_id,
                })
              }
            />
          </FadeInView>
        )}
      />

      {error ? <ErrorBanner message={error} /> : null}

      <PickerSheet
        visible={routineChoices !== null}
        title="Start a workout"
        items={[
          { id: FREESTYLE, label: 'Freestyle', note: 'Pick exercises as you go' },
          ...(routineChoices ?? []).map((routine) => ({
            id: routine.id,
            label: routine.name,
          })),
        ]}
        onSelect={([id]) => void startSession(id === FREESTYLE ? null : id)}
        onClose={() => setRoutineChoices(null)}
      />

      {sessions.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={chooseStart}
            // Long-press for a past day. Backdating is the uncommon case, so
            // it does not get its own button, but it must not be unreachable
            // either - forgetting to log is the whole reason it exists.
            onLongPress={startBackdated}
            delayLongPress={350}
            disabled={starting}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Start a workout"
            accessibilityHint="Long press to log a workout for a past day"
          >
            {starting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Ionicons name="add" size={26} color={colors.onPrimary} />
            )}
          </Pressable>
        </FadeInView>
      ) : null}
    </>
  );
}

function SessionRow({
  session,
  onPress,
}: {
  session: WorkoutSession;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <GlassCard onPress={onPress} style={styles.row}>
      <View style={styles.rowInner}>
        <View style={[styles.rowIcon, { backgroundColor: colors.accentRose + '1F' }]}>
          <Ionicons name="barbell-outline" size={17} color={colors.accentRose} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{formatEventDate(session.date)}</Text>
          {session.notes ? (
            <Text style={styles.rowSub} numberOfLines={1}>
              {session.notes}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </GlassCard>
  );
}

// PLAN --------------------------------------------------------------------------

function RoutinesTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { routines, loading, refreshing, error, refresh, reload, removeRoutine } = usePlan();

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, routines.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="list-outline"
            accent={colors.accentIndigo}
            title="No routines yet"
            message="A routine is a template: a named list of exercises with target sets and reps. It logs nothing itself, it pre-fills a session."
            action={
              <Button
                label="New routine"
                icon="add"
                onPress={() => navigation.navigate('RoutineEdit', {})}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <GlassCard
              style={styles.row}
              onPress={() => navigation.navigate('RoutineEdit', { routineId: item.id })}
            >
              <View style={styles.rowInner}>
                <View style={[styles.rowIcon, { backgroundColor: colors.accentIndigo + '1F' }]}>
                  <Ionicons name="list-outline" size={17} color={colors.accentIndigo} />
                </View>
                <Text style={[styles.rowTitle, styles.rowBody]}>{item.name}</Text>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete routine', 'Sessions you already logged from it are kept.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => void removeRoutine(item.id),
                      },
                    ])
                  }
                  hitSlop={10}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            </GlassCard>
          </FadeInView>
        )}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {routines.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('RoutineEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="New routine"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </>
  );
}

// EXERCISES ---------------------------------------------------------------------

function ExercisesTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    exercises,
    loading,
    refreshing,
    error,
    clearError,
    refresh,
    reload,
    addExercise,
    removeExercise,
  } = usePlan();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>('Mid chest');
  const [tracking, setTracking] = useState<TrackingType>('reps');
  const [adding, setAdding] = useState(false);

  /** Which region's exercises are showing. 'All' is its own first tab. */
  const [region, setRegion] = useState<MuscleRegion | 'All'>('All');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /**
   * The library, grouped by muscle within the chosen region.
   *
   * Filtering by REGION rather than by muscle keeps the tab row to seven, while
   * the headings inside still say which specific muscle each exercise trains -
   * so you get the granularity without twenty-two tabs to scroll past.
   */
  const grouped = useMemo(() => {
    const visible =
      region === 'All' ? exercises : exercises.filter((e) => regionOf(e.muscle_group) === region);

    const byMuscle = new Map<string, typeof exercises>();
    visible.forEach((exercise) => {
      const key = exercise.muscle_group?.trim() || 'Unsorted';
      const bucket = byMuscle.get(key);
      if (bucket) bucket.push(exercise);
      else byMuscle.set(key, [exercise]);
    });

    return [...byMuscle.entries()]
      .sort(([a], [b]) => (a === 'Unsorted' ? 1 : b === 'Unsorted' ? -1 : a.localeCompare(b)))
      .map(([title, items]) => ({ title, items }));
  }, [exercises, region]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    exercises.forEach((e) => {
      const r = regionOf(e.muscle_group);
      map.set(r, (map.get(r) ?? 0) + 1);
    });
    return map;
  }, [exercises]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handleAdd = async () => {
    if (!name.trim()) return;
    const ok = await addExercise(name, muscle, tracking);
    if (ok) {
      setName('');
      setAdding(false);
    }
  };

  return (
    <>
      <FormScroll
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      >
        {/* The add form sits at the TOP. Buried under the library it meant
            scrolling past everything you already have to add one more. */}
        <FadeInView>
          {adding ? (
            <GlassCard style={styles.addCard}>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) clearError();
                }}
                placeholder="Exercise name"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.primary}
                style={styles.addInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />

              <Text style={[styles.label, styles.addLabel]}>Measured in</Text>
              <SegmentedControl
                options={['reps', 'time'] as const}
                value={tracking}
                onChange={setTracking}
                renderLabel={(t) => TRACKING_LABEL[t]}
              />
              <Text style={styles.hint}>
                {tracking === 'time'
                  ? 'Sets are logged as seconds held — planks, dead hangs, wall sits.'
                  : 'Sets are logged as weight and reps.'}
              </Text>

              <Text style={[styles.label, styles.addLabel]}>Muscle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupRow}
              >
                {MUSCLE_GROUPS.map((option) => {
                  const selected = option === muscle;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setMuscle(option)}
                      style={({ pressed }) => [
                        styles.groupChip,
                        selected && styles.groupChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.groupText, selected && styles.groupTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.addActions}>
                <Pressable onPress={() => setAdding(false)} hitSlop={8}>
                  <Text style={styles.linkMuted}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleAdd} hitSlop={8} disabled={!name.trim()}>
                  <Text style={[styles.link, !name.trim() && styles.linkDisabled]}>Add</Text>
                </Pressable>
              </View>
            </GlassCard>
          ) : (
            <Button
              label="Add an exercise"
              icon="add"
              variant="glass"
              onPress={() => setAdding(true)}
              style={styles.addCard}
            />
          )}
        </FadeInView>

        {/* Region filter. */}
        <FadeInView delay={40}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupRow}
          >
            {(['All', ...MUSCLE_REGIONS] as const).map((option) => {
              const selected = option === region;
              const count = option === 'All' ? exercises.length : (counts.get(option) ?? 0);
              return (
                <Pressable
                  key={option}
                  onPress={() => setRegion(option)}
                  style={({ pressed }) => [
                    styles.groupChip,
                    selected && styles.groupChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.groupText, selected && styles.groupTextActive]}>
                    {option} {count > 0 ? count : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </FadeInView>

        {grouped.length === 0 ? (
          <FadeInView delay={80}>
            <GlassCard style={styles.addCard}>
              <Text style={styles.hint}>
                {region === 'All'
                  ? 'No exercises yet.'
                  : `Nothing tagged under ${region} yet.`}
              </Text>
            </GlassCard>
          </FadeInView>
        ) : (
          grouped.map((section, index) => (
            <FadeInView key={section.title} delay={Math.min(index, 6) * 40}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.items.map((exercise) => (
                <GlassCard
                  key={exercise.id}
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('ExerciseProgress', {
                      exerciseId: exercise.id,
                      name: exercise.name,
                    })
                  }
                >
                  <View style={styles.rowInner}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{exercise.name}</Text>
                      <Text style={styles.rowSub}>
                        {exercise.muscle_group ?? 'Unsorted'}
                        {exercise.tracking_type === 'time' ? ' · timed' : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Delete exercise', `Remove ${exercise.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => void removeExercise(exercise.id),
                          },
                        ])
                      }
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </FadeInView>
          ))
        )}
      </FormScroll>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}

// BODY --------------------------------------------------------------------------

function BodyTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const {
    profile,
    metrics,
    currentBmi,
    loading,
    error,
    clearError,
    reload,
    saveHeight,
    saveWeight,
    removeWeight,
  } = useBody();

  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const height = profile?.height_cm ?? null;

  const handleHeight = async () => {
    const parsed = Number(heightText.trim());
    if (!Number.isFinite(parsed) || parsed < 50 || parsed > 260) return;
    await saveHeight(parsed);
    setHeightText('');
  };

  const handleWeight = async () => {
    const parsed = Number(weightText.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 500) return;
    const ok = await saveWeight(todayISO(), parsed);
    if (ok) setWeightText('');
  };

  return (
    <>
      <FormScroll
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInView>
          <GlassCard>
            <Text style={styles.label}>Today</Text>
            <View style={styles.weightRow}>
              <TextInput
                value={weightText}
                onChangeText={(text) => {
                  setWeightText(text);
                  if (error) clearError();
                }}
                placeholder={metrics[0] ? String(metrics[0].weight_kg) : '0'}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.weightInput}
                maxLength={6}
              />
              <Text style={styles.unit}>kg</Text>
              {weightText.trim() ? (
                <Pressable onPress={handleWeight} hitSlop={8}>
                  <Text style={styles.link}>Save</Text>
                </Pressable>
              ) : null}
            </View>

            {/* BMI is never stored. It is entirely determined by weight and
                height, so a stored copy would go stale and look just as
                authoritative as the real one. See types.ts. */}
            {currentBmi ? (
              <Text style={styles.bmi}>
                BMI {currentBmi.toFixed(1)} · {bmiLabel(currentBmi)}
              </Text>
            ) : (
              <Text style={styles.hint}>
                {height
                  ? 'Log a weight to see your BMI.'
                  : 'Set your height below to see your BMI.'}
              </Text>
            )}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={60}>
          <GlassCard style={styles.addCard}>
            <Text style={styles.label}>Height</Text>
            <View style={styles.weightRow}>
              <TextInput
                value={heightText}
                onChangeText={setHeightText}
                placeholder={height ? String(height) : '175'}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.weightInput}
                maxLength={5}
              />
              <Text style={styles.unit}>cm</Text>
              {heightText.trim() ? (
                <Pressable onPress={handleHeight} hitSlop={8}>
                  <Text style={styles.link}>Save</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.hint}>Set once. Only used to work out BMI.</Text>
          </GlassCard>
        </FadeInView>

        {metrics.length > 0 ? (
          <FadeInView delay={100}>
            <Text style={styles.sectionLabel}>History</Text>
            {metrics.map((metric) => (
              <GlassCard key={metric.id} style={styles.row}>
                <View style={styles.rowInner}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{metric.weight_kg} kg</Text>
                    <Text style={styles.rowSub}>{formatEventDate(metric.date)}</Text>
                  </View>
                  <Pressable onPress={() => void removeWeight(metric.id)} hitSlop={10}>
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </FadeInView>
        ) : null}
      </FormScroll>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}

function ErrorBanner({ message }: { message: string }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <FadeInView style={styles.errorWrap}>
      <GlassCard style={styles.errorCard}>
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={17} color={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </GlassCard>
    </FadeInView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  addLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  addActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  linkMuted: {
    ...typography.caption,
    color: colors.textMuted,
  },
  linkDisabled: {
    opacity: 0.4,
  },
  tabsTopSpacer: {
    // Clears the transparent nav header. SwipeTabs owns the tab row's own
    // horizontal padding, so this is only the gap above it.
    height: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1,
  },
  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
  sectionLabelTight: {
    ...typography.overline,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  link: {
    ...typography.caption,
    color: colors.primary,
  },
  label: {
    ...typography.overline,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    marginTop: spacing.sm,
  },

  row: {
    marginBottom: spacing.md,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    ...typography.title,
    fontSize: 14.5,
  },
  rowSub: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },

  addCard: {
    marginBottom: spacing.md,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  addInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 6,
  },
  groupRow: {
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  groupChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  groupChipActive: {
    backgroundColor: colors.accentRose + '26',
    borderColor: colors.accentRose + '59',
  },
  groupText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  groupTextActive: {
    color: colors.accentRose,
  },
  pressed: {
    opacity: 0.7,
  },

  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  weightInput: {
    fontFamily: fonts.bold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: colors.text,
    padding: 0,
    minWidth: 90,
  },
  unit: {
    ...typography.body,
    color: colors.textMuted,
    flex: 1,
  },
  bmi: {
    ...typography.caption,
    marginTop: spacing.md,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },

  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl + 70,
  },
  errorCard: {
    borderColor: colors.danger + '55',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));
