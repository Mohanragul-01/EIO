/**
 * ExercisePicker - a sheet that lists every exercise you own.
 *
 * This replaces an `Alert.alert` whose buttons were the exercise names. That
 * looked fine with three exercises and broke silently with more: Android's
 * alert has exactly three button slots (positive, negative, neutral), so a
 * fourth exercise does not get its own button, it OVERWRITES an earlier one.
 * The list appeared to lose entries, and tapping a name could run a different
 * exercise's handler - which is why adding a second exercise looked like it was
 * replacing the first. Slicing to eight did not help; the cap is three.
 *
 * So: a real scrollable list. It also gets a search box and muscle-group
 * headers, which an alert could never have had, and it can stay open while you
 * pick several - the common case when you are building a routine.
 *
 * A Modal rather than a pushed screen, because choosing an exercise mid-session
 * must not navigate away from the sets you are part-way through logging.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { groupExercises } from '../exerciseSearch';
import type { Exercise } from '../types';

/** Below this many exercises a search box is clutter, not help. */
const SEARCH_THRESHOLD = 8;

type ExercisePickerProps = {
  visible: boolean;
  title: string;
  exercises: Exercise[];
  /**
   * Exercises already used, shown greyed out and unselectable. Passed in rather
   * than filtered out by the caller so you can SEE that a lift is already in
   * the routine instead of wondering why it is missing from the list.
   */
  disabledIds?: string[];
  /** True when the sheet should stay open so several can be picked at once. */
  multiple?: boolean;
  onSelect: (exerciseIds: string[]) => void;
  onClose: () => void;
};

export function ExercisePicker({
  visible,
  title,
  exercises,
  disabledIds = [],
  multiple = false,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  // Reopening must not inherit the last visit's search and ticks. Keyed on
  // `visible` rather than cleared in the handlers, so it holds however the
  // sheet was closed - button, backdrop, or Android back.
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setPicked([]);
    }
  }, [visible]);

  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);

  const sections = useMemo(() => groupExercises(exercises, query), [exercises, query]);

  const selectable = exercises.length - disabled.size;

  const handleRowPress = (exercise: Exercise) => {
    if (multiple) {
      setPicked((current) =>
        current.includes(exercise.id)
          ? current.filter((id) => id !== exercise.id)
          : [...current, exercise.id],
      );
      return;
    }
    // Single mode commits on tap. Nothing to confirm, so a footer button would
    // just be a second tap for the same decision.
    onSelect([exercise.id]);
    onClose();
  };

  const handleConfirm = () => {
    if (picked.length === 0) return;
    onSelect(picked);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // Without this the Android back button closes the whole screen behind
      // the sheet instead of the sheet.
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/*
          A sibling rather than a wrapper: making the backdrop a Pressable that
          CONTAINS the sheet means every tap inside the sheet bubbles up to it
          and dismisses while you are typing.
        */}
        <Pressable
          style={styles.backdropTouch}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
          pointerEvents="box-none"
        >
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={12}
                style={({ pressed }) => [styles.close, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {exercises.length >= SEARCH_THRESHOLD ? (
              <View style={styles.searchRow}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search exercises"
                  placeholderTextColor={colors.textFaint}
                  style={styles.searchInput}
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {sections.length === 0 ? (
                <Text style={styles.empty}>
                  {query
                    ? `Nothing matches "${query.trim()}".`
                    : 'No exercises yet. Add some in the Plan tab.'}
                </Text>
              ) : (
                sections.map((section) => (
                  <View key={section.group}>
                    <Text style={styles.groupLabel}>{section.group}</Text>
                    {section.items.map((exercise) => {
                      const isDisabled = disabled.has(exercise.id);
                      const isPicked = picked.includes(exercise.id);

                      return (
                        <Pressable
                          key={exercise.id}
                          onPress={() => handleRowPress(exercise)}
                          disabled={isDisabled}
                          style={({ pressed }) => [
                            styles.row,
                            isPicked && styles.rowPicked,
                            pressed && !isDisabled && styles.pressed,
                          ]}
                          accessibilityRole={multiple ? 'checkbox' : 'button'}
                          accessibilityState={{ checked: isPicked, disabled: isDisabled }}
                        >
                          <View style={styles.rowText}>
                            <Text
                              style={[styles.rowName, isDisabled && styles.rowNameDisabled]}
                              numberOfLines={1}
                            >
                              {exercise.name}
                            </Text>
                            {isDisabled ? (
                              <Text style={styles.rowNote}>Already added</Text>
                            ) : null}
                          </View>

                          {isDisabled ? (
                            <Ionicons name="checkmark-done" size={18} color={colors.textFaint} />
                          ) : multiple ? (
                            <Ionicons
                              name={isPicked ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={isPicked ? colors.primary : colors.textMuted}
                            />
                          ) : (
                            <Ionicons name="add" size={20} color={colors.primary} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                ))
              )}
            </ScrollView>

            {multiple ? (
              <Button
                label={picked.length === 0 ? 'Select exercises' : `Add ${picked.length}`}
                icon="add"
                onPress={handleConfirm}
                disabled={picked.length === 0 || selectable === 0}
                style={styles.confirm}
              />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors, typography, elevation }) => ({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetWrap: {
    justifyContent: 'flex-end',
  },
  sheet: {
    // A solid surface, not GlassCard: a BlurView in a Modal has nothing behind
    // it to blur on Android, so it renders as a flat grey panel.
    backgroundColor: colors.backgroundElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.glassBorderStrong,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    // Capped so the sheet never becomes the whole screen: seeing a slice of
    // what is behind it is what makes it read as a layer you can dismiss.
    maxHeight: '80%',
    ...elevation.floating,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glassBorderStrong,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
  },
  close: {
    padding: 4,
  },
  pressed: {
    opacity: 0.6,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    padding: 0,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.sm,
  },
  groupLabel: {
    ...typography.overline,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: 6,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  rowPicked: {
    borderColor: colors.primary,
    backgroundColor: colors.glassStrong,
  },
  rowText: {
    flex: 1,
  },
  rowName: {
    ...typography.body,
  },
  rowNameDisabled: {
    color: colors.textFaint,
  },
  rowNote: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: 2,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  confirm: {
    marginTop: spacing.md,
  },
}));
