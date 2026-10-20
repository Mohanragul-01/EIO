/**
 * useBucket: two writes queued on one row, and what each failure puts back.
 *
 * Writes to a row are chained, so a tick and its Undo land in order. What
 * this pins is the rollback: a failure must put back what the DATABASE holds,
 * never the unconfirmed screen value of an earlier write in the same queue -
 * and must leave alone a field that a later write has already changed again.
 * Each case is a real sequence: a tick and its Undo, or a tick and the memory
 * that follows it, on a weak signal.
 *
 * api.ts is mocked, with each write a promise the test settles by hand.
 */
import { act, renderHook } from '@testing-library/react-native';

import type { BucketItem } from '../types';
import { useBucket } from '../useBucket';

jest.mock('../api', () => ({
  listItems: jest.fn(),
  listSteps: jest.fn(() => Promise.resolve([])),
  patchItem: jest.fn(),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

function item(over: Partial<BucketItem> = {}): BucketItem {
  return {
    id: 'dive',
    user_id: 'u1',
    category: 'Water Adventures',
    title: 'Scuba dive',
    cost: 'high',
    is_done: false,
    done_on: null,
    done_precision: null,
    note: '',
    memory: '',
    place: '',
    again: null,
    snoozed_until: null,
    focus: null,
    target_on: null,
    target_precision: null,
    est_cost_minor: null,
    saved_minor: 0,
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const TICK = { is_done: true, done_on: '2026-10-20', done_precision: 'day' } as const;
const UNTICK = { is_done: false, done_on: null, done_precision: null } as const;
const MEMORY = {
  is_done: true,
  done_on: '2019-03-01',
  done_precision: 'month',
  memory: 'Turtles at the reef',
  place: 'Andaman',
  again: 'yes',
} as const;

async function loaded(row: BucketItem) {
  api.listItems.mockResolvedValue([row]);
  const hook = await renderHook(() => useBucket());
  await act(async () => {
    await hook.result.current.load();
  });
  return hook;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useBucket patch, two writes queued on one row', () => {
  it('tick fails, then its Undo fails: the row shows what the database holds, not done', async () => {
    const { result } = await loaded(item());
    const tick = deferred();
    const undo = deferred();
    api.patchItem.mockReturnValueOnce(tick.promise).mockReturnValueOnce(undo.promise);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.patch('dive', TICK);
      second = result.current.patch('dive', UNTICK);
    });
    expect(result.current.items[0].is_done).toBe(false);

    await act(async () => {
      tick.reject(new Error('offline'));
      await first;
    });
    // The Undo is still on its way: the screen keeps showing it.
    expect(result.current.items[0].is_done).toBe(false);

    await act(async () => {
      undo.reject(new Error('offline'));
      await second;
    });
    expect(result.current.items[0]).toMatchObject(UNTICK);
  });

  it('tick fails, then the memory after it lands: the row shows the memory, done', async () => {
    const { result } = await loaded(item());
    const tick = deferred();
    api.patchItem.mockReturnValueOnce(tick.promise).mockResolvedValueOnce(undefined);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.patch('dive', TICK);
      second = result.current.patch('dive', MEMORY);
    });

    await act(async () => {
      tick.reject(new Error('offline'));
      await first;
      await second;
    });
    // The database has the memory's write: done in March 2019, with its words.
    expect(result.current.items[0]).toMatchObject(MEMORY);
  });

  it('tick lands, then its Undo fails: the row shows the tick the database kept', async () => {
    const { result } = await loaded(item());
    const undo = deferred();
    api.patchItem.mockResolvedValueOnce(undefined).mockReturnValueOnce(undo.promise);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.patch('dive', TICK);
      second = result.current.patch('dive', UNTICK);
    });
    await act(async () => {
      await first;
    });

    await act(async () => {
      undo.reject(new Error('offline'));
      await second;
    });
    expect(result.current.items[0]).toMatchObject(TICK);
    expect(result.current.error).toBe('offline');
  });

  it('a failure puts back only its own fields', async () => {
    const { result } = await loaded(item({ note: 'Before' }));
    const tick = deferred();
    api.patchItem.mockReturnValueOnce(tick.promise).mockResolvedValueOnce(undefined);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = result.current.patch('dive', TICK);
      second = result.current.patch('dive', { note: 'After' });
    });
    await act(async () => {
      tick.reject(new Error('offline'));
      await first;
      await second;
    });
    expect(result.current.items[0]).toMatchObject({ ...UNTICK, note: 'After' });
  });
});
