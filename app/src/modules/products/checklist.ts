/**
 * checklist.ts - the Today checklist.
 *
 * Logging three daily supplements and two skincare steps used to be five
 * separate cards, each a tap into its own row. The checklist puts the things
 * you use every day at the top as check rows: tap logs today's usual amount,
 * tap again takes it back, and "Log all" does the lot. Complete daily logs are
 * also what keep the measured rate honest, so the fastest path and the most
 * accurate one are the same path.
 *
 * WHICH PRODUCTS: inferred, not configured - anything used on at least 5 of
 * the last 7 days. No schedule to set up, and a product drops off on its own
 * when you stop using it daily.
 *
 * THE LAST 7 DAYS means the seven days BEFORE today. If today counted,
 * ticking a row could be what put it on the list, and un-ticking it - the
 * documented way to take a tick back - would make the row disappear from
 * under your finger.
 */
import { lifecycleOf } from './containers';
import { addDays, type Product, type ProductUse } from './types';

/** Used on at least this many of the window's days to appear. */
export const CHECKLIST_MIN_DAYS = 5;
export const CHECKLIST_WINDOW_DAYS = 7;

export type ChecklistRow = {
  product: Product;
  /** What one tap logs: the per-use amount, or 1 when it was never measured. */
  amount: number;
  /** Today's uses of it, newest first - un-ticking removes the first. */
  todayUses: ProductUse[];
  done: boolean;
};

export function todayChecklist(
  products: Product[],
  uses: ProductUse[],
  today: string,
): ChecklistRow[] {
  const windowStart = addDays(today, -CHECKLIST_WINDOW_DAYS);

  // Distinct days in the window, per product. A twice-a-day face wash used
  // morning and evening is still one day.
  const daysUsed = new Map<string, Set<string>>();
  const usedToday = new Map<string, ProductUse[]>();

  uses.forEach((use) => {
    if (use.used_on === today) {
      const list = usedToday.get(use.product_id) ?? [];
      list.push(use);
      usedToday.set(use.product_id, list);
      return;
    }
    if (use.used_on < windowStart || use.used_on > today) return;
    const days = daysUsed.get(use.product_id) ?? new Set<string>();
    days.add(use.used_on);
    daysUsed.set(use.product_id, days);
  });

  return products
    .filter(
      (product) =>
        lifecycleOf(product) === 'in_use' &&
        (daysUsed.get(product.id)?.size ?? 0) >= CHECKLIST_MIN_DAYS,
    )
    .map((product) => {
      const todayUses = [...(usedToday.get(product.id) ?? [])].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      );
      return {
        product,
        amount: product.per_use ?? 1,
        todayUses,
        done: todayUses.length > 0,
      };
    })
    // Name order, done or not. Sinking ticked rows to the bottom would move
    // the row you just tapped, and tapping it again is how a tick is undone.
    .sort((a, b) =>
      a.product.name.localeCompare(b.product.name, undefined, { sensitivity: 'base' }),
    );
}
