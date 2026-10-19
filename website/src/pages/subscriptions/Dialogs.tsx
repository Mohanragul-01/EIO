/**
 * The Subscriptions page's dialogs: mark paid, a dated action (cancel or
 * pause), a trial's decision, reminder defaults, and one subscription's
 * details.
 *
 * Each is mounted only while open, so its fields start from the
 * subscription it was opened on. A dialog sits in the browser's top layer,
 * above the toast, so the page closes a dialog before showing its Undo.
 */
import { useCallback, useState, type ReactNode } from 'react';

import { categoryDef } from '@app/core/categories';
import { formatEventDate } from '@app/core/date';
import { formatMoney, parseAmountToMinor } from '@app/core/money';
import type { ActionKey } from '@app/modules/subscriptions/actions';
import * as api from '@app/modules/subscriptions/api';
import { addCycle, cycleLabel, cycleOf, cycleSuffix, perYearMinor } from '@app/modules/subscriptions/cycles';
import {
  currencyDef,
  formatAmount,
  formatRate,
  inrOf,
  rateFromPayment,
} from '@app/modules/subscriptions/currency';
import { offsetsLabel, priceParts, shortDate, timeLabel } from '@app/modules/subscriptions/format';
import {
  countdown,
  effectiveState,
  needsTrialDecision,
  trialEndsOn,
} from '@app/modules/subscriptions/lifecycle';
import { priceSteps } from '@app/modules/subscriptions/prices';
import { effectiveOffsets, OFFSET_CHOICES } from '@app/modules/subscriptions/reminders';
import {
  channelLabel,
  type Account,
  type PriceChange,
  type ReminderSettings,
  type Subscription,
} from '@app/modules/subscriptions/types';

import { Icon } from '../../components/Icon';
import { ErrorBanner, Modal, SelectField, Spinner, TextField } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { amountInput, BrandTile, TONE_COLOR } from './parts';

/** A labelled checkbox with a line of explanation. */
export function CheckRow({
  checked,
  onChange,
  title,
  caption,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  caption?: string;
  disabled?: boolean;
}) {
  return (
    <label className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-start', cursor: disabled ? 'default' : 'pointer' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, accentColor: 'var(--primary)' }}
      />
      <span>
        <span style={{ fontWeight: 500 }}>{title}</span>
        {caption ? (
          <span className="faint" style={{ display: 'block', fontSize: 12 }}>
            {caption}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/* MARK PAID ---------------------------------------------------------------- */

export function MarkPaidDialog({
  sub,
  accounts,
  today,
  onClose,
  onConfirm,
}: {
  sub: Subscription;
  accounts: Account[];
  today: string;
  onClose: () => void;
  onConfirm: (input: api.MarkPaidInput) => void;
}) {
  const expected = inrOf(sub);
  const [amount, setAmount] = useState(expected === null ? '' : amountInput(expected));
  const [paidOn, setPaidOn] = useState(today);
  const [accountId, setAccountId] = useState(sub.account_id ?? '');
  const [keepPrice, setKeepPrice] = useState(true);
  // No rate yet: what the bank took is the best rate there is.
  const [keepRate, setKeepRate] = useState(sub.currency !== 'INR' && !sub.fx_rate);

  const minor = parseAmountToMinor(amount);
  const valid = minor !== null && minor > 0 && !!paidOn;
  const foreign = sub.currency !== 'INR';
  const next = addCycle(sub.next_due_date, cycleOf(sub));
  const priceDiffers = !foreign && valid && minor !== sub.amount_minor;
  const paidRate = foreign && valid ? rateFromPayment(minor as number, sub.amount_minor) : null;
  const rateDiffers = paidRate !== null && paidRate !== sub.fx_rate;
  const choices = accounts.filter((a) => a.is_active || a.id === sub.account_id);

  const confirm = () => {
    if (!valid) return;
    onConfirm({
      amountInrMinor: minor as number,
      paidOn,
      accountId: accountId || null,
      today,
      newAmountMinor: priceDiffers && keepPrice ? minor : null,
      newRate: rateDiffers && keepRate ? paidRate : null,
    });
  };

  return (
    <Modal
      open
      title={`Mark ${sub.name} paid`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={confirm} disabled={!valid}>
            {valid ? `Mark paid · ${formatMoney(minor as number)}` : 'Mark paid'}
          </button>
        </>
      }
    >
      <p className="secondary" style={{ margin: 0 }}>
        {next ? `The next due date moves to ${shortDate(next, today)}.` : 'One-time: it moves to Archived.'}{' '}
        Logged to Finance as an expense under {categoryDef(sub.category).label}.
      </p>

      <TextField
        label="Charged (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
        error={amount && !valid ? 'Enter an amount like 649 or 649.50' : null}
        hint={
          foreign
            ? `${formatAmount(sub.amount_minor, sub.currency)}${
                sub.fx_rate && expected !== null
                  ? ` at ${formatRate(sub.fx_rate, sub.currency)} is ${formatMoney(expected)}`
                  : ', no rate set yet'
              }. Enter what the bank actually took.`
            : undefined
        }
        autoFocus
      />

      {priceDiffers ? (
        <CheckRow
          checked={keepPrice}
          onChange={setKeepPrice}
          title="This is the new price"
          caption={`${formatMoney(sub.amount_minor)} becomes ${formatMoney(minor as number)} from now on, and goes in its price history.`}
        />
      ) : null}
      {rateDiffers && paidRate !== null ? (
        <CheckRow
          checked={keepRate}
          onChange={setKeepRate}
          title={`Use as the rate: ${formatRate(paidRate, sub.currency)}`}
          caption={`Totals convert ${currencyDef(sub.currency).code} at this from now on.`}
        />
      ) : null}

      <div className="field">
        <span className="label">Paid on</span>
        <input className="input" type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
      </div>

      <SelectField label="From account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
        <option value="">No account</option>
        {choices.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectField>
    </Modal>
  );
}

/* A DATED ACTION: CANCEL OR PAUSE ------------------------------------------ */

export function DateDialog({
  title,
  message,
  label,
  initial,
  required,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  label: string;
  initial: string;
  required: boolean;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
}) {
  const [date, setDate] = useState(initial);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => onConfirm(date || null)} disabled={required && !date}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="secondary" style={{ margin: 0 }}>
        {message}
      </p>
      <div className="field">
        <span className="label">{label}</span>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
    </Modal>
  );
}

/* A TRIAL'S DECISION ------------------------------------------------------- */

export function TrialDialog({
  sub,
  today,
  onClose,
  onKeep,
  onCancelled,
}: {
  sub: Subscription;
  today: string;
  onClose: () => void;
  onKeep: () => void;
  onCancelled: () => void;
}) {
  const price = priceParts(sub);
  const ends = trialEndsOn(sub);
  return (
    <Modal
      open
      title={`${sub.name} trial`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onCancelled}>
            I cancelled it
          </button>
          <button className="btn" onClick={onKeep}>
            Keep it
          </button>
        </>
      }
    >
      <p className="secondary" style={{ margin: 0 }}>
        {countdown(sub, today).text}. If you keep it, it costs {price.main}
        {price.converted ? ` (${price.converted})` : ''} {cycleSuffix(cycleOf(sub))}, first charged on{' '}
        {shortDate(ends, today)}. Keep moves it into your totals; I cancelled it ends it that day.
      </p>
    </Modal>
  );
}

/* REMINDER DEFAULTS -------------------------------------------------------- */

export function ReminderDefaultsDialog({
  settings,
  onClose,
  onSave,
}: {
  settings: ReminderSettings;
  onClose: () => void;
  onSave: (settings: ReminderSettings) => void;
}) {
  const [offsets, setOffsets] = useState(settings.offsets.filter((n) => n > 0));
  const [time, setTime] = useState(timeLabel(settings.minutes));
  const [h, m] = time.split(':').map(Number);
  const minutes = Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : settings.minutes;

  return (
    <Modal
      open
      title="Renewal reminders"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => onSave({ offsets, minutes })}>
            Save
          </button>
        </>
      }
    >
      <p className="secondary" style={{ margin: 0 }}>
        For every subscription without its own choice. Reminders fire on the phone; the phone picks
        these up the next time it opens.
      </p>
      <div className="field">
        <span className="label">Remind me</span>
        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          {OFFSET_CHOICES.map((days) => (
            <CheckRow
              key={days}
              checked={offsets.includes(days)}
              onChange={(on) =>
                setOffsets(on ? [...offsets, days].sort((a, b) => b - a) : offsets.filter((n) => n !== days))
              }
              title={`${days} ${days === 1 ? 'day' : 'days'} before`}
            />
          ))}
          <CheckRow checked disabled onChange={() => {}} title="On the day" caption="Always on, so nothing renews unannounced." />
        </div>
      </div>
      <div className="field">
        <span className="label">At</span>
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 140 }} />
      </div>
      <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
        {offsetsLabel([...offsets, 0])}, at {timeLabel(minutes)}.
      </p>
    </Modal>
  );
}

/* ONE SUBSCRIPTION --------------------------------------------------------- */

/** What the detail dialog offers as buttons, by state. */
function lifecycleButtons(sub: Subscription, today: string): { key: ActionKey; label: string }[] {
  switch (effectiveState(sub, today)) {
    case 'active':
      return [
        { key: 'pause', label: 'Pause' },
        { key: 'cancel', label: 'Mark as cancelled' },
        { key: 'archive', label: 'Archive' },
      ];
    case 'trial':
    case 'trial_over':
      return [{ key: 'archive', label: 'Archive' }];
    case 'paused':
      return [
        { key: 'resume', label: 'Resume now' },
        { key: 'cancel', label: 'Mark as cancelled' },
        { key: 'archive', label: 'Archive' },
      ];
    case 'ending':
      return [
        { key: 'restore', label: 'Undo cancellation' },
        { key: 'archive', label: 'Archive' },
      ];
    case 'ended':
    case 'archived':
      return [{ key: 'restore', label: 'Restore to active' }];
  }
}

export function DetailDialog({
  sub,
  accounts,
  settings,
  today,
  version,
  onClose,
  onAction,
  onRemovePriceChange,
}: {
  sub: Subscription;
  accounts: Account[];
  settings: ReminderSettings;
  today: string;
  /** Bumped after any write, so payments and history refetch. */
  version: number;
  onClose: () => void;
  onAction: (key: ActionKey, sub: Subscription) => void;
  onRemovePriceChange: (change: PriceChange) => void;
}) {
  const load = useCallback(
    () => Promise.all([api.listPayments(sub.id), api.listPriceChanges(sub.id)]),
    [sub.id],
  );
  const history = useAsync(load, `subscription-${sub.id}-${version}`);

  const state = effectiveState(sub, today);
  const cycle = cycleOf(sub);
  const price = priceParts(sub);
  const inr = inrOf(sub);
  const due = countdown(sub, today);
  const offsets = effectiveOffsets(sub, settings);
  const accountName = (id: string | null) =>
    id ? (accounts.find((a) => a.id === id)?.name ?? 'An account no longer listed') : null;
  const [payments, changes] = history.data ?? [[], []];

  const primary: { key: ActionKey; label: string } | null =
    needsTrialDecision(sub, today) || state === 'trial'
      ? { key: 'keep', label: 'Keep it or cancel?' }
      : state === 'active'
        ? { key: 'pay', label: 'Mark paid' }
        : null;

  return (
    <Modal
      open
      title={sub.name}
      onClose={onClose}
      width={620}
      footer={
        <>
          <button className="btn btn-ghost" style={{ color: 'var(--danger)', marginRight: 'auto' }} onClick={() => onAction('delete', sub)}>
            <Icon name="trash" /> Delete
          </button>
          <button className="btn btn-secondary" onClick={() => onAction('edit', sub)}>
            <Icon name="edit" /> Edit
          </button>
          {primary ? (
            <button className="btn" onClick={() => onAction(primary.key, sub)}>
              {primary.label}
            </button>
          ) : null}
        </>
      }
    >
      <div className="row" style={{ gap: 'var(--space-lg)' }}>
        <BrandTile sub={sub} size={56} />
        <div className="grow">
          <div className="stat-value numeric">
            {price.main}
            <span className="faint" style={{ fontSize: 14, fontWeight: 400 }}>
              {' '}
              {cycleSuffix(cycle)}
            </span>
          </div>
          <div className="faint" style={{ fontSize: 12.5 }}>
            {[price.converted, inr !== null && cycle.unit !== 'once' ? `${formatMoney(perYearMinor(inr, cycle), { compact: true })} a year` : null]
              .filter(Boolean)
              .join(' · ')}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: TONE_COLOR[due.tone], fontWeight: 550 }}>
            {due.text}
            {state === 'active' ? (
              <span className="faint" style={{ fontWeight: 400 }}>
                {' '}
                · next charge {shortDate(sub.next_due_date, today)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 'var(--space-sm)' }}>
        {lifecycleButtons(sub, today).map((b) => (
          <button key={b.key} className="btn btn-secondary btn-sm" onClick={() => onAction(b.key, sub)}>
            {b.label}
          </button>
        ))}
      </div>

      <Section title="Payments">
        {history.loading && !history.data ? (
          <Spinner />
        ) : payments.length === 0 ? (
          <p className="faint" style={{ margin: 0 }}>
            Nothing marked paid yet. Mark paid logs each payment to Finance and lists it here.
          </p>
        ) : (
          payments.slice(0, 12).map((p) => (
            <div key={p.id} className="row-between" style={{ fontSize: 13, padding: '4px 0' }}>
              <span>{formatEventDate(p.date)}</span>
              <span className="faint grow" style={{ marginLeft: 'var(--space-md)' }}>
                {accountName(p.account_id) ?? 'No account'}
              </span>
              <span className="numeric" style={{ fontWeight: 550 }}>
                {formatMoney(p.amount_minor)}
              </span>
            </div>
          ))
        )}
      </Section>

      {changes.length > 0 ? (
        <Section title="Price history">
          {priceSteps(changes).map((step) => (
            <div key={step.change.id} className="row" style={{ gap: 'var(--space-sm)', fontSize: 13, padding: '2px 0' }}>
              <Icon
                name={step.direction === 'up' ? 'arrowUp' : 'arrowDown'}
                size={14}
                style={{ color: step.direction === 'up' ? 'var(--warning)' : 'var(--success)' }}
              />
              <span className="numeric">
                {formatAmount(step.change.old_amount_minor, step.change.currency, { compact: true })} →{' '}
                {formatAmount(step.change.new_amount_minor, step.change.currency, { compact: true })}
              </span>
              <span className="faint grow">
                {formatEventDate(step.change.effective_on)} · {step.pct > 0 ? '+' : ''}
                {step.pct}% {step.direction === 'up' ? 'up' : 'down'}
              </span>
              <button
                className="icon-btn"
                onClick={() => onRemovePriceChange(step.change)}
                title="Remove this price change"
                aria-label="Remove this price change"
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </Section>
      ) : null}

      <Section title="Details">
        <Fact label="Billed" value={cycleLabel(cycle)} />
        <Fact
          label="Reminders"
          value={
            offsets.length === 0
              ? 'Off'
              : `${offsetsLabel(offsets)}, at ${timeLabel(settings.minutes)}${sub.reminder_offsets === null ? ' (your defaults)' : ''}`
          }
        />
        <Fact
          label="Charged to"
          value={[accountName(sub.account_id), channelLabel(sub.charge_channel)].filter(Boolean).join(' · ') || 'Not set'}
        />
        <Fact label="Logs to Finance as" value={categoryDef(sub.category).label} />
        {sub.currency !== 'INR' ? (
          <Fact
            label="Rate"
            value={
              sub.fx_rate
                ? `${formatRate(sub.fx_rate, sub.currency)}${sub.fx_rate_on ? `, set ${formatEventDate(sub.fx_rate_on)}` : ''}`
                : 'Not set, so it is left out of totals'
            }
          />
        ) : null}
        {sub.note ? <Fact label="Note" value={sub.note} /> : null}
      </Section>

      <Section title="How to cancel">
        {sub.cancel_notes ? <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{sub.cancel_notes}</p> : null}
        {sub.cancel_url ? (
          <a className="btn btn-secondary btn-sm" href={sub.cancel_url} target="_blank" rel="noreferrer noopener" style={{ alignSelf: 'flex-start' }}>
            <Icon name="external" /> Open the manage page
          </a>
        ) : null}
        {!sub.cancel_url && !sub.cancel_notes ? (
          <p className="faint" style={{ margin: 0 }}>
            Nothing noted yet. Add the manage link and your notes in Edit.
          </p>
        ) : null}
      </Section>

      <ErrorBanner message={history.error} />
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="col" style={{ gap: 'var(--space-xs)' }}>
      <span className="overline">{title}</span>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ gap: 'var(--space-md)', fontSize: 13, alignItems: 'baseline' }}>
      <span className="faint" style={{ width: 140, flexShrink: 0 }}>
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}
