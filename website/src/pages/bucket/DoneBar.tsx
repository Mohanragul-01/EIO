/**
 * DoneBar - "Done · today", then Add memory or Undo, on the desktop.
 *
 * The site's toast carries one action and this needs two, so it is its own
 * small bar drawn with the toast's own classes: the same place, the same
 * inverse surface, the same pause while the pointer or focus is on it, and
 * Ctrl/Cmd+Z for Undo. The page hides the toast while this is up.
 */
import { useEffect, useState } from 'react';

/** Long enough to read the line and reach either button. */
const DONE_BAR_MS = 6000;

export type DoneBarState = { id: number; message: string };

export function DoneBar({
  bar,
  onAddMemory,
  onUndo,
  onExpire,
}: {
  bar: DoneBarState | null;
  onAddMemory: () => void;
  onUndo: () => void;
  onExpire: (id: number) => void;
}) {
  return (
    // The live region exists before the bar does, so a screen reader hears
    // each new one rather than missing the first.
    <div className="toast-dock bl-done-dock" role="status" aria-live="polite">
      {bar ? (
        <Bar key={bar.id} bar={bar} onAddMemory={onAddMemory} onUndo={onUndo} onExpire={onExpire} />
      ) : null}
    </div>
  );
}

function Bar({
  bar,
  onAddMemory,
  onUndo,
  onExpire,
}: {
  bar: DoneBarState;
  onAddMemory: () => void;
  onUndo: () => void;
  onExpire: (id: number) => void;
}) {
  // Per bar (it is keyed by id), so a new tick starts its own full timer.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => onExpire(bar.id), DONE_BAR_MS);
    return () => window.clearTimeout(timer);
  }, [bar.id, paused, onExpire]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      // Text fields keep their own undo.
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      event.preventDefault();
      onUndo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo]);

  return (
    <div
      className="toast"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <span className="toast-message">{bar.message}</span>
      <button type="button" className="toast-action" onClick={onAddMemory}>
        Add memory
      </button>
      <button
        type="button"
        className="toast-action"
        onClick={onUndo}
        aria-keyshortcuts="Control+Z Meta+Z"
      >
        Undo
      </button>
    </div>
  );
}
