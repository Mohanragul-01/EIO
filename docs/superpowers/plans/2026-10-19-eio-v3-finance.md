# Finance v3 Implementation Plan

**Goal:** Build the interface spec §7 asks for on top of `0008_finance_v2.sql`: accounts and transfers that stay out of spending, two-tap logging (smart defaults, note memory, pinned quick-adds, save and add another), category budgets with a pace marker, a calendar month view, phone search with a total, deltas against last month, a custom month start, and an `eio://finance/add` capture link — on the phone and the website.

**Architecture:** Every rule that can be wrong without looking wrong is a pure function in `app/src/modules/finance/`, tested, and shared by both clients: the period maths (custom month start), account balances (liability sign, transfers), the summary (transfer exclusion, deltas, list collapsing, calendar tint, search totals), the budget pace, the capture-link parser and the smart defaults. `api.ts` is the only database code. The phone's Finance screen becomes three swipeable tabs (Month, Calendar, Budgets) with Accounts, Search and a category detail as pushed screens; the add form stays a pushed screen and also serves the capture link. The website page is rebuilt from the same logic.

**Spec:** `docs/superpowers/specs/2026-10-19-eio-v3-design.md` §7 (binding), §2, §3, §12. Evidence: `docs/research/finance.md` (§5 recommendations, §5.2 capture stage 0, §6 UI patterns).

## Review focus

1. **Transfers never count as money in or out.** Paired rows (`kind = 'transfer'`, `transfer_direction` out/in, one `transfer_group_id`), excluded from spent, received, the pie, the trend, budgets, deltas and search totals — tested in `summary.test.ts` and `analytics.test.ts`; they move account balances only (`accounts.test.ts`).
2. **The month is not always the calendar month.** With a salary-day start every "this month" figure (totals, deltas, budgets and their pace, the trend, the home tile) uses `period.ts`, tested across month ends, year ends, leap years and start days 29–31.
3. **The capture link is untrusted input.** Rupees to paise, garbage rejected with a reason, never a silent ₹0; tested in `capture.test.ts`.
4. **No silent truncation.** Supabase returns at most 1000 rows per request by default, so the all-time ledger fetch (balances, trend) silently dropped the newest rows past 1000 transactions. All-time fetches now page (`paging.ts`, tested).

---

## File map

Pure logic (each with `__tests__/<name>.test.ts`):
- `finance/types.ts` — extended: `EntryKind`, `TransactionKind` (+`'transfer'`), `TransferDirection`, `Transaction` (+`account_id`, `transfer_group_id`, `transfer_direction`), `TransactionInput` (+`account_id`), `TransferInput`, `LedgerPoint` (+`category`, `account_id`, `transfer_direction`), `Account`, `AccountType`, `AccountInput`, `Budget`, `QuickAdd`, `QuickAddInput`, `FinanceSettings`.
- `finance/period.ts` — `periodBounds`, `periodOf`, `shiftPeriod`, `periodProgress`, `daysInclusive`, `periodTitle`, `periodRange`, `shortDate`, `recentPeriods`.
- `finance/accounts.ts` — `signedFlow`, `summarizeAccounts`, `netBalance`, `buildTransferRows`, `newGroupId`, `matchAccount`, `ACCOUNT_TYPE_LABEL`.
- `finance/summary.ts` — `summarize`, `expenseByCategory`, `compareToPrevious`, `deltaText`, `toListItems`, `groupByDay`, `dayTotals`, `spendLevels`, `searchTransactions`, `searchTotals`.
- `finance/budget.ts` — `budgetStatus`, `budgetLine`, `BUDGET_STATE_WORDS`, `budgetHistory`.
- `finance/defaults.ts` — `lastUsed`, `normalizeNote`, `categoryForNote`, `noteSuggestions`.
- `finance/capture.ts` — `parseCaptureAmount`, `parseCaptureParams`, `findLikelyDuplicate`.
- `finance/paging.ts` — `collectPages`.
- `finance/analytics.ts` — `runningBalance` ignores transfers; `monthlyTotals` takes a month-start day; `toCsv` gains an account column and transfer direction.

Data: `finance/api.ts` (rewritten), `supabase/migrations/0022_finance_v3.sql` (new), `0008_finance_v2.sql` (fixed, see Rulings).

Hooks: `finance/useFinance.ts` (replaces `useTransactions.ts`), `useCalendarMonth.ts`, `useAccounts.ts`, `useFinanceSearch.ts`, `useCategoryDetail.ts`, `useEntryForm.ts`.

App screens/components: `FinanceListScreen` (rebuilt: tabs), `TransactionEditScreen` (rebuilt; also the capture route), new `AccountsScreen`, `FinanceSearchScreen`, `CategoryDetailScreen`; components `PeriodHeader`, `MonthSummary` (rebuilt), `QuickAddRow`, `TransactionRow` (transfer variant), `DayHeader`, `BudgetBar`, `BudgetSheet`, `AccountSheet`, `QuickAddSheet`, `EntryMenuSheet`, `DaySheet`, `SettingsSheet`, `AccountChips`, `DeltaText`, `HistoryBars`.

Shared files (additive): `navigation/types.ts` (4 routes, `TransactionEdit` params widened), `navigation/RootNavigator.tsx` (4 screens + `linking` + `fallback`), `app/app.json` (`"scheme": "eio"` only — the one permitted exception), `home/useHomeSummaries.ts` (finance line), `website/src/pages/Dashboard.tsx` (finance tile), `website/src/styles/components.css` (Finance section at the end).

Website: `website/src/pages/FinancePage.tsx` (rebuilt) + `website/src/pages/finance/*` (dialogs, calendar, budgets, accounts).

---

## Tasks

### T1 — Migrations
**Files:** modify `supabase/migrations/0008_finance_v2.sql`; create `0022_finance_v3.sql`.
- 0008 fix: `transactions.transfer_direction text check in ('out','in')` plus a shape check (a transfer row carries a group and a direction; nothing else carries a direction). Without it the two halves of a transfer are indistinguishable (`amount_minor > 0`, both `kind = 'transfer'`), so no balance can be computed.
- 0022: `finance_templates` (pinned quick-adds: `note`, `amount_minor > 0`, `kind in (expense, income)`, `category`, `account_id → accounts on delete set null`, `position`), `finance_settings` (`user_id` primary key, `month_start_day smallint 1–31`). Four-policy RLS, updated_at triggers, idempotent.
- Re-read both for syntax and idempotency. Commit.

### T2 — Types and periods
**Files:** `types.ts`, `period.ts`, `__tests__/period.test.ts`.
Tests: start day 1 = calendar month; start 25 → "October" is 25 Sep–24 Oct; start 5 → "October" is 5 Oct–4 Nov; Dec/Jan rollover both ways; start 31 clamps (Feb starts on the 28th/29th, periods stay contiguous, leap year); `periodOf` round-trips every day of a year for several start days; `periodProgress` before/inside/after; `daysInclusive` across DST in America/New_York.

### T3 — Accounts and transfers
**Files:** `accounts.ts`, `__tests__/accounts.test.ts`.
Tests: asset balance = opening + income − expense − out + in; liability owed = opening + expense − income + out − in (a card payment lowers it); transfers net to zero overall; `netBalance` equals income − expense + asset openings − liability openings; unassigned rows counted once; archived accounts still counted; `buildTransferRows` shapes (same group, out from source, in to destination, category `transfer`), rejects same account and non-positive amounts; `newGroupId` is a v4 UUID; `matchAccount` exact then unique prefix, case-insensitive.

### T4 — Summary
**Files:** `summary.ts`, `__tests__/summary.test.ts`.
Tests: transfers excluded from spent, received, category totals (the pie) and counts; shares sum to 1; `compareToPrevious` percent, absolute below ₹500 base, "new" with no previous, same; `deltaText` words; `toListItems` collapses a pair into one item and keeps a lone half visible; `groupByDay` day totals exclude transfers; `spendLevels` buckets relative to the median spending day (0 for no spend, a single spending day is level 2, outliers capped at 4); search matches note, category label, account name and an exact amount, case-insensitive; `searchTotals` excludes transfers and counts a pair once.

### T5 — Budget pace
**Files:** `budget.ts`, `__tests__/budget.test.ts`.
Tests: tick at elapsed ÷ days × limit; state under at exactly pace, over pace above it, over budget only above the limit (at the limit is "over pace" with ₹0 left); per-day rounds down to whole rupees; "₹2,340 left · ₹156/day for 15 days" exact copy; "for 1 day"; past period has no per-day; "Over by ₹410"; fill share capped at 1; zero-day guard; `budgetHistory` per period with a custom start.

### T6 — Smart defaults and the capture link
**Files:** `defaults.ts`, `capture.ts`, tests.
Tests (defaults): last used per kind, ignores transfers, null when none; note memory case/space-insensitive, newest wins, kind-scoped; suggestions prefix-first, distinct, exclude exact, limit.
Tests (capture): `250` → 25000; `249.5` → 24950; `₹1,299.50`, `Rs. 1,299.50`, `INR 500`, `rs20` accepted; `0`, `-5`, `abc`, `1e5`, `0x10`, `12.345`, `Infinity`, `''`, absurdly large rejected with a reason; note trimmed, control characters stripped, capped at 200; category by key or label, case-insensitive; an income category with no kind implies income; a category that does not fit the kind is ignored with a reason; kind aliases debit/credit; date validated (real date, not future); array params take the first; unknown keys ignored silently. `findLikelyDuplicate`: same amount and kind logged within 10 minutes.

### T7 — Paging, api and analytics
**Files:** `paging.ts` + test, `api.ts`, `analytics.ts` + existing test extended.
`collectPages` tests: stops on a short page, exact multiple, empty, error propagates. API: period range list, slim all-time points (paged, stable order), recent rows, all rows (paged), create/update/delete/restore entry, create/update/delete/restore transfer (one statement each), accounts CRUD + archive, budgets upsert/delete/restore, quick-adds CRUD, settings get/set. Analytics: `runningBalance` ignores transfers; `monthlyTotals(points, n, now, startDay)`; CSV with account and transfer rows.

### T8 — Hooks
`useFinance` (period state, settings, accounts, budgets, quick-adds, period rows, points; derived summary, deltas, list items, budget statuses, net balance; quick-add with undo; delete with undo), `useCalendarMonth`, `useAccounts`, `useFinanceSearch`, `useCategoryDetail`, `useEntryForm` (defaults + note memory + suggestions). All use `useLatestRun`; optimistic changes roll back their own row only.

### T9 — Add/edit form and the capture route
`TransactionEditScreen`: kind Expense / Income / Transfer; amount hero; account chips (default last used for the kind); category grid (default last used; note memory overrides until you pick by hand); date; note with recent-note suggestions; Save, and Save & add another (keeps kind, account, category and date; clears amount and note; toast). Transfer mode: From / To chips, no category. Edit loads a transfer pair as one. Delete with undo toast. Capture route: parses params with `capture.ts`, shows what came from the link and what was ignored, warns on a likely duplicate.

### T10 — Finance screen
SwipeTabs Month / Calendar / Budgets. Month: balance card (→ Accounts), period header, quick-add row, totals with deltas, where it went (bars with deltas → category detail), trend, day-grouped list (transfer rows neutral, "HDFC → Cash"). Long-press a row → menu sheet (Edit, Log again today, Pin as quick-add, Delete). Calendar: MonthCalendar, spend per day, tint by level, income dot, `dayLabel`; tap → DaySheet with entries and "Add for 16 Oct". Budgets: pace bars with words, set/edit sheet, delete with undo, unbudgeted line, empty state that suggests your top categories. Header: search, accounts, more (settings sheet: month start, export).

### T11 — Accounts, search, category detail; navigation and link
Screens + routes `FinanceAccounts`, `FinanceSearch`, `FinanceCategory`, `FinanceCapture`. Linking config (`eio://finance/add`, `eio://finance`), `fallback` while the initial URL resolves, `"scheme": "eio"`.

### T12 — Home tile
App and website: net balance across accounts and this period's spend (custom start, transfers excluded), plus budgets over.

### T13 — Website
Rebuilt FinancePage on the shared logic: period switch with custom start, quick-add buttons with undo, totals with deltas, ledger table with account column and transfer rows, all-time search toggle with result totals, calendar view, budgets card with pace bars, accounts card, dialogs (entry/transfer with defaults, note memory and suggestions, save and add another; account; budget; quick-add; month start).

### T14 — Final checks and report

---

## Rulings

- Ruling: **0008 gains `transactions.transfer_direction`** (out/in) and a shape check, fixed in 0008 itself — both halves of a transfer are positive and `kind = 'transfer'`, so without it no account balance can tell money leaving from money arriving — cost if wrong: none for v2 (it never writes transfers); the column is nullable and ignored by v2.
- Ruling: **a transfer's group id is generated on the client** (`crypto.randomUUID` when present, else a Math.random v4) so both rows go in one INSERT, which is atomic — an RPC would need a function the app cannot test — cost if wrong: a collision would pair unrelated transfers; at personal volume the odds are negligible.
- Ruling: **editing a transfer is one upsert of both rows; deleting is one delete by group** — each is a single statement, so a dropped connection cannot leave half a transfer — cost if wrong: none known.
- Ruling: **no transfer fee field** — log the fee as an ordinary expense on the source account; a third row in a transfer group would break "a transfer is a pair" — cost if wrong: one extra entry for a fee.
- Ruling: **liability accounts store and show what you owe as a positive number**, as 0008's comment says (opening balance = amount owed) — cost if wrong: a card set up with a negative opening balance reads backwards; the sheet says "What you owe today".
- Ruling: **the headline balance is net across accounts**: asset balances − card balances + entries with no account. It equals the old "income − expense" when no opening balances are set — cost if wrong: the number changes when opening balances are entered, which is the point.
- Ruling: **entries with no account are allowed and shown honestly** (an "Not in an account" line on Accounts) — the v2 app and Subscriptions' mark-paid (via `core/ledger`) still write without one — cost if wrong: a line some users never need.
- Ruling: **accounts are archived, and deleted only when they have no entries** — 0008 sets `account_id` to null on delete, which would silently strip history; archiving is reversible (undo toast), delete is confirmed — cost if wrong: an extra step to delete a used account.
- Ruling: **month start is a synced setting (`finance_settings`), day 1–31; a start day past a month's end clamps to its last day**, so periods stay contiguous — cost if wrong: a 31st start makes February's period start on the 28th (stated in the sheet).
- Ruling: **a period is named after the month holding most of its days**: start day ≤ 15 → the month it starts in (5 Oct–4 Nov is October); > 15 → the month it ends in (25 Sep–24 Oct is October). The range is always shown under the title — cost if wrong: one label convention; the range removes the ambiguity.
- Ruling: **the calendar shows calendar months**, not salary periods — a calendar is a calendar, and MonthCalendar pages by month — cost if wrong: its total can differ from the Month tab's when the start day is not 1 (its footer says "1–31 Oct").
- Ruling: **budgets are per expense category, monthly per period; no overall budget and no rollover UI** — the spec asks for category budgets; rollover stays `false` (column untouched) — cost if wrong: both can be added without a migration.
- Ruling: **pace counts today as elapsed** (day 17 of 31 → tick at 17/31) and per-day spreads what is left over today and the remaining days (15 on day 17 of 31), rounded down to whole rupees so following it never overspends — matches the spec's example — cost if wrong: the tick is one day early.
- Ruling: **budget states: "On track" (at or under pace), "Over pace" (over the tick, at or under the limit), "Over budget"**, each with an icon and the colour — cost if wrong: copy only.
- Ruling: **deltas use a percentage unless last period was under ₹500, then the rupee difference**; delta text is neutral-coloured with an arrow icon and words — spending more is not always bad, and red/green already mean budget state (research §6.15) — cost if wrong: copy and colour only.
- Ruling: **quick-adds live in `finance_templates`** (synced, so the website shows the same pins) and are created from the add form ("Pin as a quick-add") or a row's menu; edited or unpinned by long-pressing the pill — cost if wrong: a table instead of a JSON setting.
- Ruling: **the add form stays a pushed screen, not a Sheet** — amount, account chips, a category grid, date, note suggestions and two buttons do not fit an 85% sheet above the keyboard; the capture link opens that screen (route `FinanceCapture`) — cost if wrong: the form can move into a Sheet later; the parsing does not change.
- Ruling: **the capture link opens a form; it never saves on its own** — that is the review step against duplicate or wrong notifications, plus a likely-duplicate warning (same amount and kind within 10 minutes) — cost if wrong: one tap per captured entry.
- Ruling: **capture params beyond the spec: `kind` (also debit/credit), `account` (by name) and `date`**, all optional and validated — a bank SMS says debited or credited and names the account, so an automation can fill them — cost if wrong: unused parameters.
- Ruling: **the capture link only exists in a new APK**: `scheme` is build-time and has no effect in Expo Go (Expo docs); the prefix is `eio://` only — cost if wrong: none; untestable in Expo Go either way.
- Ruling: **a deep link opens on top of whatever is open, with Home underneath on a cold start** (linking `initialRouteName: 'Home'`), so saving returns you where you were — cost if wrong: on a cold start Back lands on Home rather than Finance.
- Ruling: **all-time fetches page through 1000-row windows** with a stable order (date, id) — Supabase's default `max_rows` is 1000 and the old fetch silently dropped the newest rows past it — cost if wrong: extra round trips at a few thousand rows.
- Ruling: **search is all-time and client-side** over a paged fetch, matching note, category label, account name and an exact amount — keeps `ilike`/`or` filter strings free of user input — cost if wrong: a larger fetch when searching.
- Ruling: **no source/capture column in 0022** — the link opens a form the person confirms, so a captured entry is an ordinary entry — cost if wrong: a later inbox (stage 1) adds the column then.
- Ruling: **deleting an entry is undoable** (re-inserted with its id), not confirmed — it is reversible, so §2 says undo — cost if wrong: none.
- Ruling: **calendar tint uses `accentRose` (the existing "out" colour) in four alpha steps relative to the month's median spending day**, always with the amount printed — cost if wrong: colour only.

### Rulings made while building

- Ruling: **the capture route is keyed by its params** (`getId` on `FinanceCapture`) — React Navigation 7 sends a second link for the focused route to the open form and replaces its params under already-filled fields, losing one of two automations fired by the same payment; keyed, a different link opens its own form and an identical one lands on the form already showing it — cost if wrong: two identical links in a row open one form (which is the dedupe you want).
- Ruling: **the add form uses a Finance-only four-column category grid (58dp tiles), not core's CategoryPicker** — core's chips are about 36dp tall, under the 48dp target; core is left alone for the other modules — cost if wrong: two pickers that look different.
- Ruling: **an Undo for a delete made on the edit screen reaches the Finance screens through `changes.ts`**, a module-level listener, rather than an app-root context — the list reloads on focus before the Undo, so without a nudge a restored entry stayed missing; a provider would mean editing App.tsx for one module — cost if wrong: one more tiny pub/sub in the codebase.
- Ruling: **editing cannot turn an entry into a transfer or back** — that is a delete plus an insert, two statements, and an interruption between them loses or duplicates money; delete and re-add instead — cost if wrong: two steps for a rare correction.
- Ruling: **the website confirms "Save & add another" inside the dialog**, not with a toast — a toast draws behind an open dialog — cost if wrong: none.
- Ruling: **calendar amounts print in the full text colour on both clients** — the secondary colour over the darkest tint measured about 3.4:1 (light) and 3.8:1 (dark) — cost if wrong: slightly heavier small figures.
- Ruling: **the 1000-row paging fix is applied to Finance's reads only** — other modules' unbounded reads may share the cap; they are not Finance's to change (reported) — cost if wrong: another module silently truncates past 1000 rows.
- Ruling: **`useTransactions.ts` is removed**, replaced by `useFinance.ts`; nothing else imported it — cost if wrong: none.
