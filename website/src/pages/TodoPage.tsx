/**
 * TodoPage - a kanban board over the tasks, and a month calendar of them.
 *
 * THE DESKTOP PAYOFF. The phone shows Today and the four frequencies one at a
 * time, because four columns will not fit. A monitor fits them easily, and
 * seeing them together is a different thing from seeing them one at a time:
 * you can tell at a glance that Weekly has quietly grown to fifteen items
 * while Daily sits empty, which tab switching actively hides.
 *
 * GROUP BY. Frequency answers "what kind of work is this"; Due (Overdue,
 * Today, Tomorrow, This week, Later, No date) and Priority answer "what is
 * urgent". The columns are the frequencies by default because that is the
 * model; the other two are read views of the same tasks.
 *
 * DRAGGING (Frequency only) across a column changes the task's frequency -
 * that is what the columns ARE. Dragging WITHIN one changes `position`, which
 * exists only because you arranged it. The order is stored, not local, so the
 * phone and every browser agree. In the other groupings a drop has no single
 * right meaning ("This week" is not a date), so they do not drag.
 *
 * Above the board, a one-line quick add with the phone's parser.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/todo/api';
import { addDays, ruleOf, shortRule } from '@app/modules/todo/recurrence';
import { groupBySeries, streakFor, type HistoryRow } from '@app/modules/todo/streaks';
import { compareForDay, daysBetween, dueLabel } from '@app/modules/todo/today';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  outcomeOf,
  seriesKey,
  type Frequency,
  type Priority,
  type Todo,
} from '@app/modules/todo/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { useToast } from '../components/Toast';
import { ErrorBanner, Segmented, Spinner, useConfirm } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';
import { QuickAddBar } from './todo/QuickAddBar';
import { TaskCalendar } from './todo/TaskCalendar';
import { TaskDialog } from './todo/TaskDialog';

/**
 * Priority colour: red for high, blue for normal, green for low. All three are
 * shown - a scale you can only read one third of is not a scale. The rgb()
 * values live in tokens.css, one pair per theme.
 */
function priorityColor(priority: Priority): string {
  return `var(--priority-${priority})`;
}

type Status = 'open' | 'done' | 'all';
type GroupBy = 'frequency' | 'due' | 'priority';
type View = 'board' | 'calendar';
type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
type PriorityFilter = 'any' | Priority;
type RepeatFilter = 'any' | 'repeating' | 'once';

type Board = Record<Frequency, Todo[]>;

type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';
const DUE_BUCKETS: DueBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'none'];
const DUE_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'This week',
  later: 'Later',
  none: 'No date',
};

function dueBucket(todo: Todo, today: string): DueBucket {
  if (!todo.due_date) return 'none';
  const days = daysBetween(today, todo.due_date);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'week';
  return 'later';
}

/** Soonest first, then the order a day is worked in. */
function byDue(a: Todo, b: Todo): number {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date < b.due_date ? -1 : 1;
  }
  return compareForDay(a, b);
}

type ColumnSpec = {
  id: string;
  title: string;
  todos: Todo[];
  total: number;
  overdue: number;
  /** Drop target and sortable: Frequency grouping only. */
  draggable: boolean;
  onAdd?: () => void;
  addLabel?: string;
};

export function TodoPage() {
  const toast = useToast();
  const today = todayISO();

  const [status, setStatus] = useState<Status>('open');
  const [groupBy, setGroupBy] = useState<GroupBy>('frequency');
  const [view, setView] = useState<View>('board');
  const [priority, setPriority] = useState<PriorityFilter>('any');
  const [due, setDue] = useState<DueFilter>('any');
  const [repeat, setRepeat] = useState<RepeatFilter>('any');
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [newIn, setNewIn] = useState<{ frequency: Frequency; dueDate: string | null }>({
    frequency: 'daily',
    dueDate: null,
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Bumped after any write, so the calendar reloads the month's closed tasks.
  const [version, setVersion] = useState(0);
  const { confirm, dialog } = useConfirm();

  const openNew = useCallback((frequency: Frequency = 'daily', dueDate: string | null = null) => {
    setNewIn({ frequency, dueDate });
    setEditing('new');
  }, []);

  useHotkeys({ onNew: () => openNew() });

  /**
   * Completed tasks are a SEPARATE, bounded query, and only run when a view
   * needs them. listTodosByFrequency filters to open tasks in SQL because
   * finished ones are never deleted and pile up indefinitely.
   */
  const wantsDone = status !== 'open';

  const load = useCallback(async () => {
    const [open, done] = await Promise.all([
      Promise.all(FREQUENCIES.map((f) => api.listTodosByFrequency(f))),
      wantsDone
        ? Promise.all(FREQUENCIES.map((f) => api.listCompletedByFrequency(f)))
        : Promise.resolve(FREQUENCIES.map(() => [] as Todo[])),
    ]);

    // Streaks are decoration: without them the board still works.
    let history = new Map<string, HistoryRow[]>();
    try {
      const keys = open.flat().filter((t) => t.is_repeat).map(seriesKey);
      history = groupBySeries(await api.listSeriesHistory(keys));
    } catch {
      // Keep the empty map.
    }

    const columns = Object.fromEntries(
      FREQUENCIES.map((f, i) => [f, { open: open[i], done: done[i] }]),
    ) as Record<Frequency, { open: Todo[]; done: Todo[] }>;
    return { columns, history };
  }, [wantsDone]);

  const { data, loading, error, reload } = useAsync(load, `todos-${wantsDone}`);

  const refresh = useCallback(async () => {
    setVersion((v) => v + 1);
    await reload();
  }, [reload]);

  /**
   * The board as shown, held locally so a drag can move a card the instant you
   * drop it rather than after a round trip. `pending` is the one piece of local
   * truth, cleared as soon as the server confirms.
   */
  const [pending, setPending] = useState<Board | null>(null);

  const serverBoard = useMemo<Board | null>(() => {
    if (!data) return null;
    return Object.fromEntries(
      FREQUENCIES.map((f) => [
        f,
        status === 'open'
          ? data.columns[f].open
          : status === 'done'
            ? data.columns[f].done
            : [...data.columns[f].open, ...data.columns[f].done],
      ]),
    ) as Board;
  }, [data, status]);

  const board = pending ?? serverBoard;

  const allOpen = useMemo(
    () => (data ? FREQUENCIES.flatMap((f) => data.columns[f].open) : []),
    [data],
  );

  /** Filters apply to what is DISPLAYED; dragging still reorders the real column. */
  const matches = useCallback(
    (todo: Todo) => {
      if (priority !== 'any' && todo.priority !== priority) return false;

      if (repeat === 'repeating' && !todo.is_repeat) return false;
      if (repeat === 'once' && todo.is_repeat) return false;

      if (due !== 'any') {
        if (due === 'none') {
          if (todo.due_date) return false;
        } else {
          if (!todo.due_date) return false;
          const days = daysBetween(today, todo.due_date);
          if (due === 'overdue' && days >= 0) return false;
          if (due === 'today' && days !== 0) return false;
          if (due === 'week' && (days < 0 || days > 7)) return false;
        }
      }

      const needle = query.trim().toLowerCase();
      if (
        needle &&
        !todo.title.toLowerCase().includes(needle) &&
        !(todo.notes ?? '').toLowerCase().includes(needle)
      ) {
        return false;
      }

      return true;
    },
    [priority, due, repeat, query, today],
  );

  const filtersActive =
    priority !== 'any' || due !== 'any' || repeat !== 'any' || query.trim() !== '';

  const isOverdue = useCallback(
    (t: Todo) => !t.is_done && t.due_date !== null && t.due_date < today,
    [today],
  );

  const openCount = allOpen.length;
  const overdueCount = allOpen.filter(isOverdue).length;

  /** The columns for the current grouping. */
  const columns = useMemo<ColumnSpec[]>(() => {
    if (!board) return [];
    if (groupBy === 'frequency') {
      return FREQUENCIES.map((f) => ({
        id: f,
        title: FREQUENCY_LABEL[f],
        todos: board[f].filter(matches),
        total: board[f].length,
        overdue: board[f].filter(isOverdue).length,
        draggable: true,
        onAdd: () => openNew(f),
        addLabel: `New ${FREQUENCY_LABEL[f].toLowerCase()} task`,
      }));
    }
    const everything = FREQUENCIES.flatMap((f) => board[f]);
    if (groupBy === 'due') {
      return DUE_BUCKETS.map((bucket) => {
        const inBucket = everything.filter((t) => dueBucket(t, today) === bucket).sort(byDue);
        const addDate = bucket === 'today' ? today : bucket === 'tomorrow' ? addDays(today, 1) : null;
        return {
          id: bucket,
          // With completed tasks showing, the past holds finished work too,
          // and "Overdue" would call it late.
          title: bucket === 'overdue' && status !== 'open' ? 'Earlier' : DUE_LABEL[bucket],
          todos: inBucket.filter(matches),
          total: inBucket.length,
          overdue: inBucket.filter(isOverdue).length,
          draggable: false,
          onAdd: bucket === 'overdue' ? undefined : () => openNew('daily', addDate),
          addLabel: `New task, ${DUE_LABEL[bucket].toLowerCase()}`,
        };
      });
    }
    return PRIORITIES.slice()
      .reverse()
      .map((p) => {
        const inBucket = everything.filter((t) => t.priority === p).sort(byDue);
        return {
          id: p,
          title: PRIORITY_LABEL[p],
          todos: inBucket.filter(matches),
          total: inBucket.length,
          overdue: inBucket.filter(isOverdue).length,
          draggable: false,
        };
      });
  }, [board, groupBy, matches, isOverdue, today, openNew, status]);

  const shownCount = columns.reduce((total, c) => total + c.todos.length, 0);

  const streakOf = useCallback(
    (todo: Todo) =>
      todo.is_repeat && !todo.is_done && data
        ? streakFor(data.history.get(seriesKey(todo)) ?? [], todo, today)
        : null,
    [data, today],
  );

  /* DRAG ------------------------------------------------------------------ */

  const [dragging, setDragging] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A card is also a button - it opens the editor. Requiring a few pixels
      // of travel is what separates "I clicked this" from "I am moving this".
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = useCallback((id: string, from: Board): Frequency | null => {
    if (FREQUENCIES.includes(id as Frequency)) return id as Frequency;
    return FREQUENCIES.find((f) => from[f].some((t) => t.id === id)) ?? null;
  }, []);

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const found = board
      ? FREQUENCIES.flatMap((f) => board[f]).find((t) => t.id === id) ?? null
      : null;
    setDragging(found);
  };

  /**
   * Move the card between columns WHILE dragging, not on drop, so the gap it
   * will drop into is visible before you commit to it.
   */
  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || !board) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const from = columnOf(activeId, board);
    const to = columnOf(overId, board);
    if (!from || !to || from === to) return;

    setPending((current) => {
      const source = current ?? board;
      const moving = source[from].find((t) => t.id === activeId);
      if (!moving) return source;

      const overIndex = source[to].findIndex((t) => t.id === overId);
      const insertAt = overIndex >= 0 ? overIndex : source[to].length;

      return {
        ...source,
        [from]: source[from].filter((t) => t.id !== activeId),
        [to]: [
          ...source[to].slice(0, insertAt),
          { ...moving, frequency: to },
          ...source[to].slice(insertAt),
        ],
      };
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDragging(null);

    const source = pending ?? board;
    if (!over || !source) {
      setPending(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const column = columnOf(activeId, source);
    if (!column) {
      setPending(null);
      return;
    }

    const items = source[column];
    const oldIndex = items.findIndex((t) => t.id === activeId);
    const overIndex = items.findIndex((t) => t.id === overId);
    const nextItems =
      overIndex >= 0 && oldIndex >= 0 && oldIndex !== overIndex
        ? arrayMove(items, oldIndex, overIndex)
        : items;

    const next: Board = { ...source, [column]: nextItems };
    setPending(next);

    const original = serverBoard;
    const movedColumn = original ? columnOf(activeId, original) !== column : false;

    // Dropped where it started: nothing to write. Renumbering anyway would
    // mark every task in the column as edited (see reorder_todos in 0020).
    if (!movedColumn && nextItems === items && original && original[column] === items) {
      setPending(null);
      return;
    }

    setActionError(null);
    try {
      // Frequency first: the row has to belong to the column before the
      // column's order is written.
      if (movedColumn) {
        const moving = items.find((t) => t.id === activeId);
        await api.setFrequency(activeId, column, moving?.due_date ?? null);
      }
      await api.reorderTodos(nextItems.map((t) => t.id));
      if (movedColumn && original) {
        const previous = columnOf(activeId, original);
        if (previous) await api.reorderTodos(next[previous].map((t) => t.id));
      }
      await reload();
      setPending(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save that move');
      // Re-read rather than drop the optimistic board: a move is up to three
      // writes, so the stale serverBoard is not the truth either.
      try {
        await reload();
      } catch {
        // The error above already says to retry.
      }
      setPending(null);
    }
  };

  /* ACTIONS --------------------------------------------------------------- */

  const run = async (todo: Todo, write: () => Promise<void>, failure: string) => {
    setBusyId(todo.id);
    setActionError(null);
    try {
      await write();
      await refresh();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : failure);
    } finally {
      setBusyId(null);
    }
  };

  const undo = (todo: Todo) => {
    void run(todo, async () => void (await api.reopenTask(todo.id)), 'Could not undo that');
  };

  const toggle = (todo: Todo) => {
    if (todo.is_done) {
      void run(todo, async () => void (await api.reopenTask(todo.id)), 'Could not reopen that task');
      return;
    }
    void run(
      todo,
      async () => {
        const next = await api.completeTask(todo);
        toast.show({
          message: next?.due_date ? `Completed · next ${dueLabel(next.due_date, null, today)}` : 'Completed',
          actionLabel: 'Undo',
          onAction: () => undo(todo),
        });
      },
      'Could not complete that task',
    );
  };

  const skip = (todo: Todo) => {
    void run(
      todo,
      async () => {
        const next = await api.skipTask(todo);
        toast.show({
          message: next?.due_date ? `Skipped · next ${dueLabel(next.due_date, null, today)}` : 'Skipped',
          actionLabel: 'Undo',
          onAction: () => undo(todo),
        });
      },
      'Could not skip that task',
    );
  };

  const remove = async (todo: Todo) => {
    const message = todo.is_repeat
      ? `"${todo.title}" is deleted for good. Its earlier completions stay in its history.`
      : `"${todo.title}" is deleted for good.`;
    if (!(await confirm('Delete task', message))) return;
    void run(todo, () => api.deleteTodo(todo.id), 'Could not delete that task');
  };

  const filters: FilterSpec[] = [
    {
      key: 'priority',
      label: 'Priority',
      value: priority,
      onChange: (v) => setPriority(v as PriorityFilter),
      options: [
        { value: 'any', label: 'Any priority' },
        ...PRIORITIES.slice()
          .reverse()
          .map((p) => ({ value: p, label: PRIORITY_LABEL[p], dot: priorityColor(p) })),
      ],
    },
    {
      key: 'due',
      label: 'Due',
      value: due,
      onChange: (v) => setDue(v as DueFilter),
      options: [
        { value: 'any', label: 'Any date' },
        { value: 'overdue', label: 'Overdue' },
        { value: 'today', label: 'Due today' },
        { value: 'week', label: 'Next 7 days' },
        { value: 'none', label: 'No due date' },
      ],
    },
    {
      key: 'repeat',
      label: 'Repeat',
      value: repeat,
      onChange: (v) => setRepeat(v as RepeatFilter),
      options: [
        { value: 'any', label: 'All tasks' },
        { value: 'repeating', label: 'Repeating' },
        { value: 'once', label: 'One-off' },
      ],
    },
  ];

  const renderColumns = () => (
    <div className="columns">
      {columns.map((column) => (
        <Column
          key={column.id}
          spec={column}
          filtered={filtersActive}
          showOverdue={status !== 'done'}
          busyId={busyId}
          today={today}
          streakOf={streakOf}
          onToggle={toggle}
          onSkip={skip}
          onEdit={setEditing}
          onDelete={(t) => void remove(t)}
        />
      ))}
    </div>
  );

  return (
    <Shell
      title="Tasks"
      subtitle={
        loading && !data
          ? 'Loading'
          : filtersActive && view === 'board'
            ? `${shownCount} shown`
            : `${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
      }
      actions={
        <div className="row">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Board' },
              { value: 'calendar', label: 'Calendar' },
            ]}
          />
          <button className="btn" onClick={() => openNew()}>
            <Icon name="plus" /> New task
          </button>
        </div>
      }
    >
      <QuickAddBar defaultFrequency="daily" defaultDueDate={null} onAdded={() => void refresh()} />

      <ErrorBanner message={error ?? actionError} />

      {view === 'calendar' ? (
        loading && !data ? (
          <Spinner center />
        ) : (
          <TaskCalendar
            open={allOpen}
            today={today}
            version={version}
            onOpen={setEditing}
            onToggle={toggle}
            onAdded={() => void refresh()}
          />
        )
      ) : (
        <>
          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search tasks' }}
            filters={filters}
            onReset={
              filtersActive
                ? () => {
                    setPriority('any');
                    setDue('any');
                    setRepeat('any');
                    setQuery('');
                  }
                : undefined
            }
            trailing={
              <>
                <span className="faint" style={{ fontSize: 12 }}>
                  Group by
                </span>
                <Segmented
                  value={groupBy}
                  onChange={setGroupBy}
                  options={[
                    { value: 'frequency', label: 'Frequency' },
                    { value: 'due', label: 'Due' },
                    { value: 'priority', label: 'Priority' },
                  ]}
                />
                <Segmented
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: 'open', label: 'Open' },
                    { value: 'done', label: 'Done' },
                    { value: 'all', label: 'All' },
                  ]}
                />
              </>
            }
          />

          {loading && !data ? (
            <Spinner center />
          ) : groupBy === 'frequency' ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragEnd={(e) => void onDragEnd(e)}
              onDragCancel={() => {
                setDragging(null);
                setPending(null);
              }}
            >
              {renderColumns()}

              {/*
                The card follows the cursor detached from the list, so the gap it
                will drop into stays visible underneath.
              */}
              <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2,0,0,1)' }}>
                {dragging ? <TaskCard todo={dragging} today={today} overlay /> : null}
              </DragOverlay>
            </DndContext>
          ) : (
            renderColumns()
          )}
        </>
      )}

      {editing ? (
        <TaskDialog
          todo={editing === 'new' ? null : editing}
          frequency={editing === 'new' ? newIn.frequency : editing.frequency}
          dueDate={editing === 'new' ? newIn.dueDate : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {dialog}
    </Shell>
  );
}

/* COLUMN ------------------------------------------------------------------- */

type CardActions = {
  busyId: string | null;
  today: string;
  streakOf: (todo: Todo) => ReturnType<typeof streakFor> | null;
  onToggle: (todo: Todo) => void;
  onSkip: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
};

function Column({
  spec,
  filtered,
  showOverdue,
  ...actions
}: {
  spec: ColumnSpec;
  filtered: boolean;
  showOverdue: boolean;
} & CardActions) {
  // Registered by the column id, so an empty column is still a valid drop
  // target - otherwise you could never move the last task out of one.
  const { setNodeRef, isOver } = useDroppable({ id: spec.id, disabled: !spec.draggable });
  const { todos, total } = spec;

  const cards = todos.map((todo) =>
    spec.draggable ? (
      <SortableTask key={todo.id} todo={todo} {...actions} />
    ) : (
      <TaskCard key={todo.id} todo={todo} {...actionsFor(todo, actions)} />
    ),
  );

  return (
    <section className={`column${isOver ? ' drop-target' : ''}`} aria-label={spec.title}>
      <header className="column-head">
        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          <span className="column-title">{spec.title}</span>
          <span className="column-count">
            {filtered && todos.length !== total ? `${todos.length}/${total}` : total}
          </span>
          {/* A word and an icon, not just a red number. */}
          {showOverdue && spec.overdue > 0 && spec.id !== 'overdue' ? (
            <span className="column-overdue">
              <Icon name="alert" size={12} />
              {spec.overdue} overdue
            </span>
          ) : null}
        </div>
        {spec.onAdd ? (
          <button
            className="icon-btn"
            title={spec.addLabel}
            aria-label={spec.addLabel}
            onClick={spec.onAdd}
          >
            <Icon name="plus" size={14} />
          </button>
        ) : null}
      </header>

      <div className="column-body" ref={setNodeRef}>
        {todos.length === 0 ? (
          <div className="column-empty">
            {filtered && total > 0 ? `${total} hidden by filters` : 'Nothing here'}
          </div>
        ) : spec.draggable ? (
          <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {cards}
          </SortableContext>
        ) : (
          cards
        )}
      </div>
    </section>
  );
}

function actionsFor(todo: Todo, actions: CardActions) {
  return {
    today: actions.today,
    busy: actions.busyId === todo.id,
    streak: actions.streakOf(todo)?.current ?? 0,
    onToggle: () => actions.onToggle(todo),
    onSkip: todo.is_repeat && !todo.is_done ? () => actions.onSkip(todo) : undefined,
    onEdit: () => actions.onEdit(todo),
    onDelete: () => actions.onDelete(todo),
  };
}

/* CARD --------------------------------------------------------------------- */

function SortableTask({ todo, ...actions }: { todo: Todo } & CardActions) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: todo.id,
    });

  // The card is also the activator: the keyboard sensor then ignores Enter
  // and Space aimed at the buttons inside it, which would otherwise pick the
  // card up instead of pressing them.
  const setCardRef = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );

  return (
    <TaskCard
      todo={todo}
      {...actionsFor(todo, actions)}
      setNodeRef={setCardRef}
      // The whole card is the handle, minus the controls: they stop the
      // pointer themselves, and the keyboard through setCardRef.
      handleProps={{ ...attributes, ...listeners }}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        // The original stays in place as a gap rather than vanishing, so the
        // list does not collapse and re-expand under the cursor.
        opacity: isDragging ? 0 : 1,
      }}
    />
  );
}

function TaskCard({
  todo,
  today,
  busy,
  overlay,
  streak = 0,
  onToggle,
  onSkip,
  onEdit,
  onDelete,
  setNodeRef,
  handleProps,
  style,
}: {
  todo: Todo;
  today: string;
  busy?: boolean;
  overlay?: boolean;
  streak?: number;
  onToggle?: () => void;
  onSkip?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  handleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}) {
  const overdue = !todo.is_done && todo.due_date !== null && todo.due_date < today;
  const dueSoon =
    !todo.is_done && todo.due_date !== null && !overdue && daysBetween(today, todo.due_date) <= 2;
  const outcome = outcomeOf(todo);
  const checked = todo.checklist?.filter((i) => i.done).length ?? 0;
  const steps = todo.checklist?.length ?? 0;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card${overlay ? ' dragging' : ''}${todo.is_done ? ' closed' : ''}`}
      {...handleProps}
    >
      <button
        className={`check${todo.is_done ? ' on' : ''}`}
        onClick={(e) => {
          // The card is a drag handle; a click on a control inside it is not
          // a drag and must not become one.
          e.stopPropagation();
          onToggle?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={busy || overlay}
        aria-label={todo.is_done ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
      >
        {todo.is_done ? (
          <Icon
            name={outcome === 'skipped' ? 'skip' : outcome === 'wont_do' ? 'close' : 'check'}
            size={11}
            strokeWidth={2.5}
          />
        ) : null}
      </button>

      <div className="grow" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span
            className="dot"
            style={{ background: priorityColor(todo.priority) }}
            title={`${PRIORITY_LABEL[todo.priority]} priority`}
          />
          <span className={`task-title${todo.is_done ? ' strike' : ''}`}>{todo.title}</span>
        </div>

        <div className="task-meta">
          {todo.due_date ? (
            <span
              className="task-due task-meta-item"
              style={{
                color: overdue ? 'var(--danger)' : dueSoon ? 'var(--warning)' : 'var(--text-faint)',
                fontWeight: overdue ? 550 : 400,
              }}
            >
              {overdue ? <Icon name="alert" size={11} /> : null}
              {dueLabel(todo.due_date, todo.due_time, today)}
            </span>
          ) : (
            <span className="task-due faint">No date</span>
          )}

          {todo.is_done && outcome && outcome !== 'done' ? (
            <span className="task-due faint">{outcome === 'skipped' ? 'Skipped' : "Won't do"}</span>
          ) : null}

          {todo.is_repeat ? (
            <span className="task-due faint task-meta-item" title="Repeats when completed">
              <Icon name="repeat" size={11} />
              {shortRule(ruleOf(todo))}
            </span>
          ) : null}

          {steps > 0 ? (
            <span className="task-due faint task-meta-item numeric" title="Checklist">
              <Icon name="checklist" size={11} />
              {checked}/{steps}
            </span>
          ) : null}

          {streak >= 2 ? (
            <span className="task-streak numeric" title={`${streak} in a row`}>
              <Icon name="flame" size={11} />
              {streak}
            </span>
          ) : null}
        </div>
      </div>

      {overlay ? null : (
        <div className="row-actions" onPointerDown={(e) => e.stopPropagation()}>
          {onSkip ? (
            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSkip();
              }}
              title="Skip this time"
              aria-label={`Skip ${todo.title} this time`}
              disabled={busy}
            >
              <Icon name="skip" size={14} />
            </button>
          ) : null}
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            title="Edit"
            aria-label={`Edit ${todo.title}`}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            className="icon-btn danger"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.();
            }}
            title="Delete"
            aria-label={`Delete ${todo.title}`}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
    </article>
  );
}
