/**
 * NotesListScreen - Notes, Inbox, Lists and Journal over one table.
 *
 * Four views rather than four screens, because they are four questions about
 * the same rows: what have I written, what have I not filed yet, which lists
 * do I keep, and what did I write about each day.
 *
 * v3 loads every live note ONCE for all four tabs (useNotesLibrary) and lets
 * each tab pick its rows with the pure viewNotes. Pins, colours, the Archive
 * and the Trash all act across tabs, and one array is what keeps a change -
 * and its Undo - right everywhere at once.
 *
 * LONG-PRESS, NOT SWIPE. The tabs themselves are swiped, so a card cannot be:
 * holding a card starts selection mode instead, and the header turns into the
 * actions for what is selected (Pin, Colour, Archive, Move to Trash). Back,
 * the ✕ or changing tab ends it.
 *
 * Nothing here asks "are you sure". Archive and Trash are both reversible, so
 * they act at once and offer Undo for five seconds.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, usePreventRemove } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
  SwipeTabs,
  useToast,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate, todayISO } from '../../../core/date';
import { tap } from '../../../core/haptics';
import { fonts, layout, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { ActionSheet } from '../components/ActionSheet';
import { ColorSheet } from '../components/ColorPicker';
import { JournalHeader } from '../components/JournalHeader';
import { NoteCard } from '../components/NoteCard';
import { todaysEntry } from '../journal';
import { filterNotes, isLive, splitPinned, tagCounts, viewNotes, type NotesView } from '../library';
import { NOTE_COLORS, readNoteColor, type NoteColorKey } from '../noteColors';
import type { Note } from '../types';
import { useNotesLibrary } from '../useNotes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotesList'>;

const VIEWS: NotesView[] = ['notes', 'inbox', 'checklist', 'journal'];
const VIEW_LABEL: Record<NotesView, string> = {
  notes: 'Notes',
  inbox: 'Inbox',
  checklist: 'Lists',
  journal: 'Journal',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function NotesListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const library = useNotesLibrary();
  // The actions are stable (useStableCallback), so the header's callbacks
  // below only change when the selection does - not on every render.
  const { notes, counts, reload, pin, archive, trash, restore, color } = library;

  const [view, setView] = useState<NotesView>('notes');

  /**
   * Search, tag and colour live HERE, not in each page.
   *
   * Every page of a pager is mounted, so a filter owned per page would be four
   * separate filters, and typing in one then swiping would appear to lose it.
   * One copy at the top drives whichever page you are looking at.
   */
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeColor, setActiveColor] = useState<NoteColorKey | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [colorOpen, setColorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const selecting = selectedIds.length > 0;
  const selectedNotes = useMemo(
    () => notes.filter((n) => isLive(n) && selectedIds.includes(n.id)),
    [notes, selectedIds],
  );

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const clearFilters = useCallback(() => {
    setQuery('');
    setActiveTag(null);
    setActiveColor(null);
  }, []);

  const exitSelection = useCallback(() => setSelectedIds([]), []);

  // Back leaves selection mode before it leaves the screen.
  usePreventRemove(selecting, exitSelection);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  const startSelection = useCallback((id: string) => {
    tap();
    setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  /* SELECTION ACTIONS ------------------------------------------------------ */

  const allPinned = selectedNotes.length > 0 && selectedNotes.every((n) => n.pinned_at !== null);

  const pinSelected = useCallback(() => {
    const ids = selectedNotes.map((n) => n.id);
    exitSelection();
    tap();
    void pin(ids, !allPinned);
  }, [selectedNotes, allPinned, exitSelection, pin]);

  const archiveSelected = useCallback(async () => {
    const ids = selectedNotes.map((n) => n.id);
    exitSelection();
    if (await archive(ids, true)) {
      toast.show({
        message: ids.length === 1 ? 'Archived' : `Archived ${ids.length} notes`,
        actionLabel: 'Undo',
        onAction: () => void archive(ids, false),
      });
    }
  }, [selectedNotes, exitSelection, archive, toast]);

  const trashSelected = useCallback(async () => {
    const ids = selectedNotes.map((n) => n.id);
    exitSelection();
    if (await trash(ids)) {
      toast.show({
        message: ids.length === 1 ? 'Moved to Trash' : `Moved ${ids.length} notes to Trash`,
        actionLabel: 'Undo',
        onAction: () => void restore(ids),
      });
    }
  }, [selectedNotes, exitSelection, trash, restore, toast]);

  const colorSelected = useCallback(
    (value: NoteColorKey | null) => {
      const ids = selectedNotes.map((n) => n.id);
      setColorOpen(false);
      exitSelection();
      void color(ids, value);
    },
    [selectedNotes, exitSelection, color],
  );

  /** The colour the selection shares, or undefined when it is a mix. */
  const sharedColor = useMemo(() => {
    const keys = new Set(selectedNotes.map((n) => readNoteColor(n.color)?.key ?? null));
    return keys.size === 1 ? [...keys][0] : undefined;
  }, [selectedNotes]);

  /* HEADER ----------------------------------------------------------------- */

  useLayoutEffect(() => {
    if (selecting) {
      navigation.setOptions({
        title: `${selectedNotes.length} selected`,
        headerLeft: () => (
          <HeaderButton icon="close" label="End selection" onPress={exitSelection} />
        ),
        headerRight: () => (
          <View style={styles.headerActions}>
            <HeaderButton
              icon={allPinned ? 'pin' : 'pin-outline'}
              label={allPinned ? 'Unpin' : 'Pin'}
              onPress={pinSelected}
            />
            <HeaderButton
              icon="color-palette-outline"
              label="Colour"
              onPress={() => setColorOpen(true)}
            />
            <HeaderButton icon="archive-outline" label="Archive" onPress={() => void archiveSelected()} />
            <HeaderButton
              icon="trash-outline"
              label="Move to Trash"
              onPress={() => void trashSelected()}
            />
          </View>
        ),
      });
      return;
    }

    navigation.setOptions({
      title: 'Notes',
      headerLeft: undefined,
      headerRight: () => (
        <View style={styles.headerActions}>
          <HeaderButton
            icon="archive-outline"
            label={counts.archive > 0 ? `Archive, ${plural(counts.archive, '1 note', 'notes')}` : 'Archive'}
            onPress={() => navigation.navigate('NotesShelf', { shelf: 'archive' })}
          />
          <HeaderButton
            icon="trash-outline"
            label={counts.trash > 0 ? `Trash, ${plural(counts.trash, '1 note', 'notes')}` : 'Trash'}
            badge={counts.trash > 0 ? counts.trash : undefined}
            onPress={() => navigation.navigate('NotesShelf', { shelf: 'trash' })}
          />
        </View>
      ),
    });
  }, [
    navigation,
    selecting,
    selectedNotes.length,
    allPinned,
    counts,
    exitSelection,
    pinSelected,
    archiveSelected,
    trashSelected,
    styles.headerActions,
  ]);

  /* CREATE ----------------------------------------------------------------- */

  /**
   * Today's journal entry, or a new one. Opening the existing entry rather
   * than starting a second is the daily-note rule: one page per day, found
   * in one tap.
   */
  const openToday = useCallback(() => {
    const existing = todaysEntry(viewNotes(notes, 'journal'), todayISO());
    navigation.navigate('NoteEdit', existing ? { id: existing.id } : { type: 'journal' });
  }, [navigation, notes]);

  /** A tap makes this tab's kind of thing. */
  const createForTab = useCallback(() => {
    switch (view) {
      case 'notes':
        navigation.navigate('NoteEdit', {});
        return;
      case 'inbox':
        // The Inbox is where quick captures land, so that is its "type".
        navigation.navigate('NoteEdit', { quick: true });
        return;
      case 'checklist':
        navigation.navigate('NoteEdit', { type: 'checklist' });
        return;
      case 'journal':
        openToday();
        return;
    }
  }, [view, navigation, openToday]);

  const createActions = [
    {
      key: 'note',
      label: 'Note',
      icon: 'document-text-outline' as const,
      onPress: () => {
        setCreateOpen(false);
        navigation.navigate('NoteEdit', {});
      },
    },
    {
      key: 'checklist',
      label: 'Checklist',
      icon: 'checkbox-outline' as const,
      onPress: () => {
        setCreateOpen(false);
        navigation.navigate('NoteEdit', { type: 'checklist' });
      },
    },
    {
      key: 'journal',
      label: "Today's journal",
      detail: todaysEntry(viewNotes(notes, 'journal'), todayISO())
        ? 'Opens the entry you already started'
        : `A new entry for ${formatEventDate(todayISO())}`,
      icon: 'book-outline' as const,
      onPress: () => {
        setCreateOpen(false);
        openToday();
      },
    },
  ];

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <SwipeTabs
        options={VIEWS}
        value={view}
        onChange={(next) => {
          setView(next);
          // Filters and a selection belong to the view you made them in.
          // Carrying a tag filter into the Journal would silently hide entries.
          clearFilters();
          exitSelection();
        }}
        renderLabel={(v) => VIEW_LABEL[v]}
        renderPage={(v) => (
          <NotesPage
            view={v}
            all={notes}
            loading={library.loading}
            refreshing={library.refreshing}
            error={library.error}
            onRefresh={library.refresh}
            query={query}
            activeTag={activeTag}
            activeColor={activeColor}
            onQuery={setQuery}
            onTag={setActiveTag}
            onColor={setActiveColor}
            onClearFilters={clearFilters}
            selectedIds={selectedIds}
            onOpen={(id) => (selecting ? toggleSelected(id) : navigation.navigate('NoteEdit', { id }))}
            onSelect={startSelection}
            onCreate={createForTab}
            onAnswer={(prompt) => navigation.navigate('NoteEdit', { type: 'journal', prompt })}
          />
        )}
      />

      {/* Two buttons, because they are two intentions. The small one captures a
          thought immediately; the large one makes this tab's kind of note, and
          holding it offers the other kinds. Hidden while selecting, when the
          header holds the only actions that apply. */}
      {selecting ? null : (
        <FadeInView style={[styles.fabWrap, { bottom: insets.bottom + layout.fabInset }]} delay={120}>
          {view === 'notes' || view === 'checklist' ? (
            <Pressable
              onPress={() => navigation.navigate('NoteEdit', { quick: true })}
              style={({ pressed }) => [styles.quickFab, pressed && styles.fabPressed]}
              accessibilityRole="button"
              accessibilityLabel="Quick capture"
            >
              <Ionicons name="flash-outline" size={19} color={colors.primary} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={createForTab}
            onLongPress={() => {
              tap();
              setCreateOpen(true);
            }}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel={
              view === 'journal'
                ? "Today's journal entry"
                : view === 'checklist'
                  ? 'New checklist'
                  : view === 'inbox'
                    ? 'Quick capture'
                    : 'New note'
            }
            accessibilityHint="Hold for a note, a checklist or today's journal"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      )}

      <ColorSheet
        visible={colorOpen}
        subtitle={plural(selectedNotes.length, '1 note', 'notes')}
        value={sharedColor}
        onPick={colorSelected}
        onClose={() => setColorOpen(false)}
      />

      <ActionSheet
        visible={createOpen}
        title="New"
        actions={createActions}
        onClose={() => setCreateOpen(false)}
      />
    </Screen>
  );
}

/* HEADER BUTTON ------------------------------------------------------------ */

function HeaderButton({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.headerButtonPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={21} color={colors.text} />
      {badge !== undefined ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/* ONE VIEW ----------------------------------------------------------------- */

type Row =
  | { type: 'heading'; key: string; label: string }
  | { type: 'note'; key: string; note: Note }
  | { type: 'day'; key: string; date: string; entries: Note[] };

function NotesPage({
  view,
  all,
  loading,
  refreshing,
  error,
  onRefresh,
  query,
  activeTag,
  activeColor,
  onQuery,
  onTag,
  onColor,
  onClearFilters,
  selectedIds,
  onOpen,
  onSelect,
  onCreate,
  onAnswer,
}: {
  view: NotesView;
  all: Note[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  query: string;
  activeTag: string | null;
  activeColor: NoteColorKey | null;
  onQuery: (value: string) => void;
  onTag: (value: string | null) => void;
  onColor: (value: NoteColorKey | null) => void;
  onClearFilters: () => void;
  selectedIds: string[];
  onOpen: (id: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onAnswer: (prompt: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const tabNotes = useMemo(() => viewNotes(all, view), [all, view]);
  // The Inbox is a short queue you work through and the Journal is read by
  // day, so only Notes and Lists get search and filters.
  const searchable = view === 'notes' || view === 'checklist';
  const visible = useMemo(
    () =>
      searchable
        ? filterNotes(tabNotes, { query, tag: activeTag, color: activeColor })
        : tabNotes,
    [tabNotes, searchable, query, activeTag, activeColor],
  );

  const tags = useMemo(() => tagCounts(tabNotes).map((t) => t.tag), [tabNotes]);
  const colorsInUse = useMemo(() => {
    const used = new Set(tabNotes.map((n) => readNoteColor(n.color)?.key).filter(Boolean));
    return NOTE_COLORS.filter((c) => used.has(c.key));
  }, [tabNotes]);

  const today = todayISO();

  /**
   * The rows to draw.
   *
   * Notes, Inbox and Lists: PINNED and OTHERS headings, only when something
   * is pinned - a lone "Others" heading over every note would be noise.
   *
   * Journal: grouped by the day each entry is about, newest day first. Grouped
   * here rather than in SQL, which would return either the groups or the rows
   * but not both. A pinned entry stays in its day: the journal is read in
   * order, and On this day is its way of bringing old entries back.
   */
  const rows = useMemo<Row[]>(() => {
    if (view === 'journal') {
      const days: Row[] = [];
      visible.forEach((note) => {
        const date = note.entry_date ?? note.created_at.slice(0, 10);
        const last = days[days.length - 1];
        if (last && last.type === 'day' && last.date === date) last.entries.push(note);
        else days.push({ type: 'day', key: date, date, entries: [note] });
      });
      return days;
    }

    const { pinned, others } = splitPinned(visible);
    if (pinned.length === 0) return others.map((note) => ({ type: 'note', key: note.id, note }));
    return [
      { type: 'heading', key: 'pinned', label: 'Pinned' },
      ...pinned.map((note): Row => ({ type: 'note', key: note.id, note })),
      ...(others.length > 0 ? [{ type: 'heading', key: 'others', label: 'Others' } as Row] : []),
      ...others.map((note): Row => ({ type: 'note', key: note.id, note })),
    ];
  }, [view, visible]);

  const isFiltering = query.trim().length > 0 || !!activeTag || !!activeColor;
  // Nothing at all, versus nothing matching what you typed. Showing "no notes
  // yet" to someone who mistyped a search is a small but real lie.
  const isEmpty = tabNotes.length === 0;
  const isFilteredEmpty = !isEmpty && visible.length === 0;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.backgroundElevated}
    />
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const card = (note: Note) => (
    <NoteCard
      key={note.id}
      note={note}
      onPress={() => onOpen(note.id)}
      onLongPress={() => onSelect(note.id)}
      selected={selectedIds.length > 0 ? selectedIds.includes(note.id) : undefined}
    />
  );

  const colorLabel = activeColor ? NOTE_COLORS.find((c) => c.key === activeColor)?.label.toLowerCase() : null;
  const noun =
    view === 'checklist' ? plural(visible.length, '1 list', 'lists') : plural(visible.length, '1 note', 'notes');

  const header =
    view === 'journal' ? (
      <JournalHeader entries={tabNotes} today={today} onOpen={onOpen} onAnswer={onAnswer} />
    ) : isEmpty ? null : (
      <FadeInView>
        {view === 'inbox' ? (
          <Text style={styles.inboxHint}>
            Captured in a hurry. Add a title or a tag and it files itself out of here. Pinning keeps it here.
          </Text>
        ) : (
          <>
            <SearchBar value={query} onChange={onQuery} />
            {tags.length > 0 || colorsInUse.length > 0 ? (
              <FilterRow
                tags={tags}
                activeTag={activeTag}
                onTag={onTag}
                colors={colorsInUse.map((c) => c.key)}
                activeColor={activeColor}
                onColor={onColor}
              />
            ) : null}
          </>
        )}

        {isFilteredEmpty ? null : (
          <Text style={styles.summary}>
            {noun}
            {activeTag ? ` · tagged ${activeTag}` : ''}
            {colorLabel ? ` · ${colorLabel}` : ''}
          </Text>
        )}
      </FadeInView>
    );

  const empty = isEmpty ? (
    <EmptyState
      icon={
        view === 'inbox'
          ? 'file-tray-outline'
          : view === 'checklist'
            ? 'checkbox-outline'
            : view === 'journal'
              ? 'book-outline'
              : 'document-text-outline'
      }
      accent={colors.accentAmber}
      title={
        view === 'inbox'
          ? 'Inbox is clear'
          : view === 'checklist'
            ? 'No checklists yet'
            : view === 'journal'
              ? 'No entries yet'
              : 'Nothing written yet'
      }
      message={
        view === 'inbox'
          ? 'Anything you capture without a title or tag waits here until you file it.'
          : view === 'checklist'
            ? 'A checklist is reusable: tick it off, then uncheck it all when you need it again.'
            : view === 'journal'
              ? 'A journal entry is dated by the day it is about, so you can write up yesterday this morning.'
              : 'Notes, checklists and anything you want to keep. Hold the + for other kinds.'
      }
      action={
        view === 'inbox' ? undefined : (
          <Button
            label={
              view === 'checklist' ? 'New checklist' : view === 'journal' ? 'Write an entry' : 'Write a note'
            }
            icon="add"
            onPress={onCreate}
          />
        )
      }
    />
  ) : (
    <View style={styles.noMatches}>
      <Ionicons name="search-outline" size={22} color={colors.textMuted} />
      <Text style={styles.noMatchesText}>Nothing matches {activeTag ?? (colorLabel || query.trim())}</Text>
      {isFiltering ? (
        <Pressable
          onPress={onClearFilters}
          style={styles.clearFilters}
          accessibilityRole="button"
        >
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, isEmpty && view !== 'journal' && styles.listEmpty]}
        keyboardDismissMode="on-drag"
        // Without this the first tap on a note while the search keyboard is
        // open only dismisses the keyboard, and you have to tap again.
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        renderItem={({ item: row, index }) => {
          const delay = Math.min(index, 6) * motion.stagger;
          if (row.type === 'heading') {
            return (
              <Text style={styles.sectionHeading} accessibilityRole="header">
                {row.label}
              </Text>
            );
          }
          if (row.type === 'day') {
            return (
              <FadeInView delay={delay}>
                <Text style={styles.dayHeading} accessibilityRole="header">
                  {formatEventDate(row.date)}
                </Text>
                {row.entries.map(card)}
              </FadeInView>
            );
          }
          return <FadeInView delay={delay}>{card(row.note)}</FadeInView>;
        }}
      />
      <ErrorBanner error={error} />
    </>
  );
}

/** A failed background refresh should not interrupt what you are doing. */
function ErrorBanner({ error }: { error: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!error) return null;

  return (
    <FadeInView style={[styles.errorWrap, { bottom: insets.bottom + layout.aboveFab }]}>
      <GlassCard style={styles.errorCard}>
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={17} color={colors.danger} />
          <Text style={styles.errorText} numberOfLines={2}>
            {error}
          </Text>
        </View>
      </GlassCard>
    </FadeInView>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.search}>
      <Ionicons name="search" size={16} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Search notes"
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel="Search notes"
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
        >
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Tags and colours in one sideways-scrolling row.
 *
 * Only the colours actually in use on this tab are offered, the way the tags
 * are: a filter for a colour no note wears would always come back empty.
 * Each colour chip names itself to TalkBack, and the summary line under the
 * row says the colour in words once it is on.
 */
function FilterRow({
  tags,
  activeTag,
  onTag,
  colors: colorKeys,
  activeColor,
  onColor,
}: {
  tags: string[];
  activeTag: string | null;
  onTag: (tag: string | null) => void;
  colors: NoteColorKey[];
  activeColor: NoteColorKey | null;
  onColor: (color: NoteColorKey | null) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    // Horizontal scroll: tag lists grow unpredictably, and wrapping them would
    // push the notes themselves off the screen.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tagScroll}
      style={styles.tagScrollOuter}
      keyboardShouldPersistTaps="handled"
    >
      {colorKeys.map((key) => {
        const color = readNoteColor(key);
        if (!color) return null;
        const selected = key === activeColor;
        return (
          <Pressable
            key={key}
            onPress={() => onColor(selected ? null : key)}
            style={({ pressed }) => [
              styles.colorChip,
              selected && styles.chipActive,
              pressed && styles.chipPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${color.label} notes`}
          >
            <View style={[styles.colorDot, { backgroundColor: color.swatch }]}>
              {selected ? <Ionicons name="checkmark" size={12} color={colors.onPrimary} /> : null}
            </View>
          </Pressable>
        );
      })}
      {tags.map((tag) => {
        const selected = tag === activeTag;
        return (
          <Pressable
            key={tag}
            // Tapping the active tag clears it, so no separate "all" chip.
            onPress={() => onTag(selected ? null : tag)}
            style={({ pressed }) => [styles.tagChip, selected && styles.chipActive, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Tag ${tag}`}
          >
            <Text style={[styles.tagChipText, selected && styles.tagChipTextActive]}>{tag}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  tabsTopSpacer: {
    // Clears the transparent nav header. SwipeTabs owns the tab row's own
    // padding, so this is only the gap above it.
    height: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    // Clears the add button and one toast above it.
    paddingBottom: layout.aboveFab + 64,
  },
  listEmpty: {
    flexGrow: 1,
  },

  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginRight: -spacing.sm,
  },
  headerButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPressed: {
    backgroundColor: colors.glassStrong,
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 4,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.inverseSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    ...typography.numeric,
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.onInverseSurface,
  },

  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 12,
  },

  tagScrollOuter: {
    // Negative margin lets the chips bleed to the screen edge while the list
    // keeps its gutter, so the row reads as scrollable rather than clipped.
    marginHorizontal: -spacing.xl,
    marginTop: spacing.md,
  },
  tagScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  tagChip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  colorChip: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.accentAmber + '26',
    borderColor: colors.accentAmber + '59',
  },
  chipPressed: {
    opacity: 0.7,
  },
  tagChipText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagChipTextActive: {
    color: colors.text,
  },

  summary: {
    ...typography.overline,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    ...typography.overline,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  inboxHint: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  dayHeading: {
    ...typography.overline,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  noMatches: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xxxl,
  },
  noMatchesText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  clearFilters: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  clearFiltersText: {
    ...typography.caption,
    color: colors.primary,
  },

  fabWrap: {
    // Bottom set inline: the add button sits fabInset above the safe-area
    // inset, which is where the toast expects it.
    position: 'absolute',
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickFab: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },

  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
  },
  errorCard: {
    borderColor: colors.danger + '55',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
}));
