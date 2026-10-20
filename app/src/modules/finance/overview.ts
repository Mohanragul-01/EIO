/**
 * overview.ts - the three figures a home tile shows for Finance.
 *
 * The phone's tile and the website's dashboard card both say this, so it is
 * worked out once, from the same rules the Finance screen uses: the balance
 * across accounts (accounts.ts), this finance month's spending without
 * transfers (period.ts, summary.ts), and how many budgets are over.
 */
import { netBalance } from './accounts';
import { budgetStatus } from './budget';
import { periodBounds, periodOf, periodProgress, rangeContains } from './period';
import { expenseByCategory } from './summary';
import type { Account, Budget, LedgerPoint } from './types';

export type FinanceOverview = {
  balanceMinor: number;
  spentMinor: number;
  overBudget: number;
};

export function financeOverview({
  accounts,
  points,
  budgets,
  startDay,
  today,
}: {
  accounts: Account[];
  points: LedgerPoint[];
  budgets: Budget[];
  startDay: number;
  today: string;
}): FinanceOverview {
  const range = periodBounds(periodOf(today, startDay), startDay);
  const byCategory = expenseByCategory(points.filter((p) => rangeContains(range, p.date)));
  const spentMinor = Array.from(byCategory.values()).reduce((sum, v) => sum + v, 0);
  const progress = periodProgress(range, today);

  const overBudget = budgets.filter(
    (b) =>
      budgetStatus({ limitMinor: b.amount_minor, spentMinor: byCategory.get(b.category) ?? 0, progress })
        .state === 'over',
  ).length;

  return { balanceMinor: netBalance(accounts, points), spentMinor, overBudget };
}
