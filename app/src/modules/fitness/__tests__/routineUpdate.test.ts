/**
 * "Update routine" after a session changes the slot the session followed.
 *
 * A ladder slot has no exercise_id - it follows the ladder - so a set-count
 * change on it must update the slot by its ladder. Matching it by the rung's
 * exercise found nothing, and the summary's "You added <rung>" then inserted
 * a fixed copy of the rung beside the ladder slot, for ever after.
 */
type Call = { table: string; op: string; payload: unknown; filters: [string, unknown][] };
const mockCalls: Call[] = [];

jest.mock('../../../core/session', () => ({ getOwnerId: () => Promise.resolve('u') }));
jest.mock('../../../core/supabase', () => {
  const chain = (call: Call) => {
    const builder: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        call.filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve, reject),
    };
    return builder;
  };
  return {
    supabase: {
      from: (table: string) => ({
        update: (payload: unknown) => {
          const call = { table, op: 'update', payload, filters: [] };
          mockCalls.push(call);
          return chain(call);
        },
        insert: (payload: unknown) => {
          const call = { table, op: 'insert', payload, filters: [] };
          mockCalls.push(call);
          return chain(call);
        },
        select: () => chain({ table, op: 'select', payload: null, filters: [] }),
      }),
    },
  };
});

// Required after the mocks, so api.ts sees them.
const api = require('../api') as typeof import('../api');

beforeEach(() => {
  mockCalls.length = 0;
});

it("updates a ladder slot's set count by its ladder", async () => {
  await api.updateRoutineFromSession('r1', {
    setCounts: [{ progression_id: 'pull', target_sets: 4 }],
    added: [],
  });
  expect(mockCalls).toEqual([
    {
      table: 'routine_exercises',
      op: 'update',
      payload: { target_sets: 4 },
      filters: [
        ['routine_id', 'r1'],
        ['progression_id', 'pull'],
      ],
    },
  ]);
});

it("updates a fixed slot's set count by its exercise, as before", async () => {
  await api.updateRoutineFromSession('r1', {
    setCounts: [{ exercise_id: 'squat', target_sets: 5 }],
    added: [],
  });
  expect(mockCalls[0].filters).toEqual([
    ['routine_id', 'r1'],
    ['exercise_id', 'squat'],
  ]);
});
