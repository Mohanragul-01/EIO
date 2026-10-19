/**
 * SessionView - logging a session, set by set, at a desk.
 *
 * The phone's session screen laid out for a wide window: the exercises on the
 * left, and beside them the library to add from and the session's notes, so
 * nothing is a sheet away. The loop is the same - look at last time, lift,
 * tick - and so are the rules, which all come from the app (useSessionLog).
 *
 * Save as you go: every tick is written at once. Finish is optional and only
 * stamps the end time, then shows the summary.
 */
import { useEffect, useMemo, useState } from 'react';

import { formatEventDate } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { supersetLabels, supersetNext } from '@app/modules/fitness/blocks';
import { MODE_LABEL, visibleInMode } from '@app/modules/fitness/mode';
import { groupItems } from '@app/modules/fitness/pickerItems';
import { setLabels } from '@app/modules/fitness/load';
import { DEFAULT_INVENTORY, warmupSets } from '@app/modules/fitness/plates';
import { primaryRecord } from '@app/modules/fitness/records';
import type { BlockState } from '@app/modules/fitness/sessionState';
import { formatDuration, normaliseMuscle } from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Empty, ErrorBanner, Spinner, useConfirm } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { ExercisePicker } from './ExercisePicker';
import { MODE_COLOR, MODE_ICON, plural, recordValue, SET_TYPES, volumeText } from './format';
import type { MenuItem } from './Menu';
import type { FitnessNav } from './nav';
import { LoadDialog, PinnedNoteDialog, SetMenuDialog } from './SessionDialogs';
import { ExerciseBlockCard, type TickOutcome } from './SetTable';
import { rowType, useSessionLog, type SessionLog } from './useSessionLog';

type RowTarget = { blockId: string; key: string };

export function SessionView({ sessionId, nav }: { sessionId: string; nav: FitnessNav }) {
  const w = useSessionLog(sessionId);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [setMenu, setSetMenu] = useState<RowTarget | null>(null);
  const [loadFor, setLoadFor] = useState<RowTarget | null>(null);
  const [supersetFor, setSupersetFor] = useState<string | null>(null);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);
  const [pinnedFor, setPinnedFor] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [notesSeededFor, setNotesSeededFor] = useState<string | null>(null);

  // Seed the notes once per session, during render: an effect would paint an
  // empty field first and then fill it.
  if (w.session && notesSeededFor !== w.session.id) {
    setNotesSeededFor(w.session.id);
    setNotes(w.session.notes);
  }

  const routineId = w.session?.routine_id ?? null;
  const routines = useAsync(
    () => (routineId ? api.listRoutines() : Promise.resolve([])),
    `routine-name-${routineId ?? 'none'}`,
  );
  const routineName = routines.data?.find((r) => r.id === routineId)?.name ?? null;

  const bandsById = useMemo(() => Object.fromEntries(w.bands.map((b) => [b.id, b])), [w.bands]);
  const tags = supersetLabels(
    w.blocks.map((b) => ({ id: b.id, supersetGroup: b.sessionExercise?.superset_group ?? null })),
  );

  if (w.loading) return <Spinner center />;

  if (w.missing || !w.session) {
    return (
      <div className="card">
        <Empty
          icon="fitness"
          title="This workout no longer exists"
          message={w.error ?? 'It may have been deleted on your phone.'}
          action={
            <button type="button" className="btn btn-secondary" onClick={nav.back}>
              Back
            </button>
          }
        />
      </div>
    );
  }

  const session = w.session;
  const nameOf = (exerciseId: string) => w.exercisesById[exerciseId]?.name ?? 'Exercise';

  const onTick = async (
    blockId: string,
    key: string,
    viaKeyboard: boolean,
  ): Promise<TickOutcome> => {
    const before = w.blocks;
    const result = await w.tick(blockId, key);
    if (!result.ok) {
      if (result.reason) toast.show({ message: result.reason });
      return null;
    }
    const record = primaryRecord(result.records);
    if (record) {
      toast.show({
        message: `New record · ${record.label} · ${recordValue(record)} · ${nameOf(result.exerciseId)}`,
      });
    }
    // In a superset you alternate, so the next set to do is the partner's.
    const flow = supersetNext(
      before.map((b) => ({
        id: b.id,
        supersetGroup: b.sessionExercise?.superset_group ?? null,
        rows: b.rows.map((r) => ({
          done: r.kind === 'saved' || (b.id === blockId && r.key === key),
        })),
      })),
      blockId,
      0,
    );
    if (flow.nextBlockId && flow.nextBlockId !== blockId && flow.nextRowIndex !== null) {
      const nextKey = before.find((b) => b.id === flow.nextBlockId)?.rows[flow.nextRowIndex]?.key;
      const row = nextKey
        ? document.querySelector<HTMLElement>(`tr[data-key="${CSS.escape(nextKey)}"]`)
        : null;
      if (row) {
        if (viaKeyboard) {
          row.querySelector<HTMLElement>('[data-field="weight"], [data-field="value"]')?.focus();
        } else {
          row.scrollIntoView({ block: 'nearest' });
        }
        return 'moved';
      }
    }
    return 'saved';
  };

  const removeRow = (blockId: string, key: string) => {
    const undo = w.removeRow(blockId, key);
    if (undo) toast.show({ message: 'Set removed', actionLabel: 'Undo', onAction: undo });
  };

  /** A block's working weight: the first working row's typed, saved or ghost weight. */
  const workingWeight = (block: BlockState): number | null => {
    const index = block.rows.findIndex((r) => rowType(r) !== 'warmup');
    if (index < 0) return null;
    const row = block.rows[index];
    const typed =
      row.kind === 'saved' ? row.set.weight_kg : Number(row.draft.weight.replace(',', '.')) || null;
    const value = typed || w.ghostFor(block, index).weight;
    return value && value > 0 ? value : null;
  };

  const removeExercise = async (block: BlockState) => {
    const saved = block.rows.filter((r) => r.kind === 'saved').length;
    if (saved > 0) {
      const ok = await confirm(
        `Remove ${nameOf(block.exerciseId)}?`,
        `Deletes the ${plural(saved, 'set')} logged for it in this workout. This cannot be undone.`,
        'Remove',
      );
      if (!ok) return;
    }
    void w.removeExercise(block.id);
  };

  const blockMenu = (block: BlockState, index: number): MenuItem[] => {
    const exercise = w.exercisesById[block.exerciseId];
    const group = block.sessionExercise?.superset_group ?? null;
    const logged = block.rows.some((r) => r.kind === 'saved');
    return [
      {
        key: 'up',
        label: 'Move up',
        icon: 'arrowUp',
        disabled: index === 0,
        onSelect: () => void w.moveExercise(block.id, -1),
      },
      {
        key: 'down',
        label: 'Move down',
        icon: 'arrowDown',
        disabled: index === w.blocks.length - 1,
        onSelect: () => void w.moveExercise(block.id, 1),
      },
      {
        key: 'superset',
        label: group ? `Take out of superset ${group}` : 'Superset with…',
        icon: 'link',
        disabled: !group && w.blocks.length < 2,
        onSelect: () => (group ? void w.setSuperset(block.id, null) : setSupersetFor(block.id)),
      },
      {
        key: 'replace',
        label: logged ? 'Replace (only before logging)' : 'Replace exercise',
        icon: 'swap',
        disabled: logged,
        onSelect: () => setReplaceFor(block.id),
      },
      {
        key: 'warmup',
        label: 'Add warm-up sets',
        detail:
          exercise?.load_mode === 'external'
            ? '40, 60 and 80% on standard plates'
            : 'One warm-up row at the top',
        icon: 'plus',
        onSelect: () => {
          const work = workingWeight(block);
          const sets =
            exercise?.load_mode === 'external' && work ? warmupSets(work, DEFAULT_INVENTORY) : [];
          if (sets.length === 0) {
            w.addRow(block.id, 'warmup', 0);
            return;
          }
          sets.forEach((set, i) =>
            w.addRow(block.id, 'warmup', i, { weight: String(set.kg), reps: String(set.reps) }),
          );
        },
      },
      {
        key: 'pinned',
        label: exercise?.pinned_note ? 'Edit pinned note' : 'Add a pinned note',
        icon: 'pin',
        onSelect: () => setPinnedFor(block.exerciseId),
      },
      {
        key: 'history',
        label: 'History and records',
        icon: 'trend',
        onSelect: () => nav.exercise(block.exerciseId),
      },
      { kind: 'separator', key: 'sep' },
      {
        key: 'remove',
        label: 'Remove exercise',
        icon: 'trash',
        danger: true,
        onSelect: () => void removeExercise(block),
      },
    ];
  };

  const deleteWorkout = async () => {
    const ok = await confirm(
      'Delete this workout',
      'Every set in it is deleted too. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteSession(sessionId);
      toast.show({ message: `Workout on ${formatEventDate(session.date)} deleted` });
      nav.back();
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that workout' });
    }
  };

  const finish = async () => {
    if (session.ended_at) {
      nav.summary(sessionId);
      return;
    }
    if (await w.finish()) nav.summary(sessionId);
  };

  // SHEET TARGETS -----------------------------------------------------------------

  const menuBlock = w.blocks.find((b) => b.id === setMenu?.blockId);
  const menuIndex = menuBlock?.rows.findIndex((r) => r.key === setMenu?.key) ?? -1;
  const menuRow = menuBlock?.rows[menuIndex];
  const menuValues = menuRow ? (menuRow.kind === 'saved' ? menuRow.set : menuRow.draft) : null;
  // "Set 2", or "Warm-up set" for a lettered row, as the SET column reads.
  const menuLabel = menuBlock
    ? setLabels(menuBlock.rows.map((r) => ({ set_type: rowType(r) })))[menuIndex]
    : '';
  const menuTitle = /^[0-9]+$/.test(menuLabel ?? '')
    ? `Set ${menuLabel}`
    : `${SET_TYPES.find((t) => t.letter === menuLabel)?.title ?? 'This'} set`;

  const loadBlock = w.blocks.find((b) => b.id === loadFor?.blockId);
  const loadRow = loadBlock?.rows.find((r) => r.key === loadFor?.key);
  const loadDraft = loadRow && loadRow.kind === 'draft' ? loadRow.draft : null;

  return (
    <div className="fx-session">
      <header className="card fx-session-head">
        <button type="button" className="icon-btn" onClick={nav.back} aria-label="Back">
          <Icon name="chevronLeft" />
        </button>
        <div className="fx-session-title">
          <h2 className="fx-h2">
            {routineName ?? 'Workout'}
            <span className="muted"> · {formatEventDate(session.date)}</span>
          </h2>
          <span className="fx-row-sub">
            <span style={{ color: MODE_COLOR[session.mode] }}>
              <Icon name={MODE_ICON[session.mode]} size={12} style={{ display: 'inline' }} />
            </span>{' '}
            {MODE_LABEL[session.mode]}
            {session.bodyweight_kg ? ` · bodyweight ${session.bodyweight_kg} kg` : ''}
            {session.ended_at ? ' · Finished' : ''}
          </span>
        </div>
        <label className="field fx-date">
          <span className="label">Date</span>
          <input
            className="input"
            type="date"
            value={session.date}
            onChange={(e) => {
              if (e.target.value) void w.setDate(e.target.value);
            }}
          />
        </label>
        <LiveStats
          startedAt={w.stats.startedAt}
          endedAt={w.stats.endedAt}
          volume={w.stats.volume}
          sets={w.stats.workingSets}
        />
        <button type="button" className="btn" onClick={() => void finish()}>
          {session.ended_at ? 'Summary' : 'Finish'}
        </button>
        <button
          type="button"
          className="icon-btn danger"
          onClick={() => void deleteWorkout()}
          aria-label="Delete this workout"
          title="Delete this workout"
        >
          <Icon name="trash" />
        </button>
      </header>

      {w.error ? (
        <div className="row fx-error-row">
          <ErrorBanner message={w.error} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={w.clearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="split fx-session-split">
        <div className="col fx-stack">
          {w.blocks.length === 0 ? (
            <div className="card">
              <Empty
                icon="plus"
                title="No exercises yet"
                message="Add one from the list beside this to start logging."
              />
            </div>
          ) : null}

          {w.blocks.map((block, index) => (
            <ExerciseBlockCard
              key={block.id}
              block={block}
              exercise={w.exercisesById[block.exerciseId]}
              bandsById={bandsById}
              records={w.records}
              restSeconds={w.restFor(block)}
              supersetLabel={tags[block.id] ?? null}
              targetReason={w.targetFor(block).reason}
              previousDate={w.previousDate(block.exerciseId)}
              previousFor={(i) => w.previousFor(block, i)}
              ghostFor={(i) => w.ghostFor(block, i)}
              menuItems={blockMenu(block, index)}
              onOpenExercise={() => nav.exercise(block.exerciseId)}
              onRest={(seconds) => void w.setRest(block.id, seconds)}
              onTick={(key, viaKeyboard) => onTick(block.id, key, viaKeyboard)}
              onUntick={(key) => void w.untick(block.id, key)}
              onSetMenu={(key) => setSetMenu({ blockId: block.id, key })}
              onLoad={(key) => setLoadFor({ blockId: block.id, key })}
              onChangeDraft={(key, patch) => w.updateDraft(block.id, key, patch)}
              onAddSet={() => w.addRow(block.id)}
              onNoteBlur={(note) => void w.setBlockNote(block.id, note)}
            />
          ))}
        </div>

        <aside className="col fx-stack" aria-label="Add and notes">
          <AddExercisePanel w={w} />
          <div className="card card-pad">
            <label className="field">
              <span className="label">Workout notes</span>
              <textarea
                className="input"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  if (notes !== session.notes) void w.saveNotes(notes);
                }}
                placeholder="How did it go?"
              />
            </label>
          </div>
        </aside>
      </div>

      {menuBlock && menuRow && menuValues ? (
        <SetMenuDialog
          title={menuTitle}
          subtitle={`${nameOf(menuBlock.exerciseId)}: type, effort and removal`}
          setType={menuValues.set_type}
          rpe={menuValues.rpe}
          clean={menuValues.clean}
          showClean={w.exercisesById[menuBlock.exerciseId]?.load_mode === 'bodyweight'}
          onPickType={(set_type) => {
            setSetMenu(null);
            void w.updateRow(menuBlock.id, menuRow.key, { set_type });
          }}
          onPickRpe={(rpe) => {
            setSetMenu(null);
            void w.updateRow(menuBlock.id, menuRow.key, { rpe });
          }}
          onToggleClean={(clean) => void w.updateRow(menuBlock.id, menuRow.key, { clean })}
          onRemove={() => {
            // Closed first: the toast's Undo must not sit under an open dialog.
            setSetMenu(null);
            removeRow(menuBlock.id, menuRow.key);
          }}
          onClose={() => setSetMenu(null)}
        />
      ) : null}

      {loadBlock && loadDraft ? (
        <LoadDialog
          exerciseName={nameOf(loadBlock.exerciseId)}
          weight={loadDraft.weight}
          assist={loadDraft.assist}
          bandId={loadDraft.band_id}
          bands={w.bands}
          onChange={(patch) => w.updateDraft(loadBlock.id, loadDraft.key, patch)}
          onManageBands={() => {
            setLoadFor(null);
            nav.tab('body');
          }}
          onClose={() => setLoadFor(null)}
        />
      ) : null}

      {supersetFor ? (
        <ExercisePicker
          title="Superset with"
          items={w.blocks
            .filter((b) => b.id !== supersetFor)
            .map((b) => ({
              id: b.id,
              label: nameOf(b.exerciseId),
              note: b.sessionExercise?.superset_group
                ? `Joins superset ${b.sessionExercise.superset_group}`
                : 'Moves to sit after it',
            }))}
          emptyText="Add another exercise first."
          onSelect={([id]) => {
            if (id) void w.setSuperset(supersetFor, id);
          }}
          onClose={() => setSupersetFor(null)}
        />
      ) : null}

      {replaceFor ? (
        <ExercisePicker
          title="Replace with"
          items={w.exercises
            .filter((e) => visibleInMode(e, session.mode))
            .map((exercise) => {
              const added = w.blocks.some((b) => b.exerciseId === exercise.id);
              return {
                id: exercise.id,
                label: exercise.name,
                group: normaliseMuscle(exercise.muscle_group),
                disabled: added,
                note: added ? 'Already in this workout' : undefined,
              };
            })}
          emptyText="No other exercises in this mode."
          onSelect={([id]) => {
            if (id) void w.replaceExercise(replaceFor, id);
          }}
          onClose={() => setReplaceFor(null)}
        />
      ) : null}

      {pinnedFor ? (
        <PinnedNoteDialog
          exerciseName={nameOf(pinnedFor)}
          note={w.exercisesById[pinnedFor]?.pinned_note ?? ''}
          onSave={(note) => void w.setPinnedNote(pinnedFor, note)}
          onClose={() => setPinnedFor(null)}
        />
      ) : null}

      {dialog}
    </div>
  );
}

/**
 * Duration · Volume · Sets. Its own component so the once-a-second clock
 * re-renders this and nothing else; the clock stops at Finish.
 */
function LiveStats({
  startedAt,
  endedAt,
  volume,
  sets,
}: {
  startedAt: number | null;
  endedAt: number | null;
  volume: number;
  sets: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endedAt !== null || startedAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endedAt, startedAt]);

  const elapsed = startedAt === null ? 0 : Math.max(0, ((endedAt ?? now) - startedAt) / 1000);
  const hours = Math.floor(elapsed / 3600);
  const duration =
    hours > 0
      ? `${hours}:${formatDuration(elapsed % 3600).padStart(5, '0')}`
      : formatDuration(elapsed);

  return (
    <dl className="fx-live">
      <div>
        <dt>Duration</dt>
        {/* Not a live region: a clock read out every second would drown everything else. */}
        <dd className="numeric">{startedAt === null ? '—' : duration}</dd>
      </div>
      <div>
        <dt>Volume</dt>
        <dd className="numeric">{volumeText(volume)}</dd>
      </div>
      <div>
        <dt>Sets</dt>
        <dd className="numeric">{sets}</dd>
      </div>
    </dl>
  );
}

/** The library beside the session: search, then click to add. */
function AddExercisePanel({ w }: { w: SessionLog }) {
  const [query, setQuery] = useState('');
  const mode = w.session?.mode ?? 'gym';
  const sections = useMemo(
    () =>
      groupItems(
        w.exercises
          // The session's mode lists its own library ('both' shows in either).
          .filter((e) => visibleInMode(e, mode))
          .map((exercise) => {
            const added = w.blocks.some((b) => b.exerciseId === exercise.id);
            return {
              id: exercise.id,
              label: exercise.name,
              group: normaliseMuscle(exercise.muscle_group),
              disabled: added,
              note: added ? 'In this workout' : undefined,
            };
          }),
        query,
      ),
    [w.exercises, w.blocks, mode, query],
  );

  return (
    <section className="card card-pad fx-add-panel" aria-labelledby="fx-add-title">
      <h3 id="fx-add-title" className="fx-h3">
        Add an exercise
      </h3>
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${MODE_LABEL[mode].toLowerCase()} exercises`}
        aria-label="Search exercises to add"
      />
      <div className="fx-picker-list fx-add-list">
        {sections.length === 0 ? (
          <p className="muted fx-small">
            {query ? 'Nothing matches that search.' : 'No exercises in this mode yet.'}
          </p>
        ) : (
          sections.map((section) => (
            <div key={section.group}>
              <div className="overline fx-picker-group">{section.group}</div>
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="fx-picker-item"
                  disabled={item.disabled}
                  onClick={() => void w.addExercise(item.id)}
                  aria-label={
                    item.disabled ? `${item.label}, already in this workout` : `Add ${item.label}`
                  }
                >
                  <span className="grow fx-picker-label">{item.label}</span>
                  {item.note ? (
                    <span className="fx-picker-note">{item.note}</span>
                  ) : (
                    <Icon name="plus" size={14} className="faint" />
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
