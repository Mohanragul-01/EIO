/**
 * BucketListScreen - 818 things, narrowed to the ones you could do now.
 *
 * WHAT CHANGED AND WHY. This screen used to put every control on screen at
 * once: a search box, seven status and cost chips, and then all 61 CATEGORIES
 * as a horizontal chip row. Reaching Winter & Snow Sports meant swiping past
 * sixty others with nothing to search and no idea what was coming. It also cost
 * about half the screen before a single item appeared, on a screen whose entire
 * job is showing items.
 *
 * Now the controls collapse to one line - search, and a Filter button carrying
 * a count - and the filters themselves live in a sheet, where the category list
 * can be vertical, searchable, and show its own progress. What stays on screen
 * is only what is currently ON: a chip per active filter, each one removable.
 * No filters means no row.
 *
 * The default is still "to do, any cost". Opening a bucket list to a wall of
 * things you have already done is not what you came for.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import { FilterSheet, type Status } from '../components/FilterSheet';
import { ItemSheet } from '../components/ItemSheet';
import {
  COSTS,
  COST_LABEL,
  COST_SHORT,
  categorySummary,
  matchesQuery,
  progressOf,
  type BucketInput,
  type BucketItem,
  type Cost,
} from '../types';

export function BucketListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();

  const [items, setItems] = useState<BucketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<Status>('todo');
  const [cost, setCost] = useState<Cost | 'any'>('any');
  const [category, setCategory] = useState<string>('any');
  const [query, setQuery] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<BucketItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError(null);
    try {
      setItems(await api.listItems());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your list');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progress = useMemo(() => progressOf(items), [items]);
  const categories = useMemo(() => categorySummary(items), [items]);
  const categoryNames = useMemo(() => categories.map((c) => c.category), [categories]);

  /** Progress per category, so a section header can carry its own count. */
  const categoryProgress = useMemo(
    () => new Map(categories.map((c) => [c.category, c])),
    [categories],
  );

  const sections = useMemo(() => {
    const visible = items.filter((item) => {
      if (status === 'todo' && item.is_done) return false;
      if (status === 'done' && !item.is_done) return false;
      if (cost !== 'any' && item.cost !== cost) return false;
      if (category !== 'any' && item.category !== category) return false;
      return matchesQuery(item, query);
    });

    const groups = new Map<string, BucketItem[]>();
    visible.forEach((item) => {
      const bucket = groups.get(item.category);
      if (bucket) bucket.push(item);
      else groups.set(item.category, [item]);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [items, status, cost, category, query]);

  const shownCount = sections.reduce((total, s) => total + s.data.length, 0);

  /** Only the filters actually narrowing something. */
  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (status !== 'todo') {
      chips.push({
        key: 'status',
        label: status === 'done' ? 'Done' : 'All',
        clear: () => setStatus('todo'),
      });
    }
    if (cost !== 'any') {
      chips.push({ key: 'cost', label: COST_LABEL[cost], clear: () => setCost('any') });
    }
    if (category !== 'any') {
      chips.push({ key: 'category', label: category, clear: () => setCategory('any') });
    }
    return chips;
  }, [status, cost, category]);

  const clearAll = useCallback(() => {
    setStatus('todo');
    setCost('any');
    setCategory('any');
    setQuery('');
    setFiltersOpen(false);
  }, []);

  /**
   * Tick optimistically.
   *
   * You scan and tick this list in bursts, and a round trip per item makes it
   * feel stuck. A failure puts back THIS row only - restoring a whole-list
   * snapshot would also undo every other tick made while it was in flight.
   */
  const toggle = useCallback(async (item: BucketItem) => {
    const next = !item.is_done;

    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_done: next } : row)),
    );

    try {
      await api.setDone(item.id, next);
    } catch (e) {
      setItems((current) =>
        current.map((row) => (row.id === item.id ? { ...row, is_done: item.is_done } : row)),
      );
      setError(e instanceof Error ? e.message : 'Could not save that');
    }
  }, []);

  const remove = useCallback(async (item: BucketItem) => {
    let index = -1;
    setItems((current) => {
      index = current.findIndex((row) => row.id === item.id);
      return current.filter((row) => row.id !== item.id);
    });

    try {
      await api.deleteItem(item.id);
    } catch (e) {
      setItems((current) => {
        if (current.some((row) => row.id === item.id)) return current;
        const restored = [...current];
        restored.splice(index < 0 ? restored.length : index, 0, item);
        return restored;
      });
      setError(e instanceof Error ? e.message : 'Could not remove that');
    }
  }, []);

  const save = useCallback(
    async (input: BucketInput) => {
      if (editing) {
        await api.updateItem(editing.id, input);
        await load();
        return;
      }

      const created = await api.createItem(input);
      await load();

      /**
       * Make sure you can see what you just added.
       *
       * Adding something in a category you are not filtered to - or a cost tier
       * you have filtered out - used to save it and show you nothing, which
       * reads as the add having failed. Only the filters that would actually
       * hide it are cleared; a filter that still matches is left alone, because
       * you set it on purpose.
       */
      if (cost !== 'any' && created.cost !== cost) setCost('any');
      if (category !== 'any' && created.category !== category) setCategory('any');
      if (query.trim() && !matchesQuery(created, query)) setQuery('');
      // A new item is never done, so only the 'done' tab could hide it.
      if (status === 'done') setStatus('todo');
    },
    [editing, load, cost, category, query, status],
  );

  const openAdd = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const openEdit = (item: BucketItem) => {
    setEditing(item);
    setSheetOpen(true);
  };

  const costColor = (value: Cost) =>
    value === 'low'
      ? colors.priorityLow
      : value === 'moderate'
        ? colors.priorityNormal
        : colors.priorityHigh;

  if (loading) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          <FadeInView>
            <GlassCard style={styles.progressCard}>
              <View style={styles.progressRow}>
                <View>
                  <Text style={styles.progressBig}>{progress.done}</Text>
                  <Text style={styles.progressLabel}>of {progress.total} done</Text>
                </View>
                <Text style={styles.percent}>{progress.percent}%</Text>
              </View>

              <View style={styles.meter}>
                <View style={[styles.meterFill, { width: `${progress.percent}%` }]} />
              </View>

              {/*
                The cost legend doubles as the cost filter. "What can I do for
                nothing" is the question this screen exists to answer, so making
                the breakdown a label you then re-select somewhere else would be
                a wasted tap on the most common thing you do here.
              */}
              <View style={styles.costRow}>
                {COSTS.map((c) => {
                  const on = cost === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setCost(on ? 'any' : c)}
                      style={({ pressed }) => [
                        styles.costStat,
                        on && { borderColor: costColor(c) },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${progress.byCost[c]} ${COST_LABEL[c]} left`}
                    >
                      <View style={[styles.dot, { backgroundColor: costColor(c) }]} />
                      <Text style={[styles.costStatText, on && { color: costColor(c) }]}>
                        {progress.byCost[c]} {COST_SHORT[c].toLowerCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>

            <View style={styles.controls}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={16} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search the list"
                  placeholderTextColor={colors.textFaint}
                  selectionColor={colors.primary}
                  style={styles.searchInput}
                />
                {query ? (
                  <Pressable
                    onPress={() => setQuery('')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Clear the search"
                  >
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              <Pressable
                onPress={() => setFiltersOpen(true)}
                style={({ pressed }) => [
                  styles.filterButton,
                  activeFilters.length > 0 && styles.filterButtonOn,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  activeFilters.length > 0 ? `Filters, ${activeFilters.length} active` : 'Filters'
                }
              >
                <Ionicons
                  name="options-outline"
                  size={17}
                  color={activeFilters.length > 0 ? colors.primary : colors.textSecondary}
                />
                {activeFilters.length > 0 ? (
                  <Text style={styles.filterCount}>{activeFilters.length}</Text>
                ) : null}
              </Pressable>
            </View>

            {activeFilters.length > 0 ? (
              <View style={styles.activeRow}>
                {activeFilters.map((chip) => (
                  <Pressable
                    key={chip.key}
                    onPress={chip.clear}
                    style={({ pressed }) => [styles.activeChip, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove the ${chip.label} filter`}
                  >
                    <Text style={styles.activeChipText} numberOfLines={1}>
                      {chip.label}
                    </Text>
                    <Ionicons name="close" size={12} color={colors.primary} />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.countLine}>
              {shownCount === progress.total
                ? `${shownCount} things · tap to tick, hold to edit`
                : `${shownCount} of ${progress.total} · tap to tick, hold to edit`}
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </FadeInView>
        }
        ListEmptyComponent={
          <EmptyState
            icon="flag-outline"
            accent={colors.accentAmber}
            title={items.length === 0 ? 'Nothing on the list' : 'Nothing matches'}
            message={
              items.length === 0
                ? 'Add something yourself, or run migrations 0015, then 0015a to 0015e, to import the full list.'
                : 'Try a different filter, or clear the search.'
            }
            // An empty screen should offer the thing that fills it. Which
            // thing that is depends on WHY it is empty: nothing on the list at
            // all means add one, nothing matching means the filters are wrong.
            action={
              items.length === 0 ? (
                <Button label="Add something" icon="add" onPress={openAdd} />
              ) : (
                <Button label="Clear the filters" icon="close" onPress={clearAll} />
              )
            }
          />
        }
        renderSectionHeader={({ section }) => {
          const stat = categoryProgress.get(section.title);
          return (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} numberOfLines={1}>
                {section.title}
              </Text>
              <Text style={styles.sectionCount}>
                {stat ? `${stat.done}/${stat.total}` : section.data.length}
              </Text>
            </View>
          );
        }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void toggle(item)}
            onLongPress={() => openEdit(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.is_done }}
            accessibilityLabel={item.title}
            accessibilityHint="Hold to edit or remove"
          >
            <View style={[styles.box, item.is_done && styles.boxOn]}>
              {item.is_done ? (
                <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
              ) : null}
            </View>

            <View style={[styles.dot, { backgroundColor: costColor(item.cost) }]} />

            <View style={styles.rowBody}>
              <Text style={[styles.rowText, item.is_done && styles.rowTextDone]} numberOfLines={2}>
                {item.title}
              </Text>
              {item.note ? (
                <Text style={styles.rowNote} numberOfLines={1}>
                  {item.note}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      <FadeInView style={styles.fabWrap} delay={120}>
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add to the list"
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      </FadeInView>

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        status={status}
        onStatus={setStatus}
        cost={cost}
        onCost={setCost}
        category={category}
        onCategory={setCategory}
        categories={categories}
        onClear={clearAll}
      />

      <ItemSheet
        visible={sheetOpen}
        item={editing}
        defaultCategory={category}
        categories={categoryNames}
        onClose={() => setSheetOpen(false)}
        onSave={save}
        onDelete={remove}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    paddingBottom: 110,
  },

  progressCard: { marginBottom: spacing.md },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  progressBig: { ...typography.display, fontSize: 32 },
  progressLabel: { ...typography.caption },
  percent: { ...typography.title, color: colors.primary },
  meter: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: colors.success },
  costRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  costStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  costStatText: { ...typography.caption, fontSize: 11.5 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, padding: 0 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  filterButtonOn: { borderColor: colors.primary + '66', backgroundColor: colors.primary + '1A' },
  filterCount: { ...typography.caption, fontSize: 12, color: colors.primary },

  activeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary + '1A',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  activeChipText: { ...typography.caption, fontSize: 11.5, color: colors.primary, flexShrink: 1 },

  countLine: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textFaint,
    marginTop: spacing.md,
  },
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.overline, flexShrink: 1 },
  sectionCount: { ...typography.caption, fontSize: 11, color: colors.textFaint },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.6 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dot: { width: 7, height: 7, borderRadius: 4 },
  rowBody: { flex: 1 },
  rowText: { ...typography.body },
  rowTextDone: { textDecorationLine: 'line-through', color: colors.textFaint },
  rowNote: { ...typography.caption, fontSize: 11.5, color: colors.textFaint, marginTop: 2 },

  fabWrap: { position: 'absolute', right: spacing.xl, bottom: spacing.xxl },
  fab: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
  },
  fabPressed: { transform: [{ scale: 0.94 }], opacity: 0.9 },
}));
