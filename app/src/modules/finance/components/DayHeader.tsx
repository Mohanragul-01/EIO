/**
 * DayHeader - "Thu 16 Oct · ₹840 out · ₹500 in" above a day's entries.
 *
 * The day's totals are the first thing you check against memory ("did I
 * really spend 840 on Thursday?"), so they sit with the date rather than at
 * the bottom of the list. Transfers are not in them.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { formatEventDate, fromISODate } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { shortDate } from '../period';
import type { DayGroup } from '../summary';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Today", "Yesterday", or "Thu 16 Oct" - day first, whatever the phone's locale. */
export function dayLabel(iso: string): string {
  const relative = formatEventDate(iso);
  if (relative === 'Today' || relative === 'Yesterday') return relative;
  return `${WEEKDAYS[fromISODate(iso).getDay()]} ${shortDate(iso)}`;
}

export function DayHeader({ day }: { day: DayGroup }) {
  const styles = useStyles();
  const parts = [dayLabel(day.date)];
  if (day.outMinor > 0) parts.push(`${formatMoney(day.outMinor, { compact: true })} out`);
  if (day.inMinor > 0) parts.push(`${formatMoney(day.inMinor, { compact: true })} in`);

  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.text}>{parts.join(' · ')}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  wrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  text: {
    ...typography.overline,
    ...typography.numeric,
  },
}));
