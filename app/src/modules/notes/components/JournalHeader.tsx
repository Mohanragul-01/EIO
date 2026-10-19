/**
 * JournalHeader - the top of the Journal tab: why come back to it.
 *
 *   1. A streak chip and the last seven days as dots.
 *   2. On this day: entries from this date in earlier years. Hidden when
 *      nothing matches - an empty "On this day" card is a small sadness.
 *   3. A prompt, only while today has no entry, with Shuffle and Answer.
 *
 * Everything comes from journal.ts over the entries the tab already has, so
 * this costs no request. The On this day cards stack rather than scroll
 * sideways: this sits inside the tab pager, where a sideways swipe changes
 * tab.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, GlassCard } from '../../../core/components';
import { formatEventDate } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { journalStreak, onThisDay, promptFor, todaysEntry, weekStrip } from '../journal';
import { stripMarkdown } from '../markdown';
import type { Note } from '../types';

type JournalHeaderProps = {
  entries: Note[];
  today: string;
  onOpen: (id: string) => void;
  onAnswer: (prompt: string) => void;
};

/** More than this many years on one date fold behind "Show N more". */
const ON_THIS_DAY_SHOWN = 2;

export function JournalHeader({ entries, today, onOpen, onAnswer }: JournalHeaderProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [shuffle, setShuffle] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const streak = journalStreak(entries, today);
  const week = weekStrip(entries, today);
  const memories = onThisDay(entries, today);
  const wroteToday = todaysEntry(entries, today) !== null;
  const prompt = promptFor(today, shuffle);
  const daysThisWeek = week.filter((d) => d.hasEntry).length;

  const shown = showAll ? memories : memories.slice(0, ON_THIS_DAY_SHOWN);

  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <View
          style={[styles.streak, streak === 0 && styles.streakIdle]}
          accessible
          accessibilityLabel={streak === 0 ? 'No streak yet' : `${streak}-day streak`}
        >
          <Ionicons
            name={streak > 0 ? 'flame' : 'flame-outline'}
            size={15}
            color={streak > 0 ? colors.accentAmber : colors.textSecondary}
          />
          <Text style={[styles.streakText, streak > 0 && styles.streakTextOn]}>
            {streak === 0 ? 'Start a streak' : `${streak}-day streak`}
          </Text>
        </View>

        <View
          style={styles.week}
          accessible
          accessibilityLabel={`${daysThisWeek} of the last 7 days have an entry`}
        >
          {week.map((day) => (
            <View
              key={day.date}
              style={[styles.day, day.hasEntry && styles.dayFilled, day.isToday && styles.dayToday]}
            />
          ))}
        </View>
      </View>

      {shown.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.overline}>On this day</Text>
          {shown.map(({ note, yearsAgo }) => {
            const preview = stripMarkdown(note.body).replace(/\s+/g, ' ').trim();
            const when = `${yearsAgo === 1 ? '1 year ago' : `${yearsAgo} years ago`} · ${formatEventDate(note.entry_date ?? today)}`;
            return (
              <GlassCard key={note.id} onPress={() => onOpen(note.id)} style={styles.memory}>
                <Text style={styles.memoryWhen}>{when}</Text>
                {note.title ? <Text style={styles.memoryTitle} numberOfLines={1}>{note.title}</Text> : null}
                {preview ? (
                  <Text style={styles.memoryPreview} numberOfLines={2}>
                    {preview}
                  </Text>
                ) : null}
              </GlassCard>
            );
          })}
          {memories.length > ON_THIS_DAY_SHOWN ? (
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              style={styles.more}
              accessibilityRole="button"
              accessibilityState={{ expanded: showAll }}
            >
              <Text style={styles.moreText}>
                {showAll ? 'Show fewer' : `Show ${memories.length - ON_THIS_DAY_SHOWN} more`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!wroteToday ? (
        <GlassCard style={styles.section}>
          <View style={styles.promptHeader}>
            <Text style={styles.overline}>A prompt for today</Text>
            <Pressable
              onPress={() => setShuffle((n) => n + 1)}
              style={styles.shuffle}
              accessibilityRole="button"
              accessibilityLabel="Another prompt"
            >
              <Ionicons name="shuffle" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
          <Text style={styles.prompt} accessibilityLiveRegion="polite">
            {prompt}
          </Text>
          <Button
            label="Answer"
            icon="create-outline"
            variant="glass"
            onPress={() => onAnswer(prompt)}
            style={styles.answer}
          />
        </GlassCard>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  wrap: {
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.accentAmber + '1F',
    borderWidth: 1,
    borderColor: colors.accentAmber + '40',
  },
  streakIdle: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
  },
  streakText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  streakTextOn: {
    color: colors.text,
    fontFamily: typography.title.fontFamily,
  },
  week: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  day: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
  },
  dayFilled: {
    backgroundColor: colors.accentAmber,
    borderColor: colors.accentAmber,
  },
  dayToday: {
    width: 12,
    height: 12,
    borderColor: colors.text,
  },
  section: {
    marginTop: spacing.lg,
  },
  overline: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  memory: {
    marginBottom: spacing.sm,
  },
  memoryWhen: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  memoryTitle: {
    ...typography.title,
    fontSize: 15,
    marginTop: 2,
  },
  memoryPreview: {
    ...typography.caption,
    marginTop: 3,
    lineHeight: 19,
  },
  more: {
    minHeight: 48,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  moreText: {
    ...typography.caption,
    color: colors.primary,
  },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shuffle: {
    width: 48,
    height: 48,
    marginRight: -14,
    marginTop: -14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompt: {
    ...typography.h2,
    fontSize: 17,
    lineHeight: 24,
  },
  answer: {
    marginTop: spacing.lg,
  },
}));
