# Custom modules: competitor research

**Category:** no-code personal databases and build-your-own trackers
**Compared against:** EIO's module builder (`app/src/modules/custom`, migrations `0007` and `0012`)
**Date:** 19 October 2026
**Method:** public evidence only (help centres, changelogs, store listings and mirrors, reviews). Nothing was installed, decompiled, or signed up for.

### Evidence labels

| Label | Meaning |
| --- | --- |
| **OBSERVED** | Seen on the cited page. |
| **OBSERVED\*** | Seen only in a search engine's summary of the cited page, because the page itself would not load (403/404/500 or blank). Treat as lower confidence. |
| **INFERRED** | Reasoned from the evidence named next to it. |
| **UNKNOWN** | Not established. |

### Limits of this investigation

1. **Google Play pages would not load.** Every fetch of a `play.google.com` listing came back empty, and AppBrain refused the request. Install counts and ratings therefore come from third-party trackers and mirrors, and are snapshots.
2. **The web-search budget ran out partway through.** It is shared by all the agents in this session. After that, only pages whose URLs were already known could be opened. Reddit and forum opinion is the weakest part of this report as a result (see §7).
3. **No screenshots were viewed.** The visual descriptions in §2 and §6 come from help-centre text, which often describes layout precisely ("status goes on the right"). They are not based on looking at the apps.

---

## Research questions

These are the questions the brief was turned into. §7 records how far each one got.

| # | Question | Evidence needed |
| --- | --- | --- |
| Q1 | Which three tools are the leaders for personal no-code databases on Android in 2026? | Install counts and ratings, recency of updates, scope |
| Q2 | Which field types does each one offer? | Help-centre lists of field types |
| Q3 | Which views does each one offer, and which of them work on Android? | View docs, desktop-vs-mobile tables |
| Q4 | How do filters, sorts and grouping work, and are they set per view? | Help articles |
| Q5 | Are there templates for common trackers, and how do you start from one? | Template docs and galleries |
| Q6 | How fast is entry on mobile (quick-add, default values, last-used value)? | Field-settings and default-value docs |
| Q7 | What aggregates and charts are available? | Chart and aggregation docs |
| Q8 | Are there reminders, and what are they tied to? | Reminder docs |
| Q9 | How does the builder work on a phone (adding, reordering, changing a type, the effect on existing data)? | Builder and field docs, mobile limitation tables |
| Q10 | What do users praise and complain about? | Reviews, forums, Reddit |
| Q11 | Which visual and UI patterns are worth copying? | Help text describing layout |

---

## 1. Which apps, and why

| App | Android footprint | Why it is in the top 3 |
| --- | --- | --- |
| **Notion** | About 31M installs, 4.7★ from about 301K reviews, on a third-party tracker (OBSERVED\*, [apppricinglab](https://www.apppricinglab.com/developer/google_play/Notion%20Labs%2C%20Inc.)). | The default personal database most people know. It has 20+ property types and 7+ view layouts ([properties](https://www.notion.com/help/database-properties), [views](https://www.notion.com/help/views-filters-and-sorts)). It sets the expectations for views, filters and charts. |
| **Memento Database** | About 1.4M downloads, 4.42★ from 29,236 ratings, v5.8.6 updated 2026-07-04 (OBSERVED\*, [chrome-stats](https://chrome-stats.com/d/com.luckydroid.droidbase)). 5.9.1 shipped 2026-08-05 and 5.9.3 on 2026-09-17 (OBSERVED, [APKMirror](https://www.apkmirror.com/apk/mementodb-inc/memento-database/memento-database-5-9-1-release/)). | The **Android-first** personal database, and the closest match to EIO's builder. It has 30 field types ([field types](https://help.mementodatabase.com/knowledge-base/field-types/)), and you build and edit the whole library on the phone ([create from scratch](https://help.mementodatabase.com/knowledge-base/creating-a-library-from-scratch/)). It is actively maintained in 2026. |
| **Airtable** | 1M+ downloads, 4.4★ from 13.3K reviews, on an undated mirror of the Play listing (OBSERVED\*, search result). The iOS listing shows 4.8★ from 24K ([App Store](https://apps.apple.com/app/id914172636)). | The canonical no-code database. Its field types are the best designed of the three: rating, duration, barcode, checkbox, multi-select ([field types](https://support.airtable.com/docs/supported-field-types-in-airtable-overview)). It documents exactly what works on Android ([differences](https://support.airtable.com/articles/9609457174-airtable-desktop-and-mobile-feature-differences)). |

### Also studied: Track & Graph

Track & Graph is a supplement, not part of the top 3. It is an open-source Android app for logging numbers and graphing them. v10.5.1 shipped 2026-10-14 (OBSERVED, [F-Droid](https://f-droid.org/en/packages/com.samco.trackandgraph/)).

It is not a database builder, so it is not in the top 3. It is included because it is the best public evidence on two of EIO's gaps: **logging fast with default values** and **charting a number over time**. All three database apps are weak at both on a phone.

### Considered, not chosen

- **Anytype.** Its Android app gained a board view only in 0.48.9, and Android calendar support could not be confirmed (OBSERVED\*, [Anytype forum](https://community.anytype.io/t/anytype-android-0-48-9/31085)).
- **Coda and AppSheet.** Both are business app-builders, and their editors live on the desktop (INFERRED from their positioning). The search budget ran out before they could be checked.
- **HanDbase.** It is still listed, but its evidence base is thin: 2 Capterra reviews (OBSERVED\*, [Capterra](https://www.capterra.com/p/119109/HanDbase/)).

### A finding that shapes everything below

**Only Memento builds on the phone.**

- **Notion.** You can view a database page layout on mobile, but "the full builder is only on desktop or web" (OBSERVED, [Layouts](https://www.notion.com/help/layouts)). Forms can be created only on desktop and web (OBSERVED, [Forms](https://www.notion.com/help/forms)).
- **Airtable.** Creators "can't edit an interface's configuration in the mobile app", which is "only designed for end-users/contributors" (OBSERVED, [Mobile interfaces](https://support.airtable.com/docs/mobile-interfaces-in-airtable)).

EIO's builder runs entirely on the phone. That puts it in Memento's camp, which is a strength to keep (§4).

---

## 2. Per-app teardown

### 2.1 Notion

#### Features

**Property types** (OBSERVED, [Database properties](https://www.notion.com/help/database-properties)):

- Text, number, select, status, multi-select, date (single or range, optional time)
- Formula, relation, rollup
- Person, file, checkbox, URL, email, phone
- Created and edited time and by
- Button, ID, and Place (a location)

A number can be shown as currency or as a **progress bar**. A database can have up to 500 properties.

**Views** (OBSERVED, [Views, filters & sorts](https://www.notion.com/help/views-filters-and-sorts)):

- Table, board, timeline, calendar, list, gallery, and chart.
- Forms feed a database.
- A **Map** view arrived with Notion 3.0. It needs a Place property and shows up to 100 items (OBSERVED\*, [Maps help](https://www.notion.com/th/help/maps)).

**Filters, sorts and groups** (OBSERVED, [Views, filters & sorts](https://www.notion.com/help/views-filters-and-sorts)):

- These are **per view**: "Each view keeps its own settings."
- Filters can be simple, or AND/OR groups nested three levels deep.
- Sorts stack, and you rank them by dragging. Numbers sort numerically. Selects sort in the order you drag their options into.
- Group by a property, then optionally sub-group. Each group can be shown, hidden, or sorted, and empty groups can be hidden.
- Each view can show or hide properties.

**Templates** (OBSERVED, [Database templates](https://www.notion.com/help/database-templates)):

- These are templates for a *page within a database*, with **prefilled properties**. The help example sets Priority to P1 automatically.
- A template can **repeat** daily, weekly, monthly or yearly, at a chosen time.
- The public gallery has a habit-tracking category of "daily, weekly, and monthly trackers" (OBSERVED, [Templates](https://www.notion.com/templates/category/habit-tracking)).

**Entry speed:**

- A **button** with the action "Add page to" creates a database entry with set property values, in one click (OBSERVED, [Buttons](https://www.notion.com/help/buttons)).
- Whether buttons work on mobile: UNKNOWN. The help page does not say.
- Forms can be *filled* on mobile, but not created there (OBSERVED, [Forms](https://www.notion.com/help/forms)).
- There is no "last-used value" default. Values are either prefilled by a template or set by a button (INFERRED from both docs).

**Aggregates and charts** (OBSERVED, [Charts](https://www.notion.com/help/charts)):

- A chart view can be vertical bar, horizontal bar, line, donut, or a single **number**.
- The X axis is a property. The Y axis is a property or "Count", and can be split with "Group by".
- A **Cumulative** toggle is available for Count or Sum when the X axis is sorted ascending.
- Styling: palette, height, grid lines, data labels, smooth or gradient lines, and a donut centre value.
- **The free plan gets one chart.**
- Rollups across relations offer sum, average, median, min, max, range, earliest and latest date, and percent empty or not empty (OBSERVED, [Relations & rollups](https://www.notion.com/help/relations-and-rollups)).

**Reminders:**

- A date property can carry a reminder at a time offset, for example "30 minutes beforehand" (OBSERVED, [Reminders](https://www.notion.com/help/reminders)).
- Repeating templates act as a scheduled "create today's entry" (OBSERVED, [Database templates](https://www.notion.com/help/database-templates)).

#### Builder on a phone

- **Adding a property.** On desktop you click `+` next to the last column, or "Insert left/right" (OBSERVED, [Database properties](https://www.notion.com/help/database-properties)). On mobile, an unofficial Notion-hosted guide says database options are hidden in a "•••" icon next to the blue New button, and the first item edits and adds properties (OBSERVED\*, [Databases on mobile](https://runotion.notion.site/Databases-on-mobile-9848678f7910423d98df5a36d6df3238)).
- **Page layout.** Viewable on mobile, but the builder is desktop-only (OBSERVED, [Layouts](https://www.notion.com/help/layouts)). One aggregator reports that drag-to-rearrange of layouts reached mobile on 11 June 2026 (OBSERVED, [createwith](https://www.createwith.com/tool/notion/updates/notion-brings-layout-builder-to-mobile-for-database-customization)), which contradicts the help page. Current state: UNKNOWN.
- **Changing a property's type.** What happens to existing values is not documented on the properties page. UNKNOWN.
- **Mobile limits** (OBSERVED, [Notion for mobile](https://www.notion.com/help/notion-for-mobile)): "There are no columns on mobile". You cannot select multiple blocks or import data. The only Android home-screen widget the help page lists is the AI widget. Whether database widgets exist on Android: UNKNOWN. A third-party "NotiZen Widget" app exists to put Notion databases on the home screen (OBSERVED\*, search result), which suggests the gap is real (INFERRED).

#### UI and visual patterns

(OBSERVED from help text unless marked.)

- **Database page.** A header holds the page name and up to **15 pinned properties**, which scroll sideways. Below it, a *property group* can be split into **named sections**. A side **details panel** is optional. A "Tabbed" structure puts related databases on extra tabs ([Layouts](https://www.notion.com/help/layouts)).
- **Views are tabs** above the data, each with its own filter, sort and group. On small screens, "you may need to click the current view's name to reach `New view`" ([Views](https://www.notion.com/help/views-filters-and-sorts)).
- **Charts have a single-number type and a cumulative toggle.** The number type is a KPI tile, which is what EIO's home tile is ([Charts](https://www.notion.com/help/charts)).

#### Praise and complaints

- **Praise.** Notion is the breadth leader. The rating (4.7★, OBSERVED\*) and install base show it is liked widely.
- **Complaint: offline.** Offline mode came only in August 2025, and a database saves just "up to 50 rows in the first view" offline (OBSERVED, [designcompass](https://designcompass.org/en/2025/08/22/notion-offline-mode-release/)).
- **Complaint: desktop-first mobile.** Blog roundups of Reddit say mobile Notion feels desktop-first, with small buttons and slow loading, and that relation and rollup-heavy databases get slow (OBSERVED\*, [notionapps blog](https://www.notionapps.com/blog/steps-to-speed-up-of-notion-databases/)). The original threads were not verified.
- **Complaint: a market for faster entry.** Third-party "faster entry" apps exist, such as *Entry for Notion* (OBSERVED\*, [App Store](https://apps.apple.com/app/id6449053881)). INFERRED: logging into Notion from a phone is slow enough that people pay to get around it.

### 2.2 Memento Database

#### Features

**30 field types** (OBSERVED, [Field types](https://help.mementodatabase.com/knowledge-base/field-types/)):

- Text, integer, real number, currency
- Image, date, date/time, time
- Checkbox, single-choice and multiple-choice lists, radio buttons, a checkbox group
- File, **Rating** (max 10, or a lower maximum), password, phone, hyperlink, email
- **Link to Entry** (1:1, 1:many, many:many), contact, **Barcode**
- "Integer values" (pick from a range), audio, paint, **Location**
- **Calculation**, JavaScript, rich text, and **Subheader** (a visual separator)
- Duration was added in 2019 (OBSERVED, [desktop changelog](https://mementodatabase.com/download/CHANGELOG.txt))

**Defaults that matter for entry speed** (OBSERVED, [Field types](https://help.mementodatabase.com/knowledge-base/field-types/)):

- **Integer** defaults can be fixed, "from previous entry", or "incremented from previous".
- Date, date/time and time default to *now*.
- Location defaults to the current location.
- Text can **autocomplete from earlier entries**.

**Field settings** (OBSERVED, [Adding fields](https://help.mementodatabase.com/?p=691)):

- Name and **hint** (placeholder text).
- **Display as** a role: Regular, Entry name, Entry description, Entry status, or Thumbnail.
- Default value and Required.
- **Dependencies**, which show a field only when another field is set. The help example: a toggle reveals "Type of pizza".

**Six views** (OBSERVED, [Changing the view](https://help.mementodatabase.com/knowledge-base/changing-the-view/)):

| View | How it works |
| --- | --- |
| List | Grouped by one or more fields. Up to two images show as icons. Checkbox and choice fields can be **edited directly in the list**. |
| Table | Choose which columns show, resize them, long-press and drag to reorder, edit inline. |
| Cards | Set the number of columns. |
| Kanban | Columns come from a single-choice field. Drag a card to change its value. |
| Calendar | Needs a Date/Time field. A second date field or a number can set the end or duration. |
| Map | Needs a Location field. |

**Filters, sorts and groups:**

- **Filters** are named and saved. Text uses equals or contains, numbers use less or greater, and lists use allowed items. Saved filters can be reordered and **shown as tabs** at the top of the library, which the help page recommends (OBSERVED, [Filtering](https://help.mementodatabase.com/knowledge-base/filtering-data-2/)).
- **Sorts** use one or several fields, ascending or descending. The default is creation time (OBSERVED, [Sorting](https://help.mementodatabase.com/knowledge-base/sorting-data/)).
- **Grouping** uses a chosen field, and "all aggregations added to this Library will be calculated for each group" (OBSERVED, [Grouping](https://help.mementodatabase.com/knowledge-base/grouping-data-2/)).

**Templates and starting points** (OBSERVED\*, help-centre pages on [adding a library](https://help.mementodatabase.com/knowledge-base/how-to-add-a-library/), the [wizard](https://help.mementodatabase.com/knowledge-base/creating-a-library-using-a-wizard/) and the [online catalog](https://help.mementodatabase.com/knowledge-base/adding-a-library-from-online-catalog/)):

- The "Add Library" menu offers: Start from scratch, **Wizard** (the help centre recommends it for your first library), Templates, **Online catalog** (community-shared, filterable and searchable), AI Assistant, Import template, and Import from CSV.
- Templates are grouped into categories such as Personal, Collections, Business, Health & Sport, Travel, and Education.

**Autofill** (OBSERVED, [Autofill](https://help.mementodatabase.com/knowledge-base/autofill-2/), [Barcodes](https://help.mementodatabase.com/?p=407)):

- Type a title, or scan a barcode, and the entry fills from an open data source: Books, Movies, TV, Albums, Artists, or a custom source.
- Scanning a barcode with *Add* "creates it automatically".

**Aggregates and charts:**

- **Aggregation** is set up in a library tab (min, max, average, sum). With grouping on, it is computed per group (OBSERVED\*, help centre; OBSERVED, [Grouping](https://help.mementodatabase.com/knowledge-base/grouping-data-2/)).
- Charts can be pie, line, column, bar, area, or scatter.
- **Dashboards** were added in 5.3.0 (2024-04-30). They hold aggregation, chart, script, entries-list and shortcut widgets, and can pull from several libraries (OBSERVED\*, [Releases wiki](https://wiki.mementodatabase.com/index.php/Releases); OBSERVED, [Chart widget](https://help.mementodatabase.com/knowledge-base/chart-widget/)).
- The free plan limits charts, widgets, rules and scripts. Pro has "unlimited automation rules, scripts, widgets, charts" (OBSERVED, [FAQ](https://mementodatabase.com/faq.html)).

**Reminders:**

- A reminder is set **per entry**, from the entry card's menu. It shows under the entry's fields, and tapping the notification opens the entry (OBSERVED, [Reminder](https://help.mementodatabase.com/knowledge-base/reminder/)).
- Repeating reminders, and reminders tied to a date field: UNKNOWN.

**Other entry actions** (OBSERVED, [Entry actions](https://help.mementodatabase.com/?p=503)):

- **Copy**, which duplicates an entry so you only change what differs.
- A recycle bin per library.
- Favourites, comments, save as PDF, and multi-select actions.

#### Builder on a phone

(OBSERVED, [Create from scratch](https://help.mementodatabase.com/knowledge-base/creating-a-library-from-scratch/), [Adding fields](https://help.mementodatabase.com/?p=691).)

- The builder is a **tabbed editor**: Main (name, colour), Fields (`+` at the bottom right adds a field), Aggregation, and Autofill.
- "You can add or change fields and adjust other settings at any time."
- Reordering is documented only for desktop: Move Up, Move Down, and Move to Page (OBSERVED, [Desktop fields](https://help.mementodatabase.com/?p=229)). Phone reordering: UNKNOWN.
- What happens to existing values when a field changes type: **UNKNOWN**. No help page covers it.

#### UI and visual patterns

- **A list row has four named slots**: Thumbnail on the left, then Name with Description below it, then **Status on the right**. Fields with no role appear only on the card (OBSERVED\*, [Field role](https://wiki.mementodatabase.com/Field_Role.html)). This is a strong, simple pattern. The user picks which field fills which slot.
- **Saved filters shown as tabs** across the top of the library (OBSERVED, [Filtering](https://help.mementodatabase.com/knowledge-base/filtering-data-2/)).
- **Toggling in the list**: checkboxes and choices change without opening the entry (OBSERVED, [Changing the view](https://help.mementodatabase.com/knowledge-base/changing-the-view/)).
- **A Subheader field** breaks a long entry form into sections (OBSERVED, [Field types](https://help.mementodatabase.com/knowledge-base/field-types/)).
- **Visual refreshes** since 2024: themes, colourised fields, secondary thumbnails, a step-by-step entry form, and multi-column card layouts (OBSERVED, [desktop changelog](https://mementodatabase.com/download/CHANGELOG.txt)). Which of these reached Android is not stated (UNKNOWN).

#### Praise and complaints

- **Praise** (OBSERVED\*, [G2](https://www.g2.com/products/memento-database/reviews), 4.5/5 from 48 reviews): ease of use and "the ability to build custom databases".
- **Complaint: the learning curve.** Reviewers say it "can be steep for people unfamiliar with database concepts" (OBSERVED\*, [G2](https://www.g2.com/products/memento-database/reviews)).
- **Complaint: notifications.** When several reminders fall at the same moment, only one notification shows at a time (OBSERVED\*, [Google Group, Aug 2025](https://groups.google.com/g/mementodatabase/c/XqMD5heARpE/m/cekm0g7VCAAJ)).
- **INFERRED: breadth has a cost.** Thirty field types, scripting, SQL, AI credits and team permissions make it powerful, and also the reason for the "steep" complaint. EIO should not chase that breadth.

### 2.3 Airtable

#### Features

**Field types** (OBSERVED, [Supported field types](https://support.airtable.com/docs/supported-field-types-in-airtable-overview)):

- Attachment, autonumber, **barcode** (scanned with the phone camera), button, **checkbox**, count
- Created and modified time and by, currency, date & time, **duration** (h/m/s/ms), email
- Formula, last-modified, linked record, long text, lookup, **multiple select**
- Number, percent, phone, **rating**, rollup, single line text, single select, URL, user
- The phone field formats "a 10-digit string of numbers" as a US/Canada number. This matters for an India-based user.

**Default values** (OBSERVED, [Field type overview](https://support.airtable.com/docs/field-type-overview)):

- They "appear only when new records are created", so changing a default does not rewrite old records.
- They are supported on checkbox, currency, date, single select and others. They are not available on the primary field, attachments, formulas, or lookups.

**Rating field.** A yellow star by default. Changing the symbol is a paid feature (OBSERVED, [Rating field](https://support.airtable.com/docs/rating-field)). The maximum is not stated on that page (UNKNOWN).

**On Android** (OBSERVED, [Desktop vs mobile](https://support.airtable.com/articles/9609457174-airtable-desktop-and-mobile-feature-differences)):

| Area | Android support |
| --- | --- |
| Views | Grid, Gallery, Kanban and Calendar work. Timeline and Gantt do not. |
| Forms | Cannot be created or viewed in the app. |
| Filtering, sorting, grouping | Quick filters, date quick filters, search, and end-user sorting work. End-user filtering and grouping do not. |
| Fields | Formula, rollup, count and lookup are **view only**. **Duration is not supported.** |
| Automations | Not supported. |

**Interfaces on Android phones** (OBSERVED, [Mobile interfaces](https://support.airtable.com/docs/mobile-interfaces-in-airtable)):

- These are "full-screen pages" of list, gallery, calendar, kanban, grid, form, overview, and dashboard.
- They have search, **dropdown and tab filters**, and buttons that update fields or open a record-creation form.

**Templates** (OBSERVED, [Templates](https://www.airtable.com/templates)):

- A "Personal" category includes Book catalog, Personal CRM, Apartment hunting, and Job hunting.
- No habit, workout or home-inventory template was visible.

**Free plan.** Record and attachment caps exist. When you reach one, "you can't add more records" until you upgrade. Figures are not on the page (OBSERVED, [Pricing](https://www.airtable.com/pricing)).

#### Builder on a phone

- **No official article covers adding or editing a field in the mobile app.** The field docs list web, Mac and Windows only (OBSERVED\*, [Field type overview](https://support.airtable.com/docs/field-type-overview)).
- Interface configuration is explicitly not possible in the app (OBSERVED, [Mobile interfaces](https://support.airtable.com/docs/mobile-interfaces-in-airtable)).
- INFERRED: Airtable expects you to design on a computer and use the phone to enter data.

**Changing a field's type** (OBSERVED, [Customizing the field type](https://support.airtable.com/docs/customizing-the-field-type)):

- Airtable "works to convert those current cell values to the new type". It is **best-effort and can be lossy**: text changed to an attachment "clears" the values.
- Things that depend on the field survive, because the field's identity is kept. That covers lookups, rollups, filters, automations, and interface elements.
- A community moderator notes that the editor shows a data-loss warning and that Ctrl+Z can undo it (OBSERVED\*, [Airtable community](https://community.airtable.com/t/error-message-when-linking-tables/32078)).

#### UI and visual patterns

- **Tab filters**: a row of preset filters at the top of a mobile interface (OBSERVED, [Mobile interfaces](https://support.airtable.com/docs/mobile-interfaces-in-airtable)). This is the same idea as Memento's filters as tabs.
- **Button to form**: a prominent button opens a short creation form instead of the full record (OBSERVED, same page).
- **A field description** appears as help text under the field label (OBSERVED, [Field type overview](https://support.airtable.com/docs/field-type-overview)).

#### Praise and complaints

- **Praise**: 4.8★ from 24K on iOS (OBSERVED, [App Store](https://apps.apple.com/app/id914172636)).
- **Complaint: scale on Android.** The Android app "may become slow or fail to load properly" with tens of thousands of records (OBSERVED\*, Airtable differences page via search).
- **INFERRED: a poor fit for one person on Android.** Builders can't build on Android, Duration can't be used there, and the free plan caps records. Airtable is the reference for *field design*, not for a phone-only workflow.

### 2.4 Supplement: Track & Graph (logging and graphing)

**Fast logging** (OBSERVED, [Tracking tutorial](https://samamco.github.io/track-and-graph/tutorial/tracking/)):

- **Default value.** "When one is set, tapping + skips the value prompt and logs the default at the current time." Long-pressing + opens the full input.
- **Label chips.** Previously used labels appear as suggestion buttons. Tapping one fills the label, and long-pressing one logs immediately.
- **Lock icon.** A lock on an input field keeps its contents after each entry, so you can log several points in a row.
- **Durations** are entered as h:m:s, stored as total seconds, and can be timed with a built-in timer.
- **Group quick-track.** A quick-track button logs every tracker in a group at once, carrying the chosen date and time over to each.

**Line graphs** (OBSERVED, [Line graphs](https://samamco.github.io/track-and-graph/tutorial/graphs/line/)):

- Window controls: "Sample size" and "Sample ending at", which defaults to the latest point.
- **Plot totals**: "Plot when tracked", or daily, weekly or monthly totals.
- **Averaging period**: a moving average, applied after the totals.
- Several lines per graph, each with its own colour and style.

**Other graph types:** pie charts, statistics, time histograms, and bar charts (OBSERVED, [docs index](https://samamco.github.io/track-and-graph/)).

**Reminders** can be switched on or off without deleting them (10.2.0) (OBSERVED\*, [F-Droid](https://f-droid.org/en/packages/com.samco.trackandgraph/)). Home-screen widgets: UNKNOWN.

---

## 3. What EIO already has

The builder works entirely on the phone. A module has a name, an icon from 20 curated choices, a colour from 8 theme accents, and an ordered list of fields. There are seven field types: text, long text, number, money (₹, stored as paise), date, yes/no, and single choice. Each field has a required flag.

**Records** are jsonb keyed by a key that is frozen when the field is created, so renaming a field never orphans data. Deleting a field keeps the stored values, and re-adding a field with the same name brings them back. Leftover values from a type change are handled tolerantly: number-like strings still count. The field-type list is CHECK-constrained in `user_module_fields` (migration `0007`).

**The home tile** shows one statistic. It is limited to combinations that make sense: sum, average, count, or latest, with a silent fallback to count. The module has a saved sort field and direction, applied in the app so numbers sort numerically, with blanks last. Each list row's title is the first text field and its subtitle the first date field.

**On the website**, columns can be sorted per visit.

**Already in the app** and reusable: `expo-notifications` (Subscriptions reminders), `react-native-chart-kit` (Finance `TrendChart`), and a filter-sheet pattern (`bucket/components/FilterSheet.tsx`).

---

## 4. Gap analysis

### 4.1 What the leaders share that EIO lacks

| Capability | Notion | Memento | Airtable | Track & Graph | EIO |
| --- | --- | --- | --- | --- | --- |
| Default value per field | template prefill | ✔ fixed, today, **previous entry**, incremented | ✔ new records only | ✔ one-tap log | ✗ |
| Rating field | ✗ (number as bar) | ✔ max 10 | ✔ star | ✗ | ✗ |
| Multi-select | ✔ | ✔ | ✔ | (labels) | ✗ |
| Duration / time | (date+time) | ✔ duration, time | ✔ (not on Android) | ✔ timer | ✗ |
| Checkbox toggled in the list | (table cell) | ✔ "direct edit" | (grid cell) | n/a | ✗ (opens form) |
| Photo / image | ✔ files | ✔ image + thumbnail | ✔ attachment | ✗ | ✗ |
| Location | ✔ place + map | ✔ location + map | ✗ | ✗ | ✗ |
| Barcode + autofill | ✗ | ✔ (books, films…) | ✔ scan | ✗ | ✗ |
| Formula / calculation | ✔ | ✔ | ✔ | ✔ Lua functions | ✗ |
| Relations between modules | ✔ + rollup | ✔ link to entry | ✔ + lookup/rollup | ✗ | ✗ |
| Views beyond a list | 8 layouts | 6 views | 4 on Android | graphs | list only |
| Calendar view | ✔ | ✔ | ✔ | ✗ | ✗ |
| Filters | ✔ per view, nested | ✔ saved, **as tabs** | ✔ quick and tab filters | n/a | ✗ (phone) |
| Group by + per-group totals | ✔ group | ✔ aggregates per group | grouping not on Android | groups of trackers | ✗ |
| Chart of a number over time | ✔ line/bar, cumulative | ✔ line/column/area | ✔ interface charts | ✔ totals, moving avg | ✗ (tile number only) |
| Templates for trackers | ✔ gallery | ✔ wizard + templates + catalog | ✔ (few personal) | n/a | ✗ |
| Reminders | ✔ on date property | ✔ per entry | (automations, not on Android) | ✔ | ✗ |
| Duplicate an entry | ✔ | ✔ "Copy" | ✔ | n/a | ✗ |
| Field hint / description | ✔ | ✔ hint | ✔ description | ✔ description | ✗ |
| Choose which field shows where in a row | per-view property visibility | ✔ name/description/status/thumbnail | per view | n/a | automatic only |

The "✔" marks are OBSERVED from the §2 citations. Cells in parentheses are partial or INFERRED.

### 4.2 What EIO already does better

1. **The builder is on the phone, and simple.** Notion's layout builder and form builder are desktop-only (OBSERVED), and Airtable creators cannot configure on Android (OBSERVED). Memento has the same capability, but its 30 types and tabs draw a "steep" learning-curve complaint (OBSERVED\*). EIO's seven types with icon and hint chips are a better on-ramp. Keep the count of field types small.
2. **Edits never destroy data.** Airtable's type conversion is "best-effort" and can clear values (OBSERVED). EIO keeps every value in jsonb under a frozen key: deleting and re-adding a field restores them, and a type change only changes how values are read. No competitor documents a guarantee this strong (INFERRED from the absence of such a guarantee in their docs).
3. **The tile statistic only offers sensible choices.** It refuses combinations that would give NaN and falls back gracefully. Notion's free plan allows one chart, and Memento's free plan limits charts and widgets (OBSERVED). EIO's tile has no paywall and is already on the home screen. Notion's Android help lists only an AI widget.
4. **Sorting is correct** (numbers sort numerically, blanks go last) and money is native to India (₹ stored as paise). Airtable's phone field assumes a US 10-digit format (OBSERVED).
5. **No limits.** There are no record caps (Airtable has them, OBSERVED), no 50-row offline cut-off (Notion, OBSERVED), and no AI credits (Memento, OBSERVED in its changelog).

---

## 5. Recommendations

The guiding rule follows EIO's own user guide: *"Use the builder when it just needs to remember."* Each item makes remembering faster or more useful to look back on, without turning EIO into a database IDE.

**Dropped as out of scope for one person:** collaboration, sharing, permissions, public forms, team sync, AI credits, scripting, SQL, automations, the community template catalog, and paywalls.

### TOP 5

| # | Recommendation | What it is | Why it matters for one person | Apps that have it | Effort | DB change? |
| --- | --- | --- | --- | --- | --- | --- |
| **1** | **Quick log with defaults** | Each field gets a default mode: *none*, *fixed value*, *today/now* (dates), or **same as last entry**. If every required field has a default, a `+` on the module screen (and optionally on the home tile) logs an entry at once and shows an Undo toast. Long-press `+` opens the full form. | Most entries in a personal tracker repeat the last one: same book, similar hours of sleep, same plant. One tap instead of a form is the difference between logging every day and giving up. | Memento (fixed, previous entry, incremented, today), Track & Graph (one-tap default, long-press for full), Airtable (defaults on new records), Notion (prefilled template properties) | **S–M** | **Yes.** Add `default_mode text` and `default_value jsonb` to `user_module_fields`. "Last entry" needs no storage, because it reads the newest record. |
| **2** | **Trend chart for a number field** | On the module screen, a line or bar chart of one number or money field over time. The X axis is the first date field, falling back to `created_at`. Choose a bucket (as logged / day / week / month), an aggregate (sum or average), and an optional 7-entry moving average and cumulative toggle. Auto-configured, adjustable in the builder. Also a sparkline on the home tile. | "Am I sleeping more this month?" is the reason to keep a log at all. Today EIO can only answer with one number. | Notion chart (line/bar, cumulative), Memento charts and dashboards, Track & Graph (daily/weekly totals, moving average), Airtable interface charts | **M** (`react-native-chart-kit` is already used by Finance) | **Optional.** Works with no change using defaults. To save the choice, add `chart_field_key`, `chart_bucket` and `chart_agg` to `user_modules`, mirroring `summary_*`. |
| **3** | **Three new field types plus tap-to-toggle** | **Rating** (1–5 stars, or up to 10). **Multi-select** (chips; stored as a JSON array). **Duration** (h:m entry; stored as minutes or seconds; sums and averages like a number). Also make **yes/no tappable in the list row**, so a boolean works as a daily check-off. | Rating covers books, films and restaurants. Multi-select covers tags such as genres or symptoms. Duration covers sleep, reading and practice. All three are sums or averages people want, and today they get faked with number or text fields. Toggling in the list makes habit-style modules practical. | Rating: Memento, Airtable. Multi-select: all three. Duration: Memento, Airtable, Track & Graph. List toggle: Memento "direct edit". | **S–M** each | **Yes.** Widen the `type` CHECK constraint in a new migration. Values fit the existing jsonb. `aggsForFieldType` gains rating and duration as numeric. |
| **4** | **Filter chips and group-by with per-group totals** | A horizontal chip row above the list, built automatically from the module's choice, yes/no and multi-select fields (for example *All · To read · Reading · Done*), plus a date range (*This week / This month / All*). An optional **Group by** a choice field, with each group header showing its count and the module's statistic, for example "Reading · 3 · 412 pages". | Personal lists split in two: to-do vs done, or by category. Without filters, a 200-book list is one long scroll. Group totals answer "how much per category" without a chart. | Memento (saved filters **as tabs**, aggregates per group), Airtable (tab and quick filters), Notion (per-view filter and group) | **M** (reuse the B-List `FilterSheet` pattern) | **No** for chips that are not saved. **Small** if the last-used filter or group is remembered per module (`group_field_key` on `user_modules`). |
| **5** | **Module reminders** | Two kinds. (a) A **daily or weekly nudge** per module at a set time ("Log sleep · 8:30 am"), skipped if an entry already exists for that day. (b) **Date-field reminders**: notify on, or N days before, the date in a chosen date field ("Water plants", "Return library book"). Tapping the notification opens the quick-log form or the record. | A personal log is only as good as its consistency, and a nudge is the cheapest fix. Date-field reminders turn trackers like plants or warranties into something that works for you. | Notion (date reminders, repeating templates), Memento (per-entry reminders), Track & Graph (reminders with an on/off switch) | **M** (`expo-notifications` is already used by Subscriptions) | **Yes.** Add `reminder_time`, `reminder_days` and `reminder_field_key`/`reminder_offset_days` to `user_modules`. Schedule on the device, as Subscriptions does. |

### Next tier (worth doing after the top 5)

| # | Recommendation | What it is | Why for one person | Apps | Effort | DB change? |
| --- | --- | --- | --- | --- | --- | --- |
| 6 | **Starter templates** | "Start from a template" at the top of the builder: Books, Sleep log, Plants, Films, Habits, Weight, Expenses-by-trip. Each prefills fields, the tile stat, sort, chart and reminder, and stays fully editable before saving. | Shows the best way to use the new types and charts, and saves building the same Sleep log by hand. | Memento (wizard, templates by category), Notion (gallery), Airtable (Book catalog) | **S** | **No.** Ship as JSON in app code. |
| 7 | **Row layout roles** | In the builder, choose a **Title**, a **Subtitle** and a **Badge** (right-aligned: a rating, a number with units, or a status chip), instead of the automatic first-text and first-date rule. | Lets a Books list show "★★★★ · Done" at a glance. This is the most visible improvement for the least code. | Memento (name, description, status, thumbnail roles) | **S** | **Yes, small.** `title_field_key`, `subtitle_field_key` and `badge_field_key` on `user_modules`. |
| 8 | **Calendar view** | A month grid with dots on days that have entries. Tap a day to see its entries. Available when the module has a date field. Toggle List / Calendar in the header. | Shows streaks and gaps for sleep, workouts or mood. Easier to scan than a list when frequency matters. | All three, plus Memento's requirement of a date field | **M** | **Small.** `default_view` on `user_modules` (or remember it locally). |
| 9 | **Tile statistic by period** | Let the tile statistic cover *this week*, *this month* or *all time* ("₹4,200 this month", "6.8 h avg this week"), with a sparkline from #2. | All-time totals stop meaning anything after a few months. A period makes the home tile useful every day. | Notion number chart plus filters, Memento dashboard aggregation widgets | **S** | **Yes, small.** `summary_period` on `user_modules`. |
| 10 | **Duplicate entry** and **field hints** | "Duplicate" in the record menu. An optional hint under each field label ("pages read today, not total"). | Duplicating is the manual version of #1 for complex entries. Hints keep a module made months ago usable. | Memento (Copy, hint), Airtable (description), Notion | **S** | Hints: **yes**, a `hint text` column. Duplicate: no. |
| 11 | **A guard when changing a field's type** | When an existing field's type changes, show "14 entries have a value here, 3 won't display as Number. They're kept and come back if you switch back." | Builds on EIO's no-data-loss promise by making it visible. Airtable warns but can still lose data. | Airtable (warning and best-effort conversion) | **S** | No |
| 12 | **Drag to reorder fields, and a Section divider** | Long-press and drag to reorder fields in the builder. A "Section" pseudo-type adds a heading to long forms. | Field order is the form order. Long modules need structure. | Memento (Subheader type, move up/down), Notion (named property sections) | **S** | Section: **yes** (one more allowed type, no stored value). Reorder: no (`position` already exists). |

### Later, or only if a real need appears

- **Photo field and a Cards view** (Notion, Memento, Airtable). High delight for plants, collections and recipes, but it needs a Supabase Storage bucket, uploads, image caching, and a new dependency (`expo-image-picker` is not installed). Effort **L**. DB/storage change: **yes**.
- **A small set of computed fields.** For example, "difference between two times" (sleep from bedtime and wake time) or "A ÷ B". These are fixed templates, not a formula language. Notion, Memento and Airtable all have full formulas. Effort **M–L**. DB change: yes, a config jsonb.
- **ISBN scan and autofill for a Books module** (Memento). A delightful special case, but external APIs and a camera dependency make it effort **L**.

### Not recommended

- **Relations and rollups between modules.** Effort **L**. For one person, a text or choice field almost always does the job. This is exactly the step that turns a tracker into Notion.
- **A formula language, scripting, automations, an AI assistant, public forms, sharing, team sync, the community catalog, and kanban drag on a phone.** All of these are outside the brief.

---

## 6. UI/UX patterns worth adopting

Each pattern is written to be buildable without seeing the source apps.

1. **The `+` that logs at once** (Track & Graph, Memento defaults).
   - The module screen's floating `+` reads: *tap* to log with defaults, *long-press* for the full form.
   - After a tap, show a bottom toast for 4 seconds, such as "Logged · 7 h 30 m · Undo".
   - If any required field has no default, the tap opens the form with the cursor in the first empty required field.
   - The same rule applies to an optional `+` badge on the home tile.
2. **"Same as last time" as a visible state, not hidden magic.**
   - In the entry form, fields filled from the last entry show a small "↺ last" tag in muted text at the right of the input. Typing clears the tag.
   - In the builder, the default selector for each field is a segmented control: *None · Fixed · Today · Last entry*. *Today* is offered only for date fields.
3. **Recent-value chips** (Track & Graph labels, Memento autocomplete).
   - Under a text or choice input, show the 5 most recent distinct values as chips. Tapping a chip fills the field.
   - For number fields, show the last 3 values.
4. **The lock pin** (Track & Graph). A pin icon on a field in the form keeps its value for the next "Save & add another". It suits batch logging, such as entering a week of missed sleep.
5. **The row anatomy** (Memento roles).
   - Left: the module-colour dot (or a thumbnail later).
   - Centre: the **Title** in body weight, with the **Subtitle** below it in muted, smaller text.
   - Right: the **Badge**, right-aligned. A rating shows as 5 small stars filled in the module colour. A number shows with its unit, for example "7.5 h". A choice shows as a pill tinted at about 15% of the module colour. A yes/no shows as a tappable circle-check.
   - Tapping the badge on a yes/no or rating edits it in place with haptic feedback. Tapping elsewhere opens the record.
6. **The filter chip row** (Memento filters as tabs, Airtable tab filters).
   - A horizontally scrolling row directly under the header, with **All** first.
   - Next come the options of the module's first choice field, then "This week" and "This month" if the module has a date.
   - The active chip is filled with the module colour, and the others are outlined.
   - The subtitle switches to "12 of 40", matching the website's existing filter convention in the user guide.
7. **Group headers that carry totals** (Memento aggregation per group).
   - A sticky header shows the group name on the left and "count · statistic" on the right, in tabular numerals.
   - Groups collapse on tap.
   - Empty groups are hidden by default, as in Notion's "hide empty groups".
8. **The trend card above the list** (Notion chart styling, Track & Graph totals).
   - A card about 160 dp tall with a single line in the module colour and a soft gradient fill underneath. Axis labels are minimal: first date, last date, and min and max on the Y axis.
   - Above the chart, a segmented control: *Week · Month · Year · All*.
   - A small "Σ / avg" toggle sits at the right.
   - Tapping a point shows that bucket's value.
   - If the module has no number field, the card does not render. Do not show an empty chart.
   - Offer "Cumulative" only with Sum, as Notion does.
9. **Views as a header toggle, not a menu.** On mobile Notion, the views live behind the current view's name (OBSERVED). For EIO's two or three views, use a compact icon segmented control in the header (list / calendar), and remember the choice per module.
10. **A calendar month grid.** Show a dot per day that has entries, using the module colour, with opacity scaled by count or value. Selecting a day expands that day's rows inline below the grid; do not navigate away.
11. **Template picker as the first builder step** (Memento wizard and template categories).
    - A 2-column grid of template cards. Each card shows the module icon in its colour, a name, and a one-line field preview ("Title · Author · Rating · Finished on").
    - The last card is "Blank".
    - Choosing a template fills the builder rather than saving straight away, so the user reviews it first.
12. **The type-change confirmation** (Airtable warns, and EIO can do better).
    - When a saved field's type changes, show a sheet with: a count of affected entries, a preview of 3 values as they will display, and the promise "Nothing is deleted. Switch back any time."
    - Buttons: *Change type* and *Cancel*.
13. **The field-type picker grows without becoming Memento.** Keep the current icon, label and hint chip grid. Add Rating ("Stars, 1–5"), Tags ("Pick several"), Duration ("Hours and minutes") and Section ("A heading in the form"). Keep the total under 12.
14. **Reminder setup in the builder.** One row: "Remind me" switch, then time, then a weekday picker of seven circular day toggles. A second, optional row: "Remind on [date field] · [same day / 1 day before]". Use the same notification copy style as Subscriptions.

---

## 7. Checklist status

| # | Question | Status | Notes |
| --- | --- | --- | --- |
| Q1 | Top 3 on Android | **Partial** | The choice is well-founded. Install and rating figures come from third-party snapshots (OBSERVED\*), because Play pages would not load. Coda and AppSheet were not checked before the search budget ran out. |
| Q2 | Field types | **Answered** | Official lists for all three. |
| Q3 | Views (and Android support) | **Answered** | Airtable's Android support table is explicit. Notion's Map view is OBSERVED\*. |
| Q4 | Filters, sorts, groups per view | **Answered** | Notion and Memento in detail. Airtable's Android limits are documented. |
| Q5 | Templates | **Answered** | Memento's flow is partly OBSERVED\*. |
| Q6 | Entry speed (quick-add, defaults, last-used) | **Answered** | Memento "from previous entry", Airtable defaults, Track & Graph one-tap. Whether Notion buttons work on mobile is UNKNOWN. |
| Q7 | Aggregates and charts | **Answered** | Notion charts in detail. Memento chart settings are described only as "same as the library" (partial). |
| Q8 | Reminders | **Partial** | Notion's offset presets are not listed. For Memento, recurring reminders and reminders tied to date fields are UNKNOWN. Track & Graph's reminder details come from a changelog only. |
| Q9 | Builder on a phone, type changes, existing data | **Partial** | Memento builds on the phone (OBSERVED). Notion and Airtable builders are desktop-first (OBSERVED). Data handling on type change is documented only for Airtable. **UNKNOWN for Notion and Memento.** Reordering fields on the phone is UNKNOWN for all three. |
| Q10 | Praise and complaints | **Partial; weakest area** | Mostly G2 summaries, blog roundups and one forum thread. **No Reddit threads were read directly.** The search budget ran out before targeted Reddit searches. |
| Q11 | Visual and UI patterns | **Partial** | Built from help-text layout descriptions. No screenshots were viewed. Visual specifics in §6 are EIO proposals informed by those descriptions, not copies. |

**Unresolved and worth a follow-up if needed:**

1. Live Play Store ratings and recent "What's new" text for all three apps.
2. Reddit opinion on Memento's and Notion's Android entry speed.
3. Whether Notion has Android database widgets.
4. Whether Memento can repeat reminders or tie them to a date field.
5. What Notion and Memento do to existing values when a field's type changes.

---

## Sources

**Notion**

- Database properties: https://www.notion.com/help/database-properties
- Views, filters, sorts & groups: https://www.notion.com/help/views-filters-and-sorts
- Database templates: https://www.notion.com/help/database-templates
- Charts: https://www.notion.com/help/charts
- Reminders: https://www.notion.com/help/reminders
- Notion for mobile: https://www.notion.com/help/notion-for-mobile
- Forms: https://www.notion.com/help/forms
- Layouts: https://www.notion.com/help/layouts
- Buttons: https://www.notion.com/help/buttons
- Relations & rollups: https://www.notion.com/help/relations-and-rollups
- Maps (OBSERVED\*): https://www.notion.com/th/help/maps
- Habit-tracking templates: https://www.notion.com/templates/category/habit-tracking
- Layout builder on mobile, 11 June 2026 (aggregator): https://www.createwith.com/tool/notion/updates/notion-brings-layout-builder-to-mobile-for-database-customization
- Offline mode, 50-row cap: https://designcompass.org/en/2025/08/22/notion-offline-mode-release/
- Unofficial mobile database guide (OBSERVED\*): https://runotion.notion.site/Databases-on-mobile-9848678f7910423d98df5a36d6df3238
- Speed complaints roundup (OBSERVED\*): https://www.notionapps.com/blog/steps-to-speed-up-of-notion-databases/
- Entry for Notion, third-party (OBSERVED\*): https://apps.apple.com/app/id6449053881
- Install and rating snapshot (OBSERVED\*): https://www.apppricinglab.com/developer/google_play/Notion%20Labs%2C%20Inc.

**Memento Database**

- Home: https://mementodatabase.com/
- FAQ: https://mementodatabase.com/faq.html
- Field types: https://help.mementodatabase.com/knowledge-base/field-types/
- Changing the view: https://help.mementodatabase.com/knowledge-base/changing-the-view/
- Creating a library from scratch: https://help.mementodatabase.com/knowledge-base/creating-a-library-from-scratch/
- Adding fields (field settings): https://help.mementodatabase.com/?p=691
- Fields, desktop: https://help.mementodatabase.com/?p=229
- Field role (OBSERVED\*): https://wiki.mementodatabase.com/Field_Role.html
- Filtering: https://help.mementodatabase.com/knowledge-base/filtering-data-2/
- Sorting: https://help.mementodatabase.com/knowledge-base/sorting-data/
- Grouping: https://help.mementodatabase.com/knowledge-base/grouping-data-2/
- Chart widget: https://help.mementodatabase.com/knowledge-base/chart-widget/
- Reminder: https://help.mementodatabase.com/knowledge-base/reminder/
- Autofill: https://help.mementodatabase.com/knowledge-base/autofill-2/
- Barcodes: https://help.mementodatabase.com/?p=407
- Entry actions: https://help.mementodatabase.com/?p=503
- Add a library, wizard and online catalog (OBSERVED\*):
  - https://help.mementodatabase.com/knowledge-base/how-to-add-a-library/
  - https://help.mementodatabase.com/knowledge-base/creating-a-library-using-a-wizard/
  - https://help.mementodatabase.com/knowledge-base/adding-a-library-from-online-catalog/
- Desktop changelog: https://mementodatabase.com/download/CHANGELOG.txt
- Android releases wiki (OBSERVED\*): https://wiki.mementodatabase.com/index.php/Releases
- 5.9.1 release notes: https://www.apkmirror.com/apk/mementodb-inc/memento-database/memento-database-5-9-1-release/
- Play statistics snapshot (OBSERVED\*): https://chrome-stats.com/d/com.luckydroid.droidbase
- G2 reviews (OBSERVED\*): https://www.g2.com/products/memento-database/reviews
- Reminder notification thread (OBSERVED\*): https://groups.google.com/g/mementodatabase/c/XqMD5heARpE/m/cekm0g7VCAAJ

**Airtable**

- Supported field types: https://support.airtable.com/docs/supported-field-types-in-airtable-overview
- Field type overview: https://support.airtable.com/docs/field-type-overview
- Customizing the field type: https://support.airtable.com/docs/customizing-the-field-type
- Desktop vs mobile differences: https://support.airtable.com/articles/9609457174-airtable-desktop-and-mobile-feature-differences
- Mobile interfaces: https://support.airtable.com/docs/mobile-interfaces-in-airtable
- Rating field: https://support.airtable.com/docs/rating-field
- Pricing: https://www.airtable.com/pricing
- Templates: https://www.airtable.com/templates
- iOS listing: https://apps.apple.com/app/id914172636
- Community thread on type-change warning (OBSERVED\*): https://community.airtable.com/t/error-message-when-linking-tables/32078

**Track & Graph**

- F-Droid: https://f-droid.org/en/packages/com.samco.trackandgraph/
- IzzyOnDroid: https://apt.izzysoft.de/fdroid/index/apk/com.samco.trackandgraph
- Docs: https://samamco.github.io/track-and-graph/
- Tracking tutorial: https://samamco.github.io/track-and-graph/tutorial/tracking/
- Line graphs: https://samamco.github.io/track-and-graph/tutorial/graphs/line/
- Source: https://github.com/SamAmco/track-and-graph

**Other**

- Anytype Android 0.48.9 (OBSERVED\*): https://community.anytype.io/t/anytype-android-0-48-9/31085
- HanDbase on Capterra (OBSERVED\*): https://www.capterra.com/p/119109/HanDbase/

**EIO, read for comparison only, not modified**

- `app/src/modules/custom/types.ts`
- `app/src/modules/custom/summary.ts`
- `app/src/modules/custom/screens/ModuleBuilderScreen.tsx`
- `supabase/migrations/0007_create_custom_modules.sql`
- `docs/USER-GUIDE.md` §"Your own modules"
