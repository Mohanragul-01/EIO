/**
 * Type-only declarations for `expo-notifications`.
 *
 * Deliberately SEPARATE from the runtime stub next door, because the two answer
 * different questions. TypeScript needs to know the shape the shared module
 * expects, so that module still type-checks here exactly as it does in the app.
 * The bundler needs something to resolve the require to, and that is the empty
 * stub - whose emptiness is the point, since it makes the shared loader take
 * its own "notifications unavailable" branch.
 *
 * Only the members the shared module actually touches are declared. Copying the
 * library's full surface would be a large lie that rots on the next release;
 * this is a small true statement about what is used.
 */
declare module 'expo-notifications' {
  export enum AndroidImportance {
    DEFAULT = 3,
  }

  export enum SchedulableTriggerInputTypes {
    DATE = 'date',
  }

  export type PermissionResponse = { granted: boolean; canAskAgain: boolean };

  export function setNotificationHandler(handler: {
    handleNotification: () => Promise<{
      shouldShowBanner: boolean;
      shouldShowList: boolean;
      shouldPlaySound: boolean;
      shouldSetBadge: boolean;
    }>;
  }): void;

  export function setNotificationChannelAsync(
    channelId: string,
    channel: { name: string; importance: AndroidImportance; sound?: string },
  ): Promise<unknown>;

  export function getPermissionsAsync(): Promise<PermissionResponse>;
  export function requestPermissionsAsync(): Promise<PermissionResponse>;
  export function cancelScheduledNotificationAsync(identifier: string): Promise<void>;

  export function scheduleNotificationAsync(request: {
    identifier?: string;
    content: { title: string; body: string; data?: Record<string, unknown> };
    trigger: { type: SchedulableTriggerInputTypes; date: Date; channelId?: string };
  }): Promise<string>;
}
