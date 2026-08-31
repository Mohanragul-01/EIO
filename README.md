# EIO

A personal life-management app for Android: a home screen of small, independent
modules, each its own mini-app, backed by Supabase.

Built as a single-user tool rather than a product. The interesting part is not
any one module but the pattern they share, which makes adding the next one
cheap and keeps the existing ones from tangling together.

---

## Modules

| Module | What it does |
| --- | --- |
| **Tasks** | Daily/Weekly/Monthly/Yearly tabs, repeating tasks, due dates, priority |
| **Notes** | Notes, checklists and a dated journal, plus quick capture and an inbox |
| **Finance** | Running balance, monthly transactions, category pie, trend chart, CSV export |
| **Subscriptions** | Billing cycles, renewal reminders 3 days ahead, "mark paid" logs the expense to Finance |
| **Fitness** | Exercise library, routines, per-set logging, personal records, progression charts, body metrics |
| **Module builder** | Define your own module from inside the app, with a chosen tile stat and sort order |

The module builder is the one worth explaining. A built-in module is
hand-written code; a custom module is rows in a table, rendered by one generic
list screen and one generic form. Create "Sleep Log" with fields Date, Hours,
Quality and Notes, and you get working screens immediately. The rule for
choosing: **build by hand when a module needs to think, use the builder when it
just needs to remember.**

---

## Stack

- **React Native** via **Expo** (SDK 57), TypeScript
- `react-native-chart-kit` on `react-native-svg` for charts
- `expo-notifications` for local renewal reminders
- **Supabase** for Postgres, auth and row level security
- **React Navigation** (native stack)
- Plain hooks for data fetching, no state library
- `expo-blur` and `expo-linear-gradient` for the glass and aurora treatment
- Jest with `jest-expo` for tests

---

## Architecture

Four rules hold this together. They are worth reading before changing anything,
because most of the code only makes sense in light of them.

**1. Modules never import each other.**
Each lives in `src/modules/<name>/` with its own `api.ts`, hooks, screens and
types. When a second module needs something, that thing moves *down* into
`src/core/`; it never moves *across*. This is why `core/ledger.ts` and
`core/categories.ts` exist, and why workout types stayed inside Fitness: only
Fitness has a concept of a workout. Putting things in core "in case something
needs them later" turns core into a junk drawer.

**2. Screens never touch the database.**
Screens call hooks, hooks call `api.ts`, `api.ts` calls Supabase. Note that
supabase-js does not throw on database errors, it resolves `{ data, error }`,
so every function checks `error` and throws. Ignoring it silently yields an
empty list and no clue why.

**3. Money is integer paise, never decimal rupees.**
JavaScript cannot represent most decimals exactly, and these values get summed.
`1650.30 + 249.70` gives `1900.0000000000002`; `165030 + 24970` gives `190000`
exactly, always. Rupees exist only where you type one or read one. See
[`src/core/money.ts`](src/core/money.ts).

**4. A calendar day is not an instant.**
Due dates and event dates are stored as `date`, not `timestamptz`, because
`new Date('2026-08-07')` parses as UTC midnight and formats back as the 6th
anywhere behind UTC. There are also two separate formatters: a deadline can be
"3 days overdue", a purchase you already made cannot. See
[`src/core/date.ts`](src/core/date.ts).

### Layout

```
src/
  core/            shared: theme, supabase client, auth, money, dates, components
  navigation/      the one stack, and its typed param list
  home/            the tile grid and its live summaries
  modules/
    todo/  notes/  finance/  subscriptions/  fitness/  custom/
      api.ts       every database call for this module
      types.ts     row shapes and form input shapes
      use*.ts      loading, error and derived state
      screens/     list and edit
      components/  module-specific UI
supabase/migrations/   numbered SQL, applied by hand
```

---

## Running it

**Prerequisites:** Node 20+, a Supabase project, and Expo Go or a development
build on an Android device.

```bash
git clone https://github.com/Mohanragul-01/EIO.git
cd EIO
npm install
cp .env.example .env      # then fill in your Supabase URL and anon key
npx expo start
```

The anon key is public by design and ships inside the app bundle. What protects
the data is row level security, not hiding the key. Never put a `service_role`
key in `.env`.

### Environment variables and EAS builds

`.env` is gitignored, so **EAS never receives it**. A cloud build reads these
values from variables registered on the EAS project:

```bash
eas env:create --scope project --environment preview   --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-REF.supabase.co --visibility plaintext
eas env:create --scope project --environment preview   --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext
```

Repeat for `development` and `production`. Skipping this produces an APK that
installs fine and then fails at sign-in with `java.net.UnknownHostException`,
because the URL falls back to a placeholder host. `src/core/supabase.ts` now
throws at startup in release builds rather than letting that ship silently.

### Database

Run the files in [`supabase/migrations/`](supabase/migrations/) in order,
through the Supabase SQL Editor. Each creates its tables and enables RLS with
four policies (select, insert, update, delete), all `user_id = auth.uid()`.

`UPDATE` needs both `USING` and `WITH CHECK`. With only `USING`, a row's
`user_id` could be reassigned to someone else.

> `0008_finance_v2.sql` is written but **not applied**. It belongs to a
> different, still-planned change (accounts, assets, net worth) and is unrelated
> to the 0009-0012 v2 work. Migrations 0001 to 0007 and 0009 to 0012 are the
> live schema.

### Auth

Email and password, entered once. The session persists in AsyncStorage and
refreshes itself, so the sign-in screen appears only when there is no stored
session. Create your user in the Supabase dashboard under
Authentication → Users → Add user, with "Auto Confirm User" ticked, to skip the
confirmation email.

---

## Scripts

```bash
npm test              # 141 tests
npx tsc --noEmit      # type check
npx expo start        # dev server
```

Tests cover the logic where a silent bug does real damage and nothing would
catch it: money round-tripping and float-free summing, the timezone off-by-one,
due-versus-event date wording, billing cycle maths, the running balance, CSV
escaping, task recurrence anchoring, reminder scheduling, personal-record
detection, and custom-module summaries over jsonb.

Two are regression tests for bugs that actually shipped, and both were verified
to fail without their fix rather than assumed to work.

---

## Building an APK

```bash
npx eas-cli@latest build --profile preview --platform android
```

`preview` produces a standalone APK with the JavaScript bundled in: it runs with
no laptop and no dev server. `development` produces a build that still connects
to Metro, which is the one to use while actively working on the app.

---

## Design notes

**Theming.** Styles come from `makeStyles()`, not a module-scope
`StyleSheet.create`. The usual pattern runs once at import and captures whichever
palette was current then, so it can never respond to a light/dark switch.

**Blur.** Expo SDK 57 requires a `blurTarget` ref pointing at a
`BlurTargetView`; without one a `BlurView` silently renders no blur at all on
Android. `Screen` publishes that ref on a context and `GlassCard` consumes it.

**Refetch on focus.** List screens refetch when they regain focus, through
`useStableCallback`: one function identity that always reaches the latest
closure. The naive version captures the first loader forever, which made Finance
refetch the wrong month after an edit. There are now **no
`react-hooks/exhaustive-deps` suppressions anywhere in the app** - that
suppression is where the bug had been hiding.

**Native modules are required lazily, never imported.** `expo-notifications`
resolves its native module at import and throws where it is absent, and Metro
turns a module-evaluation throw into a fatal error rather than letting a
try/catch see it. So it is loaded behind an `isRunningInExpoGo()` check, using
the same signal the library itself uses. See
[`src/modules/subscriptions/notifications.ts`](src/modules/subscriptions/notifications.ts).

**jsonb is sorted in JavaScript, not SQL.** Ordering a custom module's records
by `data->>'key'` compares everything as TEXT, which puts 100 before 9 for a
number field. It looks right until you scroll.

---

## Status

Version 1 is complete and in use. A much larger v2 was scoped and deliberately
deferred, on the reasoning that a feature list written before using the app is
mostly guesswork. Those decisions are recorded in [`plan.md`](plan.MD) section 9
so nothing is lost.

Known limits, to be fixed only if daily use proves them worth fixing:

- **Network required.** No offline cache.
- **Reminders exist for subscription renewals only** (3 days ahead, local
  notifications, no server). Tasks have no reminders. Reminders are scheduled
  on the device, so they do not survive a reinstall until each subscription is
  edited again, and they need the dev or production build rather than Expo Go.
- **No AI or voice input.** Natural-language quick add was considered and
  deliberately deferred.
- **Custom modules have no relations or formula fields.** If a specific
  cross-module link is ever needed, the answer is a small hand-written bridge in
  `core/`, following `core/ledger.ts`, not a generic relations system.
- Supabase free-tier projects **pause after 7 days idle** and need a manual
  resume from the dashboard.

---

## Licence

Personal project, no licence granted. Read it, learn from it, but it is built
for one user and makes assumptions accordingly.
