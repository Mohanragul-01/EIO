/**
 * categories.ts - the shared catalogue of ledger categories.
 *
 * WHY THIS MOVED OUT OF modules/finance/:
 * Same reasoning as core/ledger.ts. Categories started as Finance's private
 * concern, but Subscriptions now needs them too - each subscription picks the
 * category its payment is logged under. Two modules needing the same thing
 * means it belongs in core, not imported sideways between modules.
 *
 * The rule this keeps producing: when a second module needs something, the
 * thing moves DOWN into core; it never moves ACROSS between modules.
 *
 * The database column is plain `text`, so this list can grow or be renamed
 * without a migration. Rows referencing a category that no longer exists fall
 * back to a neutral style rather than crashing - see categoryDef().
 */
import type { Ionicons } from '@expo/vector-icons';


/** Fallback tint for a category key that is no longer in the list. */
const NEUTRAL = '#8B93A5';

export type CategoryDef = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const EXPENSE_CATEGORIES: CategoryDef[] = [
  { key: 'food', label: 'Food', icon: 'restaurant-outline', color: '#FB923C' },
  { key: 'groceries', label: 'Groceries', icon: 'basket-outline', color: '#34D399' },
  { key: 'transport', label: 'Transport', icon: 'car-outline', color: '#60A5FA' },
  { key: 'bills', label: 'Bills', icon: 'receipt-outline', color: '#F472B6' },
  { key: 'rent', label: 'Rent', icon: 'home-outline', color: '#A78BFA' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-handle-outline', color: '#FBBF24' },
  { key: 'health', label: 'Health', icon: 'medkit-outline', color: '#F87171' },
  { key: 'fun', label: 'Fun', icon: 'game-controller-outline', color: '#22D3EE' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#94A3B8' },
];

export const INCOME_CATEGORIES: CategoryDef[] = [
  { key: 'salary', label: 'Salary', icon: 'wallet-outline', color: '#34D399' },
  { key: 'freelance', label: 'Freelance', icon: 'laptop-outline', color: '#60A5FA' },
  { key: 'refund', label: 'Refund', icon: 'return-down-back-outline', color: '#FBBF24' },
  { key: 'other-income', label: 'Other', icon: 'add-circle-outline', color: '#94A3B8' },
];

export function categoriesFor(kind: 'expense' | 'income'): CategoryDef[] {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * Look up a category's presentation. Falls back to a neutral style rather than
 * throwing, so a row saved under a category that was later removed still
 * renders - old data outliving a code change is normal, not exceptional.
 */
export function categoryDef(key: string): CategoryDef {
  const found = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].find((c) => c.key === key);
  return (
    found ?? {
      key,
      label: key,
      icon: 'pricetag-outline',
      color: NEUTRAL,
    }
  );
}

/** Sensible default for anything recurring. */
export const DEFAULT_SUBSCRIPTION_CATEGORY = 'bills';
