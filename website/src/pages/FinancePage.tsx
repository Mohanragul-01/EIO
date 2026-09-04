/**
 * FinancePage - balance, charts and the ledger, all on one screen.
 *
 * The phone stacks these: the balance card, then a pie, then a trend, then the
 * transaction list, each a scroll apart. On a monitor the whole point of a
 * ledger is comparing the total against the rows that produced it, so the
 * charts sit in a rail beside the table rather than above it.
 *
 * The table is also sortable, which the phone's list is not - sorting a list
 * you can only see six rows of is not much use, but sorting thirty visible
 * rows by amount answers "what did I actually spend on" immediately.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { categoriesFor, categoryDef } from '@app/core/categories';
import { formatEventDate, todayISO } from '@app/core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import {
  exportFilename,
  formatBalance,
  monthlyTotals,
  runningBalance,
  toCsv,
} from '@app/modules/finance/analytics';
import * as api from '@app/modules/finance/api';
import type { Transaction, TransactionInput, TransactionKind } from '@app/modules/finance/types';

import { Icon } from '../components/Icon';
import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Shell } from '../components/Shell';
import {
  ChipPicker,
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
import { downloadCsv } from '../lib/download';
import { TOOLTIP_STYLE } from '../components/chart';

type SortKey = 'date' | 'amount_minor' | 'category';

export function FinancePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'date',
    dir: 'desc',
  });
  const [actionError, setActionError] = useState<string | null>(null);
  /** Category to narrow the table to, set by the filter or by clicking the breakdown. */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [kind, setKind] = useState<'any' | TransactionKind>('any');
  const [query, setQuery] = useState('');
  const { confirm, dialog } = useConfirm();

  useHotkeys({ onNew: () => setEditing('new') });

  const load = useCallback(
    async () => {
      const [rows, ledger] = await Promise.all([
        api.listTransactions(year, month),
        api.listLedgerPoints(),
      ]);
      return { rows, ledger };
    },
    [year, month],
  );

  // The key says exactly what identifies this request, so changing month
  // refetches and nothing else does.
  const { data, loading, error, reload } = useAsync(load, `finance-${year}-${month}`);

  const rows = data?.rows ?? [];
  const ledger = data?.ledger ?? [];

  const balance = useMemo(() => runningBalance(ledger), [ledger]);
  const trend = useMemo(() => monthlyTotals(ledger, 6), [ledger]);

  const { spent, earned } = useMemo(
    () => ({
      spent: rows.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount_minor, 0),
      earned: rows.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount_minor, 0),
    }),
    [rows],
  );

  /** Expense breakdown for the pie. Income is excluded: mixing the two would
   *  make a slice chart of two opposite things. */
  const byCategory = useMemo(() => {
    const totals = new Map<string, number>();
    rows
      .filter((t) => t.kind === 'expense')
      .forEach((t) => totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount_minor));

    return [...totals.entries()]
      // categoryDef also has a `key`, so it is spread FIRST and ours wins.
      .map(([key, value]) => ({ ...categoryDef(key), key, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const sorted = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    // The filter narrows the TABLE only. The charts keep showing the whole
    // month, because they are the thing you are reading the filter against -
    // a pie that redrew to one slice would answer nothing.
    const needle = query.trim().toLowerCase();
    const visible = rows.filter((t) => {
      if (categoryFilter && t.category !== categoryFilter) return false;
      if (kind !== 'any' && t.kind !== kind) return false;
      if (needle) {
        // The category label as well as the note, so "food" finds the row even
        // when you never typed a note on it.
        const haystack = `${t.note} ${categoryDef(t.category).label}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    return [...visible].sort((a, b) => {
      if (sort.key === 'amount_minor') return factor * (a.amount_minor - b.amount_minor);
      if (sort.key === 'category') return factor * a.category.localeCompare(b.category);
      return factor * a.date.localeCompare(b.date);
    });
  }, [rows, sort, categoryFilter, kind, query]);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'category' ? 'asc' : 'desc' },
    );

  const shiftMonth = (delta: number) => {
    const date = new Date(year, month - 1 + delta, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
  };

  const remove = async (transaction: Transaction) => {
    if (!(await confirm('Delete transaction', `${formatMoney(transaction.amount_minor)} will be removed.`)))
      return;
    setActionError(null);
    try {
      await api.deleteTransaction(transaction.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  const exportCsv = async () => {
    setActionError(null);
    try {
      const all = await api.listForExport();
      if (all.length === 0) {
        setActionError('Nothing to export yet.');
        return;
      }
      // The same toCsv the phone shares to a file. Only the delivery differs:
      // a browser download instead of the OS share sheet.
      downloadCsv(exportFilename(), toCsv(all));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not export');
    }
  };

  const financeFiltersActive = kind !== 'any' || categoryFilter !== null || query.trim() !== '';

  /**
   * Category options come from what is in THIS month, not the whole catalogue.
   * Offering twelve categories when four were used makes the list mostly dead
   * ends, and the counts say how much is behind each one before you pick it.
   */
  const financeFilters: FilterSpec[] = [
    {
      key: 'kind',
      label: 'Kind',
      value: kind,
      onChange: (v) => setKind(v as 'any' | TransactionKind),
      options: [
        { value: 'any', label: 'In and out' },
        { value: 'expense', label: 'Expenses' },
        { value: 'income', label: 'Income' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      value: categoryFilter ?? 'any',
      onChange: (v) => setCategoryFilter(v === 'any' ? null : v),
      options: [
        { value: 'any', label: 'All categories' },
        ...[...new Set(rows.map((t) => t.category))]
          .map((key) => ({
            value: key,
            label: `${categoryDef(key).label} (${rows.filter((t) => t.category === key).length})`,
            dot: categoryDef(key).color,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    },
  ];

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Shell
      title="Finance"
      subtitle={`${formatBalance(balance)} all-time balance`}
      actions={
        <div className="row">
          <button className="btn btn-secondary btn-sm" onClick={() => void exportCsv()}>
            <Icon name="download" size={14} /> Export CSV
          </button>
          <button className="btn" onClick={() => setEditing('new')}>
            <Icon name="plus" /> New transaction
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      <FilterBar
        search={{ value: query, onChange: setQuery, placeholder: 'Search notes and categories' }}
        filters={financeFilters}
        onReset={
          financeFiltersActive
            ? () => {
                setKind('any');
                setCategoryFilter(null);
                setQuery('');
              }
            : undefined
        }
      />

      <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <Icon name="chevronLeft" />
          </button>
          <span style={{ fontWeight: 600, minWidth: 150, textAlign: 'center' }}>{monthLabel}</span>
          <button className="icon-btn" onClick={() => shiftMonth(1)} aria-label="Next month">
            <Icon name="chevronRight" />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setYear(now.getFullYear());
              setMonth(now.getMonth() + 1);
            }}
          >
            This month
          </button>
        </div>

      </div>

      <div className="split">
        {/* LEDGER ------------------------------------------------------- */}
        <div className="card rise" style={{ overflow: 'hidden' }}>
          {loading && !data ? (
            <Spinner center />
          ) : rows.length === 0 ? (
            <Empty
              icon="finance"
              title="Nothing this month"
              message="Add a transaction and it will show up here, in the charts, and in the running balance."
              action={
                <button className="btn" onClick={() => setEditing('new')}>
                  <Icon name="plus" /> Add one
                </button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => toggleSort('date')}>
                      Date {sort.key === 'date' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                    </th>
                    <th className="sortable" onClick={() => toggleSort('category')}>
                      Category {sort.key === 'category' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                    </th>
                    <th>Note</th>
                    <th className="sortable num" onClick={() => toggleSort('amount_minor')}>
                      Amount {sort.key === 'amount_minor' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                    </th>
                    <th style={{ width: 76 }} />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((transaction) => {
                    const category = categoryDef(transaction.category);
                    const income = transaction.kind === 'income';
                    return (
                      <tr key={transaction.id}>
                        <td className="faint" style={{ whiteSpace: 'nowrap' }}>
                          {formatEventDate(transaction.date)}
                        </td>
                        <td>
                          <span className="row" style={{ gap: 6 }}>
                            <span className="dot" style={{ background: category.color }} />
                            {category.label}
                          </span>
                        </td>
                        <td className="secondary truncate" style={{ maxWidth: 260 }}>
                          {transaction.note || '—'}
                        </td>
                        <td
                          className="num"
                          style={{
                            color: income ? 'var(--success)' : 'var(--text)',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {income ? '+' : '−'}
                          {formatMoney(transaction.amount_minor)}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                            <button
                              className="icon-btn"
                              onClick={() => setEditing(transaction)}
                              aria-label="Edit"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={() => void remove(transaction)}
                              aria-label="Delete"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RAIL --------------------------------------------------------- */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad rise">
            <div className="stat-row">
              <Stat
                label="Balance"
                value={formatBalance(balance)}
                sub="All time"
                color={balance < 0 ? 'var(--danger)' : 'var(--success)'}
              />
            </div>
            <hr className="divider" style={{ margin: 'var(--space-lg) 0' }} />
            <div className="stat-row">
              <Stat label="In" value={formatMoney(earned, { compact: true })} sub="This month" color="var(--success)" />
              <Stat label="Out" value={formatMoney(spent, { compact: true })} sub="This month" />
            </div>
          </div>

          {byCategory.length > 0 ? (
            <div className="card card-pad rise">
              <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
                Where it went
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={byCategory}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={0}
                    outerRadius={78}
                    stroke="none"
                  >
                    {byCategory.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatMoney(Number(value))}
                    contentStyle={TOOLTIP_STYLE}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="col" style={{ gap: 6, marginTop: 'var(--space-md)' }}>
                {byCategory.slice(0, 8).map((slice) => {
                  const active = categoryFilter === slice.key;
                  return (
                    <button
                      key={slice.key}
                      className="row-between"
                      // Clicking the same one again clears it, so the control
                      // that applied the filter is also the one that removes it.
                      onClick={() => setCategoryFilter(active ? null : slice.key)}
                      style={{
                        fontSize: 12.5,
                        width: '100%',
                        background: active ? 'var(--surface-2)' : 'none',
                        border: 0,
                        borderRadius: 'var(--radius-sm)',
                        padding: '3px 6px',
                        margin: '0 -6px',
                        textAlign: 'left',
                        opacity: categoryFilter && !active ? 0.5 : 1,
                      }}
                    >
                      <span className="row" style={{ gap: 6 }}>
                        <span className="dot" style={{ background: slice.color }} />
                        {slice.label}
                      </span>
                      <span className="numeric secondary">
                        {formatMoney(slice.value, { compact: true })}
                        <span className="faint">
                          {' '}
                          · {Math.round((slice.value / spent) * 100)}%
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="card card-pad rise">
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Last 6 months
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={trend} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  axisLine={false}
                  tickLine={false}
                  // Paise to rupees, then a compact label: full paise values
                  // would need eight characters of axis.
                  tickFormatter={(v: number) => `${Math.round(v / 100000)}k`}
                />
                <Tooltip
                  formatter={(value) => formatMoney(Number(value))}
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'var(--surface-2)' }}
                />
                <Bar dataKey="incomeMinor" name="In" fill="var(--success)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenseMinor" name="Out" fill="var(--accent-rose)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {editing ? (
        <TransactionDialog
          transaction={editing === 'new' ? null : editing}
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

function TransactionDialog({
  transaction,
  onClose,
  onSaved,
}: {
  transaction: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<TransactionKind>(transaction?.kind ?? 'expense');
  const [amount, setAmount] = useState(
    transaction ? minorToAmountString(transaction.amount_minor) : '',
  );
  const [category, setCategory] = useState(
    transaction?.category ?? categoriesFor(transaction?.kind ?? 'expense')[0].key,
  );
  const [note, setNote] = useState(transaction?.note ?? '');
  const [date, setDate] = useState(transaction?.date ?? todayISO());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const options = categoriesFor(kind);

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    // Expense and income have different category lists, so a category from the
    // old list would be saved against a kind that does not offer it.
    if (!categoriesFor(next).some((c) => c.key === category)) {
      setCategory(categoriesFor(next)[0].key);
    }
  };

  const save = async () => {
    const minor = parseAmountToMinor(amount);
    if (minor === null || minor <= 0) return setAmountError('Enter an amount above zero');

    setAmountError(null);
    setSaving(true);
    setError(null);

    const input: TransactionInput = { amount_minor: minor, kind, category, note: note.trim(), date };

    try {
      if (transaction) await api.updateTransaction(transaction.id, input);
      else await api.createTransaction(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={transaction ? 'Edit transaction' : 'New transaction'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : transaction ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <Segmented
        value={kind}
        onChange={changeKind}
        options={[
          { value: 'expense', label: 'Expense' },
          { value: 'income', label: 'Income' },
        ]}
      />

      <TextField
        label="Amount"
        value={amount}
        error={amountError}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        inputMode="decimal"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />

      <ChipPicker
        label="Category"
        value={category}
        onChange={setCategory}
        options={options.map((c) => ({ value: c.key, label: c.label, color: c.color }))}
      />

      <TextField
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional"
      />

      <div className="field">
        <span className="label">Date</span>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <ErrorBanner message={error} />
    </Modal>
  );
}
