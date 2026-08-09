/**
 * WorkoutEditScreen - log or edit a session.
 *
 * The design goal is a twenty-second entry. You log a workout right after
 * doing one, tired and holding a phone in one hand - so type and duration are
 * both one tap, and the notes field is there only if you want it.
 *
 * Duration is OPTIONAL here, which is why the field can be left blank and
 * saves as NULL rather than 0. "I lifted but didn't time it" is a real and
 * common case, and storing 0 would corrupt every weekly total.
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
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  DateField,
  FadeInView,
  GlassCard,
  Screen,
  TextField,
} from '../../../core/components';
import { todayISO } from '../../../core/date';
import { fonts, radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { DEFAULT_WORKOUT_TYPE, WORKOUT_TYPES } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type Nav = NativeStackNavigationProp<RootStackParamList, 'WorkoutEdit'>;
type Route = RouteProp<RootStackParamList, 'WorkoutEdit'>;

/** The durations people actually log, so the common case is one tap. */
const QUICK_DURATIONS = [20, 30, 45, 60, 90];

export function WorkoutEditScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.id;
  const isEditing = !!editingId;

  const [type, setType] = useState(DEFAULT_WORKOUT_TYPE);
  const [durationText, setDurationText] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());
  const [notes, setNotes] = useState('');

  const [durationError, setDurationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit workout' : 'Log workout' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const workout = await api.getWorkout(editingId);
        if (!active) return;
        setType(workout.type);
        setDurationText(workout.duration_minutes ? String(workout.duration_minutes) : '');
        setDate(workout.date);
        setNotes(workout.notes);
      } catch (e) {
        if (active) setLoadError(e instanceof Error ? e.message : 'Could not load this workout');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId]);

  const handleSave = async () => {
    // Blank is valid and means "not recorded" -> NULL.
    let durationMinutes: number | null = null;

    if (durationText.trim()) {
      const parsed = Number(durationText.trim());
      if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
        setDurationError('Enter whole minutes, like 45');
        return;
      }
      // The DB column is a 4-byte integer; this also catches a fat-fingered
      // "4500000" before it becomes a database error.
      if (parsed > 1440) {
        setDurationError("That's more than a day - check the number");
        return;
      }
      durationMinutes = parsed;
    }

    setDurationError(null);
    setSaving(true);

    try {
      const input = {
        type,
        duration_minutes: durationMinutes,
        date: date ?? todayISO(),
        notes: notes.trim(),
      };

      if (isEditing) {
        await api.updateWorkout(editingId, input);
      } else {
        await api.createWorkout(input);
      }
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert('Delete workout', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteWorkout(editingId);
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
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/*  Type: a tile grid, not a chip row  */}
          <FadeInView>
            <GlassCard>
              <Text style={styles.label}>Type</Text>
              <View style={styles.typeGrid}>
                {WORKOUT_TYPES.map((option) => {
                  const selected = option.key === type;
                  return (
                    <Pressable
                      key={option.key}
                      onPress={() => setType(option.key)}
                      style={({ pressed }) => [
                        styles.typeTile,
                        selected && {
                          backgroundColor: option.color + '26',
                          borderColor: option.color + '66',
                        },
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <Ionicons
                        name={option.icon}
                        size={20}
                        color={selected ? option.color : colors.textMuted}
                      />
                      <Text
                        style={[styles.typeLabel, selected && { color: option.color }]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </GlassCard>
          </FadeInView>

          {/*  Duration: quick chips + free entry  */}
          <FadeInView delay={60}>
            <GlassCard style={styles.card}>
              <Text style={styles.label}>Duration</Text>

              <View style={styles.durationRow}>
                <TextInput
                  value={durationText}
                  onChangeText={(text) => {
                    setDurationText(text);
                    if (durationError) setDurationError(null);
                  }}
                  placeholder="-"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="number-pad"
                  selectionColor={colors.primary}
                  style={styles.durationInput}
                  maxLength={4}
                />
                <Text style={styles.durationUnit}>minutes</Text>
              </View>

              <View style={styles.quickRow}>
                {QUICK_DURATIONS.map((minutes) => {
                  const selected = durationText === String(minutes);
                  return (
                    <Pressable
                      key={minutes}
                      // Tapping the selected chip clears it - duration is
                      // optional, so removing it has to be possible.
                      onPress={() => {
                        setDurationText(selected ? '' : String(minutes));
                        setDurationError(null);
                      }}
                      style={({ pressed }) => [
                        styles.quickChip,
                        selected && styles.quickChipSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[styles.quickText, selected && styles.quickTextSelected]}
                      >
                        {minutes}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {durationError ? (
                <Text style={styles.errorText}>{durationError}</Text>
              ) : (
                <Text style={styles.hint}>Optional - leave blank if you didn't time it</Text>
              )}
            </GlassCard>
          </FadeInView>

          <FadeInView delay={120}>
            <GlassCard style={styles.card}>
              {/* mode="event": a workout already happened, and the column is
                  NOT NULL, so clearing it isn't offered. */}
              <DateField
                label="When"
                value={date}
                onChange={setDate}
                mode="event"
                allowClear={false}
              />

              <TextField
                label="Notes"
                value={notes}
                onChangeText={setNotes}
                placeholder="Sets, reps, distance, how it felt..."
                multiline
                style={styles.field}
              />
            </GlassCard>
          </FadeInView>

          <FadeInView delay={160}>
            <Button
              label={isEditing ? 'Save changes' : 'Log workout'}
              icon="checkmark"
              onPress={handleSave}
              loading={saving}
              style={styles.save}
            />

            {isEditing ? (
              <Button
                label="Delete workout"
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
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  card: {
    marginTop: spacing.lg,
  },
  label: {
    ...typography.overline,
    marginBottom: spacing.md,
  },

  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeTile: {
    // Roughly four per row, accounting for the gaps.
    width: '23%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  typeLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
  },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  durationInput: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -1,
    color: colors.text,
    padding: 0,
    minWidth: 64,
  },
  durationUnit: {
    ...typography.body,
    color: colors.textMuted,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  quickChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  quickChipSelected: {
    backgroundColor: colors.primary + '26',
    borderColor: colors.primary + '66',
  },
  quickText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  quickTextSelected: {
    color: colors.primary,
  },
  hint: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.md,
  },

  pressed: {
    opacity: 0.7,
  },
  field: {
    marginTop: spacing.xxl,
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
