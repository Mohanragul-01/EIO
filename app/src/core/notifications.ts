/**
 * notifications.ts - local reminders, for every module that has any.
 *
 * It started inside Subscriptions and moved here when Tasks and Fitness needed
 * reminders too, per the sharing rule: the permission, the channel and the
 * Expo Go guard are the same for everyone; what to remind about and when stays
 * in each module.
 *
 * NO SERVER IS INVOLVED. These are local notifications, scheduled on the
 * device by the OS. That means a reminder only exists on the phone that
 * scheduled it, and a reinstall loses them all. The RESYNC below is the
 * answer: each module registers how to rebuild its reminders from the
 * database, and the app runs every one of them once per launch.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * WHY expo-notifications IS REQUIRED LAZILY AND NEVER IMPORTED AT THE TOP
 * ══════════════════════════════════════════════════════════════════════════
 * The library resolves its native module at MODULE SCOPE:
 *
 *     export default requireNativeModule('ExpoNotificationScheduler');
 *
 * requireNativeModule throws when that native module is absent, which is the
 * case in Expo Go. A static `import` is hoisted and evaluated before any code
 * in this file runs, so a try/catch around the usage cannot catch it - the
 * throw escapes the module entirely. When this lived in Subscriptions, that
 * took down the HOME SCREEN at app start in Expo Go, because the home summary
 * imports subscriptions/api, which imported the library.
 *
 * So: types are imported with `import type`, which the compiler erases and
 * which therefore costs nothing at runtime, and the real module is require()d
 * inside a guarded loader at the moment it is first needed.
 *
 * AND A try/catch AROUND THAT require IS NOT ENOUGH EITHER. Two facts combine:
 *
 *   1. expo-notifications' DevicePushTokenAutoRegistration side-effect module
 *      calls warnOfExpoGoPushUsage at import, which on Android in Expo Go
 *      THROWS rather than warning.
 *   2. Metro's guardedLoadModule catches errors thrown during module evaluation
 *      and hands them to ErrorUtils.reportFatalError instead of rethrowing,
 *      then returns undefined.
 *
 * So the require never throws to the caller: Metro swallows it and raises a
 * red screen, and our catch only fires later on the resulting undefined. The
 * only way to avoid the crash is to never require the library at all where it
 * cannot work, which is what the Expo Go check below does. It uses the same
 * signal the library itself uses to decide to throw.
 */
import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

type Notifications = typeof NotificationsModule;

export type PermissionState = 'granted' | 'denied' | 'unsupported';

/** An Android notification channel: what the user sees, and can mute, in Settings. */
export type Channel = { id: string; name: string };

/** Where a reminder goes when its module does not name a channel. */
export const DEFAULT_CHANNEL: Channel = { id: 'reminders', name: 'Reminders' };

/**
 * Cached result of trying to load the library.
 *
 * `undefined` means not yet attempted, `null` means attempted and unavailable.
 * Distinguishing the two keeps us from retrying a require that has already
 * thrown once, on every single call.
 */
let cached: Notifications | null | undefined;

/**
 * Load expo-notifications, or return null on a runtime that lacks it.
 *
 * The handler is installed here rather than at module scope, for the same
 * reason as the require: it can only run once the module actually exists.
 * Without a handler, a notification arriving while the app is foregrounded is
 * delivered silently - precisely the case where you are most likely to be
 * looking at the app and wondering why nothing happened.
 */
function loadNotifications(): Notifications | null {
  if (cached !== undefined) return cached;

  // Bail BEFORE the require, not inside a try around it. See the file header.
  // isRunningInExpoGo comes from `expo` itself and is the same check
  // expo-notifications uses to decide whether to throw, so it cannot drift.
  if (isRunningInExpoGo()) {
    cached = null;
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- see file header
    const mod = require('expo-notifications') as Notifications;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
  } catch {
    // A build without the native module. Reminders are simply off.
    cached = null;
  }

  return cached;
}

/** Channels already created this run. Creating one is idempotent but not free. */
const channelsReady = new Set<string>();

/** Android needs an explicit channel or scheduled notifications are silent. */
async function ensureChannel(mod: Notifications, channel: Channel): Promise<void> {
  if (Platform.OS !== 'android' || channelsReady.has(channel.id)) return;
  await mod.setNotificationChannelAsync(channel.id, {
    name: channel.name,
    importance: mod.AndroidImportance.DEFAULT,
    sound: 'default',
  });
  channelsReady.add(channel.id);
}

/**
 * Ask for permission if it has not been decided, and report where we stand.
 *
 * Call it when the person turns a reminder on, never at launch: a prompt that
 * arrives before you have done anything that needs it is the one people
 * refuse.
 *
 * 'unsupported' is its own state rather than being folded into 'denied',
 * because they need different words: denied is something you can fix in
 * Settings, unsupported means this build cannot do reminders at all and no
 * setting will help.
 */
export async function ensurePermission(): Promise<PermissionState> {
  const mod = loadNotifications();
  if (!mod) return 'unsupported';

  try {
    const current = await mod.getPermissionsAsync();
    if (current.granted) return 'granted';

    // Only prompt when the OS says asking is still allowed. Requesting a
    // permanently denied permission does nothing on Android and shows a no-op
    // dialog on iOS.
    if (current.canAskAgain) {
      const requested = await mod.requestPermissionsAsync();
      return requested.granted ? 'granted' : 'denied';
    }
    return 'denied';
  } catch {
    // Present but non-functional, which Expo Go can also be.
    return 'unsupported';
  }
}

/** Whether reminders can fire right now, without asking. */
async function isGranted(mod: Notifications): Promise<boolean> {
  try {
    return (await mod.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/**
 * Schedule a reminder at `date` under a stable `id`, replacing any reminder
 * already scheduled under that id (the OS keys them by identifier).
 *
 * Resolves whether a reminder now exists. False is a normal outcome, not a
 * failure: a moment already past, a phone without permission and Expo Go all
 * legitimately end with no reminder, and whatever the person was saving has
 * saved either way. So this never throws.
 *
 * A past date is refused rather than scheduled: Android fires a past-dated
 * notification immediately, so an overdue reminder would buzz the moment it
 * was saved.
 */
export async function schedule(input: {
  id: string;
  date: Date;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channel?: Channel;
  /**
   * Buttons on the notification: the id of a category registered with
   * registerCategory, or a whole Category, registered here on first use (its
   * buttons open the app unless it says otherwise). Optional and additive:
   * a category that will not register is dropped, and the reminder still
   * arrives, without buttons.
   */
  category?: string | Category;
}): Promise<boolean> {
  const mod = loadNotifications();
  if (!mod) return false;
  if (input.date.getTime() <= Date.now()) return false;

  const channel = input.channel ?? DEFAULT_CHANNEL;
  try {
    await ensureChannel(mod, channel);
    let categoryId: string | null = null;
    if (typeof input.category === 'string') categoryId = input.category;
    else if (input.category) {
      const { id, actions, opensApp = true } = input.category;
      categoryId = (await registerCategory(id, actions, { opensApp })) ? id : null;
    }
    await mod.scheduleNotificationAsync({
      identifier: input.id,
      content: {
        title: input.title,
        body: input.body,
        data: input.data ?? {},
        ...(categoryId ? { categoryIdentifier: categoryId } : {}),
      },
      trigger: {
        type: mod.SchedulableTriggerInputTypes.DATE,
        date: input.date,
        channelId: channel.id,
      },
    });
    return true;
  } catch {
    // Permission revoked between the check and the call, or a scheduler that
    // exists but refuses.
    return false;
  }
}

/**
 * Cancel the reminder with this id. Always safe: cancelling an id that has
 * nothing scheduled is a no-op, which is what lets every write path do
 * cancel-then-schedule without checking first.
 */
export async function cancel(id: string): Promise<void> {
  const mod = loadNotifications();
  if (!mod) return;
  try {
    await mod.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing scheduled, or notifications unavailable: nothing to clean up.
  }
}

/**
 * Cancel every scheduled reminder whose id starts with `prefix`.
 *
 * A resync begins with this, so reminders for rows deleted on another device
 * (or on the website) do not linger: rebuild from the database, never patch.
 */
export async function cancelPrefix(prefix: string): Promise<void> {
  const mod = loadNotifications();
  if (!mod) return;
  try {
    const scheduled = await mod.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((request) => request.identifier.startsWith(prefix))
        .map((request) => cancel(request.identifier)),
    );
  } catch {
    // Unavailable: there is nothing of ours scheduled to cancel.
  }
}

/** Each module's "rebuild my reminders from the database", by module key. */
const resyncs = new Map<string, () => Promise<void>>();

/**
 * Register how a module rebuilds its reminders. Called once at module load.
 * Registering the same key again replaces the earlier one, so a reload in
 * development cannot leave a module resyncing twice.
 */
export function registerResync(key: string, run: () => Promise<void>): void {
  resyncs.set(key, run);
}

/**
 * Rebuild every module's reminders. Run once per launch, after sign-in.
 *
 * Each runs on its own: a module whose rebuild fails (no network, a bad row)
 * does not cost the others their reminders. Where reminders cannot fire at
 * all - Expo Go, or permission not granted - nothing runs, since each rebuild
 * reads the database for reminders the phone would not show. It never
 * prompts for permission: see ensurePermission.
 */
export async function runResync(): Promise<void> {
  const mod = loadNotifications();
  if (!mod || !(await isGranted(mod))) return;

  for (const run of resyncs.values()) {
    try {
      await run();
    } catch {
      // Logged nowhere on purpose: the next launch tries again, and the
      // person editing the row reschedules it directly in the meantime.
    }
  }
}

/**
 * Whether a reminder scheduled now could fire: the library loads here and
 * permission is granted. Never prompts. A module checks it before reading the
 * database for reminders the phone would not show anyway.
 */
export async function canNotify(): Promise<boolean> {
  return (await permissionState()) === 'granted';
}

/**
 * Where permission stands, WITHOUT asking: for a screen that wants to say
 * "reminders are off" on open (asking there would be the launch-time prompt
 * ensurePermission() exists to avoid). Not yet asked reads as 'denied'.
 */
export async function permissionState(): Promise<PermissionState> {
  const mod = loadNotifications();
  if (!mod) return 'unsupported';
  return (await isGranted(mod)) ? 'granted' : 'denied';
}

/* ══════════════════════════════════════════════════════════════════════════
 * ACTING ON A NOTIFICATION
 * ══════════════════════════════════════════════════════════════════════════
 * Added for Tasks (Done and Snooze on a reminder, a digest that opens Today),
 * shaped so any module can use it:
 *
 *   registerCategory('task_reminder', [{ id: 'done', title: 'Done' }, ...])
 *   onResponse('task_reminder', ({ action, data }) => ...)   // action null = a tap
 *   schedule({ ..., category: 'task_reminder' })
 *
 * and the app root calls listenForResponses() once per signed-in session.
 *
 * BUTTONS ACT WITHOUT OPENING THE APP (opensAppToForeground: false), which is
 * the point of a Done button. The cost, on Android: when the system has
 * already killed the app's process there is no JavaScript to run the handler
 * until the app is next opened. The library keeps the latest response for
 * that moment, and listenForResponses picks it up at launch. Getting it run
 * immediately would need a headless background task (expo-task-manager),
 * which this app does not install.
 *
 * Expo Go: like everything above, nothing here loads the library there.
 */

export type NotificationButton = { id: string; title: string };

/**
 * A category with its buttons, for schedule() to register on first use.
 * `opensApp` (default true there): a button that needs a screen - "Mark paid"
 * opens a sheet you can check and undo - versus one that just acts ("Done").
 */
export type Category = { id: string; actions: NotificationButton[]; opensApp?: boolean };

export type NotificationResponse = {
  /** The button pressed, or null for a tap on the notification itself. */
  action: string | null;
  /** The notification's own id, as given to schedule(). */
  notificationId: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
};

type ResponseHandler = (response: NotificationResponse) => void | Promise<void>;

/** Categories registered this run; the platform keeps them, so once is enough. */
const categoriesReady = new Set<string>();

/**
 * Register the buttons a category of notification carries. Resolves whether
 * they are in place; false (Expo Go, the web, a refusing platform) only means
 * the notification arrives without buttons.
 *
 * Category ids must not contain ':' or '-' (the library's rule).
 */
export async function registerCategory(
  id: string,
  buttons: NotificationButton[],
  options: { opensApp?: boolean } = {},
): Promise<boolean> {
  if (categoriesReady.has(id)) return true;
  const mod = loadNotifications();
  if (!mod) return false;
  try {
    await mod.setNotificationCategoryAsync(
      id,
      buttons.map((button) => ({
        identifier: button.id,
        buttonTitle: button.title,
        options: { opensAppToForeground: options.opensApp ?? false },
      })),
    );
    categoriesReady.add(id);
    return true;
  } catch {
    return false;
  }
}

/**
 * Listeners for EVERY response, whatever its category: the navigator uses one
 * to open the screen a notification's data names. A response that arrives
 * with none listening (the tap that launched the app, before the navigator
 * has mounted) is kept until one subscribes.
 */
const anyListeners = new Set<ResponseHandler>();
let waiting: NotificationResponse[] = [];

export function onAnyResponse(listener: ResponseHandler): () => void {
  anyListeners.add(listener);
  const backlog = waiting;
  waiting = [];
  backlog.forEach((response) => {
    Promise.resolve(listener(response)).catch(() => {});
  });
  return () => {
    anyListeners.delete(listener);
  };
}

/** Each category's handler. Registering one again replaces it, as resyncs do. */
const responders = new Map<string, ResponseHandler>();

/**
 * Handle presses and taps on notifications of a category. Register at module
 * load, from a file the app imports at launch, so a response that launched the
 * app finds its handler waiting.
 */
export function onResponse(category: string, handler: ResponseHandler): void {
  responders.set(category, handler);
}

/**
 * Responses already handled, across listener restarts. The library keeps the
 * most recent response for as long as the app runs, so without this a second
 * sign-in in the same run would act on an old Done again.
 */
const handled = new Set<string>();

/**
 * Start delivering responses to their category's handler. Call once per
 * signed-in session, at the app root (handlers read the database as the
 * signed-in person). Returns the stop function.
 *
 * Also handles the response that LAUNCHED the app: the native side records it
 * before any JavaScript listener exists, so it is read once here. The same
 * response can then arrive through the listener as well, which is why each is
 * remembered by notification, action and delivery time and handled once.
 */
export function listenForResponses(): () => void {
  const mod = loadNotifications();
  if (!mod) return () => {};

  const route = (raw: NotificationsModule.NotificationResponse) => {
    try {
      const request = raw.notification.request;
      const key = `${request.identifier}|${raw.actionIdentifier}|${raw.notification.date}`;
      if (handled.has(key)) return;
      handled.add(key);
      // Taken: a later restart must not read it back as the launch response.
      mod.clearLastNotificationResponse?.();

      const action =
        raw.actionIdentifier === mod.DEFAULT_ACTION_IDENTIFIER ? null : raw.actionIdentifier;
      // A button press leaves the notification in the tray on Android (only a
      // tap on the body dismisses itself), which would read as "it did not
      // work".
      if (action !== null) mod.dismissNotificationAsync(request.identifier).catch(() => {});

      const response: NotificationResponse = {
        action,
        notificationId: request.identifier,
        title: request.content.title,
        body: request.content.body,
        data: (request.content.data ?? {}) as Record<string, unknown>,
      };

      const category = request.content.categoryIdentifier;
      const handler = category ? responders.get(category) : undefined;
      if (handler) {
        Promise.resolve(handler(response)).catch(() => {
          // A failed handler (no network for a Done) leaves the row as it was,
          // which the person sees next time they look. Nothing else to do.
        });
      }

      if (anyListeners.size === 0) {
        // The newest few are enough: nobody wants five old taps replayed.
        waiting = [...waiting, response].slice(-3);
      } else {
        anyListeners.forEach((listener) => {
          Promise.resolve(listener(response)).catch(() => {});
        });
      }
    } catch {
      // A malformed response or a handler that threw synchronously: the
      // listener must survive it for the next one.
    }
  };

  let subscription: { remove: () => void };
  try {
    subscription = mod.addNotificationResponseReceivedListener(route);
  } catch {
    return () => {};
  }

  try {
    const launch = mod.getLastNotificationResponse?.();
    if (launch) route(launch);
  } catch {
    // Not available on this platform: there is no launch response to handle.
  }

  return () => subscription.remove();
}
