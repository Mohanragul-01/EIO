-- ============================================================================
-- Finance v3: pinned quick-adds and the month-start setting
-- ============================================================================
-- Runs AFTER 0008_finance_v2.sql: quick-adds point at public.accounts, which
-- 0008 creates. Everything else Finance v3 reads (accounts, transfers,
-- budgets) is 0008's.
--
-- Like every migration here it only ADDS: the v2 app may still be running
-- when this is applied, and it reads neither table. Safe to run twice.
-- ============================================================================


-- QUICK-ADDS -------------------------------------------------------------------
-- "Chai ₹20 · Cash": an entry you log so often that it should be one tap. A
-- table rather than a JSON setting, so the website shows the same pins as the
-- phone and each one can be edited or unpinned on its own.
--
-- It is a template, not a transaction: tapping it writes an ordinary row to
-- public.transactions dated today. Deleting a quick-add touches no history.
create table if not exists public.finance_templates (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null,

  -- Doubles as the pill's label and the logged entry's note. Required: a pin
  -- with no words is a button nobody can tell apart from the next one.
  note         text        not null check (length(trim(note)) > 0),
  amount_minor bigint      not null check (amount_minor > 0),
  -- Expense or income only. A transfer moves money you already counted; it is
  -- not something you log by habit at a counter.
  kind         text        not null default 'expense' check (kind in ('expense','income')),
  -- Free text, like transactions.category: the list lives in the app
  -- (core/categories.ts) and grows without a migration.
  category     text        not null check (length(trim(category)) > 0),
  -- Set null, not cascade: closing an account should not take your pins with
  -- it. A pin without an account logs to whichever account you used last.
  account_id   uuid        references public.accounts(id) on delete set null,

  position     integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists finance_templates_user_idx
  on public.finance_templates (user_id, position);


-- SETTINGS ---------------------------------------------------------------------
-- One row per person, created the first time a setting is changed; no row
-- means every default. Synced rather than kept on the phone, because the
-- website's "this month" has to agree with the phone's.
create table if not exists public.finance_settings (
  user_id         uuid primary key,

  -- The day a finance month begins, for a salary that lands on the 25th
  -- rather than the 1st. Up to 31: a start day past a short month's end is
  -- clamped to that month's last day by the app, so the 31st means "the last
  -- day of every month" and the periods stay back to back.
  month_start_day smallint    not null default 1 check (month_start_day between 1 and 31),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- updated_at triggers (function created in migration 0001) --------------------
drop trigger if exists finance_templates_set_updated_at on public.finance_templates;
create trigger finance_templates_set_updated_at before update on public.finance_templates
  for each row execute function public.set_updated_at();

drop trigger if exists finance_settings_set_updated_at on public.finance_settings;
create trigger finance_settings_set_updated_at before update on public.finance_settings
  for each row execute function public.set_updated_at();


-- ROW LEVEL SECURITY ---------------------------------------------------------
-- The same four-policy template as every other table in this app.
do $$
declare t text;
begin
  foreach t in array array['finance_templates','finance_settings']
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
