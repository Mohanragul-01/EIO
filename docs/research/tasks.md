# Tasks: competitor research

**Category:** personal task managers and to-do apps on Android
**Compared against:** EIO's Tasks module. That covers `app/src/modules/todo` (phone), the website kanban board, and migrations `0001`, `0009` and `0013`.
**Date:** 19 October 2026
**Method:** public evidence only: help centres, changelogs, store-tracker data, reviews and roundups. Nothing was installed, decompiled or signed up for. EIO's own behaviour was read from its source code, which is cited by file path.

### Evidence labels

| Label | Meaning |
| --- | --- |
| **OBSERVED** | Seen on the cited page. |
| **OBSERVED\*** | Seen only in a search engine's summary of the cited page, not on the page itself. Lower confidence. |
| **INFERRED** | Reasoned from the evidence named next to it. |
| **UNKNOWN** | Not established. |

### Limits of this investigation

1. **Google Play pages would not load.** Every `play.google.com` fetch came back empty, and AppBrain refused the request. Install counts and ratings therefore come from AndroidRank, a third-party tracker, and are a snapshot.
2. **The web-search budget ran out partway through.** It is shared by every agent in this session. After that, only pages whose URLs were already known could be opened. Reddit (`old.reddit.com`), Capterra and G2 refused direct fetches. **User opinion is the weakest part of this report.** It comes from reviewers and comparison articles that quote users, not from the forums themselves.
3. **No screenshots were viewed.** The visual descriptions come from help-centre text. They are not based on looking at the apps.
4. **TickTick's help centre is built with JavaScript.** WebFetch returned nothing for it. The public page's HTML does contain the full text of every help article, so that HTML was saved to the scratchpad and the article text pulled out of it. This is the same text a browser shows. Each TickTick claim cites its article URL.
5. **Microsoft's To Do help is thin.** Several articles do not cover Android gestures or how completed tasks are shown, so that section has more UNKNOWNs than the others.

---

## Research questions

These are the questions the brief was turned into. §7 records how far each one got.

| # | Question | Evidence needed |
| --- | --- | --- |
| Q1 | Which three apps lead on Android in 2026? | Install counts, ratings, 2025–26 roundups |
| Q2 | How fast is capture? Natural-language parsing, the add flow, what is pre-filled. | Quick Add and smart-recognition help pages |
| Q3 | Which recurrence models exist (fixed schedule vs after completion), what happens to overdue repeats, and can an occurrence be skipped? | Recurring-task help pages |
| Q4 | How do reminders and notifications work on Android, including persistent alarms? | Reminder help pages, changelogs |
| Q5 | How do Today and Upcoming views work, and how is overdue work handled? | View help pages |
| Q6 | How do subtasks, checklists and notes work? | Task-detail help pages |
| Q7 | How do habits and streaks work? | Habit help pages, Karma docs |
| Q8 | How do focus and Pomodoro timers work? | Focus help pages |
| Q9 | What calendar views exist? | Calendar help pages |
| Q10 | How are completed tasks shown and kept? | Completed-task help pages |
| Q11 | Which swipe gestures exist? | Swipe help pages |
| Q12 | Which Android widgets exist? | Widget help pages |
| Q13 | What do kanban and board views look like? | Board help pages |
| Q14 | How do leaders handle routine, repeating responsibilities? Is EIO's frequency model a strength or something to rethink? | All of the above, plus EIO's code |
| Q15 | What do users praise and complain about? | Reviews, forums |
| Q16 | Which UI and visual patterns are worth copying (layout, hierarchy, empty states, colour)? | Help text, design statements, reviews |

---

## 1. Which apps, and why

### 1.1 The candidates

| App | Installs on Google Play (achieved / estimated) | Average rating | Number of ratings | 2025–26 roundups |
| --- | --- | --- | --- | --- |
| **Todoist** | 10M+ / ~40.4M | **4.61** | 305,614 | Zapier lists it first, "balancing power and simplicity". 2sync makes it a top pick. |
| **TickTick** | 10M+ / ~11.7M | **4.6** | 165,125 | Zapier: "Embedded calendars and timers". 2sync makes it a top pick. |
| **Microsoft To Do** | 10M+ / ~36.6M | 4.58 | 482,026 | Zapier: "Microsoft power users". |
| Google Tasks | 10M+ / ~39.7M | 4.58 | 608,476 | Zapier: "Fairly barebones". 2sync makes it a top pick. |
| Any.do | 10M+ / ~24.7M | 4.43 | 506,032 | Zapier: "Slick mobile experience", but the desktop version "feels cluttered". |

Install and rating figures: OBSERVED on AndroidRank, last updated 2026-10-09 ([Todoist](https://www.androidrank.org/application/todoist_to_do_list_planner/com.todoist), [TickTick](https://www.androidrank.org/application/ticktick_to_do_list_calendar/com.ticktick.task), [Microsoft To Do](https://www.androidrank.org/application/microsoft_to_do_lists_tasks/com.microsoft.todos), [Google Tasks](https://www.androidrank.org/application/google_tasks/com.google.android.apps.tasks), [Any.do](https://www.androidrank.org/application/any_do_to_do_list_planner/com.anydo)). Roundup quotes: OBSERVED in [Zapier's list](https://zapier.com/blog/best-todo-list-apps/) (updated December 2025) and OBSERVED\* in [2sync](https://2sync.com/blog/best-to-do-list-apps). Roundups are weak evidence. They are used here only to show which apps are considered the leaders.

### 1.2 The three chosen

1. **Todoist.** It has the highest Android rating of the group and is first in Zapier's list. Reviewers consistently call its natural-language input the best available. Ellie's comparison says it is "a step above everything else" (OBSERVED, [ellieplanner.com](https://ellieplanner.com/comparisons/todoist-vs-ticktick)).
2. **TickTick.** It is effectively tied with Todoist on rating. It is the only leader with habits, a Pomodoro timer, calendar views and kanban built in, which covers half of this brief by itself (OBSERVED, [TickTick Beginner's Guide](https://help.ticktick.com/articles/7054286604315131904)).
3. **Microsoft To Do**, chosen over Google Tasks and Any.do. Google Tasks has more ratings but is the thinnest of the five. Zapier calls it "Fairly barebones" (OBSERVED), and in late 2026 a search box was still only being spotted in its code (OBSERVED\*, [PhoneArena](https://www.phonearena.com/news/feature-that-google-tasks-users-have-wanted-could-arrive-soon_id182913)). Any.do has the lowest rating of the five. Microsoft To Do contributes **My Day**, a daily list that starts empty, and **Routine reminders**. These are the most relevant single ideas for someone whose list is mostly routine (OBSERVED, §2.3).
   - *Caveat (INFERRED):* To Do looks like it is in maintenance mode. Zapier says it "Hasn't quite caught up with Microsoft's AI pivot", and a 2024 App Store reviewer asks why requests have been "ignored (for years)" (OBSERVED, [App Store](https://apps.apple.com/us/app/microsoft-to-do/id1212616790)). It is included for its patterns, not its momentum.

---

## 2. Per-app teardown

### 2.1 Todoist

#### Core features

- **Quick Add with inline syntax** (OBSERVED, [Use Task Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz), updated 1 Sep 2026):
  - Dates and times are typed in plain language ("tomorrow at 4 PM", "every other Tuesday starting March 3").
  - `{march 30}` sets a deadline, `%label` sets a label (`@` "is planned to be retired by the end of 2026"), `p1`–`p3` set priority, `!14:00` or `!30 min before` set a reminder, `#Project` picks a project and `/Section` picks a section.
  - **Escape hatch:** "Just click or tap the word to turn it into plain text." Smart date recognition can also be turned off entirely.
  - The description field stays hidden behind a **+** unless "Show description" is turned on.
- **Recent Quick Add changes** (OBSERVED, [2026 changelog](https://www.todoist.com/help/todoist/product-updates/2026-changelog-HD3jJAtLd)):
  - 20 Aug: a redesign; "Quick Add opens clean now".
  - 24 Sep, Android, paid plans: typing "Meet tomorrow 9-10" sets both the start time and the duration.
  - 8 Oct: multiple-task capture, on web and desktop.
- **Recurring dates** (OBSERVED, [Introduction to recurring dates](https://www.todoist.com/help/todoist/features/introduction-to-recurring-dates-YUYVJJAV)):
  - Examples include "every weekday", "every other fri", "every 1st wed jan", "every mon, fri", "everyday until aug 3", "everyday for 3 weeks" and "every last workday at 3pm".
  - **`every` repeats from the original scheduled date. `every!` repeats from the completion date.** "after 10 days" becomes "every! 10 days".
  - On mobile, Date → Repeat → Custom offers an every / every! choice, a frequency and an optional end date.
  - Limits: no different times on different days, no "every 2 months on the first Friday", no "except", and only one "every" per rule.
- **Completing a recurring task** (OBSERVED, [Complete a task with a recurring date](https://www.todoist.com/help/todoist/features/complete-a-task-with-a-recurring-date-dmI6SVqdP)):
  - The task "automatically shifts to the next date" and stays in its project. Each completion is logged in Reporting.
  - **Overdue daily tasks do not pile up.** "If your task was scheduled for yesterday, and you complete it today, the task won't move to today… It will instead shift the date to the following day."
  - Rescheduling and then completing skips the occurrences in between.
  - "Complete forever" ends the series. An **Undo** pop-up stays for a few seconds. A "Reset sub-tasks" setting brings a parent's sub-tasks back with each occurrence.
  - Completed occurrences are records only and cannot be reopened. The help page says "Android doesn't show completed recurring tasks yet". The 10 Sep 2026 changelog, however, says they "now show up in Today, Upcoming, and other date views".
  - Behaviour for overdue **weekly and monthly** tasks: UNKNOWN. The docs only cover daily.
- **Reminders** (OBSERVED, [Introduction to reminders](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU)):
  - Automatic reminders are added to any task with a time, at a default lead time.
  - Custom date-and-time reminders exist, and paid plans can have several per task.
  - Relative shortcuts `!30m` and `!1hb` are paid-only. Location reminders exist.
  - Recurring reminders "aren't supported in the Android app".
  - On mobile, a "When snoozed…" setting sets the snooze interval.
- **Urgent reminders** (OBSERVED, [September 2026 update](https://www.todoist.com/help/todoist/product-updates/september-2026-decide-whats-urgent-and-let-the-rest-wait-ewUpBiZOm) and changelog):
  - Launched 20 Aug 2026 on Android. Marking a reminder Urgent sets off a full-screen alarm that "cuts through Do Not Disturb and silent mode".
  - Since 8 Oct, free accounts also get urgency control over their one at-due reminder.
- **Today view** (OBSERVED, [Plan your day with the Today view](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs) and [Upcoming](https://www.todoist.com/help/todoist/get-started/plan-your-week-with-the-upcoming-view-OKOg1mR8)):
  - Shows every task dated today, across all projects. **Undated tasks never appear in Today or Upcoming.**
  - Priority 1 tasks "show up at the top of your Today view in red".
  - In list layout, dragging a task to the bottom of Today postpones it to tomorrow.
  - A **Reschedule** button at the top right moves all overdue tasks at once.
  - Today can be grouped or sorted. Since September 2026 it can also be shown as a board grouped by priority.
- **Upcoming view** (OBSERVED, same Upcoming article):
  - On mobile, a week picker sits at the top: swipe it to change weeks, tap a day to see its tasks, tap the month to jump to any date, and tap the calendar icon to return to today.
  - **Android: "Touch and hold any date in the week picker"** to add a task to that day, or drag the add button onto a day.
  - The date picker puts a "busy" dot under dates that already have tasks.
  - Layouts are list, board (one column per day) and calendar. Calendar is paid-only.
- **Deadlines** are separate from dates (OBSERVED, [Introduction to deadlines](https://www.todoist.com/help/articles/introduction-to-deadlines-in-todoist-uMqbSLM6U), paid-only). The date is when you plan to do the task. The deadline is "the hard cutoff".
- **Sub-tasks** (OBSERVED, [Use sub-tasks](https://www.todoist.com/help/articles/introduction-to-sub-tasks-kMamDo)):
  - Up to four levels.
  - On Android, touch and hold a task and drag it right to indent. Dragging the add button below and slightly right of a task creates a sub-task.
  - In Today and Upcoming, the sub-task count expands a task.
  - Since 1 Oct 2026, sub-tasks can be completed directly from board cards (OBSERVED, changelog).
- **Karma, goals and streaks** (OBSERVED\*, [Introduction to Karma](https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy) and [Vacation mode](https://www.todoist.com/help/articles/turn-on-or-off-vacation-mode-in-todoist-pAQmRp)):
  - Default goals are 5 tasks a day and 25 a week, with streaks for meeting them.
  - **Days off** (Saturday and Sunday by default) do not break a streak. **Vacation mode** pauses Karma.
  - A broken streak can be restored up to three times.
- **Swipe actions** (OBSERVED\*, [How to change your swipe actions](https://todoist.com/help/articles/360016892459)):
  - Left and right swipes are each assignable to Complete, Schedule, Delete, Reminders, or Select (Android only).
  - A two-finger swipe or a long press starts multi-select.
- **Android widgets** (OBSERVED, [Use a Todoist widget on Android](https://www.todoist.com/help/todoist/features/use-a-todoist-widget-on-your-android-device-632pZA)):
  - **Add task shortcut.**
  - **Task list widget.** It shows a chosen "view, project, label, or filter", and tasks can be completed by tapping their circle. It has + and voice (Ramble) buttons, opacity from 0 to 100, a compact mode that hides the completion circles, small or normal font, and its own theme. It is resizable.
  - **Productivity widget** (Karma), and a 1×1 Ramble voice widget.
  - There is also an Android Quick Settings tile (OBSERVED, [26 little-known features](https://www.todoist.com/inspiration/hidden-features-todoist)).
- **Completed tasks** (OBSERVED\*, [View completed tasks](https://www.todoist.com/help/todoist/features/view-completed-tasks-in-todoist-J19h2s)):
  - Off by default. Display → "Completed tasks" shows them per project.
  - Reporting lists completions from all projects, but they cannot be uncompleted there. Filters cannot show completed tasks.
  - The free plan keeps "1 week activity history" (OBSERVED, [pricing](https://www.todoist.com/pricing)).
- **Not built in:** habits and focus timers. Ellie: "would need a separate habit app" (OBSERVED). None appears in the 2026 changelog (OBSERVED).
- **Android redesign** on 18 Jun 2026: "A fresh new look on Android", using "Material 3 Expressive" (OBSERVED, changelog).

#### Interaction details that make it good

- **The whole task fits on one line.** "Email Sarah about the proposal tomorrow at 2pm #Work p1" is parsed into name, date, time, project and priority in one pass (OBSERVED, ellieplanner).
- **The add button carries position.** Dropping the draggable add button between tasks inserts the new task there. Slightly right makes a sub-task, and onto a day in Upcoming sets that date (OBSERVED, sub-tasks and Upcoming articles). The drop position *is* the pre-fill.
- **Overdue is handled in bulk.** One Reschedule button acts on the whole overdue set instead of one task at a time (OBSERVED).
- **False positives cost one tap.** Tapping a misparsed word turns it back into plain text (OBSERVED).
- **Pre-fill by view:** UNKNOWN for Today, because the Quick Add help does not say. OBSERVED for Upcoming, where you select a day and then add.
- **Taps to add:** INFERRED as add button, type, Enter: one tap plus typing. The widget and Quick Settings tile skip opening the app.

#### UI and visual patterns

- Described as "deliberately minimal" (OBSERVED, ellieplanner). A Capterra reviewer quoted by Morgen praises its "minimalist design" (OBSERVED, [morgen.so](https://www.morgen.so/blog-posts/ticktick-vs-todoist)).
- There are four priority levels, p1 to p4 (OBSERVED\*, glossary). Priority 1 shows in red at the top of Today (OBSERVED).
- Since August and September 2026, calendar tasks can be coloured by priority, project or label (OBSERVED, changelog). Colouring by project or label is paid-only.
- The widget offers "the classic red-and-white look" through to dark (OBSERVED).
- On mobile, Upcoming is reached through a **Browse** tab (OBSERVED). The full bottom-navigation layout is UNKNOWN.
- Empty states: UNKNOWN. They are not described in the docs that were read.

#### What users praise and complain about

- **Praise:**
  - Natural-language input (OBSERVED, ellieplanner; OBSERVED, morgen).
  - Minimal design and a short learning curve (OBSERVED, morgen).
- **Complaints:**
  - No built-in calendar on the free plan, and Google Calendar sync "adds friction" (OBSERVED, ellieplanner).
  - Today is "a flat list of everything due today" (OBSERVED, ellieplanner).
  - No habits or Pomodoro timer (OBSERVED).
  - The free plan's 5-project limit (OBSERVED, ellieplanner).
  - Paywalled features, including reminders (OBSERVED, morgen, citing users).
  - Support "has largely disappeared" (OBSERVED, morgen, quoting a Reddit user).
  - No colour-coding on the calendar (OBSERVED, morgen). INFERRED to be fixed by the August 2026 colouring change.

### 2.2 TickTick

#### Core features

- **Adding a task** (OBSERVED, [Add Tasks](https://help.ticktick.com/articles/7055782422935240704)):
  - A "+" sits on every screen. A toolbar under the title sets date, priority, tag and list, and its order can be customised.
  - **Task Default** presets the date, list, priority and reminder for every new task.
  - Long-press "+" to dictate a task. The widget's "+" opens the add bar directly.
- **Smart Recognition** (OBSERVED, [Smart Recognition](https://help.ticktick.com/articles/7081924556310446080) and [Add Tasks](https://help.ticktick.com/articles/7055782422935240704)):
  - Parses dates, times, repeats, early reminders and postponed reminders, and "automatically set[s] the reminder time".
  - **An ambiguous time resolves to the nearest one in the future.** At 4pm, "remind me at 9pm" means 9pm today.
  - Parsed words are highlighted in blue. Tap one, or press Delete, to cancel it. You can choose whether the date text stays in the title.
- **AI Voice Add** (April 2026) recognises date, list, tags and priority, and "Multiple tasks in a single input can also be split automatically" (OBSERVED, [What's New](https://help.ticktick.com/articles/7082552170989486080)).
- **Inline symbols:** `#tag` (OBSERVED\*, [TickTick blog 2014](https://blog.ticktick.com/2014/05/23/group-your-tasks-by-using-tags-on-ticktick/)). `^list`, `!priority` and `*date` (OBSERVED\*, [third-party post, 2020](https://curtismchale.ca/2020/08/10/ticktick-quick-add-syntax)). The current syntax is UNKNOWN; the 2026 help centre does not document it.
- **Recurring tasks** (OBSERVED, [Set Up Recurring Tasks](https://help.ticktick.com/articles/7055782206349770752), modified 14 Oct 2026):
  - Three custom types: **By Due Date**, **By Completion Date** ("exercise once every three days" moves if you finish late) and **By Specific Dates** (pick one or more days).
  - A repeat can end on a date or "after xx times".
  - A single occurrence can be changed with "Only this Recurrence". "Show All Repeat Cycles" shows future occurrences on the calendar.
- **Skipping an occurrence** (OBSERVED, [FAQ](https://help.ticktick.com/articles/7055792921664028672)):
  - Swipe left, then choose "Skip the recurrence" in the date pop-up.
  - "You cannot modify future recurring tasks until the current recurrence is completed". This is the same single-live-instance model EIO uses.
- **Reminders** (OBSERVED, [Effective Reminder Feature](https://help.ticktick.com/articles/7055782395743567872)):
  - Several reminders per task, plus a default reminder.
  - The reminder pop-up offers **Dismiss, Start Focus, Done, Snooze**, and appears outside the app and on the lock screen.
  - "Due to Android system restrictions, some phones need to enable 'Alert Mode'."
  - Location reminders, a reminder at the end of a task's duration, and a different ringtone per priority.
- **Constant Reminder** (OBSERVED, [Constant Reminder](https://help.ticktick.com/articles/7374017550633402368)):
  - On Android the alert "will cycle 30 seconds on, 30 seconds off for a total of 5 minutes, and will continue until you take action".
  - Since June 2026 it can be set separately for tasks, habits and anniversaries.
- **Daily Notification** sends a summary of completed and incomplete tasks at a chosen time, optionally skipping weekends (OBSERVED, [TickTick blog, 2020](https://blog.ticktick.com/2020/12/08/20-lesser-known-ticktick-features/)). Whether it still exists in 2026 is UNKNOWN.
- **Smart lists** (OBSERVED, [FAQ](https://help.ticktick.com/articles/7055792921664028672)):
  - All, Today, Tomorrow, Next 7 Days, Assigned to Me, **Won't Do**, **Completed** and Inbox.
  - Each can be set to Show, Hide, or **"Show if not empty"**.
- **Group and sort** (OBSERVED, [Group & Sort](https://help.ticktick.com/articles/7056594711640801280)):
  - Grouping by time gives **Today, Tomorrow, Next 7 days, Later, Overdue**. Tasks can also be grouped by priority, tag, list or created time.
  - Tasks can be sorted by date, priority, created time or modified time. Kanban uses the same groupings.
- **Task details** (OBSERVED, [Task Details](https://help.ticktick.com/articles/7055782408586526720)):
  - Date and duration, four priorities (High, Medium, Low, None), a Markdown body, and tags.
  - **Check items:** a toggle switches the body between text and a checklist.
  - **Progress %**, calculated automatically from the check items. Completing every check item completes the task.
  - Pin, and **Won't Do**: abandoned tasks are kept, viewable in their own list, and can be restarted.
- **Subtasks** go up to five levels. You can drag one task onto another to make it a subtask, or use "Link Parent Task" (OBSERVED, [Multilevel Tasks](https://help.ticktick.com/articles/7055782219767349248)).
- **Habits** (OBSERVED, [Start a New Habit](https://help.ticktick.com/articles/7055781878401335296), [Better Achieve Habits](https://help.ticktick.com/articles/7055781805944733696), [Habit Review](https://help.ticktick.com/articles/7055781785312952320)):
  - Habits are a separate tab, switched on under Settings → Tab Bar. There is a gallery of more than 60.
  - **Frequency can be a quota**, for example fitness "three times a week".
  - Three ways to record a habit: Complete All (one swipe), Auto (a fixed amount per swipe, such as one cup of water) and Manual (enter the amount).
  - Several reminders a day are allowed, such as water at 9:00, 12:00, 18:00 and 21:00.
  - Habits are grouped into **morning, afternoon, evening and other** sections. Mood and log notes can be added.
  - Habits can be shown in Today and Next 7 Days. Tapping a date in the monthly check-in calendar logs a missed check-in. There is a **yearly heat map**.
  - Archive and delete are separate actions.
  - Tapping the number on a habit switches between Current Streak and Total Days (OBSERVED, 2020 blog).
- **Pomodoro and focus** (OBSERVED, [How to Start Focus](https://help.ticktick.com/articles/7055782010496745472)):
  - Either a 25/5 Pomodoro or a stopwatch, optionally linked to a task.
  - A focus session can start from a swipe action, from the task's detail page, or from the reminder pop-up.
  - Time can be adjusted with ± during a session, and a focus note can be added. Sessions sync across devices.
- **Calendar** (OBSERVED, [Week View](https://help.ticktick.com/articles/7055782149730861056), [Month View](https://help.ticktick.com/articles/7055782128335716352), [Year View](https://help.ticktick.com/articles/7399726920725692416)):
  - Day, 3-day, Week (timeline or grid), Month and Year views.
  - In Month view, pinching changes how many weeks are shown, and swiping changes month.
  - Year view has a **heat map** of completed tasks.
  - Completed tasks can be shown or hidden. Tasks can be coloured by list, tag or priority (OBSERVED, 2020 blog).
- **Kanban** is a display mode of any list, not a separate module. "Next 7 Days" as a kanban gives one column per day, and tasks are dragged between columns (OBSERVED, [Kanban View](https://help.ticktick.com/articles/7055782353376903168)).
- **Eisenhower Matrix** sorts tasks into four boxes automatically by priority, and the rules can be edited. A task added to the urgent-and-important box is set to today and high priority (OBSERVED, [How to Use Eisenhower Matrix](https://help.ticktick.com/articles/7055782055577124864)).
- **Suggested Tasks** (OBSERVED, [Suggested Tasks](https://help.ticktick.com/articles/7401564165023727616)):
  - Sits inside Today and has four sections:
    - **Recently Added** (undated tasks).
    - **Postponed** (sorted by how many times the date was changed: more than 5, 3 or 2 times).
    - **Long Overdue** (created more than 7, 14 or 30 days ago).
    - **Upcoming** (tomorrow, or in 2 days).
  - A + button adds a task to Today. Recurring tasks are excluded.
- **Swipe actions** (OBSERVED, [List View](https://help.ticktick.com/articles/7055782365863346176)):
  - Swiping left shows Move, Delete and Date. Swiping right shows Done and Pin.
  - Both sides are customisable, including Start Focus.
  - On Android, a long press starts batch selection.
- **Android widgets** (OBSERVED, [Widgets](https://help.ticktick.com/articles/7055780404896202752)):
  - Tasks, and Task Completions (completions per day for the last 30 days).
  - Calendar: Daily or 3-day, Week, and Month.
  - Eisenhower Matrix.
  - Today Habits, Weekly Habits, and Habit Heat Map.
  - Pomodoro, Today Focus, and Focus Distribution.
- **Achievements** (OBSERVED, [Achievements and Statistics](https://help.ticktick.com/articles/7082302534169133056)):
  - A score that goes up with completions and **down when tasks are left overdue**.
  - A trend of tasks completed per day, week and month, and a completion rate.

#### Interaction details that make it good

- **Modules are opt-in.** Habits, Pomodoro and the Matrix only appear once they are added to the tab bar. TickTick's design note says the answer to feature bloat is "to respect the user's power of choice" (OBSERVED, [Design Principles](https://help.ticktick.com/articles/7054327235582361600)).
- **Every reminder can be acted on.** Done and Snooze sit on the pop-up itself, and Start Focus links reminders to the timer (OBSERVED).
- **"Plan Your Day":** a circle button at the top of Today steps through overdue and today's tasks one by one, so each can be rescheduled, completed or deleted (OBSERVED, 2020 blog). Whether it still exists in 2026 is UNKNOWN.
- **Small guards against mistakes.** Choosing 12:30 AM brings up a prompt asking whether midnight was meant (OBSERVED, Design Principles).
- **Defaults are set once.** Task Default pre-fills date, list, priority and reminder (OBSERVED).

#### UI and visual patterns

- "We boldly subtracted" functions from the task detail page, leaving "more space for users to write" (OBSERVED, Design Principles). TickTick also says it has no splash ads and no "unremovable red dots" (OBSERVED).
- Reviewers find it "clean but busier than Todoist's" (OBSERVED, [ClickUp review](https://clickup.com/learn/topic/task-management/tools/ticktick/), June 2026) and "a bit feature-heavy" (OBSERVED, morgen).
- Parsed date words are shown in blue. Lists can have their own backgrounds, except Completed, Won't Do and Trash (OBSERVED). Smaller font sizes arrived in September 2026 (OBSERVED, What's New).

#### What users praise and complain about

- **Praise:**
  - The calendar is the "biggest advantage" (OBSERVED, ellieplanner).
  - Habits, Pomodoro and the Matrix are built in (OBSERVED, ellieplanner and morgen).
  - It is good value (OBSERVED, ClickUp).
  - Drag-and-drop calendar planning and visual urgency cues help visual planners (OBSERVED, morgen).
- **Complaints:**
  - Parsing "occasionally misreads complex recurrence patterns" (OBSERVED, ClickUp) and "isn't as reliable with complex inputs" (OBSERVED, ellieplanner).
  - A learning curve, and poor documentation (OBSERVED, morgen, citing Reddit).
  - Billing complaints on Trustpilot (OBSERVED, morgen).
  - Google Calendar sync does not always update (OBSERVED, morgen).

### 2.3 Microsoft To Do

#### Core features

- **My Day** (OBSERVED, [My Day](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions), [Plan and connect](https://support.microsoft.com/en-us/todo/plan-and-connect-with-microsoft-to-do), [My Day in Outlook](https://support.microsoft.com/en-us/topic/6de6ee52-751b-4405-b389-850572b15306)):
  - It "resets every night" ("cleared at midnight"), giving "a blank slate".
  - Tasks are added to it directly, or from any list with "Add to My Day".
  - Unfinished tasks stay in their own lists and are suggested again the next day.
  - The **lightbulb** opens Suggestions, which appear after the first day of use. A **+** next to each suggestion adds it to My Day.
- **Routine reminders on Android:** a notification at a chosen time on chosen days prompts you "to plan your day each morning", and tapping it opens Suggestions (OBSERVED, [Routine reminders](https://support.microsoft.com/en-us/ToDo/using-routine-reminders-on-android)).
- **Habits:** "When you set a task to repeat every day, we'll suggest that you add it to My Day" (OBSERVED, [Creating daily habits](https://support.microsoft.com/en-us/ToDo/creating-daily-habits-with-microsoft-to-do)). There are no streaks (OBSERVED).
- **Dates, reminders and repeats** (OBSERVED, [Add due dates and reminders](https://support.microsoft.com/en-us/ToDo/add-due-dates-and-reminders-in-microsoft-to-do)):
  - Due: today, tomorrow, next week, or pick a date.
  - Remind me: later today, tomorrow, next week, or pick a date and time.
  - Repeat: daily, weekdays, weekly, monthly, yearly, or custom.
  - The Planned list is grouped into Earlier, Today and Tomorrow (screenshot caption). Whether there are more groups is UNKNOWN.
- **Smart date recognition** (OBSERVED, [Smart due date reminder recognition](https://support.microsoft.com/en-us/ToDo/smart-due-date-reminder-recognition-in-microsoft-to-do)):
  - Recognises "tomorrow 5pm", "friday noon", "daily", "every Monday" and "daily 5pm", highlighted as you type.
  - Backspace on a highlighted word stops it being recognised. A setting removes recognised text from the title.
  - Supported on Windows (2.66 and later) and iOS, with "other platforms are in progress". **Android support: UNKNOWN.**
- **Steps, notes and tags** (OBSERVED, [Add steps, importance, notes, tags](https://support.microsoft.com/en-us/ToDo/add-steps-importance-notes-tags-and-categories-to-your-tasks)):
  - Steps are added with "+ Add step", and a counter under the task name shows how many steps are done.
  - Importance is a **star**, and starred tasks appear in the Important list.
  - `#tags` are typed in the title.
  - Notes support rich text, but only on the web.
  - ClickUp calls steps "basic, supporting only names and completion checkboxes" (OBSERVED, [ClickUp review](https://clickup.com/learn/topic/task-management/tools/microsoft-to-do/)).
- **Sort and search:** sort by Importance, Due date, Added to My Day, Alphabetically or Creation date. Search covers tasks, steps, tags and notes (OBSERVED, [Sort and search](https://support.microsoft.com/en-us/ToDo/sort-and-search-in-lists)).
- **Customising lists:** each list can have its own background colour or image, and an emoji at the start of a list's name becomes its icon (OBSERVED, [Customize your lists](https://support.microsoft.com/en-us/ToDo/customize-your-lists)).
- **Android widget:** you can view tasks, open lists, and "quickly add new tasks to My Day" (OBSERVED, [Android widget](https://support.microsoft.com/en-us/ToDo/using-the-android-widget-with-microsoft-to-do)). Completing tasks from the widget: UNKNOWN.
- **Gestures:** on mobile, swiping right to left deletes a task, after a confirmation (OBSERVED, [Create, edit, delete and restore tasks](https://support.microsoft.com/en-us/ToDo/create-edit-delete-and-restore-tasks)). Other swipes are UNKNOWN.
- **How completed tasks are shown:** UNKNOWN. Not covered by any fetched source.
- **Not built in:** kanban, a calendar view, and custom views. Priority is only a star (OBSERVED, ClickUp).

#### Interaction details that make it good

- **Today is a choice, not a backlog.** Because My Day empties itself, each morning starts with deciding what goes in, and yesterday's leftovers come back as one-tap suggestions rather than an accumulating overdue pile (OBSERVED, My Day articles). INFERRED: this is the opposite of how a list of routine tasks feels when every missed daily task stays overdue.
- **Prompt, then ritual.** The Routine reminder notification opens straight into Suggestions (OBSERVED).
- **A lesson in pre-fill.** A 2019 App Store reviewer complained that tasks added from Planned defaulted to being due *yesterday* (OBSERVED, App Store). Pre-fill from context only helps when it is right.

#### UI and visual patterns

- "very pretty" (OBSERVED, Zapier). Each list has its own theme or photo, and emoji become list icons (OBSERVED).
- The interface "works identically across Windows, Mac, iOS, Android, and web" (OBSERVED, ClickUp).

#### What users praise and complain about

- **Praise:**
  - It is free (OBSERVED, ClickUp).
  - My Day is its "best feature" (OBSERVED, ClickUp).
  - The Planned tab and cross-device sync (OBSERVED, App Store review, 2019).
  - A "direct extension of my brain" (OBSERVED, App Store review, 2021).
- **Complaints:**
  - It is behind on AI (OBSERVED, Zapier).
  - Feature requests are ignored "for years" (OBSERVED, App Store review, 2024).
  - There is no way to sort starred tasks by their list (OBSERVED, App Store review, 2024).
  - Steps are basic, and there are no kanban or custom views (OBSERVED, ClickUp).

### 2.4 Runners-up (not torn down)

- **Google Tasks** is "Fairly barebones". It shows a star for priority and lives in the Gmail and Calendar sidebars (OBSERVED, Zapier). In mid-2026 its releases were bug fixes only (OBSERVED\*, APKMirror release notes summarised by search).
- **Any.do** is "for people who forget to use to-do apps", with a slick mobile app but a cluttered desktop version (OBSERVED, Zapier).

---

## 3. What EIO already has

EIO files tasks under four frequencies: Daily, Weekly, Monthly and Yearly. They are swipeable tabs on the phone and a four-column drag-and-drop board on the website. Order within a column is set by hand, stored, and shared by both clients (`app/src/modules/todo/types.ts`, `docs/USER-GUIDE.md`).

A task has a title, an optional date, a three-level priority shown as a coloured dot, and a repeat flag. On the phone, the add button opens a full-screen form with the current tab's frequency pre-filled and the keyboard already open. Repeat is off by default, even in the Daily tab (`TodoEditScreen.tsx`).

Completing a repeating task does three things (`api.ts`):

- It marks the row done.
- It inserts a new row due **one interval after the old due date**, never after today. This is deliberate, so that "a Monday task stays a Monday task" (`types.ts`, `__tests__/recurrence.test.ts`).
- It resets the new row's priority to normal.

Nothing links one occurrence to the next except the title and the frequency. Completion is recorded as `is_done` plus `updated_at`. There is no `completed_at` column, so any later edit moves the recorded completion time.

Completed tasks are kept forever and can be reopened. The website can filter by priority, due (overdue, today, this week, no date), repeating or one-off, and text.

Local notifications already exist in the Subscriptions module through `expo-notifications`. Its header says the permission and channel code is what moves to `core/` "when Todo reminders arrive" (`app/src/modules/subscriptions/notifications.ts`).

---

## 4. Gap analysis

### 4.1 Capability grid

| Capability | Todoist | TickTick | MS To Do | EIO |
| --- | --- | --- | --- | --- |
| Natural-language quick add, with tap to undo a misparse | ✔ | ✔ | ✔ (Android UNKNOWN) | ✘ |
| Time of day | ✔ | ✔ | ✔ | ✘ |
| Reminders, with snooze | ✔ | ✔ | ✔ | ✘ (the code exists in Subscriptions) |
| Persistent or alarm reminders | ✔ Urgent | ✔ Constant | UNKNOWN | ✘ |
| Daily planning prompt | ✘ | ✔ Daily Notification (2020) | ✔ Routine reminders | ✘ |
| Today view across all lists | ✔ | ✔ | ✔ My Day + Planned | ✘ phone; filter only on web |
| Bulk reschedule of overdue tasks | ✔ Reschedule | ✔ Postpone (desktop) | via Suggestions | ✘ |
| Upcoming, or a week strip | ✔ | ✔ Next 7 Days | Planned | ✘ |
| Calendar month view | ✔ paid | ✔ | ✘ | ✘ |
| Every N, specific weekdays, nth weekday | ✔ | ✔ | ✔ custom | ✘ (the tab is the interval) |
| Repeat from completion date | ✔ `every!` | ✔ | UNKNOWN | ✘ |
| Skip one occurrence without completing it | Postpone | ✔ | UNKNOWN | ✘ |
| Overdue repeats don't pile up | ✔ for daily | UNKNOWN | n/a (My Day resets) | ✘ |
| Subtasks or checklist | ✔ 4 levels | ✔ 5 levels + check items | ✔ steps | ✘ |
| Notes or description | ✔ | ✔ Markdown | ✔ | ✘ |
| Lists, projects, labels | ✔ | ✔ | ✔ | ✘ (by design) |
| Habits and streaks | Karma streak only | ✔ full | ✘ | ✘ |
| Focus timer | ✘ | ✔ | ✘ | ✘ |
| Android widget | ✔ | ✔ many | ✔ | ✘ |
| Swipe gestures | ✔ configurable | ✔ configurable | delete | ✘ |
| Undo after completing | ✔ | UNKNOWN | UNKNOWN | ✘ (reopen from Completed) |
| Kanban | ✔ any view | ✔ any list | ✘ | ✔ web, by frequency |
| Reopen completed tasks | ✘ for recurring occurrences | ✔ via Completed list (INFERRED) | UNKNOWN | ✔ |
| Completion history kept | 1 week on free | ✔ | UNKNOWN | ✔ forever |

### 4.2 What all three leaders have and EIO lacks

- **A time and a reminder** attached to a task.
- **A screen that answers "what is due today"** across every list.
- **Natural-language capture** with a one-tap escape hatch.
- **Richer recurrence** than a single interval.
- **Breakdown inside a task:** steps, check items or sub-tasks.
- **Notes.**
- **A home-screen widget.**
- **Swipe actions.**

All of this is OBSERVED in §2.

### 4.3 The frequency model: a strength, or something to rethink? (Q14)

- **What the leaders do** (OBSERVED, §2):
  - None of them organises by frequency. They organise by list or project, treat frequency as a property of a task's *date rule*, and give you *time-horizon* views on top: Today, Tomorrow, Next 7 Days, Later and Overdue.
  - The closest thing to EIO's idea is TickTick's habit **quota** ("three times a week").
  - Microsoft To Do pushes daily repeats into My Day.
- **Where EIO's model is strong** (INFERRED):
  - "How often does this come back?" is a natural way to think about *responsibilities*: monthly bills, quarterly filter changes, the yearly car insurance.
  - The four-column web board shows the shape of the workload at a glance, which none of the leaders gives without configuration. **Keep it.**
- **Where it hurts** (INFERRED from EIO's code, compared with §2):
  1. **The tab is the repeat interval.** A "weekly" task cannot be every 2 weeks, Monday and Thursday, or the first Saturday. Todoist and TickTick both support all three.
  2. **One-off tasks have to pretend to have a frequency.** A one-time "renew passport" must sit in Daily, Weekly, Monthly or Yearly, where the column means nothing.
  3. **There is no daily surface on the phone.** To see everything due today you visit four tabs. The dashboard tile counts overdue tasks but is not somewhere you can act.
  4. **Overdue repeats pile up.** Because the next date is "one interval after the old due date", a daily task three weeks overdue comes back still overdue (the test case `nextDueDate('2026-08-01','daily') → '2026-08-02'`). It has to be ticked about 21 times to catch up. Todoist anchors to the schedule too, but lands the next daily occurrence after the completion date (OBSERVED, §2.1).
  5. **Month-end drift.** Clamping is correct for a single step, but the next step starts from the clamped date. A task due on the 31st goes to 28 February and then to 28 March, forever after. A 29 February yearly task becomes 28 February permanently (INFERRED from `addInterval` and its tests).
  6. **No series identity.** Occurrences are separate rows linked only by title and frequency. Streaks, a history for one routine, and "how often do I skip this" cannot be computed reliably, and renaming a task breaks the link.
  7. **Completion time is not stored.** `updated_at` changes on any edit, so it is not a reliable completion timestamp.
- **Verdict:** keep frequency as the way repeating responsibilities are *filed* and shown on the board. Add a **date-driven Today** as the main daily screen. Make the repeat rule richer *inside* a frequency: weekly, but on Mon and Thu; monthly, but every 2 months. Give one-off tasks a sensible home, such as a fifth "Once" bucket or a frequency of null. Fix the roll-forward and the drift.

### 4.4 What EIO already does better

- **History is kept forever, and any task can be reopened.**
  - Todoist's completed recurring occurrences are "records only" that cannot be reopened. Its free plan shows one week of history. Its Android app did not show completed recurring tasks at the time the help page was written. (All OBSERVED.)
  - EIO's Open / Completed switch is simpler than Todoist's per-view Display toggle.
- **A kanban by frequency with no setup.** Todoist's board needs sections, and TickTick's kanban needs grouping chosen per list (OBSERVED). EIO's columns *are* the model, and dragging across columns changes the frequency.
- **Hand-set order that both clients share.** Todoist's drag-to-postpone and drag-to-indent only work with sorting and grouping turned off (OBSERVED).
- **Every priority level has a colour.** Todoist's Today documentation mentions only p1 being shown in red (OBSERVED). How its other levels look is UNKNOWN. Microsoft To Do has only a star (OBSERVED). TickTick's list styling for priorities is UNKNOWN.
- **No paywalls or limits.** Calendar, deadlines, durations and full history are paid-only on Todoist (OBSERVED, pricing). This matters only because EIO never has to design around a free tier.
- **Tasks sit next to the rest of life.** Finance, fitness and subscriptions are in the same app and the same database. TickTick's stated ambition is "everything in their lives" (OBSERVED, Design Principles). EIO already has the wider data.

---

## 5. Recommendations

Effort: **S** is under a day, **M** is a few days, **L** is a week or more. "DB change" means a Supabase migration.

### ★ TOP 5

#### ★1. A Today screen, made the phone's default Tasks view

- **What:**
  - One list across all four frequencies.
  - Sections, in order:
    - **Overdue**, with a single "Reschedule" action on the section header.
    - **Today.**
    - Optionally, **Undated daily repeats**.
    - **Completed today**, collapsed, with a count.
  - The frequency tabs stay, one swipe away.
  - The dashboard tile opens it.
- **Why:** running your own life is mostly answering "what do I do now?". Four tabs answer "what kinds of things do I have?". Every leader opens on a horizon view.
- **Who has it:** Todoist (Today), TickTick (Today smart list), Microsoft To Do (My Day + Planned).
- **Effort:** M.
- **DB change:** none. The queries filter on `due_date <= today` across frequencies.

#### ★2. Time of day and reminders, plus a daily planning notification

- **What:**
  - An optional `due_time`.
  - A default reminder, such as "at time" or "30 min before", with Done and Snooze actions on the notification.
  - One "plan your day" digest notification at a chosen time listing overdue and today counts. Tapping it opens the Today screen.
  - Later: an "urgent" option that repeats until acted on.
- **Why:**
  - Without reminders, the app only works when you remember to open it.
  - The digest is the cheapest form of the ritual that Microsoft To Do's Routine reminders and TickTick's Daily Notification provide.
  - Repeating until acted on is how Todoist's Urgent reminders and TickTick's Constant Reminder deal with Android's unreliable notifications.
- **Who has it:** all three. Urgent or constant alarms: Todoist and TickTick.
- **Effort:** M.
  - The Subscriptions notification code is the starting point.
  - INFERRED from its header comment: notifications do not run in Expo Go, so this needs a development build.
  - Some Android phone makers restrict background alarms. TickTick documents an "Alert Mode" workaround (OBSERVED).
- **DB change:** yes. Add `due_time time`, plus `reminder_offset_min int` or `remind_at timestamptz`.

#### ★3. A sound recurrence engine

Fix the piling-up and drift problems, and add the options leaders share.

- **What:**
  - **Roll forward:** completing an overdue repeat lands on the first scheduled date *after today*, keeping the anchor, so Monday stays Monday.
  - **Skip this occurrence**, recorded as skipped rather than done, so history stays honest.
  - **Repeat from:** due date (the default) or completion date.
  - **Every N** of the frequency, **on these weekdays** for weekly, and **day N, or the nth weekday, or the last day** for monthly.
  - **Store the anchor day** so a task due on the 31st stays on the 31st, or the last day of shorter months.
  - A **Won't do** outcome.
- **Why:** routine responsibilities are most of EIO's list, so the repeat rule *is* the product. The current rule silently creates overdue debt and drifts at month end (§4.3).
- **Who has it:**
  - Todoist: every / every!, postpone, complete forever.
  - TickTick: By Due Date, By Completion Date and By Specific Dates, plus skip, Won't Do, and end after N times.
  - Microsoft To Do: weekdays and custom.
- **Effort:** M. The pure functions and their tests already exist to extend.
- **DB change:** yes.
  - `repeat_every smallint default 1`.
  - `repeat_weekdays smallint[]`.
  - `repeat_anchor_day smallint`.
  - `repeat_from text check (repeat_from in ('due','completion'))`.
  - `series_id uuid`, shared by every occurrence of one routine.
  - `completed_at timestamptz`.
  - `outcome text check (outcome in ('done','skipped','wont_do'))`.

#### ★4. Natural-language quick add, in a bottom sheet

- **What:**
  - A one-line field that parses dates ("tomorrow", "fri", "19/10", "next month"), times ("7pm"), repeats ("daily", "every mon", "every 2 weeks", "every! 3 days") and priority ("!high" or "p1").
  - Each parsed word is highlighted as a chip, and tapping a chip turns it back into plain text.
  - Repeat words also choose the frequency tab.
  - Enter adds the task and keeps the sheet open for the next one.
  - Pre-fill from context: the current tab's frequency, and the date of the day you are looking at.
- **Why:** a task you can type in three seconds actually gets typed. This is the feature reviewers praise most in Todoist.
- **Who has it:** all three. Microsoft To Do's Android support is UNKNOWN.
- **Effort:** M. A parsing library could be used, or a small hand-written grammar for EIO's limited vocabulary.
  - INFERRED: Indian dates are written day-first, so "05/11" must mean 5 November.
  - TickTick's rule that an ambiguous time means the nearest future one is worth copying.
- **DB change:** none beyond ★2 and ★3.

#### ★5. Swipe gestures, an undo snackbar, and a quick reschedule sheet

- **What:**
  - **Swipe right** to complete, revealing a green tick.
  - **Swipe left** to open a reschedule sheet: Today, Tomorrow, This weekend, Next week, No date, Pick, and **Skip occurrence** for repeats.
  - A snackbar reading "Completed · Undo" for about 4 seconds after any completion.
  - **Long press** for multi-select, with bulk reschedule and complete.
- **Why:**
  - Swiping is the fastest triage on a phone.
  - Undo makes fast completion safe. Today, undoing in EIO means finding the task in the Completed view, and reopening a repeat leaves its new occurrence behind (`reopenTask` does not remove it).
- **Who has it:**
  - Todoist: configurable swipes and an Undo pop-up.
  - TickTick: swipe left for Move, Delete or Date, and right for Done or Pin.
  - Microsoft To Do: swipe to delete.
- **Effort:** S–M. The Undo should also delete the new occurrence it created.
- **DB change:** none.

### The rest, in priority order

| # | Recommendation | Why it matters for one person | Who has it | Effort | DB change |
| --- | --- | --- | --- | --- | --- |
| 6 | **Notes and a checklist on a task.** A free-text note, plus check items that **reset when a repeat comes round** (Todoist's "Reset sub-tasks"). A full subtask tree is not needed. | Routines often have steps, like a monthly bills run or a car-service checklist. TickTick's check items, which complete the task when all are done, are the lightest version. | All three (steps, check items, sub-tasks) | M | `notes text`, `checklist jsonb` |
| 7 | **Streaks and history for repeating tasks.** A streak chip on the row (current, tap for total), a per-routine history, and a 365-day heat map on the website. Days off and pause, so planned breaks don't break a streak. | It makes routines feel like progress without a separate habit app. It needs ★3's `series_id` and `completed_at`. | TickTick (streaks, heat maps), Todoist (Karma streaks, days off, vacation) | M | Uses ★3's columns |
| 8 | **Upcoming.** A week strip on the phone (swipe weeks, dots on busy days, long-press a day to add) and a **month calendar on the website** (drag to reschedule, colour by priority or frequency, toggle completed). | You can see a heavy week coming and spread yearly and monthly duties out. | Todoist (week picker, busy dots), TickTick (month and year views) | M | None |
| 9 | **Triage of stale tasks.** On Today, a "Needs a decision" section: postponed 3 or more times, overdue for more than 14 days, or undated and added recently. Each has buttons for Today, Pick date, Won't do and Done. | It stops the list rotting quietly, which is the main way personal task lists die. | TickTick (Suggested Tasks), Microsoft To Do (Suggestions) | S–M | `postpone_count int` |
| 10 | **An Android home-screen widget.** Today's list, with tap-to-complete and a + button. | It shows the day without opening the app. | All three | **L.** Needs native widget code and a development build. INFERRED; check the Expo SDK 57 docs first. | None |
| 11 | **Habit quotas** ("3× a week") as an option on weekly or monthly repeats, with a progress bar instead of a due date. | It fits flexible routines like the gym, calls home, or reading. Coordinate with the Fitness module so workouts are not tracked twice. | TickTick habits | M | `target_count smallint` |
| 12 | **Group-by on the website board.** Switch columns between Frequency, Due (Overdue, Today, Tomorrow, This week, Later) and Priority. | Today's board shows "what kind of work". The other groupings answer "what's urgent". | TickTick (kanban group and sort), Todoist (Today board by priority) | S | None |
| 13 | **Smarter defaults.** Turn Repeat on by default in Daily; a remembered default priority and reminder; "add another" stays open. | It removes taps from the most common add. | TickTick (Task Default) | S | None |
| 14 | **Optional "area" tags** (Home, Money, Health, People), shown as a small chip and used as a filter. | They give a second view across frequencies without becoming projects. Low priority: frequency already does most of the job. | All three (lists, labels, tags) | M | `area text` |
| 15 | **A focus timer** linked to a task. | It is only useful if you work in timed blocks. It is the leaders' least-shared feature. | TickTick only | M | `focus_sessions` table |

**Deliberately dropped:** sharing, assignees and comments; AI assistants and the MCP/agent features; email-to-task; templates; location reminders; the Eisenhower matrix (EIO's three-level priority plus Today covers it); Karma points and levels.

---

## 6. UI and UX patterns worth adopting

Each pattern names its source. Where a detail is EIO's own design choice rather than something the leaders do, it is marked as a proposal.

1. **Quick-add sheet** (from Todoist, TickTick and Microsoft To Do):
   - A bottom sheet over the keyboard, with focus on the title immediately.
   - Below the title, a row of icon chips: 📅 date, ⏰ time, ↻ repeat, ● priority. Each chip shows its *current value* and fills in as parsing recognises text.
   - Parsed words are drawn as tinted inline chips inside the text. Tapping one turns it back into plain text (Todoist and TickTick); Backspace removes it (Microsoft To Do).
   - Enter saves the task and clears the field for the next one. Swipe the sheet down to close it.
   - The full-screen editor stays for details. A small "⤢" in the sheet opens it.
2. **Today screen layout:**
   - Header: "Today", the date, and "4 of 9 done" (proposal).
   - The **Overdue** section has a red header showing its count, with a text button "Reschedule" on the right. That button opens the reschedule sheet and applies the choice to every overdue task (Todoist).
   - Then **Today**, sorted by time, then priority, then hand-set position.
   - Then **Completed today**, collapsed, with a count. Its rows are struck through at reduced opacity.
   - Tapping an overdue task's date chip opens the same reschedule sheet.
3. **The date chip on each row:**
   - Relative wording: "Today", "Tomorrow", a weekday name within 6 days, otherwise "12 Nov".
   - **Red text when overdue.** The time is appended ("Today 19:00").
   - A ↻ glyph when the task repeats, with the rule in short form ("↻ Mon, Thu").
   - The priority dot stays on the left, as now.
4. **Swipe affordances:**
   - **Right swipe:** a green background with a ✓ that grows as the swipe passes the threshold, plus a haptic tick at the threshold.
   - **Left swipe:** an amber background with a 📅 that opens the reschedule sheet.
   - After completing, the row collapses and a bottom snackbar reads "Completed · Undo" for about 4 seconds.
   - Swipes are customisable in Todoist and TickTick (OBSERVED). For a single user, fixed swipes are fine (proposal).
5. **Reschedule sheet:**
   - One tap each: Today, Tomorrow, This weekend, Next week, No date, Pick a date…
   - For repeats, add **Skip this occurrence**, which records a skip.
   - In the date picker, put a small **dot under days that already have tasks** (Todoist's "busy" dot).
6. **Repeat editor:**
   - Presets: Daily, Weekdays, Weekly on ‹today's weekday›, Monthly on the ‹date›, Yearly on ‹date›, Custom.
   - Custom has:
     - "Every [N] [days/weeks/months/years]".
     - Weekday toggles for weekly.
     - "On day [N] / the [2nd] [Sat] / the last day" for monthly.
     - A segmented **"Repeat from: Due date | When completed"** (Todoist's every / every! and TickTick's By Due Date / By Completion Date).
     - "Ends: Never / On date / After N times" (TickTick).
   - Under the controls, a plain-English summary and the **next three dates** (proposal), so the rule can be checked before saving.
7. **Notifications:**
   - The title is the task. The body is "Due 19:00 · ↻ Daily".
   - Actions: **Done**, and **Snooze**, with the snooze length set in Settings (Todoist "When snoozed…", TickTick's pop-up). Tapping opens the task.
   - The daily digest reads "3 overdue · 6 today" and opens Today (Microsoft To Do's Routine reminders).
8. **Upcoming:**
   - A horizontal 7-day strip pinned at the top, with weekday letter, date number and a dot if busy. Swipe for other weeks, tap the month title to jump, and tap the "today" icon to return (Todoist).
   - Below, a list with sticky day headers.
   - Long-pressing a day adds a task on that day (Todoist on Android).
9. **Streaks and heat map:**
   - On a repeating task's row, a small "🔥 12" chip; tapping it switches between current streak and total (TickTick).
   - In the detail view, a month grid of done, skipped and missed days. Tapping a past day logs a missed completion (TickTick).
   - On the website, a 365-day heat map per routine and across all routines (TickTick's Year view and Habit Heat Map).
   - Pause and days-off settings, so planned breaks don't break a streak (Todoist).
10. **Triage cards:**
    - A "Plan your day" button on Today walks through overdue and stale tasks **one card at a time**, with large buttons: Today, Tomorrow, Pick, Won't do, Done (TickTick's 2020 "Plan Your Day" and Suggested Tasks).
    - Finish with a short summary: "Planned 7 for today".
11. **Empty and done states** (proposal; the leaders' empty states are UNKNOWN):
    - When Today is empty or fully done, show one calm line ("Nothing left today") and the next upcoming task as a single tappable row, not a blank screen.
    - Hide empty sections entirely (TickTick's "Show if not empty").
12. **The web board:**
    - Column headers show the count and a red overdue count ("Weekly · 15 · 3 overdue").
    - A "Group by" switch for Frequency, Due and Priority (TickTick's kanban grouping, Todoist's Today board).
    - Cards show the date chip and the ↻ rule.
13. **Restraint** (TickTick's Design Principles, Todoist's minimalism):
    - Keep the task detail screen sparse: title, chips, notes and checklist only.
    - No badges or red dots except for overdue items.
    - New modules, such as a focus timer, are opt-in rather than always visible.

---

## 7. Checklist status

| # | Question | Status | Notes |
| --- | --- | --- | --- |
| Q1 | Top three on Android | **Answered** | AndroidRank and Zapier. Play listings were not readable directly. |
| Q2 | Capture speed, natural-language parsing, pre-fill | **Partial** | Todoist and TickTick parsing are documented. TickTick's current inline symbols are UNKNOWN (sources are from 2014 and 2020). Microsoft To Do on Android is UNKNOWN. Pre-fill in Todoist's Today is UNKNOWN. |
| Q3 | Recurrence models, overdue handling, skipping | **Partial** | The models are clear for all three. Overdue roll-forward is documented only for Todoist's daily repeats. Microsoft To Do's completion behaviour is UNKNOWN. |
| Q4 | Reminders and notifications | **Answered** for Todoist and TickTick, **partial** for Microsoft To Do | Microsoft To Do's notification actions are UNKNOWN. |
| Q5 | Today and Upcoming | **Answered** | |
| Q6 | Subtasks and notes | **Answered** | |
| Q7 | Habits and streaks | **Answered** | Todoist Karma is OBSERVED\* only. |
| Q8 | Focus timer | **Answered** | Only TickTick has one. |
| Q9 | Calendar views | **Answered** | |
| Q10 | How completed tasks are shown | **Partial** | Microsoft To Do is UNKNOWN. Todoist is OBSERVED\*. |
| Q11 | Swipe gestures | **Partial** | Todoist is OBSERVED\*. Microsoft To Do only for delete. |
| Q12 | Widgets | **Answered** | Microsoft To Do is partial. |
| Q13 | Kanban and boards | **Answered** | |
| Q14 | The frequency model | **Answered** (INFERRED analysis, grounded in OBSERVED behaviour and EIO's code) | |
| Q15 | User praise and complaints | **Partial** | No direct Reddit, Play Store or Capterra reviews could be read. Opinion comes from reviewers and comparison articles quoting users, and a few App Store reviews. |
| Q16 | UI and visual patterns | **Partial** | No screenshots were viewed. Empty states, exact colours and bottom-navigation layout are UNKNOWN for all three. |

**Unresolved and worth a follow-up:**

- Google Play listings and reviews.
- Reddit opinion from the last year, including how Todoist's June 2026 Android redesign was received.
- Whether TickTick's "Plan Your Day" and Daily Notification still exist.
- Microsoft To Do's Android swipes, how it shows completed tasks, and whether its natural-language parsing works on Android.

The web-search budget ran out before these could be chased. A follow-up session could continue the search.

---

## Sources

**Rankings and roundups**

- AndroidRank: [Todoist](https://www.androidrank.org/application/todoist_to_do_list_planner/com.todoist) · [TickTick](https://www.androidrank.org/application/ticktick_to_do_list_calendar/com.ticktick.task) · [Microsoft To Do](https://www.androidrank.org/application/microsoft_to_do_lists_tasks/com.microsoft.todos) · [Google Tasks](https://www.androidrank.org/application/google_tasks/com.google.android.apps.tasks) · [Any.do](https://www.androidrank.org/application/any_do_to_do_list_planner/com.anydo)
- [Zapier: best to-do list apps (updated Dec 2025)](https://zapier.com/blog/best-todo-list-apps/) · [2sync: best to-do list apps](https://2sync.com/blog/best-to-do-list-apps) · [PhoneArena: Google Tasks search](https://www.phonearena.com/news/feature-that-google-tasks-users-have-wanted-could-arrive-soon_id182913)

**Todoist (help centre and changelog)**

- [Use Task Quick Add](https://www.todoist.com/help/articles/use-task-quick-add-in-todoist-va4Lhpzz) · [Introduction to recurring dates](https://www.todoist.com/help/todoist/features/introduction-to-recurring-dates-YUYVJJAV) · [Complete a task with a recurring date](https://www.todoist.com/help/todoist/features/complete-a-task-with-a-recurring-date-dmI6SVqdP) · [Introduction to reminders](https://www.todoist.com/help/articles/introduction-to-reminders-9PezfU)
- [Today view](https://www.todoist.com/help/todoist/get-started/plan-your-day-with-the-today-view-UVUXaiSs) · [Upcoming view](https://www.todoist.com/help/todoist/get-started/plan-your-week-with-the-upcoming-view-OKOg1mR8) · [Deadlines](https://www.todoist.com/help/articles/introduction-to-deadlines-in-todoist-uMqbSLM6U) · [Sub-tasks](https://www.todoist.com/help/articles/introduction-to-sub-tasks-kMamDo)
- [Android widget](https://www.todoist.com/help/todoist/features/use-a-todoist-widget-on-your-android-device-632pZA) · [Swipe actions](https://todoist.com/help/articles/360016892459) · [View completed tasks](https://www.todoist.com/help/todoist/features/view-completed-tasks-in-todoist-J19h2s) · [Karma](https://www.todoist.com/help/todoist/features/introduction-to-karma-OgWkWy) · [Vacation mode](https://www.todoist.com/help/articles/turn-on-or-off-vacation-mode-in-todoist-pAQmRp)
- [2026 changelog](https://www.todoist.com/help/todoist/product-updates/2026-changelog-HD3jJAtLd) · [September 2026 update](https://www.todoist.com/help/todoist/product-updates/september-2026-decide-whats-urgent-and-let-the-rest-wait-ewUpBiZOm) · [26 little-known features](https://www.todoist.com/inspiration/hidden-features-todoist) · [Pricing](https://www.todoist.com/pricing)

**TickTick (help centre: `https://help.ticktick.com/articles/<id>`)**

- [Set Up Recurring Tasks](https://help.ticktick.com/articles/7055782206349770752) · [Add Tasks](https://help.ticktick.com/articles/7055782422935240704) · [Smart Recognition](https://help.ticktick.com/articles/7081924556310446080) · [Effective Reminder Feature](https://help.ticktick.com/articles/7055782395743567872) · [Constant Reminder](https://help.ticktick.com/articles/7374017550633402368)
- [Task Details](https://help.ticktick.com/articles/7055782408586526720) · [Multilevel Tasks](https://help.ticktick.com/articles/7055782219767349248) · [List View (swipe)](https://help.ticktick.com/articles/7055782365863346176) · [Group & Sort](https://help.ticktick.com/articles/7056594711640801280) · [Kanban View](https://help.ticktick.com/articles/7055782353376903168)
- [Start a New Habit](https://help.ticktick.com/articles/7055781878401335296) · [Better Achieve Habits](https://help.ticktick.com/articles/7055781805944733696) · [Habit Review](https://help.ticktick.com/articles/7055781785312952320) · [How to Start Focus](https://help.ticktick.com/articles/7055782010496745472)
- [Week View](https://help.ticktick.com/articles/7055782149730861056) · [Month View](https://help.ticktick.com/articles/7055782128335716352) · [Year View](https://help.ticktick.com/articles/7399726920725692416) · [Calendar View Options](https://help.ticktick.com/articles/7055782085826445312) · [Eisenhower Matrix](https://help.ticktick.com/articles/7055782055577124864)
- [Suggested Tasks](https://help.ticktick.com/articles/7401564165023727616) · [Widgets](https://help.ticktick.com/articles/7055780404896202752) · [Achievements and Statistics](https://help.ticktick.com/articles/7082302534169133056) · [FAQ](https://help.ticktick.com/articles/7055792921664028672) · [What's New](https://help.ticktick.com/articles/7082552170989486080) · [Design Principles](https://help.ticktick.com/articles/7054327235582361600) · [Beginner's Guide](https://help.ticktick.com/articles/7054286604315131904)
- [TickTick blog: 20 lesser-known features (2020)](https://blog.ticktick.com/2020/12/08/20-lesser-known-ticktick-features/) · [TickTick blog: tags (2014)](https://blog.ticktick.com/2014/05/23/group-your-tasks-by-using-tags-on-ticktick/) · [Curtis McHale: quick add syntax (2020)](https://curtismchale.ca/2020/08/10/ticktick-quick-add-syntax)

**Microsoft To Do (support.microsoft.com)**

- [My Day](https://support.microsoft.com/en-us/ToDo/my-day-and-suggestions) · [Plan and connect](https://support.microsoft.com/en-us/todo/plan-and-connect-with-microsoft-to-do) · [My Day in Outlook](https://support.microsoft.com/en-us/topic/6de6ee52-751b-4405-b389-850572b15306) · [Creating daily habits](https://support.microsoft.com/en-us/ToDo/creating-daily-habits-with-microsoft-to-do) · [Routine reminders on Android](https://support.microsoft.com/en-us/ToDo/using-routine-reminders-on-android)
- [Smart due date recognition](https://support.microsoft.com/en-us/ToDo/smart-due-date-reminder-recognition-in-microsoft-to-do) · [Due dates and reminders](https://support.microsoft.com/en-us/ToDo/add-due-dates-and-reminders-in-microsoft-to-do) · [Steps, importance, notes, tags](https://support.microsoft.com/en-us/ToDo/add-steps-importance-notes-tags-and-categories-to-your-tasks)
- [Sort and search](https://support.microsoft.com/en-us/ToDo/sort-and-search-in-lists) · [Customize your lists](https://support.microsoft.com/en-us/ToDo/customize-your-lists) · [Android widget](https://support.microsoft.com/en-us/ToDo/using-the-android-widget-with-microsoft-to-do) · [Create, edit, delete and restore tasks](https://support.microsoft.com/en-us/ToDo/create-edit-delete-and-restore-tasks) · [App Store listing and reviews](https://apps.apple.com/us/app/microsoft-to-do/id1212616790)

**Reviews and comparisons**

- [Ellie: Todoist vs TickTick (Oct 2026)](https://ellieplanner.com/comparisons/todoist-vs-ticktick) · [Morgen: TickTick vs Todoist (Mar 2026)](https://www.morgen.so/blog-posts/ticktick-vs-todoist) · [ClickUp: TickTick review (Jun 2026)](https://clickup.com/learn/topic/task-management/tools/ticktick/) · [ClickUp: Microsoft To Do review (Jun 2026)](https://clickup.com/learn/topic/task-management/tools/microsoft-to-do/)
- These vendors compete with the apps they review (Ellie, ClickUp, Morgen), so their verdicts are weak evidence. They are used for feature facts and quoted user opinion.

**EIO (read-only)**

- `app/src/modules/todo/types.ts` · `app/src/modules/todo/api.ts` · `app/src/modules/todo/__tests__/recurrence.test.ts` · `app/src/modules/todo/screens/TodoEditScreen.tsx` · `app/src/modules/todo/screens/TodoListScreen.tsx` · `app/src/core/date.ts` (`addInterval`) · `app/src/modules/subscriptions/notifications.ts` · `docs/USER-GUIDE.md`
