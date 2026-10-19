/**
 * api.ts: the order of its writes, and what it sends.
 *
 * Undoing a Mark paid is two writes: take the payment out of Finance, then put
 * the due date back. Either can fail on a bad connection, and the generic
 * "Could not undo that" left the person guessing which half happened - and a
 * guess of "nothing" invites a second Mark paid. The error says where it
 * stopped.
 *
 * A price change is dated by the phone's calendar, not the database's: the
 * database's current_date is UTC, a day behind India until 05:30.
 *
 * The ledger, the database and the reminders are stood in for.
 */
import { todayISO } from '../../../core/date';
import type { MarkPaidResult } from '../api';
import type { Subscription } from '../types';

const mockRemoveEntry = jest.fn((_id: string) => Promise.resolve());
const mockInsert = jest.fn((_row: Record<string, unknown>) => undefined);
const mockUpdate = jest.fn((_patch: unknown) =>
  Promise.resolve({ data: null as unknown, error: null as { message: string } | null }),
);

jest.mock('../../../core/ledger', () => ({
  removeEntry: (id: string) => mockRemoveEntry(id),
  recordEntry: jest.fn(),
}));
jest.mock('../../../core/notifications', () => ({ registerResync: jest.fn() }));
jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../notifications', () => ({
  cancelReminders: jest.fn(() => Promise.resolve()),
  rescheduleAll: jest.fn(() => Promise.resolve()),
  scheduleReminders: jest.fn(() => Promise.resolve(0)),
}));
jest.mock('../../../core/supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch: unknown) => ({
        eq: () => ({ select: () => ({ single: () => mockUpdate(patch) }) }),
      }),
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
      insert: (row: Record<string, unknown>) => {
        mockInsert(row);
        return {
          select: () => ({ single: () => Promise.resolve({ data: { id: 'p-1' }, error: null }) }),
        };
      },
    }),
  },
}));

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
    billing_cycle: 'monthly',
    next_due_date: '2026-10-26',
    is_active: true,
    category: 'fun',
    note: '',
    created_at: '',
    updated_at: '',
    status: 'active',
    trial_ends_on: null,
    ends_on: null,
    resume_on: null,
    cancel_url: null,
    cancel_notes: '',
    service_key: null,
    color: null,
    account_id: null,
    charge_channel: null,
    reminder_offsets: null,
    cycle_unit: 'month',
    cycle_count: 1,
    currency: 'INR',
    fx_rate: null,
    fx_rate_on: null,
    anchor_day: null,
    ...overrides,
  };
}

const result: MarkPaidResult = {
  subscription: sub({ next_due_date: '2026-11-26' }),
  previous: sub(),
  transactionId: 't-1',
  priceChangeId: null,
  logged: true,
};

beforeEach(() => {
  mockRemoveEntry.mockClear();
  mockUpdate.mockClear();
  mockInsert.mockClear();
});

describe('undoMarkPaid', () => {
  it('puts the due date back after taking the payment out', async () => {
    mockUpdate.mockImplementationOnce(() => Promise.resolve({ data: sub(), error: null }));

    const restored = await api.undoMarkPaid(result);

    expect(mockRemoveEntry).toHaveBeenCalledWith('t-1');
    expect(restored.next_due_date).toBe('2026-10-26');
  });

  it('says nothing changed when the payment could not be taken out', async () => {
    mockRemoveEntry.mockImplementationOnce(() =>
      Promise.reject(new Error('Network request failed')),
    );

    await expect(api.undoMarkPaid(result)).rejects.toThrow(
      'Could not undo: the payment is still in Finance and nothing changed. Try again.',
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('says the payment is out but the date is not back, and where to fix it', async () => {
    mockUpdate.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: { message: 'Network request failed' } }),
    );

    const error = await api.undoMarkPaid(result).then(
      () => null,
      (e: Error) => e,
    );

    // The date it is stuck on and the one to put back, as the list shows dates.
    const day = (iso: string) =>
      new Date(`${iso}T00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    expect(error?.message).toBe(
      `Undo stopped halfway: the payment is out of Finance, but Netflix is still due ${day('2026-11-26')}. ` +
        `Set it back to ${day('2026-10-26')} in Edit.`,
    );
  });
});

describe('a price change', () => {
  it("is dated by the phone's calendar", async () => {
    mockUpdate.mockImplementationOnce(() =>
      Promise.resolve({ data: sub({ amount_minor: 69900 }), error: null }),
    );

    await api.updateSubscription('abc', { amount_minor: 69900 }, sub());

    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toMatchObject({
      old_amount_minor: 64900,
      new_amount_minor: 69900,
      effective_on: todayISO(),
    });
  });
});
