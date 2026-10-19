# Fitness (gym) trackers: competitor research

**Category:** gym and strength-training workout loggers (Hevy is covered in a separate report)
**Compared against:** EIO Fitness (`app/src/modules/fitness`, `website/src/pages/FitnessPage.tsx`, migrations `0011_fitness_v2`, `0014_fitness_detail`, `0018_simplify_muscle_tags`)
**Date:** 19 October 2026
**Method:** public evidence only: help centres, official blogs and changelogs, Google Play and App Store listings (descriptions, "what's new", version history, screenshots, top reviews). Nothing was installed, decompiled or signed up for.

### Evidence labels

| Label | Meaning |
| --- | --- |
| **OBSERVED** | Seen on the cited page, or in the store screenshot cited. |
| **OBSERVED\*** | Seen only in a search engine's summary of a page that was not opened. Lower confidence. |
| **INFERRED** | Reasoned from the evidence named next to it. |
| **UNKNOWN** | Not established. |

### Limits of this investigation

1. **The web-search budget ran out partway through.** It is shared by all agents in this session. After that, only pages whose URLs were already known could be opened. Some leads were never followed, among them Strong's "Muscle Heat Map" and how JEFIT computes recovery.
2. **Reddit could not be read.** Direct requests were blocked, and searches returned SEO roundups rather than threads. User opinion therefore comes from Play and App Store reviews. The stores show their "most helpful" reviews first, so many of those are from 2019–2024.
3. **Store data is a snapshot.** Google Play pages (`hl=en`, `gl=IN`) were downloaded on 19 Oct 2026 and the install band, rating, review count and update date read from them. The App Store pages are from the US store. Most changelog detail is from **iOS** version history. Android parity is assumed only where the Android "what's new" text confirms it.
4. **Screenshots are marketing images.** The Play Store screenshots were viewed. They show real UI but may be staged. UI claims based on them cite the listing.
5. **Vendor blogs are biased.** JEFIT's own four-app comparison is used only for facts that can be checked, such as a feature existing or a tier price, and never for its verdicts.

---

## Research questions

| # | Question | Evidence needed |
| --- | --- | --- |
| Q1 | Which two apps (besides Hevy) are the top gym loggers on Android in 2026? | Play install bands, ratings, review counts, update dates; 2026 comparisons |
| Q2 | What are each app's core features? | Store descriptions, help centres |
| Q3 | How fast is logging a set: taps, what is pre-filled, how the next set is chosen? | Help articles, screenshots |
| Q4 | How does each app suggest the next weight and reps? | Help articles, FAQs, product posts |
| Q5 | How is muscle recovery or fatigue modelled and shown? | Help articles, screenshots |
| Q6 | What do the statistics screens show, and how are they laid out? | Help articles, screenshots, changelogs |
| Q7 | Plate and warm-up calculators: how do they work? | Help articles |
| Q8 | Body measurements, body fat, progress photos? | Help articles, store text |
| Q9 | Calendar, heatmap and consistency views? | Changelogs, FAQ |
| Q10 | Exercise library: instructions, equipment, custom exercises? | Store text, help |
| Q11 | What happens at workout finish, and what does the summary show? | Help, changelogs, reviews |
| Q12 | What do users praise and complain about? | Store reviews, forums |
| Q13 | How are bodyweight and calisthenics movements handled (input for a Calisthenics mode)? | Help articles, changelogs |
| Q14 | Where do these apps beat Hevy, or cover something Hevy lacks? | Hevy features pages (light check only) |

---

## 1. Which apps, and why

**Chosen:** **JEFIT** and **Strong**, with Hevy as the third. A shorter, supplementary teardown of **Fitbod** covers only recovery, workout generation and progression. The brief asks for those specifically, and Fitbod is the reference implementation of all three.

### Google Play snapshot (19 Oct 2026, India storefront, English)

| App | Installs | Rating | Reviews | Last update | Source |
| --- | --- | --- | --- | --- | --- |
| Hevy | 5M+ | 4.9 | 280K | 8 Oct 2026 | [Play](https://play.google.com/store/apps/details?id=com.hevy) |
| **JEFIT** | **5M+** | 4.4 | 89.9K | 10 Oct 2026 | [Play](https://play.google.com/store/apps/details?id=je.fit) |
| **Strong** | **1M+** | 4.2 | 42.7K | 16 Oct 2026 | [Play](https://play.google.com/store/apps/details?id=io.strongapp.strong) |
| Fitbod | 1M+ | 3.8 | 31.7K | 11 Oct 2026 | [Play](https://play.google.com/store/apps/details?id=com.fitbod.fitbod) |
| Lyfta | 1M+ | 4.8 | 63.4K | – | [Play](https://play.google.com/store/apps/details?id=com.lyfta) |
| FitNotes (Android only) | 1M+ | 4.9 | 31.6K | – | [Play](https://play.google.com/store/apps/details?id=com.github.jamesgay.fitnotes) |
| Alpha Progression | 1M+ | 4.7 | 21.3K | – | [Play](https://play.google.com/store/apps/details?id=com.alphaprogression.alphaprogression) |
| Boostcamp | 500K+ | 4.7 | 13.5K | – | [Play](https://play.google.com/store/apps/details?id=com.bpmhealth.boostcamp) |
| Liftosaur | 100K+ | 4.8 | 1.15K | – | [Play](https://play.google.com/store/apps/details?id=com.liftosaur.www.twa) |
| Gym WP | 10M+ | 4.3 | 141K | – | [Play](https://play.google.com/store/apps/details?id=com.lealApps.pedro.gymWorkoutPlan) |
| "Gym Workout Tracker: Gym Log" | 10M+ | 4.9 | 234K | – | [Play](https://play.google.com/store/apps/details?id=gymworkout.gym.gymlog.gymtrainer) |

All rows are OBSERVED.

**Why JEFIT:** it is the only dedicated logger that matches Hevy's 5M+ band on Play, and it has the second-largest review count among dedicated loggers (OBSERVED, table). It is also actively developed. Its iOS version history shows about 25 releases between May and October 2026, adding periodization, interval timers and load progression ([App Store](https://apps.apple.com/us/app/id449810000), OBSERVED).

**Why Strong:** it is the minimalist reference logger. Every 2026 comparison read for this report sets it against Hevy, Fitbod and JEFIT ([JEFIT comparison, 16 Sep 2026](https://www.jefit.com/blog/fitbod-vs-strong-vs-jefit-vs-hevy), OBSERVED; other roundups OBSERVED\*). Its Play numbers are smaller (1M+, 42.7K reviews).

**Why not the others:**
- **Gym WP and the "Gym Workout Tracker: Gym Log" app** have more installs. Neither appears in any comparison consulted. INFERRED: their reach is mass-market and ad-driven rather than mindshare among lifters.
- **Lyfta** has more reviews than Strong. Choosing Strong over Lyfta is a judgement call based on mindshare in comparisons (INFERRED).
- **Boostcamp, Liftosaur and Alpha Progression** are smaller. They appear only in §2.4, where their progression rules sharpen a point.

---

## 2. Per-app teardown

### 2.1 Strong: the fast, minimal notebook

**Positioning.** "The simplest, cleanest, and most easy to use workout and exercise tracker" ([Play](https://play.google.com/store/apps/details?id=io.strongapp.strong), OBSERVED). The help centre says it is meant to stay out of your way, with "no ads, ever" ([What is Strong](https://help.strongapp.io/article/228-what-is-strong), OBSERVED).

**Bottom navigation:** Profile · History · Workout (+) · Exercises · Measure ([Play screenshots](https://play.google.com/store/apps/details?id=io.strongapp.strong), OBSERVED).

#### Core features

| Area | What Strong does | Evidence |
| --- | --- | --- |
| Start | **Empty workout or template.** A large "Start an empty workout" button sits above the template list. Templates are grouped in folders and shown as 2-column cards that preview their exercise names. | [My first workout](https://help.strongapp.io/article/229-my-first-workout); Play screenshot. OBSERVED |
| Set logging | **Grid layout.** Columns are SET · PREVIOUS · KG · REPS · ✓. Tap the checkbox to complete a set. Swipe to delete. "Add Set" sits under each exercise. | Help article 229; Play screenshot. OBSERVED |
| Previous values | **Last time's set is shown inline** (e.g. "80 kg × 5") in grey in the PREVIOUS column, row by row. Whether tapping it copies the values is not documented. | Play screenshot, OBSERVED; tap behaviour UNKNOWN |
| Set types | **Warm-up, Drop and Failure tags**, chosen by tapping the set number. A warm-up row shows an orange "W". Warm-ups are "excluded from charts and metrics". A Failure tag on 5 reps means a 6th rep was attempted and failed. | [Set tags](https://help.strongapp.io/article/166-set-tags); screenshot. OBSERVED |
| Rest timer | **Starts itself.** Default 2:00, "triggers immediately after a set is completed". It appears in the top left and can be tapped to go full screen, where you change the duration or Skip. Each exercise has its own rest duration, with **separate durations for warm-up and working sets**. | [Rest timer](https://help.strongapp.io/article/231-rest-timer). OBSERVED |
| Inline rest bar | **Rest shows between the rows.** After a set is checked, a blue progress bar showing the countdown (e.g. "1:37") appears under that row. Each later set shows its planned rest ("2:00") as small text beneath it. | Play screenshot. OBSERVED |
| Custom keypad | **In-app number pad.** It shows the value with its unit (e.g. "82.5 kg"). A plate-calculator button sits on the weight keypad and an **RPE button** on the reps keypad. **Next** moves to the next field or set. In a superset, Next jumps to the next set of the next grouped exercise (A1→B1→A2). | [Plate calc](https://help.strongapp.io/article/169-plate-calculator), [RPE](https://help.strongapp.io/article/230-about-rpe), [Supersets](https://help.strongapp.io/article/98-supersets-and-circuits); screenshot. OBSERVED |
| Plate calculator | **Per-side plate list** for the target weight. Bar weight comes from each exercise's "Bar Type" (Olympic 20 kg by default). The screenshot shows a drawn bar with coloured plates (25, 5, 1.25) inside the keypad. No settings for which plates you own are documented. Strong PRO only. | Help article 169; screenshot. OBSERVED; plate inventory UNKNOWN |
| Warm-up calculator | **Adds warm-up sets in one go.** Choose "Add/Update Warm-up Sets" from the exercise menu to add or update them as a batch. The formulas are customisable. It works only for barbell, dumbbell and machine exercises. PRO only. The default percentages are not published. | [Warm-up calc](https://help.strongapp.io/article/171-warm-up-calculator). OBSERVED; formula UNKNOWN |
| RPE | **6–10 in half steps**, mapped to RIR in the help table. It is a record only and changes nothing automatically. | Help article 230. OBSERVED |
| Notes | **Three kinds.** A workout note; an exercise note for this session; and a **pinned note**, which "will display in yellow" every time you do that exercise. Pinned notes do not show in History. | [Notes](https://help.strongapp.io/article/134-about-notes); screenshot. OBSERVED |
| Templates write-back | **Prompt at finish, if the workout changed:** Update Template, **Update Values Only** (copies the weights and reps you used into the template), Update Template and Values, or Keep Original. | [Update template](https://help.strongapp.io/article/177-update-template). OBSERVED |
| Focus Metric | **One live comparison per exercise** with your last session of it, e.g. "Volume Increase +10%". | [Focus Metric](https://help.strongapp.io/article/226-focus-metric). OBSERVED; its position on screen UNKNOWN |
| Exercise detail | **Tabs:** About (instructions and video) · History · Charts (PRO) · Records. | [Exercise detail](https://help.strongapp.io/article/237-about-exercise-detail). OBSERVED |
| Records | **Table by rep count**, showing actual best next to predicted best. A real lift that beats the prediction replaces it. Only 12 reps or fewer, because higher counts "inflate" the estimates. Estimated 1RM uses **Brzycki**. | [Records](https://help.strongapp.io/article/216-exercise-records-screen), [1RM](https://help.strongapp.io/article/133-1rm). OBSERVED |
| Profile dashboard | **User-arranged widgets.** Add with "+ Widget", long-press to reorder. Options are Workouts per week (with a 🎯 weekly goal), calories and macros, and **any exercise chart or measurement**. Add a chart from the exercise via "+ Add to Profile". | [Profile widgets](https://help.strongapp.io/article/239-profile-widgets); screenshot ("Bench Press · BEST SET (EST. 1RM)" line chart). OBSERVED |
| Measurements | **Free:** weight, body-fat % and caloric intake. **PRO:** 15 body sites, from neck to calves, with left and right sides. Tap + to add quickly, swipe to delete. The Measure tab shows a weight chart over a dated history list. Syncs with Health Connect. Measurement CSV export was added in 6.2.0 (Sep 2025). | [Measurements](https://help.strongapp.io/article/238-add-measurements); screenshot; [App Store history](https://apps.apple.com/us/app/id464254577). OBSERVED |
| Progress photos | **Attached to workouts:** "Add notes and progress pictures to your workouts" (iOS listing). | [App Store](https://apps.apple.com/us/app/id464254577). OBSERVED; Android UNKNOWN |
| Calendar | **iOS widgets only.** A calendar home-screen widget tracks monthly workouts and weekly streaks (6.4.0, May 2026). | App Store history. OBSERVED; no in-app calendar documented |
| Exercise types | **Includes "Assisted Bodyweight and Duration"** exercises. The full category list is not documented. On Android, dumbbell weight "is automatically doubled" for volume. | [Play](https://play.google.com/store/apps/details?id=io.strongapp.strong), [Dumbbells](https://help.strongapp.io/article/101-how-are-dumbbell-exercises-counted). OBSERVED |
| Muscle heat map | **Listed but undocumented.** The website names "Workout Scheduling, Muscle Heat Map" with no help article and no description. | [strong.app](https://www.strong.app/). OBSERVED (name only); behaviour UNKNOWN |
| Progression | **None.** Strong never suggests what to lift. The only carry-forward is "Update Values Only" at finish. | [JEFIT comparison](https://www.jefit.com/blog/fitbod-vs-strong-vs-jefit-vs-hevy), OBSERVED; INFERRED also from the absence of any such article in [Strong's help centre](https://help.strongapp.io) |
| Recovery | **None documented.** | INFERRED (no help article; the JEFIT comparison says "none") |

#### Interaction details that make it good

- **One screen for the whole workout.** Every exercise is a block of rows on a single scrolling page. You see what you did last time beside what you are doing now (OBSERVED, screenshot). INFERRED: this is why reviewers call it fast. "Strong is the clear winner. It's easy to use, even when you're exhausted mid-workout" is a press quote shown in the Play screenshots.
- **Logging a set:** type or confirm weight, press Next, type reps, tap ✓. That is 2–4 taps and starts the rest timer. INFERRED from the keypad and checkbox articles.
- **Templates carry forward.** With "Update Values Only", the next session opens pre-filled with this session's numbers, so a routine becomes a 1-tap-per-set flow. INFERRED from [help article 177](https://help.strongapp.io/article/177-update-template).
- **Tools live in the keypad.** The plate calculator and RPE sit where your thumb already is, not behind a menu (OBSERVED).

#### Praise and complaints

- **Praise:** simplicity, no ads, rest timer and Apple Watch. "This is bare bones and serious", quoted in the iOS listing ([App Store](https://apps.apple.com/us/app/id464254577), OBSERVED). App Store reviews from 2019–2021 praise the warm-up calculator and the charts (OBSERVED).
- **Complaint: three free templates.** The free tier is limited to 3 templates, and Play reviews from 2021 and 2022 call PRO too expensive for students ([Play](https://play.google.com/store/apps/details?id=io.strongapp.strong), OBSERVED).
- **Complaint: rigid exercise model.** A 2023 review asks for push/pull/squat categories and for weight-plus-duration exercises such as a weighted plank. It also asks for a way to convert an exercise's type without losing history ([App Store](https://apps.apple.com/us/app/id464254577), OBSERVED).
- **Complaint: a 2024 Play review** asks to "compare my previous gym workout (session) with my new" one, exercise by exercise (OBSERVED).
- **Development pace:** the iOS history for June 2025 to October 2026 is mostly fixes, plus widgets, template search, a Live Activity rest timer and CSV export (OBSERVED). Forum posts say development has slowed and data has been lost (OBSERVED\*, [macpowerusers thread](https://talk.macpowerusers.com/t/gym-iphone-app-recommendation/32667), not opened).

---

### 2.2 JEFIT: the planner with a progression engine

**Positioning.** "Over 1400 exercises and thousands of workout routines". Its claim of a community "of over 12 million gym users" is the vendor's own figure ([Play](https://play.google.com/store/apps/details?id=je.fit), OBSERVED).

**Bottom navigation:** Discover · Workout · Progress. The Workout tab has Find / Planned / Instant sub-tabs ([Play screenshots](https://play.google.com/store/apps/details?id=je.fit), OBSERVED).

#### Core features

| Area | What JEFIT does | Evidence |
| --- | --- | --- |
| Logging screen | **One exercise per screen.** A demo video sits on top and can be folded away by swiping up. Swipe left or right to change exercise. The 1RM updates with each set, and "every record breaker in your sets triggers instant notifications". | [Logging revamp, Dec 2023](https://www.jefit.com/blog/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens). OBSERVED |
| Set rows | **Rows with a big LOG SET button.** Warm-up rows show an orange "W". The current set's values are underlined and editable. A greyed "+" row holds the next set's suggested values (e.g. "10 kgs 8 reps") with a Delete action. A large **LOG SET** button sits below. | Play screenshot. OBSERVED |
| Rest and interval timers | **Rest takes over after each set.** The timer "automatically switches to the rest timer after logging". It is a circular countdown with **+15s** and pause, and there is a toggle between stopwatch and countdown. Since May–Jun 2026 you can apply a rest time to every set at once, and the timer stays visible in the log button while the keyboard is open. | Blog (Dec 2023); screenshot; [App Store 17.0.10](https://apps.apple.com/us/app/id449810000). OBSERVED |
| Timed sets auto-log | **Hands-free timed sets.** Give a set an interval timer and JEFIT "will auto-log each one when the countdown ends, kick off rest, then start the next set automatically" (17.2.6, Oct 2026). An Autoplay mode runs a whole workout this way. | App Store history. OBSERVED (iOS); Android UNKNOWN |
| Set types | **Warm-up, Working, Drop and Failure**, set in the routine editor or while logging (tap the set, pick a type, Log). | [Set types, Apr 2025](https://www.jefit.com/blog/set-types-new-in-jefit-customize-your-workouts-with-set-types). OBSERVED; effect on stats UNKNOWN |
| Planning | **Plan → days → exercises.** Weight, reps and rest are set **per set**, and timers per exercise ([routine builder](https://www.jefit.com/blog/introducing-new-routine-builder-workout-planning-simplified), [unified editor](https://www.jefit.com/blog/meet-jefits-all-new-unified-workout-editing-screen)). The Planned tab lists each day with a muscle-map thumbnail, estimated minutes, exercise count and "Not started", under a floating **Start Workout** button. | Blogs (May 2025); screenshot. OBSERVED |
| BodyMap | **Muscle-share silhouette.** It shows "which muscles are being utilized as a percentage of a workout's focus" for a planned day, a live session, or the Workout Complete screen. Tap a muscle to see its sub-muscles. "+" adds exercises for under-worked muscles. Since Oct 2026, cardio counts toward it. | [BodyMap blog, Nov 2025](https://www.jefit.com/blog/introducing-bodymap-a-smarter-way-to-visualize-your-training), [FAQ](https://www.jefit.com/support/faq), [Play what's new](https://play.google.com/store/apps/details?id=je.fit). OBSERVED |
| Muscle recovery | **Front and back silhouettes** under a "Muscle Recovery" card. Per the store text it "decides which muscles are ready to train, and which still need rest". A 2022 user review praises being told "when your muscles are ready to be stressed again". The calculation is unpublished. | Play screenshot; [App Store desc.](https://apps.apple.com/us/app/id449810000). OBSERVED; method UNKNOWN |
| Exercise progress chart | **Combined history and chart.** A headline value has a coloured trend arrow ("Compare to last week, decrease…"). Range chips run 14D · 1M · 3M · 6M · 12M · All, with a **1 Rep Max / Volume** toggle and a labelled **goal line**. Min and Max tiles sit below. Since Oct 2026, history and chart are one page: "tap any point on the chart to instantly see that day's logs". The chart also opens on the range that has data, instead of an empty one. | Screenshot; Play what's new; App Store 17.1.3. OBSERVED |
| Analytics | **Volume and muscle balance.** Store text lists "volume, muscle focus, weekly sets per muscle, and movement balance". A "Muscle Breakdown" card shows a stacked bar of this week's muscles. The NSPI progress score (0–100) is Elite only. | App Store desc.; screenshot; [Periodization post](https://www.jefit.com/blog/periodization-on-your-own-plan). OBSERVED |
| Calendar | **In the Progress tab.** Logged workouts are edited "from the calendar view in the progress tab". | [FAQ](https://www.jefit.com/support/faq). OBSERVED |
| Body stats | **Body weight, body fat and measurements** ("waist, chest, arms, legs"), plus BMI and lean mass tiles with sparklines. Progress photos can be added to any workout. | App Store desc.; screenshot. OBSERVED |
| Equipment-aware loads | **Targets match what you own.** "Edit your available weights right from the workout screen… watch planned sets adjust" (17.2.1). Periodization rounds weights "to plates and dumbbells you own". | App Store history; Periodization post. OBSERVED |
| Instant workout | **On-the-spot workouts.** Set the time, equipment and muscle focus. | App Store desc.; FAQ. OBSERVED |
| Injuries | **Tracked and checked in on.** Rate an injury mild or severe, get check-in reminders, and swaps avoid the injury (17.0.9). | App Store history. OBSERVED |
| Plate calculator | **None.** | JEFIT's own comparison lists it as a con. OBSERVED |
| Wear OS | **Logs without the phone**, then syncs later. The watch screenshot shows a scroll wheel for weight, reps, and a large ✓. | [Wear OS post](https://www.jefit.com/blog/watch-guide-elevate-your-workout-with-jefit-wear-os); screenshot. OBSERVED |

#### Progression logic (the most interesting part)

- **Load Progression Engine.** After each session, the engine "analyzes your session to determine if you've earned progression". **Primary lifts** progress at the top of the rep range "with controlled reps". **Accessory lifts** progress when most sets reach the upper range. Increases are usually 2.5–5%, depending on equipment. Rep ranges come from your goal, your experience, whether the lift is primary or accessory, its movement pattern, and your equipment ([FAQ](https://www.jefit.com/support/faq), OBSERVED).
- **Periodization on your own plan** (Aug 2026, Elite). Settings → Workouts → "Auto-apply periodization" ([Periodization post](https://www.jefit.com/blog/periodization-on-your-own-plan), OBSERVED):
  - **Phases:** On-Ramp → Accumulation → Intensification → Deload, each about a week. A new cycle starts higher than the last.
  - **Exercises stay put.** Only the targets change, and you see a preview of what changed when a phase turns over.
  - **Weights go up at the top of the rep range.** Lighter targets come only from a Deload or a return from a break, "not from a missed set".
  - **Two set structures.** Primary lifts pyramid to one top set. Accessories use straight sets.
  - **Bridge week.** If a phase falls short, it repeats once at steady weights.
  - **Pausing.** Turning the feature off restores your last logged weights. A break of up to 2 weeks resumes the same phase; a longer one restarts at On-Ramp.
  - **"Why this target".** The logging screen shows a target weight and rep range. A **purple star** explains why the target was chosen.
- **Adaptive Plan.** A generated 12-week plan in 3 mesocycles. It advances, holds (a "bridge week") or deloads each week based on load progression, volume completion and movement balance. A Weekly Recap screen says what changed and why ([Adaptive mesocycle, Apr 2026](https://www.jefit.com/blog/adaptive-mesocycle-training-jefits-smarter-way-to-progress), OBSERVED).
- **Assisted exercises.** Load progression "now correctly understands that less resistance means harder" (17.2.4) ([App Store](https://apps.apple.com/us/app/id449810000), OBSERVED).

#### Praise and complaints

- **Praise.** Customisation, the exercise database, and muscle balance and recovery views. One 2022 review: "detailed break of how much your working each muscle". A long-time 2022 Play review: "5 years since my first review… there is still no competition" ([Play](https://play.google.com/store/apps/details?id=je.fit), [App Store](https://apps.apple.com/us/app/id449810000), OBSERVED).
- **Complaint: unreliable sync and logging.** Reviews describe sync failures and lost logs (2017, 2019, 2024). One 2019 review: "if you forget to click 'finish workout'… it will actually log the ENTIRE TIME". One 2023 Play review: the app "stops working mid workout" (OBSERVED).
- **Complaint: bugs.** "There is not A DAY that goes by without having to report a bug" (App Store, Jul 2026, OBSERVED).
- **Complaint: churn and clutter.** One 2020 review: "More and more pop up prompts". Another: input "resetting itself… to a less intuitive scroller option instead of just using the keyboard" (OBSERVED). Roundups call the dashboard cluttered (OBSERVED\*).
- **Complaint: ads and upsells in the free tier** (OBSERVED\*, roundup summaries).

---

### 2.3 Fitbod (supplementary): recovery, generation, progression

Fitbod is a generator rather than a notebook. Its Android rating is the lowest of the four (3.8). It is included because its help centre documents recovery and progression better than any other app.

**Bottom navigation:** Workout · Body · Targets · Log ([Play screenshots](https://play.google.com/store/apps/details?id=com.fitbod.fitbod), OBSERVED).

**Recovery model** ([Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery), [How Fitbod knows my muscles are recovering](https://help.fitbod.me/hc/en-us/articles/43492170863895), all OBSERVED):
- **Inputs.** Sets, reps and weight logged per exercise. Each muscle group gets a **0–100% recovery** figure that climbs back over time. Full recovery takes "six days" in one article and "up to seven days" in the newer one.
- **What else counts.** Cardio counts, and so do workouts imported from Health Connect: a long run lowers the legs' recovery. Body stats refine the estimate.
- **The Body tab** shows a front and back heat map. You rotate it by swiping, and tap a muscle to see its history and recovery.
- **The header shows two numbers:** "3 days since your last workout" and "5 fresh muscle groups". Fatigued muscles are shaded pink and red (screenshot, OBSERVED).
- **You can override it** by editing a muscle's percentage by hand. "The percentages are… a good general guide rather than a reading of your actual physiology."
- **Recovery is a soft input.** A muscle at 0% is normally skipped, but split days can still include it at lower intensity. Accessory muscles get one or two exercises regardless.

**Generation** ([How Fitbod chooses exercises](https://help.fitbod.me/hc/en-us/articles/43489509474455), [My Plan](https://help.fitbod.me/hc/en-us/articles/34336407191191-My-Plan), [Customizing today's workout](https://help.fitbod.me/hc/en-us/articles/38318585683991-Customizing-Today-s-Workout), all OBSERVED):
- **Five inputs:** how effective an exercise is for your goal, the equipment available (a hard filter), recovery, a variability setting, and your feedback.
- **Gym "Locations".** Each location has its own equipment list and the weight increments you own. There is also a **Bodyweight-only mode**, and a **Fresh Muscle Groups** split that targets your two most recovered groups.
- **Today's controls.** The duration (15–90 min) scales the number of exercises. A **Swap** menu changes the split day or the muscles, or lets you build the workout from scratch.
- **Learning from you.** "Recommend more / less / don't recommend again" adjusts selection, and skips, replaces and manual additions are also treated as signals.

**Progression** ([How Fitbod decides sets, reps and weight](https://help.fitbod.me/hc/en-us/articles/43489869175063), [How Fitbod adapts](https://help.fitbod.me/hc/en-us/articles/43492523917207), all OBSERVED):
- **Driven by history.** Complete an exercise comfortably and load or reps go up; struggle and later targets ease off.
- **Varied on purpose.** Intensity changes between sessions, alternating lighter, higher-rep days with heavier days.
- **Reps in Reserve.** You are prompted for RiR (0–4+) after each set.
- **Max Effort Days.** Ramp-up sets followed by two AMRAP sets recalibrate the Estimated Strength figure (a projected 1RM).
- **Conservative where history is thin.** **New exercises start conservatively.** After a **break**, suggested weights drop automatically.

**Statistics** ([Metrics & Records](https://help.fitbod.me/hc/en-us/articles/12732749777047-Fitbod-Metrics-Records), [Weekly Set Targets](https://help.fitbod.me/hc/en-us/articles/24739986755223-Weekly-Set-Targets), [Workout Report](https://help.fitbod.me/hc/en-us/articles/16436302450711-Your-Workout-Report); screenshots; all OBSERVED):
- **Weekly Set Targets.** A hexagon ring shows overall % ("43%"). Rows read "Push Muscles 15/30 sets · 15 to go" and expand to individual muscles. Primary-muscle sets count 1 and secondary 0.5, though the same article also says secondaries don't count, so it contradicts itself.
- **Strength scores.** An **Overall Strength** score is built from per-muscle "mStrength" values, each shown with a sparkline. It stays locked ("Hit every muscle to unlock this score") until each primary muscle has 6 or more sets logged.
- **Workout Report.** Cards for totals (workouts, weight lifted, duration), each compared with the previous period. A Week / Month / 6M / Year filter applies, alongside muscle strength and muscle volume sections.
- **Estimated Strength chart** per exercise. For **bodyweight exercises it is max reps**, and added weight is ignored.

**Logging UI** (screenshot, OBSERVED):
- **Prescribed values.** Each set row is pre-filled with the reps and weight Fitbod picked. The active row is outlined, with "Reps" and "Weight (lb)" labels and a "Bar + Plates" hint.
- **Chips above the sets:** Rest timer: On · History · Replace.
- **Fewer taps.** A Play review (Nov 2024) mentions a **"log all sets"** button and asks for it to warn before logging everything (OBSERVED).

**Complaints** ([Play](https://play.google.com/store/apps/details?id=com.fitbod.fitbod), [App Store](https://apps.apple.com/us/app/id1041517543), all OBSERVED):
- **Price.**
- **Equipment limits ignored.** "I only own up to 20 lbs in dumbbells, but I cannot set that anywhere" (Nov 2024; the current My Plan help now documents weight increments).
- **Missing exercises.**
- **Locked navigation.** You can't move around the app during a workout (2024).
- **Forgotten finish.** Forgetting to end a workout logs "299 minutes".

---

### 2.4 Progression rules elsewhere

- **Hevy Trainer** (Pro). It raises a weight only when "you hit the upper end of the rep range with a specific weight on all prescribed sets". The Previous column shows last time "as a target to beat". Deload logic and increments are not stated ([Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/), OBSERVED).
- **Liftosaur** ships three named rule types ([Liftoscript docs](https://www.liftosaur.com/docs/liftoscript), OBSERVED):
  - **Linear** `lp(increment, successes needed, …, decrement, failures allowed)`.
  - **Double** `dp(increment, min reps, max reps)`.
  - **Reps-sum** `sum(total reps threshold, increment)`.
  - **Deload:** `progress: none` turns progression off for a deload week.

  This is the cleanest model to copy, because each rule is just a few numbers.
- **Boostcamp.** "Hit your reps and the app increases the load next session" (Pro). It also has a built-in plate calculator ([boostcamp.app](https://www.boostcamp.app/), OBSERVED).

### 2.5 Bodyweight and calisthenics in gym loggers (input for EIO's Calisthenics mode)

| App | How bodyweight work is handled | Evidence |
| --- | --- | --- |
| Strong | An "Assisted Bodyweight" exercise type and "Duration" exercises exist. A user asked for a weighted plank (weight × time) and was told it isn't possible. | [Play](https://play.google.com/store/apps/details?id=io.strongapp.strong), [App Store review 2023](https://apps.apple.com/us/app/id464254577). OBSERVED |
| JEFIT | Assisted exercises progress the right way round, with less assistance meaning a harder set (17.2.4). Interval-timer sets auto-log, which suits holds. | [App Store](https://apps.apple.com/us/app/id449810000). OBSERVED |
| Fitbod | A Bodyweight-only mode. Estimated Strength for bodyweight exercises is max reps. Back and biceps exercises are limited without a pull-up bar. | [Metrics](https://help.fitbod.me/hc/en-us/articles/12732749777047-Fitbod-Metrics-Records), [My Plan](https://help.fitbod.me/hc/en-us/articles/34336407191191-My-Plan). OBSERVED |
| Hevy (for contrast) | Three types: bodyweight, weighted and assisted. Assisted volume = (bodyweight − assistance) × reps, and needs a logged bodyweight. PRs for assisted exercises are limited to best total reps and most reps in a set. | [Hevy help](https://help.hevyapp.com/hc/en-us/articles/34380762441111). OBSERVED |

None of the three apps documents skill ladders (e.g. tuck → advanced tuck → straddle → full planche), progression by harder variation, or hold-time progression. INFERRED from the absence of any such help or product page. Dedicated calisthenics apps were outside this report's scope (UNKNOWN).

---

## 3. What EIO already has

EIO Fitness already covers the core of a lifting log:
- **Four views:** Log, Routines, Exercises and Body. The Log view has a 7-day strip, a streak, weekly volume and the session history.
- **Sessions.** Freestyle or from a routine. Each session is created on start, every set saves as it is logged, and there is **no finish step**.
- **Set logging.** Weight × reps or weight × seconds, a muscle-grouped picker, repeat-last-set, and a rest timer with presets. The date is editable and notes are supported.
- **Records.** A PR badge for each rep count, and a chart of estimated 1RM per exercise.
- **Library and body.** Per-user exercises with 11 muscle tags and a reps-or-time tracking type. Routines with target sets and reps. One weigh-in a day, plus height and BMI.

The schema already stores more than the UI shows:
- `session_sets` has a `created_at` timestamp on **every set**, plus an `rpe` column that the app currently writes as `null` (`app/src/modules/fitness/screens/WorkoutSessionScreen.tsx:214`).
- `routine_exercises` has `target_sets` and `target_reps` but **no target weight or rep range**.
- `exercises` has a single `muscle_group` and no equipment or load-type field ([0011](../../supabase/migrations/0011_fitness_v2.sql), [0014](../../supabase/migrations/0014_fitness_detail.sql)).

---

## 4. Gap analysis

This section lists only what JEFIT, Strong or Fitbod do that EIO lacks **and** that Hevy lacks or does worse. Hevy's side was checked only against its [features index](https://www.hevyapp.com/features/) and [Trainer page](https://www.hevyapp.com/features/workout-plan-generator/). "Hevy: UNKNOWN" means the Hevy report should confirm it.

| # | Gap | Who has it | Hevy | Why it matters for EIO |
| --- | --- | --- | --- | --- |
| G1 | **Per-muscle recovery / freshness model** with a body map and manual override | Fitbod (documented), JEFIT (exists; method unknown) | Not on the features index (INFERRED absent) | Answers "what should I train today?" without a program, especially when gym and calisthenics days mix. |
| G2 | **Progression targets on your own routines**, with a "why" explanation | JEFIT (Aug 2026 periodization on DIY plans; purple-star explanation) | Only inside Hevy Trainer's generated programs (INFERRED from the Trainer page); explanation UNKNOWN | EIO users write their own routines. A target in the set row is the single biggest aid to progressive overload. |
| G3 | **Targets rounded to the plates and dumbbells you own** | JEFIT, Fitbod | UNKNOWN | A target of "41.25 kg" is useless when the gym has 2.5 kg steps. |
| G4 | **Break and deload handling** (lower targets after a gap; deload phases; bridge week) | JEFIT, Fitbod | Trainer deload not stated (UNKNOWN) | Prevents a bad first session back after illness or travel. |
| G5 | **Weekly set targets per muscle** with "N to go" | Fitbod | Has a *sets per muscle group per week* chart; targets UNKNOWN | Turns a passive chart into a weekly checklist. |
| G6 | **Equipment / location profiles** (Gym, Home, Bodyweight-only) that filter exercises and drive suggestions | Fitbod; JEFIT Instant Workout | Trainer asks for equipment at onboarding; switchable profiles UNKNOWN | **This maps directly onto EIO's planned Gym and Calisthenics modes.** |
| G7 | **Timed sets that auto-log** at the end of a countdown and roll into rest and the next set | JEFIT (Oct 2026) | UNKNOWN | Calisthenics holds (plank, L-sit, dead hang) are already a first-class `duration_seconds` type in EIO. |
| G8 | **Records table by rep count with predicted values** (Brzycki, ≤12 reps) | Strong | UNKNOWN | EIO already has PRs per rep count; this adds "what you could lift for 3". |
| G9 | **Live comparison with last session** of the same exercise ("+10% volume") | Strong (Focus Metric); a Play review asks for whole-session comparison | UNKNOWN | Motivating feedback during the session, at no data cost. |
| G10 | **Separate rest for warm-up and working sets** per exercise | Strong | UNKNOWN | Removes manual timer fiddling after every warm-up set. |
| G11 | **Exercise chart and history on one page**, where tapping a point shows that day's sets, with a goal line and range chips | JEFIT | UNKNOWN | Better than a bare 1RM line, and exactly where EIO's chart already is. |

Things the three apps have that **Hevy also has** are not gaps against Hevy, but EIO still lacks them. They appear in §5 marked "(also Hevy)": the previous column, set types, supersets, plate and warm-up calculators, RPE, measurements, progress photos, sets-per-muscle charts, calendar, and pinned exercise notes. Hevy added pinned notes in its Oct 2026 release ([Play what's new](https://play.google.com/store/apps/details?id=com.hevy), OBSERVED).

---

## 5. Recommendations

All of these are for one person logging their own training. **Dropped:**
- **Social:** feeds, community, challenges, share cards, leaderboards and Iron Points.
- **Coaching marketplace:** coach mode and trainer platforms.
- **Monetisation:** paywalls and upsells.
- **Population-data features:** percentile ranking, and Fitbod's "87 million workouts" effectiveness data. EIO has no population to compare against.

Effort: **S** = about a day, **M** = a few days, **L** = a week or more (INFERRED estimates).

### TOP 5

**1. Next-session targets on your own routines: progression rules plus a "why" chip.**
- **What it is.**
  - **Rep range and rule per routine exercise.** Each routine exercise gets a rep range (min–max), an increment and a rule:
    - *double progression*, the default;
    - *linear*;
    - *reps-sum*;
    - *time* (+N seconds for holds);
    - *none*.
  - **Targets from last time.** When a session starts, compute each working set's target from that exercise's last session. Show the target as ghost text in the set row.
  - **A chip explains it**, e.g. "12/12/11 last time → stay at 40 kg, aim for 12".
  - **Round to owned weights.** Round to your plate or dumbbell steps (see #7).
  - **After a gap of more than 14 days**, drop the target and say so.
  - **Assisted movements** progress by *reducing* assistance.
- **Why it matters.** The question a log exists to answer is "what do I lift today?". Strong never answers it; EIO answers it only by showing history. A suggested number in the row turns the log into a coach without taking control away. It is always just a placeholder you can overwrite.
- **Who has it.**
  - JEFIT: top of the rep range, +2.5–5%, purple-star "why", rounding to owned weights, break handling.
  - Fitbod: comfortable → up, struggle → down, eases back after a break.
  - Hevy Trainer: all sets at the top of the range → increase.
  - Liftosaur: `lp`, `dp` and `sum` rules.
- **Effort:** M.
- **Database change: yes.** Add `rep_min`, `rep_max`, `increment_kg` and `progression_rule` to `routine_exercises`, with an optional default on `exercises`. `target_reps` can become `rep_max`.

**2. "Today" body map: recovery plus weekly sets, on one screen.**
- **What it is.**
  - **Silhouettes.** A front/back silhouette coloured by each muscle tag's freshness (0–100%).
  - **Fatigue model.**
    - Every working set adds fatigue to its muscle, 1.0 for the primary tag and 0.5 for a secondary tag if one is added later.
    - Fatigue fades to fresh over about 6–7 days, scaled by how much was done.
  - **Header.** "N days since last workout · N fresh muscle groups".
  - **Tap a muscle** to see its recent sets and a manual override.
  - **Weekly set targets.** Below the map, a ring per region shows progress, e.g. "Back 9/14 sets · 5 to go".
  - **Targets default** to your own 4-week average, so EIO makes no science claim of its own.
- **Why it matters.** With mixed gym and calisthenics days and no fixed program, the main daily decision is what to train. Hevy shows volume distribution but no recovery (G1).
- **Who has it.** Fitbod (recovery % and heat map, 6–7 day horizon, override, weekly set targets with primary 1 / secondary 0.5), JEFIT (Muscle Recovery card, BodyMap, weekly sets per muscle).
- **Effort:** M. Most of the work is a drawn body map with 11 regions; the model is a small client-side function over `session_sets`.
- **Database change: no** for a first version (computed). Optional later: `exercises.secondary_muscles text[]` and a weekly-target setting.
- **INFERRED caveats.**
  - "Cardio" and "Full body" need special handling, e.g. spreading one set across regions.
  - Recovery is an estimate. Say so in the UI, as Fitbod does.

**3. Faster set rows: the Strong-style grid, upgraded.**
- **What it is.**
  - **The grid:** SET · PREVIOUS · KG · REPS · ✓ for every exercise in the session. PREVIOUS shows the same set number from last time ("40 × 10"), greyed; tapping it copies the values.
  - **Set types:** a W, D or F tag set by tapping the set number. Warm-ups are excluded from PRs, volume and charts.
  - **Inline rest:** a countdown bar inserted under the set you just checked.
  - **An in-app number pad** with Next, ± steppers, the plate calculator on the weight pad and **RPE/RIR on the reps pad**.
- **Why it matters.** This is the most-used screen in the module. EIO's "repeat last set" is good, but it copies *this* session's previous set, not last week's. Previous values are the basis of #1.
- **Who has it.** Strong (all of it); JEFIT (W tag, ghost next set, auto rest); Fitbod (pre-filled rows). Hevy also has a previous column and set types.
- **Effort:** M.
- **Database change: yes, small.** Add `session_sets.set_type` (warmup | working | drop | failure, default working). RPE needs **no** change: the `rpe` column already exists and is written as null today.

**4. Gym and Calisthenics modes as equipment profiles, with honest load types.**
- **What it is.**
  - **A mode switch on the Log view** sets the session's mode, filters the exercise picker, and picks which stats appear. Gym puts 1RM and volume first. Calisthenics puts reps, hold time and assistance first.
  - **Load type per exercise:**
    - *external* (barbell, dumbbell or machine);
    - *bodyweight*;
    - *weighted bodyweight* (+kg);
    - *assisted* (−kg);
    - *timed hold*, which already exists.
  - **Volume and PRs follow Hevy's documented formula.** For assisted work: (bodyweight − assistance) × reps, using the nearest `body_metrics` weigh-in.
  - **Progression uses reps for bodyweight work** (Fitbod treats max reps as bodyweight strength).
  - **Equipment tag per exercise**, e.g. barbell, dumbbell, machine, cable, bar, rings, parallettes, bands, none.
- **Why it matters.** It is what the user asked for. Without load types, a pull-up logged as "0 kg × 10" has no meaningful volume or 1RM, and an assisted pull-up looks *easier* as the assistance drops.
- **Who has it.** Fitbod (gym locations with equipment lists, Bodyweight-only mode); Strong (Assisted Bodyweight type); JEFIT (assisted progression); Hevy (three bodyweight types).
- **Effort:** M.
- **Database change: yes.** Add `exercises.load_type` and `exercises.equipment`, and `workout_sessions.mode`.

**5. A session summary with no finish step.**
- **What it is.**
  - **Card.** When the last set is more than about 30 minutes old, or the day changes, the session card in Log collapses into a summary:
    - duration, inferred from the first and last set's `created_at`;
    - working sets and volume;
    - PRs hit;
    - a mini body map of muscles worked;
    - a comparison with the last session of the same routine (Strong's Focus Metric idea, applied per session).
  - **Calendar.** Add a month calendar or year heatmap of training days to the Log view.
- **Why it matters.** EIO's "no finish workout" design is a strength. JEFIT and Fitbod users complain about forgetting to finish and getting absurd durations ("299 minutes"). So keep it, and infer what the others ask you to confirm.
- **Who has it.**
  - Summaries: JEFIT (Workout Complete screen with BodyMap), Fitbod (post-workout heat map), Strong (History cards).
  - Calendars: JEFIT (Progress tab), Strong (iOS calendar widget with weekly streaks).
  - Hevy has a calendar.
- **Effort:** S–M.
- **Database change: no.**
- **INFERRED caveat.** Back-dated sessions (EIO allows editing the date) have meaningless timestamps. Show duration only when the sets fall on the session's date and span less than about 4 hours.

### The rest, in priority order

| # | Recommendation | Who has it | Effort | DB change |
| --- | --- | --- | --- | --- |
| 6 | **RPE/RIR entry** on the reps pad, with the RPE↔RIR table. Feeds #1: e.g. hold the weight if RIR is 0 on every set. | Strong; Fitbod RiR prompt. Also Hevy | S | **No.** The column exists. |
| 7 | **Plate calculator** with *your* plate inventory and a bar weight per exercise (20 kg, 15 kg, EZ, fixed bars). Draw the bar and plates in the keypad. | Strong; Boostcamp; Fitbod "Bar + Plates" hint. Also Hevy. JEFIT rounds to owned plates but has no calculator | S | Small. Store the inventory in a profile JSON field or locally. Optional `exercises.bar_kg`. |
| 8 | **Warm-up generator.** One tap adds W sets ramping to the first working weight, with editable percentages. | Strong; Fitbod "Add Warm-Up Set". Also Hevy | S | No, once #3's `set_type` exists. |
| 9 | **Exercise detail with tabs:** About (your own notes and a video link) · History · Charts · Records. Records holds the rep-count table with predicted values (Brzycki, ≤12 reps). | Strong | S–M | No. An optional `exercises.video_url` and `notes`. |
| 10 | **Chart upgrades:** range chips, metric toggle (e1RM / volume / best weight / reps / hold time), goal line, min/max tiles, tap a point to see that day's sets, and open on the range that has data. | JEFIT; Strong charts | M | Optional `exercises.goal_kg`. |
| 11 | **Pinned exercise note** shown in a yellow strip every time you do the exercise (setup cues, seat height). | Strong; Hevy (Oct 2026) | S | Yes: `exercises.pinned_note`. |
| 12 | **Rest per exercise, with separate warm-up and working durations**, auto-starting on ✓. | Strong; JEFIT | S | Yes, small: `exercises.rest_seconds` and `warmup_rest_seconds` (or local). |
| 13 | **Timed-set countdown that auto-logs**, then starts rest, then the next set. | JEFIT | M | No. `duration_seconds` exists. |
| 14 | **Supersets and circuits:** a link icon groups exercises; Next alternates A1→B1→A2; one rest after the pair. | Strong, JEFIT, Fitbod. Also Hevy | M | Yes: a superset group id on `routine_exercises` and `session_sets`. |
| 15 | **Body measurements and body fat:** sites with left/right pairs, a chart per site, quick "+" entry. | Strong (PRO); JEFIT; Fitbod (via Health Connect). Also Hevy | M | Yes: a new `body_measurements` table. |
| 16 | **Progress photos**, attached to a date or a session, viewed side by side. | Strong (iOS), JEFIT. Also Hevy | M–L | Yes: a table plus a Supabase Storage bucket with RLS. |
| 17 | **Replace-exercise sheet** sorted by same muscle, then most logged, with a same-equipment filter. | Fitbod; Hevy Trainer | S | No (better with #4's equipment tag). |
| 18 | **Dashboard widgets:** workouts per week against a weekly goal; pin any exercise chart. | Strong | S–M | Small: the weekly goal in profiles. |
| 19 | **"Suggest today's session"** built from the freshest muscles, the current mode's equipment and a duration. | Fitbod; JEFIT Instant Workout | L | No, beyond #2 and #4. |
| 20 | **Deload week / phases on your own routines:** a toggle marks a week as deload, which pauses progression and lightens targets. | JEFIT; Liftosaur `progress: none` | M | Small: a deload flag by date range. |

**Not recommended:**
- **Strength or percentile scores.** They need population data or opaque models.
- **A 1,400-exercise library.** EIO's own exercises plus video links are enough, and copying a library is off-limits.
- **AI plan generation.** Too much complexity for one user.
- **Watch apps,** unless the user owns a Wear OS watch (UNKNOWN).

---

## 6. UI/UX patterns worth adopting

These are written to be buildable without seeing the apps. Sources are in brackets.

1. **Session grid** (Strong screenshot).
   - **Exercise block.** Each exercise is a block: a header row (exercise name in the accent colour, which opens its detail; a link icon for supersets; ⋯), then an optional yellow pinned-note strip, then a column header row in small caps: `SET · PREVIOUS · KG · REPS · ✓`.
   - **Set rows.**
     - The SET cell shows a number, or a coloured letter for set types (W in orange).
     - PREVIOUS is muted grey text ("80 kg × 5"), or "—" if there is no history.
     - KG and REPS are rounded input cells.
     - ✓ is a square checkbox. A completed row gets a light green tint and a filled green check.
   - **"+ Add set"** sits under the last row.
2. **Inline rest timer** (Strong screenshot, help article 231).
   - **The bar.** When ✓ is tapped, a full-width progress bar appears directly under that row, counting down ("1:37"). Each unchecked set shows its planned rest ("2:00") as tiny centred text beneath it.
   - **Expanded view.** Tap the bar to open a full-screen timer with −15 / +15 and Skip.
   - **Default durations** are per exercise, with a shorter one for warm-ups.
3. **In-app keypad** (Strong help articles 169 and 230, screenshot).
   - **Layout.** A bottom sheet replaces the system keyboard. The top-left shows the value being edited with its unit ("82.5 kg"). There are large digits and ± step buttons (2.5 kg on weight, 1 on reps), and a wide **Next** key.
   - **Tool key.** On the weight field it opens a drawn barbell with plates per side, colour-coded by plate size. On the reps field it opens an RPE/RIR row.
4. **Ghost next set** (JEFIT screenshot). The next unlogged set shows the suggested numbers as placeholder text. One tap on ✓ accepts them, and typing overrides them. Put a small ★ or "why" chip next to a suggested target. Tapping it opens a one-line explanation (JEFIT purple star).
5. **Recovery body map** (Fitbod help and screenshot).
   - **Silhouettes.** Front and back silhouettes side by side, or swipe to rotate. Each muscle region is filled on a single-hue scale from neutral (fresh) to the accent colour (fatigued).
   - **Header.** Two big numbers with small captions: "3 · days since last workout", "5 · fresh muscle groups".
   - **Tap a region** to open a sheet with its recovery %, recent sets and an override slider.
   - **Disclaimer.** One line saying the figures are estimates.
6. **Weekly set targets** (Fitbod screenshot).
   - **Overall ring.** One large progress ring with the overall % in the centre.
   - **Group rows** below it: `[mini ring] Push muscles · 15/30 sets · 15 to go ⌄`, expanding to per-muscle rows.
   - **Empty state.** Lock it until there is data, with a sentence telling the user what to log, as Fitbod's "Hit every muscle to unlock this score" does.
7. **Exercise chart card** (JEFIT screenshot, Play what's new).
   - **Headline.** The latest value in a large number with a coloured arrow and a one-line delta ("−5 kg vs last week").
   - **Controls.** A segmented control (e1RM | Volume), and range chips (14D 1M 3M 6M 1Y All) in a pill row.
   - **Chart.** A line chart with a dashed, labelled goal line. Tapping a point shows a tooltip with the date and value, and lists that day's sets below.
   - **Below the chart:** two tiles (Min, Max).
   - **Empty range.** Default to the newest range that contains data, never an empty chart.
8. **Records table** (Strong help article 216). Rows are rep counts 1–12. Columns are *Best actual* and *Predicted*. A predicted cell becomes a bold actual value when a real lift beats it.
9. **Templates list** (Strong screenshot).
   - **Quick start** goes first, as a full-width primary button: "Start an empty workout".
   - **Routines** follow in collapsible folders, as 2-column cards. Each card shows the title, the first exercises in grey (truncated) and when it was last done.
10. **Plan day rows** (JEFIT screenshot). Each row shows a small muscle-map thumbnail, then the day and title, then "~27 min · 9 exercises", then a status ("Not started" or "Done Tue"). A floating **Start workout** pill sits bottom right.
11. **Workout card for a suggested session** (Fitbod screenshot). The title is followed by "7 exercises · 3 muscles" and chips for the duration ("45m") and the mode or equipment profile ("Gym", "Bars only"). Exercise rows show a thumbnail and "4 sets · 7 reps · 40 kg". There is a **Swap** button at the top right.
12. **Equipment picker** (Fitbod screenshot). Group the list (Small weights, Benches & racks, Bars & rings, Bands, Cable machines), each item with a right-aligned checkbox, under tabs for Most used / All / Selected.
13. **Profile dashboard** (Strong help article 239, screenshot). A vertical stack of cards the user chooses. Add with "+" and long-press to drag. Each card has its own ⋯ menu. A weekly bar chart has a goal line, and any chart can be pinned from its exercise.
14. **Gestures.** Swipe left on a set to delete (Strong, Fitbod). Long-press an exercise to drag and reorder (Fitbod). Tap the set number to choose its type (Strong).
15. **Muscles-hit summary** on the collapsed session card (JEFIT Workout Complete, Fitbod post-workout map). A small silhouette shows the regions trained, with the share of sets for each.

---

## 7. Checklist status

| # | Question | Status | Notes |
| --- | --- | --- | --- |
| Q1 | Top two apps besides Hevy | **Answered** | Play figures read directly on 19 Oct 2026. Choosing Strong over Lyfta is a judgement (INFERRED). |
| Q2 | Core features | **Answered** | Strong from its help centre; JEFIT from blogs, FAQ, store text and changelog; Fitbod from its help centre. |
| Q3 | Logging speed, taps, pre-fill | **Partial** | Layout OBSERVED from screenshots and help. Tap counts INFERRED. Whether tapping Strong's PREVIOUS cell copies values is UNKNOWN. |
| Q4 | Progression logic | **Answered for JEFIT, Fitbod, Hevy Trainer and Liftosaur; Strong has none** | Exact formulas and thresholds (JEFIT NSPI, Fitbod mStrength) are UNKNOWN. |
| Q5 | Recovery visualisation | **Partial** | Fitbod fully documented. JEFIT's card exists but its method is UNKNOWN. Strong's website "Muscle Heat Map" is undocumented. |
| Q6 | Statistics screens | **Answered** | Combination of help articles and screenshots. |
| Q7 | Plate and warm-up calculators | **Partial** | Strong's behaviour is documented, but its warm-up percentages and plate inventory are UNKNOWN. JEFIT has none. Fitbod's "Bar + Plates" hint is UNKNOWN beyond the screenshot. |
| Q8 | Measurements and photos | **Answered** | Strong, JEFIT, Fitbod. Strong photos confirmed on iOS only. |
| Q9 | Calendar and heatmap | **Partial** | JEFIT calendar in the Progress tab; Strong only as an iOS widget; Fitbod UNKNOWN. |
| Q10 | Exercise library | **Partial** | Sizes and instructions OBSERVED. Strong's full exercise-type list UNKNOWN. |
| Q11 | Finish and summary | **Partial** | That summaries exist is OBSERVED. Strong's finish-screen content is UNKNOWN. |
| Q12 | Praise and complaints | **Partial** | Store reviews only, many from before 2025. Reddit was not accessible. |
| Q13 | Bodyweight and calisthenics handling | **Partial** | Load types covered. Skill-ladder progressions are not documented in these apps; dedicated calisthenics apps are out of scope. |
| Q14 | Where they beat Hevy | **Partial** | Hevy checked only on its features index and Trainer page. G-rows marked "UNKNOWN" need the Hevy report to confirm. |

**Unresolved and worth a follow-up:** how JEFIT computes recovery; what Strong's "Muscle Heat Map" and "Workout Scheduling" do; Strong's default warm-up percentages; whether Hevy has recovery or weekly set targets; Android parity of JEFIT's 2026 iOS features (interval auto-log, available-weights editing); and current Reddit sentiment.

---

## Sources

**Store listings and version histories** (fetched 19 Oct 2026)
- Google Play (hl=en, gl=IN): [Hevy](https://play.google.com/store/apps/details?id=com.hevy), [JEFIT](https://play.google.com/store/apps/details?id=je.fit), [Strong](https://play.google.com/store/apps/details?id=io.strongapp.strong), [Fitbod](https://play.google.com/store/apps/details?id=com.fitbod.fitbod), [Lyfta](https://play.google.com/store/apps/details?id=com.lyfta), [FitNotes](https://play.google.com/store/apps/details?id=com.github.jamesgay.fitnotes), [Alpha Progression](https://play.google.com/store/apps/details?id=com.alphaprogression.alphaprogression), [Boostcamp](https://play.google.com/store/apps/details?id=com.bpmhealth.boostcamp), [Liftosaur](https://play.google.com/store/apps/details?id=com.liftosaur.www.twa), [Gym WP](https://play.google.com/store/apps/details?id=com.lealApps.pedro.gymWorkoutPlan), [Gym Workout Tracker: Gym Log](https://play.google.com/store/apps/details?id=gymworkout.gym.gymlog.gymtrainer), [Gymverse](https://play.google.com/store/apps/details?id=com.fitness22.workout), [Gym Day](https://play.google.com/store/apps/details?id=com.anthonyng.workoutapp)
- App Store (US): [Strong](https://apps.apple.com/us/app/id464254577), [JEFIT](https://apps.apple.com/us/app/id449810000), [Fitbod](https://apps.apple.com/us/app/id1041517543)

**Strong**
- [strong.app](https://www.strong.app/)
- Help centre: [help.strongapp.io](https://help.strongapp.io)
- Help articles:
  - Logging: [229 my first workout](https://help.strongapp.io/article/229-my-first-workout), [231 rest timer](https://help.strongapp.io/article/231-rest-timer), [166 set tags](https://help.strongapp.io/article/166-set-tags), [230 RPE](https://help.strongapp.io/article/230-about-rpe), [98 supersets](https://help.strongapp.io/article/98-supersets-and-circuits), [134 notes](https://help.strongapp.io/article/134-about-notes)
  - Calculators: [169 plate calculator](https://help.strongapp.io/article/169-plate-calculator), [171 warm-up calculator](https://help.strongapp.io/article/171-warm-up-calculator)
  - Records and stats: [226 focus metric](https://help.strongapp.io/article/226-focus-metric), [237 exercise detail](https://help.strongapp.io/article/237-about-exercise-detail), [216 records](https://help.strongapp.io/article/216-exercise-records-screen), [133 1RM](https://help.strongapp.io/article/133-1rm), [239 profile widgets](https://help.strongapp.io/article/239-profile-widgets), [238 measurements](https://help.strongapp.io/article/238-add-measurements)
  - Templates and exercises: [177 update template](https://help.strongapp.io/article/177-update-template), [105 templates](https://help.strongapp.io/article/105-about-templates), [101 dumbbells](https://help.strongapp.io/article/101-how-are-dumbbell-exercises-counted), [97 custom exercises](https://help.strongapp.io/article/97-create-custom-exercises)
  - About Strong: [132 Strong PRO](https://help.strongapp.io/article/132-strong-pro), [228 what is Strong](https://help.strongapp.io/article/228-what-is-strong), [236 best way to train](https://help.strongapp.io/article/236-best-way-to-train), [224 Apple Watch](https://help.strongapp.io/article/224-workout-on-apple-watch)

**JEFIT**
- Product blog: [Periodization on your own plan (Sep 2026)](https://www.jefit.com/blog/periodization-on-your-own-plan), [Adaptive mesocycle (Apr 2026)](https://www.jefit.com/blog/adaptive-mesocycle-training-jefits-smarter-way-to-progress), [Progressive Overload System (Nov 2025)](https://www.jefit.com/blog/the-new-era-of-jefit-the-progressive-overload-system), [BodyMap (Nov 2025)](https://www.jefit.com/blog/introducing-bodymap-a-smarter-way-to-visualize-your-training), [Set types (Apr 2025)](https://www.jefit.com/blog/set-types-new-in-jefit-customize-your-workouts-with-set-types), [Unified editing screen (May 2025)](https://www.jefit.com/blog/meet-jefits-all-new-unified-workout-editing-screen), [Routine builder (May 2025)](https://www.jefit.com/blog/introducing-new-routine-builder-workout-planning-simplified), [Logging screen revamp (Dec 2023)](https://www.jefit.com/blog/upcoming-enhancements-revamped-workout-tab-and-improved-exercise-screens), [Wear OS (Sep 2024)](https://www.jefit.com/blog/watch-guide-elevate-your-workout-with-jefit-wear-os), [Product updates index](https://www.jefit.com/blog/category/jefit-news-product-updates)
- Support and plans: [FAQ](https://www.jefit.com/support/faq), [Elite](https://www.jefit.com/elite)
- [Fitbod vs Strong vs Jefit vs Hevy, 16 Sep 2026](https://www.jefit.com/blog/fitbod-vs-strong-vs-jefit-vs-hevy) (vendor comparison; biased)

**Fitbod help centre**
- Recovery: [Muscle Recovery](https://help.fitbod.me/hc/en-us/articles/360006269014-Muscle-Recovery), [How Fitbod knows my muscles are recovering](https://help.fitbod.me/hc/en-us/articles/43492170863895)
- Progression: [How Fitbod decides sets, reps and weight](https://help.fitbod.me/hc/en-us/articles/43489869175063), [How Fitbod adapts](https://help.fitbod.me/hc/en-us/articles/43492523917207)
- Generation and setup: [How Fitbod chooses exercises](https://help.fitbod.me/hc/en-us/articles/43489509474455), [My Plan](https://help.fitbod.me/hc/en-us/articles/34336407191191-My-Plan), [Customizing today's workout](https://help.fitbod.me/hc/en-us/articles/38318585683991-Customizing-Today-s-Workout), [Editing workouts](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod)
- Statistics and body: [Metrics & Records](https://help.fitbod.me/hc/en-us/articles/12732749777047-Fitbod-Metrics-Records), [Weekly Set Targets](https://help.fitbod.me/hc/en-us/articles/24739986755223-Weekly-Set-Targets), [Workout Report](https://help.fitbod.me/hc/en-us/articles/16436302450711-Your-Workout-Report), [Body Composition](https://help.fitbod.me/hc/en-us/articles/18213217448983-Body-Composition)

**Hevy (light check only)**
- [Features index](https://www.hevyapp.com/features/), [Hevy Trainer](https://www.hevyapp.com/features/workout-plan-generator/), [Assisted bodyweight help](https://help.hevyapp.com/hc/en-us/articles/34380762441111)

**Other**
- [Liftoscript docs](https://www.liftosaur.com/docs/liftoscript), [Boostcamp](https://www.boostcamp.app/)
- Search-summary only (OBSERVED\*, not opened): [macpowerusers thread](https://talk.macpowerusers.com/t/gym-iphone-app-recommendation/32667), [sensai comparison](https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit), [gummysearch Reddit aggregator](https://gummysearch.com/tools/best-products/workout-apps/)

**EIO (for §3 and the database-change notes)**
- [`0011_fitness_v2.sql`](../../supabase/migrations/0011_fitness_v2.sql), [`0014_fitness_detail.sql`](../../supabase/migrations/0014_fitness_detail.sql), [`0018_simplify_muscle_tags.sql`](../../supabase/migrations/0018_simplify_muscle_tags.sql), `app/src/modules/fitness/screens/WorkoutSessionScreen.tsx`
