/**
 * BudgetSheet - set, change or remove one category's monthly limit.
 *
 * Shows what that category has cost so far this month while you type the
 * limit: a number picked without that context is a guess.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { EXPENSE_CATEGORIES, categoryDef } from '../../../core/categories';
import { Button, Sheet, TextField } from '../../../core/components';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { Budget } from '../types';
import { CategoryGrid } from './CategoryGrid';

type BudgetSheetProps = {
  visible: boolean;
  /** The budget being changed, or null to set a new one. */
  budget: Budget | null;
  /** Pre-selects the category for a new budget. */
  initialCategory?: string | null;
  budgetedCategories: Set<string>;
  spentByCategory: Map<string, number>;
  onClose: () => void;
  onSave: (category: string, amountMinor: number) => Promise<void>;
  onRemove: (budget: Budget) => void;
};

export function BudgetSheet({
  visible,
  budget,
  initialCategory,
  budgetedCategories,
  spentByCategory,
  onClose,
  onSave,
  onRemove,
}: BudgetSheetProps) {
  const styles = useStyles();

  const available = EXPENSE_CATEGORIES.filter((c) => !budgetedCategories.has(c.key));

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed when the sheet opens, during render rather than in an effect, so the
  // previous budget's figure never flashes for a frame (see bucket/ItemSheet).
  const identity = `${visible}:${budget?.id ?? 'new'}:${initialCategory ?? ''}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setCategory(budget?.category ?? initialCategory ?? available[0]?.key ?? '');
    setAmount(budget ? minorToAmountString(budget.amount_minor).replace(/\.00$/, '') : '');
    setError(null);
  }

  const label = categoryDef(category).label;
  const spent = spentByCategory.get(category) ?? 0;

  const save = async () => {
    const minor = parseAmountToMinor(amount);
    if (!category) return setError('Pick a category');
    if (minor === null || minor <= 0) return setError('Enter a monthly limit like 5000');
    setSaving(true);
    setError(null);
    try {
      await onSave(category, minor);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that budget');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title={budget ? `${label} budget` : 'Set a budget'}
      subtitle={category ? `${formatMoney(spent, { compact: true })} spent on ${label} so far this month` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button label={budget ? 'Save limit' : 'Set limit'} icon="checkmark" onPress={() => void save()} loading={saving} />
          {budget ? (
            <Pressable
              onPress={() => {
                onClose();
                onRemove(budget);
              }}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${label} budget`}
            >
              <Text style={styles.removeText}>Remove this budget</Text>
            </Pressable>
          ) : null}
        </>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!budget ? (
          available.length > 0 ? (
            <CategoryGrid
              label="Category"
              options={available}
              value={category}
              onChange={setCategory}
              style={styles.spaced}
            />
          ) : (
            <Text style={styles.note}>Every category already has a budget.</Text>
          )
        ) : null}

        <TextField
          label="Monthly limit (₹)"
          value={amount}
          error={error}
          onChangeText={(text) => {
            setAmount(text);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="5000"
          maxLength={12}
        />
        <Text style={styles.note}>
          The same limit applies every month. The bar on the Budgets tab shows how far through it
          you are against how far through the month.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: {
    marginBottom: spacing.xl,
  },
  note: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  remove: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  removeText: {
    ...typography.body,
    color: colors.danger,
  },
}));
