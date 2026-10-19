/**
 * TaskRow - one task in a list.
 *
 * Lives in the MODULE's components folder, not core/, because nothing else in
 * the app has a concept of "task". The rule of thumb: if a second module could
 * plausibly use it, it belongs in core/; if it's about this module's domain,
 * it stays here.
 *
 * TAP opens the task; the CHECKBOX ticks it; a LONG PRESS opens the menu
 * (reschedule, skip, edit, delete). No swipes: the list sits inside the
 * swipeable tab pager, and a row that also swiped sideways would fight it for
 * every horizontal drag. TalkBack reaches the menu through a named custom
 * action, since a long press is not something a screen reader user finds.
 *
 * The meta line says the date in relative words, the time, the repeat rule,
 * checklist progress, a streak, and priority - each with an icon or a word, so
 * nothing on it is carried by colour alone.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, Text, useAnimatedValue, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { motion, radius, spacing } from '../../../core/theme';
import { ruleOf, shortRule } from '../recurrence';
import type { StreakStats } from '../streaks';
import { dueLabel, formatTime } from '../today';
import { outcomeOf, priorityColor, PRIORITY_LABEL, type Todo } from '../types';

type TaskRowProps = {
  todo: Todo;
  today: string;
  streak?: StreakStats | null;
  /**
   * 'time' shows only the time: in the Today section the date is the section.
   * 'full' (default) shows the relative date and the time.
   */
  dateStyle?: 'full' | 'time';
  onToggle: () => void;
  onPress: () => void;
  onLongPress?: () => void;
};

const OUTCOME_WORD = { done: 'Done', skipped: 'Skipped', wont_do: "Won't do" } as const;

export function TaskRow({
  todo,
  today,
  streak,
  dateStyle = 'full',
  onToggle,
  onPress,
  onLongPress,
}: TaskRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  /**
   * The checkbox gets its own little pop on tap - it scales up past 1 and
   * springs back. Completing something should feel momentarily satisfying;
   * this is the cheapest possible version of that.
   */
  const checkScale = useAnimatedValue(1);

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(checkScale, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, ...motion.press }),
    ]).start();
    onToggle();
  };

  const closed = todo.is_done;
  const outcome = outcomeOf(todo);
  const overdue = !closed && todo.due_date !== null && todo.due_date < today;

  const date =
    todo.due_date === null
      ? null
      : dateStyle === 'time'
        ? todo.due_time
          ? formatTime(todo.due_time)
          : null
        : dueLabel(todo.due_date, todo.due_time, today);

  // `?? []` and `?? ''` guard a row read before migration 0020 has run.
  const checklist = todo.checklist ?? [];
  const checklistDone = checklist.filter((item) => item.done).length;
  const rule = todo.is_repeat ? shortRule(ruleOf(todo)) : null;
  const streakCount = streak && streak.current >= 2 ? streak.current : null;
  // Muted text is too faint on the completed tint; closed rows use textSecondary.
  const metaColor = closed ? colors.textSecondary : colors.textMuted;

  // One sentence for TalkBack, in the order the eye reads the row.
  const spoken = [
    todo.title,
    closed && outcome ? OUTCOME_WORD[outcome] : null,
    date ? (overdue ? `overdue, ${date}` : date) : null,
    rule ? `repeats ${rule}` : null,
    checklist.length > 0 ? `${checklistDone} of ${checklist.length} checked` : null,
    streakCount ? `${streakCount} in a row` : null,
    closed ? null : `${PRIORITY_LABEL[todo.priority]} priority`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <GlassCard padded={false} style={styles.card}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [styles.row, closed && styles.rowClosed, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint={onLongPress ? 'Opens the task. Hold for more actions.' : 'Opens the task'}
        accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'More actions' }] : undefined}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
        }}
      >
        {/* Its own Pressable inside the row's, so tapping the box ticks while
            tapping anywhere else opens. hitSlop takes the 24dp box to 48. */}
        <Pressable
          onPress={handleToggle}
          hitSlop={12}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: closed }}
          accessibilityLabel={closed ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
        >
          <Animated.View
            style={[
              styles.checkbox,
              closed && styles.checkboxDone,
              { transform: [{ scale: checkScale }] },
            ]}
          >
            {closed ? (
              <Ionicons
                name={
                  outcome === 'done' ? 'checkmark' : outcome === 'skipped' ? 'play-skip-forward' : 'close'
                }
                size={14}
                color={colors.onPrimary}
              />
            ) : null}
          </Animated.View>
        </Pressable>

        <View style={styles.body}>
          <Text style={[styles.title, closed && styles.titleDone]} numberOfLines={2}>
            {todo.title}
          </Text>

          <View style={styles.meta}>
            {closed && outcome && outcome !== 'done' ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name={outcome === 'skipped' ? 'play-skip-forward-outline' : 'close-circle-outline'}
                  size={12}
                  color={metaColor}
                />
                <Text style={[styles.metaText, { color: metaColor }]}>{OUTCOME_WORD[outcome]}</Text>
              </View>
            ) : null}

            {date ? (
              <View style={styles.metaItem}>
                <Ionicons
                  name={
                    overdue
                      ? 'alert-circle-outline'
                      : dateStyle === 'time'
                        ? 'time-outline'
                        : 'calendar-outline'
                  }
                  size={12}
                  color={overdue ? colors.danger : metaColor}
                />
                <Text style={[styles.metaText, { color: overdue ? colors.danger : metaColor }]}>
                  {date}
                </Text>
              </View>
            ) : null}

            {rule ? (
              <View style={styles.metaItem}>
                <Ionicons name="repeat" size={12} color={metaColor} />
                <Text style={[styles.metaText, { color: metaColor }]}>{rule}</Text>
              </View>
            ) : null}

            {checklist.length > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="list-outline" size={12} color={metaColor} />
                <Text style={[styles.metaText, styles.numeric, { color: metaColor }]}>
                  {checklistDone}/{checklist.length}
                </Text>
              </View>
            ) : null}

            {(todo.notes ?? '').trim() ? (
              <Ionicons name="document-text-outline" size={12} color={metaColor} />
            ) : null}

            {streakCount ? (
              <View style={[styles.metaItem, styles.streak]}>
                <Ionicons name="flame" size={12} color={colors.accentAmber} />
                <Text style={[styles.metaText, styles.numeric, styles.streakText]}>{streakCount}</Text>
              </View>
            ) : null}

            {/* Every priority, including normal: a scale you can read one
                third of is not a scale. The word sits beside the dot. */}
            {!closed ? (
              <View style={styles.metaItem}>
                <View
                  style={[styles.priorityDot, { backgroundColor: priorityColor(todo.priority, colors) }]}
                />
                <Text style={[styles.metaText, { color: priorityColor(todo.priority, colors) }]}>
                  {PRIORITY_LABEL[todo.priority]}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </Pressable>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    minHeight: 64,
  },
  rowClosed: {
    backgroundColor: colors.completed,
  },
  pressed: {
    opacity: 0.75,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  checkboxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  body: {
    flex: 1, // takes the leftover width so the chevron pins to the right
    paddingRight: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 15,
  },
  titleDone: {
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: 4,
    marginTop: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    fontSize: 12,
  },
  numeric: {
    ...typography.numeric,
  },
  streak: {
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentAmber + '1F',
  },
  streakText: {
    fontFamily: typography.title.fontFamily,
    color: colors.text,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
}));
