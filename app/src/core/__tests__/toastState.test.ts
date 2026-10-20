/**
 * The toast's state machine.
 *
 * Two failures are worth pinning because both are easy to ship and both make
 * Undo lie:
 *  - the action running twice (double tap, or a tap during the fade-out),
 *    which would undo a tick and then undo the undo;
 *  - an earlier toast's timer dismissing a NEWER toast, so "Moved to Trash ·
 *    Undo" vanishes after one second because the previous toast's five ran out.
 *
 * Contract: a stale or repeated action returns the very same state object. The
 * provider fires an action only when the state actually changed.
 */
import { initialToastState, toastReducer, type ToastState } from '../toastState';

const show = (state: ToastState, message: string) =>
  toastReducer(state, { type: 'show', options: { message } });

describe('toastReducer', () => {
  it('starts empty', () => {
    expect(initialToastState.current).toBeNull();
  });

  it('shows a toast with a fresh id', () => {
    const next = show(initialToastState, 'Logged');
    expect(next.current?.message).toBe('Logged');
    expect(typeof next.current?.id).toBe('number');
  });

  it('defaults to five seconds', () => {
    expect(show(initialToastState, 'Logged').current?.durationMs).toBe(5000);
  });

  it('keeps an explicit duration', () => {
    const next = toastReducer(initialToastState, {
      type: 'show',
      options: { message: 'x', durationMs: 3000 },
    });
    expect(next.current?.durationMs).toBe(3000);
  });

  it('replaces the current toast rather than stacking, with a higher id', () => {
    const first = show(initialToastState, 'A');
    const second = show(first, 'B');
    expect(second.current?.message).toBe('B');
    expect(second.current!.id).toBeGreaterThan(first.current!.id);
  });

  it('hides the current toast by its id', () => {
    const shown = show(initialToastState, 'A');
    expect(toastReducer(shown, { type: 'hide', id: shown.current!.id }).current).toBeNull();
  });

  it("ignores an older toast's timer: the newer toast stays", () => {
    const first = show(initialToastState, 'A');
    const second = show(first, 'B');
    const afterStaleTimer = toastReducer(second, { type: 'hide', id: first.current!.id });
    expect(afterStaleTimer).toBe(second);
    expect(afterStaleTimer.current?.message).toBe('B');
  });

  it('acting on the current toast clears it', () => {
    const shown = show(initialToastState, 'A');
    const acted = toastReducer(shown, { type: 'act', id: shown.current!.id });
    expect(acted).not.toBe(shown);
    expect(acted.current).toBeNull();
  });

  it('acting twice on the same toast is a no-op the second time', () => {
    const shown = show(initialToastState, 'A');
    const id = shown.current!.id;
    const once = toastReducer(shown, { type: 'act', id });
    expect(toastReducer(once, { type: 'act', id })).toBe(once);
  });

  it('acting on a toast that was replaced does nothing', () => {
    // Tapping Undo on toast A in the same frame toast B replaced it must not
    // undo A's action under B's message.
    const first = show(initialToastState, 'A');
    const second = show(first, 'B');
    expect(toastReducer(second, { type: 'act', id: first.current!.id })).toBe(second);
  });
});
