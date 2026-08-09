/**
 * api.ts - every database call the Subscriptions module makes.
 */
import { todayISO } from '../../core/date';
import { LEDGER_CATEGORY, recordEntry } from '../../core/ledger';
import { supabase } from '../../core/supabase';
import { getOwnerId } from '../../core/session';
import { advanceDueDate, type Subscription, type SubscriptionInput } from './types';

const TABLE = 'subscriptions';

/**
 * All subscriptions, soonest due first.
 *
 * Active ones sort ahead of cancelled ones, so the list opens on what you
 * actually owe. Ordering by is_active ascending puts `false` last, since
 * Postgres sorts false before true - hence `ascending: false`.
 */
export async function listSubscriptions(): Promise<Subscription[]> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('is_active', { ascending: false })
    .order('next_due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSubscription(id: string): Promise<Subscription> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const ownerId = await getOwnerId();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...input, user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateSubscription(
  id: string,
  input: Partial<SubscriptionInput>,
): Promise<Subscription> {
  const { data, error } = await supabase
    .from(TABLE)
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/** What markPaid actually managed to do - the screen reports this to the user. */
export type MarkPaidResult = {
  subscription: Subscription;
  /** False when the due date advanced but the ledger write failed. */
  logged: boolean;
  logError?: string;
};

/**
 * "I paid this one" - roll the due date forward AND log the payment to the
 * shared ledger, so subscription spending shows up in Finance.
 *
 * The new due date is computed from the EXISTING due date, not from today.
 * Paying three days late shouldn't permanently shift your billing date later;
 * the cycle stays anchored where it was.
 *
 *  ORDER OF OPERATIONS, AND WHY
 * These are two separate writes and there's no transaction spanning them, so
 * one can succeed while the other fails. That makes the ORDER a real decision:
 *
 *   log first, then advance  -> if advancing fails, the user taps again and
 *                              logs a SECOND payment. A phantom expense
 *                              silently corrupts every monthly total.
 *   advance first, then log  -> if logging fails, the user taps again and the
 *                              due date moves one cycle too far. Visible,
 *                              and fixable by editing the date.
 *
 * We advance first. A wrong date is an annoyance you can see and correct; a
 * duplicated expense is bad data you probably won't notice.
 *
 * The ledger failure is returned rather than thrown, because the first write
 * DID succeed - throwing would make the screen report total failure for an
 * operation that half-worked.
 */
export async function markPaid(subscription: Subscription): Promise<MarkPaidResult> {
  const next = advanceDueDate(subscription.next_due_date, subscription.billing_cycle);
  const updated = await updateSubscription(subscription.id, { next_due_date: next });

  try {
    await recordEntry({
      amount_minor: subscription.amount_minor,
      kind: 'expense',
      // The subscription's own category, so a gym membership lands under
      // Health rather than everything piling into Bills. Falls back for rows
      // created before the category column existed.
      category: subscription.category || LEDGER_CATEGORY.bills,
      // The subscription name IS the useful note - it's what makes the row
      // recognisable in the Finance list.
      note: subscription.name,
      // Dated today, not the old due date: this records when you actually
      // paid, and the user confirms this action on the day they pay.
      date: todayISO(),
    });
    return { subscription: updated, logged: true };
  } catch (e) {
    return {
      subscription: updated,
      logged: false,
      logError: e instanceof Error ? e.message : 'Could not log to Finance',
    };
  }
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
