-- ============================================================================
-- v2, Notes: quick capture, journal, checklists
-- ============================================================================

alter table public.notes
  add column if not exists note_type text not null default 'note'
    check (note_type in ('note', 'checklist', 'journal')),

  -- Quick capture drops a note here when it was saved with no title and no
  -- tags. A flag rather than a derived query, because "was captured in a
  -- hurry" is a fact about how the note was created; deriving it would make a
  -- note silently leave the inbox the moment its last tag was removed.
  add column if not exists is_inbox boolean not null default false,

  -- The day a journal entry is ABOUT, which is not the day it was written:
  -- backdating last night's entry this morning is the normal case. `date`, not
  -- timestamptz, because it is a calendar day. Null for non-journal notes.
  add column if not exists entry_date date,

  -- [{ "text": string, "done": boolean }] for checklists, null otherwise.
  -- jsonb rather than a child table: items have no identity of their own, are
  -- never queried across notes, and are always read and written as a whole
  -- list. A table would buy ordering and constraints we do not need, at the
  -- cost of a join on every read.
  add column if not exists checklist_items jsonb;

-- Quick capture must be able to save a body with no title at all, so the
-- non-empty check has to go. NOT NULL stays, with a default, so the column is
-- always a string: allowing null would mean every read site handling both an
-- empty string and null for the same "no title" state.
alter table public.notes drop constraint if exists notes_title_check;
alter table public.notes alter column title set default '';

-- The list is filtered by type and sorted by recency; the journal feed is
-- filtered by type and sorted by the day it is about.
create index if not exists notes_user_type_idx
  on public.notes (user_id, note_type, updated_at desc);
create index if not exists notes_user_journal_idx
  on public.notes (user_id, entry_date desc)
  where note_type = 'journal';
