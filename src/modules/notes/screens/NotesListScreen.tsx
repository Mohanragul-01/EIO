/**
 * NotesListScreen - list, search and tag-filter.
 *
 * Same three-part screen pattern as the Tasks list:
 *   1. call the module hook
 *   2. render one of loading / empty / list
 *   3. reload on focus
 *
 * The addition here is distinguishing "you have no notes" from "no notes match
 * your search". Showing "Nothing here yet" to someone who just mistyped a
 * search term is a small but genuinely confusing bug.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback } from 'react';
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

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { fonts, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { NoteCard } from '../components/NoteCard';
import { useNotes } from '../useNotes';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'NotesList'>;

export function NotesListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
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
  } = useNotes();

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // No notes at all - a genuinely empty module.
  const isEmpty = totalCount === 0;
  // Notes exist, but the current search/tag matches none of them.
  const isFilteredEmpty = !isEmpty && notes.length === 0;

  return (
    <Screen padded={false}>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, isEmpty && styles.listEmpty]}
        // Dismisses the keyboard as soon as you start scrolling the results -
        // otherwise it covers half the list you're trying to read.
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
              <SearchBar value={query} onChange={setQuery} />
              {allTags.length > 0 ? (
                <TagFilter tags={allTags} active={activeTag} onChange={setActiveTag} />
              ) : null}
              {isFilteredEmpty ? null : (
                <Text style={styles.summary}>
                  {notes.length} {notes.length === 1 ? 'note' : 'notes'}
                  {activeTag ? ` tagged "${activeTag}"` : ''}
                </Text>
              )}
            </FadeInView>
          )
        }
        ListEmptyComponent={
          isEmpty ? (
            <EmptyState
              icon="document-text-outline"
              accent={colors.accentAmber}
              title="No notes yet"
              message="Anything you want to keep - ideas, lists, things people told you."
              action={
                <Button
                  label="Write a note"
                  icon="add"
                  onPress={() => navigation.navigate('NoteEdit', {})}
                />
              }
            />
          ) : (
            // The "no matches" case: different words, and a way back out.
            <View style={styles.noMatches}>
              <Ionicons name="search-outline" size={22} color={colors.textFaint} />
              <Text style={styles.noMatchesText}>
                No notes match {activeTag ? `"${activeTag}"` : `"${query.trim()}"`}
              </Text>
              <Pressable
                onPress={() => {
                  setQuery('');
                  setActiveTag(null);
                }}
                hitSlop={8}
              >
                <Text style={styles.clearFilters}>Clear filters</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <NoteCard note={item} onPress={() => navigation.navigate('NoteEdit', { id: item.id })} />
          </FadeInView>
        )}
      />

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

      {!isEmpty ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('NoteEdit', {})}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Write a note"
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
        // Shows an X inside the field on iOS; Android gets the button below.
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
    // Horizontal ScrollView: tag lists grow unpredictably and wrapping them
    // would push the actual notes off-screen.
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
            // Tapping the active tag clears it - no separate "all" chip needed.
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1,
    paddingTop: 80,
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
    // keeps its gutter - so the row reads as scrollable rather than clipped.
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
