# Hevy deep dive: what EIO's Fitness module should learn from the leading workout tracker

Research date: 19 October 2026. Scope: the EIO Fitness module (Android app and website) compared against Hevy (iOS, Android, web).

Method: public evidence only.
- Hevy's help centre was read in full: all 90 articles, current to October 2026, pulled from its public article endpoint ([index](https://help.hevyapp.com/api/v2/help_center/en-us/articles.json)). Help-centre articles are the strongest evidence in this report for how a feature behaves.
- Hevy's feature pages, both store listings, its public API specification, the r/Hevy community and a few third-party reviews were also read.
- Hevy's marketing screenshots on hevyapp.com feature pages were viewed so the visual design could be described. They are described here, not reproduced.
- No app was installed, decompiled or signed into, and no account was created.

**Evidence labels used throughout**

- **OBSERVED**: seen in the cited source. A screenshot is cited by the feature page it appears on.
- **INFERRED**: reasoned from evidence. The basis is stated.
- **UNKNOWN**: not established by any source I could reach.

**Limitations**

- **Search budget.** The shared web-search budget ran out partway through. After that I only fetched known URLs, so four things stay open: haptics, Android keypad behaviour, dark-mode visuals, and whether the exercise picker allows multi-select.
- **Reddit.** reddit.com blocks the fetch tool. I read Reddit threads through a public read-only mirror before the budget ran out. Sources cite the original reddit.com addresses.
- **Screenshot age.** Most screenshots on hevyapp.com date from late 2024 to late 2025, judging by the dates visible inside them. Hevy shipped a "Liquid Glass on iOS and Material 3 on Android" redesign in mid-2026 ([Community Update #1](https://www.reddit.com/r/Hevy/comments/1umaz02/)), so colours and spacing may have moved. One newer screenshot, on the [custom exercises page](https://www.hevyapp.com/features/custom-exercises/), shows the 2026 layout, and the report notes where it differs.
- **Platform.** Almost every screenshot is from iOS. Android-specific behaviour is UNKNOWN unless stated.

### Research checklist (set before searching)

| # | Question | Evidence needed |
|---|---|---|
| Q1 | Is Hevy a top tracker? Installs, rating, users, and why | Store listings, Hevy site, company posts, independent comparisons |
| Q2 | Active-workout screen: header, exercise block, set-row columns | Help centre, feature pages, screenshots |
| Q3 | How the previous workout's values appear, and auto-fill | Help centre |
| Q4 | Completing a set, set types, RPE, notes | Help centre, screenshots |
| Q5 | Supersets, reorder, replace, delete | Help centre, screenshots |
| Q6 | Workout duration timer, rest timer, timed exercises | Help centre |
| Q7 | What "Finish" does and shows | Feature page, help centre, screenshots |
| Q8 | Routines, folders, programs, starting a routine, targets while logging | Help centre, screenshots |
| Q9 | Exercise library: organisation, exercise types, custom exercises, detail page | Help centre, API spec, screenshots |
| Q10 | PR types, how PRs are announced, charts, 1RM | Help centre |
| Q11 | Statistics, calendar and heatmap, streaks, measurements, photos | Help centre, screenshots |
| Q12 | Bodyweight and calisthenics handling, and its weak spots | Help centre, Reddit |
| Q13 | Speed touches: keypad, auto-fill, plate and warm-up calculators, units, live activity, haptics, sound | Help centre, screenshots |
| Q14 | Visual design: colour, type, density, dark mode, charts, cards | Screenshots, website CSS, reviews |
| Q15 | What users love and what they complain about | Reddit, store listings, reviews |

---

## 1. Hevy's standing

The brief takes Hevy as given, so this section only checks that it deserves the place.

| Evidence | Figure | Label and source |
|---|---|---|
| Google Play listing | **5M+ downloads**; the listing's page data holds an exact count of about 8.5M. **4.9 stars from 280K reviews.** Released 29 Jun 2019, last updated 8 Oct 2026. In-app purchases $2.99 to $74.99. | OBSERVED, fetched 19 Oct 2026 ([Play](https://play.google.com/store/apps/details?id=com.hevy)) |
| App Store (US storefront) | **4.9 stars, about 99K ratings**, #38 in Health & Fitness. Version 3.2.0 shipped about 5 days earlier. | OBSERVED ([App Store](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350)) |
| Hevy's own site | "Loved by **17+ million** athletes" and "4.9 App Store & 4.9 Google Play (630,000+ ratings)". Golden Kitty, Product Hunt #1 and "featured by Apple" badges. | OBSERVED, company claim ([hevyapp.com](https://www.hevyapp.com/)) |
| Hevy team's 2025 recap | "crossed 10M users" in 2025; calls itself "the #1 strength training app in the world" | OBSERVED, company claim ([r/Hevy recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/)) |
| Release cadence | Head of Product says they ship "almost weekly", with a week of beta before each full release | OBSERVED ([Community Update #1](https://www.reddit.com/r/Hevy/comments/1umaz02/)) |
| Independent comparisons (2026) | Hevy beats Strong for most lifters on free features, Android parity and social. Strong suits people who want a plain, private logbook. | OBSERVED in search summaries of comparison blogs, some affiliate-driven, so weak evidence ([aitoolsbakery](https://aitoolsbakery.com/blog/hevy-vs-strong-app/), [repreturn](https://repreturn.com/strong-app-vs-hevy/)) |
| Garage Gym Reviews | Score 3.8. Pros: "Intuitive interface", "A lot of customization". Con: the free version is limited. | OBSERVED ([GGR](https://www.garagegymreviews.com/equipment/hevy)) |

**Why it is on top.** This is INFERRED from the evidence above and from section 2. Four reasons:

1. **The logging loop is tight.** Previous values sit inline, you tick a row, and a rest timer starts automatically. Almost every praise thread names one part of that loop.
2. **It is genuinely cross-platform.** Android has been a first-class platform since 2019.
3. **The statistics go deep**, including per-muscle set counts and per-exercise record charts.
4. **The team visibly responds to users.** Pinned notes, for example, shipped in October 2026 after years of requests.

**Two caveats on the numbers:**
- **Users.** Both 10M (Jan 2026) and 17M+ (Oct 2026) come from the company. Whether the gap is growth or a different way of counting is UNKNOWN.
- **Free-tier limits.** The help centre (updated Oct 2026) limits free users to **4 routines, 7 custom exercises and 3 months of history** ([features guide](https://help.hevyapp.com/hc/en-us/articles/33106320824727)). The Play listing still says "Create an unlimited amount of routines", and some 2026 comparisons repeat that. The two sources conflict, but the conflict doesn't matter for EIO.

---

## 2. Teardown

### 2.1 App map

OBSERVED in screenshots on [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/) and [workout-settings](https://www.hevyapp.com/features/workout-settings/):

- **Bottom tabs.** Home (a social feed), Workout, Coach (in some builds) and Profile.
- **Workout tab.** This is where you plan and start sessions: a "Quick Start" block, then routines in folders.
- **Profile tab.**
  - A small chart with **Duration / Volume / Reps** chips.
  - A 2×2 **Dashboard** of buttons: **Statistics, Exercises, Measures, Calendar**.
  - Your workout history.
  - Settings, behind the gear icon.

Hevy also has a web app at hevy.com. Its site pitches the web app for "Create And Plan Routines" and "Analyze Exercise Progress" (OBSERVED, [hevyapp.com](https://www.hevyapp.com/)): the phone is for logging, the desktop for planning and analysis.

### 2.2 Starting a workout

There are six ways in (all OBSERVED):

1. **Empty workout.** Workout tab, then "+ Start Empty Workout" ([help: log a workout](https://help.hevyapp.com/hc/en-us/articles/35361530647959)).
2. **From a routine.** Each routine card has a full-width blue **Start Routine** button ([help: workouts vs routines](https://help.hevyapp.com/hc/en-us/articles/33703513582871); screenshot on [gym-routines](https://www.hevyapp.com/features/gym-routines/)).
3. **Copy a past workout**, your own or anyone's. Open it, choose ⋯, then "Copy workout", and a live workout starts with the same exercises ([help: log a workout](https://help.hevyapp.com/hc/en-us/articles/35361530647959)).
4. **From the calendar.** Tap today or an earlier date, then "+" or "Log a workout" ([help: calendar](https://help.hevyapp.com/hc/en-us/articles/35380117933207)).
5. **From a widget.** The Quick Access widget starts an empty workout or a chosen routine, or opens measurement logging. The "Routine of the Day" widget maps each weekday to a routine ([help: widgets](https://help.hevyapp.com/hc/en-us/articles/36956630666647)).
6. **From Hevy Trainer** (Pro): a generated program ([help: Trainer](https://help.hevyapp.com/hc/en-us/articles/38385724273047)).

### 2.3 The active-workout (logging) screen

Below is a schematic of the layout, drawn for this report from the screenshots on [track-exercises](https://www.hevyapp.com/features/track-exercises/) and [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/). It is not Hevy's artwork.

```
┌─────────────────────────────────────────────────────┐
│ ˅  Log Workout                        (⏰)  [Finish] │  header
│ Duration        Volume         Sets        (body)    │  live stats strip
│ 12min 4s        630 kg         1                     │
├─────────────────────────────────────────────────────┤
│ (img) Dumbbell Row  ← accent colour, tappable     ⋮  │  exercise header
│ Slow and controlled on the way down                  │  routine / pinned note
│ Add notes here...                                    │  today's note (placeholder)
│ ⏱ Rest Timer: 2min 0s  ← accent, tappable            │
│ SET   PREVIOUS     ⇔KG    REPS    RPE    ✓           │  small grey caps
│  1    35kg x 18     35     18     [RPE]  [✓]  ← whole row tinted green
│  2    35kg x 18     35     18     [RPE]  [ ]  ← grey = target, not yet done
│  3    35kg x 18     35     18     [RPE]  [ ]  ← rows zebra-striped
│ [                  + Add Set                  ]      │  full-width grey button
├─────────────────────────────────────────────────────┤
│   … next exercise block …                            │
│ [            + Add Exercise           ]  (accent)    │
│ [ Settings ]                  [ Discard Workout ]    │  grey / red text
│ ┌─────────────────────────────────────────────────┐ │
│ │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ (progress)               │ │  floating rest bar
│ │  -15        01:59        +15         [Skip]     │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### Header and stats strip

- **Header.** OBSERVED in screenshots.
  - Left: a collapse chevron, then either the elapsed time in the accent colour or the title "Log Workout".
  - Right: an alarm-clock icon and a filled blue **Finish** button.
  - Tapping the elapsed time lets you **pause or resume the workout timer** ([help: duration and pause](https://help.hevyapp.com/hc/en-us/articles/34513981310615)).
  - The clock icon opens a **Timer**, a countdown for a timed effort ([help: inline timer](https://help.hevyapp.com/hc/en-us/articles/35379662997783)).
  - The chevron most likely minimises the live workout so you can browse the rest of the app. That is INFERRED from the icon; no source describes it.
- **Live stats strip.** "Duration / Volume / Sets" (OBSERVED on [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/)). Volume and Sets update as you tick sets (OBSERVED: the screenshot shows Volume 0 kg and Sets 0 before any tick, then 630 kg and 1 after).
- **Body figure.** The 2026 screenshot adds a small front-and-back body silhouette at the right of the strip. Its purpose is INFERRED to be a live map of the muscles trained so far (on [custom-exercises](https://www.hevyapp.com/features/custom-exercises/)).
- **Thin blue line.** A thin blue line under the header is visible in older screenshots. Its purpose is UNKNOWN.

#### Exercise block

All OBSERVED in screenshots unless marked.

- **Header row.** A small exercise thumbnail, the exercise name in the accent colour, and a ⋮ menu. Tapping the name opens the exercise's detail page, even mid-workout ([help: exercise performance](https://help.hevyapp.com/hc/en-us/articles/35382889578135)).
- **Notes.**
  - A routine note shows in normal text.
  - Below it, "Add notes here..." is the placeholder for today's note.
  - Since v3.2.0, pinned notes show with a pin icon (see Notes below).
- **Rest timer line.** "⏱ Rest Timer: 2min 0s" in the accent colour. In the 2026 layout this becomes two chips, "Rest: 2min 0s" and "Note" ([custom-exercises](https://www.hevyapp.com/features/custom-exercises/)).
- **Set table.** Covered in the next part.
- **"+ Add Set".** A full-width grey button under the table, labelled "+ Add Set" ([how to write sets and reps](https://www.hevyapp.com/features/how-to-write-sets-and-reps/)).

#### Set table: columns depend on the exercise type

| Exercise type (API name, from the [public API spec](https://api.hevyapp.com/docs/)) | Columns while logging | PRs tracked ([help: PRs](https://help.hevyapp.com/hc/en-us/articles/35649367857175)) |
|---|---|---|
| Weight & reps (`weight_reps`) | SET · PREVIOUS · KG · REPS · (RPE) · ✓. OBSERVED. | Heaviest weight, Best 1RM, Best set volume, Best session volume |
| Bodyweight reps (`bodyweight_reps`) | SET · PREVIOUS ("x 12") · REPS · (RPE) · ✓, with no KG column. OBSERVED, Chin Up screenshot on [live-pr](https://www.hevyapp.com/features/live-pr/). | Best set (most reps), Most session reps |
| Weighted bodyweight | KG means *added* weight ([help](https://help.hevyapp.com/hc/en-us/articles/38387131819799)). Column label UNKNOWN. | Heaviest weight, Best set volume |
| Assisted bodyweight (`bodyweight_assisted_reps`) | KG means *assistance* ([help](https://help.hevyapp.com/hc/en-us/articles/34380762441111)). Column label UNKNOWN. | Most reps (set), Best total reps. No weight PRs. |
| Duration (`duration`) | SET · PREVIOUS ("05:40") · TIME · ✓, with an optional inline stopwatch. OBSERVED. | Best time |
| Weight & duration (`weight_duration`, e.g. a weighted plank) | KG · TIME | Heaviest weight, Best time |
| Distance & duration (`distance_duration`) | distance · time | Longest distance, Longest time |
| Reps only (`reps_only`); short distance & weight (`short_distance_weight`) | UNKNOWN, seen only in the API spec | UNKNOWN |

Two related behaviours:
- **Weight unit per exercise.** Tapping the KG column header changes that exercise's unit between kg and lb (OBSERVED, [help: units](https://help.hevyapp.com/hc/en-us/articles/34953292892823)).
- **Fixed exercise type.** The type cannot be changed after a custom exercise is created. Duplicating the exercise is the only way, and that starts its history from zero (OBSERVED, [help: custom exercises](https://help.hevyapp.com/hc/en-us/articles/34264544382615)).

#### The "Previous" column

All OBSERVED unless marked.

- **Placement and format.** The previous session's values show inline, per set, in a grey column labelled **PREVIOUS**, formatted "45kg x 9". Bodyweight exercises show "x 12" and timed ones "05:40" ([help: previous values](https://help.hevyapp.com/hc/en-us/articles/36011896355479); [track-exercises](https://www.hevyapp.com/features/track-exercises/)).
- **RPE.** If RPE was logged, the value carries it too, e.g. "50lbs x 10 @ 8.5 RPE" ([help: RPE vs RIR](https://help.hevyapp.com/hc/en-us/articles/34490600233111)).
- **Tap to fill.** Tapping a previous value copies it into the current set ([track-exercises](https://www.hevyapp.com/features/track-exercises/)).
- **Matching.** Values are matched set by set. Sets beyond last time's count show blank, and the first time you do an exercise the column is blank. INFERRED from the page: matching is by position.
- **Where previous values come from** (Settings → Workouts → Previous Workout Values) ([help: previous vs routine values](https://help.hevyapp.com/hc/en-us/articles/34105442929943)):
  - **Any workout**: the last time you did the exercise anywhere.
  - **Same routine**: the last time you did it in this routine. Useful when a strength day and a hypertrophy day share a lift.

#### Targets and auto-fill

All OBSERVED unless marked.

- **Adding an exercise you've done before** pre-fills "the number of sets, the weight, and the reps you've done before" ([programming options](https://www.hevyapp.com/features/exercise-programming-options/)).
- **Routine targets** appear in the KG and REPS cells as grey placeholders. A rep-range target shows as "10-12". When you tick the set, the value turns black. Screenshot on [track-workouts](https://www.hevyapp.com/features/track-workouts/), where Leg Press reads "120 · 10-12".
- **Routine values update themselves.** After a workout, the routine's stored weight and reps update to what you actually did. Turn this off with "Update Routine Values" on the Save screen. Exercises using a rep range never auto-update ([help: previous vs routine values](https://help.hevyapp.com/hc/en-us/articles/34105442929943)). The routine therefore drifts forward with you.

#### Completing a set

All OBSERVED.

- **Tick.** Tap the ✓ box at the right of the row.
- **Visual change.** The **whole row turns pale green** and the checkbox fills green with a white tick. Unticked rows keep alternating white and very light grey stripes (screenshots on [track-exercises](https://www.hevyapp.com/features/track-exercises/) and [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/)).
- **What ticking triggers:**
  - the exercise's **rest timer starts** ([help: rest timer](https://help.hevyapp.com/hc/en-us/articles/35385404949143));
  - a "check set" sound plays, with its own volume setting;
  - a live PR banner shows if the set is a record.
- **Only ticked sets are saved.** "You can finish a session so long as you mark at least one set as complete", and only completed sets are kept ([workout-log](https://www.hevyapp.com/features/workout-log/)).

#### Set types

All OBSERVED.

- **How to change a type.** Tap the set number. A bottom sheet titled "Select Set Type" offers **W Warm Up Set · 1 Normal Set · F Failure Set · D Drop Set · ✕ Remove Set**, each with a "?" help icon ([help: set types](https://help.hevyapp.com/hc/en-us/articles/34896293707927); screenshot on [workout-set-types](https://www.hevyapp.com/features/workout-set-types/)).
- **The type replaces the number.** A typed set shows its letter in the SET column: **W in amber, F in red, D in blue**. **Only normal sets are numbered**: W, W, 1, 2, F and 1, 2, 3, D, D (screenshots on [workout-set-types](https://www.hevyapp.com/features/workout-set-types/) and [what-are-supersets](https://www.hevyapp.com/features/what-are-supersets/)).
- **Drop sets don't start the rest timer.** The timer does not start if the *next* set is a drop set ([help: set types](https://help.hevyapp.com/hc/en-us/articles/34896293707927)).
- **Warm-ups and statistics.**
  - Since 2025, warm-up sets no longer count toward total volume ([2025 recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/)).
  - A setting, "Warm-up Sets", decides whether warm-ups count in stats and PRs, and recalculates history when changed ([help: workout settings](https://help.hevyapp.com/hc/en-us/articles/33882110558743); [workout-settings](https://www.hevyapp.com/features/workout-settings/)).
  - "Sets per Muscle Group" *does* include warm-ups ([help](https://help.hevyapp.com/hc/en-us/articles/44128140257431)).
  - These rules are not fully consistent with each other (INFERRED).
- **Failure sets and zero reps.** The help article says you cannot enter 0 reps. The 2025 recap says "failure sets accept zeros". The sources conflict; the recap is probably newer (INFERRED from its date).

#### RPE

All OBSERVED unless marked.

- **Off by default.** Turn it on in Settings → Workouts → RPE Tracking. Turning it on adds an RPE column for *rep-based* exercises only ([help: RPE](https://help.hevyapp.com/hc/en-us/articles/35687721776663)).
- **The cell.** Shows a grey "RPE" pill until a value is set.
- **The picker.** Tapping the pill opens a "Log Set RPE" sheet:
  - a subtitle naming the set, e.g. "Set 1: 50kg x 12 reps";
  - a large number readout;
  - a horizontal scale **6 · 7 · 7.5 · 8 · 8.5 · 9 · 9.5 · 10**;
  - a Done button.

  Screenshot on [gym-progress](https://www.hevyapp.com/features/gym-progress/). Each value carries a reps-in-reserve description, e.g. "RPE 8 – could have done 2 more reps".
- **The value set matches the API's RPE enum**, `[6, 7, 7.5, 8, 8.5, 9, 9.5, 10]` ([API spec](https://api.hevyapp.com/docs/)).
- **RPE in routines.**
  - An older feature page says RPE is not available in routines ([programming options](https://www.hevyapp.com/features/exercise-programming-options/)).
  - A newer routine-editor screenshot shows a **TARGET RPE** column ([what-are-supersets](https://www.hevyapp.com/features/what-are-supersets/)).
  - Target RPE in routines now looks supported (INFERRED: the screenshot is newer than the page text).

#### Notes: three kinds since v3.2.0 (October 2026)

All OBSERVED ([pinned notes post](https://www.reddit.com/r/Hevy/comments/1x509fz/); [App Store what's new](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350)).

1. **Pinned to exercise.** For machine settings, grip and form cues. It shows every time you do that exercise in any workout, and you can edit it from the exercise's How-to tab.
2. **Pinned to routine.** E.g. "3s pause". It shows whenever you run that routine, and editing it mid-workout updates the routine.
3. **Workout note.** For today only. Next time you do the exercise it appears as a **greyed-out placeholder**, so you see what happened last time, and it is discarded when that workout saves ([help: notes](https://help.hevyapp.com/hc/en-us/articles/34463684392983)).

Routine notes can include a clickable link, such as a form video ([help: exercise notes](https://help.hevyapp.com/hc/en-us/articles/36011779117591)). Users had asked for permanent notes for years ("Please add permanent exercise notes", 355 upvotes, [r/Hevy](https://www.reddit.com/r/Hevy/comments/1u57fu4/)).

#### Exercise ⋮ menu

OBSERVED: a bottom sheet with **Reorder Exercises · Replace Exercise · Add To Superset · Add Warm Up Sets · Remove Exercise** (Remove in red) (screenshot on [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/)).

For exercises that use your full bodyweight, the menu also has **Update Bodyweight**. It logs a new bodyweight from inside the workout so volume can be calculated ([help: bodyweight](https://help.hevyapp.com/hc/en-us/articles/44098622782487)).

The reorder interaction itself is not shown. A list with drag handles is INFERRED, because the help centre describes drag-to-reorder elsewhere (folders).

#### Supersets and circuits

All OBSERVED unless marked ([help: supersets](https://help.hevyapp.com/hc/en-us/articles/35650286563095); [help: circuits](https://help.hevyapp.com/hc/en-us/articles/36954623739415)).

- **Creating one.** ⋮ → "+ Add To Superset", then tap the partner exercise in a list. To grow a superset into a circuit, add a third exercise to one already in it.
- **Colour coding.** Each superset gets its own colour:
  - a coloured "Superset" pill sits under the exercise name;
  - in the picker, member exercises carry a coloured vertical bar;
  - history cards show the same bar against superset exercises.

  Screenshots on [what-are-supersets](https://www.hevyapp.com/features/what-are-supersets/) and [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/).
- **Smart Superset Scrolling** (a setting). Ticking a set auto-scrolls to the next exercise in the superset, and wraps back to the first after the last.
- **Circuits.** Put the rest timer only on the last exercise of the circuit.

#### Deleting a set

Swipe left on the row to reveal a red **Delete**, or tap the set number and choose "Remove Set" (OBSERVED, [help: delete](https://help.hevyapp.com/hc/en-us/articles/38030200802583); [how to write sets and reps](https://www.hevyapp.com/features/how-to-write-sets-and-reps/)).

#### Rest timer

All OBSERVED ([help: rest timer](https://help.hevyapp.com/hc/en-us/articles/35385404949143); [rest-timer page](https://www.hevyapp.com/features/workout-rest-timer/); screenshots on both).

- **Per exercise.** Each exercise has its own rest duration. Tap "Rest Timer" under the exercise name to get a bottom-sheet wheel picker:
  - "off" at the top;
  - **5-second steps up to 2 min** (1min 50s, 1min 55s, 2min 0s);
  - **15-second steps after that** (2min 15s, 2min 30s …);
  - a range of 5 s to 5 min;
  - a blue Done button.
- **Default for new exercises.** Settings → Workouts → Default Rest Timer applies to exercises added later. It never overwrites an exercise you have set by hand, even outside a routine. The exercise's rest choice is remembered across workouts.
- **Starts automatically** when you tick a set, unless the next set is a drop set.
- **Running timer.** A **floating card docked at the bottom** shows:
  - a thin progress bar along its top edge;
  - **−15**, a large "01:59", **+15** and a blue **Skip**.

  ±15 changes only *this* countdown. To change the exercise's duration, use the picker.
- **When the number keypad is open**, the same timer controls dock directly above the keypad, with a keyboard-dismiss key (screenshot on [live-pr](https://www.hevyapp.com/features/live-pr/)).
- **When it ends.** A notification fires. There are 5 timer sounds, and volume is High, Normal, Low or Off.
- **Large Rest Timer.** Shipped in 2025 per the [2025 recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/). Its form is UNKNOWN.

#### Workout duration

All OBSERVED ([help: duration and pause](https://help.hevyapp.com/hc/en-us/articles/34513981310615)).

- **The timer runs from start.** Tap it to pause or resume (phone only, not the watch).
- **Editable on save.** Duration and start date/time can be changed on the Save Workout screen with a scroll picker, or later via Edit Workout.

#### Timed exercises

All OBSERVED ([help: inline timer](https://help.hevyapp.com/hc/en-us/articles/35379662997783)).

- **The inline control counts up.** The play button beside a TIME cell is a **stopwatch**: it counts *up* and records the elapsed time when stopped.
- **Users often get this wrong.** They type a target and press play expecting a countdown, and the help centre has a whole article clearing this up.
- **Countdown lives elsewhere.** A real countdown is the separate header clock → "Timer", and the time must then be typed in by hand.

#### Plate and warm-up calculators

OBSERVED, with screenshots on [weight-plate-calculator](https://www.hevyapp.com/features/weight-plate-calculator/) and [warm-up-set-calculator](https://www.hevyapp.com/features/warm-up-set-calculator/).

**Plate calculator.** Turn it on in settings. Afterwards, editing the weight of a barbell exercise shows a "Calculator" button above the keyboard. It opens a bottom sheet with:
- the target weight;
- a **drawn barbell, with plates as blue blocks sized and labelled by weight**;
- "Available Equipment" with plate toggles (25 / 20 / 15 / 10 / 5 …);
- a bar choice: Standard 20 kg, Short 15 kg, EZ 7.5 kg;
- "Manage", for adding custom plates and bars.

If the target can't be made with what you have, it shows the closest achievable weight ([help](https://help.hevyapp.com/hc/en-us/articles/34518876511383)). It works for barbells only.

**Warm-up calculator** (Pro).
- **Using it.** ⋮ → Add Warm Up Sets opens a sheet: enter the target weight, see a formula table (e.g. 40 % × 5 → 30 kg × 5, 60 % × 5, 80 % × 3), then tap **Insert Warmup Sets**. W rows are inserted above the working sets.
- **Configuring it.** The formula is editable, and plate and dumbbell rounding increments are set in settings ([help](https://help.hevyapp.com/hc/en-us/articles/35650921359639)).

#### Lock screen and notification

OBSERVED ([help: live activity](https://help.hevyapp.com/hc/en-us/articles/35649846517399); [live-activity page](https://www.hevyapp.com/features/live-activity/)).

- **What it shows** (iOS and Android): the current exercise, sets done, the next set's prescribed weight and reps, previous performance and elapsed time.
- **What you can do from it:** **mark a set complete** without unlocking, and adjust the rest timer by ±15 s or skip it.
- **Android.** It is a lock-screen and heads-up notification; you must enable lock screen, badge and pop-up notifications.

#### Other workout settings

All OBSERVED ([help: workout settings](https://help.hevyapp.com/hc/en-us/articles/33882110558743)).

- Keep Awake During Workout.
- Inline Timer (the stopwatch).
- Live PR Notification, with its own volume.
- First Day of the Week, which drives the calendar and streaks.

Haptics are not mentioned anywhere in the help centre or on the feature pages, so they are UNKNOWN.

#### Bottom of the workout

The bottom of the workout has an accent **+ Add Exercise** button, then grey **Settings** and red-text **Discard Workout** buttons (OBSERVED).

There is also a **150-set cap** per workout or routine ([help](https://help.hevyapp.com/hc/en-us/articles/34896183826455)).

### 2.4 Finishing a workout

All OBSERVED ([workout-log](https://www.hevyapp.com/features/workout-log/); [help: update routine](https://help.hevyapp.com/hc/en-us/articles/38387296276375); screenshots on [workout-log](https://www.hevyapp.com/features/workout-log/) and [shareable](https://www.hevyapp.com/features/shareable/)).

1. **Finish.** Tap Finish (top right). This needs at least one ticked set; unticked sets are dropped.
2. **Save Workout screen.**
   - The title, pre-filled from the routine.
   - **Duration** (accent, editable), **Volume** and **Sets**.
   - **When** (date and time, editable).
   - "Add a photo / video".
   - A Description, placeholder "How did your workout go? Leave some notes here...".
   - Visibility, health and Strava sync, and Routine Settings (the "Update Routine Values" toggle).

   Nothing is required.
3. **Routine-change prompt.** If you reordered, added or removed exercises or sets, a bottom sheet appears:
   - a clipboard icon and **'Update "Pull"'**;
   - the change in plain words: **"You added 2 sets."**;
   - a blue **Update Routine** button and a grey **Keep Original Routine** button.

   Changes to weight or reps alone don't trigger it.
4. **Summary.** "**Good job!** This is your **477th** workout" (an ordinal count). If it is the week's first workout, the summary also shows the streak. A swipeable card carousel follows:
   - Duration, Volume and Sets with a muscle radar;
   - **"You lifted a total of 13 264 kg – That's like lifting a truck!"**, with an illustration;
   - new PRs;
   - the last 7 days' consistency;
   - a per-exercise breakdown with a muscle diagram;
   - the routine name over a 2×2 grid: Duration, Volume, Exercises, Sets.

   Share targets (Stories, link, copy text, X) and a choice of background (dark, light, transparent) follow. A blue **Done** sits at the bottom.

### 2.5 History

All OBSERVED (screenshots on [start-empty-workout](https://www.hevyapp.com/features/start-empty-workout/); [help: delete](https://help.hevyapp.com/hc/en-us/articles/38030200802583)).

**A workout card shows:**
- an avatar, name and date;
- the **workout title** in bold;
- **Time 52min · Volume 9,355 kg**;
- one line per exercise ("6 sets Bench Press (Barbell)") with a thumbnail. Superset exercises carry the coloured left bar.
- "See 2 more exercises" after the first few.

**The card's ⋯ menu:** **Save as Routine · Copy Workout · Edit Workout · Delete Workout** (Delete in red). Edit Workout reopens the full set editor with Cancel and Save.

**Deleting.** Deleted workouts can't be recovered, and there is no bulk delete ([help: reset data](https://help.hevyapp.com/hc/en-us/articles/35119576252951)).

### 2.6 Routines, folders, programs

All OBSERVED ([help: build a program](https://help.hevyapp.com/hc/en-us/articles/34953606698903); [help: routine library](https://help.hevyapp.com/hc/en-us/articles/36011518408983); screenshots on [track-workouts](https://www.hevyapp.com/features/track-workouts/) and [gym-routines](https://www.hevyapp.com/features/gym-routines/)).

- **A routine** is a plan. A **workout** is a logged session.
- **The routine editor** has Cancel, a title field and Save/Update. Each exercise block shows:
  - routine notes and the rest timer;
  - a set table: SET · KG · REPS▾ (tap it to switch to **REP RANGE "8 to 10"**) · TARGET RPE.

  Warm-up W rows can be included, so **targets are per set, not per exercise**. Duration exercises take a TIME target.
- **Folders.** A folder icon next to "Routines" creates one. Folders collapse and show a count ("Beginner Push/Pull/Legs (3)"). Long-press and drag moves a routine between folders.
- **Routine ⋯ menu:** Share · Duplicate · Edit · Delete.
- **The Explore library.**
  - 26 programs, filterable by Level, Goal and Equipment.
  - Each program card has a bold typographic cover ("PUSH PULL LEGS").
  - Program detail lists level, equipment, goal and the number of routines. Saving a program creates a folder.
  - Routine categories: At home, Travel, Dumbbells only, Band, Cardio & HIIT, Gym, **Bodyweight**.
- **Hevy Trainer** (Pro) generates a program from your answers ([help: Trainer settings](https://help.hevyapp.com/hc/en-us/articles/43572343844247)):
  - **inputs:** goal, level, equipment, frequency, duration, focus muscle, cardio, injuries and excluded exercises;
  - **splits** chosen by frequency;
  - **rest-length presets:** Short (about 1:15–1:45), Medium (about 1:45–2:15), Long (about 2:00–3:00);
  - **progressive-overload suggestions.** These are algorithmic; the help centre says "not AI".

### 2.7 Exercise library, picker and detail page

All OBSERVED unless marked.

**Library.**
- **Size:** 400+ exercises, each with an animation and step-by-step instructions ([help: library](https://help.hevyapp.com/hc/en-us/articles/35688251991575)).
- **Muscle groups:** 20 in the API (`abdominals, shoulders, biceps, triceps, forearms, quadriceps, hamstrings, calves, glutes, abductors, adductors, lats, upper_back, traps, lower_back, chest, cardio, neck, full_body, other`).
- **Equipment:** 9 categories (`none, barbell, dumbbell, kettlebell, machine, plate, resistance_band, suspension, other`).
- **Muscle tagging.** Every exercise has **one primary and any number of secondary muscles** ([API spec](https://api.hevyapp.com/docs/)).

**Picker ("Add Exercise").** Screenshots on [exercise-library](https://www.hevyapp.com/features/exercise-library) and [track-workouts](https://www.hevyapp.com/features/track-workouts/).
- **Top bar:** Cancel · Add Exercise · **Create**.
- **Search** sits above two equal buttons, **All Equipment** and **All Muscles**. Each opens a bottom-sheet list:
  - equipment entries have silhouette icons;
  - muscle entries show a small body figure with the muscle **highlighted in red**.
- **Lists.** "Recent Exercises" comes first. Each row shows a thumbnail, the name, the primary muscle in grey, and a **chart icon** that opens the exercise's progress.
- **Library page order.** Recently logged first, then your custom exercises ([help: exercise performance](https://help.hevyapp.com/hc/en-us/articles/35382889578135)).
- **Multi-select** while adding is UNKNOWN.

**Custom exercise form** ([help: custom](https://help.hevyapp.com/hc/en-us/articles/34264544382615)):
- the fields: name, image/video, equipment, primary and secondary muscles, and exercise type;
- **Duplicate** forks a library exercise into a custom one with fresh history.

Hevy itself recommends duplicating an exercise per gym when machines differ ("Leg press – Technogym") ([help: machines](https://help.hevyapp.com/hc/en-us/articles/43651329105687)).

**Exercise detail: three tabs, Summary · History · How to.** Screenshots on [exercise-performance](https://www.hevyapp.com/features/exercise-performance/) and [exercise-library](https://www.hevyapp.com/features/exercise-library).

- **Summary**
  - Animation, name, "Primary: Chest", "Secondary: Shoulders, Triceps", and a tip link ("How to log dumbbell exercises").
  - A **headline value with its date** ("57.5 kg Jan 5") over a line chart, with a range dropdown (Last 3 months / Year / All time).
  - **Metric chips** under the chart choose what's plotted:
    - weight exercises: Heaviest Weight, One Rep Max, Best Set Volume, Session Volume, Total Reps;
    - bodyweight: Most Reps (Set) and Session Reps;
    - duration: Best Time;
    - cardio: Best Pace, Longest Distance, Longest Time.
  - **Personal Records** rows, each with a "?" explainer.
  - A collapsible **Set Records** table: the heaviest weight at each rep count.
  - **Strength Level** (Beginner to Elite, compared with other users) on about 13 barbell and machine lifts ([help: strength level](https://help.hevyapp.com/hc/en-us/articles/38001696749335)).
- **History.** Every past session with this exercise: routine name, date and time, set rows ("35kg x 18 reps"). A PR set has a medal with its PR type under it.
- **How to.** The animation and numbered instructions. Pinned exercise notes now live here too.

### 2.8 Records and progress

All OBSERVED ([help: PRs](https://help.hevyapp.com/hc/en-us/articles/35649367857175); [help: set records](https://help.hevyapp.com/hc/en-us/articles/38279531346455); [help: live PR](https://help.hevyapp.com/hc/en-us/articles/36012016405655); [help: 1RM](https://help.hevyapp.com/hc/en-us/articles/36954464726167)).

- **Two kinds of record.**
  - **PRs** are the per-type records listed in section 2.3. They trigger the live banner and a medal.
  - **Set Records** are the heaviest weight for each rep count. They show only in the table and are **never announced**.
- **The live PR banner.** When a ticked set is a PR:
  - a **floating rounded toast drops over the header** with the exercise thumbnail, the name and the record in amber, e.g. "Most Reps – 13" or "Heaviest Weight – 55 kg";
  - the set's number turns into a **gold medal**;
  - a PR sound plays at its own volume.

  Screenshot on [live-pr](https://www.hevyapp.com/features/live-pr/). The medal also appears in history and on the saved workout.
- **Estimated 1RM.** A lookup table, not a formula: weight ÷ percentage for the rep count. The table runs 1 rep 100 %, 3 reps 94 %, 5 reps 89 %, 8 reps 81 %, 10 reps 75 %, 12 reps 71 %, 15 reps 67 %, 20 reps 60 %, and 30+ reps 50 %. Above 30 reps the estimate stays flat.
- **Assisted exercises reward reps only.** Less assistance is **not** treated as progress; only reps count.

Users want three things here ([2025 recap comments](https://www.reddit.com/r/Hevy/comments/1q6e2fx/)):
- PR resets, e.g. yearly or after an injury;
- a rep cutoff for the 1RM estimate;
- time-based x-axes on progress charts.

### 2.9 Statistics, calendar, streaks

All OBSERVED ([help: statistics](https://help.hevyapp.com/hc/en-us/articles/35702030346903); [help: sets per muscle](https://help.hevyapp.com/hc/en-us/articles/44128140257431); [help: calendar](https://help.hevyapp.com/hc/en-us/articles/35380117933207); screenshots on [gym-progress](https://www.hevyapp.com/features/gym-progress/), [training-chart](https://www.hevyapp.com/features/training-chart/), [gym-consistency](https://www.hevyapp.com/features/gym-consistency/) and [monthly-report](https://www.hevyapp.com/features/monthly-report)).

- **Last 7 days body graph.** A workout count plus a **front and back muscle heat map**. The figure's sex follows your profile.
- **Set count per muscle** (Pro).
  - Two dropdowns: a range (Last 30 days / Year …) and a bucket (Week / Month / Year).
  - A multi-line chart, one colour per muscle, with a checkbox list of muscles and their totals underneath.
  - **Counting rule:** 1 per set for the primary muscle, **0.5 for each secondary**, warm-ups included.
- **Muscle distribution.** A **radar chart** with six axes (Back, Chest, Core, Shoulders, Arms, Legs).
  - The current period is a translucent accent fill; the previous period of equal length is a grey fill on top.
  - Below it, four tiles (Workouts, Duration, Volume, Sets), each with a **delta arrow**: green ↑ for up, grey ↓ for down.
- **Main exercises.** Your most-logged exercises for a period.
- **Monthly report** (last completed month only).
  - A **12-bar chart** with the report month in the accent colour and the other months light grey.
  - Metric chips (Workouts / Duration / Volume / Sets).
  - A 2×2 summary with deltas, PRs, a calendar, muscle distribution and top exercises.
- **Calendar.** A vertically scrolling list of months.
  - Workout days are **filled accent circles with the routine name in tiny text underneath**.
  - Two chips at the top: "🔥 23 week streak" and "🌙 1 rest day" (days since your last workout).
  - It can't be used to plan future workouts.
- **Year heatmap** (a share card). A grid of small squares for each month, filled accent on workout days and grey otherwise, plus a multi-year strip variant (screenshot on [gym-consistency](https://www.hevyapp.com/features/gym-consistency/)).
- **Streak is weekly**: at least one workout per calendar week. The streak's ordinal is announced on the week's first workout. A missed week can be repaired by back-dating a workout ([help: streak](https://help.hevyapp.com/hc/en-us/articles/34467766576279)).
- **Year in Review** each December.

### 2.10 Body measurements and progress photos

All OBSERVED ([help: body composition](https://help.hevyapp.com/hc/en-us/articles/35385479603479); [help: measurements](https://help.hevyapp.com/hc/en-us/articles/34462134138775); screenshots on [track-body-measurements](https://www.hevyapp.com/features/track-body-measurements/) and [progress-photos](https://www.hevyapp.com/features/progress-photos/)).

- **What's tracked.**
  - Free: weight and waist.
  - Pro adds body fat % and neck, shoulder, chest, **left/right** biceps, forearms, thighs and calves, abdomen and hips.
  - The API also has `lean_mass_kg`. It stores **one wide row per date** with nullable columns.
- **The Measures page.**
  - Progress photos at the top.
  - A line chart with a headline value and date ("94.9kg Dec 10") and a range dropdown.
  - **Metric chips** (Bodyweight · Bodyfat % · Neck …).
  - A dated history list below.
- **The log form.**
  - The date, then the progress picture (Take Photo / Select Library Photo).
  - Then every measurement, with **the last value as a grey placeholder**, entered on a decimal keypad.
- **Photos.**
  - **One photo per day**, and only you can see it.
  - The in-app camera has an **"Overlay" button that ghosts your last progress photo** so you can line up the same pose.
  - Any photo can be compared side by side with another.

### 2.11 Bodyweight and calisthenics in Hevy, and where it is weak

**How it works.** All OBSERVED ([help: bodyweight types](https://help.hevyapp.com/hc/en-us/articles/44098622782487); [help: weighted](https://help.hevyapp.com/hc/en-us/articles/38387131819799); [help: assisted](https://help.hevyapp.com/hc/en-us/articles/34380762441111)).

- **Three bodyweight types:**
  - bodyweight reps;
  - assisted, where load = bodyweight − assistance;
  - weighted, where load = bodyweight + added.
- **Bodyweight counts toward volume only for a hard-coded list of "100 % bodyweight" library exercises:** pull-up, chin-up, dips and handstand push-up. It also needs a logged bodyweight.
- **Partial-bodyweight moves** like push-ups count only the added weight.
- **Custom bodyweight exercises never include bodyweight in volume.**
- **Bodyweight can be updated mid-workout** from the exercise ⋮ menu.

**Where it is weak.** Each point is OBSERVED unless marked.

1. **Assisted progress is invisible.** Using less assistance isn't a PR, so assisted exercises reward reps only ([help: set records](https://help.hevyapp.com/hc/en-us/articles/38279531346455)).
2. **No assisted hold.** Duration types can't record assistance, so a band-assisted planche or front-lever hold can't be logged properly. A user's workaround, the "weight + duration" type, "will mess with the PR system" ([r/Hevy, Aug 2026](https://www.reddit.com/r/Hevy/comments/1vxvtg4/)).
3. **No modifiers, so variations fragment history.** Rings vs bar, band colour per set, tuck vs straddle: each variation must be its own custom exercise. Because the exercise type is fixed at creation, moving from assisted to weighted means a new exercise too. Users report "hard to compare work over time when skills change quickly" ([r/Hevy, Jul 2026](https://www.reddit.com/r/Hevy/comments/1umr66b/)). They ask for rings, parallettes and parallel-bar equipment, per-set band logging, and lever and planche progressions (same thread). They also ask for user-defined **skill trees** and filters like "ring pull-ups only" ([martial_barz request](https://www.reddit.com/r/Hevy/comments/1n24nsg/)).
4. **The library is thin on skills.** Users ask for front lever, back lever, planche and skin-the-cat, and for "calisthenics isometrics" ([r/Hevy](https://www.reddit.com/r/Hevy/comments/1lg16yx/), [r/Hevy](https://www.reddit.com/r/Hevy/comments/1gtynyy/)).
5. **Timed sets confuse.** The inline timer counts up, not down (section 2.3).
6. **No RPE on holds.** The RPE column exists for rep-based exercises only ([help: RPE](https://help.hevyapp.com/hc/en-us/articles/35687721776663)).
7. **Workarounds are crude.** One user makes difficulty a fake weight: "each step forward adds 1 kg" for ring rows ([r/Hevy](https://www.reddit.com/r/Hevy/comments/1fxm6qh/)).
8. **The tools are gym-shaped.** The plate and warm-up calculators, 1RM, Strength Level and leaderboards are all barbell-oriented. Hevy has **no notion of a calisthenics mode** (INFERRED: no source mentions one, and its calisthenics page offers only custom exercises, per [calisthenics page](https://www.hevyapp.com/use-cases/calisthenics-app/)).

### 2.12 Speed touches

| Touch | How Hevy does it | Label |
|---|---|---|
| Number entry | iOS number pad with a decimal key; the rest-timer strip and a keyboard-dismiss key ride above it | OBSERVED (screenshots on [live-pr](https://www.hevyapp.com/features/live-pr/), [gym-progress](https://www.hevyapp.com/features/gym-progress/)). Android UNKNOWN. |
| Auto-fill | Previous sets, weight and reps pre-fill when you add a known exercise; routine targets show as grey placeholders; tap a Previous value to copy it | OBSERVED ([programming options](https://www.hevyapp.com/features/exercise-programming-options/), [track-exercises](https://www.hevyapp.com/features/track-exercises/)) |
| Routine carries forward | The routine's weights and reps update to what you did (toggle on save) | OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/34105442929943)) |
| Plate calculator | Button above the keypad for barbell exercises | OBSERVED |
| Warm-up calculator | One tap inserts % warm-up rows | OBSERVED |
| Units | Global kg/lb plus a per-exercise override from the KG header | OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/34953292892823)) |
| Lock screen | Tick a set, ±15 s or skip rest without unlocking | OBSERVED |
| Sound | Separate volumes for check-set, timer and PR; 5 timer sounds | OBSERVED |
| Keep awake | Toggle | OBSERVED |
| Haptics | Not documented | UNKNOWN |
| Widgets | Streak, rest days, routine of the day, quick start, weekly stats | OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/36956630666647)) |

### 2.13 Visual design

**Colour and type.**

- **One accent colour.** The website's design tokens put the accent at **`#1D83EA`** (blue) and the primary colour at near-black `#00060A`, with **Inter** at weights 600 and 500 (OBSERVED in hevyapp.com's CSS variables). In the app, the accent covers interactive text (exercise names, rest-timer labels, Cancel), primary buttons, chart lines, the calendar's workout days and the selected chip. INFERRED: it looks like the same blue, but nothing was measured.
- **Fixed meanings for the other colours** (OBSERVED in screenshots):
  - **green** only for "done" (completed rows, check boxes) and positive deltas;
  - **amber** for warm-up letters and PR text, with **gold** for the medal;
  - **red** for failure sets and destructive actions (Remove, Delete, Discard);
  - **blue** for drop sets;
  - **purple** for the superset pill and bars;
  - **grey** for anything secondary: previous values, targets, column headers, secondary buttons.
- **Type hierarchy** (OBSERVED, font family in the app UNKNOWN):
  - 17–20 pt bold page and section titles;
  - accent-coloured semibold exercise names;
  - **small grey all-caps column headers** (SET, PREVIOUS, KG, REPS, RPE);
  - medium-weight numerals in the set cells;
  - a **very large numeral** only on the timer and headline values ("01:59", "57.5 kg").

**Layout and components.** All OBSERVED.

- **Density.** Set rows are compact, roughly 44 pt, and **zebra-striped**. Exercise blocks are separated by generous whitespace rather than cards. Secondary actions are full-width light-grey buttons with a "+" icon.
- **Bottom sheets for every choice.** Set type, rest duration (a wheel), RPE (a segmented scale), the exercise menu, superset partner, plate calculator, warm-up calculator and filters all open as a bottom sheet with a grabber. Nothing navigates away from the workout.
- **Charts.**
  - Thin single-colour line charts with dots, light gridlines and few axis labels.
  - A **headline value and date** above each chart instead of a tooltip.
  - **Pill chips** below to switch metric, the selected one filled with the accent.
  - Bar charts mute every bar except the one in focus.
- **Cards.** History cards are flat: title, a two-figure stat row, then exercise lines with thumbnails. Share cards are rounded rectangles with big numbers and a small wordmark.

**Dark mode.** It exists ("Dark mode", [App Store](https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350)), and the theme setting offers "Use OS setting" or "Dark" ([screensdesign](https://screensdesign.com/apps/hevy-workout-tracker-gym-log/)). What the dark logging screen looks like is UNKNOWN. The dark share card uses a deep navy background with accent-blue numerals (OBSERVED, [shareable](https://www.hevyapp.com/features/shareable/)).

### 2.14 What users love and what they complain about

**Love.** OBSERVED unless noted.

- **Seeing consistency.** "Love being able to see the consistency!" (467 upvotes), and milestone posts like "300 workouts in a row" and "200th Workout" are among r/Hevy's top posts of the year ([r/Hevy top](https://www.reddit.com/r/Hevy/comments/1v2wheo/)). The ordinal workout count clearly motivates people (INFERRED from those milestone posts).
- **Last time's numbers on the row.** It "holds the last rep and weight from the previous time I did the exercise". Users also like the set labels (drop/failure/superset), "Tons of graphs", and that it is "Simple. Free." (store reviews quoted in the [Play description](https://play.google.com/store/apps/details?id=com.hevy) and summarised from search).
- **The team responding** to requests (Community Update threads).

**Complaints and requests.** All OBSERVED in [Community Update #1](https://www.reddit.com/r/Hevy/comments/1umaz02/), the [2025 recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/) and the [pinned-notes post](https://www.reddit.com/r/Hevy/comments/1x509fz/).

- **Notes.** Permanent notes were missing for years, and when they finally shipped, one user said the update wiped most of their existing notes.
- **Data and reliability.**
  - "mid-workout edits may be lost after switching apps", reported as a bug.
  - A PR medal icon blocks changing the set type.
  - Superset scrolling issues.
- **Records and stats.**
  - Dumbbell weight logged as a single or double weight, inconsistently.
  - PR resets wanted, and a rep cutoff for e1RM.
  - Graph x-axes are per workout, not per date.
  - Muscle distribution is based on set count rather than volume.
  - Only the last monthly report can be viewed.
  - The calendar can't plan ahead.
- **Missing training formats.** Deloads, EMOM/AMRAP/Tabata and countdown or interval timers; stretching and mobility separated from strength.
- **Rigidity.** Exercise type is locked after creation, and generic movements can't have equipment variants.
- **Platform issues.** Battery drain, watch sync, unreliable Health Connect, and no Garmin.

---

## 3. What EIO already has

EIO Fitness has four views: Log, Routines, Exercises and Body.

- **Log.** A 7-day strip of sessions, a daily streak, weekly volume and a session history. Sessions start freestyle, from a routine, or as "yesterday".
- **Session screen.** Every set is saved the moment it is logged, so there is no Finish step. You pick exercises from a picker grouped by region. Sets are weight × reps or weight × seconds, with "repeat last set", a rest timer with presets, an editable date, session notes and set deletion.
- **PRs.** A badge fires when a set beats your best at the same rep count (the first set isn't a PR, and current-session sets are excluded). Timed exercises use the best hold, and there is an estimated-1RM chart (Epley) per exercise.
- **Library.** The library is your own, with 11 muscle tags in 7 regions and reps or time tracking.
- **Routines.** Ordered exercises with optional target sets and reps per exercise.
- **Body.** One weigh-in a day plus height and computed BMI.

Logging is already reliable and quick. What's missing is everything *around* the set row: the previous-session context, set semantics, session structure and any calisthenics awareness.

---

## 4. Gap analysis

### 4.1 What Hevy has that EIO lacks

| Area | Hevy | EIO today | Gap size |
|---|---|---|---|
| Previous session inline | A grey PREVIOUS column per set, tap to copy, source = any workout or same routine | "Repeat last set" within the session only | **Large.** This is the core of progressive overload. |
| Set completion model | Planned rows with target placeholders; tick → green row, rest timer and PR check | Each set is typed then saved; no planned rows | **Large** |
| Per-exercise rest timer | Remembered per exercise, starts on tick, ±15 s, skip, docked bar | One rest timer with presets, started by hand | Medium |
| Set types | Warm-up, normal, failure, drop, chosen from the set number; numbering counts normal sets | None | Medium |
| Session duration and Finish | Live duration, pause, editable; Finish → save screen → routine-update prompt → summary with ordinal, PRs, muscles | No duration, no end, no summary | Medium to large |
| Session structure | Exercise order, notes, supersets and rest persisted per workout (API: `exercises[]` with `notes`, `superset_id`, `rest_seconds`) | Block order kept in screen memory only and rebuilt from logged sets (INFERRED from `useWorkoutSession.ts`) | **Large and foundational** |
| Supersets and circuits | Colour-coded, smart scrolling | None | Medium |
| Notes | Pinned per exercise, pinned per routine, workout note with last-time ghost | Session notes only | Medium |
| Routine targets | Per set: weight, rep range, target RPE, warm-ups; carry-forward | Per exercise: target sets and target reps | Medium |
| Exercise model | 8 types; primary and secondary muscles (20); equipment (9); instructions and animation | 2 tracking types; 1 muscle (11 tags); no equipment; no instructions | Large for calisthenics |
| Bodyweight handling | Bodyweight in volume for full-bodyweight moves; weighted and assisted types | Bodyweight sets are weight 0, so they add 0 to volume, and **rep PRs never fire** (section 4.3) | **Large for calisthenics** |
| PR types | Heaviest, e1RM, best set volume, session volume, most reps, session reps, best time, plus a Set Records table | Same-rep-count heaviest (Hevy's "Set Record") and best hold | Medium |
| PR announcement | Toast and medal on the row, PR sound | Badge | Small |
| Exercise detail | Summary chart with metric chips, records, History tab, How-to tab | An e1RM chart only | Medium |
| Statistics | Weekly sets per muscle (secondary = 0.5), radar comparison, monthly report, main exercises | Weekly volume | Medium |
| Calendar and streak | Month calendar with routine names, year heatmap, **weekly** streak, rest-day counter | 7-day strip, **daily** streak | Medium |
| Body | Circumferences (L/R), body fat, progress photos with ghost overlay | Weight and BMI | Medium |
| Gym tools | Plate calculator, warm-up calculator | None | Small to medium (Gym mode) |
| Calisthenics tools | Weak (section 2.11) | None | An opportunity: Hevy is weak here too |
| Lock screen | Live notification: tick a set, adjust rest | None | Medium, and costly to build |
| Gym vs calisthenics modes | **None** | None | EIO can lead here |

### 4.2 Where EIO is already better, or should not copy Hevy

- **Sets are saved as soon as they are logged.** Hevy users report losing mid-workout edits after switching apps (OBSERVED, [Community Update #1](https://www.reddit.com/r/Hevy/comments/1umaz02/)), and Hevy drops every unticked set on Finish. Add Finish as an *optional* close and summary, never as the moment data is saved.
- **Back-dating is first-class.** Long-press for yesterday, or an editable session date. Hevy back-dates through the Save screen's date picker or the calendar.
- **EIO's PR is the stronger signal.** EIO's PR, the heaviest weight at the same rep count, is exactly the record Hevy keeps in its Set Records table but **never announces** (OBSERVED, [help: set records](https://help.hevyapp.com/hc/en-us/articles/38279531346455)). For progressive overload it is a meaningful signal. Keep it, and add the other PR types beside it.
- **"The first set is not a PR"** keeps day-one noise down. Whether Hevy awards a PR the first time you log an exercise is UNKNOWN.
- **The muscle vocabulary is simple.** 11 tags are faster to choose from than 20. For per-muscle statistics, add *secondary* muscles rather than more primary tags.
- **No paywall limits.** Hevy caps routines, custom exercises and history for free users. EIO has no such limits and needs none.
- **One system.** EIO's body weight already exists in the same database, so bodyweight-aware volume needs no extra input. Hevy asks you to "Update Bodyweight" mid-workout.

### 4.3 Problems found in EIO's code while comparing

These are INFERRED from reading `app/src/modules/fitness/types.ts` and `useWorkoutSession.ts`, not from running the app.

1. **Bodyweight rep PRs never fire.** `isPersonalRecord` compares weight at the *same* rep count. A pull-up set is weight 0. Beating 10 reps with 12 finds no history at 12, so it isn't a PR. Matching 10 reps at 0 kg is "not strictly greater", so that isn't one either. A calisthenics user never gets a rep PR.
2. **PR badges vanish on reopen.** PR flags live only in screen state (`prs`), set when a set is logged. Reopen a past session and its PR badges are gone.
3. **Routine blocks vanish on reopen.** Block order is kept in screen state and rebuilt from logged sets. Blocks pre-filled from a routine but not yet logged disappear if the screen reloads, and exercise order, per-exercise notes, rest and superset grouping have nowhere to live.
4. **The daily streak punishes rest days.** The streak counts consecutive days, but strength training plans rest days, so the streak breaks every time you follow your plan. Hevy's weekly streak avoids this.

---

## 5. Recommendations

**Effort:** S = under a day, M = 1–3 days, L = more than 3 days, for one developer who knows the codebase. These are INFERRED estimates.
**Mode tags:** [Gym], [Cali] or [Both].
**DB:** whether a schema change is needed.

### TOP 7

#### 1. Show last session's numbers on every set row, and routine targets as placeholders — [Both] · M · DB: no

- **What.**
  - **The column.** Add a grey **PREVIOUS** column to each set row showing the matching set from the last session with this exercise, e.g. "60 × 8", "x 12" or "0:45". Match by position among the same set type.
  - **Tap to fill.** Tapping the value copies it into the row.
  - **Ghost targets.** Show routine targets, and failing those last session's values, as **grey ghost values** in the weight and reps cells, so a row can be ticked without typing anything.
  - **Source setting.** "Last time anywhere" or "last time in this routine". `workout_sessions.routine_id` already exists.
- **Why, for one person.** Every set is a decision about whether to match or beat last time. This puts that answer on the row, which is the single most-praised Hevy behaviour. It also makes "repeat last set" less necessary.
- **Evidence.** Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/36011896355479), [help](https://help.hevyapp.com/hc/en-us/articles/34105442929943), [track-exercises](https://www.hevyapp.com/features/track-exercises/)).

#### 2. Tick-to-complete set rows with a per-exercise rest timer, on a persisted session structure — [Both] · M–L · DB: yes

- **What.**
  - **Planned rows.** When a block opens, it gets planned rows: the routine's target sets, or last time's set count.
  - **The tick.** Each row has a ✓. Ticking **saves the set immediately** (keeping EIO's save-as-you-go model), tints the row green, runs the PR check and **starts that exercise's rest timer**.
  - **The rest bar.** A floating bar shows −15, mm:ss, +15 and Skip, and docks above the keypad while you type.
  - **Rest is remembered per exercise**, with a global default for new ones.
  - **Delete.** Swipe left on a row to delete it.
- **DB.**
  - A new **`session_exercises`** table: id, session_id, exercise_id, position, rest_seconds, note, superset_group. A block now exists the moment it is added, so order and routine pre-fill survive reloads (fixes 4.3 item 3).
  - `exercises.default_rest_seconds` and `routine_exercises.rest_seconds`.
  - Unticked rows stay client-side. INFERRED design choice: nothing typed but unticked is precious enough to persist.
- **Why.** Tap-tap-rest is Hevy's loop and the reason its logging feels fast. The table is also the foundation for notes, supersets, reorder and replace.

#### 3. Set types: warm-up, normal, failure, drop — [Both] · S–M · DB: yes

- **What.**
  - **Choosing a type.** Tap the set number to open a sheet: **W Warm-up · 1 Normal · F Failure · D Drop · Remove**. The type letter replaces the number: W amber, F red, D blue. Only normal sets are numbered.
  - **Rules:**
    - warm-ups are excluded from volume and PRs (fixed, no setting);
    - the rest timer doesn't start before a drop set;
    - failure sets may record 0 reps, for a failed calisthenics attempt.
- **DB.** `session_sets.set_type` text, check in ('normal','warmup','failure','drop'), default 'normal'.
- **Why.** Without types, warm-ups inflate volume and can pollute rep-count PRs, and a failed max attempt can't be recorded honestly.

#### 4. Session duration and an optional Finish with a summary — [Both] · M · DB: yes

- **What.**
  - **Live header.** The session shows a header strip: **Duration · Volume · Sets**, plus a **Finish** button.
  - **Finish** stamps the end time and shows a summary:
    - "Workout #N" (the ordinal);
    - duration, volume and sets;
    - a **PR list**;
    - a **comparison with the last session of the same routine** (volume and sets up or down). This is EIO-original and more useful solo than "you lifted a truck".
    - the week's streak.
  - **Routine-change prompt.** If exercises or sets were added, removed or reordered against the routine, offer "Update routine" or "Keep original" and spell out the change ("You added 2 sets").
  - **Not finishing is fine.** An unfinished session simply ends at its last set's time.
- **DB.** `workout_sessions.started_at` and `ended_at` (timestamptz, `ended_at` nullable). Duration is derived, never stored.
- **Why.** Gives each session closure and makes "how long did that take" answerable. It costs nothing in reliability, because Finish never gates saving.

#### 5. Gym and Calisthenics modes, built on bodyweight-aware exercise types — [Both], and defines [Cali] · M–L · DB: yes

- **What.**
  - **Discipline tag.** A `discipline` on exercises (gym, calisthenics or both) and on routines.
  - **Mode switch.** A **Gym / Calisthenics** segmented switch at the top of Fitness filters the Exercises and Routines views, the picker and the stats. A mixed session is allowed.
  - **Load modes.** Replace "reps or time" with *what is counted* (reps or hold) × *how it is loaded*:
    - **external** load: a barbell or dumbbell, where weight is the load;
    - **bodyweight**, with a signed **added load**: "+10" for a vest or belt, "−20" for a band or machine assist;
    - **unloaded**.

    One bodyweight exercise can go assisted → bodyweight → weighted **without becoming a new exercise**. That is Hevy's biggest calisthenics flaw, fixed.
  - **Holds** use the same signed load, which covers the assisted holds Hevy users ask for.
  - **Bodyweight in volume.** Effective load = bodyweight × the exercise's `bodyweight_factor` + added load. Bodyweight is the latest EIO weigh-in, snapshotted on the session.
  - **Equipment tag**, including calisthenics kit Hevy lacks: none, barbell, dumbbell, kettlebell, machine, cable, band, **pull-up bar, rings, dip bars, parallettes**, other.
- **DB.**
  - `exercises.discipline`, `exercises.load_mode`, `exercises.bodyweight_factor` (numeric, default 1.0, user-editable) and `exercises.equipment`;
  - `routines.discipline`;
  - `workout_sessions.bodyweight_kg` (snapshot);
  - `session_sets.weight_kg` may be negative for bodyweight-mode exercises.
- **Why.** The user trains both styles. A mode keeps each library and set of stats focused, and the load model is what makes calisthenics progress measurable at all. The factor is user-set rather than Hevy's hard-coded "100 % list" (INFERRED improvement on [help](https://help.hevyapp.com/hc/en-us/articles/44098622782487)).

#### 6. Records that fit the exercise, announced live — [Both] · M · DB: no

- **What.**
  - **PR types by exercise:**
    - external load: heaviest weight, best e1RM, best set volume, **plus the existing same-rep-count record**;
    - bodyweight: **most reps at the same or a harder load**, and best session reps;
    - assisted: **less assistance at the same or more reps**, which Hevy can't do;
    - holds: **longest hold at the same or a harder load**.
  - **Toast and medal.** On a tick, a toast drops from the top: exercise name, PR type and value. The row's set number becomes a medal.
  - **Rebuilt on open.** PRs are recomputed when a session opens, so badges survive a reload (fixes 4.3 item 2).
  - **Records block.** The exercise's records sit on its detail page, with the rep-max table collapsible.
  - **Keep the existing rules**: the first set isn't a PR, and comparisons are strictly greater.
- **DB.** No: computed from history. An `exercise_records` cache can come later if it gets slow.
- **Why.** Records are the reward loop. Today a calisthenics user can't earn one (4.3 item 1).

#### 7. Skill progression ladders — [Cali] · L · DB: yes

- **What.**
  - **Ladders.** A *progression* is an ordered ladder of exercises, e.g. Front lever: tuck → advanced tuck → one-leg → straddle → full. Others: planche, handstand push-up, one-arm pull-up, pistol squat.
  - **Graduation targets.** Each rung has a target, e.g. 3 × 15 s, or 3 × 8.
  - **In a session.** The block shows a level chip, "Adv. tuck · 2/5", with ‹ › to step down or up for a set. Each set is logged against that rung.
  - **Progress screen.** Shows the **highest rung reached over time** as a step chart, plus the best hold or reps at each rung.
  - **"Ready to move up".** When the rung's target is met in N consecutive sessions, a chip appears beside the rest timer, like Hevy's green "Increased Weight" chip (OBSERVED on [live-pr](https://www.hevyapp.com/features/live-pr/)).
- **DB.** A `progressions` table (id, name, discipline) plus `exercises.progression_id`, `progression_level`, `target_reps`, `target_hold_seconds` and `target_sets`.
- **Why.** This is the calisthenics equivalent of a weight chart, and the thing Hevy users explicitly ask for ("skill trees", "lever and planche progressions"). Hevy has nothing like it.

### Further recommendations, in priority order

| # | Recommendation | Mode | Effort | DB change | Notes and evidence |
|---|---|---|---|---|---|
| 8 | **Hold timer that counts down.** Tap ▶ on a timed set: 3-2-1 lead-in, count *down* to the target with a beep and vibration at zero, keep counting up past it, and auto-fill the held time on stop. Also a pure stopwatch mode. | Cali | M | No | Fixes the confusion in Hevy's count-up "timer" ([help](https://help.hevyapp.com/hc/en-us/articles/35379662997783)) |
| 9 | **Weekly streak and a calendar.** Replace the daily streak with a weekly one. Add a month calendar of accent dots with routine names, and a "days since last workout" chip. A year heatmap goes on the website. | Both | S–M | No | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35380117933207)); fixes 4.3 item 4 |
| 10 | **Secondary muscles and weekly sets per muscle.** Primary counts 1 and secondary 0.5. Add a region radar comparing this period with the last. | Both | M | Yes: `exercises.secondary_muscles text[]` | Counting rule OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/44128140257431)). Users would rather the radar measured volume than set count ([pinned-notes thread](https://www.reddit.com/r/Hevy/comments/1x509fz/)), so offer both. |
| 11 | **Exercise detail page with Summary, History and How-to tabs.** Headline value and date, range dropdown, line chart, metric chips chosen by exercise type, records, a History list per session, and your own instructions. | Both | M | Yes: `exercises.instructions text` | Extends the existing `ExerciseProgressScreen` |
| 12 | **Three kinds of notes.** Pinned to an exercise (machine settings), pinned to a routine exercise, and a session note shown greyed next time. | Both | S–M | Yes: `exercises.pinned_note`, `routine_exercises.note`; `session_exercises.note` from #2 | Hevy's most-requested feature for years ([r/Hevy](https://www.reddit.com/r/Hevy/comments/1u57fu4/)) |
| 13 | **Per-set routine targets.** Rep ranges ("8–12"), target weight, target RPE and planned warm-ups. Optionally carry the last session's weights forward. | Both | M | Yes: a `routine_sets` table, or `target_reps_min/max` on `routine_exercises` | Hevy OBSERVED ([programming options](https://www.hevyapp.com/features/exercise-programming-options/)) |
| 14 | **Double-progression hint.** When every working set hits the top of the rep range, show "↑ add weight" next session. For a ladder rung, show "↑ next level" instead. | Both | S | No, given #13 | INFERRED design. Users ask for automatic progression ([2025 recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/)). |
| 15 | **Supersets and circuits.** Group blocks with a coloured left bar, auto-advance to the next exercise on tick, and rest only after the last exercise of a round. | Both, mostly Cali circuits | M | Yes: `superset_group` on `session_exercises` and `routine_exercises` | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35650286563095)) |
| 16 | **Plate calculator.** A drawn bar with plates, available plates as toggles, and a bar choice. Defaults: 25/20/15/10/5/2.5/1.25 kg plates, 20 kg and 15 kg bars. | Gym | S | No (stored in settings) | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/34518876511383)) |
| 17 | **Warm-up calculator.** Enter the working weight and insert W rows at 40/60/80 % (editable), rounded to your plates. | Gym | S | No | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35650921359639)) |
| 18 | **Body measurements and progress photos.** One wide row per date with left/right limbs, using the last values as placeholders. Photos are stored privately, one a day, with a **ghost overlay** of the last photo when shooting. | Both | M–L | Yes: a `body_measurements` table and a `progress_photos` table plus a private Storage bucket | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35385479603479)) |
| 19 | **Keep the screen awake during a session.** | Both | S | No | Hevy setting OBSERVED. Check that SDK 57's keep-awake API is right before building. |
| 20 | **Rest-end notification that survives the background.** At minimum, schedule a local notification for when rest ends. Later, an ongoing notification with ±15 s and Skip. | Both | S, then L | No | Hevy lock-screen controls OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35649846517399)) |
| 21 | **Repeat a past session, and save a session as a routine.** | Both | S | No, given #2 | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35361530647959)) |
| 22 | **Replace and reorder an exercise mid-session.** Swap keeps the block's position, and reorder is drag-and-drop. | Both | S–M | No, given #2 | Hevy menu OBSERVED |
| 23 | **Cap e1RM at 12 reps or fewer**, for both the chart and the record. Keep Epley, and label it "estimated". | Gym | S | No | Users complain high-rep sets skew it ([2025 recap](https://www.reddit.com/r/Hevy/comments/1q6e2fx/)) |
| 24 | **Monthly report on the website.** 12 bars with the current month highlighted, plus 2×2 tiles with deltas. Any month, not only the last; Hevy offers only the last. | Both | M | No | Hevy OBSERVED ([help](https://help.hevyapp.com/hc/en-us/articles/35702030346903)) |
| 25 | **Website as the planning and analysis surface**: routine and ladder building, stats and the year heatmap. The phone stays focused on logging. | Both | Varies | No | Mirrors how Hevy positions hevy.com (OBSERVED, [hevyapp.com](https://www.hevyapp.com/)) |

### Deliberately not recommended for a single user

These are left out:

- the social feed, follows, likes and comments, the discovery feed and athlete profiles;
- leaderboards and Strength Level, which compare you against other users;
- Hevy Coach;
- Trainer's program generator: a solo user writes their own routines, and #14 covers progression;
- Strava, the ChatGPT app and watch apps;
- the paywall and Pro limits, and the 150-set cap.

Two items are optional, later polish: **share images** (the summary carousel can come without share targets) and **home-screen widgets**.

### Suggested build order

Each phase stands on the one before.

1. **Logging loop.** #2 (session_exercises, tick, per-exercise rest), then #1 (Previous and ghosts), #3 (set types), #4 (duration and Finish), and #19.
2. **Calisthenics mode.** #5 (modes and load model), then #6 (records), #8 (hold timer) and #7 (ladders).
3. **Insight.** #9, #10, #11, #12, #13 and #14.
4. **Gym tools, body and polish.** #16, #17, #15, #18, #20 to #25.

---

## 6. UI/UX patterns worth adopting

These patterns were drawn from Hevy's screens and translated into roles, not copied. EIO should express them in its own tokens.

**P1. The set table is the product.**
- **Columns:** `SET | PREVIOUS | LOAD | REPS or TIME | RPE (optional) | ✓`.
- **Headers:** 11–12 px, all caps, letter-spaced, secondary text colour.
- **Rows:** about 44 dp tall, alternately the plain and a slightly tinted surface (zebra).
- **Numerals:** tabular figures, so "60" and "57.5" line up.
- **Column widths:** SET narrow (about 32 dp, centred); PREVIOUS flexible, grey, left-aligned; LOAD and REPS equal width, centred; ✓ a 28 dp rounded square.
- **Per mode:** hide LOAD for unloaded bodyweight, and swap REPS for TIME on holds. In Calisthenics mode, show LOAD with a sign ("+10", "−20").

**P2. Completion is the only use of green.**
- **On tick:** the whole row takes a pale success tint, and the box fills with the success colour and a white tick. Animate the tint in over about 150 ms.
- **Before tick:** the box is a light grey outline.
- **Everywhere else:** green appears only on positive deltas (↑ in stats).

**P3. Ghost values.**
- **Grey placeholders.** Targets and last-time values sit in the input cells as placeholder-coloured text. Ticking a row with ghosts commits the ghost values. Typing replaces a ghost.
- **One per-row rule.** The PREVIOUS cell is always grey and always tappable.

**P4. The floating rest bar.**
- **Shape:** a rounded card pinned about 12 dp above the bottom edge, at full width minus the screen gutters.
- **Contents:** a 3 dp progress line in the accent colour across its top edge. Below it, left to right: a ghost "−15" button, a large centred "1:59" (28–32 sp, tabular), a ghost "+15", and a filled accent "Skip".
- **With the keypad open:** the same controls render as a strip directly above the keypad, with a keyboard-dismiss button at the end.
- **At zero:** a sound, a vibration and a short flash of the bar; then it dismisses itself.

**P5. Set type as a letter in the SET column.**
- **Letters:** W in amber or warning, F in red or danger, D in an info colour, and plain numbers for normal sets. Numbering counts only normal sets.
- **The menu:** tap the cell for a bottom sheet listing each type as letter, name, and an info "?" that explains it in one line, with "Remove set" last in red.

**P6. Every choice is a bottom sheet; nothing leaves the session.**
- **What gets a sheet:** rest duration, set type, RPE, the exercise menu (Reorder · Replace · Superset · Warm-up sets · Remove), plate calculator, warm-up calculator, ladder level and filters.
- **Sheet anatomy:** a grabber, a title, a one-line subtitle naming the context ("Rest timer – Bench Press"), the content, and a full-width primary button.

**P7. Wheel picker for rest.** Choices are "Off", then 5-second steps to 2:00, then 15-second steps to 5:00. The value currently in use sits in a highlighted band.

**P8. RPE as a segmented scale.**
- **Layout:** a large readout (48 sp) over a horizontal pill scale: 6 · 7 · 7.5 · 8 · 8.5 · 9 · 9.5 · 10.
- **Text:** a reps-in-reserve line under the readout ("2 reps left").
- **Subtitle:** names the set ("Set 2 · 60 kg × 8").
- **Default:** RPE off for warm-ups.

**P9. PR moment.**
- **The toast:** drops from the top over the header, rounded with a soft shadow, for about 2.5 s. It shows a small medal, the exercise name in bold, and "Most reps · 13" or "Heaviest · 55 kg" in a gold or amber text colour.
- **The row:** the set number swaps to a medal glyph. The same medal reappears in history and on the summary.
- **Haptics:** one success haptic. Hevy's haptics are UNKNOWN; this is EIO's choice.

**P10. Live header strip.** Three small-label and value pairs, Duration · Volume · Sets, under the session title. Duration takes the accent colour because it changes every second. Finish is a compact filled accent button at the top right.

**P11. Exercise block header.**
- **Top line:** the name in accent semibold (tap for detail), then the ⋮ menu.
- **Notes:** pinned notes under the name, each with a pin glyph. Today's note follows, with the placeholder "Add a note…".
- **Chips:** "⏱ 2:00" and "📝 Note". In Calisthenics mode, add the ladder chip "Adv. tuck · 2/5 ‹ ›".

**P12. Exercise picker.**
- **Layout:** a search field, then two equal filter buttons: "All equipment" and "All muscles" (in EIO, regions).
- **Filter sheets:** each option has a small icon.
- **Lists:** "Recent" comes first. Each row: icon, name, muscle in grey, and a trailing chart icon to peek at progress. Allow multi-select with a sticky "Add 3 exercises" button (Hevy's behaviour here is UNKNOWN; this is EIO's choice).

**P13. Chart pattern, used everywhere.**
- **Headline:** the value and its date ("57.5 kg · 5 Jan") updates as you scrub the chart.
- **Controls:** a range dropdown at the right (3 months / Year / All).
- **The line:** a single accent line with small dots and light horizontal gridlines only.
- **Metric switch:** pill chips below the chart, the selected one filled with the accent.
- **Bar charts:** muted grey bars with the focused bar in the accent colour.
- **On the website:** the same design, with hover in place of scrubbing.

**P14. Calendar and consistency.**
- **Month list:** months scroll vertically. Workout days are filled accent circles with the routine name in 9–10 sp text under the date. A small corner mark tells Gym and Calisthenics days apart (EIO-original).
- **Chips at the top:** "🔥 N-week streak" and "🌙 N rest days".
- **Year view on the website:** a 12-mini-grid heatmap.

**P15. Comparison radar.** Six region axes. This period is a translucent accent fill and the previous period a grey outline, with four stat tiles below (Workouts, Duration, Volume, Sets), each with a small delta and arrow.

**P16. Finish summary.**
- **Order:** "Workout #N" as a title, then a 2×2 stat grid, then PR rows with medals, then "vs last <routine>" deltas, then the muscle radar.
- **Format:** one scrolling page rather than Hevy's swipe carousel. For a solo user scanning is faster than swiping (INFERRED).
- **Exit:** a full-width Done.

**P17. History card.**
- **Order:** title in bold, then the date in secondary text, then a stat row (Duration · Volume · Sets · PRs).
- **Exercises:** up to 3 lines of "4 × Bench press", with a coloured left bar for supersets, then "+2 more".
- **Overflow menu:** Repeat · Save as routine · Edit · Delete (red).

**P18. Measurement form.** A date row, then a photo slot, then a list of measurement rows, each "label (unit)" left and value right. Last time's value appears as the grey placeholder, so only what changed needs typing. Use a decimal keypad.

**P19. Swipe left to delete** a set row, revealing a red Delete. Keep "Remove set" in the set-type sheet as the accessible alternative.

**P20. Colour roles.** One accent colour for interaction and data. Fixed semantic colours:
- success: completion and positive deltas;
- warning or amber: warm-ups and PR text;
- danger: failure sets and destructive actions;
- info: drop sets;
- one categorical colour per superset group.

Grey carries everything secondary. Define these as theme tokens with dark-mode values, because a gym is often dim. Choose the tint for completed rows in dark mode deliberately, as a desaturated success colour at about 20 % on the surface.

**P21. Density and rhythm.** The tables are tight and the spacing between blocks is generous. Secondary actions are full-width tinted buttons with a leading "+": "+ Add set" and "+ Add exercise", with the accent used only for "+ Add exercise". Destructive actions are text-only in red ("Discard session").

**P22. On EIO's swipeable phone tabs,** the active session opens as a full-screen route, not a tab. When minimised, it collapses to a slim bar above the tab bar showing "● Push · 32:10 · rest 1:12", and tapping the bar restores it. This collapse behaviour is INFERRED from Hevy's chevron, not documented.

---

## 7. Checklist status

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | Hevy's standing | **Answered** | Store figures fetched 19 Oct 2026. User counts are company claims, and 10M vs 17M is unexplained. |
| Q2 | Active-workout anatomy | **Answered** | Header, strip, block, columns and buttons all observed. The 2026 redesign is seen in only one screenshot. |
| Q3 | Previous values and auto-fill | **Answered** | Exact matching across set types is INFERRED (by position). |
| Q4 | Completing, set types, RPE, notes | **Answered** | Two conflicts flagged: 0-rep failure sets, and RPE in routines. |
| Q5 | Supersets, reorder, replace, delete | **Partial** | The reorder interaction (drag list) and the replace flow screens are not observed. |
| Q6 | Duration and rest timers, timed sets | **Answered** | |
| Q7 | Finish workout | **Answered** | |
| Q8 | Routines, folders, programs, targets while logging | **Answered** | |
| Q9 | Exercise library, types, custom exercises, detail page | **Partial** | Types, muscles and equipment come from the API. Column labels for weighted and assisted types are UNKNOWN, as is picker multi-select. |
| Q10 | Records, PRs, charts, 1RM | **Answered** | Whether a first-ever log counts as a PR is UNKNOWN. |
| Q11 | Statistics, calendar, streaks, measurements, photos | **Answered** | |
| Q12 | Bodyweight and calisthenics | **Answered** | User voice comes from r/Hevy threads; r/bodyweightfitness was not sampled. |
| Q13 | Speed touches | **Partial** | Haptics and Android keypad behaviour are UNKNOWN. |
| Q14 | Visual design | **Partial** | The light theme is well observed. Dark-mode logging screens and the app's font family are UNKNOWN, and the colours are from pre-redesign screenshots. |
| Q15 | Love and complaints | **Answered** | A top-posts sample plus official threads; not a systematic sample. |

**Unresolved:**
- haptics;
- the Android keypad and notification look;
- dark-mode visuals;
- picker multi-select;
- reorder and replace screens;
- how far the mid-2026 redesign changed colours and spacing.

All of these need either more searches (the budget ran out) or someone looking at the current app.

## Sources

**Hevy help centre** (help.hevyapp.com, all articles updated Oct 2026)
- Article index: https://help.hevyapp.com/api/v2/help_center/en-us/articles.json
- Log a workout: https://help.hevyapp.com/hc/en-us/articles/35361530647959
- 2026 features guide: https://help.hevyapp.com/hc/en-us/articles/33106320824727
- Workouts vs routines: https://help.hevyapp.com/hc/en-us/articles/33703513582871
- Previous workout values: https://help.hevyapp.com/hc/en-us/articles/36011896355479
- Previous vs routine values: https://help.hevyapp.com/hc/en-us/articles/34105442929943
- Set types: https://help.hevyapp.com/hc/en-us/articles/34896293707927
- Rest timer: https://help.hevyapp.com/hc/en-us/articles/35385404949143
- Duration and pause: https://help.hevyapp.com/hc/en-us/articles/34513981310615
- Inline timer counts up: https://help.hevyapp.com/hc/en-us/articles/35379662997783
- Workout settings: https://help.hevyapp.com/hc/en-us/articles/33882110558743
- Supersets: https://help.hevyapp.com/hc/en-us/articles/35650286563095
- Circuits: https://help.hevyapp.com/hc/en-us/articles/36954623739415
- RPE: https://help.hevyapp.com/hc/en-us/articles/35687721776663
- RPE vs RIR: https://help.hevyapp.com/hc/en-us/articles/34490600233111
- Warm-up calculator: https://help.hevyapp.com/hc/en-us/articles/35650921359639
- Plate calculator: https://help.hevyapp.com/hc/en-us/articles/34518876511383
- Exercise notes: https://help.hevyapp.com/hc/en-us/articles/36011779117591 and https://help.hevyapp.com/hc/en-us/articles/34463684392983
- Live activity: https://help.hevyapp.com/hc/en-us/articles/35649846517399
- Bodyweight types: https://help.hevyapp.com/hc/en-us/articles/44098622782487
- Weighted bodyweight: https://help.hevyapp.com/hc/en-us/articles/38387131819799
- Assisted bodyweight: https://help.hevyapp.com/hc/en-us/articles/34380762441111
- Exercise performance: https://help.hevyapp.com/hc/en-us/articles/35382889578135
- Exercise library: https://help.hevyapp.com/hc/en-us/articles/35688251991575
- Custom exercises: https://help.hevyapp.com/hc/en-us/articles/34264544382615
- Gym machines: https://help.hevyapp.com/hc/en-us/articles/43651329105687
- Units: https://help.hevyapp.com/hc/en-us/articles/34953292892823
- Set records vs PRs: https://help.hevyapp.com/hc/en-us/articles/38279531346455
- PRs explained: https://help.hevyapp.com/hc/en-us/articles/35649367857175
- Live PR: https://help.hevyapp.com/hc/en-us/articles/36012016405655
- 1RM: https://help.hevyapp.com/hc/en-us/articles/36954464726167
- Statistics: https://help.hevyapp.com/hc/en-us/articles/35702030346903
- Sets per muscle: https://help.hevyapp.com/hc/en-us/articles/44128140257431
- Calendar and streak: https://help.hevyapp.com/hc/en-us/articles/35380117933207
- Streak recovery: https://help.hevyapp.com/hc/en-us/articles/34467766576279
- Year in review: https://help.hevyapp.com/hc/en-us/articles/35700454899991
- Build a program: https://help.hevyapp.com/hc/en-us/articles/34953606698903
- Routine library: https://help.hevyapp.com/hc/en-us/articles/36011518408983
- Update vs keep routine: https://help.hevyapp.com/hc/en-us/articles/38387296276375
- Body composition: https://help.hevyapp.com/hc/en-us/articles/35385479603479
- Measurements: https://help.hevyapp.com/hc/en-us/articles/34462134138775
- Widgets: https://help.hevyapp.com/hc/en-us/articles/36956630666647
- Trainer: https://help.hevyapp.com/hc/en-us/articles/38385724273047
- Trainer settings: https://help.hevyapp.com/hc/en-us/articles/43572343844247
- Set limit: https://help.hevyapp.com/hc/en-us/articles/34896183826455
- Delete items: https://help.hevyapp.com/hc/en-us/articles/38030200802583
- Reset data: https://help.hevyapp.com/hc/en-us/articles/35119576252951
- Strength level: https://help.hevyapp.com/hc/en-us/articles/38001696749335
- Export: https://help.hevyapp.com/hc/en-us/articles/43708290987415

**Hevy website, feature pages and screenshots** (hevyapp.com)
- Home: https://www.hevyapp.com/
- Features index: https://www.hevyapp.com/features/
- Set types: https://www.hevyapp.com/features/workout-set-types/
- Rest timer: https://www.hevyapp.com/features/workout-rest-timer/
- Previous values: https://www.hevyapp.com/features/track-exercises/
- Save workout: https://www.hevyapp.com/features/workout-log/
- Programming options: https://www.hevyapp.com/features/exercise-programming-options/
- Empty workout: https://www.hevyapp.com/features/start-empty-workout/
- Sets and reps: https://www.hevyapp.com/features/how-to-write-sets-and-reps/
- Live PR: https://www.hevyapp.com/features/live-pr/
- Live activity: https://www.hevyapp.com/features/live-activity/
- Workout settings: https://www.hevyapp.com/features/workout-settings/
- Custom exercises: https://www.hevyapp.com/features/custom-exercises/
- Exercise library: https://www.hevyapp.com/features/exercise-library
- Track workouts: https://www.hevyapp.com/features/track-workouts/
- Gym routines: https://www.hevyapp.com/features/gym-routines/
- Exercise performance: https://www.hevyapp.com/features/exercise-performance/
- Gym progress: https://www.hevyapp.com/features/gym-progress/
- Muscle distribution: https://www.hevyapp.com/features/training-chart/
- Consistency: https://www.hevyapp.com/features/gym-consistency/
- Body measurements: https://www.hevyapp.com/features/track-body-measurements/
- Progress photos: https://www.hevyapp.com/features/progress-photos/
- Warm-up calculator: https://www.hevyapp.com/features/warm-up-set-calculator/
- Plate calculator: https://www.hevyapp.com/features/weight-plate-calculator/
- Supersets: https://www.hevyapp.com/features/what-are-supersets/
- Monthly report: https://www.hevyapp.com/features/monthly-report
- Sets per muscle per week: https://www.hevyapp.com/features/sets-per-muscle-group-per-week/
- Shareables: https://www.hevyapp.com/features/shareable/
- Calisthenics use case: https://www.hevyapp.com/use-cases/calisthenics-app/
- Public API spec: https://api.hevyapp.com/docs/

**Store listings** (fetched 19 Oct 2026)
- Google Play: https://play.google.com/store/apps/details?id=com.hevy
- App Store (US): https://apps.apple.com/us/app/hevy-workout-tracker-gym-log/id1458862350

**Community** (r/Hevy, read via a read-only mirror)
- Community Update #1 (Jul 2026): https://www.reddit.com/r/Hevy/comments/1umaz02/
- Pinned notes are here (Oct 2026): https://www.reddit.com/r/Hevy/comments/1x509fz/
- 2025 recap and update: https://www.reddit.com/r/Hevy/comments/1q6e2fx/
- Please add permanent exercise notes: https://www.reddit.com/r/Hevy/comments/1u57fu4/
- Love being able to see the consistency: https://www.reddit.com/r/Hevy/comments/1v2wheo/
- Calisthenics, band and hybrid feature request: https://www.reddit.com/r/Hevy/comments/1umr66b/
- Assisted weight + duration request: https://www.reddit.com/r/Hevy/comments/1vxvtg4/
- Anyone use Hevy for calisthenics: https://www.reddit.com/r/Hevy/comments/1fxm6qh/
- Make Hevy more flexible and modular: https://www.reddit.com/r/Hevy/comments/1n24nsg/
- Feature-request megathread: https://www.reddit.com/r/Hevy/comments/ryzrdi/
- Calisthenics/gymnastic movements: https://www.reddit.com/r/Hevy/comments/1lg16yx/
- Add calisthenics isometrics: https://www.reddit.com/r/Hevy/comments/1gtynyy/

**Third-party**
- Screensdesign, a screen catalogue: https://screensdesign.com/apps/hevy-workout-tracker-gym-log/
- Garage Gym Reviews: https://www.garagegymreviews.com/equipment/hevy
- Yahoo Tech user review: https://tech.yahoo.com/articles/app-completely-changed-way-track-140410445.html
- Hevy vs Strong, from search summaries only: https://aitoolsbakery.com/blog/hevy-vs-strong-app/ and https://repreturn.com/strong-app-vs-hevy/

**EIO code read for the gap analysis**
- `app/src/modules/fitness/types.ts`
- `app/src/modules/fitness/useWorkoutSession.ts`
- `app/src/modules/fitness/useFitness.ts`
