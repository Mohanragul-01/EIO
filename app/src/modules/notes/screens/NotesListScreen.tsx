/**
 * NotesListScreen - Notes, Inbox and Journal over one table.
 *
 * Three views rather than three screens, because they are three questions about
 * the same rows: what have I written, what have I not filed yet, and what did I
 * write about each day. Only the Journal renders differently, and only because
 * it groups by the day an entry is about.
 *
 * Quick capture sits beside the main add button rather than replacing it. The
 * two are genuinely different intentions: one is "get this down now", the other
 * is "write something properly", and collapsing them would make the fast path
 * slower for no gain.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
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

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Screen,
  SwipeTabs,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate } from '../../../core/date';
import { fonts, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { NoteCard } from '../components/NoteCard';
import type { Note } from '../types';
import { useNotes, type NotesView } from '../useNotes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotesList'>;

const VIEWS: NotesView[] = ['notes', 'inbox', 'checklist', 'journal'];
const VIEW_LABEL: Record<NotesView, string> = {
  notes: 'Notes',
  inbox: 'Inbox',
  checklist: 'Lists',
  journal: 'Journal',
};

export function NotesListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [view, setView] = useState<NotesView>('notes');

  /**
   * Search and tag live HERE, not in each page's hook.
   *
   * Every page of a pager is mounted, so a filter owned per page would be four
   * separate filters, and typing in one then swiping would appear to lose it.
   * One copy at the top drives whichever page you are looking at.
   */
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const clearFilters = useCallback(() => {
    setQuery('');
    setActiveTag(null);
  }, []);

  return (
    <Screen padded={false}>
      <View style={styles.tabsTopSpacer} />

      <SwipeTabs
        options={VIEWS}
        value={view}
        onChange={(next) => {
          setView(next);
          // Filters belong to the view you set them in. Carrying a tag filter
          // into the Journal would silently hide entries.
          clearFilters();
        }}
        renderLabel={(v) => VIEW_LABEL[v]}
        renderPage={(v) => (
          <NotesPage
            view={v}
            query={query}
            activeTag={activeTag}
            onQuery={setQuery}
            onTag={setActiveTag}
            onClearFilters={clearFilters}
            onOpen={(id) => navigation.navigate('NoteEdit', { id })}
            onCreate={(params) => navigation.navigate('NoteEdit', params)}
          />
        )}
      />

      {/* Two buttons, because they are two intentions. The small one captures a
          thought immediately; the large one opens the full form. */}
      <FadeInView style={styles.fabWrap} delay={120}>
        {view !== 'journal' ? (
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
          onPress={() =>
            navigation.navigate(
              'NoteEdit',
              view === 'journal'
                ? { type: 'journal' }
                : view === 'checklist'
                  ? { type: 'checklist' }
                  : {},
            )
          }
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel={view === 'journal' ? 'Write an entry' : 'Write a note'}
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      </FadeInView>
    </Screen>
  );
}

/* ONE VIEW ----------------------------------------------------------------- */

type CreateParams = { type?: 'note' | 'checklist' | 'journal' } | Record<string, never>;

function NotesPage({
  view,
  query,
  activeTag,
  onQuery,
  onTag,
  onClearFilters,
  onOpen,
  onCreate,
}: {
  view: NotesView;
  query: string;
  activeTag: string | null;
  onQuery: (value: string) => void;
  onTag: (value: string | null) => void;
  onClearFilters: () => void;
  onOpen: (id: string) => void;
  onCreate: (params: CreateParams) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const { notes, totalCount, allTags, loading, refreshing, error, refresh, reload } = useNotes(
    view,
    { query, activeTag },
  );

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /**
   * Journal entries grouped by the day they are about, newest day first.
   *
   * Grouped here rather than in SQL: Postgres would have to return either one
   * row per group or the rows themselves, and we need both the heading and the
   * entries under it. The list is already sorted by entry_date from the query,
   * so this is a single pass that only inserts headings.
   */
  const journalSections = useMemo(() => {
    if (view !== 'journal') return [];

    const groups: { date: string; entries: Note[] }[] = [];
    notes.forEach((note) => {
      const date = note.entry_date ?? note.created_at.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.date === date) last.entries.push(note);
      else groups.push({ date, entries: [note] });
    });
    return groups;
  }, [notes, view]);

  const isSearching = query.trim().length > 0 || !!activeTag;
  // Nothing at all, versus nothing matching what you typed. Showing "no notes
  // yet" to someone who mistyped a search is a small but real lie.
  const isEmpty = totalCount === 0;
  const isFilteredEmpty = !isEmpty && notes.length === 0;

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={refresh}
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

  if (view === 'journal') {
    return (
      <>
        <FlatList
          data={journalSections}
          keyExtractor={(section) => section.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
          refreshControl={refreshControl}
          ListEmptyComponent={
            <EmptyState
              icon="book-outline"
              accent={colors.accentAmber}
              title="No entries yet"
              message="A journal entry is dated by the day it is about, so you can write up yesterday this morning."
              action={
                <Button
                  label="Write an entry"
                  icon="add"
                  onPress={() => onCreate({ type: 'journal' })}
                />
              }
            />
          }
          renderItem={({ item: section, index }) => (
            <FadeInView delay={Math.min(index, 6) * motion.stagger}>
              <Text style={styles.dayHeading}>{formatEventDate(section.date)}</Text>
              {section.entries.map((note) => (
                <NoteCard key={note.id} note={note} onPress={() => onOpen(note.id)} />
              ))}
            </FadeInView>
          )}
        />
        <ErrorBanner error={error} />
      </>
    );
  }

  return (
    <>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        keyboardDismissMode="on-drag"
        // Without this the first tap on a note while the search keyboard is
        // open only dismisses the keyboard, and you have to tap again.
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        ListHeaderComponent={
          isEmpty ? null : (
            <FadeInView>
              {/* The inbox is a short queue you work through, so it gets no
                  search: filtering a handful of unfiled notes is busywork. */}
              {view === 'inbox' ? (
                <Text style={styles.inboxHint}>
                  Captured in a hurry. Add a title or a tag and it files itself out of here.
                </Text>
              ) : (
                <>
                  <SearchBar value={query} onChange={onQuery} />
                  {allTags.length > 0 ? (
                    <TagFilter tags={allTags} active={activeTag} onChange={onTag} />
                  ) : null}
                </>
              )}

              {isFilteredEmpty ? null : (
                <Text style={styles.summary}>
                  {notes.length}{' '}
                  {view === 'checklist'
                    ? notes.length === 1
                      ? 'list'
                      : 'lists'
                    : notes.length === 1
                      ? 'note'
                      : 'notes'}
                  {activeTag ? ` tagged ${activeTag}` : ''}
                </Text>
              )}
            </FadeInView>
          )
        }
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              icon={
                view === 'inbox'
                  ? 'file-tray-outline'
                  : view === 'checklist'
                    ? 'checkbox-outline'
                    : 'document-text-outline'
              }
              accent={colors.accentAmber}
              title={
                view === 'inbox'
                  ? 'Inbox is clear'
                  : view === 'checklist'
                    ? 'No checklists yet'
                    : 'Nothing written yet'
              }
              message={
                view === 'inbox'
                  ? 'Anything you capture without a title or tag waits here until you file it.'
                  : view === 'checklist'
                    ? 'A checklist is reusable: tick it off, then uncheck it all when you need it again.'
                    : 'Notes, checklists and anything you want to keep.'
              }
              action={
                view === 'inbox' ? undefined : (
                  <Button
                    label={view === 'checklist' ? 'New checklist' : 'Write a note'}
                    icon="add"
                    onPress={() => onCreate(view === 'checklist' ? { type: 'checklist' } : {})}
                  />
                )
              }
            />
          ) : (
            <View style={styles.noMatches}>
              <Ionicons name="search-outline" size={22} color={colors.textFaint} />
              <Text style={styles.noMatchesText}>
                Nothing matches {activeTag ? activeTag : query.trim()}
              </Text>
              {isSearching ? (
                <Pressable onPress={onClearFilters} hitSlop={8}>
                  <Text style={styles.clearFilters}>Clear filters</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <NoteCard note={item} onPress={() => onOpen(item.id)} />
          </FadeInView>
        )}
      />
      <ErrorBanner error={error} />
    </>
  );
}

/** A failed background refresh should not interrupt what you are doing. */
function ErrorBanner({ error }: { error: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (!error) return null;

  return (
    <FadeInView style={styles.errorWrap}>
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
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChange('')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Clear the search"
        >
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function TagFilter({
  tags,
  active,
  onChange,
}: {
  tags: string[];
  active: string | null;
  onChange: (tag: string | null) => void;
}) {
  const styles = useStyles();

  return (
    // Horizontal scroll: tag lists grow unpredictably, and wrapping them would
    // push the notes themselves off the screen.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tagScroll}
      style={styles.tagScrollOuter}
    >
      {tags.map((tag) => {
        const selected = tag === active;
        return (
          <Pressable
            key={tag}
            // Tapping the active tag clears it, so no separate "all" chip.
            onPress={() => onChange(selected ? null : tag)}
            style={({ pressed }) => [
              styles.tagChip,
              selected && styles.tagChipActive,
              pressed && styles.tagChipPressed,
            ]}
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
  tabsWrapUnused: {
    paddingHorizontal: spacing.xl,
    paddingTop: 96, // clears the transparent nav header
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1,
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
    marginTop: spacing.lg,
  },
  tagScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  tagChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tagChipActive: {
    backgroundColor: colors.accentAmber + '26',
    borderColor: colors.accentAmber + '59',
  },
  tagChipPressed: {
    opacity: 0.7,
  },
  tagChipText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },
  tagChipTextActive: {
    color: colors.accentAmber,
  },

  summary: {
    ...typography.overline,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
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
    ...typography.caption,
    color: colors.primary,
    padding: spacing.sm,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  quickFab: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  fabPressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.9,
  },

  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xxl + 70,
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
