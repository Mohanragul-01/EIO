/**
 * RoutineEditor - build or change a routine.
 *
 * A SLOT is an exercise, or a LADDER: a ladder slot becomes the ladder's
 * current rung each time a session starts, so a calisthenics routine written
 * once never needs editing as you progress. Targets are ranges - the bottom is
 * what you aim for first, the top earns the next step (more weight by the
 * increment for a lift, the next rung for a ladder). Rest and a superset
 * letter are per slot too. The same fields, checks and defaults as the phone's
 * routine screen, laid out as one row per slot.
 */
import { useMemo, useState } from 'react';

import * as api from '@app/modules/fitness/api';
import { MODE_LABEL, visibleInMode } from '@app/modules/fitness/mode';
import {
  formatDuration,
  normaliseMuscle,
  type Exercise,
  type FitnessMode,
  type Routine,
  type RoutineExercise,
} from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { ErrorBanner, Modal, TextField } from '../../components/ui';
import { ExercisePicker } from './ExercisePicker';
import { supersetColor } from './format';

/** One slot being edited. Text fields hold exactly what was typed. */
type SlotDraft = {
  key: string;
  exercise_id: string | null;
  progression_id: string | null;
  sets: string;
  min: string;
  max: string;
  rest: string;
  increment: string;
  pair: string | null;
};

const PAIRS = ['A', 'B', 'C'];

let keySeq = 0;
const newKey = () => `slot${++keySeq}`;

/** '' -> null, otherwise a positive whole number or NaN. */
function wholeOrNull(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) && n > 0 ? n : NaN;
}

function draftFrom(row: RoutineExercise): SlotDraft {
  const timed = row.target_seconds_max !== null || row.target_seconds_min !== null;
  const text = (n: number | null) => (n === null ? '' : String(n));
  return {
    key: newKey(),
    exercise_id: row.exercise_id,
    progression_id: row.progression_id,
    sets: text(row.target_sets),
    min: timed ? text(row.target_seconds_min) : text(row.target_reps_min),
    max: timed ? text(row.target_seconds_max) : text(row.target_reps),
    rest: text(row.rest_seconds),
    increment: text(row.increment_kg),
    pair: row.pair_group,
  };
}

export function RoutineEditor({
  routine,
  mode,
  exercises,
  ladders,
  initialSlots,
  onClose,
  onSaved,
}: {
  routine: Routine | null;
  /** A new routine takes the current mode; an existing one keeps its own. */
  mode: FitnessMode;
  exercises: Exercise[];
  ladders: api.Ladder[];
  initialSlots: RoutineExercise[];
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState(routine?.name ?? '');
  const [slots, setSlots] = useState<SlotDraft[]>(() => initialSlots.map(draftFrom));
  const [picking, setPicking] = useState<'exercise' | 'ladder' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const ladderById = useMemo(() => new Map(ladders.map((l) => [l.progression.id, l])), [ladders]);

  /** A slot's measure: an exercise's own, or the ladder's current rung's. */
  const isTimed = (slot: SlotDraft): boolean => {
    if (slot.exercise_id) return byId.get(slot.exercise_id)?.tracking_type === 'time';
    const ladder = slot.progression_id ? ladderById.get(slot.progression_id) : undefined;
    const rung = ladder?.steps.find((s) => s.id === ladder.progression.current_step_id);
    return !!rung && rung.goal_seconds !== null;
  };

  const update = (key: string, patch: Partial<SlotDraft>) =>
    setSlots((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const move = (key: string, delta: -1 | 1) =>
    setSlots((list) => {
      const i = list.findIndex((s) => s.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const blank = (patch: Partial<SlotDraft>): SlotDraft => ({
    key: newKey(),
    exercise_id: null,
    progression_id: null,
    sets: '3',
    min: '',
    max: '',
    rest: '',
    increment: '',
    pair: null,
    ...patch,
  });

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the routine a name');
    if (slots.length === 0) return setError('A routine with nothing in it would lay out nothing');

    const parsed = slots.map((slot) => {
      const timed = isTimed(slot);
      const rest = slot.rest.trim() ? Number(slot.rest) : null;
      const increment = slot.increment.trim() ? Number(slot.increment.replace(',', '.')) : null;
      return {
        slot,
        timed,
        min: wholeOrNull(slot.min),
        max: wholeOrNull(slot.max),
        sets: wholeOrNull(slot.sets),
        rest,
        increment,
      };
    });
    const bad = parsed.find(
      (p) =>
        Number.isNaN(p.min) ||
        Number.isNaN(p.max) ||
        Number.isNaN(p.sets) ||
        (p.min !== null && p.max !== null && p.min > p.max) ||
        (p.rest !== null && !(Number.isInteger(p.rest) && p.rest >= 0 && p.rest <= 900)) ||
        (p.increment !== null && !(p.increment > 0 && p.increment < 100)),
    );
    if (bad) {
      return setError(
        `${slotName(bad.slot)}: use whole numbers with the low end first, rest up to 900 seconds and an increment under 100 kg.`,
      );
    }

    setSaving(true);
    setError(null);
    try {
      await api.saveRoutine(
        { id: routine?.id, name: trimmed, mode },
        parsed.map(({ slot, timed, min, max, sets, rest, increment }) => ({
          exercise_id: slot.exercise_id,
          progression_id: slot.progression_id,
          target_sets: sets,
          target_reps: timed ? null : max,
          target_reps_min: timed ? null : min,
          target_seconds_min: timed ? min : null,
          target_seconds_max: timed ? max : null,
          rest_seconds: rest,
          increment_kg: increment,
          pair_group: slot.pair,
        })),
      );
      onSaved(trimmed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that routine');
      setSaving(false);
    }
  };

  const slotName = (slot: SlotDraft) =>
    slot.progression_id
      ? (ladderById.get(slot.progression_id)?.progression.name ?? 'A removed ladder')
      : (byId.get(slot.exercise_id ?? '')?.name ?? 'A removed exercise');

  return (
    <Modal
      open
      title={routine ? `Edit ${routine.name}` : `New ${MODE_LABEL[mode].toLowerCase()} routine`}
      onClose={onClose}
      width={940}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : routine ? 'Save routine' : 'Create routine'}
          </button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={mode === 'calisthenics' ? 'Day A, Skills, Pull' : 'Push day, Legs, Full body'}
        maxLength={60}
        autoFocus={!routine}
        hint={`A ${MODE_LABEL[mode].toLowerCase()} routine. Ranges are optional: the low end is what to aim for, the top earns the next step.`}
      />

      {slots.length === 0 ? (
        <p className="muted fx-small">
          Add exercises (or ladders) below. Each gets sets, a range, rest and, if you like, a
          superset letter: slots sharing a letter alternate.
        </p>
      ) : (
        <div className="fx-slots" role="list" aria-label="Slots, in order">
          {slots.map((slot, index) => {
            const ladder = slot.progression_id ? ladderById.get(slot.progression_id) : undefined;
            const rung = ladder?.steps.find((s) => s.id === ladder.progression.current_step_id);
            const exercise = slot.exercise_id ? byId.get(slot.exercise_id) : undefined;
            const timed = isTimed(slot);
            const title = slotName(slot);
            const unit = timed ? 's' : 'reps';
            return (
              <div key={slot.key} className="fx-slot" role="listitem">
                <span className="fx-slot-index numeric" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="fx-slot-title">
                  <span className="fx-slot-name">{title}</span>
                  <span className="fx-row-sub">
                    {ladder
                      ? `Ladder · now ${rung ? (byId.get(rung.exercise_id)?.name ?? 'a rung') : 'not started'}`
                      : timed
                        ? 'Held'
                        : exercise?.load_mode === 'bodyweight'
                          ? 'Bodyweight'
                          : 'Weights'}
                  </span>
                </div>
                <SmallField
                  label="Sets"
                  owner={title}
                  value={slot.sets}
                  onChange={(t) => update(slot.key, { sets: t })}
                />
                {ladder ? (
                  <span className="fx-slot-note muted fx-small">
                    Targets follow the rung
                    {rung
                      ? `: ${rung.goal_seconds ?? rung.goal_reps}${rung.goal_seconds ? ' s' : ''} to master it`
                      : ''}
                  </span>
                ) : (
                  <>
                    <SmallField
                      label={`From (${unit})`}
                      owner={title}
                      value={slot.min}
                      onChange={(t) => update(slot.key, { min: t })}
                    />
                    <SmallField
                      label={`To (${unit})`}
                      owner={title}
                      value={slot.max}
                      onChange={(t) => update(slot.key, { max: t })}
                    />
                  </>
                )}
                <SmallField
                  label="Rest (s)"
                  owner={title}
                  value={slot.rest}
                  placeholder={
                    exercise?.default_rest_seconds ? String(exercise.default_rest_seconds) : '90'
                  }
                  onChange={(t) => update(slot.key, { rest: t })}
                  title={
                    slot.rest.trim() && Number(slot.rest) > 0
                      ? `Rest ${formatDuration(Number(slot.rest))} after each set`
                      : undefined
                  }
                />
                {exercise && exercise.load_mode === 'external' && !timed ? (
                  <SmallField
                    label="+kg earned"
                    owner={title}
                    value={slot.increment}
                    placeholder="2.5"
                    onChange={(t) => update(slot.key, { increment: t })}
                  />
                ) : (
                  <span className="fx-slot-spacer" />
                )}
                <label className="field fx-small-field">
                  <span className="label">Superset</span>
                  <select
                    className="input"
                    value={slot.pair ?? ''}
                    onChange={(e) => update(slot.key, { pair: e.target.value || null })}
                    aria-label={`Superset letter for ${title}`}
                    style={slot.pair ? { color: supersetColor(slot.pair) } : undefined}
                  >
                    <option value="">None</option>
                    {PAIRS.map((letter) => (
                      <option key={letter} value={letter}>
                        {letter}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="fx-slot-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(slot.key, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${title} up`}
                  >
                    <Icon name="arrowUp" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => move(slot.key, 1)}
                    disabled={index === slots.length - 1}
                    aria-label={`Move ${title} down`}
                  >
                    <Icon name="arrowDown" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    onClick={() => setSlots((list) => list.filter((s) => s.key !== slot.key))}
                    aria-label={`Remove ${title} from this routine`}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="row wrap">
        <button type="button" className="btn btn-secondary" onClick={() => setPicking('exercise')}>
          <Icon name="plus" />
          Add exercises
        </button>
        {ladders.length > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setPicking('ladder')}>
            <Icon name="steps" />
            Follow a ladder
          </button>
        ) : null}
      </div>

      <ErrorBanner message={error} />

      {picking === 'exercise' ? (
        <ExercisePicker
          title="Add to routine"
          multiple
          items={exercises
            .filter((e) => visibleInMode(e, mode))
            .map((exercise) => {
              const already = slots.some((s) => s.exercise_id === exercise.id);
              return {
                id: exercise.id,
                label: exercise.name,
                group: normaliseMuscle(exercise.muscle_group),
                disabled: already,
                note: already ? 'Already added' : undefined,
              };
            })}
          emptyText={`No ${MODE_LABEL[mode].toLowerCase()} exercises yet.`}
          onSelect={(ids) =>
            setSlots((list) => [
              ...list,
              ...ids.map((id) => {
                const exercise = byId.get(id);
                const timed = exercise?.tracking_type === 'time';
                const bodyweight = exercise?.load_mode === 'bodyweight';
                return blank({
                  exercise_id: id,
                  min: timed ? '20' : bodyweight ? '5' : '8',
                  max: timed ? '30' : bodyweight ? '10' : '12',
                });
              }),
            ])
          }
          onClose={() => setPicking(null)}
        />
      ) : null}

      {picking === 'ladder' ? (
        <ExercisePicker
          title="Follow a ladder"
          items={ladders.map((l) => {
            const already = slots.some((s) => s.progression_id === l.progression.id);
            return {
              id: l.progression.id,
              label: l.progression.name,
              disabled: already,
              note: already ? 'Already added' : 'Uses whichever rung you are on',
            };
          })}
          onSelect={([id]) => {
            if (id) setSlots((list) => [...list, blank({ progression_id: id })]);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </Modal>
  );
}

function SmallField({
  label,
  owner,
  value,
  onChange,
  placeholder,
  title,
}: {
  label: string;
  /** The slot it belongs to, for its accessible name. */
  owner: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  title?: string;
}) {
  return (
    <label className="field fx-small-field" title={title}>
      <span className="label">{label}</span>
      <input
        className="input numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder={placeholder}
        aria-label={`${label} for ${owner}`}
      />
    </label>
  );
}
