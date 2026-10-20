/**
 * EntryMenuSheet - what a long-press on an entry offers.
 *
 * The non-swipe route to every row action (the rows live inside the tab
 * pager, so a swipe there would fight it). Delete is undoable from the toast
 * that follows, so it is not confirmed here.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { categoryDef } from '../../../core/categories';
import { Sheet } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { describeTransfer } from '../accounts';
import type { ListItem } from '../summary';
import type { Account } from '../types';
import { dayLabel } from './DayHeader';

type Action = {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  danger?: boolean;
  onPress: () => void;
};

type EntryMenuSheetProps = {
  item: ListItem | null;
  accountsById: Map<string, Account>;
  onClose: () => void;
  onEdit: (item: ListItem) => void;
  onLogAgain: (item: ListItem) => void;
  onPin: (item: ListItem) => void;
  onDelete: (item: ListItem) => void;
};

export function EntryMenuSheet({
  item,
  accountsById,
  onClose,
  onEdit,
  onLogAgain,
  onPin,
  onDelete,
}: EntryMenuSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!item) return null;

  const title =
    item.type === 'transfer'
      ? describeTransfer(item.fromAccountId, item.toAccountId, accountsById)
      : item.tx.note || categoryDef(item.tx.category).label;
  const amount = formatMoney(item.type === 'transfer' ? item.amountMinor : item.tx.amount_minor, {
    compact: true,
  });
  const date = item.type === 'transfer' ? item.date : item.tx.date;

  // Each action closes the sheet first: a toast raised while the sheet is
  // still open would draw underneath it.
  const run = (action: (item: ListItem) => void) => () => {
    onClose();
    action(item);
  };

  const actions: Action[] = [{ key: 'edit', label: 'Edit', icon: 'create-outline', onPress: run(onEdit) }];
  if (item.type === 'entry') {
    actions.push(
      { key: 'again', label: 'Log again today', icon: 'copy-outline', onPress: run(onLogAgain) },
      { key: 'pin', label: 'Pin as a quick add', icon: 'flash-outline', onPress: run(onPin) },
    );
  }
  actions.push({
    key: 'delete',
    label: item.type === 'transfer' ? 'Delete transfer' : 'Delete',
    icon: 'trash-outline',
    danger: true,
    onPress: run(onDelete),
  });

  return (
    <Sheet visible title={title} subtitle={`${amount} · ${dayLabel(date)}`} onClose={onClose}>
      <View>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons name={action.icon} size={20} color={action.danger ? colors.danger : colors.textSecondary} />
            <Text style={[styles.actionText, action.danger && { color: colors.danger }]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    minHeight: 52,
  },
  pressed: {
    opacity: 0.6,
  },
  actionText: {
    ...typography.body,
    fontSize: 15,
  },
}));
