/**
 * Fetching every row, past the server's cap.
 *
 * Supabase answers at most `max_rows` rows a request (1000 by default) and
 * says nothing when it stops there. The all-time balance used to be computed
 * from one such request, so past a thousand transactions it silently lost the
 * newest ones. collectPages keeps asking until it has them all.
 */
import { collectPages } from '../paging';

/** A fake table of `total` rows behind a server that returns at most `cap` per request. */
function server(total: number, cap: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  const calls: [number, number][] = [];
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap, total);
    return { rows: rows.slice(from, end), total };
  };
  return { fetchPage, calls };
}

describe('collectPages', () => {
  it('returns everything when it fits in one page', async () => {
    const { fetchPage, calls } = server(10, 1000);
    expect(await collectPages(fetchPage, 1000)).toHaveLength(10);
    expect(calls).toHaveLength(1);
  });

  it('keeps going past the first thousand, in order, without repeats', async () => {
    const { fetchPage, calls } = server(2500, 1000);
    const all = await collectPages(fetchPage, 1000);
    expect(all).toEqual(Array.from({ length: 2500 }, (_, i) => i));
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('stops at exactly a multiple of the page size without an extra request', async () => {
    const { fetchPage, calls } = server(2000, 1000);
    expect(await collectPages(fetchPage, 1000)).toHaveLength(2000);
    expect(calls).toHaveLength(2);
  });

  it('copes with a server whose cap is smaller than the page asked for', async () => {
    // A project configured with max_rows = 300 returns 300 to a 1000-row ask.
    const { fetchPage } = server(1000, 300);
    expect(await collectPages(fetchPage, 1000)).toHaveLength(1000);
  });

  it('falls back to "a short page is the last" when the total is unknown', async () => {
    const calls: number[] = [];
    const fetchPage = async (from: number) => {
      calls.push(from);
      return { rows: from === 0 ? [1, 2, 3] : [4], total: null };
    };
    expect(await collectPages(fetchPage, 3)).toEqual([1, 2, 3, 4]);
    expect(calls).toEqual([0, 3]);
  });

  it('stops on an empty page even if the total promised more', async () => {
    const fetchPage = async (from: number) => ({ rows: from === 0 ? [1] : [], total: 50 });
    expect(await collectPages(fetchPage, 10)).toEqual([1]);
  });

  it('passes an error through rather than returning a partial list', async () => {
    const fetchPage = async (from: number) => {
      if (from > 0) throw new Error('network');
      return { rows: [1, 2], total: 4 };
    };
    await expect(collectPages(fetchPage, 2)).rejects.toThrow('network');
  });
});
