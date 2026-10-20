/**
 * An in-memory stand-in for the slice of supabase-js that todo/api.ts uses.
 *
 * The bugs worth testing in api.ts are about WHICH rows exist after a sequence
 * of writes - two open copies of one routine, a successor that should have been
 * removed - and a mock that only records calls cannot see that. This keeps a
 * real table and applies filters to it, so a test can complete, reopen and
 * undo, then look at what is left.
 *
 * It behaves like the database where the app depends on it:
 *  - inserted rows get an id, created_at = updated_at, and the column defaults
 *    of migrations 0001-0020;
 *  - every update moves updated_at, as the todos_set_updated_at trigger does;
 *  - results are copies, so a caller mutating one cannot reach into the table.
 * Only the filters and modifiers api.ts calls are implemented; anything else
 * throws, so a new query shape fails loudly instead of matching everything.
 *
 * Lives outside __tests__ because Jest runs every file in there as a suite.
 */

type Row = Record<string, unknown>;

type Filter = (row: Row) => boolean;

const TODO_DEFAULTS: Row = {
  is_done: false,
  priority: 'normal',
  is_repeat: false,
  position: 0,
  due_date: null,
  due_time: null,
  reminder_offset_min: null,
  repeat_every: 1,
  repeat_weekdays: null,
  repeat_anchor_day: null,
  repeat_nth: null,
  repeat_from: 'due',
  series_id: null,
  scheduled_for: null,
  completed_at: null,
  outcome: null,
  notes: '',
  checklist: [],
};

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return String(a) < String(b) ? -1 : 1;
}

/** Parses PostgREST's `or` syntax for the two shapes api.ts uses: col.eq.v and col.in.(a,b). */
function parseOr(expression: string): Filter {
  const parts: Filter[] = [];
  const pattern = /([a-z_]+)\.(eq|in)\.(\([^)]*\)|[^,]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(expression)) !== null) {
    const [, column, op, raw] = match;
    if (op === 'eq') {
      parts.push((row) => String(row[column]) === raw);
    } else {
      const values = raw.slice(1, -1).split(',');
      parts.push((row) => values.includes(String(row[column])));
    }
  }
  if (parts.length === 0) throw new Error(`fakeSupabase: unsupported or(${expression})`);
  return (row) => parts.some((part) => part(row));
}

export type FakeDatabase = ReturnType<typeof createFakeSupabase>;

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = { todos: [] };
  let ids = 0;
  let tick = 0;
  /** Strictly increasing timestamps, so "later" is observable within one test. */
  const now = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++)).toISOString();
  const calls: { table: string; op: string }[] = [];

  function query(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] | null = null;
    const filters: Filter[] = [];
    const orders: { column: string; ascending: boolean }[] = [];
    let limit: number | null = null;
    let window: [number, number] | null = null;
    let counted = false;
    let single: 'single' | 'maybe' | null = null;
    let failWith: string | null = null;

    const rows = () => (tables[table] ??= []);

    const run = (): {
      data: unknown;
      error: { message: string } | null;
      count?: number | null;
    } => {
      if (failWith) return { data: null, error: { message: failWith } };
      calls.push({ table, op });
      const matching = () => rows().filter((row) => filters.every((f) => f(row)));
      let result: Row[];

      if (op === 'insert') {
        const list = Array.isArray(payload) ? payload : [payload as Row];
        result = list.map((input) => {
          const stamp = now();
          const row: Row = {
            ...(table === 'todos' ? clone(TODO_DEFAULTS) : {}),
            ...clone(input),
            id: (input as Row).id ?? `id-${++ids}`,
            created_at: stamp,
            updated_at: stamp,
          };
          rows().push(row);
          return row;
        });
      } else if (op === 'update') {
        result = matching();
        const stamp = now();
        result.forEach((row) => Object.assign(row, clone(payload), { updated_at: stamp }));
      } else if (op === 'delete') {
        result = matching();
        tables[table] = rows().filter((row) => !result.includes(row));
      } else {
        result = matching();
      }

      for (const order of [...orders].reverse()) {
        result = [...result].sort(
          (a, b) => compare(a[order.column], b[order.column]) * (order.ascending ? 1 : -1),
        );
      }
      const total = result.length;
      if (limit !== null) result = result.slice(0, limit);
      if (window) result = result.slice(window[0], window[1] + 1);

      const data = clone(result);
      if (single) {
        if (data.length === 0) {
          return single === 'maybe'
            ? { data: null, error: null }
            : {
                data: null,
                error: { message: 'JSON object requested, multiple (or no) rows returned' },
              };
        }
        return { data: data[0], error: null };
      }
      return { data, error: null, count: counted ? total : null };
    };

    const builder = {
      select(_columns?: string, options?: { count?: string }) {
        counted = options?.count === 'exact';
        return builder;
      },
      insert(values: Row | Row[]) {
        op = 'insert';
        payload = values;
        return builder;
      },
      update(values: Row) {
        op = 'update';
        payload = values;
        return builder;
      },
      delete() {
        op = 'delete';
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      neq(column: string, value: unknown) {
        filters.push((row) => row[column] !== value);
        return builder;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return builder;
      },
      is(column: string, value: null) {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      gte(column: string, value: string) {
        filters.push((row) => row[column] !== null && compare(row[column], value) >= 0);
        return builder;
      },
      gt(column: string, value: string) {
        filters.push((row) => row[column] !== null && compare(row[column], value) > 0);
        return builder;
      },
      lte(column: string, value: string) {
        filters.push((row) => row[column] !== null && compare(row[column], value) <= 0);
        return builder;
      },
      lt(column: string, value: string) {
        filters.push((row) => row[column] !== null && compare(row[column], value) < 0);
        return builder;
      },
      not(column: string, operator: string, value: unknown) {
        if (operator !== 'is' || value !== null) {
          throw new Error(`fakeSupabase: unsupported not(${column}, ${operator})`);
        }
        filters.push((row) => (row[column] ?? null) !== null);
        return builder;
      },
      or(expression: string) {
        filters.push(parseOr(expression));
        return builder;
      },
      order(column: string, options?: { ascending?: boolean }) {
        orders.push({ column, ascending: options?.ascending ?? true });
        return builder;
      },
      limit(n: number) {
        limit = n;
        return builder;
      },
      range(from: number, to: number) {
        window = [from, to];
        return builder;
      },
      single() {
        single = 'single';
        return builder;
      },
      maybeSingle() {
        single = 'maybe';
        return builder;
      },
      /** Make the next execution of THIS query fail, as a dropped connection would. */
      fail(message: string) {
        failWith = message;
        return builder;
      },
      then<T>(
        resolve: (value: { data: unknown; error: { message: string } | null }) => T,
        reject?: (reason: unknown) => T,
      ) {
        try {
          return Promise.resolve(run()).then(resolve, reject);
        } catch (error) {
          return Promise.reject(error).then(resolve, reject);
        }
      },
    };
    return builder;
  }

  /** Tables whose next write of this kind fails once. */
  const failures: { table: string; op: string; message: string }[] = [];

  const client = {
    from(table: string) {
      const builder = query(table);
      // Wrap the write methods so a queued failure attaches to the right call.
      for (const op of ['insert', 'update', 'delete'] as const) {
        const original = builder[op] as (...args: never[]) => typeof builder;
        (builder as Record<string, unknown>)[op] = (...args: never[]) => {
          const result = original(...args);
          const index = failures.findIndex((f) => f.table === table && f.op === op);
          if (index >= 0) {
            builder.fail(failures[index].message);
            failures.splice(index, 1);
          }
          return result;
        };
      }
      return builder;
    },
    rpc() {
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    client,
    rows: (table = 'todos') => clone(tables[table] ?? []),
    calls,
    /**
     * Change a row in place WITHOUT moving updated_at - the database as a
     * migration backfill or another client left it, rather than a write
     * through the API under test.
     */
    patch(id: string, values: Row, table = 'todos') {
      const row = (tables[table] ?? []).find((r) => r.id === id);
      if (!row) throw new Error(`fakeSupabase: no row ${id}`);
      Object.assign(row, clone(values));
    },
    /** The next `op` on `table` resolves with this error instead of running. */
    failNext(table: string, op: 'insert' | 'update' | 'delete', message = 'network down') {
      failures.push({ table, op, message });
    },
  };
}
