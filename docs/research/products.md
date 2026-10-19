# Products (daily-use consumables): competitor research

Research date: 19 October 2026. Scope: what the best apps for tracking consumables (supplements, skincare, household stock) do that EIO's Products module does not, in features and in UI. This is research only. No app was installed, run or decompiled, and no account was created.

**Evidence key.** Each substantive claim is tagged:

- **OBSERVED**: seen in the linked source.
- **OBSERVED (excerpt)**: seen in a search-engine excerpt of the linked official page, because a direct fetch was blocked (SkinSort returns HTTP 403 to automated fetches).
- **INFERRED**: reasoned from evidence; the basis is stated.
- **UNKNOWN**: looked for and not found.

**Note on the starting point.** The brief lists two known complaints: no usage history on the phone, and no way to log a past day. Commit `aac355a` ("Products: see your history on the phone, and log a day you missed", 2026-10-19 11:47 +0530) landed during this research. It adds a phone detail screen with a 14-day strip, a Today / Yesterday / any-past-day picker and day-grouped history with delete, and the same log-for-a-day row on the website (OBSERVED in `git show aac355a`). This report therefore treats those two complaints as fixed at a first level, and asks what is still missing for them to be fixed well (section 5).

---

## 0. The checklist (written before researching)

| # | Question | Evidence needed |
|---|---|---|
| Q1 | Which app in each neighbouring category teaches EIO the most? | Store listings, ratings, help-centre depth, relevance to non-scheduled consumables |
| Q2 | How is a daily dose or use logged: a one-tap "today" checklist, or per-product buttons? | Help articles, store descriptions, changelogs |
| Q3 | Can a missed day be backdated, and through what interaction? | Help articles; live demo forms |
| Q4 | How is usage history viewed (timeline, calendar, journal, report)? | Help articles, demo pages |
| Q5 | Can a past entry be edited, deleted or undone? | Help articles, demo pages, user complaints |
| Q6 | Refill and low-stock reminders: what triggers them, and how far ahead? | Help articles, store listings |
| Q7 | Restocking: starting a new container of the same product while keeping the old one's history | Help articles, demo pages |
| Q8 | Expiry and period-after-opening (PAO) | Help articles, demo product form, changelogs |
| Q9 | Adherence streaks and calendars | Store listings, help articles |
| Q10 | Cost per use or day, and price history across purchases | Demo product card, changelogs |
| Q11 | The visual presentation of "how much is left" | Screens, descriptions, reviews |
| Q12 | What users praise and complain about | Store reviews, Trustpilot, forums |

---

## 1. Which apps, and why

### How I chose

There is no single category for "how long will my whey last and when do I reorder". I went through the three neighbouring categories the brief named and ranked candidates on four questions:

1. Does the app model a container being used up over time?
2. Is its behaviour documented well enough to learn exact interactions from (help centre, public demo, changelog)?
3. Does it have a real user base, so there is praise and complaint evidence?
4. Does it cover something the other two picks do not?

| Category | Candidates looked at | Pick | Why this one |
|---|---|---|---|
| (a) Supplement and medication trackers | Medisafe, MyTherapy, Dosecast, SuppleMate, Stack, Capsuly, VitaL | **Medisafe** | The category leader: 4.7 stars from about 101K App Store ratings (OBSERVED, [App Store](https://apps.apple.com/us/app/medisafe-medication-management/id573916946)). It has the most detailed public help centre of any candidate, with step-by-step articles on refill thresholds, adding a dose, changing the time a dose was taken, un-taking, and deleting a single dose (OBSERVED, [help centre index](https://help-center.medisafe.com/en/collections/5305299-general-app-questions)). That makes it the best teacher for logging, backdating and refill reminders. MyTherapy is close behind (4.8 from 3.2K UK ratings, OBSERVED, [App Store UK](https://apps.apple.com/gb/app/pill-reminder-mytherapy/id662170995)), but it documents far less and its own site does not describe its refill mechanics. The supplement-specific apps (SuppleMate, Stack, Capsuly) advertise days-left estimates, but have too few ratings to show any (OBSERVED for SuppleMate, [App Store](https://apps.apple.com/ec/app/supplemate/id6740084610)). They are used below as supporting evidence only. |
| (b) Skincare routine and shelf trackers | SkinSort, SkinDooLae, MSKD, Skincare Routine: AM PM, Cosmetic Clock, Cosmetos | **SkinSort** | It is the only candidate found with all three of the things EIO lacks for skincare: an Owned shelf split into *Unopened / In Use / Empties*, PAO-based expiry with reminders, and routine logging with a way to fill in a missed day. It also has a **website and an app that share one account** (OBSERVED (excerpt), [how to log your routine](https://skinsort.com/support/how-to-log-your-routine)), which is the same two-client shape as EIO. It has 4.7 stars from 6.4K App Store ratings (OBSERVED, [App Store](https://apps.apple.com/app/id6478040418)). FeelinMySkin and TroveSkin were on the list but were not researched (see section 7). |
| (c) Household and pantry inventory | Grocy, Pantry Check, Sortly, Out of Milk | **Grocy** | Its data model is the closest match to EIO's missing pieces: every purchase is its own stock entry with its own price, purchased date, due date and opened state. It also has a "Default due days after opened" rule (the household version of PAO), a "Quick consume amount" (the same idea as EIO's per-use amount), a filterable journal of every transaction with **Undo**, a minimum stock amount, and a product card with last price, average price, average shelf life and a price history chart. It is open source with a **public live demo**, so interactions could be checked first-hand rather than taken from marketing copy (OBSERVED, [demo stock overview](https://demo.grocy.info/stockoverview)). Pantry Check (4.5 from 1.6K ratings, OBSERVED, [App Store](https://apps.apple.com/us/app/pantry-check-grocery-list/id966702368)) is more polished but documented only by its store listing. It is used below for its complaints. |

**INFERRED, from the evidence above:** the three picks split the problem cleanly.

- **Medisafe** teaches the *daily act*: logging, backdating, refill nagging.
- **SkinSort** teaches the *lifecycle of a container*: unopened, in use, finished, opened date and PAO, plus a "today" view.
- **Grocy** teaches *bookkeeping*: per-purchase entries, prices, a journal with undo, and stock thresholds.

None of the three projects a measured "days left" the way EIO does (section 4).

---

## 2. Per-app teardown

### 2.1 Medisafe (medication and supplement reminders)

**Features**

- **Supplements are added the same way as medications.** "you can add your vitamins and supplements the same way you would add a medication" (OBSERVED, [help](https://help-center.medisafe.com/en/articles/8349535-can-i-add-my-vitamins-and-supplements)).
- **Schedules.** Medications can be fixed-time, every other day, on a custom cycle, half doses, or "as needed" (OBSERVED from the article titles in the [help index](https://help-center.medisafe.com/en/collections/5305299-general-app-questions)). Switching to as-needed means turning off "Reminder times"; doses are then logged manually through **+ → Add Dose** (OBSERVED, [as-needed article](https://help-center.medisafe.com/en/articles/8103142-can-i-change-my-med-to-an-as-needed-schedule)).
- **Refill reminders.** The setup flow asks "Get refill reminders?", then the current pill or dose count, then a **threshold count**. On Android the default is "When I have 20 meds reminding". You also set a reminder time and an optional Rx number (OBSERVED, [refill article](https://help-center.medisafe.com/en/articles/8103161-can-i-get-reminded-when-it-is-time-to-refill-my-med)). An older FAQ says that once you are about to run out, "you will get a reminder at the requested time every day until you refill" (OBSERVED (excerpt), [2018 FAQ](https://www.medisafe.com/faq/how-do-i-set-a-refill-reminder-when-i-add-my-med-2/); the page now returns 404). How the count is topped up after a refill: **UNKNOWN**, as no help article covers it.
- **Reports.** The home timeline shows only the last 30 and next 30 days. Older history is under **Manage → Report**, which defaults to the last week and can switch to the last month or year (OBSERVED, [30-day article](https://help-center.medisafe.com/en/articles/9146319-why-can-t-i-see-farther-than-the-last-30-days-in-my-history)). Reports can be emailed, filtered to one medication on iOS, and "are limited to one year back" (OBSERVED, [report article](https://help-center.medisafe.com/en/articles/8103174-how-can-i-share-a-report-of-my-medication-history)).
- **Suspend.** A medication can be suspended rather than deleted (OBSERVED, [suspend article](https://help-center.medisafe.com/en/articles/8103209-how-do-i-make-a-medication-inactive)). What happens to its history: UNKNOWN.
- **Other surfaces.** Lock-screen widget, Apple Watch, PDF reports, and family "Medfriends" (OBSERVED, [App Store](https://apps.apple.com/us/app/medisafe-medication-management/id573916946)).

**Interaction details** (the most useful part for EIO)

- **Logging at a different time.** Long-press **Take** to get three choices: "Now", "On Time", "Set Time". "Set Time" lets you enter the date and time the dose was taken (OBSERVED, [choose time article](https://help-center.medisafe.com/en/articles/8103135-how-can-i-choose-the-time-i-marked-my-dose)). So a plain tap means now, and a long-press means "when?".
- **Correcting a logged dose.** Tap the dose, then **Un-take** to clear it, then Skip or long-press Take to re-record it with the right time (OBSERVED, [change time article](https://help-center.medisafe.com/en/articles/8102984-i-took-my-meds-at-a-different-time-how-do-i-change-the-time-taken)). Correction happens in place, with no delete-and-re-add.
- **Adding an unscheduled or past dose.** Use **+ → Add Dose → pick the med → confirm time and date → Save**, or on Android long-press the medication in the Medications list (OBSERVED, [add dose article](https://help-center.medisafe.com/en/articles/8103148-how-do-i-add-a-dose-of-my-med)). The article does not say whether a past date is allowed, but the "Set Time" date entry above implies it (INFERRED).
- **Deleting one dose.** The trash icon offers **"ONLY THIS DOSE"**. The other option, "all future doses", also removes "any past or future doses for that med" with no way to keep the history (OBSERVED, [delete dose article](https://help-center.medisafe.com/en/articles/8103000-how-to-delete-a-single-dose-of-a-med)). This is a cautionary example of a destructive option that is easy to misread.
- **Batch actions.** Swiping an outstanding reminder offers **"Take All"** and **"Snooze All"** (OBSERVED in a third-party guide from 2016, updated 2023, so it may be dated: [TechEnhancedLife](https://www.techenhancedlife.com/citizen-research/how-use-medisafe-app)).
- **Logging from the notification.** On Android you swipe or pull down the notification to mark the dose without opening the app (OBSERVED, [notification article](https://help-center.medisafe.com/en/articles/8103130-can-i-mark-a-dose-from-the-notification)).

**UI and visual patterns**

- **Two home screen styles.** One is a circular pillbox graphic divided into time-of-day quadrants. This is OBSERVED in the TechEnhancedLife guide and in a help article titled "My doses are showing up in the wrong quadrant" ([help index](https://help-center.medisafe.com/en/collections/5305299-general-app-questions)). The other is a **"Timeline view"** (OBSERVED, [home screen style](https://help-center.medisafe.com/en/articles/8097988-how-can-i-change-my-home-screen-style)).
- **Privacy on the lock screen.** Lock-screen alerts do not name the medication by default (OBSERVED, TechEnhancedLife).
- Exact colours, icons and the visual for remaining pills: **UNKNOWN**, as no screenshots were examined.

**Praise and complaints**

- **Praise.** "So simple to use and yet so powerful!" (OBSERVED, App Store review shown on the [listing](https://apps.apple.com/us/app/medisafe-medication-management/id573916946)).
- **The paywall.** Medisafe became "a fully paid app for users outside the U.S." from 1 January 2026, at $4.99 a month or $39.99 a year (OBSERVED, [help article](https://help-center.medisafe.com/en/articles/13052285-medisafe-is-now-a-fully-paid-app-for-users-outside-the-u-s)). That applies to India. Before that, the free tier was capped at "2 medications" (OBSERVED, [Trustpilot](https://uk.trustpilot.com/review/medisafe.com), 2.0 from 13 reviews, almost all about the paywall). A Diabetes UK forum user switched to MyTherapy, finding it "extremely easy to set up, very intuitive" (OBSERVED, [forum thread](https://forum.diabetes.org.uk/boards/threads/medisafe-alternative.114845)).
- **Reminders that are hard to change.** Some negative reviews mention difficulty changing or removing medication reminders (OBSERVED (excerpt), [Medical News Today](https://www.medicalnewstoday.com/articles/pill-reminder/)).

**What EIO should take from Medisafe:**

- tap = now, long-press = choose when;
- correct an entry in place;
- "only this one" delete semantics;
- Take All for a time slot;
- act from the notification.

**What not to copy:** a refill threshold expressed as a pill *count*. That suits fixed doses, not squirts of face wash (section 4).

---

### 2.2 SkinSort (skincare routines, shelf, expiry)

**Features**

- **Four shelves.** Every account starts with Owned, Liked, Disliked and Wishlist (OBSERVED (excerpt), [shelves](https://skinsort.com/support/skinsort-shelves)).
- **The Owned shelf has three automatic tabs** (OBSERVED (excerpt), [Unopened / In Use / Empties](https://skinsort.com/support/understanding-unopened-in-use-empties)):
  - **Unopened**: products you own that are not being tracked for expiry.
  - **In Use**: expiry tracking is on.
  - **Empties**: products you have finished. "If you finish the same product more than once, it can appear in Empties more than once." Products move between tabs only through actions (add, start tracking, mark finished). You cannot drag them between tabs.
- **Expiry from PAO.** You enter the open date and the PAO (the open-jar symbol with "12M" on the pack). SkinSort calculates the expiry and "display[s] it beneath the product on your Owned shelf". Reminders come **14 days before** and **on the day** it expires (OBSERVED (excerpt), [track expiry](https://skinsort.com/support/how-to-track-product-expiry)). An earlier excerpt says reminders can go by push, email or in-app (OBSERVED (excerpt), same page, lower confidence).
- **Routine frequency per product.** "every day, as needed, every other day, on specific days, or every 3 days" (OBSERVED (excerpt), [how to log your routine](https://skinsort.com/support/how-to-log-your-routine) / [build a routine](https://skinsort.com/support/how-to-build-a-routine)).
- **Today tab.** Version 1.89 (3 September) added it: "You can now see exactly which products you're scheduled to use each day" (OBSERVED, [App Store version history](https://apps.apple.com/us/app/skinsort-the-skincare-app/id6478040418?see-all=version-history)).
- **Weekly Progress Preview** in the Routines tab (OBSERVED (excerpt), [routines and shelves](https://skinsort.com/support/routines-and-shelves)).
- Streaks: **UNKNOWN** (none found).
- Quantity remaining or a days-left projection: **UNKNOWN**. No evidence was found that SkinSort tracks how much is left, so it is INFERRED that it tracks lifecycle and expiry but not consumption.

**Interaction details**

- **Logging a day.** Pick how your skin feels (an icon scale from bad to great), adjust concern sliders, select the products used, optionally add lifestyle factors and notes, then **Save** on the web or the **checkmark** at top right in the app (OBSERVED (excerpt), [log your routine](https://skinsort.com/support/how-to-log-your-routine)).
- **Filling in a missed day.** "If you forgot to log on a past date, tap See your progress, select the date you missed, and add your routine log from there" (OBSERVED (excerpt), same page). The backfill entry point is the progress view, not the log form.
- **Sync.** "Your routine log syncs automatically across the SkinSort website and app" (OBSERVED (excerpt), same page).

**UI and visual patterns**

- The expiry date sits *beneath the product* on the shelf (OBSERVED (excerpt)).
- Status is shown by which tab a product is in, rather than by a badge (OBSERVED (excerpt)).
- Exact colours and layout: **UNKNOWN** (no screenshots examined).

**Praise and complaints** (OBSERVED, [App Store listing](https://apps.apple.com/app/id6478040418))

- **Praise:** clear ingredient breakdowns, and "core features are free".
- **Complaints:** a September 2024 reviewer said content failed to load and onboarding hid preferences in settings; the developer replied that it was being fixed. Premium is listed at $7.99 to $12.99 a month or $19.99 to $59.99 a year.
- **Platforms:** the iOS listing is iPhone-only. An Android app: UNKNOWN.

**What EIO should take from SkinSort:**

- the *Unopened / In use / Finished* lifecycle, where repeat purchases stack up in Finished;
- PAO-to-expiry with a 14-day lead;
- frequency options per product;
- a "today" view of what is due;
- backfilling from a calendar of past days.

---

### 2.3 Grocy (self-hosted household and stock management)

Every Grocy observation below comes from the public demo at demo.grocy.info unless another source is linked.

**Features**

- **Stock overview** ([demo](https://demo.grocy.info/stockoverview), OBSERVED)
  - Columns: Product, Product group, Amount, Value, Next due date.
  - Optional columns include "Last purchased", "Last price", "Average price" and "Min. stock amount".
  - Status filter: "Due soon", "Overdue", "Expired", "Below min. stock amount", "In stock products".
- **Per-row quick actions** on the stock overview: a **"1"** button ("Consume 1 … of [product]"), an **"All"** button, and a second **"1"** button ("Mark 1 … as open") (OBSERVED, same page). The per-row amount is the product's **"Quick consume amount"**, which defaults to 1. Since 4.0.0 there is a separate **"Quick open amount"** (OBSERVED, changelogs [3.0.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/60_3.0.0_2020-12-22.md) and [4.0.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/70_4.0.0_2023-07-29.md)).
- **Stock entries: one row per purchase** ([demo](https://demo.grocy.info/stockentries), OBSERVED)
  - Columns: Product, Amount, Due date, Location, Store, **Price**, **Purchased date**, Timestamp, Note.
  - Row actions: "Consume this stock entry", "Mark this stock entry as open", "Edit stock entry", "Consume this stock entry as spoiled".
- **Product form** ([demo](https://demo.grocy.info/product/new), OBSERVED)
  - "Minimum stock amount", "Treat opened as out of stock".
  - "Due date type" ("Best before date" / "Expiration date").
  - "Default due days", **"Default due days after opened"**, plus freezing and thawing variants.
  - "Quick consume amount", "Quick open amount".
  - Quantity units, with a separate "Quantity unit for prices".
- **Opening a product can only make its due date earlier.** When a product with "Default due days after opened" is opened, "the resulting date now never extends the original due date" (OBSERVED, [3.1.0 changelog](https://raw.githubusercontent.com/grocy/grocy/master/changelog/62_3.1.0_2021-07-16.md)). This is the same rule as PAO versus the printed expiry.
- **Product card** ([demo](https://demo.grocy.info/stockoverview), OBSERVED)
  - Stock amount, Stock value, Last purchased, **Last used**, **Last price**, **Average price**, **Average shelf life**, **Spoil rate**.
  - A **Price history** section.
  - Stock transactions with an empty or zero price are excluded from average price, last price and the price history chart (OBSERVED, [4.0.0 changelog](https://raw.githubusercontent.com/grocy/grocy/master/changelog/70_4.0.0_2023-07-29.md)).
- **Price defaults on purchase.** The last price is "tracked and prefilled as a 'Total price' on purchase" (OBSERVED, 3.0.0 changelog). The purchase form toggles between "Unit price" and "Total price" (OBSERVED, [purchase demo](https://demo.grocy.info/purchase)).
- **Stock journal** ([demo](https://demo.grocy.info/stockjournal), OBSERVED)
  - Columns: Product, Amount, Transaction time, Transaction type, Location, Done by, Note.
  - Filters: product, transaction type ("Consume", "Product opened", "Purchase", "Inventory correction", "Stock entry edited (old/new values)", and others), location, user, and date range ("1 month", "6 months", "1 year", "2 years", "All").
  - Each row has **"Undo transaction"**.
- **Shopping list.** It has a "Below min. stock amount" filter and an "Add overdue/expired products" action, and shows "Last price (Unit)" and "Last price (Total)" (OBSERVED, [shopping list demo](https://demo.grocy.info/shoppinglist)).

**Interaction details**

- **No date on consume.** The consume form has Product, "Consume exact amount", Amount, Quantity unit, Location, "Spoiled", "Use a specific stock item", and Recipe. **There is no date field** (OBSERVED, [consume demo](https://demo.grocy.info/consume)). So Grocy cannot backdate a use from its UI. Whether the API allows it: UNKNOWN.
- **Purchases can be backdated, behind a setting.** "Show purchased date on purchase and inventory page (otherwise the date defaults to today)" (OBSERVED, [stock settings](https://demo.grocy.info/stocksettings)). This is a sensible default: today, with an escape hatch.
- **Undo is everywhere.** It is on every journal row. Undo from the success notification was fixed in 3.1.0 (OBSERVED, [3.1.0 changelog](https://raw.githubusercontent.com/grocy/grocy/master/changelog/62_3.1.0_2021-07-16.md)). Undoing the consumption of an opened item now restores it as opened (OBSERVED, 3.0.0 changelog).
- **Opened stock is used first.** "Opened stock entries get now consumed first by default" (OBSERVED, 3.0.0 changelog).
- **Date shortcuts.** Typing `MMDD` gives a date, `x` means "never overdue", and arrow keys step the day, week, month or year (OBSERVED, [README](https://github.com/grocy/grocy)).

**UI and visual patterns**

- **Status colours.** Due soon is **yellow**, overdue is **grey**, expired is **red** (OBSERVED, 3.0.0 changelog). There is a "Due soon days" setting (OBSERVED, stock settings); its default value is UNKNOWN.
- **Status filters work as summary buttons.** The changelog refers to a "yellow filter button" for due soon on the overview (OBSERVED, 3.0.0 changelog).
- **Look and feel.** Grocy is a dense web table UI, installable as a PWA, with no offline mode (OBSERVED, [grocy.info](https://grocy.info/)). It is the least polished of the three, so it is a model for data, not for looks (INFERRED from the demo's table layout).

**Praise and complaints**

- **Praise for breadth.** One description calls it a stock system that knows what is in the cupboard, where it lives, what it cost and when it expires (OBSERVED (excerpt), [Lemmy](https://lemmy.ndlug.org/post/97668) / [ElfHosted docs](https://docs.elfhosted.com/app/grocy/)).
- **Complaints about effort.** "the data input and actually getting it off the ground is very complex and intimidating"; "ludicrously complex"; a journalist gave up after a week, calling it "semi-professional warehouse logistics" (OBSERVED (excerpt), [Lemmy](https://lemmy.ndlug.org/post/97668) and [Digitec](https://www.digitec.ch/en/page/how-i-want-to-digitise-the-contents-of-my-fridge-and-fail-to-do-so-39565); the direct fetch timed out). There is also one maintainer working in spare time (OBSERVED (excerpt), Digitec).

**What EIO should take from Grocy:**

- one row per purchase, carrying its own price and dates;
- a journal with undo;
- the "opened never extends the printed date" rule;
- last and average price with a price history;
- a quick amount per product;
- "Treat opened as out of stock". INFERRED from the label: this lets stock thresholds count only unopened spares.

**What not to copy:** locations, stores, barcodes, labels, recipes. That breadth is exactly what users call overkill.

---

### 2.4 Supporting evidence from the runners-up

- **MyTherapy**
  - Release notes list "easier daily tracking, a clearer calendar, low-stock notifications" and a habit tracker with streaks (OBSERVED, [App Store UK](https://apps.apple.com/gb/app/pill-reminder-mytherapy/id662170995)).
  - Stock drops each time a dose is confirmed, with a refill reminder below a quantity (OBSERVED (excerpt), [APKMirror changelog](https://www.apkmirror.com/?p=6234726)).
  - Complaints: "You can't undo an action" and a fixed 30-minute snooze (OBSERVED, App Store UK review).
  - It contains ads and has a paid ad-free tier (OBSERVED, same listing).
- **Pantry Check**
  - It offers a "Current inventory & usage timeline" and "Smart shopping lists, based on usage and inventory" (OBSERVED, [App Store](https://apps.apple.com/us/app/pantry-check-grocery-list/id966702368)).
  - Complaints: "there is no 'undo' button", and the **usage slider is "too close to the 'finished' button"** (OBSERVED, same listing).
- **SuppleMate (Pro)** (OBSERVED, [App Store](https://apps.apple.com/ec/app/supplemate/id6740084610))
  - "Automatically deducts inventory when you mark a dose as complete".
  - "Low Stock Alerts: Get notified before you run out (e.g., 5 days remaining)".
  - "Expiration Management".
  - "Quick Check-in: Mark doses as done or undo them instantly".
- **Cosmetic Clock** sends expiry alerts at 30, 7 and 1 days before (OBSERVED (excerpt), [App Store](https://apps.apple.com/si/app/6751819732)).

---

## 3. What EIO already has

EIO tracks each product with:

- name, category and unit;
- total quantity, an optional per-use amount and a price in paise;
- opened-on and finished-on dates, and a note.

Each use is a separate row: date, quantity, note.

From those uses it **measures** a daily rate (amount used ÷ days open). It refuses to project until a product has been open two days and used at least once. It then gives days left, a projected empty date and cost per day, and sorts the list into five urgency bands:

- reorder now (≤ 7 days)
- running low (≤ 21 days)
- plenty
- not enough data
- finished

**As of `aac355a`:**

- Phone and website can both log a use for Today, Yesterday or any past day not before the opened date.
- The phone has a detail screen with a 14-day strip that shows empty days as gaps ("X of 14 days logged").
- Both clients have day-grouped history with delete.
- The phone list keeps its one-tap "Log use" for today, and long-press marks a product finished.

(OBSERVED in `supabase/migrations/0016_products.sql`, `app/src/modules/products/types.ts`, `api.ts`, and the commit message of `aac355a`.)

---

## 4. Gap analysis

### 4.1 Feature comparison

Legend: ✓ = has it · ~ = partial · ✗ = not found · ? = unknown

| Capability | Medisafe | SkinSort | Grocy | EIO now |
|---|---|---|---|---|
| One-tap log, today | ✓ Take | ✓ (select used products) | ✓ "1" / "All" per row | ✓ Log use |
| Batch log ("all of this morning's") | ✓ Take All | ~ (log the whole routine at once) | ✗ | ✗ |
| "Today" view of what is due | ✓ timeline / pillbox | ✓ Today tab (v1.89) | ✗ | ✗ |
| Backdate a use | ✓ long-press → Set Time | ✓ via progress view | ✗ (no date on consume) | ✓ day picker (aac355a) |
| Quick "when?" choice on the list itself | ✓ long-press Take | ✗ | ✗ | ✗ (detail screen only) |
| Edit a past entry in place | ✓ Un-take, re-take | ? | ✓ "Stock entry edited", Undo | ✗ (delete only; no `updateUse` in `api.ts`) |
| Undo right after logging | ? | ? | ✓ undo from notification | ✗ |
| Usage history view | ✓ 30-day timeline + reports | ✓ weekly progress | ✓ journal with filters | ✓ 14-day strip + grouped list |
| Refill or low-stock reminder | ✓ count threshold, daily nag | ✗ (expiry only) | ~ min stock → shopping list (no notification observed) | ✗ |
| Lead time of the warning | count-based (default 20) | 14 days + same day (expiry) | "Due soon days" setting | bands only, no alert |
| New container, history kept | ? | ✓ Empties repeat per purchase | ✓ stock entry per purchase | ✗ — `unique (user_id, name)` blocks a second same-named product |
| Spares (bought, not opened) | ✗ | ✓ Unopened tab | ✓ opened flag, "Treat opened as out of stock" | ✗ (`opened_on not null`) |
| Expiry date | ✗ | ✓ | ✓ due date, best before vs expiry | ✗ |
| Period after opening | ✗ | ✓ PAO → expiry | ✓ "Default due days after opened" | ✗ |
| Adherence calendar or streaks | ~ reports | ~ weekly preview | ✗ | ~ 14-day strip |
| Price history across purchases | ✗ | ✗ | ✓ chart, last and average price | ✗ (one price per product) |
| Cost per day | ✗ | ✗ | ✗ (value and prices, not per day) | ✓ |
| Measured days-left projection | ✗ | ✗ | ✗ (average shelf life looks backwards) | ✓ |
| Website and phone on one account | ✗ | ✓ | ✓ (web/PWA) | ✓ |

Sources for each cell are given in section 2. The EIO column is from code read on 2026-10-19.

### 4.2 What EIO lacks (priority order follows in section 5)

1. **Correction tools.** You can log a past day now, but a wrong entry can only be deleted and re-added, and there is no undo after a one-tap log. The "when?" choice lives only on the detail screen.
2. **Restocking.** The schema's own comment says a finished product "is kept, not deleted: its real lifespan is the best prediction available for the next one you buy" (OBSERVED, `0016_products.sql` lines 45–46). But `unique (user_id, name)` (line 55) means the next tub of the same whey cannot be added under the same name. So the lifespan the comment wants to reuse cannot be linked to anything.
3. **Proactive warning.** Urgency bands exist, but nothing tells you unless you open the screen. The home tile `overview()` counts *tracked* products, not ones that need reordering, even though its doc comment says "what needs reordering" (OBSERVED, `api.ts` lines 151–162).
4. **A "today" checklist.** Logging three daily supplements and two skincare steps means five separate cards.
5. **Expiry and PAO.** Sunscreen and actives can expire before they run out, and the measured projection cannot see that.
6. Spares, price history across purchases, a longer calendar view, and the ability to choose the date when marking something finished (`setFinished` always uses today; OBSERVED, `api.ts` lines 106–113).

### 4.3 What EIO already does better

- **A measured projection versus count thresholds.**
  - Medisafe warns when a *count* is crossed ("When I have 20 meds reminding"). MyTherapy warns "after a certain quantity". Both suit fixed doses.
  - For a face wash with no fixed dose, a count threshold has no meaning. EIO's rate (used ÷ days open) already absorbs skipped days and variable amounts, and it refuses to guess from one day.
  - None of the three picks shows a projected empty date. Grocy's "average shelf life" describes past entries and does not forecast the current one (INFERRED from the label on the product card).
  - SuppleMate's "5 days remaining" is days-based. Whether it is measured or derived from the schedule is UNKNOWN; derived from the schedule is more likely (INFERRED from "deducts inventory when you mark a dose as complete").
- **Cost per day in rupees.** None of the three shows it (section 4.1).
- **No paywall, no ads, no cap.** Medisafe now charges outside the US. MyTherapy carries ads.
- **Restraint.** EIO has no locations, barcodes, stores or recipes, which is exactly what Grocy users call "ludicrously complex". The recommendations below keep that restraint.

---

## 5. Recommendations

**Effort scale** (INFERRED for this codebase: two clients plus a shared Supabase schema):

- **S**: about a day.
- **M**: two to four days.
- **L**: more than a week.

"DB" means a migration is needed.

### The two known complaints: fixed, but not yet fixed well

`aac355a` answers both complaints at a first level: history on the phone, and logging a past day. Three things separate it from the best apps:

- **Correction in place.** Medisafe un-takes and re-times an entry. Grocy journals every edit and lets you undo. EIO can only delete.
- **Undo right after a one-tap log.** Grocy undoes from the success notification and SuppleMate offers "undo instantly". Its absence is a named complaint against both MyTherapy and Pantry Check.
- **The "when?" choice where you log.** Medisafe's long-press on Take gives Now / On Time / Set Time. EIO's day picker is one screen deeper, on the detail screen.

These three make up **TOP 1** below.

### TOP 5

**TOP 1: Edit a use, undo a log, and long-press for "when?"** (S, no DB)

- **What it is.** Three small changes:
  - Tapping a history row opens an edit sheet (day, quantity, note) with Save and Delete. This needs an `updateUse` in `api.ts`; the RLS update policy already exists in `0016`.
  - Every one-tap "Log use" on the list shows a snackbar for about 5 seconds: "Logged 5 g whey · Today — Undo".
  - Long-press "Log use" on a list card opens a small sheet: **Today · Yesterday · Pick a day…**, and an amount field pre-filled with the per-use amount.
  - Optionally, when a product used on most of the last 7 days has nothing logged yesterday, its card shows a one-line prompt "Nothing logged yesterday — add?" that opens the sheet already set to Yesterday.
- **Why it matters for one person.** A forgotten or wrong entry directly skews the measured rate, which the `aac355a` message itself points out. Delete-and-re-add costs two actions and loses the note.
- **Which apps have it.** Medisafe (Un-take, Now / On Time / Set Time, "ONLY THIS DOSE"); Grocy (Undo transaction, undo from notification); SuppleMate (undo instantly). The absence is a complaint against MyTherapy and Pantry Check.
- **Effort and DB.** S. No DB change.

**TOP 2: Restock ("Start a new one") that keeps the old container's history** (M, DB)

- **What it is.** When you mark a product finished, offer **"Start a new one"**: a pre-filled copy (same name, category, unit, size, per-use amount, last price editable, opened today). You can also restock early to buy ahead (see Spares below).
- **Data model, smallest option (INFERRED design).**
  - Keep `products` as the *container* row, so `project()` works unchanged per row.
  - Drop `unique (user_id, name)`.
  - Add a self-reference `previous_id uuid references products(id)`.
  - Add a partial unique index `(user_id, lower(name)) where finished_on is null` so only one *active* container exists per name.
  - Group containers by name in the UI.
- **Data model, cleaner option.** Split into `products` (the thing) and `product_containers` (each purchase: size, price, bought/opened/finished dates), with `product_uses.container_id`. This is better long-term, but it means rewriting `project()` callers and both clients' queries (L).
- **Why it matters.**
  - It lets the user restock without renaming to "Whey 2".
  - It unlocks a **prior** for the new container. Before two days of data, show "~42 days (last one lasted 42)" in muted text instead of "Not enough data". The last lifespan comes from `opened_on → finished_on` of the previous container. That turns the weakest moment of the measured projection, the first days, into a useful one.
  - It enables price history (Further 2).
- **Which apps have it.** SkinSort (Empties lists each finished purchase; Unopened holds spares); Grocy (one stock entry per purchase with its own price and dates; last price pre-filled on the next purchase).
- **Effort and DB.** M with the smallest option. DB change: yes.

**TOP 3: Reorder reminders, plus a "to reorder" count on Home** (M; optional DB)

- **What it is.**
  - A local notification on the morning a product crosses into *Reorder now* (`emptyOn − lead days`), and a second on the projected empty day.
  - Reschedule after every log, edit, delete, restock or finish; cancel when finished or when a spare exists.
  - Notification actions: **"Ordered"** (silences it until you restock) and **"Remind me in 3 days"**.
  - Change the Home tile to "2 to reorder" (urgency = critical) instead of the tracked count.
  - Optional per-product `reorder_lead_days`, defaulting to 7 to match the current band. Lead times differ by product: a local-shop item versus an online supplement order. That difference is INFERRED, not researched.
- **Why it matters.** Urgency bands only help if you open the screen. Running out of creatine or sunscreen happens precisely when you are not looking.
- **Implementation notes.**
  - `app/src/modules/subscriptions/notifications.ts` already schedules local reminders with a lead-days constant. Its header says the permission and channel handling should "move down into core when a SECOND module needs it". Products would be that second module.
  - The same header records that `expo-notifications` cannot run in Expo Go, so this must be tested in a development build. The user's dev loop uses sideloaded Expo Go, per their notes.
- **Which apps have it.** Medisafe (count threshold, reminder at a chosen time, daily until refilled); MyTherapy (low-stock notifications); SuppleMate (about 5 days remaining). EIO's version would be days-based on the *measured* rate, which none of them was seen doing.
- **Effort and DB.** M. A column is needed only for per-product lead time or "ordered".

**TOP 4: A "Today" checklist with "Log all"** (M; no DB if inferred)

- **What it is.**
  - A **Today** section at the top of the phone Products list, made of check rows: product name, per-use amount, and a circle.
  - Tapping a row logs the per-use amount (or 1) for today. Tapping again un-logs it, which is the undo.
  - A header button **"Log all (4)"** logs every unchecked row.
- **Which products appear.** Either:
  - inferred, with no DB change: products used on at least 5 of the last 7 days; or
  - explicit: a `schedule` column using SkinSort's options (daily, every other day, specific weekdays, every 3 days, as needed), with optional Morning / Evening grouping for skincare.
- **Why it matters.** Five daily items cost five card taps today, versus one tap with this. Complete daily logs also make the measured rate truer. It is the single biggest speed-up for the daily ritual.
- **Which apps have it.** Medisafe (Take All, timeline / pillbox by time of day); SkinSort (Today tab with scheduled products); SuppleMate (Quick Check-in with undo).
- **Effort and DB.** M. No DB change in the inferred variant.

**TOP 5: Expiry and period-after-opening** (S–M, DB)

- **What it is.**
  - Optional `expires_on` (the printed date) and `pao_months` (from the open-jar "12M") per container.
  - Compute `use_by = min(expires_on, opened_on + pao_months)`. This is Grocy's rule: opening never extends the printed date.
  - Show a second chip, "Use by 3 Jan", from 30 days before.
  - Warn when the measured projection says you **won't finish before it expires**: "At your pace this lasts 140 days; it expires in 90". No observed app combines its consumption rate with expiry like this (INFERRED from sections 2.2–2.3), and EIO's measured rate makes it cheap.
  - If TOP 3 is built, the same notification channel gives reminders 14 days before and on the day.
- **Why it matters.** Sunscreen, actives and opened supplements degrade. A "Plenty left" badge on an expired sunscreen is wrong in the way that matters.
- **Which apps have it.** SkinSort (PAO → expiry, 14 days and same day); Grocy (due days after opened; best before versus expiration); SuppleMate (expiration management); Cosmetic Clock (30, 7 and 1 days before).
- **Effort and DB.** S–M. DB change: yes (two nullable columns).

### Further recommendations, in priority order

1. **Spares (bought, not yet opened).** Allow a container with no `opened_on` (needs `opened_on` nullable; DB). When an active container is at *Reorder now* but an unopened spare exists, show **"Next one ready"** instead, and suppress the reorder notification. Opening the spare is the restock. Seen in SkinSort's Unopened tab and Grocy's opened flag / "Treat opened as out of stock". S after TOP 2.
2. **Price history and cost per use across containers.** Per product: last price, average price, the change since last purchase ("₹1,999 → ₹2,249, +12%"), and cost per day per container. Pre-fill the new container's price from the last one, as Grocy does. Seen in Grocy (product card, price history chart, last price pre-filled). S after TOP 2. DB covered by TOP 2.
3. **A month calendar in history** with a "days logged" count and an optional streak. The point is to *spot unlogged days*, which inflate days-left, not gamification. Tapping a day opens the log sheet for that day, as SkinSort does with "See your progress → select date". Seen in SkinSort (weekly progress) and MyTherapy (calendar, streaks). S. No DB.
4. **Product stats block, Grocy-style.** Last used, average per day, previous containers' lifespans ("lasted 41 / 38 / 44 days"), and average price. S after TOP 2. No DB.
5. **Choose the date when marking finished.** It currently always uses today. Use the same Today / Yesterday / Pick a day sheet. This matters because the finished date becomes the prior for the next container. S. No DB.
6. **Safer delete.** Deleting a product cascades its uses (OBSERVED, `on delete cascade` in `0016`). Show the count ("Deletes 62 logged uses") and suggest "Mark finished" instead. Medisafe's "all future doses" option, which silently deletes past history, is the counter-example. S. No DB.
7. **A cross-product journal** on the website: every use, restock and finish, with filters by product and type, a date range (1 month / 6 months / 1 year / All) and undo per row. Seen in Grocy's stock journal. S–M. No DB unless restock and finish become logged events.

**Deliberately not recommended:** barcode scanning and product databases, locations and stores, drug interactions, Medfriend or family sharing, recipes. These are the breadth that makes Grocy "ludicrously complex", and none of them serves one person.

---

## 6. UI/UX patterns worth adopting

These are specific enough to build from. Where a pattern is EIO's adaptation rather than something seen, it says so.

1. **Tap means now; long-press means when.**
   - The primary button logs today.
   - Long-press opens a bottom sheet with three large rows, **Today**, **Yesterday**, **Pick a day…** (opens the date picker; future days disabled; days before `opened_on` disabled), followed by an amount field pre-filled with the per-use amount.
   - Source: Medisafe's long-press Take → "Now / On Time / Set Time".
2. **An undo snackbar that names the day.**
   - Bottom snackbar for 5 seconds: "Logged **5 g** · **Yesterday**" with an **Undo** action on the right.
   - Naming the day confirms a backdated log went where you meant.
   - Source: Grocy's undo from the success notification; complaints against MyTherapy and Pantry Check. The day label is EIO's adaptation.
3. **History rows you can edit.**
   - Each row is a day header ("Sat 17 Oct · 2 uses · 10 g") followed by use rows. Tapping a use row opens an edit sheet (day, quantity, note, Save, Delete).
   - Delete removes only that use, so there is never an "all" option.
   - Source: Medisafe's "ONLY THIS DOSE" and its warning about "all future doses".
4. **A gap you can tap.**
   - Keep the 14-day strip. Draw an empty day as an outlined, hollow bar at the baseline rather than nothing, so it reads as *missing*.
   - Tapping it opens the long-press sheet already set to that day.
   - The month calendar (Further 3) uses the same encoding: filled dot for logged, hollow ring for days since opening with no log, nothing before `opened_on`.
   - Source: SkinSort's backfill from the progress view. The hollow encoding is EIO's adaptation.
5. **The Today checklist.**
   - Sections **Morning / Evening / Anytime** (or one "Today" section if no schedule is set).
   - Row: product name, a muted amount ("5 g"), and a 28 px check circle on the right. A checked row turns muted, shows "✓ 8:12", and drops to the bottom of its section.
   - The section header carries a text button, **"Log all (3)"**.
   - Source: Medisafe's Take All and time-of-day pillbox; SkinSort's Today tab; SuppleMate's Quick Check-in.
6. **How much is left: one bar, one marker, two numbers.**
   - A horizontal bar showing **remaining**, not used, filling from the left.
   - A thin vertical **reorder marker** at the point where remaining equals daily rate × lead days, so you can see the fill approaching it.
   - Below the bar: "**~23 days left** · empty 11 Nov" on the left, "₹14/day" on the right.
   - Before a projection exists, a striped or hatched bar with "Not enough data yet". With a prior (TOP 2): "~42 days (based on last one)" in muted text.
   - Keep the destructive **Mark finished** away from the quantity controls, in an overflow menu or behind a confirm.
   - Source: Pantry Check's complaint that its usage slider sits "too close to the 'finished' button". The bar and marker design is EIO's adaptation.
7. **Two kinds of urgency, never merged.**
   - The card shows one *primary* chip for whichever is sooner, reorder or use-by, and the other as a small secondary line.
   - Colours are fixed per meaning and always paired with words, never colour alone:
     - Reorder now: red
     - Running low: amber
     - Use-by within 30 days: amber, with a clock icon
     - Expired: red, with a clock icon
     - Not enough data: grey outline
     - Next one ready (spare): neutral, with a box icon
     - Finished: muted
   - Source: Grocy's fixed yellow / grey / red vocabulary and its separate due versus expired types.
8. **Lifecycle tabs that move items for you.**
   - Phone filter tabs: **Unopened · In use · Finished**. Items move only by action (open, finish, restock), never by dragging.
   - In Finished, repeat purchases group under one name with a count badge ("Whey ×3"). Expanding it shows each container's dates, lifespan and price.
   - Source: SkinSort's Unopened / In Use / Empties.
9. **A stats block on the detail screen.**
   - A 2×3 grid of small labelled figures: Last used · Avg per day · Days open; Last price · Avg price · Lasted (previous) "41 / 38 / 44 d".
   - Source: Grocy's product card.
10. **Notifications you can act on.**
    - "Whey: about 7 days left (empty ~26 Oct)" with actions **Ordered** and **In 3 days**.
    - Expiry: "Sunscreen expires in 14 days — about 30% left".
    - Sources: Medisafe marks doses from the notification; SkinSort reminds 14 days before expiry. The action names are EIO's adaptation.
11. **Date entry on the website.**
    - The log-for-a-day row accepts typed shortcuts: `y` for yesterday, `-3` for three days ago, `MMDD`.
    - Up and down arrow keys step the day.
    - Source: Grocy's date shortcuts and arrow-key stepping.

---

## 7. Checklist status

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | Best app per category | **Answered** | Medisafe, SkinSort and Grocy, with reasoning in section 1. FeelinMySkin, TroveSkin, Sortly and Out of Milk were not researched (see limits below). |
| Q2 | How a daily dose is logged | **Answered** | Medisafe: per-dose Take, Take All, from the notification. SkinSort: a whole-routine log and a Today tab. Grocy: per-row "1" / "All". |
| Q3 | Backdating | **Answered** | Medisafe: long-press → Set Time, and Add Dose with a date (past date INFERRED). SkinSort: from the progress view. Grocy: not possible on consume (OBSERVED); purchase date only behind a setting. |
| Q4 | History view | **Answered** | Medisafe: 30-day timeline plus reports (up to 1 year). SkinSort: weekly progress. Grocy: a filterable journal. |
| Q5 | Edit, delete, undo | **Partial** | Medisafe and Grocy answered. SkinSort: editing a log is UNKNOWN. |
| Q6 | Refill reminders and lead time | **Partial** | Medisafe: count threshold (default 20), repeats daily. SuppleMate: about 5 days. Grocy: min stock with no notification observed. How Medisafe tops up its count after a refill is UNKNOWN; MyTherapy's threshold is UNKNOWN. |
| Q7 | Restock with history | **Partial** | SkinSort (repeat Empties) and Grocy (per-purchase entries) answered. Medisafe: UNKNOWN. |
| Q8 | Expiry and PAO | **Answered** | SkinSort: PAO → expiry, 14 days and same day. Grocy: due days after opened, never extending the printed date. |
| Q9 | Streaks and calendars | **Partial** | MyTherapy streaks and calendar, and SkinSort's weekly preview, seen only in descriptions. No calendar screen was examined. SkinSort streaks UNKNOWN. |
| Q10 | Cost per use and price history | **Answered** | Only Grocy (last, average, chart). None shows cost per day. |
| Q11 | Visual for "how much is left" | **Unresolved** | No screenshots were examined in any app. The only visual evidence is Pantry Check's "usage slider" complaint. The patterns in section 6 are EIO adaptations and say so. |
| Q12 | Praise and complaints | **Answered** | App Store reviews, Trustpilot, a forum, Lemmy and Digitec (some as excerpts). |

**Limits of this investigation** (stated so the report is not read as more complete than it is):

- The shared **web-search budget ran out** partway through. FeelinMySkin, TroveSkin, Sortly, Out of Milk and Pantry Check's own help pages could not be searched.
- **Google Play pages were truncated** by the fetch tool, so App Store listings were used instead. Android-specific UI may differ.
- **SkinSort's support pages return HTTP 403** to automated fetches. Its claims rest on search-engine excerpts of the official pages, marked "OBSERVED (excerpt)".
- **No screenshots or videos were examined**, so colours, layouts and icons for all three apps are mostly UNKNOWN.
- Several Medisafe facts come from a 2016/2023 third-party guide (Take All, the pillbox graphic) or a 2018 FAQ (the daily reminder until refill) and may be dated.

---

## Sources

**Medisafe**
- App Store listing: https://apps.apple.com/us/app/medisafe-medication-management/id573916946
- Help centre index: https://help-center.medisafe.com/en/collections/5305299-general-app-questions
- Refill reminder: https://help-center.medisafe.com/en/articles/8103161-can-i-get-reminded-when-it-is-time-to-refill-my-med
- 2018 refill FAQ (now 404; excerpt only): https://www.medisafe.com/faq/how-do-i-set-a-refill-reminder-when-i-add-my-med-2/
- Choose the time a dose was marked: https://help-center.medisafe.com/en/articles/8103135-how-can-i-choose-the-time-i-marked-my-dose
- Change the time taken (Un-take): https://help-center.medisafe.com/en/articles/8102984-i-took-my-meds-at-a-different-time-how-do-i-change-the-time-taken
- Add a dose: https://help-center.medisafe.com/en/articles/8103148-how-do-i-add-a-dose-of-my-med
- Delete a single dose: https://help-center.medisafe.com/en/articles/8103000-how-to-delete-a-single-dose-of-a-med
- 30-day history limit: https://help-center.medisafe.com/en/articles/9146319-why-can-t-i-see-farther-than-the-last-30-days-in-my-history
- Share a report: https://help-center.medisafe.com/en/articles/8103174-how-can-i-share-a-report-of-my-medication-history
- As-needed schedule: https://help-center.medisafe.com/en/articles/8103142-can-i-change-my-med-to-an-as-needed-schedule
- Suspend a medication: https://help-center.medisafe.com/en/articles/8103209-how-do-i-make-a-medication-inactive
- Mark a dose from the notification: https://help-center.medisafe.com/en/articles/8103130-can-i-mark-a-dose-from-the-notification
- Home screen style: https://help-center.medisafe.com/en/articles/8097988-how-can-i-change-my-home-screen-style
- Vitamins and supplements: https://help-center.medisafe.com/en/articles/8349535-can-i-add-my-vitamins-and-supplements
- Paid outside the US: https://help-center.medisafe.com/en/articles/13052285-medisafe-is-now-a-fully-paid-app-for-users-outside-the-u-s
- Trustpilot: https://uk.trustpilot.com/review/medisafe.com
- Diabetes UK forum thread: https://forum.diabetes.org.uk/boards/threads/medisafe-alternative.114845
- TechEnhancedLife guide: https://www.techenhancedlife.com/citizen-research/how-use-medisafe-app
- Medical News Today: https://www.medicalnewstoday.com/articles/pill-reminder/

**SkinSort**
- App Store listing: https://apps.apple.com/app/id6478040418
- Version history: https://apps.apple.com/us/app/skinsort-the-skincare-app/id6478040418?see-all=version-history
- Unopened / In Use / Empties (excerpt): https://skinsort.com/support/understanding-unopened-in-use-empties
- Track product expiry (excerpt): https://skinsort.com/support/how-to-track-product-expiry
- Log your routine (excerpt): https://skinsort.com/support/how-to-log-your-routine
- Build a routine (excerpt): https://skinsort.com/support/how-to-build-a-routine
- Routines and shelves (excerpt): https://skinsort.com/support/routines-and-shelves
- Shelves (excerpt): https://skinsort.com/support/skinsort-shelves

**Grocy**
- Website: https://grocy.info/
- README: https://github.com/grocy/grocy
- Changelogs: [3.0.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/60_3.0.0_2020-12-22.md), [3.1.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/62_3.1.0_2021-07-16.md), [1.23.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/39_1.23.0_2018-11-24.md), [4.0.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/70_4.0.0_2023-07-29.md), [4.7.0](https://raw.githubusercontent.com/grocy/grocy/master/changelog/82_4.7.0_2026-08-28.md)
- Demo pages: https://demo.grocy.info/stockoverview · /stockentries · /consume · /purchase · /stockjournal · /stocksettings · /shoppinglist · /product/new
- Lemmy thread (excerpt): https://lemmy.ndlug.org/post/97668
- Digitec review (excerpt): https://www.digitec.ch/en/page/how-i-want-to-digitise-the-contents-of-my-fridge-and-fail-to-do-so-39565
- ElfHosted docs (excerpt): https://docs.elfhosted.com/app/grocy/

**Others**
- MyTherapy App Store (UK): https://apps.apple.com/gb/app/pill-reminder-mytherapy/id662170995
- MyTherapy website: https://www.mytherapyapp.com/
- MyTherapy changelog on APKMirror (excerpt): https://www.apkmirror.com/?p=6234726
- Pantry Check App Store: https://apps.apple.com/us/app/pantry-check-grocery-list/id966702368
- SuppleMate App Store: https://apps.apple.com/ec/app/supplemate/id6740084610
- Cosmetic Clock App Store (excerpt): https://apps.apple.com/si/app/6751819732

**EIO code** (read on 2026-10-19)
- `supabase/migrations/0016_products.sql`
- `app/src/modules/products/types.ts`, `api.ts`, `screens/ProductDetailScreen.tsx`
- `app/src/modules/subscriptions/notifications.ts`
- Commit `aac355a`
