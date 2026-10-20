# EIO v3 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared pieces every v3 module needs — undo toast, sheet, month calendar, haptics, a notifications core with launch resync, accessible colour tokens — once, in `core/`, on both clients.

**Architecture:** Each piece is a small `core/` file with one job. Pure logic (toast state, month grid, contrast) lives in its own module with tests; components are thin over it. The website mirrors the toast and calendar with its own components and reuses the app's pure logic through the `@app` alias.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19, jest-expo; Vite + React on the website; `expo-haptics`, `expo-keep-awake`, `expo-speech`, `react-native-gesture-handler`, `expo-notifications`, `react-native-keyboard-controller`.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` (§2 ground rules, §3 foundation).

## Global Constraints

- Read the Expo v57 docs before using any Expo API: https://docs.expo.dev/versions/v57.0.0/
- Native packages via `npx expo install <pkg>` only, so versions match SDK 57.
- Touch targets ≥ 48dp on Android (expand with `hitSlop`); ≥ 8dp between adjacent targets.
- Normal text ≥ 4.5:1 contrast against the background in **both** themes.
- Semantic tokens only in components — no raw hex outside `theme.ts` / `tokens.css`.
- Toasts auto-dismiss after 3–5 s (default 5000 ms); one at a time, a new one replaces the old.
- Expo Go cannot schedule notifications: every notifications call must no-op there, never throw.
- `npx tsc --noEmit`, `npx eslint src`, `npx jest` clean in `app/`; `npx tsc --noEmit`, `npx eslint src`, `npx vite build` clean in `website/`.

## Review Focus

1. **A toast's action fires twice** (double tap on Undo, or tap during the dismiss animation) → the action must run at most once per toast. Tested in Task 4.
2. **A replaced toast's timer dismisses its successor** (show A, then B 2 s later; A's timer fires) → B must stay its full duration. Tested in Task 4.
3. **Month grids at boundaries** — December → January, February in a leap year, a month whose 1st falls on the last weekday (6-row month) → correct dates, always whole weeks. Tested in Task 5.
4. **Launch resync in Expo Go or with permission denied** → completes without throwing and schedules nothing. Tested in Task 6.
5. **Haptics on a device or platform without support** → every call returns silently. Tested in Task 3.

---

## File structure

| File | Responsibility |
|---|---|
| `app/package.json`, `app/App.tsx` | new dependencies; `GestureHandlerRootView` + `ToastProvider` at the root |
| `app/src/core/theme.ts` | `info`, `completed` tokens; raised `textFaint`; `typography.numeric` |
| `app/src/core/contrast.ts` | WCAG relative luminance + contrast ratio (pure) |
| `app/src/core/haptics.ts` | `tap`, `success`, `warning` over `expo-haptics`, never throwing |
| `app/src/core/toastState.ts` | pure toast reducer: show / hide / act / expire, ids |
| `app/src/core/components/Toast.tsx` | `ToastProvider`, `useToast`, the rendered pill |
| `app/src/core/components/Sheet.tsx` | the bottom sheet, moved from `modules/bucket/components/` |
| `app/src/core/date.ts` | `monthGrid`, `addMonths` |
| `app/src/core/components/MonthCalendar.tsx` | the month grid component |
| `app/src/core/notifications.ts` | permission, channel, schedule/cancel, resync registry |
| `app/src/modules/subscriptions/notifications.ts` | keeps only subscription rules; calls core |
| `website/src/styles/tokens.css` | `--info`, `--completed`; raised `--text-faint` |
| `website/src/components/Toast.tsx` | website toast (same API) |
| `website/src/components/MonthCalendar.tsx` | website month grid (uses `@app/core/date`) |

---

### Task 1: Dependencies and the root

**Files:**
- Modify: `app/package.json` (via `npx expo install`), `app/App.tsx`

**Interfaces:**
- Produces: `expo-haptics`, `expo-keep-awake`, `expo-speech`, `react-native-gesture-handler` installed at SDK 57 versions; the app root wrapped in `GestureHandlerRootView style={{ flex: 1 }}` outermost (outside `KeyboardProvider`).

- [ ] **Step 1:** In `app/`: `npx expo install expo-haptics expo-keep-awake expo-speech react-native-gesture-handler`
- [ ] **Step 2:** Confirm each installed version equals `node_modules/expo/bundledNativeModules.json`. Run: `node -e "const b=require('./node_modules/expo/bundledNativeModules.json'),p=require('./package.json').dependencies;for(const k of ['expo-haptics','expo-keep-awake','expo-speech','react-native-gesture-handler'])console.log(k,p[k],b[k])"` — Expected: each pair matches.
- [ ] **Step 3:** Wrap the root of `App.tsx` in `GestureHandlerRootView` (import from `react-native-gesture-handler`), outermost.
- [ ] **Step 4:** Run `npx expo-doctor` — Expected: all checks pass. Run `npx tsc --noEmit` — Expected: clean.
- [ ] **Step 5:** Commit: `Add the native modules v3 needs, and the gesture root`

### Task 2: Accessible colour tokens

**Files:**
- Create: `app/src/core/contrast.ts`
- Modify: `app/src/core/theme.ts`, `app/src/core/__tests__/theme.test.ts`, `website/src/styles/tokens.css`

**Interfaces:**
- Produces: `contrastRatio(foreground: string, background: string): number` (hex `#rrggbb` in, WCAG 2.x ratio out); `ThemeColors.info: string`, `ThemeColors.completed: string` in both palettes; `typography.numeric` (`{ fontVariant: ['tabular-nums'] }`) to spread into numeric text styles; CSS `--info`, `--info-soft`, `--completed` in both website themes.

- [ ] **Step 1: Write the failing tests** in `theme.test.ts`:
  - `contrastRatio('#000000', '#ffffff')` ≈ 21 (to 1 dp); `contrastRatio('#ffffff', '#ffffff')` = 1.
  - For **each** palette: `text`, `textSecondary`, `textMuted`, `textFaint` each have `contrastRatio(token, palette.background) >= 4.5`.
  - For each palette: `info` and `completed` exist and are not equal to `success`.
- [ ] **Step 2:** Run `npx jest src/core/__tests__/theme.test.ts` — Expected: FAIL on `contrastRatio` undefined and on `textFaint` (~3.7:1 dark, ~3.1:1 light).
- [ ] **Step 3:** Implement `contrastRatio` (sRGB → linear → relative luminance; `(L1+0.05)/(L2+0.05)`, larger first). Raise `textFaint` in each palette to the smallest change that passes — keep it visibly fainter than `textMuted`. Add `info` (a blue distinct from `accentIndigo` and `priorityNormal`) and `completed` (a desaturated success tint suitable as a row background, ~20% success on the surface). Add `typography.numeric`.
- [ ] **Step 4:** Run the test — Expected: PASS. Run the full suite — Expected: PASS.
- [ ] **Step 5:** Website: raise `--text-faint` in light and dark, and add `--info`, `--info-soft`, `--completed` to **both** the `prefers-color-scheme: dark` block and the `[data-theme='dark']` block. Verify each `--text-*` against the theme's page background with a one-off `node -e` using the same formula — Expected: every ratio ≥ 4.5.
- [ ] **Step 6:** Commit: `Make faint text readable, and add info and completed tokens`

### Task 3: Haptics

**Files:**
- Create: `app/src/core/haptics.ts`, `app/src/core/__tests__/haptics.test.ts`

**Interfaces:**
- Produces: `tap(): void` (light impact), `success(): void` (success notification), `warning(): void` (warning notification). Fire-and-forget: they return nothing and never throw, including when the underlying call rejects or throws synchronously.

- [ ] **Step 1: Write the failing tests:** with `jest.mock('expo-haptics')`, each function calls the right API (`impactAsync(Light)`, `notificationAsync(Success)`, `notificationAsync(Warning)`); when the mock throws synchronously, `tap()` does not throw; when it returns a rejected promise, no unhandled rejection occurs (await a tick and assert nothing thrown).
- [ ] **Step 2:** Run `npx jest src/core/__tests__/haptics.test.ts` — Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `core/haptics.ts`; wrap each call in try/catch and attach `.catch(() => {})` to the returned promise.
- [ ] **Step 4:** Run — Expected: PASS.
- [ ] **Step 5:** Commit: `Add a haptics helper that cannot crash a screen`

### Task 4: Undo toast

**Files:**
- Create: `app/src/core/toastState.ts`, `app/src/core/__tests__/toastState.test.ts`, `app/src/core/components/Toast.tsx`, `website/src/components/Toast.tsx`
- Modify: `app/src/core/components/index.ts`, `app/App.tsx`, `website/src/App.tsx`

**Interfaces:**
- Produces:
  - `type ToastOptions = { message: string; actionLabel?: string; onAction?: () => void; durationMs?: number }` (default `durationMs` 5000).
  - `type ToastState = { current: (ToastOptions & { id: number }) | null; nextId: number }`; `toastReducer(state, action)` with actions `{ type: 'show'; options: ToastOptions }`, `{ type: 'hide'; id: number }`, `{ type: 'act'; id: number }`. `hide`/`act` with a stale id are no-ops. `act` returns the state with `current: null`; the provider runs `onAction` only when the reducer actually cleared that id.
  - `ToastProvider({ children })` and `useToast(): { show(options: ToastOptions): void; hide(): void }` from `core/components/Toast.tsx`; same names from `website/src/components/Toast.tsx`.

- [ ] **Step 1: Write the failing tests** (`toastState.test.ts`):
  - `show` sets `current` with a fresh id; a second `show` replaces it with a higher id.
  - `hide` with the current id clears; `hide` with an older id leaves the newer toast in place (Review Focus 2).
  - `act` with the current id clears and reports it acted; a second `act` with the same id is a no-op (Review Focus 1).
- [ ] **Step 2:** Run — Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `toastReducer`. Implement `Toast.tsx`: a pill above the bottom safe-area inset (`useSafeAreaInsets`), message + optional right-aligned action in `primary`, `accessibilityLiveRegion="polite"`, action hit area ≥ 48dp; timer keyed to the toast id so a replaced toast's timer cannot hide its successor; fade in/out with `useAnimatedValue`. Mount `ToastProvider` inside the theme provider in `App.tsx`; export `ToastProvider`, `useToast` from the components barrel.
- [ ] **Step 4:** Run the toast tests and the full suite — Expected: PASS. `npx tsc --noEmit`, `npx eslint src` — Expected: clean.
- [ ] **Step 5:** Website `components/Toast.tsx`: the same API, reusing `toastReducer` via `@app/core/toastState`; fixed bottom-centre pill, `role="status"`, `aria-live="polite"`; mount in `App.tsx`. Website `tsc`, `eslint`, `vite build` — Expected: clean.
- [ ] **Step 6:** Commit: `Add an undo toast to both clients`

### Task 5: Month calendar

**Files:**
- Modify: `app/src/core/date.ts`, `app/src/core/__tests__/date.test.ts`, `app/src/core/components/index.ts`
- Create: `app/src/core/components/MonthCalendar.tsx`, `website/src/components/MonthCalendar.tsx`

**Interfaces:**
- Produces:
  - `monthGrid(year: number, month: number, weekStartsOn: 0 | 1 = 1): string[][]` — whole weeks covering the month (`month` 1–12), each week 7 ISO dates, leading/trailing days from neighbouring months included.
  - `addMonths(year: number, month: number, delta: number): { year: number; month: number }`.
  - `MonthCalendar` props: `{ year: number; month: number; onChangeMonth: (year: number, month: number) => void; selected?: string | null; onSelect?: (iso: string) => void; renderDay?: (day: { iso: string; inMonth: boolean; isToday: boolean; isSelected: boolean }) => React.ReactNode; weekStartsOn?: 0 | 1 }`. Default cell: the date number. Header: month name + year, ‹ ›, and a "Today" button. Day cells ≥ 44dp tall; out-of-month days dimmed; today outlined; selected filled. Each cell has an accessibility label of the full date.
  - Website `MonthCalendar` with the same props, using `monthGrid` from `@app/core/date`.

- [ ] **Step 1: Write the failing tests** in `date.test.ts`:
  - `monthGrid(2026, 10, 1)`: first cell `'2026-09-28'` (a Monday), contains `'2026-10-01'` and `'2026-10-31'`, every row length 7.
  - `monthGrid(2027, 1, 1)` and `addMonths(2026, 12, 1)` → `{ year: 2027, month: 1 }`; `addMonths(2027, 1, -1)` → `{ year: 2026, month: 12 }` (Review Focus 3).
  - `monthGrid(2028, 2, 1)` includes `'2028-02-29'` (leap year).
  - A month needing 6 rows: `monthGrid(2026, 8, 1)` (1 Aug 2026 is a Saturday) has 6 rows.
  - `weekStartsOn: 0` makes every row start on a Sunday.
- [ ] **Step 2:** Run `npx jest src/core/__tests__/date.test.ts` — Expected: FAIL, functions not defined.
- [ ] **Step 3:** Implement `monthGrid` and `addMonths` with local `Date(y, m-1, d)` construction and `toISODate`, as the rest of `date.ts` does.
- [ ] **Step 4:** Run — Expected: PASS.
- [ ] **Step 5:** Implement both `MonthCalendar` components to the props above.
- [ ] **Step 6:** `tsc`, `eslint`, tests, `vite build` — Expected: clean.
- [ ] **Step 7:** Commit: `Add a month calendar to both clients`

### Task 6: Sheet in core, and the notifications core

**Files:**
- Move: `app/src/modules/bucket/components/Sheet.tsx` → `app/src/core/components/Sheet.tsx`
- Modify: `app/src/modules/bucket/components/FilterSheet.tsx`, `ItemSheet.tsx`, `app/src/core/components/index.ts`
- Create: `app/src/core/notifications.ts`, `app/src/core/__tests__/notifications.test.ts`
- Modify: `app/src/modules/subscriptions/notifications.ts`, `app/src/modules/subscriptions/__tests__/reminders.test.ts`, `app/App.tsx`

**Interfaces:**
- Produces:
  - `Sheet` props: `{ visible: boolean; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }`, with a grabber bar above the title.
  - From `core/notifications.ts`: `type PermissionState = 'granted' | 'denied' | 'unsupported'`; `ensurePermission(): Promise<PermissionState>`; `schedule(input: { id: string; date: Date; title: string; body: string; data?: Record<string, unknown> }): Promise<void>` (no-op for a date in the past); `cancel(id: string): Promise<void>`; `cancelPrefix(prefix: string): Promise<void>`; `registerResync(key: string, run: () => Promise<void>): void`; `runResync(): Promise<void>` (runs every registered resync, each in its own try/catch, all no-ops in Expo Go).
  - `modules/subscriptions/notifications.ts` keeps `reminderId`, `reminderDateFor`, `scheduleReminder`, `cancelReminder` and re-exports `ensurePermission`/`PermissionState` for existing callers, implemented on top of core.

- [ ] **Step 1:** Move `Sheet.tsx` to core, add `subtitle` and the grabber, export it from the barrel, and point the two bucket sheets at `../../../core/components`. `tsc` — Expected: clean.
- [ ] **Step 2: Write the failing tests** (`notifications.test.ts`), mocking `expo-notifications` and the Expo Go detection the subscriptions module already uses:
  - in Expo Go, `ensurePermission()` resolves `'unsupported'` and `schedule()` resolves without calling the native module;
  - `schedule()` with a past date does not call `scheduleNotificationAsync`;
  - `cancelPrefix('sub-')` cancels only scheduled ids starting with `sub-`;
  - `runResync()` runs every registered function and still runs the second when the first rejects (Review Focus 4).
- [ ] **Step 3:** Run — Expected: FAIL, module not found.
- [ ] **Step 4:** Implement `core/notifications.ts`, moving the permission, channel and Expo-Go guard code out of the subscriptions file. Keep the lazy `require('expo-notifications')` pattern the subscriptions file uses, so importing core never loads the native module in Expo Go.
- [ ] **Step 5:** Re-point `modules/subscriptions/notifications.ts` at core. Run the existing `reminders.test.ts` — Expected: PASS unchanged in behaviour (update only import paths/mocks it needs).
- [ ] **Step 6:** In `App.tsx`, once the session is known, call `runResync()` once per launch (an effect keyed on the signed-in user).
- [ ] **Step 7:** Full suite, `tsc`, `eslint`, `npx expo-doctor` — Expected: clean.
- [ ] **Step 8:** Commit: `Move the sheet and notifications into core, and resync reminders on launch`

---

## Self-review

- **Spec coverage (§3):** toast → T4; sheet → T6; month calendar → T5; haptics → T3; notifications core + launch resync → T6; tokens (info, completed, textFaint, numeric) → T2; dependencies + `GestureHandlerRootView` → T1. Website toast, calendar and tokens → T2, T4, T5. Nothing in §3 lacks a task.
- **Review Focus:** items 1–2 → T4 tests; 3 → T5 tests; 4 → T6 tests; 5 → T3 tests.
- **Types:** `ToastOptions`, `toastReducer`, `monthGrid`, `addMonths`, `PermissionState`, `schedule`, `cancelPrefix`, `registerResync`, `runResync` are each defined once and used with the same names wherever referenced.
