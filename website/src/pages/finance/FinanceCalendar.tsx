/**
 * FinanceCalendar - the month as days, each with what it cost.
 *
 * The phone's Calendar tab on a monitor: each day prints its spend, tinted
 * against your usual spending day (summary.spendLevels), with a plus where
 * money came in. Click a day to list it beside the grid, with "Add for 16
 * Oct". A calendar month, not a finance month - it is a calendar.
 */
import { useCallback, useMemo, useState } from 'react';

import { monthBounds, todayISO } from '@app/core/date';
import { formatMoney } from '@app/core/money';
import { describeTransfer } from '@app/modules/finance/accounts';
import * as api from '@app/modules/finance/api';
import { formatRange, shortDate } from '@app/modules/finance/period';
import { dayTotals, spendLevels, summarize, toListItems, type ListItem } from '@app/modules/finance/summary';
import { categoryDef } from '@app/core/categories';
import type { Account } from '@app/modules/finance/types';

import { MonthCalendar } from '../../components/MonthCalendar';
import { Spinner } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';

/** "1.2k" - a day cell is narrow. */
function cellAmount(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100000) return `${(rupees / 100000).toFixed(rupees >= 1000000 ? 0 : 1)}L`;
  if (rupees >= 1000) return `${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}k`;
  return `${Math.round(rupees)}`;
}

export function FinanceCalendar({
  accountsById,
  version,
  onOpen,
  onAdd,
}: {
  accountsById: Map<string, Account>;
  /** Bumped by the page after any write, so the month reloads. */
  version: number;
  onOpen: (item: ListItem) => void;
  onAdd: (date: string) => void;
}) {
  const today = todayISO();
  const [view, setView] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => api.listTransactions(view.year, view.month), [view.year, view.month]);
  const { data, loading } = useAsync(load, `fin-cal-${view.year}-${view.month}-${version}`);

  const rows = useMemo(() => data ?? [], [data]);
  const totals = useMemo(() => dayTotals(rows), [rows]);
  const levels = useMemo(() => spendLevels(totals), [totals]);
  const month = useMemo(() => summarize(rows), [rows]);
  const dayItems = useMemo(
    () => (selected ? toListItems(rows.filter((r) => r.date === selected)) : []),
    [rows, selected],
  );

  return (
    <div className="fin-cal">
      <div>
        <MonthCalendar
          year={view.year}
          month={view.month}
          onChangeMonth={(year, m) => {
            setView({ year, month: m });
            setSelected(null);
          }}
          selected={selected}
          onSelect={setSelected}
          renderDay={(day) => {
            const total = totals.get(day.iso);
            const level = day.inMonth ? levels.get(day.iso) ?? 0 : 0;
            return (
              <span
                className={`fin-cal-day lvl-${level}${day.isToday ? ' today' : ''}${day.isSelected ? ' selected' : ''}`}
              >
                <span className="fin-cal-num">{Number(day.iso.slice(8))}</span>
                {day.inMonth && total?.outMinor ? <span className="fin-cal-amt">{cellAmount(total.outMinor)}</span> : null}
                {day.inMonth && total?.inMinor ? <span className="fin-cal-in" aria-hidden="true">+</span> : null}
              </span>
            );
          }}
          dayLabel={(day) => {
            const total = totals.get(day.iso);
            if (!total) return null;
            const parts: string[] = [];
            if (total.outMinor) parts.push(`${formatMoney(total.outMinor, { compact: true })} spent`);
            if (total.inMinor) parts.push(`${formatMoney(total.inMinor, { compact: true })} received`);
            return parts.join(', ') || null;
          }}
        />
        <p className="faint" style={{ fontSize: 12, margin: 'var(--space-sm) 0 0' }}>
          {formatRange(monthBounds(view.year, view.month))} · {formatMoney(month.spentMinor, { compact: true })} out
          {month.earnedMinor > 0 ? ` · ${formatMoney(month.earnedMinor, { compact: true })} in` : ''}. Darker days
          cost more than your usual spending day; + means money came in.
        </p>
      </div>

      <div className="fin-cal-side">
        {loading && !data ? (
          <Spinner center />
        ) : selected ? (
          <>
            <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
              <span style={{ fontWeight: 600 }}>{shortDate(selected)}</span>
              <button className="btn btn-sm" onClick={() => onAdd(selected)}>
                Add for {shortDate(selected)}
              </button>
            </div>
            {dayItems.length === 0 ? (
              <p className="faint" style={{ fontSize: 13 }}>Nothing on this day.</p>
            ) : (
              <div className="col" style={{ gap: 2 }}>
                {dayItems.map((item) => (
                  <button key={item.key} type="button" className="fin-account" onClick={() => onOpen(item)}>
                    <span className="truncate">
                      {item.type === 'transfer'
                        ? describeTransfer(item.fromAccountId, item.toAccountId, accountsById)
                        : item.tx.note || categoryDef(item.tx.category).label}
                    </span>
                    <span
                      className="numeric"
                      style={{
                        fontWeight: 600,
                        color:
                          item.type === 'entry' && item.tx.kind === 'income'
                            ? 'var(--success)'
                            : item.type === 'transfer'
                              ? 'var(--text-secondary)'
                              : undefined,
                      }}
                    >
                      {item.type === 'transfer'
                        ? formatMoney(item.amountMinor, { compact: true })
                        : `${item.tx.kind === 'income' ? '+' : '−'}${formatMoney(item.tx.amount_minor, { compact: true })}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="faint" style={{ fontSize: 13 }}>Click a day to see what it cost, or to add to it.</p>
        )}
      </div>
    </div>
  );
}
