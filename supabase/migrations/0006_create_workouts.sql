-- ============================================================================
-- Phase 4 — workouts table
-- ============================================================================

create table if not exists public.workouts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid        not null,

  -- Calendar day, same reasoning as everywhere else: "I trained on Tuesday"
  -- is a date, not an instant, and storing a timestamp would shift sessions
  -- across midnight depending on timezone.
  date              date        not null default current_date,

  -- Free text rather than an enum, matching the subscriptions.category
  -- decision: the type list lives in the app and is expected to grow. A CHECK
  -- constraint would turn "add Pilates" into a database migration.
  type              text        not null check (length(trim(type)) > 0),

  -- Nullable ON PURPOSE. Duration is genuinely unknown for some sessions —
  -- you logged that you lifted, not for how long. Storing 0 would be a lie
  -- that then pollutes every total and average; NULL means "not recorded" and
  -- SUM/AVG skip it automatically.
  duration_minutes  integer     check (duration_minutes is null or duration_minutes > 0),

  -- Where sets/reps/distance go. The plan called for a free-text field rather
  -- than structured columns, which is right for a log you write in 20 seconds
  -- after training.
  notes             text        not null default '',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- The list query is always "this user, most recent first".
create index if not exists workouts_user_date_idx
  on public.workouts (user_id, date desc);

drop trigger if exists workouts_set_updated_at on public.workouts;
create trigger workouts_set_updated_at
  before update on public.workouts
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY — the same four-policy template as every other table.
-- ============================================================================
alter table public.workouts enable row level security;

drop policy if exists "workouts_select_own" on public.workouts;
drop policy if exists "workouts_insert_own" on public.workouts;
drop policy if exists "workouts_update_own" on public.workouts;
drop policy if exists "workouts_delete_own" on public.workouts;

create policy "workouts_select_own" on public.workouts for select
  using (user_id = auth.uid());
create policy "workouts_insert_own" on public.workouts for insert
  with check (user_id = auth.uid());
create policy "workouts_update_own" on public.workouts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workouts_delete_own" on public.workouts for delete
  using (user_id = auth.uid());
