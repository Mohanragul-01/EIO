# Notes, checklists and journaling: what the leading apps do that EIO's Notes doesn't

Research date: 19 October 2026. Scope: the EIO Notes module (note, checklist, journal), on the Android app and the website.
Method: public evidence only, meaning official help centres, release notes, vendor feature pages, reputable reviews, and forum or community posts. No app was installed, decompiled or signed into.

**Evidence labels used throughout**

- **OBSERVED**: seen in the cited source.
- **INFERRED**: reasoned from evidence. The basis is stated.
- **UNKNOWN**: not established by any source I could reach.

Help-centre pages count as strong evidence for how a feature behaves. Roundup listicles count only as weak evidence for "which apps are top".

**Limitation:** the shared web-search budget ran out partway through, before the Day One streak rules and direct Reddit sampling were covered. After that point I fetched official pages by known URL only. User sentiment comes from community forums, review aggregators and search-result excerpts of Reddit and Samsung Community threads, not from a systematic Reddit sample. Section 7 lists what this leaves open.

### Research checklist (set before searching)

| # | Question | Evidence needed |
|---|---|---|
| Q1 | Which 3 notes apps lead on Android in 2026? | Play install ranges and ratings (third-party trackers), 2024–2026 roundups |
| Q2 | Which single journaling app leads? | Same, plus depth of documented journal features |
| Q3 | Capture speed: widgets, share-to, voice, FAB | Help centres, release notes |
| Q4 | Formatting: rich text or markdown, checkboxes inside notes | Help centres |
| Q5 | Organisation: labels vs folders vs links | Help centres |
| Q6 | Pin, colour, archive, trash and undo | Help centres |
| Q7 | Reminders on notes | Help centres |
| Q8 | Search and filters | Help centres |
| Q9 | Reusable checklists such as a shopping list | Help centres, user write-ups |
| Q10 | Note-card layout: grid vs list, previews | Help centres, reviews, screenshots described in articles |
| Q11 | Journal: prompts, mood, streaks, On This Day, templates | Journal app guides and release notes |
| Q12 | What users praise and complain about | Reviews, forums, Reddit |
| Q13 | Empty states and navigation | Help centres, design-change coverage |

---

## 1. Which apps, and why

### Candidates: Android reach and rating

These figures come from AndroidRank, a third-party tracker, fetched 19 Oct 2026. "Installs" is the Play Store bracket reached. The tracker's own estimate is in brackets.

| App | Installs | Rating | No. of ratings | Source |
|---|---|---|---|---|
| Samsung Notes | 1B+ (est. 5B) | 4.78 | 15.2M | [androidrank](https://www.androidrank.org/application/samsung_notes/com.samsung.android.app.notes) |
| Google Keep | 1B+ (est. 2.5B) | 4.7 | 2.6M | [androidrank](https://www.androidrank.org/application/google_keep_notes_and_lists/com.google.android.keep) |
| Microsoft OneNote | 1B+ (est. 1.1B) | 4.55 | 1.5M | [androidrank](https://www.androidrank.org/application/onenote/com.microsoft.office.onenote) |
| ColorNote | 100M+ | 4.88 | 4.0M | [androidrank](https://www.androidrank.org/application/colornote/com.socialnmobile.dictapps.notepad.color.note) |
| Evernote | 100M+ | 3.48 | 1.8M | [androidrank](https://www.androidrank.org/application/evernote/com.evernote) |
| Notion | 10M+ (est. 50M) | 4.61 | 396K | [androidrank](https://www.androidrank.org/application/notion/notion.id) |
| Obsidian | 5M+ | 4.32 | 18.7K | [androidrank](https://www.androidrank.org/application/obsidian/md.obsidian) |
| *Journaling* | | | | |
| Daylio (mood-first micro-diary) | 10M+ | 4.73 | 463K | [androidrank](https://www.androidrank.org/application/daylio/net.daylio) |
| Journey | 5M+ | 4.26 | 94K | [androidrank](https://www.androidrank.org/application/journey/com.journey.app) |
| Day One | 1M+ | 4.62 | 28K | [androidrank](https://www.androidrank.org/application/day_one/com.dayoneapp.dayone) |

Zapier's Android notes list, last updated Dec 2024, recommends Keep ("day-to-day"), OneNote ("best overall") and Notion ("managing your life") (OBSERVED, [Zapier](https://zapier.com/blog/best-note-app-for-android/)). Android Police frames its own list as alternatives to Keep, which places Keep as the baseline (OBSERVED via the syndicated copy, [Yahoo/Android Police](https://tech.yahoo.com/general/articles/google-keep-missing-6-basic-163023640.html)).

### Chosen

1. **Google Keep.** It has 1B+ installs and a 4.7 rating, appears on every roundup checked, and is the baseline reviewers compare against. It is also EIO's closest analogue: quick notes and checklists, labels rather than folders, colours, pins, reminders. It is the most directly instructive of the four.
2. **Samsung Notes.** It has the largest rating base of any Android notes app (15.2M ratings, 4.78). It shows the folder-plus-favourites model, a rich-text toolbar, and a modern One UI 8.5 visual direction. A Samsung phone is very likely in an Indian household (INFERRED, not verified), but the app is Galaxy-only (INFERRED from the Samsung Community complaints about no web or non-Samsung access, cited in §2.2).
3. **Notion.** It is a Zapier pick ("managing your life") with a 4.61 rating. It is the reference for markdown shortcuts, slash commands, links and backlinks, templates and a 30-day trash. These are the formatting and structure gaps EIO lists.
4. **Supplementary journal app: Day One.** It has the deepest documented journal feature set: On This Day, daily prompts with shuffle, streaks with a widget, templates, journaling reminders, and calendar and Today views. It ships an Android release about every two weeks in 2026 (OBSERVED, [release notes](https://dayoneapp.com/guides/release-notes/android-release-notes/)). Roundups rank it first for journaling (weak evidence). Journey has more Android installs (5M+ against 1M+), so I use it, and Daylio, only as secondary references for **mood**, which Day One doesn't appear to have (INFERRED: mood is absent from its features page and from two years of Android release notes).

**Not chosen**

- **OneNote** ties Keep and Samsung on installs. Its notebook → section → page canvas model, and the "functional-looking interface" Zapier mentions, have less to teach a three-type personal notes module than Notion's formatting and linking. That is a judgement call (INFERRED).
- **Evernote**'s 3.48 rating is the lowest of the large apps.
- **Obsidian** is mentioned briefly for daily notes.

---

## 2. Per-app teardowns

### 2.1 Google Keep

**Capture**

- **Large create button.** A large FAB opens a type menu (Image, Drawing, Audio, and text/list). With "Create text notes by default", one tap makes a text note and a long-press shows the other types. The large FAB rolled out in June 2026 (OBSERVED: [Keep help: create/edit](https://support.google.com/keep/answer/2888246?hl=en&co=GENIE.Platform%3DAndroid), [9to5Google Jun 2026](https://9to5google.com/2026/06/04/google-keep-large-fab/)).
- **Three home-screen widgets** (OBSERVED: [Keep help: widgets](https://support.google.com/keep/answer/13302793?hl=en), [9to5Google Apr 2025](https://9to5google.com/2025/04/10/google-keep-widget-redesigned-wide/)):
  - **Quick capture**: text, list, audio, drawing and camera buttons. The 5×1 size has all of them; the 4×1 may drop the camera. It was redesigned in April 2025 with each action as its own button: text is a vertical pill, the others are rounded rectangles.
  - **Single note**: you can **tick list items directly on the home screen**. Editing text opens the app.
  - **Note collection**: all notes, pinned notes, or one label.
- **Voice.** You can attach a recording to a text note (OBSERVED, help). Recordings are auto-transcribed (OBSERVED, [Wikipedia](https://en.wikipedia.org/wiki/Google_Keep)). An AI "generate notes with your voice" feature is limited to Google AI Pro/Ultra subscribers, so it is out of scope (OBSERVED, [help](https://support.google.com/keep/answer/17499364?hl=en&co=GENIE.Platform%3DAndroid)).

**Formatting**

- On Android: Bold, Italic, Underline, and H1/H2/Normal, applied by selecting text and tapping Format. There is also "Remove formatting" and Undo/Redo (OBSERVED, [help](https://support.google.com/keep/answer/2888246?hl=en&co=GENIE.Platform%3DAndroid)).
- This arrived in Aug 2023, Android only at launch ([Workspace Updates](https://workspaceupdates.googleblog.com/2023/08/google-keep-notes-android-rich-text-formatting.html)).
- No bullets, strikethrough, inline images, collapsible headers or tables. Images sit only at the top of a note (OBSERVED, [Android Police via Yahoo, Feb 2025](https://tech.yahoo.com/general/articles/google-keep-missing-6-basic-163023640.html)).

**Checklists**

- You can create a List, or convert a note with Add → Checkboxes. Items are reordered by a drag handle and indented by dragging right; the first item can't be indented. A setting controls "Add new items to the bottom" (OBSERVED, [help: make a list](https://support.google.com/keep/answer/6395451?hl=en&co=GENIE.Platform%3DAndroid)).
- "Move checked items to bottom" is on by default for new users (OBSERVED, [jefftk 2020](https://www.jefftk.com/p/keep-move-checked-items-to-bottom), [help: settings](https://support.google.com/keep/answer/6358550?hl=en-IN&co=GENIE.Platform%3DAndroid)).
- "Uncheck all items" is in the ⋮ menu and is used to reset a reusable weekly checklist (OBSERVED for web/unspecified platform, [Jeff Su 2024](https://www.jeffsu.org/newsletter-175/)). Its exact place on Android is UNKNOWN.

**Organisation**

- Labels only, no folders; up to 50 labels. Labels are applied from the note's Action menu and edited from the drawer (OBSERVED, [help: organise](https://support.google.com/keep/answer/6191044?hl=en&co=GENIE.Platform%3DAndroid)).
- Sort options are Custom (drag), Date created or Date modified (OBSERVED, same page).

**Pin, colour, multi-select**

- "Pin note": "Pinned notes stay at the top of your feed" (OBSERVED, same page).
- Each note has a colour **or** an illustrated background chosen from a gallery (OBSERVED). The number of colours today is UNKNOWN; Wikipedia lists 8 from an older version.
- Long-press starts multi-select, which supports bulk colour, label, archive and delete (OBSERVED).

**Archive, trash, undo**

- **Archive** is in the note's top bar and also works in bulk. Archived notes live under Menu → Archive (OBSERVED, [help: archive](https://support.google.com/keep/answer/6262765?hl=en&co=GENIE.Platform%3DAndroid)).
- **Trash**: "After deleting a note, you have seven days to recover it." There is an "Empty Trash" option (OBSERVED, same page).
- **Undo/redo** in the editor arrived in 2017, but only within the current editing session (OBSERVED, [Wikipedia](https://en.wikipedia.org/wiki/Google_Keep)).
- A post-delete undo toast is UNKNOWN (not in the help pages).
- "Swipe to archive" appears in an older store listing (OBSERVED, [TechSpot listing](https://www.techspot.com/downloads/6186-google-keep-android.html)). Whether it is current is UNKNOWN.

**Reminders**

- "Remind me" sits at the top right of a note and offers date, time and recurrence. There are editable Morning/Afternoon/Evening presets, and a notification comes at the time and again 24 hours later (OBSERVED, [help: reminders](https://support.google.com/keep/answer/3187168?hl=en&co=GENIE.Platform%3DAndroid)).
- Reminders now live in **Google Tasks/Calendar**, and notifications need one of those apps installed. Location reminders were discontinued in late 2025 (OBSERVED, same page and Wikipedia).

**Search**

- An empty search screen offers filter tiles before you type: **Types** (reminders, recordings, URLs…), **Labels**, **Things**, **People**, **Colours** (OBSERVED, [help: search](https://support.google.com/keep/answer/2888263?hl=en&co=GENIE.Platform%3DAndroid)).
- **Find in note** shipped on Android in Aug 2026: yellow highlights and up/down arrows (OBSERVED, [9to5Google Aug 2026](https://9to5google.com/2026/08/26/google-keep-find-note-android/)).

**Card layout**

- There are multi-column (grid) and single-column views (OBSERVED, Wikipedia).
- In grid view long notes are truncated, and **ticked items in a list are hidden from the card** until you open it (OBSERVED, [Alice Keeler 2018](https://alicekeeler.com/2018/09/03/google-keep-toggle-list-view/); dated, but the behaviour is still widely shown).
- On tablets there is a dual pane: list on the left, note on the right (OBSERVED, 9to5Google 2022, search excerpt).

**Interaction details that make it good**

- Zero-decision capture. A note needs no title, label or folder (INFERRED from the create flow).
- Checklists can be ticked from the widget without opening the app.
- Colour doubles as a search filter, so it isn't just decoration.
- Pinned notes also feed a widget filter ("pinned notes").

**Praise**

- Speed, sync, simplicity, and "easy universal access" on web, Android and iOS (OBSERVED, Wikipedia reception; [Zapier](https://zapier.com/blog/best-note-app-for-android/): "Fast and minimal design").

**Complaints**

- No folders, and "Lacks advanced organization" (Zapier).
- No collapsible headers, no inline images, no lock, poor export (Android Police).
- No note-to-note links and no created timestamp visible (r/GoogleKeep threads, seen as search excerpts).
- Occasional "lost notes" reports.

### 2.2 Samsung Notes

**Capture**

- A pencil FAB creates a note. You pick "Individual pages" or "Infinite scrolling page", then a layout (OBSERVED, [Samsung help: features](https://www.samsung.com/us/support/answer/ANS10001384/)).
- Input can be keyboard, S Pen or finger. Voice recordings can be transcribed, but that uses Galaxy AI, so it is out of scope.
- **Sticky notes** (a floating memo) were added in 2025 (OBSERVED, [SamMobile Aug 2025](https://www.sammobile.com/news/samsung-notes-update-two-new-features/)).
- "Add to → Home screen" pins a note to the home screen (OBSERVED, help).
- A Note List widget shows recent notes with a **title plus thumbnail preview** (OBSERVED, 2023, [SamMobile](https://www.sammobile.com/news/samsung-notes-update-notes-list-widget/), search excerpt).

**Formatting**

- A rich-text toolbar sits above the keyboard: bold, italic, underline, font size, font colour, alignment, and to-do / bullet / numbered lists (OBSERVED, [GuidingTech](https://www.guidingtech.com/samsung-notes-app-tips-tricks-to-use/)).
- "Turn off Rich text" gives a plain writing area.
- One UI 8 added a **customisable toolbar** (OBSERVED, SamMobile Jun 2025, search excerpt).

**Organisation**

- **Folders and subfolders, each with a colour**, managed under Menu → Manage folders. Deleting a folder deletes its contents (OBSERVED, [Samsung help: organise](https://www.samsung.com/us/support/answer/ANS10004548)).
- Tags exist, but since One UI 7 the separate Tags menu has been replaced by up to 10 recent tags on the search screen. Users found tags hard to reach (OBSERVED, Samsung Community moderator, search excerpt).
- **No note-to-note links**. Users have been requesting them since 2022 (OBSERVED, [Samsung Community](https://us.community.samsung.com/t5/Samsung-Apps-and-Services/Notes-Hyperlinks-PLEASE/m-p/2394075), search excerpt).

**Pin and favourites**

- Pinning works in two steps: star a note to make it a Favourite, then turn on Sort → "**Pin favorites to top**".
- There is also a "Frequently used notes" drawer section (OBSERVED, Samsung help, GuidingTech).

**Covers**

- A note can have a cover: Pattern, Illustration, or Text with a summary and stickers (OBSERVED, help).

**Lock**

- Notes can be locked individually with a password or biometrics; this needs a Samsung account (OBSERVED, help).

**Trash**

- The Trash/Recycle bin keeps notes for **15 days**. Restore is by long-pressing a note and tapping Restore (OBSERVED, GuidingTech; Samsung Colombia support, search excerpt).

**Reminders**

- No built-in reminders. "Add to → Reminder" hands the note to the Samsung Reminder app (OBSERVED, help and GuidingTech).

**Search, sort, view**

- Sort by Title, Date created or Date modified. More → View switches between grid and list.
- In **List** view the title sits above the preview; in **Grid** view the title sits *under* a page thumbnail (OBSERVED, Samsung Community moderator, search excerpt).
- One UI 8 added new search filters (OBSERVED, SamMobile, search excerpt).

**Visual direction (One UI 8.5, Jan 2026)**

- "More depth, card-style UI elements".
- A **search bar at the bottom** of the screen for reach.
- The hamburger menu opens as a **floating card**.

(OBSERVED, [SamMobile Jan 2026](https://www.sammobile.com/news/here-is-how-one-ui-8-5-is-reshaping-samsung-notes/), search excerpt.)

**Praise**

- Offline access, plenty of formatting, pen input (OBSERVED, [Techjockey comparison](https://www.techjockey.com/compare/samsung-notes-vs-google-keep), search excerpt).

**Complaints**

- **No web version.** The Windows app is limited to Samsung PCs, and users say they "stick with Google Keep" for that reason (OBSERVED, [Samsung Community](https://eu.community.samsung.com/t5/mobile-apps-services/samsung-notes-needs-a-web-view-for-it-to-be-practical/m-p/12339185/highlight/true), search excerpt).
- It slows down with large notes (Techjockey).
- Tags are hard to reach (above).

### 2.3 Notion

**Capture**

- The mobile app has a permanent bottom bar: **Home, Search, Inbox, New page** (OBSERVED, [Notion help: sidebar/mobile](https://www.notion.com/help/navigate-with-the-sidebar), search excerpt).
- **Android widgets**, which can be resized on some devices (OBSERVED, [Notion help: widgets](https://www.notion.com/help/mobile-widgets)):
  - **Page**: a page or database shown with its icon and cover.
  - **Favorites**.
  - **Recents**.
  - **AI shortcuts** (out of scope).

**Formatting**

- **Markdown-as-you-type**, for example:
  - `[]` + space → to-do
  - `#` + space → H1
  - `-` + space → bullet
  - `>` + space → toggle (collapsible) list
- A **slash menu**: `/todo`, `/h1`, `/toggle`, `/image`, `/toc`, `/date`, `/reminder`.
- (Both OBSERVED, [Notion help: shortcuts](https://www.notion.com/help/keyboard-shortcuts).)

**Links**

- `[[` opens page search and inserts a link. The target page gets an automatic **backlink** near its top, and links update when a page is renamed (OBSERVED, [Notion help: links & backlinks](https://www.notion.com/help/guides/creating-links-and-backlinks)).
- `@` + page name also creates an inline link (OBSERVED, shortcuts page).

**Reminders**

- `@remind` + a date, then adjust the time; a notification fires at that time (OBSERVED, shortcuts page).

**Templates**

- Database templates can **Repeat** on a schedule, for example a daily journal page created automatically (OBSERVED, [Notion help: repeating templates](https://www.notion.com/help/guides/automate-work-repeating-database-templates), search excerpt).

**Favourites**

- The sidebar has a Favorites section, which also feeds a widget (OBSERVED).

**Trash and history**

- Deleted pages stay in Trash **30 days**. Trash is searchable and filterable, and trashed pages are read-only until restored.
- There is **no "empty trash all"** option.
- Page history versions are saved every 10 minutes while editing; the free plan keeps 7 days.
- (OBSERVED, [Notion help: delete & restore](https://www.notion.com/help/duplicate-delete-and-restore-content).)

**Offline**

- Pages must be toggled "Available offline" per page and per device (OBSERVED, [Notion help: offline](https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know), search excerpt).

**Card layout**

- Notion is a page tree, not a card feed. How Home lays out recents on Android is UNKNOWN.

**Interaction details that make it good**

- Formatting never needs a toolbar: typed shortcuts become structure instantly.
- Links are rename-safe.
- Backlinks build themselves.

**Praise**

- Versatility (Zapier).

**Complaints**

- "Steep learning curve" and "Slower than counterparts" (Zapier).
- Mobile is "clunky and slow", and offline is unreliable: about 77% of offline-related Capterra reviews are negative (OBSERVED, [Capterra](https://www.capterra.com/p/186596/Notion/reviews/), search excerpt; weak).

### 2.4 Day One (supplementary, journaling only)

**Navigation (Android)**

- Bottom tabs include **More** at the bottom right, which holds On This Day, Daily Prompt and the Quick Start widget (OBSERVED, [On This Day guide](https://dayoneapp.com/guides/day-one-for-android/on-this-day-view/), [release notes](https://dayoneapp.com/guides/release-notes/android-release-notes/)).
- There are List and Calendar views. Tapping a calendar date gives two choices: "Open Entries" or "View On This Day". **< >** arrows step through days (OBSERVED, [Today view guide](https://dayoneapp.com/guides/tips-and-tutorials/today-view/)).

**On This Day**

- Shows entries from the same calendar date in earlier years. Since Jan 2025 it also shows entries from the past 24 hours.
- There is an optional **daily notification** saying whether past-year entries exist; since Aug 2026 it includes photos.
- A per-journal "Show in On This Day" toggle keeps some journals out of it.
- (OBSERVED, guide and release notes.)

**Daily prompts**

- One prompt per day. On Android: "Answer prompt", a **shuffle** button for a different prompt, and "See more" for recent prompts.
- You can choose which journal and tag prompt answers go to, and turn on a prompt notification (OBSERVED, [prompts guide](https://dayoneapp.com/guides/tips-and-tutorials/daily-writing-prompts/)).
- **Prompt Packs** (Gratitude, Fitness) were added in 2025 (OBSERVED, release notes).

**Streaks**

- "Journal streaks" are listed as a feature (OBSERVED, [features](https://dayoneapp.com/features/)).
- An Android **streaks widget** arrived in Jan 2025, and streak maths was aligned with the web app in Sept 2025 (OBSERVED, release notes).
- The exact streak rules (what counts as a day, whether there is a grace period) are UNKNOWN.

**Templates**

- Templates are static: fixed text, formatting, checklists and prompts, with "no variable substitution". There is a gallery: Gratitude, Reflections, Productivity, Health (OBSERVED, [templates guide](https://dayoneapp.com/guides/tips-and-tutorials/templates/)).
- Android catch-up in 2026 (OBSERVED, release notes):
  - Aug 2026: create a template from an existing entry.
  - Sept 2026: per-journal default template.
  - Oct 2026: templates can set a default journal.

**Reminders**

- A daily reminder fires at a **random time within a chosen window**.
- Custom reminders have a message, time and recurrence, and can be linked to a journal, tags and a template.
- (OBSERVED, [reminders guide](https://dayoneapp.com/guides/tips-and-tutorials/reminders/).)

**Editor**

- Contextual toolbars:
  - Default: attachment, media, formatting.
  - Selecting text: B, I, U, strikethrough, **highlight**, inline code, link.
  - Formatting bar: six heading levels, checklist, bulleted and numbered lists, quote, code block, rule.
- The attachment sheet offers Camera, Video, Audio, **Start dictation**, File, Tag, Location and **Template**.
- (OBSERVED, [Android editing guide](https://dayoneapp.com/guides/day-one-for-android/editing-and-formatting-entries-in-day-one-for-android/).)

**Metadata**

- Weather, steps and location are added automatically.
- Multiple journals, tags, favourites, and passcode/biometric lock.
- (OBSERVED, features page.)

**Mood**

- Not offered (INFERRED, explained in §1). The secondary references:
  - **Journey** tracks mood per entry and charts it over 30 days. It also has "Throwback" (entries from a week, a month or a year or more ago) (OBSERVED, [journey.cloud](https://journey.cloud/)).
  - **Daylio** logs a mood in about two taps, with editable mood emojis and activities, and shows **Year in Pixels**: one dot per day for a whole year (OBSERVED, [daylio.net](https://daylio.net/)).

**Obsidian aside**

- Daily notes "opens a note based on today's date, or creates it if it doesn't exist", applying a template automatically (OBSERVED, [Obsidian help](https://obsidian.md/help/plugins/daily-notes)). This is the same "one tap to today's entry" idea.

**Praise and complaints**

- The praise is INFERRED from roundups ranking it first, which is weak evidence.
- **Android has lagged iOS.** A staff member said in 2023 they were "working toward feature parity" (OBSERVED, [forum](https://forums.dayoneapp.com/c/android/)). Default templates per journal reached Android only in Sept 2026, years after iOS, macOS and web (OBSERVED).
- Reminders don't sync between devices (OBSERVED, reminders guide).
- Subscription pricing complaints: UNKNOWN in this session.

---

## 3. What EIO already has

EIO stores every note in one `notes` table (`title`, `body`, `tags[]`, `note_type` of note/checklist/journal, `is_inbox`, `entry_date`, and `checklist_items` as a jsonb array of `{text, done}`), shared by the phone and the website.

It already covers:

- Zero-decision capture into an Inbox *state*: a note with no title and no tags is in the Inbox, and giving it either files it.
- Checklists with a progress line, ticking from the list, and a deliberate "Uncheck all" for reusable lists.
- Journal entries filed by the day they are *about*, so backdating works.
- A read mode where a tick saves instantly and editing sits behind a pencil with a discard prompt.
- Search across titles, bodies, tags and checklist items, plus tag filters with counts and an updated-age filter.
- Guided empty states per tab.

Cards are a single-column list: title, a 2-line preview (unticked items for checklists), up to three tags, and a relative timestamp (`app/src/modules/notes/components/NoteCard.tsx`). Delete is a hard delete behind "This cannot be undone" (`api.ts` → `.delete()`, `NoteEditScreen.tsx`).

---

## 4. Gap analysis

### What the leaders share that EIO lacks

| Capability | Keep | Samsung Notes | Notion | Day One | EIO |
|---|---|---|---|---|---|
| Trash with restore window | 7 days | 15 days | 30 days | UNKNOWN | **None (hard delete)** |
| Pin / favourite to top | Pin | Star + "pin favorites to top" | Favorites | Favorites (search) | **None** |
| Archive | Yes | — | — | — | **None** |
| Rich text or markdown | B/I/U, H1–H2 | Toolbar: B/I/U, size, colour, lists | Markdown shortcuts and slash menu | Toolbar, 6 headings, lists, quote | **Plain text** |
| Checkboxes *inside* a text note | Convert to list | Yes | Yes | Yes | Only the checklist type |
| Colour | Per note and backgrounds | Per folder/category | Page icon/cover | — | **None** |
| Reminders | Note reminders (via Tasks) | Hands off to Reminder app | `@remind` | Journaling reminders | **None in Notes** (`expo-notifications` already used by Subscriptions) |
| Home-screen widget | 3 kinds | Note list, pin note | 4 kinds | Streak, Quick Start | **None** |
| Links between notes | — | — (requested) | `[[` and backlinks | — | **None** |
| Images in notes | Top of note | Inline | Inline | Inline | **None** |
| Find in note | Yes (Aug 2026) | — | — | Entry search in editor | **None** |
| Grid view option | Yes | Yes | n/a | Calendar | **List only** |
| On This Day | — | — | — | Yes, plus notification | **None** |
| Streak | — | — | — | Yes, plus widget | **None** |
| Prompts / templates | — | Page templates | Repeating templates | Prompts, packs, templates | **None** |
| Mood | — | — | — | (Journey, Daylio) | **None** |

**Common ground**

- **All four** have a recoverable delete, a pin or favourite, and a home-screen widget.
- **Three of four** have rich formatting with checkboxes inside text, and some form of reminder.

These are the table stakes EIO is missing.

### What EIO already does better

- **The Inbox as a derived state.** Keep and Samsung give you nowhere to put unfiled notes except "all notes". Notion's Inbox is for notifications, not captures (OBSERVED, sidebar help). EIO's "no title and no tags = Inbox" is a cleaner triage model than any of the four (INFERRED from their documented organisation models).
- **Backdated journal by `entry_date`.** Keep and Samsung have no journal concept. How Day One handles backdating on Android is UNKNOWN, since the editing guide doesn't cover it. EIO's journal ordering is explicit, and it makes On This Day and streaks cheap: one date column already exists.
- **Read mode with instant ticks.** Keep opens a note straight into editing ("Open a note by tapping it, then make changes", OBSERVED help). EIO's split between ticking and editing prevents accidental edits and the "discard your tick?" trap.
- **Search covers checklist items and tags together**, and the tag filter is built from tags actually in use, with counts. This is on par with or better than Keep's label filter, though Keep's type and colour filters go further (INFERRED).
- **One database for phone and website.** Samsung Notes' biggest complaint is having no web access (OBSERVED). EIO's always-focused web capture box is a strength.
- **"Uncheck all" is a first-class button.** Keep users have to know it is in the ⋮ menu (OBSERVED, Jeff Su).

---

## 5. Recommendations

**Effort scale**

- **S**: about one day for one developer, including both clients.
- **M**: two to four days.
- **L**: a week or more, or needs native build work.

**Dropped as irrelevant for one person:** sharing and collaboration, AI generation or summaries (Keep's Gemini voice, Galaxy AI, Notion AI, Day One Gold AI), handwriting/S Pen, math solver, printed books, subscriptions.

**Database note:** the items marked "DB: yes" each add a nullable column and can be bundled into one `notes_v3` migration (`deleted_at`, `archived_at`, `pinned_at`, `color`, `mood`, `remind_at`). Row-level security is unchanged. The real cost is that **every** existing read on both clients (lists, Inbox, tag counts, search) must start excluding trashed and archived rows.

### TOP 5

**1. Trash with an Undo toast (soft delete)**

- **What:** delete moves a note to Trash and shows "Moved to Trash · Undo" for about 5 seconds. A Trash view lists deleted notes with "Restore", "Delete forever" and "Empty trash", and anything older than 30 days is purged. This replaces the current "This cannot be undone" dialog: undo is both faster and safer than a confirm prompt.
- **Why for one person:** a personal notes app is the only copy of those thoughts, and a mistaken delete is EIO's only unrecoverable data loss today.
- **Who has it:** Keep (7 days, Empty Trash), Samsung (15 days), Notion (30 days, no empty-all).
- **Effort:** M. Every query needs a filter, and the purge can be done on read or with a scheduled job.
- **DB:** yes, `deleted_at timestamptz` plus a partial index `where deleted_at is null`.

**2. Pin to top**

- **What:** a pin toggle in the read-mode header and in a long-press menu. Pinned notes sit under a "Pinned" heading above "Others" on every tab, so the shopping list stays first on Lists. Pinning must **not** file a note out of the Inbox; only a title or tag does that.
- **Why for one person:** a handful of notes (shopping list, packing list, a running "ideas" note) get opened every day, and pinning removes the scroll or search each time.
- **Who has it:** Keep (pin, plus a pinned-notes widget filter), Samsung ("Pin favorites to top"), Notion (Favorites and a widget).
- **Effort:** S.
- **DB:** yes, `pinned_at timestamptz` (ordering by pin time keeps the order stable).

**3. Lightweight markdown: rendered in read mode, with a formatting bar in edit mode**

- **What:** keep `body` as plain text holding markdown, and render it in read mode on both clients. The subset to support:
  - `#` and `##` headings
  - `**bold**` and `*italic*`
  - `-` bullets and `1.` numbered lists
  - `>` quotes
  - links
  - **`- [ ]` and `- [x]` checkboxes**, tickable in read mode and saved immediately, the same rule as checklists today

  In edit mode, add a bar above the keyboard (checkbox, bullet, heading, bold, italic, link) that inserts syntax. Enter should continue a list or checkbox line. Typed shortcuts like `[] ` work automatically because they *are* the syntax. Strip the markdown from card previews.
- **Why for one person:** a note that mixes text with a few to-dos (a trip plan, meeting notes) is the most common real note, and it currently has to be split into two notes.
- **Who has it:** Keep (B/I/U, H1/H2), Samsung (toolbar with lists and checkboxes), Notion (markdown shortcuts), Day One (contextual toolbar).
- **Effort:** M.
- **DB:** no. Search keeps working because the text is unchanged. Check that a markdown renderer works with Expo SDK 57, per AGENTS.md.

**4. Journal "On this day" plus a streak, with an optional daily prompt**

- **What:** at the top of the Journal tab, show an "On this day" strip with entries whose `entry_date` has today's month and day in earlier years (for example "1 year ago · Sun 19 Oct 2025"), each with a 2-line preview. Beside it, a streak chip ("12 days") counting consecutive days that have an entry. Optionally, a prompt card in the empty journal composer with a shuffle button, drawn from a static local list of prompts.
- **Why for one person:** journaling only pays off when you re-read it, and On This Day is the re-read trigger. A visible streak is the cheapest habit loop.
- **Who has it:** Day One (On This Day with notification, streaks with widget, daily prompt with shuffle, prompt packs); Journey (Throwback).
- **Effort:** S–M.
- **DB:** no. It all derives from `entry_date`, which EIO already has, unlike Keep or Samsung.
- **Open decision:** backdated entries will fill streak gaps. That is arguably honest, since the day *was* journaled, but decide it explicitly.

**5. Capture from outside the app: share-to-EIO and launcher shortcuts now, a widget later**

- **What:**
  - **(a)** EIO appears in Android's share sheet. Shared text or URLs land in the Inbox as a quick capture.
  - **(b)** Long-pressing the app icon offers "New note", "New checklist" and "Today's journal".
  - **(c)** Later, home-screen widgets: a 4×1 quick-capture bar (Note / List / Journal), and a single-checklist widget with tickable boxes.
- **Why for one person:** capture speed decides whether a thought goes into EIO or gets lost. On the phone, capture is currently "behind a button" inside the app (USER-GUIDE.md).
- **Who has it:** Keep (Quick capture, single-note widget with ticking, note collection); Notion (Page, Favorites and Recents widgets); Day One (Quick Start and Streak widgets).
- **Effort:** M for (a) and (b); L for (c).
- **DB:** no.
- **Build caveat:** all three need native configuration, so they **will not run in Expo Go**. They need the EAS `development` build profile, which `eas.json` already defines. Confirm the libraries against the Expo SDK 57 docs.

### The rest, in priority order

| # | Recommendation | Why for one person | Who has it | Effort | DB change? |
|---|---|---|---|---|---|
| 6 | **Checklist upgrades.** Ticked items sink to the bottom and collapse behind "N ticked ▸". Drag to reorder. Add "Delete ticked items" next to Uncheck all. Undo toast on Uncheck all. | In a shop you want only what's left on screen. Uncheck all is a one-tap mass change that should be undoable. | Keep (move checked to bottom by default, drag, indent, grid hides ticked) | S | No (order lives in the jsonb array) |
| 7 | **Archive.** "Done with it, keep it." Hidden from tabs and search by default, with an "Include archived" toggle in search. | Old trip lists and finished project notes clutter tabs without deserving deletion. | Keep | S | Yes, `archived_at` |
| 8 | **Reminders.** (a) A daily journal reminder at a chosen time, or at a random time within a window as Day One does. (b) "Remind me" on any note: date, time and repeat, with Morning/Afternoon/Evening presets. | Turns notes into prompts at the right moment, and builds the journaling habit. | Keep, Notion `@remind`, Day One, Samsung (via Reminder) | S for (a), M for (b) | (a) no, setting stored on the device; (b) yes, `remind_at`, scheduled with `expo-notifications`, already a dependency |
| 9 | **Colour per note.** 6–8 muted swatches tuned for the dark glass theme. Shown as a tint plus an edge stripe, and usable as a search filter. | Instant visual find for a few recurring notes, with no typing. | Keep (per note, plus colour filter), Samsung (folder and category colours) | S | Yes, `color text` |
| 10 | **Templates.** "Save as template" and "New from template". A default journal template, e.g. *Wins / Hard / Tomorrow*. | Recurring structures (weekly review, packing, daily journal) stop being retyped. | Notion (repeating), Day One (gallery, per-journal default, from an entry), Obsidian daily-note template | S–M | Small: `is_template boolean`, or a reserved tag |
| 11 | **Find in note and highlight.** Opening a note from search highlights the term, with ▲▼ to step through matches. | Long journal entries and notes become scannable. | Keep (Aug 2026), Day One (entry search in editor) | S | No |
| 12 | **Two-column grid option**, at least for Lists: cards show up to about 5 unticked items with hollow boxes, plus "+N ticked". | See all lists at a glance and pick the right one in the shop. | Keep, Samsung | M | No |
| 13 | **Journal mood.** An optional 5-step mood on journal entries, plus a Year-in-Pixels view. | Gives a long-run pattern that a diary alone doesn't show. | Journey, Daylio (Day One lacks it) | S–M | Yes, `mood smallint` |
| 14 | **Links between notes.** `[[Title]]` with autocomplete, rendered as a tappable chip. "Linked from" list at the bottom of the target note. Store `[[id\|title]]` so renames don't break links. | Connects a journal entry to the project note it mentions. | Notion (rename-safe, automatic backlinks); Samsung users request it | M | No (parse bodies), or a `note_links` table if it is slow |
| 15 | **Photos on notes and journal entries.** | Receipts, whiteboards, a photo for the day's journal. | All four | L (Supabase Storage, upload, thumbnails) | Yes, `attachments jsonb` plus a bucket |
| 16 | **Voice.** Rely on keyboard dictation first. Audio recording with transcription comes later. | Gboard's mic already gives voice-to-text at zero cost. Recorded audio only matters if you want to keep the sound itself. | Keep (recording, transcribed), Day One (audio, dictation) | — / L | No / yes |

---

## 6. UI and UX patterns worth adopting

Each pattern is written to be buildable without seeing the source app.

### 1. Undo toast instead of a confirm dialog (Keep pattern, Material default)

- **Placement:** a dark pill just above the tab bar, with one line of text and a right-aligned **Undo** text button in the accent colour.
- **Timing:** auto-dismisses after about 5 seconds. A new toast replaces the old one; they never stack.
- **Where to use it:** delete ("Moved to Trash"), archive ("Archived"), Uncheck all ("Unchecked 14 items"), Delete ticked items.
- **Keep confirm dialogs only for** "Delete forever" and "Empty trash".

### 2. Pinned / Others split

- **Headings:** two small-caps section labels, "PINNED" and "OTHERS", in the muted caption style. Show the labels only when at least one note is pinned. This is INFERRED Keep behaviour; the help page only says pinned notes "stay at the top".
- **Pin indicator:** a filled pin glyph at the top right of pinned cards. An outline pin in the read-mode header toggles it.

### 3. Long-press menu and multi-select (Keep, Samsung)

- Long-pressing a card selects it, and the header turns into a selection bar: "2 selected", then Pin, Colour, Tag, Archive, Delete.
- Tapping other cards adds them to the selection.
- Back, or ✕, exits selection.
- **Avoid swipe-to-archive on cards.** EIO's Notes tabs already use horizontal swipe to change tab, so a card swipe would fight that gesture (INFERRED).

### 4. Trash view

- **Entry point:** a row at the bottom of the tag or filter sheet (phone) or in the sidebar (web), showing "Trash · 3".
- **Banner:** "Notes in Trash are deleted after 30 days" at the top.
- **Cards:** read-only, with the remaining days in the timestamp slot ("Deletes in 12 days").
- **Actions:** tapping a card offers Restore and Delete forever. "Empty trash" sits in the header overflow menu.
- **Detail from Notion:** trashed notes are read-only until restored.

### 5. Checklist card anatomy (list and grid)

- **Card body:**
  - Title.
  - A thin 2px progress bar. EIO already has the "3 of 8 done" text and can keep it.
  - Up to 5 *unticked* items, each with a 12px hollow box glyph and a single line of text.
  - A muted footer, "+4 ticked".
- **In the open list:** ticked items go to a collapsible "Ticked (4) ▸" group at the bottom. They show strikethrough text in the faint colour.
- **Ticking an item:** play a short fade (about 150 ms) as it moves down, so the jump isn't jarring.

### 6. Card colour on a dark glass theme

- **Card fill:** tint the card with the swatch at about 12–16% opacity, plus a 3px left edge at full swatch colour. Text colour stays the same, which keeps contrast safe.
- **Palette:** about 7 hues plus "none" (red, orange, yellow, green, teal, blue, purple). Keep them desaturated so they read as calm on the dark background.
- **Other uses:** the same swatches appear as filter chips in search.

### 7. Search empty state as a filter launcher (Keep)

- **Before you type:** the search screen shows filter tiles: **Types** (Notes, Lists, Journal, Pinned, With reminder, Archived), then **Tags** (chips with counts, which EIO already has), then **Colours** (swatches).
- **After you type:** the results replace the tiles.
- **Field placement:** put the search field at the **bottom** on the phone, as One UI 8.5 does, for one-handed reach.

### 8. Formatting bar above the keyboard (Day One, Samsung)

- **Contextual contents:**
  - No selection: ☐ checkbox · • bullet · H heading · B · I · 🔗 link · ⌄ dismiss keyboard.
  - With a selection: B · I · S (strike) · highlight · link.
- **Behaviour:** Enter on a bullet or checkbox line continues the list. Enter on an empty list line ends it.
- **Typed shortcuts:** these work automatically because they are the stored syntax: `[] ` and `- [ ] ` become a checkbox, `# ` a heading, `- ` a bullet (Notion).

### 9. Create button (Keep, Jun 2026)

- **Tap:** a large FAB creates the current tab's default type.
- **Long-press:** opens a small vertical menu of Note, Checklist, and Journal (today), animated up from the FAB.
- **Default behaviour:** on the Journal tab, the default is "today's entry". If one exists, open it rather than creating a duplicate, which is the Obsidian daily-note behaviour.

### 10. Journal tab header (Day One, Journey)

- **Row 1:** a streak chip (flame glyph, "12-day streak"; muted "Start a streak" when it is zero) and a compact 7-day dot strip. Filled dots are days with an entry, and today is outlined.
- **Row 2: an "On this day" card.** It shows "1 year ago", the weekday and date, and a 2-line preview. It is horizontally scrollable when several years match. The card is hidden when nothing matches; there is no empty card.
- **Row 3: a prompt card**, shown only when today has no entry. It holds the prompt text, a ⟳ shuffle icon, and an "Answer" button that opens a new entry with the prompt as its first line.

### 11. Find in note (Keep, Aug 2026)

- **Highlights:** opening a note from search results highlights every match with a yellow background at about 35% opacity.
- **Navigation:** a slim top bar shows "2 / 5" with ▲ ▼ to step through matches, and a ✕ to clear the highlights.

### 12. Widgets (Keep, for the later build)

- **4×1 quick-capture bar:** a wide pill for "Note" on the left, then square-ish rounded buttons for List and Journal (Keep's 2025 redesign uses exactly this shape language).
- **Single checklist widget:** the title, then tickable rows. Tapping the title opens the app.

### 13. Empty states

EIO's per-tab empty states, with an explanation and an action, are already better than anything documented for these apps. Keep them, and add matching ones for Trash ("Nothing in Trash") and Archive.

---

## 7. Checklist status

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | Top 3 notes apps on Android | **Answered** | Install and rating data from AndroidRank (third-party) plus Zapier. The choice of Notion over OneNote is a stated judgement. |
| Q2 | Leading journal app | **Answered** | Day One chosen on feature depth and release cadence. Journey has more Android installs, so this is acknowledged as a judgement. |
| Q3 | Capture speed | **Answered** | Keep, Notion and Day One widgets OBSERVED. Samsung's current widget set is only partly verified (2023 note-list widget). Share-to behaviour for each app is UNKNOWN (not researched). |
| Q4 | Formatting | **Answered** | |
| Q5 | Organisation | **Answered** | Samsung tag UI after One UI 7 is based on a moderator excerpt only. |
| Q6 | Pin, colour, archive, trash, undo | **Partial** | Keep's post-delete undo toast and current swipe-to-archive are UNKNOWN. Keep's current colour count is UNKNOWN. Day One trash is UNKNOWN. |
| Q7 | Reminders | **Answered** | |
| Q8 | Search | **Answered** | |
| Q9 | Reusable checklists | **Partial** | Keep's "Uncheck all items" observed (platform unclear). "Delete checked items" on Android is UNKNOWN. |
| Q10 | Card layout | **Partial** | Keep grid truncation and hidden ticked items come from a 2018 source. Samsung grid and list described by a moderator. Notion's Android Home layout is UNKNOWN. |
| Q11 | Journal features | **Partial** | On This Day, prompts, templates and reminders OBSERVED. Streak rules UNKNOWN (the search budget ran out). Day One mood INFERRED absent. Day One backdating on Android UNKNOWN. |
| Q12 | Praise and complaints | **Partial** | Keep, Samsung and Notion are covered via reviews and community excerpts. No systematic Reddit sample. Day One complaints are thin (Android parity only). |
| Q13 | Empty states and navigation | **Partial** | Navigation OBSERVED for Notion, Day One and Samsung One UI 8.5. The other apps' empty states are UNKNOWN. |

## Sources

**App reach (third-party estimates)**
- https://www.androidrank.org/application/samsung_notes/com.samsung.android.app.notes
- https://www.androidrank.org/application/google_keep_notes_and_lists/com.google.android.keep
- https://www.androidrank.org/application/onenote/com.microsoft.office.onenote
- https://www.androidrank.org/application/colornote/com.socialnmobile.dictapps.notepad.color.note
- https://www.androidrank.org/application/evernote/com.evernote
- https://www.androidrank.org/application/notion/notion.id
- https://www.androidrank.org/application/obsidian/md.obsidian
- https://www.androidrank.org/application/daylio/net.daylio
- https://www.androidrank.org/application/journey/com.journey.app
- https://www.androidrank.org/application/day_one/com.dayoneapp.dayone
- https://zapier.com/blog/best-note-app-for-android/

**Google Keep**
- https://support.google.com/keep/answer/6191044?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/2888263?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/6262765?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/6358550?hl=en-IN&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/3187168?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/6395451?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/2888246?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/17499364?hl=en&co=GENIE.Platform%3DAndroid
- https://support.google.com/keep/answer/13302793?hl=en
- https://en.wikipedia.org/wiki/Google_Keep
- https://9to5google.com/2026/06/04/google-keep-large-fab/
- https://9to5google.com/2026/08/26/google-keep-find-note-android/
- https://9to5google.com/2025/04/10/google-keep-widget-redesigned-wide/
- https://workspaceupdates.googleblog.com/2023/08/google-keep-notes-android-rich-text-formatting.html
- https://tech.yahoo.com/general/articles/google-keep-missing-6-basic-163023640.html (Android Police, Feb 2025)
- https://alicekeeler.com/2018/09/03/google-keep-toggle-list-view/
- https://www.jefftk.com/p/keep-move-checked-items-to-bottom
- https://www.jeffsu.org/newsletter-175/
- https://www.techspot.com/downloads/6186-google-keep-android.html

**Samsung Notes**
- https://www.samsung.com/us/support/answer/ANS10001384/
- https://www.samsung.com/us/support/answer/ANS10004548
- https://www.guidingtech.com/samsung-notes-app-tips-tricks-to-use/
- https://www.samsung.com/co/support/mobile-devices/galaxy-s10-how-to-recover-a-deleted-note-from-samsung-notes/ (search excerpt)
- https://www.sammobile.com/news/samsung-notes-update-two-new-features/
- https://www.sammobile.com/news/here-is-how-one-ui-8-5-is-reshaping-samsung-notes/ (search excerpt)
- https://www.sammobile.com/news/one-ui-8-samsung-notes-features-leak-customizable-toolbar/ (search excerpt)
- https://www.sammobile.com/news/samsung-notes-update-notes-list-widget/ (search excerpt)
- https://eu.community.samsung.com/t5/mobile-apps-services/samsung-notes-needs-a-web-view-for-it-to-be-practical/m-p/12339185/highlight/true (search excerpt)
- https://r1.community.samsung.com/t5/others/where-is-tag-list-in-samsung-notes/td-p/32185283 (search excerpt)
- https://us.community.samsung.com/t5/Samsung-Apps-and-Services/Notes-Hyperlinks-PLEASE/m-p/2394075 (search excerpt)
- https://eu.community.samsung.com/t5/mobile-apps-services/notes/td-p/14453720 (search excerpt)
- https://www.techjockey.com/compare/samsung-notes-vs-google-keep (search excerpt)

**Notion**
- https://www.notion.com/help/keyboard-shortcuts
- https://www.notion.com/help/mobile-widgets
- https://www.notion.com/help/duplicate-delete-and-restore-content
- https://www.notion.com/help/guides/creating-links-and-backlinks
- https://www.notion.com/help/guides/automate-work-repeating-database-templates (search excerpt)
- https://www.notion.com/help/navigate-with-the-sidebar (search excerpt)
- https://www.notion.com/help/guides/working-offline-in-notion-everything-you-need-to-know (search excerpt)
- https://www.capterra.com/p/186596/Notion/reviews/ (search excerpt)

**Day One and other journal apps**
- https://dayoneapp.com/guides/day-one-for-android/on-this-day-view/
- https://dayoneapp.com/guides/tips-and-tutorials/templates/
- https://dayoneapp.com/guides/tips-and-tutorials/daily-writing-prompts/
- https://dayoneapp.com/guides/tips-and-tutorials/today-view/
- https://dayoneapp.com/guides/tips-and-tutorials/reminders/
- https://dayoneapp.com/guides/release-notes/android-release-notes/
- https://dayoneapp.com/guides/day-one-for-android/
- https://dayoneapp.com/guides/day-one-for-android/editing-and-formatting-entries-in-day-one-for-android/
- https://dayoneapp.com/features/
- https://dayoneapp.com/features/on-this-day/
- https://forums.dayoneapp.com/c/android/
- https://journey.cloud/
- https://daylio.net/
- https://obsidian.md/help/plugins/daily-notes

**EIO (local, read-only)**
- `app/src/modules/notes/types.ts`
- `app/src/modules/notes/components/NoteCard.tsx`
- `app/src/modules/notes/api.ts`
- `app/src/modules/notes/screens/NoteEditScreen.tsx`
- `app/src/modules/notes/screens/NotesListScreen.tsx`
- `supabase/migrations/0010_notes_v2.sql`
- `docs/USER-GUIDE.md`
- `app/app.json`
- `app/eas.json`
