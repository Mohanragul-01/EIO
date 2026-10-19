/**
 * QuickAddSheet - add a task in one line.
 *
 * Type "Pay rent every 1st !high" and the words the parser recognised appear
 * underneath as chips saying what they were read as; tap one and those words
 * go back into the title (Todoist's escape hatch, which is what makes a simple
 * grammar safe to use). Enter adds the task and clears the field for the next
 * one, keeping the keyboard up, because tasks tend to arrive in batches. The
 * full editor is one tap away for anything a line cannot say.
 *
 * What is pre-filled comes from where you opened it: Today's date in the
 * Today view, the tab's frequency on a frequency page.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Button, Sheet, TextField } from '../../../core/components';
import { todayISO } from '../../../core/date';
import { success } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import { parseQuickAdd, toTodoInput, type QuickAddResult, type QuickToken } from '../quickAdd';
import { describeRule } from '../recurrence';
import { dueLabel } from '../today';
import { FREQUENCY_LABEL, PRIORITY_LABEL, type Frequency, type Todo } from '../types';

type QuickAddSheetProps = {
  visible: boolean;
  /** Where it files a one-off task, and its date: from the page it was opened on. */
  defaultFrequency: Frequency;
  defaultDueDate: string | null;
  /** "Today", "Weekly" - said in the subtitle so the defaults are not a surprise. */
  contextLabel: string;
  onClose: () => void;
  onAdded: (todo: Todo) => void;
  onOpenEditor: () => void;
};

const TOKEN_ICON: Record<QuickToken['kind'], keyof typeof Ionicons.glyphMap> = {
  date: 'calendar-outline',
  time: 'time-outline',
  repeat: 'repeat',
  priority: 'flag-outline',
};

export function QuickAddSheet({
  visible,
  defaultFrequency,
  defaultDueDate,
  contextLabel,
  onClose,
  onAdded,
  onOpenEditor,
}: QuickAddSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const [text, setText] = useState('');
  const [ignore, setIgnore] = useState<string[]>([]);
  const [parsed, setParsed] = useState<QuickAddResult | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start clean each time it opens. During render rather than in an effect,
  // so the previous session's text is never painted for a frame.
  const [openedAs, setOpenedAs] = useState(visible);
  if (openedAs !== visible) {
    setOpenedAs(visible);
    if (visible) {
      setText('');
      setIgnore([]);
      setParsed(null);
      setAdded([]);
      setError(null);
    }
  }

  // Read in the handlers, not during render: "now" decides what "at 7" means.
  const parse = (value: string, ignored: string[]) => {
    const now = new Date();
    return parseQuickAdd(value, {
      today: todayISO(),
      nowMinutes: now.getHours() * 60 + now.getMinutes(),
      defaultFrequency,
      defaultDueDate,
      ignore: ignored,
    });
  };

  const onChangeText = (value: string) => {
    setText(value);
    setError(null);
    setParsed(value.trim() ? parse(value, ignore) : null);
  };

  const keepAsText = (token: QuickToken) => {
    const next = [...ignore, token.text.toLowerCase()];
    setIgnore(next);
    setParsed(parse(text, next));
  };

  const add = async () => {
    const result = text.trim() ? parse(text, ignore) : null;
    if (!result || !result.title) {
      setError(result ? 'That is all date and time - what needs doing?' : 'Type what needs doing');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const todo = await api.createTodo(toTodoInput(result));
      success();
      setAdded((list) => [summary(todo), ...list].slice(0, 3));
      setText('');
      setIgnore([]);
      setParsed(null);
      onAdded(todo);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that');
    } finally {
      setSaving(false);
    }
  };

  const today = todayISO();
  const preview = parsed && parsed.title ? parsed : null;

  return (
    <Sheet
      visible={visible}
      title="New task"
      subtitle={`Adds to ${contextLabel}. Try "every mon 7pm" or "19/10 !high".`}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button
            label="Add task"
            icon="add"
            onPress={() => void add()}
            loading={saving}
            disabled={!text.trim()}
          />
          <Pressable
            onPress={() => {
              onClose();
              onOpenEditor();
            }}
            style={styles.more}
            accessibilityRole="button"
            accessibilityHint="Opens the full editor for notes, a checklist and a reminder"
          >
            <Ionicons name="open-outline" size={15} color={colors.primary} />
            <Text style={styles.moreText}>More options</Text>
          </Pressable>
        </View>
      }
    >
      <TextField
        label="Task"
        value={text}
        onChangeText={onChangeText}
        placeholder="Pay rent every 1st !high"
        autoFocus
        returnKeyType="done"
        // Enter adds and keeps the keyboard up for the next one.
        submitBehavior="submit"
        onSubmitEditing={() => void add()}
        maxLength={200}
        error={error}
      />

      {parsed && parsed.tokens.length > 0 ? (
        <View style={styles.tokens}>
          {parsed.tokens.map((token) => (
            <Pressable
              key={`${token.start}-${token.text}`}
              onPress={() => keepAsText(token)}
              style={({ pressed }) => [styles.token, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${token.label}, from "${token.text}"`}
              accessibilityHint="Keeps these words in the title instead"
            >
              <Ionicons name={TOKEN_ICON[token.kind]} size={14} color={colors.primary} />
              <View>
                <Text style={styles.tokenLabel}>{token.label}</Text>
                <Text style={styles.tokenSource} numberOfLines={1}>
                  &ldquo;{token.text}&rdquo; · tap to keep as text
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {preview ? (
        <View style={styles.preview} accessibilityLiveRegion="polite">
          <Text style={styles.previewTitle} numberOfLines={2}>
            {preview.title}
          </Text>
          <Text style={styles.previewMeta}>
            {[
              preview.repeat ? describeRule(preview.repeat, preview.dueDate) : FREQUENCY_LABEL[preview.frequency],
              preview.dueDate ? dueLabel(preview.dueDate, preview.dueTime, today) : 'No date',
              `${PRIORITY_LABEL[preview.priority ?? 'normal']} priority`,
            ].join(' · ')}
          </Text>
        </View>
      ) : null}

      {added.length > 0 ? (
        <View style={styles.added} accessibilityLiveRegion="polite">
          {added.map((line, index) => (
            <View key={`${index}-${line}`} style={styles.addedRow}>
              <Ionicons name="checkmark-circle" size={15} color={colors.success} />
              <Text style={styles.addedText} numberOfLines={1}>
                Added {line}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Sheet>
  );

  function summary(todo: Todo): string {
    return todo.due_date ? `${todo.title} · ${dueLabel(todo.due_date, todo.due_time, todayISO())}` : todo.title;
  }
}

const useStyles = makeStyles(({ colors, typography }) => ({
  tokens: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  token: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primary + '1A',
    borderWidth: 1,
    borderColor: colors.primary + '59',
    maxWidth: '100%',
  },
  pressed: { opacity: 0.6 },
  tokenLabel: { ...typography.title, fontSize: 13, color: colors.text },
  tokenSource: { ...typography.caption, fontSize: 11, lineHeight: 14 },
  preview: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  previewTitle: { ...typography.title, fontSize: 15 },
  previewMeta: { ...typography.caption, marginTop: 2 },
  added: { marginTop: spacing.md, gap: 4 },
  addedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addedText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  footer: { gap: spacing.sm },
  more: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreText: { ...typography.title, fontSize: 14, color: colors.primary },
}));
