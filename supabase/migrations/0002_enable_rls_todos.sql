-- ============================================================================
-- Phase 1b — turn on Row Level Security for todos
-- ============================================================================
-- Migration 0001 left RLS off because the app had no sign-in, so there was no
-- auth.uid() to check against. The app now authenticates, so we can enforce
-- ownership in the DATABASE rather than trusting the client.
--
-- WHY THIS MATTERS: the anon key is compiled into the app bundle and can be
-- extracted from the APK. With RLS off, that key was effectively a full
-- read/write credential for the whole table. With RLS on, the key alone grants
-- nothing — every policy below requires a valid signed-in user, and each user
-- can only ever see their own rows.
-- ============================================================================

alter table public.todos enable row level security;

-- Policies are DROP-then-CREATE so this migration can be re-run safely.
drop policy if exists "todos_select_own" on public.todos;
drop policy if exists "todos_insert_own" on public.todos;
drop policy if exists "todos_update_own" on public.todos;
drop policy if exists "todos_delete_own" on public.todos;

-- One policy per operation. Postgres has no "all operations" shorthand that
-- distinguishes USING from WITH CHECK correctly, and being explicit makes it
-- obvious that nothing was left open by accident.

-- USING filters which existing rows you can SEE.
create policy "todos_select_own"
  on public.todos for select
  using (user_id = auth.uid());

-- WITH CHECK validates rows being WRITTEN. This is what stops a modified
-- client from inserting a row owned by someone else.
create policy "todos_insert_own"
  on public.todos for insert
  with check (user_id = auth.uid());

-- UPDATE needs BOTH: USING says which rows you may target, WITH CHECK says
-- what they may look like afterwards. Omitting WITH CHECK would let you take
-- one of your rows and reassign its user_id to someone else.
create policy "todos_update_own"
  on public.todos for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "todos_delete_own"
  on public.todos for delete
  using (user_id = auth.uid());

-- ============================================================================
-- Every table added from here on gets the same four policies. It's the
-- standard template for this app — see the plan's data model section.
-- ============================================================================
