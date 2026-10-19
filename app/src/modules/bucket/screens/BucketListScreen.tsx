/**
 * BucketListScreen - 818 things, narrowed to the ones you could do now.
 *
 * The controls collapse to one line - search, and a Filter button carrying a
 * count - and the filters themselves live in a sheet, where the category list
 * can be vertical, searchable, and show its own progress. What stays on screen
 * is only what is currently ON: a chip per active filter, each one removable.
 *
 * Above the list, in the To do view only, because that is where choosing
 * happens: Pick for me (three things for today, from whatever the filters
 * show) and the Now shelf (the few you are actually doing, with their plans).
 *
 * TICK, THEN REMEMBER. A tap still ticks, at once. A bar follows - "Done ·
 * today", Add memory, Undo - so remembering is offered after the tick rather
 * than standing in front of it. Most ticks will never get a memory; the ones
 * done years ago can be backdated from there.
 *
 * The Done view is not a list any more but the Lived timeline: years and
 * months of what you did, each year opening with its summary card.
 *
 * TOASTS AND SHEETS. A toast is drawn under any open sheet, so every action
 * taken inside a sheet closes the sheet first and only then offers its Undo.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Screen,
  useToast,
} from '../../../core/components';
import { todayISO } from '../../../core/date';
import * as haptics from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, radius, spacing } from '../../../core/theme';
import type { ItemPatch } from '../api';
import { CategoryIcon } from '../components/CategoryIcon';
import { CostMark, useCostColor } from '../components/CostMark';
import { DoneBar, type DoneBarState } from '../components/DoneBar';
import { FilterSheet, type Status } from '../components/FilterSheet';
import { ItemSheet, type ItemTab, type StepActions } from '../components/ItemSheet';
import { LivedRow, MonthHeader, YearCard } from '../components/Lived';
import type { MemoryDraft } from '../components/MemoryFields';
import { MemorySheet } from '../components/MemorySheet';
import { MoveSheet } from '../components/MoveSheet';
import { NowShelf } from '../components/NowShelf';
import { PickCard } from '../components/PickCard';
import { SwapSheet } from '../components/SwapSheet';
import { livedTimeline, summariseYear, type YearSummary } from '../lived';
import { readPickPrefs, writePickPrefs } from '../pickPrefs';
import { pickPool, pickSeed, picksFor, snoozeUntil, type PickPrefs } from '../picks';
import { formatTarget, type Target } from '../plan';
import { isShelfFull, nowShelf, stepsByItem } from '../shelf';
import {
  COSTS,
  COST_LABEL,
  COST_SHORT,
  UNDONE,
  WANT_LABEL,
  categorySummary,
  doneStateOf,
  matchesQuery,
  progressOf,
  tickedState,
  wantOf,
  type BucketInput,
  type BucketItem,
  type BucketStep,
  type Cost,
  type DoneState,
  type Want,
} from '../types';
import { useBucket } from '../useBucket';
import { formatWhen, whenToDone } from '../when';

type Row =
  | { kind: 'item'; key: string; item: BucketItem }
  | { kind: 'month'; key: string; year: number | null; month: number | null; count: number }
  | { kind: 'lived'; key: string; item: BucketItem };

type Section =
  | { key: string; kind: 'category'; title: string; data: Row[] }
  | { key: string; kind: 'year'; year: number | null; summary: YearSummary; data: Row[] };

const NO_STEPS: BucketStep[] = [];

export function BucketListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const costColor = useCostColor();

  const bucket = useBucket();
  const { items, steps, load, patch } = bucket;
  const today = todayISO();

  const [status, setStatus] = useState<Status>('todo');
  const [cost, setCost] = useState<Cost | 'any'>('any');
  const [want, setWant] = useState<Want | 'any'>('any');
  const [category, setCategory] = useState<string>('any');
  const [query, setQuery] = useState('');

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editor, setEditor] = useState<{ itemId: string | null; tab: ItemTab } | null>(null);
  const [memoryFor, setMemoryFor] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [moveFor, setMoveFor] = useState<string | null>(null);

  /** Pick for me: today's shuffle and the fold, remembered on this device. */
  const [pickPrefs, setPickPrefs] = useState<PickPrefs>({ roll: 0, collapsed: false });
  /** The card's own cost leaning, used while the screen has no cost filter. */
  const [pickCost, setPickCost] = useState<Cost | 'any'>('low');

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    let alive = true;
    void readPickPrefs(today).then((prefs) => {
      if (alive) setPickPrefs(prefs);
    });
    return () => {
      alive = false;
    };
  }, [today]);

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const find = (id: string | null) => (id ? (byId.get(id) ?? null) : null);

  const progress = useMemo(() => progressOf(items), [items]);
  const categories = useMemo(() => categorySummary(items), [items]);
  const categoryNames = useMemo(() => categories.map((c) => c.category), [categories]);
  /** Progress per category, so a section header can carry its own count. */
  const categoryProgress = useMemo(
    () => new Map(categories.map((c) => [c.category, c])),
    [categories],
  );
  const stepsMap = useMemo(() => stepsByItem(steps), [steps]);
  const stepsFor = useCallback((item: BucketItem) => stepsMap.get(item.id) ?? NO_STEPS, [stepsMap]);
  const shelf = useMemo(() => nowShelf(items), [items]);

  const filtersNarrow =
    cost !== 'any' || category !== 'any' || want !== 'any' || query.trim() !== '';

  const sections = useMemo<Section[]>(() => {
    const visible = items.filter((item) => {
      if (status === 'todo' && item.is_done) return false;
      if (status === 'done' && !item.is_done) return false;
      if (cost !== 'any' && item.cost !== cost) return false;
      if (want !== 'any' && wantOf(item) !== want) return false;
      if (category !== 'any' && item.category !== category) return false;
      return matchesQuery(item, query);
    });

    if (status === 'done') {
      return livedTimeline(visible).map((group) => ({
        key: `year-${group.year ?? 'unknown'}`,
        kind: 'year' as const,
        year: group.year,
        summary: summariseYear(group.items),
        data: group.months.flatMap((month): Row[] => [
          {
            kind: 'month',
            key: `month-${group.year}-${month.month}`,
            year: group.year,
            month: month.month,
            count: month.items.length,
          },
          ...month.items.map((item): Row => ({ kind: 'lived', key: item.id, item })),
        ]),
      }));
    }

    const groups = new Map<string, BucketItem[]>();
    visible.forEach((item) => {
      const rows = groups.get(item.category);
      if (rows) rows.push(item);
      else groups.set(item.category, [item]);
    });

    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, rows]) => ({
        key: `category-${title}`,
        kind: 'category' as const,
        title,
        data: rows.map((item): Row => ({ kind: 'item', key: item.id, item })),
      }));
  }, [items, status, cost, want, category, query]);

  const shownCount = sections.reduce(
    (total, s) => total + s.data.filter((row) => row.kind !== 'month').length,
    0,
  );

  /* PICK FOR ME ------------------------------------------------------------ */

  const pickCostInUse = cost !== 'any' ? cost : pickCost;
  const pool = useMemo(
    () => pickPool(items, { cost: pickCostInUse, category, query, want }, today),
    [items, pickCostInUse, category, query, want, today],
  );
  /** The same pool at any cost: whether "Pick from any cost" would find anything. */
  const widerPoolSize = useMemo(
    () =>
      pickCostInUse === 'any'
        ? 0
        : pickPool(items, { cost: 'any', category, query, want }, today).length,
    [items, pickCostInUse, category, query, want, today],
  );
  const picks = useMemo(
    () => picksFor(pool, pickSeed(today, pickPrefs.roll)),
    [pool, today, pickPrefs.roll],
  );

  const updatePickPrefs = (next: PickPrefs) => {
    setPickPrefs(next);
    void writePickPrefs({ day: today, ...next });
  };

  /* FEEDBACK --------------------------------------------------------------- */

  /**
   * The bar that follows a tick. Its id, the row it is about and what the row
   * was before live in a ref, because Undo must act on exactly the tick the
   * bar describes even if another tick has re-rendered the screen since.
   */
  const [doneBar, setDoneBar] = useState<DoneBarState | null>(null);
  const barRef = useRef<{ id: number; itemId: string; previous: DoneState } | null>(null);
  const barSeq = useRef(0);

  const closeBar = useCallback((id: number) => {
    if (barRef.current?.id === id) barRef.current = null;
    setDoneBar((current) => (current?.id === id ? null : current));
  }, []);

  /** A toast replaces the bar: two floating things in one place is one too many. */
  const showToast = (message: string, onUndo?: () => void) => {
    if (barRef.current) closeBar(barRef.current.id);
    toast.show(onUndo ? { message, actionLabel: 'Undo', onAction: onUndo } : { message });
  };

  /* ACTIONS ---------------------------------------------------------------- */

  const restore = (id: string, fields: ItemPatch) => {
    haptics.tap();
    void patch(id, fields);
  };

  const untick = (item: BucketItem) => {
    const previous = doneStateOf(item);
    haptics.tap();
    void patch(item.id, UNDONE);
    // The memory, place and "again" stay: they are your writing, and an
    // accidental untick must not erase them. Undo brings the date back too.
    showToast(`Not done · ${item.title}`, () => restore(item.id, previous));
  };

  const tick = (item: BucketItem) => {
    if (item.is_done) {
      untick(item);
      return;
    }
    const previous = doneStateOf(item);
    haptics.success();
    toast.hide();

    const id = ++barSeq.current;
    barRef.current = { id, itemId: item.id, previous };
    setDoneBar({ id, message: 'Done · today', spoken: `${item.title}, done today` });

    void patch(item.id, tickedState(today)).then((ok) => {
      // The tick did not happen, so a bar offering to remember it would lie.
      if (!ok) closeBar(id);
    });
  };

  const undoTick = () => {
    const bar = barRef.current;
    if (!bar) return;
    closeBar(bar.id);
    restore(bar.itemId, bar.previous);
  };

  const addMemoryFromBar = () => {
    const bar = barRef.current;
    if (!bar) return;
    closeBar(bar.id);
    setMemoryFor(bar.itemId);
  };

  const saveMemory = (item: BucketItem, draft: MemoryDraft) => {
    // Closed first: nothing said after this would be visible under the sheet.
    setMemoryFor(null);
    void patch(item.id, {
      // Saying when you did it says that you did it, whatever else happened
      // to the tick in the meantime.
      is_done: true,
      ...whenToDone(draft.when, today),
      memory: draft.memory.trim(),
      place: draft.place.trim(),
      again: draft.again,
    });
  };

  const putOnNow = (item: BucketItem) => {
    if (item.focus === 'now') return;
    if (isShelfFull(items)) {
      haptics.warning();
      setSwapFor(item.id);
      return;
    }
    const previous = item.focus;
    haptics.tap();
    void patch(item.id, { focus: 'now' }).then((ok) => {
      if (ok) showToast(`On Now · ${item.title}`, () => restore(item.id, { focus: previous }));
    });
  };

  const notNow = (item: BucketItem) => {
    const previous = item.snoozed_until;
    haptics.tap();
    void patch(item.id, { snoozed_until: snoozeUntil(today) }).then((ok) => {
      if (ok) {
        showToast('Hidden from picks for 30 days', () =>
          restore(item.id, { snoozed_until: previous }),
        );
      }
    });
  };

  const swap = (out: BucketItem, incoming: BucketItem) => {
    setSwapFor(null);
    const incomingWas = incoming.focus;
    haptics.tap();
    void bucket.swapNow(out.id, incoming.id).then((ok) => {
      if (!ok) return;
      showToast(`${out.title} moved to Next`, () => {
        // Undone in the same order the swap was made: whatever is leaving
        // Now goes first, so the shelf never holds six.
        haptics.tap();
        void patch(incoming.id, { focus: incomingWas }).then(
          (back) => back && patch(out.id, { focus: 'now' }),
        );
      });
    });
  };

  const putOnNext = (incoming: BucketItem) => {
    setSwapFor(null);
    const previous = incoming.focus;
    if (previous === 'next') return;
    void patch(incoming.id, { focus: 'next' }).then((ok) => {
      if (ok) {
        showToast(`On Next · ${incoming.title}`, () => restore(incoming.id, { focus: previous }));
      }
    });
  };

  const moveTarget = (item: BucketItem, target: Target, label: string) => {
    setMoveFor(null);
    const previous: Target = { target_on: item.target_on, target_precision: item.target_precision };
    void patch(item.id, target).then((ok) => {
      if (!ok) return;
      const said =
        target.target_on && target.target_precision
          ? formatTarget(target.target_on, target.target_precision, today)
          : label;
      showToast(`Target moved to ${said}`, () => restore(item.id, previous));
    });
  };

  const openEditor = (item: BucketItem | null, tab: ItemTab = 'about') => {
    setEditor({ itemId: item?.id ?? null, tab });
  };

  const editing = editor ? find(editor.itemId) : null;

  const saveEditor = async (fields: BucketInput & ItemPatch) => {
    // Asking for a sixth place on Now never quietly grows the shelf: the
    // save keeps the old want, then the swap sheet asks which one makes way.
    const others = items.filter((item) => item.id !== editing?.id);
    const needsSwap = fields.focus === 'now' && editing?.focus !== 'now' && isShelfFull(others);

    if (editing) {
      await bucket.save(editing.id, needsSwap ? { ...fields, focus: editing.focus } : fields);
      setEditor(null);
      if (needsSwap) setSwapFor(editing.id);
      return;
    }

    const created = await bucket.create(needsSwap ? { ...fields, focus: 'next' } : fields);
    setEditor(null);
    if (needsSwap) setSwapFor(created.id);

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
    if (want !== 'any' && wantOf(created) !== want) setWant('any');
    if (category !== 'any' && created.category !== category) setCategory('any');
    if (query.trim() && !matchesQuery(created, query)) setQuery('');
    // A new item is never done, so only the 'done' view could hide it.
    if (status === 'done') setStatus('todo');
  };

  const removeItem = (item: BucketItem) => {
    setEditor(null);
    void bucket.remove(item);
  };

  const markUndone = (item: BucketItem) => {
    setEditor(null);
    untick(item);
  };

  const stepActions: StepActions = {
    add: (itemId, title) => void bucket.addStep(itemId, title),
    toggle: (step) => {
      haptics.tap();
      void bucket.toggleStep(step);
    },
    remove: (step) => void bucket.removeStep(step),
    restore: (step) => void bucket.restoreStep(step),
    move: (step, direction) => void bucket.moveStep(step, direction),
  };

  /* FILTERS ---------------------------------------------------------------- */

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
    if (want !== 'any') {
      chips.push({ key: 'want', label: WANT_LABEL[want], clear: () => setWant('any') });
    }
    if (category !== 'any') {
      chips.push({ key: 'category', label: category, clear: () => setCategory('any') });
    }
    return chips;
  }, [status, cost, want, category]);

  const clearAll = useCallback(() => {
    setStatus('todo');
    setCost('any');
    setWant('any');
    setCategory('any');
    setQuery('');
    setFiltersOpen(false);
  }, []);

  if (bucket.loading) {
    return (
      <Screen padded={false}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const countLine =
    status === 'done'
      ? `${shownCount} done · tap one to add or change its memory`
      : shownCount === progress.total
        ? `${shownCount} things · tap to tick, hold to edit`
        : `${shownCount} of ${progress.total} · tap to tick, hold to edit`;

  const header = (
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
                hitSlop={{ top: 6, bottom: 6 }}
                style={({ pressed }) => [
                  styles.costStat,
                  on && { borderColor: costColor(c) },
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${progress.byCost[c]} ${COST_LABEL[c]} left`}
              >
                <CostMark cost={c} />
                <Text style={[styles.costStatText, on && { color: costColor(c) }]}>
                  {progress.byCost[c]} {COST_SHORT[c].toLowerCase()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      {status === 'todo' && items.length > 0 ? (
        <>
          <PickCard
            picks={picks}
            poolSize={pool.length}
            costChip={
              cost === 'any' && pickCost !== 'any'
                ? { label: COST_LABEL[pickCost], onClear: () => setPickCost('any') }
                : null
            }
            onWiden={
              cost === 'any' && pickCost !== 'any' && pool.length === 0 && widerPoolSize > 0
                ? () => setPickCost('any')
                : null
            }
            collapsed={pickPrefs.collapsed}
            onToggleCollapsed={() =>
              updatePickPrefs({ ...pickPrefs, collapsed: !pickPrefs.collapsed })
            }
            onShuffle={() => {
              haptics.tap();
              updatePickPrefs({ ...pickPrefs, roll: pickPrefs.roll + 1 });
            }}
            onOpen={(item) => openEditor(item)}
            onPin={putOnNow}
            onNotNow={notNow}
          />

          <NowShelf
            shelf={shelf}
            stepsFor={stepsFor}
            today={today}
            onOpen={(item) => openEditor(item, 'plan')}
            onMove={(item) => setMoveFor(item.id)}
          />
        </>
      ) : null}

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
            accessibilityLabel="Search the list"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              hitSlop={16}
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
              hitSlop={{ top: 6, bottom: 6 }}
              style={({ pressed }) => [styles.activeChip, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${chip.label} filter`}
            >
              {chip.key === 'category' ? (
                <CategoryIcon category={chip.label} size={12} color={colors.primary} />
              ) : null}
              <Text style={styles.activeChipText} numberOfLines={1}>
                {chip.label}
              </Text>
              <Ionicons name="close" size={12} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Text style={styles.countLine}>{countLine}</Text>

      {bucket.error ? <Text style={styles.error}>{bucket.error}</Text> : null}
    </FadeInView>
  );

  const renderItemRow = (item: BucketItem) => {
    const done = item.is_done;
    const doneLabel =
      done && item.done_on
        ? formatWhen(item.done_on, item.done_precision ?? 'day', { short: true })
        : null;
    const spoken = [
      item.title,
      COST_LABEL[item.cost],
      item.focus && !done ? `on ${WANT_LABEL[item.focus]}` : null,
      done ? (doneLabel ? `done ${doneLabel}` : 'done') : null,
    ]
      .filter(Boolean)
      .join(', ');

    return (
      <Pressable
        onPress={() => tick(item)}
        onLongPress={() => openEditor(item)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={spoken}
        accessibilityHint="Hold to edit, plan or remove"
      >
        <View style={[styles.box, done && styles.boxOn]}>
          {done ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>

        <View style={styles.rowBody}>
          {/* Done rows are muted, not struck through: done is not wrong. */}
          <Text style={[styles.rowText, done && styles.rowTextDone]} numberOfLines={2}>
            {item.title}
          </Text>
          {item.note ? (
            <Text style={styles.rowNote} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>

        {item.focus && !done ? (
          <View style={styles.wantTag}>
            <Text style={styles.wantTagText}>{WANT_LABEL[item.focus]}</Text>
          </View>
        ) : null}
        {done && item.memory ? (
          <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
        ) : null}
        {doneLabel ? <Text style={styles.doneDate}>{doneLabel}</Text> : null}
        <CostMark cost={item.cost} />
      </Pressable>
    );
  };

  return (
    <Screen padded={false}>
      <SectionList<Row, Section>
        sections={sections}
        keyExtractor={(row) => row.key}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          // Clear of the add button and the bar above it, so the last row
          // can always be scrolled into reach.
          { paddingBottom: insets.bottom + layout.aboveFab + 72 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={bucket.refreshing}
            onRefresh={() => void bucket.refresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon={status === 'done' && items.length > 0 ? 'calendar-outline' : 'flag-outline'}
            accent={colors.accentAmber}
            title={
              items.length === 0
                ? 'Nothing on the list'
                : status === 'done' && !filtersNarrow
                  ? 'Nothing done yet'
                  : 'Nothing matches'
            }
            message={
              items.length === 0
                ? 'Add something yourself, or run migrations 0015, then 0015a to 0015e, to import the full list.'
                : status === 'done' && !filtersNarrow
                  ? 'Tick something you have done - then add when it happened, even years ago.'
                  : 'Try a different filter, or clear the search.'
            }
            // An empty screen should offer the thing that fills it. Which
            // thing that is depends on WHY it is empty: nothing on the list at
            // all means add one, nothing matching means the filters are wrong.
            action={
              items.length === 0 ? (
                <Button label="Add something" icon="add" onPress={() => openEditor(null)} />
              ) : (
                <Button label="Clear the filters" icon="close" onPress={clearAll} />
              )
            }
          />
        }
        renderSectionHeader={({ section }) => {
          if (section.kind === 'year') {
            return (
              <YearCard year={section.year} summary={section.summary} filtered={filtersNarrow} />
            );
          }
          const stat = categoryProgress.get(section.title);
          return (
            <View style={styles.sectionHeader}>
              <CategoryIcon category={section.title} size={13} tile />
              <Text style={styles.sectionTitle} numberOfLines={1} accessibilityRole="header">
                {section.title}
              </Text>
              <Text style={styles.sectionCount}>
                {stat ? `${stat.done}/${stat.total}` : section.data.length}
              </Text>
            </View>
          );
        }}
        renderItem={({ item: row }) => {
          if (row.kind === 'month') {
            return <MonthHeader year={row.year} month={row.month} count={row.count} />;
          }
          if (row.kind === 'lived') {
            return <LivedRow item={row.item} onOpen={(item) => openEditor(item, 'memory')} />;
          }
          return renderItemRow(row.item);
        }}
      />

      <FadeInView
        style={[styles.fabWrap, { bottom: insets.bottom + layout.fabInset }]}
        delay={120}
      >
        <Pressable
          onPress={() => openEditor(null)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add to the list"
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      </FadeInView>

      <DoneBar bar={doneBar} onAddMemory={addMemoryFromBar} onUndo={undoTick} onExpire={closeBar} />

      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        status={status}
        onStatus={setStatus}
        cost={cost}
        onCost={setCost}
        want={want}
        onWant={setWant}
        category={category}
        onCategory={setCategory}
        categories={categories}
        onClear={clearAll}
      />

      <ItemSheet
        visible={editor !== null}
        item={editing}
        initialTab={editor?.tab}
        defaultCategory={category}
        categories={categoryNames}
        steps={editing ? stepsFor(editing) : NO_STEPS}
        today={today}
        shelfFull={isShelfFull(items.filter((item) => item.id !== editing?.id))}
        onClose={() => setEditor(null)}
        onSave={saveEditor}
        onDelete={removeItem}
        onMarkUndone={markUndone}
        stepActions={stepActions}
      />

      <MemorySheet
        item={find(memoryFor)}
        today={today}
        onClose={() => setMemoryFor(null)}
        onSave={saveMemory}
      />

      <SwapSheet
        incoming={find(swapFor)}
        shelf={shelf}
        onSwap={swap}
        onNext={putOnNext}
        onClose={() => setSwapFor(null)}
      />

      <MoveSheet
        item={find(moveFor)}
        today={today}
        onMove={moveTarget}
        onClose={() => setMoveFor(null)}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96,
  },
  pressed: { opacity: 0.6 },

  progressCard: { marginBottom: spacing.md },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  progressBig: { ...typography.display, ...typography.numeric, fontSize: 32 },
  progressLabel: { ...typography.caption },
  percent: { ...typography.title, ...typography.numeric, color: colors.primary },
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
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  costStatText: { ...typography.caption, ...typography.numeric, fontSize: 11.5 },

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
    height: 48,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, padding: 0 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    minWidth: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  filterButtonOn: { borderColor: colors.primary, backgroundColor: colors.glassStrong },
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
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
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
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: { ...typography.overline, flex: 1 },
  sectionCount: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11,
    color: colors.textFaint,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
    paddingVertical: 8,
  },
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
  rowBody: { flex: 1 },
  rowText: { ...typography.body },
  rowTextDone: { color: colors.textMuted },
  rowNote: { ...typography.caption, fontSize: 11.5, color: colors.textFaint, marginTop: 2 },
  wantTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  wantTagText: { ...typography.caption, fontSize: 10.5, color: colors.primary },
  doneDate: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11,
    color: colors.textMuted,
  },

  fabWrap: { position: 'absolute', right: spacing.xl },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
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
