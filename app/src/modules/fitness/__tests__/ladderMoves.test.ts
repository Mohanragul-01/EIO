/**
 * A ladder move is dated by the phone's own day.
 *
 * The column's default is the database's current_date, which on Supabase is
 * the UTC day: moving up at 05:00 in India was dated the day before, and the
 * ladder's "Mastered" and its timeline said yesterday. Dates in this app are
 * built from local parts (core/date.ts), so the api sends one.
 *
 * Tests run in America/New_York: 22:00 on 19 Oct there is already 20 Oct UTC.
 */
type Call = { table: string; op: string; payload: unknown };
const mockCalls: Call[] = [];

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/supabase', () => {
  const done = () => {
    const builder: Record<string, unknown> = {
      eq: () => builder,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject),
    };
    return builder;
  };
  return {
    supabase: {
      from: (table: string) => ({
        insert: (payload: unknown) => {
          mockCalls.push({ table, op: 'insert', payload });
          return done();
        },
        update: (payload: unknown) => {
          mockCalls.push({ table, op: 'update', payload });
          return done();
        },
      }),
    },
  };
});

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');

beforeEach(() => {
  mockCalls.length = 0;
  jest.useFakeTimers({
    now: new Date(2026, 9, 19, 22, 0),
    doNotFake: ['nextTick', 'queueMicrotask'],
  });
});

afterEach(() => {
  jest.useRealTimers();
});

const move = (calls: Call[]) =>
  calls.find((c) => c.table === 'progression_moves')?.payload as { date?: string };

it("dates a move by the phone's day, not the server's UTC one", async () => {
  await api.moveLadder({ progressionId: 'p', fromStepId: 'a', toStepId: 'b', kind: 'up' });
  expect(move(mockCalls).date).toBe('2026-10-19');
});

it('keeps a date it is given (a level-up accepted on a past session)', async () => {
  await api.moveLadder({
    progressionId: 'p',
    fromStepId: 'a',
    toStepId: 'b',
    kind: 'up',
    date: '2026-10-12',
  });
  expect(move(mockCalls).date).toBe('2026-10-12');
});
