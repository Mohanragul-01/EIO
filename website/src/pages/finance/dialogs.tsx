/**
 * The Finance page's two small dialogs: a quick add's details, and settings.
 */
import { useState } from 'react';

import { categoryDef } from '@app/core/categories';
import { todayISO } from '@app/core/date';
import { minorToAmountString, parseAmountToMinor } from '@app/core/money';
import { formatRange, periodBounds, periodOf, periodTitle } from '@app/modules/finance/period';
import type { QuickAdd, QuickAddInput } from '@app/modules/finance/types';

import { ErrorBanner, Modal, TextField } from '../../components/ui';

/** Change a pin's name or amount, or unpin it (undoable, so not confirmed). */
export function QuickAddDialog({
  quickAdd,
  onClose,
  onSave,
  onUnpin,
}: {
  quickAdd: QuickAdd;
  onClose: () => void;
  onSave: (id: string, patch: Partial<QuickAddInput>) => Promise<void>;
  onUnpin: (quickAdd: QuickAdd) => void;
}) {
  const [note, setNote] = useState(quickAdd.note);
  const [amount, setAmount] = useState(minorToAmountString(quickAdd.amount_minor).replace(/\.00$/, ''));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const minor = parseAmountToMinor(amount);
    if (!note.trim()) return setError('Give it a name, like Chai');
    if (minor === null || minor <= 0) return setError('Enter an amount like 20');
    setSaving(true);
    try {
      await onSave(quickAdd.id, { note: note.trim(), amount_minor: minor });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Quick add"
      onClose={onClose}
      width={420}
      footer={
        <>
          <button
            className="btn btn-ghost"
            style={{ marginRight: 'auto', color: 'var(--danger)' }}
            onClick={() => {
              onClose();
              onUnpin(quickAdd);
            }}
          >
            Unpin
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <p className="secondary" style={{ fontSize: 13, margin: 0 }}>
        Logs a {categoryDef(quickAdd.category).label} {quickAdd.kind} dated the day you click it.
      </p>
      <TextField label="Name" value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} autoFocus />
      <TextField label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <ErrorBanner message={error} />
    </Modal>
  );
}

/** When the finance month starts. Synced, so the phone follows it too. */
export function SettingsDialog({
  startDay,
  onClose,
  onSave,
}: {
  startDay: number;
  onClose: () => void;
  onSave: (day: number) => Promise<void>;
}) {
  const [day, setDay] = useState(startDay);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const period = periodOf(todayISO(), day);

  const save = async () => {
    setSaving(true);
    try {
      await onSave(day);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Finance settings"
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving || day === startDay}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <label className="field">
        <span className="label">Month starts on day</span>
        <input
          className="input"
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(Math.min(31, Math.max(1, Math.round(Number(e.target.value) || 1))))}
          style={{ width: 96 }}
        />
      </label>
      <p style={{ margin: 0, fontSize: 13.5 }}>
        {periodTitle(period)} is {formatRange(periodBounds(period, day))}.
      </p>
      <p className="faint" style={{ fontSize: 12, margin: 0 }}>
        Set it to your salary day, so a month runs from one pay to the next. Totals, budgets and the
        trend all follow it, here and on the phone. A day past a month&apos;s end means its last day.
      </p>
      <ErrorBanner message={error} />
    </Modal>
  );
}
