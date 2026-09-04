-- ============================================================================
-- Manual ordering for tasks
-- ============================================================================
-- The board lets you drag a task within its column and between columns.
-- Between columns is just `frequency`, which already exists. Within a column
-- needs somewhere to record the order you chose, and there was nowhere: tasks
-- were ordered by due date then creation time, both of which the database
-- decides, not you.
--
-- WHY AN INTEGER AND A RENUMBER, rather than the usual trick of giving each
-- task a fractional rank and inserting at the midpoint between its neighbours.
-- Midpoints only need to touch one row per drag, which is tempting - but the
-- values halve every time you drop into the same gap, and PostgREST hands
-- `numeric` back to the browser as a JSON number, which is a float64 with about
-- 16 significant digits. Roughly fifty drops into one gap and two tasks quietly
-- become equal, after which their order is whatever Postgres feels like. A
-- personal task list is small, so renumbering the whole column is cheap and has
-- no failure mode at all.
-- ============================================================================

alter table public.todos
  add column if not exists position integer not null default 0;

-- Backfill so nothing starts life unordered. Existing tasks keep exactly the
-- order they are showing in right now - due soonest first, undated last - so
-- the board looks unchanged the first time it loads.
with ordered as (
  select
    id,
    row_number() over (
      partition by user_id, frequency, is_done
      order by due_date asc nulls last, created_at desc
    ) as rank
  from public.todos
)
update public.todos t
set position = ordered.rank
from ordered
where t.id = ordered.id;

-- Exactly the board's query: this user, this tab, still open, in order.
create index if not exists todos_board_idx
  on public.todos (user_id, frequency, is_done, position);

-- ----------------------------------------------------------------------------
-- Renumber one column in a single statement.
-- ----------------------------------------------------------------------------
-- Called with the ids of a column in their new order. Doing it here rather than
-- as N updates from the browser makes a drop ONE round trip and ONE transaction:
-- a dropped connection halfway through cannot leave the column half-reordered.
--
-- SECURITY INVOKER (the default, stated explicitly because it is the whole
-- point) means row level security still applies as the calling user, so this
-- can only ever renumber your own rows. Ids belonging to anyone else simply
-- match nothing.
--
-- `with ordinality` is what turns the array's order into the position value,
-- which is why the caller only has to send ids.
-- ----------------------------------------------------------------------------
create or replace function public.reorder_todos(p_ids uuid[])
returns void
language sql
security invoker
as $$
  update public.todos t
  set position = new_order.rank
  from unnest(p_ids) with ordinality as new_order(id, rank)
  where t.id = new_order.id;
$$;

comment on function public.reorder_todos(uuid[]) is
  'Renumber tasks to match the given id order. RLS-scoped to the caller.';
