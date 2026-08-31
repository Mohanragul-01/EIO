# EIO — User Guide

Everything in One. This guide explains what each part does, how to use it, and —
where it matters — **why it behaves the way it does**, because several things in
EIO are deliberately not what you would first expect.

- [The two clients](#the-two-clients)
- [Signing in](#signing-in)
- [The dashboard](#the-dashboard)
- [Tasks](#tasks)
- [Notes](#notes)
- [Finance](#finance)
- [Subscriptions](#subscriptions)
- [Fitness](#fitness)
- [Your own modules](#your-own-modules)
- [Desktop-only conveniences](#desktop-only-conveniences)
- [Your data](#your-data)
- [When something goes wrong](#when-something-goes-wrong)

---

## The two clients

There is one EIO. You reach it two ways.

| | Phone app | Website |
| --- | --- | --- |
| Where | Android | Any desktop browser |
| Best at | Capture, logging in the moment | Reviewing, comparing, bulk entry |
| Renewal reminders | **Yes** | No — see [Subscriptions](#subscriptions) |
| Everything else | Identical | Identical |

They are not a copy and a sync. They are two front doors onto **the same
database row**. Add a task on your phone, refresh the website, it is there. There
is no sync delay because there is nothing to sync — neither client keeps its own
store.

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
**website** the sidebar already handles navigation, so the tiles stop being
buttons-you-must-press and become a status board — the point is reading all of it
at a glance.

Each tile shows the single most useful fact, and **the more urgent fact wins**.
Tasks shows overdue count if you have any, otherwise open count. Subscriptions
shows overdue, then due-this-week, and only falls back to your monthly total when
there is nothing to act on. A tile that always showed the same statistic would
stop being worth reading.

Tiles load independently. If one module fails — a dropped connection mid-load —
that tile shows a dash and the rest are unaffected.

---

## Tasks

Tasks are organised by **how often you do them**, not by project: Daily, Weekly,
Monthly, Yearly.

**On the phone** these are four tabs. **On the website they are four columns side
by side**, which is the single biggest difference between the clients. Tab
switching hides the shape of your workload — you cannot tell that Weekly has
quietly grown to fifteen items while Daily sits empty. Four columns tell you
instantly.

### Creating a task

A task has a title, a frequency, an optional due date, and a priority.

**Priority is mostly visual restraint.** Only *high* gets a colour and a dot. If
all three levels were coloured, none of them would read as urgent, so *normal*
and *low* are deliberately quiet.

**A due date is optional.** A task with no due date is not overdue and never
nags — it is a thing to do, not a thing to do *by* a date.

### Repeating tasks

Tick **Repeat** and completing the task creates the next one automatically.

Here is the part worth understanding, because it is where most repeating-task
systems get it wrong:

> **The next date counts from the task's own due date, never from when you ticked
> it off.**

Say a weekly task is due every Monday and you do not get to it until Thursday.
Anchoring to your completion would make the next one due the following Thursday,
then the Saturday after that — a habit you keep imperfectly would slowly slide
across the calendar until it bore no relation to when you meant to do it.
Anchoring to the original due date means **a Monday task stays a Monday task**,
no matter when you actually got to it.

Month-ends are handled: a task due on the 31st becomes the 28th in February
rather than skipping the month entirely.

Two more deliberate choices:

- **Priority is not carried over.** It described how urgent *that occurrence*
  was. Something you flagged urgent once should not be urgent forever.
- **Completing is a soft-complete.** The finished task stays, and a new one is
  created. Your history is intact — switch the filter to *Done* to see it.

### Reopening

Un-ticking a completed task reopens it and **does not** create another
occurrence. That path exists to undo a mistaken tap, which is not the same
action as completing something.

---

## Notes

Three kinds of note, one place.

### Quick capture

The fastest path from a thought to it being saved. Type, save, move on — no
title, no tags, no decisions.

**On the website the capture box is always on screen and always focused**, so
capturing is one keystroke. On the phone it is behind a button, because there is
no room for a permanent box.

Anything captured this way lands in the **Inbox**.

### The Inbox

The Inbox is not a folder. It is a *state*, worked out from the note itself:

> A note is in the Inbox when it has **no title and no tags**.

Give it either one and it leaves, automatically. Nothing to file, no button to
press. This is why the same rule applies whether you are creating or editing — if
the two disagreed, a note could be filed on save and back in the Inbox the next
time you opened it.

### Notes, checklists, journal

- **Note** — a title and a body. The ordinary kind.
- **Checklist** — tickable items, with a progress bar. You can tick items
  straight from the list without opening the note.
- **Journal** — an entry about a *day*. Journals are always filed under the date
  they are about, not the date you wrote them, so **backdating works properly**.
  Write up Sunday on Tuesday and it sits under Sunday.

Journals and checklists never enter the Inbox. You reached for them
deliberately, so choosing one is itself an act of filing.

### Unchecking a checklist

There is an **Uncheck all** button, and it is manual on purpose. A recurring
list — a packing list, a weekly shop — gets reused, and deciding when it starts
again is your call, not something that should happen on a timer.

### Searching

The website's search covers titles, bodies, tags **and checklist items**, so
searching "milk" finds the shopping list containing it, not just notes that
mention it in prose.

---

## Finance

A ledger. Every transaction is an expense or an income, with an amount, a
category, a date and an optional note.

### The running balance

The headline figure is your **all-time balance**: everything you have ever
recorded as income, minus everything recorded as expense.

This is not a bank balance and does not try to be. It is the balance *of what you
have told EIO about*. It is useful precisely because it is cumulative — a single
month tells you nothing about whether you are drifting.

### The month view

Transactions are browsed a month at a time. Arrows move between months; **This
month** jumps back.

**On the website, the charts sit in a rail beside the table** rather than stacked
above it, because the whole job of a ledger is reading a total against the rows
that produced it. Scrolling between the two loses the comparison.

- **Where it went** — a pie of expenses by category, with a percentage
  breakdown. Income is excluded deliberately: a slice chart mixing money in and
  money out would be a chart of two opposite things.
- **Last 6 months** — in and out per month. **Months with no activity are shown
  as zero rather than skipped**, because skipping them compresses the gap and
  draws a line implying a steady trend across a period when nothing happened.

### Sorting (website)

Click any column header to sort — by date, category or amount. Sorting thirty
visible rows by amount answers "what did I actually spend on" immediately.

### CSV export

Exports **everything**, not just the month on screen.

- **Website** — downloads a `.csv` file.
- **Phone** — opens the share sheet, so you can send it wherever.

The file is identical from either client; only the delivery differs. It opens
correctly in Excel, including the rupee sign, because the encoding is declared
properly — a detail that is invisible when right and makes the file look corrupt
when wrong.

### About the money

Amounts are stored as whole paise, never as decimals. Floating-point arithmetic
cannot represent 0.10 exactly, and a ledger that drifts by a paisa per hundred
transactions is worse than useless. You type rupees; it stores paise.

---

## Subscriptions

Everything that renews on its own.

Each has a name, an amount, a **billing cycle** (weekly, monthly, quarterly,
yearly), a category and a next due date.

### The monthly total

Every cycle is normalised to a monthly figure so the total means something. A
yearly ₹6,000 subscription counts as ₹500 a month. When you are entering one, the
normalised figure is shown live as you type, because a yearly and a monthly
number are not comparable by eye.

**Paused subscriptions are excluded from the total** but kept, so cancelling
something for a few months does not mean re-entering it later.

### Grouping (website)

The website groups by urgency — **Overdue**, **Due this week**, **Later**,
**Paused** — rather than listing everything by date. On a phone you only see a
few at a time so a flat list is fine, but on a monitor the whole list is visible
at once, and a flat list makes the renewal you must handle today no more
prominent than the one due in November.

### Mark paid

**Mark paid** does two things: it moves the due date forward one cycle, **and it
logs the expense to Finance** using the subscription's own category and name.

That second part is the point. Subscriptions are the expenses people forget to
record, and this is the one action that keeps the ledger honest without you
thinking about it.

The order matters and was chosen deliberately. The date is advanced *first*, the
expense logged *second*:

- If it advanced first and logging failed, you tap again and the due date moves
  one cycle too far — **visible, and fixable by editing the date.**
- If it logged first and advancing failed, you tap again and log a **second**
  payment — a phantom expense that silently corrupts every monthly total.

A wrong date is an annoyance you can see. A duplicated expense is bad data you
probably will not notice. So if the ledger write fails, EIO tells you exactly
that: the date moved, the expense did not.

### Renewal reminders — phone only

A local notification **3 days before** each renewal, at 9am.

- They are scheduled by your phone's operating system. **No server is
  involved**, and nothing is sent anywhere.
- They require the **dev or production build**, not Expo Go.
- They do not survive reinstalling the app until each subscription is edited
  again, because the schedule lives on the device rather than in the database.
- A subscription due *sooner* than 3 days gets no reminder — a notification
  scheduled in the past either fires instantly or is silently rejected, and
  neither is a reminder.

**The website has none, on purpose.** A browser cannot schedule a notification
that survives the tab closing. One that only fires while EIO happens to be open
in a tab would be worse than having none at all, because you would come to rely
on it.

---

## Fitness

A real training log, built to answer one question: **is this going up?**

Three views: **Log**, **Plan**, **Body**.

### Plan — exercises and routines

The **exercise library** is yours. A starter set is created the first time you
open Fitness, and you can add, rename or delete freely.

You cannot delete an exercise you have logged sets against. That history is what
every personal record is measured from, and silently erasing it to tidy up a list
would be a bad trade. EIO says so plainly rather than showing a database error.

A **routine** is a *template*. It logs nothing itself — it pre-fills a session so
you are not picking the same six exercises every week. Deleting a routine never
deletes the training you did from it.

### Log — a session

Start **Freestyle**, or from a routine.

The session is created the moment you start it, before you log anything. If the
app is killed mid-workout — not a remote possibility in a gym — everything you
have logged so far is already saved. Nothing is held in memory waiting for a
"finish" button, which is why there isn't one: nothing is pending, so there is
nothing to commit. You leave when you are done.

Log sets as `weight × reps`. Weight of 0 is valid, for bodyweight work.

**On the website, the session sits beside that exercise's own history**, so you
can see what you lifted last time while deciding what to lift now. That is the
one thing a phone screen physically cannot show at the same time as the input.

### Personal records

A **PR** badge appears when a set beats your best — and the rules are strict on
purpose:

- **Same rep count only.** 100kg × 5 and 100kg × 10 are different achievements.
  Comparing across rep counts would announce records that beat nothing.
- **Your first set at a rep count is not a PR.** With no history, everything
  would be a record on day one and the badge would mean nothing. A record means
  you *beat* something.
- **Strictly greater.** Matching your best is not a new record.
- **The current session is excluded** from the comparison, so a set is never
  measured against itself or against its own warm-ups. Without that, your second
  set of the day would be judged against your first, and a light back-off set
  would look like a regression.

The badge shows what you beat, so it carries information rather than just
congratulating you.

### The progression chart

Click any exercise in Plan to see it.

It plots **estimated one-rep max**, not raw weight. If it ranked by weight alone,
dropping the reps would always look like progress — 110kg × 1 would beat 100kg ×
8, which is not how training works. The estimate makes sets at different rep
counts comparable.

It needs at least two different days before it can show a trend.

### Rest timer

Presets, and tapping again **adds time rather than restarting** — mid-rest you
want thirty more seconds, not to start over.

It counts down to a stored moment rather than ticking a number down, so it stays
correct if you switch tabs or your phone sleeps. Timers get throttled in the
background; a clock does not.

### Body

Weight, height and BMI.

- **One weigh-in per day.** Recording again replaces the day's entry rather than
  adding a second. Weighing yourself twice in a morning is normal; keeping both
  would make the trend jitter on nothing.
- **Height is stored once**, on your profile, not on every weigh-in — it is a
  property of you, not of the measurement.
- **BMI is never stored.** It is calculated from your latest weight and your
  height every time. A stored copy would go stale while looking just as
  authoritative.

---

## Your own modules

The module builder is the part that makes EIO yours. It creates a working module
with no code and no database migration.

Good candidates: a bucket list, skills you are learning, books, films, a sleep
log, places to visit, plants to water. The rule of thumb:

> **Build by hand when a module needs to think. Use the builder when it just
> needs to remember.**

Finance needs to think — running balances, category maths, CSV escaping. A
reading list just needs to remember.

### Creating one

Give it a name and a colour, then add fields. Each field has a label, a type, and
whether it is required.

| Type | For |
| --- | --- |
| Text | Short answers |
| Long text | Paragraphs |
| Number | Quantities |
| Money | Amounts, formatted as currency |
| Date | A calendar day |
| Yes/No | A toggle |
| Choice | A fixed list you define |

### The one thing to know about renaming

Each field gets a **key** derived from its label when it is first created —
"Hours slept" becomes `hours_slept` — and that key is then **frozen forever**.

This means **renaming a field is safe.** Change the label to anything you like;
your data stays attached, because it was never stored under the label. If the key
were re-derived on every save, renaming a field would silently orphan every value
already recorded under it.

### The tile statistic

By default a tile shows a count. You can make it show something better: a
**sum**, an **average**, or the **latest** value of any field.

Only sensible combinations are offered — you cannot total a date or average a
note, and offering it would produce a tile showing `NaN`. If a statistic ever
becomes uncomputable (you emptied the field, or changed its type), the tile
quietly falls back to a count rather than showing an error.

### Sort order

Choose any field to sort entries by, ascending or descending.

Blank values always sort **last**, whichever direction you pick. A blank is not
"smallest" — it is *unanswered* — and burying it under real data is right either
way.

Numbers sort as numbers. This sounds obvious and is the kind of thing that is
quietly wrong in a lot of software: sorting these values in the database would
compare them as text and put 100 before 9, which looks fine until you scroll.

### Both settings need a saved field

The tile statistic and the sort order both point at a field's stored key, and
keys are assigned on save. So create the module first, then set them.

---

## Desktop-only conveniences

Things the website does that the phone cannot:

- **Everything at once.** Four task columns, charts beside the ledger, a session
  beside its history.
- **Sortable tables** in Finance and your own modules — click any column
  header. In a custom module this overrides the saved sort order for that visit
  only; the order you chose in the builder is a property of the module and a
  click is not meant to redefine it.
- **Click a category** in Finance's breakdown to narrow the table to it. The
  charts deliberately keep showing the whole month, because they are what you
  are reading the filtered rows against.
- **Always-on quick capture** in Notes, focused when the page opens.
- **Sidebar navigation** — every module one click from every other, with your
  own modules listed underneath.
- **Keyboard.** `/` focuses the search box, `n` opens a new entry, `Esc` closes
  any dialog, `Enter` saves most of them, and `Ctrl`/`Cmd`+`Enter` saves quick
  capture. `/` and `n` are single keys with no modifier, so they are ignored
  while you are typing in a field or while a dialog is open. The shortcuts are
  listed at the bottom of the sidebar.
- **A collapsing sidebar.** Below about 1080px wide the labels drop and the
  icons stay, so navigation is still one click rather than hidden behind a menu.
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
- Both clients ship a **public anon key**. That is by design and safe: on its
  own it grants nothing, because every policy requires a signed-in user.
- **Nothing is shared, uploaded or analysed.** There is no telemetry, no
  analytics and no third party.
- **A network connection is required.** Neither client caches for offline use.
- The one thing that never leaves your device is **notification scheduling** on
  the phone, which is why reminders vanish on reinstall.

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

**A new feature is missing, or saving fails on a specific module**
A migration has not been applied. Run the files in `supabase/migrations/` in
order through the Supabase SQL Editor. `0008_finance_v2.sql` is the exception —
it belongs to a different, still-planned change and should **not** be run.

**Renewal reminders never fire**
Expected in Expo Go — it cannot schedule them. You need the dev or production
build. If you are on one, check notification permission for EIO in Android
settings, and remember reminders are skipped for anything due within 3 days.

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
