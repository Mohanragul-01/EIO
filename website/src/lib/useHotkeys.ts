/**
 * useHotkeys - the two shortcuts every list page shares.
 *
 *   /   focus the page's search box
 *   n   open the page's "new" dialog
 *
 * Both are deliberately single keys with no modifier, which only works because
 * of the guard below: a shortcut that fires while you are typing is worse than
 * no shortcut, because it interrupts the thing you were actually doing.
 */
import { useEffect } from 'react';

/** True when the keystroke belongs to whatever the user is typing into. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    // A rich-text or otherwise editable region counts too.
    target.isContentEditable
  );
}

export function useHotkeys(handlers: { onSearch?: () => void; onNew?: () => void }) {
  const { onSearch, onNew } = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Never steal a keystroke from a field, and never from a browser or OS
      // shortcut the user meant for something else.
      if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;

      // A dialog is open: its own Esc and Enter handling owns the keyboard,
      // and opening a second dialog on top of it would be nonsense.
      if (document.querySelector('dialog[open]')) return;

      if (event.key === '/' && onSearch) {
        // Without this the '/' also lands in the field we just focused.
        event.preventDefault();
        onSearch();
        return;
      }

      if ((event.key === 'n' || event.key === 'N') && onNew) {
        event.preventDefault();
        onNew();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSearch, onNew]);
}
