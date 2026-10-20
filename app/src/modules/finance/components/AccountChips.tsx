/**
 * AccountChips - pick an account in one tap.
 *
 * Wrapping chips rather than a dropdown, for the same reason as the category
 * picker: there are a handful of accounts, seeing them all costs nothing, and
 * a dropdown is two taps for every entry. Each chip is 40dp tall with 4dp of
 * hit slop, so the touch target is 48dp without the row looking padded.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { Account } from '../types';
import { ACCOUNT_ICON } from './accountIcon';

type AccountChipsProps = {
  label: string;
  accounts: Account[];
  value: string | null;
  onChange: (id: string) => void;
  /** Shown when there are no accounts yet. */
  onAddAccount?: () => void;
  /** A short line under the chips, e.g. why nothing is selected. */
  hint?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function AccountChips({
  label,
  accounts,
  value,
  onChange,
  onAddAccount,
  hint,
  style,
}: AccountChipsProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {accounts.map((account) => {
          const selected = account.id === value;
          return (
            <Pressable
              key={account.id}
              onPress={() => onChange(account.id)}
              hitSlop={4}
              style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={account.name}
            >
              <Ionicons
                name={ACCOUNT_ICON[account.type]}
                size={15}
                color={selected ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.chipText, selected && styles.chipTextSelected]} numberOfLines={1}>
                {account.name}
              </Text>
            </Pressable>
          );
        })}

        {accounts.length === 0 && onAddAccount ? (
          <Pressable
            onPress={onAddAccount}
            hitSlop={4}
            style={({ pressed }) => [styles.chip, styles.addChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add an account"
          >
            <Ionicons name="add" size={15} color={colors.primary} />
            <Text style={[styles.chipText, styles.chipTextSelected]}>Add an account</Text>
          </Pressable>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipSelected: {
    backgroundColor: colors.primary + '24',
    borderColor: colors.primary + '80',
  },
  addChip: {
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: 0.7,
  },
  chipText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  chipTextSelected: {
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
}));
