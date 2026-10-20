/**
 * TodoEditScreen - one screen that both CREATES and EDITS a task.
 *
 *  WHY ONE SCREEN INSTEAD OF TWO
 * "Add" and "Edit" differ in exactly three ways: the title, whether we
 * pre-load a row, and whether saving inserts or updates. Everything else - the
 * fields, layout, validation - is identical. So the route param decides:
 *     navigate('TodoEdit', {})              -> create
 *     navigate('TodoEdit', { id: '...' })   -> edit
 *
 * Most tasks are added in one line from the quick-add sheet; this is where the
 * rest lives: notes and a checklist, a time and a reminder, the full repeat
 * rule with its next three dates, and - for a routine - how it has gone.
 *
 *  THE FORM PATTERN (copied by every later module)
 *   1. one useState per field ("controlled inputs")
 *   2. validate on submit, show inline errors
 *   3. disable the button while saving so it can't double-submit
 *   4. navigate back on success - the list refetches on focus
 * One exception: ticking a checklist item on an existing task saves at once,
 * because ticking steps is what you do while doing the task.
 */
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, Text, View } from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../core/components';
import { formatEventDate, todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { ChecklistEditor } from '../components/ChecklistEditor';
import { Chip } from '../components/Chip';
import { RepeatEditor, type RuleDraft } from '../components/RepeatEditor';
import { SeriesHistory } from '../components/SeriesHistory';
import { ensurePermission, offsetLabel, REMINDER_OFFSETS } from '../notifications';
import { formatTime, localDayOf } from '../today';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  outcomeOf,
  PRIORITIES,
  PRIORITY_LABEL,
  priorityColor,
  type ChecklistItem,
  type Frequency,
  type Priority,
  type Todo,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoEdit'>;
type Route = RouteProp<RootStackParamList, 'TodoEdit'>;

const EMPTY_RULE: RuleDraft = { every: 1, weekdays: null, anchorDay: null, nth: null, from: 'due' };
const pad = (n: number) => String(n).padStart(2, '0');

export function TodoEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;
  const today = todayISO();

  //  Form state: one piece of state per field
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [dueTime, setDueTime] = useState<string | null>(null);
  const [reminder, setReminder] = useState<number | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  // Pre-selected from the tab you added from.
  const [frequency, setFrequency] = useState<Frequency>(route.params?.frequency ?? 'daily');
  const [isRepeat, setIsRepeat] = useState(false);
  const [rule, setRule] = useState<RuleDraft>(EMPTY_RULE);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loaded, setLoaded] = useState<Todo | null>(null);

  const [pickingTime, setPickingTime] = useState(false);
  const [reminderNote, setReminderNote] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing); // only editing needs a fetch
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checklistError, setChecklistError] = useState<string | null>(null);

  // useLayoutEffect so the title applies before the first paint.
  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit task' : 'New task' });
  }, [navigation, isEditing]);

  // Prefill the form when editing.
  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const todo = await api.getTodo(editingId);
        if (!active) return;
        setLoaded(todo);
        setTitle(todo.title);
        setNotes(todo.notes ?? '');
        setDueDate(todo.due_date);
        setDueTime(todo.due_time ? todo.due_time.slice(0, 5) + ':00' : null);
        setReminder(todo.reminder_offset_min);
        setPriority(todo.priority);
        setFrequency(todo.frequency);
        setIsRepeat(todo.is_repeat);
        setRule({
          every: todo.repeat_every ?? 1,
          weekdays: todo.repeat_weekdays ?? null,
          anchorDay: todo.repeat_anchor_day ?? null,
          nth: todo.repeat_nth ?? null,
          from: todo.repeat_from ?? 'due',
        });
        setChecklist(todo.checklist ?? []);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this task');
      } finally {
        if (active) setLoading(false);
      }
    })();

    // Cleanup flag: if the screen unmounts mid-fetch, don't set state on it.
    return () => {
      active = false;
    };
  }, [editingId]);

  /** A new unit means the old unit's weekdays or day no longer apply. */
  const changeFrequency = (next: Frequency) => {
    setFrequency(next);
    setRule((current) => ({ ...current, weekdays: null, anchorDay: null, nth: null }));
  };

  /**
   * Choosing a reminder is the moment to ask for permission - never at launch.
   * The choice is kept either way (it is saved with the task, and works on a
   * phone that allows it), with a word about why it may stay silent here.
   */
  const chooseReminder = async (minutes: number | null) => {
    setReminder(minutes);
    setReminderNote(null);
    if (minutes === null) return;
    const permission = await ensurePermission();
    if (permission === 'denied') {
      setReminderNote(
        'Notifications are off for EIO, so this will not sound. Turn them on in Android Settings.',
      );
    } else if (permission === 'unsupported') {
      setReminderNote(
        'This build cannot show notifications (Expo Go cannot); the installed app will.',
      );
    }
  };

  /** A tick on an existing task saves at once; edits to the text wait for Save. */
  const toggleChecklist = async (items: ChecklistItem[]) => {
    const before = checklist;
    setChecklist(items);
    setChecklistError(null);
    if (!editingId) return;
    try {
      await api.updateTodo(editingId, { checklist: items });
    } catch (e) {
      setChecklist(before);
      setChecklistError(e instanceof Error ? e.message : 'Could not save that tick');
    }
  };

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Give the task a title');
      return;
    }
    setTitleError(null);
    setSaving(true);

    try {
      const input = {
        title: trimmed,
        notes: notes.trim(),
        due_date: dueDate,
        // A time needs a day, and a reminder needs a time.
        due_time: dueDate ? dueTime : null,
        reminder_offset_min: dueDate && dueTime ? reminder : null,
        priority,
        frequency,
        is_repeat: isRepeat,
        repeat_every: rule.every,
        repeat_weekdays: rule.weekdays,
        repeat_anchor_day: rule.anchorDay,
        repeat_nth: rule.nth,
        repeat_from: rule.from,
        checklist: checklist.filter((item) => item.text.trim()),
      };
      if (editingId) {
        // The row as loaded, so a save that leaves the date and the rule as
        // they were keeps a rescheduled occurrence on its schedule.
        await api.updateTodo(editingId, input, loaded);
      } else {
        await api.createTodo(input);
      }
      // goBack, not navigate: this pops the screen off the stack so the back
      // button doesn't return to a stale form. The list refetches on focus.
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    // Permanent (Tasks has no trash), so it gets a confirmation step.
    Alert.alert(
      'Delete task',
      isRepeat
        ? 'Deletes this task for good. Its earlier completions stay in its history.'
        : 'Deletes this task for good.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTodo(editingId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleReopen = async () => {
    if (!loaded) return;
    try {
      const { reopened } = await api.reopenTask(loaded.id);
      setLoaded(reopened);
    } catch (e) {
      Alert.alert('Could not reopen', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (loadError) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={26} color={colors.danger} />
          <Text style={styles.loadError}>{loadError}</Text>
          <Button label="Go back" variant="glass" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }

  const outcome = loaded ? outcomeOf(loaded) : null;
  // A yearly rule has no day control: when the date is changed here, its day
  // follows the date on save (input.ts), so the rule shown - and its next
  // three dates - follow it too. The loaded day is kept underneath, for a
  // date changed back.
  const dayFollowsDate = frequency === 'yearly' && loaded !== null && dueDate !== loaded.due_date;

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        {loaded?.is_done ? (
          <FadeInView>
            <GlassCard style={styles.closedCard}>
              <View style={styles.closedRow}>
                <Ionicons
                  name={
                    outcome === 'done'
                      ? 'checkmark-circle'
                      : outcome === 'skipped'
                        ? 'play-skip-forward-circle'
                        : 'close-circle'
                  }
                  size={20}
                  color={colors.textSecondary}
                />
                <Text style={styles.closedText}>
                  {outcome === 'done' ? 'Done' : outcome === 'skipped' ? 'Skipped' : "Won't do"}
                  {loaded.completed_at
                    ? ` · ${formatEventDate(localDayOf(loaded.completed_at))}`
                    : ''}
                </Text>
                <Pressable
                  onPress={() => void handleReopen()}
                  style={styles.reopen}
                  accessibilityRole="button"
                  accessibilityLabel="Reopen this task"
                >
                  <Text style={styles.reopenText}>Reopen</Text>
                </Pressable>
              </View>
            </GlassCard>
          </FadeInView>
        ) : null}

        <FadeInView>
          <GlassCard>
            <TextField
              label="Task"
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError) setTitleError(null); // clear the error as they fix it
              }}
              placeholder="What needs doing?"
              error={titleError}
              autoFocus={!isEditing} // keyboard opens immediately when adding
              returnKeyType="done"
              maxLength={200}
            />

            <TextField
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything worth remembering"
              multiline
              maxLength={4000}
              style={styles.field}
            />
          </GlassCard>
        </FadeInView>

        <FadeInView delay={40}>
          <GlassCard style={styles.card}>
            <DateField label="Due" value={dueDate} onChange={setDueDate} />

            {dueDate ? (
              <View style={styles.field}>
                <Text style={styles.overline}>Time</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label={dueTime ? formatTime(dueTime) : 'Add a time'}
                    icon="time-outline"
                    selected={dueTime !== null}
                    onPress={() => setPickingTime(true)}
                    accessibilityLabel={
                      dueTime ? `Time, ${formatTime(dueTime)}. Change it` : 'Add a time'
                    }
                  />
                  {dueTime ? (
                    <Chip
                      label="No time"
                      icon="close"
                      onPress={() => {
                        setDueTime(null);
                        setReminder(null);
                      }}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {dueDate && dueTime ? (
              <View style={styles.field}>
                <Text style={styles.overline}>Reminder</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label="None"
                    selected={reminder === null}
                    onPress={() => void chooseReminder(null)}
                  />
                  {REMINDER_OFFSETS.map((minutes) => (
                    <Chip
                      key={minutes}
                      label={offsetLabel(minutes)}
                      selected={reminder === minutes}
                      onPress={() => void chooseReminder(minutes)}
                    />
                  ))}
                </View>
                {reminderNote ? <Text style={styles.note}>{reminderNote}</Text> : null}
              </View>
            ) : dueDate ? (
              <Text style={styles.hint}>
                Add a time to be reminded. The daily digest covers the rest.
              </Text>
            ) : null}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={80}>
          <GlassCard style={styles.card}>
            <SegmentedControl
              label="Frequency"
              options={FREQUENCIES}
              value={frequency}
              onChange={changeFrequency}
              renderLabel={(f) => FREQUENCY_LABEL[f]}
            />

            <SegmentedControl
              label="Priority"
              options={PRIORITIES}
              value={priority}
              onChange={setPriority}
              renderLabel={(p) => PRIORITY_LABEL[p]}
              accentFor={(p) => priorityColor(p, colors)}
              style={styles.field}
            />

            {/* Repeating is the whole point of the frequency tabs, so it sits
                here rather than behind an "advanced" disclosure. */}
            <Pressable
              onPress={() => setIsRepeat(!isRepeat)}
              style={[styles.toggleRow, styles.field]}
              accessibilityRole="switch"
              accessibilityState={{ checked: isRepeat }}
              accessibilityLabel="Repeat"
            >
              <View style={styles.toggleText}>
                <Text style={styles.toggleTitle}>Repeat</Text>
                <Text style={styles.toggleCaption}>
                  {isRepeat
                    ? 'Completing it brings the next one round'
                    : 'Completing it finishes it for good'}
                </Text>
              </View>
              <View style={[styles.switch, isRepeat && styles.switchOn]}>
                <View style={[styles.knob, isRepeat && styles.knobOn]} />
              </View>
            </Pressable>

            {isRepeat ? (
              <View style={styles.field}>
                <RepeatEditor
                  frequency={frequency}
                  draft={dayFollowsDate ? { ...rule, anchorDay: null } : rule}
                  dueDate={dueDate}
                  today={today}
                  onChange={(next) =>
                    setRule(dayFollowsDate ? { ...next, anchorDay: rule.anchorDay } : next)
                  }
                />
              </View>
            ) : null}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={120}>
          <GlassCard style={styles.card}>
            <Text style={styles.overline}>
              Checklist
              {checklist.length > 0
                ? ` · ${checklist.filter((i) => i.done).length}/${checklist.length}`
                : ''}
            </Text>
            <ChecklistEditor
              items={checklist}
              onChange={setChecklist}
              onToggle={(items) => void toggleChecklist(items)}
            />
            {isRepeat && checklist.length > 0 ? (
              <Text style={styles.hint}>Each new occurrence starts with every step unticked.</Text>
            ) : null}
            {checklistError ? <Text style={styles.error}>{checklistError}</Text> : null}
          </GlassCard>
        </FadeInView>

        {loaded && loaded.is_repeat ? (
          <FadeInView delay={160}>
            <GlassCard style={styles.card}>
              <Text style={[styles.overline, styles.historyTitle]}>History</Text>
              <SeriesHistory todo={loaded} today={today} />
            </GlassCard>
          </FadeInView>
        ) : null}

        <FadeInView delay={160}>
          <Button
            label={isEditing ? 'Save changes' : 'Add task'}
            icon={isEditing ? 'checkmark' : 'add'}
            onPress={handleSave}
            loading={saving}
            style={styles.save}
          />

          {isEditing ? (
            <Button
              label="Delete task"
              icon="trash-outline"
              variant="ghost"
              onPress={handleDelete}
              style={styles.delete}
            />
          ) : null}
        </FadeInView>
      </FormScroll>

      {/* Mounted only while open: on Android this component IS the dialog. */}
      {pickingTime ? (
        <DateTimePicker
          value={
            dueTime
              ? new Date(2000, 0, 1, Number(dueTime.slice(0, 2)), Number(dueTime.slice(3, 5)))
              : new Date(2000, 0, 1, 9, 0)
          }
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_event, date) => {
            setPickingTime(false);
            if (date) setDueTime(`${pad(date.getHours())}:${pad(date.getMinutes())}:00`);
          }}
          onDismiss={() => setPickingTime(false)}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: spacing.xxxl,
  },
  card: {
    marginTop: spacing.lg,
  },
  field: {
    marginTop: spacing.xxl,
  },
  overline: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hint: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: spacing.md,
  },
  note: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.info,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  historyTitle: {
    marginBottom: spacing.md,
  },
  closedCard: {
    marginBottom: spacing.lg,
  },
  closedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  closedText: {
    ...typography.title,
    fontSize: 14,
    flex: 1,
    color: colors.textSecondary,
  },
  reopen: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginRight: -spacing.md,
  },
  reopenText: {
    ...typography.title,
    fontSize: 14,
    color: colors.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
  },
  toggleText: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  toggleTitle: {
    ...typography.title,
    fontSize: 14,
  },
  toggleCaption: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 2,
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: {
    backgroundColor: colors.primary + '4D',
    borderColor: colors.primary + '99',
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  knobOn: {
    backgroundColor: colors.primary,
    // 46px track, 3px padding, 19px knob leaves exactly 19px of travel.
    transform: [{ translateX: 19 }],
  },
  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  loadError: {
    ...typography.body,
    textAlign: 'center',
  },
}));
