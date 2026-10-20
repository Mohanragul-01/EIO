/**
 * useNotificationAction: a reminder's button arriving on the detail screen.
 *
 * What must hold: the button opens its sheet once per arrival, and only while
 * it still applies; when it does not, a toast says why - after the render,
 * not during it. The toast lives in another component (the provider), and
 * setting another component's state while rendering is what React warns
 * about ("Cannot update a component while rendering a different
 * component"); under StrictMode it could show twice.
 *
 * The toast is stood in for by a parent whose state each toast changes,
 * which is exactly the provider's situation.
 */
import { renderHook } from '@testing-library/react-native';
import React, { useState } from 'react';

import { useNotificationAction, type Arrival } from '../components/useNotificationAction';
import type { Subscription } from '../types';

const mockShow = jest.fn();
jest.mock('../../../core/components', () => ({
  useToast: () => ({ show: mockShow, hide: jest.fn() }),
}));

const TODAY = '2026-10-19';

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'abc',
    user_id: 'u',
    name: 'Netflix',
    amount_minor: 64900,
    billing_cycle: 'monthly',
    next_due_date: '2026-10-19',
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

/** A parent that re-renders on every toast, as the real provider does. */
function ToastHost({ children }: { children: React.ReactNode }) {
  const [, setShown] = useState(0);
  mockShow.mockImplementation(() => setShown((n) => n + 1));
  return <>{children}</>;
}

async function arrive(arrival: Arrival, row: Subscription | null, run = jest.fn()) {
  const { rerender } = await renderHook(
    ({ current }: { current: Subscription | null }) =>
      useNotificationAction(arrival, current, TODAY, run),
    { initialProps: { current: row }, wrapper: ToastHost },
  );
  return { rerender, run };
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  mockShow.mockReset();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

const renderWarnings = () =>
  consoleError.mock.calls.filter((args) => String(args[0]).includes('Cannot update a component'));

describe('useNotificationAction', () => {
  it('opens Mark paid for a renewal that is due, once per arrival', async () => {
    const due = sub();
    const { run, rerender } = await arrive({ id: 'abc', action: 'pay', at: '1', key: 'k' }, due);
    await rerender({ current: { ...due } });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith('pay', due);
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('waits for the subscription to load, and ignores another one', async () => {
    const { run, rerender } = await arrive({ id: 'abc', action: 'pay', at: '1', key: 'k' }, null);
    await rerender({ current: sub({ id: 'other' }) });
    expect(run).not.toHaveBeenCalled();

    await rerender({ current: sub() });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('says it was already paid after the render, not during it', async () => {
    // Paid already: the next due date is a month away.
    const paid = sub({ next_due_date: '2026-11-19' });
    const { run, rerender } = await arrive({ id: 'abc', action: 'pay', at: '1', key: 'k' }, paid);
    await rerender({ current: { ...paid } });

    expect(run).not.toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledWith({ message: 'Already paid for this cycle' });
    expect(renderWarnings()).toEqual([]);
  });
});
