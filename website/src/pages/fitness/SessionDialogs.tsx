/**
 * SessionDialogs - the small dialogs the session page opens.
 *
 * The phone's SessionSheets: each is a short set of choices about the row or
 * block you just clicked. A choice applies at once and closes the dialog -
 * there is no Save to forget - except where there are fields to type into.
 * Nothing here raises a toast while it is open: a <dialog> sits above the
 * toast, so the caller closes it first and then says what happened.
 */
import { useState } from 'react';

import type { Band, SetType } from '@app/modules/fitness/types';

import { Modal, TextField } from '../../components/ui';
import { RPE_OPTIONS, SET_TYPE_COLOR, SET_TYPES } from './format';

export function SetMenuDialog({
  title,
  subtitle,
  setType,
  rpe,
  clean,
  showClean,
  onPickType,
  onPickRpe,
  onToggleClean,
  onRemove,
  onClose,
}: {
  title: string;
  subtitle: string;
  setType: SetType;
  rpe: number | null;
  clean: boolean;
  /** Only bodyweight exercises use the clean flag: it feeds ladder level-ups. */
  showClean: boolean;
  onPickType: (type: SetType) => void;
  onPickRpe: (rpe: number | null) => void;
  onToggleClean: (clean: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-danger fx-foot-start" onClick={onRemove}>
            Remove set
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <p className="muted fx-small">{subtitle}</p>

      <div className="field">
        <span className="label" id="fx-type-label">
          Type
        </span>
        <div className="fx-options" role="radiogroup" aria-labelledby="fx-type-label">
          {SET_TYPES.map((option) => {
            const selected = option.type === setType;
            return (
              <button
                key={option.type}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`fx-option${selected ? ' on' : ''}`}
                onClick={() => onPickType(option.type)}
              >
                <span className="fx-option-letter" style={{ color: SET_TYPE_COLOR[option.type] }}>
                  {option.letter}
                </span>
                <span className="grow">
                  <span className="fx-option-title">{option.title}</span>
                  <span className="fx-option-detail">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <span className="label" id="fx-rpe-label">
          Effort (RPE)
        </span>
        <div className="chip-row" role="radiogroup" aria-labelledby="fx-rpe-label">
          <button
            type="button"
            role="radio"
            aria-checked={rpe === null}
            className={`chip${rpe === null ? ' selected' : ''}`}
            onClick={() => onPickRpe(null)}
          >
            None
          </button>
          {RPE_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rpe === value}
              className={`chip numeric${rpe === value ? ' selected' : ''}`}
              onClick={() => onPickRpe(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="muted fx-small">
          How hard it was: 10 is nothing left, 8 is two more reps in the tank.
        </span>
      </div>

      {showClean ? (
        <label className="fx-switch-row">
          <input
            type="checkbox"
            checked={clean}
            onChange={(e) => onToggleClean(e.target.checked)}
          />
          <span>
            <span className="fx-option-title">Clean set</span>
            <span className="fx-option-detail">Good form; counts toward moving up a ladder</span>
          </span>
        </label>
      ) : null}
    </Modal>
  );
}

export function LoadDialog({
  exerciseName,
  weight,
  assist,
  bandId,
  bands,
  onChange,
  onManageBands,
  onClose,
}: {
  exerciseName: string;
  weight: string;
  assist: string;
  bandId: string | null;
  bands: Band[];
  onChange: (patch: { weight?: string; assist?: string; band_id?: string | null }) => void;
  onManageBands: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title="Load"
      onClose={onClose}
      width={460}
      footer={
        <button type="button" className="btn" onClick={onClose}>
          Done
        </button>
      }
    >
      <p className="muted fx-small">
        {exerciseName}: your bodyweight, plus added weight or minus assistance.
      </p>
      <div className="fx-field-row">
        <TextField
          label="Added weight (kg)"
          value={weight}
          onChange={(e) => onChange({ weight: e.target.value })}
          inputMode="decimal"
          placeholder="0"
          autoFocus
        />
        <TextField
          label="Assistance (kg)"
          value={assist}
          // Typing a figure means it is not (only) the band any more.
          onChange={(e) => onChange({ assist: e.target.value, band_id: null })}
          inputMode="decimal"
          placeholder="0"
        />
      </div>

      <div className="field">
        <span className="label" id="fx-band-label">
          Band
        </span>
        <div className="chip-row" role="radiogroup" aria-labelledby="fx-band-label">
          <button
            type="button"
            role="radio"
            aria-checked={bandId === null}
            className={`chip${bandId === null ? ' selected' : ''}`}
            onClick={() => onChange({ band_id: null })}
          >
            None
          </button>
          {bands.map((band) => (
            <button
              key={band.id}
              type="button"
              role="radio"
              aria-checked={band.id === bandId}
              className={`chip${band.id === bandId ? ' selected' : ''}`}
              // A band IS assistance: its approximate kg is what records compare.
              onClick={() =>
                onChange({ band_id: band.id, assist: band.approx_kg ? String(band.approx_kg) : '' })
              }
            >
              <span className="fx-band-dot" style={{ background: band.color }} aria-hidden="true" />
              {band.label}
              {band.approx_kg ? (
                <span className="muted numeric"> ≈ {band.approx_kg} kg</span>
              ) : null}
            </button>
          ))}
        </div>
        <button type="button" className="fx-link fx-small" onClick={onManageBands}>
          {bands.length === 0 ? 'Add your bands on the Body tab' : 'Manage bands on the Body tab'}
        </button>
      </div>
    </Modal>
  );
}

export function PinnedNoteDialog({
  exerciseName,
  note,
  onSave,
  onClose,
}: {
  exerciseName: string;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(note);
  return (
    <Modal
      open
      title="Pinned note"
      onClose={onClose}
      width={460}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              onClose();
              onSave(text.trim());
            }}
          >
            Save
          </button>
        </>
      }
    >
      <TextField
        label={`Shown every time you log ${exerciseName}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Seat on 4, grip just outside the rings"
        maxLength={200}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onClose();
            onSave(text.trim());
          }
        }}
      />
    </Modal>
  );
}
