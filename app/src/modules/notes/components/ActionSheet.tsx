/**
 * ActionSheet - a short list of things to do, in a Sheet.
 *
 * The long-press menus of Notes: what to create, what to do with an archived
 * note, what to do with one in the Trash. Rows rather than Alert buttons,
 * because Android's Alert has three button slots and a fourth silently
 * replaces one of them (see the README's design notes).
 *
 * Each row is a full-width 56dp target with an icon, a label and, where it
 * helps, one line saying what will happen - "Deletes it for good" belongs on
 * the button, not only in the confirm that follows.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

export type SheetAction = {
  key: string;
  label: string;
  detail?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'danger';
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
  children?: React.ReactNode;
};

export function ActionSheet({ visible, title, subtitle, actions, onClose, children }: ActionSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} title={title} subtitle={subtitle} onClose={onClose}>
      {children}
      <View style={styles.list}>
        {actions.map((action) => {
          const tone = action.tone === 'danger' ? colors.danger : colors.text;
          return (
            <Pressable
              key={action.key}
              onPress={action.onPress}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.detail}
            >
              <View style={styles.icon}>
                <Ionicons name={action.icon} size={20} color={tone} />
              </View>
              <View style={styles.text}>
                <Text style={[styles.label, { color: tone }]}>{action.label}</Text>
                {action.detail ? <Text style={styles.detail}>{action.detail}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  pressed: {
    backgroundColor: colors.glassStrong,
  },
  icon: {
    width: 28,
    alignItems: 'center',
  },
  text: { flex: 1 },
  label: {
    ...typography.title,
    fontSize: 15,
  },
  detail: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
}));
