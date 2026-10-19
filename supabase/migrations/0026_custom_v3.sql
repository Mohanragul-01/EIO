-- ============================================================================
-- Custom modules v3: defaults, three new field types, row roles, a chart,
-- groups, a tile period and reminders
-- ============================================================================
-- Every column the v3 module builder reads, in one migration, so no screen can
-- land before the columns it queries. Like every migration here it ADDS and
-- RELAXES only: the v2 app may still be running when this is applied, so
-- nothing it reads is renamed, dropped or tightened. Safe to run twice.
--
-- Needs 0007 (the three tables) and 0012 (summary and sort columns) first.
--
-- Everything below is a choice ABOUT a module or a field, never data inside a
-- record, so record jsonb is untouched: a value typed under v2 reads the same
-- under v3.
-- ============================================================================

-- FIELDS ----------------------------------------------------------------------

-- How a new entry fills this field before you touch it. 'last' copies the most
-- recent entry that answered it, and needs no storage of its own: the newest
-- record already holds the value. 'today' only makes sense for a date field;
-- the app only offers it there.
alter table public.user_module_fields
  add column if not exists default_mode text not null default 'none'
    check (default_mode in ('none', 'fixed', 'today', 'last'));

-- The value a 'fixed' default fills in, stored exactly as a record would store
-- it (a number, paise, minutes, a string, true/false, a list). Ignored for
-- every other mode, and nullable because most fields never have one.
alter table public.user_module_fields
  add column if not exists default_value jsonb;

-- One line under the label in the form ("pages read today, not total"), so a
-- module built months ago is still usable.
alter table public.user_module_fields
  add column if not exists hint text not null default ''
    check (length(hint) <= 120);

-- Three new field types: rating (a whole number 1-5), multiselect (a jsonb
-- list of options) and duration (whole minutes, so it sums like a number).
--
-- The check from 0007 was declared inline, so Postgres named it; it is found
-- by what it says rather than by guessing the name, then replaced with the
-- wider list. WIDER ONLY: every type v2 can write is still allowed, so the v2
-- app keeps working while this runs. A re-run finds the wider check, drops it
-- and adds it back unchanged.
do $$
declare
  existing record;
begin
  for existing in
    select conname
    from pg_constraint
    where conrelid = 'public.user_module_fields'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%longtext%'
  loop
    execute format('alter table public.user_module_fields drop constraint %I', existing.conname);
  end loop;

  alter table public.user_module_fields
    add constraint user_module_fields_type_check
    check (type in (
      'text', 'longtext', 'number', 'money', 'date', 'boolean', 'select',
      'rating', 'multiselect', 'duration'
    ));
end $$;

-- MODULES ---------------------------------------------------------------------
-- Every *_field_key below is a field KEY, not an id, for the same reason as
-- summary_field_key in 0012: keys are frozen at creation and survive renames.
-- And for the same reason there is no foreign key: deleting a field must leave
-- the module working, with the app falling back to its automatic choice.

-- Row roles: which field is the row's title, its line underneath, and the badge
-- on the right. Null means the automatic rule (first text field, first date
-- field, first rating field), which is what every v2 module did.
alter table public.user_modules
  add column if not exists title_field_key text;
alter table public.user_modules
  add column if not exists subtitle_field_key text;
alter table public.user_modules
  add column if not exists badge_field_key text;

-- Group the list by this field, each group headed by its count and the tile's
-- statistic. Null means one flat list.
alter table public.user_modules
  add column if not exists group_field_key text;

-- The trend chart. A null field means "the first number-like field", so a
-- module with one numeric field charts it with no setup; chart_hidden is the
-- way to say no chart at all.
alter table public.user_modules
  add column if not exists chart_field_key text;
alter table public.user_modules
  add column if not exists chart_bucket text not null default 'day'
    check (chart_bucket in ('entry', 'day', 'week', 'month'));
alter table public.user_modules
  add column if not exists chart_agg text not null default 'sum'
    check (chart_agg in ('sum', 'average'));
-- A trailing moving average over this many points; null is off.
alter table public.user_modules
  add column if not exists chart_window integer
    check (chart_window is null or chart_window between 2 and 30);
alter table public.user_modules
  add column if not exists chart_hidden boolean not null default false;

-- Which stretch the home tile's statistic covers. All-time totals stop meaning
-- anything after a few months; "this month" stays useful every day.
alter table public.user_modules
  add column if not exists summary_period text not null default 'all'
    check (summary_period in ('all', 'week', 'month'));

-- REMINDERS. Scheduled on the phone, never on a server, and rebuilt from these
-- columns on every launch.
--
-- A nudge at reminder_time ('HH:MM', 24-hour, local) on the weekdays in
-- reminder_days (0 = Sunday ... 6 = Saturday, as JavaScript counts them),
-- skipped on a day that already has an entry. Null time means no nudge.
alter table public.user_modules
  add column if not exists reminder_time text
    check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
alter table public.user_modules
  add column if not exists reminder_days smallint[] not null default '{0,1,2,3,4,5,6}'
    check (reminder_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]);

-- A reminder on each entry's date in this field ("Water plants", "Return the
-- library book"), on the day or this many days before. Null field means none.
alter table public.user_modules
  add column if not exists reminder_field_key text;
alter table public.user_modules
  add column if not exists reminder_offset_days integer not null default 0
    check (reminder_offset_days between 0 and 30);

-- No new tables, so no new policies: every column above lives on a table that
-- 0007 already put under the four-policy template.
