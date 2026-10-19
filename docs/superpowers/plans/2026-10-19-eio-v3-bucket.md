# B-List v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the B-List from 818 checkboxes into a record of a life lived and a short list of what is next — spec §10 in full, on the phone and the website: tick-then-remember with backdating, Pick for me, the Now shelf, the Lived timeline with year cards, planning a Now item (target, steps, money), and a vector icon per category.

**Architecture:** One migration (`0025_bucket_v3.sql`) adds the item columns and a `bucket_steps` table. Every rule — dates and their precision, the timeline, the daily picks, the shelf cap, target and savings arithmetic, the category map — is pure TypeScript in `app/src/modules/bucket/`, tested, and imported unchanged by the website. `api.ts` is the only database code. The phone gets a `useBucket` hook (per-row optimistic updates) and a rebuilt screen made of small components; the website gets the same features on `BucketPage`, split into `website/src/pages/bucket/*`.

**Tech stack:** Expo SDK 57 / RN 0.86 / React 19 (app), Vite + React (website), Supabase Postgres, Jest. No new dependencies: Ionicons, AsyncStorage (already installed), core `Sheet`, `useToast`, `MonthCalendar`, `haptics`.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §10 (binding), §2 (ground rules), §3 (foundation), §12 (migrations). Evidence: `docs/research/bucket-list.md` (§5 recommendations, §6 UI patterns).

## Global constraints

- §2 in full: 48dp targets (hitSlop), never colour alone, Ionicons / `Icon.tsx` only, no emoji, undo for reversible (tick, untick, Not now, Now changes), confirm only the permanent (delete, which names its cascading steps), semantic tokens, tabular figures for counts and money, labels/roles/state on icon-only controls, light and dark.
- The B-List screen is a stack screen, not inside the tab pager, so the Now shelf may scroll horizontally; rows still have no swipe actions.
- Toast-under-sheet: any action taken inside a sheet closes the sheet before a toast appears. Removing a step inside the item sheet gets an inline undo instead.
- Optimistic updates roll back only the fields they changed on their own row.
- Website reuses `@app/modules/bucket/*` pure logic and `api.ts`; React hooks are not shared (a hook compiled from `../app` would resolve a second React).
- Checks after every task that touches shared code: app `tsc --noEmit`, `eslint src App.tsx`, `jest` (with a private `--cacheDirectory`); website `tsc -b`, `eslint src`, `vite build`.

---

## File map

Pure logic (each with a test in `app/src/modules/bucket/__tests__/`):
- `types.ts` — extended `BucketItem`; `Focus`, `Want`, `Again`, `Precision`, `BucketStep`, `DoneState`; `doneStateOf`, `tickedState`, `UNDONE`, `wantOf`; `matchesQuery` widened to memory and place.
- `categories.ts` — `CategoryGlyph`, `CATEGORY_GLYPH` (the 61), `glyphFor`.
- `when.ts` — month names, `addDaysTo`, `formatWhen`, `WhenChoice`, `whenToDone`, `whenFromDone`, `isFutureWhen`.
- `lived.ts` — `livedTimeline`, `summariseYear`, `monthLevels`.
- `picks.ts` — `hashSeed`, `pickSeed`, `pickPool`, `picksFor`, `snoozeUntil`, `isSnoozed`.
- `shelf.ts` — `NOW_CAP`, `nowShelf`, `isShelfFull`, `shelfProgress`, `nextStep`, `stepsByItem`.
- `plan.ts` — `TargetChoice`, `targetFor`, `formatTarget`, `targetEnd`, `isTargetPassed`, `moveOptions`, `monthsUntil`, `savingsAdvice`, `describeSavings`.

Data: `api.ts` (new calls), `useBucket.ts` (new hook), `pickPrefs.ts` (AsyncStorage: the day's roll and the card's collapsed state).

Phone components (`app/src/modules/bucket/components/`): `CategoryIcon`, `DoneBar`, `MemoryFields`, `MemorySheet`, `PlanFields`, `ItemSheet` (About / Plan / Memory), `FilterSheet` (+ Want, icons), `PickCard`, `NowShelf`, `SwapSheet`, `MoveSheet`, `YearCard`, `LivedRow`. Screen: `screens/BucketListScreen.tsx`.

Website: `website/src/components/Icon.tsx` (category glyphs, additive block), `website/src/pages/BucketPage.tsx`, new `website/src/pages/bucket/` (`categoryIcon.tsx`, `useBucketPage.ts`, `PickCard.tsx`, `NowShelf.tsx`, `Lived.tsx`, `ItemDialog.tsx`, `MemoryFields.tsx`, `DoneBar.tsx`, `SwapDialog.tsx`), `website/src/styles/components.css` (B-List section at the end), `website/src/pages/Dashboard.tsx` (tile).

Shared/home: `app/src/home/useHomeSummaries.ts` (tile line), `website/src/pages/Dashboard.tsx`.

---

## Tasks

### B1: Plan (this file) — commit.

### B2: Migration `supabase/migrations/0025_bucket_v3.sql`

Adds to `bucket_items` (all `add column if not exists`):
- `memory text not null default ''`, `place text not null default ''`, `again text check (again is null or again in ('yes','maybe','no'))`
- `done_precision text check (done_precision is null or done_precision in ('year','month','day'))`
- `snoozed_until date`
- `focus text check (focus is null or focus in ('now','next'))` — null is Someday
- `target_on date`, `target_precision text check (… in ('year','month','day'))`, guarded named check `bucket_items_target_pair` (`(target_on is null) = (target_precision is null)`)
- `est_cost_minor bigint check (est_cost_minor is null or est_cost_minor >= 0)`, `saved_minor bigint not null default 0 check (saved_minor >= 0)`
- partial index `bucket_items_focus_idx (user_id, focus) where focus is not null`

New `bucket_steps`: `id, user_id, item_id → bucket_items on delete cascade, title (non-blank), is_done, position, created_at, updated_at`; index `(item_id, position)`; `set_updated_at` trigger; four-policy RLS.

Order: needs `0001` (`set_updated_at()`) and `0015` (`bucket_items`). Nothing dropped, renamed or tightened.

- [ ] Write, re-read for syntax/idempotency, commit `Add the B-List v3 schema`.

### B3: Types and the category map

- `types.ts`: new fields and types; `doneStateOf(item)`, `tickedState(today)`, `UNDONE`, `wantOf(item)`; `matchesQuery` also matches `memory` and `place`.
- `categories.ts`: `CATEGORY_GLYPH` for all 61; `glyphFor(category)` (exact, then case-insensitive, else `'flag'`).
- Tests: `categories.test.ts` parses `supabase/migrations/0015a…e` and asserts every seed category has a glyph, that the map has no key outside the seed (typo guard), and the fallback; `progress.test.ts` gains memory/place search and the new fixture fields.

### B4: Dates with honest precision (`when.ts`)

- `formatWhen(iso, precision, { short? })` → `"14 Mar 2019"`, `"Mar 2019"`, `"2019"` (short: `"14 Mar '19"`, `"Mar '19"`). English month abbreviations, day first, no locale dependence.
- `addDaysTo(iso, n)` built from (y, m, d).
- `WhenChoice = today | yesterday | earlier{year, month|null, day|null}`; `whenToDone(choice, today)` → `{ done_on, done_precision }` (year → `Y-01-01`/'year', month → `Y-M-01`/'month'); `whenFromDone(done_on, precision, today)` (round trip); `isFutureWhen(choice, today)`.
- Tests: each precision both ways, yesterday across a month and a DST boundary, future detection for this month/next month/this year.

### B5: Lived timeline (`lived.ts`)

- `livedTimeline(items)` → years newest first; each `{ year|null, items, months: [{ month|null, items }] }`; months newest first, day items by date desc then title, month-precision items after the dated days; `month: null` ("Sometime in …") last in its year; undated done items in a final `year: null` group. Undone items ignored.
- `summariseYear(group)` → `{ count, byCost, months[12], levels[12], topCategories(3), categoriesTouched }`; `monthLevels(counts)` → 0–4 relative to the busiest month (any non-zero month ≥ 1).
- Tests: grouping and order, precision placement, unknown group, summary counts/top-3 tie-break, levels.

### B6: Pick for me (`picks.ts`)

- `hashSeed(text)` (FNV-1a 32-bit), `pickSeed(today, roll)`.
- `pickPool(items, filters, today)` — not done, not snoozed (`snoozed_until > today`), not on Now; honours cost, category, query, want.
- `picksFor(pool, seed, count = 3)` — rank by `hashSeed(seed + '|' + id)`, lowest first.
- `snoozeUntil(today)` (+30 days), `isSnoozed(item, today)`.
- Tests: same seed same picks; input order irrelevant; removing a pick keeps the other two; another day or roll differs; pool rules; fewer than three.

### B7: Now shelf (`shelf.ts`)

- `NOW_CAP = 5`; `nowShelf(items)` (undone Now items, by target end then title); `isShelfFull(items)`; `stepsByItem(steps)`; `nextStep(steps)`; `shelfProgress(item, steps)` → steps done/total, else ₹ saved/estimate, else null, percent never rounding up to 100.
- Tests: cap ignores done Now items, ordering, progress kinds and rounding, next step by position.

### B8: Plan arithmetic (`plan.ts`)

- `TargetChoice = someday | this-year | next-year | month{year,month} | day{iso}`; `targetFor(choice, today)`.
- `formatTarget(on, precision, today)` → `"This year"`, `"2027"`, `"Mar 2027"`, `"14 Mar 2027"`.
- `targetEnd`, `isTargetPassed(on, precision, today)` (a year target passes after 31 Dec; a month after its last day).
- `moveOptions(today)` → Next month (month precision), Next year (year), Someday.
- `monthsUntil(today, on, precision)` (calendar months from this month to the target's month).
- `savingsAdvice({ estMinor, savedMinor, targetOn, targetPrecision, monthlyMinor, today })` → `none | saved | by-target | too-close | by-monthly | to-go`; monthly rounded UP to ₹100; `describeSavings(advice)` → `"₹38,000 to go · ₹3,200 a month reaches it by Oct 2027"`.
- Tests: the spec's own example both directions (target Oct 2027 → ₹3,200; ₹3,200 a month → Oct 2027), rounding, year targets end in December, passed targets, saved in full, no estimate.

### B9: Data layer

- `api.ts`: `listSteps`, `setDoneState(id, state)`, `updateItemFields(id, patch)` (memory, focus, snooze, plan), `swapNow(outId, inId)` (demote first), `addStep`, `updateStep`, `deleteStep`, `restoreStep`, `moveStep(a, b)`; `overview()` gains `nowCount`; `BucketInput`/`createItem` unchanged in shape.
- `useBucket.ts`: items + steps, `load`/`refresh`, `tick` (returns the previous `DoneState`), `restoreDone`, `patch(id, fields)` with per-field rollback, `swapNow`, step actions, `create`, `update`, `remove`.
- `pickPrefs.ts`: `readPickPrefs`, `writePickPrefs` (day + roll + collapsed), never throwing.
- `app/src/home/useHomeSummaries.ts`: `"3 on Now · 469 free"` when the shelf has anything.

### B10: Phone components and screen

- `CategoryIcon` (glyph → Ionicons, `Record` so a missing icon fails `tsc`), used in section headers, filter rows, chips, picks, Now cards, timeline.
- `DoneBar`: floats at `layout.aboveFab`, inverse surface, "Done · today" + Add memory + Undo, ~6 s, announced; hides the toast while shown.
- `MemoryFields` + `MemorySheet`: when (Today / Yesterday / Earlier… → year stepper, month chips, "Just the year", optional day on `MonthCalendar`), what happened, where, do it again (Yes / Maybe / No). All optional.
- `ItemSheet`: About (title, category with suggestions and icon, cost, want, note) / Plan (When, Steps, Money; Now and Next only) / Memory (done only); delete names the cascading steps.
- `PlanFields`: target chips with honest precision, passed target → Move to…, steps (add, tick, hold for move/remove, inline undo), estimate and saved with the money line and the what-if field.
- `FilterSheet`: Want segmented control; category icons.
- `PickCard`: header with pool count and cost chip, Shuffle, three rows (icon, title, cost), tap opens, hold → Now, Not now button; collapsible.
- `NowShelf` + `SwapSheet` + `MoveSheet`: up to five cards (icon, title, target or "Target passed", bar with %, next step); full shelf asks which to swap out.
- `YearCard`, `LivedRow`: the Done view.
- Screen: progress card → Pick for me → Now (To do only) → search/filter → list or timeline; ticking shows the DoneBar; Not now, Now changes and unticks get undo toasts (sheets closed first).

### B11: Website

- `Icon.tsx`: one headed block of category glyphs (24 grid, stroke).
- `pages/bucket/*` + `BucketPage.tsx`: same features with dialogs instead of sheets; the done bar mirrors the phone's; Dashboard tile adds the Now count.
- CSS: a "B-List v3" section appended to `components.css`.

### B12: Final checks and report.

---

## Rulings

- Ruling: the "Done · today · Add memory · Undo" bar is a module-local `DoneBar`, not the core toast — the core toast carries one action and the spec's bar needs two; widening core `Toast` would change a file six builders depend on — cost if wrong: two floating surfaces to keep aligned (the bar copies the toast's position and inverse colours, and hides the toast while it shows).
- Ruling: add `done_precision` (year / month / day; null means day) beyond the spec's data list — a memory backdated to "March 2019" stored as a bare date would later read as 1 March, exactly the fake precision §10 rules out for targets — cost if wrong: one nullable column.
- Ruling: no constraint ties `done_precision` to `done_on` — the v2 app unticks by nulling `done_on` alone, and a paired check would make that update fail while v2 is still installed — cost: a stale precision on an undone row, which every reader ignores while `done_on` is null.
- Ruling: the Now cap of five is enforced in the shared pure logic both clients use, not by a trigger — one person, one rule in one place, and a trigger is SQL nobody here can run — cost if wrong: two devices racing could put six on Now; the shelf then shows all six and the cap applies to the next one.
- Ruling: a swap writes the demotion first, then the promotion — an interruption leaves four on Now rather than six — cost: none.
- Ruling: Pick for me ranks every pool item by a hash of (day, roll, item id) and shows the three lowest — stable all day, independent of fetch order, and ticking or hiding one pick replaces only that one — cost if wrong: none; tested.
- Ruling: the pool excludes done, snoozed and Now items and honours cost, category, search and want; when the screen has no cost filter the card applies its own, defaulting to No/low cost and shown as a removable chip — the research's "defaults to no/low, visibly" — cost: a category with nothing cheap shows an empty card that offers "Any cost".
- Ruling: Shuffle's roll and the card's collapsed state are remembered per device for the day (AsyncStorage; localStorage on the web) — "stable for the day" should survive leaving the screen — cost if wrong: phone and website can show different picks, each stable.
- Ruling: Not now sets `snoozed_until` to today + 30 and only affects picks; snoozed items still appear in the list — "hidden 30 days" is about the suggestion, and hiding them from the list would make them look deleted — cost: none.
- Ruling: the Lived timeline is one newest-first list: each year opens with its year card, months are subheaders, year-precision memories sit in "Sometime in <year>" at the end of their year, undated ones in a final "Date unknown" group; the year card summarises what is shown under it, so it honours filters — cost if wrong: a filtered year card shows a filtered split.
- Ruling: the money line's monthly figure is rounded UP to the next ₹100 and counts calendar months from this month to the target's month (a year target ends in December) — it reproduces the spec's own example (₹38,000 over the 12 months to Oct 2027 → ₹3,200) and never under-saves — cost: up to ₹99 a month more than strictly needed.
- Ruling: with no target, the money section offers an unsaved "try ₹… a month" field that answers "reaches it by <month>" — the spec's data list has no monthly-amount column, and setting a target month is the saved way to get the same sentence — cost: the what-if amount is retyped each time.
- Ruling: Plan (When, Steps, Money) is editable for Now and Next items only; a Someday item's Plan tab offers to move it to Now or Next — "only for items on the Now/Next shelf, so the 818-row list stays light" (research §5.5) — cost: one extra tap to plan a Someday item.
- Ruling: steps save as you go (add, tick, remove, move write at once), while About, Plan and Memory fields save with the sheet's Save — a list edited row by row would otherwise need diffing — and removing a step gets an inline Undo inside the sheet because a toast would draw under it — cost: two save behaviours in one sheet, stated in it ("Steps save as you go").
- Ruling: each category maps to a semantic glyph (`categories.ts`, tested against the seed SQL), drawn with Ionicons on the phone and stroke paths in `Icon.tsx` on the web; both glyph maps are `Record`s, so a missing icon is a type error; a category created later gets the flag — cost: a new category shows a flag until added to the map. Two animal categories share the paw on the phone (Ionicons has no bird); the web draws a feather for falconry.
- Ruling: unticking keeps memory, place and do-again (only the date and its precision clear), and the untick gets an Undo that restores the old date — the memory is the person's own writing and an accidental untick must not erase it — cost: an undone item can carry a memory, shown again once it is done.
- Ruling: tapping a pick or a Now card opens the item; ticking stays on list rows — a pick is a suggestion to look at, and a tap that ticked it would be an easy mistake — cost: none.
- Ruling: the filter sheet gains a Want control (Any / Now / Next / Someday) — "Next is a filterable tier" (research §5.3) — cost: none.
- Ruling: a passed target shows a neutral "Target passed" with Move to… (Next month / Next year / Someday) on the Now card and in the Plan tab, never red — spec §10 — cost: none.
- Ruling: in All, done rows show a filled check, a muted title and a short date ("Mar '26"), with no strikethrough; in Done, the timeline replaces the list — spec §10 — cost: none.
- Ruling: delete stays a confirmation (it is permanent) and names its cascading steps ("Also deletes its 3 steps") — §2's cascade rule — cost: none.
- Ruling: the memory's "Earlier…" picker is a year stepper with month chips and "Just the year", then an optional day on the core `MonthCalendar`; future months and days are disabled — paging a calendar back ten years one month at a time is unusable — cost: none.
- Ruling: the home tile leads with the shelf when it has anything ("3 on Now · 469 free"), otherwise the v2 line — what you said you are doing next is the actionable fact — cost: none.
- Ruling: tests run with a private `--cacheDirectory` — seven builders share `%TEMP%\jest`, and parallel runs collided there (EPERM on rename), which is the environment, not the code — cost: none.
- Ruling: on the phone, cost is marked by one, two or three bars as well as colour (`CostMark`), replacing the coloured dot — a dot is colour alone, which §2 forbids, and a word on each of 818 rows is noise — cost: a new mark to learn; the progress card's legend uses the same bars beside the words.
- Ruling: the website puts Pick for me and the Now shelf in a side rail beside the list (above it under 1180px) — a monitor can show the choosing and the list at once, which is the desktop's reason to exist — cost: none.
- Ruling: the website's memory and target pickers use a year `<select>` plus month chips, and `<input type="date">` for a day — the browser's own controls are faster with a keyboard than the phone's decade grid — cost: the two clients' pickers look different, over the same rules.
- Ruling: the website's category filter stays a native `<select>` without icons — option elements cannot hold SVG, and replacing the shared FilterBar for one page is out of scope — icons appear in the section headings, picks, Now cards, timeline and the category field instead — cost: the filter list is text-only on the desktop.
- Ruling: `api.setDone` and `api.updateItem` are removed — every write now goes through `patchItem`, so a tick, an edit and an Undo share one path; nothing else called them — cost: none (checked across app and website).
- Ruling: the 62 website glyphs are generic names (`heart`, `clock`, `camera`…) in one headed block of `Icon.tsx`, each rendered at 16 and 48 px and inspected before committing — other pages may want the same icons — cost: a merge may meet another builder's icon of the same name, which TypeScript reports as a duplicate key.
