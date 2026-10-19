/**
 * notifications.ts - module reminders on the device.
 *
 * What to remind about lives in reminders.ts, as tested data; HOW (permission,
 * the channel, the Expo Go guard) lives in core/notifications. This file only
 * joins the two: cancel everything this module scheduled, plan again from the
 * rows in hand, schedule what was planned. Rebuild, never patch - a reminder
 * for an entry deleted on the website must not survive on the phone.
 *
 * WHERE IT RUNS.
 *   - Once per signed-in launch, through the resync registered below, for
 *     every module.
 *   - Whenever a module's list loads (useCustomRecords), with the rows that
 *     load just fetched - which is how logging today's entry cancels today's
 *     nudge, and how an edited date moves its reminder.
 *   - When the builder saves, and when a module is deleted.
 *
 * Registration happens when this file is first imported. The hooks import it,
 * the home screen and the module list import the hooks, and the navigator
 * imports both at launch, so the resync exists before App runs it. It does not
 * import from the hooks, and api.ts does not import it, so there is no cycle.
 */
import { cancelPrefix, registerResync, schedule, type Channel } from '../../core/notifications';
import * as api from './api';
import { modulePrefix, planReminders } from './reminders';
import type { CustomField, CustomModule, CustomRecord } from './types';

export { ensurePermission, type PermissionState } from '../../core/notifications';

/** Its own channel, so module reminders can be muted without muting renewals. */
const CHANNEL: Channel = { id: 'custom', name: 'Module reminders' };

/** Whether a module asks for any reminder at all. */
export function hasReminders(module: Pick<CustomModule, 'reminder_time' | 'reminder_field_key'>): boolean {
  return Boolean(module.reminder_time || module.reminder_field_key);
}

async function scheduleAll(
  module: CustomModule,
  fields: CustomField[],
  records: CustomRecord[],
): Promise<number> {
  if (!hasReminders(module)) return 0;
  const planned = planReminders(module, fields, records, new Date());
  let scheduled = 0;
  for (const reminder of planned) {
    if (await schedule({ ...reminder, channel: CHANNEL })) scheduled += 1;
  }
  return scheduled;
}

/**
 * Rebuild one module's reminders from rows already loaded. Resolves how many
 * were scheduled: zero is normal (none set up, Expo Go, no permission) and
 * never an error, since whatever was being saved has saved either way.
 */
export async function syncModuleReminders(
  module: CustomModule,
  fields: CustomField[],
  records: CustomRecord[],
): Promise<number> {
  await cancelPrefix(modulePrefix(module.id));
  return scheduleAll(module, fields, records);
}

/** Forget a deleted module's reminders. */
export async function clearModuleReminders(moduleId: string): Promise<void> {
  await cancelPrefix(modulePrefix(moduleId));
}

/** Rebuild one module from the database, for the builder after a save. */
export async function resyncModule(moduleId: string): Promise<number> {
  const [module, fields, records] = await Promise.all([
    api.getModule(moduleId),
    api.listFields(moduleId),
    api.listRecords(moduleId),
  ]);
  return syncModuleReminders(module, fields, records);
}

registerResync('custom', async () => {
  // Everything this module has ever scheduled, including modules since
  // deleted elsewhere, then every module that still asks for reminders.
  await cancelPrefix('custom-');
  const [modules, fields, grouped] = await Promise.all([
    api.listModules(),
    api.allFields(),
    api.recordsByModule(),
  ]);
  for (const module of modules) {
    await scheduleAll(
      module,
      fields.filter((field) => field.module_id === module.id),
      grouped[module.id] ?? [],
    );
  }
});
