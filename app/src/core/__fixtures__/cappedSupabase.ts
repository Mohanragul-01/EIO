/**
 * A stand-in for supabase-js that does the one thing the real server does and
 * a mock usually forgets: it stops at `cap` rows and does not say so.
 *
 * For tests of "this read returns EVERY row" (see core/paging.ts). Filters
 * and ordering are accepted and ignored - every row is a match, in the order
 * given - because what is under test is whether the caller pages, not the
 * query. A request without .range() gets the first `cap` rows, exactly the
 * silent truncation that read used to suffer; with .range() it gets that
 * window, still capped. { count: 'exact' } on select() reports the true total.
 *
 * Lives outside __tests__ because Jest runs every file in there as a suite.
 */
type Row = Record<string, unknown>;

export type CappedServer = {
  from: (table: string) => unknown;
  /** Every request made, as the window it asked for (null = no range). */
  requests: { table: string; range: [number, number] | null }[];
};

export function cappedSupabase(rowsFor: (table: string) => Row[], cap = 1000): CappedServer {
  const requests: CappedServer['requests'] = [];

  const from = (table: string) => {
    const rows = rowsFor(table);
    let counted = false;
    let window: [number, number] | null = null;

    const respond = () => {
      requests.push({ table, range: window });
      const start = window ? window[0] : 0;
      const end = window ? Math.min(window[1] + 1, start + cap) : cap;
      return {
        data: rows.slice(start, end).map((row) => ({ ...row })),
        error: null,
        count: counted ? rows.length : null,
      };
    };

    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const name of ['eq', 'neq', 'in', 'is', 'not', 'gte', 'lte', 'gt', 'lt', 'or', 'order']) {
      builder[name] = chain;
    }
    builder.select = (_columns?: string, options?: { count?: string }) => {
      counted = options?.count === 'exact';
      return builder;
    };
    builder.range = (start: number, end: number) => {
      window = [start, end];
      return builder;
    };
    builder.then = (
      resolve: (value: ReturnType<typeof respond>) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve().then(respond).then(resolve, reject);
    return builder;
  };

  return { from, requests };
}

/** `n` rows made by `make(i)`, for seeding a table past the cap. */
export function manyRows(n: number, make: (i: number) => Row): Row[] {
  return Array.from({ length: n }, (_, i) => make(i));
}
