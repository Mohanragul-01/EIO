/**
 * Products' reminders reach core/notifications as a full rebuild: every
 * `product-` reminder cancelled, then the plan scheduled on the Products
 * channel. Core itself (permission, Expo Go, past dates) is tested in core.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  replaceReminders,
  PRODUCTS_CHANNEL,
  REORDER_BUTTONS,
  snoozeReorder,
} from '../notifications';
import { buildOutlooks } from '../outlook';
import { REMINDER_HOUR } from '../reminders';
import type { Product } from '../types';

// Named mock*, which jest allows a hoisted factory to reach: the factory runs
// when the module is first required, and only calls these later.
const mockCancelPrefix = jest.fn(async () => {});
const mockSchedule = jest.fn(async (_input: unknown) => true);

jest.mock('../../../core/notifications', () => ({
  cancelPrefix: (...args: unknown[]) => mockCancelPrefix(...(args as [])),
  schedule: (...args: unknown[]) => mockSchedule(...(args as [unknown])),
  ensurePermission: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      store,
      getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
      setItem: (key: string, value: string) => {
        store.set(key, value);
        return Promise.resolve();
      },
    },
  };
});

const storage = (AsyncStorage as unknown as { store: Map<string, string> }).store;

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

// Three days of use, the least a pace is measured from.
const uses = ['2026-10-10', '2026-10-11', '2026-10-12'].map((used_on, i) => ({
  id: `u${i}`,
  product_id: 'a',
  user_id: 'u1',
  used_on,
  quantity: i === 0 ? 34 : 33,
  note: '',
  created_at: `${used_on}T08:00:00Z`,
}));

beforeEach(() => {
  mockCancelPrefix.mockClear();
  mockSchedule.mockClear();
  storage.clear();
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

it('puts Ordered and In 3 days on reorder reminders, as buttons that act without opening the app', async () => {
  await replaceReminders(
    buildOutlooks([product], uses, '2026-10-19'),
    new Date(2026, 9, 19, 8, 0, 0),
  );

  expect(REORDER_BUTTONS).toEqual({
    id: 'product_reorder',
    actions: [
      { id: 'ordered', title: 'Ordered' },
      { id: 'later', title: 'In 3 days' },
    ],
    opensApp: false,
  });
  expect(mockSchedule).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'product-a-reorder', category: REORDER_BUTTONS }),
  );
});

describe('In 3 days', () => {
  // 90 g a day from 10 Oct, 100 g left on the 19th: the reorder morning has
  // passed, so only a snooze brings that reminder back.
  const nearlyEmpty = ['2026-10-10', '2026-10-11', '2026-10-12'].map((used_on, i) => ({
    ...uses[i],
    used_on,
    quantity: 300,
  }));
  const evening = new Date(2026, 9, 19, 20, 0, 0);
  const on22nd = new Date(2026, 9, 22, REMINDER_HOUR, 0, 0, 0);

  it('shows the reorder reminder again at 09:00 three days on, with its buttons', async () => {
    await snoozeReorder({ id: 'a', name: 'Whey' }, evening);
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'product-a-reorder',
        date: on22nd,
        title: 'Time to reorder Whey',
        channel: PRODUCTS_CHANNEL,
        category: REORDER_BUTTONS,
      }),
    );
  });

  it('survives the rebuild after the next log, which clears every product reminder', async () => {
    await snoozeReorder({ id: 'a', name: 'Whey' }, evening);
    mockSchedule.mockClear();

    await replaceReminders(buildOutlooks([product], nearlyEmpty, '2026-10-19'), evening);

    expect(mockCancelPrefix).toHaveBeenCalledWith('product-');
    expect(mockSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-a-reorder', date: on22nd }),
    );
  });

  it('is forgotten once a spare is on the shelf', async () => {
    await snoozeReorder({ id: 'a', name: 'Whey' }, evening);
    mockSchedule.mockClear();
    const spare: Product = { ...product, id: 's', opened_on: null };

    await replaceReminders(buildOutlooks([product, spare], nearlyEmpty, '2026-10-19'), evening);
    expect(mockSchedule).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-a-reorder' }),
    );

    // Nor by a later rebuild: it is gone, not set aside.
    mockSchedule.mockClear();
    await replaceReminders(buildOutlooks([product], nearlyEmpty, '2026-10-19'), evening);
    expect(mockSchedule).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-a-reorder' }),
    );
  });
});
