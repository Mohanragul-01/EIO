# Personal Life OS App — Project Plan

## 1. Overview

A personal, cross-platform (Android-first) app that acts as a "home screen" of small,
independent life-management tools — similar in spirit to a CRM/ERP with plugin modules,
but for personal use instead of business use.

- **Single user** (me), no multi-tenant / public auth complexity needed.
- **Modules feel independent** — each one is its own mini-app with its own screens and
  data, not deeply cross-linked. New modules should be addable later without touching
  existing ones.
- **Developer profile**: beginner, learning React Native as I build this. Prioritize
  clear, well-commented code and consistent patterns over cleverness. Explain the
  reasoning behind structural decisions the first time a new pattern is introduced.

## 2. Tech Stack

- **Framework**: React Native with **Expo** (managed workflow) — simplest path to a
  working Android build without wrestling native tooling.
- **Language**: TypeScript (catches mistakes early, and Claude Code can type-check work).
- **Backend/DB**: Supabase (Postgres + built-in Auth + Storage), free tier.
  - Free tier is 500MB DB / 1GB file storage — plenty for personal data.
  - Free projects auto-pause after 7 days of inactivity — acceptable for personal use;
    can be manually resumed from the Supabase dashboard, or pinged periodically.
- **Navigation**: React Navigation.
- **State/data fetching**: Supabase client + React Query (or simple hooks) for caching.
- **Styling**: consistent shared theme (colors, spacing, typography) defined once in
  `core/theme`, reused by every module so the app feels cohesive despite modules being
  functionally independent.

## 3. Architecture Pattern: "Home Screen of Apps"

- A **shell app** shows a home grid/list of tiles — one per module (Todo, Notes,
  Finance, Fitness, etc.). Tapping a tile navigates into that module's own stack of
  screens.
- Each module lives in its own folder under `src/modules/<module-name>/` with its own
  screens, components, and Supabase queries. Modules do **not** import from each other.
- Shared code (theme, generic UI components, the Supabase client, auth) lives under
  `src/core/`.
- Adding a new module later = new folder + one entry in the home screen's tile list.
  No changes to existing modules required.
- **Sharing rule**: when a second module needs something, it moves *down* into
  `core/` — it never moves *across* between modules. This is why the ledger
  (`core/ledger.ts`) and the category catalogue (`core/categories.ts`) live in core,
  while workout types stayed inside the Fitness module.

### 3a. User-created modules (the "plugin" capability) — CORE FEATURE

Like a CRM/ERP where you define your own objects, the app can create new modules
**from inside the app**, with no code and no migration.

- **Two kinds of module, deliberately:**
  - **Built-in** — hand-written code (`src/modules/todo/`, `finance/`, …). Used when a
    module needs domain intelligence: Finance's month switcher and paise-exact
    totals, Fitness's 7-day strip and streak logic.
  - **Custom** — defined as data at runtime, rendered by one generic list screen and
    one generic form. Used for straightforward record-keeping.
- **The rule for choosing**: build by hand when the module needs to *think*; use the
  builder when it just needs to *remember*.
- The registry pattern makes this natural — a built-in module is an entry in a code
  array, a custom module is a row in a table. The home screen normalises both into one
  tile type and doesn't know which is which.
- **Field types**: text, long text, number, money (integer paise, same as
  transactions), date, yes/no, single-choice.
- **Storage**: values live in a `jsonb` column keyed by field key, rather than one real
  table per module. Creating real tables at runtime would need a privileged server
  function executing generated SQL — significant work and a security surface not worth
  opening for a personal app. Trade-off accepted: no per-field DB constraints and
  weaker querying, neither of which matters at personal scale.
- **Data safety**: field keys are generated once from the label and then frozen, so
  renaming a field never orphans stored values. Deleting a field removes the
  definition but leaves the values in `jsonb`, so the deletion is recoverable.

```
src/
  core/
    supabase.ts          // Supabase client init
    theme.ts              // colors, spacing, fonts
    components/           // shared Button, Card, EmptyState, etc.
  navigation/
    RootNavigator.tsx
  home/
    HomeScreen.tsx         // grid of module tiles
  modules/
    todo/
      screens/
      components/
      api.ts               // Supabase queries for this module only
      types.ts
    notes/
      ...
    finance/
      ...
    fitness/
      ...
```

## 4. Modules

### V1 (build first, in this order)
1. **Todo** — tasks with title, due date, done/not done, optional priority.
   Build this first: it establishes the CRUD + Supabase pattern every other module reuses.
2. **Notes** — title, body text, created/updated date, optional tags.
3. **Finance Tracker** — transactions (amount, category, date, note), simple monthly
   totals by category.
4. **Subscriptions Tracker** — recurring bills (name, amount, billing cycle, next due
   date) with a simple upcoming-renewals view. (Recommended add-on to Finance — small
   module, high daily value.)
5. **Fitness Tracker** — workout log (date, type, duration/sets/reps notes).

### Later / backlog
Most of these no longer need hand-built modules — the builder (§3a) covers them.

**Buildable today with the module builder, no code:**
- Sleep log
- Journal (private, timestamped, optional mood tag)
- Document vault (ID, insurance, warranties — expiry as a date field)
- Reading/watch list
- Goals tracker
- Vehicle/home maintenance log

**Still need hand-written modules** (they need logic, not just storage):
- Calendar/events view — needs a date-grid UI
- Habit tracker — needs streak calculation and a completion grid
- Document expiry *reminders* — the vault itself is a custom module, but
  notifications would need real code

## 5. Data Model (Supabase / Postgres, sketch)

All tables scoped by `user_id` (even single-user, this keeps Supabase Row Level
Security straightforward and future-proofs for multi-device sync).

```sql
-- todo
todos (id, user_id, title, due_date, is_done, priority, created_at)

-- notes
notes (id, user_id, title, body, tags text[], created_at, updated_at)

-- finance
transactions (id, user_id, amount, category, note, date, created_at)

-- subscriptions
subscriptions (id, user_id, name, amount, billing_cycle, next_due_date, created_at)

-- fitness
workouts (id, user_id, date, type, duration_minutes, notes, created_at)

-- user-created modules (§3a)
user_modules       (id, user_id, name, icon, color, position, created_at, updated_at)
user_module_fields (id, module_id, user_id, key, label, type, required, options jsonb,
                    position, created_at)
user_records       (id, module_id, user_id, data jsonb, created_at, updated_at)
```

Enable Row Level Security on every table, four policies each (select / insert /
update / delete), all `user_id = auth.uid()`. `UPDATE` needs both `USING` and
`WITH CHECK`, or a row's `user_id` could be reassigned to someone else.

**Money is stored as integer paise, never decimal rupees** — JS floating point can't
represent decimals exactly, and these values get summed. Applies to
`transactions.amount_minor`, `subscriptions.amount_minor`, and money fields inside
`user_records.data`. See `src/core/money.ts`.

**Calendar days use `date`, not `timestamptz`** — a due date or a workout date is a
day, not an instant; storing a timestamp shifts entries across midnight by timezone.

## 6. Non-Functional Notes

- **Offline behavior**: not required for V1 — acceptable for the app to need network
  access. Can revisit local caching later if it becomes annoying.
- **Auth**: Supabase email/password or magic link is enough; no need for social login.
- **Design**: consistent look across modules (shared theme) but no need for a heavy
  design system — keep it simple and readable.

## 7. Build Phases for Claude Code

**Phase 0 — Scaffold**
- Init Expo + TypeScript project, install React Navigation + Supabase client.
- Set up `core/theme.ts`, `core/supabase.ts`, folder structure above.
- Build the shell: HomeScreen with a placeholder grid of tiles, empty state for
  each future module.

**Phase 1 — Todo module (reference implementation)**
- Supabase table + RLS policy for `todos`.
- Full CRUD screens (list, add, edit, mark done, delete).
- Explain the pattern used (data fetching, forms, navigation) since this becomes the
  template for every later module.

**Phase 2 — Notes module**
- Reuse Phase 1's pattern.

**Phase 3 — Finance + Subscriptions**
- Transactions CRUD + simple monthly category totals.
- Subscriptions CRUD + "next due" sorted view.

**Phase 4 — Fitness module**

**Phase 5 — User-created modules (§3a)** ← core feature, added after Phase 4
- Tables: `user_modules`, `user_module_fields`, `user_records` + RLS.
- Module builder screen: name, icon, colour, and a field list.
- One generic list screen and one generic form, driven by the field definitions.
- Home screen merges built-in and custom modules into one grid.
- Deliberately excluded from v1: per-module sort order, configurable row titles,
  summary stats, relations between modules, formulas.

**Phase 6 — Polish home screen**
- Live summaries on each tile (open tasks, spend this month, renewals due) rather
  than static subtitles. Needs a summary contract each module opts into, so the home
  screen stays ignorant of what any module contains.
- Custom modules show their record count; built-ins expose their own figure.
- Consistent empty/loading states throughout.

Build and test one phase at a time. Don't start the next module until the current
one runs correctly on an Android device/emulator.

---

## 8. Decisions made during the build (not in the original plan)

- **Auth**: email + password, entered once; the session persists in AsyncStorage and
  auto-refreshes, so there's no recurring login. Chosen over anonymous sign-in because
  anonymous identities are device-bound — a reinstall would orphan all data.
- **`transactions.kind`** (`expense` / `income`) added; the original sketch had only
  `amount`, which can't distinguish money in from money out for category totals.
- **`subscriptions.category`** added so "Mark as paid" files each payment under its own
  category rather than everything landing in Bills.
- **Subscriptions → Finance link**: marking a subscription paid writes an expense via
  `core/ledger.ts`. The ledger lives in core precisely so the two modules stay
  independent of each other.
- **Category lists live in code, not a `categories` table** — they carry an icon and a
  colour, which a text column can't, and there are about a dozen.
- **Two date modes**: `formatDueDate` for deadlines ("3 days overdue") and
  `formatEventDate` for things that already happened ("Yesterday"). Using one for the
  other produced overdue-looking past transactions.

---

## 9. Status: v1 complete, v2 deferred

**Where this stands (August 2026):** all six phases shipped and in daily use.
Five hand-built modules, the user-created module builder, light/dark theming,
live home-screen summaries, 51 passing tests, seven applied migrations.

### v2 was scoped, then deliberately postponed

A much larger second version was specified in detail and then put on hold, on
the reasoning that a feature list written before using the app is mostly
guesswork. The decisions below were made and are worth keeping, because the
work to reach them was real even though none of it was built.

**Confirmed direction, if and when v2 resumes:**

- **Development build over Expo Go.** Already set up: `eas.json`, package id
  `com.nio.eio`, `expo-dev-client` installed, a working dev build produced.
  This is what unlocks notifications, Health Connect, widgets and background
  sync, none of which Expo Go can do.
- **Finance first**, covering both halves: wealth (accounts, assets,
  investments, liabilities, net worth over time, FinBoom-style) and spending
  (category budgets with rollover, savings rate, cashflow).
- **Manual valuations, not a price feed.** FinBoom's own approach. No API keys,
  no scheduled job, nothing to go stale silently. Every value carries the date
  it was set.
- **INR only.** No currency column. Adding one later is mechanical, since every
  amount is already integer minor units.
- **Asset classes to cover:** equity (stocks, mutual funds), retirement and
  small savings (EPF, PPF, NPS, SSY), fixed and commodity (FD, gold, SGB,
  cash), property and loans with EMI schedules.
- **Fitness second**, in full: exercise library, routines, per-set logging with
  RPE, rest timer, PRs, progression charts, body metrics, cardio, nutrition.

**Written but NOT applied:** `supabase/migrations/0008_finance_v2.sql` creates
accounts, assets, asset_valuations, liabilities, net_worth_snapshots and
budgets, and extends transactions with accounts and transfers. It is reviewed
and ready. **Do not assume it has been run** - migrations 0001 to 0007 are
applied, 0008 is not.

### Shipped

- **Standalone APK** built and verified: the real Supabase host is compiled in,
  the placeholder fallback is absent. Runs with no laptop and no dev server.
- **On GitHub** at https://github.com/Mohanragul-01/EIO with a full README.
- **Real app icon**: EIO wordmark on the aurora gradient. Regenerate with
  `scripts/make-icons.js`.
- **In use.** All five modules verified against real entries.

One trap worth remembering, because it cost a broken release: `.env` is
gitignored, so **EAS never receives it**. Cloud builds read the Supabase values
from variables registered on the EAS project (`eas env:create`). Without them a
build succeeds, installs, and then fails at sign-in with
`java.net.UnknownHostException`, because the URL falls back to a host that does
not exist. `src/core/supabase.ts` now throws at startup in release builds rather
than letting that ship quietly.

### Known limits, to fix only if daily use proves them annoying

- **Network required.** No offline cache; every screen needs a connection.
- **No reminders.** Nothing notifies you of a due task, bill or renewal.
- **Supabase free tier pauses after 7 days idle** and needs a manual resume.
