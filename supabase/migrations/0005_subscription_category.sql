-- ============================================================================
-- Phase 3b — give each subscription its own ledger category
-- ============================================================================
-- "Mark as paid" writes an expense into the shared ledger. Until now every
-- one of those was filed under 'bills', which is right for a phone plan and
-- wrong for a gym membership (Health) or Netflix (Fun). Storing the category
-- per subscription means the monthly breakdown in Finance reflects what the
-- money was actually for.
--
-- Safe on existing rows: the DEFAULT backfills every current subscription
-- with 'bills', which is exactly what they were being logged as anyway.
-- ============================================================================

alter table public.subscriptions
  add column if not exists category text not null default 'bills';

-- Deliberately NO check constraint on the allowed values, unlike
-- transactions.kind. The category list lives in the app (src/core/categories.ts)
-- and is expected to grow; a database constraint would turn every new category
-- into a migration. `kind` is different — it's a two-value concept baked into
-- the logic, so pinning it in the schema is correct there and wrong here.
