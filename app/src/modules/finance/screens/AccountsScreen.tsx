/**
 * AccountsScreen - every account and what is in it; every card and what you
 * owe on it.
 *
 * A UPI payment from the bank, an ATM withdrawal and a card bill are three
 * different events, and only accounts tell them apart. Each balance here is
 * its opening balance plus everything logged to it (accounts.ts), never a
 * stored number. Entries with no account - logged before accounts existed, or
 * by Subscriptions' mark-paid - are counted on their own line, so the rows add
 * up to the headline balance exactly.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, FadeInView, GlassCard, Screen, useToast } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { ACCOUNT_TYPE_LABEL, type AccountBalance } from '../accounts';
import { formatBalance } from '../analytics';
import type { Account } from '../types';
import { useAccounts } from '../useAccounts';
import { AccountSheet } from '../components/AccountSheet';
import { ACCOUNT_ICON } from '../components/accountIcon';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FinanceAccounts'>;

export function AccountsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const toast = useToast();
  const { accounts, summary, loading, refreshing, error, refresh, create, update, setActive, remove } =
    useAccounts();

  const [sheet, setSheet] = useState<{ account: Account | null } | null>(null);

  const entryCount = (id: string | undefined) =>
    [...summary.assets, ...summary.liabilities].find((b) => b.account.id === id)?.entryCount ?? 0;

  const archive = async (account: Account, active: boolean) => {
    if (!(await setActive(account, active))) return;
    toast.show({
      message: active ? `${account.name} is back` : `Archived ${account.name}`,
      actionLabel: 'Undo',
      onAction: () => void setActive({ ...account, is_active: active }, !active),
    });
  };

  const renderRow = (balance: AccountBalance, owed: boolean) => {
    const { account } = balance;
    const amount = owed
      ? formatMoney(balance.balanceMinor, { compact: true })
      : formatBalance(balance.balanceMinor);
    return (
      <View key={account.id} style={styles.rowWrap}>
        <Pressable
          onPress={() => setSheet({ account })}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${account.name}, ${ACCOUNT_TYPE_LABEL[account.type]}${
            account.is_active ? '' : ', archived'
          }, ${owed ? `you owe ${amount}` : `balance ${amount}`}, ${balance.entryCount} entries`}
          accessibilityHint="Opens it to change, archive or delete"
        >
          <View style={styles.icon}>
            <Ionicons name={ACCOUNT_ICON[account.type]} size={18} color={colors.textSecondary} />
          </View>
          <View style={styles.body}>
            <Text style={[styles.name, !account.is_active && styles.archived]} numberOfLines={1}>
              {account.name}
            </Text>
            <Text style={styles.meta}>
              {ACCOUNT_TYPE_LABEL[account.type]}
              {account.is_active ? '' : ' · Archived'} · {balance.entryCount}{' '}
              {balance.entryCount === 1 ? 'entry' : 'entries'}
            </Text>
          </View>
          <Text
            style={[
              styles.balance,
              !owed && balance.balanceMinor < 0 && { color: colors.danger },
            ]}
          >
            {amount}
          </Text>
        </Pressable>
        {account.is_active ? (
          <Pressable
            onPress={() => navigation.navigate('TransactionEdit', { accountId: account.id })}
            style={styles.addButton}
            accessibilityRole="button"
            accessibilityLabel={`Add an entry to ${account.name}`}
          >
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      >
        <FadeInView>
          <GlassCard style={styles.summary}>
            <Text style={styles.overline}>Balance</Text>
            <Text style={[styles.net, summary.netMinor < 0 && { color: colors.danger }]}>
              {formatBalance(summary.netMinor)}
            </Text>
            <View style={styles.split}>
              <View style={styles.splitBlock}>
                <Text style={styles.overline}>You have</Text>
                <Text style={styles.splitValue}>{formatBalance(summary.assetsMinor)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.splitBlock}>
                <Text style={styles.overline}>You owe</Text>
                <Text style={styles.splitValue}>{formatMoney(summary.owedMinor, { compact: true })}</Text>
              </View>
            </View>
          </GlassCard>
        </FadeInView>

        {loading && accounts.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : null}

        {error ? (
          <View style={styles.errorRow} accessibilityRole="alert">
            <Ionicons name="warning-outline" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {summary.assets.length > 0 ? (
          <>
            <Text style={styles.section}>Accounts</Text>
            {summary.assets.map((b) => renderRow(b, false))}
          </>
        ) : null}

        {summary.liabilities.length > 0 ? (
          <>
            <Text style={styles.section}>Cards and money you owe</Text>
            {summary.liabilities.map((b) => renderRow(b, true))}
          </>
        ) : null}

        {summary.unassigned.count > 0 ? (
          <View style={styles.unassigned}>
            <Text style={styles.name}>Not in an account</Text>
            <Text style={styles.meta}>
              {summary.unassigned.count} {summary.unassigned.count === 1 ? 'entry' : 'entries'} ·{' '}
              {formatBalance(summary.unassigned.flowMinor)} net. Logged before accounts existed, or by
              Subscriptions&apos; mark-paid. Open one and pick an account to move it.
            </Text>
          </View>
        ) : null}

        {!loading && accounts.length === 0 ? (
          <Text style={styles.empty}>
            Add where your money sits - a bank, a wallet, your cash - and any credit card. Each
            entry then says which one it came from, and moving money between them is never counted
            as spending.
          </Text>
        ) : null}

        <Button label="Add an account" icon="add" onPress={() => setSheet({ account: null })} style={styles.action} />
        {accounts.filter((a) => a.is_active).length >= 2 ? (
          <Button
            label="Move money between accounts"
            icon="swap-horizontal"
            variant="glass"
            onPress={() => navigation.navigate('TransactionEdit', { kind: 'transfer' })}
            style={styles.secondary}
          />
        ) : null}
      </ScrollView>

      <AccountSheet
        visible={sheet !== null}
        account={sheet?.account ?? null}
        entryCount={entryCount(sheet?.account?.id)}
        onClose={() => setSheet(null)}
        onSave={(input) => (sheet?.account ? update(sheet.account.id, input) : create(input))}
        onSetActive={(account, active) => void archive(account, active)}
        onDelete={async (account) => {
          try {
            await remove(account);
            toast.show({ message: `Deleted ${account.name}` });
          } catch (e) {
            toast.show({ message: e instanceof Error ? e.message : 'Could not delete that account' });
          }
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl * 2,
  },
  summary: {
    marginBottom: spacing.lg,
  },
  overline: {
    ...typography.overline,
  },
  net: {
    ...typography.display,
    ...typography.numeric,
    fontSize: 30,
    marginTop: spacing.xs,
  },
  split: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  splitBlock: {
    flex: 1,
  },
  divider: {
    width: 1,
    backgroundColor: colors.glassBorder,
    marginHorizontal: spacing.lg,
  },
  splitValue: {
    ...typography.title,
    ...typography.numeric,
    marginTop: 4,
  },
  loading: {
    marginTop: spacing.xl,
  },
  section: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.sm,
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    gap: spacing.md,
    borderRadius: radius.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassStrong,
  },
  body: {
    flex: 1,
  },
  name: {
    ...typography.title,
    fontSize: 14.5,
  },
  archived: {
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
  },
  balance: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 14.5,
  },
  addButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginRight: -spacing.md,
  },
  unassigned: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  empty: {
    ...typography.body,
    marginTop: spacing.xl,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  action: {
    marginTop: spacing.xxl,
  },
  secondary: {
    marginTop: spacing.sm,
  },
}));
