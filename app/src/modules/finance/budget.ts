/**
 * budget.ts - a category budget, and how you are pacing against it.
 *
 * A budget that only shows a total tells you on the 28th that you overspent.
 * The pace marker tells you on the 12th that you are going to: a tick on the
 * bar at (days gone ÷ days in the month) × limit, which is where spending
 * would be if it were spread evenly. Money Manager draws the same line,
 * Cashew a per-day line, Wallet a forecast; all three converge on pace.
 *
 * THE STATES. On track: at or under the tick. Over pace: past the tick but not
 * past the limit - the month is not lost, but this rate will lose it. Over
 * budget: past the limit. Each has words (BUDGET_STATE_WORDS), because a green
 * or amber bar on its own says nothing to someone who cannot tell them apart.
 *
 * Works on a PeriodProgress from period.ts, so a salary-day month paces over
 * its own days, not the calendar's.
 */
import { formatMoney } from '../../core/money';
import { periodBounds, rangeContains, type Period, type PeriodProgress } from './period';
import type { LedgerPoint } from './types';

export type BudgetState = 'under' | 'over_pace' | 'over';

export const BUDGET_STATE_WORDS: Record<BudgetState, string> = {
  under: 'On track',
  over_pace: 'Over pace',
  over: 'Over budget',
};

export type BudgetStatus = {
  limitMinor: number;
  spentMinor: number;
  /** Where spending would be if spread evenly: the tick. */
  paceMinor: number;
  state: BudgetState;
  leftMinor: number;
  overMinor: number;
  /** Whole rupees a day that keep you inside the limit; null when there is no such figure. */
  perDayMinor: number | null;
  daysLeft: number;
  /** 0-1, how full the bar is. Capped: an overspend is shown in words, not a bar off the edge. */
  fillShare: number;
  /** 0-1, where the tick sits. */
  tickShare: number;
};

export function budgetStatus({
  limitMinor,
  spentMinor,
  progress,
}: {
  limitMinor: number;
  spentMinor: number;
  progress: PeriodProgress;
}): BudgetStatus {
  // A zero-day period cannot happen from period.ts, but a NaN tick would draw
  // the bar wrong without any error, so it is treated as a finished month.
  const tickShare = progress.days > 0 ? progress.elapsed / progress.days : 1;
  const paceMinor = Math.round(limitMinor * tickShare);

  const state: BudgetState =
    spentMinor > limitMinor ? 'over' : spentMinor > paceMinor ? 'over_pace' : 'under';

  const leftMinor = Math.max(0, limitMinor - spentMinor);
  const overMinor = Math.max(0, spentMinor - limitMinor);

  // Rounded DOWN to whole rupees: "₹156/day" is a figure you can follow, and
  // following it exactly never takes you over. ₹156.67 rounded to ₹157 would.
  const perDay =
    progress.daysLeft > 0 ? Math.floor(leftMinor / progress.daysLeft / 100) * 100 : 0;

  return {
    limitMinor,
    spentMinor,
    paceMinor,
    state,
    leftMinor,
    overMinor,
    perDayMinor: perDay > 0 ? perDay : null,
    daysLeft: progress.daysLeft,
    fillShare: limitMinor > 0 ? Math.min(1, spentMinor / limitMinor) : 1,
    tickShare,
  };
}

const money = (minor: number) => formatMoney(minor, { compact: true });

/** "₹2,340 left · ₹156/day for 15 days", or what applies instead. */
export function budgetLine(status: BudgetStatus): string {
  if (status.overMinor > 0) return `Over by ${money(status.overMinor)}`;
  if (status.leftMinor === 0) return 'Limit reached · ₹0 left';
  // A finished month has no days to spread anything over.
  if (status.daysLeft === 0) return `${money(status.leftMinor)} under the limit`;

  const days = `${status.daysLeft} ${status.daysLeft === 1 ? 'day' : 'days'}`;
  if (status.perDayMinor === null) return `${money(status.leftMinor)} left · ${days} to go`;
  return `${money(status.leftMinor)} left · ${money(status.perDayMinor)}/day for ${days}`;
}

/** One category's spending in each of the given finance months, oldest first. */
export function budgetHistory(
  points: LedgerPoint[],
  category: string,
  periods: Period[],
  startDay: number,
): { period: Period; spentMinor: number }[] {
  return periods.map((period) => {
    const range = periodBounds(period, startDay);
    const spentMinor = points.reduce(
      (sum, p) =>
        p.kind === 'expense' && p.category === category && rangeContains(range, p.date)
          ? sum + p.amount_minor
          : sum,
      0,
    );
    return { period, spentMinor };
  });
}
