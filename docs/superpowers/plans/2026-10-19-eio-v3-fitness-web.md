# Fitness v3 — website (F18) plan

**Goal:** bring the desktop website's Fitness page to parity with the phone on the v3 model (spec §4, §4.9): the same data, the same rules from `app/src/modules/fitness/*`, laid out as the planning and analysis surface — routine and ladder building, the month calendar, a year heatmap, charts and records — with a logging view that mirrors the phone's set table.

**Builds on:** F1–F17 (done on `v3`). No migration: `0019_fitness_v3.sql` covers everything.

**Branch / worktree:** `v3-fitness-web` in `D:\Projects\eio-v3-fitness-web`.

## File map

New pure logic in the app (each with `__tests__/<name>.test.ts`), for rules the website needs that the phone does not have yet:

- `app/src/modules/fitness/heatmap.ts` — `yearGrid(today, weeks = 53, weekStartsOn = 1)` (rows = weekdays, columns = weeks, today in the last column), `heatmapDays(sessions, setRows)` (per day: working sets, sessions, gym/calisthenics), `heatLevel(sets, max)` (0–4), `monthStarts(grid)` (which column each month label sits over).
- `app/src/modules/fitness/ladderHistory.ts` — `ladderPositions(steps, moves)` (rung number over time, one point per day, for the step chart), `bestAttempt(step, sessions)` (the phone's "8 · 7 · 6", moved out of `LadderScreen` so both clients can share it), `moveTimeline(ladders, limit)` (latest moves up across ladders).
- `app/src/modules/fitness/bands.ts` — `BAND_COLOURS` (the eight physical band colours, data not theme), `parseBandKg(text)` (the "approx kg is required" rule from `BandsScreen`).

Additive data call in `app/src/modules/fitness/api.ts`:

- `listSetDaysBetween(start, end)` — `{ session_id, date, set_type }[]` for every set in sessions dated in [start, end], paged past PostgREST's 1,000-row cap. Feeds the heatmap and the session list's set counts.

Website, replacing the 1,695-line v2 page:

- `website/src/pages/FitnessPage.tsx` — one-line re-export (App.tsx keeps its lazy import).
- `website/src/pages/fitness/FitnessPage.tsx` — Shell, Gym | Calisthenics switch, tabs, and which sub-view is open (URL search params).
- `useFitnessMode.ts` — the mode, remembered per browser (`localStorage`, key from `mode.ts`).
- `useSessionLog.ts` — the website's session hook: the phone's `useWorkoutSession` wiring over the same pure rules (no rest timer).
- `useLadderCards.ts` — ladders with rung states, progress and readiness (the phone's `useLadders` composition).
- `LogView.tsx`, `YearHeatmap.tsx`, `TrainingCalendar.tsx` — streak, rest days, calendar, heatmap, session list and its menu, starting a session.
- `SessionView.tsx`, `SetTable.tsx`, `SessionDialogs.tsx` — the set table, block header/menu, load and set menus, pickers.
- `SummaryView.tsx` — finish summary, deviation and level-up prompts.
- `RoutinesView.tsx`, `RoutineEditor.tsx` — routine list and builder.
- `SkillsView.tsx`, `LadderDetail.tsx`, `LadderEditor.tsx` — ladders.
- `ExercisesView.tsx`, `ExerciseDetail.tsx` — library and an exercise's page.
- `BodyView.tsx` — weigh-ins, height/BMI, measurements, bands, plate note.
- `Menu.tsx`, `ExercisePicker.tsx`, `charts.tsx`, `format.ts` — local building blocks.
- `fitness.css` — the page's styles.

Shared files touched: `website/src/components/Icon.tsx` (additive icons), `app/src/modules/fitness/api.ts` (one appended function). Nothing else shared.

## Tasks, in build order

### W1 — Pure rules the website needs (TDD)
- `heatmap.test.ts`: grid is 7 rows × 53 columns, last column holds today, rows start on Monday (and Sunday with `weekStartsOn = 0`), dates built from (y, m, d) so a DST change does not skip or repeat a day, future days are marked; `heatmapDays` counts working sets only and marks modes; `heatLevel` is 0 for none and 1–4 by share of the maximum; `monthStarts` puts each month over the first column whose week holds its 1st.
- `ladderHistory.test.ts`: positions follow moves in date order, one point per day (last move wins), moves to removed rungs are skipped; `bestAttempt` picks the session closest to the goal and lists its top sets; `moveTimeline` is newest first and limited.
- `bands.test.ts`: colours unique by name and hex; `parseBandKg` accepts 0 < kg < 200 with a comma decimal, rejects blank/zero/negative/huge.
- Commit: `Add the pure rules the website's Fitness page needs`.

### W2 — Data call
- `listSetDaysBetween` in `api.ts` (appended, own section). Verify: app tsc/eslint/jest, website tsc.
- Commit with W1 or alone: `Page through a year of sets for the heatmap`.

### W3 — Page shell, mode, Log tab
- Re-export, shell, mode switch, tabs in the URL, `LogView` with streak/rest days, heatmap, calendar, session list + menu (Repeat today · Save as routine · Delete with confirm), start freestyle or from a routine of the current mode, on today or a picked day.
- Commit: `Rebuild the Fitness page around the v3 model`.

### W4 — Session view
- `useSessionLog` + set table: SET · PREVIOUS · LOAD · REPS|TIME · ✓; W/F/D; RPE and clean in the set menu; ghosts from `ghostValues` + `nextTarget` with the reason shown; tick saves, untick restores a draft, remove with Undo; record toast + medals (`sessionRecords`, `primaryRecord`); bodyweight load dialog (+kg / assistance / band); L/R rows; supersets (A1/A2) from the block menu; reorder/replace/remove (confirm when sets exist); rest time; block note; pinned note; session notes; date. Enter in a row's last field ticks it.
- Commit: `Log sessions on the website with the phone's set table`.

### W5 — Finish and summary
- Workout #N, stat grid, records, vs last time of the routine, deviation + Update routine, level-up prompts (Move up with Undo, Not yet), Reopen.
- Commit: `Add the finish summary to the website`.

### W6 — Routines
- List filtered by mode with slots shown, Start, Delete (confirm); builder with exercise or ladder slots, reps or seconds ranges, rest, increment, superset letter; new routines take the current mode.
- Commit: `Build routines with ladders, ranges and supersets on the website`.

### W7 — Skills
- Ladders by family with step label and progress ring, ready/paused badges, steps-mastered count and timeline; ladder detail (rungs mastered/current/locked with dates, goal · best, Move up / Step back with Undo, make any rung current, Pause, Delete with confirm, moves history, position step chart); ladder editor (`saveLadder`, confirm when rungs are removed).
- Commit: `Add ladders to the website`.

### W8 — Exercises
- Library filtered by mode, region chips, add (weights/bodyweight, reps/time, muscle, mode defaults), delete; exercise detail: metric and range chips, chart with click-for-sets, history by session, records + rep-max table, How-to/advanced form saved with `updateExercise`.
- Commit: `Add the exercise page to the website`.

### W9 — Body
- Weigh-ins (chart, today's, history with Undo delete), height/BMI, measurements (latest + change with arrow and word, add form with every site, chart per site, days with Undo delete), bands (list/add/delete, approx kg required), plate inventory note.
- Commit: `Track measurements and bands on the website`.

### W10 — Verify
- All six checks; read every new file once more for a11y (roles, labels, never colour alone), tokens (no raw hex), reduced motion.

## Rulings

- Ruling: the website has its own session hook (`useSessionLog`) rather than importing the phone's `useWorkoutSession` — any app file that imports React resolves `react` from `app/node_modules`, so the bundle would carry a second React and hooks would break; every rule the hook calls is the app's own pure code — cost if wrong: a change to the phone hook's wiring has to be mirrored here.
- Ruling: sub-views (a session, its summary, an exercise, a ladder) and the tab live in the URL's search params (`#/fitness?session=…`) instead of new routes — no change to the shared `App.tsx`, and Back and refresh behave — cost if wrong: none; a route can replace it later.
- Ruling: the page's styles are in `pages/fitness/fitness.css`, imported by the page, not appended to `components.css` — seven branches appending to the end of one file would collide at merge, and this stylesheet loads with the Fitness chunk only — cost if wrong: a cut and paste into `components.css`.
- Ruling: no rest timer and no hold dial on the website — it is the planning surface (§4.9); a block's rest is still set and stored, and holds are typed in seconds — cost if wrong: someone logging at a desk gets no rest countdown.
- Ruling: heatmap intensity is `ceil(4 × sets / max)` over the shown year, drawn as colour AND the size of the square, with a text label per cell and a legend in words — never colour alone; a day with a session but no working sets is level 0 but still labelled — cost if wrong: one huge day flattens the rest of the year into level 1–2.
- Ruling: RPE and the clean flag live in the set menu (as on the phone) and show in the SET cell as "RPE 8" / "not clean"; the reps (or seconds) field stays the row's last field, so Enter there ticks the row and moves focus to the next draft row — cost if wrong: one extra click to set RPE.
- Ruling: the block menu, rest menu, start menu, ladder menus and session-row menu are non-modal popover menus (`Menu.tsx`, keyboard-navigable, drawn `position: fixed` so a card cannot clip them); the set menu is a dialog like the phone's sheet (type, RPE, clean, Remove), and Remove closes it before the "Set removed · Undo" toast shows. No dialog raises a toast while open — cost if wrong: none.
- Ruling: "Add warm-up sets" on the website uses the app's `DEFAULT_INVENTORY` (20 kg bar, standard plates) and says so in the menu, since the real inventory is on the phone — cost if wrong: a warm-up 1.25 kg off what your own plates make.
- Ruling: the session list's working-set counts come from the same year of rows as the heatmap, so sessions older than 53 weeks are listed without a count — cost if wrong: an older row shows less detail.
- Ruling: the heatmap is mode-agnostic (one log, one accent); modes are told apart on the month calendar (gym a dot, calisthenics a diamond, both spoken in the day's label) and on every session row (icon and word) — cost if wrong: none.
- Ruling: Enter in a row's last field ticks it and focus moves to the next row's weight (or reps, for bodyweight, skipping the load chip); in a superset it moves to the partner's next set, mirroring the phone's scroll — cost if wrong: one Tab.
- Ruling: deleting a weigh-in or a measurement day is undoable (Undo re-saves the same values for the same day) rather than confirmed — both are upserts on (user, date), so restoring is exact apart from the row id — cost if wrong: none visible.
- Ruling: deleting a band is confirmed, as on the phone — sets keep their assistance but lose the band link (`on delete set null`), and a re-created band would be a different row — cost if wrong: one extra click.
- Ruling: band colours (`BAND_COLOURS`) move into a pure app file so the website shows the same eight; `BandsScreen` still has its own copy (screens are out of my scope) — the lead can point it at `bands.ts` — cost if wrong: the two lists drift until that one-line change.
- Ruling: `bestAttempt` moves into `ladderHistory.ts` for the same reason; `LadderScreen` keeps its local copy until the lead points it here — cost if wrong: as above.
- Ruling: the year's sets are read with `listSetDaysBetween`, which pages in 1,000-row chunks — a year of training is several thousand sets and PostgREST silently truncates at its row cap, which would make the heatmap quietly wrong — cost if wrong: a few extra round trips for a heavy year.
- Ruling: plate inventory stays phone-only (spec §4.8: "stored on the device"); the Body tab says so in a read-only note — cost if wrong: none.
- Ruling: family labels, equipment labels, RPE and rest options are redefined in `pages/fitness/format.ts` — they live in phone screens or in `useLadders.ts` (which imports React), and they are vocabulary, not rules — cost if wrong: a renamed label on one client only.

## Verification

- App: `tsc --noEmit`, `eslint src App.tsx`, `jest` (the three new suites: 27 tests). Website: `tsc -b`, `eslint src`, `vite build`; the Fitness chunk carries no second React.
- A throwaway smoke harness (kept out of the repo) bundled the real page with esbuild, swapped `api.ts` for an in-memory fake with v2-shaped rows, and drove it in jsdom: 99 checks across every tab - heatmap keyboard grid, starting sessions, ghost ticks by Enter, record toast and medal, untick, set types, remove with Undo, rest, supersets and partner focus, replace, one-sided rows, pinned note, confirm before removing logged sets, notes, finish and summary (deviation, Update routine, level-up with Undo), Repeat / Save as routine / Delete, routine and ladder editors with their checks, exercise detail and how-to save, mode switch remembered, ladder move with Undo and pause, weigh-in Undo, measurements with range checks, bands - with no React errors.
- Not verified: anything against the real database (RLS, the paged heatmap read, PostgREST embedded filters), real browser layout in light and dark, and screen-reader output.

## For the lead

- `BandsScreen` keeps its own `BAND_COLOURS` and `LadderScreen` its own `bestAttempt`; both now exist in `bands.ts` / `ladderHistory.ts` and the screens can import them (I did not touch app screens).
