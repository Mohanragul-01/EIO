/**
 * ColorChoices - "None" and the seven note colours, each with its name.
 *
 * Named, not bare swatches: the colour is the whole meaning of the choice,
 * and a row of unlabelled dots is colour alone.
 */
import { NOTE_COLORS, type NoteColorKey } from '@app/modules/notes/noteColors';

import { Icon } from '../../components/Icon';

export function ColorChoices({
  value,
  onPick,
}: {
  value: NoteColorKey | null;
  onPick: (color: NoteColorKey | null) => void;
}) {
  const options = [{ key: null, label: 'None', swatch: null }, ...NOTE_COLORS] as {
    key: NoteColorKey | null;
    label: string;
    swatch: string | null;
  }[];

  return (
    <div className="note-swatches" role="radiogroup" aria-label="Colour">
      {options.map((option) => {
        const selected = option.key === value;
        return (
          <button
            key={option.label}
            type="button"
            className={`chip note-swatch${selected ? ' selected' : ''}`}
            role="radio"
            aria-checked={selected}
            onClick={() => onPick(option.key)}
          >
            <span
              className={`note-swatch-dot${option.swatch ? '' : ' none'}`}
              style={option.swatch ? { background: option.swatch } : undefined}
            >
              {selected ? <Icon name="check" size={10} strokeWidth={3} /> : null}
            </span>
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
