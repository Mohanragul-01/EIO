/**
 * QuickAddBar - add a task by typing one line, with the same parser as the
 * phone (app/src/modules/todo/quickAdd.ts), so "19/10" is 19 October on both.
 *
 * The words it recognised sit under the field as chips saying what they were
 * read as; click one and those words stay in the title instead. Enter adds and
 * keeps focus for the next one.
 */
import { useRef, useState, type FormEvent } from 'react';

import { todayISO } from '@app/core/date';
import * as api from '@app/modules/todo/api';
import {
  parseQuickAdd,
  toTodoInput,
  type QuickAddResult,
  type QuickToken,
} from '@app/modules/todo/quickAdd';
import { describeRule } from '@app/modules/todo/recurrence';
import { dueLabel } from '@app/modules/todo/today';
import { FREQUENCY_LABEL, PRIORITY_LABEL, type Frequency, type Todo } from '@app/modules/todo/types';

import { Icon, type IconName } from '../../components/Icon';

const TOKEN_ICON: Record<QuickToken['kind'], IconName> = {
  date: 'calendar',
  time: 'timer',
  repeat: 'repeat',
  priority: 'flag',
};

export function QuickAddBar({
  defaultFrequency,
  defaultDueDate,
  placeholder = 'Add a task - "Pay rent every 1st !high", "Call mum fri 7pm"',
  onAdded,
}: {
  defaultFrequency: Frequency;
  defaultDueDate: string | null;
  placeholder?: string;
  onAdded: (todo: Todo) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [ignore, setIgnore] = useState<string[]>([]);
  const [parsed, setParsed] = useState<QuickAddResult | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Read in handlers: "now" decides what "at 7" means.
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = text.trim() ? parse(text, ignore) : null;
    if (!result) return;
    if (!result.title) {
      setError('That is all date and time - what needs doing?');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const todo = await api.createTodo(toTodoInput(result));
      setAdded(
        todo.due_date ? `${todo.title} · ${dueLabel(todo.due_date, todo.due_time, todayISO())}` : todo.title,
      );
      setText('');
      setIgnore([]);
      setParsed(null);
      onAdded(todo);
      input.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add that');
    } finally {
      setSaving(false);
    }
  };

  const keepAsText = (token: QuickToken) => {
    const next = [...ignore, token.text.toLowerCase()];
    setIgnore(next);
    setParsed(parse(text, next));
    input.current?.focus();
  };

  const today = todayISO();
  const preview = parsed && parsed.title ? parsed : null;

  return (
    <div className="quick-add">
      <form className="quick-add-form" onSubmit={(e) => void submit(e)}>
        <Icon name="plus" size={15} className="quick-add-icon" />
        <input
          ref={input}
          className="input quick-add-input"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            setAdded(null);
            setParsed(e.target.value.trim() ? parse(e.target.value, ignore) : null);
          }}
          placeholder={placeholder}
          aria-label="Quick add a task"
          maxLength={200}
        />
        <button className="btn btn-sm" type="submit" disabled={!text.trim() || saving}>
          {saving ? <span className="spinner" /> : 'Add'}
        </button>
      </form>

      {parsed && parsed.tokens.length > 0 ? (
        <div className="chip-row quick-add-tokens">
          {parsed.tokens.map((token) => (
            <button
              key={`${token.start}-${token.text}`}
              type="button"
              className="chip selected"
              onClick={() => keepAsText(token)}
              title="Click to keep these words in the title"
              aria-label={`${token.label}, from "${token.text}". Click to keep as text.`}
            >
              <Icon name={TOKEN_ICON[token.kind]} size={12} />
              {token.label}
              <span className="faint">“{token.text}”</span>
              <Icon name="close" size={11} />
            </button>
          ))}
        </div>
      ) : null}

      {preview ? (
        <div className="quick-add-preview faint" aria-live="polite">
          <strong className="secondary">{preview.title}</strong>
          {' · '}
          {preview.repeat
            ? describeRule(preview.repeat, preview.dueDate)
            : FREQUENCY_LABEL[preview.frequency]}
          {' · '}
          {preview.dueDate ? dueLabel(preview.dueDate, preview.dueTime, today) : 'No date'}
          {' · '}
          {PRIORITY_LABEL[preview.priority ?? 'normal']} priority
        </div>
      ) : added ? (
        <div className="quick-add-preview" style={{ color: 'var(--success)' }} aria-live="polite">
          <Icon name="check" size={12} style={{ display: 'inline-block', verticalAlign: -1 }} /> Added {added}
        </div>
      ) : error ? (
        <div className="quick-add-preview error-text" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
