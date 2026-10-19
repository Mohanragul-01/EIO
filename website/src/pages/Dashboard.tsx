/**
 * Dashboard - every module's headline, at once.
 *
 * The phone's home screen is a scrolling column of tiles you tap to open. Here
 * the sidebar already handles navigation, so the tiles stop being buttons and
 * become a status board: the point is reading all of it in one glance, which is
 * something a phone screen cannot offer.
 *
 * The summary lines are computed by the same logic the app's useHomeSummaries
 * uses, module by module, and each is loaded independently so one failing
 * module leaves a blank line on its own tile rather than emptying the board.
 */
import { useCallback } from 'react';
import { Link } from 'react-router-dom';

import { daysUntil, todayISO } from '@app/core/date';
import { formatMoney } from '@app/core/money';
import * as bucketApi from '@app/modules/bucket/api';
import { formatBalance } from '@app/modules/finance/analytics';
import * as financeApi from '@app/modules/finance/api';
import * as fitnessApi from '@app/modules/fitness/api';
import * as notesApi from '@app/modules/notes/api';
import * as productsApi from '@app/modules/products/api';
import { buildOutlooks, reorderSummary } from '@app/modules/products/outlook';
import * as subsApi from '@app/modules/subscriptions/api';
import { toMonthlyMinor } from '@app/modules/subscriptions/types';
import * as todoApi from '@app/modules/todo/api';

import { Icon, type IconName } from '../components/Icon';
import { Shell } from '../components/Shell';
import { Spinner } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useCustomModules } from '../modules/custom/useCustomModules';

/* SUMMARIES - the same rules as the app's useHomeSummaries. ----------------- */

async function todoSummary() {
  const open = await todoApi.listOpenTodos();
  if (open.length === 0) return { text: 'All clear', tone: 'ok' as const };

  const overdue = open.filter((t) => t.due_date && daysUntil(t.due_date) < 0).length;
  // Overdue is the more urgent fact, so it wins the line when there is any.
  if (overdue > 0) return { text: `${overdue} overdue`, sub: `${open.length} open`, tone: 'bad' as const };
  return { text: `${open.length} open`, tone: 'neutral' as const };
}

async function notesSummary() {
  const { total, inbox } = await notesApi.notesOverview();
  if (total === 0) return { text: 'Nothing yet', tone: 'neutral' as const };
  if (inbox > 0) return { text: `${inbox} to file`, sub: `${total} total`, tone: 'warn' as const };
  return { text: `${total} ${total === 1 ? 'note' : 'notes'}`, tone: 'neutral' as const };
}

async function financeSummary() {
  // Balance across accounts, and this finance month's spending with transfers
  // left out: the Finance page's own figures (finance/overview.ts).
  const { balanceMinor, spentMinor, overBudget } = await financeApi.loadOverview();
  const spent = `${formatMoney(spentMinor, { compact: true })} out this month`;

  return {
    text: formatBalance(balanceMinor),
    sub:
      overBudget > 0
        ? `${overBudget} over budget · ${spent}`
        : spentMinor === 0
          ? 'No spending this month'
          : spent,
    tone: balanceMinor < 0 ? ('bad' as const) : overBudget > 0 ? ('warn' as const) : ('ok' as const),
  };
}

async function subscriptionsSummary() {
  const rows = await subsApi.listSubscriptions();
  const active = rows.filter((s) => s.is_active);
  if (active.length === 0) return { text: 'Nothing tracked', tone: 'neutral' as const };

  const overdue = active.filter((s) => daysUntil(s.next_due_date) < 0).length;
  const dueSoon = active.filter((s) => {
    const days = daysUntil(s.next_due_date);
    return days >= 0 && days <= 7;
  }).length;

  const monthly = active.reduce(
    (total, s) => total + toMonthlyMinor(s.amount_minor, s.billing_cycle),
    0,
  );
  const perMonth = `${formatMoney(monthly, { compact: true })} a month`;

  if (overdue > 0) return { text: `${overdue} overdue`, sub: perMonth, tone: 'bad' as const };
  if (dueSoon > 0) return { text: `${dueSoon} due this week`, sub: perMonth, tone: 'warn' as const };
  return { text: perMonth, sub: `${active.length} active`, tone: 'neutral' as const };
}

async function fitnessSummary() {
  const sessions = await fitnessApi.listSessions();
  if (sessions.length === 0) return { text: 'Nothing logged', tone: 'neutral' as const };

  const thisWeek = sessions.filter((session) => {
    const days = daysUntil(session.date);
    return days <= 0 && days > -7;
  }).length;

  if (thisWeek === 0) return { text: 'None in 7 days', sub: `${sessions.length} total`, tone: 'warn' as const };
  return { text: `${thisWeek} this week`, sub: `${sessions.length} total`, tone: 'ok' as const };
}

async function bucketSummary() {
  const { total, done, freeLeft } = await bucketApi.overview();
  if (total === 0) return { text: 'Nothing yet', tone: 'neutral' as const };

  // The free ones are the actionable fact: what you could do this weekend
  // without spending anything. The total is context for it.
  if (freeLeft > 0) {
    return { text: `${freeLeft} free to do`, sub: `${done} of ${total} done`, tone: 'ok' as const };
  }
  return { text: `${done} of ${total} done`, tone: 'neutral' as const };
}

async function productsSummary() {
  const [products, uses] = await Promise.all([
    productsApi.listProducts(),
    productsApi.listAllUses(),
  ]);

  // The same outlook the Products page and the phone tile use, so "to
  // reorder" means one thing everywhere: Reorder now with no spare waiting.
  // (This tile used to count Running low too, and disagreed with the page.)
  const { toReorder, runningLow, inUse } = reorderSummary(buildOutlooks(products, uses, todayISO()));
  if (inUse === 0) return { text: 'Nothing tracked', tone: 'neutral' as const };

  if (toReorder > 0) {
    return { text: `${toReorder} to reorder`, sub: `${inUse} in use`, tone: 'warn' as const };
  }
  if (runningLow > 0) {
    return { text: `${inUse} in use`, sub: `${runningLow} running low`, tone: 'ok' as const };
  }
  return { text: `${inUse} in use`, sub: 'all stocked up', tone: 'ok' as const };
}

const TONE_COLOR = {
  ok: 'var(--success)',
  warn: 'var(--warning)',
  bad: 'var(--danger)',
  neutral: 'var(--text)',
} as const;

type Summary = { text: string; sub?: string; tone: keyof typeof TONE_COLOR };

const TILES: {
  key: string;
  title: string;
  icon: IconName;
  to: string;
  accent: string;
  load: () => Promise<Summary>;
}[] = [
  { key: 'todo', title: 'Tasks', icon: 'tasks', to: '/todo', accent: 'var(--accent-indigo)', load: todoSummary },
  { key: 'notes', title: 'Notes', icon: 'notes', to: '/notes', accent: 'var(--accent-amber)', load: notesSummary },
  { key: 'finance', title: 'Finance', icon: 'finance', to: '/finance', accent: 'var(--accent-emerald)', load: financeSummary },
  { key: 'subscriptions', title: 'Subscriptions', icon: 'subscriptions', to: '/subscriptions', accent: 'var(--accent-cyan)', load: subscriptionsSummary },
  { key: 'fitness', title: 'Fitness', icon: 'fitness', to: '/fitness', accent: 'var(--accent-rose)', load: fitnessSummary },
  { key: 'bucket', title: 'B-List', icon: 'flag', to: '/blist', accent: 'var(--accent-amber)', load: bucketSummary },
  { key: 'products', title: 'Products', icon: 'inbox', to: '/products', accent: 'var(--accent-cyan)', load: productsSummary },
];

export function Dashboard() {
  const { modules, summaries } = useCustomModules();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <Shell title="Dashboard" subtitle={greeting}>
      <div className="tile-grid">
        {TILES.map(({ key, ...tile }) => (
          // `key` is destructured out: React consumes it, and leaving it in the
          // spread would set a `key` prop as well as the reserved one.
          <ModuleTile key={key} {...tile} />
        ))}

        {modules.map((module) => {
          const summary = summaries[module.id];
          return (
            <Link
              key={module.id}
              to={`/m/${module.id}`}
              className="card card-pad card-hover"
              style={{ color: 'inherit' }}
            >
              <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
                <span className="overline">{module.name}</span>
                <span className="dot" style={{ background: module.color }} />
              </div>
              <div className="stat-value numeric">{summary?.text ?? '—'}</div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
                Your module
              </div>
            </Link>
          );
        })}
      </div>
    </Shell>
  );
}

function ModuleTile({
  title,
  icon,
  to,
  accent,
  load,
}: {
  title: string;
  icon: IconName;
  to: string;
  accent: string;
  load: () => Promise<Summary>;
}) {
  const loader = useCallback(() => load(), [load]);
  const { data, loading, error } = useAsync(loader, to);

  return (
    <Link
      to={to}
      className="card card-pad card-hover"
      style={{ color: 'inherit' }}
    >
      <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
        <span className="overline">{title}</span>
        <Icon name={icon} size={15} style={{ color: accent }} />
      </div>

      {loading ? (
        <Spinner />
      ) : error ? (
        // One module failing leaves a dash on its own tile. The others are
        // loaded separately and are unaffected.
        <div className="stat-value faint">—</div>
      ) : (
        <>
          <div className="stat-value numeric" style={{ color: TONE_COLOR[data?.tone ?? 'neutral'] }}>
            {data?.text}
          </div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
            {data?.sub ?? ''}
          </div>
        </>
      )}
    </Link>
  );
}
