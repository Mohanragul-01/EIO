/**
 * changeSignal - "a task changed; whoever is on show, look again".
 *
 * The Tasks screen keeps Today and the four frequency pages mounted at once
 * (a pager), each with its own copy of the rows. A write made through one of
 * them, or by a reminder's Done, leaves the others holding rows that are no
 * longer true. So each write is announced here with who made it, and the page
 * on show reloads when it was someone else (see useFreshPage). The writer
 * does not: it has already put its own change on screen.
 *
 * Like todaySignal, a plain set of listeners: nothing persists, and a page
 * that is not mounted has nothing to refresh.
 */
type Listener = (source: object | null) => void;

const listeners = new Set<Listener>();

/** `source` is the writer's own token (null for a reminder), so it can ignore its own news. */
export function announceChange(source: object | null): void {
  listeners.forEach((listener) => listener(source));
}

export function subscribeChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
