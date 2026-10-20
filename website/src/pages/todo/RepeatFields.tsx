/**
 * RepeatFields - the website's repeat editor: every N, the weekdays of a
 * weekly repeat, the day or nth weekday of a monthly one, and whether the next
 * date follows the schedule or the day it was done. Then the rule in a
 * sentence and the next three dates, so it can be checked before saving.
 *
 * The same rule shape and the same words as the phone's RepeatEditor, from
 * the app's recurrence.ts.
 */
import {
  describeRule,
  firstDueDate,
  ordinal,
  toRule,
  upcomingDates,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  weekdayOf,
  weekdayOrder,
  type RepeatFrom,
} from '@app/modules/todo/recurrence';
import { dueLabel } from '@app/modules/todo/today';
import type { Frequency } from '@app/modules/todo/types';

import { Icon } from '../../components/Icon';
import { Segmented } from '../../components/ui';

export type RuleDraft = {
  every: number;
  weekdays: number[] | null;
  anchorDay: number | null;
  nth: number | null;
  from: RepeatFrom;
};

export const EMPTY_RULE: RuleDraft = { every: 1, weekdays: null, anchorDay: null, nth: null, from: 'due' };

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const UNIT: Record<Frequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

export function RepeatFields({
  frequency,
  draft,
  dueDate,
  today,
  onChange,
}: {
  frequency: Frequency;
  draft: RuleDraft;
  dueDate: string | null;
  today: string;
  onChange: (draft: RuleDraft) => void;
}) {
  const set = (patch: Partial<RuleDraft>) => onChange({ ...draft, ...patch });
  const base = dueDate ?? today;
  const weekdays = draft.weekdays ?? [weekdayOf(base)];
  const anchor = draft.anchorDay ?? Number(base.slice(8, 10));
  const byWeekday = draft.nth !== null;
  const rule = toRule({ frequency, ...draft });
  const start = dueDate ?? firstDueDate(rule, today);
  const [one, many] = UNIT[frequency];

  const toggleDay = (day: number) => {
    const next = weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day];
    if (next.length > 0) set({ weekdays: weekdayOrder(next) });
  };

  return (
    <div className="repeat-fields">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <label className="row" style={{ gap: 'var(--space-sm)' }}>
          <span className="label">Every</span>
          <input
            className="input numeric"
            type="number"
            min={1}
            max={99}
            value={draft.every}
            onChange={(e) => set({ every: Math.max(1, Math.min(99, Number(e.target.value) || 1)) })}
            style={{ width: 68 }}
            aria-label={`Every how many ${many}`}
          />
          <span className="secondary">{draft.every === 1 ? one : many}</span>
        </label>

        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          <span className="label">Counted from</span>
          <Segmented
            value={draft.from}
            onChange={(from) => set({ from })}
            options={[
              { value: 'due', label: 'Due date' },
              { value: 'completion', label: 'When done' },
            ]}
          />
        </div>
      </div>

      {draft.from === 'due' && frequency === 'weekly' ? (
        <div className="field">
          <span className="label">On</span>
          <div className="chip-row">
            {WEEK.map((day) => (
              <button
                key={day}
                type="button"
                className="chip"
                aria-pressed={weekdays.includes(day)}
                aria-label={WEEKDAY_LONG[day]}
                onClick={() => toggleDay(day)}
              >
                {weekdays.includes(day) ? <Icon name="check" size={11} strokeWidth={2.4} /> : null}
                {WEEKDAY_SHORT[day]}
              </button>
            ))}
            <button type="button" className="chip" onClick={() => set({ weekdays: [1, 2, 3, 4, 5] })}>
              Weekdays
            </button>
          </div>
        </div>
      ) : null}

      {draft.from === 'due' && frequency === 'monthly' ? (
        <div className="field">
          <span className="label">On</span>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Segmented
              value={byWeekday ? 'weekday' : 'day'}
              onChange={(mode) =>
                mode === 'day'
                  ? set({ nth: null, weekdays: null, anchorDay: anchor })
                  : set({
                      nth: Math.min(4, Math.ceil(Number(base.slice(8, 10)) / 7)),
                      weekdays: [weekdayOf(base)],
                      anchorDay: null,
                    })
              }
              options={[
                { value: 'day', label: 'A day of the month' },
                { value: 'weekday', label: 'A weekday' },
              ]}
            />
            {byWeekday ? (
              <>
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={draft.nth ?? 1}
                  onChange={(e) => set({ nth: Number(e.target.value) })}
                  aria-label="Which one in the month"
                >
                  {[1, 2, 3, 4, -1].map((n) => (
                    <option key={n} value={n}>
                      {n < 0 ? 'The last' : `The ${ordinal(n)}`}
                    </option>
                  ))}
                </select>
                <select
                  className="input"
                  style={{ width: 'auto' }}
                  value={draft.weekdays?.[0] ?? weekdayOf(base)}
                  onChange={(e) => set({ weekdays: [Number(e.target.value)] })}
                  aria-label="Weekday"
                >
                  {WEEK.map((day) => (
                    <option key={day} value={day}>
                      {WEEKDAY_LONG[day]}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <select
                className="input"
                style={{ width: 'auto' }}
                value={anchor}
                onChange={(e) => set({ anchorDay: Number(e.target.value) })}
                aria-label="Day of the month"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day === 31 ? 'The last day' : `The ${ordinal(day)}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      ) : null}

      <div className="repeat-summary" aria-live="polite">
        <div className="row" style={{ gap: 6 }}>
          <Icon name="repeat" size={14} />
          <strong>{describeRule(rule, start)}</strong>
        </div>
        <div className="faint numeric" style={{ fontSize: 12 }}>
          Next: {upcomingDates(start, rule, 3).map((date) => dueLabel(date, null, today)).join(' · ')}
        </div>
      </div>
    </div>
  );
}
