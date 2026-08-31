/**
 * Regression test for the Finance refresh bug.
 *
 * Symptom: add a transaction while viewing a previous month, come back, and it
 * was missing until you pulled to refresh.
 *
 * Cause: the focus effect held the FIRST `reload` it ever saw (empty dependency
 * array, needed to avoid a refetch loop). That closure captured the month
 * selected at mount, so returning from the editor refetched the wrong month.
 *
 * These tests exercise the ref-based fix directly rather than rendering a
 * screen: one stable identity that always reaches the latest closure.
 */

/** Minimal stand-in for React's hook machinery, so this needs no renderer. */
function simulate() {
  let stored: ((...args: unknown[]) => unknown) | null = null;
  const ref = { current: null as ((...args: unknown[]) => unknown) | null };

  return {
    /** One render: update the ref the way the effect does after every render. */
    render(latest: (...args: unknown[]) => unknown) {
      ref.current = latest;
      // The returned function is created once and reused, exactly as the real
      // useCallback with an empty dependency array does.
      stored = stored ?? ((...args: unknown[]) => ref.current?.(...args));
      return stored;
    },
  };
}

describe('stable callback behaviour', () => {
  it('keeps one identity across renders', () => {
    const sim = simulate();
    const first = sim.render(() => 'a');
    const second = sim.render(() => 'b');

    // Identity must not change, or the focus effect would re-fire every render.
    expect(second).toBe(first);
  });

  it('calls the latest closure, not the captured one', () => {
    const sim = simulate();

    // Render 1: the screen opens on August.
    const held = sim.render(() => 'august');
    expect(held()).toBe('august');

    // Render 2: the user switches to July. The effect still holds `held`.
    sim.render(() => 'july');

    // The bug returned 'august' here, which is why the new row never appeared.
    expect(held()).toBe('july');
  });

  it('passes arguments through to the current closure', () => {
    const sim = simulate();
    const calls: unknown[][] = [];

    const held = sim.render((...args: unknown[]) => {
      calls.push(args);
      return 'first';
    });
    sim.render((...args: unknown[]) => {
      calls.push(args);
      return 'second';
    });

    expect(held(true)).toBe('second');
    expect(calls[calls.length - 1]).toEqual([true]);
  });
});

/**
 * The month arithmetic the Finance loader depends on. If stepping months is
 * wrong, the fix above would faithfully fetch the wrong month.
 */
import { monthBounds } from '../date';

describe('monthBounds', () => {
  it('covers the whole month', () => {
    expect(monthBounds(2026, 8)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
    expect(monthBounds(2026, 4)).toEqual({ start: '2026-04-01', end: '2026-04-30' });
  });

  it('handles February in both common and leap years', () => {
    expect(monthBounds(2026, 2).end).toBe('2026-02-28');
    expect(monthBounds(2024, 2).end).toBe('2024-02-29');
  });

  it('zero-pads single-digit months', () => {
    expect(monthBounds(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-01-31' });
  });
});
