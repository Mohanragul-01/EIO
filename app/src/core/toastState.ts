/**
 * toastState.ts - the toast's state machine, kept pure so it can be tested.
 *
 * One toast at a time. A new one REPLACES the current one rather than queueing
 * behind it: "Logged · Undo" for a set you ticked a second ago is useless once
 * you have ticked the next, and a queue would show you stale undos in order.
 *
 * Every toast gets an id, and hide/act name the id they mean. That is what
 * makes the two subtle failures impossible:
 *  - an earlier toast's timer cannot dismiss a newer toast (its id is stale);
 *  - an action cannot run twice (the second act finds nothing to act on).
 *
 * A stale or repeated action returns the SAME state object. Callers rely on
 * that identity to decide whether anything happened.
 */

export type ToastOptions = {
  message: string;
  /** Text of the button, e.g. "Undo". No button without it. */
  actionLabel?: string;
  onAction?: () => void;
  /** How long it stays. Default 5000 - long enough to reach Undo. */
  durationMs?: number;
};

export type ToastState = {
  current: (ToastOptions & { id: number; durationMs: number }) | null;
  nextId: number;
};

export type ToastAction =
  | { type: 'show'; options: ToastOptions }
  | { type: 'hide'; id: number }
  | { type: 'act'; id: number };

export const DEFAULT_TOAST_MS = 5000;

export const initialToastState: ToastState = { current: null, nextId: 1 };

export function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'show':
      return {
        current: {
          ...action.options,
          durationMs: action.options.durationMs ?? DEFAULT_TOAST_MS,
          id: state.nextId,
        },
        nextId: state.nextId + 1,
      };

    case 'hide':
    case 'act':
      // Only the toast on screen can be hidden or acted on. Anything else is
      // a timer or a tap arriving for a toast that has already been replaced.
      if (state.current?.id !== action.id) return state;
      return { ...state, current: null };
  }
}
