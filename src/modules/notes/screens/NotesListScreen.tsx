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

import { Button, EmptyState, FadeInView, GlassCard, Screen, Tabs } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { formatEventDate } from '../../../core/date';
import { fonts, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { NoteCard } from '../components/NoteCard';
import type { Note } from '../types';
import { useNotes, type NotesView } from '../useNotes';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotesList'>;

const VIEWS: NotesView[] = ['notes', 'inbox', 'journal'];
const VIEW_LABEL: Record<NotesView, string> = {
  notes: 'Notes',
  inbox: 'Inbox',
  journal: 'Journal',
};

export function NotesListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [view, setView] = useState<NotesView>('notes');
  const {
    notes,
    totalCount,
    allTags,
    query,
    setQuery,
    activeTag,
    setActiveTag,
    loading,
    refreshing,
    error,
    refresh,
    reload,
  } = useNotes(view);

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

  return (
    <Screen padded={false}>
      <View style={styles.tabsWrap}>
        <Tabs
          options={VIEWS}
          value={view}
          onChange={(next) => {
            setView(next);
            // Filters belong to the view you set them in. Carrying a tag filter
            // into the Journal would silently hide entries.
            setQuery('');
            setActiveTag(null);
          }}
          renderLabel={(v) => VIEW_LABEL[v]}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : view === 'journal' ? (
        <FlatList
          data={journalSections}
          keyExtractor={(section) => section.date}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.backgroundElevated}
            />
          }
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
                  onPress={() => navigation.navigate('NoteEdit', { type: 'journal' })}
                />
              }
            />
          }
          renderItem={({ item: section, index }) => (
            <FadeInView delay={Math.min(index, 6) * motion.stagger}>
              <Text style={styles.dayHeading}>{formatEventDate(section.date)}</Text>
              {section.entries.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onPress={() => navigation.navigate('NoteEdit', { id: note.id })}
                />
              ))}
            </FadeInView>
          )}
        />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.backgroundElevated}
            />
          }
          ListHeaderComponent={
            isEmpty ? null : (
              <FadeInView>
                {/* The inbox is a short queue you work through, so it gets no
                    search: filtering a handful of unfiled notes is busywork. */}
                {view === 'notes' ? (
                  <>
                    <SearchBar value={query} onChange={setQuery} />
                    {allTags.length > 0 ? (
                      <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.inboxHint}>
                    Captured in a hurry. Add a title or a tag and it files itself out of here.
                  </Text>
                )}

                {isFilteredEmpty ? null : (
                  <Text style={styles.summary}>
                    {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                    {activeTag ? ` tagged ${activeTag}` : ''}
                  </Text>
                )}
              </FadeInView>
            )
          }
          ListEmptyComponent={
            isEmpty ? (
              <EmptyState
                icon={view === 'inbox' ? 'file-tray-outline' : 'document-text-outline'}
                accent={colors.accentAmber}
                title={view === 'inbox' ? 'Inbox is clear' : 'Nothing written yet'}
                message={
                  view === 'inbox'
                    ? 'Anything you capture without a title or tag waits here until you file it.'
                    : 'Notes, checklists and anything you want to keep.'
                }
                action={
                  view === 'inbox' ? undefined : (
                    <Button
                      label="Write a note"
                      icon="add"
                      onPress={() => navigation.navigate('NoteEdit', {})}
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
                  <Pressable
                    onPress={() => {
                      setQuery('');
                      setActiveTag(null);
                    }}
                    hitSlop={8}
                  >
                    <Text style={styles.clearFilters}>Clear filters</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <FadeInView delay={Math.min(index, 6) * motion.stagger}>
              <NoteCard note={item} onPress={() => navigation.navigate('NoteEdit', { id: item.id })} />
            </FadeInView>
          )}
        />
      )}

      {error ? (
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
      ) : null}

      {/* Two buttons, because they are two intentions. The small one captures a
          thought immediately; the large one opens the full form. */}
      {!isEmpty ? (
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
              navigation.navigate('NoteEdit', view === 'journal' ? { type: 'journal' } : {})
            }
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel={view === 'journal' ? 'Write an entry' : 'Write a note'}
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
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
        <Pressable onPress={() => onChange('')} hitSlop={10}>
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
  tabsWrap: {
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
