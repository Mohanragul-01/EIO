/**
 * QuickAddRow - pinned entries you log in one tap ("Chai ₹20 · Cash").
 *
 * UPI means many small payments a day, and each one is a chance to skip
 * logging. A pin turns the commonest of them into a single tap, with Undo in
 * the toast for the tap you did not mean (Money Manager's bookmarks, Cashew's
 * pins, Wallet's templates).
 *
 * The pills WRAP rather than scroll sideways: this row sits inside the
 * swipeable tab pager, and a horizontal scroller inside a horizontal pager is
 * two swipes fighting over one gesture. Long-press a pill to change or unpin it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatMoney } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { Account, QuickAdd } from '../types';

type QuickAddRowProps = {
  quickAdds: QuickAdd[];
  accountsById: Map<string, Account>;
  onLog: (quickAdd: QuickAdd) => void;
  onEdit: (quickAdd: QuickAdd) => void;
};

export function QuickAddRow({ quickAdds, accountsById, onLog, onEdit }: QuickAddRowProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Quick add</Text>
      {quickAdds.length === 0 ? (
        // Shows what will appear here, rather than an empty strip.
        <Text style={styles.hint}>
          Long-press an entry and pin it, or tick “Pin as a quick add” when adding one, to log it
          here in one tap.
        </Text>
      ) : (
        <View style={styles.pills}>
          {quickAdds.map((quickAdd) => {
            const account = quickAdd.account_id ? accountsById.get(quickAdd.account_id)?.name : null;
            const amount = formatMoney(quickAdd.amount_minor, { compact: true });
            return (
              <Pressable
                key={quickAdd.id}
                onPress={() => onLog(quickAdd)}
                onLongPress={() => onEdit(quickAdd)}
                delayLongPress={350}
                hitSlop={4}
                style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Log ${quickAdd.note}, ${amount}${account ? `, from ${account}` : ''}`}
                accessibilityHint="Logs it today. Long press to change or unpin it."
                accessibilityActions={[{ name: 'longpress', label: 'Change or unpin' }]}
                onAccessibilityAction={(event) => {
                  if (event.nativeEvent.actionName === 'longpress') onEdit(quickAdd);
                }}
              >
                <Ionicons
                  name={quickAdd.kind === 'income' ? 'arrow-down-circle-outline' : 'flash-outline'}
                  size={14}
                  color={colors.primary}
                />
                <Text style={styles.pillText} numberOfLines={1}>
                  {quickAdd.note} <Text style={styles.pillAmount}>{amount}</Text>
                  {account ? <Text style={styles.pillAccount}> · {account}</Text> : null}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  wrap: {
    marginBottom: spacing.xl,
  },
  label: {
    ...typography.overline,
    marginBottom: spacing.md,
  },
  hint: {
    ...typography.caption,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + '1A',
    borderWidth: 1,
    borderColor: colors.primary + '55',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  pillText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.text,
    flexShrink: 1,
  },
  pillAmount: {
    ...typography.numeric,
    color: colors.text,
  },
  pillAccount: {
    color: colors.textSecondary,
  },
}));
