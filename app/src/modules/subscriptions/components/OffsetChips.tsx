/**
 * OffsetChips - which days before a renewal to be reminded.
 *
 * Pick any of 14, 7, 3 and 1 days. "On the day" is shown too, checked and
 * locked: it is always scheduled, so a renewal never arrives unannounced
 * even when every earlier reminder had already passed.
 */
import React from 'react';
import { View } from 'react-native';

import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { OFFSET_CHOICES } from '../reminders';
import { Chip } from './Chip';

export function OffsetChips({
  value,
  onChange,
}: {
  /** Days before; 0 is implied and ignored here. */
  value: number[];
  onChange: (offsets: number[]) => void;
}) {
  const styles = useStyles();
  const chosen = new Set(value);

  return (
    <View style={styles.row}>
      {OFFSET_CHOICES.map((days) => (
        <Chip
          key={days}
          role="checkbox"
          label={days === 1 ? '1 day' : `${days} days`}
          accessibilityLabel={`${days} ${days === 1 ? 'day' : 'days'} before`}
          selected={chosen.has(days)}
          onPress={() =>
            onChange(
              chosen.has(days)
                ? value.filter((n) => n !== days)
                : [...value, days].sort((a, b) => b - a),
            )
          }
        />
      ))}
      <Chip
        role="checkbox"
        label="On the day"
        accessibilityLabel="On the day, always on"
        icon="lock-closed-outline"
        selected
        disabled
        onPress={() => {}}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
}));
