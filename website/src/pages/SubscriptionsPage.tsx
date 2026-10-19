/**
 * SubscriptionsPage - what you pay, when it leaves, and where it goes.
 *
 * Three views, as on the phone: the list (a 14-day strip, then Overdue, This
 * week, This month, Later, Trials and Paused & ending, each with a count and
 * a total), a month calendar wide enough to name what renews in each day, and
 * insights for a week, month or year. Every rule - what a status means today,
 * what counts, how cycles and currencies work - is the app's, through @app;
 * this page only lays it out for a monitor.
 *
 * The headline figures follow the filters, so narrowing to one category or
 * one card says what that costs - the question you narrowed it to ask.
 *
 * Reminders are scheduled by the phone, not here: a browser cannot fire a
 * notification once its tab is closed. The defaults can be edited here, and
 * the phone picks them up the next time it opens.
 */
import { useCallback, useMemo, useState } from 'react';

import { categoryDef, DEFAULT_SUBSCRIPTION_CATEGORY } from '@app/core/categories';
import { addDaysISO, monthBounds, todayISO } from '@app/core/date';
import { formatMoney } from '@app/core/money';
import {
  archivePatch,
  cancelPatch,
  endTrialPatch,
  keepTrialPatch,
  pausePatch,
  restorePatch,
  resumePatch,
  snapshot,
  type ActionKey,
  type LifecyclePatch,
} from '@app/modules/subscriptions/actions';
import * as api from '@app/modules/subscriptions/api';
import { cycleLabel, cycleOf, cycleSuffix } from '@app/modules/subscriptions/cycles';
import { priceParts, shortDate } from '@app/modules/subscriptions/format';
import {
  PERIOD_LABEL,
  PERIODS,
  periodTotals,
  perItemYearly,
  type Period,
  type Share,
} from '@app/modules/subscriptions/insights';
import {
  BUCKET_LABEL,
  countdown,
  daysBetween,
  effectiveState,
  needsTrialDecision,
} from '@app/modules/subscriptions/lifecycle';
import { INCREASE_BADGE_DAYS, recentIncreases, type PriceStep } from '@app/modules/subscriptions/prices';
import { DEFAULT_REMINDER_SETTINGS } from '@app/modules/subscriptions/reminders';
import {
  channelLabel,
  type Account,
  type PriceChange,
  type Subscription,
} from '@app/modules/subscriptions/types';
import {
  monthCharges,
  projectedCharges,
  sections as toSections,
  summaryTotals,
  upcomingDays,
  type Charge,
} from '@app/modules/subscriptions/upcoming';

import { FilterBar, type FilterSpec } from '../components/FilterBar';
import { Icon } from '../components/Icon';
import { MonthCalendar } from '../components/MonthCalendar';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { Empty, ErrorBanner, Segmented, Spinner, Stat, useConfirm } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';
import {
  DateDialog,
  DetailDialog,
  MarkPaidDialog,
  ReminderDefaultsDialog,
  TrialDialog,
} from './subscriptions/Dialogs';
import { EditDialog } from './subscriptions/EditDialog';
import { BrandTile, TONE_COLOR } from './subscriptions/parts';

type ViewKey = 'list' | 'calendar' | 'insights';
type StatusFilter = 'all' | 'active' | 'trials' | 'paused' | 'archived';

type Dialog =
  | { kind: 'edit'; sub: Subscription | null }
  | { kind: 'detail'; id: string }
  | { kind: 'pay'; sub: Subscription }
  | { kind: 'cancel'; sub: Subscription }
  | { kind: 'pause'; sub: Subscription }
  | { kind: 'trial'; sub: Subscription }
  | { kind: 'settings' };

export function SubscriptionsPage() {
  const toast = useToast();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const today = todayISO();

  const load = useCallback(
    () =>
      Promise.all([
        api.listSubscriptions(),
        api.listAccounts().catch(() => [] as Account[]),
        api.getReminderSettings({ fresh: true }).catch(() => DEFAULT_REMINDER_SETTINGS),
        api.listRecentPriceChanges(addDaysISO(-INCREASE_BADGE_DAYS)).catch(() => [] as PriceChange[]),
      ]),
    [],
  );
  const { data, loading, error, reload } = useAsync(load, 'subscriptions');
  const [all, accounts, settings, changes] = data ?? [[], [], DEFAULT_REMINDER_SETTINGS, []];

  /** Bumped after every write, so payment views refetch. */
  const [version, setVersion] = useState(0);
  const [view, setView] = useState<ViewKey>('list');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [category, setCategory] = useState('any');
  const [account, setAccount] = useState('any');
  const [day, setDay] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useHotkeys({ onNew: () => setDialog({ kind: 'edit', sub: null }) });

  const accountName = useCallback(
    (id: string | null) => (id ? (accounts.find((a) => a.id === id)?.name ?? null) : null),
    [accounts],
  );
  const rises = useMemo(() => recentIncreases(changes, today), [changes, today]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return all.filter((s) => {
      const state = effectiveState(s, today);
      if (status === 'active' && state !== 'active') return false;
      if (status === 'trials' && state !== 'trial' && state !== 'trial_over') return false;
      if (status === 'paused' && state !== 'paused' && state !== 'ending') return false;
      if (status === 'archived' && state !== 'archived' && state !== 'ended') return false;
      if (category !== 'any' && (s.category || DEFAULT_SUBSCRIPTION_CATEGORY) !== category) return false;
      if (account !== 'any' && (s.account_id ?? '') !== account) return false;
      if (needle && !`${s.name} ${s.note}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, query, status, category, account, today]);

  const filtering = query.trim() !== '' || status !== 'all' || category !== 'any' || account !== 'any';
  const totals = useMemo(() => summaryTotals(filtered, today), [filtered, today]);
  const grouped = useMemo(() => toSections(filtered, today), [filtered, today]);
  const strip = useMemo(() => upcomingDays(filtered, today), [filtered, today]);
  const week = grouped.sections.find((s) => s.bucket === 'week');
  const overdue = grouped.sections.find((s) => s.bucket === 'overdue');

  /* ACTIONS -------------------------------------------------------------- */

  /** Close any dialog first: a dialog sits above the toast and hides its Undo. */
  const afterWrite = async () => {
    await reload();
    setVersion((v) => v + 1);
  };

  const patch = async (sub: Subscription, p: LifecyclePatch, message: string) => {
    setDialog(null);
    setActionError(null);
    try {
      const saved = await api.applyPatch(sub, p);
      await afterWrite();
      toast.show({
        message,
        actionLabel: 'Undo',
        onAction: () =>
          void api
            .applyPatch(saved, snapshot(sub))
            .then(afterWrite)
            .catch((e: unknown) => setActionError(e instanceof Error ? e.message : 'Could not undo that')),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update that');
    }
  };

  const pay = async (sub: Subscription, input: api.MarkPaidInput) => {
    setDialog(null);
    setActionError(null);
    try {
      const result = await api.markPaid(sub, input);
      await afterWrite();
      toast.show({
        message: result.logged
          ? `${sub.name} paid · ${formatMoney(input.amountInrMinor, { compact: true })}`
          : `Due date moved, but Finance did not get it: ${result.logError}`,
        actionLabel: 'Undo',
        durationMs: result.logged ? undefined : 8000,
        onAction: () =>
          void api
            .undoMarkPaid(result)
            .then(afterWrite)
            .catch((e: unknown) => setActionError(e instanceof Error ? e.message : 'Could not undo that')),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not mark that paid');
    }
  };

  const remove = async (sub: Subscription) => {
    setDialog(null);
    // The cascade is named before it happens.
    const count = await api.countPriceChanges(sub.id).catch(() => 0);
    const what = count > 0 ? `${sub.name} and its price history (${count} ${count === 1 ? 'change' : 'changes'})` : sub.name;
    const ok = await confirm(
      `Delete ${sub.name}?`,
      `This deletes ${what} for good. Payments already logged to Finance stay there. Archive keeps it out of the way instead, and can be undone.`,
    );
    if (!ok) return;
    try {
      await api.deleteSubscription(sub.id);
      await afterWrite();
      toast.show({ message: `${sub.name} deleted` });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  const removePriceChange = async (change: PriceChange) => {
    try {
      await api.deletePriceChange(change.id);
      await afterWrite();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not remove that');
    }
  };

  const run = (key: ActionKey, sub: Subscription) => {
    switch (key) {
      case 'pay':
        setDialog({ kind: 'pay', sub });
        return;
      case 'keep':
      case 'end_trial':
        setDialog({ kind: 'trial', sub });
        return;
      case 'cancel':
        setDialog({ kind: 'cancel', sub });
        return;
      case 'pause':
        setDialog({ kind: 'pause', sub });
        return;
      case 'resume':
        void patch(sub, resumePatch(sub, today), `${sub.name} resumed`);
        return;
      case 'restore':
        void patch(sub, restorePatch(sub, today), `${sub.name} restored`);
        return;
      case 'archive':
        void patch(sub, archivePatch(), `${sub.name} archived`);
        return;
      case 'open':
        setDialog({ kind: 'detail', id: sub.id });
        return;
      case 'edit':
        setDialog({ kind: 'edit', sub });
        return;
      case 'delete':
        void remove(sub);
        return;
    }
  };

  /* FILTERS -------------------------------------------------------------- */

  const filters: FilterSpec[] = [
    {
      key: 'status',
      label: 'State',
      value: status,
      onChange: (v) => setStatus(v as StatusFilter),
      options: [
        { value: 'all', label: 'Everything' },
        { value: 'active', label: 'Active' },
        { value: 'trials', label: 'Trials' },
        { value: 'paused', label: 'Paused & ending' },
        { value: 'archived', label: 'Archived & ended' },
      ],
    },
    {
      key: 'category',
      label: 'Category',
      value: category,
      onChange: setCategory,
      options: [
        { value: 'any', label: 'All categories' },
        ...[...new Set(all.map((s) => s.category || DEFAULT_SUBSCRIPTION_CATEGORY))]
          .map((key) => ({ value: key, label: categoryDef(key).label, dot: categoryDef(key).color }))
          .sort((a, b) => a.label.localeCompare(b.label)),
      ],
    },
    {
      key: 'account',
      label: 'Charged to',
      value: account,
      onChange: setAccount,
      options: [
        { value: 'any', label: 'Any account' },
        { value: '', label: 'No account' },
        ...accounts.map((a) => ({ value: a.id, label: a.name })),
      ],
    },
  ];

  /* RENDER --------------------------------------------------------------- */

  const detailSub = dialog?.kind === 'detail' ? all.find((s) => s.id === dialog.id) : undefined;
  const pickedDay = day ? strip.find((d) => d.iso === day) : undefined;

  return (
    <Shell
      title="Subscriptions"
      subtitle={
        loading && !data
          ? 'Loading'
          : `${formatMoney(totals.perMonthMinor, { compact: true })} a month · ${totals.count} active${filtering ? ' · filtered' : ''}`
      }
      actions={
        <>
          <button className="btn btn-secondary" onClick={() => setDialog({ kind: 'settings' })}>
            <Icon name="bell" /> Reminders
          </button>
          <button className="btn" onClick={() => setDialog({ kind: 'edit', sub: null })}>
            <Icon name="plus" /> New subscription
          </button>
        </>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      {loading && !data ? (
        <Spinner center />
      ) : all.length === 0 ? (
        <div className="card">
          <Empty
            icon="subscriptions"
            title="Nothing tracked yet"
            message="Add what renews on its own - streaming, your phone pack, cloud storage - and see when each leaves your account. Marking one paid logs it to Finance."
            action={
              <button className="btn" onClick={() => setDialog({ kind: 'edit', sub: null })}>
                <Icon name="plus" /> Add one
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="card card-pad rise" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="stat-row">
              <Stat label="Per month" value={formatMoney(totals.perMonthMinor, { compact: true })} sub="Every cycle normalised" />
              <Stat label="Per year" value={formatMoney(totals.perYearMinor, { compact: true })} sub={`${formatMoney(totals.perWeekMinor, { compact: true })} a week`} />
              <Stat
                label="Due this week"
                value={week ? formatMoney(week.totalMinor ?? 0, { compact: true }) : '₹0'}
                color={overdue ? 'var(--danger)' : undefined}
                sub={overdue ? `${overdue.count} overdue` : `${week?.count ?? 0} renewing`}
              />
              <Stat label="Active" value={totals.count} sub={totals.trialCount > 0 ? `${totals.trialCount} on trial, not counted` : 'No trials running'} />
            </div>
            {totals.missingRate > 0 ? (
              <p className="faint" style={{ margin: 'var(--space-md) 0 0', fontSize: 12.5, color: 'var(--warning)' }}>
                {totals.missingRate} foreign {totals.missingRate === 1 ? 'price has' : 'prices have'} no rate set, so{' '}
                {totals.missingRate === 1 ? 'it is' : 'they are'} left out of these totals.
              </p>
            ) : null}
          </div>

          <div className="row-between" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
            <Segmented
              options={[
                { value: 'list', label: 'List' },
                { value: 'calendar', label: 'Calendar' },
                { value: 'insights', label: 'Insights' },
              ]}
              value={view}
              onChange={(v) => setView(v as ViewKey)}
            />
          </div>

          <FilterBar
            search={{ value: query, onChange: setQuery, placeholder: 'Search subscriptions' }}
            filters={filters}
            onReset={
              filtering
                ? () => {
                    setQuery('');
                    setStatus('all');
                    setCategory('any');
                    setAccount('any');
                  }
                : undefined
            }
          />

          {view === 'list' ? (
            <>
              <section className="rise" style={{ marginBottom: 'var(--space-xl)' }} aria-label="Next 14 days">
                <span className="overline" style={{ display: 'block', marginBottom: 'var(--space-sm)' }}>
                  Next 14 days
                </span>
                <div className="sub-strip">
                  {strip.map((d, index) => {
                    const date = new Date(Number(d.iso.slice(0, 4)), Number(d.iso.slice(5, 7)) - 1, Number(d.iso.slice(8)));
                    const selected = day === d.iso;
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        className={`sub-day${index === 0 ? ' today' : ''}${selected ? ' selected' : ''}`}
                        onClick={() => setDay(selected ? null : d.iso)}
                        aria-pressed={selected}
                        aria-label={`${index === 0 ? 'Today, ' : ''}${date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}, ${
                          d.charges.length === 0
                            ? 'nothing due'
                            : `${d.charges.length} ${d.charges.length === 1 ? 'renewal' : 'renewals'}${d.totalMinor > 0 ? `, ${formatMoney(d.totalMinor, { compact: true })}` : ''}`
                        }`}
                      >
                        <span className="sub-day-weekday">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                        <span className="sub-day-number">{date.getDate()}</span>
                        <span className="sub-day-tiles">
                          {d.charges.slice(0, 3).map((c, i) => (
                            <BrandTile key={`${c.sub.id}-${i}`} sub={c.sub} size={16} />
                          ))}
                        </span>
                        <span className="sub-day-meta">
                          {d.totalMinor > 0 ? formatMoney(d.totalMinor, { compact: true }) : d.charges.length > 3 ? `+${d.charges.length - 3}` : ' '}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {pickedDay ? (
                <section className="rise">
                  <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                    <span className="column-title">{shortDate(pickedDay.iso, today)}</span>
                    <span className="column-count">{pickedDay.charges.length}</span>
                    <span className="faint numeric" style={{ fontSize: 12.5 }}>
                      {formatMoney(pickedDay.totalMinor, { compact: true })}
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDay(null)} style={{ marginLeft: 'auto' }}>
                      Show all
                    </button>
                  </div>
                  <div className="col" style={{ gap: 'var(--space-sm)' }}>
                    {pickedDay.charges.length === 0 ? (
                      <p className="faint">Nothing renews that day.</p>
                    ) : (
                      pickedDay.charges.map((c, i) => (
                        <Row key={`${c.sub.id}-${i}`} sub={c.sub} today={today} accountName={accountName(c.sub.account_id)} rise={rises.get(c.sub.id)} onAction={run} />
                      ))
                    )}
                  </div>
                </section>
              ) : grouped.sections.length === 0 && grouped.archived.length === 0 ? (
                <div className="card">
                  <Empty icon="search" title="Nothing matches" message="Change or clear the filters above." />
                </div>
              ) : (
                <div className="col" style={{ gap: 'var(--space-2xl)' }}>
                  {grouped.sections.map((section) => (
                    <section key={section.bucket} className="rise">
                      <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                        {section.bucket === 'overdue' ? <Icon name="alert" size={14} style={{ color: 'var(--danger)' }} /> : null}
                        <span className="column-title" style={section.bucket === 'overdue' ? { color: 'var(--danger)' } : undefined}>
                          {BUCKET_LABEL[section.bucket]}
                        </span>
                        <span className="column-count">{section.count}</span>
                        {section.totalMinor === null ? null : (
                          <span className="faint numeric" style={{ fontSize: 12.5 }}>
                            {formatMoney(section.totalMinor, { compact: true })}
                          </span>
                        )}
                      </div>
                      <div className="col" style={{ gap: 'var(--space-sm)' }}>
                        {section.items.map((sub) => (
                          <Row key={sub.id} sub={sub} today={today} accountName={accountName(sub.account_id)} rise={rises.get(sub.id)} onAction={run} />
                        ))}
                      </div>
                    </section>
                  ))}

                  {grouped.archived.length > 0 ? (
                    <section>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowArchived(!showArchived)}
                        aria-expanded={showArchived}
                      >
                        <Icon name="archive" /> Archived & ended ({grouped.archived.length})
                        <Icon name={showArchived ? 'chevronUp' : 'chevronDown'} />
                      </button>
                      {showArchived ? (
                        <div className="col" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
                          {grouped.archived.map((sub) => (
                            <Row key={sub.id} sub={sub} today={today} accountName={accountName(sub.account_id)} rise={null} onAction={run} />
                          ))}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              )}
            </>
          ) : view === 'calendar' ? (
            <CalendarPanel subs={filtered} today={today} version={version} onOpen={(sub) => run('open', sub)} />
          ) : (
            <InsightsPanel subs={filtered} today={today} version={version} accountName={accountName} onOpen={(sub) => run('open', sub)} />
          )}
        </>
      )}

      {dialog?.kind === 'edit' ? (
        <EditDialog
          subscription={dialog.sub}
          accounts={accounts}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            void afterWrite();
          }}
        />
      ) : null}
      {dialog?.kind === 'detail' && detailSub ? (
        <DetailDialog
          sub={detailSub}
          accounts={accounts}
          settings={settings}
          today={today}
          version={version}
          onClose={() => setDialog(null)}
          onAction={run}
          onRemovePriceChange={(change) => void removePriceChange(change)}
        />
      ) : null}
      {dialog?.kind === 'pay' ? (
        <MarkPaidDialog
          sub={dialog.sub}
          accounts={accounts}
          today={today}
          onClose={() => setDialog(null)}
          onConfirm={(input) => void pay(dialog.sub, input)}
        />
      ) : null}
      {dialog?.kind === 'cancel' ? (
        <DateDialog
          title={`Cancel ${dialog.sub.name}`}
          message="When does your access end? It stays in your totals until then, and no renewal reminder fires."
          label="Access until"
          initial={dialog.sub.next_due_date}
          required
          confirmLabel="Mark as cancelled"
          onClose={() => setDialog(null)}
          onConfirm={(date) => {
            if (date) void patch(dialog.sub, cancelPatch(date), `${dialog.sub.name} cancelled · access until ${shortDate(date, today)}`);
          }}
        />
      ) : null}
      {dialog?.kind === 'pause' ? (
        <DateDialog
          title={`Pause ${dialog.sub.name}`}
          message="Paused subscriptions leave your totals. With a date, it charges again that day and the phone reminds you first; without one, it waits for you to resume it."
          label="Resumes on (optional)"
          initial=""
          required={false}
          confirmLabel="Pause"
          onClose={() => setDialog(null)}
          onConfirm={(date) =>
            void patch(
              dialog.sub,
              pausePatch(dialog.sub, date),
              date ? `${dialog.sub.name} paused until ${shortDate(date, today)}` : `${dialog.sub.name} paused`,
            )
          }
        />
      ) : null}
      {dialog?.kind === 'trial' ? (
        <TrialDialog
          sub={dialog.sub}
          today={today}
          onClose={() => setDialog(null)}
          onKeep={() => void patch(dialog.sub, keepTrialPatch(dialog.sub), `Keeping ${dialog.sub.name}`)}
          onCancelled={() => void patch(dialog.sub, endTrialPatch(dialog.sub), `${dialog.sub.name} trial ended`)}
        />
      ) : null}
      {dialog?.kind === 'settings' ? (
        <ReminderDefaultsDialog
          settings={settings}
          onClose={() => setDialog(null)}
          onSave={async (next) => {
            setDialog(null);
            try {
              await api.saveReminderSettings(next);
              await reload();
              toast.show({ message: 'Reminder defaults saved. The phone applies them next time it opens.' });
            } catch (e) {
              setActionError(e instanceof Error ? e.message : 'Could not save those');
            }
          }}
        />
      ) : null}

      {confirmDialog}
    </Shell>
  );
}

/* ROW ---------------------------------------------------------------------- */

function Row({
  sub,
  today,
  accountName,
  rise,
  onAction,
}: {
  sub: Subscription;
  today: string;
  accountName: string | null;
  rise: PriceStep | null | undefined;
  onAction: (key: ActionKey, sub: Subscription) => void;
}) {
  const state = effectiveState(sub, today);
  const cycle = cycleOf(sub);
  const price = priceParts(sub);
  const due = countdown(sub, today);
  const charged = accountName ?? channelLabel(sub.charge_channel);
  const secondLine =
    state === 'trial' || state === 'trial_over'
      ? `Trial · then ${price.main} ${cycleSuffix(cycle)}`
      : [categoryDef(sub.category).label, cycleLabel(cycle), charged].filter(Boolean).join(' · ');
  const payable = state === 'active' && daysBetween(today, sub.next_due_date) <= 7;
  const decide = needsTrialDecision(sub, today);

  return (
    <div className="list-row bordered">
      <BrandTile sub={sub} size={32} />

      <button
        type="button"
        className="grow"
        onClick={() => onAction('open', sub)}
        style={{ minWidth: 0, textAlign: 'left', background: 'none', border: 0, padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        aria-label={`${sub.name}: open details`}
      >
        <span className="row" style={{ gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }} className="truncate">
            {sub.name}
          </span>
          {rise ? (
            <span className="sub-rise" title={`Price up ${rise.pct}% on ${rise.change.effective_on}`}>
              <Icon name="arrowUp" size={10} strokeWidth={2.2} /> {rise.pct}%
            </span>
          ) : null}
        </span>
        <span className="faint truncate" style={{ display: 'block', fontSize: 12 }}>
          {secondLine}
        </span>
      </button>

      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div className="numeric" style={{ fontSize: 13.5, fontWeight: 600 }}>
          {price.main}
          <span className="faint" style={{ fontWeight: 400 }}>
            {' '}
            {cycleSuffix(cycle)}
          </span>
        </div>
        {price.converted ? (
          <div className="faint numeric" style={{ fontSize: 11.5 }}>
            {price.converted}
          </div>
        ) : null}
        <div style={{ fontSize: 12, color: TONE_COLOR[due.tone] }}>{due.text}</div>
      </div>

      {payable ? (
        <button className="btn btn-secondary btn-sm" onClick={() => onAction('pay', sub)}>
          Mark paid
        </button>
      ) : decide ? (
        <button className="btn btn-secondary btn-sm" onClick={() => onAction('keep', sub)}>
          Keep or cancel?
        </button>
      ) : null}

      <div className="row-actions">
        <button className="icon-btn" onClick={() => onAction('edit', sub)} title="Edit" aria-label={`Edit ${sub.name}`}>
          <Icon name="edit" />
        </button>
        <button className="icon-btn" onClick={() => onAction('open', sub)} title="Details and actions" aria-label={`${sub.name}: details and actions`}>
          <Icon name="more" strokeWidth={3} />
        </button>
        <button className="icon-btn danger" onClick={() => onAction('delete', sub)} title="Delete" aria-label={`Delete ${sub.name}`}>
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

/* CALENDAR ----------------------------------------------------------------- */

const KIND_WORD: Record<Charge['kind'], string> = { charge: 'Due', trial_end: 'Trial ends', paid: 'Paid' };

function CalendarPanel({
  subs,
  today,
  version,
  onOpen,
}: {
  subs: Subscription[];
  today: string;
  version: number;
  onOpen: (sub: Subscription) => void;
}) {
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7)));
  const [selected, setSelected] = useState<string | null>(today);
  const { start, end } = monthBounds(year, month);
  const loadPayments = useCallback(() => api.listPaymentsBetween(start, end), [start, end]);
  const payments = useAsync(loadPayments, `payments-${start}-${end}-${version}`);
  const view = useMemo(
    () => monthCharges(subs, payments.data ?? [], year, month, today),
    [subs, payments.data, year, month, today],
  );
  const list = selected ? (view.days.get(selected) ?? []) : [];

  return (
    <div className="split rise">
      <div className="card card-pad">
        <MonthCalendar
          year={year}
          month={month}
          onChangeMonth={(y, m) => {
            setYear(y);
            setMonth(m);
            setSelected(null);
          }}
          selected={selected}
          onSelect={setSelected}
          dayLabel={(d) => {
            const charges = view.days.get(d.iso) ?? [];
            return charges.length ? charges.map((c) => `${c.sub.name} ${KIND_WORD[c.kind].toLowerCase()}`).join(', ') : null;
          }}
          renderDay={(d) => {
            const charges = view.days.get(d.iso) ?? [];
            return (
              <div
                className="sub-cal-cell col"
                style={d.isSelected ? { background: 'var(--primary-soft)', borderRadius: 'var(--radius-md)' } : undefined}
              >
                <span
                  className={`sub-cal-number${d.isToday ? ' today' : ''}`}
                  style={d.inMonth ? undefined : { color: 'var(--text-faint)' }}
                >
                  {Number(d.iso.slice(8))}
                </span>
                <span className="sub-cal-names">
                  {charges.slice(0, 3).map((c, i) => (
                    <span key={`${c.sub.id}-${i}`} className="sub-cal-name">
                      {c.kind === 'paid' ? (
                        <Icon name="check" size={11} strokeWidth={2.4} style={{ color: 'var(--success)' }} />
                      ) : (
                        <BrandTile sub={c.sub} size={11} />
                      )}
                      <span className="truncate">{c.sub.name}</span>
                    </span>
                  ))}
                  {charges.length > 3 ? <span className="sub-cal-name">+{charges.length - 3} more</span> : null}
                </span>
              </div>
            );
          }}
        />
      </div>

      <div className="col" style={{ gap: 'var(--space-lg)' }}>
        <div className="card card-pad">
          <div className="stat-row">
            <Stat label="Paid" value={formatMoney(view.paidMinor, { compact: true })} sub="This month, logged here" />
            <Stat label="Still to pay" value={formatMoney(view.stillToPayMinor, { compact: true })} sub="Overdue included" />
          </div>
        </div>
        <div className="card card-pad">
          <span className="overline">{selected ? shortDate(selected, today) : 'Pick a day'}</span>
          <div className="col" style={{ gap: 2, marginTop: 'var(--space-sm)' }}>
            {selected && list.length === 0 ? <p className="faint" style={{ margin: 0 }}>Nothing due or paid that day.</p> : null}
            {list.map((c, i) => (
              <button
                key={`${c.sub.id}-${c.kind}-${i}`}
                type="button"
                className="list-row"
                onClick={() => onOpen(c.sub)}
                style={{ width: '100%', background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              >
                <BrandTile sub={c.sub} size={24} />
                <span className="grow">
                  <span style={{ fontWeight: 550 }}>{c.sub.name}</span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 12,
                      color: c.kind === 'paid' ? 'var(--success)' : c.kind === 'trial_end' ? 'var(--info)' : 'var(--text-muted)',
                    }}
                  >
                    {KIND_WORD[c.kind]}
                    {c.kind === 'charge' && c.date < today ? ' · overdue' : ''}
                  </span>
                </span>
                <span className="numeric" style={{ fontWeight: 550 }}>
                  {c.inrMinor !== null ? formatMoney(c.inrMinor, { compact: true }) : '—'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* INSIGHTS ----------------------------------------------------------------- */

function InsightsPanel({
  subs,
  today,
  version,
  accountName,
  onOpen,
}: {
  subs: Subscription[];
  today: string;
  version: number;
  accountName: (id: string | null) => string | null;
  onOpen: (sub: Subscription) => void;
}) {
  const [period, setPeriod] = useState<Period>('month');
  // A year of payments covers every period: one fetch, three views.
  const start = `${today.slice(0, 4)}-01-01`;
  const end = `${today.slice(0, 4)}-12-31`;
  const loadPayments = useCallback(() => api.listPaymentsBetween(start, end), [start, end]);
  const payments = useAsync(loadPayments, `payments-${start}-${end}-${version}`);
  const totals = useMemo(
    () => periodTotals(subs, payments.data ?? [], period, today),
    [subs, payments.data, period, today],
  );
  const next30 = useMemo(
    () =>
      projectedCharges(subs, today, addDaysISO(29), today).reduce(
        (sum, c) => (c.kind === 'charge' && c.inrMinor !== null ? sum + c.inrMinor : sum),
        0,
      ),
    [subs, today],
  );
  const yearly = useMemo(() => perItemYearly(subs, today), [subs, today]);

  return (
    <div className="col rise" style={{ gap: 'var(--space-lg)' }}>
      <Segmented
        options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
        value={period}
        onChange={(v) => setPeriod(v as Period)}
      />

      <div className="card card-pad">
        <div className="stat-row">
          <Stat
            label={`${shortDate(totals.range.start, today)} – ${shortDate(totals.range.end, today)}`}
            value={formatMoney(totals.totalMinor, { compact: true })}
            sub="Paid plus still due"
          />
          <Stat label="Paid" value={formatMoney(totals.paidMinor, { compact: true })} sub="Marked paid here" />
          <Stat label="Still due" value={formatMoney(totals.dueMinor, { compact: true })} sub="Projected renewals" />
          <Stat label="Next 30 days" value={formatMoney(next30, { compact: true })} sub="From today" />
        </div>
        <p className="faint" style={{ margin: 'var(--space-md) 0 0', fontSize: 12 }}>
          Paid counts payments marked paid from this version on. Trials, and foreign prices without a rate, are left out.
        </p>
      </div>

      <div className="split">
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad">
            <span className="overline">By category</span>
            {totals.byCategory.length === 0 ? <p className="faint">Nothing in this period.</p> : null}
            {totals.byCategory.map((share) => (
              <Bar key={share.key} share={share} label={categoryDef(share.key).label} color={categoryDef(share.key).color} />
            ))}
          </div>
          <div className="card card-pad">
            <span className="overline">By account</span>
            {totals.byAccount.length === 0 ? <p className="faint">Nothing in this period.</p> : null}
            {totals.byAccount.map((share) => (
              <Bar
                key={share.key || 'none'}
                share={share}
                label={share.key ? (accountName(share.key) ?? 'An old account') : 'No account'}
                color="var(--primary)"
              />
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <span className="overline">A year of each</span>
          <div className="col" style={{ gap: 2, marginTop: 'var(--space-sm)' }}>
            {yearly.map(({ sub, perYearMinor }) => (
              <button
                key={sub.id}
                type="button"
                className="list-row"
                onClick={() => onOpen(sub)}
                style={{ width: '100%', background: 'none', font: 'inherit', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
              >
                <BrandTile sub={sub} size={22} />
                <span className="grow truncate">{sub.name}</span>
                <span className="numeric" style={{ fontWeight: 550 }}>
                  {formatMoney(perYearMinor, { compact: true })}
                  <span className="faint" style={{ fontWeight: 400 }}>
                    {' '}
                    / yr
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** "Fun · 42% · ₹2,340" over a bar. Every bar names itself; no legend needed. */
function Bar({ share, label, color }: { share: Share; label: string; color: string }) {
  return (
    <div className="sub-bar">
      <div className="sub-bar-head">
        <span className="grow">{label}</span>
        <span className="faint numeric">
          {share.pct}% · {formatMoney(share.minor, { compact: true })}
        </span>
      </div>
      <div className="sub-bar-track" aria-hidden="true">
        <i style={{ width: `${Math.max(share.pct, 2)}%`, background: color }} />
      </div>
    </div>
  );
}
