/**
 * ItemSheet - add something to the list, or change something already on it.
 *
 * The app had no way to add a B-List item at all. Everything came from the
 * seed migration, which is fine for the 818 that already existed and useless
 * the first time you think of a 819th.
 *
 * CATEGORY IS A TEXT FIELD WITH SUGGESTIONS, not a picker. There are 61
 * categories, so a picker would be another searchable list; and the one thing
 * you cannot do in a picker is add the 62nd. Typing filters what already
 * exists - tap a suggestion and it is exact, ignore them and you have made a
 * new category. One control, both jobs, and no wrong answer.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, SegmentedControl, TextField } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { COSTS, COST_LABEL, type BucketInput, type BucketItem, type Cost } from '../types';
import { Sheet } from './Sheet';

type ItemSheetProps = {
  visible: boolean;
  /** The item being changed, or null when adding. */
  item: BucketItem | null;
  /** Pre-fills the category when a category filter is active. */
  defaultCategory?: string;
  categories: string[];
  onClose: () => void;
  onSave: (input: BucketInput) => Promise<void>;
  onDelete?: (item: BucketItem) => Promise<void>;
};

export function ItemSheet({
  visible,
  item,
  defaultCategory,
  categories,
  onClose,
  onSave,
  onDelete,
}: ItemSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState<Cost>('moderate');
  const [note, setNote] = useState('');

  const [titleError, setTitleError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Seed the fields when the sheet opens, and again when it is opened on a
   * different item. Done during render rather than in an effect: an effect
   * would paint the previous item's text for one frame on the way in.
   */
  const identity = `${visible}:${item?.id ?? 'new'}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setTitle(item?.title ?? '');
    setCategory(item?.category ?? (defaultCategory && defaultCategory !== 'any' ? defaultCategory : ''));
    setCost(item?.cost ?? 'moderate');
    setNote(item?.note ?? '');
    setTitleError(null);
    setCategoryError(null);
    setError(null);
  }

  const suggestions = useMemo(() => {
    const needle = category.trim().toLowerCase();
    if (!needle) return categories.slice(0, 6);
    const hits = categories.filter((c) => c.toLowerCase().includes(needle));
    // An exact match needs no suggestion - you have already typed it.
    if (hits.length === 1 && hits[0].toLowerCase() === needle) return [];
    return hits.slice(0, 6);
  }, [categories, category]);

  const isNewCategory =
    category.trim().length > 0 &&
    !categories.some((c) => c.toLowerCase() === category.trim().toLowerCase());

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();

    setTitleError(cleanTitle ? null : 'What is the thing?');
    setCategoryError(cleanCategory ? null : 'Give it a category');
    if (!cleanTitle || !cleanCategory) return;

    setSaving(true);
    setError(null);
    try {
      await onSave({ title: cleanTitle, category: cleanCategory, cost, note: note.trim() });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    Alert.alert('Remove from the list', `"${item.title}" is deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          onClose();
          void onDelete(item);
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      title={item ? 'Edit' : 'Add to the list'}
      onClose={onClose}
      footer={
        <>
          <Button
            label={item ? 'Save' : 'Add it'}
            icon="checkmark"
            onPress={() => void handleSave()}
            loading={saving}
          />
          {item && onDelete ? (
            <Pressable
              onPress={handleDelete}
              style={styles.delete}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.title}`}
            >
              <Text style={styles.deleteText}>Remove from the list</Text>
            </Pressable>
          ) : null}
        </>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField
          label="The thing"
          value={title}
          error={titleError}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError) setTitleError(null);
          }}
          placeholder="Learn to sail a dinghy"
          maxLength={140}
        />

        <TextField
          label="Category"
          value={category}
          error={categoryError}
          onChangeText={(text) => {
            setCategory(text);
            if (categoryError) setCategoryError(null);
          }}
          placeholder="Water Adventures"
          style={styles.spaced}
        />

        {isNewCategory ? (
          <Text style={styles.hint}>New category — it will appear in the filter.</Text>
        ) : null}

        {suggestions.length > 0 ? (
          <View style={styles.suggestions}>
            {suggestions.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setCategory(option);
                  setCategoryError(null);
                }}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Use the category ${option}`}
              >
                <Text style={styles.chipText} numberOfLines={1}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <SegmentedControl
          label="What it costs to do"
          options={COSTS}
          value={cost}
          onChange={setCost}
          renderLabel={(o) => COST_LABEL[o]}
          accentFor={(o) =>
            o === 'low' ? colors.priorityLow : o === 'moderate' ? colors.priorityNormal : colors.priorityHigh
          }
          style={styles.spaced}
        />

        <TextField
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Optional"
          style={styles.spaced}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  spaced: { marginTop: spacing.lg },
  hint: { ...typography.caption, fontSize: 11.5, color: colors.accentCyan, marginTop: spacing.sm },

  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxWidth: '100%',
  },
  chipText: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary },
  pressed: { opacity: 0.6 },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg },
  delete: { alignItems: 'center', marginTop: spacing.lg },
  deleteText: { ...typography.caption, color: colors.danger },
}));
