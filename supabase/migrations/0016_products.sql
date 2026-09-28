-- ============================================================================
-- Products: what you use daily, and how long it will last
-- ============================================================================
-- Whey, face wash, sunscreen - things bought in a fixed quantity and consumed
-- a little at a time. The question they exist to answer is "when do I need to
-- reorder", and that needs two facts the app cannot guess: how much is in the
-- container, and how much you use at a time.
--
-- TWO TABLES, because a product is a thing and a use is an event. Keeping a
-- running "amount left" on the product instead would mean the number is only
-- as good as the last time it was written, with no way to correct a mistake
-- except by guessing a new total. A log of uses can be edited, deleted and
-- re-summed, and the remaining amount is derived from it - so it is always
-- exactly the consequence of what you recorded.
--
-- QUANTITIES ARE NUMERIC, not integer minor units. Unlike money these are
-- never accumulated into a total that has to reconcile to the paisa: 30.5 g of
-- whey is a measurement, not an amount owed, so the reasoning in core/money.ts
-- does not apply. Price DOES use integer paise, because that is money.
-- ============================================================================

create table if not exists public.products (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid        not null,
  name           text        not null check (length(trim(name)) > 0),
  category       text        not null default 'other',

  -- HOW MUCH IS IN IT -------------------------------------------------------
  -- `unit` is free text rather than an enum so a new one - sachets, sprays,
  -- scoops - does not need a migration. It is only ever displayed.
  unit           text        not null default 'g',
  total_quantity numeric(10,2) not null check (total_quantity > 0),
  /**
   * How much one use consumes. Nullable, because some things are used in
   * amounts you would never measure - a squirt of face wash - and for those
   * the projection comes from how fast the container has actually emptied
   * rather than from arithmetic.
   */
  per_use        numeric(10,2) check (per_use is null or per_use > 0),

  -- MONEY AND DATES ---------------------------------------------------------
  -- Integer paise, like every other amount of money in this app.
  price_minor    integer     check (price_minor is null or price_minor >= 0),
  opened_on      date        not null default current_date,
  -- Set when it runs out. A finished product is kept, not deleted: its real
  -- lifespan is the best prediction available for the next one you buy.
  finished_on    date,

  note           text        not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Two products with the same name would split their usage history across
  -- them without that being visible anywhere.
  unique (user_id, name)
);

create index if not exists products_user_idx
  on public.products (user_id, finished_on, name);

create table if not exists public.product_uses (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid        not null references public.products(id) on delete cascade,
  user_id     uuid        not null,
  -- A calendar day, like every other date in this app.
  used_on     date        not null default current_date,
  /**
   * How much this use consumed. Defaults to the product's per_use at write
   * time rather than being read through a join, so correcting per_use later
   * does not silently rewrite history you already recorded.
   */
  quantity    numeric(10,2) not null check (quantity > 0),
  note        text        not null default '',
  created_at  timestamptz not null default now()
);

-- Exactly the query the projection runs: this product, in date order.
create index if not exists product_uses_product_idx
  on public.product_uses (user_id, product_id, used_on desc);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ROW LEVEL SECURITY ----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['products', 'product_uses']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists "%s_select_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_insert_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_update_own" on public.%I', t, t);
    execute format('drop policy if exists "%s_delete_own" on public.%I', t, t);

    execute format(
      'create policy "%s_select_own" on public.%I for select using (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_insert_own" on public.%I for insert with check (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_update_own" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format(
      'create policy "%s_delete_own" on public.%I for delete using (user_id = auth.uid())', t, t);
  end loop;
end $$;
