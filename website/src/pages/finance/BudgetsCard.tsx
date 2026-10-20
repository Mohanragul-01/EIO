/**
 * BudgetsCard - each category's limit with its pace line, beside the ledger.
 *
 * The same budget.ts the phone uses: a tick where spending would be if spread
 * evenly over the month, the state in words beside the colour, and "₹2,340
 * left · ₹156/day for 15 days". Clicking a budget narrows the ledger to that
 * category and shows its six months (CategoryHistory).
 */
import { useState } from 'react';
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

import { EXPENSE_CATEGORIES, categoryDef } from '@app/core/categories';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import { BUDGET_STATE_WORDS, budgetLine, type BudgetStatus } from '@app/modules/finance/budget';
import { periodTitle, shortMonth, type Period } from '@app/modules/finance/period';
import type { Budget } from '@app/modules/finance/types';

import { TOOLTIP_STYLE } from '../../components/chart';
import { Icon } from '../../components/Icon';
import { ChipPicker, ErrorBanner, Modal, TextField } from '../../components/ui';

export type BudgetView = { budget: Budget; label: string; color: string; status: BudgetStatus };

const STATE_CLASS = { under: 'ok', over_pace: 'warn', over: 'bad' } as const;
const STATE_ICON = { under: 'check', over_pace: 'trend', over: 'alert' } as const;

export function BudgetMeter({ status }: { status: BudgetStatus }) {
  return (
    <div className="fin-budget-track">
      <i
        className={`fin-budget-fill ${STATE_CLASS[status.state]}`}
        style={{ width: `${status.fillShare * 100}%` }}
      />
      <i className="fin-budget-tick" style={{ left: `${Math.min(99.5, status.tickShare * 100)}%` }} />
    </div>
  );
}

export function BudgetsCard({
  budgets,
  activeCategory,
  onPick,
  onEdit,
  onAdd,
}: {
  budgets: BudgetView[];
  activeCategory: string | null;
  onPick: (category: string) => void;
  onEdit: (budget: Budget) => void;
  onAdd: () => void;
}) {
  return (
    <div className="card card-pad rise">
      <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
        <span className="overline">Budgets</span>
        {budgets.length < EXPENSE_CATEGORIES.length ? (
          <button className="btn btn-ghost btn-sm" onClick={onAdd}>
            <Icon name="plus" size={14} /> Set
          </button>
        ) : null}
      </div>

      {budgets.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
          Set a monthly limit for a category to see, mid-month, whether you are spending faster than
          the month is passing.
        </p>
      ) : (
        <div className="col" style={{ gap: 'var(--space-md)' }}>
          {budgets.map(({ budget, label, status }) => {
            const words = BUDGET_STATE_WORDS[status.state];
            return (
              <div key={budget.id} className={`fin-budget${activeCategory === budget.category ? ' on' : ''}`}>
                <button
                  type="button"
                  className="fin-budget-main"
                  onClick={() => onPick(budget.category)}
                  aria-pressed={activeCategory === budget.category}
                  aria-label={`${label} budget. ${words}. ${budgetLine(status)}. Show its entries and history.`}
                >
                  <span className="row-between" style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 550 }}>{label}</span>
                    <span className="numeric secondary">
                      {formatMoney(status.spentMinor, { compact: true })} of{' '}
                      {formatMoney(status.limitMinor, { compact: true })}
                    </span>
                  </span>
                  <BudgetMeter status={status} />
                  <span className="row-between" style={{ fontSize: 12 }}>
                    <span className={`fin-state ${STATE_CLASS[status.state]}`}>
                      <Icon name={STATE_ICON[status.state]} size={12} /> {words}
                    </span>
                    <span className="numeric faint">{budgetLine(status)}</span>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => onEdit(budget)}
                  aria-label={`Change the ${label} budget`}
                >
                  <Icon name="edit" size={14} />
                </button>
              </div>
            );
          })}
          <div className="row faint" style={{ gap: 6, fontSize: 11.5 }}>
            <span className="fin-tick-key" aria-hidden="true" /> where you would be spreading the limit evenly
          </div>
        </div>
      )}
    </div>
  );
}

/** One category's last six finance months, against its limit if it has one. */
export function CategoryHistory({
  category,
  history,
  limitMinor,
  onClear,
}: {
  category: string;
  history: { period: Period; spentMinor: number }[];
  limitMinor: number | null;
  onClear: () => void;
}) {
  const def = categoryDef(category);
  const data = history.map((h) => ({
    label: shortMonth(h.period),
    title: periodTitle(h.period),
    value: h.spentMinor,
  }));

  return (
    <div className="card card-pad rise">
      <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
        <span className="overline">{def.label} · last 6 months</span>
        <button className="btn btn-ghost btn-sm" onClick={onClear}>
          Show all
        </button>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value) => formatMoney(Number(value))}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'var(--surface-2)' }}
          />
          {limitMinor ? (
            <ReferenceLine
              y={limitMinor}
              stroke="var(--text-muted)"
              strokeDasharray="4 3"
              label={{ value: `Limit ${formatMoney(limitMinor, { compact: true })}`, fontSize: 10, fill: 'var(--text-muted)', position: 'insideTopRight' }}
            />
          ) : null}
          <Bar dataKey="value" name="Spent" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={d.label + i} fill={def.color} fillOpacity={i === data.length - 1 ? 1 : 0.55} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {/* The figures in words too, for anyone not reading bar heights. */}
      <div className="fin-history-figures numeric">
        {data.map((d) => (
          <span key={d.title}>
            {d.label} {formatMoney(d.value, { compact: true })}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BudgetDialog({
  budget,
  initialCategory,
  budgeted,
  spentByCategory,
  onClose,
  onSave,
  onRemove,
}: {
  budget: Budget | null;
  initialCategory: string | null;
  budgeted: Set<string>;
  spentByCategory: Map<string, number>;
  onClose: () => void;
  onSave: (category: string, amountMinor: number) => Promise<void>;
  onRemove: (budget: Budget) => void;
}) {
  const available = EXPENSE_CATEGORIES.filter((c) => !budgeted.has(c.key));
  const [category, setCategory] = useState(budget?.category ?? initialCategory ?? available[0]?.key ?? '');
  const [amount, setAmount] = useState(budget ? minorToAmountString(budget.amount_minor).replace(/\.00$/, '') : '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const label = categoryDef(category).label;

  const save = async () => {
    const minor = parseAmountToMinor(amount);
    if (!category) return setError('Pick a category');
    if (minor === null || minor <= 0) return setError('Enter a monthly limit like 5000');
    setSaving(true);
    setError(null);
    try {
      await onSave(category, minor);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that budget');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={budget ? `${label} budget` : 'Set a budget'}
      onClose={onClose}
      width={460}
      footer={
        <>
          {budget ? (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto', color: 'var(--danger)' }}
              onClick={() => {
                onClose();
                onRemove(budget);
              }}
            >
              Remove
            </button>
          ) : null}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      {!budget ? (
        <ChipPicker
          label="Category"
          value={category}
          onChange={setCategory}
          options={available.map((c) => ({ value: c.key, label: c.label, color: c.color }))}
        />
      ) : null}
      <TextField
        label="Monthly limit (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        placeholder="5000"
        autoFocus
        hint={
          category
            ? `${formatMoney(spentByCategory.get(category) ?? 0, { compact: true })} spent on ${label} so far this month. The same limit applies every month.`
            : undefined
        }
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save();
        }}
      />
      <ErrorBanner message={error} />
    </Modal>
  );
}
