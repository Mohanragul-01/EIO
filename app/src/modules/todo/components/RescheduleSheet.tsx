/**
 * RescheduleSheet - move one task, or the whole Overdue section, in a tap.
 *
 * The targets are the ones Todoist and TickTick both lead with - Today,
 * Tomorrow, This weekend, Next week - each showing the date it lands on, so
 * "This weekend" on a Saturday is plainly today. Then No date, a calendar for
 * anything else, and for a repeat, Skip this time: the occurrence is recorded
 * as skipped and the next one comes round.
 *
 * Like the menu, it only reports the choice; the screen acts after the sheet
 * has closed, so the undo toast is not hidden beneath it.
 */
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { fromISODate, toISODate } from '../../../core/date';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { WEEKDAY_SHORT, weekdayOf } from '../recurrence';
import { rescheduleTargets } from '../today';
import { Chip } from './Chip';

export type RescheduleChoice = { kind: 'date'; date: string | null } | { kind: 'skip' };

type RescheduleSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  today: string;
  /** The date the task is on now, to mark it and to open the calendar on. */
  current?: string | null;
  /** Offer "Skip this time" - only for a single repeating task. */
  canSkip?: boolean;
  onClose: () => void;
  onChoose: (choice: RescheduleChoice) => void;
};

const SHORT_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 24 Oct": where a target lands, so the label is never a guess. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${WEEKDAY_SHORT[weekdayOf(iso)]} ${d} ${SHORT_MONTH[m - 1]}`;
}

export function RescheduleSheet({
  visible,
  title,
  subtitle,
  today,
  current = null,
  canSkip = false,
  onClose,
  onChoose,
}: RescheduleSheetProps) {
  const styles = useStyles();
  const [picking, setPicking] = useState(false);

  const choose = (choice: RescheduleChoice) => {
    setPicking(false);
    onClose();
    onChoose(choice);
  };

  return (
    <Sheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      <View style={styles.grid}>
        {rescheduleTargets(today).map((target) => (
          <Chip
            key={target.key}
            label={target.label}
            detail={shortDate(target.date)}
            icon="calendar-outline"
            selected={current === target.date}
            onPress={() => choose({ kind: 'date', date: target.date })}
            style={styles.cell}
          />
        ))}
        <Chip
          label="No date"
          icon="remove-circle-outline"
          onPress={() => choose({ kind: 'date', date: null })}
          style={styles.cell}
        />
        <Chip
          label="Pick a date"
          icon="calendar-number-outline"
          onPress={() => setPicking(true)}
          style={styles.cell}
        />
      </View>

      {canSkip ? (
        <Chip
          label="Skip this time"
          detail="Recorded as skipped; the next one comes round"
          icon="play-skip-forward-outline"
          onPress={() => choose({ kind: 'skip' })}
          style={styles.skip}
        />
      ) : null}

      {/* Mounted only while open: on Android this component IS the dialog. */}
      {picking ? (
        <DateTimePicker
          value={current ? fromISODate(current) : fromISODate(today)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onValueChange={(_event, date) => {
            setPicking(false);
            if (date) choose({ kind: 'date', date: toISODate(date) });
          }}
          onDismiss={() => setPicking(false)}
        />
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles(() => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  // Two to a row: wide enough for "This weekend" and its date.
  cell: {
    flexBasis: '47%',
    flexGrow: 1,
  },
  skip: {
    marginTop: spacing.md,
  },
}));
