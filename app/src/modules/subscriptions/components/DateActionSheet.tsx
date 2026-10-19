/**
 * DateActionSheet - an action that needs one date: cancel ("When does access
 * end?") or pause ("Resumes on").
 *
 * One sheet for both because they differ only in their words and in whether
 * the date may be left empty - a cancellation always has a last day, a pause
 * need not.
 */
import React, { useState } from 'react';
import { Text } from 'react-native';

import { Button, DateField, Sheet } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';

type DateActionSheetProps = {
  visible: boolean;
  title: string;
  subtitle: string;
  label: string;
  /** The date the sheet opens on. */
  initial: string | null;
  allowClear: boolean;
  caption: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (date: string | null) => void;
};

export function DateActionSheet({
  visible,
  title,
  subtitle,
  label,
  initial,
  allowClear,
  caption,
  confirmLabel,
  onClose,
  onConfirm,
}: DateActionSheetProps) {
  const styles = useStyles();
  const [date, setDate] = useState<string | null>(initial);

  // Re-seeded during render each time it opens, so it never shows the date
  // from the last subscription it was opened on.
  const identity = `${visible}:${title}:${initial}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setDate(initial);
  }

  const canConfirm = allowClear || !!date;

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <Button
          label={confirmLabel}
          icon="checkmark"
          onPress={() => onConfirm(date)}
          disabled={!canConfirm}
        />
      }
    >
      <DateField label={label} value={date} onChange={setDate} allowClear={allowClear} />
      <Text style={styles.caption}>{caption}</Text>
    </Sheet>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  caption: {
    ...typography.caption,
    marginTop: spacing.lg,
  },
}));
