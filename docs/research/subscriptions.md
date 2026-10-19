# Subscription trackers: competitor research for EIO

Research date: 2026-10-19. Scope: what the best subscription trackers do that EIO's Subscriptions module doesn't, for one person in India using an Android phone and a desktop website.

## How to read this report

Every substantive claim carries one of these tags:

- **[OBS]** means OBSERVED: seen in the linked source. Help-centre pages, FAQs, official changelogs and the vendor's own screenshots are the strongest evidence.
- **[INF]** means INFERRED: reasoned from something stated. The basis is given.
- **[UNK]** means UNKNOWN: not established from public evidence.

**Method and its limits**

- Only public evidence was used. No app was downloaded, installed, run or decompiled, and no account was created. Screenshots were viewed only where the developer publishes them on their own website (ReSubs, Tilla).
- Google Play pages could not be read by the fetch tool. Install and rating figures therefore come from third-party Play mirrors (androidrank.org, apppage.net). These are snapshots and estimates, not Google's numbers.
- CNBC, Android Authority and the XDA forum blocked fetching (HTTP 403). Where one of their claims appears, it was seen only in a search-result summary and is marked as weak.
- The shared web-search budget ran out partway through. After that, only known URLs were fetched directly. Some secondary questions stayed open because of this; see §7.
- ReSubs publishes most of the "best subscription tracker" roundups that rank well, and it ranks itself first. Those pages were used only for leads, never as evidence of ranking.

---

## 1. Which apps, and why

### Selection criteria

An app qualifies if all three hold:
1. It runs on Android.
2. It works in India without a US bank connection.
3. It is either widely installed, well rated, or the feature leader, and it is actively maintained in 2026.

### Candidate evidence (Google Play, third-party snapshots, October 2026)

| App | Android | Installs | Rating | Recent update | Works in India? |
|---|---|---|---|---|---|
| **ReSubs** (Christian Krueger) | Yes, plus iOS | 50k+ (est. ~60–70k) | 3.6 from ~1,040 | v1.38.x, Sep 2026 | Yes, manual entry with optional Gmail import |
| **Tilla** (Pavlo Rekun) | Android only | 50k+ (est. ~71–77k) | 4.4–4.5 from ~945 | v2.8.1, 29 Sep 2026 | Yes. India region in its service catalogue |
| **Subscriptions – Manage your regular expenses** (Simolation, now listed as AppFlux Labs) | Yes | **500k+** (est. ~530–630k) | 3.1–3.2 from ~5,800 | v2.8.7, Aug 2026 (minor) | Yes, manual entry |
| Rocket Money | Yes, plus iOS and web | 10M+ | 4.5 from ~140k | Oct 2026 | **No.** US banks only |
| Bobby | **iOS only** | n/a | 4.7 from 8K (App Store) | Dec 2025 | n/a on Android |
| Subby (Pocket Implementation) | Yes | 50k+ | 3.7 from 511 | n/a | Yes |
| SubX (AlkApps) | Yes | 50k+ | 3.9 from 865 | n/a | Yes |
| Feenko | Yes | 100k+ | 4.4 from ~2,600 | n/a | Bank or email scanning |

Sources for the table:
- Installs and ratings: androidrank pages for [ReSubs](https://www.androidrank.org/application/resubs/app.resubs), [Tilla](https://www.androidrank.org/application/tilla/com.pavelrekun.tilla), [Simolation](https://www.androidrank.org/application/subscriptions/de.simolation.subscriptionmanager), [Rocket Money](https://www.androidrank.org/application/rocket_money/com.truebill), [Subby](https://www.androidrank.org/application/subby_subscription_tracker/com.slapp.subby), [SubX](https://www.androidrank.org/application/subx/com.alkapps.subx) and [Feenko](https://www.androidrank.org/application/feenko/com.app.fynk). The full list of subscription apps came from [androidrank search](https://www.androidrank.org/search?q=subscriptions) **[OBS]**.
- Versions and ratings: apppage.net mirrors for [ReSubs](https://apppage.net/preview/app.resubs), [Tilla](https://apppage.net/preview/com.pavelrekun.tilla) and [Simolation](https://apppage.net/preview/de.simolation.subscriptionmanager) **[OBS]**.
- Rocket Money and international banks: the [Rocket Money help centre](https://help.rocketmoney.com/en/articles/79778-does-rocket-money-support-international-banks) says it does not support international banks **[OBS]**.
- Bobby: [App Store listing](https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023) **[OBS]**.

### The three chosen

1. **ReSubs is the feature leader among manual trackers that run on Android.** It is the only Android-available tracker found with all of the following, each documented in its own FAQ and changelog **[OBS]** ([FAQ](https://resubs.app/faq), [changelog](https://resubs.app/changelog)):
   - trial tracking with trial-end alerts
   - price-change history
   - a payment calendar
   - cancellation instructions
   - payment-method grouping
   - multi-currency with conversion
   - configurable reminder lead times

   It ships changes roughly every two weeks in 2026. Its 3.6 rating is mediocre, and the likely reasons are covered in §2.1.

2. **Tilla is the best-rated Android-native tracker and the most India-aware.** It has the highest rating of any dedicated tracker found (4.4–4.5 from about 945 ratings). It has been maintained since August 2021 with a detailed public changelog **[OBS]** ([changelog](https://pavlorekun.dev/projects/tilla/documents/changelog_release.md)).
   - Its service catalogue is filtered by region, India included. It bundles dozens of Indian services, such as Hotstar, JioSaavn, Zee5, SonyLIV, Swiggy One, Airtel, Vi, Tata Play, ACT Fibernet and Groww **[OBS]** (same changelog).
   - It follows Material You. That makes it the best Android UI reference **[OBS]**: Tilla 2.0 changelog and [developer screenshots](https://pavlorekun.dev/tilla/).

3. **Subscriptions (Simolation) is the most-installed dedicated tracker on Android**, with 500k+ installs since 2019 **[OBS]** (androidrank, apppage). It is the evidence for what the mass of manual-tracking users settle for.
   - Its thin feature set and 3.2 rating make it a useful lower bound.
   - Evidence about it is the thinnest of the three; see §7.

### Considered but not chosen

- **Rocket Money** is the category leader by a wide margin: 10M+ installs, 4.5★ **[OBS]**. It is unusable from India because it supports US banks only **[OBS]** ([help](https://help.rocketmoney.com/en/articles/79778-does-rocket-money-support-international-banks)), and even manual adding works by attaching transactions from linked accounts **[OBS]** ([help](https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions)). It is kept as a **pattern benchmark** in §2.4 because its "Upcoming" view is a well-documented reference.
- **Bobby** is iOS only **[OBS]** ([App Store](https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023)). It is kept as a short **visual benchmark** in §2.4.
- **Feenko** finds subscriptions by connecting bank or email accounts. Its App Store listing shows a $9.99/week plan. Both points come from a search-result summary of the [App Store listing](https://apps.apple.com/de/app/feenko-subscription-manager/id6747262759), which was not opened directly (weak evidence). The model doesn't fit a one-person manual tool **[INF]**.
- **Subby and SubX** are comparable in installs to ReSubs and Tilla. Their public documentation is too thin to tear down well.
  - Subby's Android and iOS apps appear to come from **different developers**: Pocket Implementation on Play, and "Abhaya Chandra G P" on the [App Store](https://apps.apple.com/in/app/subscription-tracker-loop/id6739703718) **[OBS]**. That makes its claims hard to attribute.

---

## 2. Per-app teardown

### 2.1 ReSubs

**Core features**

- **Free trials.**
  - "When adding a subscription, you can mark it as a trial and set the trial end date". ReSubs then reminds you before the trial expires **[OBS]** ([FAQ](https://resubs.app/faq)).
  - Push notifications for "upcoming renewals and trial expirations" arrived in v1.30 (Mar 2026) **[OBS]** ([changelog](https://resubs.app/changelog)).
  - Trials found by inbox scanning are flagged as trials automatically (v1.37) **[OBS]**.
- **Lifecycle states.** Active, paused, ended and trial **[OBS]** (FAQ: "You can also track paused and ended subscriptions").
  - Cancelling sets an **end date**. Removing a cancellation clears that end date (v1.28 fix) **[OBS]** (changelog).
  - So a cancelled subscription keeps running until the paid period ends **[INF]**, from the end-date behaviour.
- **Reminder timing.** "1 day, 3 days, 1 week, or custom periods before renewal" **[OBS]** (FAQ).
  - There are also optional email notifications (v1.30) and a periodic "spending report" digest whose frequency you choose (v1.28) **[OBS]** (changelog).
  - The top-voted reminder request on its own board is "More than 2 reminders", asking for 3–4 per subscription **[OBS]** ([feature board](https://resubs.featurebase.app)). That suggests the current cap is two per subscription **[INF]**.
- **Price-change history.** "When you update a subscription's cost, the previous amount is recorded". You are also notified when it detects a price increase **[OBS]** (FAQ).
  - Price-change alerts are a Premium feature **[OBS]** (FAQ, plan comparison).
- **Calendar.** There is a month calendar of all upcoming payments, so you can "spot months with higher spending" **[OBS]** (FAQ).
  - The screenshot shows a month grid with service logos on due days (up to two stacked) and today highlighted. Its footer reads "$166.57 Total · $40.19 Upcoming" **[OBS]** ([screenshot 8](https://resubs.app/screenshots/app-screenshot-8.webp)).
- **Yearly vs monthly framing.**
  - The Insights tab has a **Week / Month / Year** segmented control, a big total with its date range, and an "Expected payments next month" card **[OBS]** ([screenshot 3](https://resubs.app/screenshots/app-screenshot-3.webp)).
  - A "per-cadence compare chip" (v1.32) normalises every price in the list. The screenshot shows a "Per month ×" chip with a "$189.47 /mo" total pill **[OBS]** ([screenshot 2](https://resubs.app/screenshots/app-screenshot-2.webp)).
  - v1.38 fixed the yearly total "so it includes payments due later in the year" **[OBS]** (changelog). The yearly figure is therefore based on actual charges in the calendar year, not simply the monthly figure × 12 **[INF]**.
- **Cancellation guidance.**
  - Inside the app: "Open the subscription you want to cancel and tap 'Cancel Instructions'". It claims step-by-step guides for "hundreds of services", covering website, app, phone or email **[OBS]** (FAQ).
  - The web guides are organised **by billing channel** (web, App Store, Google Play), with a table of refund scenarios and notes on what happens after you cancel **[OBS]** ([Spotify guide](https://resubs.app/resources/how-to-cancel-spotify)).
  - v1.28 redesigned the cancellation screen "with clearer options and a confirmation flow" **[OBS]** (changelog).
- **Payment method.** You can group, filter and sort by payment method, and payment methods have colour pickers (v1.32) **[OBS]** (FAQ, changelog).
  - Insights break spending down by payment method, for example "Visa 28% · $46.47" **[OBS]** (screenshot 3).
  - A user request for "Payment method: balance tracking" shows people want to know whether a prepaid source can cover the next charge **[OBS]** (feature board).
- **Currency.** Each subscription keeps its original currency and is converted to your primary currency at current rates **[OBS]** (FAQ).
  - The list shows the converted amount with the original underneath, for example "$20.21" over "€18.00" **[OBS]** (screenshot 2).
- **Categories and organisation.** Custom categories, "profiles" (Personal, Work) and payment-method grouping **[OBS]** (FAQ).
  - Group headers show a count and a total, for example "Gaming 1 · $16.99" **[OBS]** (screenshot 4, changelog v1.32).
- **Adding a subscription.**
  - The flow: tap "+", then pick from popular services or create a custom one, then enter name, cost, cycle and renewal date, then optionally a category or payment method **[OBS]** (FAQ, "How do I add a new subscription?").
  - The service catalogue is sorted alphabetically and has a search field (v1.37) **[OBS]** (changelog).
  - Alternative entry routes: CSV import, Gmail import (you choose what to add), and AI extraction from a photo or PDF of a bill **[OBS]** (FAQ).
- **Other.**
  - Home-screen widgets showing upcoming payments and the monthly total **[OBS]** (FAQ).
  - Works offline **[OBS]** (FAQ).
  - Archiving **[OBS]** (FAQ mentions "consider archiving ones you no longer need").
  - Payment history screen grouped by date, with a total per day **[OBS]** ([screenshot 6](https://resubs.app/screenshots/app-screenshot-6.webp)).

**Interaction details that make it good**

- **Time-bucketed list.** "This week 1 · $16.99", then "This month 11 · $149.58". Each section header carries its own total **[OBS]** (screenshot 2).
- **Countdown on every row.** "Today", "10 days left", "21 days left" **[OBS]** (screenshot 2).
- **Sort, Compare and Group chips** sit directly above the list. A grid/list switch gives a "wall of logos" overview **[OBS]** (screenshots 1–2).
- **Settings are split by purpose:** General, Subscriptions, Organize, Data, plus a separate Notifications screen (v1.28) **[OBS]** (changelog).
- **Haptic feedback** on chips, tabs and toggles (v1.32) **[OBS]** (changelog).

**UI and visual patterns**

- **Full-bleed brand-coloured cards.** Xbox green, YouTube red and Netflix black, with a white logo and white text **[OBS]** (screenshots 1–2). Colourful cards became the default in v1.30 **[OBS]** (changelog).
- **Card layout is customisable.** Material You dynamic colour and a pure-black OLED mode are offered **[OBS]** (changelog v1.32, FAQ "Can I customize how the app looks?").
- **Navigation** is a floating pill-shaped bottom bar with three destinations: Home, Insights and Calendar (v1.38) **[OBS]** (changelog, screenshots).
- **Insights use horizontal bars, not pies.** Each row reads "42% · $69.45", with a category-coloured bar **[OBS]** (screenshot 3).

**What users praise and complain about**

- **Praise.** Store reviews mirrored on apppage call it "very handy" **[OBS]** ([apppage](https://apppage.net/preview/app.resubs)). Few review texts were reachable **[UNK]** for broader sentiment.
- **Complaints.** These come from its own public feature board **[OBS]** ([board](https://resubs.featurebase.app)):
  - a website version (18 votes)
  - password or fingerprint lock (18, planned)
  - "Marking subscription as paid" (19)
  - a monthly "usage check-in" that suggests pausing (21)
  - picking your own logos (19, planned)
  - a filter to hide expired subscriptions
  - countdowns and custom colours on the dashboard
  - nested sub-categories
- **Likely cause of the 3.6 rating [INF].** Heavy monetisation pressure, from:
  - a free tier capped at 5 subscriptions **[OBS]** (FAQ)
  - ads, including "watch a short video to unlock more subscriptions" (v1.28) **[OBS]** (changelog, apppage "Contains ads")
  - insights and price alerts gated behind Premium **[OBS]** (FAQ)

  The actual low-star review texts were not reachable **[UNK]**.

### 2.2 Tilla

The primary evidence is the developer's own changelog, from 2021 to 2026 ([changelog](https://pavlorekun.dev/projects/tilla/documents/changelog_release.md)), unless another source is named.

**Core features**

- **Catalogue ("bundled subscriptions").**
  - Bundled services are divided by region, and you can hide regions. The v1.5 note gives the example of hiding all Indian services if you don't need them **[OBS]**.
  - Bundled services are tied to their categories automatically **[OBS]**.
  - Indian services include Hotstar, JioSaavn, Zee5, SonyLIV, Swiggy One, Zomato Gold, Airtel, Vi, BSNL, Tata Play, ACT Fibernet, Groww, Smallcase, Times Prime, Kuku FM, Sun NXT, Aha, ETV Win and Max Life Insurance **[OBS]**.
  - You can propose additions by email **[OBS]** ([FAQ](https://pavlorekun.dev/projects/tilla/documents/faq.md)).
- **Billing cycles.**
  - Any number of days (v1.4) **[OBS]**.
  - Specific days of the month, "like every second Monday of the month" (v2.6) **[OBS]**.
  - One-time purchases (v2.7) **[OBS]**.
  - Free subscriptions with no price, and an end or expiry date (v2.1) **[OBS]**.
- **Free trials.** There is no explicit trial type or trial alert in five years of changelog **[INF]**, based on its absence. A trial can be approximated with a free subscription plus an end date **[INF]**.
  - ReSubs' comparison says Tilla lacks trial reminders. This comes from a competitor, so it is weak evidence **[OBS]** ([ReSubs vs Tilla](https://resubs.app/resources/resubs-vs-tilla)).
- **Reminders.**
  - Choose the approximate time of day (v1.4) **[OBS]**.
  - Remind on the payment date itself, the "Same day" option (v1.6, v2.3.12) **[OBS]**.
  - Make reminders **sticky**, so they can't be swiped away (v1.4) **[OBS]**.
  - The notification title states the exact payment date (v1.2) **[OBS]**.
  - Tapping a notification or widget opens that subscription's details (v2.4) **[OBS]**.
  - Whether you can choose how many days ahead to be reminded is **[UNK]**.
- **Reliability work on reminders.**
  - Moved to Android's "Alarms and reminders" exact-alarm permission (v2.3.9) **[OBS]**.
  - Fixed reminders not firing after a reboot (v2.3.9) **[OBS]**.
  - Added a dialog explaining how to exempt the app from battery optimisation (v2.1.9) **[OBS]**.
  - The FAQ blames missed reminders on OEM battery optimisation (OPPO, Xiaomi, OnePlus) and links to dontkillmyapp.com **[OBS]** ([FAQ](https://pavlorekun.dev/projects/tilla/documents/faq.md)).
- **Payments.**
  - Each subscription can switch from automatic to **manual** payment tracking, "to allow users to mark subscriptions as 'paid'" (v2.2) **[OBS]**.
  - The Details screen has a payments section with an "Add payment" dialog, and tracked payments can be removed **[OBS]** (v2.2, v2.3.12).
- **Price history.** None in the changelog **[INF]**, based on its absence.
  - An Android Authority piece reportedly said it lacks price-increase notifications. This was seen only in a search summary; the article returned 403, so it is weak evidence.
- **Calendar view** (v2.6) **[OBS]**.
  - The screenshot shows a month grid with each subscription's logo on its due day, today in a filled circle and the selected day outlined. Below the grid sit the selected date and the cards due that day **[OBS]** ([screenshots](https://pavlorekun.dev/tilla/)).
- **Totals and analytics.**
  - The home screen has a footer reading "Average expenses per month ≈ $46" **[OBS]** (screenshot).
  - The total-expenses card stays fixed at the top while scrolling (v2.0) **[OBS]**.
  - Changing the total's mode is animated (v2.1). There is a "yearly" total (v1.5.3 fix) **[OBS]**.
  - Premium Analytics (v2.4) has "Monthly statistics" and "Yearly statistics" donuts, each switchable between categories and subscriptions **[OBS]** (screenshot).
  - Also a "Spending trend by months" graph and a % difference versus the previous month (v2.7) **[OBS]**.
- **Payment methods.**
  - Per subscription (v1.6), with bundled VISA and Mastercard icons and custom icons (v2.2) **[OBS]**.
  - A default payment method (v2.3.5 fix) **[OBS]**.
  - Sort by payment method (v2.0) and filter by it (v2.2) **[OBS]**.
- **Currency.**
  - Each subscription has its own currency, and you choose a base currency for totals (v1.1) **[OBS]**.
  - A card option shows "the price in default currency next to the original price" (v2.1) **[OBS]**.
  - Zero-decimal currencies and locale-aware digit grouping are supported (v2.7) **[OBS]**.
  - A user review reports totals still counting in USD after a currency change **[OBS]** ([apppage](https://apppage.net/preview/com.pavelrekun.tilla)).
- **Organisation.**
  - Built-in categories, which keep growing (AI, Logistics, Insurance and others), plus custom categories **[OBS]**.
  - Profiles (v2.2) **[OBS]**.
  - Filters by category, payment method and profile. "Prices for all subscriptions tied to the filters", so the total follows the filter (v2.3) **[OBS]**.
  - An "Active" filter versus "All", where All includes suspended items (v2.3) **[OBS]**.
- **Lifecycle.** Suspend (v1.6), end date (v2.1) and **Archive** (v2.8, Jun 2026), where "deleted subscriptions are now preserved and can be either restored or permanently removed" **[OBS]**.
- **Adding a subscription.**
  - Search the catalogue (v1.5) **[OBS]**.
  - Clone an existing subscription (v2.4) **[OBS]**.
  - Custom icon from the device (v1.3) or from a URL (v2.7) **[OBS]**.
  - Colour by HEX code (v1.3) **[OBS]**.
  - A per-subscription link field (v1.7) **[OBS]**.
  - An unsaved-changes dialog (v2.7) **[OBS]**.
- **Widget.** Small (1 subscription) and big (3 subscriptions) sizes, resizable and following system or Material colours (v2.6) **[OBS]**.
  - Background can match the subscription's colour (v2.4) **[OBS]**.
  - Font scale and notes are configurable (v2.6.1) **[OBS]**.
- **Localisation.** Includes Hindi and Malayalam (v2.3.12, v1.2.1) **[OBS]**.

**Interaction details that make it good**

- **"Card layout" settings screen** (v2.0 onward) **[OBS]**. You decide what a row shows:
  - the date pattern
  - relative dates in days only (v2.4)
  - notes as the description line
  - converted price
  - prices aligned with average expenses (v2.6.1)
- **Choice of relative or absolute dates,** for example "14.01.2022" instead of "Tomorrow" (v1.5) **[OBS]**.
- **Plenty of sort options:** billing date, category, payment method, price, and reverse order for every criterion (v2.5) **[OBS]**.
- **The "Add own" button got a text label** "for better visibility" (v2.3.8) **[OBS]**. It shows the developer reacting to discoverability problems **[INF]**.
- **A backup restore asks for confirmation** and shows the backup's date and the subscriptions inside it before overwriting **[OBS]** (screenshot).

**UI and visual patterns**

- **Rows** are rounded cards filled with the service's brand colour **[OBS]** (screenshot). Examples: white for Notion, navy for Bitwarden, dark red for Strava, near-black for Claude.
  - Logo on the left, name in bold.
  - Right-aligned price in the original currency, for example "349 ₴" or "$9.99".
  - An uppercase countdown underneath: "2 DAYS", "17 DAYS", "1 MONTH".
- **The catalogue picker** uses the same brand-coloured rows, with search in the top bar and an "Add own" extended FAB **[OBS]** (screenshot).
- **Visual language.** Material You design with dynamic colour (v2.0), Material 3 date pickers, and a mint accent colour **[OBS]** (changelog, screenshots).
- **Dark-mode icon handling took repeated fixes.** The "white/black box" tinting issue on custom icons came up in v2.4 and v2.2.2 **[OBS]** (changelog).
  - A 2-star review reportedly said many templates "default to white" in dark mode. This was seen only in a search summary of an AppBrain page (weak evidence).

**What users praise and complain about**

- **Praise.** "Preety impressive And sweet interface" **[OBS]** ([apppage](https://apppage.net/preview/com.pavelrekun.tilla)). A 4.4–4.5 rating is the highest in the category on Android **[OBS]** (androidrank, apppage).
- **Complaints and requests:**
  - Premium is needed for cloud sync, analytics, custom themes, unlimited subscriptions and local backups **[OBS]** ([AlternativeTo comment](https://alternativeto.net/software/tilla/about/)).
  - Requests for scheduled backups, a fingerprint lock and more icons, and the currency-total bug **[OBS]** (apppage review).
  - Recurring reminder failures, which account for about eight separate reminder fixes in the changelog **[OBS]**.

### 2.3 Subscriptions, by Simolation (listed on Play as AppFlux Labs)

**Core features**

- **Recurring and one-time entries.** You set a billing period and the app shows the next payment date **[OBS]** ([apppage](https://apppage.net/preview/de.simolation.subscriptionmanager)).
  - Billing periods run "from daily to annual" **[OBS]** ([Similarweb](https://www.similarweb.com/app/google/de.simolation.subscriptionmanager/)).
- **Fields:** description, payment start date, **payment method** and notes **[OBS]** (apppage; [paramapp.com](https://paramapp.com/)).
- **Currency.** "160+ different currencies with the current exchange rate" **[OBS]** (paramapp.com).
  - A 2020 review shows a default currency chosen on first launch and a per-subscription currency picker under the price field **[OBS]** ([kocpc review](https://en.kocpc.com.tw/?p=4786)). This is old; current behaviour is **[UNK]**.
- **Organisation.** Labels (tags) and colours. Weekly, monthly and yearly expense reports **[OBS]** (Similarweb). One testimonial says tags are used for "categories or payment methods" **[OBS]** (paramapp.com).
- **Reminders.** Sent "before they hit your card" **[OBS]** (paramapp.com). The timing options are **[UNK]**.
- **Not documented anywhere:** free-trial tracking, price history, calendar view or cancellation guidance **[UNK]**. These are probably absent **[INF]**, given how little the developer's feature list contains.
- **Templates.** In 2022 there was no preset list of services **[OBS]** ([MakeUseOf](https://www.makeuseof.com/android-subscription-manager-apps/)). Whether that is still true is **[UNK]**.

**UI and visual patterns**

- **A colour per subscription** "to quickly identify each subscription service", and the monthly total at the top of the list **[OBS]** (kocpc, 2020).
- **Reviews praise the minimalist design** **[OBS]** (apppage).
- No current screenshots were reachable **[UNK]**.

**What users praise and complain about**

- **Praise.** "Brilliant app", "It's really useful" **[OBS]** (apppage).
- **Complaints.** No complaint texts were reachable **[UNK]**. The 3.1–3.2 average from about 5,800 ratings is the lowest of the three **[OBS]**.
- **Signs of ownership change or maintenance mode [INF].**
  - The developer name changed from Simolation to AppFlux Labs **[OBS]** (androidrank and Similarweb vs apppage).
  - The iOS listing linked from its own site and its Canny roadmap both returned 404 on 2026-10-19 **[OBS]**.
  - The last update note was "Monochrome icon added" **[OBS]** (apppage).
- **The lesson [INF].** A plain loop (price + cycle + currency → next date and total) is enough to reach 500k installs. Polish and maintenance are what separate a 3.2 from a 4.5.

### 2.4 Benchmarks consulted but not chosen

**Rocket Money (Android, US only)**

- **The "Recurring" tab has three views** **[OBS]** ([help](https://help.rocketmoney.com/en/articles/3117398-where-can-i-view-my-subscriptions-and-bills), [help](https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions)):
  - **Upcoming** is the default. A calendar at the top covers the next **two weeks**, with a list below "sorted by date of expected charge".
  - **All** is alphabetical.
  - The full **Calendar** opens from a double-arrow control.
  - Items with no detected payment in the past month move to an **Inactive** section at the bottom.
- **Cancellation help is organised by who bills you:** Apple, Google Play, Amazon, Roku and PayPal **[OBS]** ([help](https://help.rocketmoney.com/en/articles/4445878-how-do-i-cancel-subscriptions-that-are-billed-by-third-parties)).
- **For EIO [INF]:**
  - The "2-week strip + chronological list" home view is worth adopting.
  - So is "billed through" as a field.
  - EIO's ledger could reproduce the "Inactive" signal, as "no payment logged for N cycles".

**Bobby (iOS only, design reference)**

- 4.7★ from 8K ratings **[OBS]** ([App Store](https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023)).
- "Choose from hundreds of existing subscriptions" with service icons, a colour picker for custom ones, and totals shown per period or as a monthly average **[OBS]** (listing and reviews).
- Reviews praise "a great UI" and want more icon options for custom subscriptions **[OBS]**.
- ReSubs' comparison describes Bobby as having no multi-currency support and no subscription states. This is competitor-sourced and weak **[OBS]** ([ReSubs vs Bobby](https://resubs.app/resources/resubs-vs-bobby)).

---

## 3. What EIO already has

Checked against the repository on 2026-10-19:
- `supabase/migrations/0004_create_finance.sql` and `0005_subscription_category.sql`
- `app/src/modules/subscriptions/*`
- `website/src/pages/SubscriptionsPage.tsx`

**Data.** Each subscription stores:
- name
- amount in paise
- billing cycle: weekly, monthly, quarterly or yearly
- next due date
- an `is_active` flag
- a category that feeds the Finance ledger
- a note

**Summary.**
- The app shows a monthly-normalised total ("Costing you ₹X / month"). Contrary to the brief, it also shows **a yearly figure**: "₹X a year across N active".
- The website shows "Per month", "Per year", "Active" and "Due this week" stats.
- The website editor shows "That is ₹X a month" live as you type a non-monthly price.

**Rows.** A status colour drives a dot, the date text and the border: overdue = danger, due within 7 days = warning. A "renew" button appears only when renewal is near or past.

**Mark paid.**
- It advances the due date from the *existing* due date, so the billing anchor doesn't drift when you pay late.
- It logs an expense in Finance under the subscription's category.
- That expense uses the **stored** amount and today's date. It has **no account and no link back to the subscription**.

**Reminders.**
- One local notification, **fixed** at 3 days before, at a morning hour.
- Only in the installed build, not Expo Go.
- Skipped when the subscription is due within 3 days.
- Lost after a reinstall until each subscription is edited again (code comment in `notifications.ts`).

**Website.** Groups subscriptions by category.

---

## 4. Gap analysis

### 4.1 What the leaders have and EIO lacks

| Capability | ReSubs | Tilla | Simolation | Rocket Money (ref.) | EIO |
|---|---|---|---|---|---|
| Service catalogue with logos | Yes, hundreds **[OBS]** | Yes, by region incl. India **[OBS]** | No in 2022 **[OBS]**, now **[UNK]** | Yes **[OBS]** | No |
| Brand colour per row | Yes, default **[OBS]** | Yes **[OBS]** | Yes, user-picked **[OBS]** | **[UNK]** | No (status colour only) |
| Free-trial state + trial alert | Yes **[OBS]** | No **[INF]** | **[UNK]** | **[UNK]** | No |
| Paused / cancelled-with-end-date / archive | All three **[OBS]** | Suspend, end date, archive **[OBS]** | **[UNK]** | Auto "Inactive" **[OBS]** | Active flag only |
| Reminder lead-time choice | 1d / 3d / 1w / custom **[OBS]** | Time of day, same day, sticky **[OBS]** | **[UNK]** | **[UNK]** | Fixed 3 days, none if due in under 3 days |
| Price-change history | Yes, plus increase alert **[OBS]** | No **[INF]** | **[UNK]** | **[UNK]** | No |
| Upcoming calendar / timeline | Month grid + this-week/this-month buckets **[OBS]** | Month grid + day list **[OBS]** | **[UNK]** | 2-week strip + list **[OBS]** | "Due this week" count only |
| Payment method per subscription | Yes, with insights **[OBS]** | Yes, with icons, sort and filter **[OBS]** | Yes **[OBS]** | n/a (bank-linked) | No, though Finance has accounts |
| Per-subscription currency | Yes **[OBS]** | Yes **[OBS]** | Yes, 160+ **[OBS]** | n/a | INR only, by design |
| Flexible cycles (N days, one-time) | **[UNK]**; users ask for N-day cycles **[OBS]** | N days, nth weekday, one-time **[OBS]** | Daily to annual, one-time **[OBS]** | **[UNK]** | 4 fixed cycles |
| Cancellation guidance | In-app guides + link **[OBS]** | Link field **[OBS]** | Notes **[OBS]** | Guides by billing channel **[OBS]** | Note only |
| Insights (breakdown, trend) | Category and payment-method bars, next month **[OBS]** | Donuts, monthly trend, % vs last month **[OBS]** | Weekly / monthly / yearly reports **[OBS]** | n/a | Totals only |
| Home-screen widget | Yes **[OBS]** | Yes **[OBS]** | **[UNK]** | **[UNK]** | No |
| "Still using it?" / unused flag | Requested, not built **[OBS]** board | No **[INF]** | **[UNK]** | Auto-inactive when no charge **[OBS]** | No |

Sources: as cited in §2. Simolation's "No in 2022" is from MakeUseOf 2022. The ReSubs board items are at [resubs.featurebase.app](https://resubs.featurebase.app).

**Shared by the leaders [INF], from the table:**
- Brand identity on every row: logo plus colour.
- A countdown on every row.
- Payment method.
- Per-subscription currency with a converted total.
- A calendar of upcoming charges.
- More than a single reminder setting.
- Lifecycle states beyond on/off.

Trials and price history are documented only by ReSubs, the feature leader.

### 4.2 Where EIO is already better

- **The ledger link.**
  - Mark paid writes a real expense into Finance under the right category. Neither ReSubs nor Tilla connects to a wider money picture.
  - Tilla's manual "mark as paid" only records the payment inside Tilla **[OBS]**.
  - ReSubs users are still asking for "Marking subscription as paid" (19 votes) **[OBS]** ([board](https://resubs.featurebase.app)).
  - This also gives EIO a source of **real** price history, from what you actually paid, that no competitor has **[INF]**.
- **Anchored due dates.** Paying late doesn't shift the billing date. This is in EIO's code. Competitors' handling is **[UNK]**; Tilla's v2.8.1 note mentions "improved next bill handling" **[OBS]**.
- **Phone and desktop on one database.**
  - ReSubs has "no web version", and that is an 18-vote request **[OBS]** (FAQ, board).
  - Tilla is Android-only **[OBS]**.
- **No caps, ads or paywalls.** The free tiers are 5 subscriptions for ReSubs **[OBS]** (FAQ), 10 for Tilla Basic since Jan 2025 **[OBS]** (changelog v2.4), and 10 for Simolation/Param **[OBS]** (paramapp.com).
- **Action only when it's actionable.** The renew button shows only near or after the due date, and overdue status is explicit. ReSubs' rows have no overdue state in its screenshots **[INF]**, from the screenshots.
- **Live normalisation while editing** on the website ("That is ₹X a month"). ReSubs reached a similar idea with its per-cadence chip **[OBS]**.

---

## 5. Recommendations

Effort: **S** = under a day, **M** = a few days, **L** = a week or more, counting app and website together. "DB" means a Supabase migration is needed. Bank linking, bill negotiation, family sharing, AI savings assistants and monetisation are deliberately left out.

### TOP 5

**1. Free trials as a real state, with trial-end alerts.**
- **What.** An "This is a free trial" toggle in the editor, with "Trial ends on" and "Then costs ₹X / cycle".
  - The row shows a **TRIAL** badge and "ends in N days".
  - The trial is excluded from the monthly total until it converts. A small "₹X/mo if kept" line shows instead.
  - Reminders go out 3 days and 1 day before, and on the morning of the end date.
  - On the end date, a prompt asks: **Keep (convert to paid)** or **I cancelled (archive)**.
- **Why, for one person.** Forgotten trials are the classic surprise charge, and in India they often convert silently through a card on file or a UPI AutoPay mandate **[INF]**. It is the single highest money-at-risk event a tracker can catch.
- **Who has it.** ReSubs **[OBS]**. Tilla can only approximate it with an end date **[INF]**.
- **Effort.** M.
- **DB.** Yes: `status` (see #8) or `is_trial boolean`, plus `trial_ends_on date`.

**2. Upcoming charges: a 14-day strip and a month calendar.**
- **What.**
  - At the top of the list: a horizontally scrollable 14-day strip. Each day shows small logos and its rupee total, and tapping a day filters the list.
  - Below it, the list is split into **Overdue / This week / This month / Later**, each header with a count and a total.
  - A full month grid sits behind a calendar icon. Each day cell shows up to two logos plus "+N". Tapping a day lists that day's charges underneath. The footer shows "Total this month · Still to pay".
  - Dates are projected client-side from `next_due_date` and the cycle. The website gets the same month grid.
- **Why.** Knowing that ₹6,000 lands in the first week of the month matters for one person's cash flow more than any chart.
- **Who has it.** ReSubs (grid and time buckets) **[OBS]**, Tilla (grid and day list) **[OBS]**, Rocket Money (2-week default view) **[OBS]**.
- **Effort.** M.
- **DB.** No.

**3. Reminders that can't be missed.**
- **What.**
  - (a) A global setting for reminder offsets as multi-select chips: *7 days, 3 days, 1 day, Same day*. Add a reminder time-of-day picker, and allow a per-subscription override.
  - (b) **Never skip.** If the due date is closer than the largest offset, schedule the remaining ones, at minimum "Same day". Today EIO schedules nothing when the due date is within 3 days.
  - (c) **Re-sync all reminders on app launch**: cancel this module's notifications and reschedule them. That fixes the "lost after reinstall until edited" gap.
  - (d) The notification title names the service and the when ("Netflix renews tomorrow · ₹649"). Tapping it opens the subscription. Add a "Mark paid" action button.
  - (e) A one-time help card about battery-optimisation exemptions for OEM phones.
- **Why.** Reminders are the product. One fixed lead time fails both cheap monthly items and big annual ones.
- **Who has it.**
  - ReSubs: 1d / 3d / 1w / custom **[OBS]**.
  - Tilla: time of day, same day, sticky reminders, tap to open details, exact-alarm and battery guidance **[OBS]**.
  - Users want more than two reminders **[OBS]** (ReSubs board).
- **Effort.** S–M.
- **DB.** Optional: `reminder_offsets smallint[]` for per-subscription overrides. The global default can live in app settings.

**4. Quick-add from an India-first service catalogue, with logos and brand colours.**
- **What.** A shared JSON catalogue used by both app and website, with about 60–100 services.
  - Each entry has: key, name, domain, brand colour, category, usual cycle, a typical INR price as a hint, and a cancel/manage URL.
  - It covers the services you actually use: OTT, music, telecom, DTH, cloud, AI tools, gym, insurance.
  - The add screen opens on a search field with brand-coloured results and a clearly labelled **"Add own"** button. Picking a service pre-fills everything except the price, which you confirm.
  - Logos come from the service's favicon or logo by domain, cached, with a coloured monogram tile as the fallback.
  - Also add a **Clone** action on existing subscriptions.
- **Why.** This is the biggest visual upgrade: logos make a list scannable at a glance. It also makes adding a subscription a 5-second job, so the list stays complete.
- **Who has it.** ReSubs **[OBS]**, Tilla (region-filtered, many Indian services, "Add own", clone) **[OBS]**, Bobby **[OBS]**, Rocket Money **[OBS]**.
- **Effort.** M.
- **DB.** Yes, small: `service_key text null`, `color text null`, and optionally `domain`/`logo_url`.
- **Caution [INF].** Don't copy any app's catalogue or artwork. Build the list from the services' own sites. Logos are trademarks, which is fine for private use but a reason not to publish the catalogue. Tilla's FAQ notes a takedown warning over Viacom18 brands **[OBS]** ([FAQ](https://pavlorekun.dev/projects/tilla/documents/faq.md)).

**5. "Charged to": link each subscription to a Finance account, and make Mark paid honest.**
- **What.**
  - Add `account_id` (FK to EIO's existing `accounts` table: bank, wallet, credit card) and a `charge_channel`: *Card · UPI AutoPay · Google Play · Apple · Net-banking mandate · Manual*.
  - Show it on the row's secondary line ("Monthly · HDFC Card"). Allow group and filter by it, with totals that follow the filter.
  - **Mark paid** then logs the expense **against that account**, so balances stay correct. Today it logs with no account.
  - Mark paid also opens a one-tap confirm sheet with the amount **pre-filled but editable**. The real charge can differ because of GST, a forex markup or a price rise.
- **Why.** When a card is replaced or expires, or you revoke a UPI mandate, you need to see at once which subscriptions break. The billing channel also decides *how* you cancel.
- **Who has it.** All three chosen apps have payment method **[OBS]**. Rocket Money organises cancellation by billing channel **[OBS]**.
- **Effort.** S–M.
- **DB.** Yes: `subscriptions.account_id uuid null references accounts`, `charge_channel text null`. Also `transactions.subscription_id uuid null`, which enables #7.

### Next

**6. Flexible billing cycles: every N days, weeks or months, and one-time.**
- **What.** Replace the four-value enum with a unit + count. The migration maps the old values: weekly → (week, 1), monthly → (month, 1), quarterly → (month, 3), yearly → (year, 1). Normalisation becomes per-day based.
- **Why.** Indian prepaid mobile and DTH packs run on 28, 56 or 84 days **[INF]**, from general market knowledge, not verified in this research. Modelled as "monthly", their due dates drift by several days within a few months.
- **Who has it.** Tilla (N days, nth weekday, one-time) **[OBS]** and Simolation (daily to annual, one-time) **[OBS]**. ReSubs users ask for it **[OBS]** (apppage review: a "recurring schedule based on a number of days").
- **Effort.** M.
- **DB.** Yes.

**7. Price-change history, with a "price went up" signal.**
- **What.**
  - Editing the amount writes a history row.
  - With #5, a Mark paid confirmation at a different amount asks: "Update price to ₹X?"
  - The detail screen shows a step list ("₹499 → ₹649 on 3 Mar 2026, +30%").
  - The row gets a small "↑" badge for 60 days after an increase.
  - Insights add "Price rises this year: +₹X/yr".
- **Why.** Stealth price rises are how a fixed budget creeps. EIO can show what you actually paid, not just what you typed.
- **Who has it.** ReSubs (history plus increase alert) **[OBS]**.
- **Effort.** M.
- **DB.** Yes: a `subscription_price_changes` table (subscription_id, old/new amount, effective_on), or derive it from `transactions.subscription_id`.

**8. Lifecycle: Active, Trial, Paused, Cancelled (ends on X), Archived, with cancellation info.**
- **What.**
  - **Cancel** asks "Access until?", defaulting to the next due date. The row moves to an "Ending" section with a countdown and drops out of the totals afterwards. Undo clears the end date.
  - **Pause** has an optional resume date.
  - **Archive** keeps the history, with restore and delete from an Archive screen.
  - The editor gains a "How to cancel" section: a URL plus free-text notes.
- **Why.** Today's on/off flag can't express "cancelled but paid until the 30th", which is exactly when you need the reminder *not* to fire.
- **Who has it.** ReSubs (states, end date, cancel instructions) **[OBS]**, Tilla (suspend, end date, archive, link field) **[OBS]**, Rocket Money (inactive section, channel guides) **[OBS]**.
- **Effort.** S–M.
- **DB.** Yes: `status text`, `ends_on date`, `cancel_url text`, `cancel_notes text`. `is_active` stays as a derived or compatibility column.

**9. Per-subscription currency, while Finance stays INR.**
- **What.**
  - Add `currency` (default INR) and keep `amount_minor` in that currency.
  - Totals convert with a **manually set** rate per currency, stored with its date. That matches Finance's documented "no price feed" principle in `0008_finance_v2.sql`.
  - The row shows "$20 · ≈₹1,720".
  - Mark paid always logs the **actual INR** charged, via the confirm sheet in #5.
- **Why.** ChatGPT, Claude, Midjourney, domains and cloud services bill in USD. Today you must type a guessed rupee figure that is wrong after every bank markup **[INF]**.
- **Who has it.** All three chosen apps **[OBS]**.
- **Effort.** M.
- **DB.** Yes.

**10. "Still using it?" review.**
- **What.**
  - Once a month, a card lists subscriptions not reviewed in 90 days, offering **Keep / Pause / Cancel**.
  - Optionally a 1–3 "how much do I use it" rating.
  - Also auto-flag "no payment logged for 2 cycles" from the ledger.
- **Why.** The real saving for one person is cutting what you no longer use. No leader does this well, so this is EIO's chance to lead.
- **Who has it.** Requested on ReSubs' board, not built (21 and 9 votes) **[OBS]**. Rocket Money's auto-Inactive is the nearest equivalent **[OBS]**.
- **Effort.** S–M.
- **DB.** Yes: `last_reviewed_on date`, optional `usage smallint`.

**11. Insights view.**
- **What.**
  - A Week / Month / Year segmented control with a date-range subtitle and a "Next 30 days" figure.
  - Horizontal category bars labelled "% · ₹" (the same layout for payment method).
  - A per-item **₹ per year** column, sortable.
  - "This calendar year you'll pay ₹X", counting actual occurrences, not monthly × 12.
  - Month-over-month change computed from the ledger.
- **Who has it.** ReSubs **[OBS]**, Tilla **[OBS]**.
- **Effort.** M.
- **DB.** No.

**12. Row display preferences.** Relative vs absolute dates, a monthly-equivalent subtitle for non-monthly items, and showing the note.
- **Who has it.** Tilla "Card layout" **[OBS]**.
- **Effort.** S.
- **DB.** No (app settings).

**13. Home-screen widget** showing the next 3 charges.
- **Who has it.** ReSubs and Tilla **[OBS]**.
- **Effort.** L. It needs a native widget module in an Expo SDK 57 build; compatibility is **[UNK]** and needs checking against the v57 docs before committing.
- **DB.** No.

---

## 6. UI/UX patterns worth adopting

Each pattern is described so it can be built without seeing the apps. The source is in brackets.

1. **Brand-identity row.** Build it from these parts:
   - **Left:** a 40×40 rounded-square tile, 10–12 px radius, filled with the brand colour and holding a white or brand logo. Fall back to a 2-letter monogram on the brand colour.
   - **Middle:** the name in semibold on line 1. Line 2 is muted and reads "Monthly · HDFC Card", or "Trial · then ₹199/mo".
   - **Right:** the amount in tabular numerals on line 1. A countdown chip on line 2: `Today`, `Tomorrow`, `in 5 days`, `in 3 wks`, `2 days overdue`.

   Offer an optional "colourful cards" setting that fills the whole card with the brand colour. Choose white or black text automatically from the colour's luminance. [ReSubs screenshots 1–2 and changelog v1.30; Tilla screenshot. Both show white text on dark cards and dark text on white cards **[OBS]**.] EIO's status colour (overdue/soon) should stay as the countdown chip's colour, not the card colour, so brand and urgency don't fight.

2. **Countdown wording.** Use days up to 13, then weeks or months ("1 MONTH" in Tilla **[OBS]**; "21 days left" in ReSubs **[OBS]**). Offer a setting for absolute dates (Tilla v1.5 **[OBS]**).

3. **Summary hero with a cadence switch.** A pill "₹4,870 / mo". Tapping it cycles **/wk → /mo → /yr** with an animated number roll.
   - When the cadence isn't "as billed", every row's amount shows the normalised value, with the billed price faint beneath it.
   - The hero stays pinned while the list scrolls.
   - [ReSubs "$189.47 /mo" pill and "Per month ×" chip **[OBS]**; Tilla fixed total card and animated mode change **[OBS]**.]

4. **Time-bucketed list with header totals.** Sections run in this order: `Overdue` (danger tint), `This week`, `This month`, `Later`, `Trials`, `Paused & ending` (collapsed), `Archived` (link at the bottom).
   - Each header reads "This week · 3 · ₹1,247".
   - [ReSubs "This week 1 · $16.99" **[OBS]**; Rocket Money "View inactive" at the bottom **[OBS]**.]

5. **Chip row above the list:** `Sort ▾`, `Group ▾` (none / category / charged-to), `Cadence`, and a search icon. Group headers show count and total. Any filter recomputes the hero total, labelled "filtered". [ReSubs chips and group headers **[OBS]**; Tilla "prices tied to filters" **[OBS]**.]

6. **The 14-day strip.** Each day is a 44 px column with a weekday letter, the date number, up to 2 stacked 16 px logos, and a tiny ₹ total underneath. Today is outlined. Tapping a day scrolls the list to it or filters by it. [Rocket Money's 2-week "Upcoming" calendar above a date-sorted list **[OBS]**.]

7. **Month calendar.**
   - Header: month name plus ‹ › arrows and a "today" button.
   - Each cell holds a date number and up to 2 logos plus "+N". Today is a filled circle and the selected day is outlined.
   - Under the grid, the selected day's charges appear as normal rows.
   - Footer: "Total ₹X · Still to pay ₹Y".
   - On the website, the grid can be wide with names inside the cells.
   - [Tilla and ReSubs calendar screenshots **[OBS]**.]

8. **Add flow.**
   - Open on search with the keyboard up and Indian services ranked first.
   - Results are brand-coloured rows.
   - An extended FAB with a text label, "+ Add own", sits bottom-right.
   - Picking a service pre-fills name, logo, colour, category and cycle, then focuses the amount field.
   - Keep EIO's live "That is ₹X a month" line under the amount, and add "₹Y a year".
   - Ask before discarding unsaved changes.
   - [Tilla catalogue screen, "Add own" label (v2.3.8), unsaved-changes dialog (v2.7) **[OBS]**; ReSubs search in setup (v1.37) **[OBS]**.]

9. **Details screen.**
   - A hero with a 64 px logo tile, the name, a big price, "₹X a year", and a "Next charge in N days · 12 Nov" line.
   - Then these sections:
     - **Payments**, from the ledger, grouped by date.
     - **Price history** as a step list with ↑/↓ and %.
     - **Reminders**, the effective offsets with an override.
     - **Charged to**.
     - **How to cancel**: an open-link button plus notes.
     - Actions at the bottom: Pause / Cancel / Archive.
   - [ReSubs payments screen and "animated hero" (v1.25) **[OBS]**; Tilla payments section **[OBS]**.]

10. **Cancel flow.**
    - A bottom sheet: "When does access end?", defaulting to the next due date, with Confirm.
    - The row then shows "Ends in 9 days" in a muted style and is excluded from totals after that date.
    - Undo via a snackbar or "Undo cancellation" on the details screen, which clears the end date.
    - [ReSubs redesigned cancel screen with confirmation (v1.28), and the end date cleared when a cancellation is removed **[OBS]**.]

11. **Trial treatment.**
    - An outlined amber `TRIAL` badge on the row.
    - The countdown shows "ends today" or "ends tomorrow" in warning colour.
    - The trial-end notification reads "Your [service] trial ends tomorrow, then ₹X/mo". Its actions are `Keep` and `I cancelled`.
    - [ReSubs trial reminders **[OBS]**. The exact copy and actions are **[INF]**.]

12. **Notifications.**
    - The title names the service and the exact day.
    - The body gives the amount and the "charged to" account.
    - Tapping it deep-links to the subscription. An action button marks it paid.
    - An optional "sticky on the due day" setting.
    - [ReSubs "Spotify renews tomorrow" **[OBS]**; Tilla exact date in title (v1.2), tap opens details (v2.4), sticky option (v1.4) **[OBS]**.]

13. **Insights layout.**
    - Prefer **horizontal bars with "% · ₹" labels** over donuts. They are readable at phone width and stay accessible without a legend.
    - Above them: a segmented control (Week / Month / Year), the big total and its date range, and an "Expected next month" card.
    - [ReSubs Insights screenshot (bars) **[OBS]**; Tilla uses donuts with a legend **[OBS]**. The preference for bars is **[INF]**.]

14. **Dark-mode logos.** Never put a logo on a pure white tile in dark mode. Use the brand-colour tile, or a neutral surface tile with a 1 px border. Turn off icon tinting for custom logos. [Tilla needed several fixes for "white/black box" icon tinting (v2.2.2, v2.4) **[OBS]**.]

15. **Small touches.**
    - Light haptics on chip, tab and toggle changes (ReSubs v1.32 **[OBS]**).
    - A brief celebration on the first subscription added (ReSubs v1.25 **[OBS]**). This one is optional.
    - A restore or import confirmation that lists what will be overwritten (Tilla screenshot **[OBS]**).

---

## 7. Checklist status

| # | Question | Evidence needed | Status |
|---|---|---|---|
| 1 | Which 3 trackers matter for an Android user in India in 2026? | Install and rating data, availability, maintenance | **Answered.** Third-party install estimates were used because Play pages were unreadable. |
| 2 | Free-trial tracking and trial-end alerts | Help or FAQ text | **Answered** for ReSubs. **Partial** for Tilla (inferred absent). **Unresolved** for Simolation. |
| 3 | Reminder timing options | Help, FAQ or changelog | **Answered** for ReSubs and Tilla, though Tilla's choice of days ahead is unknown. **Unresolved** for Simolation. |
| 4 | Price-change history | Help or FAQ | **Answered** for ReSubs. **Partial** for Tilla (inferred absent). **Unresolved** for Simolation. |
| 5 | Calendar or timeline of upcoming charges | Help plus screenshots | **Answered** for ReSubs, Tilla and Rocket Money. **Unresolved** for Simolation. |
| 6 | Yearly vs monthly framing | Screenshots, changelog | **Answered** for ReSubs and Tilla. **Partial** for Simolation (reports exist, layout unknown). |
| 7 | Cancellation guidance | Help pages | **Answered** for ReSubs and Rocket Money. **Answered** for Tilla (link field only). **Partial** for Simolation (notes). |
| 8 | Payment-method tracking | FAQ, changelog | **Answered** for all three. |
| 9 | Per-subscription currency | FAQ, changelog | **Answered** for all three. Simolation's evidence is partly from 2020. |
| 10 | Categories and insights | FAQ, screenshots | **Answered** for ReSubs and Tilla. **Partial** for Simolation. |
| 11 | Add flow, templates and logos | FAQ, changelog, screenshots | **Answered** for ReSubs and Tilla. **Partial** for Simolation (2022 evidence). |
| 12 | Visual presentation of the list | Screenshots | **Answered** for ReSubs and Tilla (vendor screenshots viewed). **Unresolved** for Simolation (no current screenshots). |
| 13 | What users praise and complain about | Reviews, forums | **Partial.** ReSubs complaints came from its feature board, not store reviews. Tilla had few review texts. No Simolation complaint texts were found. No Reddit threads were found before the search budget ran out. |
| 14 | Android availability | Store presence | **Answered.** |
| 15 | What EIO has today | Repository | **Answered.** This corrects the brief: a yearly total already exists. |

**Unresolved, and how to close them:**
- The Google Play review texts for all three apps, especially the 1–3★ reviews behind ReSubs' 3.6 and Simolation's 3.2. Reading the Play pages in a browser would settle this.
- The Android Authority article on subscription trackers (it returned 403).
- Reddit threads, which the search budget didn't reach.
- Simolation's current UI and whether it now has templates.
- Whether Tilla lets you choose how many days ahead a reminder fires.
- Whether ReSubs supports N-day billing cycles.
- Whether an Android widget library works with Expo SDK 57 (needed for recommendation 13).

---

## Sources

**Ranking, installs and ratings (third-party snapshots)**
- androidrank: [search "subscriptions"](https://www.androidrank.org/search?q=subscriptions), [search "subscription tracker"](https://www.androidrank.org/search?q=subscription+tracker), [search "subscription manager"](https://www.androidrank.org/search?q=subscription+manager)
- androidrank app pages: [ReSubs](https://www.androidrank.org/application/resubs/app.resubs), [Tilla](https://www.androidrank.org/application/tilla/com.pavelrekun.tilla), [Simolation Subscriptions](https://www.androidrank.org/application/subscriptions/de.simolation.subscriptionmanager), [Rocket Money](https://www.androidrank.org/application/rocket_money/com.truebill), [Subby](https://www.androidrank.org/application/subby_subscription_tracker/com.slapp.subby), [SubX](https://www.androidrank.org/application/subx/com.alkapps.subx), [Feenko](https://www.androidrank.org/application/feenko/com.app.fynk)
- apppage.net listing mirrors: [ReSubs](https://apppage.net/preview/app.resubs), [Tilla](https://apppage.net/preview/com.pavelrekun.tilla), [Simolation Subscriptions](https://apppage.net/preview/de.simolation.subscriptionmanager)
- [apppricinglab: ReSubs](https://apppricinglab.com/app/google_play/app.resubs) (March 2026 snapshot)
- [Similarweb: Simolation Subscriptions](https://www.similarweb.com/app/google/de.simolation.subscriptionmanager/)
- [AlternativeTo: subscription trackers](https://alternativeto.net/feature/subscription-tracking), [AlternativeTo: Tilla](https://alternativeto.net/software/tilla/about/)

**ReSubs (vendor primary)**
- [Homepage](https://resubs.app/), [FAQ](https://resubs.app/faq) (answers read from the page's structured data), [Changelog](https://resubs.app/changelog), [Feature board](https://resubs.featurebase.app)
- [Cancellation guide example (Spotify)](https://resubs.app/resources/how-to-cancel-spotify)
- Screenshots: [1](https://resubs.app/screenshots/app-screenshot-1.webp), [2](https://resubs.app/screenshots/app-screenshot-2.webp), [3](https://resubs.app/screenshots/app-screenshot-3.webp), [4](https://resubs.app/screenshots/app-screenshot-4.webp), [5](https://resubs.app/screenshots/app-screenshot-5.webp), [6](https://resubs.app/screenshots/app-screenshot-6.webp), [7](https://resubs.app/screenshots/app-screenshot-7.webp), [8](https://resubs.app/screenshots/app-screenshot-8.webp)
- Competitor comparisons, weak evidence: [8 best trackers (self-ranked)](https://resubs.app/resources/best-subscription-tracker-apps), [ReSubs vs Tilla](https://resubs.app/resources/resubs-vs-tilla), [ReSubs vs Bobby](https://resubs.app/resources/resubs-vs-bobby), [ReSubs vs Subby](https://resubs.app/resources/resubs-vs-subby)

**Tilla (developer primary)**
- [Changelog (raw markdown)](https://pavlorekun.dev/projects/tilla/documents/changelog_release.md), rendered at [pavlorekun.dev/tilla/changelog_release](https://pavlorekun.dev/tilla/changelog_release/changelog_release/)
- [FAQ (raw markdown)](https://pavlorekun.dev/projects/tilla/documents/faq.md)
- [Project page and screenshots](https://pavlorekun.dev/tilla/), at `/projects/tilla/screenshots/1.png` to `6.png`
- [MakeUseOf, "7 Best Subscription Tracking Apps for Android" (Feb 2022)](https://www.makeuseof.com/android-subscription-manager-apps/)

**Subscriptions by Simolation**
- [paramapp.com](https://paramapp.com/) (developer site; its iOS and Canny links returned 404 on 2026-10-19)
- [kocpc review (2020, updated 2026)](https://en.kocpc.com.tw/?p=4786)

**Benchmarks**
- Rocket Money help: [international banks](https://help.rocketmoney.com/en/articles/79778-does-rocket-money-support-international-banks), [managing bills and subscriptions](https://help.rocketmoney.com/en/articles/2185531-managing-your-bills-and-subscriptions), [where to view subscriptions](https://help.rocketmoney.com/en/articles/3117398-where-can-i-view-my-subscriptions-and-bills), [third-party billed cancellations](https://help.rocketmoney.com/en/articles/4445878-how-do-i-cancel-subscriptions-that-are-billed-by-third-parties), [subscriptions collection](https://help.rocketmoney.com/en/collections/110540-managing-subscriptions-with-rocket-money)
- [Bobby on the App Store](https://apps.apple.com/us/app/bobby-track-subscriptions/id1059152023)
- [Subby on the App Store (different developer from the Play version)](https://apps.apple.com/in/app/subscription-tracker-loop/id6739703718)
- [Reviewed.com (2021, background only)](https://reviewed.com/tech/features/subscription-tracker-apps-save-you-money)

**Tried and blocked, or seen only via search summary (weak)**
- [CNBC Select, best subscription trackers](https://www.cnbc.com/select/best-subscription-trackers/) (403)
- [Android Authority article](https://androidauthority.com/p-3495371) (403)
- [XDA Tilla thread](https://xdaforums.com/t/app-5-0-tilla-subscriptions-manager.4315741/) (403)
- [AppBrain: Tilla](https://www.appbrain.com/app/tilla-subscriptions-manager/com.pavelrekun.tilla) (fetch failed)
- [Feenko on the App Store](https://apps.apple.com/de/app/feenko-subscription-manager/id6747262759) (search summary only)

**EIO repository (for §3)**
- `supabase/migrations/0004_create_finance.sql`, `0005_subscription_category.sql`, `0008_finance_v2.sql`
- `app/src/modules/subscriptions/{api.ts,notifications.ts,useSubscriptions.ts,components/SubscriptionRow.tsx,screens/SubscriptionsListScreen.tsx}`
- `website/src/pages/SubscriptionsPage.tsx`
