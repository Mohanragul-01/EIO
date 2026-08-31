/**
 * TodoPage - all four frequencies at once.
 *
 * THE ONE CHANGE THAT MATTERS ON A DESKTOP. The phone shows Daily, Weekly,
 * Monthly and Yearly as tabs, because four columns will not fit on a phone.
 * A monitor fits them easily, and seeing them together is a different thing
 * from seeing them one at a time: you can tell at a glance that your weekly
 * list has quietly grown to fifteen items while daily is empty, which tab
 * switching actively hides.
 *
 * Everything else is the phone's behaviour exactly - the same api.ts, the same
 * recurrence rule, the same soft-complete.
 */
import { useCallback, useMemo, useState } from 'react';

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

import { Shell } from '../components/Shell';
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

/** Only "high" gets a loud colour; colouring all three would make none urgent. */
function priorityColor(priority: Priority): string {
  if (priority === 'high') return 'var(--accent-rose)';
  if (priority === 'low') return 'var(--text-muted)';
  return 'var(--accent-indigo)';
}

type Filter = 'open' | 'done' | 'all';

export function TodoPage() {
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Todo | 'new' | null>(null);
  const [newIn, setNewIn] = useState<Frequency>('daily');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  // All four lists in one round of parallel requests. The phone fetches one
  // tab at a time because it only ever shows one.
  const load = useCallback(async () => {
    const lists = await Promise.all(FREQUENCIES.map((f) => api.listTodosByFrequency(f)));
    return Object.fromEntries(FREQUENCIES.map((f, i) => [f, lists[i]])) as Record<
      Frequency,
      Todo[]
    >;
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'todos');

  const visible = useMemo(() => {
    if (!data) return null;
    const pick = (todos: Todo[]) =>
      todos.filter((todo) =>
        filter === 'all' ? true : filter === 'done' ? todo.is_done : !todo.is_done,
      );
    return Object.fromEntries(FREQUENCIES.map((f) => [f, pick(data[f])])) as Record<
      Frequency,
      Todo[]
    >;
  }, [data, filter]);

  const openCount = useMemo(
    () =>
      data
        ? FREQUENCIES.reduce((total, f) => total + data[f].filter((t) => !t.is_done).length, 0)
        : 0,
    [data],
  );

  const overdueCount = useMemo(
    () =>
      data
        ? FREQUENCIES.reduce(
            (total, f) =>
              total +
              data[f].filter((t) => !t.is_done && t.due_date && isOverdue(t.due_date)).length,
            0,
          )
        : 0,
    [data],
  );

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

  return (
    <Shell
      title="Tasks"
      subtitle={
        loading
          ? 'Loading'
          : `${openCount} open${overdueCount > 0 ? ` · ${overdueCount} overdue` : ''}`
      }
      actions={
        <div className="row">
          <Segmented
            value={filter}
            onChange={setFilter}
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
            ＋ New task
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      {loading && !data ? (
        <Spinner center />
      ) : (
        <div className="columns" style={{ marginTop: error || actionError ? 16 : 0 }}>
          {FREQUENCIES.map((frequency, index) => {
            const todos = visible?.[frequency] ?? [];
            const openHere = data?.[frequency].filter((t) => !t.is_done).length ?? 0;

            return (
              <section
                className="column rise"
                key={frequency}
                style={{ animationDelay: `${index * 45}ms` }}
                aria-label={FREQUENCY_LABEL[frequency]}
              >
                <header className="column-head">
                  <div className="row" style={{ gap: 'var(--space-sm)' }}>
                    <span className="column-title">{FREQUENCY_LABEL[frequency]}</span>
                    <span className="column-count">{openHere}</span>
                  </div>
                  <button
                    className="icon-btn"
                    title={`New ${FREQUENCY_LABEL[frequency].toLowerCase()} task`}
                    onClick={() => {
                      setNewIn(frequency);
                      setEditing('new');
                    }}
                  >
                    ＋
                  </button>
                </header>

                <div className="column-body">
                  {todos.length === 0 ? (
                    <div
                      className="card"
                      style={{
                        padding: 'var(--space-xl)',
                        textAlign: 'center',
                        color: 'var(--text-faint)',
                        fontSize: 13,
                      }}
                    >
                      {filter === 'done' ? 'Nothing completed' : 'All clear'}
                    </div>
                  ) : (
                    todos.map((todo) => (
                      <TaskRow
                        key={todo.id}
                        todo={todo}
                        busy={busyId === todo.id}
                        onToggle={() => void toggle(todo)}
                        onEdit={() => setEditing(todo)}
                        onDelete={() => void remove(todo)}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
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

/* ROW ---------------------------------------------------------------------- */

function TaskRow({
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
  const overdue = !todo.is_done && todo.due_date !== null && isOverdue(todo.due_date);
  const dueSoon =
    !todo.is_done && todo.due_date !== null && !overdue && daysUntil(todo.due_date) <= 2;

  return (
    <div className="list-row" style={{ alignItems: 'flex-start' }}>
      <button
        className={`check${todo.is_done ? ' on' : ''}`}
        onClick={onToggle}
        disabled={busy}
        aria-label={todo.is_done ? 'Reopen task' : 'Complete task'}
        style={{ marginTop: 1 }}
      >
        {todo.is_done ? '✓' : ''}
      </button>

      <div className="grow" style={{ minWidth: 0 }}>
        <div className={`row${todo.is_done ? '' : ''}`} style={{ gap: 6, alignItems: 'center' }}>
          {/* Only high priority gets a dot, for the same reason it gets the colour. */}
          {todo.priority === 'high' && !todo.is_done ? (
            <span className="dot" style={{ background: priorityColor('high') }} />
          ) : null}
          <span
            className={todo.is_done ? 'strike' : ''}
            style={{ fontSize: 13.5, fontWeight: 500, wordBreak: 'break-word' }}
          >
            {todo.title}
          </span>
        </div>

        <div className="row" style={{ gap: 'var(--space-sm)', marginTop: 3 }}>
          {todo.due_date ? (
            <span
              style={{
                fontSize: 12,
                color: overdue
                  ? 'var(--danger)'
                  : dueSoon
                    ? 'var(--warning)'
                    : 'var(--text-faint)',
                fontWeight: overdue ? 600 : 400,
              }}
            >
              {formatDueDate(todo.due_date)}
            </span>
          ) : (
            <span className="faint" style={{ fontSize: 12 }}>
              No due date
            </span>
          )}

          {todo.is_repeat ? (
            <span className="faint" style={{ fontSize: 12 }} title="Repeats when completed">
              ↻
            </span>
          ) : null}
        </div>
      </div>

      <div className="row-actions">
        <button className="icon-btn" onClick={onEdit} title="Edit" aria-label="Edit task">
          ✎
        </button>
        <button
          className="icon-btn danger"
          onClick={onDelete}
          title="Delete"
          aria-label="Delete task"
        >
          🗑
        </button>
      </div>
    </div>
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
          <button className="btn btn-glass" onClick={onClose}>
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
        options={PRIORITIES.map((p) => ({
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
          <button className="btn btn-glass btn-sm" onClick={() => setDueDate(todayISO())}>
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
          {isRepeat ? '✓' : ''}
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
