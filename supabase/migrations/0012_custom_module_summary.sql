-- ============================================================================
-- v2, Custom modules: a tile stat and a sort order
-- ============================================================================
-- Both are choices ABOUT a module rather than data inside it, so they live on
-- user_modules next to the name and icon, not in a settings table.
-- ============================================================================

alter table public.user_modules
  -- Which field the tile summarises. A field KEY, not a field id: keys are
  -- frozen at creation and survive renaming, so a renamed field keeps its
  -- summary. Nullable, because a module without one falls back to a count.
  add column if not exists summary_field_key text,

  add column if not exists summary_agg text
    check (summary_agg is null or summary_agg in ('sum', 'average', 'count', 'latest')),

  -- Which field orders the list. Null means order by created_at, which is what
  -- every custom module did before this migration.
  add column if not exists sort_field_key text,

  add column if not exists sort_direction text not null default 'desc'
    check (sort_direction in ('asc', 'desc'));

-- Deliberately NO foreign key from summary_field_key to user_module_fields.
-- It is a key, not an id, and the pair (module, key) is unique but not the
-- primary key there. More importantly: deleting a field should leave the
-- module working with a stale summary that falls back to a count, not refuse
-- the delete or silently cascade the module away. The app treats an unknown
-- key as "no summary configured".
