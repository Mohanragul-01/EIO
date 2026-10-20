/**
 * TaskMenuSheet - what a long press on a task offers.
 *
 * A sheet of full-width rows rather than an Alert: Android's dialog has three
 * button slots and quietly overwrites the first when given a fourth (see the
 * README's design notes), and this menu has up to five.
 *
 * It never acts itself. It names the choice and closes; the screen acts once
 * the sheet is gone, so the undo toast that follows is not drawn underneath
 * it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { dueLabel } from '../today';
import type { Todo } from '../types';

export type TaskMenuAction = 'reschedule' | 'skip' | 'wont_do' | 'reopen' | 'edit' | 'delete';

type Item = {
  action: TaskMenuAction;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
};

/** Which choices a task gets: skip for a repeat, won't do for a one-off, reopen once closed. */
export function menuItems(todo: Todo): Item[] {
  if (todo.is_done) {
    return [
      { action: 'reopen', label: 'Reopen', hint: 'Back to open', icon: 'arrow-undo-outline' },
      { action: 'edit', label: 'Edit', hint: 'Open the task', icon: 'create-outline' },
      { action: 'delete', label: 'Delete', hint: 'Removes it for good', icon: 'trash-outline', danger: true },
    ];
  }
  return [
    { action: 'reschedule', label: 'Reschedule', hint: 'Today, tomorrow, a date', icon: 'calendar-outline' },
    todo.is_repeat
      ? {
          action: 'skip',
          label: 'Skip this time',
          hint: 'Recorded as skipped; the next one comes round',
          icon: 'play-skip-forward-outline',
        }
      : {
          action: 'wont_do',
          label: "Won't do",
          hint: 'Closes it without counting it as done',
          icon: 'close-circle-outline',
        },
    { action: 'edit', label: 'Edit', hint: 'Details, repeat, reminder', icon: 'create-outline' },
    { action: 'delete', label: 'Delete', hint: 'Removes it for good', icon: 'trash-outline', danger: true },
  ];
}

type TaskMenuSheetProps = {
  todo: Todo | null;
  today: string;
  onClose: () => void;
  onChoose: (action: TaskMenuAction, todo: Todo) => void;
};

export function TaskMenuSheet({ todo, today, onClose, onChoose }: TaskMenuSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Sheet
      visible={todo !== null}
      title={todo?.title ?? ''}
      subtitle={
        todo?.due_date ? dueLabel(todo.due_date, todo.due_time, today) : todo ? 'No date' : undefined
      }
      onClose={onClose}
    >
      {todo
        ? menuItems(todo).map((item) => (
            <Pressable
              key={item.action}
              onPress={() => {
                onClose();
                onChoose(item.action, todo);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityHint={item.hint}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={item.danger ? colors.danger : colors.textSecondary}
              />
              <View style={styles.texts}>
                <Text style={[styles.label, item.danger && styles.danger]}>{item.label}</Text>
                <Text style={styles.hint}>{item.hint}</Text>
              </View>
            </Pressable>
          ))
        : null}
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.6 },
  texts: { flex: 1 },
  label: { ...typography.title, fontSize: 15 },
  danger: { color: colors.danger },
  hint: { ...typography.caption, marginTop: 1 },
}));
