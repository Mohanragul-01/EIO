/**
 * saveEntry: the add form's writes, and what a failure in each one means.
 *
 * "Pin as a quick add" is a second write after the entry. If it fails - the
 * connection drops between the two, or 0022 has not been run - the entry is
 * already saved. Reporting that as "could not save" left the form filled in
 * with Save enabled, and a second Save logged the payment twice. So: the save
 * fails only when the entry did not save, and a failed pin comes back on its
 * own for the form to mention once it has moved on.
 *
 * api.ts is mocked.
 */
import { saveEntry } from '../saveEntry';
import type { QuickAddInput, TransactionInput } from '../types';

jest.mock('../api', () => ({
  createTransaction: jest.fn(() => Promise.resolve({ id: 't-1' })),
  updateTransaction: jest.fn(() => Promise.resolve({ id: 't-1' })),
  createQuickAdd: jest.fn(() => Promise.resolve({ id: 'q-1' })),
  createTransfer: jest.fn(() => Promise.resolve([])),
  updateTransfer: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

const input: TransactionInput = {
  amount_minor: 25000,
  kind: 'expense',
  category: 'food',
  note: 'Swiggy',
  date: '2026-10-20',
  account_id: 'cash',
};
const pin: QuickAddInput = {
  note: 'Swiggy',
  amount_minor: 25000,
  kind: 'expense',
  category: 'food',
  account_id: 'cash',
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveEntry', () => {
  it('saves the entry and then its pin', async () => {
    await expect(saveEntry({ type: 'entry', input, pin })).resolves.toEqual({ pinError: null });
    expect(api.createTransaction).toHaveBeenCalledWith(input);
    expect(api.createQuickAdd).toHaveBeenCalledWith(pin);
  });

  it('counts the entry as saved when only the pin fails, and says why the pin did not', async () => {
    api.createQuickAdd.mockRejectedValueOnce(new Error('The request timed out'));

    await expect(saveEntry({ type: 'entry', input, pin })).resolves.toEqual({
      pinError: 'The request timed out',
    });
    expect(api.createTransaction).toHaveBeenCalledTimes(1);
  });

  it('fails, and pins nothing, when the entry itself does not save', async () => {
    api.createTransaction.mockRejectedValueOnce(new Error('offline'));

    await expect(saveEntry({ type: 'entry', input, pin })).rejects.toThrow('offline');
    expect(api.createQuickAdd).not.toHaveBeenCalled();
  });

  it('changes an entry being edited rather than adding one', async () => {
    await saveEntry({ type: 'entry', input, id: 't-1' });
    expect(api.updateTransaction).toHaveBeenCalledWith('t-1', input);
    expect(api.createTransaction).not.toHaveBeenCalled();
  });

  it('writes a transfer, or changes the one being edited', async () => {
    const transfer = {
      amount_minor: 200000,
      from_account_id: 'hdfc',
      to_account_id: 'cash',
      note: 'ATM',
      date: '2026-10-20',
    };
    await saveEntry({ type: 'transfer', input: transfer });
    expect(api.createTransfer).toHaveBeenCalledWith(transfer);

    await saveEntry({ type: 'transfer', input: transfer, groupId: 'g', existing: [] });
    expect(api.updateTransfer).toHaveBeenCalledWith('g', transfer, []);
  });
});
