/**
 * paging.ts - every row, not just the first thousand.
 *
 * Supabase caps a response at `max_rows` (1000 unless the project changes it)
 * and does not say it stopped. The all-time ledger fetch behind the balance and
 * the trend was a single request, so once you had logged more than a thousand
 * transactions the newest ones silently fell out of both. Nothing errored; the
 * balance was simply wrong.
 *
 * So an unbounded read asks page by page. The first page also asks for the
 * exact count, and the loop runs until it has that many rows - which works
 * even on a project whose cap is lower than the page size asked for, where
 * "stop at a short page" would stop after the first. Pages advance by what
 * actually came back, and the query must have a stable order (the caller ends
 * it with a unique column) so no row lands in two pages or none.
 *
 * No supabase import: the loop is pure, and tested with a fake server.
 */

export const PAGE_SIZE = 1000;

export type Page<T> = { rows: T[]; total: number | null };

export async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<Page<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let total: number | null = null;

  for (;;) {
    const page = await fetchPage(all.length, all.length + pageSize - 1);
    if (total === null) total = page.total;
    all.push(...page.rows);

    // An empty page ends it whatever the count promised: rows deleted between
    // requests would otherwise keep this asking forever.
    if (page.rows.length === 0) break;
    if (total !== null ? all.length >= total : page.rows.length < pageSize) break;
  }

  return all;
}
