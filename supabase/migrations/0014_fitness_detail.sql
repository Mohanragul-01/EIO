-- ============================================================================
-- Fitness: specific muscles, and exercises measured in time
-- ============================================================================
-- Two changes that the training log needed before it could describe a real
-- session.
--
-- MUSCLE GROUPS WERE TOO COARSE TO BE USEFUL. Eight values - Chest, Back,
-- Legs, Shoulders, Arms, Core, Cardio, Other - meant "Arms" covered a barbell
-- curl, a skullcrusher and a wrist curl, which are three different muscles you
-- would never train interchangeably. The replacement is 22 specific muscles,
-- each belonging to one of the seven regions, so browsing stays a tab per
-- region while a tag actually says what it trains.
--
-- `muscle_group` is free text, so this is a DATA remap and not a schema change.
-- Exercises are matched by name first and fall back to their region's most
-- common muscle, because "Arms" alone cannot tell you which arm muscle it was.
-- That fallback is a guess and is meant to be corrected by hand - which is why
-- renaming an exercise is now possible in both clients.
--
-- SOME EXERCISES ARE HELD, NOT REPEATED. A plank, a dead hang and a wall sit
-- are measured in seconds, and `session_sets.reps` was `not null check (reps >
-- 0)`, so a timed hold was literally unstorable. Rather than pretend one rep
-- means one hold, sets now carry EITHER reps OR a duration, enforced by a check
-- so a row can never claim both or neither.
-- ============================================================================

-- HOW AN EXERCISE IS MEASURED -------------------------------------------------
-- On the exercise, not the set: it is a property of the movement. A plank is
-- always timed, and the logging screen reads this to decide whether to ask for
-- reps or for seconds.
alter table public.exercises
  add column if not exists tracking_type text not null default 'reps'
    check (tracking_type in ('reps', 'time'));

-- TIMED SETS ------------------------------------------------------------------
alter table public.session_sets
  add column if not exists duration_seconds integer
    check (duration_seconds is null or duration_seconds > 0);

-- reps has to become nullable before a timed set can exist at all.
alter table public.session_sets
  alter column reps drop not null;

-- Exactly one of the two, always. Without this a row could carry both - which
-- of them is the set then? - or neither, which is not a set.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'session_sets_reps_xor_duration'
  ) then
    alter table public.session_sets
      add constraint session_sets_reps_xor_duration
      check (num_nonnulls(reps, duration_seconds) = 1);
  end if;
end $$;

-- The old positive-reps check now has to tolerate a null.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'session_sets_reps_check') then
    alter table public.session_sets drop constraint session_sets_reps_check;
  end if;
end $$;

alter table public.session_sets
  add constraint session_sets_reps_check check (reps is null or reps > 0);

-- REMAP THE MUSCLE GROUPS -----------------------------------------------------
-- By name where the exercise is recognisable, so the six seeded defaults and
-- the most common additions land on the right muscle rather than on their
-- region's fallback.
update public.exercises set muscle_group = case
  -- Chest
  when name ilike '%incline%press%'    or name ilike '%incline%fly%'    then 'Upper chest'
  when name ilike '%decline%press%'    or name ilike '%dip%'            then 'Lower chest'
  when name ilike '%bench press%'      or name ilike '%chest%'
    or name ilike '%push%up%'          or name ilike '%fly%'            then 'Mid chest'

  -- Back
  when name ilike '%pull-up%' or name ilike '%pull up%' or name ilike '%pullup%'
    or name ilike '%lat%'     or name ilike '%pulldown%'                then 'Lats'
  when name ilike '%shrug%'                                             then 'Traps'
  when name ilike '%row%'                                               then 'Rhomboids'
  when name ilike '%deadlift%' or name ilike '%back extension%'
    or name ilike '%good morning%'                                      then 'Lower back'

  -- Shoulders
  when name ilike '%rear delt%' or name ilike '%reverse fly%'
    or name ilike '%face pull%'                                         then 'Rear delts'
  when name ilike '%lateral raise%' or name ilike '%side raise%'        then 'Side delts'
  when name ilike '%overhead press%' or name ilike '%shoulder press%'
    or name ilike '%front raise%'    or name ilike '%arnold%'           then 'Front delts'

  -- Arms
  when name ilike '%curl%' and name not ilike '%leg%' and name not ilike '%wrist%'
    and name not ilike '%hamstring%'                                    then 'Biceps'
  when name ilike '%tricep%' or name ilike '%skullcrusher%'
    or name ilike '%pushdown%' or name ilike '%kickback%'               then 'Triceps'
  when name ilike '%wrist%' or name ilike '%grip%' or name ilike '%forearm%' then 'Forearms'

  -- Legs
  when name ilike '%squat%' or name ilike '%leg press%'
    or name ilike '%lunge%' or name ilike '%leg extension%'             then 'Quads'
  when name ilike '%leg curl%' or name ilike '%hamstring%'
    or name ilike '%romanian%' or name ilike '%rdl%'                    then 'Hamstrings'
  when name ilike '%hip thrust%' or name ilike '%glute%'                then 'Glutes'
  when name ilike '%calf%'                                              then 'Calves'
  when name ilike '%adduct%' or name ilike '%abduct%'                   then 'Adductors'

  -- Core
  when name ilike '%oblique%' or name ilike '%russian twist%'
    or name ilike '%side bend%'                                         then 'Obliques'
  when name ilike '%leg raise%' or name ilike '%knee raise%'            then 'Lower abs'
  when name ilike '%crunch%' or name ilike '%sit-up%' or name ilike '%sit up%'
    or name ilike '%plank%'   or name ilike '%ab %'                     then 'Abs'

  -- Region fallbacks, for anything the names above did not recognise. A guess,
  -- and meant to be corrected by hand - which is why both clients can now
  -- rename an exercise.
  when muscle_group = 'Chest'     then 'Mid chest'
  when muscle_group = 'Back'      then 'Lats'
  when muscle_group = 'Shoulders' then 'Side delts'
  when muscle_group = 'Arms'      then 'Biceps'
  when muscle_group = 'Legs'      then 'Quads'
  when muscle_group = 'Core'      then 'Abs'
  when muscle_group = 'Cardio'    then 'Cardio'
  else 'Full body'
end
-- Only the old vocabulary. Running this twice must not re-map exercises that
-- are already specific, or a corrected 'Triceps' would be dragged back to
-- 'Biceps' by the Arms fallback.
where muscle_group in
  ('Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio', 'Other')
  or muscle_group is null;

-- Anything held rather than repeated is timed, so the logging screen asks for
-- seconds without you having to set it.
update public.exercises
set tracking_type = 'time'
where tracking_type = 'reps'
  and (
    -- \m \M are word boundaries. Plain '%hang%' also catches "Hanging Leg
    -- Raise", which is counted, not held.
    name ilike '%plank%' or name ~* '\mhang\M' or name ilike '%wall sit%'
    or name ilike '%hold%' or name ilike '%carry%' or name ilike '%l-sit%'
  );

-- Browsing is by muscle now, so that is what the index should answer.
create index if not exists exercises_muscle_idx
  on public.exercises (user_id, muscle_group, name);
