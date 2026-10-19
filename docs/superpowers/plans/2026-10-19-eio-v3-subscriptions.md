# Subscriptions v3 Implementation Plan

> **For agentic workers:** built inline by one builder, task by task, TDD for every pure function. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Subscriptions the tracker that cannot let a renewal slip past — reminders that never skip and survive a reinstall, real trials, a lifecycle beyond on/off, an India-first quick-add catalogue, honest Mark paid against a Finance account, price history, flexible cycles, per-subscription currency, an upcoming strip, a month calendar and insights — spec §8 in full, on the phone and the website.

**Architecture:** One migration (`0023_subscriptions_v3.sql`, after `0008_finance_v2.sql`) adds the lifecycle, cycle, currency, reminder and charged-to columns, `subscription_price_changes`, `subscription_settings` and `transactions.subscription_id`. All rules are pure TypeScript in `app/src/modules/subscriptions/` (`cycles.ts`, `currency.ts`, `lifecycle.ts`, `reminders.ts`, `upcoming.ts`, `insights.ts`, `prices.ts`, `catalogue.ts`, `brand.ts`), each tested, and shared by both clients. `api.ts` is the only database code (it reads `accounts` and `transactions` itself, and writes transactions through `core/ledger`). `notifications.ts` turns a reminder plan into scheduled notifications through `core/notifications`; the launch resync is registered from `api.ts`.

**Tech stack:** Expo SDK 57 / RN 0.86 / React 19 (app), Vite + React (website), Supabase Postgres, Jest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §8 (binding), §2, §3, §12. Evidence: `docs/research/subscriptions.md` (§5 recommendations, §6 UI patterns).

## Global constraints

- §2 in full: 48dp targets, never colour alone (status chips carry words), Ionicons / `Icon.tsx` only, no swipe on rows (long-press → actions sheet, plus buttons on the detail screen), undo for reversible (mark paid, pause, cancel, archive, convert trial), confirm only delete, semantic tokens in screens (brand colours come from data, never a literal in a screen), tabular figures for every ₹ column, a11y labels, light + dark.
- Money is integer minor units. A subscription's `amount_minor` is in its own `currency`; anything summed is converted to INR paise first; Mark paid always logs INR.
- Dates are `'YYYY-MM-DD'` and all date maths go through `(y, m, d)` construction (tests run in America/New_York across DST).
- The migration adds only; `is_active` and `billing_cycle` keep being written for the v2 app.
- Checks after every task touching shared code: app `tsc --noEmit`, `eslint src App.tsx`, `jest` (with a private `--cacheDirectory`: the shared transform cache races between parallel builders); website `tsc -b`, `eslint src`, `vite build`.

---

## File map

Pure logic (each with `__tests__/<name>.test.ts`):
- `subscriptions/types.ts` — row types (`Subscription`, `SubscriptionInput`, `SubscriptionStatus`, `CycleUnit`, `Cycle`, `ChargeChannel`, `PriceChange`, `ReminderSettings`, `Account`, `Payment`) and labels. Keeps `toMonthlyMinor` / `advanceDueDate` for old callers.
- `subscriptions/cycles.ts` — `cycleOf`, `legacyCycleFor`, `addCycle`, `perYearMinor`, `perMonthMinor`, `cycleLabel`, `cycleSuffix`, `occurrences`.
- `subscriptions/currency.ts` — `CURRENCIES`, `toInrMinor`, `inrOf`, `formatAmount`, `rateFromPayment`.
- `subscriptions/lifecycle.ts` — `effectiveStatus`, `countsInTotals`, `isUpcomingCharge`, `bucketOf`, `countdownLabel`, `isActiveFlag`.
- `subscriptions/reminders.ts` — `DEFAULT_REMINDER_SETTINGS`, `reminderPlan`, `reminderTitle`, offset ids.
- `subscriptions/upcoming.ts` — `upcomingDays` (14-day strip), `monthCharges` (calendar), `sections` (time buckets with count + total), `summaryTotals`.
- `subscriptions/insights.ts` — `periodRange`, `periodTotal`, `breakdown`, `perItemYearly`.
- `subscriptions/prices.ts` — `priceSteps`, `recentIncrease` (60-day ↑).
- `subscriptions/catalogue.ts` — ~80 India-first services (plain data) + `searchCatalogue`, `findService`.
- `subscriptions/brand.ts` — `monogram`, `readableOn` (text colour on a brand tile), `fallbackColor`.

Data and hooks: `api.ts` (rewritten), `notifications.ts` (rewritten), `useSubscriptions.ts`, `useSubscription.ts` (detail).

App UI: components `BrandTile`, `SubscriptionRow`, `UpcomingStrip`, `SectionHeader`, `MarkPaidSheet`, `DateActionSheet` (cancel / pause), `TrialSheet`, `ActionsSheet`, `ReminderSettingsSheet`, `OffsetChips`, `CalendarView`, `InsightsView`; screens `SubscriptionsListScreen` (rebuilt), `SubscriptionDetailScreen` (new), `SubscriptionCatalogueScreen` (new), `SubscriptionEditScreen` (rebuilt).

Shared files (additive): `core/ledger.ts` (account/subscription ids, returns id, `removeEntry`), `core/notifications.ts` (`categoryId`, `defineCategory`, `onResponse`), `navigation/types.ts` + `RootNavigator.tsx` (two routes, notification routing), `home/useHomeSummaries.ts` (tile), website `pages/Dashboard.tsx` (tile), `components/Icon.tsx` (icons), `styles/components.css` (section at the end).

Website: `pages/SubscriptionsPage.tsx` (rebuilt; the page splits into `pages/subscriptions/*` if it grows past ~900 lines).

---

## Tasks

### S0: Plan (this file) — commit.

### S1: The confirmed bug, test first
- [ ] Failing test in `__tests__/reminders.test.ts`: a subscription due in 2 days still gets a reminder (`scheduleReminder` resolves `true`, the native scheduler is called for the 1-day and same-day moments). Watch it fail (returns `false`).
- [ ] Fix inside the current shape: offsets `[3, 1, 0]`, schedule each one still in the future, ids `subscription-renewal-<id>-d<N>`, cancel the old bare id too. Test passes; whole suite green. Commit.

### S2: Migration `supabase/migrations/0023_subscriptions_v3.sql`
- [ ] Columns on `subscriptions`: `status`, `trial_ends_on`, `ends_on`, `resume_on`, `cancel_url`, `cancel_notes`, `service_key`, `color`, `account_id` (→ `accounts`, set null), `charge_channel`, `reminder_offsets smallint[]`, `cycle_unit`, `cycle_count`, `currency`, `fx_rate`, `fx_rate_on`; guarded backfills (`status` from `is_active`, cycle from `billing_cycle`).
- [ ] `transactions.subscription_id` (→ `subscriptions`, set null) + partial index.
- [ ] `subscription_price_changes` (cascade with its subscription) and `subscription_settings` (one row per user); RLS + four policies each; `updated_at` trigger on settings.
- [ ] Re-read for syntax and idempotency. Commit.

### S3: Types and cycles (`types.ts`, `cycles.ts`)
- [ ] Tests: legacy fallback (`weekly → week×1`, `quarterly → month×3`), `addCycle` for N days across DST, N weeks, N months with month-end clamp from the anchor (31 Jan + 2 months = 31 Mar, not 28 Mar), years incl. 29 Feb, `once → null`; `perMonthMinor` (weekly = 52/12, 28 days = 365/28/12, once = 0, whole paise); `legacyCycleFor` (28 d → monthly, 84 d → quarterly, once → yearly); labels ("Every 28 days", "Every 2 months", "One-time"); `occurrences` from a due date to an end date. Then implement. Commit.

### S4: Currency (`currency.ts`)
- [ ] Tests: INR passthrough, `$20.00 × 86.50 = ₹1,730.00`, rounding to whole paise, missing rate → `null`, `rateFromPayment(₹1,742.40 for $20) = 87.12`, formatting with symbol. Implement. Commit.

### S5: Lifecycle (`lifecycle.ts`)
- [ ] Tests: paused past its resume date is active; cancelled before/on/after `ends_on`; cancelled with no end date is ended; trial before/at/after its end; archived; `countsInTotals` (active yes, cancelled until ends_on, trial no, foreign without rate excluded separately); `bucketOf` (overdue, this week = 0–6 days, this month = rest of the calendar month, later, trials, paused & ending, archive); `countdownLabel` ("Today", "Tomorrow", "in 5 days", "in 3 wks", "2 days overdue", "Ends in 9 days", "Trial ends today"); `isActiveFlag` for the v2 column. Implement. Commit.

### S6: Reminders (`reminders.ts`, `notifications.ts`)
- [ ] Tests for `reminderPlan(sub, settings, now, context)`: every chosen offset still in the future; same-day always included (the floor); due in 2 days with `[7,3]` → only same-day; per-subscription override wins; `[]` = off; time of day honoured; trial → 3d/1d/morning-of the end date with trial wording; paused with a resume date → "resumes" wording; cancelled / archived / ended → none; overdue → none; DST-safe (fire time is local wall-clock time built from y/m/d). Titles: "Netflix renews tomorrow · ₹649", body names the date and the account.
- [ ] `notifications.ts`: `scheduleReminders(sub, settings, context)`, `cancelReminders(id)`, `rescheduleAll(rows, settings, context)` (`cancelPrefix('subscription-renewal-')` then schedule all), the `'renewals'` channel, `reminderId` unchanged. Lazy-loading tests kept. Commit.

### S7: Upcoming, insights, prices (`upcoming.ts`, `insights.ts`, `prices.ts`)
- [ ] Tests: 14-day strip (days, per-day items, INR totals, trials marked but not totalled); sections with count + INR total; month calendar (projected charges + paid entries); summary totals per week/month/year normalised; period ranges (Mon–Sun week, calendar month, calendar year); `periodTotal` = paid in period + still due; category breakdown with % summing to 100 and sorted; `recentIncrease` within 60 days only and only for increases; `priceSteps` with %. Implement. Commit.

### S8: Catalogue and brand (`catalogue.ts`, `brand.ts`)
- [ ] Tests: unique keys, valid hex, valid category keys, valid cycles, https URLs; search by name and alias, case/space-insensitive, Indian services first for an empty query; `monogram` ("Amazon Prime Video" → "AP", "JioCinema" → "JC", "Zee5" → "Z5"); `readableOn` picks the higher-contrast of white/near-black. Write the catalogue (~80 services: OTT, music, telecom, DTH, broadband, cloud, AI, software, news, food/shopping memberships, fitness, education, gaming), flagging uncertain URLs. Commit.

### S9: Core additions (shared, additive)
- [ ] `core/ledger.ts`: `LedgerEntry` gains optional `account_id`, `subscription_id`; `recordEntry` returns the new row's id; `removeEntry(id)`.
- [ ] `core/notifications.ts`: `schedule({... categoryId?})`, `defineCategory(id, actions)`, `onResponse(listener)` (live responses + the one that launched the app). Tests in `core/__tests__/notifications.test.ts`.
- [ ] `navigation/types.ts` (`SubscriptionDetail`, `SubscriptionCatalogue`, `SubscriptionEdit.serviceKey`), `RootNavigator.tsx` (register, plus `useNotificationRoutes`: a notification whose data carries `route`/`params` — or `actions[actionId]` — opens that screen). Commit.

### S10: API and hooks
- [ ] `api.ts`: list/get/create/update (writes `is_active`, `billing_cycle` for v2; records a price change when the amount changes), delete; `markPaid` / `undoMarkPaid`; `pause`, `resume`, `cancel`, `undoLifecycle` (restore a snapshot of the lifecycle fields), `archive`, `restore`, `convertTrial`, `endTrial`; `listAccounts`, `listPayments(subId)`, `listPaymentsBetween(from, to)`, `listPriceChanges(subId)`, `listRecentPriceChanges(since)`; `getReminderSettings` / `saveReminderSettings`; `resyncReminders` registered with `registerResync('subscriptions', …)`.
- [ ] `useSubscriptions` (list + accounts + settings + recent price changes + permission; actions update their own row only), `useSubscription(id)` (detail). Commit.

### S11: App screens
- [ ] Components: `BrandTile`, `SubscriptionRow`, `SectionHeader`, `UpcomingStrip`, `MarkPaidSheet`, `DateActionSheet`, `TrialSheet`, `ActionsSheet`, `OffsetChips`, `ReminderSettingsSheet`, `CalendarView`, `InsightsView`.
- [ ] `SubscriptionsListScreen`: hero with cadence pill (/wk /mo /yr), permission banner, `Tabs` Upcoming · Calendar · Insights, strip + sections, archive link, FAB → catalogue.
- [ ] `SubscriptionCatalogueScreen`: search with keyboard up, brand rows, "Add own" extended button.
- [ ] `SubscriptionEditScreen`: amount + currency + rate, name, cycle (unit/count/one-time), trial toggle, next due, category, charged to (account + channel), reminders (default / custom / off), how to cancel, colour, note; unsaved-changes guard.
- [ ] `SubscriptionDetailScreen`: hero, Mark paid, payments, price history, reminders, charged to, how to cancel, lifecycle actions, delete (confirm stating the cascade). Opens the Mark paid / trial sheet when routed from a notification. Commit after each screen.

### S12: Home tile
- [ ] `home/useHomeSummaries.ts`: overdue → trial ending → due this week → ₹/mo, using the new rules. Commit.

### S13: Website
- [ ] `SubscriptionsPage`: stats with cadence, Segmented List · Calendar · Insights, FilterBar (search, status, category, charged to), strip, sections with brand tiles, detail dialog (payments, price history, how to cancel, lifecycle), Mark paid dialog, cancel/pause dialogs, trial decision, edit dialog with catalogue search, reminder defaults dialog, archive view, undo toasts.
- [ ] `Dashboard.tsx` tile; `Icon.tsx` icons; CSS section at the end of `components.css`. Commit.

### S14: Verification
- [ ] All six checks; read both themes' styles once more; `git log --oneline v3..HEAD`; report.

---

## Rulings

- Ruling: per-offset reminder ids `subscription-renewal-<id>-d<N>` (renewals) and `-t<N>` (trial end); the bare v2 id `subscription-renewal-<id>` is still cancelled on every reschedule — why: several reminders per subscription need distinct ids, and one shared prefix keeps the brief's `cancelPrefix('subscription-renewal-')` resync and `reminderId` intact — cost if wrong: none at runtime; a stray id is cleared at the next launch.
- Ruling: the same-day reminder is always scheduled (the floor); the chosen offsets are added to it; a subscription can turn its reminders Off (empty override) — why: spec "at minimum same-day"; Off exists for the ₹20 things nobody wants buzzing — cost if wrong: someone who wanted no same-day buzz gets one (the chip says so).
- Ruling: global reminder defaults (offsets, time of day) live in a `subscription_settings` row, not on the phone — why: they survive a reinstall, the launch resync then reads only the database, and the website can edit them — cost if wrong: one small extra table.
- Ruling: default offsets 3 days and 1 day (plus the same-day floor) at 09:00 — why: v2 reminded 3 days ahead at 9; 1 day and same day are the bug fix — cost if wrong: one setting change.
- Ruling: the resync is registered from `api.ts`, not `notifications.ts` — why: it reads the database, only `api.ts` talks to Supabase, and `notifications.ts` cannot import `api.ts` (a cycle); `api.ts` is loaded at launch (HomeScreen → useHomeSummaries → subscriptions/api) — cost if wrong: none.
- Ruling: `status` is stored, the effective state is derived (paused past its resume date → active; cancelled past its access date, or with none → ended; trial past its end → awaiting a decision) — why: nothing runs in the background to flip a stored state on the day, and a derived state cannot go stale — cost if wrong: filtering by effective state happens in JS, which is fine at tens of rows.
- Ruling: `is_active` (= status active or trial) and `billing_cycle` (nearest legacy cycle) are still written for the v2 app; the migration maps `is_active = false` to `cancelled` with no end date (ended) — why: v2's phone labels inactive rows "Cancelled · Not billing" — cost if wrong: an old paused row shows under Archived & ended, one tap from Restore.
- Ruling: `cycle_unit` / `cycle_count` are nullable and read through `cycleOf`, which falls back to `billing_cycle` — why: a v2 app still inserting after the migration writes only `billing_cycle`, and a column default would silently turn its weekly bill into a monthly one — cost if wrong: one fallback function.
- Ruling: a one-time charge moves to Archived when marked paid — why: it does not recur; Archive keeps its payment — cost if wrong: one Restore.
- Ruling: currencies are INR plus two-decimal ones (USD, EUR, GBP, AED, SGD, AUD, CAD); the rate is ₹ per unit, set by hand with its date; a foreign subscription without a rate is left out of totals and says so — why: `core/money` parses two decimals, and a yen subscription is unlikely for this user — cost if wrong: enter that one in INR.
- Ruling: Mark paid always asks the INR amount (pre-filled with the converted price). For INR subscriptions a different amount offers "This is the new price" (on by default); for foreign ones it offers "Use as the rate: ₹87.12 per $" (off by default). A price change is recorded only when chosen — why: for INR a different amount is usually a rise; for USD it is usually forex — cost if wrong: one toggle tap.
- Ruling: Mark paid is confirmed by its sheet (the amount is the thing to check), then undoable for 5 s from a toast (deletes the transaction and price change, restores date, status and amount) — why: §2 undo-for-logs plus the spec's editable amount — cost if wrong: none.
- Ruling: editing the amount in the editor also records a price change, effective today — why: "price history from those edits" — cost if wrong: a typo fix leaves a history row (it can be deleted on the detail screen).
- Ruling: a cancelled subscription still counts in totals until its access date, but is never projected as an upcoming charge and gets no reminders — why: spec "drops from totals after"; it will not renew — cost if wrong: a month of slightly high total.
- Ruling: a trial's `next_due_date` is its end date (the first charge if kept) and `amount_minor` is the price after; Keep → active with the same due date (so it shows "Due today" and Mark paid); I cancelled → cancelled with access until the trial end — why: no extra columns, and Keep leads straight into paying — cost if wrong: none.
- Ruling: pausing takes an optional resume date; with one, `next_due_date` moves to it and the reminders say "resumes"; Resume now sets the due date to the later of the old one and today — why: a paused plan's next charge IS its resume day — cost if wrong: the date is editable.
- Ruling: notification taps and the Mark-paid action are routed by a generic, additive mechanism: `core/notifications` gains `categoryId` / `defineCategory` / `onResponse`, and `RootNavigator` opens `data.route` with `data.params` (or `data.actions[actionId]`) — why: modules cannot import navigation (the website imports `api.ts` → `notifications.ts`), and a route in the notification keeps core module-agnostic — cost if wrong: a core change others should know about; unverifiable here; the v57 docs mark `categoryIdentifier` iOS-only, so the Android button may not appear (the tap still opens the subscription with Mark paid one tap away).
- Ruling: the catalogue is plain TS data in the module (~80 services, no prices, monogram tiles only, no logos); URLs come from general knowledge and uncertain ones say so in a comment — why: brief; prices go stale and the spec pre-fills everything but the price — cost if wrong: a dead "Manage" link, editable per subscription.
- Ruling: `charge_channel` has no CHECK constraint — why: the list grows (Amazon Pay, PayPal…) and a constraint would make each one a migration, the same call 0005 made for categories — cost if wrong: a typo'd value from a hand-edit shows as "Other".
- Ruling: transactions are written through `core/ledger` (extended additively) rather than inserted from `api.ts` — why: one insert path for the ledger (its header explains why) — cost if wrong: a merge with Finance's edits to the same file.
- Ruling: the calendar shows projected charges from each next due date onward and, for past days, payments logged with a `subscription_id`; footer "Paid ₹X · Still to pay ₹Y" — why: a projection backwards is fiction — cost if wrong: payments logged before v3 (no link) do not appear.
- Ruling: Insights for a period = paid in it (ledger) + still due in it (projection); category and charged-to bars; per-item ₹/yr — why: spec + ReSubs v1.38's "includes payments due later in the year" — cost if wrong: the "paid" half only counts v3-linked payments, and says so.
- Ruling: "This week" = due in the next 7 days (0–6), "This month" = later in the current calendar month, "Later" after that — why: predictable on any day of the month — cost if wrong: labels only.
- Ruling: the list screen uses core `Tabs` (Upcoming · Calendar · Insights), not `SwipeTabs` — why: the 14-day strip scrolls horizontally, and two horizontal gestures in one place fight — cost if wrong: none.
- Ruling: Delete stays a confirm and names the cascade ("Deletes its price history (3 changes). Payments already in Finance stay.") — why: permanent; Archive is the undoable alternative and is offered first — cost if wrong: none.
