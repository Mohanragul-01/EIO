-- ============================================================================
-- EIO v2, Finance: accounts, net worth, budgets
-- ============================================================================
-- The v1 module tracked SPENDING (what you did). This adds WEALTH (what you
-- own), which is the FinBoom half, plus the account layer that makes both
-- honest.
--
-- Design decisions this encodes, all confirmed before writing:
--   * INR only. No currency column anywhere. Adding one later is a real
--     migration, but a mechanical one, since every amount is already stored as
--     integer minor units and would simply gain a currency alongside it.
--   * Values are updated BY HAND, FinBoom-style. No price feed, no scheduled
--     job, nothing to silently go stale without you noticing. Every valuation
--     carries the date it was set so stale numbers are visible rather than
--     quietly wrong.
--   * Money stays integer paise throughout, for the reasons in core/money.ts.
-- ============================================================================


-- ACCOUNTS ------------------------------------------------------------------
-- Where money actually sits. Without this, "how much do I have" is
-- unanswerable and transfers between your own accounts look like spending.
create table if not exists public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid        not null,

  name                  text        not null check (length(trim(name)) > 0),
  type                  text        not null default 'bank'
                                    check (type in ('bank','cash','wallet','credit_card')),

  -- The balance before the first transaction you logged. Current balance is
  -- this plus everything since, computed rather than stored: a stored balance
  -- drifts out of sync the moment any write fails halfway.
  opening_balance_minor bigint      not null default 0,

  -- Credit cards are a liability: a positive balance means you OWE it. Kept as
  -- a flag rather than inferred from `type`, so a prepaid card or an overdraft
  -- account can be marked correctly too.
  is_liability          boolean     not null default false,

  is_active             boolean     not null default true,
  note                  text        not null default '',
  position              integer     not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts (user_id, is_active, position);


-- TRANSACTIONS, extended -----------------------------------------------------
alter table public.transactions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- Two rows make a transfer: money out of one account, into another. They share
-- a group id so the pair can be edited or deleted together, and so reports can
-- exclude them. A transfer is NOT spending; counting it as such double-counts
-- every rupee you move between your own accounts.
alter table public.transactions
  add column if not exists transfer_group_id uuid;

-- `kind` gains 'transfer'. Dropping and recreating the constraint is the only
-- way to widen a CHECK.
alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions
  add constraint transactions_kind_check check (kind in ('expense','income','transfer'));

create index if not exists transactions_account_idx
  on public.transactions (user_id, account_id, date desc);
create index if not exists transactions_transfer_idx
  on public.transactions (transfer_group_id) where transfer_group_id is not null;

-- Existing rows predate accounts. Give each user a Cash account and attach
-- their history to it, so nothing is orphaned and totals stay correct. Safe to
-- re-run: it only fires for users who have no account yet.
insert into public.accounts (user_id, name, type, position)
select distinct t.user_id, 'Cash', 'cash', 0
from public.transactions t
where not exists (select 1 from public.accounts a where a.user_id = t.user_id);

update public.transactions t
set account_id = a.id
from public.accounts a
where t.account_id is null
  and a.user_id = t.user_id
  and a.name = 'Cash';


-- ASSETS ---------------------------------------------------------------------
-- One table for every asset class rather than a table each. They share the
-- same lifecycle (own it, value it, sell it) and differ only in which fields
-- apply, so separate tables would mean near-identical CRUD five times over.
create table if not exists public.assets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid        not null,

  name                text        not null check (length(trim(name)) > 0),

  asset_class         text        not null
                      check (asset_class in (
                        'stock','mutual_fund',          -- equity
                        'epf','ppf','nps','ssy',        -- retirement and small savings
                        'fd','gold','sgb','cash_other', -- fixed and commodity
                        'real_estate','other'
                      )),

  -- Units for the classes that have them: shares, MF units, grams of gold.
  -- numeric, not integer: MF units run to three or four decimals, and rounding
  -- them would misstate the holding.
  quantity            numeric(20,4),

  -- What you put in. Kept separate from current value so gain/loss is a fact
  -- rather than something you have to remember.
  invested_minor      bigint      not null default 0 check (invested_minor >= 0),

  -- What it is worth now, as of `valued_on`.
  current_value_minor bigint      not null default 0 check (current_value_minor >= 0),
  valued_on           date        not null default current_date,

  -- For FDs, PPF, NPS and similar. Null where meaningless.
  interest_rate       numeric(6,3),
  maturity_date       date,

  -- Optional link: which account this is held in or funded from.
  account_id          uuid        references public.accounts(id) on delete set null,

  is_active           boolean     not null default true,
  note                text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists assets_user_idx on public.assets (user_id, is_active, asset_class);


-- ASSET VALUATION HISTORY ----------------------------------------------------
-- Every time you update an asset's value, the old figure is kept. This is what
-- makes per-asset growth charts possible; without history you only ever know
-- today, and "how did this do" is unanswerable forever after.
create table if not exists public.asset_valuations (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid        not null references public.assets(id) on delete cascade,
  user_id     uuid        not null,
  value_minor bigint      not null check (value_minor >= 0),
  as_of       date        not null default current_date,
  created_at  timestamptz not null default now(),
  -- One valuation per asset per day. Re-entering a value on the same day
  -- corrects it rather than adding a duplicate point to the chart.
  unique (asset_id, as_of)
);

create index if not exists asset_valuations_idx on public.asset_valuations (asset_id, as_of desc);


-- LIABILITIES ----------------------------------------------------------------
-- Loans and debt. Net worth without these is just a nice number.
create table if not exists public.liabilities (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid        not null,

  name               text        not null check (length(trim(name)) > 0),
  kind               text        not null default 'other'
                     check (kind in ('home','car','personal','education','credit_card','other')),

  principal_minor    bigint      not null default 0 check (principal_minor >= 0),
  outstanding_minor  bigint      not null default 0 check (outstanding_minor >= 0),
  valued_on          date        not null default current_date,

  interest_rate      numeric(6,3),
  emi_minor          bigint      check (emi_minor is null or emi_minor > 0),
  tenure_months      integer     check (tenure_months is null or tenure_months > 0),
  start_date         date,
  next_due_date      date,

  is_active          boolean     not null default true,
  note               text        not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists liabilities_user_idx on public.liabilities (user_id, is_active, next_due_date);


-- NET WORTH SNAPSHOTS --------------------------------------------------------
-- Written whenever you finish a valuation pass. The chart could instead be
-- derived by replaying asset_valuations and account balances for every date,
-- but that query gets expensive fast and produces a jagged line whenever one
-- asset was updated and others were not. A snapshot is one honest reading of
-- everything at one moment.
create table if not exists public.net_worth_snapshots (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null,
  as_of             date        not null default current_date,

  assets_minor      bigint      not null default 0,
  liabilities_minor bigint      not null default 0,
  -- Stored rather than computed, so a snapshot stays a record of what you
  -- believed at the time even if the components are later corrected.
  net_minor         bigint      not null default 0,

  created_at        timestamptz not null default now(),
  unique (user_id, as_of)
);

create index if not exists net_worth_snapshots_idx on public.net_worth_snapshots (user_id, as_of desc);


-- BUDGETS --------------------------------------------------------------------
-- One row per category, not per category per month. A monthly row would mean
-- creating twelve rows a year for a number that rarely changes; instead the
-- amount is the standing limit and the app computes each month against it.
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null,

  category     text        not null check (length(trim(category)) > 0),
  amount_minor bigint      not null check (amount_minor > 0),

  -- Unspent amount carries into next month, and an overspend carries as a
  -- deficit. Per category, because it makes sense for Shopping and not for Rent.
  rollover     boolean     not null default false,

  starts_on    date        not null default date_trunc('month', current_date)::date,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (user_id, category)
);

create index if not exists budgets_user_idx on public.budgets (user_id, is_active);


-- updated_at triggers (function created in migration 0001) --------------------
drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists assets_set_updated_at on public.assets;
create trigger assets_set_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

drop trigger if exists liabilities_set_updated_at on public.liabilities;
create trigger liabilities_set_updated_at before update on public.liabilities
  for each row execute function public.set_updated_at();

drop trigger if exists budgets_set_updated_at on public.budgets;
create trigger budgets_set_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();


-- ROW LEVEL SECURITY ---------------------------------------------------------
-- The same four-policy template as every other table in this app.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','assets','asset_valuations','liabilities','net_worth_snapshots','budgets'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_own" on public.%I', t, t);

    execute format(
      'create policy "%s_select_own" on public.%I for select using (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_delete_own" on public.%I for delete using (user_id = auth.uid())', t, t);
  end loop;
end $$;
