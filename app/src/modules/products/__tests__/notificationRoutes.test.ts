/**
 * What pressing a button on a reorder reminder does, or tapping it.
 *
 *   Ordered     puts the next one on the shelf as a spare, which stops the
 *               reorder reminders and clears "to reorder" everywhere
 *   In 3 days   shows the reorder reminder again three days on
 *   tap         opens the product
 *
 * The buttons act without opening the app. core/notifications, api.ts, the
 * scheduling in notifications.ts and the navigator are mocked; each is tested
 * on its own.
 */
import type { NotificationResponse } from '../../../core/notifications';
import { onProductsChanged } from '../changes';
import { REORDER_CATEGORY } from '../reminders';

jest.mock('../../../core/notifications', () => ({ onResponse: jest.fn() }));

jest.mock('../api', () => ({
  addSpareFromReminder: jest.fn(),
  resyncReminders: jest.fn(() => Promise.resolve()),
}));

jest.mock('../notifications', () => ({
  snoozeReorder: jest.fn(() => Promise.resolve(true)),
}));

const mockNavigate = jest.fn();
jest.mock('../../../navigation/navigationRef', () => ({
  navigateWhenReady: (go: (nav: { navigate: jest.Mock }) => void) => go({ navigate: mockNavigate }),
}));

const core = jest.requireMock('../../../core/notifications') as { onResponse: jest.Mock };
const api = jest.requireMock('../api') as Record<string, jest.Mock>;
const scheduling = jest.requireMock('../notifications') as { snoozeReorder: jest.Mock };

// Registered when the file is imported, as the list screen does at launch.
require('../notificationRoutes');

const handler = core.onResponse.mock.calls.find(
  ([category]) => category === REORDER_CATEGORY,
)?.[1] as (response: NotificationResponse) => Promise<void>;

const response = (
  action: string | null,
  data: Record<string, unknown> = { productId: 'a', name: 'Whey' },
) => ({
  action,
  notificationId: 'product-a-reorder',
  title: 'Time to reorder Whey',
  body: 'About 7 days left at your pace, empty around 17 Jan.',
  data,
});

beforeEach(() => {
  api.addSpareFromReminder.mockReset();
  api.resyncReminders.mockClear();
  scheduling.snoozeReorder.mockClear();
  mockNavigate.mockClear();
});

it('is registered for the reorder reminders when the file is imported', () => {
  expect(handler).toEqual(expect.any(Function));
});

it('Ordered adds the spare, rebuilds the reminders, and tells open screens', async () => {
  api.addSpareFromReminder.mockResolvedValue({ id: 's' });
  const heard = jest.fn();
  const stop = onProductsChanged({}, heard);

  await handler(response('ordered'));
  stop();

  expect(api.addSpareFromReminder).toHaveBeenCalledWith('a');
  expect(api.resyncReminders).toHaveBeenCalled();
  expect(heard).toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('Ordered with a spare already waiting changes nothing on screen', async () => {
  api.addSpareFromReminder.mockResolvedValue(null);
  const heard = jest.fn();
  const stop = onProductsChanged({}, heard);

  await handler(response('ordered'));
  stop();

  expect(heard).not.toHaveBeenCalled();
});

it('In 3 days snoozes the reminder for this product, and opens nothing', async () => {
  await handler(response('later'));
  expect(scheduling.snoozeReorder).toHaveBeenCalledWith({ id: 'a', name: 'Whey' });
  expect(api.addSpareFromReminder).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

it('a tap opens the product', async () => {
  await handler(response(null));
  expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'a' });
});

it('does nothing for a reminder that names no product', async () => {
  await handler(response('ordered', {}));
  await handler(response(null, {}));
  expect(api.addSpareFromReminder).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
