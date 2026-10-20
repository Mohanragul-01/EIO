/**
 * LadderScreen - one ladder: where you are on it, and the way up.
 *
 * Rungs read top to bottom in order. Mastered ones are ticked with the day you
 * moved up from them; the current one is outlined, with its goal, your best
 * recent attempt and a progress ring; the ones above are locked (dimmed, with
 * a lock, never by colour alone). Moving up and stepping back are always your
 * call and always undoable - the app only says when you look ready.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, FadeInView, GlassCard, Screen, Sheet, useToast } from '../../../core/components';
import { formatEventDate, todayISO } from '../../../core/date';
import { success } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { BlockMenu } from '../components/SessionSheets';
import { ProgressRing } from '../components/ProgressRing';
import type { SetFact } from '../load';
import { LadderProgress } from '../components/LadderProgress';
import { ladderPositions, stepSeries, type RungBest } from '../ladderHistory';
import { goalLabel, goalProgress, neighbours, type Rung } from '../progression';
import { useLadders, useRungBests } from '../useLadders';
import type { ProgressionStep } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Ladder'>;
type Route = RouteProp<RootStackParamList, 'Ladder'>;

/** The best recent session's top sets against the goal, e.g. "8 · 7 · 6" or "25s · 20s". */
function bestAttempt(rung: Rung, sessions: SetFact[][]): string | null {
  const step = rung.step;
  const timed = step.goal_seconds !== null;
  let best: number[] = [];
  let bestScore = -1;
  for (const sets of sessions) {
    const score = goalProgress(step, sets);
    if (score <= bestScore) continue;
    bestScore = score;
    best = sets
      .filter((s) => s.exercise_id === step.exercise_id && s.set_type !== 'warmup')
      .map((s) => (timed ? (s.duration_seconds ?? 0) : (s.reps ?? 0)))
      .sort((a, b) => b - a)
      .slice(0, step.goal_sets);
  }
  if (best.length === 0) return null;
  return best.map((v) => (timed ? `${v}s` : String(v))).join(' · ');
}

/** A rung's best ever, in words: "Most reps 12 · 3 Oct", "Longest hold 45s · 3 Oct". */
function bestEver(best: RungBest | null | undefined): string | null {
  if (!best) return null;
  const value = best.kind === 'hold' ? `Longest hold ${best.value}s` : `Most reps ${best.value}`;
  return `${value} · ${formatEventDate(best.date)}`;
}

const NO_STEPS: ProgressionStep[] = [];

export function LadderScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { progressionId } = useRoute<Route>().params;
  const toast = useToast();
  const { cards, recent, exerciseName, loading, reload } = useLadders();
  const [menu, setMenu] = useState(false);
  const [rungMenu, setRungMenu] = useState<Rung | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const card = cards.find((c) => c.ladder.progression.id === progressionId);
  const progression = card?.ladder.progression;
  const { bests, reload: reloadBests } = useRungBests(card?.ladder.steps ?? NO_STEPS);

  // Back from a session on this ladder: its bests may have moved.
  useFocusEffect(
    useCallback(() => {
      reloadBests();
    }, [reloadBests]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: progression?.name ?? 'Ladder',
      headerRight: () => (
        <Pressable
          onPress={() => setMenu(true)}
          accessibilityRole="button"
          accessibilityLabel="Ladder options"
          style={styles.headerButton}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Pressable>
      ),
    });
  }, [navigation, progression?.name, colors.textSecondary, styles.headerButton]);

  const sides = useMemo(
    () => (card ? neighbours(card.ladder.steps, progression?.current_step_id ?? null) : null),
    [card, progression?.current_step_id],
  );

  const moves = useMemo(
    () =>
      [...(card?.ladder.moves ?? [])].sort(
        (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
      ),
    [card],
  );

  // Where you stood on the ladder each day you moved, run on to today.
  const positions = useMemo(
    () =>
      card ? stepSeries(ladderPositions(card.ladder.steps, card.ladder.moves), todayISO()) : [],
    [card],
  );

  if (loading && !card) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (!card || !progression) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Text style={styles.hint}>This ladder no longer exists.</Text>
        </View>
      </Screen>
    );
  }

  const nameOf = (stepId: string | null) => {
    const step = card.ladder.steps.find((s) => s.id === stepId);
    return step ? exerciseName(step.exercise_id) : 'a removed rung';
  };

  /** Move to a rung, with an undo that puts you back where you were. */
  const moveTo = async (toStepId: string, kind: 'up' | 'back' | 'start') => {
    const from = progression.current_step_id;
    setBusy(true);
    try {
      await api.moveLadder({ progressionId, fromStepId: from, toStepId, kind });
      if (kind === 'up') success();
      await reload();
      const verb = kind === 'up' ? 'Moved up to' : kind === 'back' ? 'Stepped back to' : 'Now on';
      toast.show({
        message: `${verb} ${nameOf(toStepId)}`,
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await api.undoLadderMove(progressionId, from);
            await reload();
          } catch (e) {
            toast.show({ message: e instanceof Error ? e.message : 'Could not undo that' });
          }
        },
      });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not move' });
    } finally {
      setBusy(false);
    }
  };

  /** Start a calisthenics session with the current rung already in it. */
  const train = async (exerciseId: string) => {
    setBusy(true);
    try {
      const session = await api.startSession({
        date: todayISO(),
        mode: 'calisthenics',
        routine_id: null,
      });
      await api.addSessionExercise({
        session_id: session.id,
        exercise_id: exerciseId,
        position: 0,
      });
      navigation.navigate('WorkoutSession', { sessionId: session.id, routineId: null });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not start a session' });
    } finally {
      setBusy(false);
    }
  };

  const total = card.rungs.length;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FadeInView>
          <GlassCard>
            <Text style={styles.kicker}>
              {card.current
                ? `Step ${card.current.number} of ${total}`
                : total
                  ? 'Not started'
                  : 'No rungs yet'}
            </Text>
            <View
              style={styles.segments}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {card.rungs.map((r) => (
                <View
                  key={r.step.id}
                  style={[
                    styles.segment,
                    r.state === 'mastered' && styles.segmentMastered,
                    r.state === 'current' && styles.segmentCurrent,
                  ]}
                />
              ))}
            </View>
            {progression.paused_at ? (
              <View style={styles.notice}>
                <Ionicons name="pause-circle-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.noticeText}>
                  Paused: no level-up prompts until you resume it.
                </Text>
              </View>
            ) : null}
            {total === 0 ? (
              <Button
                label="Add rungs"
                icon="add"
                onPress={() => navigation.navigate('LadderEdit', { progressionId })}
                style={styles.topButton}
              />
            ) : null}
          </GlassCard>
        </FadeInView>

        {card.rungs.map((rung, i) => {
          const name = exerciseName(rung.step.exercise_id);
          const sessions = recent[rung.step.exercise_id] ?? [];
          const best = bestAttempt(rung, sessions);
          const ever = bestEver(bests[rung.step.id]);
          const current = rung.state === 'current';
          const locked = rung.state === 'locked';
          return (
            <FadeInView key={rung.step.id} delay={Math.min(i, 8) * 30}>
              <Pressable
                onPress={() => setRungMenu(rung)}
                accessibilityRole="button"
                accessibilityLabel={`Step ${rung.number}, ${name}. ${
                  rung.state === 'mastered'
                    ? rung.masteredOn
                      ? `Mastered ${formatEventDate(rung.masteredOn)}`
                      : 'Behind you'
                    : current
                      ? `Current. Goal ${goalLabel(rung.step)}${best ? `. Best ${best}` : ''}`
                      : 'Locked'
                }${ever ? `. ${ever}` : ''}`}
                style={[styles.rung, current && styles.rungCurrent, locked && styles.rungLocked]}
              >
                <View style={[styles.number, rung.state === 'mastered' && styles.numberMastered]}>
                  {rung.state === 'mastered' ? (
                    <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.numberText}>{rung.number}</Text>
                  )}
                </View>
                <View style={styles.rungBody}>
                  <Text style={styles.rungName}>{name}</Text>
                  <Text style={styles.rungDetail}>
                    {rung.state === 'mastered'
                      ? rung.masteredOn
                        ? `Mastered ${formatEventDate(rung.masteredOn)}`
                        : 'Behind you'
                      : `Goal ${goalLabel(rung.step)}${current && best ? ` · Best ${best}` : ''}`}
                  </Text>
                  {ever ? <Text style={styles.rungDetail}>{ever}</Text> : null}
                  {rung.step.cue ? <Text style={styles.cue}>{rung.step.cue}</Text> : null}
                  {current ? (
                    <>
                      {card.ready ? (
                        <View style={styles.notice}>
                          <Ionicons name="arrow-up-circle" size={16} color={colors.success} />
                          <Text style={[styles.noticeText, { color: colors.success }]}>
                            You have met the goal. Ready when you are.
                          </Text>
                        </View>
                      ) : null}
                      <View style={styles.actions}>
                        <Button
                          label="Train"
                          icon="play"
                          onPress={() => void train(rung.step.exercise_id)}
                          disabled={busy}
                          style={styles.action}
                        />
                        {sides?.next ? (
                          <Button
                            label="Move up"
                            icon="arrow-up"
                            variant="glass"
                            onPress={() => void moveTo(sides.next!.id, 'up')}
                            disabled={busy}
                            style={styles.action}
                          />
                        ) : null}
                      </View>
                    </>
                  ) : null}
                </View>
                {current ? (
                  <ProgressRing progress={card.progress} size={52} />
                ) : locked ? (
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                ) : null}
              </Pressable>
            </FadeInView>
          );
        })}

        {positions.length > 1 ? (
          <FadeInView delay={100}>
            <GlassCard style={styles.history}>
              <Text style={styles.kicker}>Progress</Text>
              <LadderProgress points={positions} total={total} name={progression.name} />
            </GlassCard>
          </FadeInView>
        ) : null}

        {moves.length > 0 ? (
          <FadeInView delay={120}>
            <GlassCard style={styles.history}>
              <Text style={styles.kicker}>History</Text>
              {moves.map((m) => (
                <View key={m.id} style={styles.moveRow}>
                  <Ionicons
                    name={
                      m.kind === 'up'
                        ? 'arrow-up-circle'
                        : m.kind === 'back'
                          ? 'arrow-down-circle'
                          : 'flag'
                    }
                    size={16}
                    color={m.kind === 'up' ? colors.accentCyan : colors.textSecondary}
                  />
                  <Text style={styles.moveDate}>{formatEventDate(m.date)}</Text>
                  <Text style={styles.moveText} numberOfLines={2}>
                    {m.kind === 'start'
                      ? `Started on ${nameOf(m.to_step_id)}`
                      : `${m.kind === 'up' ? 'Up' : 'Back'}: ${nameOf(m.from_step_id)} → ${nameOf(m.to_step_id)}`}
                  </Text>
                </View>
              ))}
            </GlassCard>
          </FadeInView>
        ) : null}
      </ScrollView>

      {rungMenu ? (
        <Sheet
          visible
          title={exerciseName(rungMenu.step.exercise_id)}
          subtitle={`Step ${rungMenu.number} · goal ${goalLabel(rungMenu.step)}`}
          onClose={() => setRungMenu(null)}
        >
          {rungMenu.state !== 'current' ? (
            <Button
              label="Make this my current rung"
              icon="flag-outline"
              variant="glass"
              onPress={() => {
                const target = rungMenu;
                setRungMenu(null);
                const kind = !card.current
                  ? 'start'
                  : target.number > card.current.number
                    ? 'up'
                    : 'back';
                void moveTo(target.step.id, kind);
              }}
              style={styles.sheetButton}
            />
          ) : null}
          <Button
            label="See its history"
            icon="stats-chart-outline"
            variant="glass"
            onPress={() => {
              const target = rungMenu;
              setRungMenu(null);
              navigation.navigate('ExerciseProgress', {
                exerciseId: target.step.exercise_id,
                name: exerciseName(target.step.exercise_id),
              });
            }}
            style={styles.sheetButton}
          />
        </Sheet>
      ) : null}

      <BlockMenu
        visible={menu}
        exerciseName={progression.name}
        onClose={() => setMenu(false)}
        actions={[
          {
            key: 'edit',
            label: 'Edit ladder',
            icon: 'create-outline',
            onPress: () => {
              setMenu(false);
              navigation.navigate('LadderEdit', { progressionId });
            },
          },
          {
            key: 'back',
            label: sides?.previous
              ? `Step back to ${exerciseName(sides.previous.exercise_id)}`
              : 'Step back',
            icon: 'arrow-down',
            disabled: !sides?.previous,
            onPress: () => {
              setMenu(false);
              if (sides?.previous) void moveTo(sides.previous.id, 'back');
            },
          },
          {
            key: 'pause',
            label: progression.paused_at ? 'Resume' : 'Pause (injury, travel, deload)',
            icon: progression.paused_at ? 'play-circle-outline' : 'pause-circle-outline',
            onPress: async () => {
              setMenu(false);
              try {
                await api.setLadderPaused(progressionId, !progression.paused_at);
                await reload();
              } catch (e) {
                toast.show({ message: e instanceof Error ? e.message : 'Could not change that' });
              }
            },
          },
          {
            key: 'delete',
            label: 'Delete ladder',
            icon: 'trash-outline',
            danger: true,
            onPress: () => {
              setMenu(false);
              Alert.alert(
                `Delete ${progression.name}?`,
                'Deletes the ladder and its history of moves. Every set you logged is kept. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await api.deleteLadder(progressionId);
                        navigation.goBack();
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
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // A 48dp box round the icon: hitSlop alone left it short of 48.
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  kicker: { ...typography.overline, marginBottom: spacing.sm },
  hint: { ...typography.body },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: colors.glassStrong },
  segmentMastered: { backgroundColor: colors.accentCyan },
  segmentCurrent: { backgroundColor: colors.accentCyan, opacity: 0.45 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  noticeText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  topButton: { marginTop: spacing.md },
  rung: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    minHeight: 64,
  },
  rungCurrent: { borderColor: colors.accentCyan, borderWidth: 2 },
  rungLocked: { opacity: 0.55 },
  number: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
  },
  numberMastered: { backgroundColor: colors.accentCyan, borderColor: colors.accentCyan },
  numberText: { ...typography.title, ...typography.numeric },
  rungBody: { flex: 1, gap: 2 },
  rungName: { ...typography.title },
  rungDetail: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  cue: { ...typography.caption, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1 },
  history: { marginTop: spacing.xl, gap: spacing.xs },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 32 },
  moveDate: { ...typography.caption, ...typography.numeric, width: 80 },
  moveText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  sheetButton: { marginBottom: spacing.sm },
}));
