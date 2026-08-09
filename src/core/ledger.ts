/**
 * ledger.ts - the shared "record that money moved" service.
 *
 *
 * WHY THIS IS IN core/ AND NOT IN THE FINANCE MODULE
 *
 *
 * The rule from the plan is that modules never import from each other. When
 * Subscriptions needed to log a payment into Finance, there were three ways
 * to do it, and only one is any good:
 *
 *  1. subscriptions/api.ts imports finance/api.ts.
 *     Breaks the rule outright. Delete or rework Finance later and
 *     Subscriptions breaks with it - exactly the coupling the plan exists to
 *     prevent. Do this twice more and the modules stop being independent.
 *
 *  2. Subscriptions writes to the `transactions` table directly with its own
 *     copy of the insert.
 *     No import, but now two places know the table's shape. Add a column and
 *     you have to remember to change both. Worse than an import, because the
 *     duplication is invisible.
 *
 *  3. THIS: the narrow slice both modules need moves DOWN into core/, and
 *     both depend on core rather than on each other.
 *
 * The reframing that makes option 3 correct rather than just convenient:
 * `transactions` is no longer "the Finance module's private table". It's the
 * app's LEDGER - a shared record of money moving. Finance is the ledger's
 * VIEWER and EDITOR (it owns listing, monthly summaries, category breakdowns,
 * the edit form). Subscriptions is simply another WRITER. Any future module
 * that spends money - a Fuel log, say - becomes a writer too, with no changes
 * here and none to Finance.
 *
 * So this file deliberately holds ONLY the write path. Everything else about
 * transactions stays in modules/finance/, because nothing else is shared.
 */
import { getOwnerId } from './session';
import { supabase } from './supabase';

const TABLE = 'transactions';

/**
 * Category keys that core-level writers may use.
 *
 * These are plain strings in the database. They're named here, in the shared
 * layer, rather than imported from Finance's category list - that would be a
 * cross-module import through the back door. Finance knows how to render
 * them (icon, colour, label); core only needs to know they exist.
 */
export const LEDGER_CATEGORY = {
  bills: 'bills',
  other: 'other',
} as const;

export type LedgerEntry = {
  /** Paise, always positive. Direction comes from `kind`. */
  amount_minor: number;
  kind: 'expense' | 'income';
  category: string;
  note: string;
  /** 'YYYY-MM-DD' - the day the money actually moved. */
  date: string;
};

/**
 * Write one entry to the ledger.
 *
 * The owner id is stamped here, so callers never deal with identity - the
 * same contract every module's api.ts follows.
 */
export async function recordEntry(entry: LedgerEntry): Promise<void> {
  const ownerId = await getOwnerId();

  const { error } = await supabase.from(TABLE).insert({ ...entry, user_id: ownerId });

  if (error) throw new Error(error.message);
}
