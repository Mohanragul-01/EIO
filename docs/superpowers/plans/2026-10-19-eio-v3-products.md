# Products v3 Implementation Plan

**Goal:** Finish the Products module (spec §9): correct and backdate uses without friction, restock a product without renaming it, warn before something runs out or expires, and make the daily ritual one tap — on the phone and the website, over one set of shared rules.

**Architecture:** One migration (`0024_products_v3.sql`) relaxes the one-product-per-name rule into one *active* container per name and adds spares, expiry, period-after-opening and a reorder lead time. Every rule (projection, prior estimate from the previous container, use-by, the expiry conflict, lifecycle and grouping, the Today checklist, reorder counts, reminder planning, the expiry text parser) is pure TypeScript in `app/src/modules/products/`, tested, and shared by both clients through `@app`. One composition function, `buildOutlooks`, turns rows into what a card shows, so the list, the detail screen, the website, the home tiles and the reminders cannot disagree. `api.ts` is the only database code.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §9 (binding), §2, §3, §12. Evidence: `docs/research/products.md` (§5 TOP 1–5, §6 UI patterns).

## Global constraints

- §2 in full: 48dp targets, never colour alone, Ionicons / `Icon.tsx` only, undo for reversible actions (log, un-log, delete a use, finish), confirm only deleting a product (with its cascade count), semantic tokens, tabular figures, a11y labels, light + dark.
- The migration only adds and relaxes. Dropping `unique (user_id, name)` and making `opened_on` nullable are relaxations the spec requires; both keep every v2 row valid.
- A projection is measured, never assumed. The previous container's lifespan is shown as an *estimate* ("~42 days"), never as a measured figure, and never drives reminders.
- Toasts never from inside an open sheet or dialog: close first, then show.

## File map

Pure logic (each tested in `__tests__/`):
- `products/types.ts` — row types gain `previous_id`, `expires_on`, `pao_months`, `reorder_lead_days`, nullable `opened_on`; `project()` handles spares and ends a finished container's life at `finished_on`; `urgencyOf()` uses the product's lead days; `daysBetween`, `addDays` exported.
- `products/containers.ts` — `lifecycleOf`, `lifespanDays`, `previousContainer`, `priorEstimate`, `formatEstimate`, `sameName`, `finishedGroups`, `siblingsOf`, `restockDraft`.
- `products/useBy.ts` — `addMonthsISO`, `useByOf`, `useByState`, `expiryConflict`, `conflictMessage`, `useByLabel`, `parseExpiry`, `formatExpiryInput`.
- `products/checklist.ts` — `todayChecklist`.
- `products/outlook.ts` — `buildOutlooks`, `chipsFor`, `reorderSummary`, `loggedMessage`, `deleteSummary`, `reorderMarker`.
- `products/reminders.ts` — `planReminders`, `reminderIdsFor`, `REMINDER_HOUR`.

Data and side effects:
- `supabase/migrations/0024_products_v3.sql`.
- `products/api.ts` — new fields; `updateUse`, `deleteUses`, `logUses`, `countUses`, `setFinished(id, date|null)`, `openSpare`, `overview()` returns `{ inUse, toReorder }`, `resyncReminders()` + `registerResync('products', …)`; unique-violation message.
- `products/notifications.ts` — channel `{ id: 'products', name: 'Reorder reminders' }`, `replaceReminders(outlooks)` (cancel `product-` prefix, schedule the plan).
- `products/useProducts.ts` — list data hook (useLatestRun), optimistic one-row log/un-log, reminders replaced after every load.

Phone UI:
- `products/components/DayChoice.tsx` — Today · Yesterday · Pick a day, the last opening an inline core `MonthCalendar` bounded to [opened, today], logged days dotted.
- `products/components/UseSheet.tsx` — log a use for a chosen day, or edit one (day, amount, note, Save, Delete).
- `products/components/FinishSheet.tsx` — the date it ran out; Finish / Finish and start a new one / Finish and open the spare.
- `products/components/TodayChecklist.tsx` — check rows + "Log all (N)".
- `products/components/StatusChips.tsx` — the primary + secondary chips and the remaining bar with its reorder marker.
- Screens: `ProductsListScreen` (lifecycle filter, checklist, grouped Finished, long-press sheet, undo naming the day), `ProductDetailScreen` (edit a use, strip day → sheet, finish sheet, spares, previous containers, expiry conflict), `ProductEditScreen` (spare toggle, expiry, PAO, lead days, restock pre-fill, safer delete).

Website: `website/src/pages/ProductsPage.tsx` (same features at desktop density), `website/src/pages/Dashboard.tsx` (tile counts via `reorderSummary`). Home: `app/src/home/useHomeSummaries.ts` (tile via `api.overview()`). Navigation: `ProductEdit` params gain `restockFrom` and `spare`.

## Tasks

### P1 — Migration `0024_products_v3.sql`
Drop the `(user_id, name)` unique constraint, found by definition in `pg_constraint` (not by guessed name), in a guarded `do $$`. Add `previous_id uuid references products(id) on delete set null` + index; `create unique index if not exists products_one_open_per_name on products (user_id, name) where finished_on is null and opened_on is not null`; `opened_on drop not null`; `expires_on date`; `pao_months smallint check 1..120`; `reorder_lead_days smallint check 1..60` (null = 7). Re-read for idempotency. Commit.

### P2 — Projection and urgency for spares, finished containers and lead days
Tests (`projection.test.ts`, extended): a spare projects nothing and is `unopened`; a finished container's `daysOpen` ends at `finished_on`; lead days move the Reorder-now and Running-low bands (critical ≤ L, soon ≤ L+14; L=7 keeps 7/21). Implement in `types.ts`.

### P3 — Containers: lifecycle, lifespan, prior estimate, grouping, restock
Tests (`containers.test.ts`): lifespan counts both ends; previous by `previous_id`, else latest finished with the same name (case- and space-insensitive), never itself, never an unfinished one; estimate = previous lifespan scaled by size when units match, minus days elapsed, floored at 0; no estimate without a finished previous; `formatEstimate` switches to months at 45; groups count only finished containers, newest first; `restockDraft` copies size, unit, per use, price, PAO and lead days, opens today (or not at all for a spare), clears expiry and note, links `previous_id`.

### P4 — Use-by, expiry conflict, expiry parser
Tests (`useBy.test.ts`): `addMonthsISO` clamps 31 Jan + 1 → 28/29 Feb and crosses years; use-by is the earlier of printed expiry and opened + PAO; a spare has no PAO clock; state is `soon` from exactly 30 days before through the day itself, `expired` the day after; conflict only when days left strictly exceeds days to use-by; message wording incl. "today"; parser takes `MM/YY`, `MM/YYYY`, `DD/MM/YY`, `DD/MM/YYYY` (day-first), `-`/`.`/space separators and ISO; month-only means the month's last day; rejects month 13, day 31 in April, empty.

### P5 — Today checklist
Tests (`checklist.test.ts`): window is the 7 days *before* today (today's ticks do not change membership); 5 of 7 qualifies, 4 does not; two uses on one day count once; uses 8 days ago and today do not count; finished, spares and products opened after today are excluded; a row is done when today has a use, carries today's uses newest first, amount = per_use or 1; stable alphabetical order.

### P6 — Outlook composition, chips, summaries, messages
Tests (`outlook.test.ts`): `buildOutlooks` attaches each container's uses, estimate, spare, use-by and conflict; a spare suppresses `needsReorder` for Reorder now and Running low and shows "Next one ready"; chips order use-by first only when it falls before the empty date; `reorderSummary` counts Reorder-now without a spare, running low, in use, spares; `loggedMessage` names the day ("Logged 5 g · Yesterday"); `deleteSummary` singular/plural/zero; reorder marker position = rate × lead ÷ total, clamped.

### P7 — Reminder plan
Tests (`reminders.test.ts`): two reminders per in-use container with a measured projection, at 09:00 local on (empty − lead) and on the empty day; past moments dropped; a spare drops the reorder one and changes the empty-day text; finished, spares, unknown projections plan nothing; ids are `product-<id>-reorder|empty`; DST-safe (built from y/m/d).

### P8 — API, notifications, data hook, home tile
`api.ts` (new functions above), `notifications.ts`, `useProducts.ts`, `home/useHomeSummaries.ts` ("2 to reorder"), registration chain check (RootNavigator → screens → api → notifications). Checks.

### P9 — Phone: sheets and components
`DayChoice`, `UseSheet`, `FinishSheet`, `TodayChecklist`, `StatusChips`.

### P10 — Phone: list screen
Lifecycle filter (Unopened · In use · Finished, shown once there is more than one), Today checklist with Log all and undo, cards with chips + marker bar + estimate line, tap Log use = today with "Logged 5 g · Today — Undo", long-press = UseSheet, Finished grouped "Whey ×3" with each container's lifespan and price, summary "N to reorder".

### P11 — Phone: detail screen
Status card (headline, chips, bar with marker, rate/cost, estimate, conflict line), strip with hollow empty days since opening (tap → UseSheet on that day), history rows tap → edit sheet, delete with undo, previous containers ("Lasted 41 · 38 · 44 days", prices), Finish sheet (date + restock / open spare), Add a spare, Open the spare, Reopen.

### P12 — Phone: edit screen
Spare toggle ("Not opened yet"), expiry text field with parser, PAO chips, reorder lead chips, restock pre-fill from `restockFrom` with the estimate preview and "last price" hint, permission request on save, safer delete (count + Mark finished instead).

### P13 — Website
ProductsPage at parity: lifecycle filter, Today checklist, chips, marker bar, estimate, conflict, undo toasts naming the day, history dialog with edit-in-place and inline undo, typed date shortcuts (`y`, `-3`, `DDMM`), finish dialog with date and restock/open spare, grouped Finished, delete dialog with count and Mark finished instead, product dialog with the new fields. Dashboard tile via `reorderSummary`. Checks, commit.

## Rulings

- Ruling: the active-container unique index is on `(user_id, name)` exactly, not `lower(name)` — the old constraint guarantees the exact form builds on existing data, while a case-folded one could fail the migration on "Whey"/"whey" — cost if wrong: two active containers differing only by case can coexist; the UI groups case-insensitively anyway.
- Ruling: "active" in the unique index means opened and not finished; spares (opened_on null) are outside it, so any number of spares can wait — cost if wrong: none for one person; buying two spares is real.
- Ruling: `reorder_lead_days` is nullable with null meaning 7 (today's Reorder-now band) — rows written by v2 and rows read before the migration both behave as today — cost if wrong: none.
- Ruling: bands scale with lead L as Reorder now ≤ L, Running low ≤ L + 14 — L = 7 reproduces today's 7/21 exactly, and a two-week buffer reads the same at any lead — cost if wrong: Running low starts a little early or late for unusual leads.
- Ruling: a finished container's life ends at `finished_on`, so "Lasted N days" stops counting when it was finished (v2 kept counting to today, which made every finished card's lifespan grow daily) — cost if wrong: none; it is a bug fix.
- Ruling: lifespans count both ends (opened 1 Oct, finished 1 Oct = 1 day), matching `daysOpen` — cost if wrong: off by one day in a muted estimate.
- Ruling: the previous container is `previous_id` when set, otherwise the latest finished container with the same name — v2 data has no links, and a re-added product of the same name is the same product — cost if wrong: an estimate from an unrelated product sharing a name.
- Ruling: the prior estimate is scaled by size when the units match (a 2 kg tub after a 1 kg one is ~2×) — cost if wrong: a less exact muted estimate.
- Ruling: the estimate is shown only until the measured projection exists, never feeds urgency, the expiry conflict or reminders — README: "a confident wrong number is worse than not enough data" — cost if wrong: an early container shows "Not enough data" urgency next to its estimate.
- Ruling: use-by states: "soon" from 30 days before (spec) through the use-by day; "expired" from the day after — cost if wrong: one day.
- Ruling: a spare's use-by is its printed expiry only; PAO starts on opening — cost if wrong: none.
- Ruling: expiry is typed as printed (`03/2027`, `15/03/2027`, day-first), and a month-only date means the month's last day — packs print month/year, and India writes day-first — cost if wrong: a product flagged a few weeks late if the maker meant the 1st.
- Ruling: the Today checklist window is the 7 days before today, not including it — otherwise ticking today could add a row and un-ticking it could make the row vanish under your finger — cost if wrong: a product needs one more day of use to appear.
- Ruling: checklist rows keep a stable alphabetical order and mute when done, instead of sinking to the bottom — "tap again un-logs" needs the row to stay where it was tapped — cost if wrong: done rows mix with open ones.
- Ruling: un-logging a checklist row deletes today's most recent use of it, with an undo toast — cost if wrong: on a two-a-day product the evening use goes first, which is also the one just logged.
- Ruling: "to reorder" (home tiles, summary) counts Reorder-now containers with no spare waiting; Running low is a secondary figure — the spec's notification fires on crossing into Reorder now, and a count that includes "Running low" (v2 website) disagrees with it — cost if wrong: the tile shows a smaller number than v2's website did.
- Ruling: a spare suppresses the reorder reminder and turns the empty-day reminder into "your next one is ready" — research Further 1 — cost if wrong: none.
- Ruling: the crossing reminder fires at 09:00 on (projected empty − lead days) only if that moment is still ahead; a container already past it gets only the empty-day reminder — re-arming a past crossing at every launch would nag daily without an "Ordered" action to silence it — cost if wrong: a container that is already at Reorder now when first projected, or that jumps past the crossing on a big log, gets no crossing notification (its card is red).
- Ruling: reminders are planned from the list's own data after every load (and after every write on the detail screen via `resyncReminders`), not by re-reading the database inside each write — the list reloads after every write anyway, so this costs no extra query — cost if wrong: a write made on the website reschedules on the phone only at its next launch or list open.
- Ruling: the resync is registered at the bottom of `api.ts`, not in `notifications.ts` — the resync must read the database and only `api.ts` may, while `api.ts` already imports `notifications.ts`, so registering there would create an import cycle — cost if wrong: none; the registration is reached by the same static import chain.
- Ruling: notification permission is requested when a product is saved on the phone (creating, restocking, editing) — that is the moment a reorder reminder is set up; never at launch — cost if wrong: someone who only logs never sees the prompt (Subscriptions asks on its screen already, so on this phone it is usually granted).
- Ruling: Ordered / In 3 days notification actions are deferred: core has no category support and the Tasks builder may add it; Products ships plain reminders, and adding a spare is the in-app "ordered" — cost if wrong: one more tap into the app.
- Ruling: finishing moves off the list's long-press (now "log for another day", per spec) to the detail screen's Finish sheet, where its date is chosen — research §6.6 keeps the destructive action away from the quantity control — cost if wrong: finishing is one screen deeper.
- Ruling: finish + restock writes in that order (finish, then create), because the unique index forbids two open containers; an interruption leaves the old one finished and no new one, which is visible and retryable — cost if wrong: none.
- Ruling: opening a spare finishes the current container on the same day first, then opens the spare; undo reverses in the opposite order — cost if wrong: none.
- Ruling: the Pick-a-day choice is an inline core `MonthCalendar` inside the sheet rather than the native date dialog — it can show which days already have uses, bound the range to [opened, today] visibly, and avoids stacking a native dialog over a Modal — cost if wrong: one more row of height in the sheet.
- Ruling: deleting a use on the website happens inside the history dialog, where a toast would sit under the `<dialog>`; the dialog shows its own inline "Deleted · Undo" line instead — cost if wrong: none.
- Ruling: the phone tile now fetches open containers' uses to count what to reorder (v2 deliberately did not) — the spec asks for "2 to reorder", and only open containers' uses are read — cost if wrong: one more small query on the home screen.
