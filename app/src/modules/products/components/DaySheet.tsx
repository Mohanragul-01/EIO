/**
 * DaySheet - "which day?" for the moments in a container's life: finishing
 * it, and opening a spare.
 *
 * Both used to assume today. Finishing on the day you notice rather than the
 * day it ran out stretches the container's lifespan, and that lifespan is the
 * next container's estimate - so a wrong day here quietly misleads the next
 * six weeks. Today is still one tap; the day is just yours to change.
 *
 * Each action resolves whether it worked. The sheet keeps itself open with
 * the error on failure; on success the parent closes it and shows its toast.
 */
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { DayChoice } from './DayChoice';

export type DayAction = {
  key: string;
  label: string;
  icon?: React.ComponentProps<typeof Button>['icon'];
  variant?: React.ComponentProps<typeof Button>['variant'];
  run: (day: string) => Promise<boolean>;
};

type DaySheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** The question above the day, e.g. "When did it run out?". */
  question: string;
  today: string;
  min: string | null;
  /** A live line under the day, worked out from it. */
  detail?: (day: string) => string | null;
  actions: DayAction[];
  onClose: () => void;
};

export function DaySheet({
  visible,
  title,
  subtitle,
  question,
  today,
  min,
  detail,
  actions,
  onClose,
}: DaySheetProps) {
  const styles = useStyles();
  const [day, setDay] = useState(today);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Back to today each time it opens: the last choice belonged to another
  // container.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const identity = `${visible}:${title}`;
  if (openedFor !== identity) {
    setOpenedFor(identity);
    setDay(today);
    setError(null);
  }

  const run = async (action: DayAction) => {
    setRunning(action.key);
    setError(null);
    try {
      const ok = await action.run(day);
      if (!ok) setError('That did not save. Check your connection and try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save');
    } finally {
      setRunning(null);
    }
  };

  const line = detail?.(day) ?? null;

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <View style={styles.actions}>
          {actions.map((action) => (
            <Button
              key={action.key}
              label={action.label}
              icon={action.icon}
              variant={action.variant}
              onPress={() => void run(action)}
              loading={running === action.key}
              disabled={running !== null && running !== action.key}
            />
          ))}
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <DayChoice label={question} value={day} onChange={setDay} min={min} max={today} />
        {line ? <Text style={styles.line}>{line}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  actions: { gap: spacing.sm },
  line: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.md },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.md },
}));
