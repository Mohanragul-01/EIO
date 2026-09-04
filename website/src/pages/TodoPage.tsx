/**
 * TodoPage - a kanban board over the four frequencies.
 *
 * THE DESKTOP PAYOFF. The phone shows Daily, Weekly, Monthly and Yearly as
 * tabs, because four columns will not fit. A monitor fits them easily, and
 * seeing them together is a different thing from seeing them one at a time:
 * you can tell at a glance that Weekly has quietly grown to fifteen items while
 * Daily sits empty, which tab switching actively hides.
 *
 * DRAGGING ACROSS a column changes the task's frequency - that is what the
 * columns ARE. Dragging WITHIN one changes `position`, which exists only
 * because you arranged it: everything else about a task's order is decided by
 * the database, and this is the one part that is yours.
 *
 * The order is stored, not local. A board whose arrangement lived in this
 * browser would silently disagree with the phone, and with this same board on
 * another machine.
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

import { daysUntil, formatDueDate, isOverdue, todayISO } from '@app/core/date';
import * as api from '@app/modules/todo/api';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  nextDueDate,
  type Frequency,
  type Priority,
  type Todo,
  type TodoInput,
} from '@app/modules/todo/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { FilterBar, type FilterSpec } from '../components/FilterBar';
import {
  ChipPicker,
  ErrorBanner,
  Modal,
  Segmented,
  Spinner,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

/**
 * Priority colour: red for high, blue for normal, green for low.
 *
 * All three are shown now. The earlier version coloured only "high", on the
 * reasoning that colouring everything makes nothing stand out - true of colour
 * used decoratively, but these are a SCALE, and a scale you can only read one
 * third of is not a scale. Three dots also make an uncoloured card mean
 * "something is wrong" rather than "probably normal".
 *
 * The rgb() values live in tokens.css, one pair per theme, so a dot never has
 * to know which theme is active.
 */
function priorityColor(priority: Priority): string {
  return `var(--priority-${priority})`;
}

type Status = 'open' | 'done' | 'all';
type DueFilter = 'any' | 'overdue' | 'today' | 'week' | 'none';
type PriorityFilter = 'any' | Priority;
type RepeatFilter = 'any' | 'repeating' | 'once';

type Board = Record<Frequency, Todo[]>;

export function TodoPage() {
  const [status, setStatus] = useState<Status>('open');
  const [priority, setPriority] = useState<PriorityFilter>('any');
  const [due, setDue] = useState<DueFilter>('any');
  const [repeat, setRepeat] = useState<RepeatFilter>('any');
  const [query, setQuery] = useState('');

  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [newIn, setNewIn] = useState<Frequency>('daily');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useHotkeys({
    onNew: () => {
      setNewIn('daily');
      setEditing('new');
    },
  });

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

    return Object.fromEntries(
      FREQUENCIES.map((f, i) => [f, { open: open[i], done: done[i] }]),
    ) as Record<Frequency, { open: Todo[]; done: Todo[] }>;
  }, [wantsDone]);

  const { data, loading, error, reload } = useAsync(load, `todos-${wantsDone}`);

  /**
   * The board as shown, held locally so a drag can move a card the instant you
   * drop it rather than after a round trip.
   *
   * Derived from `data` on every render rather than copied into state: an extra
   * copy would need syncing back whenever a reload landed, and the two would
   * disagree exactly when something had gone wrong. `pending` below is the one
   * piece of local truth, and it is cleared as soon as the server confirms.
   */
  const [pending, setPending] = useState<Board | null>(null);

  const serverBoard = useMemo<Board | null>(() => {
    if (!data) return null;
    return Object.fromEntries(
      FREQUENCIES.map((f) => [
        f,
        status === 'open'
          ? data[f].open
          : status === 'done'
            ? data[f].done
            : [...data[f].open, ...data[f].done],
      ]),
    ) as Board;
  }, [data, status]);

  const board = pending ?? serverBoard;

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
          const days = daysUntil(todo.due_date);
          if (due === 'overdue' && days >= 0) return false;
          if (due === 'today' && days !== 0) return false;
          if (due === 'week' && (days < 0 || days > 7)) return false;
        }
      }

      const needle = query.trim().toLowerCase();
      if (needle && !todo.title.toLowerCase().includes(needle)) return false;

      return true;
    },
    [priority, due, repeat, query],
  );

  const visible = useMemo<Board | null>(() => {
    if (!board) return null;
    return Object.fromEntries(
      FREQUENCIES.map((f) => [f, board[f].filter(matches)]),
    ) as Board;
  }, [board, matches]);

  const filtersActive =
    priority !== 'any' || due !== 'any' || repeat !== 'any' || query.trim() !== '';

  const openCount = useMemo(
    () => (data ? FREQUENCIES.reduce((total, f) => total + data[f].open.length, 0) : 0),
    [data],
  );

  const overdueCount = useMemo(
    () =>
      data
        ? FREQUENCIES.reduce(
            (total, f) =>
              total + data[f].open.filter((t) => t.due_date && isOverdue(t.due_date)).length,
            0,
          )
        : 0,
    [data],
  );

  const shownCount = useMemo(
    () => (visible ? FREQUENCIES.reduce((total, f) => total + visible[f].length, 0) : 0),
    [visible],
  );

  /* DRAG ------------------------------------------------------------------ */

  const [dragging, setDragging] = useState<Todo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // A card is also a button - it opens the editor. Requiring a few pixels
      // of travel is what separates "I clicked this" from "I am moving this";
      // without it every click starts a drag and nothing ever opens.
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnOf = useCallback(
    (id: string, from: Board): Frequency | null => {
      if (FREQUENCIES.includes(id as Frequency)) return id as Frequency;
      return FREQUENCIES.find((f) => from[f].some((t) => t.id === id)) ?? null;
    },
    [],
  );

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    const found = board
      ? FREQUENCIES.flatMap((f) => board[f]).find((t) => t.id === id) ?? null
      : null;
    setDragging(found);
  };

  /**
   * Move the card between columns WHILE dragging, not on drop.
   *
   * Without this the card stays in its old column until you let go, so you are
   * aiming at a gap that does not visibly exist yet. Moving it live is what
   * makes the drop position obvious before you commit to it.
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

    // Reorder within the column it has landed in.
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

    setActionError(null);
    try {
      // Frequency first: the row has to belong to the column before the
      // column's order is written, or the reorder names a task that is not
      // in it yet.
      if (movedColumn) await api.setFrequency(activeId, column);

      await api.reorderTodos(nextItems.map((t) => t.id));

      // If it came from another column, that one's numbering now has a hole in
      // it. Harmless for ordering, but renumbering keeps the two columns from
      // drifting apart over many moves.
      if (movedColumn && original) {
        const previous = columnOf(activeId, original);
        if (previous) await api.reorderTodos(next[previous].map((t) => t.id));
      }

      await reload();
      setPending(null);
    } catch (e) {
      // Put the board back the way the server has it. A card that stayed where
      // you dropped it after the write failed would be a lie you would only
      // notice on the next refresh.
      setPending(null);
      setActionError(e instanceof Error ? e.message : 'Could not save that move');
    }
  };

  /* ACTIONS --------------------------------------------------------------- */

  const toggle = async (todo: Todo) => {
    setBusyId(todo.id);
    setActionError(null);
    try {
      if (todo.is_done) await api.reopenTask(todo.id);
      else await api.completeTask(todo);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update that task');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (todo: Todo) => {
    if (!(await confirm('Delete task', `"${todo.title}" will be removed.`))) return;
    setActionError(null);
    try {
      await api.deleteTodo(todo.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that task');
    }
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

  return (
    <Shell
      title="Tasks"
      subtitle={
        loading
          ? 'Loading'
          : filtersActive
            ? `${shownCount} of ${openCount} shown`
            : `${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
      }
      actions={
        <div className="row">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'done', label: 'Done' },
              { value: 'all', label: 'All' },
            ]}
          />
          <button
            className="btn"
            onClick={() => {
              setNewIn('daily');
              setEditing('new');
            }}
          >
            <Icon name="plus" /> New task
          </button>
        </div>
      }
    >
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
      />

      <ErrorBanner message={error ?? actionError} />

      {loading && !data ? (
        <Spinner center />
      ) : (
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
          <div className="columns">
            {FREQUENCIES.map((frequency) => (
              <Column
                key={frequency}
                frequency={frequency}
                todos={visible?.[frequency] ?? []}
                total={board?.[frequency].length ?? 0}
                filtered={filtersActive}
                busyId={busyId}
                onAdd={() => {
                  setNewIn(frequency);
                  setEditing('new');
                }}
                onToggle={(t) => void toggle(t)}
                onEdit={setEditing}
                onDelete={(t) => void remove(t)}
              />
            ))}
          </div>

          {/*
            The card follows the cursor detached from the list, so the gap it
            will drop into stays visible underneath. Rendering the original in
            place and moving it would hide the very thing you are aiming at.
          */}
          <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.2,0,0,1)' }}>
            {dragging ? <TaskCard todo={dragging} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {editing ? (
        <TaskDialog
          todo={editing === 'new' ? null : editing}
          frequency={editing === 'new' ? newIn : editing.frequency}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </Shell>
  );
}

/* COLUMN ------------------------------------------------------------------- */

function Column({
  frequency,
  todos,
  total,
  filtered,
  busyId,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
}: {
  frequency: Frequency;
  todos: Todo[];
  total: number;
  filtered: boolean;
  busyId: string | null;
  onAdd: () => void;
  onToggle: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onDelete: (todo: Todo) => void;
}) {
  // Registered by the column id, so an empty column is still a valid drop
  // target - otherwise you could never move the last task out of one.
  const { setNodeRef, isOver } = useDroppable({ id: frequency });

  return (
    <section className={`column${isOver ? ' drop-target' : ''}`} aria-label={FREQUENCY_LABEL[frequency]}>
      <header className="column-head">
        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          <span className="column-title">{FREQUENCY_LABEL[frequency]}</span>
          <span className="column-count">
            {filtered && todos.length !== total ? `${todos.length}/${total}` : total}
          </span>
        </div>
        <button
          className="icon-btn"
          title={`New ${FREQUENCY_LABEL[frequency].toLowerCase()} task`}
          aria-label={`New ${FREQUENCY_LABEL[frequency].toLowerCase()} task`}
          onClick={onAdd}
        >
          <Icon name="plus" size={14} />
        </button>
      </header>

      <div className="column-body" ref={setNodeRef}>
        <SortableContext items={todos.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {todos.length === 0 ? (
            <div className="column-empty">
              {filtered && total > 0 ? `${total} hidden by filters` : 'Nothing here'}
            </div>
          ) : (
            todos.map((todo) => (
              <SortableTask
                key={todo.id}
                todo={todo}
                busy={busyId === todo.id}
                onToggle={() => onToggle(todo)}
                onEdit={() => onEdit(todo)}
                onDelete={() => onDelete(todo)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </section>
  );
}

/* CARD --------------------------------------------------------------------- */

function SortableTask({
  todo,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  });

  return (
    <TaskCard
      todo={todo}
      busy={busy}
      onToggle={onToggle}
      onEdit={onEdit}
      onDelete={onDelete}
      setNodeRef={setNodeRef}
      // The whole card is the handle, minus the controls, which stop
      // propagation themselves. A dedicated grip would be tidier and would also
      // mean every move starts with hitting a 12px target.
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
  busy,
  overlay,
  onToggle,
  onEdit,
  onDelete,
  setNodeRef,
  handleProps,
  style,
}: {
  todo: Todo;
  busy?: boolean;
  overlay?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  setNodeRef?: (node: HTMLElement | null) => void;
  handleProps?: Record<string, unknown>;
  style?: React.CSSProperties;
}) {
  const overdue = !todo.is_done && todo.due_date !== null && isOverdue(todo.due_date);
  const dueSoon =
    !todo.is_done && todo.due_date !== null && !overdue && daysUntil(todo.due_date) <= 2;

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`task-card${overlay ? ' dragging' : ''}`}
      {...handleProps}
    >
      <button
        className={`check${todo.is_done ? ' on' : ''}`}
        onClick={(e) => {
          // The card is a drag handle; a click on a control inside it is not a
          // drag and must not become one.
          e.stopPropagation();
          onToggle?.();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        disabled={busy || overlay}
        aria-label={todo.is_done ? 'Reopen task' : 'Complete task'}
      >
        {todo.is_done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
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

        <div className="row" style={{ gap: 6, marginTop: 2 }}>
          {todo.due_date ? (
            <span
              className="task-due"
              style={{
                color: overdue
                  ? 'var(--danger)'
                  : dueSoon
                    ? 'var(--warning)'
                    : 'var(--text-faint)',
                fontWeight: overdue ? 550 : 400,
              }}
            >
              {formatDueDate(todo.due_date)}
            </span>
          ) : (
            <span className="task-due faint">No date</span>
          )}

          {todo.is_repeat ? (
            <span className="faint" title="Repeats when completed" style={{ display: 'inline-flex' }}>
              <Icon name="repeat" size={11} />
            </span>
          ) : null}
        </div>
      </div>

      {overlay ? null : (
        <div className="row-actions" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.();
            }}
            title="Edit"
            aria-label="Edit task"
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
            aria-label="Delete task"
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
      )}
    </article>
  );
}

/* DIALOG ------------------------------------------------------------------- */

function TaskDialog({
  todo,
  frequency,
  onClose,
  onSaved,
}: {
  todo: Todo | null;
  frequency: Frequency;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [dueDate, setDueDate] = useState(todo?.due_date ?? '');
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'normal');
  const [freq, setFreq] = useState<Frequency>(todo?.frequency ?? frequency);
  const [isRepeat, setIsRepeat] = useState(todo?.is_repeat ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return setTitleError('Give the task a title');

    setTitleError(null);
    setSaving(true);
    setError(null);

    const input: TodoInput = {
      title: trimmed,
      // '' from a cleared date input means "no due date", which is a different
      // thing from an unset field and has to reach the database as null.
      due_date: dueDate || null,
      priority,
      frequency: freq,
      is_repeat: isRepeat,
    };

    try {
      if (todo) await api.updateTodo(todo.id, input);
      else await api.createTodo(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that task');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={todo ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : todo ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <TextField
        label="Title"
        value={title}
        error={titleError}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What needs doing?"
        autoFocus
        // Enter saves, so a one-line task never needs the mouse.
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />

      <ChipPicker
        label="Frequency"
        value={freq}
        onChange={setFreq}
        options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
      />

      <ChipPicker
        label="Priority"
        value={priority}
        onChange={setPriority}
        options={PRIORITIES.slice()
          .reverse()
          .map((p) => ({
            value: p,
            label: PRIORITY_LABEL[p],
            color: priorityColor(p),
          }))}
      />

      <div className="field">
        <span className="label">Due date</span>
        <div className="row">
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setDueDate(todayISO())}>
            Today
          </button>
          {dueDate ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setDueDate('')}>
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <label className="row" style={{ gap: 'var(--space-md)', cursor: 'pointer' }}>
        <button
          type="button"
          className={`check${isRepeat ? ' on' : ''}`}
          onClick={() => setIsRepeat(!isRepeat)}
          aria-pressed={isRepeat}
        >
          {isRepeat ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
        </button>
        <span>
          <div style={{ fontWeight: 500 }}>Repeat {FREQUENCY_LABEL[freq].toLowerCase()}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {/*
              Showing the actual next date rather than describing the rule.
              The anchoring is the subtle part - the next occurrence counts
              from the task's OWN due date, not from when you tick it - and a
              concrete date is the clearest way to say so.
            */}
            {isRepeat
              ? `Completing it creates the next one, due ${formatDueDate(
                  nextDueDate(dueDate || null, freq),
                )}`
              : 'Completing it just marks it done'}
          </div>
        </span>
      </label>

      <ErrorBanner message={error} />
    </Modal>
  );
}
