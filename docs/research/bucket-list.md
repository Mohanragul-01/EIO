# B-List: bucket-list apps compared, and what EIO should borrow

Researched 2026-10-19 for EIO's **B-List** (818 items, 61 categories). Public evidence only: Play Store and App Store listings, including their screenshots and release notes, developer websites, help pages and blogs, and roundup articles. No app was installed, decompiled or signed into.

**Evidence tags.** Each substantive claim carries one of three tags:

- **OBSERVED**: seen in the linked source. The tag itself is the link.
- **INFERRED**: reasoned from evidence. The basis is stated.
- **UNKNOWN**: looked for but not found.

**Units and dates.** Play Store figures are as fetched on 2026-10-19 with the Indian locale, so "1L+" means 100,000+ installs. Where a date shows only a month and day, the year is 2026 unless stated otherwise.

---

## 1. Which apps, and why

### How the shortlist was built

1. Four Play Store searches ("bucket list", "bucket list goals", "life goals dreams", "life list") returned about 34 relevant listings ([OBSERVED](https://play.google.com/store/search?q=bucket%20list&c=apps)). For each one I recorded the install band, rating, review count and last update.
2. I then read every roundup I could reach: [MakeUseOf](https://www.makeuseof.com/best-bucket-list-apps-android/), [TechnicalUstad](https://technicalustad.com/bucket-list-apps/), [Savor's blog](https://www.savortheapp.com/blog/food-memories-journaling/bucket-list-app/) and [Buckist's own blog](https://www.buckist.app/blog/top-bucket-list-apps-for-android/).
3. I searched for Reddit threads, but the searches returned none. The shared web-search budget then ran out, so community sentiment is **unresolved** (see section 7).

### The field (dedicated bucket-list apps on Android, plus the strongest adjacent ones)

| App | Installs | Rating (count) | Last update | Notes |
|---|---|---|---|---|
| **Buckist** | 100K+ | 4.6 (1,502) | 9 Aug 2026 | Largest maintained dedicated app. Redesigned in 2026. [OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist) |
| Simple Bucket List | 100K+ | 4.7 (480) | 8 Oct **2022** | A minimal checklist, unmaintained for four years. [OBSERVED](https://play.google.com/store/apps/details?id=com.thevarunshah.simplebucketlist) |
| Lifetime Goals (Bucket List) | 50K+ | 4.3 (420) | 24 Feb **2024** | Dashboard and achievement graphs. Stale. [OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals) |
| **iBucket** | 10K+ | 3.7 (149); iOS 4.5 (82) | 18 Oct 2026 | The most complete feature set. Cross-platform, actively shipped. [OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket) |
| Bucket List – Travel Goals | 10K+ | 4.5 (275); iOS 4.9 (847) | 1 Oct 2026 | Travel- and social-led, sold by subscription. [OBSERVED](https://play.google.com/store/apps/details?id=love.bucketlist.app) |
| My Bucket List & Life Goals | 10K+ | 4.5 (177) | 20 Aug 2026 | Savings tracker. Reviews complain about ad spam. [OBSERVED](https://play.google.com/store/apps/details?id=my.bucket.list.slapps) |
| **Goals planner** (adjacent) | **500K+** | **4.6 (5,525)** | 13 Oct 2026 | General goal planner: steps, deadline, goal diary. [OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner) |
| Life Goal Planner & Affirmation (adjacent) | 100K+ | 4.4 (2,065) | 1 Sep 2026 | Built around affirmations. Less relevant. [OBSERVED](https://play.google.com/store/apps/details?id=com.srgroup.lifegoals) |
| DreamList, DoBefore, Adventure Book, DreamPaths, Someday, Galavant, Bucktly | 5+ to 1K+ | too few ratings to show | 2025–26 | New, tiny, but each has one sharp idea (§2.4). |

### Chosen

1. **Buckist** is the clear leader among dedicated Android bucket-list apps.
   - It has the most installs and reviews of any maintained one, and it shipped three releases in 2026 (Apr to Sep), including a full redesign ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).
   - It is the best reference for **visual quality**, **dates**, the **"done" album** and **random discovery**.
2. **iBucket** is the most complete dedicated app, and the best reference for **goal → tasks → memory**, **priority sorting** and **place mapping**.
   - Its Android footprint is small (10K+, 3.7★). It made the list for depth, not popularity.
   - Its site claims "4.6 from 600+ ratings" across platforms ([OBSERVED](https://ibucket.app)). The basis for that figure is UNKNOWN.
3. **Goals planner** (adjacent) is in because the dedicated apps are weak at turning a wish into a plan.
   - It is the most-installed, best-rated Android app that does that well: deadline, steps, motivation, reward and a dated goal diary ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
   - At 500K+ installs and 4.6★ from 5.5K ratings, it is the strongest evidence of what people actually use for "big goal, small steps".

### How thin the category is (honest notes)

- **Only one dedicated app is both large and maintained.**
  - Buckist is the only one with 100K+ installs that was updated this year.
  - The other two 100K+/50K+ apps stopped updating in 2022 and 2024 ([OBSERVED](https://play.google.com/store/apps/details?id=com.thevarunshah.simplebucketlist), [OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals)).
  - Most 2025–26 entrants have under 1K installs (table above).
- **The roundups are weak evidence.**
  - Two are written by competing vendors: Buckist's founder ([OBSERVED](https://www.buckist.app/blog/top-bucket-list-apps-for-android/)) and Savor ([OBSERVED](https://www.savortheapp.com/blog/food-memories-journaling/bucket-list-app/)).
  - MakeUseOf's is from Feb 2021 ([OBSERVED](https://www.makeuseof.com/best-bucket-list-apps-android/)).
  - They contain errors. Savor calls "Bucket List – Travel Goals" iOS-only and Buckist Android-only, but both are on the other store too ([OBSERVED](https://play.google.com/store/apps/details?id=love.bucketlist.app), [OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).
- **Some of the best ideas are iOS-only:**
  - Life Listr's capped "Focus" section and step prices ([OBSERVED](https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740)).
  - Just Bucket's per-goal budget and photo album ([OBSERVED](https://apps.apple.com/app/id696506350)).

  They are cited as patterns only.
- **The leaders are built for short lists, not long ones.**
  - Their marketing addresses an empty or short list ("Out of ideas?", community feeds, AI ideas). EIO has the opposite problem: 818 items.
  - Buckist's own blog makes this distinction: "inspiration" fills a thin list, and tiering structures a heavy one ([OBSERVED](https://www.buckist.app/blog/bucket-list-paralysis-too-many-goals)).
  - **INFERRED** from the above: EIO should borrow the leaders' *planning, memory and surfacing* ideas, not their idea-discovery feeds.

---

## 2. Per-app teardown

### 2.1 Buckist (Iced Tea Labs; Android since 2024, iOS since Apr 2026)

Where the publisher is based, and the iOS launch year, are both INFERRED:
- **Base:** the site's examples are all Vietnamese places.
- **iOS launch year:** the iOS 1.0 date shows no year, but the 2025 roundups still call Buckist Android-only.

**Snapshot.**
- 100K+ installs, 4.6★ from 1,502 ratings, free ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).
- iOS in-app purchases: Premium at $3.99 a month or $23.99 a year ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).
- Launched on Product Hunt in Apr 2024 as an Android side project ([OBSERVED](https://hunted.space/dashboard/buckist/launches/buckist)).
- The Play description text is still the old one (Inspirations list, Facebook sharing, PIN lock). The Play screenshots and release notes show the 2026 redesign ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).

**Features**

| Area | What it does |
|---|---|
| Wish → plan | • Each dream has a photo, a **date**, a **place** and a category, and the site argues the date is what turns "someday" into a plan ([OBSERVED](https://www.buckist.app/)).<br>• The iOS listing adds "step-by-step roadmaps … with sub-task checklists" ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).<br>• No cost or savings field is described anywhere (UNKNOWN; it is absent from the site and both listings). |
| Completing | • A **"Slide to Achieve"** control sits at the bottom of every dream: drag an arrow across and the dream is "dated and saved" ([OBSERVED](https://www.buckist.app/)).<br>• v1.3.0 added a swipe-to-complete animation ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)). |
| Memory | • Achieved dreams become **stamps in an album**, shown as a 2-column grid of photo tiles with perforated edges, uppercase title and place ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist): screenshot "Memories, but collectable").<br>• No story, mood or "what happened" field is described (UNKNOWN).<br>• Users improvise: one golf reviewer swaps each course's image for a photo of himself there, making "a very cool achieved board" ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)). |
| Browsing | • **Active / Achieved** segmented toggle at the top of the list ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist): screenshot "Someday finally got a date").<br>• The list is **grouped by month of the target date** ("Jan, 2026", "Apr, 2026").<br>• Grouping is by "Lists, categories" ([OBSERVED](https://www.buckist.app/)).<br>• No search or filter UI is shown or described (UNKNOWN). |
| Random / inspire | • The Discover tab has **"Random Ideas" / "Newest" / "Most Popular"** tabs ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist): screenshot "Out of ideas?").<br>• v1.4.2 added home and lock-screen widgets, including a **random "Spark" bucket item**, a "Next Travel" map and a Life-in-Weeks grid ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)). |
| Progress | • **Life in Weeks**: enter a birth year to see weeks lived and weeks left (on a 90-year life), with dreams "pinned to the weeks ahead" ([OBSERVED](https://www.buckist.app/)).<br>• A screenshot shows a stats row of weeks lived, weeks left, % of 90 years and "7/9 buckets", plus a full-life week grid ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).<br>• A smaller **"Week 32 of 52"** current-year grid shows weeks left, buckets and "% year done" ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).<br>• No year-in-review screen exists (UNKNOWN).<br>• The founder's blog suggests a yearly birthday review, but doesn't tie it to an app screen ([OBSERVED](https://www.buckist.app/blog/birthday-ritual-yearly-life-review)). |
| Map | • Dreams with a place appear on a **dotted globe**. Tapping a country zooms to "its own small map" ([OBSERVED](https://www.buckist.app/)).<br>• **Green = been, clay = going next** ([OBSERVED](https://www.buckist.app/)).<br>• A bottom sheet lists a country's dreams with a "● VISITED" chip and date, plus a "3 / 195 countries" counter ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist): screenshot "Colour in the whole planet"). |
| Priority | Not described (UNKNOWN). |
| Done vs not-done | • Done and to-do live in **separate views** (Active / Achieved toggle) and are rendered differently: list rows for active, stamps for achieved.<br>• In Explore, "Grey stamps are done. Cream ones are still waiting" ([OBSERVED](https://www.buckist.app/)).<br>• On the map, the distinction is green vs clay. |

**Interaction details**
- Active list rows ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist): screenshots):
  - a large rounded photo thumbnail on the left;
  - a 1–2 line title, then the place in small text below;
  - the target date with a calendar icon in a warm red;
  - a floating "+ Bucket" pill button at bottom right.
- The site's own "Try it" box adds a dream from a single text field ([OBSERVED](https://www.buckist.app/)).
- **INFERRED**, because the slide control is "at the bottom of every dream", meaning inside the dream view: completing takes at least one more step than EIO's tap-to-tick. That suits a short list of big dreams, not ticking in bursts.

**UI and visual patterns**
- A single deep-green brand colour with cream surfaces, rounded cards and photo-first rows.
- Playful screenshot copy ("2,845 weeks left. No pressure!").
- Stats sit in a row of small number-over-label tiles.

All [OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist) in the screenshots.

**Praise**
- "a very cool achieved board" (golf reviewer, above).
- "pretty solid … Awesome implementation" ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).

**Complaints**
- **Data loss**: after a login update, "ALL of them were deleted" ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).
- **Bugs**: you can't replace a photo without removing it first ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).
- **No sharing** (older review) ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).
- A 2025 roundup lists "no map or travel tools" and "Pro needed for … unlimited lists" ([OBSERVED](https://technicalustad.com/bucket-list-apps/)). The map has since shipped.

### 2.2 iBucket (PuurPuur; iOS and Android, plus a web app)

Its help page says data is stored in the Netherlands ([OBSERVED](https://ibucket.app/help)).

**Snapshot.**
- Android: 10K+ installs, 3.7★ (149) ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).
- iOS: 4.5★ (82) ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).
- **One-time purchase**, not a subscription. iOS prices: Premium $14.99, or Goals $8.99 and Places $8.99 bought separately ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715), [OBSERVED](https://ibucket.app/help)).
- Ships roughly one or two updates a month ([OBSERVED](https://ibucket.app/help)).

**Features**

| Area | What it does |
|---|---|
| Wish → plan | • **Goals** can hold **tasks**, which break a goal into "smaller steps to track progress" ([OBSERVED](https://ibucket.app/help)).<br>• **Lists** group goals and show overall progress. The help page's example is a "US States" list of 50 goals ([OBSERVED](https://ibucket.app/help)).<br>• **Trips** are sets of goals scheduled day by day, with bookings, tickets and **cost tracking** ([OBSERVED](https://ibucket.app/help), [OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).<br>• Calendar and scheduled times were added after a user asked ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)). |
| Memory | • Goals capture "moments with photos and stories" ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).<br>• Journal entries are tied "to the place and the moment it happened" ([OBSERVED](https://ibucket.app)).<br>• A goal-detail screenshot shows, top to bottom ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket): screenshot "Create it. Bucket List"):<br>&nbsp;&nbsp;– a full-bleed hero photo with Map and Edit pill buttons;<br>&nbsp;&nbsp;– three round photo thumbnails overlapping its bottom edge;<br>&nbsp;&nbsp;– the title, a green **"Completed"** label and a first-person story with "More…";<br>&nbsp;&nbsp;– the place with a pin icon;<br>&nbsp;&nbsp;– a Tasks section of check rows. |
| Browsing | • Navigation is a dropdown that switches between Goals, Places and Memories (v15.0) ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).<br>• Lists and tasks carry lock and filter icons ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket): screenshot).<br>• Older reviews asked for "view of all goals regardless of grouping", date or progress sorting and manual reordering. The developer replied that most of it was implemented ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)). Current filter depth is UNKNOWN. |
| Priority | Priority can be set and sorted on **goals and tasks** (v14.2) ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)). |
| Progress | • A passport card shows "% World, Countries, Regions, Cities, % Progress, Goals, Done, Trips" ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket): screenshot "Collect it. Passport").<br>• A yearly passport share was added in v14.4 ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)). |
| Map | • Mark countries, regions and cities. **Want-to-visit and visited use two colours** ([OBSERVED](https://ibucket.app/help)): the help page says blue and green, the screenshots show purple and green.<br>• A country sheet has two big buttons, "Visited" and "Want to visit". Region rows carry a heart (want) and a flag (visited) ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)). |
| Done vs not-done | • A **green check badge** over the photo thumbnail on done goals and in grids ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket): screenshots).<br>• A green "Completed" label in the detail view.<br>• Completing works three ways: toggle in Edit, swipe right then ✓, or the ⋮ menu ([OBSERVED](https://ibucket.app/help)). |

**Interaction details.**
- Create with "+ add" and pick the type: Goal, List, Trip or Place ([OBSERVED](https://ibucket.app/help)).
- Tasks can only be created inside a goal ([OBSERVED](https://ibucket.app/help)).
- Offline you can view but **not edit** ([OBSERVED](https://ibucket.app/help)).

**UI and visual patterns.**
- A white canvas with one indigo accent, big bold titles and photo-heavy cards.
- A round indigo + FAB.
- Script-font section kickers in screenshots ("Create it.", "Track it.").

All [OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket).

**Praise**
- "hands down the best option" for categorising places on a map ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).
- "sort your goals in lists and add specific tasks to each. Plus you can add your chosen photo to each goal/task/list" ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).
- The one-time price is liked ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).

**Complaints**
- **Free tier capped** at "30 locations worldwide" ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).
- **Freezing and crashes**, and requests for editable categories and start/end dates on goals ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).
- "cluttered interface" and "occasional sync issues" (roundup) ([OBSERVED](https://technicalustad.com/bucket-list-apps/)).
- **INFERRED**: the Android rating fell from 4.1 (130 ratings, per the Sep 2025 roundup) to 3.7 (149), which suggests recent Android reviews skew negative.

### 2.3 Goals planner (Go Dreams; adjacent general goal planner)

**Snapshot.** 500K+ installs, 4.6★ (5,525), updated 13 Oct 2026 ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).

**Why it's here.** The goal fields are exactly the "wish → plan" layer the bucket apps lack ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)):

- image;
- **motivation** ("what motivates you");
- **reward** for when it's done;
- **deadline**;
- **steps**;
- **notes as a goal diary**;
- categories.

**Features and interaction**
- **Goals list** ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner): screenshot "Create goals"):
  - a horizontal row of **category chips** (All · Personal · Fitness · Family);
  - cards with a square photo, the title and a time-left label ("21 days left", "3 months left");
  - an **"Overdue"** pill;
  - a thin progress bar with the % right-aligned.
- **Goal detail** has three tabs: **Description | Steps | Notes** ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner): screenshots).
  - Steps: done steps get a filled orange check, **strikethrough and grey text**. Steps can be dragged to reorder ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner): review).
  - Notes: entries are headed by **"Day 7", "Day 5"** (days since the goal started) and can hold a photo and a timestamp.
  - Description: flag icon + motivation, badge icon + reward, calendar icon + date.

**Praise**
- "large goals and small steps" ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
- "take photos of achievement and add it as an image … drag it to where it's supposed to be" ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).

**Complaints**
- **No backup** ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
- No goal linking or dependencies ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
- No way to mark a goal complete: it "still says i failed it" after all steps were ticked ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
- No progress nudges ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).

### 2.4 Idea donors: small apps, each with one idea worth taking

These have too few users to count as leaders. Each solves one of the brief's questions better than the leaders do.

| App | The idea | Evidence |
|---|---|---|
| **Adventure Book** (10+ installs) | **"Free this weekend?"**<br>• Every Friday it shows your **top 3** saved ideas.<br>• Pick one and it moves to this weekend; "Not this time" asks again next week.<br>• Ideas carry optional **keenness** (three levels), **duration** (a few hours / half a day / whole day) and **energy** (relaxed / active).<br>• The someday list is grouped by keenness with counts, and has duration chips.<br>• After an outing: add a photo, a rating and one thing to remember, and say whether you'd go again.<br>• "A title is enough." | [OBSERVED](https://play.google.com/store/apps/details?id=si.ahlin.adventurebook)<br>[OBSERVED](https://adventurebook.app) |
| **DoBefore** (5+) | Memories instead of checkmarks.<br>• A done goal gets **photos, mood, place (auto map tile), date and a reflection**, linked back to the goal.<br>• A **Memories timeline** with a date column (day over month).<br>• "no streaks, no guilt".<br>• A year-in-review collage is "on the way". | [OBSERVED](https://play.google.com/store/apps/details?id=cz.sedlardavid.dobefore)<br>[OBSERVED](https://dobefore.app) |
| **DreamList** (1K+) | • A **before-and-after pair**: the day you wrote the dream down next to the day it came true, with the days between ("249 days ago this was just a line on your list").<br>• Reminders that come **more often as the deadline nears**.<br>• Each dream has a **priority** field.<br>• On the map, visited countries are filled and wished-for ones have a **dashed outline**. | [OBSERVED](https://play.google.com/store/apps/details?id=com.dreamlist.tree)<br>[OBSERVED](https://dreamlist.life) |
| **DreamPaths** (50+) | Each dream gets a *type* of path:<br>• **financial** (save toward a target);<br>• checklist;<br>• deadline with milestones;<br>• experience (photos);<br>• metric, habit and skill.<br>A weekly report shows what moved. | [OBSERVED](https://play.google.com/store/apps/details?id=com.jastar.dreampaths)<br>[OBSERVED](https://dreampathsapp.com) |
| **Bucktly** (100+) | **Estimated budget** and a **savings goal** per dream, showing how long until you reach the target.<br>Also priority and difficulty levels. | [OBSERVED](https://play.google.com/store/apps/details?id=com.app.bucktly) |
| **Someday** (100+) | • Target **a year, or leave it as "Someday"**.<br>• Hide done items.<br>• Export to a file.<br>• Your own emoji per category.<br>• Fully offline. | [OBSERVED](https://play.google.com/store/apps/details?id=com.frontick.someday) |
| **Galavant** (50+) | A Year in Review with milestones.<br>Photobook pages with a story and a "feeling" tag. | [OBSERVED](https://play.google.com/store/apps/details?id=com.gyradevs.galavant)<br>[OBSERVED](https://galavant.merchase.app) |
| **Lifetime Goals** (50K+, stale) | Achievement graphs and a dashboard; random, periodic or daily reminders.<br>Top review request: **edit the achievement date** to log things done years ago. | [OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals) |
| **Life Listr** (iOS only) | **"Focus"** section, capped at **5 goals**.<br>Steps with **their own price**. | [OBSERVED](https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740) |
| **Just Bucket** (iOS only) | Per-goal add-ons: Album, **Budget**, Checklist, Notes, Links, Route.<br>An "Inspire Me" feature. | [OBSERVED](https://apps.apple.com/app/id696506350) |

---

## 3. What EIO already has

**OBSERVED** in `supabase/migrations/0015_bucket_list.sql`, `app/src/modules/bucket/` and `docs/USER-GUIDE.md`.

EIO's B-List holds 818 imported items: 469 no/low cost, 243 moderate and 106 big investment, across 61 categories.

- **Item fields:** title, category, a **cost tier** (what it takes to do, deliberately not importance), `is_done`, `done_on`, note and position.
- **Ticking:** tap to tick, saved immediately; `done_on` is set to the device's today.
- **Editing:** long-press to edit or remove. The + button adds an item, with a free-text category so new categories can be created.
- **Progress card:** done/total, an honest percent, and items **left** per cost tier, which double as the cost filter.
- **Search:** matches title, category *and* note.
- **Filter sheet:** status, cost, and a searchable vertical category list with each category's progress. Active filters show as removable chips; sections carry done/total headers.
- **Default view:** To do, so done items are hidden.
- **Done styling:** strikethrough, faint text and a filled checkbox.
- **Platforms:** the same Supabase table backs the Android app and the desktop site.
- **Not present:**
  - the done date cannot be edited;
  - no photos, story, place, target date, steps, money, priority or random pick;
  - no year view.

---

## 4. Gap analysis

### What the leaders have that EIO lacks

| Capability | Buckist | iBucket | Goals planner | Idea donors | EIO today |
|---|---|---|---|---|---|
| Target date / "someday" | ✔ date per dream | ✔ calendar, trips | ✔ deadline + days left | Someday (year or none), DreamList | ✘ |
| Steps / milestones | ✔ sub-tasks (iOS listing) | ✔ tasks | ✔ steps, reorder | Bucktly, DreamPaths | ✘ |
| Money: estimate and savings | ✘ (UNKNOWN) | trips only: cost tracking | ✘ | Bucktly, DreamPaths, My Bucket List, Life Listr, Just Bucket | Cost *tier* only |
| Memory on completion | photo → stamp album | photos + story + journal | photo + dated diary | DoBefore, DreamList, Adventure Book | date only, not editable |
| Backdating a done date | UNKNOWN | UNKNOWN | n/a | requested in Lifetime Goals reviews | ✘ (always today) |
| Random / "inspire me" | ✔ Random Ideas tab, Spark widget | ✘ (UNKNOWN) | ✘ | Adventure Book's weekly top 3, Just Bucket | ✘ |
| Priority / want-level | UNKNOWN | ✔ priority sort | ✘ | DreamList, Bucktly, Adventure Book keenness, Life Listr Focus (5) | ✘ (cost ≠ want, by design) |
| Year-in-review / life view | Life in Weeks, year-week grid | yearly passport share, stats card | ✘ | Galavant, DoBefore (planned), Lifetime Goals graphs | ✘ |
| Places / map | ✔ dotted globe, green vs clay | ✔ countries/regions/cities, two colours | ✘ | DreamList (filled vs dashed) | ✘ |
| Distinct done visual | separate Achieved album (stamps) | green check badge on photo | strikethrough on steps | DoBefore timeline | strikethrough + faint |
| Photos generally | ✔ photo-first rows | ✔ hero + gallery | ✔ | most | ✘ |

### What EIO already does better

1. **Finding things in a long list.**
   - EIO's search spans title, category and note; it has a searchable 61-category filter with per-category progress, removable chips, and status × cost filters.
   - None of the leaders shows anything comparable:
     - Buckist: an Active/Achieved toggle, lists and categories ([OBSERVED](https://www.buckist.app/)).
     - Goals planner: a **horizontal category chip row** ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)), the exact pattern EIO dropped because it fails at 61 categories (USER-GUIDE.md).
     - Lifetime Goals only added search in v1.8.4 ([OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals)).
   - **INFERRED** that EIO's filtering already exceeds all three. The caveat is that the leaders' in-app sort and filter menus were not fully visible.
2. **Cost as a first-class question.** No leader filters by what an item costs to do; the closest are Bucktly's budget and difficulty fields and Life Listr's step prices. EIO's "items left per tier, tap to filter" is unique among what was observed (**INFERRED**).
3. **Ticking in bursts.**
   - Tap-to-tick in the list beats Buckist's slide-inside-the-dream and iBucket's Edit toggle, swipe or ⋮ menu for working through a long list ([OBSERVED](https://ibucket.app/help), [OBSERVED](https://www.buckist.app/)).
   - Keep it. Add memory capture *after* the tick, not as a gate before it (§6).
4. **Honest numbers.** The percent never rounds up to 100, and the counts show what's left. Competitors show bare percentages and counts (**INFERRED** from screenshots).
5. **No data-loss, paywall or ads problems.**
   - Competitor reviews complain about:
     - data loss (Buckist's login update; Simple Bucket List had no account, so a lost phone meant losing "thousands of checked and unchecked items" ([OBSERVED](https://play.google.com/store/apps/details?id=com.thevarunshah.simplebucketlist)));
     - no backup (Goals planner);
     - free-tier caps (iBucket's 30 locations);
     - ad spam and paywalled lists (My Bucket List & Life Goals ([OBSERVED](https://play.google.com/store/apps/details?id=my.bucket.list.slapps))).
   - EIO's single-user Supabase database avoids all of these.
6. **A desktop surface.**
   - Buckist advertises iPhone and Android only ([OBSERVED](https://www.buckist.app/)), and Goals planner has no web app (UNKNOWN; none was found).
   - iBucket does have a web app ([OBSERVED](https://ibucket.app/help)), but location features don't work there.

---

## 5. Recommendations (prioritized)

**Effort:** S = up to about a day, M = about 2–4 days, L = a week or more, for one developer who knows the codebase (INFERRED).

**What EIO's app already has** (OBSERVED in `app/package.json`): `expo-notifications` is installed and used by Subscriptions. It does **not** have an image picker, haptics, maps or Supabase Storage.

The memory notes say the phone runs Expo Go, so anything needing a custom native build (such as home-screen widgets) is more expensive (**INFERRED**). Per AGENTS.md, confirm each library against the Expo SDK 57 docs before building.

### TOP 5

**1. Record the memory when you tick it, and let the date be edited**
- **What:**
  - Ticking stays one tap.
  - A brief "Done · today — Add memory · Undo" bar follows.
  - "Add memory" opens a sheet where every field is optional:
    - **when** (today, yesterday, or any earlier month or year, **so things done years ago can be backdated**);
    - **what happened** (a few lines);
    - **where** (free text);
    - **photo(s)**;
    - **do it again?** (yes / maybe / no).
- **Why for one person:**
  - It turns 818 checkboxes into a record of a life actually lived.
  - Backdating matters because every one of the 818 rows came in undone (**OBSERVED**: the seed files set no `is_done`). If some were already done in real life, ticking them now would stamp them with today's date (**INFERRED**).
- **Who has it:**
  - iBucket: photos + story ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).
  - Buckist: photo → album ([OBSERVED](https://www.buckist.app/)).
  - DoBefore: photos, mood, place, date, reflection ([OBSERVED](https://dobefore.app)).
  - DreamList: before/after with days between ([OBSERVED](https://dreamlist.life)).
  - Adventure Book: photo, rating, one thing to remember, go again ([OBSERVED](https://play.google.com/store/apps/details?id=si.ahlin.adventurebook)).
  - The backdating request comes from Lifetime Goals reviews ([OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals)).
- **Effort and database, in three steps:**
  - (a) Editable done date: **S, no database change** (`done_on` exists).
  - (b) What happened, where and again: **S, database change** (e.g. `memory text`, `place text`, `again text`).
  - (c) Photos: **M, database and storage change** (a Storage bucket plus a `bucket_photos` table, and an image-picker dependency).

**2. "Pick for me": three random to-dos, defaulting to no/low cost**
- **What:**
  - A card under the progress card shows **3 random to-do items** that honour the active filters.
  - With no filter set, it defaults to **no/low cost**, the tier the user guide describes as "doable this weekend for nothing".
  - Controls: **Shuffle**, **Not now** (hide that item from picks for a while) and **Pin to Now** (see #3).
  - Optional: a Friday-evening local notification listing the three.
- **Why for one person:**
  - With 469 no/low-cost items, the hard part is choosing, not finding. Buckist's founder calls this "bucket list paralysis" ([OBSERVED](https://www.buckist.app/blog/bucket-list-paralysis-too-many-goals)).
  - A small random sample turns a wall into a choice of three.
- **Who has it:**
  - Adventure Book: a weekly top 3 with "not this time" ([OBSERVED](https://adventurebook.app)).
  - Buckist: Random Ideas tab, random "Spark" widget ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).
  - Just Bucket: Inspire Me ([OBSERVED](https://apps.apple.com/app/id696506350)).
- **Effort and database:**
  - Random picks: **S, no database change**.
  - "Not now": **S, database change** (`snoozed_until date`).
  - Friday notification: **M, no database change** (`expo-notifications` is already installed).

**3. A small "Now" shelf: want-level kept separate from cost**
- **What:**
  - A third, optional dimension: **Now / Next / Someday** (default Someday).
  - The Now items, capped at about 5, sit as cards at the top of the B-List.
  - Adding a sixth asks you to swap one out.
  - Next is a sortable or filterable tier; Someday is everything else.
- **Why for one person:**
  - Cost answers "what can I afford", while Now answers "what am I actually going to do". EIO deliberately refuses to overload cost with importance, so want-level needs its own small field.
  - The cap keeps it honest.
- **Who has it:**
  - Life Listr: Focus, max 5 ([OBSERVED](https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740)).
  - The Buckist blog's Now/Next/Someday method with "Now" capped at 3–4 ([OBSERVED](https://www.buckist.app/blog/bucket-list-paralysis-too-many-goals)).
  - iBucket: priority sort ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).
  - DreamList: priority ([OBSERVED](https://dreamlist.life)).
  - Adventure Book: keenness groups ([OBSERVED](https://adventurebook.app)).
- **Effort and database:** **S–M, database change** (`focus text check (focus in ('now','next'))`, null meaning Someday).

**4. A "Lived" timeline and a year-in-review**
- **What:**
  - When the status filter is Done, show a **timeline grouped by year → month** instead of category sections.
  - Add a **year card**: items done that year, a month-by-month strip, the split by cost tier, top categories, and memories or photos if #1 exists.
  - Year chips switch between years.
- **Why for one person:** the reward for doing things should be seeing them. EIO already records `done_on` precisely "so the list can answer 'what did I actually do this year'" (migration comment, OBSERVED), but no screen asks that question yet.
- **Who has it:**
  - Buckist: Achieved album grouped by month, Life-in-Weeks stats ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).
  - Galavant: Year in Review ([OBSERVED](https://play.google.com/store/apps/details?id=com.gyradevs.galavant)).
  - DoBefore: memories timeline ([OBSERVED](https://play.google.com/store/apps/details?id=cz.sedlardavid.dobefore)).
  - Lifetime Goals: achievement graphs ([OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals)).
  - iBucket: yearly passport ([OBSERVED](https://apps.apple.com/us/app/ibucket/id864052715)).
- **Effort and database:** **S–M, no database change.** It is far more truthful after #1(a) lets old completions be backdated.

**5. Plan a Now item: target, steps, and money in ₹**
- **What:** only for items on the Now/Next shelf, so the 818-row list stays light. Three sections:
  - **When:** Someday / this year / a month / an exact date, so precision is explicit rather than a fake exact date.
  - **Steps:** a checklist with drag-to-reorder and a progress bar.
  - **Money:** estimated ₹, saved so far, a progress bar and "₹X a month gets you there by <month>".
- **Why for one person:**
  - Big-investment items (106 of them) only happen with a plan and savings. The cost tier says "needs saving for" (USER-GUIDE.md) but nothing tracks the saving.
- **Who has it:**
  - Goals planner: deadline, steps, days left ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).
  - Buckist: date, sub-tasks ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)).
  - iBucket: tasks ([OBSERVED](https://ibucket.app/help)).
  - Bucktly: budget, savings goal, time to target ([OBSERVED](https://play.google.com/store/apps/details?id=com.app.bucktly)).
  - DreamPaths: financial path ([OBSERVED](https://dreampathsapp.com)).
  - My Bucket List & Life Goals: savings tracker ([OBSERVED](https://play.google.com/store/apps/details?id=my.bucket.list.slapps)).
  - Life Listr: per-step price ([OBSERVED](https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740)).
- **Effort and database:** **M–L, database change**:
  - `target_on date` and `target_precision text` (`year` / `month` / `day`);
  - `est_cost_inr integer` and `saved_inr integer`;
  - a `bucket_steps` table (`item_id`, `title`, `is_done`, `position`).

### Further recommendations (after the top 5)

| # | What | Why for one person | Who has it | Effort | Database change? |
|---|---|---|---|---|---|
| 6 | **Completion feel:** haptic tick, a short check animation, and an undo bar after each tick (the same bar as #1). | Ticking is the core action. Undo removes the fear of mis-taps while ticking in bursts. | Buckist swipe-to-complete animation ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)); DoBefore haptic buzz ([OBSERVED](https://play.google.com/store/apps/details?id=cz.sedlardavid.dobefore)) | S (adds a haptics dependency) | No |
| 7 | **An emoji per category**, shown in section headers, the filter list and chips. | 61 text headers are hard to scan; a glyph gives each section an identity. | Someday: your own emoji ([OBSERVED](https://play.google.com/store/apps/details?id=com.frontick.someday)); Buckist category icons ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)); My Bucket List category icons and images ([OBSERVED](https://play.google.com/store/apps/details?id=my.bucket.list.slapps)) | S–M | Yes, a small `bucket_categories (name, emoji)` table. A hard-coded map for the 61 is S with no change. |
| 8 | **Duration tag:** a few hours / half day / whole day / multi-day, used by Pick for me. | "Free this Saturday afternoon" is a duration question that cost can't answer. | Adventure Book duration and energy chips, with a "4 of 14 fit" count ([OBSERVED](https://adventurebook.app)) | M (tagging 818 items needs a per-category bulk default) | Yes |
| 9 | **Best months:** an optional season per item so Pick for me can prefer what's in season. In India that means monsoon treks, winter sports from Nov to Feb, and festival dates. | Many categories are seasonal (Winter & Snow Sports, Culture, Festivals & Community). | Buckist blog suggests grouping "by season" ([OBSERVED](https://www.buckist.app/blog/bucket-list-paralysis-too-many-goals)); the India fit is INFERRED | M | Yes (`best_months smallint[]`) |
| 10 | **Gentle reminders** for Now items with a target, getting more frequent near the date. Never "overdue" red. | One person has no one else to nudge them, but guilt makes people abandon lists. | DreamList escalating reminders ([OBSERVED](https://dreamlist.life)); Lifetime Goals random or periodic reminders ([OBSERVED](https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals)); DoBefore "no streaks, no guilt" ([OBSERVED](https://dobefore.app)) | M | No (needs #5) |
| 11 | **Places and map:** where it was done (and where it's wanted) on a map, filled for done and outlined for wanted. | Nice for travel items, but only about 94 of 818 items sit in place-centred categories (Travel & Exploration, World Wonders, Iconic World Journeys, Pilgrimage, World Culinary/Wellness, Extreme Geography, Deep Nature). **INFERRED** from category names. | Buckist ([OBSERVED](https://www.buckist.app/)); iBucket ([OBSERVED](https://ibucket.app/help)); DreamList ([OBSERVED](https://dreamlist.life)) | L (maps dependency and geocoding) | Yes (`place` from #1, plus `lat`/`lng`) |
| 12 | **Year-progress strip** (week N of 52, weeks left) on the B-List or the Dashboard. Optionally a life-in-weeks view. | Makes "this year" concrete when choosing the Now shelf. | Buckist Life in Weeks and year grid ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)) | S (year strip) / M (life view) | Year: no. Life: yes (birth year setting). |
| 13 | **Home-screen widget** with a random pick or the Now shelf. | One glance a day keeps the list alive. | Buckist Spark, Next Travel and Life-in-Weeks widgets ([OBSERVED](https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117)) | L (native widget; not available in Expo Go, INFERRED) | No |

### Deliberately dropped (single user, no monetisation)

- Community idea feeds and "borrow others' dreams" (Buckist Explore, DreamList, Bucket List – Travel Goals Explorers Club).
- Sharing, couple and group lists, followers and comments.
- Passport stamps shared as images.
- Points, trees and leaderboards.
- Trip itineraries and bookings (iBucket), which belong in a travel tool if anywhere.
- AI goal suggestions: EIO's problem is choosing among 818, not finding more.
- Premium tiers.

---

## 6. UI/UX patterns worth adopting

Each pattern is concrete enough to build without seeing the source apps. Sources are in brackets. Visual specifics beyond the sources are design judgment (**INFERRED**).

1. **Tick first, remember second.**
   - Keep the one-tap tick.
   - On tick:
     - the checkbox fills with a short scale-up (about 150 ms) and a light haptic;
     - a bottom bar appears for about 6 s: **"Done · today"**, **[Add memory]**, **[Undo]**.
   - "Add memory" opens a bottom sheet:
     - **date chips** Today | Yesterday | Earlier…; Earlier opens a month-and-year picker that reaches back decades, for backdating;
     - a multiline "What happened?" with no character pressure;
     - a "Where" single line;
     - a photo strip of square thumbnails with a + tile;
     - a three-way segmented "Do again? Yes / Maybe / No".
   - All fields are optional; Save stays enabled when empty.
   - Sources: Buckist's "dated and saved" ([OBSERVED](https://www.buckist.app/)); Adventure Book's "A title is enough" ([OBSERVED](https://adventurebook.app)); DoBefore's fields ([OBSERVED](https://dobefore.app)).

2. **Done looks different by context, not just struck through.**
   - In **To do** (the default), done items are hidden, as now.
   - In **All**: done rows get a filled check, the title in the muted text colour **without** strikethrough, and a right-aligned small date chip ("Mar '26"). A 📷 or ❝ glyph appears if a photo or memory exists.
   - In **Done**: switch to the Lived timeline (pattern 5). Strikethrough on a screen where everything is done is pure noise. EIO currently strikes through every row there (OBSERVED in `rowTextDone`).
   - Sources: Buckist separates Active and Achieved into different layouts, and its "Grey … done. Cream … still waiting" ([OBSERVED](https://www.buckist.app/)); iBucket's green check badge on done thumbnails ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).

3. **The "Pick for me" card.**
   - **Placement:** directly under the progress card, collapsible, with its state remembered.
   - **Header:** "Pick for me" on the left; "3 of 469 · No/low cost" in small muted text (live count of the pool); a shuffle icon button on the right.
   - **Body:** three stacked rows, each with the category emoji, the title (2 lines max) and a cost chip.
     - Tap opens the item.
     - A trailing "Not now" icon hides it from picks for 30 days.
     - Long-press pins it to Now.
   - **The pool** honours active filters. When none are active, it defaults to no/low cost with a removable chip so it's visible.
   - **Stability:** seed the random choice by date so the same three show all day (no flicker on every open); Shuffle re-rolls.
   - Sources: Adventure Book's three numbered cards with a "Not this time" link and a "4 of 14 fit" count ([OBSERVED](https://adventurebook.app)); Buckist's Random Ideas tab ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).

4. **The Now shelf.**
   - **Layout:** at most 5 cards in a horizontal scroller above the category sections, visible in To-do view only.
   - **Each card:** title; target ("Mar 2027", "This year" or blank); a thin progress bar with the % right-aligned (steps done/total, or ₹ saved/estimate); the next unticked step in muted text.
   - **When full:** pinning a 6th opens a sheet listing the 5 with a "Swap out" button on each.
   - Sources: Goals planner's card anatomy (photo, title, time-left label, thin bar with right-aligned %) ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)); Life Listr's cap of 5 ([OBSERVED](https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740)).

5. **The Lived timeline.**
   - **Grouping:** sticky year headers ("2026 · 23 done"), then month subheaders.
   - **Each row:** a fixed-width left date column (day number large, month abbreviation small, as in DoBefore's timeline); title; category emoji and place in muted text; a 48 px rounded photo thumbnail on the right if one exists; the first line of the memory in italics.
   - Items done without a date sit under a final "Date unknown" group, prompting backdating.
   - Sources: DoBefore Memories timeline ([OBSERVED](https://play.google.com/store/apps/details?id=cz.sedlardavid.dobefore)); Buckist month grouping ("Jan, 2026") ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)).

6. **The year card** (top of the Lived timeline, or its own screen):
   - year chips;
   - a hero number ("23 done in 2026");
   - a row of 3–4 stat tiles (number over label): done · no-cost · big investments · categories touched;
   - a 12-cell month strip whose cell intensity reflects count;
   - "Top categories" (3);
   - a photo grid if photos exist.
   - Optional: "Week 42 of 52 · 10 weeks left" as a thin year bar.
   - Sources: Buckist's stats-row and year-grid styling ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)); iBucket's passport stats card ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).

7. **Item sheet with sections, not a long form.**
   - Long-press opens a sheet with three tabs or segments: **About** (title, category, cost, note), **Plan** (When, Steps, Money; only shown or editable for Now/Next items), and **Memory** (only once done).
   - Source: Goals planner's Description | Steps | Notes tabs ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).

8. **"Someday" is a real value, not an empty field.**
   - The When control's first option is **Someday** (selected by default), then This year, Next year, Pick month, Pick date.
   - Display precision matches input: "2027", "Mar 2027" or "14 Mar 2027".
   - Sources: Someday's "a year, or none at all" ([OBSERVED](https://play.google.com/store/apps/details?id=com.frontick.someday)); Buckist's "Once it has a date, it stops being a someday" ([OBSERVED](https://www.buckist.app/)).

9. **No guilt states.**
   - A passed target shows a neutral "Target passed · Move to…" action (next month / next year / Someday), never a red "Overdue".
   - Sources: DoBefore "no streaks, no guilt" ([OBSERVED](https://dobefore.app)) and Buckist's "No pressure!" tone ([OBSERVED](https://play.google.com/store/apps/details?id=com.icetea09.bucketlist)), set against Goals planner's "Overdue" pill ([OBSERVED](https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner)).

10. **Money line that does the arithmetic.**
    - Under the estimate and saved fields, one sentence: "₹38,000 to go · ₹3,200 a month reaches it by Oct 2027". It recomputes as you type the target month or the monthly amount.
    - Use Indian digit grouping (₹1,50,000) via `Intl.NumberFormat('en-IN')` (INFERRED for the India locale).
    - Source: Bucktly's "see how long it will take to reach your target" ([OBSERVED](https://play.google.com/store/apps/details?id=com.app.bucktly)).

11. **If a map is ever built,** use two unmistakable states:
    - done = filled marker or region in the success colour;
    - wanted = outlined or dashed in the accent colour.
    - Tapping a region opens a bottom sheet listing its items with a "Done · date" chip.
    - Sources: DreamList's filled vs dashed ([OBSERVED](https://dreamlist.life)); Buckist's green vs clay with a country sheet ([OBSERVED](https://www.buckist.app/)); iBucket's Visited / Want-to-visit button pair ([OBSERVED](https://play.google.com/store/apps/details?id=com.kaimallie.ibucket)).

---

## 7. Checklist status

| # | Question | Evidence needed | Status |
|---|---|---|---|
| Q1 | Which dedicated bucket-list apps lead on Android in 2026? | Play search, install bands, ratings, update dates | **Answered.** Install bands are coarse, and Play search results may be personalised. |
| Q2 | Is the category thin; which adjacent app fills the gap? | The same, plus roundups | **Answered.** |
| Q3 | How is a wish turned into a plan (date, steps, cost, savings)? | Listings, help pages, screenshots | **Answered for date and steps. Partial for money:** neither leader has savings, so the evidence is from small apps. |
| Q4 | How is the memory captured when done (photo, date, place, story)? | Listings, screenshots, sites | **Answered** at the feature level. **Partial** on the exact completion flow inside iBucket, which was not seen in screenshots. |
| Q5 | How do they handle browsing a long list (filters, random, "this weekend")? | Screenshots, help pages, reviews | **Partial.** Random and "this weekend" are answered. The leaders' full sort and filter menus are not visible publicly. |
| Q6 | Progress and year-in-review? | Screenshots, listings | **Answered.** No leader has a true goals year-in-review: only Galavant claims one, DoBefore lists it as planned, and Buckist offers Life in Weeks. |
| Q7 | Maps of places? | Sites, screenshots, help | **Answered.** |
| Q8 | Priority or want-level? | Listings, release notes | **Answered** for iBucket and the small apps. **UNKNOWN** for Buckist. |
| Q9 | How are done and not-done items distinguished visually? | Screenshots | **Answered** (from screenshots). |
| Q10 | Praise and complaints? | Play/App Store reviews, Reddit | **Partial.** Only 3–5 visible reviews per app. **No Reddit threads were found, and the shared web-search budget was exhausted** before more could be tried. |
| Q11 | Where does EIO already do better? | EIO code and guide vs evidence above | **Answered** (INFERRED comparisons). |
| Q12 | Can it be built in EIO's stack (dependencies, database)? | `app/package.json`, migrations | **Partial.** Dependencies and schema were checked. The Expo SDK 57 docs were **not** read (research only); the implementer must do that per AGENTS.md. |

**Unresolved:**
- **Community sentiment:** Reddit and forums.
- **Buckist:**
  - priority;
  - search and filter;
  - sub-task UI after the redesign;
  - Android Pro pricing (iOS is $3.99 a month or $23.99 a year).
- **iBucket:**
  - exact free-tier limits beyond "30 locations";
  - current sort and filter options.
- **Goals planner:** what its premium unlocks.

## Sources

- Play Store search "bucket list": https://play.google.com/store/search?q=bucket%20list&c=apps
- Buckist:
  - Play listing: https://play.google.com/store/apps/details?id=com.icetea09.bucketlist
  - iOS listing: https://apps.apple.com/app/buckist-bucket-list-to-do/id6759974117
  - Site: https://www.buckist.app/
  - Blog, Android roundup (vendor-written): https://www.buckist.app/blog/top-bucket-list-apps-for-android/
  - Blog, "bucket list paralysis": https://www.buckist.app/blog/bucket-list-paralysis-too-many-goals
  - Blog, birthday review: https://www.buckist.app/blog/birthday-ritual-yearly-life-review
  - Product Hunt launch stats: https://hunted.space/dashboard/buckist/launches/buckist
- iBucket:
  - Play listing: https://play.google.com/store/apps/details?id=com.kaimallie.ibucket
  - iOS listing and version history: https://apps.apple.com/us/app/ibucket/id864052715
  - Site: https://ibucket.app
  - Help: https://ibucket.app/help
- Goals planner: https://play.google.com/store/apps/details?id=com.krutoapps.goalplanner
- Simple Bucket List: https://play.google.com/store/apps/details?id=com.thevarunshah.simplebucketlist
- Lifetime Goals: https://play.google.com/store/apps/details?id=np.com.shirishkoirala.lifetimegoals
- Bucket List – Travel Goals:
  - Play listing: https://play.google.com/store/apps/details?id=love.bucketlist.app
  - iOS listing: https://apps.apple.com/app/id6451215432
- My Bucket List & Life Goals: https://play.google.com/store/apps/details?id=my.bucket.list.slapps
- Life Goal Planner & Affirmation: https://play.google.com/store/apps/details?id=com.srgroup.lifegoals
- Adventure Book:
  - Play listing: https://play.google.com/store/apps/details?id=si.ahlin.adventurebook
  - Site: https://adventurebook.app
- DoBefore:
  - Play listing: https://play.google.com/store/apps/details?id=cz.sedlardavid.dobefore
  - Site: https://dobefore.app
- DreamList:
  - Play listing: https://play.google.com/store/apps/details?id=com.dreamlist.tree
  - Site: https://dreamlist.life
- DreamPaths:
  - Play listing: https://play.google.com/store/apps/details?id=com.jastar.dreampaths
  - Site: https://dreampathsapp.com
- Someday: https://play.google.com/store/apps/details?id=com.frontick.someday
- Galavant:
  - Play listing: https://play.google.com/store/apps/details?id=com.gyradevs.galavant
  - Site: https://galavant.merchase.app
- Bucktly: https://play.google.com/store/apps/details?id=com.app.bucktly
- Life Listr (iOS): https://apps.apple.com/us/app/bucket-list-maker-life-listr/id954332740
- Just Bucket (iOS): https://apps.apple.com/app/id696506350
- Roundups:
  - MakeUseOf (Feb 2021): https://www.makeuseof.com/best-bucket-list-apps-android/
  - TechnicalUstad (Sep 2025): https://technicalustad.com/bucket-list-apps/
  - Savor (vendor-written, updated Feb 2026): https://www.savortheapp.com/blog/food-memories-journaling/bucket-list-app/
- AlternativeTo (no user comments): https://alternativeto.net/software/bucketlist-org
- EIO internals:
  - `supabase/migrations/0015_bucket_list.sql`
  - `supabase/migrations/0015a…e_bucket_list_part*.sql`
  - `app/src/modules/bucket/types.ts`
  - `app/src/modules/bucket/api.ts`
  - `app/src/modules/bucket/screens/BucketListScreen.tsx`
  - `docs/USER-GUIDE.md`
  - `app/package.json`
