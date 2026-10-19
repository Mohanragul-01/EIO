/**
 * notesEvents.ts - "a note changed somewhere else; look again."
 *
 * The undo toast outlives the screen that showed it. Move a note to the Trash
 * from its own screen and you are back on the list before you press Undo - and
 * the list, having reloaded on focus without that note, would not know it had
 * come back. Whatever writes outside the list's own hook calls notesChanged()
 * once it has landed, and the hooks holding notes reload.
 *
 * A plain listener set rather than a context, because the writers (a toast's
 * action, a screen that has already been popped) are not under any one
 * provider that could own it.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe; returns the unsubscribe, so it drops straight into an effect. */
export function onNotesChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notesChanged(): void {
  listeners.forEach((listener) => listener());
}
