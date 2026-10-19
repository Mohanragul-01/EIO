-- ============================================================================
-- Fitness v3: two modes, honest bodyweight sets, persisted sessions, ladders
-- ============================================================================
-- One migration for everything Fitness v3 reads, so no screen can land before
-- the columns it queries. Like every migration here it ADDS and RELAXES only:
-- the v2 app may still be running when this is applied, so nothing it reads is
-- renamed, dropped or tightened. Safe to run twice.
--
-- THE MODEL IN ONE PARAGRAPH. Gym and Calisthenics are a lens, not two
-- databases: one exercise library, one session log, one record system. How a
-- set is logged is decided by the EXERCISE (its load_mode and tracking_type),
-- never by the mode, so a pull-up logs the same way on a gym day and a
-- calisthenics day. A bodyweight exercise's weight_kg means ADDED load and
-- stays >= 0; assistance (a band, a counterweight) gets its own column. A
-- signed weight would have silently broken every volume and record sum, and
-- the v1 check that weight_kg >= 0.
-- ============================================================================

-- EXERCISES -------------------------------------------------------------------

alter table public.exercises
  add column if not exists discipline text not null default 'gym'
    check (discipline in ('gym', 'calisthenics', 'both'));

-- external: the barbell or dumbbell IS the load. bodyweight: the body is, and
-- weight_kg is what you add to it.
alter table public.exercises
  add column if not exists load_mode text not null default 'external'
    check (load_mode in ('external', 'bodyweight'));

-- The share of bodyweight one rep moves (a push-up is about 0.65). Only used
-- for bodyweight-inclusive volume and estimated maxes, never for records,
-- which compare like with like and need no estimate.
alter table public.exercises
  add column if not exists bodyweight_factor numeric(3,2) not null default 1.00
    check (bodyweight_factor > 0 and bodyweight_factor <= 1.50);

alter table public.exercises
  add column if not exists equipment text
    check (equipment is null or equipment in (
      'none', 'barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'band',
      'pull_up_bar', 'rings', 'dip_bars', 'parallettes', 'other'
    ));

-- Logged per side: a pistol squat or an archer push-up is two numbers, not one.
alter table public.exercises
  add column if not exists is_unilateral boolean not null default false;

-- Remembered per exercise, because a heavy squat and a curl do not want the
-- same rest.
alter table public.exercises
  add column if not exists default_rest_seconds integer
    check (default_rest_seconds is null or default_rest_seconds between 0 and 900);

-- Shown every time the exercise is logged ("seat on 4, grip outside the knurl").
alter table public.exercises
  add column if not exists pinned_note text not null default '';

-- Your own how-to.
alter table public.exercises
  add column if not exists instructions text not null default '';

-- Best guesses for the library you already have. Each update is guarded so a
-- re-run, or an exercise you have since corrected by hand, is left alone: it
-- only touches rows still on the defaults.
update public.exercises
set load_mode = 'bodyweight', discipline = 'both'
where load_mode = 'external'
  and discipline = 'gym'
  and (
    name ~* '\m(pull|chin)[- ]?ups?\M'
    or name ~* '\mdips?\M'
    or name ~* '\mpush[- ]?ups?\M'
    or name ~* '\mmuscle[- ]?ups?\M'
    or name ~* '\mpistol'
    or name ~* '\minverted rows?\M'
    or name ~* '\mhang\M'
    or name ~* '\ml[- ]?sit'
    or name ~* '\mplank'
    or name ~* '\mhandstand'
    or name ~* '\mlever\M'
    or name ~* '\mplanche'
    or name ~* '\mburpees?\M'
    or name ~* '\msit[- ]?ups?\M'
    or name ~* '\mcrunch'
    or name ~* '\m(leg|knee) raises?\M'
    or name ~* '\mbodyweight\M'
  )
  -- A weighted or machine variant is still an external lift.
  and name !~* '\m(machine|assisted machine|cable|smith)\M';

update public.exercises
set bodyweight_factor = 0.65
where bodyweight_factor = 1.00
  and load_mode = 'bodyweight'
  and name ~* '\mpush[- ]?ups?\M'
  and name !~* '\mpike\M';

update public.exercises
set bodyweight_factor = 0.70
where bodyweight_factor = 1.00
  and load_mode = 'bodyweight'
  and name ~* '\mpike push[- ]?ups?\M';

update public.exercises
set equipment = case
  when name ~* '\m(pull|chin)[- ]?ups?\M' or name ~* '\mhang\M' then 'pull_up_bar'
  when name ~* '\mdips?\M' then 'dip_bars'
  when name ~* '\mbarbell\M'
    or name ~* '\m(bench press|deadlift|back squat|front squat|overhead press)\M'
    or name ~* '^\s*squats?\s*$' then 'barbell'
  when name ~* '\m(dumbbell|db)\M' then 'dumbbell'
  when name ~* '\mkettlebell\M' then 'kettlebell'
  when name ~* '\m(cable|pushdown|face pull)\M' then 'cable'
  when name ~* '\mmachine\M' or name ~* '\mleg (press|extension|curl)\M' then 'machine'
  when load_mode = 'bodyweight' then 'none'
  else null
end
where equipment is null;

-- BANDS -----------------------------------------------------------------------
-- Resistance bands are remembered by colour, so a set records WHICH band
-- rather than a guessed kilogram figure. approx_kg is only for estimates.

create table if not exists public.bands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,
  label       text        not null check (length(trim(label)) > 0),
  color       text        not null,
  approx_kg   numeric(5,1) check (approx_kg is null or approx_kg > 0),
  position    integer     not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists bands_user_idx on public.bands (user_id, position);

-- SETS ------------------------------------------------------------------------

-- Warm-ups are excluded from volume and records; a failure set may record 0
-- reps (a failed attempt); a drop set gets no rest before it.
alter table public.session_sets
  add column if not exists set_type text not null default 'normal'
    check (set_type in ('normal', 'warmup', 'failure', 'drop'));

-- Assistance subtracted from bodyweight: a band's approximate kg or a machine
-- counterweight. Positive, like every other weight here.
alter table public.session_sets
  add column if not exists assist_kg numeric(6,2)
    check (assist_kg is null or assist_kg > 0);

alter table public.session_sets
  add column if not exists band_id uuid references public.bands(id) on delete set null;

alter table public.session_sets
  add column if not exists side text check (side is null or side in ('left', 'right'));

-- Whether the set counts toward a ladder level-up. Default true: you mark the
-- ugly ones, not the good ones.
alter table public.session_sets
  add column if not exists clean boolean not null default true;

-- A failed attempt records 0 reps. RELAXES the old "reps > 0" rule (every row
-- the v2 app can write still passes); the reps-xor-seconds rule is untouched.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'session_sets_reps_check') then
    alter table public.session_sets drop constraint session_sets_reps_check;
  end if;
  alter table public.session_sets
    add constraint session_sets_reps_check
    check (reps is null or reps > 0 or (reps = 0 and set_type = 'failure'));
end $$;

-- SESSIONS ----------------------------------------------------------------------

alter table public.workout_sessions
  add column if not exists mode text not null default 'gym'
    check (mode in ('gym', 'calisthenics'));

-- Null for sessions logged before v3; the app falls back to the sets' times.
alter table public.workout_sessions
  add column if not exists started_at timestamptz;

-- Null until Finish is pressed, and Finish is optional: an unfinished session
-- simply ends at its last set.
alter table public.workout_sessions
  add column if not exists ended_at timestamptz;

-- The weigh-in in force when the session started. A snapshot rather than a
-- lookup, so editing an old weigh-in does not rewrite old sessions' volume.
alter table public.workout_sessions
  add column if not exists bodyweight_kg numeric(5,2)
    check (bodyweight_kg is null or (bodyweight_kg > 0 and bodyweight_kg < 500));

-- The exercises IN a session, in order, with their rest, note and superset.
-- Before this, a session's exercise list lived only in screen state and was
-- rebuilt from the sets logged, so an exercise added but not yet logged
-- vanished when the session was reopened, and order, notes and rest had
-- nowhere to live. One block per exercise per session.
create table if not exists public.session_exercises (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid        not null references public.workout_sessions(id) on delete cascade,
  exercise_id     uuid        not null references public.exercises(id) on delete cascade,
  user_id         uuid        not null,
  position        integer     not null default 0,
  rest_seconds    integer     check (rest_seconds is null or rest_seconds between 0 and 900),
  note            text        not null default '',
  superset_group  text,
  created_at      timestamptz not null default now(),
  unique (session_id, exercise_id)
);

create index if not exists session_exercises_session_idx
  on public.session_exercises (session_id, position);

-- One row per exercise already logged in each session, in the order each was
-- first logged. on conflict: a re-run, or a row the app already wrote, wins.
insert into public.session_exercises (session_id, exercise_id, user_id, position)
select session_id, exercise_id, user_id,
       (row_number() over (partition by session_id order by first_logged) - 1)::integer
from (
  select session_id, exercise_id, user_id, min(created_at) as first_logged
  from public.session_sets
  group by session_id, exercise_id, user_id
) firsts
on conflict (session_id, exercise_id) do nothing;

-- ROUTINES ----------------------------------------------------------------------

alter table public.routines
  add column if not exists mode text not null default 'gym'
    check (mode in ('gym', 'calisthenics'));

-- PROGRESSIONS (ladders) --------------------------------------------------------
-- A ladder per skill: "Pull-up: scapular pull -> negative -> pull-up -> +10".
-- Each rung IS an ordinary library exercise, so history, records and charts
-- keep working per variation, and switching variation no longer looks like
-- your reps collapsed. Which rungs are mastered is DERIVED from the moves, not
-- stored, so it can never disagree with them.

create table if not exists public.progressions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid        not null,
  name             text        not null check (length(trim(name)) > 0),
  family           text        not null default 'other'
    check (family in ('push', 'pull', 'legs', 'core', 'balance', 'statics', 'other')),
  current_step_id  uuid,
  position         integer     not null default 0,
  -- How many recent sessions must meet the rung's goal before "Ready to move
  -- up?" appears: two of the last three (the default), or just one.
  level_up_rule    text        not null default 'two_of_three'
    check (level_up_rule in ('two_of_three', 'one')),
  paused_at        timestamptz,
  notes            text        not null default '',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists progressions_user_idx on public.progressions (user_id, family, position);

drop trigger if exists progressions_set_updated_at on public.progressions;
create trigger progressions_set_updated_at before update on public.progressions
  for each row execute function public.set_updated_at();

create table if not exists public.progression_steps (
  id              uuid primary key default gen_random_uuid(),
  progression_id  uuid        not null references public.progressions(id) on delete cascade,
  user_id         uuid        not null,
  -- restrict: a rung's exercise cannot be deleted out from under the ladder.
  exercise_id     uuid        not null references public.exercises(id) on delete restrict,
  position        integer     not null default 0,
  -- The graduation target: goal_sets sets of goal_reps reps OR goal_seconds
  -- seconds, optionally with added weight.
  goal_sets       integer     not null default 3 check (goal_sets > 0),
  goal_reps       integer     check (goal_reps is null or goal_reps > 0),
  goal_seconds    integer     check (goal_seconds is null or goal_seconds > 0),
  goal_added_kg   numeric(5,2) check (goal_added_kg is null or goal_added_kg > 0),
  -- Where you restart on this rung right after moving up to it.
  start_reps      integer     check (start_reps is null or start_reps > 0),
  start_seconds   integer     check (start_seconds is null or start_seconds > 0),
  -- One line on what a clean rep looks like here.
  cue             text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists progression_steps_idx
  on public.progression_steps (progression_id, position);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'progression_steps_goal_xor') then
    alter table public.progression_steps
      add constraint progression_steps_goal_xor
      check (num_nonnulls(goal_reps, goal_seconds) = 1);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'progressions_current_step_fk') then
    alter table public.progressions
      add constraint progressions_current_step_fk
      foreign key (current_step_id) references public.progression_steps(id) on delete set null;
  end if;
end $$;

-- Every move up or back, with the session that earned it. The ladder's
-- history, and the source of every "mastered on" date.
create table if not exists public.progression_moves (
  id              uuid primary key default gen_random_uuid(),
  progression_id  uuid        not null references public.progressions(id) on delete cascade,
  user_id         uuid        not null,
  from_step_id    uuid        references public.progression_steps(id) on delete set null,
  to_step_id      uuid        not null references public.progression_steps(id) on delete cascade,
  kind            text        not null check (kind in ('start', 'up', 'back')),
  date            date        not null default current_date,
  session_id      uuid        references public.workout_sessions(id) on delete set null,
  note            text        not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists progression_moves_idx
  on public.progression_moves (progression_id, date, created_at);

-- ROUTINE SLOTS -------------------------------------------------------------------
-- A slot is a fixed exercise OR a ladder; a ladder slot resolves to the
-- ladder's current rung when a session starts, so a routine written once
-- never needs editing as you progress. Making exercise_id nullable RELAXES it;
-- the v2 app only ever writes exercise slots.

alter table public.routine_exercises alter column exercise_id drop not null;

alter table public.routine_exercises
  add column if not exists progression_id uuid references public.progressions(id) on delete cascade;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'routine_exercises_slot_xor') then
    alter table public.routine_exercises
      add constraint routine_exercises_slot_xor
      check (num_nonnulls(exercise_id, progression_id) = 1);
  end if;
end $$;

-- Targets become ranges: the existing target_reps is the top of the range.
alter table public.routine_exercises
  add column if not exists target_reps_min integer
    check (target_reps_min is null or target_reps_min > 0);
alter table public.routine_exercises
  add column if not exists target_seconds_min integer
    check (target_seconds_min is null or target_seconds_min > 0);
alter table public.routine_exercises
  add column if not exists target_seconds_max integer
    check (target_seconds_max is null or target_seconds_max > 0);
alter table public.routine_exercises
  add column if not exists rest_seconds integer
    check (rest_seconds is null or rest_seconds between 0 and 900);
-- Slots sharing a letter alternate as a superset.
alter table public.routine_exercises
  add column if not exists pair_group text;
-- How much to add when every set hits the top of the range (double progression).
alter table public.routine_exercises
  add column if not exists increment_kg numeric(4,2)
    check (increment_kg is null or increment_kg > 0);

-- BODY MEASUREMENTS -------------------------------------------------------------
-- One row per date, a column per site. Wide rather than one row per site and
-- date, because you measure several sites at once and read them together, and
-- a fixed set of columns lets the database check each value.

create table if not exists public.body_measurements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null,
  date           date        not null,
  neck           numeric(5,1) check (neck is null or (neck > 0 and neck < 300)),
  shoulders      numeric(5,1) check (shoulders is null or (shoulders > 0 and shoulders < 300)),
  chest          numeric(5,1) check (chest is null or (chest > 0 and chest < 300)),
  waist          numeric(5,1) check (waist is null or (waist > 0 and waist < 300)),
  hips           numeric(5,1) check (hips is null or (hips > 0 and hips < 300)),
  arm_left       numeric(5,1) check (arm_left is null or (arm_left > 0 and arm_left < 300)),
  arm_right      numeric(5,1) check (arm_right is null or (arm_right > 0 and arm_right < 300)),
  forearm_left   numeric(5,1) check (forearm_left is null or (forearm_left > 0 and forearm_left < 300)),
  forearm_right  numeric(5,1) check (forearm_right is null or (forearm_right > 0 and forearm_right < 300)),
  thigh_left     numeric(5,1) check (thigh_left is null or (thigh_left > 0 and thigh_left < 300)),
  thigh_right    numeric(5,1) check (thigh_right is null or (thigh_right > 0 and thigh_right < 300)),
  calf_left      numeric(5,1) check (calf_left is null or (calf_left > 0 and calf_left < 300)),
  calf_right     numeric(5,1) check (calf_right is null or (calf_right > 0 and calf_right < 300)),
  body_fat_pct   numeric(4,1) check (body_fat_pct is null or (body_fat_pct > 0 and body_fat_pct < 75)),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists body_measurements_user_idx
  on public.body_measurements (user_id, date desc);

drop trigger if exists body_measurements_set_updated_at on public.body_measurements;
create trigger body_measurements_set_updated_at before update on public.body_measurements
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY ------------------------------------------------------------
-- The same four policies as every other table: you see, add, change and
-- delete only your own rows, and an update can neither reach nor produce
-- another person's row (using AND with check).

do $$
declare t text;
begin
  foreach t in array array[
    'bands', 'session_exercises', 'progressions', 'progression_steps',
    'progression_moves', 'body_measurements'
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
