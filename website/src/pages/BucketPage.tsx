/**
 * BucketPage - 818 things, and which of them you could do this weekend.
 *
 * A list this long is only useful if it can be narrowed, so the filters are the
 * feature: by category, by what it costs, by whether it is done. The desktop
 * payoff is that the progress figures and the filtered list are on screen
 * together - you can see "142 free things left" and then look at them.
 */
import { useCallback, useMemo, useState } from 'react';

import { formatEventDate } from '@app/core/date';
import * as api from '@app/modules/bucket/api';
import {
  COSTS,
  COST_LABEL,
  COST_SHORT,
  categorySummary,
  matchesQuery,
  progressOf,
  type BucketItem,
  type Cost,
} from '@app/modules/bucket/types';

import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import {
  Empty,
  ErrorBanner,
  Modal,
  Segmented,
  Spinner,
  Stat,
  TextArea,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

type Status = 'all' | 'todo' | 'done';

const COST_COLOR: Record<Cost, string> = {
  low: 'var(--priority-low)',
  moderate: 'var(--priority-normal)',
  high: 'var(--priority-high)',
};

export function BucketPage() {
  const [status, setStatus] = useState<Status>('todo');
  const [cost, setCost] = useState<'any' | Cost>('any');
  const [category, setCategory] = useState('any');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<BucketItem | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useHotkeys({ onNew: () => setEditing('new') });

  const load = useCallback(() => api.listItems(), []);
  const { data, loading, error, reload, set } = useAsync(load, 'bucket');

  const items = useMemo(() => data ?? [], [data]);
  const progress = useMemo(() => progressOf(items), [items]);
  const categories = useMemo(() => categorySummary(items), [items]);

  const visible = useMemo(
    () =>
      items.filter((item) => {
        if (status === 'todo' && item.is_done) return false;
        if (status === 'done' && !item.is_done) return false;
        if (cost !== 'any' && item.cost !== cost) return false;
        if (category !== 'any' && item.category !== category) return false;
        return matchesQuery(item, query);
      }),
    [items, status, cost, category, query],
  );

  /** Grouped under their category headings, which is how the source list read. */
  const grouped = useMemo(() => {
    const groups = new Map<string, BucketItem[]>();
    visible.forEach((item) => {
      (groups.get(item.category) ?? groups.set(item.category, []).get(item.category)!).push(item);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  /**
   * Tick optimistically.
   *
   * On a list you scan and tick in bursts, waiting for a round trip per item
   * makes the whole thing feel stuck. A failure puts the tick back and says so.
   */
  const toggle = async (item: BucketItem) => {
    const next = !item.is_done;
    setBusyId(item.id);
    setActionError(null);

    set(
      items.map((row) =>
        row.id === item.id
          ? { ...row, is_done: next, done_on: next ? new Date().toISOString().slice(0, 10) : null }
          : row,
      ),
    );

    try {
      await api.setDone(item.id, next);
    } catch (e) {
      set(items);
      setActionError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: BucketItem) => {
    if (!(await confirm('Remove from the list', `"${item.title}" will be deleted.`))) return;
    try {
      await api.deleteItem(item.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  const filtersActive =
    cost !== 'any' || category !== 'any' || query.trim() !== '' || status !== 'todo';

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

  return (
    <Shell
      title="B-List"
      subtitle={
        loading ? 'Loading' : `${progress.done} of ${progress.total} done · ${progress.percent}%`
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
          <button className="btn" onClick={() => setEditing('new')}>
            <Icon name="plus" /> Add
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      {loading && !data ? (
        <Spinner center />
      ) : (
        <>
          <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-row">
              <Stat label="Done" value={progress.done} sub={`of ${progress.total}`} />
              <Stat
                label="Free to do"
                value={progress.byCost.low}
                sub="no or low cost"
                color={COST_COLOR.low}
              />
              <Stat
                label="Moderate"
                value={progress.byCost.moderate}
                sub="left"
                color={COST_COLOR.moderate}
              />
              <Stat
                label="Big"
                value={progress.byCost.high}
                sub="left"
                color={COST_COLOR.high}
              />
            </div>

            <div className="meter" style={{ marginTop: 'var(--space-lg)' }}>
              <i style={{ width: `${progress.percent}%` }} />
            </div>
          </div>

          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search 818 things' }}
            filters={filters}
            onReset={
              filtersActive
                ? () => {
                    setCost('any');
                    setCategory('any');
                    setQuery('');
                    setStatus('todo');
                  }
                : undefined
            }
          />

          {grouped.length === 0 ? (
            <div className="card">
              <Empty
                icon="flag"
                title={items.length === 0 ? 'Nothing on the list yet' : 'Nothing matches'}
                message={
                  items.length === 0
                    ? 'Run migrations 0015, then 0015a to 0015e, to import the list. Or add something yourself.'
                    : 'Try a different filter, or clear them.'
                }
              />
            </div>
          ) : (
            <div className="col" style={{ gap: 'var(--space-xl)' }}>
              {grouped.map(([name, rows]) => (
                <section key={name}>
                  <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 8 }}>
                    <span className="column-title">{name}</span>
                    <span className="column-count">{rows.length}</span>
                  </div>

                  <div className="col" style={{ gap: 3 }}>
                    {rows.map((item) => (
                      <div className="list-row bordered" key={item.id}>
                        <button
                          className={`check${item.is_done ? ' on' : ''}`}
                          onClick={() => void toggle(item)}
                          disabled={busyId === item.id}
                          aria-label={item.is_done ? 'Mark as not done' : 'Mark as done'}
                        >
                          {item.is_done ? (
                            <Icon name="check" size={11} strokeWidth={2.5} />
                          ) : null}
                        </button>

                        <span
                          className="dot"
                          style={{ background: COST_COLOR[item.cost] }}
                          title={COST_LABEL[item.cost]}
                        />

                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className={item.is_done ? 'strike' : ''} style={{ fontSize: 13 }}>
                            {item.title}
                          </div>
                          {item.note ? (
                            <div className="faint" style={{ fontSize: 11.5 }}>
                              {item.note}
                            </div>
                          ) : null}
                        </div>

                        {item.done_on ? (
                          <span className="faint" style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}>
                            {formatEventDate(item.done_on)}
                          </span>
                        ) : (
                          <span className="pill">{COST_SHORT[item.cost]}</span>
                        )}

                        <div className="row-actions">
                          <button
                            className="icon-btn"
                            onClick={() => setEditing(item)}
                            aria-label="Edit"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="icon-btn danger"
                            onClick={() => void remove(item)}
                            aria-label="Delete"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {editing ? (
        <ItemDialog
          item={editing === 'new' ? null : editing}
          categories={categories.map((c) => c.category)}
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

/* DIALOG ------------------------------------------------------------------- */

function ItemDialog({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item: BucketItem | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [category, setCategory] = useState(item?.category ?? categories[0] ?? 'Other');
  const [cost, setCost] = useState<Cost>(item?.cost ?? 'moderate');
  const [note, setNote] = useState(item?.note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) return setError('Give it a title');
    setSaving(true);
    setError(null);

    try {
      const input = { title: title.trim(), category: category.trim(), cost, note: note.trim() };
      if (item) await api.updateItem(item.id, input);
      else await api.createItem(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={item ? 'Edit item' : 'Add to the list'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : item ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <TextField
        label="What"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Learn to surf"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />

      <label className="field">
        <span className="label">Category</span>
        <input
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="bucket-categories"
          placeholder="Water Adventures"
        />
        {/* A datalist, not a select: the 61 existing categories are suggestions,
            and a new one should not need a schema change or a dropdown edit. */}
        <datalist id="bucket-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      <div className="field">
        <span className="label">What it costs to do</span>
        <Segmented
          value={cost}
          onChange={setCost}
          options={COSTS.map((c) => ({ value: c, label: COST_LABEL[c] }))}
        />
      </div>

      <TextArea
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional — where, who with, what it needs"
        rows={3}
      />

      <ErrorBanner message={error} />
    </Modal>
  );
}
