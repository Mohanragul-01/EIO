/**
 * changes.ts - "the ledger changed somewhere you are not looking; look again".
 *
 * Deleting from the edit screen goes back to the list and THEN offers Undo in
 * a toast. The list reloaded when it regained focus, before the Undo, so
 * without a nudge the restored entry would stay missing until the next visit,
 * and the Undo would look as if it had failed. Whatever restores rows calls
 * ledgerChanged(); the Finance screens listen and quietly reload.
 *
 * Module-level and tiny on purpose: a context provider at the app root would
 * mean editing App.tsx for one module's refresh.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onLedgerChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ledgerChanged(): void {
  listeners.forEach((listener) => listener());
}
