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
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { fonts, radius, spacing } from '../../../core/theme';
import { checklistProgress, type ChecklistItem } from '../types';

type ChecklistEditorProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
};

export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const { done, total } = checklistProgress(items);

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { text, done: false }]);
    setDraft(''); // cleared so the field is ready for the next line
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
              <Pressable onPress={uncheckAll} hitSlop={8}>
                <Text style={styles.uncheck}>Uncheck all</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {items.map((item, index) => (
        // eslint-disable-next-line react/no-array-index-key -- see file header
        <View key={index} style={styles.row}>
          <Pressable onPress={() => toggle(index)} hitSlop={10}>
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

          <Pressable onPress={() => removeItem(index)} hitSlop={10}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      <View style={styles.addRow}>
        <Ionicons name="add" size={17} color={colors.textMuted} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
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
          <Pressable onPress={addItem} hitSlop={8}>
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
    marginBottom: spacing.md,
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
  uncheck: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: 6,
  },
  box: {
    width: 21,
    height: 21,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
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
    paddingTop: 2,
  },
  itemInputDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
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
