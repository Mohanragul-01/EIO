/**
 * ChecklistEditor - the body of a checklist note.
 *
 * The whole list is held in the parent's state and written back as one array,
 * matching how it is stored: jsonb, read and written whole. So there is no
 * per-item save, no per-item id, and no way for the list to end up half
 * applied.
 *
 * Items carry no id, which means React needs a key from somewhere. Index is
 * used deliberately here: the list is short, reordering is not supported, and
 * an item's identity genuinely is its position.
 *
 * "Add an item" is held by the parent too, so that its Save and its discard
 * guard see a line that was typed but not added yet.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import { checklistProgress, withDraftItem, type ChecklistItem } from '../types';

type ChecklistEditorProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  /** What is typed in "Add an item". */
  draft: string;
  onDraftChange: (draft: string) => void;
};

export function ChecklistEditor({ items, onChange, draft, onDraftChange }: ChecklistEditorProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const { done, total } = checklistProgress(items);

  const addItem = () => {
    if (!draft.trim()) return;
    onChange(withDraftItem(items, draft));
    onDraftChange(''); // cleared so the field is ready for the next line
  };

  const toggle = (index: number) =>
    onChange(items.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));

  const editText = (index: number, text: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, text } : item)));

  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index));

  /**
   * Manual reset only. A checklist you reuse weekly should clear when YOU say
   * so, not on a schedule: an automatic reset would wipe the evidence of what
   * you had already done, at a moment you did not choose.
   */
  const uncheckAll = () => onChange(items.map((item) => ({ ...item, done: false })));

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.label}>Items</Text>
        {total > 0 ? (
          <View style={styles.headerRight}>
            <Text style={styles.progress}>
              {done} of {total}
            </Text>
            {done > 0 ? (
              <Pressable
                onPress={uncheckAll}
                hitSlop={4}
                style={styles.uncheckButton}
                accessibilityRole="button"
              >
                <Text style={styles.uncheck}>Uncheck all</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {items.map((item, index) => (
         
        <View key={index} style={styles.row}>
          <Pressable
            onPress={() => toggle(index)}
            style={styles.tick}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={item.text || 'Empty line'}
          >
            <View style={[styles.box, item.done && styles.boxDone]}>
              {item.done ? (
                <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
              ) : null}
            </View>
          </Pressable>

          <TextInput
            value={item.text}
            onChangeText={(text) => editText(index, text)}
            style={[styles.itemInput, item.done && styles.itemInputDone]}
            placeholder="Empty line"
            placeholderTextColor={colors.textFaint}
            selectionColor={colors.primary}
            multiline
          />

          <Pressable
            onPress={() => removeItem(index)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.text || 'this line'}`}
          >
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <Ionicons name="add" size={17} color={colors.textMuted} />
        <TextInput
          value={draft}
          onChangeText={onDraftChange}
          onSubmitEditing={addItem}
          // Keeps the keyboard up so several items can be typed in one go.
          blurOnSubmit={false}
          returnKeyType="done"
          placeholder="Add an item"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          style={styles.addInput}
        />
        {draft.trim() ? (
          <Pressable onPress={addItem} style={styles.addButton} accessibilityRole="button">
            <Text style={styles.addAction}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // As tall as Uncheck all from the start, so the list does not jump down
    // the moment the first item is ticked.
    minHeight: 40,
    marginBottom: spacing.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    ...typography.overline,
  },
  progress: {
    ...typography.caption,
    fontSize: 11.5,
  },
  // 40dp plus a 4dp hitSlop: a 48dp target. The negative margin keeps the
  // words where they were, against the card's edge.
  uncheckButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginRight: -spacing.sm,
  },
  uncheck: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    minHeight: 48,
  },
  // 48dp to press around the 21dp box. The negative margins keep the box at
  // the card's edge and the text where it was.
  tick: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -13,
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  itemInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    padding: 0,
    // Centres a first line on the 48dp row, level with its box.
    paddingVertical: 13,
  },
  itemInputDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  // 48dp to press; pulled into the gap before it and the card's padding after
  // it, so the cross sits where it did.
  remove: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
    marginRight: -spacing.lg,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
  },
  addButton: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginRight: -spacing.lg,
  },
  addInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  addAction: {
    ...typography.caption,
    color: colors.primary,
  },
}));
