/**
 * api.ts - every database call the Subscriptions module makes.
 *
 * It also reads two tables it does not own, which the architecture allows
 * (reading another module's TABLE from your own api.ts; never importing its
 * code): `accounts` (Finance, 0008) to offer "charged to", and `transactions`
 * (the shared ledger) for a subscription's payments. Payments are WRITTEN
 * through core/ledger, the one insert path for the ledger.
 *
 * Every write that changes when or whether something charges reschedules its
 * reminders from the row the database returned - never from the input, which
 * for a partial update does not describe the whole row.
 */
import { fromISODate, todayISO } from '../../core/date';
import { removeEntry, recordEntry } from '../../core/ledger';
import { registerResync } from '../../core/notifications';
import { getOwnerId } from '../../core/session';
import { supabase } from '../../core/supabase';
import { markPaidPatch, snapshot, type LifecyclePatch, type MarkPaidChoice } from './actions';
import { legacyCycleFor } from './cycles';
import { isActiveFlag } from './lifecycle';
import { cancelReminders, rescheduleAll, scheduleReminders } from './notifications';
import { DEFAULT_REMINDER_SETTINGS } from './reminders';
import type {
  Account,
  Payment,
  PriceChange,
  ReminderSettings,
  Subscription,
  SubscriptionInput,
} from './types';

const TABLE = 'subscriptions';
const PRICES = 'subscription_price_changes';
const SETTINGS = 'subscription_settings';

/* ROWS --------------------------------------------------------------------- */

type Row = Record<string, unknown>;

/**
 * A database row as the app's type. numeric columns are normalised to
 * numbers (fx_rate), and a row a v2 app wrote is given v3 defaults rather
 * than undefined.
 */
function toSubscription(row: Row): Subscription {
  const r = row as unknown as Subscription;
  return {
    ...r,
    amount_minor: Number(r.amount_minor),
    status: r.status ?? (r.is_active ? 'active' : 'cancelled'),
    cancel_notes: r.cancel_notes ?? '',
    currency: r.currency ?? 'INR',
    fx_rate: r.fx_rate === null || r.fx_rate === undefined ? null : Number(r.fx_rate),
    cycle_count:
      r.cycle_count === null || r.cycle_count === undefined ? null : Number(r.cycle_count),
    anchor_day: r.anchor_day === null || r.anchor_day === undefined ? null : Number(r.anchor_day),
    reminder_offsets: r.reminder_offsets ?? null,
  };
}

/**
 * The two v2 columns, derived on every write so they can never disagree with
 * what v3 shows: is_active from the status, billing_cycle as the nearest of
 * v2's four. The v2 app reads only those.
 */
function withCompat(patch: Partial<SubscriptionInput>, current?: Subscription): Row {
  const row: Row = { ...patch };
  if (patch.status !== undefined) row.is_active = isActiveFlag(patch.status);
  if (patch.cycle_unit !== undefined || patch.cycle_count !== undefined) {
    const unit = patch.cycle_unit ?? current?.cycle_unit ?? 'month';
    const count = patch.cycle_count ?? current?.cycle_count ?? 1;
    row.billing_cycle = legacyCycleFor({ unit, count });
  }
  return row;
}

/** Soonest due first. Everything, whatever its state: the screens split it. */
export async function listSubscriptions(): Promise<Subscription[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('user_id', ownerId)
    .order('next_due_date', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toSubscription);
}

export async function getSubscription(id: string): Promise<Subscription> {
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return toSubscription(data);
}

export async function createSubscription(input: SubscriptionInput): Promise<Subscription> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ ...withCompat(input), user_id: ownerId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  const created = toSubscription(data);

  // After the insert, never before: a failed write must not leave a reminder
  // for a subscription that does not exist.
  await rescheduleQuietly(created);
  return created;
}

/**
 * Save changes. When the amount changes (same currency), the old price goes
 * into the history first - "price history from those edits".
 *
 * ORDER: history row, then the update. If the update fails, the history row
 * is removed again and the error thrown. The other order would lose the
 * history silently whenever the second write failed; this one can at worst
 * leave a visible, deletable row.
 */
export async function updateSubscription(
  id: string,
  patch: Partial<SubscriptionInput>,
  previous?: Subscription,
): Promise<Subscription> {
  let priceChangeId: string | null = null;
  const changesPrice =
    previous &&
    patch.amount_minor !== undefined &&
    patch.amount_minor !== previous.amount_minor &&
    (patch.currency === undefined || patch.currency === previous.currency);

  if (changesPrice && previous && patch.amount_minor !== undefined) {
    priceChangeId = await recordPriceChange(previous, patch.amount_minor);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(withCompat(patch, previous))
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (priceChangeId) await deletePriceChange(priceChangeId).catch(() => {});
    throw new Error(error.message);
  }

  const updated = toSubscription(data);
  await rescheduleQuietly(updated);
  return updated;
}

/** Apply a lifecycle patch from actions.ts (pause, cancel, archive, undo...). */
export async function applyPatch(sub: Subscription, patch: LifecyclePatch): Promise<Subscription> {
  return updateSubscription(sub.id, patch);
}

export async function deleteSubscription(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);

  // After the delete succeeds. Cancelling first would silently drop the
  // reminders of a subscription that then failed to delete.
  await cancelReminders(id);
}

/* MARK PAID ---------------------------------------------------------------- */

export type MarkPaidInput = MarkPaidChoice & {
  /** The rupees actually charged: Finance is INR. */
  amountInrMinor: number;
  /** The day it was paid. */
  paidOn: string;
  accountId: string | null;
  /** Today, for the patch's notion of "has this pause come round". */
  today: string;
};

/** What markPaid managed to do; the screen reports it and can undo it. */
export type MarkPaidResult = {
  subscription: Subscription;
  /** The row before, so Undo can put it back exactly. */
  previous: Subscription;
  transactionId: string | null;
  priceChangeId: string | null;
  /** False when the due date moved but the ledger write failed. */
  logged: boolean;
  logError?: string;
};

/**
 * "I paid this one": move the due date on and log the payment to the ledger,
 * against the charged-to account, linked to this subscription.
 *
 *  ORDER OF OPERATIONS, AND WHY
 * There is no transaction across these writes, so one can succeed while
 * another fails, and the order is the decision:
 *
 *   log first, then advance  -> if advancing fails, a tap again logs a SECOND
 *                              payment: a phantom expense in every total.
 *   advance first, then log  -> if logging fails, a tap again moves the date
 *                              one cycle too far: visible, and editable.
 *
 * So: price history (if a new price was confirmed), then advance, then log.
 * A failed log is returned rather than thrown, because the advance DID happen
 * and "nothing worked" would be untrue.
 */
export async function markPaid(sub: Subscription, input: MarkPaidInput): Promise<MarkPaidResult> {
  const patch = markPaidPatch(sub, input, input.today);

  let priceChangeId: string | null = null;
  if (patch.amount_minor !== undefined) {
    priceChangeId = await recordPriceChange(sub, patch.amount_minor, input.paidOn);
  }

  let updated: Subscription;
  try {
    updated = await updateSubscription(sub.id, patch);
  } catch (e) {
    if (priceChangeId) await deletePriceChange(priceChangeId).catch(() => {});
    throw e;
  }

  try {
    const transactionId = await recordEntry({
      amount_minor: input.amountInrMinor,
      kind: 'expense',
      // The subscription's own category, so a gym lands under Health rather
      // than everything piling into Bills.
      category: sub.category || 'bills',
      // The name IS the useful note: it is what makes the row recognisable
      // in the Finance list.
      note: sub.name,
      date: input.paidOn,
      account_id: input.accountId,
      subscription_id: sub.id,
    });
    return { subscription: updated, previous: sub, transactionId, priceChangeId, logged: true };
  } catch (e) {
    return {
      subscription: updated,
      previous: sub,
      transactionId: null,
      priceChangeId,
      logged: false,
      logError: e instanceof Error ? e.message : 'Could not log to Finance',
    };
  }
}

/**
 * Undo a Mark paid. The payment goes first: if removing it fails, nothing
 * else is touched. Putting the date back first and then failing to remove the
 * payment would invite a second Mark paid - the phantom expense the order
 * above exists to prevent.
 *
 * Either write can fail on a bad connection, and the error says which half
 * happened: "could not undo" alone reads as "nothing changed", which after
 * the first write is no longer true.
 */
export async function undoMarkPaid(result: MarkPaidResult): Promise<Subscription> {
  if (result.transactionId) {
    try {
      await removeEntry(result.transactionId);
    } catch {
      throw new Error(
        'Could not undo: the payment is still in Finance and nothing changed. Try again.',
      );
    }
  }
  let restored: Subscription;
  try {
    restored = await updateSubscription(result.previous.id, snapshot(result.previous));
  } catch (e) {
    // Nothing was removed, so nothing is half-done: the plain error stands.
    if (!result.transactionId) throw e;
    throw new Error(
      `Undo stopped halfway: the payment is out of Finance, but ${result.previous.name} is ` +
        `still due ${shortDay(result.subscription.next_due_date)}. ` +
        `Set it back to ${shortDay(result.previous.next_due_date)} in Edit.`,
    );
  }
  if (result.priceChangeId) await deletePriceChange(result.priceChangeId).catch(() => {});
  return restored;
}

/** "26 Oct": the day without the relative words, which read oddly mid-sentence. */
const shortDay = (iso: string) =>
  fromISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/* PRICE HISTORY ------------------------------------------------------------ */

/** Write one price change and return its id. */
async function recordPriceChange(
  sub: Subscription,
  newAmountMinor: number,
  effectiveOn?: string,
): Promise<string> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(PRICES)
    .insert({
      user_id: ownerId,
      subscription_id: sub.id,
      old_amount_minor: sub.amount_minor,
      new_amount_minor: newAmountMinor,
      currency: sub.currency,
      // The phone's day: the column's default (current_date) is UTC, which
      // is still yesterday in India until 05:30.
      effective_on: effectiveOn ?? todayISO(),
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

const toPriceChange = (row: Row): PriceChange => {
  const r = row as unknown as PriceChange;
  return {
    ...r,
    old_amount_minor: Number(r.old_amount_minor),
    new_amount_minor: Number(r.new_amount_minor),
  };
};

export async function listPriceChanges(subscriptionId: string): Promise<PriceChange[]> {
  const { data, error } = await supabase
    .from(PRICES)
    .select('*')
    .eq('subscription_id', subscriptionId)
    .order('effective_on', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPriceChange);
}

/** Every change on or after `since`, for the list's "↑" badges. */
export async function listRecentPriceChanges(since: string): Promise<PriceChange[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from(PRICES)
    .select('*')
    .eq('user_id', ownerId)
    .gte('effective_on', since);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPriceChange);
}

export async function deletePriceChange(id: string): Promise<void> {
  const { error } = await supabase.from(PRICES).delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** How many price changes a delete would take with it, for the confirmation. */
export async function countPriceChanges(subscriptionId: string): Promise<number> {
  const { count, error } = await supabase
    .from(PRICES)
    .select('id', { count: 'exact', head: true })
    .eq('subscription_id', subscriptionId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/* FINANCE'S TABLES, READ ONLY ---------------------------------------------- */

/** Finance accounts, in Finance's order. Inactive ones too: a linked one still needs its name. */
export async function listAccounts(): Promise<Account[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('accounts')
    .select('id, name, type, is_liability, is_active')
    .eq('user_id', ownerId)
    .order('position', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Account[];
}

const PAYMENT_COLUMNS = 'id, subscription_id, amount_minor, date, account_id, category, note';

const toPayment = (row: Row): Payment => {
  const r = row as unknown as Payment;
  return { ...r, amount_minor: Number(r.amount_minor) };
};

/** One subscription's payments, newest first. */
export async function listPayments(subscriptionId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(PAYMENT_COLUMNS)
    .eq('subscription_id', subscriptionId)
    .eq('kind', 'expense')
    .order('date', { ascending: false })
    .limit(120);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPayment);
}

/** Every subscription payment in [from, to], for the calendar and insights. */
export async function listPaymentsBetween(from: string, to: string): Promise<Payment[]> {
  const ownerId = await getOwnerId();
  const { data, error } = await supabase
    .from('transactions')
    .select(PAYMENT_COLUMNS)
    .eq('user_id', ownerId)
    .eq('kind', 'expense')
    .not('subscription_id', 'is', null)
    .gte('date', from)
    .lte('date', to);
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPayment);
}

/* REMINDER DEFAULTS -------------------------------------------------------- */

/**
 * Cached per person for the life of the process: every write reschedules
 * reminders and needs these, and they change only through
 * saveReminderSettings below (or the website, which the launch resync picks
 * up by reading fresh).
 */
let settingsCache: { ownerId: string; settings: ReminderSettings } | null = null;

export async function getReminderSettings(options?: {
  fresh?: boolean;
}): Promise<ReminderSettings> {
  const ownerId = await getOwnerId();
  if (!options?.fresh && settingsCache?.ownerId === ownerId) return settingsCache.settings;

  const { data, error } = await supabase
    .from(SETTINGS)
    .select('reminder_offsets, reminder_minutes')
    .eq('user_id', ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const row = data as { reminder_offsets: number[]; reminder_minutes: number } | null;
  const settings: ReminderSettings = row
    ? { offsets: row.reminder_offsets.map(Number), minutes: Number(row.reminder_minutes) }
    : DEFAULT_REMINDER_SETTINGS;
  settingsCache = { ownerId, settings };
  return settings;
}

/** Save the defaults, then rebuild every reminder: they all just changed. */
export async function saveReminderSettings(settings: ReminderSettings): Promise<ReminderSettings> {
  const ownerId = await getOwnerId();
  const { error } = await supabase.from(SETTINGS).upsert(
    {
      user_id: ownerId,
      reminder_offsets: settings.offsets,
      reminder_minutes: settings.minutes,
    },
    { onConflict: 'user_id' },
  );
  if (error) throw new Error(error.message);

  settingsCache = { ownerId, settings };
  await resyncReminders().catch(() => {
    // Saved either way; the next launch rebuilds them.
  });
  return settings;
}

/* REMINDERS ---------------------------------------------------------------- */

/** Account names by id, remembered from the last read, for reminder bodies. */
const accountNames = new Map<string, string>();

async function accountNameFor(accountId: string | null): Promise<string | null> {
  if (!accountId) return null;
  if (!accountNames.has(accountId)) {
    const { data } = await supabase
      .from('accounts')
      .select('name')
      .eq('id', accountId)
      .maybeSingle();
    if (data) accountNames.set(accountId, (data as { name: string }).name);
  }
  return accountNames.get(accountId) ?? null;
}

/**
 * Reschedule one subscription's reminders. Never throws: the subscription has
 * already saved, and a reminder that could not be scheduled now is rebuilt at
 * the next launch.
 */
async function rescheduleQuietly(sub: Subscription): Promise<void> {
  try {
    const [settings, accountName] = await Promise.all([
      getReminderSettings(),
      accountNameFor(sub.account_id).catch(() => null),
    ]);
    await scheduleReminders(sub, settings, { accountName });
  } catch {
    // See above.
  }
}

/**
 * Rebuild every subscription reminder from the database: cancel them all,
 * then schedule each row's plan. The launch resync.
 */
export async function resyncReminders(): Promise<void> {
  const [rows, settings, accounts] = await Promise.all([
    listSubscriptions(),
    getReminderSettings({ fresh: true }),
    listAccounts().catch(() => [] as Account[]),
  ]);
  accounts.forEach((a) => accountNames.set(a.id, a.name));
  await rescheduleAll(rows, settings, (sub) => ({
    accountName: sub.account_id ? (accountNames.get(sub.account_id) ?? null) : null,
  }));
}

/**
 * Registered here, at module load, rather than in notifications.ts: the
 * resync reads the database, only this file talks to Supabase, and
 * notifications.ts cannot import this file without a cycle. This file is in
 * the app's static imports from launch (HomeScreen -> useHomeSummaries ->
 * subscriptions/api), so the app's one runResync() per launch finds it.
 */
registerResync('subscriptions', resyncReminders);
