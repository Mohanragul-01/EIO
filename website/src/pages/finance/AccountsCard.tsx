/**
 * AccountsCard - each account's balance and each card's debt, beside the ledger.
 *
 * Balances come from accounts.ts, shared with the phone: an opening balance
 * plus everything logged to it, a card counted as what you owe, and a line for
 * entries in no account so the rows add up to the headline figure.
 */
import { useState } from 'react';

import { formatMoney, minorToAmountString } from '@app/core/money';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, parseSignedAmount, type AccountsSummary, type AccountBalance } from '@app/modules/finance/accounts';
import { formatBalance } from '@app/modules/finance/analytics';
import type { Account, AccountInput, AccountType } from '@app/modules/finance/types';

import { Icon } from '../../components/Icon';
import { ErrorBanner, Modal, SelectField, TextField } from '../../components/ui';

export function AccountsCard({
  summary,
  onEdit,
  onAdd,
}: {
  summary: AccountsSummary;
  onEdit: (balance: AccountBalance) => void;
  onAdd: () => void;
}) {
  const row = (balance: AccountBalance, owed: boolean) => (
    <button
      key={balance.account.id}
      type="button"
      className="fin-account"
      onClick={() => onEdit(balance)}
      style={{ opacity: balance.account.is_active ? 1 : 0.6 }}
    >
      <span className="truncate">
        {balance.account.name}
        <span className="faint">
          {' '}
          · {ACCOUNT_TYPE_LABEL[balance.account.type]}
          {balance.account.is_active ? '' : ' · archived'}
        </span>
      </span>
      <span
        className="numeric"
        style={{ fontWeight: 600, color: !owed && balance.balanceMinor < 0 ? 'var(--danger)' : undefined }}
      >
        {owed ? formatMoney(balance.balanceMinor, { compact: true }) : formatBalance(balance.balanceMinor)}
      </span>
    </button>
  );

  return (
    <div className="card card-pad rise">
      <div className="row-between" style={{ marginBottom: 'var(--space-sm)' }}>
        <span className="overline">Accounts</span>
        <button className="btn btn-ghost btn-sm" onClick={onAdd}>
          <Icon name="plus" size={14} /> Add
        </button>
      </div>

      {summary.assets.length + summary.liabilities.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
          Add where your money sits - a bank, a wallet, your cash - and any credit card, so moving
          money between them is never counted as spending.
        </p>
      ) : null}

      <div className="col" style={{ gap: 2 }}>{summary.assets.map((b) => row(b, false))}</div>

      {summary.liabilities.length > 0 ? (
        <>
          <div className="overline" style={{ margin: 'var(--space-md) 0 var(--space-xs)' }}>
            Owed on cards · {formatMoney(summary.owedMinor, { compact: true })}
          </div>
          <div className="col" style={{ gap: 2 }}>{summary.liabilities.map((b) => row(b, true))}</div>
        </>
      ) : null}

      {summary.unassigned.count > 0 ? (
        <p className="faint" style={{ fontSize: 12, margin: 'var(--space-md) 0 0' }}>
          {summary.unassigned.count} {summary.unassigned.count === 1 ? 'entry is' : 'entries are'} in no
          account ({formatBalance(summary.unassigned.flowMinor)} net) - logged before accounts, or by
          Subscriptions&apos; mark-paid. Edit one to give it an account.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Add an account or change one. An account with entries can be archived but
 * not deleted: 0008 would set its entries to no account, stripping their
 * history. Delete is offered only for an empty account, and confirmed.
 */
export function AccountDialog({
  balance,
  onClose,
  onSave,
  onSetActive,
  onDelete,
}: {
  /** The account being changed, or null to add one. */
  balance: AccountBalance | null;
  onClose: () => void;
  onSave: (input: AccountInput) => Promise<void>;
  onSetActive: (account: Account, active: boolean) => void;
  onDelete: (account: Account) => void;
}) {
  const account = balance?.account ?? null;
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'bank');
  const [opening, setOpening] = useState(
    account && account.opening_balance_minor !== 0
      ? minorToAmountString(account.opening_balance_minor).replace(/\.00$/, '')
      : '',
  );
  const [liability, setLiability] = useState(account?.is_liability ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const openingMinor = parseSignedAmount(opening);
    if (!name.trim()) return setError('Give it a name, like HDFC or Cash');
    if (openingMinor === null) return setError('The opening balance is not an amount');
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), type, opening_balance_minor: openingMinor, is_liability: liability });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that account');
      setSaving(false);
    }
  };

  const entries = balance?.entryCount ?? 0;

  return (
    <Modal
      open
      title={account ? account.name : 'Add an account'}
      onClose={onClose}
      footer={
        <>
          {account ? (
            <button
              className="btn btn-ghost"
              style={{ marginRight: 'auto' }}
              onClick={() => {
                onClose();
                onSetActive(account, !account.is_active);
              }}
            >
              {account.is_active ? 'Archive' : 'Bring back'}
            </button>
          ) : null}
          {account && entries === 0 ? (
            <button
              className="btn btn-ghost"
              style={{ color: 'var(--danger)' }}
              onClick={() => {
                onClose();
                onDelete(account);
              }}
            >
              Delete
            </button>
          ) : null}
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC" maxLength={40} autoFocus />
      <SelectField
        label="Type"
        value={type}
        onChange={(e) => {
          const next = e.target.value as AccountType;
          setType(next);
          // A card is money you owe; the checkbox below covers the odd case.
          setLiability(next === 'credit_card');
        }}
      >
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>
            {ACCOUNT_TYPE_LABEL[t]}
          </option>
        ))}
      </SelectField>
      <TextField
        label={liability ? 'What you owed when you started logging (₹)' : 'Balance when you started logging (₹)'}
        value={opening}
        onChange={(e) => setOpening(e.target.value)}
        placeholder="0"
        hint="Its balance is this plus everything logged to it since. Negative is allowed."
      />
      <label className="row" style={{ gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={liability} onChange={(e) => setLiability(e.target.checked)} />
        Money you owe (counts against your balance, like a credit card)
      </label>
      {account && entries > 0 ? (
        <p className="faint" style={{ fontSize: 12 }}>
          It has {entries} {entries === 1 ? 'entry' : 'entries'}, so it can be archived but not deleted:
          archiving hides it from pickers and keeps every entry and its balance.
        </p>
      ) : null}
      <ErrorBanner message={error} />
    </Modal>
  );
}
