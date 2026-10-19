/**
 * QuickAddSheet - change a pinned quick-add's words or amount, or unpin it.
 *
 * Unpinning is undoable (the toast after the sheet closes), so it is not
 * confirmed. Nothing logged from the pin is touched either way.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { Button, Sheet, TextField } from '../../../core/components';
import { minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { QuickAdd, QuickAddInput } from '../types';

type QuickAddSheetProps = {
  quickAdd: QuickAdd | null;
  accountName: string | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<QuickAddInput>) => Promise<void>;
  onUnpin: (quickAdd: QuickAdd) => void;
};

export function QuickAddSheet({ quickAdd, accountName, onClose, onSave, onUnpin }: QuickAddSheetProps) {
  const styles = useStyles();
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const identity = quickAdd?.id ?? '';
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setNote(quickAdd?.note ?? '');
    setAmount(quickAdd ? minorToAmountString(quickAdd.amount_minor).replace(/\.00$/, '') : '');
    setError(null);
  }

  if (!quickAdd) return null;

  const save = async () => {
    const minor = parseAmountToMinor(amount);
    if (!note.trim()) return setError('Give it a name, like Chai');
    if (minor === null || minor <= 0) return setError('Enter an amount like 20');
    setSaving(true);
    setError(null);
    try {
      await onSave(quickAdd.id, { note: note.trim(), amount_minor: minor });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const context = [categoryDef(quickAdd.category).label, accountName ?? 'your last-used account'].join(' · ');

  return (
    <Sheet
      visible
      title="Quick add"
      subtitle={context}
      onClose={onClose}
      footer={
        <>
          <Button label="Save" icon="checkmark" onPress={() => void save()} loading={saving} />
          <Pressable
            onPress={() => {
              onClose();
              onUnpin(quickAdd);
            }}
            style={styles.unpin}
            accessibilityRole="button"
            accessibilityLabel={`Unpin ${quickAdd.note}`}
          >
            <Text style={styles.unpinText}>Unpin</Text>
          </Pressable>
        </>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField
          label="Name"
          value={note}
          onChangeText={(text) => {
            setNote(text);
            if (error) setError(null);
          }}
          placeholder="Chai"
          maxLength={60}
        />
        <TextField
          label="Amount (₹)"
          value={amount}
          error={error}
          onChangeText={(text) => {
            setAmount(text);
            if (error) setError(null);
          }}
          keyboardType="decimal-pad"
          maxLength={12}
          style={styles.spaced}
        />
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: {
    marginTop: spacing.lg,
  },
  unpin: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  unpinText: {
    ...typography.body,
    color: colors.danger,
  },
}));
