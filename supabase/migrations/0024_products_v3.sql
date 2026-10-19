-- ============================================================================
-- Products v3: a second tub of the same whey, spares, expiry, reorder lead
-- ============================================================================
-- Like every migration here it ADDS and RELAXES only: the v2 app may still be
-- running when this is applied, so nothing it reads is renamed or dropped and
-- every row it can write stays valid. Safe to run twice.
--
-- THE MODEL. A `products` row was always one CONTAINER - one tub, one bottle,
-- with its own size, price and opened/finished dates - and 0016 said so: a
-- finished one is kept because "its real lifespan is the best prediction
-- available for the next one you buy". But `unique (user_id, name)` meant
-- there could never BE a next one under the same name. The second tub of whey
-- could not be added at all, so the lifespan that comment wanted to reuse had
-- nothing to be reused by.
--
-- So the rule becomes what it always meant: one OPEN container per name. Any
-- number of finished ones (the history), any number of spares (bought, not yet
-- opened), and each new container can point at the one it replaced.
-- ============================================================================

-- ONE OPEN CONTAINER PER NAME, NOT ONE EVER --------------------------------
-- 0016 declared the constraint inline, so Postgres named it. Found by what it
-- constrains rather than by a guessed name, so a database where it was named
-- differently - or already dropped - is handled the same way. Dropping it only
-- relaxes: every row valid before is valid after.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.products'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname::text)
        from unnest(con.conkey) as k(attnum)
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = k.attnum
      ) = array['name', 'user_id']
  loop
    execute format('alter table public.products drop constraint %I', c.conname);
  end loop;
end $$;

-- A spare is bought but not opened, so it has no opening date yet. v2 always
-- writes one, and v2 rows keep theirs; this only allows the absence.
alter table public.products alter column opened_on drop not null;

-- What 0016's constraint was protecting against still holds for OPEN
-- containers: two open "Whey"s would split today's uses between them with
-- nothing on screen to say so. Spares and finished containers are outside it.
--
-- The exact name, not lower(name): the old constraint guarantees the exact
-- form builds on the data already here, while a case-folded index could fail
-- this migration on a "Whey" and a "whey" that both exist today.
create unique index if not exists products_one_open_per_name
  on public.products (user_id, name)
  where finished_on is null and opened_on is not null;

-- THE CONTAINER THIS ONE REPLACED -------------------------------------------
-- Set by "Start a new one" and "Add a spare". It is how the new container
-- borrows the old one's lifespan as an estimate before it has data of its
-- own. SET NULL, not cascade: deleting an old tub must never delete the one
-- you are using now.
alter table public.products
  add column if not exists previous_id uuid
    references public.products(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_previous_not_self') then
    alter table public.products
      add constraint products_previous_not_self
      check (previous_id is null or previous_id <> id);
  end if;
end $$;

create index if not exists products_previous_idx
  on public.products (previous_id)
  where previous_id is not null;

-- EXPIRY ----------------------------------------------------------------------
-- The printed date. A month-only print ("EXP 03/2027") is stored as that
-- month's last day by the app.
alter table public.products
  add column if not exists expires_on date;

-- Period after opening: the open-jar "12M" on the pack. Use-by is the earlier
-- of the printed date and opened_on + this, because opening a product can
-- only bring its end forward, never extend it.
alter table public.products
  add column if not exists pao_months smallint
    check (pao_months is null or pao_months between 1 and 120);

-- REORDERING ------------------------------------------------------------------
-- How many days before it runs out to reorder: the time a new one takes to
-- arrive. Null means the default of 7, which is where v2's "Reorder now" band
-- has always started, so v2 rows behave exactly as before.
alter table public.products
  add column if not exists reorder_lead_days smallint
    check (reorder_lead_days is null or reorder_lead_days between 1 and 60);

-- RLS is unchanged: no new tables, and 0016's four policies already cover
-- every column of `products` and `product_uses`.
