/**
 * Smart defaults for the add form.
 *
 * Every default the form gets right is a tap saved on an entry made at a shop
 * counter, many times a day. Every one it gets wrong is a mis-filed rupee
 * nobody notices, so "no answer" is preferred to a guess.
 */
import { categoryForNote, lastTransfer, lastUsed, normalizeNote, noteSuggestions } from '../defaults';
import type { Transaction } from '../types';

let seq = 0;
function row(over: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: `r${seq}`,
    user_id: 'u',
    amount_minor: 2000,
    kind: 'expense',
    category: 'food',
    note: '',
    date: '2026-10-19',
    created_at: '2026-10-19T08:00:00Z',
    account_id: 'cash',
    transfer_group_id: null,
    transfer_direction: null,
    ...over,
  };
}

// Newest first, the order api.listRecent returns.
const recent = [
  row({ kind: 'transfer', category: 'transfer', account_id: 'hdfc', transfer_group_id: 'g', transfer_direction: 'out' }),
  row({ kind: 'transfer', category: 'transfer', account_id: 'cash', transfer_group_id: 'g', transfer_direction: 'in' }),
  row({ kind: 'expense', category: 'transport', note: 'Metro', account_id: null }),
  row({ kind: 'income', category: 'salary', note: 'October salary', account_id: 'hdfc' }),
  row({ kind: 'expense', category: 'food', note: 'Chai', account_id: 'cash', amount_minor: 2000 }),
  row({ kind: 'expense', category: 'groceries', note: '  chai  ', account_id: 'upi' }),
  row({ kind: 'expense', category: 'food', note: 'Chaat', account_id: 'upi', amount_minor: 6000 }),
  row({ kind: 'expense', category: 'shopping', note: 'Charger', account_id: 'upi' }),
];

describe('lastUsed', () => {
  it('takes the newest category and the newest account for that kind, skipping transfers', () => {
    expect(lastUsed(recent, 'expense')).toEqual({ category: 'transport', accountId: 'cash' });
    expect(lastUsed(recent, 'income')).toEqual({ category: 'salary', accountId: 'hdfc' });
  });

  it('has no answer with no history', () => {
    expect(lastUsed([], 'expense')).toEqual({ category: null, accountId: null });
  });
});

describe('lastTransfer', () => {
  it('reads the newest transfer as from and to', () => {
    expect(lastTransfer(recent)).toEqual({ fromId: 'hdfc', toId: 'cash' });
    expect(lastTransfer([])).toBeNull();
  });
});

describe('note memory', () => {
  it('normalises case and spacing', () => {
    expect(normalizeNote('  Masala   Chai ')).toBe('masala chai');
  });

  it("gives an earlier note's category, the newest one winning", () => {
    expect(categoryForNote('CHAI', recent, 'expense')).toBe('food');
    expect(categoryForNote('metro', recent, 'expense')).toBe('transport');
  });

  it('stays within the kind, and has no answer for a new note', () => {
    expect(categoryForNote('October salary', recent, 'expense')).toBeNull();
    expect(categoryForNote('Dosa', recent, 'expense')).toBeNull();
    expect(categoryForNote('   ', recent, 'expense')).toBeNull();
  });
});

describe('noteSuggestions', () => {
  it('puts notes that start with what you typed before ones that only contain it', () => {
    const notes = noteSuggestions('ch', recent, 'expense').map((s) => s.note);
    expect(notes).toEqual(['Chai', 'Chaat', 'Charger']);
  });

  it('lists each note once, as it was last logged', () => {
    const chai = noteSuggestions('chai', recent, 'expense');
    // "Chai" exactly matches what was typed, so it is not suggested back.
    expect(chai).toEqual([]);
    const cha = noteSuggestions('cha', recent, 'expense');
    expect(cha[0]).toEqual({ note: 'Chai', category: 'food', amountMinor: 2000, accountId: 'cash' });
  });

  it('matches inside a note too', () => {
    expect(noteSuggestions('arg', recent, 'expense').map((s) => s.note)).toEqual(['Charger']);
  });

  it('offers the most recent notes before anything is typed', () => {
    expect(noteSuggestions('', recent, 'expense', 2).map((s) => s.note)).toEqual(['Metro', 'Chai']);
  });

  it('keeps to the limit and the kind', () => {
    expect(noteSuggestions('', recent, 'income').map((s) => s.note)).toEqual(['October salary']);
    expect(noteSuggestions('c', recent, 'expense', 1)).toHaveLength(1);
  });
});
