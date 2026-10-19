/**
 * MarkdownTextarea - the body field in the note dialog, with a toolbar.
 *
 * The same edits as the phone's formatting bar (the app's markdownEdit.ts):
 * box, bullet, number, heading, bold, italic, link, each undoing itself when
 * pressed again. Enter carries a list on, and Enter on an empty item ends it.
 * Ctrl/Cmd+B and Ctrl/Cmd+I do bold and italic, since a desktop has a keyboard
 * worth using.
 *
 * After an edit the caret is put back where the edit says, in a layout effect
 * keyed on the value: setting it before React has written the new text would
 * place it in the old one.
 */
import { useLayoutEffect, useRef, type KeyboardEvent } from 'react';

import {
  continueList,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
  type Edit,
  type Selection,
} from '@app/modules/notes/markdownEdit';

import { Icon, type IconName } from '../../components/Icon';

type Action = 'task' | 'bullet' | 'numbered' | 'heading' | 'bold' | 'italic' | 'link';

const BUTTONS: { action: Action; label: string; icon?: IconName; text?: string; keys?: string }[] = [
  { action: 'task', label: 'Checkbox', icon: 'checklist' },
  { action: 'bullet', label: 'Bulleted list', icon: 'list' },
  { action: 'numbered', label: 'Numbered list', text: '1.' },
  { action: 'heading', label: 'Heading', text: 'H' },
  { action: 'bold', label: 'Bold', text: 'B', keys: 'Ctrl+B' },
  { action: 'italic', label: 'Italic', text: 'I', keys: 'Ctrl+I' },
  { action: 'link', label: 'Link', icon: 'link' },
];

export function MarkdownTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 8,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<Selection | null>(null);

  useLayoutEffect(() => {
    const area = ref.current;
    const selection = pending.current;
    if (!area || !selection) return;
    pending.current = null;
    area.focus();
    area.setSelectionRange(selection.start, selection.end);
  }, [value]);

  const apply = (edit: Edit) => {
    pending.current = edit.selection;
    onChange(edit.text);
  };

  const current = (): Selection => {
    const area = ref.current;
    return area ? { start: area.selectionStart, end: area.selectionEnd } : { start: value.length, end: value.length };
  };

  const run = (action: Action) => {
    const selection = current();
    switch (action) {
      case 'task':
      case 'bullet':
      case 'numbered':
      case 'heading':
        apply(toggleLinePrefix(value, selection, action));
        return;
      case 'bold':
        apply(wrapSelection(value, selection, '**'));
        return;
      case 'italic':
        apply(wrapSelection(value, selection, '*'));
        return;
      case 'link':
        apply(insertLink(value, selection));
        return;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.shiftKey && !event.altKey && (event.key === 'b' || event.key === 'i')) {
      event.preventDefault();
      run(event.key === 'b' ? 'bold' : 'italic');
      return;
    }

    if (event.key !== 'Enter' || mod || event.shiftKey || event.altKey) return;
    const { start, end } = current();
    if (start !== end) return;
    const next = value.slice(0, start) + '\n' + value.slice(end);
    const edit = continueList(value, next, start);
    if (!edit) return;
    event.preventDefault();
    apply(edit);
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="md-toolbar" role="toolbar" aria-label="Formatting">
        {BUTTONS.map((button) => (
          <button
            key={button.action}
            type="button"
            className="icon-btn md-tool"
            // Keep focus (and the selection) in the textarea when clicked.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => run(button.action)}
            aria-label={button.label}
            title={button.keys ? `${button.label} (${button.keys})` : button.label}
          >
            {button.icon ? (
              <Icon name={button.icon} size={15} />
            ) : (
              <span className={`md-tool-text md-tool-${button.action}`}>{button.text}</span>
            )}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className="input md-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
        aria-label={label}
      />
      <span className="faint" style={{ fontSize: 12 }}>
        - [ ] box · - bullet · 1. number · # heading · **bold** · *italic* · [words](https://…)
      </span>
    </div>
  );
}
