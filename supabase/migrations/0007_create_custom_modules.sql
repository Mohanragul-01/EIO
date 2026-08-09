-- ============================================================================
-- Phase 5 — user-created modules ("build your own app")
-- ============================================================================
-- Three tables that together let you define a module from inside the app and
-- have its screens generated, with no code and no migration.
--
--   user_modules        one row per module you create      ("Sleep Log")
--   user_module_fields  the fields you gave it             (Date, Hours, …)
--   user_records        the actual entries                 (one per night)
--
-- ── WHY VALUES GO IN JSONB RATHER THAN REAL COLUMNS ───────────────────────
-- The "proper" version of this creates a real table per module, with real
-- typed columns. That needs DDL at runtime, which the anon key can't do and
-- shouldn't be able to — it would mean a privileged server-side function that
-- executes generated SQL, which is both significant work and a security
-- surface worth avoiding in a personal app.
--
-- So each entry stores its values in one `jsonb` column keyed by field key.
-- What that costs: no per-field database constraints, and weaker querying
-- (no index on "hours slept" unless we add one deliberately). What it buys:
-- creating a module is a plain INSERT, needs no elevated privileges, and can
-- never corrupt the schema. At personal scale — thousands of rows, not
-- millions — the query difference is unmeasurable.
-- ============================================================================


-- ── MODULES ────────────────────────────────────────────────────────────────
create table if not exists public.user_modules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid        not null,

  name        text        not null check (length(trim(name)) > 0),
  -- Ionicons name and a hex colour, so a custom tile is indistinguishable
  -- from a built-in one on the home screen.
  icon        text        not null default 'cube-outline',
  color       text        not null default '#818CF8',

  -- Ordering on the home screen. Kept explicit so modules can be reordered
  -- later without depending on creation time.
  position    integer     not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_modules_user_idx
  on public.user_modules (user_id, position, created_at);


-- ── FIELDS ─────────────────────────────────────────────────────────────────
create table if not exists public.user_module_fields (
  id          uuid primary key default gen_random_uuid(),

  -- ON DELETE CASCADE: deleting a module deletes its fields and its records.
  -- Enforced by the database rather than the app, so it holds even if a
  -- delete happens from the dashboard or a future second client.
  module_id   uuid        not null references public.user_modules(id) on delete cascade,

  -- Denormalised from the parent module ON PURPOSE. RLS policies run per row,
  -- and `user_id = auth.uid()` is a plain comparison; without this column the
  -- policy would need a subquery joining back to user_modules on every single
  -- row read. Duplicating one uuid is the cheaper trade.
  user_id     uuid        not null,

  -- Stable identifier used as the jsonb key. Generated from the label once,
  -- then never changed — renaming "Hours" to "Hours slept" must not orphan
  -- the data already stored under the old key.
  key         text        not null check (length(trim(key)) > 0),
  label       text        not null check (length(trim(label)) > 0),

  -- CHECK constrained, unlike category/type columns elsewhere: this list is
  -- not user-extensible. Each type maps to a specific input widget in the
  -- app, so a value outside this set would have nothing to render it.
  type        text        not null
                          check (type in ('text','longtext','number','money','date','boolean','select')),

  required    boolean     not null default false,

  -- Choices for 'select' fields, e.g. ["Poor","OK","Good"]. Empty otherwise.
  options     jsonb       not null default '[]'::jsonb,

  position    integer     not null default 0,
  created_at  timestamptz not null default now(),

  -- Two fields in one module can't share a key, or one would overwrite the
  -- other's value in the record jsonb.
  unique (module_id, key)
);

create index if not exists user_module_fields_module_idx
  on public.user_module_fields (module_id, position);


-- ── RECORDS ────────────────────────────────────────────────────────────────
create table if not exists public.user_records (
  id          uuid        primary key default gen_random_uuid(),
  module_id   uuid        not null references public.user_modules(id) on delete cascade,
  user_id     uuid        not null,

  -- { "<field key>": <value> }. Money values are stored as integer paise here
  -- too, exactly as in the transactions table — same reasoning, same helpers.
  data        jsonb       not null default '{}'::jsonb,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_records_module_idx
  on public.user_records (module_id, created_at desc);


-- ── updated_at triggers (reusing the function from migration 0001) ─────────
drop trigger if exists user_modules_set_updated_at on public.user_modules;
create trigger user_modules_set_updated_at
  before update on public.user_modules
  for each row execute function public.set_updated_at();

drop trigger if exists user_records_set_updated_at on public.user_records;
create trigger user_records_set_updated_at
  before update on public.user_records
  for each row execute function public.set_updated_at();


-- ============================================================================
-- ROW LEVEL SECURITY — the same four-policy template, applied to all three.
-- ============================================================================
alter table public.user_modules       enable row level security;
alter table public.user_module_fields enable row level security;
alter table public.user_records       enable row level security;

drop policy if exists "user_modules_select_own" on public.user_modules;
drop policy if exists "user_modules_insert_own" on public.user_modules;
drop policy if exists "user_modules_update_own" on public.user_modules;
drop policy if exists "user_modules_delete_own" on public.user_modules;
create policy "user_modules_select_own" on public.user_modules for select
  using (user_id = auth.uid());
create policy "user_modules_insert_own" on public.user_modules for insert
  with check (user_id = auth.uid());
create policy "user_modules_update_own" on public.user_modules for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_modules_delete_own" on public.user_modules for delete
  using (user_id = auth.uid());

drop policy if exists "user_module_fields_select_own" on public.user_module_fields;
drop policy if exists "user_module_fields_insert_own" on public.user_module_fields;
drop policy if exists "user_module_fields_update_own" on public.user_module_fields;
drop policy if exists "user_module_fields_delete_own" on public.user_module_fields;
create policy "user_module_fields_select_own" on public.user_module_fields for select
  using (user_id = auth.uid());
create policy "user_module_fields_insert_own" on public.user_module_fields for insert
  with check (user_id = auth.uid());
create policy "user_module_fields_update_own" on public.user_module_fields for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_module_fields_delete_own" on public.user_module_fields for delete
  using (user_id = auth.uid());

drop policy if exists "user_records_select_own" on public.user_records;
drop policy if exists "user_records_insert_own" on public.user_records;
drop policy if exists "user_records_update_own" on public.user_records;
drop policy if exists "user_records_delete_own" on public.user_records;
create policy "user_records_select_own" on public.user_records for select
  using (user_id = auth.uid());
create policy "user_records_insert_own" on public.user_records for insert
  with check (user_id = auth.uid());
create policy "user_records_update_own" on public.user_records for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_records_delete_own" on public.user_records for delete
  using (user_id = auth.uid());
