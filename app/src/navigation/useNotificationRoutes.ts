/**
 * useNotificationRoutes - open the screen a tapped notification asks for.
 *
 * Listens through core/notifications (which also hands over the tap that
 * launched the app) and navigates to whatever the notification's data names
 * (see notificationTarget.ts). Enabled only once the navigator is ready, so
 * a launch tap is not lost navigating before there is anywhere to go.
 */
import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { useEffect } from 'react';

import { onResponse } from '../core/notifications';
import { targetFor } from './notificationTarget';
import type { RootStackParamList } from './types';

export function useNotificationRoutes(
  navigationRef: NavigationContainerRefWithCurrent<RootStackParamList>,
  enabled: boolean,
): void {
  useEffect(() => {
    if (!enabled) return;
    return onResponse((response) => {
      const target = targetFor(response);
      if (!target || !navigationRef.isReady()) return;
      // A route this build does not have (a newer reminder, a removed screen)
      // is dropped rather than handed to navigate(), which would warn and stay.
      const names = navigationRef.getRootState()?.routeNames ?? [];
      if (!names.includes(target.route as keyof RootStackParamList)) return;
      // The one untyped boundary: the route came from a notification's data.
      // It is checked against the navigator's own route names just above.
      (navigationRef.navigate as (route: string, params?: object) => void)(
        target.route,
        target.params,
      );
    });
  }, [navigationRef, enabled]);
}
