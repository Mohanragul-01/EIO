/**
 * capture.ts - the eio://finance/add link, turned into a pre-filled form.
 *
 * Stage 0 of the capture plan (docs/research/finance.md §5.2): an automation
 * app the person already trusts (MacroDroid, Tasker) reads the bank's SMS
 * notification and opens
 *
 *   eio://finance/add?amount=250&note=Swiggy&category=food
 *
 * so EIO never holds a notification-access or SMS permission. The link opens
 * the add form, filled in; it never saves on its own. That form is the review
 * step every auto-capture app needs, because parsing a bank's message goes
 * wrong in ways that look right.
 *
 * EVERY PARAMETER IS UNTRUSTED. It came from outside the app. The rules:
 *  - amount is in RUPEES (what the message says) and becomes paise here;
 *  - anything unusable is dropped with a reason the form shows, and the form
 *    is left blank where it was - never a silent ₹0, never a guess;
 *  - parameters it does not know (an `id`, say) are ignored entirely, so a
 *    link cannot point the form at an existing row.
 *
 * Accepted: amount, note, category, and three the spec does not name but a
 * bank alert carries - kind (expense / income, or debit / credit), account
 * (matched by name in the form) and date.
 */
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../core/categories';
import { formatMoney, parseAmountToMinor } from '../../core/money';
import type { EntryKind, Transaction } from './types';

/** ₹10 crore. Nothing an automation reads off one notification is bigger. */
export const MAX_CAPTURE_MINOR = 10_000_000_000;

const NOTE_MAX = 200;
const ACCOUNT_MAX = 60;

const KIND_WORDS: Record<string, EntryKind> = {
  expense: 'expense',
  debit: 'expense',
  debited: 'expense',
  spent: 'expense',
  paid: 'expense',
  income: 'income',
  credit: 'income',
  credited: 'income',
  received: 'income',
};

const FIELDS = ['amount', 'note', 'category', 'kind', 'account', 'date'] as const;

/** Raw text from outside, shown in a reason: short, so garbage cannot fill the screen. */
function quote(raw: string): string {
  const flat = raw.replace(/\s+/g, ' ').trim();
  return `"${flat.length > 24 ? `${flat.slice(0, 24)}…` : flat}"`;
}

export function parseCaptureAmount(raw: string): { minor: number } | { error: string } {
  // "Rs. 1,299.50" and "INR 500" are how Indian bank messages write money.
  // The ₹ sign, commas and spaces are parseAmountToMinor's own job.
  const cleaned = raw.trim().replace(/^(rs\.?|inr)\s*/i, '');
  const minor = parseAmountToMinor(cleaned);

  if (minor === null) return { error: `The amount ${quote(raw)} is not a number of rupees, so it was left blank.` };
  if (minor === 0) return { error: 'The amount was zero, so it was left blank.' };
  if (minor > MAX_CAPTURE_MINOR) {
    return { error: `The amount ${quote(raw)} is more than ${formatMoney(MAX_CAPTURE_MINOR, { compact: true })}, so it was left blank.` };
  }
  return { minor };
}

export type CapturePrefill = {
  amountMinor: number | null;
  note: string;
  kind: EntryKind;
  category: string | null;
  /** A name for the form to match against your accounts. */
  account: string | null;
  date: string | null;
};

export type CaptureResult = {
  prefill: CapturePrefill;
  /** One sentence per parameter that could not be used. */
  ignored: string[];
  /** Whether the link carried anything this understands at all. */
  provided: boolean;
};

function isRealPastDate(iso: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // 2026-02-30 becomes 2 March: a date that does not round-trip is not real.
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  return real && iso <= today;
}

export function parseCaptureParams(params: Record<string, unknown> | undefined, today: string): CaptureResult {
  const read = (key: string): string | undefined => {
    let value = params?.[key];
    // A repeated parameter arrives as an array; the first is what was meant.
    if (Array.isArray(value)) value = value[0];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' ? value : undefined;
  };

  const ignored: string[] = [];
  const prefill: CapturePrefill = {
    amountMinor: null,
    note: '',
    kind: 'expense',
    category: null,
    account: null,
    date: null,
  };
  const provided = FIELDS.some((field) => read(field) !== undefined);

  const amount = read('amount');
  if (amount !== undefined && amount.trim() !== '') {
    const parsed = parseCaptureAmount(amount);
    if ('minor' in parsed) prefill.amountMinor = parsed.minor;
    else ignored.push(parsed.error);
  }

  const note = read('note');
  if (note !== undefined) {
    // Control characters (a newline from a two-line notification, a NUL) have
    // no business in a one-line note.
    const printable = Array.from(note, (ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? ' ' : ch;
    }).join('');
    const clean = printable.replace(/\s+/g, ' ').trim();
    if (clean.length > NOTE_MAX) {
      prefill.note = clean.slice(0, NOTE_MAX);
      ignored.push(`The note was cut to ${NOTE_MAX} characters.`);
    } else {
      prefill.note = clean;
    }
  }

  const kind = read('kind');
  let kindGiven = false;
  if (kind !== undefined && kind.trim() !== '') {
    const known = KIND_WORDS[kind.trim().toLowerCase()];
    if (known) {
      prefill.kind = known;
      kindGiven = true;
    } else {
      ignored.push(`The type ${quote(kind)} is not expense or income, so it was set to expense.`);
    }
  }

  const category = read('category');
  if (category !== undefined && category.trim() !== '') {
    const needle = category.trim().toLowerCase();
    const find = (list: typeof EXPENSE_CATEGORIES) =>
      list.find((c) => c.key === needle || c.label.toLowerCase() === needle);
    const expense = find(EXPENSE_CATEGORIES);
    const income = find(INCOME_CATEGORIES);

    if (!expense && !income) {
      ignored.push(`There is no category ${quote(category)}, so your usual one was kept.`);
    } else if (!kindGiven) {
      // "category=salary" with no type means income: the category says so.
      const match = expense ?? income!;
      prefill.kind = expense ? 'expense' : 'income';
      prefill.category = match.key;
    } else {
      const match = prefill.kind === 'expense' ? expense : income;
      if (match) prefill.category = match.key;
      else ignored.push(`${quote(category)} is not ${prefill.kind === 'expense' ? 'an expense' : 'an income'} category, so your usual one was kept.`);
    }
  }

  const account = read('account');
  if (account !== undefined && account.trim() !== '') {
    prefill.account = account.trim().slice(0, ACCOUNT_MAX);
  }

  const date = read('date');
  if (date !== undefined && date.trim() !== '') {
    if (isRealPastDate(date.trim(), today)) prefill.date = date.trim();
    else ignored.push(`The date ${quote(date)} is not a past day written as YYYY-MM-DD, so today was used.`);
  }

  return { prefill, ignored, provided };
}

/**
 * An entry logged in the last few minutes for the same amount and kind.
 *
 * One UPI payment often produces two notifications (the UPI app's and the
 * bank's SMS), and an automation that fires on both opens this form twice.
 * The form warns rather than refuses: two ₹20 chais in ten minutes is real.
 */
export function findLikelyDuplicate<T extends Pick<Transaction, 'amount_minor' | 'kind' | 'created_at'>>(
  candidate: { amountMinor: number | null; kind: EntryKind },
  recent: T[],
  now: Date,
  windowMinutes = 10,
): T | null {
  if (candidate.amountMinor === null) return null;
  const windowMs = windowMinutes * 60_000;
  return (
    recent.find(
      (row) =>
        row.kind === candidate.kind &&
        row.amount_minor === candidate.amountMinor &&
        Math.abs(now.getTime() - Date.parse(row.created_at)) <= windowMs,
    ) ?? null
  );
}
