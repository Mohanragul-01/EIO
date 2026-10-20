/**
 * MarkdownView - a note body, read.
 *
 * Draws what markdown.ts parses, one block per source line, so a tick on a
 * `- [ ]` box knows which line of the stored text to change. The box is the
 * one thing you can change here, and it saves at once - the same rule as a
 * checklist tick, because reading a trip plan and ticking "passport" off is
 * one gesture, not an edit.
 *
 * Bullets are drawn dots rather than "•": a glyph comes from whatever font has
 * it, sits on the text baseline and changes weight between devices.
 *
 * Text colours stop at textSecondary, never muted or faint, so the body stays
 * readable on a coloured card's tint.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Pressable, Text, View, type TextStyle } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import { parseMarkdown, type Span } from '../markdown';

type MarkdownViewProps = {
  body: string;
  /** Omit to show the boxes without letting them be ticked (a note in the Trash). */
  onToggleTask?: (line: number) => void;
};

/** One indent step for nested list items. */
const INDENT = 18;

export function MarkdownView({ body, onToggleTask }: MarkdownViewProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const blocks = parseMarkdown(body);

  return (
    <View>
      {blocks.map((block) => {
        switch (block.kind) {
          case 'blank':
            return <View key={block.line} style={styles.blank} />;

          case 'heading':
            return (
              <Text
                key={block.line}
                style={[styles.heading, block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3]}
                accessibilityRole="header"
              >
                <Spans spans={block.spans} />
              </Text>
            );

          case 'paragraph':
            return (
              <Text key={block.line} style={styles.paragraph}>
                <Spans spans={block.spans} />
              </Text>
            );

          case 'quote':
            return (
              <View key={block.line} style={styles.quote}>
                <Text style={[styles.paragraph, styles.quoteText]}>
                  <Spans spans={block.spans} />
                </Text>
              </View>
            );

          case 'bullet':
            return (
              <View key={block.line} style={[styles.listRow, { paddingLeft: block.depth * INDENT }]}>
                <View style={styles.bulletSlot}>
                  <View style={[styles.dot, block.depth > 0 && styles.dotHollow]} />
                </View>
                <Text style={[styles.paragraph, styles.listText]}>
                  <Spans spans={block.spans} />
                </Text>
              </View>
            );

          case 'numbered':
            return (
              <View key={block.line} style={[styles.listRow, { paddingLeft: block.depth * INDENT }]}>
                <Text style={[styles.paragraph, styles.number]}>{block.number}.</Text>
                <Text style={[styles.paragraph, styles.listText]}>
                  <Spans spans={block.spans} />
                </Text>
              </View>
            );

          case 'task': {
            const label = block.spans.map((s) => s.text).join('') || 'Empty item';
            const content = (
              <>
                <View style={[styles.box, block.checked && styles.boxOn]}>
                  {block.checked ? (
                    <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
                  ) : null}
                </View>
                <Text style={[styles.paragraph, styles.listText, block.checked && styles.taskDone]}>
                  <Spans spans={block.spans} />
                </Text>
              </>
            );

            if (!onToggleTask) {
              return (
                <View
                  key={block.line}
                  style={[styles.taskRow, { paddingLeft: block.depth * INDENT }]}
                  accessible
                  accessibilityLabel={`${label}, ${block.checked ? 'done' : 'not done'}`}
                >
                  {content}
                </View>
              );
            }

            return (
              <Pressable
                key={block.line}
                onPress={() => onToggleTask(block.line)}
                style={({ pressed }) => [
                  styles.taskRow,
                  { paddingLeft: block.depth * INDENT },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: block.checked }}
                accessibilityLabel={label}
              >
                {content}
              </Pressable>
            );
          }
        }
      })}
    </View>
  );
}

/** Inline runs. Nested Text, so a bold word wraps with the sentence it is in. */
function Spans({ spans }: { spans: Span[] }) {
  const styles = useStyles();

  return (
    <>
      {spans.map((span, i) => {
        const style: TextStyle[] = [];
        if (span.bold) style.push(styles.bold);
        if (span.italic) style.push(styles.italic);
        if (span.href) style.push(styles.link);

        const href = span.href;
        return (
          <Text
            key={i}
            style={style}
            onPress={href ? () => void Linking.openURL(href).catch(() => undefined) : undefined}
            accessibilityRole={href ? 'link' : undefined}
          >
            {span.text}
          </Text>
        );
      })}
    </>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  blank: { height: spacing.sm },
  paragraph: {
    ...typography.body,
    lineHeight: 22,
  },
  heading: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  h1: { ...typography.h1, fontSize: 21 },
  h2: { ...typography.h2 },
  h3: { ...typography.title },
  bold: {
    // The semibold file, not fontWeight: Android would synthesise a muddy fake
    // bold from the regular one.
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  italic: { fontStyle: 'italic' },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: colors.glassBorderStrong,
    paddingLeft: spacing.md,
    marginVertical: 2,
  },
  quoteText: { fontStyle: 'italic' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletSlot: {
    width: 14,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.textSecondary,
  },
  dotHollow: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textSecondary,
  },
  number: {
    ...typography.numeric,
    minWidth: 20,
    color: colors.textSecondary,
  },
  listText: { flex: 1 },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // A full 48dp row: this is pressed standing up, phone in one hand.
    minHeight: 48,
  },
  pressed: { opacity: 0.6 },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
}));
