/**
 * notificationRoutes - what pressing or tapping a task notification does.
 *
 *   Done        completes the task, as a tick would
 *   Snooze      shows the same reminder again in 30 minutes
 *   tap         opens the task (a reminder) or Today (the digest)
 *
 * Done and Snooze open the app where it was (see ensureCategory in
 * notifications.ts for why), and the press is handled here. Once a Done has
 * landed, the Tasks page on show reloads (changeSignal), since the reload the
 * app's return to the foreground started may have read the task still open.
 *
 * Kept apart from notifications.ts because it navigates, and navigation is
 * the app's alone: the website imports notifications.ts through api.ts and
 * has no navigator. It is imported by TodoListScreen, which the navigator
 * registers at launch, so the handlers exist before the app root starts
 * listening - including for the tap that launched the app.
 */
import { onResponse } from '../../core/notifications';
import { navigateWhenReady } from '../../navigation/navigationRef';
import { completeById } from './api';
import { announceChange } from './changeSignal';
import {
  ACTION_DONE,
  ACTION_SNOOZE,
  DIGEST_CATEGORY,
  REMINDER_CATEGORY,
  snooze,
} from './notifications';
import { requestToday } from './todaySignal';

onResponse(REMINDER_CATEGORY, async (response) => {
  const taskId = typeof response.data.taskId === 'string' ? response.data.taskId : null;
  if (!taskId) return;

  if (response.action === ACTION_DONE) {
    // Through the same path as a tick, so a repeat's next occurrence is
    // created and its reminder scheduled. A task already closed is left alone.
    await completeById(taskId);
    announceChange(null);
  } else if (response.action === ACTION_SNOOZE) {
    await snooze(response.notificationId, response);
  } else {
    navigateWhenReady((nav) => nav.navigate('TodoEdit', { id: taskId }));
  }
});

onResponse(DIGEST_CATEGORY, () => {
  navigateWhenReady((nav) => nav.navigate('TodoList'));
  requestToday();
});
