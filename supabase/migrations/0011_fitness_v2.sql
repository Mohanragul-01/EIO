-- ============================================================================
-- v2, Fitness: a real training log
-- ============================================================================
-- A clean-slate rebuild. The v1 `workouts` table stored one free-text row per
-- session, which cannot answer "is my bench going up" - the only question a
-- training log exists to answer. It is empty, so it is dropped, not migrated.
--
-- Six tables plus a profile, because a session is genuinely hierarchical: a
-- session has sets, a set belongs to an exercise, and a routine is a template
-- that produces sessions. Flattening that into one table is what made v1
-- useless for anything except counting that you turned up.
-- ============================================================================

drop table if exists public.workouts;

-- PROFILE ---------------------------------------------------------------------
-- One row per user, for what is set once and rarely changes. Height lives here
-- rather than on every weight entry: it is a property of you, not of the
-- measurement, and repeating it per row invites two rows disagreeing.
create table if not exists public.profiles (
  user_id     uuid primary key,
  height_cm   numeric(5,1) check (height_cm is null or height_cm between 50 and 260),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- BODY METRICS ----------------------------------------------------------------
create table if not exists public.body_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  -- A calendar day, like every other date in this app.
  date        date        not null,
  weight_kg   numeric(5,2) not null check (weight_kg > 0 and weight_kg < 500),
  created_at  timestamptz not null default now(),
  -- One weigh-in per day. Weighing twice is normal; keeping both would make the
  -- trend jitter on nothing. Re-entering a day corrects it rather than
  -- duplicating it.
  unique (user_id, date)
);

create index if not exists body_metrics_user_idx on public.body_metrics (user_id, date desc);

-- EXERCISES -------------------------------------------------------------------
-- Per-user rather than a shared reference table. Shared rows would need
-- different RLS from everything else here, and people rename exercises to match
-- their own gym anyway.
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null,
  name          text        not null check (length(trim(name)) > 0),
  muscle_group  text,
  created_at    timestamptz not null default now(),
  -- Two exercises with the same name would split the PR history across them
  -- without that being visible anywhere.
  unique (user_id, name)
);

create index if not exists exercises_user_idx on public.exercises (user_id, muscle_group, name);

-- ROUTINES --------------------------------------------------------------------
-- A template only. It logs nothing itself; it pre-fills a session.
create table if not exists public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  name        text        not null check (length(trim(name)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists routines_user_idx on public.routines (user_id, name);

create table if not exists public.routine_exercises (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid        not null references public.routines(id) on delete cascade,
  exercise_id   uuid        not null references public.exercises(id) on delete cascade,
  -- Denormalised from the parent, matching user_module_fields and user_records.
  -- RLS runs per row, and `user_id = auth.uid()` is a plain comparison; without
  -- this column every policy would need a subquery back to the parent for every
  -- row read.
  user_id       uuid        not null,
  position      integer     not null default 0,
  target_sets   integer     check (target_sets is null or target_sets > 0),
  target_reps   integer     check (target_reps is null or target_reps > 0)
);

create index if not exists routine_exercises_idx on public.routine_exercises (routine_id, position);

-- SESSIONS --------------------------------------------------------------------
create table if not exists public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  date        date        not null default current_date,
  -- Nullable: an ad-hoc session belongs to no routine. ON DELETE SET NULL, not
  -- CASCADE - deleting a routine template must never delete the training you
  -- actually did from it.
  routine_id  uuid        references public.routines(id) on delete set null,
  notes       text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists workout_sessions_user_idx on public.workout_sessions (user_id, date desc);

create table if not exists public.session_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid        not null references public.workout_sessions(id) on delete cascade,
  -- RESTRICT, not CASCADE: deleting an exercise must not silently erase every
  -- set you ever did of it, which is the entire history the PR query reads.
  exercise_id  uuid        not null references public.exercises(id) on delete restrict,
  user_id      uuid        not null,
  set_number   integer     not null check (set_number > 0),
  reps         integer     not null check (reps > 0),
  -- numeric, not integer grams. Unlike money, weights are never accumulated
  -- into a running total that has to reconcile exactly, so the reasoning in
  -- core/money.ts does not apply here.
  weight_kg    numeric(6,2) not null check (weight_kg >= 0),
  rpe          numeric(3,1) check (rpe is null or rpe between 1 and 10),
  created_at   timestamptz not null default now()
);

-- Exactly the PR query: this user, this exercise, this rep count, heaviest
-- first. Without it, every set you log scans the whole history.
create index if not exists session_sets_pr_idx
  on public.session_sets (user_id, exercise_id, reps, weight_kg desc);
create index if not exists session_sets_session_idx
  on public.session_sets (session_id, set_number);

-- updated_at triggers (function from migration 0001) ---------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists routines_set_updated_at on public.routines;
create trigger routines_set_updated_at before update on public.routines
  for each row execute function public.set_updated_at();

drop trigger if exists workout_sessions_set_updated_at on public.workout_sessions;
create trigger workout_sessions_set_updated_at before update on public.workout_sessions
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY ----------------------------------------------------------
-- The same four-policy template as every other table in this app.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','body_metrics','exercises','routines',
    'routine_exercises','workout_sessions','session_sets'
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
