/**
 * TaskDialog - create or edit a task on the website: everything the phone's
 * editor has (time, reminder, notes, checklist, the full repeat rule with its
 * next three dates) in one dialog.
 *
 * The reminder is chosen here but rings on the phone: a browser cannot hold a
 * notification for when the tab is closed, so the field says so.
 */
import { useState } from 'react';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/todo/api';
import { offsetLabel, REMINDER_OFFSETS } from '@app/modules/todo/notifications';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  type ChecklistItem,
  type Frequency,
  type Priority,
  type Todo,
  type TodoInput,
} from '@app/modules/todo/types';

import { Icon } from '../../components/Icon';
import { ChipPicker, ErrorBanner, Modal, TextArea, TextField } from '../../components/ui';
import { EMPTY_RULE, RepeatFields, type RuleDraft } from './RepeatFields';

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function TaskDialog({
  todo,
  frequency,
  dueDate: initialDue = null,
  onClose,
  onSaved,
}: {
  todo: Todo | null;
  frequency: Frequency;
  /** Pre-filled when adding from a calendar day. */
  dueDate?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = todayISO();
  const [title, setTitle] = useState(todo?.title ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const [dueDate, setDueDate] = useState(todo?.due_date ?? initialDue ?? '');
  const [dueTime, setDueTime] = useState(todo?.due_time?.slice(0, 5) ?? '');
  const [reminder, setReminder] = useState<number | null>(todo?.reminder_offset_min ?? null);
  const [priority, setPriority] = useState<Priority>(todo?.priority ?? 'normal');
  const [freq, setFreq] = useState<Frequency>(todo?.frequency ?? frequency);
  const [isRepeat, setIsRepeat] = useState(todo?.is_repeat ?? false);
  const [rule, setRule] = useState<RuleDraft>(
    todo
      ? {
          every: todo.repeat_every ?? 1,
          weekdays: todo.repeat_weekdays ?? null,
          anchorDay: todo.repeat_anchor_day ?? null,
          nth: todo.repeat_nth ?? null,
          from: todo.repeat_from ?? 'due',
        }
      : EMPTY_RULE,
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(todo?.checklist ?? []);
  const [step, setStep] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return setTitleError('Give the task a title');

    setTitleError(null);
    setSaving(true);
    setError(null);

    // '' from a cleared date or time input means "none", which has to reach
    // the database as null.
    const date = dueDate || null;
    const time = date && dueTime ? `${dueTime}:00` : null;
    const input: TodoInput = {
      title: trimmed,
      notes: notes.trim(),
      due_date: date,
      due_time: time,
      reminder_offset_min: time ? reminder : null,
      priority,
      frequency: freq,
      is_repeat: isRepeat,
      repeat_every: rule.every,
      repeat_weekdays: rule.weekdays,
      repeat_anchor_day: rule.anchorDay,
      repeat_nth: rule.nth,
      repeat_from: rule.from,
      checklist: checklist.filter((item) => item.text.trim()),
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

  const addStep = () => {
    const text = step.trim();
    if (!text) return;
    setChecklist((items) => [...items, { id: newId(), text, done: false }]);
    setStep('');
  };

  return (
    <Modal
      open
      title={todo ? 'Edit task' : 'New task'}
      onClose={onClose}
      width={600}
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

      <TextArea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything worth remembering"
        rows={3}
      />

      <ChipPicker
        label="Frequency"
        value={freq}
        onChange={(next) => {
          setFreq(next);
          // The old unit's weekdays or day no longer apply.
          setRule((current) => ({ ...current, weekdays: null, anchorDay: null, nth: null }));
        }}
        options={FREQUENCIES.map((f) => ({ value: f, label: FREQUENCY_LABEL[f] }))}
      />

      <ChipPicker
        label="Priority"
        value={priority}
        onChange={setPriority}
        options={PRIORITIES.slice()
          .reverse()
          .map((p) => ({ value: p, label: PRIORITY_LABEL[p], color: `var(--priority-${p})` }))}
      />

      <div className="field">
        <span className="label">Due</span>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="Due date"
            style={{ width: 'auto' }}
          />
          <button className="btn btn-secondary btn-sm" onClick={() => setDueDate(today)}>
            Today
          </button>
          {dueDate ? (
            <>
              <input
                className="input"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                aria-label="Time"
                style={{ width: 'auto' }}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDueDate('');
                  setDueTime('');
                }}
              >
                Clear
              </button>
            </>
          ) : null}
        </div>
      </div>

      {dueDate && dueTime ? (
        <div className="field">
          <span className="label">Reminder</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={reminder === null ? '' : String(reminder)}
            onChange={(e) => setReminder(e.target.value === '' ? null : Number(e.target.value))}
            aria-label="Reminder"
          >
            <option value="">None</option>
            {REMINDER_OFFSETS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {offsetLabel(minutes)}
              </option>
            ))}
          </select>
          <span className="faint" style={{ fontSize: 12 }}>
            Rings on the phone. A browser cannot keep a reminder once the tab is closed.
          </span>
        </div>
      ) : null}

      <label className="row" style={{ gap: 'var(--space-md)', cursor: 'pointer' }}>
        <button
          type="button"
          className={`check${isRepeat ? ' on' : ''}`}
          onClick={() => setIsRepeat(!isRepeat)}
          aria-pressed={isRepeat}
          aria-label="Repeat"
        >
          {isRepeat ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
        </button>
        <span>
          <div style={{ fontWeight: 500 }}>Repeat</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {isRepeat ? 'Completing it brings the next one round' : 'Completing it just marks it done'}
          </div>
        </span>
      </label>

      {isRepeat ? (
        <RepeatFields
          frequency={freq}
          draft={rule}
          dueDate={dueDate || null}
          today={today}
          onChange={setRule}
        />
      ) : null}

      <div className="field">
        <span className="label">
          Checklist
          {checklist.length > 0
            ? ` · ${checklist.filter((i) => i.done).length}/${checklist.length}`
            : ''}
        </span>
        <div className="checklist">
          {checklist.map((item) => (
            <div key={item.id} className="checklist-row">
              <button
                type="button"
                className={`check${item.done ? ' on' : ''}`}
                aria-pressed={item.done}
                aria-label={item.done ? `Untick ${item.text}` : `Tick ${item.text}`}
                onClick={() =>
                  setChecklist((items) =>
                    items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)),
                  )
                }
              >
                {item.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
              </button>
              <input
                className={`input checklist-input${item.done ? ' strike' : ''}`}
                value={item.text}
                aria-label="Step"
                onChange={(e) =>
                  setChecklist((items) =>
                    items.map((i) => (i.id === item.id ? { ...i, text: e.target.value } : i)),
                  )
                }
              />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${item.text}`}
                onClick={() => setChecklist((items) => items.filter((i) => i.id !== item.id))}
              >
                <Icon name="close" size={13} />
              </button>
            </div>
          ))}
          <div className="checklist-row">
            <Icon name="plus" size={14} style={{ color: 'var(--primary)', margin: '0 1px' }} />
            <input
              className="input checklist-input"
              value={step}
              placeholder="Add a step, then Enter"
              aria-label="Add a step"
              onChange={(e) => setStep(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Adds the step rather than submitting anything around it.
                  e.preventDefault();
                  addStep();
                }
              }}
            />
          </div>
        </div>
        {isRepeat && checklist.length > 0 ? (
          <span className="faint" style={{ fontSize: 12 }}>
            Each new occurrence starts with every step unticked.
          </span>
        ) : null}
      </div>

      <ErrorBanner message={error} />
    </Modal>
  );
}
