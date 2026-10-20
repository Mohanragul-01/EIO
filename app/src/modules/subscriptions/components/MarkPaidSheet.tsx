/**
 * MarkPaidSheet - "I paid this one", with the amount you were actually
 * charged.
 *
 * The amount is pre-filled and editable because the real charge differs more
 * often than not: GST, a bank's forex markup, a quiet price rise. Finance is
 * INR, so this always asks rupees. When the figure differs, the sheet offers
 * to keep it - as the new price for a rupee subscription (a rise, usually),
 * or as the new rate for a foreign one (forex, usually; off by default).
 *
 * It logs against the charged-to account so that account's balance stays
 * true. The screen closes the sheet before showing its Undo toast: a toast
 * draws beneath an open sheet.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, DateField, Sheet, TextField } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatMoney, minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { spacing } from '../../../core/theme';
import type { MarkPaidInput } from '../api';
import { addCycle, cycleOf } from '../cycles';
import { currencyDef, formatAmount, formatRate, inrOf, rateFromPayment } from '../currency';
import { shortDate } from '../format';
import type { Account, Subscription } from '../types';
import { Chip } from './Chip';

type MarkPaidSheetProps = {
  visible: boolean;
  subscription: Subscription | null;
  accounts: Account[];
  today: string;
  onClose: () => void;
  onConfirm: (input: MarkPaidInput) => void;
};

export function MarkPaidSheet({
  visible,
  subscription: sub,
  accounts,
  today,
  onClose,
  onConfirm,
}: MarkPaidSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const [amountText, setAmountText] = useState('');
  const [paidOn, setPaidOn] = useState<string | null>(today);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [keepPrice, setKeepPrice] = useState(true);
  const [keepRate, setKeepRate] = useState(false);

  /**
   * Seeded during render when the sheet opens on a subscription, not in an
   * effect: an effect would paint the previous subscription's figure for a
   * frame on the way in.
   */
  const identity = `${visible}:${sub?.id ?? ''}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    const inr = sub ? inrOf(sub) : null;
    setAmountText(inr === null ? '' : minorToAmountString(inr).replace(/\.00$/, ''));
    setPaidOn(today);
    setAccountId(sub?.account_id ?? null);
    setKeepPrice(true);
    // No rate yet: the payment is the best rate there is, so offer it on.
    setKeepRate(!!sub && sub.currency !== 'INR' && !sub.fx_rate);
  }

  if (!sub) return null;

  const cycle = cycleOf(sub);
  const next = addCycle(sub.next_due_date, cycle);
  const amountInr = parseAmountToMinor(amountText);
  const valid = amountInr !== null && amountInr > 0 && !!paidOn;
  const foreign = sub.currency !== 'INR';
  const expectedInr = inrOf(sub);

  const priceDiffers = !foreign && valid && amountInr !== sub.amount_minor;
  const paidRate = foreign && valid ? rateFromPayment(amountInr as number, sub.amount_minor) : null;
  const rateDiffers = paidRate !== null && paidRate !== sub.fx_rate;

  // Accounts you can pick: active ones, plus the linked one even if it has
  // since been closed, so the default never silently changes.
  const choices = accounts.filter((a) => a.is_active || a.id === sub.account_id);

  const confirm = () => {
    if (!valid || !paidOn) return;
    onConfirm({
      amountInrMinor: amountInr as number,
      paidOn,
      accountId,
      today,
      newAmountMinor: priceDiffers && keepPrice ? amountInr : null,
      newRate: rateDiffers && keepRate ? paidRate : null,
    });
  };

  return (
    <Sheet
      visible={visible}
      title={`Mark ${sub.name} paid`}
      subtitle={next ? `Next due moves to ${shortDate(next, today)}` : 'One-time: it moves to Archived'}
      onClose={onClose}
      footer={
        <Button
          label={valid ? `Mark paid · ${formatMoney(amountInr as number)}` : 'Mark paid'}
          icon="checkmark"
          onPress={confirm}
          disabled={!valid}
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TextField
          label="Charged (₹)"
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0"
          error={amountText && !valid ? 'Enter an amount like 649 or 649.50' : null}
          maxLength={12}
        />
        {foreign ? (
          <Text style={styles.hint}>
            {formatAmount(sub.amount_minor, sub.currency)}
            {sub.fx_rate && expectedInr !== null
              ? ` at ${formatRate(sub.fx_rate, sub.currency)} is ${formatMoney(expectedInr)}`
              : ' - no rate set yet'}
            . Enter what the bank actually took.
          </Text>
        ) : null}

        {priceDiffers ? (
          <Toggle
            checked={keepPrice}
            onPress={() => setKeepPrice(!keepPrice)}
            title="This is the new price"
            caption={`${formatMoney(sub.amount_minor)} becomes ${formatMoney(amountInr as number)} from now on, and goes in its price history`}
          />
        ) : null}
        {rateDiffers && paidRate !== null ? (
          <Toggle
            checked={keepRate}
            onPress={() => setKeepRate(!keepRate)}
            title={`Use as the rate: ${formatRate(paidRate, sub.currency)}`}
            caption={`Totals convert ${currencyDef(sub.currency).code} at this from now on`}
          />
        ) : null}

        <DateField
          label="Paid on"
          value={paidOn}
          onChange={setPaidOn}
          mode="event"
          allowClear={false}
          style={styles.field}
        />

        <Text style={[styles.label, styles.field]}>From account</Text>
        {choices.length === 0 ? (
          <Text style={styles.hint}>
            No Finance accounts yet, so it is logged without one.
          </Text>
        ) : (
          <View style={styles.chips}>
            <Chip label="No account" selected={accountId === null} onPress={() => setAccountId(null)} />
            {choices.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                icon={account.type === 'credit_card' ? 'card-outline' : 'wallet-outline'}
                selected={accountId === account.id}
                onPress={() => setAccountId(account.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
          <Text style={styles.noteText}>
            Logged to Finance as an expense under its category. You can undo it for a few seconds
            after.
          </Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** A labelled checkbox row, 48dp tall. */
function Toggle({
  checked,
  onPress,
  title,
  caption,
}: {
  checked: boolean;
  onPress: () => void;
  title: string;
  caption: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${title}. ${caption}`}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? colors.primary : colors.textMuted}
      />
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleCaption}>{caption}</Text>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  content: {
    paddingBottom: spacing.sm,
  },
  field: {
    marginTop: spacing.lg,
  },
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    ...typography.title,
    fontSize: 14,
  },
  toggleCaption: {
    ...typography.caption,
    fontSize: 12,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noteText: {
    ...typography.caption,
    fontSize: 12,
    flex: 1,
  },
}));
