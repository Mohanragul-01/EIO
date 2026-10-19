/**
 * TrialSheet - the question every trial ends with: keep it, or did you cancel?
 *
 * A trial converting silently through a card on file or a UPI mandate is the
 * most expensive thing a tracker can miss, so on its end date the app asks
 * rather than assuming either way. Keep makes it active, with its first charge
 * on the end date; "I cancelled" ends it there. Both can be undone.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { cycleOf, cycleSuffix } from '../cycles';
import { priceParts, shortDate } from '../format';
import { countdown, trialEndsOn } from '../lifecycle';
import type { Subscription } from '../types';

export function TrialSheet({
  visible,
  subscription: sub,
  today,
  onClose,
  onKeep,
  onCancelled,
}: {
  visible: boolean;
  subscription: Subscription | null;
  today: string;
  onClose: () => void;
  onKeep: () => void;
  onCancelled: () => void;
}) {
  const styles = useStyles();
  if (!sub) return null;

  const price = priceParts(sub);
  const ends = trialEndsOn(sub);

  return (
    <Sheet
      visible={visible}
      title={`${sub.name} trial`}
      subtitle={`${countdown(sub, today).text} · ${shortDate(ends, today)}`}
      onClose={onClose}
      footer={
        <View style={styles.buttons}>
          <Button label="Keep it" icon="checkmark" onPress={onKeep} />
          <Button label="I cancelled it" icon="close" variant="glass" onPress={onCancelled} />
        </View>
      }
    >
      <Text style={styles.body}>
        If you keep it, it costs {price.main}
        {price.converted ? ` (${price.converted})` : ''} {cycleSuffix(cycleOf(sub))}, first charged
        on {shortDate(ends, today)}.
      </Text>
      <Text style={styles.caption}>
        Keep moves it into your totals and reminds you before each renewal. I cancelled it ends it
        on that day.
      </Text>
    </Sheet>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  body: {
    ...typography.body,
  },
  caption: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  buttons: {
    gap: spacing.sm,
  },
}));
