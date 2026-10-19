/**
 * TrainingCalendar - the month at a glance: which days you trained, and how.
 *
 * Built on the core MonthCalendar. A trained day gets a filled dot; a
 * calisthenics day also gets a small cyan square in its corner, so a mixed
 * week reads at a glance - and every mark is also spoken, never colour alone.
 * Tapping a day opens what you did, or offers to log that day if you forgot.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { GlassCard, MonthCalendar } from '../../../core/components';
import { monthBounds, todayISO } from '../../../core/date';
import { makeStyles } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import { trainingDays, type TrainingDay } from '../streak';

export function TrainingCalendar({
  onPickDay,
  refreshKey,
}: {
  onPickDay: (iso: string) => void;
  /** Changes when sessions change elsewhere, so the month reloads. */
  refreshKey?: unknown;
}) {
  const styles = useStyles();
  const today = todayISO();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [days, setDays] = useState<Record<string, TrainingDay>>({});

  useEffect(() => {
    let active = true;
    const { start, end } = monthBounds(year, month);
    // A week either side, so the leading and trailing days of the grid have
    // their marks too.
    api
      .listSessionsBetween(shift(start, -7), shift(end, 7))
      .then((sessions) => {
        if (active) setDays(trainingDays(sessions));
      })
      .catch(() => {
        // The calendar is a view: a failed load leaves it unmarked.
      });
    return () => {
      active = false;
    };
  }, [year, month, refreshKey]);

  const onChangeMonth = (y: number, m: number) => {
    setYear(y);
    setMonth(m);
  };

  const monthCount = Object.entries(days).filter(([iso]) =>
    iso.startsWith(`${year}-${String(month).padStart(2, '0')}-`),
  ).length;

  return (
    <GlassCard style={styles.card}>
      <MonthCalendar
        year={year}
        month={month}
        onChangeMonth={onChangeMonth}
        onSelect={onPickDay}
        dayLabel={({ iso }) => {
          const day = days[iso];
          if (!day) return null;
          const kinds = [day.gym ? 'gym' : null, day.calisthenics ? 'calisthenics' : null]
            .filter(Boolean)
            .join(' and ');
          return `${day.count} ${day.count === 1 ? 'workout' : 'workouts'}, ${kinds}`;
        }}
        renderDay={({ iso, inMonth, isToday }) => {
          const day = days[iso];
          return (
            <View style={[styles.day, isToday && styles.today]}>
              <Text style={[styles.number, !inMonth && styles.outside]}>
                {Number(iso.slice(8))}
              </Text>
              <View style={styles.marks}>
                {day ? <View style={[styles.dot, !inMonth && styles.faded]} /> : null}
              </View>
              {day?.calisthenics ? (
                <View style={[styles.corner, !inMonth && styles.faded]} />
              ) : null}
            </View>
          );
        }}
      />
      <Text style={styles.footer}>
        {monthCount === 0
          ? 'No training this month yet.'
          : `${monthCount} training ${monthCount === 1 ? 'day' : 'days'} this month · dot: trained · square: calisthenics`}
      </Text>
    </GlassCard>
  );
}

function shift(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginTop: spacing.md },
  day: {
    width: 38,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  today: { borderColor: colors.primary },
  number: { ...typography.caption, ...typography.numeric, color: colors.text },
  outside: { color: colors.textFaint },
  marks: { height: 8, justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  corner: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 1,
    backgroundColor: colors.accentCyan,
  },
  faded: { opacity: 0.4 },
  footer: { ...typography.caption, marginTop: spacing.sm },
}));
