/**
 * NotesPage - capture on the left, everything you have on the right.
 *
 * The phone puts quick capture behind a button because there is no room for a
 * permanent box. Here it is always on screen and always focused, which is the
 * whole point of quick capture: the gap between having a thought and it being
 * saved should be one keystroke, not a tap, a screen transition and a tap.
 *
 * v3 brings the phone's rules, from the app's own Notes module so they cannot
 * drift: one load of every LIVE note (a trashed or archived note is never
 * counted, listed or searched outside its own shelf), Move to Trash with Undo
 * instead of a delete you cannot take back, pins, colours, Markdown read mode
 * with boxes that tick and save at once, and the journal's streak, On this day
 * and prompt. A pointer replaces the phone's long-press: each card carries its
 * own Pin, Colour, Archive and Trash buttons.
 */
import { useCallback, useMemo, useState, type FormEvent } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/notes/api';
import {
  filterNotes,
  isTrashed,
  matchesFilter,
  purgeLabel,
  splitPinned,
  tagCounts,
  viewNotes,
} from '@app/modules/notes/library';
import { stripMarkdown, taskProgress, toggleTask } from '@app/modules/notes/markdown';
import {
  NOTE_COLORS,
  noteTint,
  readNoteColor,
  type NoteColorKey,
} from '@app/modules/notes/noteColors';
import {
  belongsInInbox,
  checklistProgress,
  deleteTicked,
  formatTags,
  parseTags,
  partitionChecklist,
  readChecklistItems,
  toggleItem,
  uncheckAll,
  NOTE_TYPE_LABEL,
  type ChecklistItem,
  type Note,
  type NoteInput,
  type NoteType,
} from '@app/modules/notes/types';

import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
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
import { ColorChoices } from './notes/ColorChoices';
import { JournalStrip } from './notes/JournalStrip';
import { MarkdownTextarea } from './notes/MarkdownTextarea';
import { NoteMarkdown } from './notes/NoteMarkdown';

type View = 'all' | 'inbox' | 'note' | 'checklist' | 'journal' | 'archive' | 'trash';
type AgeFilter = 'any' | 'week' | 'month' | 'year';
type Editing = { note: Note | null; prompt?: string; type?: NoteType };

const nowISO = () => new Date().toISOString();

export function NotesPage() {
  const toast = useToast();
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('any');
  const [color, setColor] = useState<'any' | NoteColorKey>('any');
  const [age, setAge] = useState<AgeFilter>('any');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [colouring, setColouring] = useState<Note | null>(null);
  const [capture, setCapture] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  // '/' finds the FilterBar's search box on its own.
  useHotkeys({ onNew: () => setEditing({ note: null }) });

  /**
   * Every live note, after clearing out anything that has sat in the Trash
   * past its 30 days. Purging on read needs no scheduler, and loses nothing a
   * schedule would have kept.
   */
  const load = useCallback(async () => {
    await api.purgeExpiredTrash().catch(() => {});
    return api.listLive();
  }, []);
  const { data, loading, error, reload, set } = useAsync(load, 'notes-live');
  const notes = useMemo(() => data ?? [], [data]);

  // The shelves load only when opened, and their counts for the side list.
  const shelfData = useAsync(
    () =>
      view === 'trash'
        ? api.listTrash()
        : view === 'archive'
          ? api.listArchive()
          : Promise.resolve([] as Note[]),
    `notes-shelf-${view}`,
  );
  const countsData = useAsync(api.shelfCounts, 'notes-shelf-counts');
  const shelf = shelfData.data;
  const shelfCounts = useMemo(
    () => countsData.data ?? { trash: 0, archive: 0 },
    [countsData.data],
  );
  const reloadShelf = shelfData.reload;
  const reloadCounts = countsData.reload;
  const refreshShelves = useCallback(async () => {
    await Promise.all([reloadShelf(), reloadCounts()]);
  }, [reloadShelf, reloadCounts]);

  const refresh = useCallback(async () => {
    await Promise.all([reload(), refreshShelves()]);
  }, [reload, refreshShelves]);

  const counts = useMemo(
    () => ({
      all: notes.length,
      inbox: viewNotes(notes, 'inbox').length,
      note: notes.filter((n) => n.note_type === 'note').length,
      checklist: viewNotes(notes, 'checklist').length,
      journal: viewNotes(notes, 'journal').length,
      archive: shelfCounts.archive,
      trash: shelfCounts.trash,
    }),
    [notes, shelfCounts],
  );

  const tags = useMemo(() => tagCounts(notes), [notes]);

  /** The clock, read once per mount, so the filters stay pure functions. */
  const [now] = useState(() => Date.now());
  const today = todayISO();

  const onShelf = view === 'archive' || view === 'trash';

  const visible = useMemo(() => {
    const filter = {
      query,
      tag: tag === 'any' ? null : tag,
      color: color === 'any' ? null : color,
    };
    let list: Note[];
    if (onShelf) list = (shelf ?? []).filter((n) => matchesFilter(n, filter));
    else {
      const base =
        view === 'all'
          ? [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          : view === 'note'
            ? viewNotes(notes, 'notes').filter((n) => n.note_type === 'note')
            : viewNotes(notes, view);
      list = filterNotes(base, filter);
    }
    if (age === 'any') return list;
    const limit = age === 'week' ? 7 : age === 'month' ? 31 : 365;
    // Measured against updated_at: "touched recently" is what you look for
    // when you cannot remember a note's name.
    return list.filter((n) => (now - new Date(n.updated_at).getTime()) / 86400000 <= limit);
  }, [notes, shelf, view, onShelf, query, tag, color, age, now]);

  const grouped = useMemo(
    () => (onShelf || view === 'journal' ? null : splitPinned(visible)),
    [visible, onShelf, view],
  );

  // ACTIONS ----------------------------------------------------------------

  /** Apply a change to one live note locally, then to the database; undo the local change if it fails. */
  const patchLocal = (id: string, patch: Partial<Note>) =>
    set((list) => list.map((n) => (n.id === id ? { ...n, ...patch } : n)));

  const fail = (e: unknown, fallback: string) =>
    setActionError(e instanceof Error ? e.message : fallback);

  const quickCapture = async (event: FormEvent) => {
    event.preventDefault();
    const body = capture.trim();
    if (!body) return;
    setCapturing(true);
    setActionError(null);
    try {
      // No title and no tags, which by the belongsInInbox rule is exactly
      // what the inbox means.
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
      fail(e, 'Could not save that');
    } finally {
      setCapturing(false);
    }
  };

  const moveToTrash = async (note: Note) => {
    setActionError(null);
    set((list) => list.filter((n) => n.id !== note.id));
    try {
      await api.trashNotes([note.id], nowISO());
      void refreshShelves();
      toast.show({
        message: 'Moved to Trash',
        actionLabel: 'Undo',
        onAction: () =>
          void api
            .restoreNotes([note.id])
            .then(refresh)
            .catch((e) => fail(e, 'Could not restore that')),
      });
    } catch (e) {
      fail(e, 'Could not move that to the Trash');
      void reload();
    }
  };

  const setArchived = async (note: Note, archived: boolean) => {
    setActionError(null);
    if (archived) set((list) => list.filter((n) => n.id !== note.id));
    try {
      await api.setArchived([note.id], archived ? nowISO() : null);
      await refresh();
      toast.show({
        message: archived ? 'Archived' : 'Back in your notes',
        actionLabel: 'Undo',
        onAction: () =>
          void api
            .setArchived([note.id], archived ? null : (note.archived_at ?? nowISO()))
            .then(refresh)
            .catch((e) => fail(e, 'Could not undo that')),
      });
    } catch (e) {
      fail(e, 'Could not change that');
      void reload();
    }
  };

  const togglePin = async (note: Note) => {
    const pinned_at = note.pinned_at ? null : nowISO();
    patchLocal(note.id, { pinned_at });
    try {
      await api.setPinned([note.id], pinned_at);
    } catch (e) {
      patchLocal(note.id, { pinned_at: note.pinned_at });
      fail(e, 'Could not pin that');
    }
  };

  const applyColor = async (note: Note, next: NoteColorKey | null) => {
    setColouring(null);
    patchLocal(note.id, { color: next });
    try {
      await api.setColor([note.id], next);
    } catch (e) {
      patchLocal(note.id, { color: note.color });
      fail(e, 'Could not change the colour');
    }
  };

  /** Tick a box in a note's Markdown body; saved at once. */
  const tickTask = async (note: Note, line: number) => {
    const body = toggleTask(note.body, line);
    patchLocal(note.id, { body });
    try {
      await api.setBody(note.id, body);
    } catch (e) {
      patchLocal(note.id, { body: note.body });
      fail(e, 'Could not save that tick');
    }
  };

  /** Change a checklist's items; saved at once. */
  const setItems = async (note: Note, items: ChecklistItem[]) => {
    patchLocal(note.id, { checklist_items: items });
    try {
      await api.setChecklistItems(note.id, items);
    } catch (e) {
      patchLocal(note.id, { checklist_items: note.checklist_items });
      fail(e, 'Could not update that list');
    }
  };

  // Trash shelf actions. These are the permanent ones, so they confirm.
  const restore = async (note: Note) => {
    try {
      await api.restoreNotes([note.id]);
      await refresh();
      toast.show({ message: note.archived_at ? 'Restored to the Archive' : 'Restored' });
    } catch (e) {
      fail(e, 'Could not restore that');
    }
  };

  const deleteForever = async (note: Note) => {
    const label = note.title || stripMarkdown(note.body).slice(0, 40) || 'This note';
    if (
      !(await confirm('Delete forever', `${label} will be gone for good. This cannot be undone.`))
    )
      return;
    try {
      await api.deleteForever([note.id]);
      await refreshShelves();
    } catch (e) {
      fail(e, 'Could not delete that');
    }
  };

  const emptyTrash = async () => {
    const n = shelfCounts.trash;
    if (
      !(await confirm(
        'Empty the Trash',
        `${n} ${n === 1 ? 'note is' : 'notes are'} deleted for good. This cannot be undone.`,
      ))
    )
      return;
    try {
      await api.emptyTrash();
      await refreshShelves();
    } catch (e) {
      fail(e, 'Could not empty the Trash');
    }
  };

  const filtersActive = query.trim() !== '' || tag !== 'any' || color !== 'any' || age !== 'any';

  const filters: FilterSpec[] = [
    {
      key: 'tag',
      label: 'Tag',
      value: tag,
      onChange: setTag,
      options: [
        { value: 'any', label: tags.length > 0 ? 'Any tag' : 'No tags yet' },
        ...tags.map((t) => ({ value: t.tag, label: `#${t.tag} (${t.count})` })),
      ],
    },
    {
      key: 'color',
      label: 'Colour',
      value: color,
      onChange: (v) => setColor(v as 'any' | NoteColorKey),
      options: [
        { value: 'any', label: 'Any colour' },
        ...NOTE_COLORS.map((c) => ({ value: c.key, label: c.label })),
      ],
    },
    {
      key: 'age',
      label: 'Updated',
      value: age,
      onChange: (v) => setAge(v as AgeFilter),
      options: [
        { value: 'any', label: 'Any time' },
        { value: 'week', label: 'Past week' },
        { value: 'month', label: 'Past month' },
        { value: 'year', label: 'Past year' },
      ],
    },
  ];

  const VIEWS: [View, string][] = [
    ['all', 'Everything'],
    ['inbox', 'Inbox'],
    ['note', 'Notes'],
    ['checklist', 'Checklists'],
    ['journal', 'Journal'],
    ['archive', 'Archive'],
    ['trash', 'Trash'],
  ];

  const renderCard = (note: Note) => (
    <NoteCard
      key={note.id}
      note={note}
      onShelf={onShelf ? view : null}
      today={now}
      onOpen={() => setEditing({ note })}
      onPin={() => void togglePin(note)}
      onColour={() => setColouring(note)}
      onArchive={() => void setArchived(note, !note.archived_at)}
      onTrash={() => void moveToTrash(note)}
      onRestore={() => void restore(note)}
      onDeleteForever={() => void deleteForever(note)}
      onToggleItem={(i) =>
        void setItems(note, toggleItem(readChecklistItems(note.checklist_items), i))
      }
    />
  );

  return (
    <Shell
      title="Notes"
      subtitle={loading ? 'Loading' : `${counts.all} total · ${counts.inbox} to file`}
      actions={
        <button className="btn" onClick={() => setEditing({ note: null })}>
          <Icon name="plus" /> New note
        </button>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      <div className="split-wide split">
        {/* CAPTURE + VIEWS ------------------------------------------------- */}
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
              // Ctrl/Cmd+Enter saves; plain Enter stays a newline.
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
              {VIEWS.map(([key, label]) => (
                <button
                  key={key}
                  className={`nav-link${view === key ? ' active' : ''}`}
                  onClick={() => setView(key)}
                  aria-current={view === key ? 'page' : undefined}
                  style={{ background: view === key ? undefined : 'none', width: '100%' }}
                >
                  {key === 'archive' ? <Icon name="archive" size={14} /> : null}
                  {key === 'trash' ? <Icon name="trash" size={14} /> : null}
                  {label}
                  <span className="nav-badge">{counts[key]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LIST ------------------------------------------------------------ */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          {view === 'journal' ? (
            <JournalStrip
              entries={viewNotes(notes, 'journal')}
              today={today}
              onOpen={(note) => setEditing({ note })}
              onAnswer={(prompt) => setEditing({ note: null, prompt, type: 'journal' })}
            />
          ) : null}

          {view === 'trash' ? (
            <div className="card card-pad row-between">
              <span className="secondary" style={{ fontSize: 13 }}>
                Notes in the Trash are deleted for good after 30 days.
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => void emptyTrash()}
                disabled={shelfCounts.trash === 0}
              >
                Empty trash
              </button>
            </div>
          ) : null}

          <FilterBar
            search={{
              value: query,
              onChange: setQuery,
              placeholder: 'Search titles, bodies, tags and items',
            }}
            filters={filters}
            onReset={
              filtersActive
                ? () => {
                    setQuery('');
                    setTag('any');
                    setColor('any');
                    setAge('any');
                  }
                : undefined
            }
          />

          {(loading && !data) || (onShelf && shelfData.loading) ? (
            <Spinner center />
          ) : visible.length === 0 ? (
            <div className="card">
              <Empty
                icon={view === 'trash' ? 'trash' : view === 'archive' ? 'archive' : 'notes'}
                title={
                  filtersActive
                    ? 'Nothing matches'
                    : view === 'inbox'
                      ? 'Inbox is clear'
                      : view === 'trash'
                        ? 'The Trash is empty'
                        : view === 'archive'
                          ? 'Nothing archived'
                          : 'No notes yet'
                }
                message={
                  filtersActive
                    ? 'Try a different search or clear the filters.'
                    : view === 'inbox'
                      ? 'Captured notes land here until you give them a title or a tag.'
                      : view === 'trash'
                        ? 'Notes you move to the Trash wait here for 30 days.'
                        : view === 'archive'
                          ? 'Archive notes you are done with but want to keep.'
                          : 'Capture something on the left, or create a note with a title and tags.'
                }
              />
            </div>
          ) : grouped && grouped.pinned.length > 0 ? (
            <>
              <div className="overline">Pinned</div>
              <div className="col" style={{ gap: 'var(--space-sm)' }}>
                {grouped.pinned.map(renderCard)}
              </div>
              {grouped.others.length > 0 ? <div className="overline">Others</div> : null}
              <div className="col" style={{ gap: 'var(--space-sm)' }}>
                {grouped.others.map(renderCard)}
              </div>
            </>
          ) : (
            <div className="col" style={{ gap: 'var(--space-sm)' }}>
              {visible.map(renderCard)}
            </div>
          )}
        </div>
      </div>

      {editing ? (
        <NoteDialog
          key={editing.note?.id ?? 'new'}
          note={
            editing.note ? (notes.find((n) => n.id === editing.note!.id) ?? editing.note) : null
          }
          prompt={editing.prompt}
          initialType={editing.type}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
          onTickTask={(note, line) => void tickTask(note, line)}
          onItems={(note, items) => void setItems(note, items)}
          onPin={(note) => void togglePin(note)}
          onArchive={(note) => {
            // Close first: a toast under an open dialog would hide its Undo.
            setEditing(null);
            void setArchived(note, !note.archived_at);
          }}
          onTrash={(note) => {
            setEditing(null);
            void moveToTrash(note);
          }}
          onRestore={(note) => {
            setEditing(null);
            void restore(note);
          }}
        />
      ) : null}

      {colouring ? (
        <Modal open title="Colour" onClose={() => setColouring(null)} width={420}>
          <ColorChoices
            value={readNoteColor(colouring.color)?.key ?? null}
            onPick={(next) => void applyColor(colouring, next)}
          />
        </Modal>
      ) : null}

      {dialog}
    </Shell>
  );
}

/* CARD --------------------------------------------------------------------- */

function NoteCard({
  note,
  onShelf,
  today,
  onOpen,
  onPin,
  onColour,
  onArchive,
  onTrash,
  onRestore,
  onDeleteForever,
  onToggleItem,
}: {
  note: Note;
  onShelf: View | null;
  today: number;
  onOpen: () => void;
  onPin: () => void;
  onColour: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onDeleteForever: () => void;
  onToggleItem: (index: number) => void;
}) {
  const items = readChecklistItems(note.checklist_items);
  const progress =
    note.note_type === 'checklist' ? checklistProgress(items) : taskProgress(note.body);
  const colour = readNoteColor(note.color);
  const preview = stripMarkdown(note.body);
  const inTrash = onShelf === 'trash' || isTrashed(note);

  return (
    <div
      className="card card-pad card-hover note-card"
      style={
        colour
          ? {
              background: `linear-gradient(${noteTint(colour.swatch)}, ${noteTint(colour.swatch)}), var(--surface)`,
              borderLeftColor: colour.swatch,
            }
          : undefined
      }
    >
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <button
          onClick={onOpen}
          className="grow note-card-open"
          aria-label={`Open ${note.title || 'note'}`}
        >
          <div
            className="row"
            style={{ gap: 'var(--space-sm)', marginBottom: 4, flexWrap: 'wrap' }}
          >
            {note.pinned_at ? (
              <span className="note-pin" title="Pinned">
                <Icon name="pin" size={12} /> Pinned
              </span>
            ) : null}
            <span
              className="pill"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              {NOTE_TYPE_LABEL[note.note_type]}
            </span>
            {colour ? (
              <span className="faint" style={{ fontSize: 12 }}>
                {colour.label}
              </span>
            ) : null}
            {note.is_inbox && !onShelf ? (
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
            {inTrash && note.deleted_at ? (
              <span className="faint" style={{ fontSize: 12 }}>
                {purgeLabel(note.deleted_at, new Date(today))}
              </span>
            ) : null}
          </div>

          {note.title ? (
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{note.title}</div>
          ) : null}

          {preview ? <div className="secondary note-card-preview">{preview}</div> : null}
        </button>

        <div className="row-actions">
          {inTrash ? (
            <>
              <button className="icon-btn" onClick={onRestore} aria-label="Restore" title="Restore">
                <Icon name="reset" />
              </button>
              <button
                className="icon-btn danger"
                onClick={onDeleteForever}
                aria-label="Delete forever"
                title="Delete forever"
              >
                <Icon name="trash" />
              </button>
            </>
          ) : (
            <>
              <button
                className="icon-btn"
                onClick={onPin}
                aria-label={note.pinned_at ? 'Unpin' : 'Pin'}
                aria-pressed={!!note.pinned_at}
                title={note.pinned_at ? 'Unpin' : 'Pin'}
              >
                <Icon name="pin" />
              </button>
              <button className="icon-btn" onClick={onColour} aria-label="Colour" title="Colour">
                <Icon name="palette" />
              </button>
              <button
                className="icon-btn"
                onClick={onArchive}
                aria-label={note.archived_at ? 'Unarchive' : 'Archive'}
                title={note.archived_at ? 'Unarchive' : 'Archive'}
              >
                <Icon name="archive" />
              </button>
              <button
                className="icon-btn danger"
                onClick={onTrash}
                aria-label="Move to Trash"
                title="Move to Trash"
              >
                <Icon name="trash" />
              </button>
            </>
          )}
        </div>
      </div>

      {progress.total > 0 ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 6 }}>
            <div
              className="note-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.done}
            >
              <div style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
            <span className="faint numeric" style={{ fontSize: 11.5 }}>
              {progress.done}/{progress.total}
            </span>
          </div>

          {note.note_type === 'checklist' && !onShelf ? (
            <div className="col" style={{ gap: 3 }}>
              {/* Open items first: the card answers "what is left". */}
              {partitionChecklist(items)
                .open.slice(0, 6)
                .map(({ item, index }) => (
                  <label
                    key={index}
                    className="row"
                    style={{ gap: 'var(--space-sm)', cursor: 'pointer', fontSize: 13 }}
                  >
                    <button
                      className="check"
                      style={{ width: 15, height: 15, fontSize: 9 }}
                      onClick={() => onToggleItem(index)}
                      aria-label={`Tick ${item.text}`}
                    />
                    <span>{item.text}</span>
                  </label>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {note.tags.length > 0 ? (
        <div className="chip-row" style={{ marginTop: 'var(--space-md)' }}>
          {note.tags.map((t) => (
            <span
              key={t}
              className="pill"
              style={{ background: 'var(--surface-2)', color: 'var(--text-secondary)' }}
            >
              #{t}
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
  prompt,
  initialType,
  onClose,
  onSaved,
  onTickTask,
  onItems,
  onPin,
  onArchive,
  onTrash,
  onRestore,
}: {
  note: Note | null;
  prompt?: string;
  initialType?: NoteType;
  onClose: () => void;
  onSaved: () => void;
  onTickTask: (note: Note, line: number) => void;
  onItems: (note: Note, items: ChecklistItem[]) => void;
  onPin: (note: Note) => void;
  onArchive: (note: Note) => void;
  onTrash: (note: Note) => void;
  onRestore: (note: Note) => void;
}) {
  /**
   * Read or edit. An existing note opens in read mode, where a tick is the
   * only change you can make and it saves at once; a new note opens in edit.
   * A note in the Trash is read-only, with Restore.
   */
  const trashed = note ? isTrashed(note) : false;
  const [mode, setMode] = useState<'read' | 'edit'>(note ? 'read' : 'edit');
  const [noteType, setNoteType] = useState<NoteType>(note?.note_type ?? initialType ?? 'note');
  const [title, setTitle] = useState(note?.title ?? '');
  const [body, setBody] = useState(note?.body ?? (prompt ? `> ${prompt}\n\n` : ''));
  const [tagText, setTagText] = useState(note ? formatTags(note.tags) : '');
  const [entryDate, setEntryDate] = useState(note?.entry_date ?? todayISO());
  const [items, setItems] = useState<ChecklistItem[]>(readChecklistItems(note?.checklist_items));
  const [newItem, setNewItem] = useState('');
  const [showTicked, setShowTicked] = useState(false);
  /** An inline Undo for list-wide changes made in read mode (a toast would sit under the dialog). */
  const [undo, setUndo] = useState<{ label: string; items: ChecklistItem[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read mode shows the live list, so ticks made here and elsewhere agree.
  const liveItems = note && mode === 'read' ? readChecklistItems(note.checklist_items) : items;
  const parts = partitionChecklist(liveItems);

  const changeItems = (label: string | null, next: ChecklistItem[]) => {
    if (!note) return;
    if (label) setUndo({ label, items: liveItems });
    onItems(note, next);
  };

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
      is_inbox: belongsInInbox({ title: trimmedTitle, tags, note_type: noteType }),
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

  const readFooter = note ? (
    trashed ? (
      <>
        <button className="btn btn-secondary" onClick={onClose}>
          Close
        </button>
        <button className="btn" onClick={() => onRestore(note)}>
          <Icon name="reset" size={14} /> Restore
        </button>
      </>
    ) : (
      <>
        <button
          className="btn btn-ghost"
          onClick={() => onPin(note)}
          aria-pressed={!!note.pinned_at}
        >
          <Icon name="pin" size={14} /> {note.pinned_at ? 'Unpin' : 'Pin'}
        </button>
        <button className="btn btn-ghost" onClick={() => onArchive(note)}>
          <Icon name="archive" size={14} /> {note.archived_at ? 'Unarchive' : 'Archive'}
        </button>
        <button className="btn btn-ghost" onClick={() => onTrash(note)}>
          <Icon name="trash" size={14} /> Move to Trash
        </button>
        <button
          className="btn"
          onClick={() => {
            setItems(readChecklistItems(note.checklist_items));
            setBody(note.body);
            setMode('edit');
          }}
        >
          <Icon name="edit" size={14} /> Edit
        </button>
      </>
    )
  ) : null;

  return (
    <Modal
      open
      title={
        note
          ? mode === 'read'
            ? note.title || NOTE_TYPE_LABEL[note.note_type]
            : 'Edit note'
          : 'New note'
      }
      onClose={onClose}
      width={640}
      footer={
        mode === 'read' ? (
          readFooter
        ) : (
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" onClick={() => void save()} disabled={saving}>
              {saving ? <span className="spinner" /> : note ? 'Save' : 'Create'}
            </button>
          </>
        )
      }
    >
      {mode === 'read' && note ? (
        <>
          {trashed ? (
            <p className="faint" style={{ fontSize: 12.5 }}>
              In the Trash. Restore it to change it.
            </p>
          ) : null}
          {note.note_type === 'journal' && note.entry_date ? (
            <div className="overline">{formatEventDate(note.entry_date)}</div>
          ) : null}

          {note.note_type === 'checklist' ? (
            liveItems.length === 0 ? (
              <p className="faint">This list has no items yet. Press Edit to add some.</p>
            ) : (
              <>
                <div className="col" style={{ gap: 2 }}>
                  {parts.open.map(({ item, index }) => (
                    <ItemRow
                      key={index}
                      item={item}
                      disabled={trashed}
                      onToggle={() => changeItems(null, toggleItem(liveItems, index))}
                    />
                  ))}
                </div>
                {parts.ticked.length > 0 ? (
                  <div className="col" style={{ gap: 2 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={() => setShowTicked((v) => !v)}
                      aria-expanded={showTicked}
                    >
                      <Icon name={showTicked ? 'chevronUp' : 'chevronDown'} size={13} />{' '}
                      {parts.ticked.length} ticked
                    </button>
                    {showTicked
                      ? parts.ticked.map(({ item, index }) => (
                          <ItemRow
                            key={index}
                            item={item}
                            disabled={trashed}
                            onToggle={() => changeItems(null, toggleItem(liveItems, index))}
                          />
                        ))
                      : null}
                    {!trashed ? (
                      <div className="row" style={{ gap: 'var(--space-sm)' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => changeItems('Unticked everything', uncheckAll(liveItems))}
                        >
                          <Icon name="reset" size={13} /> Uncheck all
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            changeItems('Deleted the ticked items', deleteTicked(liveItems))
                          }
                        >
                          <Icon name="trash" size={13} /> Delete ticked
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {undo ? (
                  <div className="note-undo" role="status">
                    <span>{undo.label}</span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        onItems(note, undo.items);
                        setUndo(null);
                      }}
                    >
                      Undo
                    </button>
                  </div>
                ) : null}
                <p className="faint" style={{ fontSize: 12 }}>
                  {checklistProgress(liveItems).done} of {liveItems.length} done · saved as you tick
                </p>
              </>
            )
          ) : note.body ? (
            <NoteMarkdown
              body={note.body}
              onToggleTask={trashed ? undefined : (line) => onTickTask(note, line)}
            />
          ) : (
            <p className="faint">This note is empty. Press Edit to write something.</p>
          )}

          {note.tags.length > 0 ? (
            <p className="faint" style={{ fontSize: 12.5 }}>
              {note.tags.map((t) => `#${t}`).join(' ')}
            </p>
          ) : null}
        </>
      ) : (
        <>
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
                Backdate freely. The entry is filed under the day it is about, not the day you wrote
                it.
              </span>
            </div>
          ) : null}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              noteType === 'note'
                ? 'Optional — a note with no title stays in the inbox'
                : 'Optional'
            }
            autoFocus={!prompt}
          />

          {noteType === 'checklist' ? (
            <div className="field">
              <span className="label">Items</span>
              <div className="col" style={{ gap: 6, marginBottom: 'var(--space-sm)' }}>
                {items.map((item, index) => (
                  <div className="row" key={index} style={{ gap: 'var(--space-sm)' }}>
                    <button
                      className={`check${item.done ? ' on' : ''}`}
                      onClick={() => setItems((current) => toggleItem(current, index))}
                      aria-label={item.done ? `Untick ${item.text}` : `Tick ${item.text}`}
                    >
                      {item.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                    </button>
                    <input
                      className="input grow"
                      value={item.text}
                      aria-label={`Item ${index + 1}`}
                      onChange={(e) =>
                        setItems((current) =>
                          current.map((it, i) =>
                            i === index ? { ...it, text: e.target.value } : it,
                          ),
                        )
                      }
                    />
                    <button
                      className="icon-btn danger"
                      onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                      aria-label={`Remove ${item.text}`}
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
                  aria-label="New item"
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
                  // Here in edit mode it is part of the draft: Cancel undoes it.
                  onClick={() => setItems(uncheckAll)}
                >
                  <Icon name="reset" size={13} /> Uncheck all
                </button>
              ) : null}
            </div>
          ) : (
            <MarkdownTextarea
              label="Body"
              value={body}
              onChange={setBody}
              placeholder="Write it down. - [ ] makes a box you can tick."
              rows={noteType === 'journal' ? 12 : 8}
              autoFocus={!!prompt}
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
        </>
      )}
    </Modal>
  );
}

function ItemRow({
  item,
  disabled,
  onToggle,
}: {
  item: ChecklistItem;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="list-row"
      style={{ width: '100%', textAlign: 'left', padding: '9px 10px' }}
      onClick={onToggle}
      disabled={disabled}
      role="checkbox"
      aria-checked={item.done}
    >
      <span className={`check${item.done ? ' on' : ''}`}>
        {item.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
      </span>
      {/* No strikethrough: the group already says these are done, and struck text is harder to read. */}
      <span className={`grow${item.done ? ' secondary' : ''}`} style={{ fontSize: 13 }}>
        {item.text}
      </span>
    </button>
  );
}
