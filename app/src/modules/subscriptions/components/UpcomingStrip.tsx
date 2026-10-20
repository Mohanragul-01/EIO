/**
 * UpcomingStrip - the next fourteen days at a glance.
 *
 * One column a day: weekday, date, up to two tiles for what renews (or a
 * trial that ends), and the rupees that leave. Knowing ₹6,000 goes in the
 * first week of the month matters more than any chart. Tapping a day narrows
 * the list to that day; tapping it again clears it.
 *
 * It scrolls sideways, which is why the list screen switches views with tabs
 * rather than a swipe pager: two horizontal gestures in one place fight.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { makeStyles } from '../../../core/ThemeContext';
import { fromISODate } from '../../../core/date';
import { radius, spacing } from '../../../core/theme';
import { stripDayLabel } from '../format';
import type { StripDay } from '../upcoming';
import { BrandTile } from './BrandTile';

/** "₹1.2k" style for a narrow column; the full figure is in the label. */
function compactRupees(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(1).replace(/\.0$/, '')}L`;
  if (rupees >= 10_000) return `₹${Math.round(rupees / 1000)}k`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `₹${Math.round(rupees)}`;
}

export function UpcomingStrip({
  days,
  selected,
  onSelect,
}: {
  days: StripDay[];
  selected: string | null;
  onSelect: (iso: string | null) => void;
}) {
  const styles = useStyles();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityLabel="Next 14 days"
    >
      {days.map((day, index) => {
        const date = fromISODate(day.iso);
        const isToday = index === 0;
        const isSelected = selected === day.iso;
        const count = day.charges.length;

        return (
          <Pressable
            key={day.iso}
            onPress={() => onSelect(isSelected ? null : day.iso)}
            style={({ pressed }) => [
              styles.day,
              isToday && styles.today,
              isSelected && styles.selected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={stripDayLabel(day, isToday)}
            accessibilityState={{ selected: isSelected }}
          >
            {/* Today says so in words: an outline alone is colour alone. */}
            <Text
              style={[
                styles.weekday,
                isToday && styles.todayWord,
                isSelected && styles.selectedText,
              ]}
              numberOfLines={1}
            >
              {isToday ? 'Today' : date.toLocaleDateString(undefined, { weekday: 'narrow' })}
            </Text>
            <Text style={[styles.number, isSelected && styles.selectedText]}>
              {date.getDate()}
            </Text>
            <View style={styles.tiles}>
              {day.charges.slice(0, 2).map((charge, i) => (
                <View key={`${charge.sub.id}-${i}`} style={i > 0 ? styles.overlap : undefined}>
                  <BrandTile sub={charge.sub} size={18} />
                </View>
              ))}
              {count > 2 ? <Text style={styles.more}>+{count - 2}</Text> : null}
            </View>
            <Text style={[styles.total, isSelected && styles.selectedText]} numberOfLines={1}>
              {day.totalMinor > 0 ? compactRupees(day.totalMinor) : ' '}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  content: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  day: {
    width: 52,
    minHeight: 104,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  today: {
    borderColor: colors.primary,
  },
  selected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectedText: {
    color: colors.onPrimary,
  },
  pressed: {
    opacity: 0.75,
  },
  weekday: {
    ...typography.overline,
    fontSize: 10,
  },
  todayWord: {
    // "TODAY" in a 52dp column: a little less tracking than one letter needs.
    letterSpacing: 0.4,
    color: colors.text,
  },
  number: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 16,
    marginTop: 2,
  },
  tiles: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    marginTop: spacing.xs,
  },
  overlap: {
    marginLeft: -6,
  },
  more: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    marginLeft: 2,
    color: colors.textSecondary,
  },
  total: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 2,
    color: colors.textSecondary,
  },
}));
