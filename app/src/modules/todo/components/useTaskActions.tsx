/**
 * useTaskActions - ticking, the long-press menu, rescheduling and their undo
 * toasts, written once for the Today page and every frequency page.
 *
 * The rules it keeps:
 *  - Reversible actions (tick, skip, won't do, reschedule) happen at once and
 *    offer Undo for a few seconds; only Delete asks first, because Tasks has
 *    no trash and a delete is for good.
 *  - Undo of a tick on a repeat also takes away the occurrence the tick
 *    created (api.reopenTask does that).
 *  - A sheet closes BEFORE its action runs, so the toast that follows is not
 *    drawn underneath it (a toast lives in the app's window, a sheet in its
 *    own).
 */
import React, { useState } from 'react';
import { Alert } from 'react-native';

import { useToast } from '../../../core/components';
import { success, tap } from '../../../core/haptics';
import { dueLabel } from '../today';
import type { Todo } from '../types';
import { RescheduleSheet, type RescheduleChoice } from './RescheduleSheet';
import { TaskMenuSheet, type TaskMenuAction } from './TaskMenuSheet';

/** What a page's data hook offers; useToday and useTodos both fit. */
export type TaskWrites = {
  complete: (todo: Todo) => Promise<Todo | null | false>;
  skip: (todo: Todo) => Promise<Todo | null | false>;
  wontDo: (todo: Todo) => Promise<boolean>;
  reopen: (todo: Todo) => Promise<boolean>;
  reschedule: (tasks: Todo[], dueDate: string | null) => Promise<boolean>;
  remove: (todo: Todo) => Promise<boolean>;
};

type Rescheduling = {
  tasks: Todo[];
  title: string;
  subtitle?: string;
  canSkip: boolean;
  current: string | null;
};

export function useTaskActions(writes: TaskWrites, today: string, onEdit: (id: string) => void) {
  const toast = useToast();
  const [menuFor, setMenuFor] = useState<Todo | null>(null);
  const [rescheduling, setRescheduling] = useState<Rescheduling | null>(null);

  const nextWords = (next: Todo | null) =>
    next?.due_date ? ` · next ${dueLabel(next.due_date, null, today)}` : '';

  const complete = async (todo: Todo) => {
    success();
    const next = await writes.complete(todo);
    if (next === false) return;
    toast.show({
      message: `Completed${nextWords(next)}`,
      actionLabel: 'Undo',
      onAction: () => void writes.reopen(todo),
    });
  };

  const skip = async (todo: Todo) => {
    const next = await writes.skip(todo);
    if (next === false) return;
    toast.show({
      message: `Skipped${nextWords(next)}`,
      actionLabel: 'Undo',
      onAction: () => void writes.reopen(todo),
    });
  };

  const wontDo = async (todo: Todo) => {
    if (!(await writes.wontDo(todo))) return;
    toast.show({
      message: "Marked won't do",
      actionLabel: 'Undo',
      onAction: () => void writes.reopen(todo),
    });
  };

  const reopen = async (todo: Todo) => {
    if (await writes.reopen(todo)) toast.show({ message: 'Reopened' });
  };

  /** Put each task back on the date it had, one request per distinct date. */
  const undoReschedule = async (tasks: Todo[], movedTo: string | null) => {
    const byDate = new Map<string | null, Todo[]>();
    for (const task of tasks) {
      const group = byDate.get(task.due_date);
      // The rows as they are now, so a failed undo restores the moved state.
      const moved = { ...task, due_date: movedTo };
      if (group) group.push(moved);
      else byDate.set(task.due_date, [moved]);
    }
    for (const [date, group] of byDate) await writes.reschedule(group, date);
  };

  const reschedule = async (tasks: Todo[], date: string | null) => {
    if (!(await writes.reschedule(tasks, date))) return;
    const where = date ? dueLabel(date, null, today) : 'no date';
    toast.show({
      message: tasks.length > 1 ? `Moved ${tasks.length} tasks to ${where}` : `Moved to ${where}`,
      actionLabel: 'Undo',
      onAction: () => void undoReschedule(tasks, date),
    });
  };

  const confirmDelete = (todo: Todo) => {
    Alert.alert(
      'Delete task',
      todo.is_repeat
        ? `"${todo.title}" is deleted for good. Its earlier completions stay in its history.`
        : `"${todo.title}" is deleted for good.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (await writes.remove(todo)) toast.show({ message: 'Task deleted' });
            })();
          },
        },
      ],
    );
  };

  const choose = (action: TaskMenuAction, todo: Todo) => {
    switch (action) {
      case 'reschedule':
        setRescheduling({
          tasks: [todo],
          title: 'Reschedule',
          subtitle: todo.title,
          canSkip: todo.is_repeat,
          current: todo.due_date,
        });
        break;
      case 'skip':
        void skip(todo);
        break;
      case 'wont_do':
        void wontDo(todo);
        break;
      case 'reopen':
        void reopen(todo);
        break;
      case 'edit':
        onEdit(todo.id);
        break;
      case 'delete':
        confirmDelete(todo);
        break;
    }
  };

  const onRescheduleChoice = (choice: RescheduleChoice) => {
    if (!rescheduling) return;
    const { tasks } = rescheduling;
    if (choice.kind === 'skip') void skip(tasks[0]);
    else void reschedule(tasks, choice.date);
  };

  return {
    /** The checkbox: completes an open task, reopens a closed one. */
    toggle: (todo: Todo) => void (todo.is_done ? reopen(todo) : complete(todo)),
    openMenu: (todo: Todo) => {
      tap();
      setMenuFor(todo);
    },
    /** The Overdue section's Reschedule: every task in it, one choice. */
    rescheduleAll: (tasks: Todo[]) =>
      setRescheduling({
        tasks,
        title: `Reschedule ${tasks.length} overdue`,
        subtitle: 'They all move to the day you pick',
        canSkip: false,
        current: null,
      }),
    sheets: (
      <>
        <TaskMenuSheet
          todo={menuFor}
          today={today}
          onClose={() => setMenuFor(null)}
          onChoose={choose}
        />
        <RescheduleSheet
          visible={rescheduling !== null}
          title={rescheduling?.title ?? ''}
          subtitle={rescheduling?.subtitle}
          today={today}
          current={rescheduling?.current ?? null}
          canSkip={rescheduling?.canSkip ?? false}
          onClose={() => setRescheduling(null)}
          onChoose={onRescheduleChoice}
        />
      </>
    ),
  };
}
