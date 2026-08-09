-- ============================================================================
-- Phase 2 — notes table
-- ============================================================================
-- Same shape as todos, same four RLS policies. That repetition is intentional:
-- every module owns its own table with identical ownership rules, so no module
-- can accidentally widen access for another.
-- ============================================================================

create table if not exists public.notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,

  title       text        not null check (length(trim(title)) > 0),

  -- Body is optional: a note is often just a title ("call the plumber").
  -- Defaulting to '' rather than allowing null means the app never has to
  -- handle two kinds of "empty".
  body        text        not null default '',

  -- A Postgres ARRAY column rather than a separate tags table.
  -- Justification: tags here are free-text labels with no properties of their
  -- own, we only ever filter by containment, and this is a single-user app.
  -- A join table would be the right call if tags needed renaming across notes
  -- or had their own colors/ordering.
  tags        text[]      not null default '{}',

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Main list query: this user's notes, newest-edited first.
create index if not exists notes_user_id_idx on public.notes (user_id, updated_at desc);

-- GIN is the index type for array containment ("notes tagged 'work'").
-- A normal B-tree can't answer that; it only indexes the array as a whole.
create index if not exists notes_tags_idx on public.notes using gin (tags);

-- Reuses the set_updated_at() function created in migration 0001.
-- For notes this matters more than for todos: the list is SORTED by
-- updated_at, so the trigger is what keeps recently-edited notes on top.
drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — identical policy set to todos.
-- ============================================================================
alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
drop policy if exists "notes_insert_own" on public.notes;
drop policy if exists "notes_update_own" on public.notes;
drop policy if exists "notes_delete_own" on public.notes;

create policy "notes_select_own"
  on public.notes for select
  using (user_id = auth.uid());

create policy "notes_insert_own"
  on public.notes for insert
  with check (user_id = auth.uid());

create policy "notes_update_own"
  on public.notes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notes_delete_own"
  on public.notes for delete
  using (user_id = auth.uid());
