/**
 * saveEntry.ts - what the add form's Save writes, in order.
 *
 * An expense or income, then its pin if "Pin as a quick add" is on; or a
 * transfer's two rows. Out of the screen so the order of the writes, and what
 * a failure in each means, can be tested without drawing a form.
 *
 * THE ENTRY IS FINAL ONCE IT SAVES. The pin is a second write, and it can
 * fail after the first succeeded: the connection drops between them, or 0022
 * has not been run. Failing the whole save then left the form filled in under
 * "could not save", and a second tap on Save logged the payment twice. So this
 * throws only when the entry itself did not save; a failed pin comes back as
 * `pinError`, for the form to mention after it has moved on.
 */
import * as api from './api';
import type { QuickAddInput, Transaction, TransactionInput, TransferInput } from './types';

export type EntryWrite =
  | { type: 'transfer'; input: TransferInput; groupId?: string; existing?: Transaction[] | null }
  | { type: 'entry'; input: TransactionInput; id?: string; pin?: QuickAddInput | null };

export async function saveEntry(write: EntryWrite): Promise<{ pinError: string | null }> {
  if (write.type === 'transfer') {
    if (write.groupId && write.existing) {
      await api.updateTransfer(write.groupId, write.input, write.existing);
    } else {
      await api.createTransfer(write.input);
    }
    return { pinError: null };
  }

  if (write.id) await api.updateTransaction(write.id, write.input);
  else await api.createTransaction(write.input);

  if (!write.pin) return { pinError: null };
  try {
    await api.createQuickAdd(write.pin);
    return { pinError: null };
  } catch (e) {
    return { pinError: e instanceof Error ? e.message : 'Could not pin it' };
  }
}
