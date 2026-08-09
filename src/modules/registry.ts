/**
 * registry.ts - the list of modules the home screen renders.
 *
 * THIS IS THE HINGE OF THE WHOLE ARCHITECTURE.
 *
 * The home screen doesn't know anything about Todo or Finance; it maps over
 * this array and renders a tile per entry. Adding a module later is:
 *   1. create `src/modules/<name>/`,
 *   2. register its screen(s) in the navigator + RootStackParamList,
 *   3. add ONE object here.
 * No existing module is touched - the "independent modules" requirement made
 * mechanical rather than aspirational.
 *
 * ON ICONS: these are Ionicons names, not emoji. Emoji render as a different
 * typeface on every device, sit on the text baseline instead of the optical
 * centre, and can't take the module's accent color. A real icon set is drawn
 * on one grid at one weight, which is why a screenful of them looks
 * deliberate instead of assembled.
 */
import type { Ionicons } from '@expo/vector-icons';

import type { ModuleEntryScreen } from '../navigation/types';

/**
 * Accent is a semantic key, not a hex value. Each palette defines its own
 * version of these, so a tile picks up the right tone in light and dark
 * without the registry knowing which mode is active.
 */
export type AccentKey = 'indigo' | 'amber' | 'emerald' | 'cyan' | 'rose';

export type ModuleStatus = 'ready' | 'planned';

export type ModuleDefinition = {
  /** Stable internal id - never shown to the user. */
  key: string;
  title: string;
  /** One concrete line about what the module stores. Not a slogan. */
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** Accent, resolved against the active palette by the home screen. */
  accent: AccentKey;
  /** Restricted to param-less screens - see ModuleEntryScreen. */
  route: ModuleEntryScreen;
  status: ModuleStatus;
  /** Which build phase delivers it - shown on the tile while it's pending. */
  phase: number;
};

export const MODULES: ModuleDefinition[] = [
  {
    key: 'todo',
    title: 'Tasks',
    subtitle: 'Due dates and priority',
    icon: 'checkmark-done-outline',
    accent: 'indigo',
    route: 'TodoList',
    status: 'ready', // Phase 1 - the reference implementation
    phase: 1,
  },
  {
    key: 'notes',
    title: 'Notes',
    subtitle: 'Written notes with tags',
    icon: 'document-text-outline',
    accent: 'amber',
    route: 'NotesList',
    status: 'ready', // Phase 2
    phase: 2,
  },
  {
    key: 'finance',
    title: 'Finance',
    subtitle: 'Spending by category',
    icon: 'wallet-outline',
    accent: 'emerald',
    route: 'FinanceList',
    status: 'ready', // Phase 3
    phase: 3,
  },
  {
    key: 'subscriptions',
    title: 'Subscriptions',
    subtitle: 'Recurring bills and renewals',
    icon: 'repeat-outline',
    accent: 'cyan',
    route: 'SubscriptionsList',
    status: 'ready', // Phase 3
    phase: 3,
  },
  {
    key: 'fitness',
    title: 'Fitness',
    subtitle: 'Workout and session log',
    icon: 'barbell-outline',
    accent: 'rose',
    route: 'FitnessList',
    status: 'ready', // Phase 4
    phase: 4,
  },
];
