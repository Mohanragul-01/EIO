# EIO v3 — design

*Written 19 Oct 2026. The contract every v3 build works from: what gets built, why, and the rules it is built under.*

---

## 1. Intent

EIO is one person's life system: an Android app and a desktop website on one Supabase database. v3 measures each module against the best apps in its category, and closes the gaps that matter to **one person tracking their own life** — features *and* interface, weighted equally.

The user's own words set three priorities:

1. **Fitness becomes Hevy-grade, with two modes — Gym and Calisthenics.** They train both.
2. **Products: see the usage history on the phone, and log a day you missed.** (Done in `aac355a`; v3 finishes the job.)
3. **Every other module:** find the top 3 apps in its category, take what is important and missing, and do not neglect the UI.

### How the research was done

Ten parallel investigations followed the evidence method of the REA reverse-engineering skill — a question checklist, independent scopes, and a ledger separating what was **observed** from what was **inferred**. They used only what these apps show publicly: official sites, help centres, store listings, changelogs, reviews. Nothing was decompiled or copied. Reports, with sources, are in [`docs/research/`](../../research/):

| Module | Apps studied | Report |
|---|---|---|
| Fitness — Gym | Hevy (deep), JEFIT, Strong, Fitbod | [fitness-hevy.md](../../research/fitness-hevy.md), [fitness-gym-trackers.md](../../research/fitness-gym-trackers.md) |
| Fitness — Calisthenics | Thenics, Calisteniapp, Calistree | [fitness-calisthenics.md](../../research/fitness-calisthenics.md) |
| Tasks | Todoist, TickTick, Microsoft To Do | [tasks.md](../../research/tasks.md) |
| Notes | Google Keep, Samsung Notes, Notion, + Day One | [notes.md](../../research/notes.md) |
| Finance | Money Manager, Wallet, axio, + Cashew | [finance.md](../../research/finance.md) |
| Subscriptions | ReSubs, Tilla, Simolation | [subscriptions.md](../../research/subscriptions.md) |
| Products | Medisafe, SkinSort, Grocy | [products.md](../../research/products.md) |
| B-List | Buckist, iBucket, Goals planner | [bucket-list.md](../../research/bucket-list.md) |
| Custom modules | Notion, Memento Database, Airtable | [custom-modules.md](../../research/custom-modules.md) |

**Builders: read your module's report.** This document picks *what* to build and fixes the cross-cutting decisions; the reports hold the evidence and the detailed UI patterns (their §6) that this document refers to.

---

## 2. Ground rules (every module, every builder)

These are not preferences. A change that breaks one is not done.

**Platform**
- Expo SDK 57, React Native 0.86, React 19. **Read the v57 docs before using any Expo API** (`AGENTS.md`): <https://docs.expo.dev/versions/v57.0.0/>.
- The user's daily app is an **EAS APK** (`preview` profile), so native modules that are in the SDK work for them. The development loop is Expo Go, which only runs modules in `expo/bundledNativeModules.json`. Prefer bundled modules. Anything that cannot run in Expo Go must say so in the code and be listed in your report.
- Install native packages with `npx expo install <pkg>` so versions match the SDK. Do not add a dependency unless it is essential; if you add one, say so in your report.

**Architecture** (from the README; already enforced)
1. **Modules never import each other.** Each lives in `app/src/modules/<name>/` with its own `api.ts`, hooks, screens, types. Reading another module's *table* from your own `api.ts` is allowed; importing its code is not. Shared code moves *down* into `app/src/core/` when a second module needs it.
2. **Screens never talk to Supabase.** Only `api.ts` does.
3. **No `react-hooks/exhaustive-deps` suppressions.** Fix the dependency instead.
4. **The website reuses the app's `api.ts` and `types.ts`** through the `@app` alias. Logic lives once.

**Data**
- Money is **integer paise** (`amount_minor`); format with `core/money.ts`. Indian grouping (₹1,50,000).
- Calendar dates are `'YYYY-MM-DD'` strings from `core/date.ts` (`todayISO`, `addDaysISO`), never `Date` arithmetic across timezones.
- Every table: `user_id`, RLS on, the **four-policy template**, and UPDATE policies with **both** `using` and `with check`. Copy the pattern from an existing migration.
- Migrations are **idempotent** (`if not exists`, guarded `update ... where`) so running one twice is harmless. They also must be **safe to run before the app ships**: never rename or drop a column the current app reads.
- Deleting with `on delete cascade` must be stated in the UI ("Deletes 62 logged uses").

**Quality**
- `npx tsc --noEmit`, `npx eslint src`, and `npx jest` pass in `app/`; `npx tsc --noEmit`, `npx eslint src`, and `npx vite build` pass in `website/`.
- Pure logic (dates, recurrence, projections, records, parsing) lives in `types.ts` or a sibling file and has **tests**. Screens do not get snapshot tests.
- Data hooks use `core/useLatestRun` (ticket guard). Optimistic updates roll back **only their own row**, never a whole-list snapshot.
- Comments explain *why*, in the voice of the existing code. Commit messages explain the problem, then the fix.

**Interface** (from the UI/UX skill's rules, applied to this app)
- **Touch targets ≥ 48dp** on Android: expand small icons with `hitSlop`. At least 8dp between adjacent targets.
- **Never colour alone.** Every status colour is paired with a word or an icon.
- **Vector icons only** (`@expo/vector-icons` Ionicons on the phone, `components/Icon.tsx` on the web). **No emoji as icons.**
- **One gesture per region.** No horizontal swipe-to-act on rows that sit inside the swipeable tab pager. Every swipe action also has a non-swipe route (long-press menu, or a button in a sheet).
- **Undo, not confirm, for reversible actions** (tick, log, move to trash, archive) — an undo toast for ~5 s. **Confirm only what is permanent** (delete forever, empty trash, delete a product with its history).
- **Semantic colour tokens only** — no raw hex in screens. Numbers that line up in columns use tabular figures.
- Every icon-only control has `accessibilityLabel` and the right `accessibilityRole` and state.
- Respect reduced motion; check both light and dark themes.

---

## 3. Shared foundation (built first, by the lead)

Several modules need the same pieces. They are built once in `core/` before module work starts, so module builders use them rather than inventing parallel versions.

| Piece | What | Used by |
|---|---|---|
| **Undo toast** | `core/components/Toast.tsx` + a `ToastProvider` at the app root and a `useToast()` hook: `show({ message, actionLabel?, onAction?, durationMs? })`. One toast at a time; a new one replaces the old. Sits above the safe-area bottom. Website: the same API in `website/src/components/toast.tsx`. | Tasks, Notes, Products, B-List, Finance, Custom, Fitness |
| **Sheet** | The bottom-sheet shell moves from `modules/bucket/components/Sheet.tsx` to `core/components/Sheet.tsx` (keyboard-controller avoidance, safe-area padding, sibling backdrop). Standard anatomy: grabber, title, one-line subtitle naming the context, content, full-width primary button. | Everything |
| **Month calendar** | `core/components/MonthCalendar.tsx`: a month grid with ‹ › and "today", a render prop per day cell (dot, number, tint, logos), tap-to-select, swipe or arrows to change month. Website: `components/MonthCalendar.tsx`. Pure date maths in `core/date.ts` with tests. | Fitness, Finance, Subscriptions, Products, Tasks, Custom |
| **Haptics** | `core/haptics.ts`: `tap()`, `success()`, `warning()` over `expo-haptics`; silently no-ops if unavailable. | Ticking anything, PRs, timers |
| **Notifications core** | Permission, Android channels, and a per-module scheduler move from `modules/subscriptions/notifications.ts` into `core/notifications.ts` (the file's own header says to do this when a second module needs it). Each module keeps its own scheduling rules; core gives `ensurePermission`, `schedule({ id, date, title, body, data })`, `cancel(id)`, `cancelPrefix(prefix)`. **Reminders are re-synced on every app launch.** Expo Go cannot schedule notifications — preserve the existing guard. | Subscriptions, Tasks, Products, Notes, B-List, Custom, Fitness (rest end) |
| **Tokens** | Add `info` (drop sets, neutral notices) and `completed` (a desaturated success tint for ticked rows) to both palettes. **Raise `textFaint` to ≥ 4.5:1** in both themes — it is ~3.7:1 (dark) and ~3.1:1 (light) today, and it carries small text everywhere. Add a contrast test to `theme.test.ts`. Add a `numeric` text style with `fontVariant: ['tabular-nums']`. | Everything |
| **Dependencies** | `expo-haptics`, `expo-keep-awake`, `expo-speech`, `react-native-gesture-handler` (root wrapped in `GestureHandlerRootView`). All are in Expo Go for SDK 57. | Fitness, all |

---

## 4. Fitness — the centrepiece

### 4.1 The model: one data model, two lenses

All three fitness reports converge on this and it is the decision that keeps the module from doubling in size:

- **Gym and Calisthenics are a *mode*, not two databases.** One exercise library, one session log, one record system. The mode is a lens that changes defaults, filters, pickers, routines, records and charts.
- **How a set is logged is decided by the exercise, not the mode.** A pull-up logs the same way on a gym day and a calisthenics day.
- A session may mix both (weighted pull-ups on a gym day).

A **Gym | Calisthenics** segmented control sits at the top of Fitness, remembered per device. The four tabs stay (Log · Routines · Exercises · Body); in Calisthenics mode, Exercises becomes **Skills** (ladders first, library second).

### 4.2 Exercise and set model

**Exercise** gains:
- `discipline` — `gym | calisthenics | both` (which mode lists it).
- `load_mode` — `external` (barbell, dumbbell, machine: weight is the load) or `bodyweight` (the body is the load).
- `bodyweight_factor` — numeric, default 1.0: the share of bodyweight a rep moves (push-up ≈ 0.65). Used only for bodyweight-inclusive volume and e1RM. Editable under "Advanced".
- `equipment` — `none, barbell, dumbbell, kettlebell, machine, cable, band, pull-up bar, rings, dip bars, parallettes, other`.
- `is_unilateral` — sets are logged per side.
- `default_rest_seconds`, `pinned_note` (shown every time the exercise is logged), `instructions` (your own how-to).
- `tracking_type` (`reps | time`) is unchanged.

**Set** gains:
- `set_type` — `normal | warmup | failure | drop`. Warm-ups are excluded from volume and records. A failure set may record 0 reps (a failed attempt).
- `assist_kg` — assistance subtracted from bodyweight (band, counterweight, machine). **Assistance gets its own column; `weight_kg` stays ≥ 0 and means *added* load for bodyweight exercises.** The UI may *show* assistance as "−20", but storage stays non-negative. Making `weight_kg` signed would silently break every existing volume and record calculation, and the database's `check (weight_kg >= 0)`.
- `band_id` (→ a small `bands` table: label, colour, approx kg), `side` (`left | right | null`), `clean` (default true — only clean sets count toward level-ups).
- `rpe` already exists and is **always written as null today**. v3 writes it.

So one exercise goes assisted (−20) → bodyweight → weighted (+10) without becoming a new exercise.

**Effective load** for records and volume, bodyweight exercises: `bodyweight × factor + weight_kg − assist_kg`, using the session's **bodyweight snapshot** (`workout_sessions.bodyweight_kg`, taken from the latest weigh-in when the session starts).

### 4.3 Session structure (fixes a foundational bug)

**`session_exercises`** (new): `session_id, exercise_id, position, rest_seconds, note, superset_group`. Today a session's exercise order lives only in screen state and is rebuilt from logged sets, so **an exercise added but not yet logged disappears when the session is reopened**, and order, notes, rest and supersets have nowhere to live. The migration backfills one row per existing (session, exercise) in first-logged order. One block per exercise per session.

**`workout_sessions`** gains `mode`, `started_at`, `ended_at` (nullable), `bodyweight_kg`.

### 4.4 The logging screen (Hevy's loop, EIO's save model)

The active session is a full-screen route. Each exercise is a block:

- **Header:** name in the accent colour (tap → exercise detail), ⋮ menu (Reorder · Replace · Superset · Add warm-up sets · Remove), pinned note with a pin glyph, today's note, chips for rest ("⏱ 2:00") and — for a ladder exercise — the level ("Adv. tuck · 2/5 ‹ ›").
- **Set table:** `SET · PREVIOUS · LOAD · REPS|TIME · ✓`, tabular figures, ~48dp rows, zebra striping.
  - **PREVIOUS** shows the matching set from the last session with this exercise ("60 × 8", "× 12", "0:45", "8 · +10", "22s · red band"), greyed; tapping it copies the values.
  - **Ghost values:** routine targets, failing that last time's values, sit in the cells as placeholders. Ticking a row with ghosts commits them, so a set can be logged without typing.
  - **Tap the set number** → sheet: W Warm-up · 1 Normal · F Failure · D Drop · Remove. The letter replaces the number (W amber, F red, D info). Only normal sets are numbered.
  - **LOAD** for bodyweight exercises shows a signed chip (+10 / −20 / band dot); hidden when unloaded.
  - **✓ ticks the set: it saves immediately** (EIO's save-as-you-go model is kept — Hevy users lose unsaved work; EIO users don't), tints the row with `completed`, runs the record check, and **starts that exercise's rest timer**. Unticking deletes the saved set and leaves the row with its values.
  - Swipe left on a row deletes it; "Remove" in the set-type sheet is the non-swipe route.
- **Rest bar:** a floating card above the bottom safe area — thin progress line, −15 · mm:ss · +15 · Skip. Per-exercise duration remembered; no rest before a drop set. When it ends: haptic + sound + a local notification if the app is backgrounded.
- **Live header strip:** Duration · Volume · Sets, and a compact **Finish** button.
- **Finish is optional and never gates saving.** It stamps `ended_at` and shows a single scrolling summary: "Workout #N", a 2×2 stat grid, records with medals, **"vs last time you did this routine"** deltas, and — if the session deviated from its routine — "Update routine?" with the change spelled out ("You added 2 sets"). An unfinished session simply ends at its last set.
- Screen stays awake during a session (`expo-keep-awake`).

### 4.5 Calisthenics mode specifics

- **Progression ladders** (`progressions`, `progression_steps`, `progression_moves`, per [fitness-calisthenics.md §5](../../research/fitness-calisthenics.md)): each rung is an ordinary library exercise with a graduation target (sets × reps, or sets × seconds, optional + kg), so history and records keep working per variation. Rung state is *derived*: mastered / current / locked.
- **Skills view:** cards grouped by family (Push, Pull, Legs, Core, Balance, Statics) — "Step 4/7 · Advanced tuck" + a progress ring. **Ladder screen:** numbered rungs, mastered with date, current highlighted with target and best, locked dimmed; "Step back" always available.
- **Hold timer is the input** for time exercises: a large dial showing the target, tap to start, 3-2-1 lead-in, count up with ticks, a distinct cue at the target, keeps counting past it, tap to stop → elapsed seconds become the set. Goal · Best · Last under the dial. ≥ 64dp hit area. Voice and ticks toggleable (`expo-speech`, haptics).
- **"Ready to move up?"** at session end when a rung's target was met with clean sets in 2 of the last 3 sessions on it (configurable to 1). [Move up] [Not yet]. Never moves you silently.
- Routine slots can point at a **ladder** instead of an exercise; the slot resolves to the current rung when the session starts. Targets become ranges.

### 4.6 Records (fixes two bugs)

Computed, not stored — and **recomputed when a session opens**, so badges survive a reload (today they vanish). Types follow the exercise:

| Exercise | Records |
|---|---|
| External load | heaviest weight; heaviest at the same rep count (EIO's existing record — keep it); best e1RM (capped at ≤ 12 reps, labelled "estimated"); best set volume |
| Bodyweight | **most reps at the same or a harder load** (today a bodyweight rep record **can never fire**, because records compare weight at a fixed rep count and the weight is always 0); best +kg at N reps |
| Assisted | **less assistance at the same or more reps** |
| Hold | longest hold at the same or a harder load |

Keep the existing rules: the first set at a measure is not a record; comparisons are strictly greater; the current session is excluded. Announce with a toast + success haptic; the set number becomes a medal.

### 4.7 Insight

- **Weekly streak** replaces the daily streak — a daily streak breaks every planned rest day, punishing you for following your plan. Plus "N rest days".
- **Month calendar** of training days (core `MonthCalendar`), a small corner mark distinguishing Gym and Calisthenics days.
- **Exercise detail:** Summary (headline value + chart with metric chips chosen by type, range chips, tap a point → that day's sets), History (per session), Records (incl. the rep-max table with predicted values), How-to (your instructions + pinned note).
- **Next-session targets** (double progression): routine exercises get a rep range and an increment. When every working set last time hit the top of the range → ghost target "+2.5 kg, aim for the bottom of the range", with a "why" chip. Bodyweight: +1 rep; holds: +5 s; ladder: "↑ next level". After a gap > 14 days, hold the weight and say so.
- **Calisthenics progress:** ladder position over time (step chart), max reps / max hold per rung, "N steps mastered" + a dated timeline of moves.

### 4.8 Gym tools and body

- **Plate calculator** (drawn bar + plates, your plate inventory and bar weight, closest achievable weight) and **warm-up calculator** (40/60/80 %, inserted as W rows, rounded to your plates). Inventory stored on the device.
- **Supersets:** a coloured left bar groups blocks; ticking advances to the partner; rest only after the last of a round.
- **Replace / reorder** an exercise mid-session; **repeat a past session**; **save a session as a routine**.
- **Body measurements:** sites with left/right pairs and body fat %, one row per date, last values as placeholders, a chart per site. New `body_measurements` table.

### 4.9 Website

The website gets the same model and is the **planning and analysis surface**: routine and ladder building, the month calendar, a year heatmap, charts and records. Its logging view mirrors the phone's set table. Keep it at parity on data; it may show more at once.

### 4.10 Deferred (not in v3)

Progress photos (needs a Storage bucket + image picker), the recovery body map (worth doing next — needs a drawn silhouette), lock-screen live controls (native, costly), monthly report. The research rationale for each is in the reports.

### 4.11 Bugs fixed

1. Session exercise order lost on reopen → `session_exercises`.
2. Bodyweight rep records never fire → records by exercise type.
3. Record badges vanish on reopen → recompute on open.
4. Daily streak breaks on rest days → weekly streak.
5. `rpe` never written → RPE sheet.

---

## 5. Tasks

**Confirmed bugs** (verified in `modules/todo/types.ts` and `api.ts`):
1. **Overdue repeats pile up.** `nextDueDate` adds one interval to the *old* due date, so a daily task three weeks overdue comes back still overdue — about 21 ticks to catch up. → Roll forward to the first scheduled date *after today*, keeping the anchor (Monday stays Monday).
2. **Month-end drift.** The clamped date becomes the next base: a task on the 31st becomes the 28th in February and stays the 28th forever. → Store the anchor day.
3. **Reopening a repeating task duplicates it.** `reopenTask` flips `is_done` but leaves the successor it already created open. → Link occurrences with a `series_id`; reopening removes the untouched successor.

**Build:**
- **Today view, the phone's default:** Overdue (with one "Reschedule" for the whole section) · Today · Completed today (collapsed). The four frequency tabs stay one swipe away; the dashboard tile opens Today.
- **Recurrence engine:** every N; weekdays for weekly; day N / nth weekday / last day for monthly; repeat from due date *or* completion date; **skip this occurrence** (recorded as skipped, not done); a plain-English summary and the next three dates in the editor.
- **Time + reminders:** optional `due_time`, a reminder offset, Done/Snooze on the notification, and a daily "plan your day" digest (overdue + today counts) that opens Today.
- **Quick add with natural language:** a one-line sheet parsing dates ("tomorrow", "fri", "19/10" **day-first**), times ("7pm"), repeats ("every mon", "every 2 weeks") and priority ("!high"); recognised words become tappable chips; Enter adds and keeps the sheet open. Hand-written grammar, fully tested — no library.
- **Complete with undo:** ticking shows "Completed · Undo"; undo also removes the occurrence it created. Long-press opens a menu (Reschedule, Skip, Edit, Delete). **No row swipes** — the list sits in the tab pager.
- **Notes and a checklist on a task**, with check items that reset when a repeat comes round.
- **Streak chip** on repeating tasks (from `series_id` + `completed_at`); a per-routine history.
- **Website:** the kanban gains Group by (Frequency · Due · Priority), column overdue counts, the same quick-add parser, and a month calendar of tasks.

Data: `due_time`, `reminder_offset_min`, `repeat_every`, `repeat_weekdays`, `repeat_anchor_day`, `repeat_from`, `series_id`, `completed_at`, `outcome` (`done | skipped | wont_do`), `notes`, `checklist`.

---

## 6. Notes

- **Trash with undo** replaces "This cannot be undone": delete → "Moved to Trash · Undo"; a Trash view (restore, delete forever, empty); purge after 30 days. **Every** existing read on both clients must exclude trashed notes — lists, Inbox, tag counts, search, home tile.
- **Pin to top** (Pinned / Others headings when something is pinned). Pinning does not file a note out of the Inbox.
- **Markdown in read mode:** headings, bold, italic, bullets, numbered lists, quotes, links, and **`- [ ]` checkboxes tickable in read mode and saved immediately** (the same rule checklists already follow). A formatting bar above the keyboard in edit mode; Enter continues a list. Previews strip the syntax. **A small hand-written parser shared by both clients** (pure TS in `modules/notes/`, tested) — not a library.
- **Journal:** an "On this day" strip (entries from this date in earlier years), a streak chip, and an optional prompt card with shuffle when today has no entry. All derived from `entry_date`.
- **Checklist upgrades:** ticked items sink into a collapsible "N ticked" group; "Delete ticked"; undo on "Uncheck all".
- **Archive**, and **note colour** (6–7 muted swatches as a tint + edge stripe, usable as a filter).
- **Create button:** tap = the current tab's type; long-press = Note / Checklist / Today's journal. On Journal, open today's entry if it exists rather than duplicating it.
- **Long-press a card** → selection mode (Pin, Colour, Archive, Delete). No card swipes (tab pager).

Data: `deleted_at`, `pinned_at`, `archived_at`, `color`.

---

## 7. Finance

**Run `0008_finance_v2.sql`.** It is a complete, considered design for accounts, transfers, budgets, assets, liabilities and net worth, held back only because no interface existed for it. v3 builds the interface for the parts below; net worth stays for later.

- **Accounts and transfers:** an account on every transaction (default: last used); transfers are paired rows, shown as a neutral "HDFC → Cash" row and **excluded from income, spending and the pie**; an Accounts screen with balances (opening balance + transactions) and credit cards as liabilities.
- **Two-tap logging:** default category and account = last used for that kind; a note that matches an earlier note pre-fills its category; **pinned quick-adds** ("Chai ₹20 · Cash") logging in one tap with undo; **Save & add another**; recent-note suggestions.
- **Category budgets with a pace marker:** a bar with a tick at (days elapsed ÷ days in month) × limit; green under pace, amber over pace but under the limit, red over (with words, never colour alone); "₹2,340 left · ₹156/day for 15 days". Tap → that category's month and six-month history.
- **Calendar month view** on the phone (core `MonthCalendar`): each day's spend, tint by spend, tap → that day's entries + "Add for 16 Oct".
- **Phone search with a total** of the results ("23 results · ₹6,480").
- **Deltas** on the month summary ("Food ▲18% vs Sep"; absolute ₹ when last month was tiny).
- **Custom month start** (salary day) as a setting.
- **Deep link for capture:** `eio://finance/add?amount=…&note=…&category=…` opens a pre-filled add sheet, so an automation app the user trusts (MacroDroid, Tasker) can turn bank/UPI notifications into entries without EIO holding a restricted permission. Stage 0 of the capture plan in [finance.md §5.2](../../research/finance.md).

Data: 0008, plus `finance_templates` (pinned quick-adds) or a JSON setting.

**Deferred:** the in-app notification listener (stage 1) — custom Kotlin, a restricted setting on sideloaded Android, and unverifiable from here; tags; net-worth screens; receipts.

---

## 8. Subscriptions

**Confirmed bug:** reminders are **skipped when the due date is within 3 days** — exactly the ones closest to being forgotten. And reminders are lost after a reinstall until the subscription is edited.

- **Reminders that can't be missed:** chosen offsets (7d · 3d · 1d · same day), a time of day, per-subscription override; **never skip** — schedule whichever offsets are still in the future, at minimum same-day; **re-sync on every launch**; "Netflix renews tomorrow · ₹649" with a Mark-paid action.
- **Free trials:** a trial state with "ends on" and "then ₹X"; excluded from totals until it converts; reminders 3d/1d/morning-of; on the end date, Keep (convert) or I cancelled.
- **Upcoming:** a 14-day strip (day, logos, ₹ total) and a **month calendar** (core); the list split into Overdue · This week · This month · Later, each header with count and total.
- **Lifecycle:** Active · Trial · Paused (resume date) · Cancelled ("access until", drops from totals after) · Archived; "How to cancel" (link + notes).
- **India-first quick-add catalogue:** ~60–100 services (OTT, music, telecom, DTH, cloud, AI tools…) with brand colour, category, usual cycle and a manage/cancel URL; picking one pre-fills everything but the price. Rows show a **brand-coloured tile with a monogram**. Built from the services' own sites; not copied from any app; kept private.
- **Charged to:** link to a Finance account (0008) and a channel (Card · UPI AutoPay · Google Play · …). Mark paid logs **against that account**, with the amount **editable** (GST, forex, a price rise).
- **Price history** from those edits, with a "↑" badge for 60 days after an increase.
- **Flexible cycles:** every N days/weeks/months, and one-time (28/56/84-day Indian prepaid packs).
- **Per-subscription currency** with a manually set rate; Mark paid always logs the actual INR.
- **Insights:** Week / Month / Year, horizontal category bars with "% · ₹" (not donuts), ₹ per year per item.

Data: `status`, `trial_ends_on`, `ends_on`, `resume_on`, `cancel_url`, `cancel_notes`, `service_key`, `color`, `account_id`, `charge_channel`, `reminder_offsets`, `cycle_unit`, `cycle_count`, `currency`, `fx_rate`; `subscription_price_changes`; `transactions.subscription_id`.

---

## 9. Products

- **Edit a past use** (tap a history row → day, quantity, note, Save, Delete).
- **Undo after a one-tap log:** "Logged 5 g · Yesterday — Undo" (naming the day confirms a backdated log landed right).
- **Long-press "Log use"** → Today · Yesterday · Pick a day, with the amount pre-filled.
- **Restock — "Start a new one"** when finishing: a pre-filled copy (same name, opened today, last price editable). Today the table allows **one product per name**, so a second tub of the same whey cannot be added at all. → Drop `unique (user_id, name)`, add `previous_id`, and a partial unique index on the *active* container per name. The previous container's lifespan gives the new one an estimate before it has data: "~42 days (last one lasted 42)".
- **Reorder reminders:** a notification the morning a product crosses into "Reorder now", and on the projected empty day; actions Ordered / In 3 days; rescheduled after every log. The home tile shows "2 to reorder".
- **Today checklist:** products used on ≥ 5 of the last 7 days appear as check rows at the top; tap logs the per-use amount, tap again un-logs; "Log all (N)".
- **Expiry and period-after-opening:** `expires_on` and `pao_months`; use-by = the earlier of the two; a second chip from 30 days before; **"At your pace this lasts 140 days; it expires in 90."**
- **Choose the date when marking finished** (it feeds the next container's estimate).
- **Lifecycle filter:** Unopened (spares) · In use · Finished; repeat purchases grouped ("Whey ×3") with each container's lifespan and price.
- **Safer delete:** "Deletes 62 logged uses" and suggest Mark finished instead.

Data: drop the name unique, `previous_id`, partial unique index, `expires_on`, `pao_months`, `reorder_lead_days`, `opened_on` nullable (spares).

---

## 10. B-List

- **Tick, then remember:** ticking stays one tap; a bar follows — "Done · today · Add memory · Undo". The memory sheet (all optional): **when** (today, yesterday, or any earlier month/year — backdating matters because all 818 items came in undone), what happened, where, do it again (yes/maybe/no).
- **Pick for me:** three random to-dos honouring the active filters, defaulting to no/low cost; stable for the day; Shuffle; Not now (hidden 30 days); long-press → Now.
- **Now shelf:** a want-level separate from cost — Now / Next / Someday — with Now capped at 5 cards at the top; adding a sixth asks which to swap out.
- **Lived timeline:** the Done view becomes a year → month timeline with a **year card** (count, cost-tier split, top categories, month strip). No strikethrough in Done — on a screen where everything is done it is noise.
- **Plan a Now item:** target with honest precision (this year / a month / a date), a steps checklist, estimated ₹ and ₹ saved with "₹3,200 a month reaches it by Oct 2027". No red "overdue" — a passed target offers "Move to…".
- **A vector icon per category** (a hard-coded map for the 61), in headers, the filter sheet and chips.

Data: `memory`, `place`, `again`, `snoozed_until`, `focus`, `target_on`, `target_precision`, `est_cost_minor`, `saved_minor`; `bucket_steps`.

**Deferred:** photos (Storage), places on a map.

---

## 11. Custom modules

- **Quick log with defaults:** each field gets a default — none · fixed · today · **same as last entry**. If every required field has one, `+` logs at once with "Logged · Undo"; long-press opens the full form. Fields filled from the last entry show a "↺ last" tag.
- **Trend chart** of a number/money field over time (bucket as-logged/day/week/month, sum or average, optional moving average), plus a sparkline on the home tile. No empty chart: no number field, no card.
- **New field types:** Rating (1–5), Multi-select, Duration (h:m, sums like a number), and **tap-to-toggle yes/no in the list row** so a module works as a daily check-off.
- **Filter chips and group-by** with per-group totals ("Reading · 3 · 412 pages").
- **Module reminders:** a daily/weekly nudge (skipped if today already has an entry), and reminders on a date field (on, or N days before).
- **Starter templates** (Books, Sleep, Plants, Films, Habits…) that pre-fill the builder for review.
- **Row roles:** choose Title, Subtitle and Badge fields.
- **Calendar view** for modules with a date field.
- **Type-change guard:** "14 entries have a value here; 3 won't show as Number. Nothing is deleted."

Data: `user_module_fields.default_mode`, `default_value`, `hint`; widen the field-type check; `user_modules.title/subtitle/badge_field_key`, `chart_*`, `group_field_key`, `reminder_*`, `summary_period`.

---

## 12. Migrations

Numbered so they sort into a valid run order. The user runs them; the lead cannot apply them without a fresh access token.

| File | Contents |
|---|---|
| `0017_drop_duplicate_exercise_index.sql` | (already written) |
| `0018_simplify_muscle_tags.sql` | (already written) |
| `0008_finance_v2.sql` | (already written; **now to be run**) |
| `0019_fitness_v3.sql` | §4 |
| `0020_tasks_v3.sql` | §5 |
| `0021_notes_v3.sql` | §6 |
| `0022_finance_v3.sql` | §7 (templates, capture columns if any) |
| `0023_subscriptions_v3.sql` | §8 (references `accounts` from 0008) |
| `0024_products_v3.sql` | §9 |
| `0025_bucket_v3.sql` | §10 |
| `0026_custom_v3.sql` | §11 |

**All migrations must be run before the v3 APK is installed.** A query naming a column that does not exist yet fails the whole screen. Each migration is idempotent and never drops or renames anything the v2 app reads, so running them early is safe.

---

## 13. How it gets built

1. **Foundation** (lead): §3. Committed before anything else starts.
2. **Fitness** (lead): §4, phase by phase — logging loop → calisthenics mode → insight → gym tools and body — app and website together.
3. **The other seven modules in parallel** (one builder each, isolated worktrees): §5–§11. Each builder reads its research report and this document, follows §2, writes its own migration, and returns a summary of what it built, what it could not, and what it could not verify.
4. **Integration** (lead): merge, resolve the shared files (navigation, routes, dashboard), run everything, update the user guide, build the APK.

**Done means:** every check in §2 passes on both clients, each module's pure logic has tests, and the report says plainly what could not be verified — nothing here runs on the user's phone until they install it.
