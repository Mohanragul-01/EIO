/**
 * useHomeSummaries
 *
 * Turns each module's data into the one line its tile shows.
 *
 * Where this lives matters. The home screen is the composition root: it is
 * allowed to know about every module, because assembling them is its job.
 * Modules still know nothing about each other, and nothing here reaches back
 * into the home screen. Putting this inside any single module would have been
 * the thing that broke the rule.
 *
 * Everything runs through Promise.allSettled, so one failing module leaves a
 * blank line on its own tile rather than emptying the whole dashboard.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { formatMoney } from '../core/money';
import { daysUntil } from '../core/date';
import * as financeApi from '../modules/finance/api';
import { formatBalance, runningBalance } from '../modules/finance/analytics';
import * as fitnessApi from '../modules/fitness/api';
import * as notesApi from '../modules/notes/api';
import * as subscriptionsApi from '../modules/subscriptions/api';
import { toMonthlyMinor } from '../modules/subscriptions/types';
import * as todoApi from '../modules/todo/api';

/** Keyed by the module key from the registry. */
export type SummaryMap = Record<string, string>;

async function todoSummary(): Promise<string> {
  // Across every frequency tab: the tile speaks for the whole module, and a
  // count of just the Daily tab would read as the total and be wrong.
  const open = await todoApi.listOpenTodos();
  if (open.length === 0) return 'All clear';

  const overdue = open.filter((t) => t.due_date && daysUntil(t.due_date) < 0).length;
  // Overdue is the more urgent fact, so it wins the line when there is any.
  if (overdue > 0) return `${overdue} overdue, ${open.length} open`;
  return `${open.length} open`;
}

async function notesSummary(): Promise<string> {
  // Counts every kind, including journal entries. listNotes deliberately
  // excludes journals for the list view, so counting it would under-report.
  const { total, inbox } = await notesApi.notesOverview();
  if (total === 0) return 'Nothing yet';

  // An unfiled backlog is something to act on, so it wins the line.
  if (inbox > 0) return `${inbox} to file, ${total} total`;
  return `${total} ${total === 1 ? 'note' : 'notes'}`;
}

async function financeSummary(): Promise<string> {
  const now = new Date();
  // Both figures in parallel: the balance spans everything, the spend is this
  // month, and they answer different questions.
  const [rows, ledger] = await Promise.all([
    financeApi.listTransactions(now.getFullYear(), now.getMonth() + 1),
    financeApi.listLedgerPoints(),
  ]);

  const balance = formatBalance(runningBalance(ledger));
  if (rows.length === 0) return `${balance} balance`;

  const spent = rows
    .filter((t) => t.kind === 'expense')
    .reduce((total, t) => total + t.amount_minor, 0);
  // Balance first: it is the figure you actually act on. The month's spend is
  // context for it.
  return `${balance} left, ${formatMoney(spent, { compact: true })} out`;
}

async function subscriptionsSummary(): Promise<string> {
  const rows = await subscriptionsApi.listSubscriptions();
  const active = rows.filter((s) => s.is_active);
  if (active.length === 0) return 'Nothing tracked';

  // A renewal you have to act on beats the monthly total for attention.
  const dueSoon = active.filter((s) => {
    const days = daysUntil(s.next_due_date);
    return days >= 0 && days <= 7;
  }).length;
  const overdue = active.filter((s) => daysUntil(s.next_due_date) < 0).length;

  if (overdue > 0) return `${overdue} overdue`;
  if (dueSoon > 0) return `${dueSoon} due this week`;

  const monthly = active.reduce(
    (total, s) => total + toMonthlyMinor(s.amount_minor, s.billing_cycle),
    0,
  );
  return `${formatMoney(monthly, { compact: true })} a month`;
}

async function fitnessSummary(): Promise<string> {
  const workouts = await fitnessApi.listWorkouts();
  if (workouts.length === 0) return 'Nothing logged';

  const thisWeek = workouts.filter((w) => {
    const days = daysUntil(w.date);
    return days <= 0 && days > -7;
  }).length;

  if (thisWeek === 0) return 'None in 7 days';
  return `${thisWeek} this week`;
}

const LOADERS: Record<string, () => Promise<string>> = {
  todo: todoSummary,
  notes: notesSummary,
  finance: financeSummary,
  subscriptions: subscriptionsSummary,
  fitness: fitnessSummary,
};

export function useHomeSummaries() {
  const [summaries, setSummaries] = useState<SummaryMap>({});
  const [loading, setLoading] = useState(true);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const keys = Object.keys(LOADERS);
    // allSettled, not all: one module erroring must not blank the others.
    const results = await Promise.allSettled(keys.map((key) => LOADERS[key]()));

    if (!mounted.current) return;

    const next: SummaryMap = {};
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') next[keys[index]] = result.value;
    });

    setSummaries(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { summaries, loading, reload: load };
}
