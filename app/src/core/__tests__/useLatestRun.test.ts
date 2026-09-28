/**
 * The behaviour worth pinning down is the one the old `mounted` guard got
 * wrong: an older, slower request must not overwrite a newer one's answer.
 *
 * renderHook is async in @testing-library/react-native 14, as are rerender and
 * unmount, so every one of them is awaited.
 */
import { renderHook } from '@testing-library/react-native';

import { useLatestRun } from '../useLatestRun';

describe('useLatestRun', () => {
  describe('begin', () => {
    it('lets a single run write', async () => {
      const { result } = await renderHook(() => useLatestRun());
      const isCurrent = result.current.begin();
      expect(isCurrent()).toBe(true);
    });

    it('refuses the older run once a newer one has started', async () => {
      const { result } = await renderHook(() => useLatestRun());

      const first = result.current.begin();
      const second = result.current.begin();

      // This is the case that used to corrupt the list: the first request is
      // still in flight when the second starts, and returns after it.
      expect(first()).toBe(false);
      expect(second()).toBe(true);
    });

    it('keeps refusing the older run however late it lands', async () => {
      const { result } = await renderHook(() => useLatestRun());
      const first = result.current.begin();
      result.current.begin();
      result.current.begin();

      expect(first()).toBe(false);
    });

    it('refuses every run after unmount', async () => {
      const { result, unmount } = await renderHook(() => useLatestRun());
      const run = result.current.begin();
      expect(run()).toBe(true);

      await unmount();
      expect(run()).toBe(false);
    });
  });

  describe('isMounted', () => {
    it('stays true while a newer run starts', async () => {
      const { result } = await renderHook(() => useLatestRun());

      result.current.begin();
      result.current.begin();

      // A mutation writes its own result, so a load starting mid-save must not
      // invalidate it. Ticketing mutations would drop a write you waited for.
      expect(result.current.isMounted()).toBe(true);
    });

    it('goes false on unmount', async () => {
      const { result, unmount } = await renderHook(() => useLatestRun());
      expect(result.current.isMounted()).toBe(true);

      await unmount();
      expect(result.current.isMounted()).toBe(false);
    });
  });

  it('keeps a stable identity so it can sit in a dependency array', async () => {
    const { result, rerender } = await renderHook(() => useLatestRun());
    const first = result.current;
    await rerender({});

    expect(result.current).toBe(first);
    expect(result.current.begin).toBe(first.begin);
    expect(result.current.isMounted).toBe(first.isMounted);
  });
});
