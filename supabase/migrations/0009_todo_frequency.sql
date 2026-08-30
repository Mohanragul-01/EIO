-- ============================================================================
-- v2, Todo: frequency tabs and repeating tasks
-- ============================================================================
-- Two columns, no new tables. Recurrence is handled entirely in todo/api.ts:
-- completing a repeating task inserts the next one. There is no scheduler and
-- no cron, which means nothing can fire while the app is closed, and equally
-- nothing can silently double-fire.
-- ============================================================================

alter table public.todos
  add column if not exists frequency text
    check (frequency in ('daily', 'weekly', 'monthly', 'yearly')),
  add column if not exists is_repeat boolean not null default false;

-- Backfill defensively. The tabs query `where frequency = '<tab>'`, so a row
-- with a null frequency would exist but be invisible in every tab. The table is
-- effectively empty today, so this is a no-op in practice; it exists so a stray
-- row cannot become unreachable.
update public.todos set frequency = 'daily' where frequency is null;

-- Matches the tab query exactly: this user, this tab, still open, soonest due.
create index if not exists todos_user_frequency_idx
  on public.todos (user_id, frequency, is_done, due_date);
