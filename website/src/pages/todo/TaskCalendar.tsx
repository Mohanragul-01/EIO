/**
 * TaskCalendar - the month at a glance: what is due each day, what was done,
 * and where repeats will land.
 *
 * Open tasks sit on their due date; closed ones on theirs, ticked; and each
 * open repeat is projected forward through the month (shown faint, with the
 * repeat icon), so a heavy week can be seen coming and yearly and monthly
 * duties spread out. A projection assumes each occurrence is done on time,
 * which is the only honest guess.
 *
 * Click a day to see it in full beside the calendar, and to add a task on it.
 */
import { useCallback, useMemo, useState } from 'react';

import { monthBounds } from '@app/core/date';
import * as api from '@app/modules/todo/api';
import { projectedDates, ruleOf, WEEKDAY_SHORT, weekdayOf } from '@app/modules/todo/recurrence';
import { compareForDay, formatTime } from '@app/modules/todo/today';
import { PRIORITY_LABEL, type Todo } from '@app/modules/todo/types';

import { Icon } from '../../components/Icon';
import { MonthCalendar, type CalendarDay } from '../../components/MonthCalendar';
import { ErrorBanner } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { QuickAddBar } from './QuickAddBar';

type Entry = { todo: Todo; kind: 'open' | 'closed' | 'projected' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How many lines a day cell shows before "+N more". */
const SHOWN = 3;

export function TaskCalendar({
  open,
  today,
  version,
  onOpen,
  onToggle,
  onAdded,
}: {
  /** Every open task, across frequencies. */
  open: Todo[];
  today: string;
  /** Changes after a write, to reload the month's closed tasks. */
  version: number;
  onOpen: (todo: Todo) => void;
  onToggle: (todo: Todo) => void;
  onAdded: () => void;
}) {
  const [view, setView] = useState(() => ({
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  }));
  const [selected, setSelected] = useState<string>(today);
  const { start, end } = monthBounds(view.year, view.month);

  const loadClosed = useCallback(() => api.listClosedBetween(start, end), [start, end]);
  const closed = useAsync(loadClosed, `closed-${start}-${version}`);

  const byDay = useMemo(() => {
    const days = new Map<string, Entry[]>();
    const put = (day: string, entry: Entry) => {
      if (day < start || day > end) return;
      const list = days.get(day);
      if (list) list.push(entry);
      else days.set(day, [entry]);
    };
    for (const todo of open) {
      if (!todo.due_date) continue;
      put(todo.due_date, { todo, kind: 'open' });
      if (todo.is_repeat) {
        // From after today for an overdue repeat (it rolls past today when
        // done), to the end of the month however far ahead it is.
        for (const date of projectedDates(todo.due_date, ruleOf(todo), today, end)) {
          put(date, { todo, kind: 'projected' });
        }
      }
    }
    for (const todo of closed.data ?? []) {
      if (todo.due_date) put(todo.due_date, { todo, kind: 'closed' });
    }
    for (const list of days.values()) {
      list.sort((a, b) => {
        const rank = { open: 0, projected: 1, closed: 2 } as const;
        return rank[a.kind] - rank[b.kind] || compareForDay(a.todo, b.todo);
      });
    }
    return days;
  }, [open, closed.data, start, end, today]);

  const renderDay = (day: CalendarDay) => {
    const entries = byDay.get(day.iso) ?? [];
    return (
      <div
        className={`task-cal-day${day.isToday ? ' today' : ''}${day.isSelected ? ' selected' : ''}`}
      >
        <span className="task-cal-number">{Number(day.iso.slice(8))}</span>
        {entries.slice(0, SHOWN).map((entry, i) => (
          <span key={`${entry.todo.id}-${entry.kind}-${i}`} className={`task-cal-entry ${entry.kind}`}>
            {entry.kind === 'closed' ? (
              <Icon name="check" size={10} />
            ) : entry.kind === 'projected' ? (
              <Icon name="repeat" size={10} />
            ) : (
              <span className="dot" style={{ background: `var(--priority-${entry.todo.priority})` }} />
            )}
            <span className="task-cal-title">{entry.todo.title}</span>
          </span>
        ))}
        {entries.length > SHOWN ? (
          <span className="task-cal-more">+{entries.length - SHOWN} more</span>
        ) : null}
      </div>
    );
  };

  const dayLabel = (day: CalendarDay) => {
    const entries = byDay.get(day.iso) ?? [];
    if (entries.length === 0) return null;
    const due = entries.filter((e) => e.kind === 'open').length;
    const done = entries.filter((e) => e.kind === 'closed').length;
    const repeats = entries.filter((e) => e.kind === 'projected').length;
    return [
      due ? `${due} due` : null,
      done ? `${done} done` : null,
      repeats ? `${repeats} repeating` : null,
    ]
      .filter(Boolean)
      .join(', ');
  };

  const selectedEntries = byDay.get(selected) ?? [];
  const [, sm, sd] = selected.split('-').map(Number);
  const selectedTitle = `${WEEKDAY_SHORT[weekdayOf(selected)]} ${sd} ${MONTHS[sm - 1]}`;

  return (
    <div className="split">
      <div className="card card-pad">
        <ErrorBanner message={closed.error} />
        <MonthCalendar
          year={view.year}
          month={view.month}
          onChangeMonth={(year, month) => setView({ year, month })}
          selected={selected}
          onSelect={setSelected}
          renderDay={renderDay}
          dayLabel={dayLabel}
        />
      </div>

      <aside className="card card-pad task-cal-panel" aria-label={`Tasks on ${selectedTitle}`}>
        <div className="row-between">
          <h3 className="cal-title">{selected === today ? `Today · ${selectedTitle}` : selectedTitle}</h3>
        </div>

        {selectedEntries.length === 0 ? (
          <p className="faint" style={{ fontSize: 13 }}>
            Nothing on this day.
          </p>
        ) : (
          <ul className="task-cal-list">
            {selectedEntries.map((entry, i) => (
              <li key={`${entry.todo.id}-${entry.kind}-${i}`} className="task-cal-row">
                {entry.kind === 'projected' ? (
                  <span className="task-cal-glyph faint" title="A future occurrence of a repeat">
                    <Icon name="repeat" size={13} />
                  </span>
                ) : (
                  <button
                    type="button"
                    className={`check${entry.kind === 'closed' ? ' on' : ''}`}
                    onClick={() => onToggle(entry.todo)}
                    aria-label={
                      entry.kind === 'closed' ? `Reopen ${entry.todo.title}` : `Complete ${entry.todo.title}`
                    }
                  >
                    {entry.kind === 'closed' ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                  </button>
                )}
                <button
                  type="button"
                  className="task-cal-open"
                  onClick={() => onOpen(entry.todo)}
                  aria-label={`Edit ${entry.todo.title}`}
                >
                  <span className={entry.kind === 'closed' ? 'strike' : entry.kind === 'projected' ? 'faint' : ''}>
                    {entry.todo.title}
                  </span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    {[
                      entry.todo.due_time ? formatTime(entry.todo.due_time) : null,
                      entry.kind === 'projected' ? 'Repeats here' : null,
                      entry.kind === 'closed' ? 'Done' : `${PRIORITY_LABEL[entry.todo.priority]} priority`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <QuickAddBar
          defaultFrequency="daily"
          defaultDueDate={selected}
          placeholder={`Add on ${selectedTitle}`}
          onAdded={onAdded}
        />
      </aside>
    </div>
  );
}
