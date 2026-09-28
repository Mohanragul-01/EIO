-- ============================================================================
-- B-List: the bucket list
-- ============================================================================
-- 818 items in 61 categories, imported from the standalone page that held them
-- in localStorage. Moving them here is the point of the exercise: a list kept
-- in one browser is a list you cannot tick off from your phone, and losing that
-- browser's site data loses years of it.
--
-- COST, NOT IMPORTANCE. The original sorted low-to-high "by what it costs to
-- actually do it", and the three tiers were labelled NO/LOW COST, MODERATE and
-- BIG INVESTMENT. Preserved as low / moderate / high, because that is the
-- question the list is organised around: what can I do this weekend for
-- nothing, versus what needs saving for.
--
-- SEEDED PER USER, by cross joining auth.users. This app has one user, and
-- hardcoding their uuid into a migration would be both ugly and wrong for
-- anyone else who ever runs it. New accounts start empty rather than
-- inheriting someone else's bucket list, which is the correct default for a
-- list this personal.
-- ============================================================================

create table if not exists public.bucket_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null,
  category     text        not null,
  title        text        not null check (length(trim(title)) > 0),
  -- What it costs to do, not how much you want it.
  cost         text        not null default 'moderate'
                 check (cost in ('low', 'moderate', 'high')),
  is_done      boolean     not null default false,
  -- The day you did it. Null while undone; set when ticked, so the list can
  -- answer "what did I actually do this year" rather than only "how many".
  done_on      date,
  note         text        not null default '',
  -- Keeps the original order within a category, which was itself meaningful:
  -- the source list was sorted cheapest-first.
  position     integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- The same thing twice in one category is a duplicate, not two goals.
  unique (user_id, category, title)
);

create index if not exists bucket_items_user_idx
  on public.bucket_items (user_id, category, position);

-- Answers the two headline figures - how many done, and how many of each cost
-- tier are left - without scanning the whole list.
create index if not exists bucket_items_progress_idx
  on public.bucket_items (user_id, is_done, cost);

drop trigger if exists bucket_items_set_updated_at on public.bucket_items;
create trigger bucket_items_set_updated_at before update on public.bucket_items
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY ----------------------------------------------------------
-- The same four-policy template as every other table in this app.
do $$
begin
  execute 'alter table public.bucket_items enable row level security';

  execute 'drop policy if exists "bucket_items_select_own" on public.bucket_items';
  execute 'drop policy if exists "bucket_items_insert_own" on public.bucket_items';
  execute 'drop policy if exists "bucket_items_update_own" on public.bucket_items';
  execute 'drop policy if exists "bucket_items_delete_own" on public.bucket_items';

  execute 'create policy "bucket_items_select_own" on public.bucket_items
    for select using (user_id = auth.uid())';
  execute 'create policy "bucket_items_insert_own" on public.bucket_items
    for insert with check (user_id = auth.uid())';
  execute 'create policy "bucket_items_update_own" on public.bucket_items
    for update using (user_id = auth.uid()) with check (user_id = auth.uid())';
  execute 'create policy "bucket_items_delete_own" on public.bucket_items
    for delete using (user_id = auth.uid())';
end $$;

-- THE LIST --------------------------------------------------------------------
-- The 818 items live in five separate files, 0015a through 0015e, so that no
-- single statement is large enough for a browser SQL editor to mangle. Run
-- them after this one.
