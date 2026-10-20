# Fitness v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make EIO's Fitness module Hevy-grade, with a Gym and a Calisthenics mode over one data model — spec §4 in full, on the phone and the website.

**Architecture:** One migration (`0019_fitness_v3.sql`) adds everything the four phases need. The training rules (load, records, previous-set matching, rest and hold timers, ladders, targets, streaks, plates, summaries) are pure TypeScript files in `app/src/modules/fitness/`, each with tests, shared by both clients. `api.ts` is the only database code. Screens are rebuilt around a session that is persisted block by block (`session_exercises`) and saved set by set.

**Tech Stack:** Expo SDK 57 / RN 0.86 / React 19 (app), Vite + React (website), Supabase Postgres, Jest. Native: `expo-keep-awake`, `expo-speech`, `expo-haptics` (via `core/haptics`), `react-native-gesture-handler` (row swipe), core notifications (rest end).

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §4 (binding), §2 (ground rules), §3 (foundation APIs). Evidence: `docs/research/fitness-hevy.md`, `fitness-gym-trackers.md`, `fitness-calisthenics.md` (§5 data model, §6 UI patterns, §7 coexistence).

## Global Constraints

- Every §2 rule: 48dp targets; never colour alone; Ionicons / `Icon.tsx` only; one gesture per region (row swipe-to-delete is allowed **only** inside the session screen, which is not in the tab pager, and "Remove" in the set-type sheet is its non-swipe route); undo for reversible, confirm for permanent; semantic tokens; tabular figures for every number column and timer; a11y labels; light + dark.
- `weight_kg` stays ≥ 0 and means *added* load on bodyweight exercises; assistance is `assist_kg` (> 0). Never store a signed weight.
- Records are computed, never stored. First set at a measure is not a record; strictly greater; the current session is excluded from the *baseline*.
- Save-as-you-go is kept: ticking a set writes it immediately; Finish never gates saving.
- Migration is idempotent, adds only, and relaxes (never tightens) constraints the v2 app relies on.
- Website reuses `@app/modules/fitness/*` logic; no rule is implemented twice.
- Both clients' checks after every task: app `tsc`, `eslint src App.tsx`, `jest`; website `tsc -b`, `eslint src`, `vite build`.

## Review Focus

1. **Bodyweight records** — a bodyweight rep record must fire (10 → 11 pull-ups at +0), an assisted set must not outrank an unassisted one, and the first set at a new load is not a record. Tested in F2.
2. **Reopening a session** — an exercise added but not logged, block order, notes, rest and badges must all survive leaving and reopening. Tested in F3/F4 (pure block assembly + record recompute).
3. **Timers across background and lock** — rest and hold timers are computed from timestamps, so a backgrounded app shows the right time on return; the rest-end notification is cancelled when the timer is skipped or changed. Tested in F5/F10 (pure timer maths).
4. **Untick / delete / undo races** — unticking a saved set, then ticking again, must not duplicate; deleting a row with undo restores the same values. Tested in F4 (row state reducer).
5. **Old data** — sessions and sets written by v2 (no `set_type`, no `session_exercises` for a session created after the migration by v2, null `started_at`) render and compute correctly. Tested in F2/F4 with v2-shaped fixtures.

---

## File map

New pure logic (each with `__tests__/<name>.test.ts`):
- `fitness/model.ts` — v3 row types (`SetType`, `LoadMode`, `Discipline`, `Equipment`, `FitnessMode`, `SessionExercise`, `Band`, `Progression`, `ProgressionStep`, `ProgressionMove`, `BodyMeasurement`) and the v3 fields on `Exercise`, `SessionSet`, `WorkoutSession`, `Routine`, `RoutineExercise` (extended in `types.ts`).
- `fitness/load.ts` — effective load, net load, working-set volume, set labels, display strings.
- `fitness/records.ts` — records by exercise type; per-session recompute.
- `fitness/previous.ts` — previous-set matching and ghost values.
- `fitness/blocks.ts` — assembling session blocks (saved sets + draft rows) and the row state reducer.
- `fitness/restTimer.ts`, `fitness/holdTimer.ts` — timestamp-based timer maths and cue schedule.
- `fitness/progression.ts` — rung states, goal checks, level-up readiness, goal progress.
- `fitness/targets.ts` — next-session targets (double progression).
- `fitness/streak.ts` — weekly streak, rest days, training-day map.
- `fitness/summary.ts` — finish summary, deltas vs last time, routine deviations.
- `fitness/plates.ts` — plate and warm-up calculators.
- `fitness/exerciseStats.ts` — chart series by metric, rep-max table.
- `fitness/measurements.ts` — body measurement sites and latest values.
- `fitness/mode.ts` — mode filters and defaults.

Modified: `fitness/types.ts` (extended types, keep existing exports), `fitness/api.ts`, `fitness/useFitness.ts`, `fitness/useWorkoutSession.ts`, all fitness screens and components, `navigation/types.ts` + `RootNavigator.tsx` (new routes), `website/src/pages/FitnessPage.tsx` (split into `website/src/pages/fitness/*`).

New screens/components (app): `WorkoutSessionScreen` (rebuilt), `WorkoutSummaryScreen`, `ExerciseDetailScreen` (replaces `ExerciseProgressScreen`), `LadderScreen`, `LadderEditScreen`, `ExerciseEditScreen` (Advanced fields), `PlateCalculatorScreen`; components `SetTable`, `SetRow`, `SetTypeSheet`, `RpeSheet`, `BlockMenu`, `RestBar`, `HoldDial`, `LoadChips`, `BandsSheet`, `ModeSwitch`, `SkillCard`, `TrainingCalendar`, `LineChart` (react-native-svg).

---

## Phase A — data and rules

### F1: Migration `0019_fitness_v3.sql`

**Files:** Create `supabase/migrations/0019_fitness_v3.sql`.

Adds (all `if not exists`, guarded):
- `exercises`: `discipline text not null default 'gym' check in ('gym','calisthenics','both')`; `load_mode text not null default 'external' check in ('external','bodyweight')`; `bodyweight_factor numeric(3,2) not null default 1.00 check (> 0 and <= 1.50)`; `equipment text null check in (none, barbell, dumbbell, kettlebell, machine, cable, band, pull_up_bar, rings, dip_bars, parallettes, other)`; `is_unilateral boolean not null default false`; `default_rest_seconds integer null check (between 0 and 900)`; `pinned_note text not null default ''`; `instructions text not null default ''`.
- Backfill (guarded, re-run safe, word-boundary regex written as `~*` with `\m…\M`): bodyweight + `discipline='both'` for pull-up, chin-up, dip, push-up, muscle-up, pistol, inverted row, hang, L-sit, plank, handstand, lever, planche, burpee, sit-up, crunch, leg raise, knee raise, bodyweight squat, lunge only if name contains "bodyweight"; `bodyweight_factor = 0.65` for push-up variants, `0.70` pike push-up; equipment guesses (barbell for bench/squat/deadlift/overhead press/row with "barbell", dumbbell for "dumbbell"/"db", pull_up_bar for pull-up/chin-up/hang, dip_bars for dip, cable for "cable"/"pushdown", machine for "machine"/"press" with "leg").
- `bands` (new): `id, user_id, label text not null, color text not null, approx_kg numeric(5,1) null check (> 0), position int not null default 0, created_at`. RLS four-policy.
- `session_sets`: `set_type text not null default 'normal' check in ('normal','warmup','failure','drop')`; `assist_kg numeric(6,2) null check (> 0)`; `band_id uuid null references bands on delete set null`; `side text null check in ('left','right')`; `clean boolean not null default true`. Replace `session_sets_reps_check` with `reps is null or reps > 0 or (reps = 0 and set_type = 'failure')` (relaxes; the xor check is unchanged).
- `workout_sessions`: `mode text not null default 'gym' check in ('gym','calisthenics')`; `started_at timestamptz null`; `ended_at timestamptz null`; `bodyweight_kg numeric(5,2) null check (> 0 and < 500)`.
- `session_exercises` (new): `id, session_id → workout_sessions on delete cascade, exercise_id → exercises on delete cascade, user_id, position int not null default 0, rest_seconds int null check (between 0 and 900), note text not null default '', superset_group text null, created_at`; `unique (session_id, exercise_id)`; index `(session_id, position)`. RLS. **Backfill**: one row per (session, exercise) present in `session_sets`, position by first `created_at`, `on conflict do nothing`.
- `routines`: `mode text not null default 'gym' check`.
- `routine_exercises`: `exercise_id` drop not null; `progression_id uuid null → progressions on delete cascade`; check `num_nonnulls(exercise_id, progression_id) = 1` (named, guarded); `target_reps_min int null`, `target_seconds_min int null`, `target_seconds_max int null`, `rest_seconds int null`, `pair_group text null`, `increment_kg numeric(4,2) null check (> 0)`.
- `progressions` (new): `id, user_id, name, family text not null default 'other' check in ('push','pull','legs','core','balance','statics','other'), current_step_id uuid null, position int, level_up_rule text not null default 'two_of_three' check in ('two_of_three','one'), paused_at timestamptz null, notes text default '', created_at, updated_at` + updated_at trigger. `progression_steps` (new): `id, progression_id → progressions on delete cascade, user_id, exercise_id → exercises on delete restrict, position int, goal_sets int not null default 3 check > 0, goal_reps int null, goal_seconds int null, goal_added_kg numeric(5,2) null, start_reps int null, start_seconds int null, cue text default ''`, check `num_nonnulls(goal_reps, goal_seconds) = 1`. Then `progressions.current_step_id → progression_steps on delete set null` (guarded). `progression_moves` (new): `id, progression_id → cascade, user_id, from_step_id → set null, to_step_id → cascade, kind text check in ('start','up','back'), date date not null default current_date, session_id → workout_sessions on delete set null, note text default '', created_at`. RLS on all three.
- `body_measurements` (new): `id, user_id, date date not null, neck, shoulders, chest, waist, hips, arm_left, arm_right, forearm_left, forearm_right, thigh_left, thigh_right, calf_left, calf_right` (each `numeric(5,1) null check (> 0 and < 300)`), `body_fat_pct numeric(4,1) null check (> 0 and < 75)`, `created_at, updated_at`, `unique (user_id, date)`. RLS.

- [ ] Step 1: write the file. Step 2: re-read for syntax and idempotency (every `add column if not exists`, every constraint in a `do $$ … if not exists (select from pg_constraint …)` block, every policy dropped before created). Step 3: commit `Add the Fitness v3 schema`.

### F2: Model, load and records

**Files:** Create `fitness/model.ts`, `fitness/load.ts`, `fitness/records.ts`, tests `load.test.ts`, `records.test.ts`. Modify `fitness/types.ts` (extend `Exercise`, `SessionSet`, `WorkoutSession`, `Routine`, `RoutineExercise`, `SetInput` with the F1 fields; keep every existing export).

**Interfaces (produces):**
- `type SetType = 'normal' | 'warmup' | 'failure' | 'drop'`; `type LoadMode = 'external' | 'bodyweight'`; `type FitnessMode = 'gym' | 'calisthenics'`.
- `type SetFact = { exercise_id: string; session_id: string; set_type: SetType; reps: number | null; duration_seconds: number | null; weight_kg: number; assist_kg: number | null; created_at: string }` — what record and progression maths read (v2 rows: `set_type` missing → `'normal'`, via `toSetFact(row)`).
- `netLoad(set): number` = `weight_kg − (assist_kg ?? 0)` (signed, kg; the *comparison* load for bodyweight exercises).
- `effectiveLoad(set, exercise, bodyweightKg: number | null): number | null` — external: `weight_kg`; bodyweight: `bodyweightKg * factor + netLoad`, or `null` without a bodyweight.
- `isWorking(set): boolean` — not a warm-up.
- `workingVolume(sets, exercisesById, bodyweightKg): number` — Σ reps × load over working rep sets; bodyweight exercises use `effectiveLoad` when a bodyweight is known, else `netLoad` clamped at 0; rounded to 0.1.
- `setLabels(sets: {set_type}[]): string[]` — `'W' | 'F' | 'D'` or the running count of normal sets ("1", "2", …).
- `formatLoadChip(set, exercise, bandLabel?): string | null` — bodyweight: `+10`, `−20`, `Red band`, `null` when unloaded; external: `null`.
- `formatSetShort(set, exercise, bandLabel?): string` — "60 × 8", "× 12", "0:45", "8 · +10", "22s · −20", "22s · Red band".
- `records.ts`: `type RecordKind = 'heaviest' | 'repsAtWeight' | 'e1rm' | 'setVolume' | 'reps' | 'load' | 'hold'`; `type RecordHit = { kind: RecordKind; value: number; previous: number; label: string }`; `detectRecords(exercise, baseline: SetFact[], earlierThisSession: SetFact[], candidate: SetFact): RecordHit[]`; `sessionRecords(exercisesById, baselineByExercise: Record<string, SetFact[]>, sessionSets: SetFact[] /* in logged order */): Record<setId, RecordHit[]>`.

**Rules** (spec §4.6): warm-ups never count (as candidate or baseline). Baseline must contain a comparable set or it is not a record. Strictly greater than the baseline best AND strictly greater than the best of `earlierThisSession` for that kind (so a record is announced once per session, on the set that first sets it — recompute on open is the same function, so badges match). External rep sets: heaviest (max weight, any reps), repsAtWeight (max weight at the same reps — existing rule), e1rm (Epley, reps ≤ 12 only, label "Est. 1RM"), setVolume (w × r). Bodyweight rep sets: reps = more reps than any baseline set with `netLoad ≥ candidate's`; load = higher `netLoad` than any baseline set with `reps ≥ candidate's` (label "Less assistance" when the candidate is assisted, "+kg" otherwise; never fires at net 0 vs net 0). Holds (time, either load mode): hold = longer than any baseline hold with `netLoad ≥ candidate's`. A failure set with 0 reps is never a record.

- [ ] Step 1: tests — `load.test.ts`: effective load for external / bodyweight with and without bodyweight; push-up factor 0.65; volume excludes warm-ups and holds; v2 row without set_type counts as normal; set labels `W,1,2,F,D,3`; short formats for all six shapes. `records.test.ts`: 10 → 11 pull-ups at +0 fires `reps`; 8 @ +10 with no history at ≥ +10 does not fire; 9 @ +10 after 8 @ +10 fires `reps`; assisted 10 @ −20 after 10 @ −30 fires `load` "Less assistance"; assisted set does not fire `reps` over an unassisted baseline with more reps; the existing "heaviest at same reps" cases still pass; e1rm ignores 15-rep sets; warm-up candidate never fires and warm-up baseline is ignored; two sets beating the baseline in one session → only the first gets the hit, a third that beats both gets it too; hold 31s after 30s fires, 31s with +0 after 35s at −10 does fire? (no: baseline hold with net ≥ 0 required — the −10 hold is easier, so baseline empty → no record); `sessionRecords` over a fixture equals per-set `detectRecords` replay.
- [ ] Step 2: run → FAIL (modules missing). Step 3: implement. Step 4: run → PASS, full suite. Step 5: commit `Judge records by exercise type, so bodyweight records can fire`.

### F3: Data layer

**Files:** Modify `fitness/api.ts`; create `fitness/__tests__/blocks.test.ts` (pure part), `fitness/blocks.ts`.

**Interfaces (produces):**
- api (all throw on error, owner stamped here): `getSession(id)`, `startSession({ date, mode, routine_id })` — inserts the session with `started_at = now()` and `bodyweight_kg` = latest weigh-in on or before `date`, then inserts `session_exercises` from the routine (ladder slots resolved to the ladder's current step's exercise; position and rest copied), returns the session; `finishSession(id)` (stamps `ended_at`); `reopenSession(id)` (clears `ended_at`); `listSessionExercises(sessionId)`; `addSessionExercise(sessionId, exerciseId, position, rest)` (upsert on `(session_id, exercise_id)`); `updateSessionExercise(id, patch)`; `removeSessionExercise(id)` (and its sets, after a confirm in the UI when sets exist); `reorderSessionExercises(rows: {id, position}[])`; `addSet(sessionId, input: SetInput)` with all v3 fields; `updateSet(id, patch)`; `deleteSet(id)`; `listPreviousSets(exerciseIds, beforeSessionId)` → for each exercise, the sets of the most recent *other* session containing it (by session date, then created_at), plus that session's date; `listBaseline(exerciseIds, excludeSessionId)` → `SetFact[]` per exercise (all other sessions); bands CRUD (`listBands`, `saveBand`, `deleteBand`); `updateExercise` accepting the F1 fields.
- `blocks.ts`: `type DraftRow = { key: string; set_type: SetType; reps: string; seconds: string; weight: string; assist: string; band_id: string | null; side: 'left' | 'right' | null; rpe: number | null; clean: boolean }`; `type Row = { kind: 'saved'; set: SessionSet } | { kind: 'draft'; draft: DraftRow }`; `assembleBlocks(sessionExercises, sets, exercisesById): Block[]` — blocks in `position` order; **any exercise with sets but no `session_exercises` row (v2 wrote it) is appended in first-logged order**, so nothing logged is ever hidden; `initialDrafts(block, { routineTargetSets, previousSets }): DraftRow[]` — as many draft rows as the routine's target sets (else last time's working-set count, else 1) minus saved normal sets, at least one when nothing is saved.

- [ ] Step 1: tests for `assembleBlocks` (order by position; v2 orphan sets appended; an added-but-unlogged exercise present with zero sets) and `initialDrafts` (routine target 3 with 1 saved → 2 drafts; no routine, last time 4 working → 4; brand new → 1). Step 2: FAIL. Step 3: implement `blocks.ts` and the api. Step 4: PASS + suite + both clients' tsc. Step 5: commit `Persist each session's exercises, so an unlogged exercise survives reopening`.

---

## Phase B — the logging loop (phone)

### F4: Session hook

**Files:** Rewrite `fitness/useWorkoutSession.ts`; extend `blocks.ts` with `rowReducer`; tests in `blocks.test.ts`.

**Interfaces:** `useWorkoutSession(sessionId)` returns `{ session, blocks: BlockView[], bands, stats: { durationMs, volume, sets }, records: Record<setId, RecordHit[]>, previousByExercise, loading, error, tick(blockId, rowKey), untick(setId), updateDraft(blockId, rowKey, patch), addRow(blockId, type?), removeRow(blockId, rowKey | setId) → returns an undo fn, setRowType(...), setRpe(...), addExercise(id), removeExercise(blockId), moveExercise(blockId, delta), setRest(blockId, seconds), setBlockNote(...), setSuperset(...), finish(), reopen(), setDate, saveNotes }`. `BlockView = { id, exercise, rows: Row[], restSeconds, note, supersetGroup, ghostFor(rowIndex) }`.

**Rules:** Tick commits a draft (empty cells take their ghost values; a row with neither value nor ghost does not tick and says why), saves, then runs `detectRecords` against the loaded baseline and the earlier sets of this session, then reports `{ records, restSeconds }` to the screen (which starts the rest bar and shows the toast). Optimistic: the row shows as saved immediately with a pending flag; on failure it reverts to its draft with the same values and an error. Untick deletes the saved set and puts its values back as a draft in the same position. Records are recomputed from scratch on load (`sessionRecords`), so badges survive a reload. `rowReducer` holds the pure state transitions (`tickStart`, `tickSaved`, `tickFailed`, `untick`, `remove`, `restore`) and is what the tests exercise.

- [ ] Tests: tick→saved replaces the draft at the same index; tick failure restores identical values; untick → draft with the set's values at the set's index; remove then restore returns the row to its index; double tick on the same draft key is ignored while pending (Review Focus 4). FAIL → implement → PASS → commit `Rebuild the session hook around saved and draft rows`.

### F5: Rest timer

**Files:** Create `fitness/restTimer.ts` + test, `fitness/components/RestBar.tsx`; delete `components/RestTimer.tsx` once unused.

**Interfaces:** `type RestState = { endsAt: number; totalMs: number; exerciseId: string } | null`; `startRest(now, seconds, exerciseId)`, `adjustRest(state, now, deltaSeconds)` (never below 0; extending a finished timer restarts from now), `remainingMs(state, now)`, `isFinished(state, now)`. `RestBar` props `{ state, onAdjust, onSkip, onFinished }`: floating card above the bottom inset — thin progress line, `−15 · m:ss · +15 · Skip` (48dp each), tabular numerals, live-region announcement only at end. It ticks with a 250 ms interval while mounted and computes from `endsAt` (so backgrounding is harmless). On start/adjust it (re)schedules a core notification `fitness-rest` at `endsAt` (channel `{ id: 'fitness-rest', name: 'Rest timer' }`), cancels it on skip/finish/unmount-with-no-timer; on reaching zero in the foreground: `haptics.warning()`; the notification supplies the sound. No rest before a drop set (the hook passes `restSeconds = 0` when the next row is a drop set).

- [ ] Tests: remaining after start; adjust +15 / −15; −15 below zero clamps to 0 and is finished; +15 on a finished timer restarts from now; finished exactly at endsAt (Review Focus 3). → commit `Add a rest bar that keeps time from timestamps`.

### F6: Session screen

**Files:** Rewrite `screens/WorkoutSessionScreen.tsx`; create `components/SetTable.tsx`, `SetRow.tsx`, `SetTypeSheet.tsx`, `RpeSheet.tsx`, `BlockMenu.tsx`, `LoadChips.tsx`.

**Behaviour (spec §4.4):** full-screen route; `useKeepAwake()` while mounted (`expo-keep-awake`, read the v57 page first). Header strip pinned under the nav header: Duration (from `started_at`, else first set) · Volume · Sets, and a compact **Finish** button (→ F7). Each block: name in `primary` (tap → exercise detail), `⋮` (BlockMenu: Reorder up/down · Replace · Superset with… · Add warm-up sets · Rest time · Remove), pinned note row (pin icon), a one-line block note field, rest chip ("Rest 2:00", tap → choose 0:30–5:00 or Off; saved to the block and remembered on the exercise as `default_rest_seconds`), level chip for ladder exercises (Phase C). Set table header `SET · PREVIOUS · LOAD · REPS|TIME · ✓`, rows ~48dp, zebra striping with `glass` alternate, tabular numerals. SET cell: label from `setLabels` (W amber `warning`, F `danger`, D `info`, medal icon + number when the set has a record); tap → SetTypeSheet (W · 1 · F · D · RPE · Remove). PREVIOUS: muted `formatSetShort` of the matching set; tap copies its values into the row. LOAD cell: external → kg input; bodyweight → `LoadChips` (tap opens a small sheet: Added kg / Assistance kg / Band / Side / Clean). Value cell: reps or seconds input, ghost values as placeholders (`textFaint`). ✓: 48dp, ticked rows tinted `completed` with a check icon (not colour alone). Swipe left on a row (gesture-handler `ReanimatedSwipeable`) reveals Delete; deleting shows "Set removed · Undo". "+ Add set" under each table. Record → toast "New record · Heaviest 100 kg" + `haptics.success()`; tick otherwise → `haptics.tap()`. Session notes card and "Add exercise" (PickerSheet, mode-filtered) at the end. RestBar floats above the bottom inset (scroll content gets bottom padding equal to its height when visible).

- [ ] No unit tests (screen). Verify: both clients' checks; manual reasoning pass through: open → add exercise → tick ghost row → rest bar → untick → reopen session. Commit `Rebuild the session screen as a set table`.

### F7: Finish and summary

**Files:** Create `fitness/summary.ts` + test, `screens/WorkoutSummaryScreen.tsx`; route `WorkoutSummary: { sessionId: string }`.

**Interfaces:** `sessionSummary({ session, sets, exercisesById, recordsBySet, sessionNumber })` → `{ title: "Workout #N", durationMs, volume, workingSets, recordsCount, records: {exerciseName, hit}[] }`; `compareToLast(current: SetFact[], last: SetFact[] | null, exercisesById)` → per exercise `{ volumeDelta, bestSetDelta: string }` (null when no previous session of the same routine); `routineDeviation(routineSlots, blocks)` → `{ added: string[], removed: string[], setCountChanges: {name, from, to}[] }` and `describeDeviation(dev): string[]` ("You added 2 sets of Squat", "You added Dips", "You skipped Rows").

**Behaviour:** Finish stamps `ended_at` and opens the summary (one scrolling page): title, 2×2 stat grid (Duration, Volume, Sets, Records), records list with medal icons, "vs last time you did <routine>" deltas (▲/▼ with words), and, when the session deviated from its routine, "Update routine?" with the described changes and [Update routine] [Keep it]. Calisthenics level-up prompts appear here (F11). The summary is also reachable from a finished session's row on the Log tab. "Reopen" clears `ended_at`.

- [ ] Tests: summary numbers from a fixture; deltas (heavier/lighter/new exercise/no previous); deviation descriptions. → commit `Add a finish summary that compares with last time`.

---

## Phase C — Calisthenics mode

### F8: The mode

**Files:** Create `fitness/mode.ts` + test, `components/ModeSwitch.tsx`; modify `FitnessListScreen.tsx`, `useFitness.ts`, `PickerSheet` usage, `RoutineEditScreen.tsx`.

**Interfaces:** `visibleInMode(exercise, mode)` (discipline `both` shows in both); `defaultsForMode(mode)` → `{ discipline, load_mode, tracking_type }` for a new exercise; `useFitnessMode(): [FitnessMode, (m) => void]` persisted in AsyncStorage key `eio.fitness-mode`. Gym | Calisthenics segmented control at the top of Fitness; in Calisthenics the Exercises tab is labelled **Skills** and shows ladders first, then the library filtered to calisthenics. New sessions take the current mode (or the routine's). Routines list filters by `routines.mode`; the Log tab shows all sessions (combined history) with a small mode glyph. Calisthenics accent: `accentCyan` for mode-identifying UI (switch indicator, skill rings); gym keeps `primary`.

- [ ] Tests for `visibleInMode` and `defaultsForMode`. → commit `Add Gym and Calisthenics modes over one library`.

### F9: Ladders

**Files:** Create `fitness/progression.ts` + test; api (progressions CRUD incl. steps and moves, `moveTo(progressionId, stepId, kind, sessionId?)`); screens `LadderScreen.tsx`, `LadderEditScreen.tsx`; components `SkillCard.tsx`; routes `Ladder: { progressionId }`, `LadderEdit: { progressionId?: string }`.

**Interfaces:** `rungStates(steps, currentStepId, moves)` → `{ step, state: 'mastered' | 'current' | 'locked', masteredOn: string | null }[]` (mastered = an `up` move *from* it and it is before the current step; stepping back makes later rungs locked again but keeps their mastered date in history); `meetsGoal(step, sessionSets: SetFact[] & {clean}[])` (clean, working, unassisted unless `goal` says otherwise, ≥ goal_sets sets each ≥ goal reps/seconds and `weight_kg ≥ goal_added_kg`); `readyToMoveUp(step, lastSessions: SetFact[][] /* newest first */, rule)` (`two_of_three`: met in ≥ 2 of the newest 3; `one`: newest met); `goalProgress(step, bestSessionSets)` → 0..1 for the ring (best qualifying sets vs goal, capped); `stepLabel(i, n, name)` → "Step 4/7 · Advanced tuck".

**UI:** Skills tab: ladders grouped by family (Push, Pull, Legs, Core, Balance, Statics, Other), `SkillCard` = name, "Step 4/7 · Adv. tuck", progress ring (react-native-svg), tap → Ladder. Ladder screen: header "Step 4 of 7" + segmented bar; numbered rungs — mastered (check, date, muted), current (accent border, "Goal 3 × 8 · Best 3 × 6", [Train] starts a calisthenics session with that exercise), locked (lock icon, 40% opacity); overflow: Edit ladder · Step back · Pause. Ladder editor: name, family, rungs (pick exercise, goal sets × reps|seconds, optional +kg, start reps/seconds, cue), reorder with up/down buttons, level-up rule. Moving: "Move up" / "Step back" write a `progression_moves` row and update `current_step_id`, with undo.

- [ ] Tests: rung states (fresh ladder, after two ups, after a step back); meetsGoal (clean only, warm-ups ignored, +kg goal); readyToMoveUp 2-of-3 and 1; goalProgress. → commit `Add progression ladders`.

### F10: Bodyweight sets and the hold timer

**Files:** Create `fitness/holdTimer.ts` + test, `components/HoldDial.tsx`, `components/BandsSheet.tsx`; extend `LoadChips`, `SetRow`.

**Interfaces:** `holdPhase(now, startedAt, leadInMs = 3000)` → `{ phase: 'leadIn', count: 3|2|1 } | { phase: 'holding', elapsedMs }`; `holdCues(prevElapsedMs, nextElapsedMs, targetSeconds, tickEverySeconds = 5)` → ordered cues `('tick' | 'target')[]` crossed in that interval; `formatHold(ms)`.

**UI:** for a time exercise the value cell opens the HoldDial sheet (also a "Timer" button on the block): ~180dp circle with the target in large tabular numerals, −/+ 5 s, tap anywhere on the dial (≥ 64dp) to start; 3-2-1 lead-in (big numerals + `haptics.tap()` per count); counting ring fills to the target in `accentCyan` and continues past it in `success`; at the target: two-tone cue = `haptics.success()` + `expo-speech` "Target" if voice on; ticks every 5 s (`haptics.tap()`, voice says the seconds if on); tap to stop → elapsed seconds fill the row, [Save] ticks it. Goal · Best · Last under the dial. Toggles (voice, ticks) persisted per device. Keep-awake already on. Bands sheet: list, add (label, colour from a fixed 6-swatch set of tokens, approx kg), delete. Side: unilateral exercises get L/R rows (adding a set adds a pair).

- [ ] Tests: lead-in counts 3/2/1 then holding with elapsed from the end of lead-in; cues between 4.9 s and 5.1 s = tick; target crossing emits target once; no cues on a zero interval; elapsed is correct after a long gap (backgrounded). → commit `Add a hold timer and bodyweight load chips`.

### F11: Ladder routines and the level-up prompt

**Files:** Modify `RoutineEditScreen.tsx`, api `saveRoutine` (progression slots, ranges, rest, pair group, increment), `startSession` (resolve slots), `WorkoutSummaryScreen` (prompt).

**Behaviour:** a routine row is an exercise or a ladder; targets are ranges (reps min–max or seconds min–max), rest, increment (gym). At session start a ladder slot becomes its current rung (ghost target = the rung's goal reps/seconds, or `start_reps` right after a move). Summary: for each ladder whose current rung was trained, `readyToMoveUp` → banner "Pull-up ladder: ready for Archer pull-up?" [Move up] [Not yet]. Never moves silently.

- [ ] Tests (pure parts): slot resolution `resolveSlot(slot, progressionsById)`; level-up candidate list from a summary fixture. → commit `Let routines follow a ladder, and offer level-ups after a session`.

---

## Phase D — Insight

### F12: Weekly streak and the training calendar

**Files:** Create `fitness/streak.ts` + test, `components/TrainingCalendar.tsx`; modify `useFitness.ts`, Log tab.

**Interfaces:** `weeklyStreak(sessionDates, today, weekStartsOn = 1)` → consecutive weeks with ≥ 1 session, counting the current week if it has one, else ending last week (an empty current week does not break it until it ends); `restDays(sessionDates, today)` → days since the last session (0 if today); `trainingDays(sessions)` → `Record<iso, { gym: boolean; calisthenics: boolean }>`.

**UI:** Log tab header: "N-week streak" chip + "N rest days" (words, not colour). The WeekStrip stays; below it a `TrainingCalendar` (core `MonthCalendar` + `renderDay`): trained days get a filled dot in `primary`, calisthenics days a cyan corner mark, both = both marks; tap a day → its sessions (open the session; empty day → "Log a workout for 16 Oct").

- [ ] Tests: streak across a year boundary; current empty week does not break; gap of one empty full week breaks; rest days. → commit `Count streaks in weeks, and show training days on a calendar`.

### F13: Exercise detail

**Files:** Create `fitness/exerciseStats.ts` + test, `screens/ExerciseDetailScreen.tsx` (replaces `ExerciseProgressScreen`; route `ExerciseDetail: { exerciseId: string }`, keep `ExerciseProgress` route as an alias that redirects); `components/LineChart.tsx` (react-native-svg 15.15.4, installed and in Expo Go); api `listExerciseSets(exerciseId)` (sets joined with session date and bodyweight).

**Interfaces:** `metricsFor(exercise)` → chips: external rep: `['e1rm','heaviest','bestSetVolume','sessionVolume','totalReps']`; bodyweight rep: `['mostReps','bestAddedKg','totalReps','bwE1rm']`; hold: `['longestHold','totalTime']`; `seriesFor(metric, setsWithDates, range: '1m'|'3m'|'1y'|'all', today)` → `{ date, value }[]` one point per session; `repMaxTable(sets)` → for 1–12 reps: actual best weight (with date) and Epley-predicted from the best e1RM; `historyBySession(sets)`.

**UI:** tabs Summary · History · Records · How-to. Summary: headline value for the selected metric, a line chart (react-native-svg), metric chips and range chips (`1M 3M 1Y All`), tap a point → that day's sets in a sheet. History: per session cards (date, sets via `formatSetShort`, records medals). Records: current best per record kind with date, the rep-max table (actual vs predicted, predicted in `textMuted` and labelled "est."). How-to: instructions + pinned note (editable), equipment, "Advanced" (load mode, bodyweight factor, unilateral, discipline). Also `ExerciseEditScreen` reachable from here and from the library for those fields.

- [ ] Tests: metricsFor per type; series one point per session, range filter; repMaxTable actual vs predicted; warm-ups excluded. → commit `Add an exercise detail page with charts, history and records`.

### F14: Next-session targets and calisthenics progress

**Files:** Create `fitness/targets.ts` + test; modify ghost computation in `blocks.ts`/hook; create `components/LadderProgress.tsx` (step chart + moves timeline) on the Ladder screen and a "Progress" section on the Skills tab ("N steps mastered" + timeline).

**Interfaces:** `nextTarget({ exercise, slot: { repsMin, repsMax, secondsMin, secondsMax, incrementKg } | null, lastWorkingSets: SetFact[], lastDate: string | null, today })` → `{ weight: number | null, reps: number | null, seconds: number | null, reason: string | null }`. Rules: external with a range: all working sets at `repsMax` → `weight + increment (default 2.5)`, reps `repsMin`, reason "+2.5 kg · every set hit 12"; else same weight, reps = last + 1 capped at max, reason null. Bodyweight rep: +1 rep ("+1 rep"). Hold: +5 s ("+5 s"). Gap > 14 days: same weight and reps as last time, reason "Back after N days · same weight". No history → routine targets or nothing.

**UI:** ghost values come from `nextTarget` first; a small "why" chip under the block title shows `reason` when present (tap → one-line explanation).

- [ ] Tests: each rule above, including the 14-day gap and no history. → commit `Suggest next-session targets by double progression`.

---

## Phase E — Gym tools and body

### F15: Plate and warm-up calculators

**Files:** Create `fitness/plates.ts` + test, `screens/PlateCalculatorScreen.tsx` (route `PlateCalculator: { targetKg?: number }`), plate inventory in AsyncStorage `eio.plates` (`{ barKg: 20, plates: [{kg, pairs}] }`, defaults 25/20/15/10/5/2.5/1.25 × 4 pairs).

**Interfaces:** `platesFor(targetKg, barKg, inventory)` → `{ perSide: number[]; achievedKg: number; exact: boolean }` — closest achievable not above the target (ties prefer fewer plates); below the bar → bar only; `warmupSets(workKg, barKg, inventory)` → `{ kg, reps }[]` at 40/60/80 % (reps 8/5/3), each rounded down to an achievable load, at least the bar, deduplicated, strictly below the work weight.

**UI:** drawn bar with plates (Views, plate height by size, colour by size from the accent tokens with the kg written on each — not colour alone); target input; "Closest: 97.5 kg" when not exact; inventory editor. Block menu "Add warm-up sets" inserts W draft rows from `warmupSets` using the block's first working weight (ghost or typed). Block menu and the LOAD cell's long-press open the plate calculator for that weight.

- [ ] Tests: 100 kg on 20 bar → [25,15] per side; 102.5 with standard plates → [25,15,1.25]; 101 → closest 100 not exact; inventory with one pair of 25s; target < bar; warm-ups for 100 → 40/60/80 rounded, no duplicates, none ≥ 100. → commit `Add plate and warm-up calculators`.

### F16: Supersets, replace, repeat, save as routine

**Files:** modify hook, `BlockMenu`, `SetTable`, `WorkoutSessionScreen`, Log tab session row menu; pure `supersetNext(blocks, blockId, rowIndex)` in `blocks.ts` + test.

**Behaviour:** "Superset with…" assigns the same `superset_group` letter to two or more adjacent blocks (moving the partner next to it); grouped blocks show a coloured left bar and the letter (A1/A2 labels). Ticking a row in a superset scrolls to the partner's next undone row; rest starts only after the last block of the round (`supersetNext` returns `{ nextBlockId, nextRowIndex, restAfter: boolean }`). Replace: pick another exercise; allowed when the block has no saved sets (otherwise offers "Add as new block"). Reorder: up/down in the block menu. Log tab session row long-press → Repeat (new session today with the same blocks, mode, ghost values from that session) · Save as routine (name prompt, slots from blocks with set counts and the session's reps as targets) · Delete.

- [ ] Tests: `supersetNext` for A1→A2→A1 rounds, uneven set counts, a non-superset block (rest after every set). → commit `Add supersets, replace, repeat and save-as-routine`.

### F17: Body measurements

**Files:** create `fitness/measurements.ts` + test; api `listMeasurements`, `saveMeasurement(date, values)` (upsert on `(user_id, date)`), `deleteMeasurement`; Body tab section + `MeasurementSheet`; chart per site using `LineChart`.

**Interfaces:** `MEASUREMENT_SITES` — `{ key, label, pair?: 'left'|'right', unit: 'cm' | '%' }[]` (Neck, Shoulders, Chest, Waist, Hips, Arm L/R, Forearm L/R, Thigh L/R, Calf L/R, Body fat %); `latestValues(rows)` → per site the latest value and its date; `seriesForSite(rows, key)`.

**UI:** Body tab: "Measurements" card listing each site's latest value and change since the previous entry (▲/▼ + words), [Add measurements] → sheet with every site, last values as placeholders, pairs side by side; tap a site → chart sheet.

- [ ] Tests: latest values skip nulls; series ordered by date. → commit `Track body measurements`.

---

## Phase F — Website

### F18: Website Fitness v3

**Files:** split `website/src/pages/FitnessPage.tsx` into `website/src/pages/fitness/` (`FitnessPage.tsx` shell with the mode switch and tabs, `LogView.tsx`, `SessionView.tsx`, `RoutinesView.tsx`, `SkillsView.tsx`, `ExercisesView.tsx`, `ExerciseDetail.tsx`, `BodyView.tsx`, `charts.ts`); CSS section in `components.css`.

**Behaviour (spec §4.9):** same model and rules via `@app/modules/fitness/*`. Log: weekly streak, rest days, month calendar (`MonthCalendar`) with gym/calisthenics marks, a 53-week year heatmap (CSS grid, intensity by working sets, with a legend and per-cell title), session list. Session view mirrors the phone's set table (SET · PREVIOUS · LOAD · REPS|TIME · ✓, set types, ghosts, records, rest not needed on desktop), Finish + summary. Routines: builder with exercise or ladder slots, ranges, rest, pair group, increment. Skills: ladders grouped by family, ladder detail with rungs and moves, ladder editor. Exercise detail: metric chips, range chips, chart (existing chart lib in `components/chart.ts`), history, records with rep-max table, how-to/advanced fields. Body: weigh-ins (existing) + measurements table and charts. Bands and plate inventory are phone-side (inventory is per device); bands are editable on the web too (they are rows).

- [ ] Verify: website tsc/eslint/build; commit in parts (`Rebuild the Fitness page around the v3 model`, …).

---

## Self-review

- **Spec coverage:** §4.1 → F8; §4.2 → F1/F2/F10/F13 (exercise fields edit); §4.3 → F1/F3; §4.4 → F4–F7; §4.5 → F9–F11; §4.6 → F2/F4; §4.7 → F12–F14; §4.8 → F15–F17; §4.9 → F18; §4.11 bugs: 1 F3, 2 F2, 3 F4, 4 F12, 5 F6 (RPE in the set-type sheet).
- **Review Focus** 1 → F2 tests; 2 → F3/F4 tests; 3 → F5/F10 tests; 4 → F4 tests; 5 → F2/F3 tests with v2 fixtures.
- **Types:** `SetFact`, `SetType`, `RecordHit`, `DraftRow`, `Row`, `RestState`, `FitnessMode` are defined once (F2–F5) and used by name thereafter.

## Rulings

- Ruling: records are announced once per session per kind (the first set that beats both the baseline and earlier sets this session) — three sets at a new best would otherwise each fire a toast, which teaches you to ignore it — cost if wrong: a later equal set shows no medal.
- Ruling: bodyweight comparisons use net load (`weight − assist`) and dominance ("same or harder load" / "same or more reps") — this is the spec's wording, and it is what keeps an assisted set from outranking an unassisted one — cost if wrong: fewer records fire for odd load changes.
- Ruling: the rest-end sound comes from the scheduled local notification (shown in the foreground too, by the handler core installs) rather than a new audio dependency — §2 discourages new dependencies, and expo-audio is not in the foundation set — cost if wrong: no sound in Expo Go, where notifications cannot be scheduled (haptic only).
- Ruling: row swipe-to-delete exists only on the session screen — it is a full-screen route outside the tab pager, so §2's one-gesture rule holds; "Remove" in the set-type sheet is the non-swipe route — cost if wrong: none.
- Ruling: one migration for all four phases — a half-applied fitness schema would break the screens of whichever phase landed first — cost if wrong: none; it is additive.
- Ruling: plate inventory lives on the device (AsyncStorage), bands in the database — the spec says inventory is stored on the device; bands are referenced by sets, so they must be rows — cost if wrong: re-entering plates on a second phone.
