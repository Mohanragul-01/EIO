-- ============================================================================
-- B-List v3: remember it, choose it, plan it
-- ============================================================================
-- The list arrived as 818 rows with a tick and a date. v3 gives a done item a
-- memory, gives the undone ones a want-level and a plan, and lets a daily pick
-- skip what you said "not now" to. Everything here ADDS: the v2 app may still
-- be installed when this runs, so nothing it reads is renamed, dropped or
-- tightened. Safe to run twice.
--
-- Needs 0001 (set_updated_at) and 0015 (bucket_items). Run before the v3 app.
-- ============================================================================

-- MEMORY ----------------------------------------------------------------------
-- All optional, all written after the tick rather than before it: ticking
-- stays one tap, and remembering is offered, never required.

-- What happened, in your own words.
alter table public.bucket_items
  add column if not exists memory text not null default '';

-- Where. Free text: a place name is enough, and a map is a later job.
alter table public.bucket_items
  add column if not exists place text not null default '';

-- Would you do it again? Null until you say.
alter table public.bucket_items
  add column if not exists again text
    check (again is null or again in ('yes', 'maybe', 'no'));

-- HOW PRECISELY done_on IS KNOWN. Every one of the 818 rows came in undone, so
-- things done years ago get backdated - and "sometime in 2019" stored as a
-- bare date would later read as 1 January 2019, a precision nobody claimed.
-- Null means 'day', which is what every tick before this migration was.
--
-- Deliberately NOT tied to done_on by a check: the v2 app unticks by nulling
-- done_on alone, and a paired constraint would make that update fail.
alter table public.bucket_items
  add column if not exists done_precision text
    check (done_precision is null or done_precision in ('year', 'month', 'day'));

-- Instead, clearing the date clears its precision. Without this, an item
-- backdated to "2019" by v3, then unticked and re-ticked in the v2 app, would
-- keep 'year' beside v2's new date and read as "sometime in" this year. v2
-- must untick before it can re-tick, so clearing on the untick is enough, and
-- nothing that sets a date (v2's tick, v3's backdating) is touched.
create or replace function public.bucket_items_clear_done_precision()
returns trigger
language plpgsql
as $$
begin
  if new.done_on is null then
    new.done_precision := null;
  end if;
  return new;
end;
$$;

drop trigger if exists bucket_items_clear_done_precision on public.bucket_items;
create trigger bucket_items_clear_done_precision
  before insert or update on public.bucket_items
  for each row execute function public.bucket_items_clear_done_precision();

-- PICK FOR ME -------------------------------------------------------------------

-- "Not now": the daily pick skips the item until this day has passed. The item
-- stays on the list; only the suggestion is snoozed.
alter table public.bucket_items
  add column if not exists snoozed_until date;

-- THE NOW SHELF -----------------------------------------------------------------
-- How much you want it NOW, kept apart from cost on purpose: cost answers "can
-- I afford it", this answers "am I actually going to do it". Null is Someday,
-- which is where all 818 start. The cap of five on 'now' is enforced by the
-- clients' shared rule rather than a trigger.
alter table public.bucket_items
  add column if not exists focus text
    check (focus is null or focus in ('now', 'next'));

create index if not exists bucket_items_focus_idx
  on public.bucket_items (user_id, focus)
  where focus is not null;

-- THE PLAN ----------------------------------------------------------------------
-- A target with honest precision: "2027", "March 2027" or "14 March 2027" are
-- three different promises. A year target is stored as 1 January with
-- precision 'year', a month as its 1st with 'month'.
alter table public.bucket_items
  add column if not exists target_on date;

alter table public.bucket_items
  add column if not exists target_precision text
    check (target_precision is null or target_precision in ('year', 'month', 'day'));

-- A date without a precision cannot be displayed honestly, and a precision
-- without a date means nothing. The v2 app never writes either column.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bucket_items_target_pair'
  ) then
    alter table public.bucket_items
      add constraint bucket_items_target_pair
      check ((target_on is null) = (target_precision is null));
  end if;
end $$;

-- Money in integer paise, like every amount in this app.
alter table public.bucket_items
  add column if not exists est_cost_minor bigint
    check (est_cost_minor is null or est_cost_minor >= 0);

alter table public.bucket_items
  add column if not exists saved_minor bigint not null default 0
    check (saved_minor >= 0);

-- STEPS -----------------------------------------------------------------------
-- A checklist under a planned item. Deleting the item deletes its steps; the
-- clients say so before they delete.
create table if not exists public.bucket_steps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  item_id     uuid        not null references public.bucket_items(id) on delete cascade,
  title       text        not null check (length(trim(title)) > 0),
  is_done     boolean     not null default false,
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Exactly the read the item sheet does: this item's steps, in order.
create index if not exists bucket_steps_item_idx
  on public.bucket_steps (item_id, position);

-- The list screen loads every step of the owner's in one request.
create index if not exists bucket_steps_user_idx
  on public.bucket_steps (user_id);

drop trigger if exists bucket_steps_set_updated_at on public.bucket_steps;
create trigger bucket_steps_set_updated_at before update on public.bucket_steps
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY ----------------------------------------------------------
-- The same four-policy template as every other table in this app, with one
-- addition on the writes: the step's item must be yours too. A foreign key
-- is checked without RLS, so user_id alone would let anyone who learned an
-- item id hang steps off someone else's item.
do $$
begin
  execute 'alter table public.bucket_steps enable row level security';

  execute 'drop policy if exists "bucket_steps_select_own" on public.bucket_steps';
  execute 'drop policy if exists "bucket_steps_insert_own" on public.bucket_steps';
  execute 'drop policy if exists "bucket_steps_update_own" on public.bucket_steps';
  execute 'drop policy if exists "bucket_steps_delete_own" on public.bucket_steps';

  execute 'create policy "bucket_steps_select_own" on public.bucket_steps
    for select using (user_id = auth.uid())';
  execute 'create policy "bucket_steps_insert_own" on public.bucket_steps
    for insert with check (
      user_id = auth.uid()
      and exists (
        select 1 from public.bucket_items i
        where i.id = bucket_steps.item_id and i.user_id = auth.uid()
      )
    )';
  execute 'create policy "bucket_steps_update_own" on public.bucket_steps
    for update using (user_id = auth.uid()) with check (
      user_id = auth.uid()
      and exists (
        select 1 from public.bucket_items i
        where i.id = bucket_steps.item_id and i.user_id = auth.uid()
      )
    )';
  execute 'create policy "bucket_steps_delete_own" on public.bucket_steps
    for delete using (user_id = auth.uid())';
end $$;
