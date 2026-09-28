/**
 * TodoListScreen - four swipeable frequency tabs, open or completed.
 *
 *  THE SCREEN PATTERN (shared by every module)
 *   1. call the module's hook for data and state
 *   2. render exactly one of: loading / empty / list
 *   3. refetch when the screen regains focus
 * The screen contains no Supabase code at all: it never imports the client.
 *
 * The tab lives in this screen's state rather than in navigation, because it
 * is a filter over one list, not a destination.
 *
 * WHY THE LIST IS ITS OWN COMPONENT NOW. A pager has to have every page
 * mounted - you cannot swipe to something that has not rendered - so each
 * frequency needs its own copy of the list with its own data. Extracting
 * FrequencyList is what makes "one hook per page" possible; keeping it inline
 * would have meant one hook and three blank pages.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Screen,
  SegmentedControl,
  SwipeTabs,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { TaskRow } from '../components/TaskRow';
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency } from '../types';
import { useTodos, type TodoStatus } from '../useTodos';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoList'>;

export function TodoListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [status, setStatus] = useState<TodoStatus>('open');

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <SegmentedControl
          options={['open', 'done'] as const}
          value={status}
          onChange={setStatus}
          renderLabel={(s) => (s === 'open' ? 'Open' : 'Completed')}
        />
      </View>

      <SwipeTabs
        options={FREQUENCIES}
        value={frequency}
        onChange={setFrequency}
        renderLabel={(f) => FREQUENCY_LABEL[f]}
        renderPage={(f) => (
          <FrequencyList
            // Remounts when the status changes, so the list never shows the
            // previous slice's rows while the new query is in flight.
            key={`${f}-${status}`}
            frequency={f}
            status={status}
            onAdd={() => navigation.navigate('TodoEdit', { frequency: f })}
            onOpen={(id) => navigation.navigate('TodoEdit', { id })}
          />
        )}
      />

      {status === 'open' ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={() => navigation.navigate('TodoEdit', { frequency })}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
            accessibilityRole="button"
            accessibilityLabel="Add a task"
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

/* ONE FREQUENCY ------------------------------------------------------------ */

function FrequencyList({
  frequency,
  status,
  onAdd,
  onOpen,
}: {
  frequency: Frequency;
  status: TodoStatus;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const { todos, loading, refreshing, error, refresh, reload, complete } = useTodos(
    frequency,
    status,
  );

  /**
   * useFocusEffect, not useEffect: this also runs when you pop back from the
   * edit screen, so a task you just added appears immediately. reload keeps one
   * identity for the life of the screen and always calls the latest loader, so
   * depending on it does not refetch in a loop.
   */
  useFocusEffect(
    useCallback(() => {
      reload(); // silent: no pull-to-refresh spinner on every return
    }, [reload]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const label = FREQUENCY_LABEL[frequency].toLowerCase();

  return (
    <>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, todos.length === 0 && styles.listEmpty]}
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
                {todos.length} {status === 'done' ? 'completed' : 'open'}{' '}
                {todos.length === 1 ? 'task' : 'tasks'}
              </Text>
            </FadeInView>
          ) : null
        }
        ListEmptyComponent={
          status === 'done' ? (
            <EmptyState
              icon="checkmark-circle-outline"
              accent={colors.accentEmerald}
              title={`Nothing ${label} completed`}
              message="Tasks you tick off appear here, newest first. Nothing is ever deleted by completing it."
            />
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              accent={colors.accentIndigo}
              title={`Nothing ${label}`}
              message={
                frequency === 'daily'
                  ? 'Daily tasks you add here reset by repeating, not by being wiped.'
                  : `Add a ${label} task and it will show up here.`
              }
              action={<Button label="Add a task" icon="add" onPress={onAdd} />}
            />
          )
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <TaskRow
              todo={item}
              // In the completed list the same tap reopens, which useTodos
              // works out from the row rather than from a second prop.
              onToggle={() => complete(item)}
              onPress={() => onOpen(item.id)}
            />
          </FadeInView>
        )}
      />

      {/* A failed background refresh should not interrupt what you are doing,
          so errors surface as a banner rather than an alert. */}
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
    </>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  header: {
    paddingHorizontal: spacing.xl,
    // Clears the transparent nav header, which the list used to do itself.
    paddingTop: 96,
    paddingBottom: spacing.md,
    alignItems: 'flex-start',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 110, // clears the FAB
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  summary: {
    ...typography.caption,
    marginBottom: spacing.md,
  },
  errorWrap: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
  },
  errorCard: {
    borderColor: colors.danger,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    flex: 1,
  },
  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xxl,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    transform: [{ scale: motion.scalePressed }],
  },
}));
