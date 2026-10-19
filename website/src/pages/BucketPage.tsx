/**
 * BucketPage - 818 things, which of them you are doing, and what you did.
 *
 * A list this long is only useful if it can be narrowed, so the filters are
 * still the feature: cost, want, category, search. The desktop payoff is that
 * the side rail holds the choosing - Pick for me and the Now shelf - beside
 * the list rather than above it, so you can read the list and plan at once.
 *
 * Ticking is one click and a bar follows - "Done · today", Add memory, Undo -
 * as on the phone. The Done view is the Lived timeline: years and months of
 * what you did, each year with its card. Every rule here is the app's own
 * (picks, shelf, plan, when, lived); this page only arranges them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { todayISO } from '@app/core/date';
import type { ItemPatch } from '@app/modules/bucket/api';
import { livedTimeline } from '@app/modules/bucket/lived';
import { readPickPrefs, writePickPrefs } from '@app/modules/bucket/pickPrefs';
import { pickPool, pickSeed, picksFor, snoozeUntil, type PickPrefs } from '@app/modules/bucket/picks';
import { formatTarget, type Target } from '@app/modules/bucket/plan';
import {
  NOW_CAP,
  focusOnReopen,
  isShelfFull,
  nowShelf,
  stepsByItem,
} from '@app/modules/bucket/shelf';
import {
  COSTS,
  COST_LABEL,
  COST_SHORT,
  UNDONE,
  WANTS,
  WANT_LABEL,
  categorySummary,
  doneStateOf,
  matchesQuery,
  progressOf,
  tickedState,
  wantOf,
  type BucketInput,
  type BucketItem,
  type BucketStep,
  type Cost,
  type DoneState,
  type Want,
} from '@app/modules/bucket/types';
import { formatWhen, whenToDone } from '@app/modules/bucket/when';

import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { Empty, ErrorBanner, Segmented, Spinner, Stat, useConfirm } from '../components/ui';
import { useHotkeys } from '../lib/useHotkeys';
import { CategoryIcon } from './bucket/CategoryIcon';
import { MemoryDialog, MoveDialog, SwapDialog } from './bucket/Dialogs';
import { DoneBar, type DoneBarState } from './bucket/DoneBar';
import { ItemDialog, type ItemTab, type StepActions } from './bucket/ItemDialog';
import { Lived } from './bucket/Lived';
import type { MemoryDraft } from './bucket/MemoryFields';
import { NowShelf } from './bucket/NowShelf';
import { COST_COLOR, PickCard } from './bucket/PickCard';
import { useBucketData } from './bucket/useBucketData';

type Status = 'all' | 'todo' | 'done';

type Dialog =
  | { kind: 'item'; itemId: string | null; tab: ItemTab }
  | { kind: 'memory'; itemId: string }
  | { kind: 'swap'; itemId: string }
  | { kind: 'move'; itemId: string };

const NO_STEPS: BucketStep[] = [];

export function BucketPage() {
  const bucket = useBucketData();
  const { patch } = bucket;
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const today = todayISO();

  const [status, setStatus] = useState<Status>('todo');
  const [cost, setCost] = useState<'any' | Cost>('any');
  const [want, setWant] = useState<'any' | Want>('any');
  const [category, setCategory] = useState('any');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const [pickPrefs, setPickPrefs] = useState<PickPrefs>({ roll: 0, collapsed: false });
  const [pickCost, setPickCost] = useState<'any' | Cost>('low');

  useHotkeys({ onNew: () => setDialog({ kind: 'item', itemId: null, tab: 'about' }) });

  useEffect(() => {
    let alive = true;
    void readPickPrefs(today).then((prefs) => {
      if (alive) setPickPrefs(prefs);
    });
    return () => {
      alive = false;
    };
  }, [today]);

  const items = useMemo(() => bucket.items ?? [], [bucket.items]);
  const steps = useMemo(() => bucket.steps ?? NO_STEPS, [bucket.steps]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const progress = useMemo(() => progressOf(items), [items]);
  const categories = useMemo(() => categorySummary(items), [items]);
  /** Progress per category, so a section heading can carry its own count. */
  const categoryProgress = useMemo(
    () => new Map(categories.map((c) => [c.category, c])),
    [categories],
  );
  const stepsMap = useMemo(() => stepsByItem(steps), [steps]);
  const stepsFor = useCallback((item: BucketItem) => stepsMap.get(item.id) ?? NO_STEPS, [stepsMap]);
  const shelf = useMemo(() => nowShelf(items), [items]);
  const nextCount = useMemo(
    () => items.filter((item) => item.focus === 'next' && !item.is_done).length,
    [items],
  );

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (status === 'todo' && item.is_done) return false;
        if (status === 'done' && !item.is_done) return false;
        if (cost !== 'any' && item.cost !== cost) return false;
        if (want !== 'any' && wantOf(item) !== want) return false;
        if (category !== 'any' && item.category !== category) return false;
        return matchesQuery(item, query);
      }),
    [items, status, cost, want, category, query],
  );

  /** Grouped under their category headings, which is how the source list read. */
  const grouped = useMemo(() => {
    const groups = new Map<string, BucketItem[]>();
    visible.forEach((item) => {
      const rows = groups.get(item.category);
      if (rows) rows.push(item);
      else groups.set(item.category, [item]);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const timeline = useMemo(
    () => (status === 'done' ? livedTimeline(visible) : []),
    [status, visible],
  );

  /* PICK FOR ME ------------------------------------------------------------ */

  const pickCostInUse = cost !== 'any' ? cost : pickCost;
  const pool = useMemo(
    () => pickPool(items, { cost: pickCostInUse, category, query, want }, today),
    [items, pickCostInUse, category, query, want, today],
  );
  /** The same pool at any cost: whether "Pick from any cost" would find anything. */
  const widerPoolSize = useMemo(
    () =>
      pickCostInUse === 'any'
        ? 0
        : pickPool(items, { cost: 'any', category, query, want }, today).length,
    [items, pickCostInUse, category, query, want, today],
  );
  const picks = useMemo(
    () => picksFor(pool, pickSeed(today, pickPrefs.roll)),
    [pool, today, pickPrefs.roll],
  );

  const updatePickPrefs = (next: PickPrefs) => {
    setPickPrefs(next);
    void writePickPrefs({ day: today, ...next });
  };

  /* FEEDBACK --------------------------------------------------------------- */

  const [doneBar, setDoneBar] = useState<DoneBarState | null>(null);
  /** What the bar is about, read by its buttons rather than during render. */
  const barRef = useRef<{ id: number; itemId: string; previous: DoneState } | null>(null);
  const barSeq = useRef(0);

  const closeBar = useCallback((id: number) => {
    if (barRef.current?.id === id) barRef.current = null;
    setDoneBar((current) => (current?.id === id ? null : current));
  }, []);

  /** A toast replaces the bar: two things floating in one place is one too many. */
  const showToast = (message: string, onUndo?: () => void) => {
    if (barRef.current) closeBar(barRef.current.id);
    toast.show(onUndo ? { message, actionLabel: 'Undo', onAction: onUndo } : { message });
  };

  /* ACTIONS ---------------------------------------------------------------- */

  const untick = (item: BucketItem) => {
    const previous = doneStateOf(item);
    // Done, it freed its place on Now; if that place was taken since, it
    // comes back as Next rather than making six.
    const focus = focusOnReopen(item, items);
    const demoted = focus !== item.focus;
    void patch(item.id, demoted ? { ...UNDONE, focus } : UNDONE);
    // Memory, place and "again" stay - they are your writing. Undo brings
    // the date back too.
    showToast(
      demoted
        ? `Not done · ${item.title} · Now is full, so it is on Next`
        : `Not done · ${item.title}`,
      () => void patch(item.id, demoted ? { ...previous, focus: item.focus } : previous),
    );
  };

  const tick = (item: BucketItem) => {
    if (item.is_done) {
      untick(item);
      return;
    }
    const previous = doneStateOf(item);
    toast.hide();
    const id = ++barSeq.current;
    barRef.current = { id, itemId: item.id, previous };
    setDoneBar({ id, message: `Done · today · ${item.title}` });
    void patch(item.id, tickedState(today)).then((ok) => {
      // The tick did not happen, so a bar offering to remember it would lie.
      if (!ok) closeBar(id);
    });
  };

  const undoTick = () => {
    const bar = barRef.current;
    if (!bar) return;
    closeBar(bar.id);
    const item = byId.get(bar.itemId);
    const focus = item ? focusOnReopen(item, items) : null;
    if (item && focus !== item.focus) {
      // Its place on Now was taken while it was ticked.
      void patch(bar.itemId, { ...bar.previous, focus });
      showToast(`Now is full, so ${item.title} is on Next`);
      return;
    }
    void patch(bar.itemId, bar.previous);
  };

  const addMemoryFromBar = () => {
    const bar = barRef.current;
    if (!bar) return;
    closeBar(bar.id);
    setDialog({ kind: 'memory', itemId: bar.itemId });
  };

  const saveMemory = (item: BucketItem, draft: MemoryDraft) => {
    setDialog(null);
    void patch(item.id, {
      // Saying when you did it says that you did it.
      is_done: true,
      ...whenToDone(draft.when, today),
      memory: draft.memory.trim(),
      place: draft.place.trim(),
      again: draft.again,
    });
  };

  const putOnNow = (item: BucketItem) => {
    if (item.focus === 'now') return;
    if (isShelfFull(items)) {
      setDialog({ kind: 'swap', itemId: item.id });
      return;
    }
    const previous = item.focus;
    void patch(item.id, { focus: 'now' }).then((ok) => {
      if (ok) showToast(`On Now · ${item.title}`, () => void patch(item.id, { focus: previous }));
    });
  };

  const notNow = (item: BucketItem) => {
    const previous = item.snoozed_until;
    void patch(item.id, { snoozed_until: snoozeUntil(today) }).then((ok) => {
      if (ok) {
        showToast(
          'Hidden from picks for 30 days',
          () => void patch(item.id, { snoozed_until: previous }),
        );
      }
    });
  };

  const swap = (out: BucketItem, incoming: BucketItem) => {
    setDialog(null);
    const incomingWas = incoming.focus;
    void bucket.swapNow(out.id, incoming.id).then((ok) => {
      if (!ok) return;
      showToast(`${out.title} moved to Next`, () => {
        // Undone in the order it was done: what leaves Now goes first.
        void patch(incoming.id, { focus: incomingWas }).then(
          (back) => back && patch(out.id, { focus: 'now' }),
        );
      });
    });
  };

  const putOnNext = (incoming: BucketItem) => {
    setDialog(null);
    const previous = incoming.focus;
    if (previous === 'next') return;
    void patch(incoming.id, { focus: 'next' }).then((ok) => {
      if (ok) {
        showToast(`On Next · ${incoming.title}`, () => void patch(incoming.id, { focus: previous }));
      }
    });
  };

  const moveTarget = (item: BucketItem, target: Target, label: string) => {
    setDialog(null);
    const previous: Target = { target_on: item.target_on, target_precision: item.target_precision };
    void patch(item.id, target).then((ok) => {
      if (!ok) return;
      const said =
        target.target_on && target.target_precision
          ? formatTarget(target.target_on, target.target_precision, today)
          : label;
      showToast(`Target moved to ${said}`, () => void patch(item.id, previous));
    });
  };

  const openItem = (item: BucketItem | null, tab: ItemTab = 'about') => {
    // The dialog shows step errors too, so it opens clean.
    bucket.clearActionError();
    setDialog({ kind: 'item', itemId: item?.id ?? null, tab });
  };

  const editing =
    dialog?.kind === 'item' && dialog.itemId ? (byId.get(dialog.itemId) ?? null) : null;

  const saveItem = async (fields: BucketInput & ItemPatch) => {
    const others = items.filter((item) => item.id !== editing?.id);
    // A sixth on Now never quietly grows the shelf: save the rest, then ask.
    // A done item takes no place on Now, so it never needs a swap.
    const needsSwap =
      fields.focus === 'now' &&
      editing?.focus !== 'now' &&
      !editing?.is_done &&
      isShelfFull(others);

    if (editing) {
      await bucket.save(editing.id, needsSwap ? { ...fields, focus: editing.focus } : fields);
      setDialog(needsSwap ? { kind: 'swap', itemId: editing.id } : null);
      return;
    }

    const created = await bucket.create(needsSwap ? { ...fields, focus: 'next' } : fields);
    setDialog(needsSwap ? { kind: 'swap', itemId: created.id } : null);
    // Clear only the filters that would hide what you just added.
    if (cost !== 'any' && created.cost !== cost) setCost('any');
    if (want !== 'any' && wantOf(created) !== want) setWant('any');
    if (category !== 'any' && created.category !== category) setCategory('any');
    if (query.trim() && !matchesQuery(created, query)) setQuery('');
    if (status === 'done') setStatus('todo');
  };

  const remove = async (item: BucketItem) => {
    const count = stepsFor(item).length;
    // Permanent, so it asks - and says what goes with it, since steps cascade.
    const message =
      count > 0
        ? `"${item.title}" will be deleted, with its ${count} ${count === 1 ? 'step' : 'steps'}.`
        : `"${item.title}" will be deleted.`;
    if (!(await confirm('Remove from the list', message))) return;
    setDialog(null);
    await bucket.remove(item);
  };

  const markUndone = (item: BucketItem) => {
    setDialog(null);
    untick(item);
  };

  const stepActions: StepActions = {
    add: (itemId, title) => void bucket.addStep(itemId, title),
    toggle: (step) => void bucket.toggleStep(step),
    remove: (step) => void bucket.removeStep(step),
    restore: (step) => void bucket.restoreStep(step),
    move: (step, direction) => void bucket.moveStep(step, direction),
  };

  /* FILTERS ---------------------------------------------------------------- */

  const filtersNarrow =
    cost !== 'any' || category !== 'any' || want !== 'any' || query.trim() !== '';
  const filtersActive = filtersNarrow || status !== 'todo';

  const filters: FilterSpec[] = [
    {
      key: 'cost',
      label: 'Cost',
      value: cost,
      onChange: (v) => setCost(v as 'any' | Cost),
      options: [
        { value: 'any', label: 'Any cost' },
        ...COSTS.map((c) => ({
          value: c,
          label: `${COST_LABEL[c]} (${progress.byCost[c]} left)`,
          dot: COST_COLOR[c],
        })),
      ],
    },
    {
      key: 'want',
      label: 'Want',
      value: want,
      onChange: (v) => setWant(v as 'any' | Want),
      options: [
        { value: 'any', label: 'Any want' },
        ...WANTS.map((w) => ({ value: w, label: WANT_LABEL[w] })),
      ],
    },
    {
      key: 'category',
      label: 'Category',
      value: category,
      onChange: setCategory,
      options: [
        { value: 'any', label: `All ${categories.length} categories` },
        ...categories.map((c) => ({
          value: c.category,
          label: `${c.category} (${c.done}/${c.total})`,
        })),
      ],
    },
  ];

  const showRail = status === 'todo' && items.length > 0;
  const dialogItem = dialog && dialog.kind !== 'item' ? byId.get(dialog.itemId) : undefined;

  return (
    <Shell
      title="B-List"
      subtitle={
        bucket.loading && !bucket.items
          ? 'Loading'
          : `${progress.done} of ${progress.total} done · ${progress.percent}%`
      }
      actions={
        <div className="row">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'todo', label: 'To do' },
              { value: 'done', label: 'Done' },
              { value: 'all', label: 'All' },
            ]}
          />
          <button className="btn" onClick={() => openItem(null)}>
            <Icon name="plus" /> Add
          </button>
        </div>
      }
    >
      <ErrorBanner message={bucket.error} />

      {bucket.loading && !bucket.items ? (
        <Spinner center />
      ) : (
        <>
          <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-row">
              <Stat label="Done" value={progress.done} sub={`of ${progress.total}`} />
              {/*
                Each tier filters to itself, and clicking the one already on
                clears it: "what can I do for nothing" is the question this
                page exists to answer.
              */}
              {COSTS.map((c) => (
                <Stat
                  key={c}
                  label={c === 'low' ? 'Free to do' : COST_SHORT[c]}
                  value={progress.byCost[c]}
                  sub={c === 'low' ? 'no or low cost' : 'left'}
                  color={COST_COLOR[c]}
                  onClick={() => setCost(cost === c ? 'any' : c)}
                  active={cost === c}
                  title={`Show only ${COST_LABEL[c].toLowerCase()}`}
                />
              ))}
              <Stat
                label="On Now"
                value={`${shelf.length}/${NOW_CAP}`}
                sub={`${nextCount} next`}
                onClick={() => setWant(want === 'now' ? 'any' : 'now')}
                active={want === 'now'}
                title="Show only what is on Now"
              />
            </div>

            <div className="meter" style={{ marginTop: 'var(--space-lg)' }}>
              <i style={{ width: `${progress.percent}%` }} />
            </div>
          </div>

          <div className={`bl-layout${showRail ? ' with-rail' : ''}`}>
            <div className="bl-main">
              <FilterBar
                search={{
                  value: query,
                  onChange: setQuery,
                  // Counted, not a literal 818 - which stopped being true the
                  // first time something was added.
                  placeholder: `Search ${progress.total} things`,
                }}
                filters={filters}
                onReset={
                  filtersActive
                    ? () => {
                        setCost('any');
                        setWant('any');
                        setCategory('any');
                        setQuery('');
                        setStatus('todo');
                      }
                    : undefined
                }
              />

              {visible.length === 0 ? (
                <div className="card">
                  <Empty
                    icon={status === 'done' && items.length > 0 ? 'calendar' : 'flag'}
                    title={
                      items.length === 0
                        ? 'Nothing on the list yet'
                        : status === 'done' && !filtersNarrow
                          ? 'Nothing done yet'
                          : 'Nothing matches'
                    }
                    message={
                      items.length === 0
                        ? 'Run migrations 0015, then 0015a to 0015e, to import the list. Or add something yourself.'
                        : status === 'done' && !filtersNarrow
                          ? 'Tick something you have done, then add when it happened - even years ago.'
                          : 'Try a different filter, or clear them.'
                    }
                  />
                </div>
              ) : status === 'done' ? (
                <Lived
                  years={timeline}
                  filtered={filtersNarrow}
                  onOpen={(item) => openItem(item, 'memory')}
                />
              ) : (
                <div className="col" style={{ gap: 'var(--space-xl)' }}>
                  {grouped.map(([name, rows]) => {
                    const stat = categoryProgress.get(name);
                    return (
                      <section key={name}>
                        <div className="row bl-section-head">
                          <span className="bl-glyph">
                            <CategoryIcon category={name} size={13} />
                          </span>
                          <span className="column-title">{name}</span>
                          {/* The category's own progress, not how many rows
                              the filter left. */}
                          <span className="column-count numeric">
                            {stat ? `${stat.done}/${stat.total}` : rows.length}
                          </span>
                        </div>

                        <div className="col" style={{ gap: 3 }}>
                          {rows.map((item) => (
                            <ItemRow
                              key={item.id}
                              item={item}
                              onTick={tick}
                              onEdit={(row) => openItem(row)}
                              onDelete={(row) => void remove(row)}
                            />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>

            {showRail ? (
              <aside className="bl-rail">
                <PickCard
                  picks={picks}
                  poolSize={pool.length}
                  costChip={
                    cost === 'any' && pickCost !== 'any'
                      ? { label: COST_LABEL[pickCost], onClear: () => setPickCost('any') }
                      : null
                  }
                  onWiden={
                    cost === 'any' && pickCost !== 'any' && pool.length === 0 && widerPoolSize > 0
                      ? () => setPickCost('any')
                      : null
                  }
                  collapsed={pickPrefs.collapsed}
                  onToggleCollapsed={() =>
                    updatePickPrefs({ ...pickPrefs, collapsed: !pickPrefs.collapsed })
                  }
                  onShuffle={() => updatePickPrefs({ ...pickPrefs, roll: pickPrefs.roll + 1 })}
                  onOpen={(item) => openItem(item)}
                  onPin={putOnNow}
                  onNotNow={notNow}
                />
                <NowShelf
                  shelf={shelf}
                  stepsFor={stepsFor}
                  today={today}
                  onOpen={(item) => openItem(item, 'plan')}
                  onMove={(item) => setDialog({ kind: 'move', itemId: item.id })}
                />
              </aside>
            ) : null}
          </div>
        </>
      )}

      {dialog?.kind === 'item' ? (
        <ItemDialog
          // Keyed so each open starts from the item it was opened on.
          key={`${dialog.itemId ?? 'new'}-${dialog.tab}`}
          item={editing}
          initialTab={dialog.tab}
          categories={categories.map((c) => c.category)}
          defaultCategory={category}
          steps={editing ? stepsFor(editing) : NO_STEPS}
          today={today}
          shelfFull={isShelfFull(items.filter((item) => item.id !== editing?.id))}
          onClose={() => setDialog(null)}
          onSave={saveItem}
          onDelete={(item) => void remove(item)}
          onMarkUndone={markUndone}
          stepActions={stepActions}
          actionError={bucket.actionError}
        />
      ) : null}

      {dialog?.kind === 'memory' && dialogItem ? (
        <MemoryDialog
          item={dialogItem}
          today={today}
          onClose={() => setDialog(null)}
          onSave={saveMemory}
        />
      ) : null}

      {dialog?.kind === 'swap' && dialogItem ? (
        <SwapDialog
          incoming={dialogItem}
          shelf={shelf}
          onSwap={swap}
          onNext={putOnNext}
          onClose={() => setDialog(null)}
        />
      ) : null}

      {dialog?.kind === 'move' && dialogItem ? (
        <MoveDialog
          item={dialogItem}
          today={today}
          onMove={moveTarget}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <DoneBar bar={doneBar} onAddMemory={addMemoryFromBar} onUndo={undoTick} onExpire={closeBar} />

      {confirmDialog}
    </Shell>
  );
}

/* ROW ---------------------------------------------------------------------- */

function ItemRow({
  item,
  onTick,
  onEdit,
  onDelete,
}: {
  item: BucketItem;
  onTick: (item: BucketItem) => void;
  onEdit: (item: BucketItem) => void;
  onDelete: (item: BucketItem) => void;
}) {
  const done = item.is_done;
  const doneLabel =
    done && item.done_on
      ? formatWhen(item.done_on, item.done_precision ?? 'day', { short: true })
      : null;

  return (
    <div className="list-row bordered">
      <button
        className={`check${done ? ' on' : ''}`}
        onClick={() => onTick(item)}
        role="checkbox"
        aria-checked={done}
        aria-label={item.title}
      >
        {done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
      </button>

      <div className="grow" style={{ minWidth: 0 }}>
        {/* Done rows are muted, not struck through: done is not wrong. */}
        <div className={done ? 'muted' : ''} style={{ fontSize: 13 }}>
          {item.title}
        </div>
        {item.note ? (
          <div className="faint" style={{ fontSize: 11.5 }}>
            {item.note}
          </div>
        ) : null}
      </div>

      {item.focus && !done ? <span className="pill bl-want">{WANT_LABEL[item.focus]}</span> : null}
      {done && item.memory ? (
        <span className="faint" title="Has a memory">
          <Icon name="chat" size={13} />
        </span>
      ) : null}
      {doneLabel ? (
        <span className="faint numeric" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
          {doneLabel}
        </span>
      ) : null}
      <span className="pill" title={COST_LABEL[item.cost]}>
        <span className="dot" style={{ background: COST_COLOR[item.cost] }} />
        {COST_SHORT[item.cost]}
      </span>

      <div className="row-actions">
        <button className="icon-btn" onClick={() => onEdit(item)} aria-label={`Edit ${item.title}`}>
          <Icon name="edit" size={14} />
        </button>
        <button
          className="icon-btn danger"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.title}`}
        >
          <Icon name="trash" size={14} />
        </button>
      </div>
    </div>
  );
}
