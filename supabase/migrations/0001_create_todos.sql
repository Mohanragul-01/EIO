-- ============================================================================
-- Phase 1 — todos table
-- ============================================================================
-- Kept in the repo (rather than only clicked into the dashboard) so the schema
-- is version-controlled and reproducible: if this project is ever rebuilt, the
-- migrations replay in order and produce the same database.
-- ============================================================================

create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),

  -- Owner of the row. Nullable-free and indexed, because every query filters
  -- on it. Today it holds the fixed OWNER_ID from src/core/session.ts; when
  -- auth is switched on it holds auth.uid() and nothing else has to change.
  user_id     uuid        not null,

  title       text        not null check (length(trim(title)) > 0),

  -- `date` not `timestamptz`: a due date is a calendar day, not an instant.
  -- Storing it as a timestamp invites timezone bugs where a task due "today"
  -- shows as yesterday for anyone east of UTC.
  due_date    date,

  is_done     boolean     not null default false,

  -- Constrained to three values at the DATABASE level rather than only in the
  -- app. The database is the last line of defence — app-side validation can be
  -- bypassed by any other client that talks to this table.
  priority    text        not null default 'normal'
                          check (priority in ('low', 'normal', 'high')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index matching the main list query (filter by owner, sort by done + date).
create index if not exists todos_user_id_idx on public.todos (user_id, is_done, due_date);

-- ── updated_at maintenance ─────────────────────────────────────────────────
-- Done in a trigger, not in the app: it then holds no matter which client
-- writes the row, and can't be forgotten at a call site.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- This app currently runs WITHOUT sign-in, so there is no auth.uid() to check
-- against. RLS is therefore DISABLED and the table is reachable by anyone
-- holding the project URL + anon key — both of which ship inside the app
-- bundle. This is a deliberate, accepted trade-off for a personal app.
--
-- TO SECURE IT LATER, add sign-in and run migration 0002:
--
--   alter table public.todos enable row level security;
--
--   create policy "owner can read"   on public.todos
--     for select using (user_id = auth.uid());
--   create policy "owner can insert" on public.todos
--     for insert with check (user_id = auth.uid());
--   create policy "owner can update" on public.todos
--     for update using (user_id = auth.uid()) with check (user_id = auth.uid());
--   create policy "owner can delete" on public.todos
--     for delete using (user_id = auth.uid());
--
-- ...then re-stamp existing rows with your real user id:
--   update public.todos set user_id = '<your-auth-uid>';
-- ============================================================================

alter table public.todos disable row level security;
