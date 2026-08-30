/**
 * NoteCard - one note in the list.
 *
 * Shows a two-line preview of the body rather than just a title. A notes list
 * of titles alone is nearly useless for recall - the first line of content is
 * usually what you actually recognise.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import { checklistProgress, readChecklistItems, type Note } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type NoteCardProps = {
  note: Note;
  onPress: () => void;
};

export function NoteCard({ note, onPress }: NoteCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const isChecklist = note.note_type === 'checklist';
  const items = isChecklist ? readChecklistItems(note.checklist_items) : [];
  const { done, total } = checklistProgress(items);

  // Collapse newlines so a multi-line body doesn't blow out the preview
  // height - numberOfLines caps the render, but a body starting with blank
  // lines would otherwise show as empty.
  //
  // A checklist keeps its content in checklist_items, not body, so its preview
  // is built from the first unticked lines: what is still to do is the useful
  // thing to see from the outside.
  const preview = isChecklist
    ? items
        .filter((item) => !item.done)
        .map((item) => item.text)
        .join(', ')
    : note.body.replace(/\s+/g, ' ').trim();

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.titleRow}>
        {isChecklist ? (
          <Ionicons name="checkbox-outline" size={14} color={colors.textMuted} />
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {/* Quick captures have no title, so the card falls back to the body
              rather than rendering a blank line where the title would be. */}
          {note.title || preview || 'Untitled'}
        </Text>
      </View>

      {isChecklist && total > 0 ? (
        <Text style={styles.progress}>
          {done === total ? 'All done' : `${done} of ${total} done`}
        </Text>
      ) : null}

      {preview && note.title ? (
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}

      {note.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {/* Cap at three so a heavily-tagged note doesn't dominate the list,
              then show a count for the rest. */}
          {note.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
          {note.tags.length > 3 ? (
            <Text style={styles.tagOverflow}>+{note.tags.length - 3}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.timestamp}>{formatTimestamp(note.updated_at)}</Text>
    </GlassCard>
  );
}

/**
 * Relative time for recent edits, absolute date once it's old.
 *
 * NOTE the difference from core/date.ts: that file handles calendar DATES
 * (due dates, where timezone shifts cause off-by-one-day bugs). This handles
 * an INSTANT - updated_at is a timestamptz, so `new Date(iso)` is correct here
 * and the local-midnight dance would be wrong.
 */
function formatTimestamp(iso: string): string {
  const then = new Date(iso);
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`;

  const sameYear = then.getFullYear() === new Date().getFullYear();
  return then.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  });
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.title,
    fontSize: 15,
    flexShrink: 1,
  },
  progress: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 3,
  },
  preview: {
    ...typography.caption,
    marginTop: 5,
    lineHeight: 19,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.accentAmber + '1A',
    borderWidth: 1,
    borderColor: colors.accentAmber + '2E',
  },
  tagText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.accentAmber,
  },
  tagOverflow: {
    ...typography.caption,
    fontSize: 11,
  },
  timestamp: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
}));
