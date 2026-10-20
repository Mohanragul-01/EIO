/**
 * FinancePage - the ledger, the month's figures, budgets and accounts on one
 * screen.
 *
 * The phone splits these across three tabs and a few screens, each a swipe or
 * a tap apart. On a monitor the point of a ledger is comparing the totals
 * against the rows that produced them, so the figures sit in a rail beside the
 * table: this month against last, the budgets and their pace, where it went,
 * the accounts and the trend.
 *
 * All of it comes from the app's own finance logic through @app, so the two
 * clients cannot disagree: transfers are never money in or out, "this month"
 * follows the month-start setting, and balances are worked out from the rows.
 *
 * Reversible actions - deleting an entry, logging a quick add, unpinning,
 * archiving an account, removing a budget - show Undo instead of asking first.
 * Deleting an empty account is permanent, so that one asks.
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

import { categoryDef } from '@app/core/categories';
import { formatEventDate, fromISODate, todayISO } from '@app/core/date';
import { formatMoney } from '@app/core/money';
import {
  describeTransfer,
  summarizeAccounts,
  type AccountBalance,
} from '@app/modules/finance/accounts';
import { exportFilename, formatBalance, monthlyTotals, toCsv } from '@app/modules/finance/analytics';
import * as api from '@app/modules/finance/api';
import { budgetHistory, budgetStatus } from '@app/modules/finance/budget';
import { quickAddAccount } from '@app/modules/finance/defaults';
import {
  longMonth,
  normalizeStartDay,
  periodBounds,
  periodOf,
  periodProgress,
  periodSubtitle,
  periodTitle,
  rangeContains,
  recentPeriods,
  shiftPeriod,
  shortMonth,
} from '@app/modules/finance/period';
import {
  compareToPrevious,
  deltaShort,
  deltaSpoken,
  searchTotals,
  searchTransactions,
  summarize,
  toListItems,
  type Delta,
  type ListItem,
} from '@app/modules/finance/summary';
import type { Budget, QuickAdd, TransactionKind } from '@app/modules/finance/types';

import { TOOLTIP_STYLE } from '../components/chart';
import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { Empty, ErrorBanner, Segmented, Spinner, Stat, useConfirm } from '../components/ui';
import { downloadCsv } from '../lib/download';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';
import { AccountDialog, AccountsCard } from './finance/AccountsCard';
import { BudgetDialog, BudgetsCard, CategoryHistory, type BudgetView } from './finance/BudgetsCard';
import { EntryDialog, type EntryTarget } from './finance/EntryDialog';
import { FinanceCalendar } from './finance/FinanceCalendar';
import { QuickAddDialog, SettingsDialog } from './finance/dialogs';

type SortKey = 'date' | 'amount' | 'category';

const itemDate = (item: ListItem) => (item.type === 'entry' ? item.tx.date : item.date);
const itemAmount = (item: ListItem) => (item.type === 'entry' ? item.tx.amount_minor : item.amountMinor);
const itemCategory = (item: ListItem) => (item.type === 'entry' ? categoryDef(item.tx.category).label : 'Transfer');

function describe(item: ListItem): string {
  if (item.type === 'transfer') return `${formatMoney(item.amountMinor, { compact: true })} transfer`;
  return `${formatMoney(item.tx.amount_minor, { compact: true })} · ${item.tx.note || categoryDef(item.tx.category).label}`;
}

/** "+18% vs Sep", or nothing. Neutral colour: the sign and the words say it. */
function DeltaLine({ delta, versus, versusLong }: { delta: Delta | null; versus: string; versusLong: string }) {
  if (!delta) return null;
  return (
    <span className="faint numeric" style={{ fontSize: 11.5 }} title={deltaSpoken(delta, versusLong)}>
      {deltaShort(delta, versus)}
    </span>
  );
}

export function FinancePage() {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const [offset, setOffset] = useState(0);
  /** Bumped after every write: part of each load's key, so it re-runs. */
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [entry, setEntry] = useState<EntryTarget | null>(null);
  const [accountDialog, setAccountDialog] = useState<{ balance: AccountBalance | null } | null>(null);
  const [budgetDialog, setBudgetDialog] = useState<{ budget: Budget | null; category: string | null } | null>(null);
  const [quickAddDialog, setQuickAddDialog] = useState<QuickAdd | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'desc' });
  /** Category to narrow the table to, set by the filter, a budget or the breakdown. */
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [kind, setKind] = useState<'any' | TransactionKind>('any');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'month' | 'all'>('month');

  useHotkeys({ onNew: () => setEntry({ mode: 'new' }) });

  const load = useCallback(async () => {
    // The month start decides which days "this month" is, so it is read first.
    const settings = await api.getSettings();
    const startDay = normalizeStartDay(settings.month_start_day);
    const today = todayISO();
    const period = shiftPeriod(periodOf(today, startDay), offset);
    const range = periodBounds(period, startDay);
    const [rows, points, accounts, budgets, quickAdds, recent] = await Promise.all([
      api.listTransactionsBetween(range),
      api.listLedgerPoints(),
      api.listAccounts(),
      api.listBudgets(),
      api.listQuickAdds(),
      api.listRecent(),
    ]);
    return { today, startDay, period, range, rows, points, accounts, budgets, quickAdds, recent };
  }, [offset]);

  const { data, loading, error } = useAsync(load, `finance-${offset}-${version}`);

  // An all-time search reads every row, so it only loads while one is typed.
  const searchingAll = scope === 'all' && query.trim() !== '';
  const loadAll = useCallback(
    () => (searchingAll ? api.listAllTransactions() : Promise.resolve(null)),
    [searchingAll],
  );
  const all = useAsync(loadAll, `finance-all-${searchingAll}-${version}`);

  // Memoised, not `data?.rows ?? []` inline: the fallback would be a new array
  // every render and every memo below would recompute on each keystroke.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const points = useMemo(() => data?.points ?? [], [data]);
  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const budgets = useMemo(() => data?.budgets ?? [], [data]);
  const recent = useMemo(() => data?.recent ?? [], [data]);
  const startDay = data?.startDay ?? 1;
  const today = data?.today ?? todayISO();
  const period = data?.period ?? shiftPeriod(periodOf(today, 1), offset);
  const previous = shiftPeriod(period, -1);
  const versus = shortMonth(previous);
  const versusLong = longMonth(previous);

  const accountsById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const accountsSummary = useMemo(() => summarizeAccounts(accounts, points), [accounts, points]);
  const summary = useMemo(() => summarize(rows), [rows]);

  // Plain numbers for the memos below: the period objects are rebuilt on
  // every render, and a memo keyed on them would never hold.
  const periodYear = period.year;
  const periodMonth = period.month;

  const previousSummary = useMemo(() => {
    const before = periodBounds(shiftPeriod({ year: periodYear, month: periodMonth }, -1), startDay);
    return summarize(points.filter((p) => rangeContains(before, p.date)));
  }, [points, periodYear, periodMonth, startDay]);

  const deltas = useMemo(() => {
    const prevBy = new Map(previousSummary.categoryTotals.map((c) => [c.key, c.totalMinor]));
    return {
      spent: compareToPrevious(summary.spentMinor, previousSummary.spentMinor),
      earned: compareToPrevious(summary.earnedMinor, previousSummary.earnedMinor),
      byCategory: new Map(summary.categoryTotals.map((c) => [c.key, compareToPrevious(c.totalMinor, prevBy.get(c.key) ?? 0)])),
    };
  }, [summary, previousSummary]);

  const trend = useMemo(() => monthlyTotals(points, 6, fromISODate(today), startDay), [points, today, startDay]);

  const budgetViews = useMemo<BudgetView[]>(() => {
    if (!data) return [];
    const progress = periodProgress(data.range, data.today);
    const spentBy = new Map(summary.categoryTotals.map((c) => [c.key, c.totalMinor]));
    const order = { over: 0, over_pace: 1, under: 2 } as const;
    return budgets
      .map((budget) => {
        const def = categoryDef(budget.category);
        return {
          budget,
          label: def.label,
          color: def.color,
          status: budgetStatus({ limitMinor: budget.amount_minor, spentMinor: spentBy.get(budget.category) ?? 0, progress }),
        };
      })
      .sort((a, b) => order[a.status.state] - order[b.status.state] || b.status.fillShare - a.status.fillShare);
  }, [data, budgets, summary]);

  const history = useMemo(
    () =>
      categoryFilter
        ? budgetHistory(points, categoryFilter, recentPeriods({ year: periodYear, month: periodMonth }, 6), startDay)
        : [],
    [categoryFilter, points, periodYear, periodMonth, startDay],
  );

  // THE TABLE -------------------------------------------------------------------

  const items = useMemo(() => {
    const source = searchingAll ? all.data ?? [] : rows;
    const needle = query.trim();
    const matched = needle ? searchTransactions(source, needle, accountsById) : source;
    const narrowed = matched.filter((t) => {
      if (kind !== 'any' && t.kind !== kind) return false;
      // A transfer has no spending category, so a category filter hides it.
      if (categoryFilter && t.category !== categoryFilter) return false;
      return true;
    });
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...toListItems(narrowed)].sort((a, b) => {
      if (sort.key === 'amount') return factor * (itemAmount(a) - itemAmount(b));
      if (sort.key === 'category') return factor * itemCategory(a).localeCompare(itemCategory(b));
      return factor * itemDate(a).localeCompare(itemDate(b));
    });
  }, [searchingAll, all.data, rows, query, accountsById, kind, categoryFilter, sort]);

  const filtersActive = kind !== 'any' || categoryFilter !== null || query.trim() !== '';
  const totals = searchTotals(items);

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'category' ? 'asc' : 'desc' },
    );

  // ACTIONS ---------------------------------------------------------------------

  /** Run a write; report a failure in the banner rather than throwing. */
  const attempt = async (action: () => Promise<void>, failure: string) => {
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : failure);
    }
  };

  const remove = (item: ListItem) =>
    attempt(async () => {
      const gone = item.type === 'entry' ? [item.tx] : item.rows;
      if (item.type === 'entry') await api.deleteTransaction(item.tx.id);
      else await api.deleteTransfer(item.groupId);
      refresh();
      toast.show({
        message: `Deleted ${describe(item)}`,
        actionLabel: 'Undo',
        onAction: () =>
          void attempt(async () => {
            await api.restoreTransactions(gone);
            refresh();
          }, 'Could not undo that'),
      });
    }, 'Could not delete that');

  const logQuickAdd = (quickAdd: QuickAdd) =>
    attempt(async () => {
      // The same rule as the phone's: the last-used account still in use.
      const accountId = quickAdd.account_id ?? quickAddAccount(quickAdd.kind, recent, accounts);
      const created = await api.createTransaction({
        amount_minor: quickAdd.amount_minor,
        kind: quickAdd.kind,
        category: quickAdd.category,
        note: quickAdd.note,
        date: todayISO(),
        account_id: accountId,
      });
      refresh();
      const account = accountId ? accountsById.get(accountId)?.name : null;
      toast.show({
        message: `Logged ${quickAdd.note} ${formatMoney(quickAdd.amount_minor, { compact: true })}${account ? ` · ${account}` : ''}`,
        actionLabel: 'Undo',
        onAction: () =>
          void attempt(async () => {
            await api.deleteTransaction(created.id);
            refresh();
          }, 'Could not undo that'),
      });
    }, 'Could not log that');

  const unpin = (quickAdd: QuickAdd) =>
    attempt(async () => {
      await api.deleteQuickAdd(quickAdd.id);
      refresh();
      toast.show({
        message: `Unpinned ${quickAdd.note}`,
        actionLabel: 'Undo',
        onAction: () =>
          void attempt(async () => {
            await api.restoreQuickAdd(quickAdd);
            refresh();
          }, 'Could not undo that'),
      });
    }, 'Could not unpin that');

  const removeBudget = (budget: Budget) =>
    attempt(async () => {
      await api.deleteBudget(budget.id);
      refresh();
      toast.show({
        message: `Removed the ${categoryDef(budget.category).label} budget`,
        actionLabel: 'Undo',
        onAction: () =>
          void attempt(async () => {
            await api.restoreBudget(budget);
            refresh();
          }, 'Could not undo that'),
      });
    }, 'Could not remove that budget');

  const setAccountActive = (account: { id: string; name: string }, active: boolean) =>
    attempt(async () => {
      await api.updateAccount(account.id, { is_active: active });
      refresh();
      toast.show({
        message: active ? `${account.name} is back` : `Archived ${account.name}`,
        actionLabel: 'Undo',
        onAction: () =>
          void attempt(async () => {
            await api.updateAccount(account.id, { is_active: !active });
            refresh();
          }, 'Could not undo that'),
      });
    }, 'Could not change that account');

  const deleteAccount = async (account: { id: string; name: string }) => {
    if (!(await confirm('Delete account', `"${account.name}" is deleted. This cannot be undone.`))) return;
    await attempt(async () => {
      await api.deleteAccount(account.id);
      refresh();
    }, 'Could not delete that account');
  };

  const exportCsv = () =>
    attempt(async () => {
      const all = await api.listForExport();
      if (all.length === 0) {
        setActionError('Nothing to export yet.');
        return;
      }
      // The same toCsv the phone shares to a file. Only the delivery differs.
      downloadCsv(exportFilename(), toCsv(all, (id) => accountsById.get(id)?.name ?? ''));
    }, 'Could not export');

  // CATEGORY FILTER OPTIONS: what is in this month, not the whole catalogue.
  const financeFilters: FilterSpec[] = [
    {
      key: 'kind',
      label: 'Kind',
      value: kind,
      onChange: (v) => setKind(v as 'any' | TransactionKind),
      options: [
        { value: 'any', label: 'In, out and moves' },
        { value: 'expense', label: 'Expenses' },
        { value: 'income', label: 'Income' },
        { value: 'transfer', label: 'Transfers' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      value: categoryFilter ?? 'any',
      onChange: (v) => setCategoryFilter(v === 'any' ? null : v),
      options: [
        { value: 'any', label: 'All categories' },
        ...[...new Set(rows.filter((t) => t.kind !== 'transfer').map((t) => t.category))]
          .map((key) => ({
            value: key,
            label: `${categoryDef(key).label} (${rows.filter((t) => t.category === key).length})`,
            dot: categoryDef(key).color,
          }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    },
  ];

  const range = data ? periodSubtitle(period, startDay) : null;
  const quickAdds = data?.quickAdds ?? [];
  const budgetFor = categoryFilter ? budgets.find((b) => b.category === categoryFilter) ?? null : null;

  return (
    <Shell
      title="Finance"
      subtitle={`${formatBalance(accountsSummary.netMinor)} across your accounts`}
      actions={
        <div className="row">
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Finance settings" title="Month start">
            <Icon name="sliders" />
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => void exportCsv()}>
            <Icon name="download" size={14} /> Export CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setEntry({ mode: 'new', kind: 'transfer' })}>
            <Icon name="swap" /> Transfer
          </button>
          <button className="btn" onClick={() => setEntry({ mode: 'new' })}>
            <Icon name="plus" /> New entry
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? all.error ?? actionError} />

      <div className="row-between fin-toolbar">
        <div className="row" style={{ gap: 'var(--space-sm)' }}>
          <button className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">
            <Icon name="chevronLeft" />
          </button>
          <span style={{ minWidth: 150, textAlign: 'center' }}>
            <span style={{ fontWeight: 600, display: 'block' }}>{periodTitle(period)}</span>
            {range ? <span className="faint numeric" style={{ fontSize: 11.5 }}>{range}</span> : null}
          </span>
          <button
            className="icon-btn"
            onClick={() => setOffset((o) => Math.min(0, o + 1))}
            disabled={offset === 0}
            aria-label="Next month"
          >
            <Icon name="chevronRight" />
          </button>
          {offset !== 0 ? (
            <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)}>
              This month
            </button>
          ) : null}
        </div>

        <div className="fin-quick" aria-label="Quick add">
          {quickAdds.length === 0 ? (
            <span className="faint" style={{ fontSize: 12 }}>
              Tick “Pin as a quick add” when adding an entry to log it here in one click.
            </span>
          ) : (
            quickAdds.map((q) => {
              const account = q.account_id ? accountsById.get(q.account_id)?.name : null;
              return (
                <span key={q.id} className="fin-quick-item">
                  <button
                    type="button"
                    className="fin-quick-log"
                    onClick={() => void logQuickAdd(q)}
                    title="Logs it today"
                  >
                    <Icon name="bolt" size={13} /> {q.note}{' '}
                    <span className="numeric">{formatMoney(q.amount_minor, { compact: true })}</span>
                    {account ? <span className="faint"> · {account}</span> : null}
                  </button>
                  <button
                    type="button"
                    className="fin-quick-edit"
                    onClick={() => setQuickAddDialog(q)}
                    aria-label={`Change or unpin ${q.note}`}
                  >
                    <Icon name="edit" size={12} />
                  </button>
                </span>
              );
            })
          )}
        </div>
      </div>

      <div className="split">
        {/* LEDGER --------------------------------------------------------- */}
        <div className="card rise" style={{ overflow: 'hidden' }}>
          <div className="fin-ledger-head">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'table', label: 'Entries' },
                { value: 'calendar', label: 'Calendar' },
              ]}
            />
          </div>

          {view === 'calendar' ? (
            <FinanceCalendar
              accountsById={accountsById}
              version={version}
              onOpen={(item) => setEntry({ mode: 'edit', item })}
              onAdd={(date) => setEntry({ mode: 'new', date })}
            />
          ) : (
            <>
              <div className="fin-filters">
                <FilterBar
                  search={{ value: query, onChange: setQuery, placeholder: 'Search notes, categories, accounts or an amount' }}
                  filters={financeFilters}
                  onReset={
                    filtersActive
                      ? () => {
                          setKind('any');
                          setCategoryFilter(null);
                          setQuery('');
                        }
                      : undefined
                  }
                  trailing={
                    <Segmented
                      value={scope}
                      onChange={setScope}
                      options={[
                        { value: 'month', label: 'This month' },
                        { value: 'all', label: 'All time' },
                      ]}
                    />
                  }
                />
                {filtersActive ? (
                  <div className="numeric" style={{ fontSize: 13, fontWeight: 550, margin: '0 var(--space-md) var(--space-sm)' }}>
                    {totals.count} {totals.count === 1 ? 'result' : 'results'}
                    {totals.outMinor > 0 ? ` · ${formatMoney(totals.outMinor, { compact: true })} spent` : ''}
                    {totals.inMinor > 0 ? ` · ${formatMoney(totals.inMinor, { compact: true })} received` : ''}
                    {scope === 'all' && query.trim() ? ' · all time' : ''}
                  </div>
                ) : null}
              </div>

              {(loading && !data) || (searchingAll && all.loading && !all.data) ? (
                <Spinner center />
              ) : items.length === 0 ? (
                <Empty
                  icon="finance"
                  title={filtersActive ? 'Nothing matches' : 'Nothing this month'}
                  message={
                    filtersActive
                      ? 'Try another word, or search all time.'
                      : 'Add an entry and it shows up here, in the figures, and in your budgets.'
                  }
                  action={
                    filtersActive ? undefined : (
                      <button className="btn" onClick={() => setEntry({ mode: 'new' })}>
                        <Icon name="plus" /> Add one
                      </button>
                    )
                  }
                />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th className="sortable" onClick={() => toggleSort('date')} aria-sort={sort.key === 'date' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          Date {sort.key === 'date' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                        </th>
                        <th className="sortable" onClick={() => toggleSort('category')} aria-sort={sort.key === 'category' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          Category {sort.key === 'category' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                        </th>
                        <th>Note</th>
                        <th>Account</th>
                        <th className="sortable num" onClick={() => toggleSort('amount')} aria-sort={sort.key === 'amount' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                          Amount {sort.key === 'amount' ? (sort.dir === 'asc' ? 'up' : 'down') : ''}
                        </th>
                        <th style={{ width: 76 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        if (item.type === 'transfer') {
                          return (
                            <tr key={item.key}>
                              <td className="faint" style={{ whiteSpace: 'nowrap' }}>{formatEventDate(item.date)}</td>
                              <td>
                                <span className="row secondary" style={{ gap: 6 }}>
                                  <Icon name="swap" size={13} /> Transfer
                                </span>
                              </td>
                              <td className="secondary truncate" style={{ maxWidth: 220 }}>{item.note || '—'}</td>
                              <td className="secondary truncate" style={{ maxWidth: 200 }}>
                                {describeTransfer(item.fromAccountId, item.toAccountId, accountsById)}
                              </td>
                              {/* No sign: a transfer is neither money in nor out. */}
                              <td className="num secondary" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                {formatMoney(item.amountMinor)}
                              </td>
                              <td>
                                <RowActions onEdit={() => setEntry({ mode: 'edit', item })} onDelete={() => void remove(item)} />
                              </td>
                            </tr>
                          );
                        }
                        const tx = item.tx;
                        const category = categoryDef(tx.category);
                        const income = tx.kind === 'income';
                        return (
                          <tr key={item.key}>
                            <td className="faint" style={{ whiteSpace: 'nowrap' }}>{formatEventDate(tx.date)}</td>
                            <td>
                              <span className="row" style={{ gap: 6 }}>
                                <span className="dot" style={{ background: category.color }} />
                                {category.label}
                              </span>
                            </td>
                            <td className="secondary truncate" style={{ maxWidth: 220 }}>{tx.note || '—'}</td>
                            <td className="secondary truncate" style={{ maxWidth: 160 }}>
                              {tx.account_id ? accountsById.get(tx.account_id)?.name ?? '—' : <span className="faint">No account</span>}
                            </td>
                            <td
                              className="num"
                              style={{ color: income ? 'var(--success)' : 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              {income ? '+' : '−'}
                              {formatMoney(tx.amount_minor)}
                            </td>
                            <td>
                              <RowActions onEdit={() => setEntry({ mode: 'edit', item })} onDelete={() => void remove(item)} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* RAIL --------------------------------------------------------- */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad rise">
            <div className="stat-row">
              <Stat
                label="Balance"
                value={formatBalance(accountsSummary.netMinor)}
                sub={accountsSummary.owedMinor > 0 ? `after ${formatMoney(accountsSummary.owedMinor, { compact: true })} owed` : 'Across your accounts'}
                color={accountsSummary.netMinor < 0 ? 'var(--danger)' : 'var(--success)'}
              />
            </div>
            <hr className="divider" style={{ margin: 'var(--space-lg) 0' }} />
            <div className="stat-row">
              <Stat
                label="Out"
                value={formatMoney(summary.spentMinor, { compact: true })}
                sub={<DeltaLine delta={deltas.spent} versus={versus} versusLong={versusLong} />}
              />
              <Stat
                label="In"
                value={formatMoney(summary.earnedMinor, { compact: true })}
                sub={<DeltaLine delta={deltas.earned} versus={versus} versusLong={versusLong} />}
                color="var(--success)"
              />
            </div>
            <p className="faint" style={{ fontSize: 11.5, margin: 'var(--space-md) 0 0' }}>
              Transfers between your accounts are not counted as in or out.
            </p>
          </div>

          {categoryFilter ? (
            <CategoryHistory
              category={categoryFilter}
              history={history}
              limitMinor={budgetFor?.amount_minor ?? null}
              onClear={() => setCategoryFilter(null)}
            />
          ) : null}

          <BudgetsCard
            budgets={budgetViews}
            activeCategory={categoryFilter}
            onPick={(category) => setCategoryFilter(categoryFilter === category ? null : category)}
            onEdit={(budget) => setBudgetDialog({ budget, category: budget.category })}
            onAdd={() => setBudgetDialog({ budget: null, category: null })}
          />

          {summary.categoryTotals.length > 0 ? (
            <div className="card card-pad rise">
              <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
                Where it went
              </div>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie data={summary.categoryTotals} dataKey="totalMinor" nameKey="label" innerRadius={0} outerRadius={78} stroke="none">
                    {summary.categoryTotals.map((slice) => (
                      <Cell key={slice.key} fill={slice.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>

              <div className="col" style={{ gap: 6, marginTop: 'var(--space-md)' }}>
                {summary.categoryTotals.slice(0, 9).map((slice) => {
                  const active = categoryFilter === slice.key;
                  const delta = deltas.byCategory.get(slice.key) ?? null;
                  return (
                    <button
                      key={slice.key}
                      className="fin-slice"
                      // Clicking the same one again clears it, so the control
                      // that applied the filter is also the one that removes it.
                      onClick={() => setCategoryFilter(active ? null : slice.key)}
                      aria-pressed={active}
                      style={{ background: active ? 'var(--surface-2)' : undefined, opacity: categoryFilter && !active ? 0.5 : 1 }}
                    >
                      <span className="row" style={{ gap: 6 }}>
                        <span className="dot" style={{ background: slice.color }} />
                        {slice.label}
                      </span>
                      <span className="numeric secondary">
                        {formatMoney(slice.totalMinor, { compact: true })}
                        <span className="faint"> · {Math.round(slice.share * 100)}%</span>
                        {delta ? <span className="faint"> · {deltaShort(delta, versus)}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <AccountsCard
            summary={accountsSummary}
            onEdit={(balance) => setAccountDialog({ balance })}
            onAdd={() => setAccountDialog({ balance: null })}
          />

          <div className="card card-pad rise">
            <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
              Last 6 months
            </div>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={trend} margin={{ top: 4, right: 0, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
                  axisLine={false}
                  tickLine={false}
                  // Paise to thousands of rupees: full paise values would need
                  // eight characters of axis.
                  tickFormatter={(v: number) => `${Math.round(v / 100000)}k`}
                />
                <Tooltip formatter={(value) => formatMoney(Number(value))} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="incomeMinor" name="In" fill="var(--success)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenseMinor" name="Out" fill="var(--accent-rose)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {entry ? (
        <EntryDialog
          target={entry}
          accounts={accounts}
          recent={recent}
          onClose={() => setEntry(null)}
          onSaved={(_message, stayOpen) => {
            refresh();
            if (!stayOpen) setEntry(null);
          }}
        />
      ) : null}

      {accountDialog ? (
        <AccountDialog
          balance={accountDialog.balance}
          onClose={() => setAccountDialog(null)}
          onSave={async (input) => {
            const existing = accountDialog.balance?.account;
            if (existing) await api.updateAccount(existing.id, input);
            else await api.createAccount(input, accounts.reduce((max, a) => Math.max(max, a.position), -1) + 1);
            refresh();
          }}
          onSetActive={(account, active) => void setAccountActive(account, active)}
          onDelete={(account) => void deleteAccount(account)}
        />
      ) : null}

      {budgetDialog ? (
        <BudgetDialog
          budget={budgetDialog.budget}
          initialCategory={budgetDialog.category}
          budgeted={new Set(budgets.map((b) => b.category))}
          spentByCategory={new Map(summary.categoryTotals.map((c) => [c.key, c.totalMinor]))}
          onClose={() => setBudgetDialog(null)}
          onSave={async (category, amountMinor) => {
            await api.saveBudget(category, amountMinor);
            refresh();
          }}
          onRemove={(budget) => void removeBudget(budget)}
        />
      ) : null}

      {quickAddDialog ? (
        <QuickAddDialog
          quickAdd={quickAddDialog}
          onClose={() => setQuickAddDialog(null)}
          onSave={async (id, patch) => {
            await api.updateQuickAdd(id, patch);
            refresh();
          }}
          onUnpin={(q) => void unpin(q)}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsDialog
          startDay={startDay}
          onClose={() => setSettingsOpen(false)}
          onSave={async (day) => {
            await api.saveMonthStartDay(day);
            setOffset(0);
            refresh();
          }}
        />
      ) : null}

      {confirmDialog}
    </Shell>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
      <button className="icon-btn" onClick={onEdit} aria-label="Edit">
        <Icon name="edit" />
      </button>
      {/* Undoable from the toast, so it does not ask first. */}
      <button className="icon-btn danger" onClick={onDelete} aria-label="Delete">
        <Icon name="trash" />
      </button>
    </div>
  );
}
