/**
 * useNotificationAction - a reminder's button, acted on once it arrives.
 *
 * A reminder's "Mark paid" (or a trial's "Keep it" / "I cancelled") lands on
 * the detail screen with an action, and the matching sheet opens once the
 * subscription has loaded. Only for the subscription the reminder was about,
 * and only while its button still makes sense (see notificationActionApplies):
 * an old reminder must not pay the next cycle or undo a decision already
 * made. When it no longer applies, a toast says why instead.
 */
import { useEffect, useState } from 'react';

import { useToast } from '../../../core/components';
import { useStableCallback } from '../../../core/useStableCallback';
import { notificationActionApplies, staleActionMessage } from '../lifecycle';
import type { Subscription } from '../types';

export type NotificationAction = 'pay' | 'keep' | 'cancelled';

export type Arrival = {
  /** The subscription the reminder was about. */
  id: string;
  action?: NotificationAction;
  /** When the button was tapped: the same button tapped twice is two arrivals. */
  at?: string;
  /** The route's key, for an arrival with no `at`. */
  key: string;
};

export function useNotificationAction(
  arrival: Arrival,
  sub: Subscription | null,
  today: string,
  run: (key: 'pay' | 'keep', sub: Subscription) => void,
): void {
  const toast = useToast();
  const { id, action } = arrival;

  /**
   * Handled once per arrival. Done during render, React's pattern for
   * adjusting state to new props, rather than in an effect: it only opens a
   * sheet, which is this screen's own state.
   */
  const actionKey =
    action && sub && sub.id === id ? `${sub.id}:${action}:${arrival.at ?? arrival.key}` : null;
  const [handled, setHandled] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string } | null>(null);
  if (action && actionKey && handled !== actionKey && sub) {
    setHandled(actionKey);
    if (notificationActionApplies(action, sub, today)) {
      run(action === 'pay' ? 'pay' : 'keep', sub);
    } else {
      setNotice({ message: staleActionMessage(action, sub, today) });
    }
  }

  // The toast is the provider's state, not this screen's: showing it during
  // this render is what React warns about (and StrictMode could show it
  // twice), so it waits for the commit. Once per notice - a new object per
  // arrival - whatever else re-renders the screen meanwhile.
  const showToast = useStableCallback((message: string) => toast.show({ message }));
  useEffect(() => {
    if (notice) showToast(notice.message);
  }, [notice, showToast]);
}
