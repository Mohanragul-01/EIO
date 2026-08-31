/**
 * SubscriptionsPage - what renews, when, and what it costs a month.
 *
 * Grouped by urgency rather than listed flat: overdue, this week, later, and
 * paused. The phone sorts by date and lets you scroll, which works on a small
 * screen because you only see a few at a time. On a monitor the whole list is
 * visible at once, and a flat list of twenty renewals makes the two you have
 * to act on today no more prominent than the one due in November.
 *
 * Reminders are deliberately absent here. They are local notifications
 * scheduled by the phone's OS; a browser cannot schedule them and pretending
 * otherwise with a web notification that only fires while this tab is open
 * would be worse than not offering it.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { categoriesFor, categoryDef, DEFAULT_SUBSCRIPTION_CATEGORY } from '@app/core/categories';
import { daysUntil, formatDueDate, todayISO } from '@app/core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import * as api from '@app/modules/subscriptions/api';
import {
  advanceDueDate,
  BILLING_CYCLES,
  CYCLE_LABEL,
  CYCLE_SUFFIX,
  toMonthlyMinor,
  type BillingCycle,
  type Subscription,
  type SubscriptionInput,
} from '@app/modules/subscriptions/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import {
  ChipPicker,
  Empty,
  ErrorBanner,
  Modal,
  Spinner,
  Stat,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

type Bucket = 'overdue' | 'week' | 'later' | 'paused';

const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Overdue',
  week: 'Due this week',
  later: 'Later',
  paused: 'Paused',
};

const BUCKET_COLOR: Record<Bucket, string> = {
  overdue: 'var(--danger)',
  week: 'var(--warning)',
  later: 'var(--text-muted)',
  paused: 'var(--text-faint)',
};

function bucketFor(subscription: Subscription): Bucket {
  if (!subscription.is_active) return 'paused';
  const days = daysUntil(subscription.next_due_date);
  if (days < 0) return 'overdue';
  if (days <= 7) return 'week';
  return 'later';
}

export function SubscriptionsPage() {
  const [editing, setEditing] = useState<Subscription | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => api.listSubscriptions(), []);
  const { data, loading, error, reload } = useAsync(load, 'subscriptions');

  // A success notice is worth showing and not worth keeping. Errors stay until
  // something changes; a confirmation that lingers just becomes furniture.
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  useHotkeys({ onNew: () => setEditing('new') });

  const subscriptions = data ?? [];
  const active = subscriptions.filter((s) => s.is_active);

  const monthlyTotal = useMemo(
    () => active.reduce((total, s) => total + toMonthlyMinor(s.amount_minor, s.billing_cycle), 0),
    [active],
  );

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Subscription[]> = { overdue: [], week: [], later: [], paused: [] };
    subscriptions.forEach((s) => buckets[bucketFor(s)].push(s));
    (Object.keys(buckets) as Bucket[]).forEach((key) =>
      buckets[key].sort((a, b) => a.next_due_date.localeCompare(b.next_due_date)),
    );
    return buckets;
  }, [subscriptions]);

  const pay = async (subscription: Subscription) => {
    const ok = await confirm(
      'Mark as paid',
      `Logs ${formatMoney(subscription.amount_minor)} to Finance and moves the due date to ${formatDueDate(
        advanceDueDate(subscription.next_due_date, subscription.billing_cycle),
      )}.`,
      'Mark paid',
    );
    if (!ok) return;

    setBusyId(subscription.id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await api.markPaid(subscription);
      // markPaid advances the date first and returns rather than throws when
      // only the ledger write failed - reporting total failure for something
      // that half-worked would be a lie.
      if (!result.logged) {
        setActionError(
          `Due date moved, but the expense was not logged to Finance: ${result.logError}`,
        );
      } else {
        setNotice(`${subscription.name} logged to Finance.`);
      }
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not mark that paid');
    } finally {
      setBusyId(null);
    }
  };

  const togglePause = async (subscription: Subscription) => {
    setBusyId(subscription.id);
    setActionError(null);
    try {
      await api.updateSubscription(subscription.id, { is_active: !subscription.is_active });
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update that');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (subscription: Subscription) => {
    if (!(await confirm('Delete subscription', `${subscription.name} will be removed.`))) return;
    setActionError(null);
    try {
      await api.deleteSubscription(subscription.id);
      await reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  return (
    <Shell
      title="Subscriptions"
      subtitle={
        loading
          ? 'Loading'
          : `${formatMoney(monthlyTotal, { compact: true })} a month · ${active.length} active`
      }
      actions={
        <button className="btn" onClick={() => setEditing('new')}>
          <Icon name="plus" /> New subscription
        </button>
      }
    >
      <ErrorBanner message={error ?? actionError} />
      {notice ? (
        <div
          className="banner"
          style={{
            borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)',
            background: 'color-mix(in srgb, var(--success) 12%, transparent)',
            color: 'var(--success)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {notice}
        </div>
      ) : null}

      {loading && !data ? (
        <Spinner center />
      ) : subscriptions.length === 0 ? (
        <div className="card">
          <Empty
            icon="subscriptions"
            title="Nothing tracked yet"
            message="Add the things that renew on their own, and marking one paid logs the expense to Finance for you."
            action={
              <button className="btn" onClick={() => setEditing('new')}>
                <Icon name="plus" /> Add one
              </button>
            }
          />
        </div>
      ) : (
        <>
          <div className="card card-pad rise" style={{ marginBottom: 'var(--space-xl)' }}>
            <div className="stat-row">
              <Stat
                label="Per month"
                value={formatMoney(monthlyTotal, { compact: true })}
                sub="Every cycle normalised"
              />
              <Stat
                label="Per year"
                value={formatMoney(monthlyTotal * 12, { compact: true })}
                sub="At today's rates"
              />
              <Stat label="Active" value={active.length} sub={`${subscriptions.length} total`} />
              <Stat
                label="Due this week"
                value={grouped.week.length + grouped.overdue.length}
                color={grouped.overdue.length > 0 ? 'var(--danger)' : undefined}
                sub={grouped.overdue.length > 0 ? `${grouped.overdue.length} overdue` : 'On track'}
              />
            </div>
          </div>

          <div className="col" style={{ gap: 'var(--space-2xl)' }}>
            {(Object.keys(BUCKET_LABEL) as Bucket[]).map((bucket) => {
              const items = grouped[bucket];
              if (items.length === 0) return null;

              return (
                <section
                  key={bucket}
                  className="rise"
                  
                >
                  <div className="row" style={{ gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                    <span className="dot" style={{ background: BUCKET_COLOR[bucket] }} />
                    <span className="column-title">{BUCKET_LABEL[bucket]}</span>
                    <span className="column-count">{items.length}</span>
                  </div>

                  <div className="col" style={{ gap: 'var(--space-sm)' }}>
                    {items.map((subscription) => (
                      <SubscriptionRow
                        key={subscription.id}
                        subscription={subscription}
                        bucket={bucket}
                        busy={busyId === subscription.id}
                        onPay={() => void pay(subscription)}
                        onTogglePause={() => void togglePause(subscription)}
                        onEdit={() => setEditing(subscription)}
                        onDelete={() => void remove(subscription)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {editing ? (
        <SubscriptionDialog
          subscription={editing === 'new' ? null : editing}
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

/* ROW ---------------------------------------------------------------------- */

function SubscriptionRow({
  subscription,
  bucket,
  busy,
  onPay,
  onTogglePause,
  onEdit,
  onDelete,
}: {
  subscription: Subscription;
  bucket: Bucket;
  busy: boolean;
  onPay: () => void;
  onTogglePause: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const category = categoryDef(subscription.category || DEFAULT_SUBSCRIPTION_CATEGORY);

  return (
    <div className="list-row bordered">
      <span className="dot" style={{ background: category.color, width: 9, height: 9 }} />

      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{subscription.name}</div>
        <div className="faint" style={{ fontSize: 12 }}>
          {category.label} · {CYCLE_LABEL[subscription.billing_cycle]}
        </div>
      </div>

      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <div className="numeric" style={{ fontSize: 13.5, fontWeight: 600 }}>
          {formatMoney(subscription.amount_minor)}
          <span className="faint" style={{ fontWeight: 400 }}>
            {CYCLE_SUFFIX[subscription.billing_cycle]}
          </span>
        </div>
        <div style={{ fontSize: 12, color: BUCKET_COLOR[bucket] }}>
          {subscription.is_active ? formatDueDate(subscription.next_due_date) : 'Paused'}
        </div>
      </div>

      {subscription.is_active ? (
        <button className="btn btn-secondary btn-sm" onClick={onPay} disabled={busy}>
          {busy ? <span className="spinner" /> : 'Mark paid'}
        </button>
      ) : null}

      <div className="row-actions">
        <button
          className="icon-btn"
          onClick={onTogglePause}
          title={subscription.is_active ? 'Pause' : 'Resume'}
          aria-label={subscription.is_active ? 'Pause' : 'Resume'}
        >
          {subscription.is_active ? 'pause' : 'play'}
        </button>
        <button className="icon-btn" onClick={onEdit} title="Edit" aria-label="Edit">
          <Icon name="edit" />
        </button>
        <button className="icon-btn danger" onClick={onDelete} title="Delete" aria-label="Delete">
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

/* DIALOG ------------------------------------------------------------------- */

function SubscriptionDialog({
  subscription,
  onClose,
  onSaved,
}: {
  subscription: Subscription | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(subscription?.name ?? '');
  const [amount, setAmount] = useState(
    subscription ? minorToAmountString(subscription.amount_minor) : '',
  );
  const [cycle, setCycle] = useState<BillingCycle>(subscription?.billing_cycle ?? 'monthly');
  const [category, setCategory] = useState(
    subscription?.category || DEFAULT_SUBSCRIPTION_CATEGORY,
  );
  const [dueDate, setDueDate] = useState(subscription?.next_due_date ?? todayISO());
  const [isActive, setIsActive] = useState(subscription?.is_active ?? true);
  const [note, setNote] = useState(subscription?.note ?? '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    const minor = parseAmountToMinor(amount);

    setNameError(trimmed ? null : 'Give it a name');
    setAmountError(minor !== null && minor > 0 ? null : 'Enter an amount above zero');
    if (!trimmed || minor === null || minor <= 0) return;

    setSaving(true);
    setError(null);

    const input: SubscriptionInput = {
      name: trimmed,
      amount_minor: minor,
      billing_cycle: cycle,
      category,
      next_due_date: dueDate,
      is_active: isActive,
      note: note.trim(),
    };

    try {
      if (subscription) await api.updateSubscription(subscription.id, input);
      else await api.createSubscription(input);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  const minor = parseAmountToMinor(amount);

  return (
    <Modal
      open
      title={subscription ? 'Edit subscription' : 'New subscription'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : subscription ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <TextField
        label="Name"
        value={name}
        error={nameError}
        onChange={(e) => setName(e.target.value)}
        placeholder="Netflix, gym, insurance…"
        autoFocus
      />

      <TextField
        label="Amount"
        value={amount}
        error={amountError}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        inputMode="decimal"
      />

      <ChipPicker
        label="Billing cycle"
        value={cycle}
        onChange={setCycle}
        options={BILLING_CYCLES.map((c) => ({ value: c, label: CYCLE_LABEL[c] }))}
      />

      {/*
        The normalised monthly cost, shown live. A yearly figure and a monthly
        one are not comparable by eye, and this is the number the summary adds
        up - so seeing it while you type is what makes the total make sense.
      */}
      {minor !== null && minor > 0 && cycle !== 'monthly' ? (
        <div className="faint" style={{ fontSize: 12.5, marginTop: -8 }}>
          That is {formatMoney(toMonthlyMinor(minor, cycle))} a month.
        </div>
      ) : null}

      <ChipPicker
        label="Category"
        value={category}
        onChange={setCategory}
        options={categoriesFor('expense').map((c) => ({
          value: c.key,
          label: c.label,
          color: c.color,
        }))}
      />

      <TextField
        label="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional"
      />

      <div className="field">
        <span className="label">Next due date</span>
        <input
          className="input"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <label className="row" style={{ gap: 'var(--space-md)', cursor: 'pointer' }}>
        <button
          type="button"
          className={`check${isActive ? ' on' : ''}`}
          onClick={() => setIsActive(!isActive)}
          aria-pressed={isActive}
        >
          {isActive ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
        </button>
        <span>
          <div style={{ fontWeight: 500 }}>Active</div>
          <div className="faint" style={{ fontSize: 12 }}>
            Paused subscriptions are kept but excluded from the monthly total.
          </div>
        </span>
      </label>

      <ErrorBanner message={error} />
    </Modal>
  );
}
