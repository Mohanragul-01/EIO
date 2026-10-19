-- ============================================================================
-- Subscriptions v3: lifecycle, trials, flexible cycles, currency, charged-to,
-- reminder choices, price history
-- ============================================================================
-- Runs AFTER 0008_finance_v2.sql: `account_id` references public.accounts,
-- which 0008 creates.
--
-- Like every migration here it ADDS only. The v2 app may still be running when
-- this is applied, so nothing it reads is renamed, dropped or tightened:
-- `is_active` and `billing_cycle` stay, and the v3 app keeps writing both (see
-- the notes beside each). Safe to run twice.
-- ============================================================================


-- LIFECYCLE ------------------------------------------------------------------
-- v2 had one flag, is_active, which cannot say "cancelled, but paid up until
-- the 30th" - exactly when a renewal reminder must NOT fire - or "a free trial
-- that charges on the 4th unless I cancel".
--
-- The STORED status is what you chose; the app derives what it means today
-- (a pause past its resume date is active again, a cancellation past its
-- access date has ended). Nothing runs in the background to flip a stored
-- value on the day, so storing the derived state would go stale.
alter table public.subscriptions
  add column if not exists status text not null default 'active'
    check (status in ('active', 'trial', 'paused', 'cancelled', 'archived'));

-- Existing inactive rows. v2's phone labels them "Cancelled · Not billing", so
-- that is what they become: cancelled with no access date, which reads as
-- ended. Guarded on status = 'active' so a re-run cannot undo a choice made
-- since: the v3 app writes is_active = true for every active row.
update public.subscriptions
set status = 'cancelled'
where is_active = false
  and status = 'active';

-- Trial: the day it ends, which is also the first charge if you keep it. The
-- price after the trial is the ordinary amount_minor.
alter table public.subscriptions
  add column if not exists trial_ends_on date;

-- Cancelled: the last day you still have access. Counts in totals until then.
alter table public.subscriptions
  add column if not exists ends_on date;

-- Paused: the day it starts charging again, if you know it.
alter table public.subscriptions
  add column if not exists resume_on date;

-- How to cancel: a link to the service's own page, and your own notes
-- ("Cancel from the Play Store, not the app").
alter table public.subscriptions
  add column if not exists cancel_url text;

alter table public.subscriptions
  add column if not exists cancel_notes text not null default '';


-- IDENTITY -------------------------------------------------------------------
-- Which catalogue entry it came from, and the brand colour its tile is drawn
-- in. The catalogue lives in the app; the key only lets a row find its entry
-- again (for the manage link), so it is not a foreign key.
alter table public.subscriptions
  add column if not exists service_key text;

-- '#RRGGBB'. Checked, because the app computes text contrast from it.
alter table public.subscriptions
  add column if not exists color text
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');


-- CHARGED TO -----------------------------------------------------------------
-- The Finance account the money leaves (0008), so Mark paid logs against it
-- and its balance stays true. A deleted account leaves the subscription with
-- no account rather than deleting it.
alter table public.subscriptions
  add column if not exists account_id uuid references public.accounts(id) on delete set null;

-- How it is billed: card, upi_autopay, google_play, apple, netbanking, wallet,
-- manual. No CHECK: the list lives in the app and will grow (Amazon Pay,
-- PayPal), and a constraint would make each addition a migration - the same
-- call 0005 made for categories.
alter table public.subscriptions
  add column if not exists charge_channel text;

create index if not exists subscriptions_account_idx
  on public.subscriptions (user_id, account_id) where account_id is not null;


-- REMINDERS ------------------------------------------------------------------
-- Days before the due date, for THIS subscription. Null means "use my
-- defaults" (subscription_settings below); an empty array means "no reminders
-- for this one". 0 is the morning of.
alter table public.subscriptions
  add column if not exists reminder_offsets smallint[]
    check (
      reminder_offsets is null
      or (0 <= all (reminder_offsets) and 60 >= all (reminder_offsets))
    );


-- CYCLES ---------------------------------------------------------------------
-- Every N days, weeks, months or years, or once. Indian prepaid mobile and DTH
-- packs run 28, 56 or 84 days; modelled as "monthly" they drift by days within
-- a few renewals.
--
-- NULLABLE, with no default, on purpose. The app reads these and falls back to
-- billing_cycle when they are null. A default would be worse than nothing: a
-- v2 app still adding a WEEKLY subscription after this has run writes only
-- billing_cycle, and a default of (month, 1) would silently make it monthly.
alter table public.subscriptions
  add column if not exists cycle_unit text
    check (cycle_unit is null or cycle_unit in ('day', 'week', 'month', 'year', 'once'));

alter table public.subscriptions
  add column if not exists cycle_count smallint
    check (cycle_count is null or cycle_count between 1 and 366);

-- Existing rows, from the four v2 cycles. Only rows not yet converted, so a
-- re-run (or a row edited by v3 since) is left alone.
update public.subscriptions
set cycle_unit = case billing_cycle
                   when 'weekly' then 'week'
                   when 'yearly' then 'year'
                   else 'month'
                 end,
    cycle_count = case billing_cycle when 'quarterly' then 3 else 1 end
where cycle_unit is null;

-- billing_cycle itself stays NOT NULL with its four values: v2 reads it. The
-- v3 app writes the nearest of the four alongside the real cycle (84 days is
-- "quarterly"), which is close enough for an app that is going away.


-- CURRENCY -------------------------------------------------------------------
-- amount_minor is in THIS currency's minor units (cents for USD). Totals
-- convert with a rate you set by hand - Finance's "no price feed" principle
-- from 0008 - and fx_rate_on says how old it is. Mark paid always logs the
-- rupees actually charged, so Finance stays INR.
alter table public.subscriptions
  add column if not exists currency text not null default 'INR'
    check (currency ~ '^[A-Z]{3}$');

-- Rupees per one unit of `currency` (86.5 for USD). numeric, not a float:
-- it multiplies money.
alter table public.subscriptions
  add column if not exists fx_rate numeric(12,4)
    check (fx_rate is null or fx_rate > 0);

alter table public.subscriptions
  add column if not exists fx_rate_on date;

create index if not exists subscriptions_user_status_idx
  on public.subscriptions (user_id, status, next_due_date);


-- THE LEDGER LINK -------------------------------------------------------------
-- Which subscription a payment was for. This is what makes "Payments" on a
-- subscription, the calendar's paid days and the "paid so far" half of
-- insights possible. A deleted subscription leaves its payments in Finance,
-- unlinked: they were real money.
alter table public.transactions
  add column if not exists subscription_id uuid
    references public.subscriptions(id) on delete set null;

create index if not exists transactions_subscription_idx
  on public.transactions (user_id, subscription_id, date desc)
  where subscription_id is not null;


-- PRICE HISTORY ---------------------------------------------------------------
-- One row per price change, written when you edit the amount or confirm a new
-- price while marking a payment. Stealth rises are how a fixed budget creeps,
-- and the current amount alone cannot show one.
--
-- Deleted with its subscription (the app says so before deleting).
create table if not exists public.subscription_price_changes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null,
  subscription_id   uuid        not null references public.subscriptions(id) on delete cascade,

  old_amount_minor  bigint      not null check (old_amount_minor > 0),
  new_amount_minor  bigint      not null check (new_amount_minor > 0),
  -- The currency both amounts are in, recorded rather than read through the
  -- subscription, so changing its currency later does not reinterpret history.
  currency          text        not null default 'INR' check (currency ~ '^[A-Z]{3}$'),

  effective_on      date        not null default current_date,
  created_at        timestamptz not null default now(),

  check (old_amount_minor <> new_amount_minor)
);

create index if not exists subscription_price_changes_idx
  on public.subscription_price_changes (user_id, subscription_id, effective_on desc);


-- REMINDER DEFAULTS -----------------------------------------------------------
-- One row per person: the offsets every subscription uses unless it has its
-- own, and the time of day they fire. In the database rather than on the phone
-- so a reinstall keeps them - the launch resync rebuilds every reminder from
-- here, which is the whole point of having one.
create table if not exists public.subscription_settings (
  user_id           uuid        primary key,
  reminder_offsets  smallint[]  not null default '{3,1}'
    check (0 <= all (reminder_offsets) and 60 >= all (reminder_offsets)),
  -- Minutes after midnight, local time on the phone. 540 = 09:00.
  reminder_minutes  smallint    not null default 540
    check (reminder_minutes between 0 and 1439),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists subscription_settings_set_updated_at on public.subscription_settings;
create trigger subscription_settings_set_updated_at
  before update on public.subscription_settings
  for each row execute function public.set_updated_at();


-- ROW LEVEL SECURITY ---------------------------------------------------------
-- The same four-policy template as every other table in this app. UPDATE has
-- both USING and WITH CHECK, so a row cannot be handed to someone else.
do $$
declare t text;
begin
  foreach t in array array['subscription_price_changes', 'subscription_settings']
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
