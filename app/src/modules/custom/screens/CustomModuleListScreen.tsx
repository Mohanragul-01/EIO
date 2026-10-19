/**
 * CustomModuleListScreen - the entries of ONE user-created module.
 *
 * Compare this to TodoListScreen or FitnessListScreen: same structure, but
 * nothing about it is specific to any domain. It renders whatever the field
 * definitions describe, which is why one file serves every module you'll ever
 * create. Every decision it shows - the chart's points, the chips, the
 * groups and their totals, the row roles, whether `+` logs at once - is made
 * by a tested pure file; this screen only lays them out.
 *
 * THE `+`. When every required field can fill itself in (defaults.ts), a tap
 * logs a whole entry and offers Undo; a long-press, or the TalkBack action,
 * opens the full form. When it cannot, a tap opens the form pre-filled. In the
 * calendar, both use the day you are looking at.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native';

import {
  Button,
  EmptyState,
  FadeInView,
  GlassCard,
  MonthCalendar,
  Screen,
  useToast,
  type CalendarDay,
} from '../../../core/components';
import { fromISODate, todayISO } from '../../../core/date';
import { success, tap, warning } from '../../../core/haptics';
import { layout, motion, radius, spacing } from '../../../core/theme';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import type { RootStackParamList } from '../../../navigation/types';
import { CustomRecordRow } from '../components/CustomRecordRow';
import { FilterChips } from '../components/FilterChips';
import { TrendCard } from '../components/TrendCard';
import { canQuickLog, resolveDefaults } from '../defaults';
import { dateFieldOf, entryDateOf } from '../entryDate';
import {
  filterChipsFor,
  filterRecords,
  groupRecords,
  groupStatLine,
  NO_FILTERS,
  type ActiveFilters,
} from '../filters';
import { formatFieldValue, isEmptyValue, readableAs } from '../format';
import { rowRoles } from '../roles';
import { chartFieldOf } from '../trend';
import { isGroupableType, type CustomField, type CustomRecord } from '../types';
import { useCustomRecords } from '../useCustomRecords';

type Nav = NativeStackNavigationProp<RootStackParamList, 'CustomModuleList'>;
type Route = RouteProp<RootStackParamList, 'CustomModuleList'>;

type View_ = 'list' | 'calendar';

type Section = {
  key: string;
  /** Null for an ungrouped list: no header at all. */
  title: string | null;
  stat: string;
  data: CustomRecord[];
};

export function CustomModuleListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const toast = useToast();
  const { moduleId } = route.params;

  const { module, fields, records, loading, refreshing, error, refresh, reload, add, remove, setValue } =
    useCustomRecords(moduleId);

  const [view, setView] = useState<View_>('list');
  const [filters, setFilters] = useState<ActiveFilters>(NO_FILTERS);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [logging, setLogging] = useState(false);

  useFocusEffect(
    // reload keeps one identity for the life of the screen and always calls
    // the latest loader, so this can depend on it without refetching in a loop.
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const today = todayISO();
  const accent = module?.color ?? colors.primary;
  const dateField = useMemo(() => dateFieldOf(fields), [fields]);
  const roles = useMemo(() => (module ? rowRoles(module, fields) : null), [module, fields]);
  const chips = useMemo(() => filterChipsFor(fields, dateField), [fields, dateField]);
  const visible = useMemo(
    () => filterRecords(records, filters, dateField, today),
    [records, filters, dateField, today],
  );
  const resolved = useMemo(() => resolveDefaults(fields, records, today), [fields, records, today]);
  const quick = canQuickLog(fields, resolved);

  const chartField = module ? chartFieldOf(module, fields) : null;
  // No empty chart: a number-like field with no value anywhere draws nothing.
  const showChart =
    !!chartField &&
    records.some((r) => {
      const value = r.data[chartField.key];
      return !isEmptyValue(value) && readableAs(chartField.type, value);
    });

  const groupField =
    fields.find((f) => f.key === module?.group_field_key && isGroupableType(f.type)) ?? null;
  const summaryField = fields.find((f) => f.key === module?.summary_field_key) ?? null;

  /** Entries per day, for the calendar's dots and its TalkBack labels. */
  const byDay = useMemo(() => {
    const map = new Map<string, CustomRecord[]>();
    records.forEach((record) => {
      const day = entryDateOf(record, dateField);
      const list = map.get(day);
      if (list) list.push(record);
      else map.set(day, [record]);
    });
    return map;
  }, [records, dateField]);

  const sections = useMemo<Section[]>(() => {
    if (view === 'calendar') {
      return [{ key: 'day', title: null, stat: '', data: byDay.get(selectedDay) ?? [] }];
    }
    if (groupField && module) {
      return groupRecords(visible, groupField).map((group) => ({
        key: group.key,
        title: group.label,
        stat: groupStatLine(module, summaryField, group.records),
        // A collapsed group keeps its header, so it can be opened again.
        data: collapsed.includes(group.key) ? [] : group.records,
      }));
    }
    return [{ key: 'all', title: null, stat: '', data: visible }];
  }, [view, byDay, selectedDay, groupField, module, visible, summaryField, collapsed]);

  const openForm = useCallback(() => {
    navigation.navigate('CustomRecordEdit', {
      moduleId,
      // In the calendar, a new entry belongs to the day you are looking at.
      date: view === 'calendar' && dateField ? selectedDay : undefined,
    });
  }, [navigation, moduleId, view, dateField, selectedDay]);

  /** What the toast names: the new entry's title, or its badge value. */
  const describe = (data: Record<string, unknown>) => {
    const named = [roles?.title, roles?.badge]
      .map((field) => (field ? formatFieldValue(field, data[field.key]) : null))
      .find((text) => text);
    return named ? `Logged · ${named}` : 'Logged';
  };

  const quickLog = async () => {
    if (!quick) {
      openForm();
      return;
    }
    if (logging) return; // a second tap while the first is saving is not a second entry
    setLogging(true);
    const values =
      view === 'calendar' && dateField
        ? { ...resolved.values, [dateField.key]: selectedDay }
        : resolved.values;
    try {
      const created = await add(values);
      success();
      toast.show({
        message: describe(values),
        actionLabel: 'Undo',
        onAction: () => void remove(created),
      });
    } catch (e) {
      warning();
      toast.show({ message: e instanceof Error ? `Not logged: ${e.message}` : 'Not logged. Try again.' });
    } finally {
      setLogging(false);
    }
  };

  const toggle = (record: CustomRecord, field: CustomField) => {
    tap();
    const next = record.data[field.key] !== true;
    const updated = { ...record, data: { ...record.data, [field.key]: next } };
    void setValue(record, field.key, next);
    // Only when the tick moves the row out from under the filter, so it
    // vanishes: otherwise the tick is its own undo, and five habit ticks
    // should not raise five toasts.
    if (filterRecords([updated], filters, dateField, today).length === 0) {
      toast.show({
        message: `${field.label}: ${next ? 'yes' : 'no'} · hidden by the filter`,
        actionLabel: 'Undo',
        onAction: () => void setValue(updated, field.key, !next),
      });
    }
  };

  /**
   * The header title comes from the data, so it can't be set in the navigator
   * - it isn't known until the module loads. On the right: the list/calendar
   * switch (only with a date field) and the builder.
   */
  useLayoutEffect(() => {
    navigation.setOptions({
      title: module?.name ?? '',
      headerRight: () => (
        <View style={styles.headerButtons}>
          {dateField ? (
            <Pressable
              onPress={() => setView((v) => (v === 'list' ? 'calendar' : 'list'))}
              hitSlop={4}
              style={styles.headerButton}
              accessibilityRole="button"
              accessibilityLabel={view === 'list' ? 'Show the calendar' : 'Show the list'}
            >
              <Ionicons
                name={view === 'list' ? 'calendar-outline' : 'list-outline'}
                size={21}
                color={colors.text}
              />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('ModuleBuilder', { moduleId })}
            hitSlop={4}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Edit this module"
          >
            <Ionicons name="options-outline" size={21} color={colors.text} />
          </Pressable>
        </View>
      ),
    });
    // colors.text belongs here: without it the header icons keep whichever
    // theme was active when the screen mounted, so switching to dark mode
    // leaves a near-black icon on a near-black header.
  }, [navigation, module?.name, moduleId, colors.text, dateField, view, styles]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  // A module with no fields can't render a form - send the user to fix it
  // rather than showing an add button that opens an empty screen.
  if (fields.length === 0 || !module || !roles) {
    return (
      <Screen>
        <EmptyState
          icon="construct-outline"
          accent={accent}
          title={error ? 'Could not load this module' : 'No fields yet'}
          message={
            error ?? "This module has nothing to record. Add a field or two and it'll start working."
          }
          action={
            error ? (
              <Button label="Try again" icon="refresh" onPress={reload} />
            ) : (
              <Button
                label="Set up fields"
                icon="options-outline"
                onPress={() => navigation.navigate('ModuleBuilder', { moduleId })}
              />
            )
          }
        />
      </Screen>
    );
  }

  const hasRecords = records.length > 0;
  const filtered = filters.value !== null || filters.period !== null;
  const dayCount = byDay.get(selectedDay)?.length ?? 0;
  const dayName = fromISODate(selectedDay).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const countLine =
    view === 'calendar'
      ? `${dayName} · ${dayCount === 0 ? 'nothing logged' : `${dayCount} ${dayCount === 1 ? 'entry' : 'entries'}`}`
      : filtered
        ? `${visible.length} of ${records.length}`
        : `${records.length} ${records.length === 1 ? 'entry' : 'entries'}`;

  const header = (
    <FadeInView>
      {view === 'list' && showChart && chartField ? (
        <TrendCard module={module} field={chartField} fields={fields} records={records} accent={accent} />
      ) : null}

      {view === 'calendar' ? (
        <GlassCard style={styles.calendarCard}>
          <MonthCalendar
            year={month.year}
            month={month.month}
            onChangeMonth={(year, m) => setMonth({ year, month: m })}
            selected={selectedDay}
            onSelect={setSelectedDay}
            renderDay={(day) => (
              <CalendarCell day={day} count={byDay.get(day.iso)?.length ?? 0} accent={accent} />
            )}
            dayLabel={(day) => {
              const n = byDay.get(day.iso)?.length ?? 0;
              return n === 0 ? null : `${n} ${n === 1 ? 'entry' : 'entries'}`;
            }}
          />
        </GlassCard>
      ) : chips.length > 0 && hasRecords ? (
        <FilterChips chips={chips} active={filters} accent={accent} onChange={setFilters} />
      ) : null}

      {hasRecords || view === 'calendar' ? (
        <Text style={styles.summary}>
          {countLine}
          {quick ? ' · tap + to log, hold for the form' : ''}
        </Text>
      ) : null}
    </FadeInView>
  );

  const empty =
    view === 'calendar' ? null : hasRecords ? (
      <EmptyState
        icon="funnel-outline"
        accent={accent}
        title="Nothing matches"
        message="No entry fits these filters."
        action={<Button label="Show all" variant="glass" onPress={() => setFilters(NO_FILTERS)} />}
      />
    ) : (
      <EmptyState
        icon={(module.icon as never) ?? 'cube-outline'}
        accent={accent}
        title="Nothing here yet"
        message={
          quick
            ? `Tap below to log your first entry with your defaults.`
            : `Add your first entry to ${module.name}.`
        }
        action={<Button label={quick ? 'Log an entry' : 'Add entry'} icon="add" onPress={quickLog} />}
      />
    );

  return (
    <Screen padded={false}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, !hasRecords && view === 'list' && styles.listEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={sections.every((s) => s.title === null) ? empty : null}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <GroupHeader
              title={section.title}
              stat={section.stat}
              open={!collapsed.includes(section.key)}
              onPress={() =>
                setCollapsed((current) =>
                  current.includes(section.key)
                    ? current.filter((key) => key !== section.key)
                    : [...current, section.key],
                )
              }
            />
          ) : null
        }
        renderItem={({ item, index }) => (
          <FadeInView delay={Math.min(index, 6) * motion.stagger}>
            <CustomRecordRow
              record={item}
              roles={roles}
              accent={accent}
              onToggle={toggle}
              onPress={() =>
                navigation.navigate('CustomRecordEdit', { moduleId, recordId: item.id })
              }
            />
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

      {hasRecords || view === 'calendar' ? (
        <FadeInView style={styles.fabWrap} delay={120}>
          <Pressable
            onPress={quickLog}
            onLongPress={openForm}
            delayLongPress={350}
            disabled={logging}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: accent },
              (pressed || logging) && styles.fabPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={quick ? 'Log an entry with your defaults' : 'Add entry'}
            accessibilityHint={quick ? 'Long-press, or use actions, for the full form' : undefined}
            accessibilityActions={quick ? [{ name: 'longpress', label: 'Open the full form' }] : undefined}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'longpress') openForm();
            }}
          >
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        </FadeInView>
      ) : null}
    </Screen>
  );
}

/** A group's header: its name, then its count and statistic. Tap to fold. */
function GroupHeader({
  title,
  stat,
  open,
  onPress,
}: {
  title: string;
  stat: string;
  open: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.groupHeader, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${stat.replace(' · ', ' entries, ')}`}
      accessibilityState={{ expanded: open }}
    >
      <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={15} color={colors.textMuted} />
      <Text style={styles.groupTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.groupStat} numberOfLines={1}>
        {stat}
      </Text>
    </Pressable>
  );
}

/**
 * One calendar day: its number, and a dot when it has entries. The dot's
 * strength grows with the count, and the count is also in the day's TalkBack
 * label, so it never rests on shading alone.
 */
function CalendarCell({ day, count, accent }: { day: CalendarDay; count: number; accent: string }) {
  const styles = useStyles();
  return (
    <View
      style={[
        styles.day,
        day.isToday && styles.dayToday,
        day.isSelected && [styles.daySelected, { borderColor: accent }],
      ]}
    >
      <Text style={[styles.dayNumber, !day.inMonth && styles.dayOutside]}>
        {Number(day.iso.slice(8))}
      </Text>
      <View
        style={[
          styles.dayDot,
          count > 0 && { backgroundColor: accent, opacity: count === 1 ? 0.55 : count === 2 ? 0.8 : 1 },
        ]}
      />
    </View>
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
    paddingTop: 104,
    paddingBottom: layout.aboveFab + spacing.xxl,
  },
  listEmpty: {
    flexGrow: 1,
  },
  summary: {
    ...typography.overline,
    ...typography.numeric,
    marginBottom: spacing.lg,
  },
  pressed: {
    opacity: 0.7,
  },

  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  calendarCard: {
    marginBottom: spacing.lg,
  },
  day: {
    width: 38,
    height: 42,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 3,
  },
  dayToday: {
    borderColor: colors.glassBorderStrong,
  },
  daySelected: {
    backgroundColor: colors.glassStrong,
  },
  dayNumber: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 13,
    color: colors.text,
  },
  dayOutside: {
    color: colors.textFaint,
  },
  dayDot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },

  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  groupTitle: {
    ...typography.title,
    fontSize: 14,
    flex: 1,
  },
  groupStat: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.textSecondary,
  },

  fabWrap: {
    position: 'absolute',
    right: spacing.xl,
    bottom: layout.fabInset,
  },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
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
    bottom: layout.aboveFab,
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
