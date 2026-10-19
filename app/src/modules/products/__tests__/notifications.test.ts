/**
 * Products' reminders reach core/notifications as a full rebuild: every
 * `product-` reminder cancelled, then the plan scheduled on the Products
 * channel. Core itself (permission, Expo Go, past dates) is tested in core.
 */
import { replaceReminders, PRODUCTS_CHANNEL } from '../notifications';
import { buildOutlooks } from '../outlook';
import type { Product } from '../types';

// Named mock*, which jest allows a hoisted factory to reach: the factory runs
// when the module is first required, and only calls these later.
const mockCancelPrefix = jest.fn(async () => {});
const mockSchedule = jest.fn(async () => true);

jest.mock('../../../core/notifications', () => ({
  cancelPrefix: (...args: unknown[]) => mockCancelPrefix(...(args as [])),
  schedule: (...args: unknown[]) => mockSchedule(...(args as [])),
  ensurePermission: jest.fn(),
}));

const product: Product = {
  id: 'a',
  user_id: 'u1',
  name: 'Whey',
  category: 'supplement',
  unit: 'g',
  total_quantity: 1000,
  per_use: 30,
  price_minor: null,
  opened_on: '2026-10-10',
  finished_on: null,
  note: '',
  previous_id: null,
  expires_on: null,
  pao_months: null,
  reorder_lead_days: null,
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
};

const uses = [
  {
    id: 'u',
    product_id: 'a',
    user_id: 'u1',
    used_on: '2026-10-10',
    quantity: 100,
    note: '',
    created_at: '2026-10-10T08:00:00Z',
  },
];

beforeEach(() => {
  mockCancelPrefix.mockClear();
  mockSchedule.mockClear();
});

it('clears every product reminder, then schedules the plan on its own channel', async () => {
  const order: string[] = [];
  mockCancelPrefix.mockImplementationOnce(async () => {
    order.push('cancel');
  });
  mockSchedule.mockImplementation(async () => {
    order.push('schedule');
    return true;
  });

  await replaceReminders(
    buildOutlooks([product], uses, '2026-10-19'),
    new Date(2026, 9, 19, 8, 0, 0),
  );

  expect(mockCancelPrefix).toHaveBeenCalledWith('product-');
  expect(order).toEqual(['cancel', 'schedule', 'schedule']);
  expect(mockSchedule).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'product-a-reorder', channel: PRODUCTS_CHANNEL }),
  );
  expect(PRODUCTS_CHANNEL).toEqual({ id: 'products', name: 'Reorder reminders' });
});

it('runs one rebuild at a time, so two close together cannot interleave', async () => {
  const order: string[] = [];
  mockCancelPrefix.mockImplementation(async () => {
    order.push('cancel');
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
  mockSchedule.mockImplementation(async () => {
    order.push('schedule');
    return true;
  });

  const outlooks = buildOutlooks([product], uses, '2026-10-19');
  const now = new Date(2026, 9, 19, 8, 0, 0);
  await Promise.all([replaceReminders(outlooks, now), replaceReminders(outlooks, now)]);

  expect(order).toEqual(['cancel', 'schedule', 'schedule', 'cancel', 'schedule', 'schedule']);
});

it('keeps working after a rebuild that failed', async () => {
  mockCancelPrefix.mockImplementationOnce(async () => {
    throw new Error('boom');
  });
  const outlooks = buildOutlooks([product], uses, '2026-10-19');
  const now = new Date(2026, 9, 19, 8, 0, 0);

  await replaceReminders(outlooks, now);
  mockSchedule.mockClear();
  mockCancelPrefix.mockImplementation(async () => {});
  await replaceReminders(outlooks, now);

  expect(mockSchedule).toHaveBeenCalledTimes(2);
});
