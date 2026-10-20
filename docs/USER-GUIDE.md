# EIO — User Guide

Everything in One. This guide explains what each part does, how to use it, and —
where it matters — **why it behaves the way it does**, because several things in
EIO are deliberately not what you would first expect. It describes version 3.

- [What's new in v3](#whats-new-in-v3)
- [The two clients](#the-two-clients)
- [Signing in](#signing-in)
- [The dashboard](#the-dashboard)
- [Undo, menus and sheets](#undo-menus-and-sheets)
- [Reminders and notification buttons](#reminders-and-notification-buttons)
- [Tasks](#tasks)
- [Notes](#notes)
- [Finance](#finance)
- [Subscriptions](#subscriptions)
- [Fitness](#fitness)
- [B-List](#b-list)
- [Products](#products)
- [Your own modules](#your-own-modules)
- [Desktop-only conveniences](#desktop-only-conveniences)
- [Your data](#your-data)
- [When something goes wrong](#when-something-goes-wrong)

---

## What's new in v3

The changes you will notice first, module by module.

- **Fitness** — [Gym and Calisthenics modes](#gym-and-calisthenics) over one
  log; a [set table](#the-set-table) that shows last time and saves as you
  tick; rest and hold timers; [records that work for bodyweight](#personal-records);
  [ladders](#calisthenics-skills-and-ladders); a [finish summary](#finishing-and-the-summary).
- **Tasks** — opens on [Today](#today); [quick add](#quick-add) reads "every
  mon 7pm !high"; repeats on chosen weekdays or from completion; reminders with
  Done and Snooze.
- **Notes** — [Trash with Undo](#trash); pins, colours and an archive;
  [Markdown](#markdown) with boxes you can tick; a journal streak and prompts.
- **Finance** — [accounts and transfers](#accounts-and-the-balance);
  [budgets with a pace line](#budgets); a calendar; pinned quick adds; a month
  that can start on payday.
- **Subscriptions** — [reminders that never skip the last days](#renewal-reminders);
  free trials; an 84-service catalogue; Mark paid with an editable amount and
  account; price history.
- **Products** — log a missed day, edit past uses, [spares and
  restocking](#finishing-and-starting-the-next-one), expiry dates, and
  [reorder reminders](#reorder-reminders).
- **B-List** — a memory when you tick something off, [Pick for me](#pick-for-me),
  a Now shelf, plans with savings, and a timeline of what you have done.
- **Your own modules** — [one-tap logging with defaults](#defaults-and-one-tap-logging),
  new field types, a trend chart, reminders, and starter templates.
- **Everywhere** — [Undo instead of "are you sure?"](#undo-menus-and-sheets)
  for anything reversible, and [reminders rebuilt on every
  launch](#reminders-and-notification-buttons).

### Moving from v2

1. **Run the migrations** in `supabase/migrations/` through the Supabase SQL
   Editor. With 0001–0007 and 0009–0016 already in place from v2, run, in this
   order: **0017, 0018, 0008, 0019, 0020, 0021, 0022, 0023, 0024, 0025, 0026.**
2. **Install the v3 APK straight away.** It replaces the v2 app on the phone.

`0008_finance_v2.sql` (accounts and transfers) was written long ago and held
back. v3 needs it: Finance's accounts and transfers and Subscriptions' "charged
to" read its tables, and 0022 and 0023 build on it — hence its place in the
middle of the order.

Every migration only adds, and each is safe to run twice. **But the v2 app
misreads the new data**, so the time between running them and installing v3
should be minutes, not days. While the phone is still on v2:

- its Products screen crashes once a spare container exists;
- it counts a transfer twice in its balance;
- an edit it makes to a subscription's cycle or date is misread.

So: run the migrations, install v3 immediately, and don't create spares or
transfers on the website until the phone has v3.

---

## The two clients

There is one EIO. You reach it two ways.

| | Phone app | Website |
| --- | --- | --- |
| Where | Android | Any desktop browser |
| Best at | Capture, logging in the moment | Reviewing, planning, comparing, bulk entry |
| Reminders and notification buttons | **Yes** | No — see [Reminders](#reminders-and-notification-buttons) |
| Reminder *settings* | Yes | Yes, for Tasks, Subscriptions and your own modules; the phone picks them up the next time EIO starts there |
| Rest timer, hold timer, plate calculator, screen kept awake | Yes | No — see [Fitness on the website](#fitness-on-the-website) |
| Finance capture links (`eio://`) | Yes | No |
| Tasks' Today page, Reschedule, Won't do, a repeat's history | Yes | No |
| Kanban board, year heatmap, sortable tables, always-on capture | No | Yes — see [Desktop-only conveniences](#desktop-only-conveniences) |
| Everything else | Same data, same rules | Same data, same rules |

Smaller differences are noted where they occur.

They look different, deliberately. The phone leans on colour and depth, which
suits a screen showing one thing at a time. The website is flat and dense,
because a monitor shows six things at once and decoration then competes with
what you came to read.

They are not a copy and a sync. They are two front doors onto **the same
database row**. Add a task on your phone, refresh the website, it is there. There
is no sync delay because there is nothing to sync — neither client keeps its own
copy of your data. The rules are shared too: the website runs the phone's own
code for recurrence, records, projections and totals, so the two cannot
disagree about what counts.

The practical consequence: **whichever is nearer is the right one.** Log a set at
the gym on your phone; plan next month's budget at your desk.

---

## Signing in

One account, both clients. The same email and password you use on the phone
works on the website, and you see the same data because the database itself
scopes every row to your user id.

**On the website**, you stay signed in until you sign out — the session is kept
in the browser. Signing out in one client does not sign you out of the other.

If sign-up seems to do nothing, check your email. If your Supabase project has
email confirmation switched on, the account is created but unusable until you
confirm, and the app tells you so rather than leaving the form looking dead.

---

## The dashboard

Every module's headline in one view.

On the **phone** it is a scrolling grid of tiles you tap to open a module. On the
**website** the sidebar already handles navigation, so the tiles become a status
board — the point is reading all of it at a glance.

Each tile shows the single most useful fact, and **the more urgent fact wins**.
Tasks shows "2 overdue · 5 today" (and opens on Today). Subscriptions shows
overdue, then a trial about to end, then what is due this week, and only falls
back to your monthly total when there is nothing to act on. Products shows how
many to reorder before how many are in use; the B-List, what is on your Now
shelf. A tile that always showed the same statistic would stop being worth
reading. Your own modules' tiles carry a small trend line when they have a
number to chart.

Tiles load independently. If one module fails — a dropped connection mid-load —
that tile shows a dash and the rest are unaffected.

---

## Undo, menus and sheets

A few habits run through every module.

**Undo, not "are you sure?"** Anything you can take back — ticking, logging,
deleting a set, moving a note to the Trash, archiving, pausing, pinning a quick
add — happens at once, and a toast offers **Undo** for about five seconds.
Only what is permanent asks first: deleting something forever, emptying the
Trash, deleting a product with its history, deleting a workout. A confirmation
on every tick trains you to tap "Yes" without reading; an Undo costs nothing
when you meant it, and the one confirmation left still means something.

One toast shows at a time; a new one replaces the old. On the website,
hovering over a toast or focusing it holds it open, and **Ctrl/Cmd+Z** runs its
Undo — except while you are typing in a field or a dialog is open, where it
would act on something you cannot see.

**Long-press for the menu.** On the phone, most lists sit inside a pager you
swipe between, so a row swipe would fight the page swipe. Rows therefore have
no swipe actions; long-press opens their menu instead. The one exception is a
set inside a workout, which you can swipe away because a session is a screen of
its own.

**Sheets.** Choices and short forms slide up from the bottom: a title, a line
saying what they are about, and one main button.

**Never colour alone.** Every status colour comes with a word or an icon —
"Over budget", "Reorder now", a check on a ticked row — so nothing depends on
telling two colours apart.

On the phone, ticking and logging come with a small vibration, and records and
finished timers with a stronger one.

---

## Reminders and notification buttons

Reminders are a **phone** feature.

| Module | Reminds you | Buttons | A tap opens |
| --- | --- | --- | --- |
| Tasks | A task with a time: at the time, or 5, 15 or 30 min, 1 hour or 1 day before. Optional **Plan your day** digest each morning | **Done** · **Snooze 30 min** | The task (the digest opens Today) |
| Subscriptions | Each renewal: your chosen days before, and always on the day. A trial: 3 days and 1 day before it ends, and that morning | **Mark paid**; on a trial **Keep it** · **I cancelled** | The subscription |
| Products | The morning a product reaches Reorder now, and its projected empty day | **Ordered** · **In 3 days** | The product |
| Your own modules | A daily or weekly nudge to log; a date field coming up | — | The module, or the entry |
| Fitness | Rest over | — | — |

Details are in each module's section. What they have in common:

- **Every button opens EIO and acts there.** A button that acts in the
  background needs the app's code running, and once Android has closed EIO there
  is none — a press handled in the background could simply be lost. So a press
  opens the app, and the app acts on it, once. **Done** completes the task as a
  tick would and **Snooze 30 min** brings it back half an hour later; **Mark
  paid** opens the Mark paid sheet, so you can check the amount before it is
  logged; **Keep it** and **I cancelled** open the trial's sheet; **Ordered**
  adds a spare and **In 3 days** asks again later.
- **An old notification cannot do something wrong.** Pressed after things have
  moved on, a button checks first and says so — "Already paid for this cycle".
  Changing a subscription also clears its reminders already sitting in the
  notification tray.
- **They fire on time.** EIO declares Android's exact-alarm permission, so a
  reminder arrives at the minute it was set for, not whenever Android next
  batches its alarms.
- **They are rebuilt on every launch.** Reminders are local notifications,
  scheduled by your phone's operating system. **No server is involved**, and
  nothing is sent anywhere — which also means a reminder exists only on the
  phone that scheduled it. So each time EIO starts with you signed in, every
  module rebuilds its reminders from the database. A reinstall, or a change made
  on the website, is picked up the next time EIO starts on the phone.
- **Permission is asked when you first need it**, never at launch: when you set
  a task's reminder, turn on the digest, save a product, switch on a module's
  reminder, or start your first rest timer. A prompt that arrives before you
  have done anything is the one people refuse.
- **Each module has its own Android channel** — Task reminders, Renewal
  reminders, Reorder reminders, Module reminders, Rest timer — so you can mute
  one in Android's settings without muting the rest.
- **They need the installed EIO app, not Expo Go.** Expo Go cannot schedule
  notifications at all, so there EIO schedules none (Subscriptions says so on
  its screen).

**The website has none, on purpose.** A browser cannot schedule a notification
that survives the tab closing. One that only fires while EIO happens to be open
in a tab would be worse than having none at all, because you would come to rely
on it. You can still change reminder settings there; the phone applies them the
next time it starts.

---

## Tasks

Tasks are organised by **how often you do them**, not by project: Daily, Weekly,
Monthly, Yearly.

**On the phone** there are five pages — **Today**, then Daily, Weekly, Monthly
and Yearly — and you swipe between them or tap their names. EIO opens on Today.
**On the website they are a kanban board**, which is the single biggest
difference between the clients. Tab switching hides the shape of your
workload — you cannot tell that Weekly has quietly grown to fifteen items while
Daily sits empty. Four columns tell you instantly.

### Today

Today is the question you open Tasks to answer: what needs doing now?

- **Overdue · N**, with **Reschedule**, which moves the whole section at once
  to the day you pick.
- **Today · N**.
- **Completed today**, folded away until you tap it — everything closed since
  midnight, whether done, skipped or marked won't do.

When nothing is left it says so ("Nothing left today") and shows what is next.
A task with no due date never appears here: it is a thing to do, not a thing to
do *by* a date, so it is not overdue and never nags.

### Ticking, and Undo

Tick a task and it is done, with a toast — **"Completed · next Thu"** for a
repeat, naming when it comes round again — and **Undo**. Undo reopens the task
and removes the next occurrence it had just created, as long as you have not
touched that one.

Finished work is never deleted. Each frequency page has a **Completed** link at
the top that switches it to what you have done; ticking something there
reopens it. Completed is fetched separately from open tasks because finished
work piles up for years and outnumbers open tasks many times over; downloading
all of it every time you glance at today's list would be a strange thing to do.

### The long-press menu

Long-press a task for:

- **Reschedule** — Today, Tomorrow, This weekend, Next week (each showing the
  date it lands on), No date, or Pick a date. Only the date moves; a repeat keeps
  its rhythm.
- **Skip this time** (repeats) — recorded as skipped, and the next one comes
  round.
- **Won't do** (one-offs) — closes it without counting it as done.
- **Edit**, and **Delete**, which asks first because it is permanent. A repeat's
  earlier completions stay in its history.

### Quick add

Tap **+** and type one line. Hold **+** for the full editor.

| You type | It reads |
| --- | --- |
| `tomorrow`, `fri`, `next fri`, `this weekend`, `next week`, `in 3 days`, `after 3 days` | A due date |
| `19/10`, `19/10/27`, `19 Oct`, `Oct 19th` | A date, **day first**: 19/10 is 19 October |
| `7pm`, `7:30pm`, `19:00`, `noon`, `at 7` | A time; with no date, today (or tomorrow, if it has passed) |
| `daily`, `every mon`, `every mon and thu`, `every 2 weeks`, `every 15th`, `every last fri`, `every weekday` | A repeat, counted from the due date |
| `every! 3 days`, `every! week` | A repeat counted from when you finish it |
| `!high`, `!h`, `p1` · `!low`, `p3` | Priority |

Every word it recognised shows as a chip under the line — tap a chip to put
those words back into the title. **Enter adds the task and keeps the sheet
open**, so you can add five in a row; the last three are listed as you go. On
Today a task is dated today unless you say otherwise; on a frequency page it
joins that frequency.

**A title can say "Daily" and stay a title.** "Daily standup", "Weekly review"
and "Buy sun cream" stay as they are: words that are as often part of a title
as a date — daily, weekly, sun, sat, wed, weekend — only count where they stand
on their own, at the end of the line ("Review finances weekly") or after a word
like "on", "this" or "every".

Quick add never sets a reminder; add one in the editor.

### Creating and editing a task

A task has a title, a frequency, an optional due date and time, a reminder, a
priority, and optionally a repeat, notes and a checklist.

**Priority is a coloured dot with its word** — high, normal or low — on every
open card. All three are shown, because they are a scale and a scale you can
only read one third of is not a scale.

**Notes and a checklist** live on the task itself. Ticking a step saves at
once. On a repeat, **every new occurrence starts with all its steps unticked**.

### Repeating tasks

Turn on **Repeat** and completing the task brings the next one round. The
editor offers:

- **Every** 1 to 99 days, weeks, months or years.
- **Weekly**: on chosen weekdays (Mon–Sun, or Weekdays).
- **Monthly**: a day of the month (or the last day), or a weekday — the 1st to
  4th, or the last.
- **Next one counted from**: **Due date** or **When done**.

A plain-English line sums it up — "Every week on Mon, Thu", "3 days after each
completion" — with the next three dates under it.

Here is the part worth understanding, because it is where most repeating-task
systems get it wrong:

> **By default the next date counts from the task's own due date, never from
> when you ticked it off.**

Say a weekly task is due every Monday and you do not get to it until Thursday.
Anchoring to your completion would make the next one due the following Thursday,
then the Saturday after that — a habit you keep imperfectly would slowly slide
across the calendar until it bore no relation to when you meant to do it.
Anchoring to the due date means **a Monday task stays a Monday task**, no matter
when you actually got to it.

**When done** exists for the other kind of task — water the plants three days
after you last did, not every third calendar day. That is what `every!` sets in
quick add.

Three more rules:

- **An overdue repeat comes back in the future.** The next date is the first one
  on the schedule after today, however late the tick. In v2 a daily task three
  weeks overdue came back still overdue, and took about twenty-one ticks to
  catch up.
- **Month-ends hold.** A task due on the 31st is due on the 28th in February and
  back on the 31st in March. The day you chose is stored separately from the
  date it falls on, so one short month cannot drag it to the 28th forever.
- **Priority is not carried over.** It described how urgent *that occurrence*
  was. Something you flagged urgent once should not be urgent forever.

Completing is a soft-complete: the finished task stays, and a new one is
created, so your history is intact.

**A streak** — a flame and a number — shows on a repeating task once you have
done it on schedule twice in a row. A skip neither adds to it nor breaks it;
letting one pass undone resets it. Open a repeat's editor for its **History**:
in a row, best, done, skipped, and a month calendar.

### Reopening

Un-ticking a completed task reopens it and **removes the next occurrence** its
completion created, as long as you have not touched that one. That path exists
to undo a mistaken tap, which is not the same action as completing something —
in v2 it left the successor behind, and you ended up with two.

### Task reminders

Give a task a **time**, then a **reminder**: at the time, or 5, 15 or 30
minutes, 1 hour or 1 day before. None is the default. A dated task with no time
gets no reminder — a reminder needs a moment — and the editor says so: "Add a
time to be reminded. The daily digest covers the rest."

The notification is the task's title, with "Due 7 pm" (and the repeat, if any),
and two buttons: **Done** and **Snooze 30 min**. Tap it to open the task.

**Plan your day** is an optional morning notification: "2 overdue · 5 today".
Turn it on from the bell at the top of Tasks; it is off until you do, and set to
8:00. Days with nothing due are skipped. Tap it to open Today. The digest's
settings are kept on the phone.

### Tasks on the website

- **Group by** Frequency, Due (Overdue, Today, Tomorrow, This week, Later, No
  date) or Priority, and show Open, Done or All. Each column shows how many of
  its tasks are overdue.
- Filters for priority, due date and repeat, and a search over titles and notes.
- A **quick-add bar** at the top, with the same reading of dates, times, repeats
  and priority as the phone.
- **Board** or **Calendar**: the calendar projects each repeat forward, faintly,
  so you can see where it falls; click a day for its tasks and to add one there.
- Hovering a card shows **Skip this time** (repeats), **Edit** and **Delete**.
  Completing and skipping show the same Undo toasts as the phone. Reschedule,
  Won't do and a repeat's history are phone-only.
- In the dialog, checklist ticks are saved with **Save**.

**Dragging** works while the board is grouped by frequency.

- **Across columns** changes the task's frequency. That is what the columns
  *are* — a weekly task dragged to Monthly now recurs monthly. Its due date is
  untouched: when it is due has not changed, only how often it comes back.
- **Within a column** sets the order by hand, and that order is **stored, not
  local**. A board arranged in this browser that disagreed with this same board
  on another machine would be worse than no ordering at all.

A card only starts moving after a few pixels of travel, so a click still opens
the editor. Keyboard works too: tab to a card, press space to lift it, arrow
keys to move, space again to drop. If a move fails to save, EIO says so and
reloads the board from the server. A card that stayed where you dropped it after
the write failed would be a lie you would only find on the next refresh.

---

## Notes

Three kinds of note, one place.

On the phone there are four tabs — **Notes, Inbox, Lists, Journal** — and you
swipe between them. Notes holds notes and checklists; Lists shows only your
checklists, which is the tab you want when you are standing in a shop. The
website has a **Show** list instead: Everything, Inbox, Notes, Checklists,
Journal, Archive and Trash, each with a count.

### Quick capture

The fastest path from a thought to it being saved. Type, save, move on — no
title, no tags, no decisions.

**On the website the capture box is always on screen and always focused**, so
capturing is one keystroke (Ctrl/Cmd+Enter saves). On the phone it is the **+**
on the Inbox tab, or the small lightning button on Notes and Lists, because
there is no room for a permanent box.

Anything captured this way lands in the **Inbox**.

### The Inbox

The Inbox is not a folder. It is a *state*, worked out from the note itself:

> A note is in the Inbox when it has **no title and no tags**.

Give it either one and it leaves, automatically. Nothing to file, no button to
press. This is why the same rule applies whether you are creating or editing — if
the two disagreed, a note could be filed on save and back in the Inbox the next
time you opened it.

**Pinning or colouring a note does not file it.** Those are about how you see a
note, not about whether you have dealt with it. Archiving or trashing takes it
out of the Inbox, like everywhere else.

### Notes, checklists, journal

- **Note** — a title and a body. The ordinary kind.
- **Checklist** — tickable items, with a progress bar.
- **Journal** — an entry about a *day*. Journals are always filed under the date
  they are about, not the date you wrote them, so **backdating works properly**.
  Write up Sunday on Tuesday and it sits under Sunday.

Journals and checklists never enter the Inbox. You reached for them
deliberately, so choosing one is itself an act of filing.

**The + button** makes the current tab's kind: a note on Notes, a capture on
Inbox, a checklist on Lists, and on Journal **today's entry** — opening the one
you already started rather than making a second. Long-press **+** for all three:
Note, Checklist, Today's journal.

### Reading and editing

Opening an existing note puts it in **read mode**. Ticking a box there — on a
checklist, or a box in a note's text — **saves immediately**. The pin, a ⋮ menu
(colour, archive, Trash) and the **pencil** to edit sit at the top.

Everything else — renaming an item, adding one, changing the title — is behind
the pencil. A new note saves with **Save**, an existing one with **Save
changes**.

The split exists because of checklists. With a single mode everything was
buffered, so ticking an item and pressing back offered to *discard the tick* —
the wrong answer for the one gesture you perform most. Now a tick is not a
pending edit at all; it is already written before you leave.

Backing out of edit mode with unsaved changes still asks — "Discard this?" —
and that includes changing a note's **type** or a journal's **date**, not just
its text.

### Markdown

A note's text can carry simple formatting, shown formatted in read mode:

- headings (`#`, `##`, `###`), **bold** (`**…**`), *italic* (`*…*`);
- bulleted (`-`) and numbered (`1.`) lists, quotes (`>`), and links;
- **boxes** — `- [ ]` and `- [x]` — which you can tick in read mode, saved at
  once, just like a checklist.

Nothing else is interpreted; anything outside that list shows as you typed it.
While you type, a **formatting bar** sits above the keyboard — box, bullets,
numbers, heading, bold, italic, link — and the website has the same buttons plus
Ctrl+B and Ctrl+I. Enter continues a list; Enter on an empty item ends it. Card
previews show the words without the symbols.

### Checklists

In read mode, ticked items sink into a folded **"N ticked"** group, with
**Uncheck all** and **Delete ticked** — both undoable. The footer says it
plainly: "saved as you tick".

Unchecking is manual on purpose. A recurring list — a packing list, a weekly
shop — gets reused, and deciding when it starts again is your call, not
something that should happen on a timer.

On the website a checklist's card shows up to six open items you can tick
without opening it. On the phone, tapping a card opens it.

### Journal

The Journal tab adds three things above your entries:

- **A streak** — "12-day streak", with the last seven days as dots. Today still
  being unwritten does not break it.
- **On this day** — entries from this date in earlier years: "2 years ago · 20
  Oct 2024".
- **A prompt** — "A prompt for today", with a shuffle button and **Answer**,
  which starts today's entry with the prompt quoted at the top. It shows only
  until today has an entry, and stays the same all day.

### Pins, colours and the archive

- **Pin** a note from its header, or by selecting it. Pinned notes sit under
  **Pinned**, the rest under **Others**; the headings appear only once
  something is pinned.
- **Colour** — Red, Orange, Yellow, Green, Teal, Blue or Purple, shown as a tint
  with a stripe and its name. You can filter by colour on both clients.
- **Archive** — from a note's ⋮ menu: kept, but out of the tabs and search. The
  archive icon at the top of Notes opens the Archive; hold an archived note to
  open it, unarchive it, or move it to the Trash.

**Long-press a card** to select it: "1 selected", then tap others to add them,
and **Pin**, **Colour**, **Archive** or **Move to Trash** them together. Back,
or the ✕, ends the selection. Cards have no swipe actions, because the tabs
swipe.

### Trash

Deleting a note moves it to the **Trash**, with **Undo**. v2 deleted at once
and warned "This cannot be undone"; a mistaken delete is now one tap to reverse.

The Trash is the bin icon at the top of Notes (with a count), or Trash in the
website's Show list. Each note says how long it has left — "Deletes in 12 days".
Tap one to **Restore** it or **Delete forever**; **Empty** clears the lot. Those
two ask first, because they are permanent.

**Notes are deleted for good 30 days after they were moved to the Trash.** There
is no server job doing this: the purge runs whenever Notes or the Trash loads, on
either client, so a note can outstay its 30 days until you next open Notes.

Trashed and archived notes are left out of everything else — every tab, the
Inbox, tag counts, search, and the home tile.

### Searching and filtering

Search covers titles, bodies, tags **and checklist items**, so searching "milk"
finds the shopping list containing it, not just notes that mention it in prose.

- **On the phone**, search sits on the Notes and Lists tabs, with colour dots and
  tag chips under it.
- **On the website**, filter by **tag** — the list is built from the tags
  actually in use, with counts, so a tag you stop using disappears on its own —
  by **colour**, and by when a note was last **updated**, which is what you are
  reaching for when you cannot remember a note's name but know you touched it
  last week.

Notes has no reminders.

---

## Finance

A ledger of money in, money out — and, new in v3, money moved between your own
accounts.

On the phone, Finance has three tabs: **Month**, **Calendar** and **Budgets**
(which carries a badge when a budget is over). At the top: search, accounts, and
settings with export. **+** adds an entry.

### Accounts and the balance

Each entry can belong to an **account** — Bank, Cash, Wallet or Credit card. An
account starts from an **opening balance**: what it held, or what you owed on a
card, when you started logging. Its balance is that plus everything logged to it
since.

- **Balances are never stored.** They are worked out from the opening balance
  and the entries every time, so they cannot drift from the entries that make
  them.
- **A card is money you owe.** Spending on it adds to what you owe, and the
  Accounts screen lists cards under "Cards and money you owe".
- **The headline Balance** is what you have, minus what you owe on cards, plus
  any entries in no account. With no accounts set up it is exactly v2's figure:
  all income minus all expenses.

It is still the balance *of what you have told EIO about*. Set each account's
opening balance to what the bank said on the day you started, and it tracks the
real thing.

**Not in an account** collects entries from before accounts existed, and those
Subscriptions' Mark paid logged with no account. Open one and pick an account to
move it.

**Archive** an account to hide it from the pickers; its entries and its balance
stay. Only an account with no entries can be deleted, so its history is never
lost.

### Transfers

Moving money between your own accounts — an ATM withdrawal, paying a card bill —
is a **transfer**. Pick **Transfer** in the add form (From, To), use **Move money
between accounts** on the Accounts screen, or **Transfer** on the website. It
shows as one neutral row, "HDFC → Cash", with no plus or minus.

**A transfer is never money in or out.** Moving ₹2,000 from HDFC to your wallet
is not spending ₹2,000, and counting it would double-count every rupee you then
spend from the wallet. So transfers are left out of spending, income, the pie,
budgets and the month-on-month changes, and across all your accounts a transfer
nets to zero — the balance never moves when you shuffle money between your own
accounts.

A transfer is saved as its two halves in a single write, so it can never be
half-saved.

### Logging in two taps

- **The form starts where you left off**: the category and account you last used
  for that kind of entry.
- **A note you have used before brings back its category.** "Metro" was
  Transport last time, so it is Transport now — until you pick a category
  yourself.
- **Your most-used categories come first.**
- **Suggestions** under the note — "Swiggy · ₹250" — fill in the note and
  category, and the amount if you have not typed one.
- **Save & add another** keeps the kind, account, category and date, and clears
  the rest.
- **Pinned quick adds.** Turn on "Pin as a quick add" when adding an entry, or
  long-press an entry and pin it. It appears as a pill on the Month tab — "Chai
  ₹20 · Cash" — and **one tap logs it today**, with Undo. Long-press a pill to
  change it or unpin it.

**Long-press an entry** for **Edit**, **Log again today**, **Pin as a quick
add** and **Delete** (a transfer: Edit and Delete transfer). Logging again,
pinning and deleting all have Undo. Entries have no swipe actions.

### The month

The Month tab, top to bottom: the Balance; the month and its arrows; your quick
adds; **Spent** and **Received**; **Where it went**; the last six months; and the
entries, by day.

- **Where it went** — a pie of expenses by category, with bars you can tap for
  that category's month and its last six months. Income is excluded
  deliberately: a slice chart mixing money in and money out would be a chart of
  two opposite things.
- **Last 6 months** — in and out per month. **Months with no activity are shown
  as zero rather than skipped**, because skipping them compresses the gap and
  draws a line implying a steady trend across a period when nothing happened.

**The change against last month** sits beside each total: "+18% vs Sep",
"−₹450 vs Sep". It stays a neutral colour — spending more on groceries is not
an error.

- **Rupees, not percent, when last month was small** — under ₹500. Going from
  ₹45 to ₹450 would read "+900%", which says nothing useful.
- **A month still running is compared with the same days of the last one**: on
  20 October, with 1–20 September ("−12% vs 1–20 Sep"). Twenty days of October
  against all of September would always look like a drop.

### A month that starts on payday

In settings, **Month starts on** can be any day from the 1st to the 31st — set it
to your salary day, and a month runs from one pay to the next: "October 2026 is
25 Sep – 24 Oct". A start on the 16th or later names the month after the one it
mostly covers. A day past a month's end means its last day.

Totals, budgets and their pace, the six-month trend, the changes against last
month and the home tile all follow it. The Calendar tab stays a calendar month.
The setting is shared with the website.

### Budgets

Set a monthly limit for a category from the Budgets tab. Each budget is a bar
with a **line where you would be if you spread the limit evenly over the
month**, and the words that matter:

| State | Means |
| --- | --- |
| **On track** | At or under the line |
| **Over pace** | Past the line, under the limit |
| **Over budget** | Past the limit |

Under it: "₹2,340 left · ₹156/day for 15 days", or "Over by ₹600".

The line is the point. Sixty percent of a budget spent means nothing until you
know how much of the month has gone: it is fine on the 25th and a problem on the
5th.

Bars are sorted worst first, and the tab notes what you spent in categories with
no budget. Tap a bar for that category's month: its budget, its last six months,
and its entries.

### The calendar

Each day shows what it cost, tinted darker the more it cost against your usual
spending day, with a **+** where money came in. Tap a day for its entries and
**Add for 16 Oct**, which opens the form already dated. Days with only transfers
stay blank.

### Search

Search covers **every entry you have ever logged**, not just the month — notes,
categories, accounts, or an amount: "250" finds every ₹250. The results carry
their total: "23 results · ₹6,480 spent". Transfers are found, but add nothing
to it.

### Capture links (phone)

`eio://finance/add?amount=250&note=Swiggy&category=food` opens the add form
already filled in. It also takes `kind`, `account` and `date`. An automation app
you already trust — MacroDroid, Tasker — can turn a bank or UPI notification into
such a link, so EIO never has to hold Android's restricted permission to read
your notifications itself.

- **It never saves by itself.** The form opens as "Check and save", saying what
  it filled in and anything it dropped.
- **It warns about doubles.** If the same amount was logged in the last ten
  minutes: "Save this only if it is a second payment. One UPI payment often sends
  two alerts."

Links need the installed EIO app; Expo Go does not know the `eio://` address.

### CSV export

- **Phone** — settings, **Export as CSV**: **This month** or **Everything**, sent
  through the share sheet.
- **Website** — **Export CSV** downloads everything.

The columns are date, type, category, note, amount and account; a transfer's
halves are "transfer out" and "transfer in". The website's file carries the
marker that tells Excel it is UTF-8; the phone's does not, so for Excel, export
from the website if a note has anything beyond plain English text.

### About the money

Amounts are stored as whole paise, never as decimals. Floating-point arithmetic
cannot represent 0.10 exactly, and a ledger that drifts by a paisa per hundred
transactions is worse than useless. You type rupees; it stores paise.

### Finance on the website

**The charts sit in a rail beside the table** rather than stacked above it,
because the whole job of a ledger is reading a total against the rows that
produced it. Scrolling between the two loses the comparison.

- **Entries** or **Calendar**, filtered by kind (in, out, transfers), category
  and search; a search can cover **All time**.
- **Sort** by date, category or amount by clicking the column header. Sorting
  thirty visible rows by amount answers "what did I actually spend on"
  immediately.
- The rail: Balance, Out and In with their changes; **Budgets** — click one to
  narrow the table to that category; **Where it went** — click a category for
  the same; **Accounts**; and the last six months. The charts keep showing the
  whole month, because they are what you are reading the filtered rows against.
- **Transfer**, **New entry** (or `n`), quick-add pills, and the month start.

---

## Subscriptions

Everything that renews on its own.

On the phone, three views: **Upcoming**, **Calendar** and **Insights**. They are
tabs you tap rather than pages you swipe, because the strip of upcoming days
already scrolls sideways.

### The total

**"Costing you"** is every cycle normalised — tap **/ mo** to switch between per
week, month and year. A yearly ₹6,000 subscription counts as ₹500 a month. While
you type an amount, the normalised figures show live, because a yearly and a
monthly number are not comparable by eye.

Counted: active subscriptions, and cancelled ones still inside the access you
paid for. Not counted: **trials** (until you keep them), **paused**, ended and
archived ones, and foreign prices with no exchange rate set. Paused ones are kept
rather than deleted, so pausing something for a few months does not mean
re-entering it later.

### Upcoming

A **Next 14 days** strip — each day with its renewals and their total; tap a day
to narrow the list to it — then the list in sections:

**Overdue · This week · This month · Later · Trials · Paused & ending**, and a
fold for **Archived & ended**. Each header carries its count and total:
"This week 3 · ₹1,247".

Grouping by urgency rather than listing by date means the renewal you must
handle today is more prominent than the one due in November.

### Adding one: the catalogue

**+** opens a catalogue of 84 services — Indian ones first: video, music,
mobile, TV, cloud, AI tools. Picking one fills in its name, brand colour,
category, usual cycle and a manage-or-cancel link — **everything but the price**,
which is yours to type. **Add your own** for anything not listed.

Each subscription shows as a tile in its brand colour with a monogram — no
logos.

- **Cycles**: Monthly, Yearly, Quarterly, Weekly, 28 days, 84 days, One-time, or
  **Every…** N days, weeks, months or years. The 28- and 84-day cycles are for
  Indian prepaid packs.
- **Currency**: rupees, or USD, EUR, GBP, AED, SGD, AUD or CAD with a rate you set
  by hand. Without a rate a foreign subscription is left out of the totals rather
  than guessed at. Mark paid always logs rupees.
- **Charged to** — a Finance account — and **Billed through**: Card, UPI
  AutoPay, Google Play, Apple, Net-banking mandate, Wallet, or Paid by hand.
- **How to cancel** — the manage link and your own notes ("cancel in the Play
  Store, not the app"), so the day you want out you know where to go.

### Its life

A subscription is **Active**, on **Trial**, **Paused**, **Cancelled** or
**Archived**. Long-press it, or open it, for its actions:

- **Pause** — optionally with a **resume** date. Out of the totals while paused;
  with a date, its next due date becomes that day.
- **Mark as cancelled** — with **Access until**: it stays in your totals until
  then, and no renewal reminder fires.
- **Archive** — out of the way, out of the totals.
- **Delete** asks first, and offers **Archive instead**. It deletes the price
  history; payments already logged to Finance stay there.

Each change has **Undo**.

### Free trials

Tick **This is a free trial**, with **Trial ends on** and **Then costs**. A
trial is not in your totals until you keep it, and it reminds you 3 days and 1
day before it ends, and that morning.

From its end date the row asks **Keep it or cancel?** **Keep it** makes it active,
first charged on the trial's end date. **I cancelled it** ends it on that day.

### Mark paid

**Mark paid** appears on a row due within a week or overdue, in its menu, on its
page, and on its reminder. It opens a sheet: the amount charged, **editable** —
GST, a foreign-exchange charge, a price rise — the day, and the account it came
from. Then it does two things: it moves the due date forward one cycle, **and it
logs the expense to Finance**, against that account, under the subscription's
own category and name.

That second part is the point. Subscriptions are the expenses people forget to
record, and this is the one action that keeps the ledger honest without you
thinking about it.

The next due date counts from the old due date, never from today, so paying a
few days late does not move your renewal day.

The order matters and was chosen deliberately. The date is advanced *first*, the
expense logged *second*:

- If it advanced first and logging failed, you tap again and the due date moves
  one cycle too far — **visible, and fixable by editing the date.**
- If it logged first and advancing failed, you tap again and log a **second**
  payment — a phantom expense that silently corrupts every monthly total.

A wrong date is an annoyance you can see. A duplicated expense is bad data you
probably will not notice. So if the ledger write fails, EIO tells you exactly
that: "Due date moved, but Finance did not get it". Undo takes the payment back
out of Finance and puts the date back.

### Price history

Changing the amount — in the editor, or with **This is the new price** in Mark
paid — records a price change. After a rise, the row carries an **↑** badge with
the percentage for 60 days. A price change can be removed from the
subscription's page, after a confirmation.

### Renewal reminders

Phone only — see [Reminders](#reminders-and-notification-buttons).

- Choose any of **14, 7, 3 and 1 days before**; **on the day** is always
  included. The defaults are 3 days and 1 day before, at 09:00.
- The bell at the top of Subscriptions sets the defaults ("Renewal reminders").
  Each subscription can use **My defaults**, **Its own**, or **Off**.
- The reminder reads "Netflix renews tomorrow · ₹649", with the due date and the
  account, and a **Mark paid** button. A trial's reads "Spotify trial ends
  tomorrow", with **Keep it** and **I cancelled**.

**Why the day itself always gets one.** v2 had one reminder three days ahead,
and dropped it when that moment had already passed — so the subscription closest
to renewing got nothing at all. Now every chosen moment still ahead is
scheduled, and the floor is the morning of the day.

Cancelled, archived and overdue subscriptions get no reminders, and neither does
one paused without a resume date. One paused *with* a date is reminded that it
resumes.

### Insights

**Week**, **Month** or **Year**: what was paid and what is still due, the next 30
days, and bars **by category** and **by account**, each labelled "42% · ₹2,340".
Below them, **a year of each**: what every subscription costs you per year.

### Subscriptions on the website

The same sections and Next 14 days strip, as **List**, **Calendar** or
**Insights**, with filters for state, category and account — and the headline
figures follow the filters. Everything can be done there except firing
reminders: adding from the catalogue, Mark paid, pausing, trials, price changes,
and the reminder settings, which the phone picks up the next time it starts.

---

## Fitness

A real training log, built to answer one question: **is this going up?** In v3
it also knows that "up" means something different for a barbell, a pull-up and
a plank.

### Gym and Calisthenics

At the top of Fitness is a **Gym | Calisthenics** switch. It is a *lens*, not a
second module: underneath there is one exercise library, one log and one set of
records, and the switch only decides what is shown first and what new things
start as.

| | Gym | Calisthenics |
| --- | --- | --- |
| Third tab | **Exercises** — the library | **Skills** — your ladders, with the library a toggle away |
| Exercise lists and pickers | Gym exercises | Calisthenics exercises |
| Routines listed | Gym routines | Calisthenics routines |
| A new exercise starts as | Weights | Bodyweight |
| A freestyle session is | A gym session | A calisthenics session |

An exercise set to **Both** shows in either, and a bodyweight exercise you add
is Both from the start: a pull-up is a pull-up whichever day it is on.

**How a set is logged is decided by the exercise, never by the mode.** A pull-up
logs the same way on a gym day and a calisthenics day, and one session can mix
the two — weighted pull-ups on a gym day are fine. The **Log** tab shows every
session in either lens, each marked with its mode by icon and word, because your
training history is one history.

The switch is remembered on the phone (and, separately, in each browser): it is
about what you are doing there and then, not a setting of your account.

The four tabs are **Log · Routines · Exercises** (or **Skills**) **· Body**,
swipeable on the phone.

### The Log tab

- **Last 7 days** — sessions, kg moved, the **streak**, and how many rest days
  since your last session. **Tap any day** to open what you logged, or to log
  that day if you did not.
- **The month calendar** — a dot on every day you trained, and a small square in
  the corner on a calisthenics day. Tapping a day does the same as the strip.
- **History** — every session, newest first. Tap one to open it; its **⋮** has
  **Repeat it today** (a new session today with the same exercises), **Save as a
  routine**, and **Delete workout**, which confirms because every set goes with
  it.
- **+** starts a workout: **Freestyle**, or one of this mode's routines.
  Long-press it for a past day.

**The streak counts weeks, not days.** A daily streak breaks on every planned
rest day, so it punishes you for following your plan and rewards training
through fatigue. A week with at least one session keeps it going, weeks start on
Monday, and the week you are in does not count against you until it is over.

### A session, start to finish

The session is created the moment you start it, before anything is logged, and
it takes a snapshot of your latest weigh-in for bodyweight volume. From a
routine, its exercises are already laid out; a freestyle session starts empty,
and **Add exercise** lists this mode's library.

**The screen stays awake** while a session is open. A phone that locks between
every set is the most common complaint about gym loggers.

Across the top: **Duration · Volume · Sets** and **Finish**. Below that, the
**Workout date**, then a card per exercise, then **Notes** for the whole
session. The bin in the header deletes the workout, after asking.

#### The set table

Each exercise is a card with a table:

`SET · PREVIOUS · KG · REPS · ✓`

— **LOAD** instead of KG for a bodyweight exercise, **TIME** instead of REPS for
a held one.

- **PREVIOUS** is the matching set from the last time you did this exercise:
  "60 × 8", "× 12", "8 · +10", "45s". Tap it to copy its values into the row.
- **Ghost values** sit faint in the empty cells: the routine's target if there
  is one, otherwise last time's numbers. **Tick a row with its cells empty and
  the ghosts are what is saved**, so "same as last time" is one tap per set.
- **✓ saves the set at once.** The row takes the completed tint with a filled
  check, the set is checked for records, and the rest timer starts. Tick it
  again to untick: the set is deleted and its values come back to edit.
- **Swipe a row left** to delete it, with **Undo**. **Remove set**, in the set's
  sheet, does the same without the gesture.
- **Add set** under the table adds a row.

A row with nothing typed and no ghost will not tick, and says why — "Enter the
reps first".

A card starts with as many rows as the routine's target sets; without a routine,
last time's sets, warm-ups included; for an exercise you have never done, one.
Rows you have not ticked live only on the screen — ticking is what saves — so
leaving and coming back rebuilds them the same way and loses nothing. **Nothing
waits for Finish**: if the app is killed mid-workout — not a remote possibility
in a gym — every ticked set is already saved.

**Why PREVIOUS is the last time you did *that exercise*.** Not the last session,
and not the last time you ran this routine: the most recent other session that
had this exercise in it, on or before this one's date. That is the number you
are trying to match or beat, whatever day it was done on. Two details keep it
honest:

- **Warm-ups are matched with warm-ups, and working sets with working sets**,
  each in order. Add a warm-up today and your first working set is still
  compared with last time's first working set, not with the set before it.
- **"On or before this session's date"** means a past day you are filling in
  compares with what came before that day, not with something you did after.

#### Set types and effort

Tap the **set number** for its sheet:

| | Type | Meaning |
| --- | --- | --- |
| **W** | Warm-up | Not counted in volume or records |
| **1, 2, 3…** | Normal | A working set |
| **F** | Failure | Taken to failure; may record 0 reps |
| **D** | Drop set | Straight after the last, no rest |

Only normal sets are numbered, so 1, 2, 3 are always your working sets whatever
warm-ups came before them. A failure set is the one set allowed to record 0
reps: a failed attempt is still information.

The same sheet has **Effort (RPE)** — 6, 7, 7.5, 8, 8.5, 9, 9.5 or 10; "10 is
nothing left, 8 is two more reps in the tank"; tap again to clear — and, on a
bodyweight exercise, **Clean set**: good form, which is what counts toward a
ladder level-up.

#### The exercise's card

- **Its name**, in the accent colour, opens the exercise's page.
- **The rest chip** (a timer and "1:30", or "Off") sets its rest time.
- **⋮**: Move up · Move down · Superset with… · Replace exercise · Add warm-up
  sets · Plate calculator (weights exercises) · Rest time · Remove exercise.
- The exercise's **pinned note**, with a pin icon, shows every session — "seat
  on 4". It is set on the exercise's page. Below it, a **note for today**.
- A **target chip** appears when today's ghosts differ from last time on
  purpose (next section).

**Replace** works only until something is logged in that card ("Replace (only
before logging)"); after that it would rewrite what you did. **Remove exercise**
with sets logged asks first, and says how many sets go with it.

#### Next-session targets

The ghosts are not always a copy of last time. EIO suggests the next step —
double progression — and says why in a chip on the card:

- **Weights, in a routine with a rep range:** once every working set last time
  reached the top of the range, the ghost weight goes up by the routine's
  increment (2.5 kg unless you set another) and the reps go back to the bottom:
  "+2.5 kg · every set hit 12". Until then the weight stays.
- **Bodyweight reps:** one more than your best at the hardest load you used —
  "+1 rep".
- **Holds:** five seconds more than your best — "+5 s".
- **After more than 14 days away:** repeat last time instead — "Back after 20
  days · same weight". Strength fades over a break, and a missed rep is a bad way
  to come back.

Targets apply to working sets only, never to warm-ups or drop sets.

#### The rest timer

Ticking a set starts the rest timer by itself: a bar floating above the bottom
of the screen with **−15 · time · +15 · Skip**.

- Rest is set per exercise with the rest chip — Off, or 0:30 to 5:00 — and is
  **90 seconds** until you choose. A change is **remembered on the exercise**,
  so the next session starts there.
- **No rest before a drop set**, which follows straight on. In a superset, rest
  comes only after the last exercise of a round.
- When it ends: a vibration if EIO is open, and a **Rest over** notification with
  sound, which is what reaches you with the phone in your pocket. EIO asks for
  notification permission the first time a rest timer runs, when the reason is
  obvious.

**It keeps the time it ends, not a countdown.** Lock the phone or switch apps
mid-rest and it is right the moment you look; timers get throttled in the
background, a clock does not. Skipping or changing it moves or cancels the
notification. (Expo Go cannot schedule notifications, so there it only
vibrates.)

#### Holds: the hold timer

For a held exercise — plank, dead hang, L-sit — **the timer is the input**. Tap
the TIME cell and the dial opens:

1. The goal is in the middle: the routine's target or last time's, 30 seconds if
   neither. Adjust it with **−5** and **+5**.
2. **Tap the dial.** A 3-2-1 lead-in, which does not count, then it counts up.
   The ring fills toward the goal and carries on past it in a second colour —
   "Past your goal".
3. **Tap again to stop**, then **Save** (the seconds become the set, ticked) or
   **Again**.

Under the dial: **Goal · Best · Last**. You feel a tap on each count, every five
seconds, and a distinct cue at the goal. **Say the count out loud** adds a voice,
for when your hands are busy and the phone is on the floor; **Tick every 5
seconds** can be turned off. Both are remembered on the phone. Timed it some
other way? **Type the seconds** and Save.

Like the rest timer, it runs from timestamps, so a dropped frame or a locked
screen cannot cost you a second.

Held sets are left out of the session's volume: volume is kg × reps summed, and
seconds are not that. A hold is tracked by its longest time instead.

#### Bodyweight exercises: added weight, assistance and bands

On a bodyweight exercise the LOAD cell is a chip — **BW** for plain bodyweight,
**+10** with a vest or a belt, **−20** with assistance, or a band's name. Tap it
to set **Added weight (kg)**, **Assistance (kg)** or a **Band**; picking a band
fills in the assistance from that band's figure. **Bands** in the same sheet
opens your list of bands: a colour, a name, and **roughly how much it helps
(kg)**.

So one exercise goes assisted (−20) → bodyweight → weighted (+10) without
becoming three exercises, and its history and records follow it the whole way.

**Why a band needs a kilo figure.** Records compare assisted sets by how much
help they had. A band with no figure would count as no help at all and could
outrank honest work. A rough guess is enough: it only has to put your bands in
order. Deleting a band keeps the assistance on the sets that used it; they just
stop naming it.

**Volume counts your body, too.** For a bodyweight set it is the session's
weigh-in snapshot times the share of your body the movement lifts (a push-up is
about 0.65; set it on the exercise's page), plus added weight, minus assistance.
With no weigh-in on record only the added weight counts — EIO never invents a
bodyweight.

#### One side at a time

An exercise set to **One side at a time** (on its page) gets a left and a right
row for each set, marked **L** and **R**.

A left and a right are **one set**. A routine that asks for 3 sets of a lunge
gives you three L/R pairs, the summary counts three, and **Update routine**
saves 3, not 6. Warm-up sets come in pairs too: L1 R1, L2 R2.

#### Supersets

**⋮ → Superset with…**, then pick the partner. The two share a letter (A1, A2)
and a coloured bar down the left, and the partner moves next to it. Ticking a
set jumps to the partner's next set **without** a rest; the rest timer runs only
after the last exercise of the round. **⋮ → Take out of superset A** undoes it.
A routine can carry superset letters, so the pairing is there when the session
starts.

#### Warm-ups and the plate calculator

**⋮ → Add warm-up sets**, on a weights exercise with a working weight, inserts
three W rows at 40, 60 and 80% for 8, 5 and 3 reps, each rounded down to a load
your plates can make and never below the empty bar. Otherwise it adds one empty
warm-up row.

**⋮ → Plate calculator** (on weights exercises counted in reps) opens with the
card's working weight:

- The bar drawn with its plates, heaviest innermost, each labelled with its
  weight, and the words: "Each side: 25 + 15 kg".
- When your plates cannot make the weight, the closest load below it: "Your
  plates cannot make 101 kg. Closest: 100 kg."
- The warm-ups for that weight, with the plates for each.
- **Your bar and plates**: the bar's weight, and how many *pairs* of each plate
  you own — a 20 kg bar and four pairs each of 25, 20, 15, 10, 5, 2.5 and 1.25
  until you change it. Kept on the phone.

**It searches every combination you own** rather than piling on the heaviest
plate first. With one pair of 20s and two pairs of 15s, 30 a side is 15 + 15,
which "heaviest first" never finds. On a tie it uses fewer plates.

#### Finishing, and the summary

**Finish is optional and never gates saving.** Every set was saved when you
ticked it. Finish stamps the end time and opens the summary; a session you never
finish simply ends at its last set. Once finished, the button reads
**Summary**.

The summary is one page:

- **Workout #N**, with the date and routine, and four tiles: Duration · Volume ·
  Sets · Records.
- **Records** set today, each with what it beat: "Heaviest weight · 100 kg (was
  97.5 kg)".
- **Ladder level-ups**, if you earned one (see [Skills and
  ladders](#calisthenics-skills-and-ladders)).
- **vs last time you did** *the routine* — each exercise marked **Better**,
  **Lower**, **Same** or **New**, with its best set, last time's best, and the
  difference in volume.
- **Update** *the routine*? — if you strayed from it, the changes in words ("You
  added Dips", "You did 4 sets of Squat instead of 3", "You skipped Rows"), with
  **Update routine** or **Keep it**. Skipped exercises stay in the routine.
- **Done**, or **Reopen workout** to carry on logging.

**Why two different "last times".** The set table compares each exercise with
the last time you did *that exercise*, wherever it was. The summary compares
with the last time you did *this routine*, because the question after a workout
is whether today's Push day beat the last Push day — like with like. A freestyle
session has no routine, so it has no such section.

### Personal records

A record is announced with a toast and a vibration, and a **trophy** appears
beside the set number. Records are worked out again whenever a session opens,
so the trophies are still there next time you look.

What counts depends on the exercise:

| Exercise | Records |
| --- | --- |
| Weights | **Heaviest weight**; **Heaviest for N reps**; **Best est. 1RM** (sets of 12 reps or fewer); **Best set volume** |
| Bodyweight, reps | **Most reps** at the same or a harder load; **Most added weight**, or **Less assistance**, for at least as many reps |
| Held | **Longest hold** at the same or a harder load |

**Why by type.** A record used to mean one thing: a heavier weight at the same
rep count. On a bodyweight exercise the weight is always 0, so eleven pull-ups
for the first time could never be a record.

**Why "the same or a harder load".** Bodyweight sets are compared by *net* load:
added weight minus assistance. An assisted set is easier than an unassisted one,
so it can never outrank one — twelve band-assisted pull-ups do not beat ten
without the band.

The rules that make a trophy worth trusting:

- **Warm-ups never count**, neither as the record nor as what it is measured
  against.
- **The first set at a measure is not a record.** With nothing comparable before
  it, it beat nothing, and everything would be a record on day one.
- **Strictly greater.** Equalling your best is not a new one.
- **The bar to beat is your other sessions.** Within one session a record is
  announced once, on the set that first sets it, so three sets at a new best do
  not fire three toasts — and a light back-off set is never judged against
  today's top set.
- **The estimated 1RM stops at 12 reps**, where the estimate stops being fair.

### Exercises and the exercise page

The **Exercises** tab (in Calisthenics, **Skills → Library**) is this mode's
library, browsed by region — **All, Chest, Back, Shoulders, Arms, Legs, Core,
Other** — and grouped by muscle within. **Add an exercise** sits at the top: a
name, **Measured in** Reps or Time, **Load** Weights or Bodyweight (starting at
the mode's default), and a muscle.

The muscle list is deliberately **short — eleven tags**:

| Region | Tags |
| --- | --- |
| Chest, Back, Shoulders, Legs | one each |
| Arms | Biceps, Triceps, Forearms |
| Core | Abs, Lower back |
| Other | Cardio, Full body |

It once had twenty-two — upper/mid/lower chest, quads, hamstrings, glutes, three
separate delts. That is a coaching textbook's vocabulary, not one you use while
picking an exercise: **a list you have to think about before tagging is a list
you will tag wrong.** Arms and core still split, because those are genuinely
different sessions.

You cannot delete an exercise you have logged sets against. That history is what
every record is measured from, and EIO says so rather than showing a database
error.

Tap an exercise — here, or its name in a session — for its page, in four tabs:

- **Summary** — a chart of one measure at a time, chosen by chips (for weights:
  Est. 1RM, Heaviest, Best set, Volume, Total reps; for bodyweight: Most reps,
  Added kg, Total reps, Est. 1RM (with body); for holds: Longest hold, Total
  time) over **1M, 3M, 1Y** or **All**. One point per session; tap a point for
  that day's sets.
- **History** — each session's sets.
- **Records** — your best of each kind, with the day. For weights, a **rep-max
  table**: for 1 to 12 reps, your actual best beside the estimate from your best
  1RM. Where the estimate beats the actual, a record is waiting.
- **How-to** — your own notes on form; the **pinned note**; and how it is logged:
  Reps or Held, Weights or Bodyweight (with the share of bodyweight it lifts),
  **One side at a time**, **Shows in** Gym / Calisthenics / Both, and equipment.

**Why the first chart for weights is estimated 1RM, not weight.** Ranked by
weight alone, dropping the reps would always look like progress — 110 kg × 1
would beat 100 kg × 8, which is not how training works. The estimate makes sets
at different rep counts comparable.

### Routines

A **routine** is a template. It logs nothing itself; it lays out a session so
you are not picking the same six exercises every week. Deleting one never
deletes the training you did from it. The Routines tab lists this mode's
routines.

Each line of a routine is an exercise **or a ladder**, with:

- **Sets**, and an optional target range — **From** and **To**, in reps or
  seconds. The bottom is what you aim for first; the top earns the next step.
- **Rest (s)**.
- **+kg when earned**, on weights: how much the target rises when every set
  reaches the top of the range. 2.5 if left blank.
- A **superset** letter: None, A, B or C.

**A ladder line follows the ladder.** When a session starts it becomes whichever
rung you are on, aiming from that rung's restart point up to its goal, so a
calisthenics routine written once never needs editing as you progress.

Two other ways to get one: **Save as a routine** from a logged session's **⋮**
(its exercises, set counts and the rep range you actually did), and **Update
routine** on a summary.

### Calisthenics: skills and ladders

In Calisthenics the third tab is **Skills**. It opens on **Ladders**, with
**Library** a toggle away.

A **ladder** is the path to a skill, one variation at a time: tuck, advanced
tuck, straddle. Each **rung** is an ordinary exercise from your library with a
goal — sets × reps or sets × seconds, optionally with added weight. Because each
rung is its own exercise, its history and records keep working. Without ladders,
moving to a harder variation just looks like your reps collapsed.

**The Skills tab** groups ladders by family — Push, Pull, Legs, Core, Balance,
Statics, Other. Each card reads "Step 4/7 · Advanced tuck", with a ring showing
how close your recent sessions came to that rung's goal, and **Ready to move
up** or **Paused** when either applies. Below them: **N steps mastered**, and
your latest moves up, dated.

**A ladder's page** shows "Step 4 of 7" and a bar of its rungs:

- **Mastered** — a check, and the day you moved up from it.
- **Current** — its goal and your best attempt, **Train** (starts a calisthenics
  session today with this rung in it) and **Move up**.
- **Locked** — dimmed, with a lock.

Every rung you have trained shows its **best ever** under its goal — "Most reps
12 · 3 Oct", or "Longest hold 45s · 3 Oct" for a held rung. Only clean
working sets count: a warm-up or a band-assisted set is not the rung itself,
though added weight is. Once you have moved at least once, a **Progress** card
draws your step on the ladder over time.

Tap any rung for **Make this my current rung** or **See its history**. The
page's **⋮** has **Edit ladder**, **Step back**, **Pause (injury, travel,
deload)** and **Delete ladder**, which keeps every set you logged. Every move
has **Undo**.

**Building one:** **New ladder** → a name, a family, the level-up rule, and the
rungs — each an exercise, **Sets**, reps or seconds each, an optional **+kg**,
**Restart at** (where you begin when you first move onto it), and a cue for what
a clean rep looks like there.

**In a session**, a ladder exercise's block shows where it sits — "Front lever
· 2/4" — between **‹** and **›**. They swap the block to the easier or harder
rung **for today only**: a bad day, or a good one. The ladder itself does not
move. They work while nothing is logged in that block yet, and not onto a rung
that is already in the session.

**"Ready to move up?"** After a session that trained a ladder's current rung,
the summary asks — "Pull-up ladder: ready for Archer pull-up?" — with **Move
up** and **Not yet**, once the rung's goal was met in **2 of the last 3**
sessions on it (or **1 session**, if you set the ladder that way). Only sets
that prove the rung count: working sets, marked **clean**, **not assisted**, and
carrying the goal's added weight if it has one.

**It never moves you on its own.** Moving up is always your call; apps that move
people silently are the ones people complain about. A paused ladder does not ask
at all.

**Mastered is worked out, not stored.** Everything before your current rung is
behind you; everything after is locked. Step back and the later rungs lock
again, while their dates stay in the ladder's history.

### Logging a past day

Forgetting to log on the day is the normal case, not the exception.

- **Tap the day** in Last 7 days or on the calendar. If you trained it, it opens;
  if not, it starts a session dated that day. The day you missed is already on
  screen, so pointing at it is the whole gesture.
- **Long-press +** for **Yesterday**.
- Inside any session, change the **Workout date**. Sets belong to the session,
  so the whole workout moves with it.

A past day's PREVIOUS column compares with the session before that day, as
above.

### Body

Weight, height, BMI and tape measurements.

- **One weigh-in per day.** Recording again replaces the day's entry rather than
  adding a second. Weighing yourself twice in a morning is normal; keeping both
  would make the trend jitter on nothing.
- **Height is stored once**, on your profile — it is a property of you, not of
  the measurement.
- **BMI is never stored.** It is calculated from your latest weight and your
  height every time. A stored copy would go stale while looking just as
  authoritative.
- **Measurements** — neck, shoulders, chest, waist, hips, body fat %, and left
  and right arm, forearm, thigh and calf. The card shows each site's latest value
  and its change since the time before, as "up" or "down" in words — no
  judgement either way: a bigger arm and a smaller waist are both just changes.
  **Add measurements** opens every site at once, with last values shown faintly;
  leave any blank. One entry per day. Tap a site for its chart.

You rarely measure everything at once, so each site's latest value is the most
recent day that measured *it*.

### Fitness on the website

The same model and the same rules — records, ghosts, targets, ladders, streaks
and summaries are the phone's own code, so the two clients cannot disagree about
what counts as a record. The website is where you plan and look back, and it
logs too. The Gym | Calisthenics switch and the four tabs are the same; the mode
is remembered per browser.

- **Log** — Streak, Rest, This week and Last 12 months across the top. **The
  year**: a heatmap of working sets per day over 53 weeks (warm-ups not
  counted), drawn as colour *and* the size of each square, with a legend in
  words; arrow keys move around it. Beside the history, a month calendar marks
  gym days with a dot and calisthenics days with a diamond. Pick a day on either
  to see it, or **Log a workout for** that day. **Start workout** offers
  Freestyle or this mode's routines.
- **A session** — the phone's set table, with "Last time *date*" over PREVIOUS
  and exercises added from a searchable list beside it. **Enter in a row's last
  field ticks it** and moves to the next set (in a superset, the partner's). RPE
  and "not clean" show in the SET cell. The pinned note is edited from the card's
  menu. Finish and the summary are the same.
- **No rest timer and no hold dial.** A card's rest is still set and stored, and
  holds are typed in seconds — the desk is not where you rest between sets.
- **Add warm-up sets** uses a standard 20 kg bar and plates, and says so,
  because your own plates are recorded on the phone.
- **Routines** list their lines, with **Start today**; the builder matches the
  phone's.
- **Skills** — the same ladders, plus a step chart of your position on each
  ladder over time and its history of moves.
- **Exercises** — the library and the exercise page, as on the phone.
- **Body** — weigh-ins with a chart and history, height and BMI, a measurements
  table with a chart per site, and your **bands**. Deleting a weigh-in or a day's
  measurements has **Undo**. The plate calculator stays on the phone, and the
  page says so.

A session, its summary, an exercise and a ladder each live in the page's
address, so Back and refresh behave.

---

## B-List

Your bucket list — 818 things across 61 categories to begin with, imported from
the standalone page that used to hold them in browser storage. A list kept in one
browser is a list you cannot tick off from your phone, and clearing that
browser's site data loses years of it.

### Sorted by cost, not by importance

The three tiers answer *what it takes to do the thing*, not how much you want it:

| Tier | Means |
| --- | --- |
| **No/low cost** | Doable this weekend for nothing |
| **Moderate** | Needs a bit of money or planning |
| **Big investment** | Needs saving for |

That is the question the list is organised around, so it is the question the
filters answer. The headline counts show **how many are left** at each tier, not
how many there were — a total that never moves is not progress. How much you
*want* something is a separate setting: [Now, Next, Someday](#now-next-someday).

### Ticking, and remembering

**Tap** to tick. It saves at once, and a bar follows for a few seconds: **Done ·
today**, with **Add memory** and **Undo**.

**Add memory** is all optional:

- **When** — Today, Yesterday, or **Earlier…**: a year, a month, or a day, as
  precisely as you remember ("Sometime in 2019", "Mar 2019").
- **What happened?** — a line is plenty.
- **Where**, and **Do it again?** — Yes, Maybe or No.

**Why "when" can be years ago.** All 818 things came in unticked, and many were
done long before EIO existed. Ticking one today and saying "2019" puts it where it
belongs in your timeline, without pretending to a day you do not know.

To add or change a memory later, tap the item in the Done view, or long-press
it. Untick by tapping again ("Not done · …", with Undo).

### Pick for me

At the top of To do, three things you could do, chosen for you:

- They follow your filters, and with no cost filter on they lean to **No/low
  cost** — shown as a chip you can clear. "What can I do for nothing?" is the
  question this list is best at answering.
- They stay the same all day; **Shuffle** for three others.
- **Not now** hides one from picks for 30 days, with Undo.
- Tap one to open it; **hold one to put it on Now**.

Done items, Now items and hidden ones are never picked.

### Now, Next, Someday

Each item has a **want** level — **Now**, **Next** or **Someday** — set in its
sheet ("How much you want it now"), separate from what it costs.

**Now** is a shelf at the top of To do, holding at most **five**. Adding a sixth
asks which to swap out ("Now holds 5"); the one you swap moves to Next. The shelf
is ordered by target, soonest first.

### Planning a Now item

A Now or Next item has a **Plan**:

- **When** — Someday, This year, Next year, a month, or a day. A target as
  precise as you actually are: "this year" is a real plan, and pretending it is
  14 March is not.
- **Steps** — a checklist that saves as you go; hold a step to move or remove
  it.
- **Estimate** and **Saved so far** in rupees: "₹38K to go · ₹3,200 a month
  reaches it by Oct 2027". With no target date, **What if I put aside** shows
  where a monthly amount gets you.

A target that passes is never shown in red. It says **Target passed · Move to…**,
with Next month, Next year or Someday. A bucket-list item is not overdue; it is
just not done yet.

### The Done view

Switch to **Done** and the list becomes a timeline of what you have lived, by
year and then month, newest first. Each year opens with a card: how many, the
split by cost, a strip of the twelve months, and the categories you did most.
Items dated only by year sit under "Sometime in 2019"; undated ones are gathered
on one card asking when — even just the year.

There is no strikethrough in Done. On a screen where everything is done it would
only be noise.

### Using it

Default view is **To do**, any cost. Opening a bucket list to a wall of things
you have already done is not what you came for.

- **Long-press** an item to edit or remove it (removing deletes its steps too,
  and asks first).
- **+** adds one. Category there is a text field with suggestions rather than a
  picker: typing narrows the categories that exist, and ignoring them makes a
  new one. A picker could not have done the second thing.
- Search covers the **category name too**, so "water" finds the whole Water
  Adventures section — and notes, memories and places.

Every category has its own icon, in headers, the filter and the chips.

### Filtering

The filters live behind the **Filter** button, which carries a count when any
are on: **Show** (To do, Done, All), **Cost to do**, **Want**, and **Category**.
Only the ones actually narrowing something stay on screen, as chips you can tap
to remove.

They used to all be on screen at once — including every one of the **61
categories** as a horizontal chip row. Reaching Winter & Snow Sports meant
swiping past sixty others with nothing to search and no idea what was coming,
and the controls took about half the screen before a single item appeared. In
the sheet the category list is vertical, searchable, and shows each category's
own progress, which is the thing you actually wanted to know.

The cost breakdown on the progress card is **also the cost filter** — tap "412
low" to see just those.

The percentage never rounds up to 100 while anything is outstanding. 817 of 818
is 99.88%, and showing "100%" next to an unticked item is the kind of small lie
that makes you stop trusting the number.

### B-List on the website

Pick for me and the Now shelf sit in a side rail; picks have a **Now** button
instead of a long-press. The stats across the top — Done, Free to do, Moderate,
Big, On Now — and dropdown filters for cost, want and category. The done bar has
the same Undo, and Ctrl/Cmd+Z works on it.

---

## Products

What you get through daily — whey, face wash, sunscreen, shampoo — and when to
reorder. Sorted by urgency, because the only reason to open this is to find out
what is about to run out.

### The list

The card at the top says how many to **reorder now** (or "stocked up for now"),
with how many are running low and how many spares are on the shelf. Each product
carries a chip:

| Chip | Means |
| --- | --- |
| **Reorder now** | It runs out within its lead time — 7 days unless you set another |
| **Running low** | Within the lead time plus two weeks |
| **Plenty left** | Further off than that |
| **Not enough data** | Not measured yet (below) |
| **Next one ready** | Low, but a spare is waiting |
| **Spare**, **Finished** | Not in use |

Set the lead time per product with **Remind me to reorder**: 3, 7, 14 or 21 days
before. Something you can buy round the corner needs less warning than something
that ships from abroad.

Expired products come first, then Reorder now, Running low, Not enough data and
Plenty left; spares and finished ones come last. Once you have a spare
or a finished container, a switch appears: **Unopened · In use · Finished**.
Finished containers are grouped by name — "Whey ×3" — each with its dates, how
long it lasted, its size and its price.

### Logging a use

- **Log use** on the row logs the usual amount for today. That is the thing you
  do every day, so it is a button on the row rather than something behind a tap.
- **Hold Log use** for **Today**, **Yesterday** or **Pick a day** (a calendar
  from the day it was opened, with dots on days already logged), the amount and a
  note.

The toast names the day — "Logged 5 g of Whey · Yesterday" — with **Undo**.
Naming the day confirms that a backdated log landed where you meant it.

### The Today checklist

Products you used on at least five of the seven days before today appear at the
top as a checklist. Tap one to log its usual amount ("Logged 5 g at 08:14");
tap again to take today's use back off. **Log all (N)** does the rest. The rows
stay in name order and do not move as you tick.

### The product's page

Tap a product for its page:

- How many days are left, the rate ("5 g a day · ₹12 a day"), and "Runs out
  around 3 Nov · reorder by 27 Oct".
- **Last 14 days** — hollow days have nothing logged; tap one to fill it in.
- **History**, by day. **Tap a use to edit it** — its day, amount and note — or
  **Delete this use**, with Undo.
- **Before this one** — how long your earlier containers of it lasted.

Give it a price and it works out what it costs you **per day**.

### The rate is measured, not assumed

The obvious way to do this is `total ÷ per_use` and call that the number of uses
left. That answers a different question: *how long if you never miss a day*. Days
get missed.

So it divides what you have **actually used** by the days since your **first
logged use**. The rate already accounts for the days you skipped, so the
projection degrades gracefully instead of being permanently optimistic.

**Why from the first logged use, not the day it was opened.** Days before you
started logging are days not logged, not days of nothing used. A tub entered with
its true opening date weeks back, and a first scoop logged today, would spread one
scoop over all those weeks — and project two thousand days.

**Per use** therefore does not drive the projection at all. It exists to pre-fill
the amount when you log a use, so logging is one tap.

### It will not guess from too little

Nothing is projected until a container has uses logged on **three different
days**. One use on the first day implies one-per-day, which for something you use
twice a week would call the bottle empty three times too soon — and a confident
wrong number is worse than "not enough data yet". Three days is the least that
tells a daily habit from a twice-a-week one.

Until then the product shows **Not enough data** — or, if an earlier container of
the same thing was finished, an estimate from how long that one lasted: "~42
days".

### Finishing and starting the next one

On the product's page, **Mark as finished…** asks when it ran out — today,
yesterday, or a day you pick — and says "It lasted 42 days. That becomes the next
one's first estimate." That is why the date matters. Then:

- **Finish and start a new one** — a copy, already filled in (name, size, usual
  amount, lead time, price — change it if it moved), opened today, starting with
  an estimate: "~42 days (last one lasted 42)".
- **Finish and open the spare**, if one is waiting.
- **Just mark it finished.**

A finished container is **kept, not deleted** — it is the record of how long that
one actually lasted. **Reopen this one** if you finished it by mistake.

You can have **one open container per name**. v2 allowed only one product per
name at all, so a second tub of the same whey could not be added; now the old one
is finished and the new one opened, and EIO stops you only from having two open
at once: "You already have an open Whey. Finish it first, or add this one as a
spare."

### Spares

A **spare** is one bought ahead, waiting unopened. Add it with **Add a spare** on
a product in use, or tick **Not opened yet** when adding a product. While a spare
waits there is nothing to reorder, so its product's chip says **Next one ready**
and its reorder reminder stays quiet. **Open it** when the time comes, and the old
one is marked finished.

### Expiry and once-opened

- **Expiry date** — written as printed: "03/2027" means the end of March 2027;
  full dates are day first.
- **Use within, once opened** — 3, 6, 12, 18 or 24 months, or not printed.

The use-by date is the earlier of the two. From 30 days before it, a second chip
appears — "Use by 3 Jan" — and then "Expired". When your pace and the date
disagree, it says so: **"At your pace this lasts 140 days; it expires in 90."**

### Reorder reminders

Phone only — see [Reminders](#reminders-and-notification-buttons).

- **The morning it crosses into Reorder now**, at 09:00: "Time to reorder Whey"
  — "About 7 days left at your pace, empty around 3 Nov."
- **On its projected empty day**, at 09:00: "Whey is about empty".

Each has **Ordered**, which adds a spare — so it no longer needs reordering — and
**In 3 days**, which asks again at 09:00 three days later. Tap one to open the
product. With a spare already waiting, the empty-day reminder just says your next
one is ready to open.

Reminders come only from a measured pace. They are rebuilt after every use you
log and every change, and on each launch; EIO asks for notification permission
when you save a product. A crossing that has already passed is not re-armed for
the next morning: the card is already showing it, and a reminder that came back
every morning would nag until you restocked. **In 3 days** is the way to be asked
again.

### Deleting

**Delete this product** is at the bottom of its edit screen, and it asks first,
because it is permanent: "Deletes 62 logged uses. To keep its history — and how
long it lasted — mark it finished instead." with **Mark finished** right there.

### Products on the website

**Unopened · In use · Finished · All**; **To reorder**, **Running cost** (a
month, at your rate) and **In use** across the top; search and a category filter.
Each row has buttons for Log use, its usage history, Add a spare, Mark finished,
Edit and Delete. Logging a past day happens in the usage dialog.

---

## Your own modules

The module builder is the part that makes EIO yours. It creates a working module
with no code and no database migration.

Good candidates: skills you are learning, books, films, a sleep log, places to
visit, plants to water. The rule of thumb:

> **Build by hand when a module needs to think. Use the builder when it just
> needs to remember.**

Finance needs to think — running balances, category maths, CSV escaping. A
reading list just needs to remember.

### Creating one

**Start from** a template — Books, Sleep, Plants, Films, Habits or Weight — or
Blank. A template only fills in the builder; nothing exists until **Create
module**, so change anything first.

Give it a name and a colour, then fields. Each field has a label, a type, and
whether it is required.

| Type | For |
| --- | --- |
| Text | Short answers |
| Long text | Paragraphs |
| Number | Quantities |
| Money | Amounts, formatted as currency |
| Duration | Hours and minutes; totals and averages like a number |
| Rating | Stars, 1 to 5 |
| Date | A calendar day |
| Yes / No | Something to tick off — tickable straight from the list |
| Choice | One from a fixed list you define |
| Tags | Several from a list you define |

### Defaults and one-tap logging

Each field can **fill in with** a default: **None**, **Fixed** (a value you
choose), **Today** (date fields), or **Last entry** — whatever your newest entry
said there. A value carried over from the last entry is marked **last** until you
type over it.

When a default is in use and no required field is left empty, **+ logs an entry
at once** — "Logged · …", with Undo. **Hold +** for the full form. A module you
log every day — sleep, weight, a habit — should be one tap, not a form.

### In the list

- **Yes / No fields** tick straight from the row, so a module works as a daily
  check-off.
- **What each row shows**: in the builder, **In the list** picks the title, the
  line under it, and what sits on the right — automatic until you choose.
- **Filter chips**: the options of your first Choice and Tags
  fields, your Yes / No fields ("Read" / "Not read"), and This week / This month
  when there is a date field.
- **Group entries by** a Choice, Yes / No or Rating field, with each group's
  count and total: "Reading · 3 · 412 pages".
- **Calendar**: a module with a date field gets a calendar view; tap a day for its
  entries, and **+** adds one on that day.

### The trend chart

A module with a Number, Money, Duration or Rating field shows a **trend chart**
above its list. In the builder's **Trend chart** section: which field, its
**Points** — each entry, or by day, week or month as a total or an average — and
**Smoothing**: off, or a 3- or 7-point average. Range chips — 1M, 3M, 1Y, All —
sit on the card, and tapping a point reads it out. The home tile shows the same
line, small. With no numbers to chart, there is no chart.

### Module reminders

Phone only — see [Reminders](#reminders-and-notification-buttons).

- **Remind me to log** — on the days you pick (every day, weekdays, or your
  own), at 20:00 unless you change it. **Skipped on a day that already has an
  entry**: a nudge to log what you have logged is noise.
- **Remind me on a date** — from a date field: on the day, or 1, 2 or 7 days
  before, at the nudge's time (or 9:00). Tap it to open that entry.

They are planned two weeks ahead and rebuilt on each launch and each time you
open the module, so the schedule never runs out. You can set them on the website
too; the phone picks the change up the next time EIO starts there.

### The one thing to know about renaming

Each field gets a **key** derived from its label when it is first created —
"Hours slept" becomes `hours_slept` — and that key is then **frozen forever**.

This means **renaming a field is safe.** Change the label to anything you like;
your data stays attached, because it was never stored under the label. If the key
were re-derived on every save, renaming a field would silently orphan every value
already recorded under it.

**Changing a field's type** is safe too, and EIO tells you what it will look
like first: "14 entries have a value here; 3 won't show as Number. Nothing is
deleted." Change it back and they reappear. **Removing a field** leaves its values
in your entries, with Undo.

### The tile statistic

By default a tile shows a count. You can make it show something better: the
**total** or **average** of a number field, or the **most recent** value of any
field — over **all time**, **this week** or **this month**.

Only sensible combinations are offered — you cannot total a date or average a
note, and offering it would produce a tile showing `NaN`. If a statistic ever
becomes uncomputable (you emptied the field, or changed its type), the tile
quietly falls back to a count rather than showing an error.

### Sort order

**Newest first** by default, or any field ascending or descending (except Yes /
No and Tags, which have no sensible order).

Blank values always sort **last**, whichever direction you pick. A blank is not
"smallest" — it is *unanswered* — and burying it under real data is right either
way.

Numbers sort as numbers. This sounds obvious and is the kind of thing that is
quietly wrong in a lot of software: sorting these values in the database would
compare them as text and put 100 before 9, which looks fine until you scroll.

The tile statistic, the sort, the chart and the row choices can all be set while
you build the module; they no longer wait for it to be saved first.

### Your modules on the website

A table rather than cards, with Yes / No cells you tick in place; **Log with
defaults**, **New entry**, search, **Table** or **Calendar**, and the trend
chart. **Click any column header to sort** — for that visit only: the order you
chose in the builder is a property of the module, and a click is not meant to
redefine it.

---

## Desktop-only conveniences

Things the website does that the phone cannot:

- **Everything at once.** Task columns, charts beside the ledger, a session's
  table beside its exercise list, a year of training as a heatmap.
- **Filters** on Tasks, Notes, Finance, Subscriptions, Products and the B-List.
  An applied filter is tinted so you can see why a list is short, and **Clear**
  appears only when something is actually on.
- **Sortable tables** in Finance and your own modules — click any column header.
- **Click a category** in Finance's breakdown, or a budget, to narrow the table
  to it.
- **Always-on quick capture** in Notes, focused when the page opens, and a
  quick-add bar in Tasks.
- **Sidebar navigation** — every module one click from every other, with your
  own modules listed underneath.
- **Keyboard.** `/` focuses the search box, `n` opens a new entry, `Esc` closes
  any dialog, and `Enter` saves most of them. `Ctrl`/`Cmd`+`Enter` saves quick
  capture, `Ctrl`/`Cmd`+`Z` runs a toast's Undo, `Ctrl`+`B` and `Ctrl`+`I` format
  a note, and in a workout `Enter` ticks a set. `/` and `n` are single keys with
  no modifier, so they are ignored while you are typing in a field or while a
  dialog is open. The shortcuts are listed at the bottom of the sidebar.
- **A collapsing sidebar.** Below about 1080px wide the labels drop and the icons
  stay, so navigation is still one click rather than hidden behind a menu.
- **A theme toggle** — light, dark, or follow your system.
- **Real browser things** — the page title follows the module, so several tabs
  are readable; back and forward work.

---

## Your data

- Everything lives in **your own Supabase project**. Not a service, not a
  company's server — a database you own and can log into.
- **Row Level Security** is on for every table, with policies requiring
  `user_id = auth.uid()`. The database itself refuses to return anyone else's
  rows. This is enforced server-side, not by the app being polite.
- Both clients ship a **public anon key**. That is by design and safe: on its own
  it grants nothing, because every policy requires a signed-in user.
- **Nothing is shared, uploaded or analysed.** There is no telemetry, no
  analytics and no third party.
- **A network connection is required.** Neither client caches for offline use.
- **Long histories are read in full.** The server hands back at most 1,000 rows
  per request, and quietly stops there; where a history can outgrow that — a
  year of sets, every use of a product — EIO reads it page by page, so totals and
  records are never worked out from a truncated list.
- **A few things live only on the device**: reminders themselves (rebuilt from
  the database on each launch), the Fitness mode, your plate inventory, the hold
  timer's voice and tick switches, the Tasks digest's settings, a product's
  "In 3 days", and Pick for me's shuffle. Nothing in that list is data you would
  miss on a new phone, apart from re-entering your plates.

---

## When something goes wrong

**Everything loads empty and nothing saves**
Your Supabase project may be paused — free-tier projects pause after 7 days
idle. Open the Supabase dashboard and resume it.

**The website says Supabase is not configured**
`website/.env` is missing or empty. Copy `.env.example` to `.env`, fill in your
project URL and anon key, and **restart the dev server** — environment variables
are read at startup, not per request.

**Sign-in fails on the phone but works on the website**
The APK was built without its environment variables registered on EAS. `.env` is
never uploaded to a cloud build. Register them with `eas env:create` and rebuild.

**A screen fails to load, or a v3 feature is missing**
A migration has not been applied. A query naming a column that does not exist yet
fails the whole screen. Run the files in `supabase/migrations/` in order through
the Supabase SQL Editor — for v3, after 0001–0007 and 0009–0016: **0017, 0018,
0008, 0019, 0020, 0021, 0022, 0023, 0024, 0025, 0026.** `0008_finance_v2.sql` is
needed: it holds accounts and transfers, and 0022 and 0023 depend on it. See
[Moving from v2](#moving-from-v2).

**Products crashes, or the balance is wrong, on the old app**
The phone is still running v2 against the v3 database. v2 crashes on a spare
container, counts a transfer twice, and misreads a subscription's new cycle and
date fields. Install the v3 APK.

**The B-List is empty, or a migration fails with a parse error**
The 818 items are split across `0015a` to `0015e`, run after `0015` itself,
because one 78 KB statement is a bad thing to paste into a browser editor: a
paste that arrives short fails with an error pointing somewhere in the middle of
the list, which tells you nothing. Two things to watch for in the SQL Editor:

- It runs **only the highlighted text** when anything is selected. Click once in
  the editor to deselect before running.
- Scroll to the bottom and check the last line is really the last line of the
  file before you run it.

Each part is safe to re-run — it will not duplicate a row or overwrite something
you have already ticked — so if you are unsure about one, just run it again.

**Reminders never fire**
Expected in Expo Go — it cannot schedule them. You need the installed EIO APK. On
the APK, check that notifications are allowed for EIO in Android settings, and
that the module's own channel (Task reminders, Renewal reminders, and so on) is
not muted. Then open EIO once while signed in: reminders are rebuilt on each
launch. A task needs a **time** before it can have a reminder.

**A notification button seemed to do nothing**
Each button opens EIO and acts there, once you are signed in. If you were signed
out, sign in and press it again.

**A Finance capture link does nothing**
`eio://` links need the installed APK; Expo Go does not know the address.

**The QR code for the dev app does not work**
It contains your computer's local IP, which changes when you switch networks.
Restart the dev server to get a fresh one, and make sure both devices are on the
same Wi-Fi.

**The website will not start after pulling changes**
Install both projects: `cd app && npm install`, then `cd ../website && npm
install`. The website type-checks against the shared modules in `app/`, so
`app/node_modules` has to exist.

---

*EIO is built for one person. It makes assumptions accordingly, and most of the
odd-looking decisions in it are the result of using it and finding out.*
