/**
 * ExercisePicker - choose one exercise (or several) from a searchable list.
 *
 * The phone's PickerSheet, as a dialog, over the same shared grouping
 * (pickerItems.groupItems): the search matches the muscle and the note too, so
 * typing "legs" finds the squat, and "Other" sinks to the bottom. Items that
 * cannot be picked stay listed, greyed, with the reason - hiding them would
 * make "where did my exercise go?" a question.
 */
import { useMemo, useState } from 'react';

import { groupItems, type PickerItem } from '@app/modules/fitness/pickerItems';

import { Icon } from '../../components/Icon';
import { Modal } from '../../components/ui';

export function ExercisePicker({
  title,
  items,
  multiple = false,
  emptyText = 'Nothing to choose from yet.',
  onSelect,
  onClose,
}: {
  title: string;
  items: PickerItem[];
  multiple?: boolean;
  emptyText?: string;
  /** Called with the chosen ids; the picker closes itself straight after. */
  onSelect: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const sections = useMemo(() => groupItems(items, query), [items, query]);
  const flat = items.every((item) => !item.group?.trim());

  const pick = (id: string) => {
    if (!multiple) {
      onClose();
      onSelect([id]);
      return;
    }
    setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  };

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width={520}
      footer={
        multiple ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn"
              disabled={chosen.length === 0}
              onClick={() => {
                onClose();
                onSelect(chosen);
              }}
            >
              {chosen.length === 0 ? 'Add' : `Add ${chosen.length}`}
            </button>
          </>
        ) : undefined
      }
    >
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        aria-label="Search"
        autoFocus
      />

      <div className="fx-picker-list" role="list">
        {items.length === 0 ? (
          <p className="muted fx-small">{emptyText}</p>
        ) : sections.length === 0 ? (
          <p className="muted fx-small">Nothing matches that search.</p>
        ) : (
          sections.map((section) => (
            <div key={section.group} role="listitem">
              {flat ? null : <div className="overline fx-picker-group">{section.group}</div>}
              {section.items.map((item) => {
                const on = chosen.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`fx-picker-item${on ? ' on' : ''}`}
                    disabled={item.disabled}
                    aria-pressed={multiple ? on : undefined}
                    onClick={() => pick(item.id)}
                  >
                    <span className="grow">
                      <span className="fx-picker-label">{item.label}</span>
                      {item.note ? <span className="fx-picker-note">{item.note}</span> : null}
                    </span>
                    {multiple ? (
                      <span className={`check${on ? ' on' : ''}`} aria-hidden="true">
                        <Icon name="check" size={11} strokeWidth={2.4} />
                      </span>
                    ) : (
                      <Icon name="plus" size={14} className="faint" />
                    )}
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
