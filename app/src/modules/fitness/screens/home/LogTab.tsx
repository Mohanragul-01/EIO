/**
 * LogTab - The Log tab: the week, your sessions, and starting a new one.
 *
 * Moved out of FitnessListScreen unchanged when the screen grew past what one
 * file holds comfortably; each tab owns its own data, which is what lets the
 * pager mount them all at once.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Sheet,
  TextField,
  useToast,
} from '../../../../core/components';
import { useTheme } from '../../../../core/ThemeContext';
import { formatEventDate, todayISO, addDaysISO } from '../../../../core/date';
import { motion } from '../../../../core/theme';
import * as api from '../../api';
import { MODE_LABEL } from '../../mode';
import { PickerSheet } from '../../components/PickerSheet';
import { BlockMenu } from '../../components/SessionSheets';
import { TrainingCalendar } from '../../components/TrainingCalendar';
import { WeekStrip } from '../../components/WeekStrip';
import { type FitnessMode, type Routine, type WorkoutSession } from '../../types';
import { useFitnessHome } from '../../useFitness';
import { useFitnessMode } from '../../useFitnessMode';
import type { RootStackParamList } from '../../../../navigation/types';
import { ErrorBanner, useHomeStyles } from './styles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;

export function LogTab() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { sessions, summary, loading, refreshing, error, refresh, reload } = useFitnessHome();
  const { mode } = useFitnessMode();
  const [starting, setStarting] = useState(false);
  const [routineChoices, setRoutineChoices] = useState<Routine[] | null>(null);
  /** The logged session whose menu is open, and the one being saved as a routine. */
  const [rowMenu, setRowMenu] = useState<WorkoutSession | null>(null);
  const [saveAs, setSaveAs] = useState<WorkoutSession | null>(null);
  const [routineName, setRoutineName] = useState('');
  const toast = useToast();
  /** The day a pending 'choose a routine' will be logged against. */
  const [pendingDate, setPendingDate] = useState(todayISO());

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
    async (routineId: string | null, date: string = todayISO(), routineMode?: FitnessMode) => {
      setStarting(true);
      try {
        // startSession also lays out the routine's exercises as blocks and
        // snapshots the bodyweight, so the session opens ready to log.
        const session = await api.startSession({
          date,
          // A routine carries its own mode; a freestyle session takes the lens.
          mode: routineMode ?? mode,
          routine_id: routineId,
        });
        navigation.navigate('WorkoutSession', { sessionId: session.id, routineId });
      } catch (e) {
        Alert.alert('Could not start', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        setStarting(false);
      }
    },
    [navigation, mode],
  );

  /**
   * Start a session on a day other than today.
   *
   * Three taps deep would be wrong for something you reach for whenever you
   * forget to log, so yesterday gets its own entry rather than hiding behind a
   * date picker. Anything older is set from inside the session, or by tapping
   * the day in the week strip.
   */
  const startBackdated = useCallback(() => {
    Alert.alert('Log a past workout', 'Which day?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yesterday', onPress: () => void startSession(null, addDaysISO(-1)) },
      { text: 'Today', onPress: () => void startSession(null) },
    ]);
  }, [startSession]);

  /**
   * Offer the routines, then start on `date`.
   *
   * The date is held in state rather than passed through the sheet, because the
   * sheet's callback fires long after this returns and only knows which routine
   * you picked.
   */
  const chooseStart = useCallback(
    async (date: string) => {
      setPendingDate(date);
      try {
        // This mode's routines; the other mode's are a switch away.
        const routines = (await api.listRoutines()).filter((r) => r.mode === mode);
        if (routines.length === 0) {
          void startSession(null, date);
          return;
        }

        // A sheet, not an Alert. Android gives an alert three button slots, and
        // Cancel plus Freestyle already used two, so the third routine onwards
        // overwrote an earlier button instead of adding one. The slice(0, 2)
        // that used to be here was hiding the problem, not fixing it: with more
        // than two routines the rest were simply unreachable from this screen.
        setRoutineChoices(routines);
      } catch {
        void startSession(null, date);
      }
    },
    [startSession, mode],
  );

  /**
   * Tapping a day in the week strip.
   *
   * Already trained that day, so there is something to look at - open it rather
   * than starting a second session beside it. Nothing logged, so the obvious
   * intent is to log it, on that day.
   */
  const pickDay = useCallback(
    (date: string) => {
      const existing = sessions.find((s) => s.date === date);
      if (existing) {
        navigation.navigate('WorkoutSession', {
          sessionId: existing.id,
          routineId: existing.routine_id,
        });
        return;
      }
      void chooseStart(date);
    },
    [sessions, navigation, chooseStart],
  );

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
              restDays={summary.restDays}
              onPickDay={pickDay}
            />
            <TrainingCalendar onPickDay={pickDay} refreshKey={sessions} />
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
            action={
              <Button
                label="Start a workout"
                icon="add"
                onPress={() => void chooseStart(todayISO())}
              />
            }
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
              onMenu={() => setRowMenu(item)}
            />
          </FadeInView>
        )}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {rowMenu ? (
        <BlockMenu
          visible
          exerciseName={formatEventDate(rowMenu.date)}
          onClose={() => setRowMenu(null)}
          actions={[
            {
              key: 'repeat',
              label: 'Repeat it today',
              icon: 'repeat',
              onPress: async () => {
                const source = rowMenu;
                setRowMenu(null);
                try {
                  const session = await api.repeatSession(source.id);
                  navigation.navigate('WorkoutSession', {
                    sessionId: session.id,
                    routineId: session.routine_id,
                  });
                } catch (e) {
                  toast.show({ message: e instanceof Error ? e.message : 'Could not repeat it' });
                }
              },
            },
            {
              key: 'routine',
              label: 'Save as a routine',
              icon: 'list-outline',
              onPress: () => {
                setRoutineName('');
                setSaveAs(rowMenu);
                setRowMenu(null);
              },
            },
            {
              key: 'delete',
              label: 'Delete workout',
              icon: 'trash-outline',
              danger: true,
              onPress: () => {
                const target = rowMenu;
                setRowMenu(null);
                Alert.alert(
                  'Delete this workout',
                  'Every set in it is deleted too. This cannot be undone.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        try {
                          await api.deleteSession(target.id);
                          reload();
                        } catch (e) {
                          toast.show({
                            message: e instanceof Error ? e.message : 'Could not delete',
                          });
                        }
                      },
                    },
                  ],
                );
              },
            },
          ]}
        />
      ) : null}

      {saveAs ? (
        <Sheet
          visible
          title="Save as a routine"
          subtitle={`From ${formatEventDate(saveAs.date)}: its exercises, sets and rep ranges`}
          onClose={() => setSaveAs(null)}
          footer={
            <Button
              label="Save routine"
              disabled={!routineName.trim()}
              onPress={async () => {
                const source = saveAs;
                const name = routineName.trim();
                setSaveAs(null);
                try {
                  await api.saveSessionAsRoutine(source.id, name);
                  toast.show({ message: `Saved "${name}" to Routines` });
                } catch (e) {
                  toast.show({ message: e instanceof Error ? e.message : 'Could not save it' });
                }
              }}
            />
          }
        >
          <TextField
            label="Name"
            value={routineName}
            onChangeText={setRoutineName}
            placeholder="Push day, Day A"
            autoFocus
            maxLength={60}
          />
        </Sheet>
      ) : null}

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
        onSelect={([id]) =>
          void startSession(
            id === FREESTYLE ? null : id,
            pendingDate,
            routineChoices?.find((r) => r.id === id)?.mode,
          )
        }
        onClose={() => setRoutineChoices(null)}
      />

      {sessions.length > 0 ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => void chooseStart(todayISO())}
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
  onMenu,
}: {
  session: WorkoutSession;
  onPress: () => void;
  onMenu: () => void;
}) {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  // The mode is marked by icon and accent together, and spoken, never by
  // colour alone.
  const calisthenics = session.mode === 'calisthenics';
  const accent = calisthenics ? colors.accentCyan : colors.accentRose;

  return (
    <GlassCard onPress={onPress} style={styles.row}>
      <View
        style={styles.rowInner}
        accessible
        accessibilityLabel={`${MODE_LABEL[session.mode]} workout, ${formatEventDate(session.date)}${
          session.notes ? `. ${session.notes}` : ''
        }`}
      >
        <View style={[styles.rowIcon, { backgroundColor: accent + '1F' }]}>
          <Ionicons
            name={calisthenics ? 'body-outline' : 'barbell-outline'}
            size={17}
            color={accent}
          />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle}>{formatEventDate(session.date)}</Text>
          {session.notes ? (
            <Text style={styles.rowSub} numberOfLines={1}>
              {session.notes}
            </Text>
          ) : null}
        </View>
        <Pressable
          onPress={onMenu}
          accessibilityRole="button"
          accessibilityLabel={`More for the workout on ${formatEventDate(session.date)}`}
          style={styles.rowMenu}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>
    </GlassCard>
  );
}
