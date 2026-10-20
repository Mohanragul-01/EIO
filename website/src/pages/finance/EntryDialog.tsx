/**
 * EntryDialog - add or edit an expense, an income or a transfer.
 *
 * The phone form's rules, from the same shared functions: the category and
 * account last used for the kind, a note's remembered category, the most-used
 * categories first, recent notes one click away, Save & add another, and a
 * pin. Enter in the amount saves.
 */
import { useMemo, useState } from 'react';

import { categoriesFor, categoryDef } from '@app/core/categories';
import { todayISO } from '@app/core/date';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '@app/core/money';
import { activeAccounts } from '@app/modules/finance/accounts';
import * as api from '@app/modules/finance/api';
import { categoryForNote, lastTransfer, lastUsed, noteSuggestions, orderByUse } from '@app/modules/finance/defaults';
import type { ListItem } from '@app/modules/finance/summary';
import type { Account, EntryKind, Transaction, TransactionKind } from '@app/modules/finance/types';

import { Icon } from '../../components/Icon';
import { ChipPicker, ErrorBanner, Modal, Segmented, SelectField, TextField } from '../../components/ui';

export type EntryTarget =
  | { mode: 'new'; date?: string; kind?: TransactionKind; accountId?: string }
  | { mode: 'edit'; item: ListItem };

const KIND_LABEL: Record<TransactionKind, string> = { expense: 'Expense', income: 'Income', transfer: 'Transfer' };

const amountText = (minor: number) => minorToAmountString(minor).replace(/\.00$/, '');

type Initial = {
  kind: TransactionKind;
  amount: string;
  category: string;
  accountId: string;
  fromId: string;
  toId: string;
  note: string;
  date: string;
};

/** Everything the form starts with, worked out once when it opens. */
function initialState(target: EntryTarget, accounts: Account[], recent: Transaction[]): Initial {
  const active = activeAccounts(accounts);
  const isActive = (id: string | null | undefined): id is string => !!id && active.some((a) => a.id === id);

  if (target.mode === 'edit') {
    const { item } = target;
    if (item.type === 'transfer') {
      return {
        kind: 'transfer',
        amount: amountText(item.amountMinor),
        category: '',
        accountId: '',
        fromId: item.fromAccountId ?? '',
        toId: item.toAccountId ?? '',
        note: item.note,
        date: item.date,
      };
    }
    const tx = item.tx;
    return {
      kind: tx.kind,
      amount: amountText(tx.amount_minor),
      category: tx.category,
      accountId: tx.account_id ?? '',
      fromId: '',
      toId: '',
      note: tx.note,
      date: tx.date,
    };
  }

  const kind = target.kind ?? 'expense';
  const entryKind: EntryKind = kind === 'income' ? 'income' : 'expense';
  const defaults = lastUsed(recent, entryKind);
  const last = lastTransfer(recent);
  const from = (isActive(target.accountId) && target.accountId) || (isActive(last?.fromId) && last?.fromId) || active[0]?.id || '';
  return {
    kind,
    amount: '',
    category: defaults.category ?? categoriesFor(entryKind)[0].key,
    accountId:
      (isActive(target.accountId) && target.accountId) ||
      (isActive(defaults.accountId) && defaults.accountId) ||
      active[0]?.id ||
      '',
    fromId: from,
    toId: (isActive(last?.toId) && last?.toId !== from && last?.toId) || active.find((a) => a.id !== from)?.id || '',
    note: '',
    date: target.date ?? todayISO(),
  };
}

export function EntryDialog({
  target,
  accounts,
  recent,
  onClose,
  onSaved,
}: {
  target: EntryTarget;
  accounts: Account[];
  recent: Transaction[];
  onClose: () => void;
  /** Called after every save; `stayOpen` for Save & add another. */
  onSaved: (message: string, stayOpen: boolean) => void;
}) {
  const isEditing = target.mode === 'edit';
  const [initial] = useState(() => initialState(target, accounts, recent));

  const [kind, setKind] = useState<TransactionKind>(initial.kind);
  const [amount, setAmount] = useState(initial.amount);
  const [category, setCategory] = useState(initial.category);
  const [categoryChosen, setCategoryChosen] = useState(isEditing);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [fromId, setFromId] = useState(initial.fromId);
  const [toId, setToId] = useState(initial.toId);
  const [note, setNote] = useState(initial.note);
  const [date, setDate] = useState(initial.date);
  const [pin, setPin] = useState(false);

  /** "Saved ₹250 · Food" after Save & add another: a toast would sit behind this dialog. */
  const [saved, setSaved] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const entryKind: EntryKind = kind === 'income' ? 'income' : 'expense';
  const options = useMemo(
    () => orderByUse(categoriesFor(entryKind), recent, entryKind),
    [entryKind, recent],
  );
  const suggestions =
    isEditing || kind === 'transfer' ? [] : noteSuggestions(note, recent, entryKind);

  // An archived account stays listed on an entry that already uses it.
  const choosable = accounts.filter(
    (a) => a.is_active || a.id === accountId || a.id === fromId || a.id === toId,
  );

  const kinds: TransactionKind[] =
    target.mode === 'edit'
      ? target.item.type === 'transfer'
        ? []
        : ['expense', 'income']
      : ['expense', 'income', 'transfer'];

  const changeKind = (next: TransactionKind) => {
    setKind(next);
    if (next === 'transfer') return;
    if (!categoriesFor(next).some((c) => c.key === category)) {
      setCategory(lastUsed(recent, next).category ?? categoriesFor(next)[0].key);
      setCategoryChosen(false);
    }
  };

  const changeNote = (text: string) => {
    setNote(text);
    if (!categoryChosen && kind !== 'transfer') {
      const remembered = categoryForNote(text, recent, entryKind);
      if (remembered) setCategory(remembered);
    }
  };

  const save = async (stayOpen: boolean) => {
    // Enter reaches here too, and the button being disabled does not stop it:
    // a second Enter during a slow save would add the entry twice.
    if (saving) return;
    const minor = parseAmountToMinor(amount);
    if (minor === null || minor <= 0) return setAmountError('Enter an amount like 250 or 249.50');
    if (kind === 'transfer' && (!fromId || !toId)) return setError('Pick the account it left and the one it reached.');
    if (kind === 'transfer' && fromId === toId) return setError('A transfer needs two different accounts.');

    setAmountError(null);
    setError(null);
    setSaving(true);
    try {
      if (kind === 'transfer') {
        const input = { amount_minor: minor, from_account_id: fromId, to_account_id: toId, note: note.trim(), date };
        if (target.mode === 'edit' && target.item.type === 'transfer') {
          await api.updateTransfer(target.item.groupId, input, target.item.rows);
        } else {
          await api.createTransfer(input);
        }
      } else {
        const input = {
          amount_minor: minor,
          kind: entryKind,
          category,
          note: note.trim(),
          date,
          account_id: accountId || null,
        };
        if (target.mode === 'edit' && target.item.type === 'entry') await api.updateTransaction(target.item.tx.id, input);
        else await api.createTransaction(input);
        if (pin && !isEditing) {
          await api.createQuickAdd({
            note: note.trim() || categoryDef(category).label,
            amount_minor: minor,
            kind: entryKind,
            category,
            account_id: accountId || null,
          });
        }
      }

      const label = kind === 'transfer' ? 'transfer' : categoryDef(category).label;
      const message = `Saved ${formatMoney(minor, { compact: true })} · ${label}`;
      onSaved(message, stayOpen);
      if (stayOpen) {
        setSaved(message);
        // The next line of the same receipt shares kind, account, category and
        // date; only the amount and the note differ.
        setAmount('');
        setNote('');
        setPin(false);
        setCategoryChosen(false);
        setSaving(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
      setSaving(false);
    }
  };

  const accountSelect = (label: string, value: string, onChange: (id: string) => void) => (
    <SelectField label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {kind !== 'transfer' ? <option value="">No account</option> : <option value="">Pick an account</option>}
      {choosable.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.is_active ? '' : ' (archived)'}
        </option>
      ))}
    </SelectField>
  );

  return (
    <Modal
      open
      title={isEditing ? (kind === 'transfer' ? 'Edit transfer' : 'Edit entry') : 'New entry'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!isEditing ? (
            <button className="btn btn-secondary" onClick={() => void save(true)} disabled={saving}>
              Save &amp; add another
            </button>
          ) : null}
          <button className="btn" onClick={() => void save(false)} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      {kinds.length > 0 ? (
        <Segmented
          value={kind}
          onChange={changeKind}
          options={kinds.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
        />
      ) : (
        <p className="secondary" style={{ fontSize: 13 }}>
          A transfer between your own accounts. It is not spending or income.
        </p>
      )}

      <TextField
        label="Amount (₹)"
        value={amount}
        error={amountError}
        onChange={(e) => {
          setAmount(e.target.value);
          setSaved(null);
          if (amountError) setAmountError(null);
        }}
        placeholder="0.00"
        inputMode="decimal"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') void save(false);
        }}
      />

      {kind === 'transfer' ? (
        <div className="fin-two">
          {accountSelect('From', fromId, (id) => {
            if (id === toId) setToId(fromId);
            setFromId(id);
          })}
          {accountSelect('To', toId, (id) => {
            if (id === fromId) setFromId(toId);
            setToId(id);
          })}
        </div>
      ) : (
        <>
          {accountSelect(kind === 'income' ? 'Received in' : 'Paid from', accountId, setAccountId)}
          <ChipPicker
            label="Category"
            value={category}
            onChange={(key) => {
              setCategory(key);
              setCategoryChosen(true);
            }}
            options={options.map((c) => ({ value: c.key, label: c.label, color: c.color }))}
          />
        </>
      )}

      <TextField
        label="Note"
        value={note}
        onChange={(e) => changeNote(e.target.value)}
        placeholder={kind === 'transfer' ? 'ATM, card bill…' : 'What was it for?'}
        maxLength={200}
      />

      {suggestions.length > 0 ? (
        <div className="chip-row" style={{ marginTop: -6 }} aria-label="Recent notes">
          {suggestions.map((s) => (
            <button
              key={s.note}
              type="button"
              className="chip"
              onClick={() => {
                setNote(s.note);
                setCategory(s.category);
                setCategoryChosen(false);
                if (!amount.trim()) setAmount(amountText(s.amountMinor));
              }}
            >
              <span className="dot" style={{ background: categoryDef(s.category).color }} />
              {s.note} · {formatMoney(s.amountMinor, { compact: true })}
            </button>
          ))}
        </div>
      ) : null}

      <div className="field">
        <span className="label">Date</span>
        <input className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
      </div>

      {!isEditing && kind !== 'transfer' ? (
        <label className="row" style={{ gap: 8, fontSize: 13 }}>
          <input type="checkbox" checked={pin} onChange={(e) => setPin(e.target.checked)} />
          Pin as a quick add, to log it again in one click
        </label>
      ) : null}

      {saved ? (
        <p role="status" className="row" style={{ gap: 6, margin: 0, fontSize: 13, color: 'var(--success)' }}>
          <Icon name="check" size={14} /> {saved}. Add the next one.
        </p>
      ) : null}
      <ErrorBanner message={error} />
    </Modal>
  );
}
