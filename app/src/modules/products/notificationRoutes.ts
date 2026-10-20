/**
 * notificationRoutes - what pressing or tapping a reorder reminder does.
 *
 *   Ordered     puts the next one on the shelf as a spare, in the background:
 *               the reorder reminders stop and "to reorder" clears everywhere
 *   In 3 days   shows the reorder reminder again at 09:00 three days on
 *   tap         opens the product
 *
 * Kept apart from notifications.ts because it navigates, and navigation is
 * the app's alone: the website imports notifications.ts through api.ts and
 * has no navigator. It is imported by ProductsListScreen, which the navigator
 * registers at launch, so the handler exists before the app root starts
 * listening - including for a press that waited for the app to open.
 */
import { onResponse } from '../../core/notifications';
import { navigateWhenReady } from '../../navigation/navigationRef';
import { addSpareFromReminder, resyncReminders } from './api';
import { productsChanged } from './changes';
import { snoozeReorder } from './notifications';
import { ACTION_LATER, ACTION_ORDERED, REORDER_CATEGORY } from './reminders';

onResponse(REORDER_CATEGORY, async (response) => {
  const productId = typeof response.data.productId === 'string' ? response.data.productId : null;
  if (!productId) return;
  const name = typeof response.data.name === 'string' ? response.data.name : 'it';

  if (response.action === ACTION_ORDERED) {
    const spare = await addSpareFromReminder(productId);
    // A list or product page that is open shows the spare, and rebuilds.
    if (spare) productsChanged(null);
    // And when none is, the reminders follow here.
    await resyncReminders();
  } else if (response.action === ACTION_LATER) {
    await snoozeReorder({ id: productId, name });
  } else {
    navigateWhenReady((nav) => nav.navigate('ProductDetail', { productId }));
  }
});
