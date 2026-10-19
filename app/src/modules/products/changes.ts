/**
 * changes.ts - "products changed", between the module's own screens.
 *
 * A toast outlives the screen that raised it. Log a use on a product's page,
 * go back to the list, tap Undo: the write runs from a page that is no longer
 * on screen, and the list - which reloaded when it regained focus, before the
 * Undo - goes on showing the use that was just taken back. So every write
 * announces itself here, and the other screens reload.
 *
 * A screen never hears its own announcements: it has already shown the
 * change, and reloading on top of an optimistic row would race it.
 */
type Listener = { owner: unknown; run: () => void };

const listeners = new Set<Listener>();

/** Listen for changes made anywhere but `owner`. Returns the unsubscribe. */
export function onProductsChanged(owner: unknown, run: () => void): () => void {
  const listener = { owner, run };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Announce a change. `owner` is the screen that made it, or null for none. */
export function productsChanged(owner: unknown): void {
  listeners.forEach((listener) => {
    if (owner === null || listener.owner !== owner) listener.run();
  });
}
