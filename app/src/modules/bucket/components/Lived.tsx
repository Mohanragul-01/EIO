/**
 * Lived - the Done view as a life, not a crossed-out list.
 *
 * Each year opens with a card: how many things, what they cost to do, which
 * categories, and a month strip of when. Under it, the year's months, newest
 * first, and one row per thing done: the day it happened down the left, then
 * what it was, where, and the first line of what you wrote.
 *
 * NO STRIKETHROUGH. On a screen where everything is done, a line through
 * every title says nothing and makes all of it harder to read. Done-ness is
 * the screen itself.
 *
 * The year card summarises what is shown under it, so with a filter on (only
 * no/low cost, say) it describes that filtered year - which the subtitle
 * says, rather than passing it off as the whole year.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { YearSummary } from '../lived';
import { AGAIN_LABEL, COST_SHORT, COSTS, type BucketItem } from '../types';
import { MONTH_LONG, MONTH_SHORT, formatWhen, partsOf } from '../when';
import { CategoryIcon } from './CategoryIcon';
import { useCostColor } from './CostMark';

/** The strip's five shades of one token, so it holds in both themes. */
const LEVEL_OPACITY = [0, 0.3, 0.5, 0.75, 1];

export function YearCard({
  year,
  summary,
  filtered,
}: {
  year: number | null;
  summary: YearSummary;
  /** Filters are narrowing what is shown, so the card says so. */
  filtered: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const costColor = useCostColor();

  if (year === null) {
    return (
      <GlassCard style={styles.card}>
        <Text style={styles.unknownTitle} accessibilityRole="header">
          Date unknown
        </Text>
        <Text style={styles.caption}>
          {summary.count} done with no date. Open one to say when - even just the year.
        </Text>
      </GlassCard>
    );
  }

  const busyMonths = summary.months
    .map((count, index) => (count > 0 ? `${MONTH_LONG[index]} ${count}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <GlassCard style={styles.card}>
      <View accessible accessibilityRole="header" accessibilityLabel={`${summary.count} done in ${year}`}>
        <Text style={styles.hero}>
          <Text style={styles.heroNumber}>{summary.count}</Text> done in {year}
        </Text>
      </View>
      {filtered ? <Text style={styles.caption}>Of what the filters show</Text> : null}

      <View style={styles.tiles}>
        {COSTS.map((cost) => (
          <View
            key={cost}
            style={styles.tile}
            accessible
            accessibilityLabel={`${summary.byCost[cost]} ${COST_SHORT[cost]} cost`}
          >
            <Text style={styles.tileNumber}>{summary.byCost[cost]}</Text>
            <View style={styles.tileLabelRow}>
              <View style={[styles.dot, { backgroundColor: costColor(cost) }]} />
              <Text style={styles.tileLabel}>{COST_SHORT[cost]}</Text>
            </View>
          </View>
        ))}
        <View
          style={styles.tile}
          accessible
          accessibilityLabel={`${summary.categoriesTouched} categories`}
        >
          <Text style={styles.tileNumber}>{summary.categoriesTouched}</Text>
          <Text style={styles.tileLabel}>Categories</Text>
        </View>
      </View>

      <View
        style={styles.strip}
        accessible
        accessibilityLabel={busyMonths ? `By month: ${busyMonths}` : 'No dated months'}
      >
        {summary.levels.map((level, index) => (
          <View key={MONTH_SHORT[index]} style={styles.stripCell}>
            <View style={styles.stripTrack}>
              <View
                style={[
                  styles.stripFill,
                  { backgroundColor: colors.success, opacity: LEVEL_OPACITY[level] },
                ]}
              />
            </View>
            <Text style={styles.stripLabel}>{MONTH_SHORT[index].charAt(0)}</Text>
          </View>
        ))}
      </View>
      {summary.sometime > 0 ? (
        <Text style={styles.caption}>+ {summary.sometime} sometime in the year</Text>
      ) : null}

      {summary.topCategories.length > 0 ? (
        <View style={styles.top}>
          <Text style={styles.overline}>Most in</Text>
          {summary.topCategories.map(({ category, count }) => (
            <View key={category} style={styles.topRow}>
              <CategoryIcon category={category} size={14} />
              <Text style={styles.topName} numberOfLines={1}>
                {category}
              </Text>
              <Text style={styles.topCount}>{count}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

export function MonthHeader({
  year,
  month,
  count,
}: {
  year: number | null;
  month: number | null;
  count: number;
}) {
  const styles = useStyles();
  if (year === null) return null;
  const label = month === null ? `Sometime in ${year}` : MONTH_LONG[month - 1];
  return (
    <View style={styles.monthHeader}>
      <Text style={styles.overline} accessibilityRole="header">
        {label}
      </Text>
      <Text style={styles.monthCount}>{count}</Text>
    </View>
  );
}

export function LivedRow({ item, onOpen }: { item: BucketItem; onOpen: (item: BucketItem) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const precision = item.done_precision ?? 'day';
  const parts = item.done_on ? partsOf(item.done_on) : null;
  const firstLine = item.memory.split('\n')[0].trim();
  const when = item.done_on ? formatWhen(item.done_on, precision) : 'date unknown';

  const spoken = [
    item.title,
    `done ${precision === 'year' ? `sometime in ${when}` : when}`,
    item.place ? `at ${item.place}` : null,
    firstLine || null,
    item.again ? `do it again: ${AGAIN_LABEL[item.again]}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onOpen(item)}
      onLongPress={() => onOpen(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens its memory"
    >
      <View style={styles.dateColumn}>
        {parts && precision === 'day' ? (
          <>
            <Text style={styles.day}>{parts.day}</Text>
            <Text style={styles.dayMonth}>{MONTH_SHORT[parts.month - 1]}</Text>
          </>
        ) : parts && precision === 'month' ? (
          <Text style={styles.dayMonth}>{MONTH_SHORT[parts.month - 1]}</Text>
        ) : (
          <Ionicons name="ellipse-outline" size={10} color={colors.textMuted} />
        )}
      </View>

      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.meta}>
          <CategoryIcon category={item.category} size={12} />
          <Text style={styles.metaText} numberOfLines={1}>
            {item.place ? `${item.category} · ${item.place}` : item.category}
          </Text>
        </View>
        {firstLine ? (
          <View style={styles.memoryRow}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
            <Text style={styles.memory} numberOfLines={2}>
              {firstLine}
            </Text>
          </View>
        ) : null}
      </View>

      {item.again ? (
        <View style={styles.again}>
          <Ionicons
            name={item.again === 'no' ? 'close-outline' : 'repeat-outline'}
            size={13}
            color={colors.textMuted}
          />
          <Text style={styles.againText}>{AGAIN_LABEL[item.again]}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginTop: spacing.lg, marginBottom: spacing.sm },
  caption: { ...typography.caption, marginTop: spacing.xs },
  overline: { ...typography.overline },
  unknownTitle: { ...typography.h2 },

  hero: { ...typography.h2 },
  heroNumber: { ...typography.display, ...typography.numeric },

  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tileNumber: { ...typography.title, ...typography.numeric, fontSize: 17 },
  tileLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { ...typography.caption, fontSize: 11 },
  dot: { width: 6, height: 6, borderRadius: 3 },

  strip: { flexDirection: 'row', gap: 3, marginTop: spacing.md },
  stripCell: { flex: 1, alignItems: 'center', gap: 3 },
  stripTrack: {
    alignSelf: 'stretch',
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.glassBorder,
    overflow: 'hidden',
  },
  stripFill: { flex: 1 },
  stripLabel: { ...typography.caption, fontSize: 10, lineHeight: 12 },

  top: { marginTop: spacing.md, gap: spacing.xs },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  topName: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  topCount: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },

  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  monthCount: { ...typography.caption, ...typography.numeric, fontSize: 11 },

  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 10, minHeight: 48 },
  pressed: { opacity: 0.6 },
  dateColumn: { width: 36, alignItems: 'center', paddingTop: 2 },
  day: { ...typography.h2, ...typography.numeric, lineHeight: 22 },
  dayMonth: { ...typography.overline, fontSize: 9.5 },
  rowBody: { flex: 1, gap: 3 },
  // The text colour, not faint: these are the things you did, and they are
  // the point of the screen.
  rowTitle: { ...typography.body, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { ...typography.caption, fontSize: 11.5, flex: 1 },
  memoryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  memory: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  again: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingTop: 3 },
  againText: { ...typography.caption, fontSize: 11 },
}));
