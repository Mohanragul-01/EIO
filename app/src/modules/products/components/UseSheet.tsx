/**
 * UseSheet - log a use for a chosen day, or correct one already logged.
 *
 * One sheet for both, because they are the same three facts - which day, how
 * much, a note - and a correction should feel like logging it right the
 * first time, not like a different form.
 *
 * Logging opens from a long-press on "Log use" and from tapping a day in the
 * fortnight strip; the amount is pre-filled with the usual per-use amount so
 * the common case is one tap on the button. Editing opens from a history row,
 * and its Delete takes back only that one use - never "all of them", the
 * option Medisafe users delete their history with by accident.
 *
 * The sheet saves and reports errors itself; the parent closes it on success
 * and only then shows the undo toast, which would otherwise draw beneath the
 * sheet's window.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';

import { Button, Sheet, TextField } from '../../../core/components';
import { formatEventDate } from '../../../core/date';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { formatQuantity, type Product, type ProductUse } from '../types';
import { DayChoice } from './DayChoice';

export type UseSheetMode = { kind: 'log'; day: string } | { kind: 'edit'; use: ProductUse };

export type UseDraft = { quantity: number; usedOn: string; note: string };

type UseSheetProps = {
  visible: boolean;
  product: Product;
  mode: UseSheetMode;
  today: string;
  /** Days that already have a use, dotted in the calendar. */
  logged: Set<string>;
  onClose: () => void;
  /** Resolves true when it saved. */
  onSubmit: (draft: UseDraft) => Promise<boolean>;
  /** Edit mode only. */
  onDelete?: (use: ProductUse) => void;
};

export function UseSheet({
  visible,
  product,
  mode,
  today,
  logged,
  onClose,
  onSubmit,
  onDelete,
}: UseSheetProps) {
  const styles = useStyles();

  const [day, setDay] = useState(today);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Seed the fields whenever the sheet opens, or opens on something else.
   * During render rather than in an effect, so it never paints the previous
   * entry's values for a frame on the way in.
   */
  const identity = `${visible}:${mode.kind === 'edit' ? mode.use.id : `log-${mode.day}`}`;
  const [seeded, setSeeded] = useState<string | null>(null);
  if (seeded !== identity) {
    setSeeded(identity);
    if (mode.kind === 'edit') {
      setDay(mode.use.used_on);
      setAmount(String(mode.use.quantity));
      setNote(mode.use.note);
    } else {
      setDay(mode.day);
      // The usual amount, or 1 when it was never measured: recording THAT it
      // was used is what the rate is built from.
      setAmount(String(product.per_use ?? 1));
      setNote('');
    }
    setAmountError(null);
    setError(null);
  }

  const submit = async () => {
    const quantity = Number(amount.trim().replace(',', '.'));
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setAmountError('How much did you use?');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const ok = await onSubmit({ quantity, usedOn: day, note: note.trim() });
      if (!ok) setError('That did not save. Check your connection and try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save');
    } finally {
      setSaving(false);
    }
  };

  const editing = mode.kind === 'edit';
  const title = editing ? 'Edit this use' : `Log ${product.name}`;
  const subtitle = editing
    ? `${formatQuantity(mode.use.quantity, product.unit)} logged ${formatEventDate(mode.use.used_on)}`
    : product.per_use !== null
      ? `Usually ${formatQuantity(product.per_use, product.unit)} a time`
      : product.name;

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <Button
            label={editing ? 'Save' : day === today ? 'Log it' : `Log for ${formatEventDate(day)}`}
            icon={editing ? 'checkmark' : 'add'}
            onPress={() => void submit()}
            loading={saving}
          />
          {editing && onDelete ? (
            <Pressable
              onPress={() => onDelete(mode.use)}
              style={styles.delete}
              accessibilityRole="button"
              accessibilityLabel={`Delete this use: ${formatQuantity(mode.use.quantity, product.unit)} ${formatEventDate(mode.use.used_on)}`}
            >
              <Text style={styles.deleteText}>Delete this use</Text>
            </Pressable>
          ) : null}
        </>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <DayChoice
          value={day}
          onChange={setDay}
          min={product.opened_on}
          max={today}
          marked={logged}
        />

        <TextField
          label={`Amount (${product.unit})`}
          value={amount}
          error={amountError}
          onChangeText={(text) => {
            setAmount(text);
            if (amountError) setAmountError(null);
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.spaced}
        />

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          maxLength={200}
          style={styles.spaced}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: { marginTop: spacing.lg },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
  delete: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  deleteText: { ...typography.caption, color: colors.danger },
}));
