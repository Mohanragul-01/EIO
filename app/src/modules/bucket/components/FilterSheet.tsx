/**
 * FilterSheet - status, cost and category, in one place.
 *
 * WHY A SHEET. The category filter was 61 chips in a horizontal scroll. To
 * reach Winter & Snow Sports you swiped past sixty others, with no way to see
 * what was coming and nothing to search. A horizontal chip row works for four
 * options; at sixty-one it is a worse version of a list.
 *
 * So categories are a vertical, searchable list with their own progress on each
 * row - which also answers the question you actually have when filtering by
 * category ("how much of this one is left?") rather than just narrowing to it.
 * Each row carries the category's icon, the same one its section header shows.
 *
 * Want (Now / Next / Someday) sits beside cost and never replaces it: Next is
 * a tier you filter to when choosing what comes after the shelf.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { SegmentedControl, Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { COSTS, COST_SHORT, WANTS, WANT_LABEL, type Cost, type Want } from '../types';
import { CategoryIcon } from './CategoryIcon';

export type Status = 'todo' | 'done' | 'all';

export type CategoryStat = { category: string; total: number; done: number };

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;

  status: Status;
  onStatus: (value: Status) => void;
  cost: Cost | 'any';
  onCost: (value: Cost | 'any') => void;
  want: Want | 'any';
  onWant: (value: Want | 'any') => void;
  category: string;
  onCategory: (value: string) => void;

  categories: CategoryStat[];
  onClear: () => void;
};

const STATUS: Status[] = ['todo', 'done', 'all'];
const STATUS_LABEL: Record<Status, string> = { todo: 'To do', done: 'Done', all: 'All' };

const WANT_OPTIONS: (Want | 'any')[] = ['any', ...WANTS];
const WANT_OPTION_LABEL: Record<Want | 'any', string> = { any: 'Any', ...WANT_LABEL };

const COST_OPTIONS: (Cost | 'any')[] = ['any', ...COSTS];
const COST_OPTION_LABEL: Record<Cost | 'any', string> = {
  any: 'Any',
  low: COST_SHORT.low,
  moderate: COST_SHORT.moderate,
  high: COST_SHORT.high,
};

export function FilterSheet({
  visible,
  onClose,
  status,
  onStatus,
  cost,
  onCost,
  want,
  onWant,
  category,
  onCategory,
  categories,
  onClear,
}: FilterSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return categories;
    return categories.filter((c) => c.category.toLowerCase().includes(needle));
  }, [categories, query]);

  return (
    <Sheet visible={visible} title="Filter" onClose={onClose}>
      <SegmentedControl
        label="Show"
        options={STATUS}
        value={status}
        onChange={onStatus}
        renderLabel={(o) => STATUS_LABEL[o]}
      />

      <SegmentedControl
        label="Cost to do"
        options={COST_OPTIONS}
        value={cost}
        onChange={onCost}
        renderLabel={(o) => COST_OPTION_LABEL[o]}
        style={styles.spaced}
      />

      <SegmentedControl
        label="Want"
        options={WANT_OPTIONS}
        value={want}
        onChange={onWant}
        renderLabel={(o) => WANT_OPTION_LABEL[o]}
        style={styles.spaced}
      />

      <Text style={[styles.label, styles.spaced]}>Category</Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${categories.length} categories`}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          style={styles.searchInput}
        />
        {query ? (
          <Pressable
            onPress={() => setQuery('')}
            // 48 wide and the field's 40 tall, plus 4 above and below: 48dp.
            hitSlop={{ top: 4, bottom: 4 }}
            style={styles.searchClear}
            accessibilityRole="button"
            accessibilityLabel="Clear the category search"
          >
            <Ionicons name="close-circle" size={15} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        <CategoryRow
          label="Every category"
          selected={category === 'any'}
          onPress={() => {
            onCategory('any');
            onClose();
          }}
        />

        {matches.map((c) => (
          <CategoryRow
            key={c.category}
            category={c.category}
            label={c.category}
            note={`${c.done} of ${c.total}`}
            selected={category === c.category}
            onPress={() => {
              onCategory(c.category);
              onClose();
            }}
          />
        ))}

        {matches.length === 0 ? (
          <Text style={styles.empty}>No category matches {query.trim()}</Text>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={onClear}
        style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Clear every filter"
      >
        <Text style={styles.clearText}>Clear all filters</Text>
      </Pressable>
    </Sheet>
  );
}

function CategoryRow({
  category,
  label,
  note,
  selected,
  onPress,
}: {
  /** Absent for "Every category", which has no icon of its own. */
  category?: string;
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={note ? `${label}, ${note} done` : label}
    >
      {category ? (
        <CategoryIcon category={category} size={16} color={selected ? colors.primary : undefined} />
      ) : (
        <Ionicons name="apps-outline" size={16} color={selected ? colors.primary : colors.textMuted} />
      )}
      <Text style={[styles.rowLabel, selected && styles.rowLabelOn]} numberOfLines={1}>
        {label}
      </Text>
      {note ? <Text style={styles.rowNote}>{note}</Text> : null}
      {selected ? <Ionicons name="checkmark" size={16} color={colors.primary} /> : null}
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: { ...typography.overline },
  spaced: { marginTop: spacing.lg },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    height: 40,
    marginTop: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, fontSize: 14, color: colors.text, padding: 0 },
  // Pulled into the field's padding so the icon sits at its edge.
  searchClear: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },

  // Shorter since Want joined the sheet, so the whole sheet still fits a small
  // phone without the controls above scrolling away.
  list: { marginTop: spacing.sm, maxHeight: 220 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  rowLabel: { ...typography.body, fontSize: 14, flex: 1, color: colors.textSecondary },
  rowLabelOn: { color: colors.primary },
  rowNote: { ...typography.caption, ...typography.numeric, fontSize: 11.5, color: colors.textFaint },
  pressed: { opacity: 0.6 },
  empty: { ...typography.caption, paddingVertical: spacing.lg },

  clear: { alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: spacing.sm },
  clearText: { ...typography.caption, color: colors.danger },
}));
