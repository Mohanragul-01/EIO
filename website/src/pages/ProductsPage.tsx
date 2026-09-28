/**
 * ProductsPage - what you use daily, and when it runs out.
 *
 * The list is sorted by urgency rather than by name, because the only reason
 * to open this page is to find out what needs reordering. A product with three
 * days left and one with four months are not equally interesting, and
 * alphabetical order treats them as if they were.
 */
import { useCallback, useMemo, useState } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import * as api from '@app/modules/products/api';
import {
  CATEGORY_LABEL,
  PRODUCT_CATEGORIES,
  UNITS,
  URGENCY_LABEL,
  formatDaysLeft,
  formatQuantity,
  project,
  urgencyOf,
  type Product,
  type ProductUse,
  type Urgency,
} from '@app/modules/products/types';

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
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

const URGENCY_COLOR: Record<Urgency, string> = {
  critical: 'var(--danger)',
  soon: 'var(--warning)',
  ok: 'var(--success)',
  unknown: 'var(--text-muted)',
  finished: 'var(--text-faint)',
};

/** Sort order: what needs acting on first. */
const URGENCY_RANK: Record<Urgency, number> = {
  critical: 0,
  soon: 1,
  unknown: 2,
  ok: 3,
  finished: 4,
};

export function ProductsPage() {
  const [category, setCategory] = useState('any');
  const [state, setState] = useState<'open' | 'finished' | 'all'>('open');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  useHotkeys({ onNew: () => setEditing('new') });

  const load = useCallback(async () => {
    const [products, uses] = await Promise.all([api.listProducts(), api.listAllUses()]);
    return { products, uses };
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'products');
  const today = todayISO();

  /** Each product with its projection, sorted by what needs attention. */
  const rows = useMemo(() => {
    const products = data?.products ?? [];
    const uses = data?.uses ?? [];

    const byProduct = new Map<string, ProductUse[]>();
    uses.forEach((use) => {
      (byProduct.get(use.product_id) ?? byProduct.set(use.product_id, []).get(use.product_id)!).push(
        use,
      );
    });

    return products
      .map((product) => {
        const projection = project(product, byProduct.get(product.id) ?? [], today);
        return { product, projection, urgency: urgencyOf(product, projection) };
      })
      .sort(
        (a, b) =>
          URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
          (a.projection.daysLeft ?? 9999) - (b.projection.daysLeft ?? 9999) ||
          a.product.name.localeCompare(b.product.name),
      );
  }, [data, today]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(({ product }) => {
      if (state === 'open' && product.finished_on) return false;
      if (state === 'finished' && !product.finished_on) return false;
      if (category !== 'any' && product.category !== category) return false;
      if (needle && !`${product.name} ${product.note}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, state, category, query]);

  const needsReorder = rows.filter(
    (r) => !r.product.finished_on && (r.urgency === 'critical' || r.urgency === 'soon'),
  ).length;

  const monthlySpend = useMemo(
    () =>
      rows
        .filter((r) => !r.product.finished_on && r.projection.costPerDay !== null)
        .reduce((total, r) => total + (r.projection.costPerDay ?? 0) * 30, 0),
    [rows],
  );

  /** Log one use at the product's own per-use amount. */
  const logUse = async (product: Product) => {
    setBusyId(product.id);
    setActionError(null);
    try {
      // Falls back to 1 when you never measured it: the point is still to
      // record THAT you used it, which is what the rate is built from.
      await api.logUse(product.id, product.per_use ?? 1);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not log that');
    } finally {
      setBusyId(null);
    }
  };

  const toggleFinished = async (product: Product) => {
    try {
      await api.setFinished(product.id, !product.finished_on);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update that');
    }
  };

  const remove = async (product: Product) => {
    if (
      !(await confirm('Delete product', `${product.name} and its whole usage history are removed.`))
    )
      return;
    try {
      await api.deleteProduct(product.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  const filtersActive = category !== 'any' || query.trim() !== '' || state !== 'open';

  const filters: FilterSpec[] = [
    {
      key: 'category',
      label: 'Category',
      value: category,
      onChange: setCategory,
      options: [
        { value: 'any', label: 'All categories' },
        ...PRODUCT_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
      ],
    },
  ];

  return (
    <Shell
      title="Products"
      subtitle={
        loading
          ? 'Loading'
          : needsReorder > 0
            ? `${needsReorder} to reorder`
            : `${visible.length} tracked`
      }
      actions={
        <div className="row">
          <Segmented
            value={state}
            onChange={setState}
            options={[
              { value: 'open', label: 'In use' },
              { value: 'finished', label: 'Finished' },
              { value: 'all', label: 'All' },
            ]}
          />
          <button className="btn" onClick={() => setEditing('new')}>
            <Icon name="plus" /> New product
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      {loading && !data ? (
        <Spinner center />
      ) : (
        <>
          {rows.length > 0 ? (
            <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="stat-row">
                <Stat
                  label="To reorder"
                  value={needsReorder}
                  sub="within 3 weeks"
                  color={needsReorder > 0 ? 'var(--danger)' : undefined}
                />
                <Stat
                  label="Running cost"
                  value={formatMoney(monthlySpend, { compact: true })}
                  sub="a month, at your rate"
                />
                <Stat
                  label="In use"
                  value={rows.filter((r) => !r.product.finished_on).length}
                  sub={`${rows.length} tracked`}
                />
              </div>
            </div>
          ) : null}

          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search products' }}
            filters={filters}
            onReset={
              filtersActive
                ? () => {
                    setCategory('any');
                    setQuery('');
                    setState('open');
                  }
                : undefined
            }
          />

          {visible.length === 0 ? (
            <div className="card">
              <Empty
                icon="module"
                title={rows.length === 0 ? 'Nothing tracked yet' : 'Nothing matches'}
                message={
                  rows.length === 0
                    ? 'Add a product with its size and how much you use at a time, then log each use. It works out the rest from what you actually use.'
                    : 'Try a different filter.'
                }
                action={
                  rows.length === 0 ? (
                    <button className="btn" onClick={() => setEditing('new')}>
                      <Icon name="plus" /> Add one
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="col" style={{ gap: 'var(--space-sm)' }}>
              {visible.map(({ product, projection, urgency }) => (
                <div className="card card-pad" key={product.id}>
                  <div className="row-between wrap" style={{ gap: 'var(--space-md)' }}>
                    <div className="grow" style={{ minWidth: 180 }}>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="dot" style={{ background: URGENCY_COLOR[urgency] }} />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</span>
                        <span className="pill">{CATEGORY_LABEL[product.category] ?? 'Other'}</span>
                      </div>
                      <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>
                        {formatQuantity(projection.remaining, product.unit)} left of{' '}
                        {formatQuantity(product.total_quantity, product.unit)}
                        {product.finished_on
                          ? ` · finished ${formatEventDate(product.finished_on)}`
                          : ''}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: 120 }}>
                      <div
                        className="numeric"
                        style={{ fontWeight: 600, color: URGENCY_COLOR[urgency] }}
                      >
                        {product.finished_on
                          ? URGENCY_LABEL.finished
                          : formatDaysLeft(projection.daysLeft)}
                      </div>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {product.finished_on
                          ? `lasted ${projection.daysOpen} days`
                          : projection.emptyOn
                            ? `empty ${formatEventDate(projection.emptyOn)}`
                            : URGENCY_LABEL[urgency]}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 4 }}>
                      {!product.finished_on ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => void logUse(product)}
                          disabled={busyId === product.id}
                        >
                          {busyId === product.id ? (
                            <span className="spinner" />
                          ) : (
                            <>
                              <Icon name="plus" size={13} /> Log use
                            </>
                          )}
                        </button>
                      ) : null}

                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          onClick={() => setHistoryFor(product)}
                          title="Usage history"
                          aria-label="Usage history"
                        >
                          <Icon name="trend" size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => void toggleFinished(product)}
                          title={product.finished_on ? 'Reopen' : 'Mark finished'}
                          aria-label={product.finished_on ? 'Reopen' : 'Mark finished'}
                        >
                          <Icon name={product.finished_on ? 'reset' : 'check'} size={14} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => setEditing(product)}
                          aria-label="Edit"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => void remove(product)}
                          aria-label="Delete"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="meter" style={{ marginTop: 10 }}>
                    <i
                      style={{
                        width: `${projection.percentUsed}%`,
                        background: URGENCY_COLOR[urgency],
                      }}
                    />
                  </div>

                  {projection.dailyRate !== null ? (
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 6 }}>
                      {formatQuantity(Math.round(projection.dailyRate * 10) / 10, product.unit)} a
                      day, measured over {projection.daysOpen} days
                      {projection.costPerDay !== null
                        ? ` · ${formatMoney(projection.costPerDay)} a day`
                        : ''}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editing ? (
        <ProductDialog
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      {historyFor ? (
        <HistoryDialog
          product={historyFor}
          onClose={() => {
            setHistoryFor(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </Shell>
  );
}

/* PRODUCT DIALOG ----------------------------------------------------------- */

function ProductDialog({
  product,
  onClose,
  onSaved,
}: {
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? 'other');
  const [unit, setUnit] = useState(product?.unit ?? 'g');
  const [total, setTotal] = useState(product ? String(product.total_quantity) : '');
  const [perUse, setPerUse] = useState(product?.per_use ? String(product.per_use) : '');
  const [price, setPrice] = useState(
    product?.price_minor != null ? minorToAmountString(product.price_minor) : '',
  );
  const [openedOn, setOpenedOn] = useState(product?.opened_on ?? todayISO());
  const [note, setNote] = useState(product?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const totalValue = Number(total.trim());
    if (!name.trim()) return setError('Give it a name');
    if (!Number.isFinite(totalValue) || totalValue <= 0) return setError('How much is in it?');

    setSaving(true);
    setError(null);

    const input = {
      name: name.trim(),
      category,
      unit: unit.trim() || 'g',
      total_quantity: totalValue,
      per_use: perUse.trim() ? Number(perUse) : null,
      price_minor: price.trim() ? parseAmountToMinor(price) : null,
      opened_on: openedOn,
      note: note.trim(),
    };

    try {
      if (product) await api.updateProduct(product.id, input);
      else await api.createProduct(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={product ? 'Edit product' : 'New product'}
      onClose={onClose}
      width={560}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : product ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Whey protein, face wash, sunscreen…"
        autoFocus
      />

      <div className="field">
        <span className="label">Category</span>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-end' }}>
        <TextField
          label="How much is in it"
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          placeholder="1000"
          inputMode="decimal"
          style={{ flex: 1 }}
        />
        <label className="field" style={{ width: 130 }}>
          <span className="label">Unit</span>
          <input
            className="input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            list="product-units"
            placeholder="g"
          />
          <datalist id="product-units">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </label>
      </div>

      <TextField
        label="Per use"
        value={perUse}
        onChange={(e) => setPerUse(e.target.value)}
        placeholder="30"
        inputMode="decimal"
        hint="Optional. Only used to pre-fill the amount when you log a use — the projection is measured from what you actually use."
      />

      <TextField
        label="What it cost"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        placeholder="Optional"
        inputMode="decimal"
        hint="Used to work out what it costs you a day."
      />

      <div className="field">
        <span className="label">Opened on</span>
        <input
          className="input"
          type="date"
          value={openedOn}
          onChange={(e) => setOpenedOn(e.target.value)}
        />
      </div>

      <TextField
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional"
      />

      <ErrorBanner message={error} />
    </Modal>
  );
}

/* HISTORY ------------------------------------------------------------------ */

function HistoryDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const load = useCallback(() => api.listUses(product.id), [product.id]);
  const { data, loading, error, reload } = useAsync(load, `uses-${product.id}`);

  const uses = data ?? [];

  const remove = async (id: string) => {
    await api.deleteUse(id);
    await reload();
  };

  return (
    <Modal open title={`${product.name} · usage`} onClose={onClose} width={480}>
      <ErrorBanner message={error} />

      {loading ? (
        <Spinner center />
      ) : uses.length === 0 ? (
        <Empty title="Nothing logged yet" message="Log a use and it appears here." />
      ) : (
        <div className="col" style={{ gap: 3 }}>
          {uses.map((use) => (
            <div className="list-row bordered" key={use.id}>
              <span className="grow" style={{ fontSize: 13 }}>
                {formatEventDate(use.used_on)}
              </span>
              <span className="numeric faint" style={{ fontSize: 12.5 }}>
                {formatQuantity(use.quantity, product.unit)}
              </span>
              <button
                className="icon-btn danger"
                onClick={() => void remove(use.id)}
                aria-label="Delete this entry"
              >
                <Icon name="trash" size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
