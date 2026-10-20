-- ============================================================================
-- Notes v3: trash, pins, archive, colour
-- ============================================================================
-- Four nullable columns and one trigger. Like every migration here it ADDS
-- only: the v2 app may still be running when this is applied, and it reads
-- none of these columns, so nothing it relies on is renamed, dropped or
-- tightened. Safe to run twice. Needs 0003 and 0010 first.
--
-- Timestamps rather than booleans for all three states, because each one
-- carries a "since when" that something reads: the Trash counts down from
-- deleted_at, pinned notes are ordered by pinned_at, and the Archive lists
-- the most recently archived first.
-- ============================================================================

-- When the note was moved to the Trash. Null for every live note. A note in
-- the Trash is hidden from every list, count and search except the Trash
-- itself, and is purged 30 days after this moment.
alter table public.notes
  add column if not exists deleted_at timestamptz;

-- When the note was pinned. Null = not pinned. Pinning is not filing: it
-- leaves is_inbox alone, so a pinned capture stays in the Inbox.
alter table public.notes
  add column if not exists pinned_at timestamptz;

-- When the note was archived: "done with it, keep it". Hidden from the tabs,
-- search and the home tile, listed under Archive.
alter table public.notes
  add column if not exists archived_at timestamptz;

-- A key, not a hex value, so the swatches can be retuned in the app without
-- touching the data. Null = no colour.
alter table public.notes
  add column if not exists color text
    check (color is null or color in ('red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple'));

-- The live list: everything not in the Trash, newest-edited first. Partial,
-- so trashed rows cost the everyday query nothing.
create index if not exists notes_user_live_idx
  on public.notes (user_id, updated_at desc)
  where deleted_at is null;

-- The Trash and its 30-day purge both read by deletion time.
create index if not exists notes_user_trash_idx
  on public.notes (user_id, deleted_at)
  where deleted_at is not null;

-- ============================================================================
-- updated_at moves on CONTENT changes only
-- ============================================================================
-- The notes list is sorted by updated_at, and until now every update touched
-- it. With pins, colours, archive and trash that is wrong: moving a note to
-- the Trash and pressing Undo would bring it back at the TOP of the list
-- rather than where it was, and colouring a note would read as editing it.
--
-- So notes get their own trigger function, which bumps updated_at only when a
-- column the person actually writes in changes. Ticking a checklist item is
-- still an edit (it always has been). The generic set_updated_at() from 0001
-- is left alone for every other table.
create or replace function public.notes_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.title, new.body, new.tags, new.note_type, new.is_inbox, new.entry_date, new.checklist_items)
     is distinct from
     (old.title, old.body, old.tags, old.note_type, old.is_inbox, old.entry_date, old.checklist_items)
  then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

-- Same trigger name as 0003, now pointing at the notes-only function.
drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.notes_touch_updated_at();

-- RLS is unchanged: 0003's four policies (select/insert/update/delete own,
-- update with both using and with check) already cover the new columns.
