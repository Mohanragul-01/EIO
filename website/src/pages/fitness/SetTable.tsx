/**
 * SetTable - one exercise in a session: its header and its set table.
 *
 *   SET · PREVIOUS · LOAD · REPS (or TIME) · ✓
 *
 * The phone's ExerciseBlock, for a keyboard and a mouse. Each row starts as a
 * draft with GHOST values - the progression target, the routine's, or last
 * time's matching set - drawn faint in the cells, and ticking a row with empty
 * cells commits the ghosts, so "same as last time" is one click per set.
 *
 * From the keyboard: Enter in the weight moves to the reps, and Enter in the
 * reps (the row's last field) ticks the row and moves on to the next one.
 *
 * A ticked row is saved at once and tinted with --completed, with a filled
 * check as well, so the state is never colour alone; the text on the tint is
 * --text and --text-secondary only, which keep their contrast there. Ticking
 * it again unticks it: the set is deleted and its values come back to edit.
 */
import { type KeyboardEvent, type ReactNode } from 'react';

import type { DraftRow } from '@app/modules/fitness/blocks';
import {
  formatHoldShort,
  formatLoadChip,
  formatSetShort,
  setLabels,
  type SetFact,
} from '@app/modules/fitness/load';
import { primaryRecord, type RecordHit } from '@app/modules/fitness/records';
import type { BlockState, Ghost, Row } from '@app/modules/fitness/sessionState';
import type { Band, Exercise } from '@app/modules/fitness/types';
import { formatEventDate } from '@app/core/date';

import { Icon } from '../../components/Icon';
import { fieldText, REST_OPTIONS, restLabel, SET_TYPE_COLOR, supersetColor } from './format';
import { Menu, type MenuItem } from './Menu';
import { rowType } from './useSessionLog';

type DraftPatch = Partial<Omit<DraftRow, 'key'>>;

/**
 * What a tick came to: saved (focus moves to the next row here), saved and
 * focus already moved elsewhere (to a superset partner), or not saved.
 */
export type TickOutcome = 'saved' | 'moved' | null;

export type BlockProps = {
  block: BlockState;
  exercise: Exercise | undefined;
  bandsById: Record<string, Band>;
  records: Record<string, RecordHit[]>;
  restSeconds: number;
  /** "A1", "A2" when the block is in a superset. */
  supersetLabel: string | null;
  /** Why today's ghosts differ from last time: "+2.5 kg · every set hit 12". */
  targetReason: string | null;
  /** The day of the session the PREVIOUS column comes from. */
  previousDate: string | null;
  previousFor: (index: number) => SetFact | null;
  ghostFor: (index: number) => Ghost;
  menuItems: MenuItem[];
  onOpenExercise: () => void;
  onRest: (seconds: number) => void;
  onTick: (key: string, viaKeyboard: boolean) => Promise<TickOutcome>;
  onUntick: (key: string) => void;
  onSetMenu: (key: string) => void;
  onLoad: (key: string) => void;
  onChangeDraft: (key: string, patch: DraftPatch) => void;
  onAddSet: () => void;
  onNoteBlur: (note: string) => void;
};

export function ExerciseBlockCard(props: BlockProps) {
  const { block, exercise } = props;
  const name = exercise?.name ?? 'Exercise';
  const timed = exercise?.tracking_type === 'time';
  const bodyweight = exercise?.load_mode === 'bodyweight';
  const labels = setLabels(block.rows.map((row) => ({ set_type: rowType(row) })));
  const ssColor = props.supersetLabel ? supersetColor(props.supersetLabel[0]) : undefined;
  const headingId = `fx-block-${block.id}`;

  return (
    <section
      className={`card fx-block${props.supersetLabel ? ' superset' : ''}`}
      style={ssColor ? { borderLeftColor: ssColor } : undefined}
      aria-labelledby={headingId}
    >
      <header className="fx-block-head">
        {props.supersetLabel ? (
          <span className="fx-ss-tag" style={{ color: ssColor }}>
            <Icon name="link" size={12} />
            <span>
              <span className="sr-only">Superset </span>
              {props.supersetLabel}
            </span>
          </span>
        ) : null}
        <h3 id={headingId} className="fx-block-name">
          <button
            type="button"
            className="fx-link"
            onClick={props.onOpenExercise}
            title={`${name}: history, records and how-to`}
          >
            {name}
          </button>
        </h3>
        {props.previousDate ? (
          <span className="muted fx-small">Last time {formatEventDate(props.previousDate)}</span>
        ) : null}
        <span className="grow" />
        <Menu
          label={`Rest after each set of ${name}: ${restLabel(props.restSeconds)}. Change`}
          className="chip fx-rest-chip"
          content={
            <>
              <Icon name="timer" size={13} />
              <span className="numeric">{restLabel(props.restSeconds)}</span>
            </>
          }
          items={[
            { kind: 'heading', key: 'h', label: 'Rest after each set' },
            ...REST_OPTIONS.map((seconds) => ({
              key: String(seconds),
              label: seconds === 0 ? 'No rest timer' : restLabel(seconds),
              checked: seconds === props.restSeconds,
              onSelect: () => props.onRest(seconds),
            })),
          ]}
        />
        <Menu label={`More for ${name}`} items={props.menuItems} />
      </header>

      {props.targetReason ? (
        <p className="fx-reason">
          <Icon name="trend" size={13} />
          <span>
            Today&rsquo;s target: <strong>{props.targetReason}</strong>
          </span>
        </p>
      ) : null}

      {exercise?.pinned_note ? (
        <p className="fx-pinned">
          <Icon name="pin" size={13} />
          <span>
            <span className="sr-only">Pinned note: </span>
            {exercise.pinned_note}
          </span>
        </p>
      ) : null}

      <input
        className="input fx-note"
        defaultValue={block.sessionExercise?.note ?? ''}
        onBlur={(e) => props.onNoteBlur(e.target.value.trim())}
        placeholder="Note for today"
        aria-label={`Note for ${name} today`}
        maxLength={300}
      />

      <table className="fx-sets">
        <caption className="sr-only">Sets of {name}</caption>
        <thead>
          <tr>
            <th scope="col" className="fx-c-set">
              Set
            </th>
            <th scope="col" className="fx-c-prev">
              Previous
            </th>
            <th scope="col" className="fx-c-load">
              {bodyweight ? 'Load' : 'kg'}
            </th>
            <th scope="col" className="fx-c-value">
              {timed ? 'Time (s)' : 'Reps'}
            </th>
            <th scope="col" className="fx-c-tick">
              <Icon name="check" size={14} />
              <span className="sr-only">Done</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, index) => (
            <SetRow
              key={row.key}
              row={row}
              label={labels[index]}
              exercise={exercise}
              bandsById={props.bandsById}
              hits={row.kind === 'saved' ? (props.records[row.set.id] ?? []) : []}
              previous={props.previousFor(index)}
              ghost={props.ghostFor(index)}
              onTick={props.onTick}
              onUntick={props.onUntick}
              onSetMenu={props.onSetMenu}
              onLoad={props.onLoad}
              onChangeDraft={props.onChangeDraft}
            />
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="btn btn-ghost btn-sm fx-add-set"
        data-add-set=""
        onClick={props.onAddSet}
        aria-label={`Add a set of ${name}`}
      >
        <Icon name="plus" size={14} />
        Add set
      </button>
    </section>
  );
}

/**
 * After a tick, focus the next row that can still be filled in, or Add set.
 * Takes the ROW, captured before the save: the field that was focused is
 * replaced by plain text once the set is saved, and a detached input can no
 * longer find its way back to the table.
 */
function focusNext(row: HTMLTableRowElement) {
  let next = row.nextElementSibling;
  while (next) {
    // The weight for a lift; for bodyweight, straight to the reps - the load
    // chip is usually left as it is, and it is one Shift+Tab away.
    const field = next.querySelector<HTMLElement>('[data-field="weight"], [data-field="value"]');
    if (field) {
      field.focus();
      return;
    }
    next = next.nextElementSibling;
  }
  row.closest('.fx-block')?.querySelector<HTMLElement>('[data-add-set]')?.focus();
}

function SetRow({
  row,
  label,
  exercise,
  bandsById,
  hits,
  previous,
  ghost,
  onTick,
  onUntick,
  onSetMenu,
  onLoad,
  onChangeDraft,
}: {
  row: Row;
  label: string;
  exercise: Exercise | undefined;
  bandsById: Record<string, Band>;
  hits: RecordHit[];
  previous: SetFact | null;
  ghost: Ghost;
  onTick: (key: string, viaKeyboard: boolean) => Promise<TickOutcome>;
  onUntick: (key: string) => void;
  onSetMenu: (key: string) => void;
  onLoad: (key: string) => void;
  onChangeDraft: (key: string, patch: DraftPatch) => void;
}) {
  const timed = exercise?.tracking_type === 'time';
  const bodyweight = exercise?.load_mode === 'bodyweight';
  const shape = { load_mode: exercise?.load_mode ?? 'external' } as const;
  const type = rowType(row);
  const saved = row.kind === 'saved';
  const draft = row.kind === 'draft' ? row.draft : null;
  const record = primaryRecord(hits);
  const values = row.kind === 'saved' ? row.set : row.draft;
  const side = values.side;
  const rpe = values.rpe;
  const clean = values.clean;
  const setName = `Set ${label}${side ? (side === 'left' ? ' left' : ' right') : ''}`;

  const previousText = previous
    ? formatSetShort({ ...previous, band_id: null, side: null }, shape)
    : '—';

  const tickFromKeyboard = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const tr = event.currentTarget.closest('tr');
    void onTick(row.key, true).then((outcome) => {
      if (outcome === 'saved' && tr) focusNext(tr);
    });
  };

  // LOAD: a kg field for a lift; for bodyweight, a chip that opens the load
  // dialog (+kg, assistance or a band) and reads "BW" when unloaded.
  let loadCell: ReactNode;
  if (bodyweight) {
    const source =
      row.kind === 'saved'
        ? row.set
        : {
            weight_kg: Number(row.draft.weight.replace(',', '.')) || 0,
            assist_kg: Number(row.draft.assist.replace(',', '.')) || null,
            band_id: row.draft.band_id,
          };
    const band = source.band_id ? bandsById[source.band_id] : undefined;
    const chip = formatLoadChip(source, shape, band?.label) ?? 'BW';
    const spoken = chip === 'BW' ? 'bodyweight' : chip.replace('−', 'minus ');
    const content = (
      <>
        {band ? <span className="fx-band-dot" style={{ background: band.color }} /> : null}
        <span aria-hidden={chip === 'BW'}>{chip}</span>
        {chip === 'BW' ? <span className="sr-only">bodyweight</span> : null}
      </>
    );
    loadCell = draft ? (
      <button
        type="button"
        className="fx-load-chip"
        data-field="load"
        onClick={() => onLoad(row.key)}
        aria-label={`${setName} load: ${spoken}. Change`}
      >
        {content}
      </button>
    ) : (
      <span className="fx-load-chip static">{content}</span>
    );
  } else if (row.kind === 'saved') {
    loadCell = <span className="numeric">{fieldText(row.set.weight_kg) || '0'}</span>;
  } else {
    loadCell = (
      <input
        className="input fx-cell-input numeric"
        data-field="weight"
        value={row.draft.weight}
        onChange={(e) => onChangeDraft(row.key, { weight: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.currentTarget
            .closest('tr')
            ?.querySelector<HTMLElement>('[data-field="value"]')
            ?.focus();
        }}
        placeholder={fieldText(ghost.weight)}
        inputMode="decimal"
        disabled={row.kind !== 'draft'}
        aria-label={`${setName} weight in kilograms`}
      />
    );
  }

  let valueCell: ReactNode;
  if (row.kind === 'saved') {
    valueCell = (
      <span className="numeric">
        {timed ? formatHoldShort(row.set.duration_seconds ?? 0) : String(row.set.reps ?? 0)}
      </span>
    );
  } else {
    const ghostValue = timed ? ghost.seconds : ghost.reps;
    valueCell = (
      <input
        className="input fx-cell-input numeric"
        data-field="value"
        value={timed ? row.draft.seconds : row.draft.reps}
        onChange={(e) =>
          onChangeDraft(row.key, timed ? { seconds: e.target.value } : { reps: e.target.value })
        }
        onKeyDown={tickFromKeyboard}
        placeholder={ghostValue === null ? '' : String(ghostValue)}
        inputMode="numeric"
        disabled={row.kind !== 'draft'}
        aria-label={`${setName} ${timed ? 'seconds held' : 'reps'}${
          ghostValue === null ? '' : `, ${ghostValue} if left empty`
        }. Enter to tick`}
      />
    );
  }

  return (
    <tr
      data-key={row.key}
      className={`fx-set-row${saved ? ' done' : ''}${row.kind === 'pending' ? ' pending' : ''}`}
    >
      <td className="fx-c-set">
        <button
          type="button"
          className="fx-set-btn"
          onClick={() => onSetMenu(row.key)}
          disabled={row.kind === 'pending'}
          aria-label={`${setName}${record ? `, record: ${record.label}` : ''}${
            rpe ? `, RPE ${rpe}` : ''
          }${clean ? '' : ', not clean'}. Change type, effort or remove`}
        >
          {record ? <Icon name="trophy" size={13} className="fx-medal" /> : null}
          <span className="fx-set-label" style={{ color: SET_TYPE_COLOR[type] }}>
            {label}
          </span>
          {side ? <span className="fx-side">{side === 'left' ? 'L' : 'R'}</span> : null}
          {rpe ? <span className="fx-rpe">RPE {rpe}</span> : null}
          {clean ? null : <span className="fx-rpe">not clean</span>}
        </button>
      </td>
      <td className="fx-c-prev">
        <button
          type="button"
          className="fx-prev-btn numeric"
          disabled={!previous || !draft}
          onClick={() => {
            if (!previous || !draft) return;
            onChangeDraft(row.key, {
              weight: fieldText(previous.weight_kg),
              assist: fieldText(previous.assist_kg),
              ...(timed
                ? { seconds: previous.duration_seconds ? String(previous.duration_seconds) : '' }
                : { reps: previous.reps !== null ? String(previous.reps) : '' }),
            });
          }}
          aria-label={
            previous
              ? `Last time ${previousText}${draft ? '. Copy into this set' : ''}`
              : 'No previous set'
          }
        >
          {previousText}
        </button>
      </td>
      <td className="fx-c-load">{loadCell}</td>
      <td className="fx-c-value">{valueCell}</td>
      <td className="fx-c-tick">
        {/* One button in every state, so a keyboard user who ticks with Space
            keeps focus on it while the set saves and after; while saving it is
            busy rather than disabled, since disabling a focused button drops
            focus to the page. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={saved || row.kind === 'pending'}
          aria-busy={row.kind === 'pending' || undefined}
          aria-disabled={row.kind === 'pending' || undefined}
          className={`fx-tick${saved ? ' on' : ''}${row.kind === 'pending' ? ' busy' : ''}`}
          onClick={() => {
            if (row.kind === 'pending') return;
            if (saved) onUntick(row.key);
            else void onTick(row.key, false);
          }}
          aria-label={
            row.kind === 'pending'
              ? `Saving ${setName}`
              : saved
                ? `${setName} done. Untick to edit`
                : `Complete ${setName}`
          }
        >
          {row.kind === 'pending' ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <Icon name="check" size={14} strokeWidth={2.2} />
          )}
        </button>
      </td>
    </tr>
  );
}
