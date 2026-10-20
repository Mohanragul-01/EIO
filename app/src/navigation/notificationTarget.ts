/**
 * notificationTarget.ts - which screen a tapped notification opens.
 *
 * The module that scheduled a reminder knows where it should lead; the
 * navigator does not, and should not have to learn about every module's
 * reminders. So a reminder's data carries it:
 *
 *   { route: 'SubscriptionDetail', params: { id },
 *     actions: { mark_paid: { route: 'SubscriptionDetail', params: { id, action: 'pay' } } } }
 *
 * and this reads it. Pure, so it is tested without a navigator or a phone. A
 * notification without a route - every one scheduled before this existed -
 * simply opens the app where it was.
 */
import type { NotificationResponse } from '../core/notifications';

export type NotificationTarget = { route: string; params: Record<string, string> };

/** Only string params: anything else in the data is not ours to pass on. */
function stringParams(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const params: Record<string, string> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'string') params[key] = v;
  }
  return params;
}

function asTarget(value: unknown): NotificationTarget | null {
  if (!value || typeof value !== 'object') return null;
  const { route, params } = value as { route?: unknown; params?: unknown };
  if (typeof route !== 'string' || !route) return null;
  return { route, params: stringParams(params) };
}

export function targetFor(response: NotificationResponse): NotificationTarget | null {
  const { data, action } = response;
  if (action) {
    const actions = data.actions;
    if (actions && typeof actions === 'object') {
      const own = asTarget((actions as Record<string, unknown>)[action]);
      if (own) return own;
    }
  }
  // A plain tap, or a button this build does not know: the notification's
  // own screen.
  return asTarget(data);
}
