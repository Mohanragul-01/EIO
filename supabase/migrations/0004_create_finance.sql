-- ============================================================================
-- Phase 3 — transactions + subscriptions
-- ============================================================================
-- Two tables in one migration because they ship together, but they remain
-- fully independent: no foreign key between them, and each module only ever
-- queries its own.
-- ============================================================================


-- ── TRANSACTIONS ───────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null,

  -- Money as an INTEGER count of paise, never a decimal of rupees. See
  -- src/core/money.ts for the full reasoning: floating-point decimals
  -- accumulate rounding errors when summed, integers never do.
  -- bigint, not integer: a 4-byte int caps out around ₹2.1 crore.
  -- Positive only — direction is carried by `kind` below.
  amount_minor  bigint      not null check (amount_minor > 0),

  -- An addition to the plan's sketch, which had only `amount`. Without a
  -- direction flag, "monthly totals by category" can't distinguish money in
  -- from money out. The alternative — negative amounts for income — makes
  -- every query carry a sign convention in your head. An explicit column is
  -- harder to misread.
  kind          text        not null default 'expense'
                            check (kind in ('expense', 'income')),

  category      text        not null check (length(trim(category)) > 0),
  note          text        not null default '',

  -- `date`, not timestamptz: "what day did I spend this" is a calendar day.
  -- Storing an instant would shift entries across midnight by timezone.
  date          date        not null default current_date,

  created_at    timestamptz not null default now()
);

-- The list query is always "this user, this month, newest first".
create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);


-- ── SUBSCRIPTIONS ──────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid        not null,

  name            text        not null check (length(trim(name)) > 0),
  amount_minor    bigint      not null check (amount_minor > 0),

  billing_cycle   text        not null default 'monthly'
                              check (billing_cycle in ('weekly', 'monthly', 'quarterly', 'yearly')),

  next_due_date   date        not null,

  -- Lets you keep a cancelled subscription for reference without it polluting
  -- the upcoming-renewals view or the monthly total.
  is_active       boolean     not null default true,

  note            text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists subscriptions_user_due_idx
  on public.subscriptions (user_id, is_active, next_due_date);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY — the same four-policy template as todos and notes.
-- ============================================================================
alter table public.transactions  enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;

create policy "transactions_select_own" on public.transactions for select
  using (user_id = auth.uid());
create policy "transactions_insert_own" on public.transactions for insert
  with check (user_id = auth.uid());
create policy "transactions_update_own" on public.transactions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "transactions_delete_own" on public.transactions for delete
  using (user_id = auth.uid());

drop policy if exists "subscriptions_select_own" on public.subscriptions;
drop policy if exists "subscriptions_insert_own" on public.subscriptions;
drop policy if exists "subscriptions_update_own" on public.subscriptions;
drop policy if exists "subscriptions_delete_own" on public.subscriptions;

create policy "subscriptions_select_own" on public.subscriptions for select
  using (user_id = auth.uid());
create policy "subscriptions_insert_own" on public.subscriptions for insert
  with check (user_id = auth.uid());
create policy "subscriptions_update_own" on public.subscriptions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "subscriptions_delete_own" on public.subscriptions for delete
  using (user_id = auth.uid());
