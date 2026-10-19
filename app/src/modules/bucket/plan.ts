/**
 * plan.ts - turning a Now item from a wish into a plan.
 *
 * TARGETS SAY ONLY WHAT WAS DECIDED. "This year", "March 2027" and
 * "14 March 2027" are three different promises, and a date picker that only
 * takes exact days forces the third on someone who meant the first. So a
 * target carries its precision, and a year target runs to 31 December rather
 * than expiring on the 1st of January it is stored as.
 *
 * NO GUILT. A target that has passed is a fact with a way forward - move it to
 * next month, next year, or back to Someday - and never an "overdue" in red.
 * Guilt is how lists like this get abandoned.
 *
 * THE MONEY SENTENCE does the arithmetic you would otherwise do on a
 * calculator, in whichever direction you have the numbers for: from a target
 * month to a monthly amount, or from a monthly amount to the month it lands.
 */
import { formatMoney } from '../../core/money';
import type { Precision } from './types';
import { MONTH_SHORT, daysInMonth, formatWhen, isoOf, partsOf } from './when';

export type TargetChoice =
  | { kind: 'someday' }
  | { kind: 'year'; year: number }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'day'; iso: string };

export type Target = { target_on: string | null; target_precision: Precision | null };

export const SOMEDAY: Target = { target_on: null, target_precision: null };

export function targetFor(choice: TargetChoice): Target {
  switch (choice.kind) {
    case 'someday':
      return SOMEDAY;
    case 'year':
      return { target_on: isoOf(choice.year, 1, 1), target_precision: 'year' };
    case 'month':
      return { target_on: isoOf(choice.year, choice.month, 1), target_precision: 'month' };
    case 'day':
      return { target_on: choice.iso, target_precision: 'day' };
  }
}

/** The choice a stored target reads back as, to seed the editor. */
export function choiceOf(targetOn: string | null, precision: Precision | null): TargetChoice {
  if (!targetOn || !precision) return { kind: 'someday' };
  const { year, month } = partsOf(targetOn);
  if (precision === 'year') return { kind: 'year', year };
  if (precision === 'month') return { kind: 'month', year, month };
  return { kind: 'day', iso: targetOn };
}

/** "This year", "2027", "Mar 2027", "14 Mar 2027". */
export function formatTarget(targetOn: string, precision: Precision, today: string): string {
  if (precision === 'year' && partsOf(targetOn).year === partsOf(today).year) return 'This year';
  return formatWhen(targetOn, precision);
}

/** The last day a target still covers. */
export function targetEnd(targetOn: string, precision: Precision): string {
  const { year, month } = partsOf(targetOn);
  if (precision === 'year') return isoOf(year, 12, 31);
  if (precision === 'month') return isoOf(year, month, daysInMonth(year, month));
  return targetOn;
}

export function isTargetPassed(
  targetOn: string | null,
  precision: Precision | null,
  today: string,
): boolean {
  if (!targetOn || !precision) return false;
  return today > targetEnd(targetOn, precision);
}

/** What a passed target can become. Each is a fresh promise, not a penalty. */
export function moveOptions(today: string): { label: string; target: Target }[] {
  const { year, month } = partsOf(today);
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return [
    { label: 'Next month', target: targetFor({ kind: 'month', ...next }) },
    { label: 'Next year', target: targetFor({ kind: 'year', year: year + 1 }) },
    { label: 'Someday', target: SOMEDAY },
  ];
}

/** Calendar months from this month to the month a target ends in. */
export function monthsUntil(today: string, targetOn: string, precision: Precision): number {
  const now = partsOf(today);
  const end = partsOf(targetEnd(targetOn, precision));
  return end.year * 12 + end.month - (now.year * 12 + now.month);
}

/**
 * Up to the next whole ₹100.
 *
 * Up, never to the nearest: a plan that rounds ₹3,149 down to ₹3,100 a month
 * arrives short, and the point of the sentence is that following it works.
 */
export function roundUpToHundred(minor: number): number {
  const hundred = 100 * 100;
  return Math.ceil(minor / hundred) * hundred;
}

export type SavingsAdvice =
  | { kind: 'none' }
  | { kind: 'saved' }
  | { kind: 'to-go'; toGoMinor: number }
  | { kind: 'passed'; toGoMinor: number }
  | { kind: 'too-close'; toGoMinor: number; reach: string }
  | { kind: 'by-target'; toGoMinor: number; monthlyMinor: number; reach: string }
  | { kind: 'by-monthly'; toGoMinor: number; monthlyMinor: number; reach: string };

function monthLabel(year: number, month: number): string {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

/** The month `count` calendar months after today's. */
function monthsAfter(today: string, count: number): string {
  const { year, month } = partsOf(today);
  const absolute = year * 12 + (month - 1) + count;
  return monthLabel(Math.floor(absolute / 12), (absolute % 12) + 1);
}

/**
 * What it takes to get there.
 *
 * Counted in calendar months from this one to the target's month, one saving
 * per month after this one: Oct 2026 to Oct 2027 is twelve. A saved target
 * wins over a typed "what if" amount, because the target is the plan you
 * actually kept.
 */
export function savingsAdvice(input: {
  estMinor: number | null;
  savedMinor: number;
  targetOn: string | null;
  targetPrecision: Precision | null;
  /** An unsaved "what if I put aside…" amount. */
  monthlyMinor: number | null;
  today: string;
}): SavingsAdvice {
  const { estMinor, savedMinor, targetOn, targetPrecision, monthlyMinor, today } = input;
  if (!estMinor || estMinor <= 0) return { kind: 'none' };

  const toGoMinor = estMinor - savedMinor;
  if (toGoMinor <= 0) return { kind: 'saved' };

  if (targetOn && targetPrecision) {
    if (isTargetPassed(targetOn, targetPrecision, today)) return { kind: 'passed', toGoMinor };

    const end = partsOf(targetEnd(targetOn, targetPrecision));
    const reach = monthLabel(end.year, end.month);
    const months = monthsUntil(today, targetOn, targetPrecision);
    if (months <= 0) return { kind: 'too-close', toGoMinor, reach };

    return {
      kind: 'by-target',
      toGoMinor,
      monthlyMinor: roundUpToHundred(toGoMinor / months),
      reach,
    };
  }

  if (monthlyMinor && monthlyMinor > 0) {
    const months = Math.ceil(toGoMinor / monthlyMinor);
    return { kind: 'by-monthly', toGoMinor, monthlyMinor, reach: monthsAfter(today, months) };
  }

  return { kind: 'to-go', toGoMinor };
}

/** The sentence under the money fields. Empty when there is nothing to say. */
export function describeSavings(advice: SavingsAdvice): string {
  const money = (minor: number) => formatMoney(minor, { compact: true });

  switch (advice.kind) {
    case 'none':
      return '';
    case 'saved':
      return 'Saved in full';
    case 'to-go':
      return `${money(advice.toGoMinor)} to go`;
    case 'passed':
      return `${money(advice.toGoMinor)} to go · target passed`;
    case 'too-close':
      return `${money(advice.toGoMinor)} to go by ${advice.reach}`;
    case 'by-target':
    case 'by-monthly':
      return `${money(advice.toGoMinor)} to go · ${money(advice.monthlyMinor)} a month reaches it by ${advice.reach}`;
  }
}
