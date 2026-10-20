/**
 * NowShelf - the few things you are actually doing, above everything else.
 *
 * At most five (shelf.ts), as cards in a row: what it is, when you are aiming
 * for, how far along it is, and the next step. The B-List is a stack screen
 * rather than a tab in the swipeable pager, so this row can scroll sideways
 * without fighting a page swipe.
 *
 * A target that has passed says so plainly and offers to move it - next
 * month, next year, or back to Someday. Never red, never "overdue": the
 * point of the shelf is the next thing you do, not a record of slipping.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { formatTarget, isTargetPassed } from '../plan';
import { NOW_CAP, nextStep, shelfProgress } from '../shelf';
import type { BucketItem, BucketStep } from '../types';
import { CategoryIcon } from './CategoryIcon';

type NowShelfProps = {
  shelf: BucketItem[];
  stepsFor: (item: BucketItem) => BucketStep[];
  today: string;
  onOpen: (item: BucketItem) => void;
  onMove: (item: BucketItem) => void;
};

const CARD_WIDTH = 236;

export function NowShelf({ shelf, stepsFor, today, onOpen, onMove }: NowShelfProps) {
  const styles = useStyles();

  if (shelf.length === 0) {
    return (
      <View style={styles.emptyRow}>
        <Text style={styles.label}>Now</Text>
        <Text style={styles.emptyText}>
          Nothing on Now. Hold a pick, or set an item to Now, to keep it here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.label} accessibilityRole="header">
          Now
        </Text>
        <Text style={styles.count}>
          {shelf.length} of {NOW_CAP}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.row}
        // The list below scrolls vertically; this only takes clearly
        // sideways drags.
        directionalLockEnabled
      >
        {shelf.map((item) => (
          <NowCard
            key={item.id}
            item={item}
            steps={stepsFor(item)}
            today={today}
            onOpen={onOpen}
            onMove={onMove}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function NowCard({
  item,
  steps,
  today,
  onOpen,
  onMove,
}: {
  item: BucketItem;
  steps: BucketStep[];
  today: string;
  onOpen: (item: BucketItem) => void;
  onMove: (item: BucketItem) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const progress = shelfProgress(item, steps);
  const upNext = nextStep(steps);
  const target =
    item.target_on && item.target_precision
      ? formatTarget(item.target_on, item.target_precision, today)
      : null;
  const passed = isTargetPassed(item.target_on, item.target_precision, today);

  const progressText = progress
    ? progress.kind === 'steps'
      ? `${progress.done} of ${progress.total} steps`
      : `${formatMoney(progress.done, { compact: true })} of ${formatMoney(progress.total, { compact: true })}`
    : null;

  const spoken = [
    item.title,
    passed ? `target ${target} has passed` : target ? `aiming for ${target}` : null,
    progressText ? `${progressText}, ${progress?.percent} percent` : null,
    upNext ? `next: ${upNext.title}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <GlassCard style={styles.card}>
      <Pressable
        onPress={() => onOpen(item)}
        style={({ pressed }) => [styles.body, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        accessibilityHint="Opens its plan"
      >
        <View style={styles.categoryRow}>
          <CategoryIcon category={item.category} size={13} />
          <Text style={styles.category} numberOfLines={1}>
            {item.category}
          </Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {target && !passed ? (
          <View style={styles.targetRow}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={styles.target}>{target}</Text>
          </View>
        ) : null}

        {progress ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <View style={[styles.meterFill, { width: `${progress.percent}%` }]} />
            </View>
            <Text style={styles.percent}>{progress.percent}%</Text>
          </View>
        ) : null}

        {upNext ? (
          <Text style={styles.next} numberOfLines={1}>
            Next: {upNext.title}
          </Text>
        ) : progressText ? (
          <Text style={styles.next} numberOfLines={1}>
            {progressText}
          </Text>
        ) : null}
      </Pressable>

      {passed ? (
        <Pressable
          onPress={() => onMove(item)}
          style={({ pressed }) => [styles.move, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Target ${target} passed. Move ${item.title} to a new target`}
        >
          <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.moveText} numberOfLines={1}>
            Target passed · Move to…
          </Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  wrap: { marginBottom: spacing.md },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  label: { ...typography.overline },
  count: { ...typography.caption, ...typography.numeric, fontSize: 11.5 },
  // Bleeds past the list's side padding to the screen edges, so a half-shown
  // next card says "there is more this way" instead of being cut at a margin.
  bleed: { marginHorizontal: -spacing.xl },
  row: { gap: spacing.md, paddingHorizontal: spacing.xl },

  emptyRow: { marginBottom: spacing.md, gap: spacing.xs },
  emptyText: { ...typography.caption },

  card: { width: CARD_WIDTH },
  body: { gap: spacing.sm, minHeight: 48 },
  pressed: { opacity: 0.6 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  category: { ...typography.caption, fontSize: 11.5, flex: 1 },
  title: { ...typography.title, minHeight: 40 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  target: { ...typography.caption, color: colors.textSecondary },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meter: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: colors.success },
  percent: { ...typography.caption, ...typography.numeric, fontSize: 11.5, color: colors.textSecondary },
  next: { ...typography.caption, fontSize: 12 },

  move: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  moveText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
}));
