/**
 * AccountSheet - add an account, or change, archive or delete one.
 *
 * ARCHIVE, NOT DELETE, for an account with entries. 0008 sets a deleted
 * account's entries to "no account", which would quietly strip their history
 * and move their money out of every balance. Archiving hides the account from
 * the pickers and keeps everything; it is undoable from the toast. Delete is
 * offered only for an account nothing has been logged to, and is confirmed,
 * because it is permanent.
 */
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Button, SegmentedControl, Sheet, TextField } from '../../../core/components';
import { minorToAmountString } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABEL, parseSignedAmount } from '../accounts';
import type { Account, AccountInput, AccountType } from '../types';

type AccountSheetProps = {
  visible: boolean;
  /** The account being changed, or null to add one. */
  account: Account | null;
  entryCount: number;
  onClose: () => void;
  onSave: (input: AccountInput) => Promise<void>;
  onSetActive: (account: Account, active: boolean) => void;
  onDelete: (account: Account) => Promise<void>;
};

export function AccountSheet({
  visible,
  account,
  entryCount,
  onClose,
  onSave,
  onSetActive,
  onDelete,
}: AccountSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('');
  const [liability, setLiability] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [openingError, setOpeningError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const identity = `${visible}:${account?.id ?? 'new'}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setName(account?.name ?? '');
    setType(account?.type ?? 'bank');
    setOpening(
      account && account.opening_balance_minor !== 0
        ? minorToAmountString(account.opening_balance_minor).replace(/\.00$/, '')
        : '',
    );
    setLiability(account?.is_liability ?? false);
    setNameError(null);
    setOpeningError(null);
  }

  const changeType = (next: AccountType) => {
    setType(next);
    // A card is money you owe; anything else is money you have. The switch is
    // still there for the odd case (an overdraft account, a prepaid card).
    setLiability(next === 'credit_card');
  };

  const save = async () => {
    const cleanName = name.trim();
    const openingMinor = parseSignedAmount(opening);
    setNameError(cleanName ? null : 'Give it a name, like HDFC or Cash');
    setOpeningError(openingMinor === null ? 'Enter an amount like 12500, or leave it blank' : null);
    if (!cleanName || openingMinor === null) return;

    setSaving(true);
    try {
      await onSave({
        name: cleanName,
        type,
        opening_balance_minor: openingMinor,
        is_liability: liability,
      });
      onClose();
    } catch (e) {
      setNameError(e instanceof Error ? e.message : 'Could not save that account');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () => {
    if (!account) return;
    Alert.alert('Delete account', `"${account.name}" is deleted. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onClose();
          void onDelete(account);
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      title={account ? account.name : 'Add an account'}
      subtitle={
        account
          ? `${ACCOUNT_TYPE_LABEL[account.type]} · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`
          : 'A bank, a wallet, your cash, or a card'
      }
      onClose={onClose}
      footer={<Button label={account ? 'Save' : 'Add account'} icon="checkmark" onPress={() => void save()} loading={saving} />}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField
          label="Name"
          value={name}
          error={nameError}
          onChangeText={(text) => {
            setName(text);
            if (nameError) setNameError(null);
          }}
          placeholder="HDFC"
          maxLength={40}
        />

        <SegmentedControl
          label="Type"
          options={ACCOUNT_TYPES}
          value={type}
          onChange={changeType}
          renderLabel={(t) => (t === 'credit_card' ? 'Card' : ACCOUNT_TYPE_LABEL[t])}
          style={styles.spaced}
        />

        <TextField
          label={liability ? 'What you owed when you started logging (₹)' : 'Balance when you started logging (₹)'}
          value={opening}
          error={openingError}
          onChangeText={(text) => {
            setOpening(text);
            if (openingError) setOpeningError(null);
          }}
          keyboardType="numbers-and-punctuation"
          placeholder="0"
          maxLength={14}
          style={styles.spaced}
        />
        <Text style={styles.note}>
          Its balance is this plus everything logged to it since.
          {liability ? ' Spending on it raises what you owe; paying it off lowers it.' : ''}
        </Text>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Money you owe</Text>
            <Text style={styles.note}>Counts against your balance, like a credit card.</Text>
          </View>
          <Switch
            value={liability}
            onValueChange={setLiability}
            trackColor={{ true: colors.primary, false: colors.glassStrong }}
            thumbColor={colors.backgroundElevated}
            accessibilityLabel="Money you owe"
          />
        </View>

        {account ? (
          <View style={styles.danger}>
            <Pressable
              onPress={() => {
                onClose();
                onSetActive(account, !account.is_active);
              }}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityLabel={account.is_active ? `Archive ${account.name}` : `Bring back ${account.name}`}
            >
              <Text style={styles.textButtonLabel}>
                {account.is_active ? 'Archive this account' : 'Bring this account back'}
              </Text>
            </Pressable>
            {entryCount === 0 ? (
              <Pressable
                onPress={confirmDelete}
                style={styles.textButton}
                accessibilityRole="button"
                accessibilityLabel={`Delete ${account.name}`}
              >
                <Text style={[styles.textButtonLabel, { color: colors.danger }]}>Delete this account</Text>
              </Pressable>
            ) : (
              <Text style={styles.note}>
                Archiving hides it from the pickers; its {entryCount}{' '}
                {entryCount === 1 ? 'entry stays' : 'entries stay'}, and so does its balance. An
                account with entries cannot be deleted, so its history is never lost.
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: {
    marginTop: spacing.xl,
  },
  note: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    minHeight: 48,
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
  },
  switchLabel: {
    ...typography.body,
    color: colors.text,
  },
  danger: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  textButton: {
    minHeight: 48,
    justifyContent: 'center',
  },
  textButtonLabel: {
    ...typography.body,
    color: colors.primary,
  },
}));
