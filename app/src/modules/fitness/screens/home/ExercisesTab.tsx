/**
 * ExercisesTab - The Exercises tab: the library, browsed by region.
 *
 * Moved out of FitnessListScreen unchanged when the screen grew past what one
 * file holds comfortably; each tab owns its own data, which is what lets the
 * pager mount them all at once.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  Button,
  FadeInView,
  FormScroll,
  GlassCard,
  SegmentedControl,
} from '../../../../core/components';
import { useTheme } from '../../../../core/ThemeContext';
import {
  MUSCLE_GROUPS,
  MUSCLE_REGIONS,
  TRACKING_LABEL,
  normaliseMuscle,
  regionOf,
  type MuscleRegion,
  type TrackingType,
} from '../../types';
import { usePlan } from '../../useFitness';
import type { RootStackParamList } from '../../../../navigation/types';
import { ErrorBanner, useHomeStyles } from './styles';

type Nav = NativeStackNavigationProp<RootStackParamList, 'FitnessList'>;

export function ExercisesTab() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const {
    exercises,
    loading,
    refreshing,
    error,
    clearError,
    refresh,
    reload,
    addExercise,
    removeExercise,
  } = usePlan();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<string>('Mid chest');
  const [tracking, setTracking] = useState<TrackingType>('reps');
  const [adding, setAdding] = useState(false);

  /** Which region's exercises are showing. 'All' is its own first tab. */
  const [region, setRegion] = useState<MuscleRegion | 'All'>('All');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  /**
   * The library, grouped by muscle within the chosen region.
   *
   * Filtering by REGION rather than by muscle keeps the tab row to seven, while
   * the headings inside still say which specific muscle each exercise trains -
   * so you get the granularity without twenty-two tabs to scroll past.
   */
  const grouped = useMemo(() => {
    const visible =
      region === 'All' ? exercises : exercises.filter((e) => regionOf(e.muscle_group) === region);

    const byMuscle = new Map<string, typeof exercises>();
    visible.forEach((exercise) => {
      // Normalised, so an exercise still carrying a pre-0018 tag groups under
      // the tag it now belongs to rather than under a heading that no longer
      // exists in the vocabulary.
      const key = normaliseMuscle(exercise.muscle_group)?.trim() || 'Unsorted';
      const bucket = byMuscle.get(key);
      if (bucket) bucket.push(exercise);
      else byMuscle.set(key, [exercise]);
    });

    return [...byMuscle.entries()]
      .sort(([a], [b]) => (a === 'Unsorted' ? 1 : b === 'Unsorted' ? -1 : a.localeCompare(b)))
      .map(([title, items]) => ({ title, items }));
  }, [exercises, region]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    exercises.forEach((e) => {
      const r = regionOf(e.muscle_group);
      map.set(r, (map.get(r) ?? 0) + 1);
    });
    return map;
  }, [exercises]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const handleAdd = async () => {
    if (!name.trim()) return;
    const ok = await addExercise(name, muscle, tracking);
    if (ok) {
      setName('');
      setAdding(false);
    }
  };

  return (
    <>
      <FormScroll
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.backgroundElevated}
          />
        }
      >
        {/* The add form sits at the TOP. Buried under the library it meant
            scrolling past everything you already have to add one more. */}
        <FadeInView>
          {adding ? (
            <GlassCard style={styles.addCard}>
              <TextInput
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (error) clearError();
                }}
                placeholder="Exercise name"
                placeholderTextColor={colors.textFaint}
                selectionColor={colors.primary}
                style={styles.addInput}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />

              <Text style={[styles.label, styles.addLabel]}>Measured in</Text>
              <SegmentedControl
                options={['reps', 'time'] as const}
                value={tracking}
                onChange={setTracking}
                renderLabel={(t) => TRACKING_LABEL[t]}
              />
              <Text style={styles.hint}>
                {tracking === 'time'
                  ? 'Sets are logged as seconds held — planks, dead hangs, wall sits.'
                  : 'Sets are logged as weight and reps.'}
              </Text>

              <Text style={[styles.label, styles.addLabel]}>Muscle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupRow}
              >
                {MUSCLE_GROUPS.map((option) => {
                  const selected = option === muscle;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setMuscle(option)}
                      style={({ pressed }) => [
                        styles.groupChip,
                        selected && styles.groupChipActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.groupText, selected && styles.groupTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.addActions}>
                <Pressable onPress={() => setAdding(false)} hitSlop={8}>
                  <Text style={styles.linkMuted}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleAdd} hitSlop={8} disabled={!name.trim()}>
                  <Text style={[styles.link, !name.trim() && styles.linkDisabled]}>Add</Text>
                </Pressable>
              </View>
            </GlassCard>
          ) : (
            <Button
              label="Add an exercise"
              icon="add"
              variant="glass"
              onPress={() => setAdding(true)}
              style={styles.addCard}
            />
          )}
        </FadeInView>

        {/* Region filter. */}
        <FadeInView delay={40}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupRow}
          >
            {(['All', ...MUSCLE_REGIONS] as const).map((option) => {
              const selected = option === region;
              const count = option === 'All' ? exercises.length : (counts.get(option) ?? 0);
              return (
                <Pressable
                  key={option}
                  onPress={() => setRegion(option)}
                  style={({ pressed }) => [
                    styles.groupChip,
                    selected && styles.groupChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.groupText, selected && styles.groupTextActive]}>
                    {option} {count > 0 ? count : ''}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </FadeInView>

        {grouped.length === 0 ? (
          <FadeInView delay={80}>
            <GlassCard style={styles.addCard}>
              <Text style={styles.hint}>
                {region === 'All' ? 'No exercises yet.' : `Nothing tagged under ${region} yet.`}
              </Text>
            </GlassCard>
          </FadeInView>
        ) : (
          grouped.map((section, index) => (
            <FadeInView key={section.title} delay={Math.min(index, 6) * 40}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.items.map((exercise) => (
                <GlassCard
                  key={exercise.id}
                  style={styles.row}
                  onPress={() =>
                    navigation.navigate('ExerciseProgress', {
                      exerciseId: exercise.id,
                      name: exercise.name,
                    })
                  }
                >
                  <View style={styles.rowInner}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {exercise.name}
                      </Text>
                      <Text style={styles.rowSub}>
                        {normaliseMuscle(exercise.muscle_group) ?? 'Unsorted'}
                        {exercise.tracking_type === 'time' ? ' · timed' : ''}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() =>
                        Alert.alert('Delete exercise', `Remove ${exercise.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => void removeExercise(exercise.id),
                          },
                        ])
                      }
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete the exercise ${exercise.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </FadeInView>
          ))
        )}
      </FormScroll>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}
