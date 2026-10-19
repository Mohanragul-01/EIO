/**
 * PlanFields - when, the steps, and the money, for a Now or Next item.
 *
 * The desktop twin of the phone's PlanFields, over the same rules (plan.ts,
 * shelf.ts): a target with honest precision, a passed one offered somewhere
 * to go rather than called overdue, steps that save as you go with Undo right
 * here, and the money sentence worked out in whichever direction you have the
 * numbers for. The what-if amount is not saved; a target is the plan you keep.
 */
import { useState } from 'react';

import { parseAmountToMinor } from '@app/core/money';
import {
  choiceOf,
  describeSavings,
  formatTarget,
  isTargetPassed,
  moveOptions,
  savingsAdvice,
  targetFor,
  type TargetChoice,
} from '@app/modules/bucket/plan';
import type { BucketStep } from '@app/modules/bucket/types';
import { addDaysTo, isoOf, partsOf } from '@app/modules/bucket/when';

import { Icon } from '../../components/Icon';
import { TextField } from '../../components/ui';
import { PeriodPicker } from './PeriodPicker';
import { isPendingStep } from './useBucketData';

export type PlanDraft = { target: TargetChoice; est: string; saved: string };

type WhenKey = 'someday' | 'this-year' | 'next-year' | 'month' | 'day';

const WHEN_OPTIONS: { key: WhenKey; label: string }[] = [
  { key: 'someday', label: 'Someday' },
  { key: 'this-year', label: 'This year' },
  { key: 'next-year', label: 'Next year' },
  { key: 'month', label: 'A month' },
  { key: 'day', label: 'A day' },
];

export function PlanFields({
  draft,
  onChange,
  today,
  steps,
  onAddStep,
  onToggleStep,
  onRemoveStep,
  onRestoreStep,
  onMoveStep,
  estError,
  savedError,
}: {
  draft: PlanDraft;
  onChange: (draft: PlanDraft) => void;
  today: string;
  steps: BucketStep[];
  onAddStep: (title: string) => void;
  onToggleStep: (step: BucketStep) => void;
  onRemoveStep: (step: BucketStep) => void;
  onRestoreStep: (step: BucketStep) => void;
  onMoveStep: (step: BucketStep, direction: -1 | 1) => void;
  estError?: string | null;
  savedError?: string | null;
}) {
  const now = partsOf(today);
  const [newStep, setNewStep] = useState('');
  const [removed, setRemoved] = useState<BucketStep | null>(null);
  const [monthly, setMonthly] = useState('');

  const set = (patch: Partial<PlanDraft>) => onChange({ ...draft, ...patch });
  const { target } = draft;
  const stored = targetFor(target);
  const passed = isTargetPassed(stored.target_on, stored.target_precision, today);

  const whenKey: WhenKey | null =
    target.kind === 'someday'
      ? 'someday'
      : target.kind === 'year'
        ? target.year === now.year
          ? 'this-year'
          : target.year === now.year + 1
            ? 'next-year'
            : null
        : target.kind;

  const chooseWhen = (key: WhenKey) => {
    const next = partsOf(addDaysTo(isoOf(now.year, now.month, 1), 31));
    const choices: Record<WhenKey, TargetChoice> = {
      someday: { kind: 'someday' },
      'this-year': { kind: 'year', year: now.year },
      'next-year': { kind: 'year', year: now.year + 1 },
      month: target.kind === 'month' ? target : { kind: 'month', year: next.year, month: next.month },
      day: target.kind === 'day' ? target : { kind: 'day', iso: addDaysTo(today, 30) },
    };
    set({ target: choices[key] });
  };

  const estMinor = parseAmountToMinor(draft.est);
  const savedMinor = parseAmountToMinor(draft.saved) ?? 0;
  const advice = savingsAdvice({
    estMinor,
    savedMinor,
    targetOn: stored.target_on,
    targetPrecision: stored.target_precision,
    monthlyMinor: parseAmountToMinor(monthly),
    today,
  });
  const sentence = describeSavings(advice);
  const showWhatIf = target.kind === 'someday' && (advice.kind === 'to-go' || advice.kind === 'by-monthly');
  const moneyPercent =
    estMinor && estMinor > 0
      ? savedMinor >= estMinor
        ? 100
        : Math.min(99, Math.round((savedMinor / estMinor) * 100))
      : null;

  // Nothing moves while a step is still on its way: it has no id to renumber.
  const anyPending = steps.some(isPendingStep);

  const submitStep = () => {
    const title = newStep.trim();
    if (!title) return;
    onAddStep(title);
    setNewStep('');
    setRemoved(null);
  };

  return (
    <>
      <div className="field">
        <span className="label">When</span>
        <div className="chip-row" role="radiogroup" aria-label="When">
          {WHEN_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={whenKey === option.key}
              className={`chip${whenKey === option.key ? ' selected' : ''}`}
              onClick={() => chooseWhen(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {target.kind === 'month' ? (
        <PeriodPicker
          label="Year"
          year={target.year}
          month={target.month}
          minYear={now.year}
          maxYear={now.year + 30}
          isMonthDisabled={(y, m) => y * 12 + m < now.year * 12 + now.month}
          onChange={(year, month) => set({ target: { kind: 'month', year, month: month ?? 1 } })}
        />
      ) : null}

      {target.kind === 'day' ? (
        <label className="field">
          <span className="label">The day</span>
          <input
            type="date"
            className="input bl-date"
            min={today}
            value={target.iso}
            onChange={(e) => {
              if (e.target.value && e.target.value >= today) {
                set({ target: { kind: 'day', iso: e.target.value } });
              }
            }}
          />
        </label>
      ) : null}

      {passed && stored.target_on && stored.target_precision ? (
        // Neutral on purpose: no red, no "overdue". A date that slipped is a
        // fact with a way forward.
        <div className="bl-passed">
          <div className="row" style={{ gap: 6 }}>
            <Icon name="clock" size={14} />
            <span>
              Target passed · {formatTarget(stored.target_on, stored.target_precision, today)}. Move
              to…
            </span>
          </div>
          <div className="chip-row">
            {moveOptions(today).map((option) => (
              <button
                key={option.label}
                type="button"
                className="chip"
                onClick={() =>
                  set({ target: choiceOf(option.target.target_on, option.target.target_precision) })
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="faint bl-small">
          {stored.target_on && stored.target_precision
            ? `Aiming for ${formatTarget(stored.target_on, stored.target_precision, today)}`
            : 'No date yet - that is allowed.'}
        </p>
      )}

      <div className="field">
        <div className="row-between">
          <span className="label">Steps</span>
          {steps.length > 0 ? (
            <span className="faint numeric bl-small">
              {steps.filter((s) => s.is_done).length} of {steps.length}
            </span>
          ) : null}
        </div>

        <div className="col" style={{ gap: 2 }}>
          {steps.map((step, index) => {
            const pending = isPendingStep(step);
            return (
              <div key={step.id} className="list-row bl-step">
                <button
                  type="button"
                  className={`check${step.is_done ? ' on' : ''}`}
                  onClick={() => {
                    setRemoved(null);
                    onToggleStep(step);
                  }}
                  disabled={pending}
                  role="checkbox"
                  aria-checked={step.is_done}
                  aria-label={step.title}
                >
                  {step.is_done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                </button>
                {/* Muted rather than struck through: a ticked step is done, not wrong. */}
                <span className={`grow${step.is_done ? ' muted' : ''}`}>{step.title}</span>
                <div className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={anyPending || index === 0}
                    onClick={() => onMoveStep(step, -1)}
                    aria-label={`Move ${step.title} up`}
                  >
                    <Icon name="chevronUp" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={anyPending || index === steps.length - 1}
                    onClick={() => onMoveStep(step, 1)}
                    aria-label={`Move ${step.title} down`}
                  >
                    <Icon name="chevronDown" size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    disabled={pending}
                    onClick={() => {
                      setRemoved(step);
                      onRemoveStep(step);
                    }}
                    aria-label={`Remove ${step.title}`}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {removed ? (
          <div className="row-between bl-small" role="status">
            <span className="muted truncate">Removed “{removed.title}”</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                onRestoreStep(removed);
                setRemoved(null);
              }}
            >
              Undo
            </button>
          </div>
        ) : null}

        <div className="row" style={{ gap: 6 }}>
          <input
            className="input grow"
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submitStep();
              }
            }}
            placeholder="Add a step"
            aria-label="New step"
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={submitStep}
            disabled={!newStep.trim()}
          >
            <Icon name="plus" size={14} /> Add
          </button>
        </div>
        <span className="faint bl-small">Steps save as you go.</span>
      </div>

      <div className="bl-money">
        <TextField
          label="Estimate, ₹"
          value={draft.est}
          onChange={(e) => set({ est: e.target.value })}
          inputMode="decimal"
          placeholder="38000"
          error={estError}
        />
        <TextField
          label="Saved so far, ₹"
          value={draft.saved}
          onChange={(e) => set({ saved: e.target.value })}
          inputMode="decimal"
          placeholder="0"
          error={savedError}
        />
      </div>

      {moneyPercent !== null ? (
        <div className="row" style={{ gap: 8 }}>
          <div className="meter grow">
            <i style={{ width: `${moneyPercent}%` }} />
          </div>
          <span className="faint numeric bl-small">{moneyPercent}%</span>
        </div>
      ) : null}

      {sentence ? (
        <p className="bl-money-line" aria-live="polite">
          {sentence}
        </p>
      ) : null}

      {showWhatIf ? (
        <TextField
          label="What if I put aside, ₹ a month"
          value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          inputMode="decimal"
          placeholder="3200"
        />
      ) : null}
    </>
  );
}
