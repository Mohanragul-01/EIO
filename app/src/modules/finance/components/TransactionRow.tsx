/**
 * TransactionRow - one list item: an expense, an income, or a transfer.
 *
 * Income and expense are distinguished by SIGN and COLOR rather than by two
 * different layouts - the eye can scan a column of amounts far faster when
 * they're aligned in the same place. The sign is what carries it; the colour
 * only repeats it.
 *
 * A TRANSFER LOOKS DIFFERENT on purpose: a neutral swap icon, "HDFC → Cash",
 * and no sign at all, because it is neither money in nor money out. Showing
 * it with a minus would read as spending, which is the exact mistake keeping
 * transfers out of the totals is meant to prevent.
 *
 * Tap opens it; long-press opens its menu (edit, log again, pin, delete).
 * There is no swipe: these rows sit inside the swipeable tab pager, and two
 * horizontal gestures in one place fight.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { GlassCard } from '../../../core/components';
// formatEventDate, not formatDueDate: this date is when the money moved, so
// "Yesterday" is right and "3 days overdue" would be meaningless.
import { formatEventDate } from '../../../core/date';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { describeTransfer } from '../accounts';
import type { ListItem } from '../summary';
import type { Account } from '../types';

type TransactionRowProps = {
  item: ListItem;
  accountsById: Map<string, Account>;
  onPress: () => void;
  onLongPress?: () => void;
  /** Lists grouped under a day header leave the date off; search results keep it. */
  showDate?: boolean;
};

export function TransactionRow({ item, accountsById, onPress, onLongPress, showDate = false }: TransactionRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  let icon: React.ComponentProps<typeof Ionicons>['name'];
  let iconColor: string;
  let iconBackground: string;
  let title: string;
  let meta: string[];
  let amount: string;
  let amountStyle;
  let spoken: string;

  if (item.type === 'transfer') {
    const route = describeTransfer(item.fromAccountId, item.toAccountId, accountsById);
    icon = 'swap-horizontal';
    iconColor = colors.textSecondary;
    iconBackground = colors.glassStrong;
    title = route;
    meta = [item.note || 'Transfer'];
    if (showDate) meta.push(formatEventDate(item.date));
    amount = formatMoney(item.amountMinor, { compact: true });
    amountStyle = styles.amountTransfer;
    spoken = `Transfer of ${amount}, ${route.replace('→', 'to')}${item.note ? `, ${item.note}` : ''}`;
  } else {
    const tx = item.tx;
    const category = categoryDef(tx.category);
    const income = tx.kind === 'income';
    const account = tx.account_id ? accountsById.get(tx.account_id)?.name : null;
    icon = category.icon;
    iconColor = category.color;
    iconBackground = category.color + '1F';
    // The note is the headline when there is one - "Coffee with Ravi" is more
    // identifiable than "Food". The category becomes context.
    title = tx.note || category.label;
    meta = [];
    if (tx.note) meta.push(category.label);
    meta.push(account ?? 'No account');
    if (showDate) meta.push(formatEventDate(tx.date));
    amount = `${income ? '+' : '−'}${formatMoney(tx.amount_minor, { compact: true })}`;
    amountStyle = income ? styles.amountIncome : styles.amount;
    spoken = `${income ? 'Received' : 'Spent'} ${formatMoney(tx.amount_minor, { compact: true })}, ${title}, ${meta.join(', ')}`;
  }

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [styles.press, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={onLongPress ? 'Opens it. Long press for more actions.' : 'Opens it.'}
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: 'More actions' }] : undefined}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'longpress') onLongPress?.();
      }}
    >
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: iconBackground }]}>
            <Ionicons name={icon} size={17} color={iconColor} />
          </View>

          <View style={styles.body}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {meta.join(' · ')}
            </Text>
          </View>

          <Text style={[styles.amountBase, amountStyle]}>{amount}</Text>
        </View>
      </GlassCard>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  press: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  card: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  body: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 14.5,
  },
  meta: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  amountBase: {
    ...typography.title,
    // Tabular figures make every digit the same width, so a column of amounts
    // lines up instead of jittering.
    ...typography.numeric,
    fontSize: 14.5,
  },
  amount: {
    color: colors.text,
  },
  amountIncome: {
    color: colors.success,
  },
  amountTransfer: {
    color: colors.textSecondary,
  },
}));
