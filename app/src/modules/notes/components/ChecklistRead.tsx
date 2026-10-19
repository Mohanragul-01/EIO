/**
 * ChecklistRead - a checklist in read mode: what is left on top, what is
 * ticked folded away underneath.
 *
 * In a shop you want only what is left on the screen, so ticked items sink
 * into a collapsible "N ticked" group, folded by default. The sinking is a
 * view, not a reorder: the stored list keeps its order (partitionChecklist),
 * so unticking an item puts it back where it was.
 *
 * Every change here saves at once, like the ticks always have. The two mass
 * actions - Uncheck all, for a list you reuse, and Delete ticked, for one you
 * use up - are one tap each, and the screen offers Undo for both rather than
 * asking first.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import { partitionChecklist, type ChecklistItem, type IndexedItem } from '../types';

type ChecklistReadProps = {
  items: ChecklistItem[];
  /** Omit to show the list without letting it be changed (a note in the Trash). */
  onToggle?: (index: number) => void;
  onUncheckAll?: () => void;
  onDeleteTicked?: () => void;
};

export function ChecklistRead({ items, onToggle, onUncheckAll, onDeleteTicked }: ChecklistReadProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [showTicked, setShowTicked] = useState(false);

  const { open, ticked } = partitionChecklist(items);

  const row = ({ item, index }: IndexedItem) => {
    const content = (
      <>
        <View style={[styles.box, item.done && styles.boxOn]}>
          {item.done ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
        <Text style={[styles.itemText, item.done && styles.itemDone]}>{item.text}</Text>
      </>
    );

    if (!onToggle) {
      return (
        <View
          key={index}
          style={styles.item}
          accessible
          accessibilityLabel={`${item.text}, ${item.done ? 'done' : 'not done'}`}
        >
          {content}
        </View>
      );
    }

    return (
      <Pressable
        key={index}
        onPress={() => onToggle(index)}
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.text}
      >
        {content}
      </Pressable>
    );
  };

  return (
    <View>
      {open.length === 0 && ticked.length > 0 ? (
        <View style={styles.allDone}>
          <Ionicons name="checkmark-done" size={17} color={colors.success} />
          <Text style={styles.allDoneText}>All done</Text>
        </View>
      ) : null}

      {open.map(row)}

      {ticked.length > 0 ? (
        <View style={styles.tickedGroup}>
          <View style={styles.tickedHeader}>
            <Pressable
              onPress={() => setShowTicked((v) => !v)}
              style={styles.disclosure}
              accessibilityRole="button"
              accessibilityState={{ expanded: showTicked }}
              accessibilityLabel={`${ticked.length} ticked`}
              accessibilityHint={showTicked ? 'Hides the ticked items' : 'Shows the ticked items'}
            >
              <Ionicons
                name={showTicked ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={styles.tickedLabel}>{ticked.length} ticked</Text>
            </Pressable>

            {onUncheckAll ? (
              <Pressable
                onPress={onUncheckAll}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel="Uncheck all"
              >
                <Text style={styles.actionText}>Uncheck all</Text>
              </Pressable>
            ) : null}
            {onDeleteTicked ? (
              <Pressable
                onPress={onDeleteTicked}
                style={styles.action}
                accessibilityRole="button"
                accessibilityLabel="Delete ticked items"
              >
                <Text style={styles.actionText}>Delete ticked</Text>
              </Pressable>
            ) : null}
          </View>

          {showTicked ? ticked.map(row) : null}
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Generous, because this is the one control on the screen and it is
    // pressed standing up with one hand.
    minHeight: 48,
  },
  pressed: { opacity: 0.6 },
  box: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemText: {
    ...typography.body,
    flex: 1,
  },
  itemDone: {
    textDecorationLine: 'line-through',
  },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  allDoneText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  tickedGroup: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  tickedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  disclosure: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
  },
  tickedLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  action: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  actionText: {
    ...typography.caption,
    color: colors.primary,
  },
}));
