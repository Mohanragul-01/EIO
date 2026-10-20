/**
 * ActionsSheet - everything you can do to a subscription, from a long-press.
 *
 * Only what makes sense for its state today: a trial offers Keep or "I
 * cancelled", a pause offers Resume, an archived one offers Restore. Every
 * reversible action here is followed by an Undo toast; Delete alone asks
 * first, because it is the one that cannot be taken back.
 *
 * Rows are full-width 52dp buttons with an icon AND a word - a list built
 * from Alert buttons silently loses entries on Android past the third (see
 * the README).
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { ActionKey } from '../actions';
import { effectiveState } from '../lifecycle';
import type { Subscription } from '../types';

export type { ActionKey };

type ActionDef = { key: ActionKey; label: string; icon: keyof typeof Ionicons.glyphMap };

/** The actions a subscription offers today, most likely first. */
export function actionsFor(sub: Subscription, today: string): ActionDef[] {
  const state = effectiveState(sub, today);
  const list: ActionDef[] = [];
  switch (state) {
    case 'active':
      list.push(
        { key: 'pay', label: 'Mark paid', icon: 'checkmark-circle-outline' },
        { key: 'pause', label: 'Pause', icon: 'pause-circle-outline' },
        { key: 'cancel', label: 'Mark as cancelled', icon: 'close-circle-outline' },
      );
      break;
    case 'trial':
    case 'trial_over':
      list.push(
        { key: 'keep', label: 'Keep it (convert to paid)', icon: 'checkmark-circle-outline' },
        { key: 'end_trial', label: 'I cancelled the trial', icon: 'close-circle-outline' },
      );
      break;
    case 'paused':
      list.push(
        { key: 'resume', label: 'Resume now', icon: 'play-circle-outline' },
        { key: 'cancel', label: 'Mark as cancelled', icon: 'close-circle-outline' },
      );
      break;
    case 'ending':
      list.push({ key: 'restore', label: 'Undo cancellation', icon: 'arrow-undo-outline' });
      break;
    case 'ended':
    case 'archived':
      list.push({ key: 'restore', label: 'Restore to active', icon: 'arrow-undo-outline' });
      break;
  }
  list.push({ key: 'open', label: 'Open details', icon: 'reader-outline' });
  list.push({ key: 'edit', label: 'Edit', icon: 'create-outline' });
  if (state !== 'archived') list.push({ key: 'archive', label: 'Archive', icon: 'archive-outline' });
  list.push({ key: 'delete', label: 'Delete…', icon: 'trash-outline' });
  return list;
}

export function ActionsSheet({
  visible,
  subscription,
  today,
  onClose,
  onAction,
}: {
  visible: boolean;
  subscription: Subscription | null;
  today: string;
  onClose: () => void;
  onAction: (key: ActionKey, sub: Subscription) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!subscription) return null;

  return (
    <Sheet visible={visible} title={subscription.name} subtitle="Actions" onClose={onClose}>
      <View>
        {actionsFor(subscription, today).map((action) => {
          const danger = action.key === 'delete';
          return (
            <Pressable
              key={action.key}
              onPress={() => onAction(action.key, subscription)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label.replace('…', '')}
            >
              <Ionicons
                name={action.icon}
                size={20}
                color={danger ? colors.danger : colors.textSecondary}
              />
              <Text style={[styles.label, danger && { color: colors.danger }]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassBorder,
  },
  pressed: {
    opacity: 0.6,
  },
  label: {
    ...typography.body,
    color: colors.text,
  },
}));
