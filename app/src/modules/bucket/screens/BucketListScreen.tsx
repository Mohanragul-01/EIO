/**
 * BucketListScreen - 818 things, filtered down to the ones you could do now.
 *
 * A list this long is only usable if it can be narrowed, so the controls are
 * the feature: cost, category and a search. The default view is deliberately
 * "not done, any cost" rather than everything - opening a bucket list to a
 * wall of things you have already done is not what you came for.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';

import { EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import * as api from '../api';
import {
  COSTS,
  COST_LABEL,
  COST_SHORT,
  categorySummary,
  matchesQuery,
  progressOf,
  type BucketItem,
  type Cost,
} from '../types';

type Status = 'todo' | 'done' | 'all';

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
      (groups.get(item.category) ?? groups.set(item.category, []).get(item.category)!).push(item);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({ title, data }));
  }, [items, status, cost, category, query]);

  /**
   * Tick optimistically.
   *
   * You scan and tick this list in bursts, and a round trip per item makes it
   * feel stuck. A failure puts the tick back and says so.
   */
  const toggle = useCallback(async (item: BucketItem) => {
    const next = !item.is_done;

    setItems((current) =>
      current.map((row) => (row.id === item.id ? { ...row, is_done: next } : row)),
    );

    try {
      await api.setDone(item.id, next);
    } catch (e) {
      // Roll back THIS row only. Restoring a whole-list snapshot would also
      // undo every other tick made while this one was in flight, and ticking
      // in bursts is exactly how this list is used.
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
      // Put this one row back where it was, rather than restoring a snapshot
      // that would resurrect anything else deleted in the meantime.
      setItems((current) => {
        if (current.some((row) => row.id === item.id)) return current;
        const next = [...current];
        next.splice(index < 0 ? next.length : index, 0, item);
        return next;
      });
      setError(e instanceof Error ? e.message : 'Could not remove that');
    }
  }, []);

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

              <View style={styles.costRow}>
                {COSTS.map((c) => (
                  <View key={c} style={styles.costStat}>
                    <View style={[styles.dot, { backgroundColor: costColor(c) }]} />
                    <Text style={styles.costStatText}>
                      {progress.byCost[c]} {COST_SHORT[c].toLowerCase()} left
                    </Text>
                  </View>
                ))}
              </View>
            </GlassCard>

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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {(['todo', 'done', 'all'] as Status[]).map((option) => (
                <Chip
                  key={option}
                  label={option === 'todo' ? 'To do' : option === 'done' ? 'Done' : 'All'}
                  active={status === option}
                  onPress={() => setStatus(option)}
                />
              ))}
              <View style={styles.chipDivider} />
              {(['any', ...COSTS] as (Cost | 'any')[]).map((option) => (
                <Chip
                  key={option}
                  label={option === 'any' ? 'Any cost' : COST_LABEL[option]}
                  active={cost === option}
                  accent={option === 'any' ? undefined : costColor(option)}
                  onPress={() => setCost(option)}
                />
              ))}
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Chip
                label={`All ${categories.length} categories`}
                active={category === 'any'}
                onPress={() => setCategory('any')}
              />
              {categories.map((c) => (
                <Chip
                  key={c.category}
                  label={`${c.category} ${c.done}/${c.total}`}
                  active={category === c.category}
                  onPress={() => setCategory(c.category)}
                />
              ))}
            </ScrollView>

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
                ? 'Run migrations 0015, then 0015a to 0015e, to import your list.'
                : 'Try a different filter, or clear the search.'
            }
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>
            {section.title} · {section.data.length}
          </Text>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => void toggle(item)}
            onLongPress={() =>
              Alert.alert(item.title, item.note || COST_LABEL[item.cost], [
                { text: 'Close', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => void remove(item),
                },
              ])
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.is_done }}
          >
            <View style={[styles.box, item.is_done && styles.boxOn]}>
              {item.is_done ? (
                <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
              ) : null}
            </View>

            <View style={[styles.dot, { backgroundColor: costColor(item.cost) }]} />

            <Text
              style={[styles.rowText, item.is_done && styles.rowTextDone]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function Chip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent?: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = accent ?? colors.primary;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: tint + '26', borderColor: tint + '66' },
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.chipText, active && { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
    paddingBottom: spacing.xxxl,
  },

  progressCard: { marginBottom: spacing.lg },
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
    gap: spacing.md,
    marginTop: spacing.md,
  },
  costStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  costStatText: { ...typography.caption, fontSize: 11.5 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.md,
    height: 42,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, padding: 0 },

  chipRow: { gap: spacing.sm, paddingBottom: spacing.md },
  chipDivider: { width: 1, backgroundColor: colors.glassBorder, marginHorizontal: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipText: { ...typography.caption, fontSize: 11.5, color: colors.textSecondary },

  sectionHeader: {
    ...typography.overline,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
  },
  rowPressed: { opacity: 0.6 },
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
  rowText: { ...typography.body, flex: 1 },
  rowTextDone: { textDecorationLine: 'line-through', color: colors.textFaint },

  error: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
}));
