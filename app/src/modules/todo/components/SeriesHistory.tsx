/**
 * SeriesHistory - how a routine has gone: its streak, its best, how often it
 * was done or skipped, and a month calendar marking each day one occurrence
 * was closed and how.
 *
 * Every mark carries an icon as well as its tint (a tick for done, a skip
 * arrow, a cross for won't do), and the calendar tells TalkBack the same in
 * words, because the cell's own label hides what is drawn inside it.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { MonthCalendar, type CalendarDay } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import { historyDays, streakFor, type HistoryRow } from '../streaks';
import { seriesKey, type Outcome, type Todo } from '../types';

type SeriesHistoryProps = {
  todo: Todo;
  today: string;
};

const SPOKEN: Record<Outcome, string> = { done: 'done', skipped: 'skipped', wont_do: "won't do" };

export function SeriesHistory({ todo, today }: SeriesHistoryProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [month, setMonth] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));

  const key = seriesKey(todo);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const history = await api.listSeriesHistory([key]);
        if (active) setRows(history);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [key]);

  if (failed) {
    return <Text style={styles.note}>History could not be loaded. Open the task again to retry.</Text>;
  }
  if (!rows) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  const stats = streakFor(rows, todo.is_done ? null : todo, today);
  const days = historyDays(rows);

  const renderDay = (day: CalendarDay) => {
    const outcome = days.get(day.iso);
    return (
      <View
        style={[
          styles.day,
          outcome === 'done' && styles.dayDone,
          outcome && outcome !== 'done' && styles.dayOther,
          day.isToday && styles.dayToday,
        ]}
      >
        <Text style={[styles.dayNumber, !day.inMonth && !outcome && styles.dayOutside]}>
          {Number(day.iso.slice(8))}
        </Text>
        {outcome ? (
          <Ionicons
            name={outcome === 'done' ? 'checkmark' : outcome === 'skipped' ? 'play-skip-forward' : 'close'}
            size={10}
            color={outcome === 'done' ? colors.text : colors.textSecondary}
          />
        ) : null}
      </View>
    );
  };

  return (
    <View>
      <View style={styles.stats}>
        <Stat icon="flame" tint={colors.accentAmber} value={stats.current} label="In a row" />
        <Stat icon="trophy-outline" tint={colors.accentIndigo} value={stats.best} label="Best" />
        <Stat icon="checkmark-done" tint={colors.success} value={stats.done} label="Done" />
        <Stat icon="play-skip-forward-outline" tint={colors.textMuted} value={stats.skipped} label="Skipped" />
      </View>

      {rows.length === 0 ? (
        <Text style={styles.note}>Nothing closed yet. Each time it is done or skipped, it shows here.</Text>
      ) : (
        <View style={styles.calendar}>
          <MonthCalendar
            year={month.year}
            month={month.month}
            onChangeMonth={(year, m) => setMonth({ year, month: m })}
            renderDay={renderDay}
            dayLabel={(day) => {
              const outcome = days.get(day.iso);
              return outcome ? SPOKEN[outcome] : null;
            }}
          />
        </View>
      )}
    </View>
  );
}

function Stat({
  icon,
  tint,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  value: number;
  label: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={15} color={tint} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  loading: { marginVertical: spacing.lg },
  note: { ...typography.caption, marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: 2,
  },
  statValue: { ...typography.h2, ...typography.numeric },
  statLabel: { ...typography.caption, fontSize: 11, lineHeight: 14 },
  calendar: { marginTop: spacing.lg },
  day: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  dayDone: { backgroundColor: colors.completed },
  dayOther: { borderColor: colors.glassBorderStrong, borderStyle: 'dashed' },
  dayToday: { borderColor: colors.primary, borderStyle: 'solid' },
  dayNumber: { ...typography.caption, ...typography.numeric, color: colors.text, lineHeight: 15 },
  dayOutside: { color: colors.textFaint },
}));
