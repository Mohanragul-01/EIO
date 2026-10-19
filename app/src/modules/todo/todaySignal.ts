/**
 * todaySignal - "show Today", from outside the Tasks screen.
 *
 * The digest's tap opens Tasks on Today. When Tasks is not open, navigating
 * there is enough, since Today is its first page. When it is already open on
 * another tab, navigating to it changes nothing, so the screen also listens
 * here and switches its own tab.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function requestToday(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToday(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
