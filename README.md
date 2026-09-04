# EIO

A personal life-management system: small, independent modules, each its own
mini-app, backed by Supabase. **An Android app and a desktop website, sharing
one data layer and one database.**

Built as a single-user tool rather than a product. The interesting part is not
any one module but the pattern they share, which makes adding the next one
cheap and keeps the existing ones from tangling together.

**New here?** The [User Guide](docs/USER-GUIDE.md) explains what everything
does and why it behaves the way it does. This file is about how it is built.

---

## Repository layout

```
EIO/
├── app/          Expo app (Android). Owns the shared domain layer.
├── website/      Vite + React desktop client. Imports that layer.
├── supabase/     Migrations. One schema, both clients.
└── docs/         User guide.
```

**Two clients, one brain.** Roughly 3,000 lines - every `api.ts`, every
`types.ts`, the analytics, the recurrence maths, PR detection, jsonb handling
and the colour palettes - contain no React Native import at all. The website
reads them straight out of `app/src` rather than reimplementing or copying
them, so a rule fixed in one place is fixed for both clients.

That direction is deliberate. The app is the older, shipped client and it owns
the domain; the website depends on it and the app depends on nothing. Extracting
a third `shared/` package would be tidier on paper but would mean npm
workspaces and Metro `watchFolders`, which can behave differently on an EAS
build than they do locally - a real risk to a working app, for a rename.

Exactly one file is not portable: `app/src/core/supabase.ts`, which uses
AsyncStorage, a Hermes URL polyfill and Expo's build-time env vars. It is
**not** forked. `website/vite.config.ts` aliases those away and substitutes the
values, which is the same mechanism Metro uses with different inputs, so both
clients run the identical file.

---

## Modules

| Module | What it does |
| --- | --- |
| **Tasks** | Daily/Weekly/Monthly/Yearly, repeating tasks, due dates, priority; a drag-and-drop kanban board on the web |
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

**App**

- **React Native** via **Expo** (SDK 57), TypeScript
- `react-native-chart-kit` on `react-native-svg` for charts
- `expo-notifications` for local renewal reminders
- **Supabase** for Postgres, auth and row level security
- **React Navigation** (native stack)
- Plain hooks for data fetching, no state library
- `expo-blur` and `expo-linear-gradient` for the glass and aurora treatment
- Jest with `jest-expo` for tests

**Website**

- **React 19** on **Vite**, TypeScript
- `react-router-dom` with a **hash** router, so a built copy opens from disk
  with no server to rewrite deep links
- `@dnd-kit` for the task board - chosen over the HTML5 drag API for real
  keyboard support and sane touch behaviour
- `recharts` for charts
- Hand-written CSS with custom properties, no framework
- A hand-drawn SVG icon set, one 24px grid at one stroke weight
- No state library here either

Chosen over Next.js because every byte of EIO is behind auth and scoped to one
user by RLS. There is no SEO, no public page and nothing to pre-render, so a
server would be infrastructure that never earns its keep - and it would replace
a working localStorage session with cookie-based SSR session handling.

---

## Architecture

Four rules hold this together. They are worth reading before changing anything,
because most of the code only makes sense in light of them.

**1. Modules never import each other.**
Each lives in `app/src/modules/<name>/` with its own `api.ts`, hooks, screens and
types. When a second module needs something, that thing moves *down* into
`app/src/core/`; it never moves *across*. This is why `core/ledger.ts` and
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
[`app/src/core/money.ts`](app/src/core/money.ts).

**4. A calendar day is not an instant.**
Due dates and event dates are stored as `date`, not `timestamptz`, because
`new Date('2026-08-07')` parses as UTC midnight and formats back as the 6th
anywhere behind UTC. There are also two separate formatters: a deadline can be
"3 days overdue", a purchase you already made cannot. See
[`app/src/core/date.ts`](app/src/core/date.ts).

### Layout

```
app/src/
  core/            shared: theme, supabase client, auth, money, dates, components
  navigation/      the one stack, and its typed param list
  home/            the tile grid and its live summaries
  modules/
    todo/  notes/  finance/  subscriptions/  fitness/  custom/
      api.ts       every database call for this module      ─┐
      types.ts     row shapes, and the maths worth testing   │ no React Native
      pickerItems / analytics / summary / format             │ import anywhere:
                                                             │ the website runs
      use*.ts      loading, error and derived state          │ these unchanged
      screens/     list and edit                            ─┘ (screens excepted)
      components/  module-specific UI

website/src/
  lib/
    shims/         browser stand-ins for AsyncStorage, react-native, expo
    types/         type-only declarations for packages the site never installs
    auth.tsx       the session; same Supabase client as the app
    useAsync.ts    one loading hook, since the queries live in the shared api.ts
  components/      Shell (sidebar + topbar) and the UI primitives
  styles/          tokens.css - the app's palettes as custom properties
  pages/           one per module

supabase/migrations/   numbered SQL, applied by hand
docs/USER-GUIDE.md     what everything does, and why
```

---

## Running it

**Prerequisites:** Node 20+, a Supabase project, and (for the app) Expo Go or a
development build on an Android device.

Both clients read the same Supabase project. Sign in with the same account and
you see the same rows, because RLS scopes everything to `auth.uid()` regardless
of which client asked.

**The app**

```bash
git clone https://github.com/Mohanragul-01/EIO.git
cd EIO/app
npm install
cp .env.example .env      # then fill in your Supabase URL and anon key
npx expo start
```

**The website**

```bash
cd EIO/website
npm install
cp .env.example .env      # same project, VITE_ names
npm run dev               # opens http://localhost:5173
```

`npm run build` produces a static `dist/` you can open directly - the router is
hash-based and asset paths are relative, precisely so that works with no server
and under any subpath.

The website builds on its own: it does NOT need the app installed. That used to
be untrue by accident - module resolution walks up from the importing file, so
`app/src/core/supabase.ts` found supabase-js in `app/node_modules` and the build
only worked next to an installed app. Both the TypeScript path and the Vite
alias now pin it here.

### Deploying the website

[`.github/workflows/deploy-website.yml`](.github/workflows/deploy-website.yml)
builds and publishes to GitHub Pages on every push that touches `website/` or
`app/src/`. The shared directory is included deliberately: a fix in an `api.ts`
is a website change whether or not any file under `website/` moved.

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets, and
set Pages to build from GitHub Actions. The workflow fails rather than
publishing if those are missing - otherwise you get a valid-looking page whose
only symptom is that login never works.

The anon key is public by design and ships inside both clients. What protects
the data is row level security, not hiding the key. Never put a `service_role`
key in either `.env`.

### Environment variables and EAS builds

`.env` is gitignored, so **EAS never receives it**. A cloud build reads these
values from variables registered on the EAS project:

```bash
eas env:create --scope project --environment preview   --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-REF.supabase.co --visibility plaintext
eas env:create --scope project --environment preview   --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value YOUR-ANON-KEY --visibility plaintext
```

Repeat for `development` and `production`. Skipping this produces an APK that
installs fine and then fails at sign-in with `java.net.UnknownHostException`,
because the URL falls back to a placeholder host. `app/src/core/supabase.ts` now
throws at startup in release builds rather than letting that ship silently.

EAS commands run from `app/`, since that is where `app.json` and `eas.json`
live.

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
# app/
npm test              # 177 tests
npx tsc --noEmit      # type check
npx expo start        # dev server
npx expo-doctor       # config and dependency checks before a build

# website/
npm run dev           # dev server on :5173
npm run build         # type check, then static build into dist/
npm run typecheck
```

Tests live with the app because that is where the shared logic lives, so they
cover both clients by construction. They target the places where a silent bug
does real damage and nothing else would catch it: money round-tripping and
float-free summing, the timezone off-by-one, due-versus-event date wording,
billing cycle maths, the running balance, CSV escaping, task recurrence
anchoring, reminder scheduling, personal-record detection, set numbering after
a deletion, and custom-module summaries over jsonb.

Several are regression tests for bugs that actually shipped, and each was
verified to fail without its fix rather than assumed to work.

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
[`app/src/modules/subscriptions/notifications.ts`](app/src/modules/subscriptions/notifications.ts).

**jsonb is sorted in JavaScript, not SQL.** Ordering a custom module's records
by `data->>'key'` compares everything as TEXT, which puts 100 before 9 for a
number field. It looks right until you scroll.

**The two clients no longer look alike, on purpose.** The website first copied
the phone's aesthetic - translucent panels over animated gradients. That reads
well on a phone, which shows one thing at a time and can afford atmosphere. On a
monitor showing four task columns, a ledger and two charts at once, it is
decoration competing with data, and it is the most recognisable house style of
generated dashboards. So the site is flat and dense now: neutral surfaces, one
accent, hairline borders instead of blur, small radii, and colour reserved for
meaning.

**Never build an icon set out of Unicode characters.** The site used `✎`, `🗑`,
`＋`, `↻`, `⚙` - glyphs from a dozen unrelated blocks, each resolved from
whatever font happened to have it, so no two shared a stroke weight, an optical
size or a baseline. `🗑` is worse: on Windows it is a full-colour emoji, so a
neutral toolbar had one glossy bin in it. They are now drawn paths on one grid,
in [`Icon.tsx`](website/src/components/Icon.tsx). Nothing else moved the needle
on "this looks designed" as far.

**Never build a list out of `Alert.alert` buttons.** Android has exactly three
button slots - positive, negative, neutral - and a fourth button does not fail
loudly, it *overwrites* one of the first three. A picker built this way appears
to lose entries, and because the slots are reused a tap can fire a different
item's handler. Two screens had this. Both now use
[`PickerSheet`](app/src/modules/fitness/components/PickerSheet.tsx).

**Multi-step writes are ordered so an interruption cannot destroy data.** There
are no transactions across Supabase calls, so three functions that write twice
were ordered wrong: completing a repeating task marked it done before creating
the next occurrence, and saving fields or a routine deleted before inserting the
replacements. A dropped connection in between ended a recurrence silently or
emptied a template. All three now write first and delete last, so the failure
mode is a stale row you can see rather than missing data you cannot recover.

**The website's `useAsync` takes a string key, not a dependency array.** An
array parameter spread into `useEffect` cannot be checked by exhaustive-deps and
needs a suppression. This codebase has none, and that suppression is where its
last real bug hid.

---

## Status

Version 2 is complete and in use: repeating tasks by frequency, a notes system
with quick capture and a journal, an all-time finance balance with charts and
CSV export, renewal reminders, a full training log, and custom modules with
their own tile stat and sort order.

The desktop website ships alongside it, with the same features and the same
database - and a few things a wider screen makes possible, listed in the
[User Guide](docs/USER-GUIDE.md).

Scope was held deliberately. AI and voice input, cross-module relations and
formula fields were all considered and left out, on the reasoning that a feature
list written before using the app is mostly guesswork. Those decisions are
recorded in [`plan.md`](plan.MD) section 9 so nothing is lost.

Known limits, to be fixed only if daily use proves them worth fixing:

- **Network required.** No offline cache.
- **Reminders exist for subscription renewals only, and only on the phone**
  (3 days ahead, local notifications, no server). Tasks have no reminders. They
  are scheduled on the device, so they do not survive a reinstall until each
  subscription is edited again, and they need the dev or production build rather
  than Expo Go. The website deliberately has none: a browser cannot schedule a
  notification that survives the tab closing, and one that only fires while the
  tab is open would be worse than nothing, because you would rely on it.
- **No AI or voice input.** Natural-language quick add was considered and
  deliberately deferred.
- **Custom modules have no relations or formula fields.** If a specific
  cross-module link is ever needed, the answer is a small hand-written bridge in
  `core/`, following `core/ledger.ts`, not a generic relations system.
- **The website is desktop-first.** It is usable on a narrow window - the
  columns collapse - but the phone app is the better answer on a phone, and the
  layouts here assume a screen wide enough to show several things at once.
- **The website has no offline story either**, and no service worker. Closing
  the tab loses nothing, because every write goes straight to Supabase.
- Supabase free-tier projects **pause after 7 days idle** and need a manual
  resume from the dashboard.

---

## Licence

Personal project, no licence granted. Read it, learn from it, but it is built
for one user and makes assumptions accordingly.
