/**
 * navigationRef - navigate from outside a screen.
 *
 * A notification tap arrives in a listener, not in a component, and on a cold
 * start it can arrive before the navigator has finished mounting. So a
 * navigation requested before the container is ready is held (the latest one
 * wins) and run from the container's onReady. Screens keep using
 * useNavigation; this is only for code that has no screen.
 */
import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type Go = (nav: typeof navigationRef) => void;

let pending: Go | null = null;

/** Run `go` now if the navigator is ready, otherwise as soon as it is. */
export function navigateWhenReady(go: Go): void {
  if (navigationRef.isReady()) {
    go(navigationRef);
  } else {
    pending = go;
  }
}

/** Passed to NavigationContainer's onReady. */
export function flushPendingNavigation(): void {
  const go = pending;
  pending = null;
  if (go && navigationRef.isReady()) go(navigationRef);
}
