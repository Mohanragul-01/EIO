/**
 * The icon each kind of account wears, everywhere it appears: chips, rows,
 * the Accounts screen. One table so a bank never shows as a wallet on one
 * screen and a building on another.
 */
import type { Ionicons } from '@expo/vector-icons';

import type { AccountType } from '../types';

export const ACCOUNT_ICON: Record<AccountType, keyof typeof Ionicons.glyphMap> = {
  bank: 'business-outline',
  cash: 'cash-outline',
  wallet: 'wallet-outline',
  credit_card: 'card-outline',
};
