/**
 * Toast - a short message at the foot of the window, usually with an Undo.
 *
 * The same API as the app's, and the same rules, because it runs the app's
 * reducer (one at a time, a newer one replaces an older one, an action runs at
 * most once, an old timer cannot dismiss a newer toast). This file only draws
 * it and owns the clock.
 *
 *   const toast = useToast();
 *   toast.show({ message: 'Note deleted', actionLabel: 'Undo', onAction: restore });
 *
 * Unlike the phone, a desktop has a pointer and a keyboard to rest on the
 * toast, and the clock stops while either does: reaching for Undo should not
 * be a race against a timer you cannot see. From the keyboard, Ctrl+Z (Cmd+Z)
 * runs the toast's action while one is showing, since tabbing to a button at
 * the very end of the page inside five seconds is not a fair ask - unless
 * focus is in a text field, where Ctrl+Z keeps meaning "undo my typing".
 *
 * NOT FROM INSIDE AN OPEN <dialog>. A modal dialog sits in the browser's top
 * layer, above everything else, including this toast, which would then hide
 * behind it while its timer runs. Close the dialog, then show the toast.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  initialToastState,
  toastReducer,
  type ToastAction,
  type ToastOptions,
  type ToastState,
} from '@app/core/toastState';

type ToastApi = {
  show: (options: ToastOptions) => void;
  hide: () => void;
};

type LiveToast = NonNullable<ToastState['current']>;

const ToastContext = createContext<ToastApi | undefined>(undefined);

// Matches the toast-out animation in components.css.
const EXIT_MS = 140;

export function ToastProvider({ children }: { children: ReactNode }) {
  // A ref, updated synchronously, so a double click on Undo cannot undo twice:
  // the second click sees the first one's result before React re-renders.
  const stateRef = useRef<ToastState>(initialToastState);
  // What is drawn, which outlives the live toast by the length of its exit.
  const [shown, setShown] = useState<{ toast: LiveToast; leaving: boolean } | null>(null);
  const [paused, setPaused] = useState(false);

  const dispatch = useCallback((action: ToastAction): ToastState => {
    const before = stateRef.current;
    stateRef.current = toastReducer(before, action);
    return before;
  }, []);

  const leave = useCallback((id: number) => {
    setShown((s) => (s?.toast.id === id ? { ...s, leaving: true } : s));
    window.setTimeout(() => {
      // Only if it is still this toast: a newer one may have replaced it.
      setShown((s) => (s?.toast.id === id ? null : s));
    }, EXIT_MS);
  }, []);

  const hideId = useCallback(
    (id: number) => {
      const before = dispatch({ type: 'hide', id });
      if (before !== stateRef.current) leave(id);
    },
    [dispatch, leave],
  );

  const act = useCallback(
    (id: number) => {
      const before = dispatch({ type: 'act', id });
      // Unchanged state: already acted on, dismissed or replaced. Do nothing.
      if (before === stateRef.current) return;
      leave(id);
      before.current?.onAction?.();
    },
    [dispatch, leave],
  );

  const show = useCallback(
    (options: ToastOptions) => {
      dispatch({ type: 'show', options });
      const toast = stateRef.current.current;
      if (toast) setShown({ toast, leaving: false });
      setPaused(false);
    },
    [dispatch],
  );

  const hide = useCallback(() => {
    const id = stateRef.current.current?.id;
    if (id !== undefined) hideId(id);
  }, [hideId]);

  // One timer per toast, keyed to its id, and none while paused. Resuming
  // restarts the full duration rather than the remainder: whoever paused it
  // was reading it.
  const shownId = shown?.toast.id;
  const shownDuration = shown?.toast.durationMs;
  useEffect(() => {
    if (shownId === undefined || shownDuration === undefined || paused) return;
    const timer = window.setTimeout(() => hideId(shownId), shownDuration);
    return () => window.clearTimeout(timer);
  }, [shownId, shownDuration, paused, hideId]);

  // Ctrl/Cmd+Z runs the live toast's action. Listens only while a toast
  // with an action is showing, and leaves text fields their own undo.
  const actionableId = shown && !shown.leaving && shown.toast.onAction ? shown.toast.id : undefined;
  useEffect(() => {
    if (actionableId === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      act(actionableId);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actionableId, act]);

  const api = useMemo<ToastApi>(() => ({ show, hide }), [show, hide]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* The live region exists before any toast does. Screen readers only
          announce changes inside a region they already know about, so one
          created together with its message is often read out late or never. */}
      <div className="toast-dock" role="status" aria-live="polite">
        {shown ? (
          <div
            // A new key per toast replays the entrance when one replaces another.
            key={shown.toast.id}
            className={'toast' + (shown.leaving ? ' toast-leaving' : '')}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <span className="toast-message">{shown.toast.message}</span>
            {shown.toast.actionLabel && shown.toast.onAction ? (
              <button
                type="button"
                className="toast-action"
                onClick={() => act(shown.toast.id)}
                aria-keyshortcuts="Control+Z Meta+Z"
              >
                {shown.toast.actionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}
