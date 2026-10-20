/**
 * LadderEditor - build or change a ladder.
 *
 * A ladder is a name, a family (for grouping), when to ask about moving up,
 * and an ordered list of rungs. Each rung is an exercise from your library
 * with a graduation goal - so many sets of so many reps (or seconds),
 * optionally with added weight - plus where to restart right after moving up
 * to it, and a one-line cue for what a clean rep looks like there.
 *
 * Rungs keep their identity through edits (api.saveLadder updates by id), so
 * the dates you mastered them survive renaming or reordering. Taking a rung
 * out deletes its history of moves, and the save asks before doing that.
 */
import { useMemo, useState } from 'react';

import * as api from '@app/modules/fitness/api';
import { visibleInMode } from '@app/modules/fitness/mode';
import {
  normaliseMuscle,
  type Exercise,
  type Progression,
  type ProgressionFamily,
} from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import {
  ChipPicker,
  ErrorBanner,
  Modal,
  Segmented,
  TextArea,
  TextField,
  useConfirm,
} from '../../components/ui';
import { ExercisePicker } from './ExercisePicker';
import { FAMILIES, FAMILY_LABEL, plural } from './format';

type RungDraft = {
  key: string;
  id?: string;
  exercise_id: string;
  goalSets: string;
  goal: string;
  added: string;
  start: string;
  cue: string;
};

let keySeq = 0;
const newKey = () => `rung${++keySeq}`;

const toInt = (text: string) => {
  const n = Number(text.trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function LadderEditor({
  ladder,
  exercises,
  onClose,
  onSaved,
}: {
  /** Null for a new ladder. */
  ladder: api.Ladder | null;
  exercises: Exercise[];
  onClose: () => void;
  onSaved: (progressionId: string) => void;
}) {
  const { confirm, dialog } = useConfirm();
  const ordered = useMemo(
    () => [...(ladder?.steps ?? [])].sort((a, b) => a.position - b.position),
    [ladder],
  );
  const [name, setName] = useState(ladder?.progression.name ?? '');
  const [family, setFamily] = useState<ProgressionFamily>(ladder?.progression.family ?? 'pull');
  const [rule, setRule] = useState<Progression['level_up_rule']>(
    ladder?.progression.level_up_rule ?? 'two_of_three',
  );
  const [notes, setNotes] = useState(ladder?.progression.notes ?? '');
  const [rungs, setRungs] = useState<RungDraft[]>(() =>
    ordered.map((s) => ({
      key: newKey(),
      id: s.id,
      exercise_id: s.exercise_id,
      goalSets: String(s.goal_sets),
      goal: String(s.goal_seconds ?? s.goal_reps ?? ''),
      added: s.goal_added_kg ? String(s.goal_added_kg) : '',
      start: String(s.start_seconds ?? s.start_reps ?? ''),
      cue: s.cue,
    })),
  );
  /** null: closed; 'add': appending; a key: replacing that rung's exercise. */
  const [picking, setPicking] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const timed = (rung: RungDraft) => byId.get(rung.exercise_id)?.tracking_type === 'time';

  const update = (key: string, patch: Partial<RungDraft>) =>
    setRungs((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (key: string, delta: -1 | 1) =>
    setRungs((list) => {
      const i = list.findIndex((r) => r.key === key);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = async () => {
    const problems: string[] = [];
    if (!name.trim()) problems.push('Give the ladder a name');
    if (rungs.length === 0) problems.push('Add at least one rung');
    rungs.forEach((r, i) => {
      if (!toInt(r.goalSets) || !toInt(r.goal)) problems.push(`Rung ${i + 1} needs a goal`);
    });
    if (problems.length > 0) return setError(problems[0]);

    const removed = ordered.filter((s) => !rungs.some((r) => r.id === s.id)).length;
    if (removed > 0) {
      const ok = await confirm(
        `Remove ${plural(removed, 'rung')}?`,
        'Their history of moves on this ladder is deleted. Sets you logged are kept. This cannot be undone.',
        'Remove and save',
      );
      if (!ok) return;
    }

    setSaving(true);
    setError(null);
    try {
      const id = await api.saveLadder(
        {
          id: ladder?.progression.id,
          name: name.trim(),
          family,
          level_up_rule: rule,
          notes: notes.trim(),
        },
        rungs.map((r) => {
          const isTimed = timed(r);
          const added = Number(r.added.replace(',', '.'));
          return {
            id: r.id,
            exercise_id: r.exercise_id,
            goal_sets: toInt(r.goalSets) ?? 3,
            goal_reps: isTimed ? null : toInt(r.goal),
            goal_seconds: isTimed ? toInt(r.goal) : null,
            goal_added_kg: Number.isFinite(added) && added > 0 ? added : null,
            start_reps: isTimed ? null : toInt(r.start),
            start_seconds: isTimed ? toInt(r.start) : null,
            cue: r.cue.trim(),
          };
        }),
      );
      onSaved(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the ladder');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={ladder ? `Edit ${ladder.progression.name}` : 'New ladder'}
      onClose={onClose}
      width={900}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save ladder'}
          </button>
        </>
      }
    >
      <div className="fx-field-row">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Front lever, Pull-up, Pistol squat"
          maxLength={60}
          autoFocus={!ladder}
        />
        <div className="field">
          <span className="label">Ask to move up after</span>
          <Segmented
            value={rule}
            onChange={setRule}
            options={[
              { value: 'two_of_three', label: '2 of the last 3' },
              { value: 'one', label: '1 session' },
            ]}
          />
          <span className="muted fx-small">
            Sessions on a rung that must meet its goal, with clean sets, before you are asked.
          </span>
        </div>
      </div>

      <ChipPicker
        label="Family"
        value={family}
        onChange={setFamily}
        options={FAMILIES.map((f) => ({ value: f, label: FAMILY_LABEL[f] }))}
      />

      <div className="field">
        <span className="label">Rungs, easiest first</span>
        {rungs.length === 0 ? (
          <p className="muted fx-small">
            Add the variations in order. Each gets a goal: so many sets of so many reps or seconds,
            optionally with added weight.
          </p>
        ) : (
          <ol className="fx-rungs-edit">
            {rungs.map((rung, index) => {
              const exercise = byId.get(rung.exercise_id);
              const isTimed = timed(rung);
              const label = exercise?.name ?? 'A removed exercise';
              return (
                <li key={rung.key} className="fx-rung-edit">
                  <span className="fx-slot-index numeric" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="fx-rung-edit-main">
                    <div className="row">
                      <button
                        type="button"
                        className="fx-link grow"
                        onClick={() => setPicking(rung.key)}
                        aria-label={`Rung ${index + 1}: ${label}. Change the exercise`}
                      >
                        {label}
                      </button>
                      <span className="muted fx-small">
                        {isTimed ? 'Held, in seconds' : 'Counted in reps'}
                      </span>
                    </div>
                    <div className="fx-rung-fields">
                      <RungField
                        label="Sets"
                        owner={label}
                        value={rung.goalSets}
                        onChange={(t) => update(rung.key, { goalSets: t })}
                      />
                      <RungField
                        label={isTimed ? 'Seconds each' : 'Reps each'}
                        owner={label}
                        value={rung.goal}
                        onChange={(t) => update(rung.key, { goal: t })}
                      />
                      <RungField
                        label="+kg (optional)"
                        owner={label}
                        value={rung.added}
                        onChange={(t) => update(rung.key, { added: t })}
                      />
                      <RungField
                        label={isTimed ? 'Restart at (s)' : 'Restart at (reps)'}
                        owner={label}
                        value={rung.start}
                        onChange={(t) => update(rung.key, { start: t })}
                      />
                    </div>
                    <input
                      className="input"
                      value={rung.cue}
                      onChange={(e) => update(rung.key, { cue: e.target.value })}
                      placeholder="Cue: what a clean rep looks like here"
                      aria-label={`Cue for ${label}`}
                      maxLength={140}
                    />
                  </div>
                  <div className="fx-slot-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => move(rung.key, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${label} up`}
                    >
                      <Icon name="arrowUp" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => move(rung.key, 1)}
                      disabled={index === rungs.length - 1}
                      aria-label={`Move ${label} down`}
                    >
                      <Icon name="arrowDown" />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => setRungs((list) => list.filter((r) => r.key !== rung.key))}
                      aria-label={`Remove ${label} from this ladder`}
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <div>
          <button type="button" className="btn btn-secondary" onClick={() => setPicking('add')}>
            <Icon name="plus" />
            Add a rung
          </button>
        </div>
      </div>

      <TextArea
        label="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Anything about this ladder"
        rows={2}
      />

      <ErrorBanner message={error} />

      {picking !== null ? (
        <ExercisePicker
          title={picking === 'add' ? 'Add a rung' : 'Choose the exercise'}
          items={exercises
            .filter((e) => visibleInMode(e, 'calisthenics'))
            .map((e) => ({ id: e.id, label: e.name, group: normaliseMuscle(e.muscle_group) }))}
          emptyText="No calisthenics exercises yet. Add some under Skills, in the Library."
          onSelect={([id]) => {
            if (!id) return;
            const exercise = byId.get(id);
            const held = exercise?.tracking_type === 'time';
            if (picking === 'add') {
              setRungs((list) => [
                ...list,
                {
                  key: newKey(),
                  exercise_id: id,
                  goalSets: '3',
                  goal: held ? '30' : '8',
                  added: '',
                  start: held ? '10' : '5',
                  cue: '',
                },
              ]);
            } else {
              update(picking, { exercise_id: id });
            }
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}

      {dialog}
    </Modal>
  );
}

function RungField({
  label,
  owner,
  value,
  onChange,
}: {
  label: string;
  owner: string;
  value: string;
  onChange: (text: string) => void;
}) {
  return (
    <label className="field fx-small-field">
      <span className="label">{label}</span>
      <input
        className="input numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label={`${label} for ${owner}`}
      />
    </label>
  );
}
