/**
 * NoteCard - one note in a list.
 *
 * Shows a two-line preview of the body rather than just a title. A notes list
 * of titles alone is nearly useless for recall - the first line of content is
 * usually what you actually recognise. The preview is the body with its
 * Markdown stripped: "**Book** the [train](https://...)" reads "Book the train".
 *
 * A note's colour is a faint tint plus a solid stripe down the left edge; the
 * text colour never changes. On a tinted card every small line is drawn in
 * textSecondary rather than muted or faint, because those two drop under 4.5:1
 * on the tint (noteColors.test pins it).
 *
 * Tap opens; long-press selects. There is no swipe on purpose: the list sits
 * inside the swipeable tab pager, and a card swipe would fight it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { stripMarkdown, taskProgress } from '../markdown';
import { noteTint, readNoteColor } from '../noteColors';
import { NOTE_TYPE_LABEL, checklistProgress, readChecklistItems, type Note } from '../types';

type NoteCardProps = {
  note: Note;
  onPress: () => void;
  onLongPress?: () => void;
  /** In selection mode, whether this card is one of the selected. */
  selected?: boolean;
  /** Replaces the timestamp, e.g. "Deletes in 12 days" in the Trash. */
  meta?: string;
  /** What a long-press does, for TalkBack. */
  longPressHint?: string;
};

export function NoteCard({ note, onPress, onLongPress, selected, meta, longPressHint }: NoteCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const color = readNoteColor(note.color);
  const tinted = color !== null;
  const isChecklist = note.note_type === 'checklist';
  const items = isChecklist ? readChecklistItems(note.checklist_items) : [];
  const progress = isChecklist ? checklistProgress(items) : taskProgress(note.body);

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
    : stripMarkdown(note.body).replace(/\s+/g, ' ').trim();

  const heading = note.title || preview || 'Untitled';
  const progressText =
    progress.total > 0
      ? progress.done === progress.total
        ? 'All done'
        : `${progress.done} of ${progress.total} done`
      : null;

  const spoken = [
    heading,
    NOTE_TYPE_LABEL[note.note_type],
    progressText,
    note.pinned_at ? 'pinned' : null,
    color ? `${color.label.toLowerCase()} note` : null,
    note.tags.length > 0 ? `tagged ${note.tags.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  const small = tinted ? styles.onTint : null;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityHint={onLongPress ? (longPressHint ?? 'Hold to select') : undefined}
    >
      <GlassCard padded={false} style={selected ? styles.selectedShell : undefined}>
        {color ? (
          <>
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: noteTint(color.swatch) }]}
            />
            <View pointerEvents="none" style={[styles.stripe, { backgroundColor: color.swatch }]} />
          </>
        ) : null}

        <View style={styles.body}>
          <View style={styles.titleRow}>
            {isChecklist ? (
              <Ionicons name="checkbox-outline" size={14} color={tinted ? colors.textSecondary : colors.textMuted} />
            ) : null}
            <Text style={styles.title} numberOfLines={1}>
              {/* Quick captures have no title, so the card falls back to the body
                  rather than rendering a blank line where the title would be. */}
              {heading}
            </Text>
            {selected ? (
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            ) : note.pinned_at ? (
              <Ionicons name="pin" size={15} color={tinted ? colors.textSecondary : colors.textMuted} />
            ) : null}
          </View>

          {progressText ? <Text style={[styles.progress, small]}>{progressText}</Text> : null}

          {preview && note.title ? (
            <Text style={[styles.preview, small]} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}

          {note.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {/* Cap at three so a heavily-tagged note doesn't dominate the list,
                  then show a count for the rest. */}
              {note.tags.slice(0, 3).map((tag) => (
                <View key={tag} style={[styles.tag, tinted && styles.tagOnTint]}>
                  <Text style={[styles.tagText, tinted && styles.onTint]}>{tag}</Text>
                </View>
              ))}
              {note.tags.length > 3 ? (
                <Text style={[styles.tagOverflow, small]}>+{note.tags.length - 3}</Text>
              ) : null}
            </View>
          ) : null}

          <Text style={[styles.timestamp, small]}>{meta ?? formatTimestamp(note.updated_at)}</Text>
        </View>
      </GlassCard>
    </Pressable>
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
  wrap: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  selectedShell: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  stripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  body: {
    padding: 18,
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
    flexGrow: 1,
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
  onTint: {
    color: colors.textSecondary,
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
  tagOnTint: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorder,
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
