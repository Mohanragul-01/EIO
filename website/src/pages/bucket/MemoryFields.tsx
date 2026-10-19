/**
 * MemoryFields - when it happened, what happened, where, and would you again.
 *
 * All optional; Save works with every field empty. "When" reaches back by
 * year and month and stops at whatever you remember - just the year, a month,
 * or the exact day - because most of this list was done long before it was
 * ticked. The same rules as the phone (when.ts), shared rather than redone.
 */
import { AGAINS, AGAIN_LABEL, type Again } from '@app/modules/bucket/types';
import {
  addDaysTo,
  daysInMonth,
  describeWhen,
  isFutureWhen,
  isoOf,
  partsOf,
  type WhenChoice,
} from '@app/modules/bucket/when';

import { Segmented, TextArea, TextField } from '../../components/ui';
import { PeriodPicker } from './PeriodPicker';

export type MemoryDraft = {
  when: WhenChoice;
  memory: string;
  place: string;
  again: Again | null;
};

const YEARS_BACK = 90;

export function MemoryFields({
  draft,
  onChange,
  today,
}: {
  draft: MemoryDraft;
  onChange: (draft: MemoryDraft) => void;
  today: string;
}) {
  const now = partsOf(today);
  const { when } = draft;
  const set = (patch: Partial<MemoryDraft>) => onChange({ ...draft, ...patch });

  const startEarlier = (): WhenChoice => {
    if (when.kind === 'earlier') return when;
    const lastMonth = partsOf(addDaysTo(isoOf(now.year, now.month, 1), -1));
    return { kind: 'earlier', year: lastMonth.year, month: lastMonth.month, day: null };
  };

  const dayBounds =
    when.kind === 'earlier' && when.month !== null
      ? {
          min: isoOf(when.year, when.month, 1),
          max: (() => {
            const last = isoOf(when.year, when.month, daysInMonth(when.year, when.month));
            return last > today ? today : last;
          })(),
        }
      : null;

  return (
    <>
      <div className="field">
        <span className="label">When</span>
        <Segmented
          value={when.kind}
          onChange={(kind) =>
            set({
              when:
                kind === 'today'
                  ? { kind: 'today' }
                  : kind === 'yesterday'
                    ? { kind: 'yesterday' }
                    : startEarlier(),
            })
          }
          options={[
            { value: 'today', label: 'Today' },
            { value: 'yesterday', label: 'Yesterday' },
            { value: 'earlier', label: 'Earlier…' },
          ]}
        />
      </div>

      {when.kind === 'earlier' ? (
        <>
          <PeriodPicker
            label="Year"
            year={when.year}
            month={when.month}
            allowYearOnly
            newestFirst
            minYear={now.year - YEARS_BACK}
            maxYear={now.year}
            isMonthDisabled={(y, m) => isFutureWhen({ kind: 'earlier', year: y, month: m, day: null }, today)}
            // A new month drops the day: the 14th of March is not the 14th of May.
            onChange={(year, month) => set({ when: { kind: 'earlier', year, month, day: null } })}
          />

          {dayBounds && when.month !== null ? (
            <label className="field">
              <span className="label">The day, if you know it</span>
              <input
                type="date"
                className="input bl-date"
                min={dayBounds.min}
                max={dayBounds.max}
                value={when.day ? isoOf(when.year, when.month, when.day) : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    set({ when: { ...when, day: null } });
                    return;
                  }
                  const { year, month, day } = partsOf(value);
                  const choice: WhenChoice = { kind: 'earlier', year, month, day };
                  if (!isFutureWhen(choice, today)) set({ when: choice });
                }}
              />
            </label>
          ) : null}
        </>
      ) : null}

      <p className="secondary bl-when" aria-live="polite">
        {describeWhen(when, today)}
      </p>

      <TextArea
        label="What happened?"
        value={draft.memory}
        onChange={(e) => set({ memory: e.target.value })}
        placeholder="Optional - a line is plenty"
        rows={3}
      />

      <TextField
        label="Where"
        value={draft.place}
        onChange={(e) => set({ place: e.target.value })}
        placeholder="Optional"
      />

      <div className="field">
        <span className="label">Do it again?</span>
        <div className="chip-row" role="radiogroup" aria-label="Do it again?">
          {AGAINS.map((again) => (
            <button
              key={again}
              type="button"
              role="radio"
              aria-checked={draft.again === again}
              className={`chip${draft.again === again ? ' selected' : ''}`}
              // Clicking the chosen answer clears it: "not decided" is a real
              // answer with no other way back to it.
              onClick={() => set({ again: draft.again === again ? null : again })}
            >
              {AGAIN_LABEL[again]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
