/**
 * ProductsPage - what you use daily, when it runs out, and when it goes off.
 *
 * The list is sorted by urgency rather than by name, because the only reason
 * to open this page is to find out what needs reordering. A product with three
 * days left and one with four months are not equally interesting, and
 * alphabetical order treats them as if they were.
 *
 * Every rule here - the projection, the previous container's estimate,
 * use-by, the Today checklist, what counts as "to reorder" - comes from the
 * app's products module, so this page and the phone cannot disagree about a
 * single container. Only the layout is the website's: denser, with the
 * history, finishing and restocking one click away instead of a screen.
 */
import { useCallback, useMemo, useState } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import * as api from '@app/modules/products/api';
import { todayChecklist, type ChecklistRow } from '@app/modules/products/checklist';
import {
  activeSibling,
  estimateLabel,
  finishedGroups,
  lifespanDays,
  nameKey,
  priorEstimate,
  restockDraft,
  type Lifecycle,
} from '@app/modules/products/containers';
import {
  buildOutlooks,
  chipsFor,
  deleteSummary,
  loggedAllMessage,
  loggedMessage,
  removedMessage,
  remainingFraction,
  reorderMarker,
  reorderSummary,
  type Chip,
  type ChipKind,
  type Outlook,
} from '@app/modules/products/outlook';
import {
  CATEGORY_LABEL,
  DEFAULT_LEAD_DAYS,
  PRODUCT_CATEGORIES,
  UNITS,
  addDays,
  daysBetween,
  formatDayMonth,
  formatDaysLeft,
  formatQuantity,
  groupByDay,
  type Product,
  type ProductInput,
  type ProductUse,
  type Urgency,
} from '@app/modules/products/types';
import {
  conflictMessage,
  formatExpiryInput,
  parseExpiry,
  usableLabel,
  usableUntil,
} from '@app/modules/products/useBy';

import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon, type IconName } from '../components/Icon';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import {
  Empty,
  ErrorBanner,
  Modal,
  Segmented,
  SelectField,
  Spinner,
  Stat,
  TextField,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

const CHIP_LOOK: Record<ChipKind, { tone: string; color: string; icon: IconName }> = {
  reorder: { tone: 'danger', color: 'var(--danger)', icon: 'alert' },
  low: { tone: 'warn', color: 'var(--warning)', icon: 'trendDown' },
  plenty: { tone: 'ok', color: 'var(--success)', icon: 'check' },
  unknown: { tone: 'muted', color: 'var(--text-muted)', icon: 'help' },
  'spare-ready': { tone: 'info', color: 'var(--info)', icon: 'box' },
  'use-by': { tone: 'warn', color: 'var(--warning)', icon: 'clock' },
  expired: { tone: 'danger', color: 'var(--danger)', icon: 'clock' },
  finished: { tone: 'muted', color: 'var(--text-muted)', icon: 'check' },
  unopened: { tone: 'info', color: 'var(--info)', icon: 'box' },
};

/** Sort order: what needs acting on first. */
const URGENCY_RANK: Record<Urgency, number> = {
  critical: 0,
  soon: 1,
  unknown: 2,
  ok: 3,
  unopened: 4,
  finished: 5,
};

function rankOf(outlook: Outlook): number {
  // Expired leads, whatever is left in it; a spare waiting behind a container
  // that is running out means there is nothing to order.
  if (outlook.useByState === 'expired') return -1;
  if (outlook.spare && (outlook.urgency === 'critical' || outlook.urgency === 'soon')) {
    return URGENCY_RANK.ok;
  }
  return URGENCY_RANK[outlook.urgency];
}

/** The supply chip (not the use-by one) colours the bar and the headline. */
function supplyChip(chips: Chip[]): Chip {
  return chips.find((chip) => chip.kind !== 'use-by' && chip.kind !== 'expired') ?? chips[0];
}

/** "today", "yesterday", "on 3 Oct" - a day in the middle of a sentence. */
function onDay(day: string, today: string): string {
  const diff = daysBetween(day, today);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `on ${formatDayMonth(day, today)}`;
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

type EditTarget =
  | { kind: 'new' }
  | { kind: 'edit'; product: Product }
  | { kind: 'restock'; from: Product; spare: boolean };

type LifecycleFilter = Lifecycle | 'all';

export function ProductsPage() {
  const toast = useToast();
  const [category, setCategory] = useState('any');
  const [lifecycle, setLifecycle] = useState<LifecycleFilter>('in_use');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [historyFor, setHistoryFor] = useState<Product | null>(null);
  const [finishing, setFinishing] = useState<Outlook | null>(null);
  const [opening, setOpening] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<{ product: Product; count: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useHotkeys({ onNew: () => setEditing({ kind: 'new' }) });

  const load = useCallback(async () => {
    const [products, uses] = await Promise.all([api.listProducts(), api.listAllUses()]);
    return { products, uses };
  }, []);

  const { data, loading, error, reload } = useAsync(load, 'products');
  const today = todayISO();
  const products = useMemo(() => data?.products ?? [], [data]);
  const uses = useMemo(() => data?.uses ?? [], [data]);

  const outlooks = useMemo(() => buildOutlooks(products, uses, today), [products, uses, today]);
  const summary = useMemo(() => reorderSummary(outlooks), [outlooks]);
  const checklist = useMemo(() => todayChecklist(products, uses, today), [products, uses, today]);

  const needle = query.trim().toLowerCase();
  const matches = useCallback(
    (product: Product) =>
      (category === 'any' || product.category === category) &&
      (!needle || `${product.name} ${product.note}`.toLowerCase().includes(needle)),
    [category, needle],
  );

  const visible = useMemo(
    () =>
      outlooks
        .filter(
          (o) =>
            o.lifecycle !== 'finished' &&
            (lifecycle === 'all' || o.lifecycle === lifecycle) &&
            matches(o.product),
        )
        .sort(
          (a, b) =>
            rankOf(a) - rankOf(b) ||
            (a.projection.daysLeft ?? a.estimate?.daysLeft ?? 9999) -
              (b.projection.daysLeft ?? b.estimate?.daysLeft ?? 9999) ||
            a.product.name.localeCompare(b.product.name),
        ),
    [outlooks, lifecycle, matches],
  );

  const groups = useMemo(
    () =>
      lifecycle === 'finished' || lifecycle === 'all'
        ? finishedGroups(products.filter(matches))
        : [],
    [products, lifecycle, matches],
  );

  const monthlySpend = useMemo(
    () =>
      outlooks
        .filter((o) => o.lifecycle === 'in_use' && o.projection.costPerDay !== null)
        .reduce((total, o) => total + (o.projection.costPerDay ?? 0) * 30, 0),
    [outlooks],
  );

  /** Run a write, reload, and say what went wrong if it did. */
  const run = useCallback(
    async <T,>(write: () => Promise<T>, failure: string): Promise<T | undefined> => {
      setActionError(null);
      try {
        const result = await write();
        await reload();
        return result;
      } catch (e) {
        setActionError(messageOf(e, failure));
        return undefined;
      }
    },
    [reload],
  );

  const did = useCallback(
    async (write: () => Promise<void>, failure: string) =>
      (await run(async () => {
        await write();
        return true;
      }, failure)) === true,
    [run],
  );

  /** Log one use for today, then offer to take it back, naming the day. */
  const logToday = async (product: Product, quantity = product.per_use ?? 1) => {
    setBusyId(product.id);
    const saved = await run(() => api.logUse(product.id, quantity, today), 'Could not log that');
    setBusyId(null);
    if (!saved) return;
    toast.show({
      message: loggedMessage({ quantity, unit: product.unit, usedOn: today, name: product.name }),
      actionLabel: 'Undo',
      onAction: () => void did(() => api.deleteUse(saved.id), 'Could not undo that'),
    });
  };

  const toggleRow = async (row: ChecklistRow) => {
    if (!row.done) return logToday(row.product, row.amount);
    // The most recent use today - the one the tick most likely made.
    const latest = row.todayUses[0];
    setBusyId(row.product.id);
    const ok = await did(() => api.deleteUse(latest.id), 'Could not take that back');
    setBusyId(null);
    if (!ok) return;
    toast.show({
      message: removedMessage({
        quantity: latest.quantity,
        unit: row.product.unit,
        usedOn: latest.used_on,
        name: row.product.name,
      }),
      actionLabel: 'Undo',
      onAction: () =>
        void did(
          () => api.logUse(latest.product_id, latest.quantity, latest.used_on, latest.note).then(() => {}),
          'Could not undo that',
        ),
    });
  };

  const logAll = async () => {
    const open = checklist.filter((row) => !row.done);
    if (open.length === 0) return;
    setBusyId('all');
    const saved = await run(
      () =>
        api.logUses(
          open.map((row) => ({ productId: row.product.id, quantity: row.amount, usedOn: today })),
        ),
      'Could not log those',
    );
    setBusyId(null);
    if (!saved) return;
    toast.show({
      message: loggedAllMessage(saved.length),
      actionLabel: 'Undo',
      onAction: () => void did(() => api.deleteUses(saved.map((u) => u.id)), 'Could not undo that'),
    });
  };

  const reopen = (product: Product) =>
    void did(() => api.setFinished(product.id, null), 'Could not reopen that');

  const askDelete = async (product: Product) => {
    const count = await run(() => api.countUses(product.id), 'Could not check its history');
    if (count === undefined) return;
    setDeleting({ product, count });
  };

  const filtersActive = category !== 'any' || query.trim() !== '' || lifecycle !== 'in_use';

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
          : summary.toReorder > 0
            ? `${summary.toReorder} to reorder`
            : `${summary.inUse} in use`
      }
      actions={
        <div className="row">
          <Segmented
            value={lifecycle}
            onChange={setLifecycle}
            options={[
              { value: 'unopened', label: `Unopened${summary.spares ? ` ${summary.spares}` : ''}` },
              { value: 'in_use', label: 'In use' },
              { value: 'finished', label: 'Finished' },
              { value: 'all', label: 'All' },
            ]}
          />
          <button className="btn" onClick={() => setEditing({ kind: 'new' })}>
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
          {products.length > 0 ? (
            <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="stat-row">
                <Stat
                  label="To reorder"
                  value={summary.toReorder}
                  sub={summary.runningLow > 0 ? `${summary.runningLow} running low` : 'nothing running low'}
                  color={summary.toReorder > 0 ? 'var(--danger)' : undefined}
                />
                <Stat
                  label="Running cost"
                  value={formatMoney(monthlySpend, { compact: true })}
                  sub="a month, at your rate"
                />
                <Stat
                  label="In use"
                  value={summary.inUse}
                  sub={summary.spares > 0 ? `${summary.spares} spare${summary.spares === 1 ? '' : 's'} waiting` : 'no spares'}
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
                    setLifecycle('in_use');
                  }
                : undefined
            }
          />

          {lifecycle === 'in_use' && checklist.length > 0 && !needle && category === 'any' ? (
            <TodayPanel
              rows={checklist}
              busyId={busyId}
              onToggle={(row) => void toggleRow(row)}
              onLogAll={() => void logAll()}
            />
          ) : null}

          {visible.length === 0 && groups.length === 0 ? (
            <div className="card">
              <Empty
                icon="module"
                title={products.length === 0 ? 'Nothing tracked yet' : 'Nothing here'}
                message={
                  products.length === 0
                    ? 'Add a product with its size and how much you use at a time, then log each use. It works out the rest from what you actually use.'
                    : lifecycle === 'unopened'
                      ? 'No spares. Add one from a product when you buy ahead.'
                      : 'Try a different filter.'
                }
                action={
                  products.length === 0 ? (
                    <button className="btn" onClick={() => setEditing({ kind: 'new' })}>
                      <Icon name="plus" /> Add one
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : null}

          {visible.length > 0 ? (
            <div className="col" style={{ gap: 'var(--space-sm)' }}>
              {visible.map((outlook) => (
                <ProductRow
                  key={outlook.product.id}
                  outlook={outlook}
                  today={today}
                  busy={busyId === outlook.product.id}
                  onLog={() => void logToday(outlook.product)}
                  onHistory={() => setHistoryFor(outlook.product)}
                  onFinish={() => setFinishing(outlook)}
                  onOpen={() => setOpening(outlook.product)}
                  onSpare={() => setEditing({ kind: 'restock', from: outlook.product, spare: true })}
                  onEdit={() => setEditing({ kind: 'edit', product: outlook.product })}
                  onDelete={() => void askDelete(outlook.product)}
                />
              ))}
            </div>
          ) : null}

          {groups.length > 0 ? (
            <div className="col" style={{ gap: 'var(--space-sm)', marginTop: visible.length ? 'var(--space-xl)' : 0 }}>
              {lifecycle === 'all' ? <div className="overline">Finished</div> : null}
              {groups.map((group) => {
                const open = expanded === group.key;
                const latest = group.containers[0];
                return (
                  <div className="card card-pad" key={group.key}>
                    <button
                      className="row-between"
                      style={{ width: '100%', textAlign: 'left' }}
                      onClick={() => setExpanded(open ? null : group.key)}
                      aria-expanded={open}
                    >
                      <span className="row" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</span>
                        {group.containers.length > 1 ? (
                          <span className="pill numeric">×{group.containers.length}</span>
                        ) : null}
                        <span className="pill">{CATEGORY_LABEL[latest.category] ?? 'Other'}</span>
                      </span>
                      <span className="row faint" style={{ gap: 6, fontSize: 12 }}>
                        last finished {formatEventDate(latest.finished_on!)}
                        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
                      </span>
                    </button>

                    {open ? (
                      <div className="col" style={{ gap: 3, marginTop: 'var(--space-md)' }}>
                        {group.containers.map((container, index) => {
                          const lasted = lifespanDays(container);
                          return (
                            <div className="list-row bordered" key={container.id}>
                              <span className="numeric" style={{ fontSize: 12.5, minWidth: 150 }}>
                                {container.opened_on ? formatDayMonth(container.opened_on, today) : '—'} –{' '}
                                {formatDayMonth(container.finished_on!, today)}
                              </span>
                              <span className="numeric faint grow" style={{ fontSize: 12.5 }}>
                                {[
                                  lasted !== null ? `lasted ${lasted} ${lasted === 1 ? 'day' : 'days'}` : null,
                                  formatQuantity(container.total_quantity, container.unit),
                                  container.price_minor !== null ? formatMoney(container.price_minor) : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                              <div className="row-actions">
                                {index === 0 &&
                                !products.some(
                                  (p) => !p.finished_on && nameKey(p.name) === group.key,
                                ) ? (
                                  <button
                                    className="icon-btn"
                                    onClick={() => setEditing({ kind: 'restock', from: container, spare: false })}
                                    title="Start a new one"
                                    aria-label={`Start a new ${container.name}`}
                                  >
                                    <Icon name="repeat" size={14} />
                                  </button>
                                ) : null}
                                <button
                                  className="icon-btn"
                                  onClick={() => setHistoryFor(container)}
                                  title="Usage history"
                                  aria-label="Usage history"
                                >
                                  <Icon name="trend" size={14} />
                                </button>
                                <button
                                  className="icon-btn"
                                  onClick={() => reopen(container)}
                                  title="Reopen"
                                  aria-label="Reopen"
                                >
                                  <Icon name="reset" size={14} />
                                </button>
                                <button
                                  className="icon-btn"
                                  onClick={() => setEditing({ kind: 'edit', product: container })}
                                  aria-label="Edit"
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                                <button
                                  className="icon-btn danger"
                                  onClick={() => void askDelete(container)}
                                  aria-label="Delete"
                                >
                                  <Icon name="trash" size={14} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </>
      )}

      {editing ? (
        <ProductDialog
          target={editing}
          today={today}
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
          today={today}
          onClose={() => {
            setHistoryFor(null);
            void reload();
          }}
        />
      ) : null}

      {finishing ? (
        <DayDialog
          title={`Finished ${finishing.product.name}?`}
          question="When did it run out?"
          today={today}
          min={finishing.product.opened_on}
          detail={(day) => {
            if (!finishing.product.opened_on) return null;
            const days = Math.max(1, daysBetween(finishing.product.opened_on, day) + 1);
            return `It lasted ${days} ${days === 1 ? 'day' : 'days'}. That becomes the next one's first estimate.`;
          }}
          onClose={() => setFinishing(null)}
          actions={[
            {
              key: 'finish',
              label: 'Just mark it finished',
              className: 'btn btn-secondary',
              run: async (day) => {
                const product = finishing.product;
                const ok = await did(() => api.setFinished(product.id, day), 'Could not finish it');
                if (!ok) return false;
                setFinishing(null);
                toast.show({
                  message: `${product.name} finished ${onDay(day, today)}`,
                  actionLabel: 'Undo',
                  onAction: () => void did(() => api.setFinished(product.id, null), 'Could not undo that'),
                });
                return true;
              },
            },
            finishing.spare
              ? {
                  key: 'open-spare',
                  label: 'Finish and open the spare',
                  className: 'btn',
                  run: async (day) => {
                    const product = finishing.product;
                    const spare = finishing.spare!;
                    const ok = await did(
                      () => api.openSpare(spare.id, day, product.id),
                      'Could not open the spare',
                    );
                    if (!ok) return false;
                    setFinishing(null);
                    toast.show({
                      message: `Finished · the next ${product.name} is open`,
                      actionLabel: 'Undo',
                      onAction: () =>
                        void did(() => api.unopenSpare(spare.id, product.id), 'Could not undo that'),
                    });
                    return true;
                  },
                }
              : {
                  key: 'restock',
                  label: 'Finish and start a new one',
                  className: 'btn',
                  run: async (day) => {
                    const product = finishing.product;
                    const ok = await did(() => api.setFinished(product.id, day), 'Could not finish it');
                    if (!ok) return false;
                    setFinishing(null);
                    setEditing({ kind: 'restock', from: product, spare: false });
                    return true;
                  },
                },
          ]}
        />
      ) : null}

      {opening ? (
        <OpenSpareDialog
          spare={opening}
          replacing={activeSibling(opening, products)}
          today={today}
          onClose={() => setOpening(null)}
          onOpen={async (day, replacing) => {
            const spare = opening;
            const ok = await did(
              () => api.openSpare(spare.id, day, replacing?.id ?? null),
              'Could not open it',
            );
            if (!ok) return false;
            setOpening(null);
            toast.show({
              message: replacing
                ? `Opened ${onDay(day, today)} · the last one is finished`
                : `Opened ${onDay(day, today)}`,
              actionLabel: 'Undo',
              onAction: () =>
                void did(() => api.unopenSpare(spare.id, replacing?.id ?? null), 'Could not undo that'),
            });
            return true;
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteDialog
          product={deleting.product}
          count={deleting.count}
          onClose={() => setDeleting(null)}
          onFinishInstead={() => {
            const product = deleting.product;
            setDeleting(null);
            const outlook = outlooks.find((o) => o.product.id === product.id);
            if (outlook) setFinishing(outlook);
          }}
          onDelete={async () => {
            const product = deleting.product;
            const ok = await did(() => api.deleteProduct(product.id), 'Could not delete that');
            if (ok) setDeleting(null);
          }}
        />
      ) : null}

    </Shell>
  );
}

/* STATUS ------------------------------------------------------------------- */

function StatusChips({ chips }: { chips: Chip[] }) {
  return (
    <span className="row wrap" style={{ gap: 4 }}>
      {chips.map((chip) => (
        <span key={chip.kind} className={`pchip ${CHIP_LOOK[chip.kind].tone}`}>
          <Icon name={CHIP_LOOK[chip.kind].icon} size={12} strokeWidth={2.2} />
          {chip.label}
        </span>
      ))}
    </span>
  );
}

function SupplyBar({ outlook, color }: { outlook: Outlook; color: string }) {
  const marker = reorderMarker(outlook);
  return (
    <div className="supply" aria-hidden="true">
      <i style={{ width: `${Math.round(remainingFraction(outlook) * 1000) / 10}%`, background: color }} />
      {marker !== null ? <b style={{ left: `${Math.round(marker * 1000) / 10}%` }} /> : null}
    </div>
  );
}

/* ROWS --------------------------------------------------------------------- */

function ProductRow({
  outlook,
  today,
  busy,
  onLog,
  onHistory,
  onFinish,
  onOpen,
  onSpare,
  onEdit,
  onDelete,
}: {
  outlook: Outlook;
  today: string;
  busy: boolean;
  onLog: () => void;
  onHistory: () => void;
  onFinish: () => void;
  onOpen: () => void;
  onSpare: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { product, projection, lifecycle } = outlook;
  const chips = chipsFor(outlook, today);
  const color = CHIP_LOOK[supplyChip(chips).kind].color;
  const measured = projection.daysLeft !== null;

  const headline =
    lifecycle === 'unopened'
      ? 'Spare'
      : measured
        ? formatDaysLeft(projection.daysLeft)
        : outlook.estimate
          ? `~${formatDaysLeft(outlook.estimate.daysLeft)}`
          : projection.remaining <= 0
            ? 'Empty'
            : 'New';

  return (
    <div className="card card-pad">
      <div className="row-between wrap" style={{ gap: 'var(--space-md)' }}>
        <div className="grow" style={{ minWidth: 200 }}>
          <div className="row wrap" style={{ gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</span>
            <span className="pill">{CATEGORY_LABEL[product.category] ?? 'Other'}</span>
            <StatusChips chips={chips} />
          </div>
          <div className="faint numeric" style={{ fontSize: 12, marginTop: 4 }}>
            {lifecycle === 'unopened'
              ? `Not opened · ${formatQuantity(product.total_quantity, product.unit)}${
                  product.price_minor !== null ? ` · ${formatMoney(product.price_minor)}` : ''
                }`
              : `${formatQuantity(projection.remaining, product.unit)} left of ${formatQuantity(product.total_quantity, product.unit)} · opened ${formatEventDate(product.opened_on!)}`}
          </div>
        </div>

        <div style={{ textAlign: 'right', minWidth: 130 }}>
          <div
            className="numeric"
            style={{ fontWeight: 600, color: measured || lifecycle === 'unopened' ? color : 'var(--text-secondary)' }}
          >
            {headline}
          </div>
          <div className="faint numeric" style={{ fontSize: 11.5 }}>
            {lifecycle === 'unopened'
              ? outlook.useBy
                ? usableLabel(outlook.useBy, today)
                : 'waiting on the shelf'
              : projection.emptyOn
                ? `empty ${formatDayMonth(projection.emptyOn, today)}${
                    outlook.reorderOn && outlook.reorderOn > today && !outlook.spare
                      ? ` · reorder ${formatDayMonth(outlook.reorderOn, today)}`
                      : ''
                  }`
                : outlook.estimate
                  ? 'estimated'
                  : 'not enough data'}
          </div>
        </div>

        <div className="row" style={{ gap: 4 }}>
          {lifecycle === 'in_use' ? (
            <button className="btn btn-secondary btn-sm" onClick={onLog} disabled={busy}>
              {busy ? (
                <span className="spinner" />
              ) : (
                <>
                  <Icon name="plus" size={13} /> Log use
                </>
              )}
            </button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={onOpen}>
              <Icon name="box" size={13} /> Open it
            </button>
          )}

          <div className="row-actions">
            {lifecycle === 'in_use' ? (
              <>
                <button className="icon-btn" onClick={onHistory} title="Usage history" aria-label="Usage history">
                  <Icon name="trend" size={14} />
                </button>
                <button className="icon-btn" onClick={onSpare} title="Add a spare" aria-label="Add a spare">
                  <Icon name="box" size={14} />
                </button>
                <button className="icon-btn" onClick={onFinish} title="Mark finished" aria-label="Mark finished">
                  <Icon name="check" size={14} />
                </button>
              </>
            ) : null}
            <button className="icon-btn" onClick={onEdit} title="Edit" aria-label="Edit">
              <Icon name="edit" size={14} />
            </button>
            <button className="icon-btn danger" onClick={onDelete} title="Delete" aria-label="Delete">
              <Icon name="trash" size={14} />
            </button>
          </div>
        </div>
      </div>

      {lifecycle === 'in_use' ? (
        <div style={{ marginTop: 10 }}>
          <SupplyBar outlook={outlook} color={color} />
        </div>
      ) : null}

      {lifecycle === 'in_use' ? (
        <div className="faint numeric" style={{ fontSize: 11.5, marginTop: 6 }}>
          {projection.dailyRate !== null
            ? `${formatQuantity(Math.round(projection.dailyRate * 10) / 10, product.unit)} a day, measured over ${projection.daysOpen} days${
                projection.costPerDay !== null ? ` · ${formatMoney(projection.costPerDay)} a day` : ''
              }`
            : outlook.estimate
              ? estimateLabel(outlook.estimate, product.unit)
              : 'Log a couple of days of use to measure the rate'}
        </div>
      ) : null}

      {outlook.conflict ? (
        <div className="row secondary" style={{ gap: 6, fontSize: 12, marginTop: 6 }}>
          <Icon name="clock" size={13} style={{ color: 'var(--warning)' }} />
          {conflictMessage(outlook.conflict)}
        </div>
      ) : null}

      {outlook.spare && (outlook.urgency === 'critical' || outlook.urgency === 'soon') ? (
        <div className="row secondary" style={{ gap: 6, fontSize: 12, marginTop: 6 }}>
          <Icon name="box" size={13} style={{ color: 'var(--info)' }} />A spare is waiting, so there is nothing to
          reorder.
        </div>
      ) : null}
    </div>
  );
}

/* TODAY -------------------------------------------------------------------- */

function TodayPanel({
  rows,
  busyId,
  onToggle,
  onLogAll,
}: {
  rows: ChecklistRow[];
  busyId: string | null;
  onToggle: (row: ChecklistRow) => void;
  onLogAll: () => void;
}) {
  const remaining = rows.filter((row) => !row.done).length;
  return (
    <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
        <div>
          <div className="overline">Today</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {remaining === 0
              ? 'All logged'
              : `${rows.length - remaining} of ${rows.length} logged · things you used on 5 of the last 7 days`}
          </div>
        </div>
        {remaining > 0 ? (
          <button className="btn btn-sm" onClick={onLogAll} disabled={busyId === 'all'}>
            {busyId === 'all' ? <span className="spinner" /> : `Log all (${remaining})`}
          </button>
        ) : null}
      </div>
      <div className="col" style={{ gap: 3 }}>
        {rows.map((row) => (
          <div className={`list-row bordered${row.done ? ' done' : ''}`} key={row.product.id}>
            <button
              className={`check${row.done ? ' on' : ''}`}
              onClick={() => onToggle(row)}
              disabled={busyId === row.product.id}
              role="checkbox"
              aria-checked={row.done}
              aria-label={`${row.product.name}, ${formatQuantity(row.amount, row.product.unit)} today`}
            >
              {row.done ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
            </button>
            <span className="grow" style={{ fontSize: 13 }}>
              {row.product.name}
            </span>
            <span className="numeric muted" style={{ fontSize: 12.5 }}>
              {row.done ? 'logged · ' : ''}
              {formatQuantity(row.amount, row.product.unit)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* DAY DIALOGS -------------------------------------------------------------- */

/**
 * A day input with Today and Yesterday one click away, bounded to the days
 * that make sense. The arrow keys already step a native date field by a day.
 */
function DayInput({
  value,
  onChange,
  min,
  today,
  label = 'Day',
}: {
  value: string;
  onChange: (day: string) => void;
  min: string | null;
  today: string;
  label?: string;
}) {
  const yesterday = addDays(today, -1);
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <button
          type="button"
          className={`chip${value === today ? ' selected' : ''}`}
          onClick={() => onChange(today)}
          aria-pressed={value === today}
        >
          Today
        </button>
        {!min || yesterday >= min ? (
          <button
            type="button"
            className={`chip${value === yesterday ? ' selected' : ''}`}
            onClick={() => onChange(yesterday)}
            aria-pressed={value === yesterday}
          >
            Yesterday
          </button>
        ) : null}
        <input
          className="input"
          type="date"
          value={value}
          min={min ?? undefined}
          max={today}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 160 }}
          aria-label={`${label}, pick a date`}
        />
      </div>
    </div>
  );
}

type DialogAction = {
  key: string;
  label: string;
  className: string;
  run: (day: string) => Promise<boolean>;
};

function DayDialog({
  title,
  question,
  today,
  min,
  detail,
  actions,
  onClose,
}: {
  title: string;
  question: string;
  today: string;
  min: string | null;
  detail?: (day: string) => string | null;
  actions: DialogAction[];
  onClose: () => void;
}) {
  const [day, setDay] = useState(today);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = !!day && day <= today && (!min || day >= min);

  const go = async (action: DialogAction) => {
    if (!valid) {
      setError(min ? `Pick a day from ${formatEventDate(min)} to today.` : 'Pick a day up to today.');
      return;
    }
    setRunning(action.key);
    setError(null);
    const ok = await action.run(day);
    if (!ok) {
      setRunning(null);
      setError('That did not save. The reason is shown on the page.');
    }
  };

  const line = valid ? detail?.(day) : null;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {actions.map((action) => (
            <button
              key={action.key}
              className={action.className}
              onClick={() => void go(action)}
              disabled={running !== null}
            >
              {running === action.key ? <span className="spinner" /> : action.label}
            </button>
          ))}
        </>
      }
    >
      <DayInput value={day} onChange={setDay} min={min} today={today} label={question} />
      {line ? (
        <p className="secondary" style={{ fontSize: 13, marginTop: 'var(--space-md)' }}>
          {line}
        </p>
      ) : null}
      <ErrorBanner message={error} />
    </Modal>
  );
}

function OpenSpareDialog({
  spare,
  replacing,
  today,
  onOpen,
  onClose,
}: {
  spare: Product;
  replacing: Product | null;
  today: string;
  onOpen: (day: string, replacing: Product | null) => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <DayDialog
      title={`Open this ${spare.name}?`}
      question="When did you open it?"
      today={today}
      min={replacing?.opened_on ?? null}
      detail={(day) =>
        replacing ? `Your open ${spare.name} will be marked finished ${onDay(day, today)}.` : null
      }
      onClose={onClose}
      actions={[
        { key: 'open', label: 'Open it', className: 'btn', run: (day) => onOpen(day, replacing) },
      ]}
    />
  );
}

function DeleteDialog({
  product,
  count,
  onClose,
  onFinishInstead,
  onDelete,
}: {
  product: Product;
  count: number;
  onClose: () => void;
  onFinishInstead: () => void;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const canFinish = count > 0 && !!product.opened_on && !product.finished_on;
  return (
    <Modal
      open
      title={`Delete ${product.name}?`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {canFinish ? (
            <button className="btn btn-secondary" onClick={onFinishInstead}>
              Mark finished instead
            </button>
          ) : null}
          <button
            className="btn btn-danger"
            disabled={deleting}
            onClick={() => {
              setDeleting(true);
              void onDelete().finally(() => setDeleting(false));
            }}
          >
            {deleting ? <span className="spinner" /> : 'Delete'}
          </button>
        </>
      }
    >
      <p className="secondary">
        <strong>{deleteSummary(count)}</strong>{' '}
        {count > 0
          ? 'To keep its history - and how long it lasted, which the next one is estimated from - mark it finished instead. '
          : ''}
        This cannot be undone.
      </p>
    </Modal>
  );
}

/* PRODUCT DIALOG ----------------------------------------------------------- */

const PAO_OPTIONS = [3, 6, 12, 18, 24];
const LEAD_OPTIONS = [3, 7, 14, 21];

function ProductDialog({
  target,
  today,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  today: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = target.kind === 'edit' ? target.product : null;
  const from = target.kind === 'restock' ? target.from : null;
  const spare = target.kind === 'restock' && target.spare;

  // Editing starts from the row; a restock from the draft of the next
  // container, which keeps the product's facts and drops the tub's own.
  const initial: ProductInput | null = editing ?? (from ? restockDraft(from, today, spare) : null);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'other');
  const [unit, setUnit] = useState(initial?.unit ?? 'g');
  const [total, setTotal] = useState(initial ? String(initial.total_quantity) : '');
  const [perUse, setPerUse] = useState(initial?.per_use != null ? String(initial.per_use) : '');
  const [price, setPrice] = useState(
    initial?.price_minor != null ? minorToAmountString(initial.price_minor) : '',
  );
  const [unopened, setUnopened] = useState(initial ? !initial.opened_on : false);
  const [openedOn, setOpenedOn] = useState(initial?.opened_on ?? today);
  const [expiry, setExpiry] = useState(formatExpiryInput(initial?.expires_on ?? null));
  const [pao, setPao] = useState<number | null>(initial?.pao_months ?? null);
  const [lead, setLead] = useState<number | null>(initial?.reorder_lead_days ?? null);
  const [note, setNote] = useState(initial?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An open container with uses cannot go back to being a spare: its uses
  // would lose the opening day their rate counts from.
  const canBeSpare = !editing || !editing.opened_on;

  const parsed = parseExpiry(expiry);
  const useBy = parsed.ok
    ? usableUntil({
        opened_on: unopened ? null : openedOn,
        finished_on: null,
        expires_on: parsed.value,
        pao_months: pao,
      })
    : null;

  const size = Number(total.trim());
  const preview =
    from && !unopened && Number.isFinite(size) && size > 0
      ? priorEstimate(
          { ...from, id: 'draft', previous_id: from.id, finished_on: null, total_quantity: size, unit, opened_on: openedOn },
          from,
          today,
        )
      : null;

  const leadOptions = lead !== null && !LEAD_OPTIONS.includes(lead) ? [...LEAD_OPTIONS, lead].sort((a, b) => a - b) : LEAD_OPTIONS;

  const save = async () => {
    const totalValue = Number(total.trim());
    if (!name.trim()) return setError('Give it a name');
    if (!Number.isFinite(totalValue) || totalValue <= 0) return setError('How much is in it?');
    if (!parsed.ok) return setError('Write the expiry as printed: 03/2027, or 15/03/2027');
    if (!unopened && (!openedOn || openedOn > today)) return setError('Pick the day it was opened.');

    setSaving(true);
    setError(null);

    const input: ProductInput = {
      name: name.trim(),
      category,
      unit: unit.trim() || 'g',
      total_quantity: totalValue,
      per_use: perUse.trim() ? Number(perUse) : null,
      price_minor: price.trim() ? parseAmountToMinor(price) : null,
      opened_on: unopened ? null : openedOn,
      note: note.trim(),
      expires_on: parsed.value,
      pao_months: pao,
      reorder_lead_days: lead,
    };

    try {
      if (editing) await api.updateProduct(editing.id, input);
      else await api.createProduct({ ...input, previous_id: from?.id ?? null });
      onSaved();
    } catch (e) {
      setError(messageOf(e, 'Could not save that'));
      setSaving(false);
    }
  };

  const title = editing ? 'Edit product' : from ? (spare ? 'Add a spare' : 'Start a new one') : 'New product';
  const lastLasted = from ? lifespanDays(from) : null;

  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width={580}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : editing ? 'Save' : from ? (spare ? 'Add the spare' : 'Start it') : 'Add'}
          </button>
        </>
      }
    >
      {from ? (
        <div className="banner" style={{ background: 'var(--info-soft)', color: 'var(--info)', marginBottom: 'var(--space-md)' }}>
          <Icon name={spare ? 'box' : 'repeat'} size={15} style={{ marginTop: 1 }} />
          <span>
            {spare
              ? `A spare ${from.name}, bought ahead. While it waits there is nothing to reorder.`
              : preview
                ? `Starts with an estimate: ${estimateLabel(preview, unit)}.`
                : lastLasted !== null
                  ? `The last one lasted ${lastLasted} days.`
                  : `Copied from your ${from.name}.`}
          </span>
        </div>
      ) : null}

      <TextField
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Whey protein, face wash, sunscreen…"
        autoFocus
      />

      <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
        {PRODUCT_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </SelectField>

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
        hint={
          from && from.price_minor !== null
            ? `The last one cost ${formatMoney(from.price_minor)}. Change it if the price moved.`
            : 'Used to work out what it costs you a day.'
        }
      />

      {canBeSpare ? (
        <label className="row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={unopened} onChange={(e) => setUnopened(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Not opened yet</span>
          <span className="faint" style={{ fontSize: 12 }}>
            a spare, bought ahead
          </span>
        </label>
      ) : null}

      {!unopened ? (
        <div className="field">
          <span className="label">Opened on</span>
          <input
            className="input"
            type="date"
            value={openedOn}
            max={today}
            onChange={(e) => setOpenedOn(e.target.value)}
          />
        </div>
      ) : null}

      <div className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-start' }}>
        <TextField
          label="Expiry date"
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          placeholder="As printed: 03/2027"
          error={parsed.ok ? null : 'Write it as printed: 03/2027, or 15/03/2027'}
          style={{ flex: 1 }}
        />
        <SelectField
          label="Use within, once opened"
          value={pao === null ? '' : String(pao)}
          onChange={(e) => setPao(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Not printed</option>
          {PAO_OPTIONS.map((months) => (
            <option key={months} value={months}>
              {months} months ({months}M)
            </option>
          ))}
        </SelectField>
      </div>
      <div className="faint" style={{ fontSize: 12, marginTop: -6 }}>
        {useBy
          ? `Use by ${formatDayMonth(useBy, today)}${
              pao && parsed.ok && parsed.value ? ', the earlier of the printed date and the months after opening' : ''
            }.`
          : pao && unopened
            ? `${pao} months from the day you open it.`
            : 'Packs print month and year; a full date is day first.'}
      </div>

      <SelectField
        label="Remind me to reorder"
        value={String(lead ?? DEFAULT_LEAD_DAYS)}
        onChange={(e) => {
          const days = Number(e.target.value);
          setLead(days === DEFAULT_LEAD_DAYS ? null : days);
        }}
      >
        {leadOptions.map((days) => (
          <option key={days} value={days}>
            {days} days before it runs out
          </option>
        ))}
      </SelectField>

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

/**
 * A product's usage: log a use for any day, and see, correct or delete what
 * is logged.
 *
 * Corrections happen in place - day, amount and note on the row itself -
 * because a wrong entry skews the measured rate and deleting it to type it
 * again loses the note. Deleting removes only that one use, with an Undo
 * shown INSIDE the dialog: the page's toast would sit beneath a modal
 * <dialog>, its Undo out of reach.
 */
function HistoryDialog({
  product,
  today,
  onClose,
}: {
  product: Product;
  today: string;
  onClose: () => void;
}) {
  const load = useCallback(() => api.listUses(product.id), [product.id]);
  const { data, loading, error, reload } = useAsync(load, `uses-${product.id}`);

  const uses = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => groupByDay(uses), [uses]);
  const canLog = !!product.opened_on && !product.finished_on;

  const [usedOn, setUsedOn] = useState(today);
  const [amount, setAmount] = useState(String(product.per_use ?? 1));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; undo: () => Promise<unknown> } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ usedOn: '', amount: '', note: '' });

  const inRange = (day: string) => !!day && day <= today && (!product.opened_on || day >= product.opened_on);

  /** Run a write and reload. Resolves its result, or undefined when it failed. */
  const attempt = async <T,>(write: () => Promise<T>, failure: string): Promise<T | undefined> => {
    setActionError(null);
    try {
      const result = await write();
      await reload();
      return result;
    } catch (e) {
      setActionError(messageOf(e, failure));
      return undefined;
    }
  };

  const add = async () => {
    const quantity = Number(amount.trim());
    if (!Number.isFinite(quantity) || quantity <= 0) return setActionError('Enter how much you used.');
    // Before the opening date would inflate the measured rate, because the
    // days it is divided by start counting from opening.
    if (!inRange(usedOn)) {
      return setActionError(
        `Pick a day from ${formatEventDate(product.opened_on ?? today)} to today. Change the opened date first if it was earlier.`,
      );
    }

    setSaving(true);
    const logged = await attempt(
      () => api.logUse(product.id, quantity, usedOn, note.trim()),
      'Could not log that',
    );
    setSaving(false);
    if (!logged) return;
    setNotice({
      message: loggedMessage({ quantity, unit: product.unit, usedOn }),
      undo: () => api.deleteUse(logged.id),
    });
    // Back to today, so the next entry does not quietly land on the same past
    // day as this one.
    setUsedOn(today);
    setNote('');
  };

  const startEdit = (use: ProductUse) => {
    setEditingId(use.id);
    setDraft({ usedOn: use.used_on, amount: String(use.quantity), note: use.note });
  };

  const saveEdit = async (use: ProductUse) => {
    const quantity = Number(draft.amount.trim());
    if (!Number.isFinite(quantity) || quantity <= 0) return setActionError('Enter how much you used.');
    if (!inRange(draft.usedOn)) return setActionError('Pick a day between opening and today.');
    const changed = await attempt(
      () => api.updateUse(use.id, { used_on: draft.usedOn, quantity, note: draft.note.trim() }),
      'Could not save that',
    );
    if (!changed) return;
    setEditingId(null);
    setNotice({
      message: `Changed to ${formatQuantity(quantity, product.unit)} · ${formatEventDate(draft.usedOn)}`,
      undo: () => api.updateUse(use.id, { used_on: use.used_on, quantity: use.quantity, note: use.note }),
    });
  };

  const remove = async (use: ProductUse) => {
    const ok = await attempt(async () => {
      await api.deleteUse(use.id);
      return true;
    }, 'Could not delete that entry');
    if (!ok) return;
    setNotice({
      message: removedMessage({ quantity: use.quantity, unit: product.unit, usedOn: use.used_on }),
      undo: () => api.logUse(use.product_id, use.quantity, use.used_on, use.note),
    });
  };

  const undo = async () => {
    if (!notice) return;
    const current = notice;
    setNotice(null);
    await attempt(current.undo, 'Could not undo that');
  };

  return (
    <Modal open title={`${product.name} · usage`} onClose={onClose} width={560}>
      <ErrorBanner message={error ?? actionError} />

      {notice ? (
        <div
          className="row-between"
          role="status"
          style={{
            gap: 'var(--space-md)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--inverse-surface)',
            color: 'var(--on-inverse-surface)',
            marginBottom: 'var(--space-md)',
            fontSize: 13,
          }}
        >
          <span>{notice.message}</span>
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'var(--inverse-primary)' }}
            onClick={() => void undo()}
          >
            Undo
          </button>
        </div>
      ) : null}

      {canLog ? (
        <div className="card card-pad" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
            Log a use
          </div>
          <div className="col" style={{ gap: 'var(--space-sm)' }}>
            <DayInput value={usedOn} onChange={setUsedOn} min={product.opened_on} today={today} />
            <div className="row wrap" style={{ gap: 'var(--space-sm)', alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 110 }}>
                <span className="label">Amount ({product.unit})</span>
                <input
                  className="input numeric"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="field grow" style={{ minWidth: 120 }}>
                <span className="label">Note</span>
                <input
                  className="input"
                  value={note}
                  placeholder="Optional"
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void add();
                  }}
                />
              </div>
              <button className="btn" onClick={() => void add()} disabled={saving}>
                {saving ? <span className="spinner" /> : usedOn === today ? 'Log' : `Log for ${formatEventDate(usedOn)}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading && !data ? (
        <Spinner center />
      ) : groups.length === 0 ? (
        <Empty title="Nothing logged yet" message="Log a use and it appears here." />
      ) : (
        <div className="col" style={{ gap: 'var(--space-md)' }}>
          {groups.map((day) => (
            <div key={day.date}>
              <div className="row-between" style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{formatEventDate(day.date)}</span>
                <span className="numeric faint" style={{ fontSize: 12.5 }}>
                  {day.uses.length > 1 ? `${day.uses.length} uses · ` : ''}
                  {formatQuantity(day.total, product.unit)}
                </span>
              </div>
              <div className="col" style={{ gap: 3 }}>
                {day.uses.map((use) =>
                  editingId === use.id ? (
                    <div className="list-row bordered wrap" key={use.id} style={{ gap: 6 }}>
                      <input
                        className="input"
                        type="date"
                        value={draft.usedOn}
                        min={product.opened_on ?? undefined}
                        max={today}
                        onChange={(e) => setDraft({ ...draft, usedOn: e.target.value })}
                        aria-label="Day"
                        style={{ width: 150 }}
                      />
                      <input
                        className="input numeric"
                        inputMode="decimal"
                        value={draft.amount}
                        onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                        aria-label={`Amount in ${product.unit}`}
                        style={{ width: 80 }}
                      />
                      <input
                        className="input grow"
                        value={draft.note}
                        placeholder="Note"
                        onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void saveEdit(use);
                          if (e.key === 'Escape') {
                            // Esc closes the edit, not the whole dialog.
                            e.stopPropagation();
                            setEditingId(null);
                          }
                        }}
                        aria-label="Note"
                      />
                      <button className="btn btn-sm" onClick={() => void saveEdit(use)}>
                        Save
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="list-row bordered" key={use.id}>
                      <span className="numeric" style={{ fontSize: 12.5, minWidth: 72 }}>
                        {formatQuantity(use.quantity, product.unit)}
                      </span>
                      <span className="grow faint truncate" style={{ fontSize: 12.5 }}>
                        {use.note}
                      </span>
                      <div className="row-actions">
                        <button
                          className="icon-btn"
                          onClick={() => startEdit(use)}
                          aria-label={`Edit ${formatQuantity(use.quantity, product.unit)} on ${formatEventDate(use.used_on)}`}
                          title="Edit this entry"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        <button
                          className="icon-btn danger"
                          onClick={() => void remove(use)}
                          aria-label={`Delete ${formatQuantity(use.quantity, product.unit)} on ${formatEventDate(use.used_on)}`}
                          title="Delete this entry"
                        >
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
