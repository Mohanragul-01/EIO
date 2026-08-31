/**
 * TaskRow - one task in the list.
 *
 * Lives in the MODULE's components folder, not core/, because nothing else in
 * the app has a concept of "task". The rule of thumb: if a second module could
 * plausibly use it, it belongs in core/; if it's about this module's domain,
 * it stays here.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatDueDate, isOverdue } from '../../../core/date';
import { motion, radius, spacing } from '../../../core/theme';
import { priorityColor, type Todo } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type TaskRowProps = {
  todo: Todo;
  onToggle: () => void;
  onPress: () => void;
};

export function TaskRow({ todo, onToggle, onPress }: TaskRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  /**
   * The checkbox gets its own little pop on tap - it scales up past 1 and
   * springs back. Completing something should feel momentarily satisfying;
   * this is the cheapest possible version of that.
   */
  const checkScale = useRef(new Animated.Value(1)).current;

  const handleToggle = () => {
    Animated.sequence([
      Animated.timing(checkScale, { toValue: 1.25, duration: 110, useNativeDriver: true }),
      Animated.spring(checkScale, { toValue: 1, useNativeDriver: true, ...motion.press }),
    ]).start();
    onToggle();
  };

  const overdue = todo.due_date && !todo.is_done && isOverdue(todo.due_date);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        {/* The checkbox is its own Pressable INSIDE the card's Pressable, so
            tapping the box toggles while tapping anywhere else opens the
            editor. hitSlop widens the target without enlarging the visual. */}
        <Pressable onPress={handleToggle} hitSlop={12}>
          <Animated.View
            style={[
              styles.checkbox,
              todo.is_done && styles.checkboxDone,
              { transform: [{ scale: checkScale }] },
            ]}
          >
            {todo.is_done ? <Ionicons name="checkmark" size={15} color={colors.onPrimary} /> : null}
          </Animated.View>
        </Pressable>

        <View style={styles.body}>
          <Text
            style={[styles.title, todo.is_done && styles.titleDone]}
            numberOfLines={2}
          >
            {todo.title}
          </Text>

          {/* Meta line only renders when there's something to say - an empty
              row of nothing is worse than no row. */}
          {(todo.due_date || todo.priority !== 'normal' || todo.is_repeat) && !todo.is_done ? (
            <View style={styles.meta}>
              {todo.due_date ? (
                <View style={styles.metaItem}>
                  <Ionicons
                    name={overdue ? 'alert-circle-outline' : 'calendar-outline'}
                    size={12}
                    color={overdue ? colors.danger : colors.textMuted}
                  />
                  <Text style={[styles.metaText, overdue && styles.metaTextOverdue]}>
                    {formatDueDate(todo.due_date)}
                  </Text>
                </View>
              ) : null}

              {todo.is_repeat ? (
                <View style={styles.metaItem}>
                  <Ionicons name="repeat" size={12} color={colors.textMuted} />
                  <Text style={styles.metaText}>Repeats</Text>
                </View>
              ) : null}

              {todo.priority !== 'normal' ? (
                <View style={styles.metaItem}>
                  <View
                    style={[styles.priorityDot, { backgroundColor: priorityColor(todo.priority, colors) }]}
                  />
                  <Text style={[styles.metaText, { color: priorityColor(todo.priority, colors) }]}>
                    {todo.priority === 'high' ? 'High priority' : 'Low priority'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </View>
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
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
  metaTextOverdue: {
    color: colors.danger,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
}));
