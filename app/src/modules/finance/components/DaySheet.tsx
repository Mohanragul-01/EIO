/**
 * DaySheet - one calendar day's entries, and "Add for 16 Oct".
 *
 * Money Manager's calendar signature: answer "what happened on the 14th?"
 * and, when the answer is "I forgot to log it", add it there and then,
 * already dated.
 */
import React from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { formatMoney } from '../../../core/money';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { shortDate } from '../period';
import type { DayTotal, ListItem } from '../summary';
import type { Account } from '../types';
import { dayLabel } from './DayHeader';
import { TransactionRow } from './TransactionRow';

type DaySheetProps = {
  date: string | null;
  items: ListItem[];
  total: DayTotal | undefined;
  accountsById: Map<string, Account>;
  onClose: () => void;
  onOpen: (item: ListItem) => void;
  onAdd: (date: string) => void;
};

export function DaySheet({ date, items, total, accountsById, onClose, onOpen, onAdd }: DaySheetProps) {
  const styles = useStyles();
  if (!date) return null;

  const parts: string[] = [];
  if (total?.outMinor) parts.push(`${formatMoney(total.outMinor, { compact: true })} out`);
  if (total?.inMinor) parts.push(`${formatMoney(total.inMinor, { compact: true })} in`);

  return (
    <Sheet
      visible
      title={dayLabel(date)}
      subtitle={parts.length ? parts.join(' · ') : 'Nothing logged'}
      onClose={onClose}
      footer={
        <Button
          label={`Add for ${shortDate(date)}`}
          icon="add"
          onPress={() => {
            // Close first: the add form is a screen, and the sheet is a window
            // that would otherwise stay on top of it.
            onClose();
            onAdd(date);
          }}
        />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <Text style={styles.empty}>Nothing on this day yet.</Text>
        ) : (
          items.map((item) => (
            <TransactionRow
              key={item.key}
              item={item}
              accountsById={accountsById}
              onPress={() => {
                onClose();
                onOpen(item);
              }}
            />
          ))
        )}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  empty: {
    ...typography.body,
    paddingVertical: spacing.lg,
  },
}));
