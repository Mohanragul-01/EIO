/**
 * SkillsTab - the Exercises tab, as Calisthenics sees it: ladders first.
 *
 * In calisthenics the unit of progress is the ladder (tuck -> advanced tuck ->
 * straddle), not the single exercise, so that is what this tab opens on: one
 * card per ladder with the step you are on and how close your last session
 * came to its goal. The plain library is one toggle away, unchanged.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  SegmentedControl,
} from '../../../../core/components';
import { formatEventDate } from '../../../../core/date';
import { useTheme } from '../../../../core/ThemeContext';
import type { RootStackParamList } from '../../../../navigation/types';
import { ProgressRing } from '../../components/ProgressRing';
import { stepLabel } from '../../progression';
import { FAMILIES, FAMILY_LABEL, useLadders, type LadderCard } from '../../useLadders';
import { ExercisesTab } from './ExercisesTab';
import { ErrorBanner, useHomeStyles } from './styles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;
type View_ = 'ladders' | 'library';

export function SkillsTab() {
  const styles = useHomeStyles();
  const [view, setView] = useState<View_>('ladders');

  return (
    <View style={styles.fill}>
      <View style={styles.subToggle}>
        <SegmentedControl
          options={['ladders', 'library'] as View_[]}
          value={view}
          onChange={setView}
          renderLabel={(v) => (v === 'ladders' ? 'Ladders' : 'Library')}
        />
      </View>
      {view === 'ladders' ? <Ladders /> : <ExercisesTab />}
    </View>
  );
}

function Ladders() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { cards, exerciseName, loading, error, reload } = useLadders();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const byFamily = useMemo(
    () =>
      FAMILIES.map((family) => ({
        family,
        cards: cards.filter((c) => c.ladder.progression.family === family),
      })).filter((group) => group.cards.length > 0),
    [cards],
  );

  // "N steps mastered" and the latest moves up: the calisthenics answer to
  // "am I getting anywhere?".
  const mastered = cards.reduce(
    (n, c) => n + c.rungs.filter((r) => r.state === 'mastered').length,
    0,
  );
  const timeline = useMemo(
    () =>
      cards
        .flatMap((c) =>
          c.ladder.moves
            .filter((m) => m.kind === 'up')
            .map((m) => {
              const from = c.ladder.steps.find((s) => s.id === m.from_step_id);
              const to = c.ladder.steps.find((s) => s.id === m.to_step_id);
              return {
                id: m.id,
                date: m.date,
                text: `${from ? exerciseName(from.exercise_id) : '?'} → ${to ? exerciseName(to.exercise_id) : '?'}`,
              };
            }),
        )
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [cards, exerciseName],
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
      <ScrollView
        contentContainerStyle={[styles.list, cards.length === 0 && styles.listEmpty]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await reload();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      >
        {cards.length === 0 ? (
          <EmptyState
            icon="git-commit-outline"
            accent={colors.accentCyan}
            title="No ladders yet"
            message="A ladder is the path to a skill, one variation at a time: tuck, advanced tuck, straddle. Each rung has a goal, and you move up when you have met it."
            action={
              <Button
                label="New ladder"
                icon="add"
                onPress={() => navigation.navigate('LadderEdit', {})}
              />
            }
          />
        ) : (
          <>
            <FadeInView>
              <Button
                label="New ladder"
                icon="add"
                variant="glass"
                onPress={() => navigation.navigate('LadderEdit', {})}
                style={styles.addCard}
              />
            </FadeInView>

            {byFamily.map((group, gi) => (
              <FadeInView key={group.family} delay={Math.min(gi, 6) * 40}>
                <Text style={styles.sectionLabel}>{FAMILY_LABEL[group.family]}</Text>
                {group.cards.map((card) => (
                  <SkillCard
                    key={card.ladder.progression.id}
                    card={card}
                    onPress={() =>
                      navigation.navigate('Ladder', { progressionId: card.ladder.progression.id })
                    }
                  />
                ))}
              </FadeInView>
            ))}

            <FadeInView delay={160}>
              <GlassCard style={styles.progressCard}>
                <Text style={styles.label}>Progress</Text>
                <Text style={styles.bigNumber}>
                  {mastered} {mastered === 1 ? 'step' : 'steps'} mastered
                </Text>
                {timeline.length === 0 ? (
                  <Text style={styles.hint}>Moves up appear here, with the day you made them.</Text>
                ) : (
                  timeline.map((entry) => (
                    <View key={entry.id} style={styles.timelineRow}>
                      <Ionicons name="arrow-up-circle" size={16} color={colors.accentCyan} />
                      <Text style={styles.timelineDate}>{formatEventDate(entry.date)}</Text>
                      <Text style={styles.timelineText} numberOfLines={1}>
                        {entry.text}
                      </Text>
                    </View>
                  ))
                )}
              </GlassCard>
            </FadeInView>
          </>
        )}
      </ScrollView>
      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}

function SkillCard({ card, onPress }: { card: LadderCard; onPress: () => void }) {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const { progression } = card.ladder;
  const total = card.rungs.length;
  const subtitle = card.current
    ? stepLabel(card.current.number, total, card.currentName ?? '')
    : total === 0
      ? 'No rungs yet'
      : 'Not started';

  return (
    <GlassCard onPress={onPress} style={styles.row}>
      <View
        style={styles.rowInner}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${progression.name}. ${subtitle}. ${Math.round(card.progress * 100)} percent of the goal${
          card.ready ? '. Ready to move up' : ''
        }${progression.paused_at ? '. Paused' : ''}`}
      >
        <ProgressRing progress={card.progress} size={46} />
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {progression.name}
          </Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {subtitle}
          </Text>
          {card.ready ? (
            <View style={styles.badge}>
              <Ionicons name="arrow-up-circle" size={13} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>Ready to move up</Text>
            </View>
          ) : progression.paused_at ? (
            <View style={styles.badge}>
              <Ionicons name="pause-circle-outline" size={13} color={colors.textMuted} />
              <Text style={styles.badgeText}>Paused</Text>
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
    </GlassCard>
  );
}
