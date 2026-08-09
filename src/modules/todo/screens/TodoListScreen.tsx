/**
 * TodoListScreen - the module's home: list of tasks, plus a way to add one.
 *
 *  THE SCREEN PATTERN (copied by every later module)
 *   1. call the module's hook for data + state
 *   2. render exactly one of: loading / error / empty / list
 *   3. refetch when the screen regains focus
 * Notice the screen contains no Supabase code at all - it never imports the
 * client. That's the separation working.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import { Button, EmptyState, FadeInView, GlassCard, Screen } from '../../../core/components';
import { motion, radius, spacing } from '../../../core/theme';
import { TaskRow } from '../components/TaskRow';
import type { RootStackParamList } from '../../../navigation/types';
import { useTodos } from '../useTodos';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoList'>;

export function TodoListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { todos, loading, refreshing, error, refresh, reload, toggleDone } = useTodos();

  /**
   * useFocusEffect runs when the screen comes back into view - including when
   * you pop back from the edit screen after saving. A plain useEffect would
   * only run on first mount, so a newly-added task wouldn't appear until you
   * left the module entirely. This is the standard way to keep a list fresh.
   */
  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload(); // silent: no pull-to-refresh spinner on every return
    }, [reload]),
  );

  // Derived counts for the header. useMemo so we don't recount on every
  // unrelated re-render.
  const { openCount, doneCount } = useMemo(
    () => ({
      openCount: todos.filter((t) => !t.is_done).length,
      doneCount: todos.filter((t) => t.is_done).length,
    }),
    [todos],
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

  return (
    <Screen padded={false}>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, todos.length === 0 && styles.listEmpty]}
        // Pull-to-refresh. Free once the hook exposes `refreshing` + `refresh`.
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
          todos.length > 0 ? (
            <FadeInView>
              <Text style={styles.summary}>
                {openCount === 0
                  ? 'All clear'
                  : `${openCount} open ${openCount === 1 ? 'task' : 'tasks'}`}
                {doneCount > 0 ? `  ·  ${doneCount} done` : ''}
              </Text>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-outline"
            accent={colors.accentIndigo}
            title="Nothing on the list"
            message="Add your first task and it'll sync to Supabase straight away."
            action={
              <Button
                label="Add a task"
                icon="add"
                onPress={() => navigation.navigate('TodoEdit', {})}
              />
            }
          />
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <TaskRow
              todo={item}
              onToggle={() => toggleDone(item)}
              onPress={() => navigation.navigate('TodoEdit', { id: item.id })}
            />
          </FadeInView>
        )}
      />

      {/* Errors surface as a dismissible banner rather than an alert: a failed
          background refresh shouldn't interrupt what you're doing. */}
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

      {/* Floating action button - the primary action, always reachable with a
          thumb regardless of scroll position. */}
      {todos.length > 0 ? <AddButton onPress={() => navigation.navigate('TodoEdit', {})} /> : null}
    </Screen>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <FadeInView style={styles.fabWrap} delay={120}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add a task"
      >
        <Ionicons name="add" size={26} color={colors.onPrimary} />
      </Pressable>
    </FadeInView>
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
    // Top padding clears the transparent nav header; bottom clears the FAB.
    paddingTop: 104,
    paddingBottom: 110,
  },
  listEmpty: {
    flexGrow: 1, // lets the empty state centre itself in the viewport
    paddingTop: 80,
  },
  summary: {
    ...typography.overline,
    marginBottom: spacing.lg,
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
