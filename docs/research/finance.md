# Finance: what the best expense trackers have that EIO lacks

*Research date: 19 Oct 2026. Scope: personal expense trackers and budgeting apps, for one user in India on Android, paying mostly by UPI. Public evidence only: Play listings, help centres, changelogs, official docs. No app was downloaded, installed or run, and no account was created.*

**Evidence labels.** OBSERVED means seen in the cited source. INFERRED means reasoned, and the reasoning is given. UNKNOWN means not established. Play Store numbers come from the `en_IN` listing pages fetched on 19 Oct 2026. Install and rating counts are global, not India-only, and the listing shows them in Indian notation: 1Cr+ = 10M+, 50L+ = 5M+, 10L+ = 1M+, 5L+ = 500K+.

**Limits of this investigation (read first).**
- Reddit (r/IndiaInvestments, r/personalfinanceindia) could not be reached. Both the search tool and direct fetches refused reddit.com, so Indian forum sentiment is UNKNOWN. Play Store review snippets on the `en_IN` listings stand in for it, and they are a small sample.
- The web-search budget for this session ran out partway through. Later evidence came from fetching known official pages directly: help centres, Play listings, GitHub, npm and Android docs. No searches were run through other channels.
- CRED's expense features were not investigated (UNKNOWN).

## Checklist (the brief turned into questions)

| # | Question | Evidence it needs |
|---|---|---|
| Q1 | Which 3 apps lead for an Indian Android user in 2026? | Play installs, ratings, update recency, India-specific features, roundups (weak) |
| Q2 | How fast is adding an expense: taps, keypad, defaults, last-used category? | Help-centre "add a transaction" articles, changelogs |
| Q3 | How do accounts/wallets and transfers work? | Help-centre articles |
| Q4 | How do budgets work, and how is overspending shown? | Help-centre budget articles |
| Q5 | How do recurring transactions work? | Help-centre repeat/planned-payment articles |
| Q6 | Custom categories, subcategories, tags? | Help centre, listings |
| Q7 | How does SMS/UPI auto-detection work in India, and how much permission and privacy does it cost? | Play policy, Android docs, app help pages, privacy/FAQ pages |
| Q8 | What could a self-built (sideloaded Expo) app realistically do? | Android docs, Play policy, developer-verification docs, Expo docs, npm |
| Q9 | Reports and charts? | Help centre |
| Q10 | Calendar view of spending? | Help centre, changelogs |
| Q11 | Search? | Help centre |
| Q12 | Export and backup? | Help centre |
| Q13 | Net worth? | Help centre, listings |
| Q14 | UI patterns: dashboard, colour for money in and out, navigation, empty states? | Help centre text describing screens; screenshots were not viewable as text |
| Q15 | What do users praise and complain about? | Play review snippets (Reddit unavailable) |

The status of each question is in section 7.

---

## 1. Which apps, and why

### Candidates screened

| App | Installs | Rating (count) | Last update | India fit | Decision |
|---|---|---|---|---|---|
| **Money Manager** (Realbyte) | 10M+ | 4.6 (467,333) | 13 Oct 2026 | Manual entry. INR and lakh-scale amounts work. Bengali among supported languages | **Chosen** |
| **Wallet** (BudgetBakers) | 10M+ | 4.7 (387,684) | 14 Oct 2026 | Has an **India-only "SMS Pay Sync"** built on notification access | **Chosen** |
| **axio** (formerly Walnut) | 10M+ | 4.5 (265,640) | 15 Jul 2026 | India-native, SMS-based tracker | **Chosen** |
| Cashew | 500K+ | 4.9 (27,927) | 3 Oct 2026 | Free, no data collected. Indian users are visible in its reviews | **Also studied** for UI and its user-taught notification parser |
| Monefy | 10M+ | 4.0 (194,662) | 16 Aug 2026 | Manual entry. A visible Indian review complains about a ₹2,600/yr paywall | Not chosen: low rating, paywall |
| Money Lover | 5M+ | 4.2 (208,195) | 9 Oct 2026 | Generic | Not chosen: nothing India-specific found |
| YNAB | 1M+ | 3.5 (25,384) | 13 Oct 2026 | US-centric. A 34-day trial, then a subscription | Not chosen |
| Spendee | 1M+ | 4.3 (63,709) | 17 Oct 2026 | Generic | Not chosen |
| Bluecoins | 1M+ | 4.3 (40,924) | 16 Oct 2026 | Reads notifications and SMS | Used only as evidence for capture mechanics |
| 1Money / Expense Manager (Bishinews) | 5M+ each | 3.8 / 4.4 | Feb / May 2026 | Generic | Not chosen: stale updates or low rating |
| Moneyview | 100M+ | 4.8 | 16 Oct 2026 | The listing is now loans, UPI, credit cards and gold. Expense tracking is not mentioned | **Excluded**: no longer an expense tracker |
| Fold | n/a | n/a | n/a | Built on the RBI Account Aggregator | Excluded: the brief drops bank-linking through aggregators |

Sources for the table: the Play listings for [Money Manager](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN), [Wallet](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en_IN&gl=IN), [axio](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN), [Cashew](https://play.google.com/store/apps/details?id=com.budget.tracker_app&hl=en_IN&gl=IN), [Monefy](https://play.google.com/store/apps/details?id=com.monefy.app.lite&hl=en_IN&gl=IN), [Money Lover](https://play.google.com/store/apps/details?id=com.bookmark.money&hl=en_IN&gl=IN), [YNAB](https://play.google.com/store/apps/details?id=com.youneedabudget.evergreen.app&hl=en_IN&gl=IN), [Spendee](https://play.google.com/store/apps/details?id=com.cleevio.spendee&hl=en_IN&gl=IN), [Bluecoins](https://play.google.com/store/apps/details?id=com.rammigsoftware.bluecoins&hl=en_IN&gl=IN), [1Money](https://play.google.com/store/apps/details?id=org.pixelrush.moneyiq&hl=en_IN&gl=IN), [Expense Manager](https://play.google.com/store/apps/details?id=com.expensemanager&hl=en_IN&gl=IN) and [Moneyview](https://play.google.com/store/apps/details?id=com.whizdm.moneyview.loans&hl=en_IN&gl=IN). All are OBSERVED. Fold's Account Aggregator basis appeared only in search-result snippets ([fold.money](https://fold.money), [Zerodha Rainmatter](https://zerodha.com/z-connect/rainmatter/introducing-fold)), so treat it as weak evidence. India listicles from 2026, all written by app vendors and therefore weak, repeatedly name Money Manager (Realbyte), axio, Monefy, Wallet and Money View. Example: [getfinny.app](https://getfinny.app/blog/best-expense-tracker-apps-india-2026).

### Why these three

1. **Money Manager (Realbyte)** is the benchmark for manual entry. It has the most ratings of any candidate, ships monthly updates (quick-add widgets in July 2026, tags in October 2026), and is the manual option Indian roundups name. Its help centre is the most detailed of any app here, so its behaviour is well evidenced. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN), [4.12 notes](https://help.realbyteapps.com/hc/en-us/articles/58999568169497-Android-4-12-x-Update-June-2026), [4.13 notes](https://help.realbyteapps.com/hc/en-us/articles/63008416855961-Android-4-13-x-Update-October-2026).
2. **Wallet (BudgetBakers)** has the highest rating at scale and the richest budget and dashboard design. It is also the only global app found with an **India-specific automatic capture**, "SMS Pay Sync", which reads the notifications of the default SMS app instead of asking for SMS permission. That is the most relevant pattern for what EIO could build. OBSERVED: [SMS Pay Sync](https://support.budgetbakers.com/hc/en-us/articles/39631628971666-SMS-Pay-Sync), [Notification Access – India](https://support.budgetbakers.com/hc/en-us/articles/39631752579346-Notification-Access-Permission-India).
3. **axio (formerly Walnut)** is India's long-running SMS-reading tracker, with 10M+ installs. It shows the full-SMS-permission approach end to end, including its failure modes. It is now a lending-first app (OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN)), so it is a lesson in mechanics, not a model for the product.

**Cashew** is a sidebar to the main three. It is the best-rated app here and is open source, its documentation is unusually precise, and its notification-scanning design is the most instructive for a self-built app. OBSERVED: [README](https://github.com/jameskokoska/Cashew), [FAQ](https://cashewapp.web.app/faq.html).

---

## 2. Per-app teardown

### 2.1 Money Manager (Realbyte)

**Core features**
- **Accounts:** double-entry bookkeeping, account groups, debit cards linked to a bank account, and credit cards with settlement and payment dates. The Accounts tab shows total assets and liabilities at the top. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN), [accounts](https://help.realbyteapps.com/hc/en-us/articles/360043221593-How-to-register-hide-edit-delete-accounts), [debit cards](https://help.realbyteapps.com/hc/en-us/articles/360016071953-How-to-use-debit-cards), [credit-card settlement](https://help.realbyteapps.com/hc/en-us/articles/360015963554-How-to-settle-credit-card-payments).
- **Transfers:** a transfer between your own accounts is not income or expense. It can carry a **fee**, recorded as an expense on the source account. From and To can be swapped (4.10.3). Typical uses are ATM withdrawals (Bank → Cash) and card bill payments (Bank → Card). OBSERVED: [record a transfer](https://help.realbyteapps.com/hc/en-us/articles/360042702534-How-to-record-a-transfer), [4.10 notes](https://help.realbyteapps.com/hc/en-us/articles/48855415561753-Android-4-10-x-Update-July-2025). A per-account **"Transfer-Expense"** setting counts transfers into savings, insurance or loan accounts as spending. OBSERVED: [article](https://help.realbyteapps.com/hc/en-us/articles/360015963434-How-to-set-up-Savings-Investment-Insurance-Loan-as-an-expense).
- **Budgets** are per category, plus an overall budget. A **default monthly amount** applies to every month and can be overridden for a single month. Changing the default takes effect from next month. There is an optional **carry-over**. OBSERVED: [budget article](https://help.realbyteapps.com/hc/en-us/articles/360042743774-How-to-set-up-modify-delete-a-budget), [carry-over](https://help.realbyteapps.com/hc/en-us/articles/360043218993-How-to-turn-on-carry-over-feature), [3.9 notes](https://help.realbyteapps.com/hc/en-us/articles/360049743274-Android-3-9-x-Update-June-2018).
- **Recurring entries** come from a "Repeat" button on the date field. Frequencies include 4 weeks, 6 months and yearly. An entry is posted on its due date, or on the 1st of the month if you choose that setting, and upcoming repeats are previewed at the top of the list. **Installments** show "n of N" and the remaining amount. OBSERVED: [repeat & installment](https://help.realbyteapps.com/hc/en-us/articles/360046668993-How-to-set-up-a-repeat-schedule-installment), [3.1 notes](https://help.realbyteapps.com/hc/en-us/articles/360049671554-Android-3-1-x-Update-December-2015).
- **Categories:** fully editable income and expense categories, with subcategories that can be switched on or off, a sub→main conversion, and tags (added in Oct 2026). OBSERVED: [subcategory](https://help.realbyteapps.com/hc/en-us/articles/360015963394-How-to-add-a-subcategory-under-main-category), [4.13](https://help.realbyteapps.com/hc/en-us/articles/63008416855961-Android-4-13-x-Update-October-2026).
- **Search** covers keyword (with autocomplete), period, account, category, min/max amount and tag. It shows **the totals of the results**, and you can select all results to edit them. OBSERVED: [search](https://help.realbyteapps.com/hc/en-us/articles/360046151974-How-to-search), [4.3](https://help.realbyteapps.com/hc/en-us/articles/360049813374-Android-4-3-x-Update-November-2019), [3.5](https://help.realbyteapps.com/hc/en-us/articles/360049678574-Android-3-5-x-Update-September-2016), [4.11](https://help.realbyteapps.com/hc/en-us/articles/56943207694361-Android-4-11-x-Update-April-2026).
- **Backup:** Google Drive auto-backup (daily or weekly), a SQLite backup file by email, an on-device auto-backup kept for 7 days, Excel export, and TSV import. **No sync between devices** (OBSERVED: [sync FAQ](https://help.realbyteapps.com/hc/en-us/articles/26009445731993-Can-we-sync-between-devices), [backup](https://help.realbyteapps.com/hc/en-us/articles/360042747934-How-to-backup-and-restore-data)). A paid "PC Manager" serves an editing page over local Wi-Fi (OBSERVED: [PC Manager](https://help.realbyteapps.com/hc/en-us/articles/360043758513-How-to-use-PC-Manager)).
- **Configurable month start** (for example, the salary day) and week start. OBSERVED: [period article](https://help.realbyteapps.com/hc/en-us/articles/360046346554-How-to-customize-monthly-weekly-period).
- Passcode and biometrics, a daily reminder alarm, and up to 3 photos per transaction (since 4.9.38 they are stored only inside the app and deleted with it). OBSERVED: [passcode](https://help.realbyteapps.com/hc/en-us/articles/360046343634-How-to-use-passcode), [alarm](https://help.realbyteapps.com/hc/en-us/articles/360060613673-How-to-set-up-a-reminding-alarm), [photos](https://help.realbyteapps.com/hc/en-us/articles/47441540474137-How-to-Backup-Restore-Money-Manager-Photos).
- **No SMS or notification auto-capture** appears anywhere in its help centre or listing (INFERRED from absence across all 77 Android help articles).

**What makes entry fast**
- You tap **+** on the Trans. tab, choose Income, Expense or Transfer, and fill in **Date, Account, Category and Amount** (all required) plus an optional note and photo. A **"Continue"** button saves and keeps the form open for the next entry. OBSERVED: [add income & expense](https://help.realbyteapps.com/hc/en-us/articles/360042701994-How-to-add-an-income-expense).
- **Bookmarks** are saved entries that re-post with today's date. OBSERVED: [bookmark](https://help.realbyteapps.com/hc/en-us/articles/360042743374-How-to-make-a-bookmark), [Home tab](https://help.realbyteapps.com/hc/en-us/articles/360046150874-Home-tab).
- **Autocomplete** on the note field. OBSERVED: [autocomplete](https://help.realbyteapps.com/hc/en-us/articles/360044208973-How-to-set-up-autocomplete).
- **A built-in calculator in the amount field**, which also works with an external keyboard. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN), [4.8 notes](https://help.realbyteapps.com/hc/en-us/articles/18564611917593-Android-4-8-x-Update-June-2023).
- "Copy with today's date" on any past entry. OBSERVED: [4.10](https://help.realbyteapps.com/hc/en-us/articles/48855415561753-Android-4-10-x-Update-July-2025).
- **Three Quick-Add home-screen widgets**. OBSERVED: [4.12](https://help.realbyteapps.com/hc/en-us/articles/58999568169497-Android-4-12-x-Update-June-2026).
- A **+ button on each account's detail page** that pre-selects that account. OBSERVED: [4.0](https://help.realbyteapps.com/hc/en-us/articles/360050549913-Android-4-0-x-Update-October-2018).
- Exact tap count: UNKNOWN. Whether the last-used account or category is pre-selected: UNKNOWN. With four required fields, a fresh entry is probably around 4 taps plus digits, and a bookmark is around 2 taps (INFERRED from the documented fields).

**UI and visual patterns**
- Bottom tabs are **Trans., Stats, Accounts, More** (OBSERVED: these names run through every help article). The Trans. tab switches between **Daily, Calendar, Weekly, Monthly and Total** views, and tapping the Trans. tab returns to today. OBSERVED: [Home tab](https://help.realbyteapps.com/hc/en-us/articles/360046150874-Home-tab).
- **Calendar view:** each day shows that day's income, expense and balance. Tapping a day shows that day's entries with an Add button, so you can add without leaving the calendar. Coloured day notes appear on the calendar, and the calendar can be the start screen. OBSERVED: [Home tab](https://help.realbyteapps.com/hc/en-us/articles/360046150874-Home-tab), [3.5](https://help.realbyteapps.com/hc/en-us/articles/360049678574-Android-3-5-x-Update-September-2016), [start screen](https://help.realbyteapps.com/hc/en-us/articles/7049415557401-How-to-change-the-start-screen-to-Daily-or-Calendar), [note colours](https://help.realbyteapps.com/hc/en-us/articles/4402738138009-How-to-assign-color-to-notes).
- **Budget bar with a pacing marker:** "The line on the bar indicates your current recommended spending limit based on the amount of the budget and the current date." Tapping a budget bar shows spending month by month. OBSERVED: [budget article](https://help.realbyteapps.com/hc/en-us/articles/360042743774-How-to-set-up-modify-delete-a-budget).
- **Colour use:** income is **blue** and expense **red** by default, and the user can swap them. OBSERVED: [colour article](https://help.realbyteapps.com/hc/en-us/articles/360047246533-How-to-change-income-expense-colors). Overdue card amounts show in grey. OBSERVED: [settlement](https://help.realbyteapps.com/hc/en-us/articles/360015963554-How-to-settle-credit-card-payments).
- **Stats tab:** a category pie, a ranked list below it, and a tap on a category opens its monthly pattern. You can switch between List and Trend, and between weekly, monthly, yearly or a custom period. OBSERVED: [Stats tab](https://help.realbyteapps.com/hc/en-us/articles/360045310273-Stats-Tab).
- **Swipe left and right to change month.** **Long-press transactions to multi-select and see their sum.** OBSERVED: [4.6](https://help.realbyteapps.com/hc/en-us/articles/4411967292441-Android-4-6-0-x-Update-January-2022), [4.0](https://help.realbyteapps.com/hc/en-us/articles/360050549913-Android-4-0-x-Update-October-2018).
- System, dark and light modes, with 6 theme colours. OBSERVED: [style](https://help.realbyteapps.com/hc/en-us/articles/7318083094169-How-to-set-style).

**Praise and complaints (from the three `en_IN` review snippets, a small sample)**
- Praise: "very useful and easy to use". OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN).
- Complaints:
  - Notes lost after a year of use ("No Data Available").
  - Account-wise summaries only go month by month, with no custom range, multi-month or yearly option.
  - A wish for clearer debit/credit columns.
  - Source for all three: OBSERVED, same listing.
- Structural limits:
  - No device sync. OBSERVED: [sync FAQ](https://help.realbyteapps.com/hc/en-us/articles/26009445731993-Can-we-sync-between-devices).
  - The free version shows ads and caps you at 15 accounts. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree&hl=en_IN&gl=IN).
  - Photos are lost when the app is uninstalled. OBSERVED: [photos](https://help.realbyteapps.com/hc/en-us/articles/47441540474137-How-to-Backup-Restore-Money-Manager-Photos).

### 2.2 Wallet (BudgetBakers)

**Core features**
- **Accounts:** manual, bank-synced (bank sync is weak in India, see complaints), **Google Pay Sync** (not offered in India) and **SMS Pay Sync (India only)**. OBSERVED: [Google Pay Sync country list](https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Sync), [SMS Pay Sync](https://support.budgetbakers.com/hc/en-us/articles/39631628971666-SMS-Pay-Sync).
- **SMS Pay Sync (India):**
  - Setup is a guided wizard: switch off battery optimisation, enable autostart on Xiaomi and Vivo, grant notification access, then pick your banks. Wallet then **creates one account per bank automatically**.
  - It "listen[s] for notifications from your default SMS application", parses merchant, amount and currency, and stores the records "locally in the app's database". It is "disabled by default" and touches no other app's notifications.
  - Wallet's FAQ adds two caveats: if no notification arrives, nothing is recorded, and connecting the same bank twice (SMS and bank sync) creates duplicates.
  - OBSERVED: [SMS Pay Sync](https://support.budgetbakers.com/hc/en-us/articles/39631628971666-SMS-Pay-Sync), [Notification Access – India](https://support.budgetbakers.com/hc/en-us/articles/39631752579346-Notification-Access-Permission-India), [Google Pay Sync FAQ](https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Sync).
  - Caveat: both India articles also carry a "Coming soon" label, so whether the feature is fully live is UNKNOWN.
- **Budgets** can be defined by category, account or label, over a week, month or year. Each budget shows:
  - **Spent**
  - **Remaining**
  - **Predicted expenses**: spent so far, plus planned payments, plus the average of earlier periods
  - **Expected balance**
  - colour coding: **"green – budget okay, orange – risk of overspending, red – budget exceeded"**
  - a spending trend against the 5 previous periods
  - optional alerts "if you overspend or are close to it"

  OBSERVED: [Setup Budgets](https://support.budgetbakers.com/hc/en-us/articles/7076953735314-Setup-Budgets).
- **Planned payments** are recurring entries that wait for **manual or automatic confirmation**, with notifications on the due date or 3 days before, and an "upcoming" card on the dashboard. A payment scheduled for the 31st is skipped in shorter months, because "last day of month" is not supported. OBSERVED: [Planned Payments](https://support.budgetbakers.com/hc/en-us/articles/7149523920786-Setup-Planned-Payments).
- **Templates** pre-fill amount, category, account, payee, labels and note, and can be picked straight from the home **+**. OBSERVED: [Templates](https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates).
- **Categories:**
  - A fixed set of main categories, kept fixed because the app categorises with machine learning. You can rename them, add sub-subcategories, and give each a **"nature"** of must, need or want.
  - The picker surfaces **"most used categories"** first.
  - **Labels** add up to 5 tags per record.
  - OBSERVED: [Categories](https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories), [Labels](https://support.budgetbakers.com/hc/en-us/articles/7076564578066-Utilising-Labels).
- **Automatic rules:** a keyword in the payee or note sets the category and labels. They apply only to bank-synced records. OBSERVED: [Automatic Rules](https://support.budgetbakers.com/hc/en-us/articles/7149319175826-Automatic-Rules).
- **Splitting a record** is Android-only. OBSERVED: [Transactions](https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates).
- **Merging duplicates** works on bank records with the same amount and type within 10 days. OBSERVED: [Duplicates](https://support.budgetbakers.com/hc/en-us/articles/7149205631634-Solve-Duplicate-Transactions).
- **Export** to PDF, XLS or CSV is **Premium**. OBSERVED: [Export](https://support.budgetbakers.com/hc/en-us/articles/7151606064018-How-to-export-transactions-from-Wallet). Cloud sync and a web app are included. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en_IN&gl=IN).
- **"Initial day of the month"** setting (Android only). OBSERVED: [article](https://support.budgetbakers.com/hc/en-us/articles/12212663489298-Setup-Initial-day-of-the-month).
- **Net worth:** a Balance Trend widget, plus stock tracking and debts. OBSERVED: [percentage article](https://support.budgetbakers.com/hc/en-us/articles/36546774821778-What-does-the-percentage-next-to-Income-Expenses-mean), [listing](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en_IN&gl=IN).

**What makes entry fast**
- On Android the record form asks for the **amount first, then account, then category**, and an arrow reveals optional fields (note, labels, payee, date, payment type, receipts and more). OBSERVED: [Transactions](https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates). The documented Android path starts from the side menu (≡, Records, +), but the home **+** offers templates directly. OBSERVED: [Templates](https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates).
- The category picker leads with the most-used categories. A label can be set to apply to every new record. OBSERVED: [Categories](https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories), [Labels](https://support.budgetbakers.com/hc/en-us/articles/7076564578066-Utilising-Labels).

**UI and visual patterns**
- **Card-based dashboard:** add, remove, filter and drag cards to reorder them. OBSERVED: [Dashboard cards](https://support.budgetbakers.com/hc/en-us/articles/7150077480850-Add-or-Modify-Dashboard-Cards-Widgets).
- **Period-over-period change** shows as "a small percentage… with an up or down arrow", computed as (current − previous) ÷ |previous|. Wallet's own help page warns that a tiny previous period makes the percentage look huge. OBSERVED: [percentage article](https://support.budgetbakers.com/hc/en-us/articles/36546774821778-What-does-the-percentage-next-to-Income-Expenses-mean).
- **Review state for imported records:**
  - Unreviewed records lack a **green check mark**.
  - You confirm one by editing it, by **swiping right**, or automatically when a rule matches.
  - OBSERVED: [Record Confirmation](https://support.budgetbakers.com/hc/en-us/articles/9740038391186-Record-Confirmation-Green-check-mark).
- Budget states use traffic-light colours (above). Statistics pies are expense-only, and Wallet says including income is "a complex challenge". OBSERVED: [Statistics](https://support.budgetbakers.com/hc/en-us/articles/31001090941970-Understanding-Your-Wallet-Statistics).
- Calendar view: UNKNOWN, as no help article mentions one.

**Praise and complaints (`en_IN` snippets)**
- Praise: "Great app, simple yet useful". OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.droid4you.application.wallet&hl=en_IN&gl=IN).
- Complaints from Indian Premium users (OBSERVED, same listing):
  - Bank sync "disconnects every 2 3 days".
  - Transactions are "not syncing" for a month with no support reply.
  - One reviewer points Wallet at the Fold app as a better example.
- These complaints cover the bank-sync channel, not SMS Pay Sync (INFERRED from their wording and dates).

### 2.3 axio (formerly Walnut)

**Core features**
- An **SMS-based money manager**:
  - tracks daily and monthly spends across bank accounts, credit cards, wallets and meal cards (Sodexo)
  - shows bank balances and **credit-card dues**
  - tracks utility bills (electricity, DTH, gas, mobile, Wi-Fi)
  - supports custom categories, notes, **tags and receipt photos**
  - **searches** expenses, tags and notes

  OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN).
- **Spending limits with timely alerts.** OBSERVED: [axio.co.in](https://axio.co.in/). How limits are displayed: UNKNOWN.
- **Detection:**
  - Only supported senders are parsed (banks, cards, wallets, DTH, utilities, insurers).
  - An unsupported SMS can be reported under "Biz Messages" via **"Request to Support"**.
  - There is a **"Rescan SMS"** option.
  - Xiaomi, Vivo and Lenovo phones may need background and autostart permissions.
  - **Cash and wallet spends default to "not an expense"**, so ATM withdrawals and wallet top-ups are not double-counted.
  - OBSERVED: [FAQ](https://axio.co.in/faq).
- **Manual entry:** "+ New Transaction" on the Money Manager tab, or "Add Spend" from an account page. OBSERVED: [FAQ](https://axio.co.in/faq).
- **Export and backup:** reports are emailed as PDF and CSV. The backup is tied to your email address. "axio does not support syncing across devices." OBSERVED: [FAQ](https://axio.co.in/faq).

**Privacy and permissions (the key lesson)**
- axio holds the **READ_SMS** permission. The listing says it "does not read your personal SMS". The same SMS permission also serves the lending business: "Personal Loan: Fraud prevention and security" and "Fixed Deposit: SMS-based SIM-device binding". OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN).
- If backup is on, axio "securely transmits and saves your messages from businesses on our secure servers". "OTPs and personal SMSes are not sent." OBSERVED: [FAQ](https://axio.co.in/faq).
- The Play Data-safety summary says the app "may share… Location and Personal info" with third parties. OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN).

**Interaction**
- Most entries arrive automatically, so the work moves from typing entries to **correcting and categorising** them. That is INFERRED from the FAQ's emphasis on reporting undetected SMS and on recategorising. Screen-level UI details (dashboard layout, colours): UNKNOWN, because no help pages describing screens were reachable.

**Praise and complaints (`en_IN` snippets, all from Aug–Oct 2026)**
- Bank SMS have gone undetected since 2 Aug 2026 even after a rescan, with no response from support.
- Online transactions are captured "twice or sometimes even 5 times". Some never appear, and export "does not work anymore".
- The spend is recorded but the **Balance section is not updated**, and there is no manual balance entry.
- Source for all three: OBSERVED, [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN).
- **Lesson (INFERRED):** fully automatic SMS parsing fails silently. Formats change, duplicates appear, and balances drift. A self-built version needs a **review step**, **dedupe**, and a manual fallback.

### 2.4 Also studied: Cashew (UI and capture design)

- **Entry flow:**
  - **+** asks, in sequence, for **title, then category, then amount**. "Tap outside to close the sequence of questions at any time." OBSERVED: [FAQ](https://cashewapp.web.app/faq.html).
  - **"Custom Titles"**: once a title has been used, it auto-assigns its category the next time. OBSERVED: [README](https://github.com/jameskokoska/Cashew).
  - **Long-press +** for transfers, balance corrections and **pinned transactions**. A pinned transaction is duplicated to the current date and time with one tap. OBSERVED: [FAQ](https://cashewapp.web.app/faq.html).
  - The primary account is the default for new transactions. OBSERVED: same.
  - The number pad has a haptics setting. OBSERVED: [changelog](https://github.com/jameskokoska/Cashew/blob/main/budget/lib/widgets/showChangelog.dart).
- **Budgets:**
  - **"All Transactions"** budgets (filters decide what counts) and **"Added Only"** budgets (for trips) are separate types.
  - Category spending goals are set as a percentage or an amount.
  - History shows past periods.
  - The **budget graph** plots spending against date, with "a dashed line… on the current date and the average amount spent per day". The crossing point shows where spending should be to stay on track.
  - OBSERVED: [FAQ](https://cashewapp.web.app/faq.html).
- **Recurring:** upcoming, repeating and subscription entries **don't count until marked Paid**. The next occurrence is created only when the current one is paid or skipped. Overdue entries are auto-paid by default. OBSERVED: [FAQ](https://cashewapp.web.app/faq.html).
- **Transfers** are paired balance-correction entries with a net total of 0. They are excluded from income and expense totals, and deleting one side prompts to delete the other. OBSERVED: [FAQ](https://cashewapp.web.app/faq.html), [changelog](https://github.com/jameskokoska/Cashew/blob/main/budget/lib/widgets/showChangelog.dart).
- **Home screen:**
  - **Fully customisable sections**: graphs, budgets, balances, **heatmaps**, pie charts, recent transactions, and net worth with a chosen set of accounts and time range.
  - Long-press most elements to edit them.
  - Long-press a total to copy the breakdown.
  - OBSERVED: [FAQ](https://cashewapp.web.app/faq.html).
- **Notification (and SMS) scanning** is experimental and Android-only. The user teaches the parser instead of relying on hard-coded bank formats:
  1. Wait for a real notification.
  2. Tap the text that identifies the **subject** (the sender or app).
  3. Tap the **amount**.
  4. Optionally tap the **title**.
  5. Set a default category and account.

  "All notification data is processed on device." The docs also warn that "the notification listener may be stopped by Android background/battery restrictions". OBSERVED: [notification-scan doc](https://cashewapp.web.app/assets/docs/automation/notification-scan.md).
- **App Links and a broadcast receiver:**
  - `https://cashewapp.web.app/addTransaction?amount=…&title=…&category=…` adds a transaction.
  - `/addTransactionRoute` opens the add form pre-filled.
  - Tasker or Automate can broadcast the same links to `com.budget.tracker_app.UriReceiver` while Cashew is in the background.
  - OBSERVED: [app-links doc](https://cashewapp.web.app/assets/docs/automation/app-links.md), [broadcast doc](https://cashewapp.web.app/assets/docs/automation/broadcast-receiver.md).
- **Reviews:** they praise its cleanliness and ask for: local reading of transactional messages, an investment tracker, loan given/taken tracking, and **tags** (for example #Amazon, #KashmirTrip). OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.budget.tracker_app&hl=en_IN&gl=IN). Data safety: "No data collected". OBSERVED: same.

---

## 3. What EIO already has

EIO Finance already does several things well:
- **Storage and formatting:** transactions are stored as integer paise with an explicit income/expense kind, and amounts show with Indian digit grouping (₹12,34,567).
- **Phone:**
  - an all-time running balance
  - stepping back and forward through months
  - a month in/out summary
  - a category pie with ranked bars
  - a six-month trend
- **Website:** CSV export and filters.
- **Entry:** amount-first, with an oversized auto-focused decimal-pad field and a Type toggle. The category defaults to the first in the list (Food), not the last one used.
- **Sync:** one Supabase database syncs the phone and the website.
- **Subscriptions:** tracks due dates with reminders, and **"mark paid" logs the payment as an expense** under the subscription's category. That is a manual-confirm recurring model, close to Wallet's planned payments and Cashew's "mark as paid".
- **Already designed:** a full schema for accounts, transfers, assets, liabilities, net-worth snapshots and budgets (with rollover) is drafted in `supabase/migrations/0008_finance_v2.sql` but not applied.

Sources: `app/src/modules/finance/*`, `app/src/core/money.ts`, `app/src/core/categories.ts`, `app/src/modules/subscriptions/api.ts`, `supabase/migrations/0004_create_finance.sql`, `supabase/migrations/0008_finance_v2.sql` (OBSERVED in the repo).

---

## 4. Gap analysis

### 4.1 Capability matrix

| Capability | Money Manager | Wallet | axio | Cashew | EIO |
|---|---|---|---|---|---|
| Multiple accounts and balances | Yes | Yes | Yes (from SMS) | Yes | **No** (schema drafted) |
| Transfers excluded from spending | Yes, with fees | Yes | Partly: cash/wallet "not an expense" default | Yes, net 0 | **No** (schema drafted) |
| Credit-card cycle (payable vs outstanding) | Yes | Debts/cards | Card dues from SMS | Cycle range for reports | **No** |
| Category budgets | Yes, with pacing line and carry-over | Yes, with forecast and traffic lights | Limits and alerts | Yes, with per-day pace line | **No** (schema drafted) |
| Recurring entries | Repeat and installments | Planned payments (manual or auto confirm) | Bills from SMS | Upcoming, subscription, repeating | **Partial** (Subscriptions → mark paid) |
| Custom categories and subcategories | Yes | Rename and subs only | Custom categories | Yes | **No** (fixed list in code) |
| Tags / labels | Yes (Oct 2026) | Yes (5 per record) | Yes | Yes (search filter) | **No** |
| Quick repeat (bookmark / template / pin) | Bookmarks | Templates | n/a | Pinned | **No** |
| Smart defaults (most-used / title memory) | Note autocomplete | Most-used categories | n/a | Title → category | **No** (always defaults to Food) |
| Save and add another | "Continue" | UNKNOWN | UNKNOWN | UNKNOWN | **No** |
| Calendar view | Yes, core | UNKNOWN | UNKNOWN | Heatmap and calendar | **No** |
| Search on the phone | Yes, with result totals | Filters | Yes | Yes | **No** (website only) |
| Period comparison | Month list | % vs previous period | UNKNOWN | Compare periods | Six-month trend only |
| Net worth | Assets vs liabilities | Balance trend | Balances | Net-worth section | **No** (schema drafted) |
| Auto-capture of bank/UPI alerts | No | SMS Pay Sync (notifications) | READ_SMS | User-taught notification parser | **No** |
| Review queue for captured items | n/a | Green check / swipe | Recategorise | On app open | **No** |
| Home-screen quick add | Quick-add widgets | Widgets | UNKNOWN | Widgets and shortcuts | **No** |
| Custom month start (salary day) | Yes | Yes | UNKNOWN | Per-budget start | **No** |
| Receipts / photos | Up to 3 | Yes | Yes | Attachments | No |
| Split transaction | Not found (MM documents a negative expense for reimbursements) | Android only | UNKNOWN | Bill splitter | No |
| Export | Excel via email | CSV/XLS/PDF (Premium) | PDF/CSV email | Data file, CSV | CSV (website) |
| Multi-device sync | **No** | Yes | **No** | Yes (Drive) | **Yes** (Supabase) |
| Ads or upsell | Ads, 15-account cap | Premium paywall | Loans and FD upsell | Cashew Pro; multiple budgets appear to be Pro (INFERRED from FAQ wording) | **None** |

The cells come from the sources cited in section 2, except "UNKNOWN", which means no evidence was found.

### 4.2 What all the leaders share that EIO lacks

1. **An account layer with transfers.** Every leader models where money sits, and keeps moves between your own accounts out of spending.
2. **Budgets that show pace, not just totals.**
   - Money Manager: "recommended spending limit" line.
   - Cashew: dashed average-per-day line.
   - Wallet: predicted spend plus traffic-light colours.
3. **A one-tap path for repeated spends.** Bookmarks, templates or pins, plus some form of default memory.
4. **Editable categories with a second level,** either subcategories or tags/labels.
5. **Search on the phone.**
6. **Some way to see spending by day,** as a calendar or a heatmap.
7. **In India, an answer for UPI volume.** Either automatic capture (axio, Wallet SMS Pay Sync, Cashew scanning) or very fast manual entry.

### 4.3 What EIO already does better

- **Sync between phone and desktop with no paywall.** Money Manager and axio both state they don't sync across devices. Wallet locks export behind Premium. OBSERVED: [MM sync FAQ](https://help.realbyteapps.com/hc/en-us/articles/26009445731993-Can-we-sync-between-devices), [axio FAQ](https://axio.co.in/faq), [Wallet export](https://support.budgetbakers.com/hc/en-us/articles/7151606064018-How-to-export-transactions-from-Wallet).
- **No ads, no lending upsell, and no third-party data sharing.** Compare axio's and Money Manager's Data-safety declarations above.
- **Integer-paise money and an explicit kind column.** Correct by construction (INFERRED: competitors' internals are not public).
- **The recurring-confirmation model already exists** in Subscriptions, where "mark paid" logs the expense. That is the pattern Wallet and Cashew converged on, so it only needs generalising.
- **The schema for accounts, budgets and net worth is already designed,** including choices the leaders also made: computed balances, a transfer group, per-category budgets with rollover, and dated valuations.

---

## 5. Recommendations

Effort assumes one developer who knows this codebase: **S** = about a day, **M** = 2–4 days, **L** = a week or more (INFERRED estimates). "DB" says whether a migration is needed.

### TOP 5

**1. Accounts and transfers (apply the account half of migration 0008)**
- **What:**
  - Accounts: Cash, each bank or UPI account, credit cards.
  - An account on every transaction, defaulting to the last one used.
  - Transfers as paired rows that are excluded from income/expense totals and pie charts.
  - An Accounts screen that lists balances, with a liabilities line for cards.
  - An optional fee on a transfer.
- **Why for one person:** a UPI payment from the bank, an ATM withdrawal, and a credit-card bill payment are different events. Without accounts, an ATM withdrawal looks like spending, then the cash spent looks like spending again. axio's "not an expense by default" for cash and wallet spends exists to stop exactly that double count (OBSERVED: [FAQ](https://axio.co.in/faq)). Accounts are also the base for net worth and for auto-capture, since each captured alert maps to one account.
- **Who has it:** Money Manager, Wallet, axio, Cashew.
- **Effort:** M. **DB:** yes, the `accounts` table and `account_id`/`transfer_group_id` columns already drafted in 0008. Assets, liabilities and snapshots can wait.

**2. Two-tap logging: smart defaults, pinned templates, save-and-add-another**
- **What:**
  - Default the category and account to the **last used for that kind**. Better still, if the note matches an earlier note, use that note's category (Cashew's "Custom Titles"; Wallet's "most used categories").
  - Show a row of **pinned templates** on the Finance screen (for example "Chai ₹20 · Cash", "Metro ₹40 · UPI") that log with one tap and show an **Undo** snackbar (Money Manager bookmarks; Wallet templates; Cashew pins).
  - Add a **"Save & add another"** button (Money Manager "Continue").
  - Show a **recent-notes autocomplete** (Money Manager).
- **Why for one person:** UPI means many small payments a day, and each one is a chance to skip logging. Logging speed decides whether the data is complete (INFERRED). EIO is already amount-first, so this item removes the remaining taps.
- **Who has it:** all four.
- **Effort:** S for defaults, note memory and save-and-add-another. M with templates. **DB:** none for defaults (derive from the latest transactions, or store locally). Templates need a small `finance_templates` table, or a JSON setting.

**3. Category budgets with a pace marker and colour states (apply the `budgets` table from 0008)**
- **What:**
  - A standing monthly limit per category, plus an optional overall limit.
  - A bar with a **today marker** at (days elapsed ÷ days in month) × limit.
  - Colours: **green** below pace, **amber** above pace but under the limit, **red** over the limit.
  - A copy line such as "₹2,340 left · ₹156/day for 15 days".
  - Tapping a bar opens that category's month list and its six-month history.
  - Rollover per category, as the draft schema already allows.
- **Why:** a budget only changes behaviour if you can see mid-month that you are ahead of pace. All three teardown apps converge on a pacing line or a forecast. OBSERVED: [MM](https://help.realbyteapps.com/hc/en-us/articles/360042743774-How-to-set-up-modify-delete-a-budget), [Cashew](https://cashewapp.web.app/faq.html), [Wallet](https://support.budgetbakers.com/hc/en-us/articles/7076953735314-Setup-Budgets).
- **Who has it:** Money Manager, Wallet, Cashew. axio has alerts.
- **Effort:** M. **DB:** yes (`budgets` in 0008).

**4. Semi-automatic capture of bank and UPI alerts into a review inbox (staged)**
- **What:**
  - On Android, a notification listener sees bank SMS (through the SMS app's notifications) and UPI-app payment notifications.
  - It parses amount, direction and merchant **on the device** and writes a **pending** row.
  - EIO shows an **Inbox** where you confirm, recategorise or dismiss each row. Wallet's swipe-right-to-confirm is the model.
  - Details, constraints and staging are in section 5.2.
- **Why:** for someone who pays mostly by UPI, this is the only route to near-complete data without discipline. The leaders split on it: axio uses full SMS permission, Wallet and Cashew use notifications, and Money Manager has none.
- **Who has it:** axio (READ_SMS), Wallet (SMS Pay Sync, India), Cashew (experimental), Bluecoins.
- **Effort:** L. **DB:** yes. Add a `status` (`pending | confirmed`) or `needs_review` flag, `source` (`manual | notification | sms`), and an `external_ref` or hash for dedupe.

**5. A calendar month view on the phone, plus phone search**
- **What:**
  - A month grid where each day shows its expense total. Optionally, a small income figure, and cell tint scaled to spend, like a heatmap.
  - Tapping a day opens a sheet with that day's entries and an **Add** button pre-dated to that day.
  - Swipe left or right to change month.
  - Phone search over note, category and amount range, with **a total of the results**.
- **Why:** "what happened on the 14th?" and "how much did I spend on Swiggy this year?" are the questions a personal ledger has to answer. Both are Money Manager signatures, and search with totals is cheap to add.
- **Who has it:** Money Manager (calendar and search with totals), Cashew (heatmap and search), axio (search).
- **Effort:** S–M. **DB:** none. The website already has search, so the queries exist.

### 5.1 The rest, in priority order

| # | Recommendation | Why (solo) | Who has it | Effort | DB |
|---|---|---|---|---|---|
| 6 | **Custom month start** (salary day) for summaries and budgets | A salary on the last working day makes calendar months misleading | MM, Wallet, Cashew | S | No (a setting) |
| 7 | **Generalise Subscriptions into "planned payments"**: rent, SIP, EMI, insurance, with mark-paid (or auto-post) and a due-soon card on Finance | EIO already has the confirm model; extend it beyond subscriptions | Wallet, Cashew, MM | M | Small (a kind/flag on `subscriptions`, or a sibling table) |
| 8 | **Tags** (free-text, multiple per transaction) and **subcategories** only if needed | Groups spending across categories (trips, a wedding, "Amazon"), which Cashew reviewers ask for | MM, Wallet, axio, Cashew | M | Yes (`tags text[]` column, or a join table) |
| 9 | **Custom categories in the UI.** Because EIO is your own code, adding a category is a one-line edit to `core/categories.ts` (the DB column is free text), so a UI is optional | Low urgency for a developer-owner (INFERRED) | All | M | Yes, if user-editable (`categories` table) |
| 10 | **Net worth** (assets, liabilities, snapshots from 0008), with manual valuations and a trend line | Already designed. Money Manager shows assets vs liabilities. Cashew and Wallet show a trend | MM, Wallet, Cashew | M–L | Yes (0008) |
| 11 | **Quick add from outside the app**: an Android app shortcut (long-press the icon → "Add expense") first, then a home-screen widget | Removes the "open the app, navigate" cost | MM (quick-add widgets), Cashew, Wallet | S for a shortcut (`expo-quick-actions`); M–L for a widget (`react-native-android-widget`); both need a dev build | No |
| 12 | **Period-over-period deltas** on the month summary ("Food ▲18% vs Sep") | Fast insight. Show the absolute ₹ change when the base is tiny, the failure Wallet's own help page documents | Wallet | S | No |
| 13 | **Credit-card cycle** (payable vs outstanding by statement date) | Useful only if you put real spending on cards | MM | M | Yes (statement and due day on accounts) |
| 14 | **Multi-select with a running sum** and bulk recategorise | Cleans up mis-tagged imports quickly, and works well with item 4 | MM, Wallet | S–M | No |
| 15 | Receipts/photos; split transactions | Low value solo. A split can be two rows. A refund can be a negative expense (MM's documented trick) or the existing `refund` income category | MM, Wallet, Cashew | M each | Yes (storage, split groups) |

Dropped as not useful for one person: shared accounts and group budgets (Wallet), bank sync through aggregators (Wallet bank sync, Fold), and lending, credit-score and FD upsells (axio, Moneyview).

### 5.2 Auto-capture of SMS and UPI alerts: what a self-built Android app can actually do

**The two technical routes**

| Route | How | Restrictions for a sideloaded APK | Restrictions if ever on Google Play |
|---|---|---|---|
| **A. Notification listener** (recommended) | A `NotificationListenerService` declared with `BIND_NOTIFICATION_LISTENER_SERVICE`. The user enables it in system settings, not through a runtime dialog. It receives every posted notification: the default SMS app's bank-SMS notifications and the UPI apps' "Paid ₹X to Y" notifications. OBSERVED: [Android reference](https://developer.android.com/reference/android/service/notification/NotificationListenerService). This is the route Wallet's India SMS Pay Sync, Cashew and Bluecoins use. OBSERVED: [Wallet](https://support.budgetbakers.com/hc/en-us/articles/39631752579346-Notification-Access-Permission-India), [Cashew](https://cashewapp.web.app/assets/docs/automation/notification-scan.md), [Bluecoins](https://ram.bluecoinsapp.com/guide/bank-notifications/) | Notification listener is a **restricted setting** for sideloaded apps (Android 13+; listed in the Android 15 CDD). The user must open App info → ⋮ → **"Allow restricted settings"** once. OBSERVED: [Google help](https://support.google.com/android/answer/12623953), [9to5Google](https://9to5google.com/2024/09/12/android-15-sideloaded-apps-restrictions/). Android 15 **redacts OTPs** from notifications for untrusted listeners. OBSERVED: [Android 15 changes](https://developer.android.com/about/versions/15/behavior-changes-all). It is INFERRED that plain debit alerts are not redacted; whether the OTP detector misfires on transaction alerts is UNKNOWN | UNKNOWN (Play's review of notification-listener use was not researched) |
| **B. Read SMS** (`READ_SMS` / `RECEIVE_SMS`) | Read the inbox directly. That allows a **back-fill / "rescan"**, which axio offers and route A cannot | The SMS runtime permission is **also restricted** for sideloaded apps on Android 15. OBSERVED: [9to5Google](https://9to5google.com/2024/09/12/android-15-sideloaded-apps-restrictions/). It reads every message, including personal ones and OTPs: a much larger privacy surface | Allowed only via a Permissions Declaration under the **"SMS-based money management"** exception ("apps that track and manage budget"), and budgeting apps "may not exfiltrate or share non-financial or personal SMS history". OBSERVED: [Play policy](https://support.google.com/googleplay/android-developer/answer/10208820), [Play policy 2](https://support.google.com/googleplay/android-developer/answer/9047303) |

**Constraints specific to EIO**
- **Expo Go cannot load either route.** Both need custom native code, so the app has to run as its own build. Expo describes a development build as "your own version of Expo Go where you are free to use any native libraries"; that Expo Go itself cannot is the implication (OBSERVED quote, INFERRED conclusion: [Expo dev builds](https://docs.expo.dev/develop/development-builds/introduction/)).
  - EIO already has `expo-dev-client` and an EAS `development` profile that builds an APK (OBSERVED: `app/package.json`, `app/eas.json`). In practice this means switching daily use from the sideloaded Expo Go to an EIO dev or preview APK (INFERRED).
  - Existing libraries:
    - [`expo-android-notification-listener-service`](https://www.npmjs.com/package/expo-android-notification-listener-service): last published Jan 2025.
    - [`react-native-android-notification-listener`](https://www.npmjs.com/package/react-native-android-notification-listener): last published Dec 2022.
    - [`@maniac-tech/react-native-expo-read-sms`](https://www.npmjs.com/package/@maniac-tech/react-native-expo-read-sms): Mar 2026.

    All OBSERVED via the npm registry.
  - Given React Native 0.86 and the age of those packages, a **small local Expo module** in Kotlin (a listener service that writes to a local queue) is probably safer than an old library (INFERRED).
- **Background reliability:** every app that does this documents having to disable battery optimisation and, on Xiaomi and Vivo, enable autostart. Without it the listener gets killed. OBSERVED: [Wallet](https://support.budgetbakers.com/hc/en-us/articles/39631628971666-SMS-Pay-Sync), [axio](https://axio.co.in/faq), [Bluecoins](https://ram.bluecoinsapp.com/guide/bank-notifications/), [Cashew](https://cashewapp.web.app/assets/docs/automation/notification-scan.md). Route A also **misses anything posted while the listener was dead** and cannot back-fill (INFERRED from how the API works).
- **Duplicates are the main data-quality risk.** One UPI payment typically produces both a UPI-app notification and a bank SMS (INFERRED). Wallet warns that two sources for the same money cause duplicates (OBSERVED: [Google Pay Sync FAQ](https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Sync)). axio users report entries captured 2–5 times (OBSERVED: [listing](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN)). Mitigations:
  - **Pick one source per account.** For example, bank SMS only, ignoring the UPI apps, which mirrors Wallet's advice.
  - **Dedupe** on amount plus account plus a ±10-minute window plus the reference number when one is present. The window is INFERRED; Wallet's bank-record merge uses same amount and type within 10 days.
- **Parsing:** formats differ by bank and change without notice, which is axio's documented failure (OBSERVED: [listing reviews](https://play.google.com/store/apps/details?id=com.daamitt.walnut.app&hl=en_IN&gl=IN)). Two options:
  - **(a) User-taught templates**, as in Cashew: pick a real notification, tap the amount and the payee.
  - **(b) A regex library** such as [`transaction-sms-parser`](https://www.npmjs.com/package/transaction-sms-parser): MIT licence, last published May 2026, tested on Axis, ICICI, Kotak, HDFC, IDFC, Federal and others. It is self-described as "a naive implementation using mostly regular expressions". Its README example output puts the *balance* in the `amount` field, which shows how easily the wrong number gets picked. OBSERVED: npm registry README.

  For one person with 2–3 banks, (a) or a small hand-written parser per bank is realistic (INFERRED).
- **Privacy:** parse on the phone. Upload only the resulting transaction (amount, merchant, account, date), never raw message bodies, and keep a `source` tag. This mirrors Wallet's and Cashew's on-device processing (OBSERVED, sources above). Never read OTPs; route A's Android 15 redaction helps here.
- **Sideloading in 2026–27:** Google's developer verification starts on 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand, and "will be expanded globally… in 2027". Three escape routes exist:
  - **ADB installs are exempt**: "Apps installed using ADB won't require verification."
  - A free **limited distribution account** covers up to 20 devices with no ID.
  - An **advanced flow** lets power users install unverified apps.

  OBSERVED: [developer verification](https://developer.android.com/developer-verification), [FAQ](https://developer.android.com/developer-verification/guides/faq), [limited distribution](https://developer.android.com/developer-verification/guides/limited-distribution). India is not named in the first wave (OBSERVED: same pages). A personal EIO APK stays installable, but it should be registered under a limited-distribution account before 2027 (INFERRED).

**Suggested staging**
1. **Stage 0 (S, no native code):** add a deep link such as `eio://finance/add?amount=…&note=…&category=…` that opens a pre-filled add sheet, plus an Android share target. The share target needs native config, so it requires a dev build: [`expo-share-intent`](https://www.npmjs.com/package/expo-share-intent). This lets an automation app the user already trusts, such as MacroDroid, Tasker or Automate, do the notification reading, with EIO holding no restricted permission. This is Cashew's App Links and broadcast-receiver design (OBSERVED: [app-links](https://cashewapp.web.app/assets/docs/automation/app-links.md)).
2. **Stage 1 (L):** build an in-app notification listener. It accepts notifications only from an allow-list (the default SMS app plus chosen UPI apps), applies per-bank templates, writes rows to the **pending** inbox, and uses one source per account.
3. **Stage 2 (M):** add rules ("merchant contains SWIGGY → Food"), learn the category from past confirmations, and add a "missed alerts?" banner when the listener has been disconnected. The banner relies on `onListenerDisconnected` (INFERRED from the [API](https://developer.android.com/reference/android/service/notification/NotificationListenerService)).

---

## 6. UI/UX patterns worth adopting

Each of these is specific enough to build without seeing the source app. The source and the evidence label are in brackets.

**Adding a transaction**
1. **Amount-first sheet with an in-app keypad.** Show a large ₹ amount on top and a 4×4 keypad (digits, `.`, backspace, `+ − × ÷`, `=`). Arithmetic lets you total "120+45" at the counter. A Save key is always visible. *[Money Manager calculator; Wallet amount → account → category order. OBSERVED. A custom keypad instead of the system decimal pad is INFERRED as better for arithmetic and a fixed layout.]*
2. **Category as a grid below the amount, with the most used first.** Show a 4-column icon grid ordered by use in the last 60 days. The last-used category is pre-selected and outlined. Long-press a tile to edit it. *[Wallet "most used categories"; Cashew long-press to edit. OBSERVED.]*
3. **A chip row for account and date.** Under the amount, show `[UPI · HDFC ▾]` and `[Today ▾]` chips. Tapping the date chip offers Yesterday or a picker. Both default to the last used / today. *[INFERRED from the MM/Wallet field sets.]*
4. **Note with memory.** As you type, suggest past notes. Picking one fills in its category, and amount if you choose. *[Cashew "Custom Titles"; MM autocomplete. OBSERVED.]*
5. **Two save buttons.** "Save" closes the sheet. "Save & add another" keeps it open, keeps the account and date, and clears the amount. *[MM "Continue". OBSERVED.]*
6. **Pinned quick-adds.** A horizontal row of pills ("Chai ₹20") above the transaction list. One tap logs today's entry and shows a snackbar "Logged Chai ₹20 · Undo". *[MM bookmarks, Cashew pins, Wallet templates. OBSERVED. The Undo snackbar is INFERRED.]*
7. **Long-press the + button** for a small menu: Transfer, Template, Income. *[Cashew. OBSERVED.]*

**Lists and navigation**
8. **Day-grouped list with day totals.** A sticky header per day, such as "Thu 16 Oct · −₹840 · +₹0". Rows show the note (or the category if there's no note), a category icon, the account in small grey text, and the amount on the right. EIO already shows the note first, so keep that. *[INFERRED from MM's daily view, whose header totals were not verified in text.]*
9. **Swipe left/right on the month header to change month.** Tapping the month title jumps back to the current month. *[MM. OBSERVED.]*
10. **Long-press to multi-select, with a live sum in the top bar** ("3 selected · ₹1,245"), plus bulk Recategorise and Delete. *[MM. OBSERVED.]*
11. **Search that totals its results.** The results header reads "23 results · ₹6,480". *[MM. OBSERVED.]*

**Calendar**
12. **Month grid.** Each cell shows the date number and the day's spend in small text. The cell background is tinted by spend, using 4 buckets relative to the month's median day. Today is outlined. Days with income get a small dot. Tapping a day opens a bottom sheet with the day's entries and "+ Add for 16 Oct". *[MM calendar with per-day add; Cashew heatmap. OBSERVED. The bucket scheme is INFERRED.]*

**Budgets**
13. **Pacing bar.**
    - A horizontal bar showing spent ÷ limit.
    - A thin vertical tick at today's expected spend (days elapsed ÷ days in month × limit).
    - Fill colour: green when spent ≤ tick, amber when spent > tick but ≤ limit, red when over the limit, with the overspend amount in red text.
    - A subline: "₹2,340 left · ₹156/day for 15 days", or "Over by ₹410".

    *[MM tick, Cashew per-day line, Wallet green/orange/red. OBSERVED.]*
14. **Budget overview header.** The total spent of the total budget, the expected end-of-month spend (spent + remaining recurring + average daily × days left), and the expected balance. *[Wallet "Predicted expenses / Expected balance". OBSERVED.]*

**Colour semantics**
15. **Keep three colour systems separate:**
    - **Direction**: in and out, for example green income and neutral-or-red expense. Money Manager defaults to blue income and red expense and lets you swap them.
    - **Category hues**: EIO already has these.
    - **Status**: budget green, amber and red.

    If red already means "over budget", consider showing ordinary expenses in neutral text and colouring only income (INFERRED design advice). *[MM colour setting. OBSERVED.]*
16. **Transfers look different.** Use a neutral grey row with a ⇄ icon, "HDFC → Cash", no + or − sign, and leave it out of the pie and the month totals. *[Cashew/Wallet exclude transfers from totals. OBSERVED. The visual treatment is INFERRED.]*

**Reports**
17. **Delta chips on the summary.** "Spent ₹42,300 ▲12% vs Sep". When last period was under ₹500, show "+₹X" instead of a percentage. *[Wallet, including its documented small-base problem. OBSERVED.]*
18. **Tapping a pie slice or category bar** opens that category's month list and its six-month mini-trend. *[MM Stats, Wallet budget detail. OBSERVED.]*

**Auto-capture inbox (if item 4 is built)**
19. **An Inbox badge** on the Finance header ("5 to review"). Each pending row shows the parsed amount, merchant, account and a suggested category. **Swipe right to confirm**, swipe left to dismiss, tap to edit. Confirmed rows join the ledger. Pending rows are shown faded and excluded from totals until confirmed. *[Wallet green-check and swipe-right. OBSERVED. Excluding pending rows from totals mirrors Cashew's upcoming-not-counted-until-paid rule (OBSERVED).]*
20. **An honest setup screen** with three checklist rows, each with a live ✓/✗ status and a button that opens the exact settings page:
    - Notification access
    - Allow restricted settings
    - Battery: Unrestricted

    *[Wallet's guided wizard; restricted-settings path. OBSERVED.]*

**Empty states**
21. **Make empty states show what will appear.** An empty budget card says "Set a monthly limit for Food" with an inline amount field. An empty calendar shows the grid greyed out with "Tap a day to add". *[Cashew's principle that "features reveal themselves as you need them". OBSERVED in its FAQ. Specifics are INFERRED.]*

---

## 7. Checklist status

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | Top 3 for India | **Answered** | Chosen on Play metrics, update recency and India-specific features. Indian community sentiment (Reddit) is unresolved |
| Q2 | Entry speed | **Partial** | Fields, bookmarks, templates, Continue, most-used and title memory are all documented. Exact tap counts and whether MM pre-selects the last-used category are UNKNOWN (screens could not be inspected) |
| Q3 | Accounts and transfers | **Answered** | MM, Wallet, Cashew in detail. axio from its FAQ |
| Q4 | Budgets and overspend display | **Answered** for MM, Wallet, Cashew. **Partial** for axio (alerts only) | |
| Q5 | Recurring | **Answered** | |
| Q6 | Categories, subcategories, tags | **Answered** | |
| Q7 | SMS/UPI detection and privacy | **Answered** for axio and Wallet. Whether Wallet's India feature is fully live is UNKNOWN ("Coming soon" label) | |
| Q8 | What a self-built app can do | **Answered** for the sideloaded APK route. Play review of notification-listener use is UNKNOWN. Whether `adb install` counts as sideloaded for restricted settings is UNKNOWN | |
| Q9 | Reports and charts | **Answered** (MM, Wallet, Cashew). **Partial** for axio | |
| Q10 | Calendar view | **Answered** for MM and Cashew. **UNKNOWN** for Wallet and axio | |
| Q11 | Search | **Answered** | |
| Q12 | Export and backup | **Answered** | |
| Q13 | Net worth | **Answered** | |
| Q14 | UI patterns | **Partial** | Taken from help-centre descriptions of screens. Screenshots could not be read, so layout details (spacing, typography, dashboard order) are not verified. axio's UI is UNKNOWN |
| Q15 | Praise and complaints | **Partial** | 3 Play snippets per app, no Reddit, no full review mining |

**Unresolved overall:** Reddit and forum sentiment; CRED's expense features; axio's screen-level UI; whether Wallet's India SMS Pay Sync is fully rolled out; exact tap counts per app; whether Android's OTP redaction ever hides bank transaction alerts.

---

## Sources

**Play Store listings** (all fetched 19 Oct 2026, `hl=en_IN&gl=IN`)
- Money Manager: https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree
- Wallet: https://play.google.com/store/apps/details?id=com.droid4you.application.wallet
- axio: https://play.google.com/store/apps/details?id=com.daamitt.walnut.app
- Cashew: https://play.google.com/store/apps/details?id=com.budget.tracker_app
- Monefy: https://play.google.com/store/apps/details?id=com.monefy.app.lite
- Money Lover: https://play.google.com/store/apps/details?id=com.bookmark.money
- YNAB: https://play.google.com/store/apps/details?id=com.youneedabudget.evergreen.app
- Spendee: https://play.google.com/store/apps/details?id=com.cleevio.spendee
- Bluecoins: https://play.google.com/store/apps/details?id=com.rammigsoftware.bluecoins
- 1Money: https://play.google.com/store/apps/details?id=org.pixelrush.moneyiq
- Expense Manager: https://play.google.com/store/apps/details?id=com.expensemanager
- Moneyview: https://play.google.com/store/apps/details?id=com.whizdm.moneyview.loans

**Money Manager (Realbyte) help centre**, Android user guide, read through the public Zendesk API at `help.realbyteapps.com/api/v2/help_center/en-us/articles.json`
- Home tab: https://help.realbyteapps.com/hc/en-us/articles/360046150874-Home-tab
- Add income & expense: https://help.realbyteapps.com/hc/en-us/articles/360042701994-How-to-add-an-income-expense
- Budgets: https://help.realbyteapps.com/hc/en-us/articles/360042743774-How-to-set-up-modify-delete-a-budget
- Carry-over: https://help.realbyteapps.com/hc/en-us/articles/360043218993-How-to-turn-on-carry-over-feature
- Transfers: https://help.realbyteapps.com/hc/en-us/articles/360042702534-How-to-record-a-transfer
- Repeat & installments: https://help.realbyteapps.com/hc/en-us/articles/360046668993-How-to-set-up-a-repeat-schedule-installment
- Search: https://help.realbyteapps.com/hc/en-us/articles/360046151974-How-to-search
- Stats: https://help.realbyteapps.com/hc/en-us/articles/360045310273-Stats-Tab
- Bookmarks: https://help.realbyteapps.com/hc/en-us/articles/360042743374-How-to-make-a-bookmark
- Autocomplete: https://help.realbyteapps.com/hc/en-us/articles/360044208973-How-to-set-up-autocomplete
- Colours: https://help.realbyteapps.com/hc/en-us/articles/360047246533-How-to-change-income-expense-colors
- Accounts: https://help.realbyteapps.com/hc/en-us/articles/360043221593-How-to-register-hide-edit-delete-accounts
- Credit-card settlement: https://help.realbyteapps.com/hc/en-us/articles/360015963554-How-to-settle-credit-card-payments
- Debit cards: https://help.realbyteapps.com/hc/en-us/articles/360016071953-How-to-use-debit-cards
- Transfer-as-expense: https://help.realbyteapps.com/hc/en-us/articles/360015963434-How-to-set-up-Savings-Investment-Insurance-Loan-as-an-expense
- Subcategories: https://help.realbyteapps.com/hc/en-us/articles/360015963394-How-to-add-a-subcategory-under-main-category
- Backup: https://help.realbyteapps.com/hc/en-us/articles/360042747934-How-to-backup-and-restore-data
- Sync FAQ: https://help.realbyteapps.com/hc/en-us/articles/26009445731993-Can-we-sync-between-devices
- Photos: https://help.realbyteapps.com/hc/en-us/articles/47441540474137-How-to-Backup-Restore-Money-Manager-Photos
- Month/week period: https://help.realbyteapps.com/hc/en-us/articles/360046346554-How-to-customize-monthly-weekly-period
- Start screen: https://help.realbyteapps.com/hc/en-us/articles/7049415557401-How-to-change-the-start-screen-to-Daily-or-Calendar
- Style: https://help.realbyteapps.com/hc/en-us/articles/7318083094169-How-to-set-style
- Release notes 4.13: https://help.realbyteapps.com/hc/en-us/articles/63008416855961-Android-4-13-x-Update-October-2026
- Release notes 4.12: https://help.realbyteapps.com/hc/en-us/articles/58999568169497-Android-4-12-x-Update-June-2026
- Release notes 4.11: https://help.realbyteapps.com/hc/en-us/articles/56943207694361-Android-4-11-x-Update-April-2026
- Release notes 4.10: https://help.realbyteapps.com/hc/en-us/articles/48855415561753-Android-4-10-x-Update-July-2025
- Release notes 4.8: https://help.realbyteapps.com/hc/en-us/articles/18564611917593-Android-4-8-x-Update-June-2023
- Release notes 4.6: https://help.realbyteapps.com/hc/en-us/articles/4411967292441-Android-4-6-0-x-Update-January-2022
- Release notes 4.3: https://help.realbyteapps.com/hc/en-us/articles/360049813374-Android-4-3-x-Update-November-2019
- Release notes 4.0: https://help.realbyteapps.com/hc/en-us/articles/360050549913-Android-4-0-x-Update-October-2018
- Release notes 3.9: https://help.realbyteapps.com/hc/en-us/articles/360049743274-Android-3-9-x-Update-June-2018
- Release notes 3.5: https://help.realbyteapps.com/hc/en-us/articles/360049678574-Android-3-5-x-Update-September-2016

**Wallet (BudgetBakers) help centre**, read through the public Zendesk API at `support.budgetbakers.com/api/v2/help_center/en-us/articles.json`
- SMS Pay Sync (India): https://support.budgetbakers.com/hc/en-us/articles/39631628971666-SMS-Pay-Sync
- Notification Access – India: https://support.budgetbakers.com/hc/en-us/articles/39631752579346-Notification-Access-Permission-India
- Notification Access (Google Pay): https://support.budgetbakers.com/hc/en-us/articles/27357560590098-Notification-Access-Permission
- Google Pay Sync: https://support.budgetbakers.com/hc/en-us/articles/27454807191058-Google-Pay-Sync
- Budgets: https://support.budgetbakers.com/hc/en-us/articles/7076953735314-Setup-Budgets
- Planned Payments: https://support.budgetbakers.com/hc/en-us/articles/7149523920786-Setup-Planned-Payments
- Templates: https://support.budgetbakers.com/hc/en-us/articles/7077050225042-Using-Templates
- Categories: https://support.budgetbakers.com/hc/en-us/articles/7077082048146-All-about-Categories-and-Subcategories
- Labels: https://support.budgetbakers.com/hc/en-us/articles/7076564578066-Utilising-Labels
- Automatic Rules: https://support.budgetbakers.com/hc/en-us/articles/7149319175826-Automatic-Rules
- Record Confirmation: https://support.budgetbakers.com/hc/en-us/articles/9740038391186-Record-Confirmation-Green-check-mark
- Transactions: https://support.budgetbakers.com/hc/en-us/articles/7149271363090-Everything-About-Transactions-Add-edit-clone-split-duplicates
- Duplicates: https://support.budgetbakers.com/hc/en-us/articles/7149205631634-Solve-Duplicate-Transactions
- Statistics: https://support.budgetbakers.com/hc/en-us/articles/31001090941970-Understanding-Your-Wallet-Statistics
- Percentage: https://support.budgetbakers.com/hc/en-us/articles/36546774821778-What-does-the-percentage-next-to-Income-Expenses-mean
- Dashboard cards: https://support.budgetbakers.com/hc/en-us/articles/7150077480850-Add-or-Modify-Dashboard-Cards-Widgets
- Export: https://support.budgetbakers.com/hc/en-us/articles/7151606064018-How-to-export-transactions-from-Wallet
- Initial day of month: https://support.budgetbakers.com/hc/en-us/articles/12212663489298-Setup-Initial-day-of-the-month

**axio**
- Site: https://axio.co.in/
- FAQ: https://axio.co.in/faq
- Privacy policy (checked; no SMS-specific text found in the readable portion): https://axio.co.in/privacy-policy

**Cashew**
- README: https://github.com/jameskokoska/Cashew
- Changelog: https://github.com/jameskokoska/Cashew/blob/main/budget/lib/widgets/showChangelog.dart
- FAQ: https://cashewapp.web.app/faq.html
- Notification scanning: https://cashewapp.web.app/assets/docs/automation/notification-scan.md
- App Links: https://cashewapp.web.app/assets/docs/automation/app-links.md
- Broadcast receiver: https://cashewapp.web.app/assets/docs/automation/broadcast-receiver.md

**Bluecoins**
- Bank notifications guide: https://ram.bluecoinsapp.com/guide/bank-notifications/

**Google Play policy**
- SMS/Call Log permitted uses: https://support.google.com/googleplay/android-developer/answer/10208820
- SMS/Call Log policy: https://support.google.com/googleplay/android-developer/answer/9047303

**Android platform**
- NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- Android 15 behaviour changes (OTP redaction): https://developer.android.com/about/versions/15/behavior-changes-all
- Restricted settings: https://support.google.com/android/answer/12623953
- Android 15 restricted-settings list (CDD), as reported by 9to5Google: https://9to5google.com/2024/09/12/android-15-sideloaded-apps-restrictions/
- Developer verification: https://developer.android.com/developer-verification
- Verification FAQ: https://developer.android.com/developer-verification/guides/faq
- Limited distribution accounts: https://developer.android.com/developer-verification/guides/limited-distribution

**Expo**
- Development builds: https://docs.expo.dev/develop/development-builds/introduction/

**npm packages** (metadata read from registry.npmjs.org)
- transaction-sms-parser: https://www.npmjs.com/package/transaction-sms-parser
- expo-android-notification-listener-service: https://www.npmjs.com/package/expo-android-notification-listener-service
- react-native-android-notification-listener: https://www.npmjs.com/package/react-native-android-notification-listener
- @maniac-tech/react-native-expo-read-sms: https://www.npmjs.com/package/@maniac-tech/react-native-expo-read-sms
- react-native-android-widget: https://www.npmjs.com/package/react-native-android-widget
- expo-quick-actions: https://www.npmjs.com/package/expo-quick-actions
- expo-share-intent: https://www.npmjs.com/package/expo-share-intent

**Weak evidence, used only for "which apps are named"**
- Finny's 2026 India roundup (written by a vendor): https://getfinny.app/blog/best-expense-tracker-apps-india-2026
- Search-result listings from jupiter.money, finart.app and moneyview.in roundups (not opened)
- unitQ scorecard (aggregate score only, no review text): https://unitq.com/unitq-scorecards/moneymanagerfree

**EIO repository** (OBSERVED)
- `app/src/modules/finance/`
- `app/src/modules/subscriptions/api.ts`
- `app/src/core/money.ts`
- `app/src/core/categories.ts`
- `app/package.json`
- `app/eas.json`
- `supabase/migrations/0004_create_finance.sql`
- `supabase/migrations/0008_finance_v2.sql`
