# Calisthenics mode: competitor research for EIO Fitness

Researched 2026-10-19. Public evidence only: Google Play and App Store listings (descriptions, screenshots, "what's new", version history, the reviews each store shows), official websites and help centres, a public feature-request board, reviews and roundups, and one open-source app's routine data on GitHub. Nothing was installed, downloaded as an app, decompiled or signed up for.

**Evidence labels.** Each substantive claim carries one of these labels:
- **OBSERVED**: seen in the cited source.
- **INFERRED**: reasoned from evidence; the basis is given.
- **UNKNOWN**: looked for and not found.

Quotes are kept short.

**Limits of this pass (read first).**
- The web-search budget ran out partway through. It was shared with other agents running at the same time. After that point, only known URLs could be fetched directly.
- Reddit refused direct fetches, so r/bodyweightfitness and r/calisthenics threads could not be read. The Recommended Routine (RR) comes from three other places:
  1. An open-source Android app that encodes an older RR version as data.
  2. Liftosaur's encoding of the 2018 RR rewrite.
  3. Third-party summaries.
- No YouTube material was reviewed.
- Store pages show only a handful of "most relevant" reviews, so praise and complaints are a sample, not a census.
- The checklist at the end marks what is still open.

---

## 1. Which apps, and why

### Shortlist evidence (Google Play, fetched 2026-10-19)

Install figures are Google Play's bucket thresholds ("1M+" means at least one million). Source for every row: `https://play.google.com/store/apps/details?id=<package>` (OBSERVED).

| App | Package | Installs | Rating | Reviews | Last update | Relevance |
|---|---|---|---|---|---|---|
| **Thenics: Calisthenics Coach** | com.abad.thenics | **5M+** | 4.7 | 38.2K | Oct 8 2026 | Skill-first; each skill is a ladder of levels |
| **Calisteniapp** | me.inakitajes.calisteniapp | 1M+ | 4.7 | **40.4K** | Sep 30 2026 | Largest review base; phase programs, EVO adaptive routines, weighted calisthenics |
| **Calistree** | com.calistree.calistree | 500K+ | 4.7 | 3.87K | Oct 13 2026 | Deepest skill tree; **gym and calisthenics in one app**; bands, eccentrics, audio cues |
| Madbarz | com.madbarz.madbarzApp | 1M+ | 4.7 | 19.5K | Apr 21 2026 | Workout generator; no skill ladders |
| Thenx | com.sysops.thenx | 1M+ | 4.0 | 16.7K | Aug 31 2026 | Follow-along video programs |
| Bodyweight Workout at Home | com.axiommobile.sportsman | 1M+ | 4.7 | 26.8K | Jul 30 2026 | Generic home workouts, not progression-based |
| Hybrid Calisthenics | com.hybridcalisthenics.app | 100K+ | 4.8 | 8.18K | Oct 8 2026 | Beginner levels; little tracking |
| CalistX | com.calistx.calisthenics.app | 100K+ | 4.5 | 5.54K | Mar 27 2026 | — |
| Caliverse | com.caliverseapps.caliverse | 100K+ | 4.6 | 3.43K | Oct 15 2026 | Skill tree gated by "3 clean sets" (per a reviewer) |
| Fitloop | com.fitloop | 50K+ | 4.4 | 1.29K | Oct 16 2026 | Built from r/bodyweightfitness; RR built in; "Calisthenics & Gym" |
| Simple Calisthenics | com.wallmann.exercisable_platform | 50K+ | 4.3 | 438 | Oct 13 2026 | — |
| Cali Move Workouts | com.calimove.player | 10K+ | 4.2 | 510 | Sep 24 2026 | Calimove's app is small on Android |
| Calitracker | com.braziusProductions.calisthenicsworkouttracker | 10K+ | 4.8 | 170 | Oct 18 2026 | A pure *tracker*: holds, +kg, bands; closest analogue to EIO |
| Calistack | com.cali.stack | 5K+ | 4.2 | — | Oct 18 2026 | Explicit node states: Locked → Unlocked → Ongoing → Completed → Mastered |

### The three chosen

1. **Thenics.** It has by far the most Android installs of any calisthenics-specific app (5M+), a 4.7 rating and an update this month (OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.abad.thenics)). Its whole structure is *skill → numbered levels → workouts*, which is exactly EIO's missing piece. It rarely appears in English roundups, likely because it is a German product (developer Innothenics GmbH, OBSERVED, [App Store](https://apps.apple.com/us/app/thenics/id1509531048)). The install numbers still put it first.
2. **Calisteniapp.** It has the largest review count in the category (40.4K, 4.7) and is actively updated. It is the overall pick in the most-cited 2026 roundup (OBSERVED, [calisthenics.com](https://calisthenics.com/best-calisthenics-apps/), affiliate article). It represents the "programs + adaptive routines + weighted calisthenics" school.
3. **Calistree.** It is smaller (500K+), but:
   - It is the reference implementation of a calisthenics **skill tree**.
   - It logs bands, eccentrics and added weight.
   - It has the most developed hands-free audio.
   - It explicitly covers **both home/park calisthenics and gym weight training in one library and one log**, which matches EIO's two-mode question.

   OBSERVED: [Play](https://play.google.com/store/apps/details?id=com.calistree.calistree), [calistree.com](https://calistree.com/), [calisthenics.com review](https://calisthenics.com/calistree-app-review/).

### Not chosen, but used as supporting evidence
- **Madbarz** and **Thenx**: large install bases, but neither has browsable progression ladders (OBSERVED in a competitor's roundup, [fitloop.app](https://fitloop.app/blog/best-calisthenics-apps), biased source). Madbarz has not been updated since April.
- **Fitloop** and **Calitracker**: small, but each shows a clean "calisthenics + gym tracker" pattern that EIO can copy.
- **Caliverse**, **Calistack**, **Ascend**, **Level Up** and **Progressive Workouts**: each documents a concrete unlock rule.
- **The open-source "Bodyweight Fitness" app** (github.com/mazurio/bodyweight-fitness-android): encodes the RR as data, which shows how practitioners structure progressions.

---

## 2. Per-app teardown

### 2.1 Thenics (5M+, 4.7)

**Model**
- Skills are the top-level object.
  - Free skills: Muscle-Up, Planche, Front Lever, Back Lever, Pistol Squat, Handstand Push-Up, V-Sit.
  - Pro skills: One-Arm Pull-Up, Human Flag, One-Arm Push-Up, One-Arm Handstand, Shrimp Squat, Hefesto, Dragon Flag.

  OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.abad.thenics).
- "Every skill is divided into several progressions which include different workouts" (OBSERVED, [App Store](https://apps.apple.com/us/app/thenics/id1509531048)).
- A user describes the loop: a skill's workouts make you "stronger until you reach the point where you need to progress. It then opens up the next level". The workouts are timed, and "all you have to do is follow the workout and enter your reps or time" (OBSERVED, Play review).

**Level display (screenshots, OBSERVED on the Play listing)**
- The **Skills list** shows one card per skill: a black-and-white photo, the skill name, "Lvl 5: Muscle Up" or "Lvl 4: Adv. Tuck Planche", and a **circular percentage ring** (80%, 50%).
- The **progression screen** for one skill (e.g. Handstand Push Up) has an overall ring (88%) and "Details" and "History" chips. Below them is a numbered vertical ladder: 1 Pike Push Up, 2 Adv. Pike Push Up, 3 Wall HSPU, 4 Negative HSPU, 5 HSPU. Each rung carries its own % ring (100%, 100%, 100%, 100%, 40%).
  - INFERRED from the rings and the review above: each rung has a mastery target, the ring is progress toward it, and the next rung opens at 100%.
  - UNKNOWN: the exact threshold. It is not published.
- A reviewer notes that past 50% of one level there are "not enough progression exercises to bridge the gap", e.g. frog stand to tuck planche (OBSERVED, [App Store reviews](https://apps.apple.com/us/app/thenics/id1509531048?see-all=reviews)). Ladders need intermediate rungs, and a user needs to be able to add their own.

**Guided workout screen (OBSERVED, screenshot)**
- Top: a segmented progress bar with exercise silhouettes, a "1/3" counter and elapsed time.
- Middle: a large exercise photo and name.
- A **"Start Timer"** pill.
- A row of three small stats under it: flag 10s, star 0s, history-clock 2s. INFERRED from the icons: target, best and last.

**History (OBSERVED, screenshot)**
- A month timeline. Each session card lists its exercises with per-set values in one compact line, e.g. "Handstand 45 | 30 | 30" (seconds) and "Wall Handstand Push Up 6 | 6 | 6" (reps), plus the session duration.

**Coach and plans**
- 6-week plans with week tabs and day icons (✓ when done), and a "Today's Workout" card showing a level as dots (OBSERVED, screenshot).
- The Pro coach generates plans (OBSERVED, App Store).

**UI**
- Monochrome photography and silhouettes on near-black, with white cards and one cyan accent used only for the progress rings. Calm and very legible (OBSERVED, screenshots).

**Praise (OBSERVED, store reviews)**
- Progressions "prioritize form and technique, which must be mastered prior to progressing".
- "Once I've mastered one level, I know I'm ready to move on".
- Users like that the free version "goes straight to the skill list".

**Complaints (OBSERVED, store reviews and version history)**
- The coach cannot be turned off; "I know my schedule and my body better than your algorithm".
- Some static moves have no timer, and the timer glitches during the cooldown.
- The timer sound stopped the user's music. Fixed in 7.0.24: "stopping of music due timer sound".
- A user asks for **audio announcing the timer start and the next exercise**, because many skills "doesn't allow free hands".
- No pause button.
- The screen sleeps mid-workout.
- No ding at the end of rest.
- An accidental test workout could not be deleted.
- Users want per-exercise notes. Workout notes were added in 7.0.26.
- Limited customisation. Own workouts were added only in 2025–26.

### 2.2 Calisteniapp (1M+, 4.7, 40.4K reviews)

**Model: programs with phases, plus three other formats**
- Skill programs ("Your first pull-up", front lever, handstand by strength, back lever) are split into **phases**. The screenshot shows "7 PHASES · YOUR FIRST PULL-UP", "Phase 1 · Novice stage level 0 · 1/3 weeks", and this week's sessions (OBSERVED, Play screenshots).
- From the help centre (OBSERVED, [help: Explore](https://help.calisteniapp.com/en/docs/explore)):
  - Programs are generated as a calendar from your chosen days, level and goal.
  - After sessions, the system suggests when to "accelerate, repeat or consolidate" or go back a phase.
  - **EVO routines** start with "an initial test", then readjust after each session from "what you could do and how you felt".
- The 2025 changelog adds "feedback on effort and sensations per exercise" and a progress analysis based on "how you rate each session" (OBSERVED, [App Store version history](https://apps.apple.com/us/app/calisteniapp/id1265489771)).
- **21-day challenges**: a day grid of big numbered tiles marked Done or locked (OBSERVED, screenshot).

**Session types** (OBSERVED, [help: Session Creator](https://help.calisteniapp.com/en/docs/custom-sessions))
- **Classic**: sets and reps, with supersets and drop sets. Rest is set between blocks and between sets, and there is a time limit.
- **HIIT**: work and rest per exercise.
- **Tabata**: 8 × 20s/10s.
- **EMOM**: one minute per exercise.
- **AMRAP**: total time cap.

**Records** (OBSERVED, [help: Personal Records](https://help.calisteniapp.com/en/docs/personal-records))
- Records split into two kinds:
  - **Weighted**: added weight, e.g. "35 kg in weighted pull-ups".
  - **Endurance**: best reps or best hold seconds.
- Records come only from completed workouts.
- A **podium** shows your current best and the previous bests, each with the session that set it.
- You can discard a mark logged by mistake.
- 2026 additions: estimated 1RM/2RM/3RM/5RM "from your records with added weight" and total tonnage (OBSERVED, version history 26.9.0 and 26.8.0).

**Progress** (OBSERVED, [help: Statistics](https://help.calisteniapp.com/en/docs/statistics) and screenshots)
- Date filter: 7 days / 30 days / All / custom.
- Hours, sessions, energy and a load score.
- An estimated-load chart with a ±15% recommended band.
- A worked-muscles body map.
- An **"Unlocked exercises 78 / 703"** strip on the profile.
- Hexagonal achievement badges.
- 2025-11: a "new unlocked exercises section in profile".

**Interaction details (OBSERVED, version history)**
- Apple Watch app (2026-02).
- **Pause a program** for "vacations, injuries" with progress preserved (2026-01).
- Customisable warm-up, with "decide when to continue or skip each phase" (26.8.0).
- An "Attempts only indicator" (26.7.0). INFERRED: some skill sets are logged as attempts rather than reps. UNKNOWN: the exact UI.
- Unified planning view with drag-and-drop and per-week exceptions (25.10.0).
- kg and lb units (26.3.0).
- Photos on workouts (26.7.0).

**UI**
- Dark and cinematic: near-black with an orange-red gradient accent.
- Heavy condensed uppercase display type for titles.
- Difficulty shown as 1–3 lightning-bolt glyphs ("Easy ⚡", "Moderate ⚡⚡").
- Full-bleed athlete photography on cards.
- Pill buttons ("Progress", "Info").

OBSERVED, screenshots.

**Praise (OBSERVED, reviews)**
- Breadth of programs.
- Progressions "well planned and suitable for beginners".
- "Not totally over-engineered".
- A strong free tier.

**Complaints (OBSERVED, reviews and roundups)**
- Cannot log a past workout or backfill a date; a session counts only if run live in the app ([App Store reviews](https://apps.apple.com/us/app/calisteniapp/id1265489771?see-all=reviews), [calistree.com roundup](https://calistree.com/blog/best-calisthenics-apps-2026/)).
- "Can't modify rest times in pre-made routines" ([calisthenics.com](https://calisthenics.com/best-calisthenics-apps/)).
- The interface "can feel overwhelming".
- Wants "an individual timer".
- A Play reviewer asks for **an option to input band strength** ([Play](https://play.google.com/store/apps/details?id=me.inakitajes.calisteniapp)).
- Adding a program's workouts to the schedule is clumsy.

### 2.3 Calistree (500K+, 4.7): home, park and gym in one

**Model**
- One library of 1,300–1,700+ exercises, each with a datasheet. Each exercise "shows its easier and harder variations".
- A **skill tree** of dependencies between exercises.
- A personal tree showing where you are.

OBSERVED, [calistree.com](https://calistree.com/), [Play](https://play.google.com/store/apps/details?id=com.calistree.calistree).

**Tree display (OBSERVED, screenshot "Climb the skill tree")**
- A vertical canvas split into **horizontal colour bands labelled Beginner / Novice / Intermediate / Advanced**.
- Circular photo nodes sit in the bands, linked by curved arrows.
- The searched exercise (Pistol squat) has a red ring.
- Tabs: Filters / Results / **Tree**.
- Later updates added "curved, color-coded arrows" and swipe/zoom (OBSERVED, [calisthenics.com review](https://calisthenics.com/calistree-app-review/)).

**How "ready for the next step" is decided**
- A reviewer names three per-exercise measures: **"readiness, coverage, and mastery levels"** (OBSERVED, [App Store reviews](https://apps.apple.com/us/app/calistree/id1558561315?see-all=reviews)).
- The changelog shows "exercise readiness" on each history page, an adjustable "readiness threshold", and readiness as a search filter (OBSERVED, [app-updates](https://calistree.com/app-updates/)).
- The engine auto-progresses "sets/reps/time", keeps values "always limited by the min/max ranges", can "switch back to time if stuck on reps", and (5.0.3) has an "end-of-session screen to suggest updating the min/max parameters based on what was actually logged" (OBSERVED, app-updates and App Store version history).
- UNKNOWN: the readiness and mastery formulas. Not published.
- The most-voted public request is a **"Too hard" / "Too easy" button** (166 votes, planned). Users want a manual override on automatic progression (OBSERVED, [feedback board](https://feedback.calistree.com/)).

**Logging per set**
- "Customize your workouts with added weight, counterweight, elastic bands, eccentric option, RPE, rest times" (OBSERVED, Play).
- 5.10.3: "Band sets: save your exact elastic bands and their force, and combine several at once" (OBSERVED, Play "what's new").
- Mastery was fixed specifically "of band-assisted/eccentric exercises", and a "Band-resistance PR" exists. INFERRED: an assisted set is a different performance from an unassisted one, and PRs are kept separately.
- The reviewer mentions logging grip position and angle (OBSERVED, calisthenics.com review). Custom exercises carry properties such as Variation base, Equipment, Grip position, Difficulty ("Novice+"), Velocity (Dynamic) and Sagittal symmetry (Bilateral) (OBSERVED, screenshot).

**Set-entry UI (OBSERVED, screenshots)**
- A session header with a **carousel of round exercise thumbnails**; done ones are ticked.
- A set table with columns `#`, **Previous (with date)**, Time or Reps (with the **target range shown in the header**, e.g. "30"–1'00"" or "6–15"), and a Done checkbox.
- A "PRs: 16 reps · 32"" chip.
- ADD SET, START TIMER and a Notes field.
- **Unilateral exercises show R and L rows within each set.**

**Hands-free features (OBSERVED, app-updates and App Store history)**
- "Time Attack" mode auto-plays videos, **auto-starts timers for static holds** and checks off sets. It auto-advances and reads the next exercise aloud.
- A set timer with optional **1-second and 5-second beeps**.
- A stopwatch that can "save the initial goal or the extra time".
- A **"Between sides" timer** for unilateral work.
- A get-ready time "limited by rest time".
- **Background mode** with the screen locked.
- **Audio ducking** of your music, instead of stopping it.
- Selectable beep sounds.
- "Fully customizable cues", **haptics**, and "audio cues as text".

**Gym and calisthenics together (OBSERVED, Play and App Store history)**
- Equipment profiles per location (home, gym, park), so only possible exercises are programmed.
- 47 gym machine exercises.
- A barbell plate calculator.
- A "Type of weight" option.
- PPL plans.
- Bodyweight/height import from Health.
- **One library, one log, one PR system.**

**Progress (OBSERVED, screenshots)**
- A muscle-fatigue body map (Ready → Recovering → Fatigued).
- "Experience profiles": strength, balance, cardio and flexibility level lines over months.
- XP per session.
- A calendar with session dots.

**UI**
- Bright orange header bars, white cards, thin orange outlines, round photo nodes and a tree motif.
- Dense: lots of numbers and chips.

**Praise (OBSERVED, reviews)**
- "The skill tree alone is reason to download".
- "Constantly opening the skill tree during my workouts".
- Gamified mastery "feels like you just beat a side quest".
- Tracks progress "by exercise, muscle group, and skill".

**Complaints (OBSERVED)**
- "Slightly complex" interface and a "steep learning curve" ([review](https://calisthenics.com/calistree-app-review/)).
- Building your own routine is "overly/unnecessarily complex" (Play).
- Progression of "increasing sets/reps every session" is too aggressive, and 30s rest is too short; the user wants both configurable (App Store).
- Generated workouts ignore the chosen intensity (Play).
- Requests: deload / vacation / injury-recovery mode (30 votes); session and exercise notes; larger videos (feedback board).

### 2.4 Supporting evidence from other apps

**Unlock rules published by smaller apps (OBSERVED, App Store and Play listings)**

| App | Published rule | Source |
|---|---|---|
| Progressive Workouts | Move up at "three sets of eight repetitions" or 3 × 30s holds; per-level charts; alternative paths | [listing](https://apps.apple.com/app/id1551617282) |
| Ascend | "2-out-of-3 success rule" across recent workouts; previous session's reps and holds shown under each set | [listing](https://apps.apple.com/app/id6765751498) |
| Level Up | Five classes (Push, Pull, Balance & Inversion, Straight Arm Strength, Lower Body & Mobility), 10 ranks each, unlocked by benchmarks | [listing](https://apps.apple.com/app/id6759352254) |
| Calistack | Four categories (Push, Pull, Core, Legs); node states **Locked → Unlocked → Ongoing → Completed → Mastered**; placement from two questions (max push-ups, max pull-ups) | [Play](https://play.google.com/store/apps/details?id=com.cali.stack) |
| Caliverse | A tester says it won't advance you until you log 3 clean sets at the prior step | [calistree.com roundup](https://calistree.com/blog/best-calisthenics-apps-2026/), second-hand |

**Calitracker** (closest to EIO: a tracker, not a coach). OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.braziusProductions.calisthenicsworkouttracker) listing and screenshots:
- Logs "sets, reps, holds and added weight or resistance bands".
- Shows "previous results next to every set".
- Has an "automatic rest timer and a customizable timer for holds".
- Weighted dips are written **"5+50kg"** in the Previous column, with a separate "+kg" column.
- History shows "1 × 5 reps +25kg".
- A skill plan shows a **numbered progression path (1–7) with the current step highlighted** and "Level 3 Target: Negative Pull-Ups — Target: 10 Repetitions".
- Difficulty filter chips run Beginner / Easy / Medium / Hard / Expert, with a coloured difficulty tab on each row.
- A reviewer asks for **RIR per set**.

**Fitloop.** OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.fitloop) and screenshots:
- Programs include both the r/bodyweightfitness RR and gym programs (5x5, 5/3/1, GZCLP).
- "Log a set in one tap", "previous reps and weight on every set", plate calculator.
- **The hold entry is a large circular "30s target" dial with − and + steppers, a timer button and one big ✓.**
- The progression list shows LEVEL 1, 2, 3… rows grouped by equipment branch ("Rings" / "No Rings") plus "Alternatives".
- The pull-up progression page branches after Pull-Up into weighted, L-sit, arch and archer variants, with typewriter after archer (OBSERVED, [fitloop.app/progressions/pullup-progression](https://fitloop.app/progressions/pullup-progression)).
- Its stated rule: start at 3×5, add a rep per set each session, move up at 3×8 (OBSERVED, [fitloop.app blog](https://fitloop.app/blog/best-calisthenics-apps), author's own app).
- Complaints: no notification when rest ends, and timers "start inconsistently" (Play reviews).

**Thenx.** OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.sysops.thenx) reviews:
- "no voice coaching! clock is not visible enough… no alerts".
- "Timed exercises should stop on their own".

**Madbarz.** OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.madbarz.madbarzApp):
- A "Smart repetition counter: slide to record your reps".
- Complaint: "Upcoming exercises not shown during rest periods".

**Caliverse.** OBSERVED, [Play](https://play.google.com/store/apps/details?id=com.caliverseapps.caliverse) reviews:
- Repeated crashes "lose literally every trace of your workout".
- Lesson: persist each set the moment it is logged.

### 2.5 Practitioner structure: the r/bodyweightfitness Recommended Routine

**Current version (2018 rewrite), as encoded by Liftosaur.** OBSERVED, [liftosaur.com](https://www.liftosaur.com/programs/recommended-routine). This is a third-party encoding; the Reddit wiki itself could not be fetched.

Structure:
- Warm-up.
- Three **pairs**: pull + squat, dip + hinge, row + push-up.
- A **core triplet**: anti-extension, anti-rotation, extension.
- 3 sessions a week.

Sets and rest:
- Main exercises 3 × 5–8; core 3 × 8–12.
- 90s rest within pairs, 60s in the triplet.

Rule:
- Add a rep per set each session.
- At 3 × 8 (or 3 × 12 for core), move to the next variation and restart at the bottom of the range.
- At the top of a ladder, add weight.
- Timed rungs grow 5s per session to a target (30s; 60s for support hold).

Ladders, as encoded:

| Movement | Ladder |
|---|---|
| Pull | Scapular pull → Arch hang → Negative pull-up → Pull-up |
| Squat | Assisted → Bodyweight → Split → Bulgarian split → Shrimp |
| Dip | Support hold → Negative dip → Dip |
| Hinge | Romanian DL → Single-leg DL → Banded Nordic → Nordic |
| Row | Vertical → Incline → Inverted → Wide |
| Push | Wall → Incline → Push-up → Diamond → Pseudo-planche |

Other sources:
- The same 3 × 8 trigger appears in older StartBodyweight-derived material (OBSERVED via search summaries; primary pages not fetched).
- A 2021 community comment advises 4–8 weeks at a level, then a deload week (OBSERVED via search summary of a mirror, anecdotal).

**Older RR, as data in the open-source "Bodyweight Fitness" Android app.** OBSERVED, [GitHub](https://github.com/mazurio/bodyweight-fitness-android): `app/src/main/res/raw/bodyweight_fitness_recommended_routine.json` and `RoutineRepository.kt`. The routine is a tree:

```
Category (Warmup / Skill Work / Strength Work)
  └ Section (e.g. "Pull Up Progression", description "3x(5-8)", mode = all | pick | levels)
      └ Exercise (title, level "Level 1..8", defaultSet = "weighted" | "timed")
```

- A `levels` section means **"the routine slot is the progression; you do whichever level you are on"**.
- `pick` means choose one of several.
- `all` means do every item.
- Skill work is separate from strength work:
  - Handstand: wall plank → stomach-to-wall → freestanding, 5 min.
  - Support practice: parallel bar → rings → rings turned out, 2–3 min.
- The L-sit ladder is timed: foot-supported → one-leg → tuck → full, 3 × 10–30s.
- One rung is labelled "Level 5-8" as an alternate branch.
- Each stored set is `{isTimed, weight, reps, seconds}`.

INFERRED: practitioners think in **slots that point at ladders**, with a **target range** and a **graduation target** per slot. Holds and reps mix within one ladder. Skill practice (time-on-task) is a separate block from strength sets.

---

## 3. What EIO already has

EIO Fitness already has:
- A solid gym logger: weight × reps or weight × seconds per set, "repeat last set", rest timer presets, session notes, a 7-day strip, streak and history.
- Same-rep-count PR badges, best hold for timed exercises, and a per-exercise e1RM chart.
- A personal exercise library with 11 muscle tags and a reps/time tracking type.
- Routines with target sets and reps.
- Body weigh-ins with BMI.

The schema (`supabase/migrations/0011_fitness_v2.sql`, `0014_fitness_detail.sql`) stores each set as exactly one of reps or `duration_seconds`, plus `weight_kg >= 0` and `rpe`.

Gaps that matter for calisthenics:
- There is no concept of an exercise being *bodyweight*, so `weight_kg = 0` is ambiguous. It could mean "no load recorded" or "bodyweight only".
- There is no assistance, side, ladder, level, target hold or audio cue.

---

## 4. Gap analysis: what a calisthenics mode needs that EIO lacks

| # | Need | Why gym logging can't express it | Evidence | EIO today |
|---|---|---|---|---|
| G1 | **Progression ladders**: an ordered list of variations per skill, with a *current* step | In calisthenics, progress means moving to a harder *exercise*, not adding kg | Thenics ladders, Calistree tree, RR "levels" sections, Calistack states (OBSERVED, §2) | None |
| G2 | **Graduation target per step** (e.g. 3 × 8 reps, 3 × 30s) and a "ready to move up" prompt | The app must know when a step is earned | RR 3×5–8 → 3×8; Progressive Workouts 3×8 / 3×30s; Ascend 2-of-3 rule; Calitracker "Target: 10 Repetitions" (OBSERVED) | Routines hold only fixed `target_reps` |
| G3 | **Step states**: locked / current / mastered, with progress % | Motivation and orientation: "where am I on the planche?" | Thenics % rings; Calistack five states; Calisteniapp "Unlocked 78/703" (OBSERVED) | None |
| G4 | **Bodyweight-aware load**: added weight (+kg), assistance (band or counterweight, kg), with bodyweight as the base | Weighted pull-ups are "BW + 20 kg"; a band-assisted pull-up is *easier* than a pull-up | Calistree bands/counterweight/added weight; Calitracker "5+50kg"; Calisteniapp weighted records and e1RM (OBSERVED) | `weight_kg` only, ≥ 0, ambiguous at 0 |
| G5 | **Band inventory** (colour → approx kg) | Bands are identified by colour, not by kg | Calistree "save your exact elastic bands and their force"; "Add band colours throughout the app"; Calisteniapp user asks to input band strength (OBSERVED) | None |
| G6 | **Unilateral sides** (L/R) | Pistols, archer push-ups, one-arm work | Calistree R/L rows and between-sides timer (OBSERVED) | None |
| G7 | **"Clean" vs ragged sets, and attempts** | Only clean, full-range sets should count toward a level-up; balance skills are practised as attempts | Caliverse "3 clean sets" (second-hand); Calisteniapp "Attempts only indicator"; Thenics "form… must be mastered" (OBSERVED) | RPE only |
| G8 | **Hold timer as the input method**: count-up with target, get-ready countdown, beeps, voice, haptics, auto-log | Hands are on the floor or bar; typing seconds afterwards is error-prone | Calistree Time Attack, beeps and voice; Fitloop 30s dial; Thenics "Start Timer" and the audio request; Thenx complaints (OBSERVED) | Rest timer only; seconds typed by hand |
| G9 | **Routine slots that point at a ladder**, with rep or hold *ranges* and pairing / rest | The RR is "Pull-up progression 3×5–8, paired with squat, 90s" | RR JSON `mode: levels`; Liftosaur encoding (OBSERVED) | Slot = fixed exercise, single target |
| G10 | **Skill-practice blocks** (time-on-task, e.g. 5 min handstand) | Not sets × reps | RR Skill Work section (OBSERVED) | None |
| G11 | **Calisthenics records**: max reps (BW), max hold, best +kg at N reps, BW-inclusive e1RM, step reached | Same-rep weight PRs say nothing when weight is 0 | Calisteniapp Weighted / Endurance split, podium, e1RM from added weight (OBSERVED) | Weight PRs plus best hold |
| G12 | **Calisthenics progress views**: ladder position over time, max hold and max reps lines, skills-unlocked timeline | e1RM is meaningless for a tuck front lever | Thenics history; Calisteniapp unlocked strip; Progressive Workouts per-level charts (OBSERVED) | e1RM chart only |
| G13 | **Step back / deload / pause** | Injury, travel, stalls | Calisteniapp pause programs; Calistree "Too hard" (166 votes) and deload request (OBSERVED) | None |
| G14 | Circuits / EMOM / AMRAP timers | Conditioning days | Calisteniapp session types (OBSERVED) | None (lower value for EIO) |
| G15 | **Tempo / partial range** | Eccentric emphasis, partial-ROM work | Calistree "eccentric option"; Fitloop's write-up says Calistree logs partial-range variations (OBSERVED, second-hand). Tempo as a logged field: UNKNOWN in all three apps | None; low priority |

---

## 5. Recommendations

Dropped deliberately for a single self-coached user: social feeds, follow and likes, coaching marketplaces, AI coach and plan generators, challenges with prizes, XP economies, paywalls, and video libraries.

### TOP 5

#### ★1. Progressions: ladders with a current step and graduation targets
- **What:** A user-built ladder per skill or movement. For example, "Pull-up: Scapular pull → Arch hang → Negative → Pull-up → +10 kg". Each rung is an existing library exercise with a graduation target (sets × reps, or sets × seconds, optionally + kg). The ladder has a current step, and a history of moves up and down.
- **Why for one person:** This is *the* calisthenics progress unit. Without it, the log only shows that reps went down when you switched variation, which looks like regression.
- **Who has it:** Thenics, Calistree, Fitloop, Calitracker, Calistack (OBSERVED, §2).
- **Effort:** L (new screens on both clients). **DB:** yes (three new tables, below).
- **Implementation note:** Because each rung is a normal `exercises` row, existing history, PRs and charts keep working per variation for free.

#### ★2. Bodyweight-aware set logging: reps or hold, + added kg, − assistance, side, clean
- **What:** For exercises flagged *bodyweight*, the set row reads `reps` (or `seconds`) followed by optional chips: `+kg`, `assist` (band or kg) and `L/R`. A small "clean" toggle defaults to on. The Previous column shows `8 · +10 kg` or `25s · red band`.
- **Why:** It makes weighted pull-ups, banded pull-ups and archer sides recordable *truthfully*, and it lets PRs and level-ups count only comparable sets.
- **Who has it:** Calistree (bands, counterweight, added weight, eccentric, R/L); Calitracker (+kg, bands, holds); Calisteniapp (weighted records) (OBSERVED).
- **Effort:** M. **DB:** yes (columns on `exercises` and `session_sets`, an optional `bands` table).

#### ★3. A hold timer that *is* the input
- **What:** For a time exercise, the set row's primary control is a large circular timer showing the target ("30s").
  - Tap anywhere on the dial to start.
  - A 3-2-1 get-ready countdown with beeps.
  - Count up, with a beep each 5s, a distinct tone at the target, and a double-buzz.
  - Tap again (or press a volume key) to stop. The elapsed seconds are saved as the set.
  - Optional voice ("ten seconds… target").
  - Music is ducked, not stopped.
  - The screen is kept awake.
  - It keeps running with the screen locked.
- **Why:** This is the most-requested and most-complained-about interaction in the category. Hands are busy, and the phone is on the floor.
- **Who has it:** Calistree (Time Attack, 1s and 5s beeps, voice, haptics, ducking, background); Fitloop (30s dial); Thenics ("Start Timer", audio requests, music-stop bug) (OBSERVED).
- **Effort:** M. **DB:** no (the result goes into `duration_seconds`). It reuses the rest-timer plumbing.

#### ★4. Routine slots that follow a ladder, with ranges, pairs and rest
- **What:** A routine row can point to a progression instead of a fixed exercise. When a session starts, the slot resolves to the ladder's current step. Targets become ranges (reps 5–8, or 10–30s), and slots can be paired (A1/A2) with their own rest.
- **Why:** You write "RR-style Day A" once and never edit it as you progress. This is how practitioners actually structure training.
- **Who has it:** The RR as encoded in the open-source app (`mode: levels`); Liftosaur's RR; Calisteniapp program phases (OBSERVED).
- **Effort:** M. **DB:** yes (columns on `routine_exercises`).

#### ★5. Level-up prompt plus the ladder view (locked / current / mastered)
- **What:**
  - At the end of a session, for each ladder trained, check the current step's target against the clean sets just logged. If it is met (default: in 2 of the last 3 sessions, configurable to "1 session"), show **"Ready: move to Archer push-up?"** with [Move up] [Not yet].
  - The ladder screen shows numbered rungs. Mastered rungs get a filled check and the date. The current rung is highlighted with its target, best so far and a progress ring. Locked rungs are dimmed with a lock.
  - A "Step back" action is always present.
- **Why:** It decides *when* you've earned it without an opaque algorithm. Users reject coaches that move them silently (the Thenics complaint) and want manual overrides (Calistree's 166-vote "too hard / too easy").
- **Who has it:** Thenics rings; Calitracker "Level 3 Target"; Calistack states; Ascend 2-of-3; Progressive Workouts 3×8 / 3×30s (OBSERVED).
- **Effort:** M. **DB:** no beyond ★1.

### Further recommendations (ranked)

| # | What | Why (one person) | Apps | Effort | DB? |
|---|---|---|---|---|---|
| 6 | **Gym / Calisthenics mode switch** at the top of Fitness (see §7) | One module, two lenses; less clutter in each | Calistree equipment profiles; Fitloop programs (OBSERVED) | S | Small: `mode` on routines and sessions |
| 7 | **Calisthenics records**: max reps at bodyweight, max hold, best +kg × reps, BW-inclusive e1RM (bodyweight from the nearest weigh-in), assisted PRs kept separate | The PR badge must fire for "first 10 pull-ups" and "first 30s L-sit" | Calisteniapp Weighted / Endurance, podium, e1RM; Calistree band PR (OBSERVED) | S–M | No (computed) |
| 8 | **Skill progress charts**: ladder position over time (step chart), max hold and max reps per rung, "unlocked" timeline, "Steps mastered 14 / 40" | The calisthenics equivalent of the e1RM chart | Thenics history and rings; Calisteniapp unlocked 78/703; Progressive Workouts per-level chart (OBSERVED) | M | No |
| 9 | **Band inventory** (colour, label, approx kg); a set picks a band and shows its colour dot | Bands are remembered by colour | Calistree band sets and colours (OBSERVED) | S | Yes (`bands`) |
| 10 | **Unilateral logging**: L and R per set, with a between-sides countdown | Pistols, archers, one-arm work | Calistree (OBSERVED) | S–M | Yes (`side`, `is_unilateral`) |
| 11 | **Skill-practice block**: a timed block (e.g. 5 min handstand) that logs total minutes plus best hold and attempts | Balance skills aren't sets × reps | RR Skill Work; Calisteniapp "Attempts only" (OBSERVED) | S | Optional (reuse time sets: one set per attempt) |
| 12 | **Rest screen shows what's next** (exercise, target, last time) | Prepare grips, bands and rings during rest | Madbarz complaint; Calistree carousel (OBSERVED) | S | No |
| 13 | **Pause / deload**: mark a ladder "paused" or "deload week" (targets × 0.8, prompts off) | Injury, travel, stalls | Calisteniapp pause; Calistree deload request; RR community deload advice (OBSERVED) | S | Small (`paused_at` on progressions) |
| 14 | **Backfill and edit any session**, including a past date | Calisteniapp's most-cited limitation | Calisteniapp complaints; Calistree "add past sessions" (OBSERVED) | — | EIO likely already allows this. Keep it. |
| 15 | **Save every set immediately** (optimistic plus offline queue) | Caliverse crash reviews show the cost | (OBSERVED, complaint) | S–M | No |
| 16 | Circuit / EMOM / AMRAP interval timer | Occasional conditioning | Calisteniapp (OBSERVED) | M | Small |
| 17 | Tempo / partial ROM as an optional per-set note chip ("3-1-1", "½ ROM") | Rare, but useful for eccentrics | Calistree eccentric option (OBSERVED); tempo field UNKNOWN | S | Optional text column |

### Proposed data model for progressions (plain words)

These follow the existing naming in `supabase/migrations`.

**`exercises`: add two flags**
- `is_bodyweight` (yes/no, default no). When yes, the body is the load: a set's `weight_kg` means *added* weight, and assistance may be recorded. Pull-up, dip, push-up and L-sit are yes; bench press is no; a weighted pull-up is the same exercise with +kg. This removes the "0 kg" ambiguity.
- `is_unilateral` (yes/no, default no). When yes, sets are logged per side.
- `tracking_type` (reps | time) stays as it is.

**NEW `progressions`: one row per ladder**
- `id`, `user_id`.
- `name` (e.g. "Pull-up", "Front lever").
- `family`: push / pull / legs / core / handstand & balance / straight-arm statics / mobility. Suggested values, stored as text, for grouping the list; this mirrors Calistack's and Level Up's groupings.
- `current_step_id`.
- `position` (order on screen).
- `paused_at` (nullable).
- `notes`, `created_at`, `updated_at`.

**NEW `progression_steps`: the rungs**
- `id`, `progression_id`.
- `exercise_id`: the rung *is* a library exercise.
- `position` (1, 2, 3…).
- `branch` (null = main path; otherwise a short label such as "Rings" or "Archer path" for alternates, as in Fitloop's pull-up branches and the RR "Level 5-8" alternate).
- Graduation goal: `goal_sets`, plus **either** `goal_reps` **or** `goal_seconds` (an xor check, the same pattern as `session_sets`), plus optional `goal_added_kg` for weighted top rungs.
- Entry point: `start_reps` or `start_seconds` (the bottom of the range you restart at after moving up, e.g. 5 reps or 10s).
- `cue`: one line saying what "clean" means for this rung.

**NEW `progression_moves`: history of the current step**
- `id`, `progression_id`.
- `from_step_id` (nullable for the first placement), `to_step_id`.
- `kind`: start / up / back.
- `date`.
- `session_id` (the session that earned it, nullable).
- `note`.

Rung status is **derived, not stored**:
- *mastered*: there is an "up" move away from it.
- *current*: `current_step_id`.
- *locked*: later on the path.

**`session_sets`: add**
- `assist_kg` (nullable, > 0): assistance subtracted from bodyweight (counterweight, or a band's approximate kg).
- `band_id` (nullable, references `bands`).
- `side` (left / right / null).
- `clean` (yes/no, default yes): whether the set counts toward PRs and level-ups.
- Keep `weight_kg ≥ 0` as *added* load for bodyweight exercises. Do not use negative weight for assistance.
- `rpe` already exists.

**NEW `bands`** (optional, small): `id`, `user_id`, `label` ("Red"), `colour` (hex), `approx_kg`, `position`.

**`routine_exercises`: add**
- `progression_id` (nullable), with `exercise_id` becoming nullable, and a check that exactly one of the two is set.
- `target_reps_min` (the existing `target_reps` becomes the max), `target_seconds_min`, `target_seconds_max`.
- `rest_seconds`.
- `pair_group` (a short label such as "A" or "B"; rows sharing it alternate as a superset or pair).

**`routines` and `workout_sessions`: add**
- `mode` (gym | calisthenics, default gym): a lens for filtering and defaults, not a separate data path.

**Level-up check (logic, no storage)**
- After a session, for each progression whose current step was trained, take that session's **clean** sets of that exercise. Ignore assisted sets unless the rung itself is "band-assisted X".
- Met = at least `goal_sets` sets each reaching `goal_reps` (or `goal_seconds`), and `weight_kg ≥ goal_added_kg` if set.
- Prompt when met in 2 of the last 3 sessions on that step. Offer a per-ladder setting of "1 session".
- On confirm, insert a `progression_moves` row and update `current_step_id`.
- Show the step's `start_reps` as the new routine target.
- BW-inclusive e1RM for weighted calisthenics = (nearest `body_metrics.weight_kg` + `weight_kg` − `assist_kg`) through the existing e1RM formula. Computed, not stored.

### How logging a calisthenics set differs from a gym set

| Aspect | Gym set (today) | Calisthenics set (proposed) |
|---|---|---|
| Primary value | kg × reps | **reps** or **seconds**; kg is secondary |
| Load field | `weight_kg` = total bar or dumbbell weight | `+kg` chip = added (vest, belt); `assist` chip = band or counterweight; bodyweight implied |
| Time entry | type seconds | **hold timer dial** auto-fills seconds |
| Sides | n/a | L / R rows for unilateral exercises |
| Quality | RPE | `clean` toggle (default on) plus optional RPE |
| What the row shows | last kg × reps | last reps or seconds plus modifiers (`8 · +10kg`, `22s · red`), the **step target** (`goal 3×8`) and progress to it |
| PR | heavier kg at same reps; best e1RM | more reps at BW; longer hold; more +kg at N reps; first time at a new step |
| After the session | — | "Ready to move up?" per ladder trained |
| Quick actions | repeat last set | repeat last set; ±1 rep; ±5s; start timer |

---

## 6. UI/UX patterns worth adopting

Specific enough to build from. The source app is in brackets; EIO should restyle, not copy.

1. **Skill list cards** [Thenics]: one card per progression.
   - Left: an icon or silhouette.
   - Title: the skill.
   - Subtitle: "Step 4/7 · Advanced tuck".
   - Right: a progress ring for the current step (% of goal met by the best recent session).
   - Group the cards under family headers (Push / Pull / Legs / Core / Balance / Statics).
2. **Ladder screen** [Thenics, Calitracker, Fitloop]: a vertical numbered list.
   - Mastered rungs: filled check, muted text and the date mastered.
   - Current rung: accent border, "Goal 3 × 8 · Best 3 × 6", a ring, and a [Train] button.
   - Locked rungs: 40% opacity and a lock glyph.
   - Branches: small sub-headers ("Rings path", "Bar path") with their own numbering.
   - Header: overall "Step 4 of 7" and a thin segmented bar.
   - A "Step back" item in the overflow menu.
3. **Website only: tree canvas** [Calistree]. Horizontal tier bands (Beginner / Novice / Intermediate / Advanced) behind round nodes with curved arrows. It suits the desktop site's width. On the phone, stay with the ladder: Calistree is the app most criticised for complexity.
4. **Hold dial** [Fitloop, Thenics]:
   - A ~180 dp circle with the target ("30s") in large numerals, and − / + (5s steps) beside it.
   - Tapping the circle starts the timer. A ring fills toward the target and keeps counting past it in a second colour.
   - Under the dial: three mini stats, **Goal · Best · Last** (Thenics' flag / star / clock row).
   - One full-width ✓ to save.
   - A hit area of at least 64 dp, so it can be tapped with a knuckle or toe.
5. **Audio grammar** [Calistree, Thenics complaints]:
   - get-ready 3-2-1 (short beeps);
   - start (long beep);
   - every 5s (soft tick, optional);
   - target reached (two-tone);
   - rest over (distinct chime plus vibration).
   - Duck other audio instead of pausing it; keep the screen on; keep running with the screen locked.
   - Settings: voice on or off, ticks on or off, haptics on or off. Mirror cues as large on-screen text for silent use.
6. **Set row with Previous column** [Calistree, Calitracker, Fitloop]: `#` · Previous (`8 · +10kg`, dated) · value · modifiers · ✓. The target range sits in the column header ("reps 5–8"). Use Calitracker's notation for added weight, **`5+50kg`**: compact and readable.
7. **Session header carousel** [Calistree, Thenics]: round thumbnails for each exercise in the session, with a check when done and the current one enlarged. Tapping one jumps to it. Thenics' segmented top progress bar is the minimal version.
8. **Rest screen with "Up next"** [Madbarz complaint]: the countdown, then the next exercise name, its target, and last time's numbers.
9. **Level-up moment** [Calisteniapp achievements, Calistree mastery]: a single calm full-width banner at session end ("Pull-up ladder: ready for Archer pull-up") with [Move up] [Not yet]. No confetti economy.
10. **Difficulty colour scale** [Calitracker, Calistree tier bands]: one hue ramp (e.g. green → teal → amber → red → violet) used *only* for step difficulty, as a small left tab on rungs and pickers.
11. **"Unlocked" counter and timeline** [Calisteniapp]: on the calisthenics Progress view, "14 steps mastered" plus a vertical dated timeline of moves ("12 Aug · Tuck → Adv. tuck front lever").
12. **Records podium** [Calisteniapp]: per exercise, the current best plus the two previous bests with the dates and sessions that set them; long-press to discard a mistaken mark.
13. **End-of-session target nudge** [Calistree 5.0.3]: "You did 3 × 9 on a 5–8 target: raise the target?" One tap updates the routine slot.
14. **Visual direction.** The best-received looks are restrained: Thenics' monochrome with one accent colour, and Calisteniapp's dark-with-one-hot-accent. EIO's calisthenics mode could take one accent distinct from gym mode, so the mode is recognisable at a glance. INFERRED, a design judgement.

---

## 7. How Gym and Calisthenics should coexist in one module

**Evidence that one shared core works.** Calistree, Fitloop and Calitracker each run gym and calisthenics on **one exercise library, one session log and one PR system**. They differentiate by exercise attributes and by programs, not by separate databases (OBSERVED, §2.3 and §2.4). Calisteniapp went the other way, adding gym-style analytics (e1RM, tonnage) to bodyweight exercises with added weight (OBSERVED). INFERRED: the convergent design is "one data model, two lenses".

**Shared, unchanged**
- Calendar strip, streak, session history.
- Body view (weigh-ins, BMI). Weigh-ins also feed bodyweight-inclusive calisthenics load.
- Rest timer engine, session notes, "repeat last set".
- `exercises`, `workout_sessions`, `session_sets` and `routines` tables.
- A session may freely mix both kinds of exercise, e.g. weighted pull-ups on a gym day.

**Differs per mode**

| | Gym mode | Calisthenics mode |
|---|---|---|
| Fitness home | 7-day strip, today's routine, recent PRs | 7-day strip, **skill cards** (current step and ring), today's routine |
| Exercise picker | grouped by muscle | grouped by progression / family, with "current step" pinned on top |
| Set entry | kg × reps (or kg × seconds) | reps or **hold dial**, plus +kg / assist / side / clean |
| Routines | fixed exercises, sets × reps | **ladder slots**, ranges, pairs with rest |
| Records | heavier at same reps, e1RM | max reps, max hold, +kg × reps, BW-inclusive e1RM, step reached |
| Progress | e1RM line per exercise | ladder position step chart, max hold and reps per rung, unlocked timeline |
| Timer | rest | rest, **hold**, get-ready, between-sides, skill-practice block |
| Accent colour | current | distinct accent |

**Mechanics**
- A segmented control **[Gym | Calisthenics]** at the top of Fitness, remembered per device.
- It changes the defaults and filters of the four existing tabs. It does not create separate tabs. On the phone the swipeable tabs remain Log / Routines / Exercises / Body; in calisthenics mode the Exercises tab becomes "Skills" (progressions first, library second).
- `routines.mode` decides which list a routine appears in.
- `workout_sessions.mode` is set from the routine (or the current lens) so history can be filtered. The combined history remains the default.
- The set-entry form is chosen per exercise (`is_bodyweight`, `tracking_type`), **not** per mode, so a pull-up logs the same way in either mode. This is what prevents duplication.

---

## 8. Checklist status

| # | Question | Evidence needed | Status |
|---|---|---|---|
| 1 | Top 3 calisthenics apps on Android in 2026, with evidence | Play installs, ratings, reviews, recency; roundups | **Answered.** Play figures for 30+ candidates fetched; roundups cross-checked |
| 2 | How apps model a progression ladder | Screenshots, listings, open-source data | **Answered.** Thenics, Calistree, Fitloop, Calitracker, Calistack screenshots and listings; RR JSON |
| 3 | How apps decide a step is earned | Published thresholds | **Partial.** Rules published by RR (3×5–8 → 3×8; holds +5s to 30–60s), Progressive Workouts (3×8 / 3×30s), Ascend (2-of-3), Fitloop (3×5 → 3×8), Calitracker (per-level rep target), Caliverse (3 clean sets, second-hand). **The top 3 do not publish their formulas** (Thenics %, Calistree readiness/mastery, Calisteniapp EVO): UNKNOWN |
| 4 | How locked / unlocked / current levels look | Screenshots | **Answered** (Thenics rings, Calistree tier bands, Calitracker numbered path, Fitloop LEVEL rows, Calistack named states) |
| 5 | Skill families and grouping | Listings | **Answered** (Thenics skill list; Calistack Push/Pull/Core/Legs; Level Up's five classes; RR pairs plus skill work; Fitloop beginner/intermediate/advanced) |
| 6 | What gets logged per set (reps, hold, assistance, added weight, tempo, form, ROM, negatives) | Listings, changelogs, screenshots | **Mostly answered.** Reps, holds, +kg, bands, counterweight, eccentric, sides, RPE observed. Negatives are modelled as their own rung (RR, Caliverse). Form: a "clean sets" idea and an "attempts" indicator observed, but no app shows a per-set form field. **Tempo as a logged field: UNKNOWN.** Partial ROM: second-hand only |
| 7 | Programs and structure (circuits, EMOM, AMRAP, skill/strength split, rest, deload) | Help centres, RR | **Answered** (Calisteniapp session types; RR skill/strength split, pairs, rest; Calisteniapp pause; deload as community advice and a Calistree request) |
| 8 | Calisthenics progress visualisation | Screenshots, help | **Answered** (rings, unlocked counts, podium, experience profiles, per-level charts). Exact chart designs for max hold over time in the top 3: **partial** |
| 9 | Interaction design while training | Changelogs, reviews | **Answered** (Calistree audio and timer features; Fitloop dial; Thenics and Thenx complaints) |
| 10 | UI and visual design | Screenshots | **Answered** for the top 3 plus Calitracker and Fitloop (store screenshots only; in-app motion unseen) |
| 11 | Praise and complaints | Store reviews, feedback board, roundups | **Partial.** Store pages expose only a few reviews each; Reddit could not be fetched (blocked); r/calisthenics and YouTube not reviewed |
| 12 | How a combined app keeps Gym and Calisthenics as two modes | Calistree, Fitloop, Calitracker evidence | **Answered** (pattern observed; the EIO-specific design in §7 is INFERRED) |
| 13 | r/bodyweightfitness RR as practitioner evidence | Wiki | **Partial.** Read via Liftosaur's encoding (2018 rewrite) and the open-source app's older JSON; the live wiki text was not fetched |

**Still open, and how to close them:**
- Read the live r/bodyweightfitness RR wiki and FAQ in a browser.
- Check r/calisthenics threads on app preferences.
- Watch one walkthrough video each of Thenics' level-up moment and Calistree's Time Attack, to see the motion and audio.
- Raise the search budget for a follow-up pass on Thenics' unlock rule.

---

## Sources

**Google Play listings** (descriptions, screenshots, "what's new", visible reviews; fetched 2026-10-19)
- https://play.google.com/store/apps/details?id=com.abad.thenics
- https://play.google.com/store/apps/details?id=me.inakitajes.calisteniapp
- https://play.google.com/store/apps/details?id=com.calistree.calistree
- https://play.google.com/store/apps/details?id=com.madbarz.madbarzApp
- https://play.google.com/store/apps/details?id=com.sysops.thenx
- https://play.google.com/store/apps/details?id=com.caliverseapps.caliverse
- https://play.google.com/store/apps/details?id=com.fitloop
- https://play.google.com/store/apps/details?id=com.braziusProductions.calisthenicsworkouttracker
- https://play.google.com/store/apps/details?id=com.cali.stack
- https://play.google.com/store/apps/details?id=com.themovementathlete.app
- https://play.google.com/store/apps/details?id=com.hybridcalisthenics.app
- https://play.google.com/store/apps/details?id=com.axiommobile.sportsman
- https://play.google.com/store/apps/details?id=com.calimove.player
- https://play.google.com/store/apps/details?id=com.wallmann.exercisable_platform
- Play search pages for "calisthenics", "calisthenics skills", "bodyweight fitness", "calisthenics progression", "calimove", "madbarz", "calisthenics tracker" (used to enumerate candidates)

**App Store** (descriptions, version history, reviews)
- https://apps.apple.com/us/app/thenics/id1509531048 (and ?see-all=reviews)
- https://apps.apple.com/us/app/calisteniapp/id1265489771 (and ?see-all=reviews)
- https://apps.apple.com/us/app/calistree/id1558561315 (and ?see-all=reviews)
- https://apps.apple.com/app/id1551617282 (Progressive Workouts)
- https://apps.apple.com/app/id6765751498 (Ascend)
- https://apps.apple.com/app/id6759352254 (Level Up)

**Official sites and help**
- http://www.thenics.de
- https://calisteniapp.com
- https://help.calisteniapp.com/en/docs
- https://help.calisteniapp.com/en/docs/explore
- https://help.calisteniapp.com/en/docs/custom-sessions
- https://help.calisteniapp.com/en/docs/personal-records
- https://help.calisteniapp.com/en/docs/statistics
- https://help.calisteniapp.com/en/docs/settings
- https://help.calisteniapp.com/en/docs/today
- https://calistree.com/
- https://calistree.com/app-updates/
- https://calistree.com/blog/
- https://feedback.calistree.com/
- https://fitloop.app
- https://fitloop.app/skills
- https://fitloop.app/progressions
- https://fitloop.app/progressions/pullup-progression
- https://www.caliverse.app/exercises/pull-up-negative-109

**Reviews and roundups** (affiliate or vendor-authored; treat rankings as opinion)
- https://calisthenics.com/best-calisthenics-apps/
- https://calisthenics.com/calistree-app-review/
- https://fitloop.app/blog/best-calisthenics-apps (author: Fitloop)
- https://calistree.com/blog/best-calisthenics-apps-2026/ (author: Calistree)

**Practitioner structure**
- https://www.liftosaur.com/programs/recommended-routine
- https://github.com/mazurio/bodyweight-fitness-android (`app/src/main/res/raw/bodyweight_fitness_recommended_routine.json`, `app/src/main/kotlin/com/bodyweight/fitness/model/RoutineJson.kt`, `RoutineRepository.kt`)
- https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine: **not fetchable** (blocked); cited only through the sources above

**EIO's current state**
- `supabase/migrations/0011_fitness_v2.sql`
- `supabase/migrations/0014_fitness_detail.sql`
- `supabase/migrations/0018_simplify_muscle_tags.sql`
