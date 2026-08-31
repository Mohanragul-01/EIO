/**
 * TodoEditScreen - one screen that both CREATES and EDITS a task.
 *
 *  WHY ONE SCREEN INSTEAD OF TWO
 * "Add" and "Edit" differ in exactly three ways: the title, whether we
 * pre-load a row, and whether saving inserts or updates. Everything else - the
 * fields, layout, validation - is identical. Two screens would mean keeping
 * two copies of that in sync forever. So the route param decides:
 *     navigate('TodoEdit', {})            -> create
 *     navigate('TodoEdit', { id: '...' })   -> edit
 *
 *  THE FORM PATTERN (copied by every later module)
 *   1. one useState per field ("controlled inputs")
 *   2. validate on submit, show inline errors
 *   3. disable the button while saving so it can't double-submit
 *   4. navigate back on success - the list refetches on focus
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  GlassCard,
  Screen,
  SegmentedControl,
  TextField,
} from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import {
  FREQUENCIES,
  FREQUENCY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  priorityColor,
  type Frequency,
  type Priority,
} from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'TodoEdit'>;
type Route = RouteProp<RootStackParamList, 'TodoEdit'>;

export function TodoEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  //  Form state: one piece of state per field
  // These are "controlled inputs" - React holds the value and the input just
  // displays it. It's more wiring than an uncontrolled input, but it's the
  // only way to validate, prefill, or reset a field programmatically.
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('normal');
  // Pre-selected from the tab you added from; 'daily' only when opened without
  // one, which does not happen from the list screen.
  const [frequency, setFrequency] = useState<Frequency>(route.params?.frequency ?? 'daily');
  const [isRepeat, setIsRepeat] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing); // only editing needs a fetch
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Set the header title based on mode. useLayoutEffect (not useEffect) so it
  // applies before the first paint - otherwise the title visibly changes.
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
        setTitle(todo.title);
        setDueDate(todo.due_date);
        setPriority(todo.priority);
        setFrequency(todo.frequency);
        setIsRepeat(todo.is_repeat);
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

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Give the task a title');
      return;
    }
    setTitleError(null);
    setSaving(true);

    try {
      const input = { title: trimmed, due_date: dueDate, priority, frequency, is_repeat: isRepeat };
      if (isEditing) {
        await api.updateTodo(editingId, input);
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
    // Destructive and irreversible, so it gets a confirmation step.
    Alert.alert('Delete task', 'This cannot be undone.', [
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
    ]);
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

  return (
    <Screen padded={false}>
      {/* Without this the keyboard covers the lower fields and the save button
          on iOS. Android mostly handles it via windowSoftInputMode, hence the
          platform-specific behavior. */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled" // taps work while the keyboard is up
          showsVerticalScrollIndicator={false}
        >
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

              <DateField
                label="Due"
                value={dueDate}
                onChange={setDueDate}
                style={styles.field}
              />

              <SegmentedControl
                label="Frequency"
                options={FREQUENCIES}
                value={frequency}
                onChange={setFrequency}
                renderLabel={(f) => FREQUENCY_LABEL[f]}
                style={styles.field}
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
              >
                <View style={styles.toggleText}>
                  <Text style={styles.toggleTitle}>Repeat</Text>
                  <Text style={styles.toggleCaption}>
                    {isRepeat
                      ? `Completing this creates the next one, one ${
                          frequency === 'daily'
                            ? 'day'
                            : frequency === 'weekly'
                              ? 'week'
                              : frequency === 'monthly'
                                ? 'month'
                                : 'year'
                        } on from its due date`
                      : 'Completing this finishes it for good'}
                  </Text>
                </View>
                <View style={[styles.switch, isRepeat && styles.switchOn]}>
                  <View style={[styles.knob, isRepeat && styles.knobOn]} />
                </View>
              </Pressable>
            </GlassCard>
          </FadeInView>

          <FadeInView delay={80}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104, // clears the transparent nav header
    paddingBottom: spacing.xxxl,
  },
  field: {
    marginTop: spacing.xxl,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
