/**
 * EditDialog - add or change a subscription on the website.
 *
 * Adding starts on the catalogue: type a name, pick the service, and the form
 * arrives filled in but for the price. "Add your own" skips it. The same
 * fields as the phone, laid out for a keyboard; the rules (cycles, currency,
 * what is saved for the v2 app) are the app's own, through @app.
 */
import { useMemo, useState } from 'react';

import { categoriesFor, DEFAULT_SUBSCRIPTION_CATEGORY } from '@app/core/categories';
import { addDaysISO, todayISO } from '@app/core/date';
import { formatMoney, parseAmountToMinor } from '@app/core/money';
import * as api from '@app/modules/subscriptions/api';
import { TILE_COLOURS, readableOn, tileColor } from '@app/modules/subscriptions/brand';
import { findService, searchCatalogue, type Service } from '@app/modules/subscriptions/catalogue';
import { cycleLabel, cycleOf, perMonthMinor, perYearMinor } from '@app/modules/subscriptions/cycles';
import { CURRENCIES, currencyDef, formatRate, toInrMinor } from '@app/modules/subscriptions/currency';
import {
  DEFAULT_REMINDER_SETTINGS,
  OFFSET_CHOICES,
  offsetsToSave,
} from '@app/modules/subscriptions/reminders';
import {
  CHANNEL_LABEL,
  CHARGE_CHANNELS,
  type Account,
  type CycleUnit,
  type Subscription,
  type SubscriptionInput,
} from '@app/modules/subscriptions/types';

import { Icon } from '../../components/Icon';
import { ChipPicker, ErrorBanner, Modal, SelectField, TextArea, TextField } from '../../components/ui';
import { CheckRow } from './Dialogs';
import { amountInput, BrandTile } from './parts';

const PRESETS: { value: string; label: string; unit: CycleUnit; count: number }[] = [
  { value: 'month-1', label: 'Monthly', unit: 'month', count: 1 },
  { value: 'year-1', label: 'Yearly', unit: 'year', count: 1 },
  { value: 'month-3', label: 'Quarterly', unit: 'month', count: 3 },
  { value: 'week-1', label: 'Weekly', unit: 'week', count: 1 },
  { value: 'day-28', label: '28 days', unit: 'day', count: 28 },
  { value: 'day-84', label: '84 days', unit: 'day', count: 84 },
  { value: 'once-1', label: 'One-time', unit: 'once', count: 1 },
  { value: 'custom', label: 'Every…', unit: 'day', count: 28 },
];

type ReminderMode = 'default' | 'custom' | 'off';

export function EditDialog({
  subscription,
  accounts,
  onClose,
  onSaved,
}: {
  /** Null to add a new one. */
  subscription: Subscription | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: (saved: Subscription) => void;
}) {
  const editing = subscription;
  const [stage, setStage] = useState<'pick' | 'form'>(editing ? 'form' : 'pick');
  const [query, setQuery] = useState('');

  const initialCycle = editing ? cycleOf(editing) : { unit: 'month' as CycleUnit, count: 1 };
  const [name, setName] = useState(editing?.name ?? '');
  const [amount, setAmount] = useState(editing ? amountInput(editing.amount_minor) : '');
  const [currency, setCurrency] = useState(editing?.currency ?? 'INR');
  const [rateText, setRateText] = useState(editing?.fx_rate ? String(editing.fx_rate) : '');
  const [isTrial, setIsTrial] = useState(editing?.status === 'trial');
  const [trialEnds, setTrialEnds] = useState(editing?.trial_ends_on ?? addDaysISO(7));
  const [unit, setUnit] = useState<CycleUnit>(initialCycle.unit);
  const [countText, setCountText] = useState(String(initialCycle.count));
  const [custom, setCustom] = useState(false);
  const [nextDue, setNextDue] = useState(editing?.next_due_date ?? addDaysISO(30));
  const [category, setCategory] = useState(editing?.category || DEFAULT_SUBSCRIPTION_CATEGORY);
  const [accountId, setAccountId] = useState(editing?.account_id ?? '');
  const [channel, setChannel] = useState(editing?.charge_channel ?? '');
  const [reminderMode, setReminderMode] = useState<ReminderMode>(
    editing?.reminder_offsets == null ? 'default' : editing.reminder_offsets.length === 0 ? 'off' : 'custom',
  );
  const [offsets, setOffsets] = useState<number[]>(
    (editing?.reminder_offsets ?? DEFAULT_REMINDER_SETTINGS.offsets).filter((n) => n > 0),
  );
  const [cancelUrl, setCancelUrl] = useState(editing?.cancel_url ?? '');
  const [cancelNotes, setCancelNotes] = useState(editing?.cancel_notes ?? '');
  const [color, setColor] = useState<string | null>(editing?.color ?? null);
  const [serviceKey, setServiceKey] = useState<string | null>(editing?.service_key ?? null);
  const [note, setNote] = useState(editing?.note ?? '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const results = useMemo(() => searchCatalogue(query).slice(0, 40), [query]);

  const pick = (service: Service | null) => {
    if (service) {
      setName(service.name);
      setCurrency(service.currency ?? 'INR');
      setUnit(service.cycle.unit);
      setCountText(String(service.cycle.count));
      setCategory(service.category);
      setCancelUrl(service.manageUrl);
      setColor(service.color);
      setServiceKey(service.key);
    } else if (query.trim()) {
      setName(query.trim());
    }
    setStage('form');
  };

  const count = Number(countText);
  const countValid = unit === 'once' || (Number.isInteger(count) && count >= 1 && count <= 366);
  const cycle = { unit, count: unit === 'once' ? 1 : countValid ? count : 1 };
  const preset = PRESETS.find((p) => p.unit === cycle.unit && p.count === cycle.count && p.value !== 'custom');
  const presetValue = custom || !preset ? 'custom' : preset.value;
  const minor = parseAmountToMinor(amount);
  const rate = currency === 'INR' ? null : Number(rateText) > 0 ? Number(rateText) : null;
  const inr = minor ? toInrMinor(minor, currency, rate) : null;
  const service = serviceKey ? findService(serviceKey) : undefined;
  const swatches = [
    ...new Set([...(service ? [service.color] : []), ...(color ? [color.toUpperCase()] : []), ...TILE_COLOURS]),
  ];
  const currentColour = tileColor({ color, service_key: serviceKey, name: name || '?' });

  const save = async () => {
    const trimmed = name.trim();
    let url = cancelUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const next: Record<string, string> = {};
    if (!trimmed) next.name = 'Give it a name';
    if (minor === null || minor <= 0) next.amount = 'Enter an amount above zero';
    if (!countValid) next.count = 'A whole number from 1 to 366';
    if (currency !== 'INR' && rateText.trim() && rate === null) next.rate = 'A rate like 86.50';
    if (url && !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) next.url = 'That does not look like a link';
    setErrors(next);
    if (Object.keys(next).length > 0 || minor === null) return;

    const today = todayISO();
    const input: SubscriptionInput = {
      name: trimmed,
      amount_minor: minor,
      next_due_date: isTrial ? trialEnds : nextDue,
      category,
      note: note.trim(),
      status: isTrial ? 'trial' : editing && editing.status !== 'trial' ? editing.status : 'active',
      trial_ends_on: isTrial ? trialEnds : (editing?.trial_ends_on ?? null),
      ends_on: editing?.ends_on ?? null,
      resume_on: editing?.resume_on ?? null,
      cancel_url: url || null,
      cancel_notes: cancelNotes.trim(),
      service_key: serviceKey,
      color,
      account_id: accountId || null,
      charge_channel: channel || null,
      reminder_offsets: offsetsToSave(reminderMode, offsets),
      cycle_unit: cycle.unit,
      cycle_count: cycle.count,
      currency,
      fx_rate: rate,
      fx_rate_on:
        rate === null ? null : rate !== (editing?.fx_rate ?? null) ? today : (editing?.fx_rate_on ?? today),
    };

    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await api.updateSubscription(editing.id, input, editing)
        : await api.createSubscription(input);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  if (stage === 'pick') {
    return (
      <Modal
        open
        title="Add a subscription"
        onClose={onClose}
        width={520}
        footer={
          <>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" onClick={() => pick(null)}>
              <Icon name="plus" /> Add your own
            </button>
          </>
        }
      >
        <TextField
          label="Search services"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Netflix, Jio, Swiggy One…"
          autoFocus
        />
        <div className="sub-catalogue col" style={{ gap: 2 }} role="list">
          {results.length === 0 ? (
            <p className="faint" style={{ margin: 'var(--space-sm)' }}>
              Not in the list. Add it as your own - it takes the same fields.
            </p>
          ) : (
            results.map((s) => (
              <button key={s.key} type="button" className="list-row" onClick={() => pick(s)} role="listitem">
                <BrandTile sub={{ name: s.name, color: s.color, service_key: s.key }} size={28} />
                <span className="grow">
                  <span style={{ fontWeight: 550 }}>{s.name}</span>
                  <span className="faint" style={{ display: 'block', fontSize: 12 }}>
                    {s.group} · {cycleLabel(s.cycle)}
                    {s.currency ? ` · billed in ${s.currency}` : ''}
                  </span>
                </span>
                <Icon name="chevronRight" style={{ color: 'var(--text-faint)' }} />
              </button>
            ))
          )}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      title={editing ? 'Edit subscription' : 'New subscription'}
      onClose={onClose}
      width={600}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : editing ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-end' }}>
        <BrandTile sub={{ name: name || '?', color, service_key: serviceKey }} size={40} />
        <div className="grow">
          <TextField label="Name" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} autoFocus={!editing && !name} />
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-start' }}>
        <div className="grow">
          <TextField
            label={`${isTrial ? 'Then costs' : 'Amount'} (${currencyDef(currency).symbol})`}
            value={amount}
            error={errors.amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoFocus={!editing && !!name}
            hint={
              inr && unit !== 'once'
                ? `≈ ${formatMoney(perMonthMinor(inr, cycle), { compact: true })} a month · ${formatMoney(perYearMinor(inr, cycle), { compact: true })} a year`
                : undefined
            }
          />
        </div>
        <SelectField label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.name}
            </option>
          ))}
        </SelectField>
      </div>

      {currency !== 'INR' ? (
        <TextField
          label={`Rate: rupees per 1 ${currency}`}
          value={rateText}
          error={errors.rate}
          onChange={(e) => setRateText(e.target.value)}
          inputMode="decimal"
          placeholder="86.50"
          hint={
            rate && inr !== null
              ? `${formatRate(rate, currency)}: each charge is about ${formatMoney(inr)}.`
              : 'Set by hand. Without a rate it is left out of your totals.'
          }
        />
      ) : null}

      {!editing || editing.status === 'trial' ? (
        <CheckRow
          checked={isTrial}
          onChange={setIsTrial}
          title="This is a free trial"
          caption="Not in your totals until you keep it. Reminders 3 days and 1 day before it ends, and that morning."
        />
      ) : null}
      {isTrial ? (
        <div className="field">
          <span className="label">Trial ends on</span>
          <input className="input" type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
        </div>
      ) : null}

      <ChipPicker
        label="Billed"
        value={presetValue}
        onChange={(value) => {
          const p = PRESETS.find((x) => x.value === value);
          if (!p) return;
          setCustom(value === 'custom');
          if (value === 'custom') {
            if (unit === 'once') {
              setUnit('day');
              setCountText('28');
            }
          } else {
            setUnit(p.unit);
            setCountText(String(p.count));
          }
        }}
        options={PRESETS.map((p) => ({ value: p.value, label: p.label }))}
      />
      {presetValue === 'custom' ? (
        <div className="row" style={{ gap: 'var(--space-md)', alignItems: 'flex-start' }}>
          <TextField
            label="Every"
            value={countText}
            error={errors.count}
            onChange={(e) => setCountText(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            style={{ width: 90 }}
          />
          <SelectField label="Unit" value={unit === 'once' ? 'day' : unit} onChange={(e) => setUnit(e.target.value as CycleUnit)}>
            <option value="day">Days</option>
            <option value="week">Weeks</option>
            <option value="month">Months</option>
            <option value="year">Years</option>
          </SelectField>
          <span className="faint" style={{ alignSelf: 'center', marginTop: 18 }}>
            {cycleLabel(cycle)}
          </span>
        </div>
      ) : null}

      {!isTrial ? (
        <div className="field">
          <span className="label">{unit === 'once' ? 'Due on' : 'Next due'}</span>
          <input className="input" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
        </div>
      ) : null}

      <ChipPicker
        label="Logs to Finance as"
        value={category}
        onChange={setCategory}
        options={categoriesFor('expense').map((c) => ({ value: c.key, label: c.label, color: c.color }))}
      />

      <div className="row" style={{ gap: 'var(--space-md)' }}>
        <div className="grow">
          <SelectField label="Charged to" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">{accounts.length === 0 ? 'No Finance accounts yet' : 'None'}</option>
            {accounts
              .filter((a) => a.is_active || a.id === accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </SelectField>
        </div>
        <div className="grow">
          <SelectField label="Billed through" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Not set</option>
            {CHARGE_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {CHANNEL_LABEL[c]}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <ChipPicker
        label="Reminders"
        value={reminderMode}
        onChange={(v) => setReminderMode(v as ReminderMode)}
        options={[
          { value: 'default', label: 'My defaults' },
          { value: 'custom', label: 'Its own' },
          { value: 'off', label: 'Off' },
        ]}
      />
      {reminderMode === 'custom' ? (
        <div className="row wrap" style={{ gap: 'var(--space-lg)', marginTop: -8 }}>
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
          <CheckRow checked disabled onChange={() => {}} title="On the day" />
        </div>
      ) : null}

      <TextField
        label="Manage or cancel at"
        value={cancelUrl}
        error={errors.url}
        onChange={(e) => setCancelUrl(e.target.value)}
        placeholder="https://…"
      />
      <TextArea
        label="How to cancel"
        value={cancelNotes}
        onChange={(e) => setCancelNotes(e.target.value)}
        placeholder="e.g. cancel in the Play Store, not the app"
        rows={2}
      />

      <div className="field">
        <span className="label">Colour</span>
        <div className="sub-swatches" role="radiogroup" aria-label="Colour">
          {swatches.map((c, index) => (
            <button
              key={c}
              type="button"
              className="sub-swatch"
              role="radio"
              aria-checked={c === currentColour}
              aria-label={`Colour ${index + 1} of ${swatches.length}${index === 0 && service ? ', the brand colour' : ''}`}
              style={{ background: c, color: readableOn(c) }}
              onClick={() => setColor(c)}
            >
              {c === currentColour ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
            </button>
          ))}
        </div>
      </div>

      <TextField label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />

      <ErrorBanner message={error} />
    </Modal>
  );
}
