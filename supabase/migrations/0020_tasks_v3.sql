-- ============================================================================
-- Tasks v3: a recurrence that holds its schedule, times and reminders, notes,
-- a checklist, and a series identity for streaks and history
-- ============================================================================
-- One migration for every column Tasks v3 reads, so no screen can land before
-- the column it queries. Like every migration here it only ADDS: the v2 app may
-- still be running when this is applied, so nothing it reads is renamed,
-- dropped or tightened. `is_done` stays the open/closed flag both versions
-- filter on; `outcome` says HOW a closed row was closed. Safe to run twice.
--
-- The three bugs this exists to fix (see app/src/modules/todo/recurrence.ts):
--   1. An overdue repeat came back still overdue, one interval at a time.
--      Fixed in the app; it needs no column.
--   2. A task on the 31st clamped to the 28th in February and stayed there,
--      because the clamped date became the next base. repeat_anchor_day
--      remembers the day it is MEANT to fall on.
--   3. Reopening a completed repeat left its successor open beside it, because
--      nothing linked one occurrence to the next. series_id does.
--
-- Depends on 0001 (todos), 0009 (frequency, is_repeat) and 0013 (position,
-- and reorder_todos, which this replaces with a version that skips rows
-- already in place).
-- ============================================================================

-- TIME AND REMINDER ---------------------------------------------------------

-- A wall-clock time on the due date, not an instant: "19:00" means seven in
-- the evening wherever the phone is, the same reason due_date is a `date`.
alter table public.todos
  add column if not exists due_time time;

-- Minutes before due_date + due_time that the reminder fires. Null means no
-- reminder; 0 means at the time itself. Capped at a week, which is already
-- further ahead than a task reminder is useful.
alter table public.todos
  add column if not exists reminder_offset_min integer
    check (reminder_offset_min is null or reminder_offset_min between 0 and 10080);

-- THE REPEAT RULE -------------------------------------------------------------
-- `frequency` (0009) stays the unit and the tab. These say how often within
-- it, on which days, and counted from what.

-- Every N days / weeks / months / years.
alter table public.todos
  add column if not exists repeat_every smallint not null default 1
    check (repeat_every between 1 and 366);

-- Weekly: the days it falls on, 0 = Sunday ... 6 = Saturday (JavaScript's
-- getDay). Monthly by nth weekday: the one weekday, in element 1.
-- Null on a weekly repeat means "the due date's own weekday", which is what
-- every v2 weekly repeat meant.
alter table public.todos
  add column if not exists repeat_weekdays smallint[]
    check (
      repeat_weekdays is null
      or (cardinality(repeat_weekdays) between 1 and 7
          and repeat_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
    );

-- Monthly and yearly: the day of the month it is meant to fall on. Clamped to
-- the month's length when it lands, never overwritten by the clamp, so the
-- 31st is the 28th in February and the 31st again in March. 31 therefore
-- means "the last day of every month".
alter table public.todos
  add column if not exists repeat_anchor_day smallint
    check (repeat_anchor_day is null or repeat_anchor_day between 1 and 31);

-- Monthly by weekday: the 1st-4th, or -1 for the last, of repeat_weekdays[1].
-- No 5th: most months do not have one.
alter table public.todos
  add column if not exists repeat_nth smallint
    check (repeat_nth is null or repeat_nth in (-1, 1, 2, 3, 4));

-- 'due': the next date follows the schedule (Monday stays Monday).
-- 'completion': the next date is counted from when it was actually done
-- ("water the plants 3 days after I last did").
alter table public.todos
  add column if not exists repeat_from text not null default 'due'
    check (repeat_from in ('due', 'completion'));

-- SERIES ----------------------------------------------------------------------
-- Every occurrence of one routine shares a series. The FIRST occurrence of a
-- new routine leaves this null and its successors carry the first one's id, so
-- the series key is coalesce(series_id, id) and the app never has to invent a
-- uuid. No foreign key: deleting the first occurrence must not orphan or
-- cascade into the rest of the history.
alter table public.todos
  add column if not exists series_id uuid;

-- The date on the schedule this occurrence stands for. Rescheduling one moves
-- due_date and leaves this, so the next occurrence is stepped from the
-- schedule rather than from wherever this one was moved: October's "every 2
-- months on the 15th" moved to 3 November still brings the next on 15
-- December, and 1 November pulled back to 28 October does not bring 1
-- November straight back. Null on v2 rows the backfill below cannot reach;
-- the app then uses due_date.
alter table public.todos
  add column if not exists scheduled_for date;

-- COMPLETION ------------------------------------------------------------------

-- When it was closed. updated_at moves on ANY edit, so it was never a
-- completion time; streaks and "completed today" need a real one.
alter table public.todos
  add column if not exists completed_at timestamptz;

-- How a closed row was closed. Null while open. 'skipped' keeps history honest
-- (the occurrence was deliberately passed over, not done); 'wont_do' is a
-- one-off task abandoned rather than finished. The v2 app only ever sets
-- is_done, so a null outcome on a done row is read as 'done'.
alter table public.todos
  add column if not exists outcome text
    check (outcome is null or outcome in ('done', 'skipped', 'wont_do'));

-- DETAIL ----------------------------------------------------------------------

alter table public.todos
  add column if not exists notes text not null default '';

-- [{ "id": "...", "text": "...", "done": false }, ...]. Kept as one jsonb
-- array rather than a child table: it is only ever read and written whole,
-- with its task, and a repeat copies it forward with every item unticked.
alter table public.todos
  add column if not exists checklist jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'todos_checklist_is_array'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_checklist_is_array check (jsonb_typeof(checklist) = 'array');
  end if;
end
$$;

-- BACKFILLS -------------------------------------------------------------------
-- ORDER MATTERS. Every update below fires todos_set_updated_at, which moves
-- updated_at to now(). The completion backfill reads updated_at as the best
-- available completion time, so it runs FIRST, while updated_at still means
-- what it meant. (Within one statement SET reads the old value, so the
-- trigger moving it afterwards does not affect this row's completed_at.)

-- Closed rows get a completion time and an outcome. Guarded on null so a
-- second run, or a row the v3 app has since closed, is left alone.
update public.todos
set completed_at = updated_at,
    outcome = coalesce(outcome, 'done')
where is_done
  and completed_at is null;

-- Monthly and yearly repeats remember the day they fall on. A v2 task already
-- dragged from the 31st to the 28th by the old bug cannot be recovered - the
-- 31st is gone - so it keeps the 28th until edited.
update public.todos
set repeat_anchor_day = extract(day from due_date)::smallint
where is_repeat
  and frequency in ('monthly', 'yearly')
  and due_date is not null
  and repeat_anchor_day is null;

-- Link v2 occurrences into series. v2 joined one occurrence to the next only by
-- carrying the title forward, so the title is the best evidence there is:
-- every repeating row with the same (trimmed, case-folded) title for the same
-- person is one routine. Not frequency as well - dragging a task between
-- columns on the board changed it mid-series. The root is the earliest row's
-- key, and coalesce() picks up a series that already exists, so rows the v2 app
-- adds after a first run join it rather than starting another.
with grouped as (
  select
    id,
    first_value(coalesce(series_id, id)) over (
      partition by user_id, lower(btrim(title))
      order by created_at, id
    ) as root
  from public.todos
  where is_repeat
)
update public.todos t
set series_id = grouped.root
from grouped
where t.id = grouped.id
  and t.series_id is null
  -- The first row of a series is its own key; writing its own id into it is
  -- harmless but would move its updated_at for nothing.
  and grouped.root <> t.id;

-- Open repeats are on the schedule where they are due. Only open ones: a
-- closed occurrence is never stepped from again, and the app reads a null
-- scheduled_for as its due date anyway.
update public.todos
set scheduled_for = due_date
where is_repeat
  and not is_done
  and due_date is not null
  and scheduled_for is null;

-- REORDERING TOUCHES ONLY WHAT MOVED ------------------------------------------
-- 0013's reorder_todos renumbered every row of a column on every drag, and the
-- updated_at trigger then marked each one as edited. Tasks v3 reads "never
-- edited" (created_at = updated_at) to decide that reopening a repeat may
-- remove the occurrence it created, so a single drag on the website made
-- every successor in the column look hand-edited, and an Undo then left the
-- routine open twice. Same signature, same result for the order; rows already
-- in place are simply not written.
create or replace function public.reorder_todos(p_ids uuid[])
returns void
language sql
security invoker
as $$
  update public.todos t
  set position = new_order.rank
  from unnest(p_ids) with ordinality as new_order(id, rank)
  where t.id = new_order.id
    and t.position is distinct from new_order.rank;
$$;

comment on function public.reorder_todos(uuid[]) is
  'Renumber tasks to match the given id order, writing only rows whose position changes. RLS-scoped to the caller.';

-- INDEXES ---------------------------------------------------------------------

-- A routine's history, in date order: streaks, the history calendar, and
-- finding the untouched successor when an occurrence is reopened.
create index if not exists todos_series_idx
  on public.todos (user_id, series_id, due_date);

-- "Completed today" and the done list, newest first.
create index if not exists todos_completed_idx
  on public.todos (user_id, completed_at desc)
  where is_done;

comment on column public.todos.repeat_anchor_day is
  'Day of the month a monthly/yearly repeat is meant to fall on; clamped when it lands, never overwritten. 31 = last day.';
comment on column public.todos.series_id is
  'Shared by every occurrence of a routine. Null on the first occurrence; the key is coalesce(series_id, id).';
comment on column public.todos.scheduled_for is
  'The date on the schedule this occurrence stands for; a reschedule moves due_date only. Null means due_date.';
comment on column public.todos.outcome is
  'How a closed row was closed: done, skipped, wont_do. Null while open; null on a done v2 row means done.';

-- Row level security is unchanged: 0002's four policies cover every column of
-- todos, including these.
