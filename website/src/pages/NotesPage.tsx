/**
 * NotesPage - capture on the left, everything you have on the right.
 *
 * The phone puts quick capture behind a button because there is no room for a
 * permanent box. Here it is always on screen and always focused, which is the
 * whole point of quick capture: the gap between having a thought and it being
 * saved should be one keystroke, not a tap, a screen transition and a tap.
 *
 * The three kinds of note are filters rather than separate screens, and the
 * inbox is a filter too - a note is "in the inbox" when it has no title and no
 * tags, which is a property of the note, not a place it lives.
 */
import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/notes/api';
import {
  belongsInInbox,
  checklistProgress,
  formatTags,
  parseTags,
  readChecklistItems,
  NOTE_TYPE_LABEL,
  type ChecklistItem,
  type Note,
  type NoteInput,
  type NoteType,
} from '@app/modules/notes/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import {
  Empty,
  ErrorBanner,
  Modal,
  Segmented,
  Spinner,
  TextArea,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

type View = 'all' | 'inbox' | 'note' | 'checklist' | 'journal';

export function NotesPage() {
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Note | 'new' | null>(null);
  const [capture, setCapture] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeys({
    onSearch: () => searchRef.current?.focus(),
    onNew: () => setEditing('new'),
  });

  // listNotes deliberately excludes journals, so the journal list is fetched
  // separately and the two are combined here.
  const load = useCallback(async () => {
    const [notes, journal] = await Promise.all([api.listNotes(), api.listJournal()]);
    return [...notes, ...journal];
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'notes');
  const notes = useMemo(() => data ?? [], [data]);

  const counts = useMemo(
    () => ({
      all: notes.length,
      inbox: notes.filter((n) => n.is_inbox).length,
      note: notes.filter((n) => n.note_type === 'note').length,
      checklist: notes.filter((n) => n.note_type === 'checklist').length,
      journal: notes.filter((n) => n.note_type === 'journal').length,
    }),
    [notes],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return notes
      .filter((note) => {
        if (view === 'inbox') return note.is_inbox;
        if (view !== 'all') return note.note_type === view;
        return true;
      })
      .filter((note) => {
        if (!needle) return true;
        // Searches the checklist items too, so "milk" finds the shopping list
        // that contains it rather than only notes that mention it in prose.
        const haystack = [
          note.title,
          note.body,
          note.tags.join(' '),
          readChecklistItems(note.checklist_items)
            .map((i) => i.text)
            .join(' '),
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => {
        // Journals read chronologically by the day they are ABOUT; everything
        // else by when it was last touched.
        if (a.note_type === 'journal' && b.note_type === 'journal') {
          return (b.entry_date ?? '').localeCompare(a.entry_date ?? '');
        }
        return b.updated_at.localeCompare(a.updated_at);
      });
  }, [notes, view, query]);

  const quickCapture = async (event: FormEvent) => {
    event.preventDefault();
    const body = capture.trim();
    if (!body) return;

    setCapturing(true);
    setActionError(null);
    try {
      // No title and no tags, which by the belongsInInbox rule is exactly
      // what the inbox means - so this is that rule's answer for this shape of
      // note, not a separate decision.
      await api.createNote({
        title: '',
        body,
        tags: [],
        note_type: 'note',
        is_inbox: true,
        entry_date: null,
        checklist_items: null,
      });
      setCapture('');
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setCapturing(false);
    }
  };

  const remove = async (note: Note) => {
    const label = note.title || note.body.slice(0, 40) || 'This note';
    if (!(await confirm('Delete note', `${label} will be removed.`))) return;
    setActionError(null);
    try {
      await api.deleteNote(note.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  /** Tick an item without opening the note. */
  const toggleItem = async (note: Note, index: number) => {
    const items = readChecklistItems(note.checklist_items);
    const next = items.map((item, i) => (i === index ? { ...item, done: !item.done } : item));
    setActionError(null);
    try {
      await api.setChecklistItems(note.id, next);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update that list');
    }
  };

  return (
    <Shell
      title="Notes"
      subtitle={loading ? 'Loading' : `${counts.all} total · ${counts.inbox} to file`}
      actions={
        <button className="btn" onClick={() => setEditing('new')}>
          <Icon name="plus" /> New note
        </button>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      <div className="split-wide split">
        {/* CAPTURE + FILTERS -------------------------------------------- */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <form className="card card-pad rise" onSubmit={quickCapture}>
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Quick capture
            </div>
            <TextArea
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              placeholder="Anything. Sort it out later."
              rows={4}
              autoFocus
              // Ctrl/Cmd+Enter saves without reaching for the mouse. Plain
              // Enter has to stay as a newline: this is a textarea, and a
              // thought worth capturing is often more than one line.
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void quickCapture(e);
              }}
            />
            <div className="row-between" style={{ marginTop: 'var(--space-md)' }}>
              <span className="faint" style={{ fontSize: 11.5 }}>
                <span className="kbd">Ctrl</span> <span className="kbd">↵</span> to save
              </span>
              <button className="btn btn-sm" type="submit" disabled={capturing || !capture.trim()}>
                {capturing ? <span className="spinner" /> : 'Capture'}
              </button>
            </div>
          </form>

          <div className="card card-pad rise">
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Show
            </div>
            <div className="col" style={{ gap: 2 }}>
              {(
                [
                  ['all', 'Everything'],
                  ['inbox', 'Inbox'],
                  ['note', 'Notes'],
                  ['checklist', 'Checklists'],
                  ['journal', 'Journal'],
                ] as [View, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`nav-link${view === key ? ' active' : ''}`}
                  onClick={() => setView(key)}
                  style={{ background: view === key ? undefined : 'none', width: '100%' }}
                >
                  {label}
                  <span className="nav-badge">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LIST ---------------------------------------------------------- */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <input
            ref={searchRef}
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, bodies, tags and list items    /"
            type="search"
          />

          {loading && !data ? (
            <Spinner center />
          ) : visible.length === 0 ? (
            <div className="card">
              <Empty
                icon="notes"
                title={query ? 'Nothing matches' : view === 'inbox' ? 'Inbox is clear' : 'No notes yet'}
                message={
                  query
                    ? `Nothing found for "${query.trim()}".`
                    : view === 'inbox'
                      ? 'Captured notes land here until you give them a title or a tag.'
                      : 'Capture something on the left, or create a note with a title and tags.'
                }
              />
            </div>
          ) : (
            <div className="col" style={{ gap: 'var(--space-sm)' }}>
              {visible.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onOpen={() => setEditing(note)}
                  onDelete={() => void remove(note)}
                  onToggleItem={(i) => void toggleItem(note, i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <NoteDialog
          note={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </Shell>
  );
}

/* CARD --------------------------------------------------------------------- */

function NoteCard({
  note,
  onOpen,
  onDelete,
  onToggleItem,
}: {
  note: Note;
  onOpen: () => void;
  onDelete: () => void;
  onToggleItem: (index: number) => void;
}) {
  const items = readChecklistItems(note.checklist_items);
  const progress = checklistProgress(items);

  return (
    <div className="card card-pad card-hover">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <button
          onClick={onOpen}
          className="grow"
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            textAlign: 'left',
            minWidth: 0,
          }}
        >
          <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 4 }}>
            <span className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {NOTE_TYPE_LABEL[note.note_type]}
            </span>
            {note.is_inbox ? (
              <span
                className="pill"
                style={{
                  background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
                  color: 'var(--warning)',
                }}
              >
                Inbox
              </span>
            ) : null}
            {note.entry_date ? (
              <span className="faint" style={{ fontSize: 12 }}>
                {formatEventDate(note.entry_date)}
              </span>
            ) : null}
          </div>

          {note.title ? (
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{note.title}</div>
          ) : null}

          {note.body ? (
            <div
              className="secondary"
              style={{
                fontSize: 13,
                // Three lines then an ellipsis: enough to recognise a note,
                // not so much that ten of them fill the screen.
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                whiteSpace: 'pre-wrap',
              }}
            >
              {note.body}
            </div>
          ) : null}
        </button>

        <div className="row-actions">
          <button className="icon-btn" onClick={onOpen} aria-label="Edit">
            <Icon name="edit" />
          </button>
          <button className="icon-btn danger" onClick={onDelete} aria-label="Delete">
            <Icon name="trash" />
          </button>
        </div>
      </div>

      {note.note_type === 'checklist' && items.length > 0 ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 6 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: 'var(--border)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(progress.done / progress.total) * 100}%`,
                  height: '100%',
                  background: 'var(--success)',
                  transition: 'width var(--transition)',
                }}
              />
            </div>
            <span className="faint numeric" style={{ fontSize: 11.5 }}>
              {progress.done}/{progress.total}
            </span>
          </div>

          <div className="col" style={{ gap: 3 }}>
            {items.slice(0, 6).map((item, index) => (
              <label
                key={index}
                className="row"
                style={{ gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 13 }}
              >
                <button
                  className={`check${item.done ? ' on' : ''}`}
                  style={{ width: 15, height: 15, fontSize: 9 }}
                  onClick={() => onToggleItem(index)}
                  aria-label={item.done ? 'Untick' : 'Tick'}
                >
                  {item.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                </button>
                <span className={item.done ? 'strike' : ''}>{item.text}</span>
              </label>
            ))}
            {items.length > 6 ? (
              <span className="faint" style={{ fontSize: 12 }}>
                +{items.length - 6} more
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {note.tags.length > 0 ? (
        <div className="chip-row" style={{ marginTop: 'var(--space-md)' }}>
          {note.tags.map((tag) => (
            <span key={tag} className="pill" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* DIALOG ------------------------------------------------------------------- */

function NoteDialog({
  note,
  onClose,
  onSaved,
}: {
  note: Note | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [noteType, setNoteType] = useState<NoteType>(note?.note_type ?? 'note');
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? '');
  const [tagText, setTagText] = useState(note ? formatTags(note.tags) : '');
  const [entryDate, setEntryDate] = useState(note?.entry_date ?? todayISO());
  const [items, setItems] = useState<ChecklistItem[]>(readChecklistItems(note?.checklist_items));
  const [newItem, setNewItem] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setItems((current) => [...current, { text, done: false }]);
    setNewItem('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);

    const trimmedTitle = title.trim();
    const tags = parseTags(tagText);

    const input: NoteInput = {
      title: trimmedTitle,
      body: body.trim(),
      tags,
      note_type: noteType,
      // Computed here, at the save site, exactly as the app's edit screen does.
      // createNote and updateNote store whatever they are given - so hardcoding
      // false meant a note whose title and tags you had just cleared stayed
      // filed instead of returning to the inbox, and a note created through
      // this dialog with neither never reached it at all.
      is_inbox: belongsInInbox({ title: trimmedTitle, tags, note_type: noteType }),
      // A journal entry is ABOUT a day; nothing else has one.
      entry_date: noteType === 'journal' ? entryDate : null,
      checklist_items: noteType === 'checklist' ? items : null,
    };

    try {
      if (note) await api.updateNote(note.id, input);
      else await api.createNote(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that note');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={note ? 'Edit note' : 'New note'}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : note ? 'Save' : 'Create'}
          </button>
        </>
      }
    >
      <Segmented
        value={noteType}
        onChange={setNoteType}
        options={[
          { value: 'note', label: 'Note' },
          { value: 'checklist', label: 'Checklist' },
          { value: 'journal', label: 'Journal' },
        ]}
      />

      {noteType === 'journal' ? (
        <div className="field">
          <span className="label">Entry date</span>
          <input
            className="input"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
          <span className="faint" style={{ fontSize: 12 }}>
            Backdate freely. The entry is filed under the day it is about, not the day you wrote it.
          </span>
        </div>
      ) : null}

      <TextField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={noteType === 'note' ? 'Optional — a note with no title stays in the inbox' : 'Optional'}
        autoFocus
      />

      {noteType === 'checklist' ? (
        <div className="field">
          <span className="label">Items</span>

          <div className="col" style={{ gap: 6, marginBottom: 'var(--space-sm)' }}>
            {items.map((item, index) => (
              <div className="row" key={index} style={{ gap: 'var(--space-sm)' }}>
                <button
                  className={`check${item.done ? ' on' : ''}`}
                  onClick={() =>
                    setItems((current) =>
                      current.map((it, i) => (i === index ? { ...it, done: !it.done } : it)),
                    )
                  }
                  aria-label={item.done ? 'Untick' : 'Tick'}
                >
                  {item.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                </button>
                <input
                  className="input grow"
                  value={item.text}
                  onChange={(e) =>
                    setItems((current) =>
                      current.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)),
                    )
                  }
                />
                <button
                  className="icon-btn danger"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  aria-label="Remove item"
                >
                  <Icon name="close" />
                </button>
              </div>
            ))}
          </div>

          <div className="row" style={{ gap: 'var(--space-sm)' }}>
            <input
              className="input grow"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add an item"
              // Enter adds and keeps focus, so a list is typed in one go.
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <button className="btn btn-secondary" onClick={addItem} disabled={!newItem.trim()}>
              Add
            </button>
          </div>

          {items.some((i) => i.done) ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: 'flex-start', marginTop: 'var(--space-sm)' }}
              // Manual, never automatic. A recurring list is reused, and
              // deciding when it starts again is the user's call.
              onClick={() => setItems((current) => current.map((i) => ({ ...i, done: false })))}
            >
              <Icon name="reset" size={13} /> Uncheck all
            </button>
          ) : null}
        </div>
      ) : (
        <TextArea
          label="Body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write it down"
          rows={noteType === 'journal' ? 10 : 6}
        />
      )}

      <TextField
        label="Tags"
        value={tagText}
        onChange={(e) => setTagText(e.target.value)}
        placeholder="comma, separated"
        hint="A note with a title or a tag leaves the inbox."
      />

      <ErrorBanner message={error} />
    </Modal>
  );
}
