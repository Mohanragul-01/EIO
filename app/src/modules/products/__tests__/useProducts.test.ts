/**
 * useProducts: a one-tap log must stay on the list, exactly once, whatever a
 * load in flight brings back.
 *
 * The bug this file was written for: go back from a product's page and tap
 * "Log use" at once. The focus load, which read the uses BEFORE the insert,
 * landed during the save and replaced the list, taking the pending row with
 * it; the save then had no pending row to swap for the saved one. The toast
 * said "Logged 30 g · Today", the card did not move, and a second tap logged
 * a duplicate. Landing the other way round - the save first, the old load
 * after - wiped the saved row instead. api.ts is mocked.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { Product, ProductUse } from '../types';
import { useProducts } from '../useProducts';

jest.mock('../api', () => ({
  listProducts: jest.fn(),
  listAllUses: jest.fn(),
  logUse: jest.fn(),
  logUses: jest.fn(),
  deleteUses: jest.fn(),
}));

jest.mock('../notifications', () => ({
  replaceReminders: jest.fn(() => Promise.resolve()),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

const whey: Product = {
  id: 'p1',
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

const row = (id: string, used_on = '2026-10-19'): ProductUse => ({
  id,
  product_id: 'p1',
  user_id: 'u1',
  used_on,
  quantity: 30,
  note: '',
  created_at: `${used_on}T08:00:00Z`,
});

const older = row('old', '2026-10-18');
const saved = row('saved');

/** A promise the test resolves when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

type Hook = Awaited<ReturnType<typeof renderList>>;

function renderList() {
  return renderHook(() => useProducts());
}

/** The list after a first load, with one older use on it. */
async function loadedList(): Promise<Hook> {
  api.listProducts.mockResolvedValue([whey]);
  api.listAllUses.mockResolvedValue([older]);
  const hook = await renderList();
  await act(async () => {
    await hook.result.current.load();
  });
  expect(ids(hook)).toEqual(['old']);
  return hook;
}

/**
 * Start a load (a focus load, or a pull to refresh) whose answer was read
 * before the write under test, and arrives when the test says.
 */
async function slowLoad(hook: Hook, isRefresh = false) {
  const products = deferred<Product[]>();
  const uses = deferred<ProductUse[]>();
  api.listProducts.mockReturnValueOnce(products.promise);
  api.listAllUses.mockReturnValueOnce(uses.promise);
  await act(async () => {
    void hook.result.current.load(isRefresh);
  });
  return {
    // Not awaited to the end: a load that overlapped a write waits for it.
    land: () =>
      act(async () => {
        products.resolve([whey]);
        uses.resolve([older]);
      }),
  };
}

/** Let a load that is reading again finish. */
const settle = () => act(async () => {});

const ids = (hook: Hook) => hook.result.current.uses.map((u) => u.id);

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps a log whose save outlives a load that read the list before it', async () => {
  const hook = await loadedList();
  const load = await slowLoad(hook);

  const insert = deferred<ProductUse>();
  api.logUse.mockReturnValueOnce(insert.promise);
  let logged!: Promise<ProductUse | null>;
  await act(async () => {
    logged = hook.result.current.logUse('p1', 30, '2026-10-19');
  });
  expect(ids(hook)[0]).toMatch(/^pending-/);

  // Read before the insert, so it has no row for it.
  await load.land();
  expect(ids(hook)[0]).toMatch(/^pending-/);

  // Anything read from now on has the saved row.
  api.listAllUses.mockResolvedValue([saved, older]);
  await act(async () => {
    insert.resolve(saved);
    await logged;
  });
  await settle();

  expect(ids(hook)).toEqual(['saved', 'old']);
});

it('keeps a log whose save lands before a load that read the list before it', async () => {
  const hook = await loadedList();
  const load = await slowLoad(hook);

  api.logUse.mockResolvedValueOnce(saved);
  await act(async () => {
    await hook.result.current.logUse('p1', 30, '2026-10-19');
  });
  expect(ids(hook)).toEqual(['saved', 'old']);

  api.listAllUses.mockResolvedValue([saved, older]);
  await load.land();
  await settle();

  expect(ids(hook)).toEqual(['saved', 'old']);
});

it('does not bring back a removed use from a load that read the list before it', async () => {
  const hook = await loadedList();
  const load = await slowLoad(hook);

  api.deleteUses.mockResolvedValueOnce(undefined);
  await act(async () => {
    await hook.result.current.removeUses([older]);
  });
  expect(ids(hook)).toEqual([]);

  api.listAllUses.mockResolvedValue([]);
  await load.land();
  await settle();

  expect(ids(hook)).toEqual([]);
});

it('stops the pull-to-refresh spinner once the list has read again', async () => {
  const hook = await loadedList();
  const refresh = await slowLoad(hook, true);
  expect(hook.result.current.refreshing).toBe(true);

  api.logUse.mockResolvedValueOnce(saved);
  await act(async () => {
    await hook.result.current.logUse('p1', 30, '2026-10-19');
  });

  api.listAllUses.mockResolvedValue([saved, older]);
  await refresh.land();
  await settle();

  expect(hook.result.current.refreshing).toBe(false);
  expect(ids(hook)).toEqual(['saved', 'old']);
});
