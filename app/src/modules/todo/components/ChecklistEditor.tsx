/**
 * ChecklistEditor - the steps inside a task.
 *
 * Steps, not sub-tasks: names and ticks, which is all a monthly bills run or
 * a car-service list needs. When a repeat comes round, the new occurrence
 * starts with every item unticked (api.completeTask).
 *
 * A tick is reported separately from an edit, so the editor can save it
 * straight away - ticking items is what you do while doing the task, and it
 * should not depend on remembering to press Save.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { ChecklistItem } from '../types';

type ChecklistEditorProps = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
  /** A tick or untick, with the list as it now stands. */
  onToggle: (items: ChecklistItem[]) => void;
};

/** Local to the task, only for keys and edits; nothing else reads it. */
function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function ChecklistEditor({ items, onChange, onToggle }: ChecklistEditorProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: newId(), text, done: false }]);
    setDraft('');
  };

  return (
    <View>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Pressable
            onPress={() =>
              onToggle(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))
            }
            hitSlop={12}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.done }}
            accessibilityLabel={item.text}
          >
            <View style={[styles.box, item.done && styles.boxOn]}>
              {item.done ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>

          <TextInput
            value={item.text}
            onChangeText={(text) => onChange(items.map((i) => (i.id === item.id ? { ...i, text } : i)))}
            style={[styles.input, item.done && styles.inputDone]}
            placeholderTextColor={colors.textFaint}
            accessibilityLabel={`Step: ${item.text}`}
            maxLength={200}
          />

          <Pressable
            onPress={() => onChange(items.filter((i) => i.id !== item.id))}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.text}`}
          >
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}

      <View style={styles.row}>
        <Ionicons name="add" size={20} color={colors.primary} style={styles.addIcon} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          submitBehavior="submit"
          returnKeyType="done"
          placeholder="Add a step"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          accessibilityLabel="Add a step"
          maxLength={200}
        />
        {draft.trim() ? (
          <Pressable
            onPress={add}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel="Add this step"
          >
            <Ionicons name="return-down-back" size={18} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  addIcon: { width: 22, textAlign: 'center' },
  input: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  inputDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  remove: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -14,
  },
}));
