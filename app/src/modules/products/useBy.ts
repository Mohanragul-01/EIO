/**
 * useBy.ts - when a product stops being usable, whether or not it is empty.
 *
 * Two dates can end a product's life before the last gram is used: the one
 * printed on the pack, and the period after opening (the open-jar "12M").
 * Use-by is the EARLIER of the two, because opening can only bring the end
 * forward, never push it back - Grocy's rule for "due days after opened", and
 * the one every pack's small print implies.
 *
 * The measured rate makes one more thing cheap to say, which none of the apps
 * studied does: "At your pace this lasts 140 days; it expires in 90."
 *
 * Pure, so both clients share it.
 */
import { daysBetween, formatDayMonth } from './types';

/** The use-by warning starts this many days ahead (spec §9). */
export const USE_BY_WARNING_DAYS = 30;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, month, 0).getDate();
}

/**
 * A calendar date moved by whole months, the day clamped to the end of a
 * shorter month: six months after 31 August is 28 February, not 3 March.
 */
export function addMonthsISO(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const absolute = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(absolute / 12);
  const targetMonth = (absolute % 12) + 1;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${pad(targetMonth)}-${pad(targetDay)}`;
}

/**
 * The last day a container should be used.
 *
 * A spare has no period-after-opening clock yet, so only its printed date
 * applies. A finished container has none at all: it is gone.
 */
export function usableUntil(product: {
  opened_on: string | null;
  finished_on: string | null;
  expires_on: string | null;
  pao_months: number | null;
}): string | null {
  if (product.finished_on) return null;

  const afterOpening =
    product.opened_on && product.pao_months
      ? addMonthsISO(product.opened_on, product.pao_months)
      : null;

  const candidates = [product.expires_on, afterOpening].filter((d): d is string => !!d);
  if (candidates.length === 0) return null;
  return candidates.sort()[0];
}

export type UseByState = 'soon' | 'expired';

/**
 * Whether the use-by date needs a chip yet. "Soon" from 30 days before
 * through the day itself - "use by 3 Jan" still means usable on the 3rd - and
 * "expired" from the day after.
 */
export function usableState(useBy: string | null, today: string): UseByState | null {
  if (!useBy) return null;
  const days = daysBetween(today, useBy);
  if (days < 0) return 'expired';
  if (days <= USE_BY_WARNING_DAYS) return 'soon';
  return null;
}

/** "Use by 3 Jan", "Use by today", "Expired 18 Oct". */
export function usableLabel(useBy: string, today: string): string {
  const days = daysBetween(today, useBy);
  if (days < 0) return `Expired ${formatDayMonth(useBy, today)}`;
  if (days === 0) return 'Use by today';
  if (days === 1) return 'Use by tomorrow';
  return `Use by ${formatDayMonth(useBy, today)}`;
}

export type ExpiryConflict = { lastsDays: number; expiresInDays: number };

/**
 * The supply outlasts the shelf life: at the measured pace there will still
 * be some left when it should no longer be used.
 *
 * Strictly more days than remain, since finishing on the use-by day is
 * finishing in time. An already-expired product is left to its "Expired"
 * chip, which says it more plainly.
 */
export function expiryConflict(
  daysLeft: number | null,
  useBy: string | null,
  today: string,
): ExpiryConflict | null {
  if (daysLeft === null || !useBy) return null;
  const expiresInDays = daysBetween(today, useBy);
  if (expiresInDays < 0) return null;
  return daysLeft > expiresInDays ? { lastsDays: daysLeft, expiresInDays } : null;
}

export function conflictMessage(conflict: ExpiryConflict): string {
  const lasts = conflict.lastsDays === 1 ? '1 day' : `${conflict.lastsDays} days`;
  const expires =
    conflict.expiresInDays === 0
      ? 'today'
      : conflict.expiresInDays === 1
        ? 'tomorrow'
        : `in ${conflict.expiresInDays}`;
  return `At your pace this lasts ${lasts}; it expires ${expires}.`;
}

export type ParsedExpiry = { ok: true; value: string | null } | { ok: false };

function valid(year: number, month: number, day: number): boolean {
  return (
    year >= 2000 &&
    year <= 2100 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

/**
 * Read an expiry date the way it is printed on the pack.
 *
 * Packs mostly print a month and a year ("EXP 03/2027"), which means "good
 * through March", so a month-only date becomes that month's last day. A full
 * date is DAY FIRST, as India writes it. Two-digit years are this century.
 * Slashes, dashes, dots or spaces all separate; an ISO date is accepted too,
 * because that is what the website's own date fields produce.
 *
 * An empty field is a valid answer - no expiry - and comes back as null.
 */
export function parseExpiry(text: string): ParsedExpiry {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    const [year, month, day] = iso.slice(1).map(Number);
    return valid(year, month, day)
      ? { ok: true, value: `${year}-${pad(month)}-${pad(day)}` }
      : { ok: false };
  }

  const parts = trimmed.split(/[\s/.-]+/);
  if (!parts.every((part) => /^\d{1,4}$/.test(part))) return { ok: false };

  const toYear = (raw: string) => (raw.length <= 2 ? 2000 + Number(raw) : Number(raw));

  if (parts.length === 2) {
    const month = Number(parts[0]);
    const year = toYear(parts[1]);
    if (!valid(year, month, 1)) return { ok: false };
    return { ok: true, value: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}` };
  }

  if (parts.length === 3) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    const year = toYear(parts[2]);
    if (!valid(year, month, day)) return { ok: false };
    return { ok: true, value: `${year}-${pad(month)}-${pad(day)}` };
  }

  return { ok: false };
}

/**
 * A stored expiry written back for editing. A month's last day goes back as
 * "MM/YYYY", which is almost always how it was typed, so opening the form
 * shows what was on the pack rather than a day nobody entered.
 */
export function formatExpiryInput(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  if (day === daysInMonth(year, month)) return `${pad(month)}/${year}`;
  return `${pad(day)}/${pad(month)}/${year}`;
}
