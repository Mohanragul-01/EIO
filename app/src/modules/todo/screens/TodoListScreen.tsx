/**
 * TodoListScreen - Today, then the four frequency tabs, one swipe apart.
 *
 *  THE SCREEN PATTERN (shared by every module)
 *   1. call the module's hook for data and state
 *   2. render exactly one of: loading / empty / list
 *   3. refetch when the screen regains focus
 * The screen contains no Supabase code at all: it never imports the client.
 *
 * TODAY COMES FIRST. Running your own life is mostly answering "what do I do
 * now?", and four frequency tabs answer a different question - "what kinds of
 * things do I have?". So the pager opens on Today (overdue, due today, done
 * today, across every frequency), and the tabs that file routines by how
 * often they come round are one swipe to the right. The dashboard tile opens
 * this screen, so it opens Today.
 *
 * Each page is its own component with its own hook, because a pager has every
 * page mounted - you cannot swipe to something that has not rendered. So each
 * is told whether it is the one on show (`active`): that page reloads when it
 * is swiped to, when the app comes back to the foreground, and when another
 * page or a reminder changes a task (see useFreshPage).
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  Screen,
  SwipeTabs,
} from '../../../core/components';
import { fromISODate, todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { layout, motion, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import { DigestSheet } from '../components/DigestSheet';
import { QuickAddSheet } from '../components/QuickAddSheet';
import { TaskRow } from '../components/TaskRow';
import { useTaskActions } from '../components/useTaskActions';
// Registers what a reminder's Done / Snooze / tap does. Imported here because
// the navigator registers this screen at launch; see the file's header.
import '../notificationRoutes';
import { dueLabel } from '../today';
import { subscribeToday } from '../todaySignal';
import { FREQUENCIES, FREQUENCY_LABEL, type Frequency, type Todo } from '../types';
import { useToday } from '../useToday';
import { useTodos, type TodoStatus } from '../useTodos';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoList'>;

type Page = 'today' | Frequency;
const PAGES: Page[] = ['today', ...FREQUENCIES];
const pageLabel = (page: Page) => (page === 'today' ? 'Today' : FREQUENCY_LABEL[page]);

export function TodoListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();

  const [page, setPage] = useState<Page>('today');
  const [adding, setAdding] = useState(false);
  const [digestOpen, setDigestOpen] = useState(false);
  // Bumped after a quick add, so the page you are looking at shows the new
  // task without waiting for the next focus.
  const [version, setVersion] = useState(0);

  // A digest tap while this screen is already open switches it to Today.
  useEffect(() => subscribeToday(() => setPage('today')), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => setDigestOpen(true)}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Daily digest settings"
        >
          <Ionicons name="notifications-outline" size={21} color={colors.text} />
        </Pressable>
      ),
    });
  }, [navigation, styles.headerButton, colors.text]);

  const openTask = useCallback(
    (id: string) => navigation.navigate('TodoEdit', { id }),
    [navigation],
  );
  const frequency: Frequency = page === 'today' ? 'daily' : page;

  return (
    <Screen padded={false}>
      <View style={styles.header} />

      <SwipeTabs
        options={PAGES}
        value={page}
        onChange={setPage}
        renderLabel={pageLabel}
        renderPage={(p) =>
          p === 'today' ? (
            <TodayPage
              active={page === 'today'}
              version={version}
              onOpen={openTask}
              onAdd={() => setAdding(true)}
            />
          ) : (
            <FrequencyPage
              frequency={p}
              active={page === p}
              version={version}
              onOpen={openTask}
              onAdd={() => setAdding(true)}
            />
          )
        }
      />

      <FadeInView style={[styles.fabWrap, { bottom: insets.bottom + layout.fabInset }]} delay={120}>
        <Pressable
          onPress={() => setAdding(true)}
          onLongPress={() => navigation.navigate('TodoEdit', { frequency })}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add a task"
          accessibilityHint="Hold to open the full editor"
        >
          <Ionicons name="add" size={26} color={colors.onPrimary} />
        </Pressable>
      </FadeInView>

      <QuickAddSheet
        visible={adding}
        defaultFrequency={frequency}
        defaultDueDate={page === 'today' ? todayISO() : null}
        contextLabel={page === 'today' ? 'Today' : FREQUENCY_LABEL[page]}
        onClose={() => setAdding(false)}
        onAdded={() => setVersion((v) => v + 1)}
        onOpenEditor={() => navigation.navigate('TodoEdit', { frequency })}
      />

      <DigestSheet visible={digestOpen} onClose={() => setDigestOpen(false)} />
    </Screen>
  );
}

/* TODAY --------------------------------------------------------------------- */

type TodayItem =
  | { kind: 'intro'; key: string }
  | { kind: 'overdue-head'; key: string; tasks: Todo[] }
  | { kind: 'today-head'; key: string; count: number }
  | { kind: 'done-head'; key: string; count: number }
  | { kind: 'calm'; key: string }
  | { kind: 'task'; key: string; todo: Todo; dateStyle: 'full' | 'time' };

function TodayPage({
  active,
  version,
  onOpen,
  onAdd,
}: {
  active: boolean;
  version: number;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const data = useToday(active);
  const actions = useTaskActions(data, data.today, onOpen);
  const [showDone, setShowDone] = useState(false);
  const { reload } = data;

  useFocusEffect(
    useCallback(() => {
      reload(); // silent: no pull-to-refresh spinner on every return
    }, [reload]),
  );
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  if (data.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const { overdue, today, completed } = data.sections;
  const doneCount = completed.length;
  const total = doneCount + overdue.length + today.length;

  const items: TodayItem[] = [{ kind: 'intro', key: 'intro' }];
  if (overdue.length > 0) {
    items.push({ kind: 'overdue-head', key: 'overdue-head', tasks: overdue });
    overdue.forEach((todo) => items.push({ kind: 'task', key: todo.id, todo, dateStyle: 'full' }));
  }
  if (today.length > 0) {
    items.push({ kind: 'today-head', key: 'today-head', count: today.length });
    today.forEach((todo) => items.push({ kind: 'task', key: todo.id, todo, dateStyle: 'time' }));
  }
  if (overdue.length === 0 && today.length === 0) items.push({ kind: 'calm', key: 'calm' });
  if (doneCount > 0) {
    items.push({ kind: 'done-head', key: 'done-head', count: doneCount });
    if (showDone) {
      completed.forEach((todo) =>
        items.push({ kind: 'task', key: todo.id, todo, dateStyle: 'time' }),
      );
    }
  }

  const renderItem = ({ item, index }: { item: TodayItem; index: number }) => {
    switch (item.kind) {
      case 'intro':
        return (
          <View style={styles.intro}>
            <Text style={styles.introDate}>
              {fromISODate(data.today).toLocaleDateString(undefined, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </Text>
            {total > 0 ? (
              <Text style={styles.introCount}>
                {doneCount} of {total} done
              </Text>
            ) : null}
            {data.error ? <ErrorCard message={data.error} /> : null}
          </View>
        );

      case 'overdue-head':
        return (
          <View style={styles.sectionHead}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={[styles.sectionTitle, styles.overdueTitle]} accessibilityRole="header">
              Overdue · {item.tasks.length}
            </Text>
            <Pressable
              onPress={() => actions.rescheduleAll(item.tasks)}
              style={styles.sectionAction}
              accessibilityRole="button"
              accessibilityLabel={`Reschedule all ${item.tasks.length} overdue tasks`}
            >
              <Text style={styles.sectionActionText}>Reschedule</Text>
            </Pressable>
          </View>
        );

      case 'today-head':
        return (
          <View style={styles.sectionHead}>
            <Ionicons name="today-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.sectionTitle} accessibilityRole="header">
              Today · {item.count}
            </Text>
          </View>
        );

      case 'calm': {
        const next = data.next;
        return (
          <GlassCard style={styles.calm}>
            <View style={styles.calmRow}>
              <Ionicons name="sunny-outline" size={20} color={colors.accentAmber} />
              <Text style={styles.calmTitle}>
                {doneCount > 0 ? 'Nothing left today' : 'Nothing due today'}
              </Text>
            </View>
            {next?.due_date ? (
              <Pressable
                onPress={() => onOpen(next.id)}
                style={styles.nextRow}
                accessibilityRole="button"
                accessibilityLabel={`Next up: ${next.title}, ${dueLabel(next.due_date, next.due_time, data.today)}`}
              >
                <Text style={styles.nextLabel}>Next up</Text>
                <Text style={styles.nextTitle} numberOfLines={1}>
                  {next.title}
                </Text>
                <Text style={styles.nextDate}>
                  {dueLabel(next.due_date, next.due_time, data.today)}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.calmAction}>
                <Button label="Add a task" icon="add" variant="glass" onPress={onAdd} />
              </View>
            )}
          </GlassCard>
        );
      }

      case 'done-head':
        return (
          <Pressable
            onPress={() => setShowDone((v) => !v)}
            style={styles.sectionHead}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            accessibilityLabel={`Completed today, ${item.count}`}
          >
            <Ionicons name="checkmark-done" size={16} color={colors.success} />
            <Text style={styles.sectionTitle}>Completed today · {item.count}</Text>
            <Ionicons
              name={showDone ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textMuted}
              style={styles.sectionChevron}
            />
          </Pressable>
        );

      case 'task':
        return (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <TaskRow
              todo={item.todo}
              today={data.today}
              streak={data.streakOf(item.todo)}
              dateStyle={item.dateStyle}
              onToggle={() => actions.toggle(item.todo)}
              onPress={() => onOpen(item.todo.id)}
              onLongPress={() => actions.openMenu(item.todo)}
            />
          </FadeInView>
        );
    }
  };

  return (
    <>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      />
      {actions.sheets}
    </>
  );
}

/* ONE FREQUENCY ------------------------------------------------------------- */

function FrequencyPage(props: {
  frequency: Frequency;
  active: boolean;
  version: number;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const [status, setStatus] = useState<TodoStatus>('open');
  // Remounts when the status changes, so the list never shows the previous
  // slice's rows while the new query is in flight.
  return <FrequencyList key={status} {...props} status={status} onStatus={setStatus} />;
}

function FrequencyList({
  frequency,
  active,
  version,
  status,
  onStatus,
  onOpen,
  onAdd,
}: {
  frequency: Frequency;
  active: boolean;
  version: number;
  status: TodoStatus;
  onStatus: (status: TodoStatus) => void;
  onOpen: (id: string) => void;
  onAdd: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const data = useTodos(frequency, status, active);
  const today = todayISO();
  const actions = useTaskActions(data, today, onOpen);
  const { reload } = data;

  /**
   * useFocusEffect, not useEffect: this also runs when you pop back from the
   * edit screen, so a task you just changed appears immediately. reload keeps
   * one identity for the life of the screen, so depending on it does not loop.
   */
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);

  if (data.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const label = FREQUENCY_LABEL[frequency].toLowerCase();
  const { todos } = data;

  return (
    <>
      <FlatList
        data={todos}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, todos.length === 0 && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={data.refreshing}
            onRefresh={data.refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.pageHead}>
              <Text style={styles.summary}>
                {todos.length} {status === 'done' ? 'completed' : 'open'}{' '}
                {todos.length === 1 ? 'task' : 'tasks'}
              </Text>
              <Pressable
                onPress={() => onStatus(status === 'open' ? 'done' : 'open')}
                style={styles.statusToggle}
                accessibilityRole="button"
                accessibilityLabel={
                  status === 'open' ? `Show completed ${label} tasks` : `Show open ${label} tasks`
                }
              >
                <Ionicons
                  name={status === 'open' ? 'checkmark-done-outline' : 'list-outline'}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.statusToggleText}>
                  {status === 'open' ? 'Completed' : 'Open'}
                </Text>
              </Pressable>
            </View>
            {data.error ? <ErrorCard message={data.error} /> : null}
          </View>
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
                  ? 'Daily tasks come back by repeating, not by being wiped.'
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
              today={today}
              streak={data.streakOf(item)}
              onToggle={() => actions.toggle(item)}
              onPress={() => onOpen(item.id)}
              onLongPress={() => actions.openMenu(item)}
            />
          </FadeInView>
        )}
      />
      {actions.sheets}
    </>
  );
}

/** A failed load or write, in the list rather than floating over the add button. */
function ErrorCard({ message }: { message: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <GlassCard style={styles.errorCard}>
      <View style={styles.errorRow} accessibilityRole="alert">
        <Ionicons name="warning-outline" size={17} color={colors.danger} />
        <Text style={styles.errorText} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  header: {
    // Clears the transparent nav header.
    paddingTop: 96,
  },
  headerButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    // Clears the add button and the toast above it.
    paddingBottom: layout.aboveFab + 72,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  intro: {
    marginBottom: spacing.md,
  },
  introDate: {
    ...typography.h2,
  },
  introCount: {
    ...typography.caption,
    ...typography.numeric,
    marginTop: 2,
  },
  sectionHead: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.overline,
    ...typography.numeric,
    flex: 1,
    color: colors.textSecondary,
  },
  overdueTitle: {
    color: colors.danger,
  },
  sectionAction: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    marginRight: -spacing.md,
    justifyContent: 'center',
  },
  sectionActionText: {
    ...typography.title,
    fontSize: 14,
    color: colors.primary,
  },
  sectionChevron: {
    marginRight: 2,
  },
  calm: {
    marginBottom: spacing.md,
  },
  calmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  calmTitle: {
    ...typography.title,
  },
  calmAction: {
    marginTop: spacing.lg,
  },
  nextRow: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorder,
    minHeight: 48,
  },
  nextLabel: {
    ...typography.overline,
  },
  nextTitle: {
    ...typography.title,
    fontSize: 15,
    marginTop: 2,
  },
  nextDate: {
    ...typography.caption,
  },
  pageHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  summary: {
    ...typography.caption,
    ...typography.numeric,
    flex: 1,
  },
  statusToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginRight: -spacing.md,
  },
  statusToggleText: {
    ...typography.title,
    fontSize: 13.5,
    color: colors.primary,
  },
  errorCard: {
    borderColor: colors.danger,
    marginBottom: spacing.md,
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
  },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
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
