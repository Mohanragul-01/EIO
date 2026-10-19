/**
 * BodyTab - The Body tab: weigh-ins, height and BMI.
 *
 * Moved out of FitnessListScreen unchanged when the screen grew past what one
 * file holds comfortably; each tab owns its own data, which is what lets the
 * pager mount them all at once.
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { FadeInView, FormScroll, GlassCard } from '../../../../core/components';
import { useTheme } from '../../../../core/ThemeContext';
import { formatEventDate, todayISO } from '../../../../core/date';
import { bmiLabel } from '../../types';
import { Measurements } from '../../components/Measurements';
import { useBody } from '../../useFitness';
import { ErrorBanner, useHomeStyles } from './styles';

export function BodyTab() {
  const styles = useHomeStyles();
  const { colors } = useTheme();
  const {
    profile,
    metrics,
    currentBmi,
    loading,
    error,
    clearError,
    reload,
    saveHeight,
    saveWeight,
    removeWeight,
  } = useBody();

  const [heightText, setHeightText] = useState('');
  const [weightText, setWeightText] = useState('');

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const height = profile?.height_cm ?? null;

  const handleHeight = async () => {
    const parsed = Number(heightText.trim());
    if (!Number.isFinite(parsed) || parsed < 50 || parsed > 260) return;
    await saveHeight(parsed);
    setHeightText('');
  };

  const handleWeight = async () => {
    const parsed = Number(weightText.trim());
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 500) return;
    const ok = await saveWeight(todayISO(), parsed);
    if (ok) setWeightText('');
  };

  return (
    <>
      <FormScroll
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <FadeInView>
          <GlassCard>
            <Text style={styles.label}>Today</Text>
            <View style={styles.weightRow}>
              <TextInput
                value={weightText}
                onChangeText={(text) => {
                  setWeightText(text);
                  if (error) clearError();
                }}
                placeholder={metrics[0] ? String(metrics[0].weight_kg) : '0'}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.weightInput}
                maxLength={6}
              />
              <Text style={styles.unit}>kg</Text>
              {weightText.trim() ? (
                <Pressable onPress={handleWeight} hitSlop={8}>
                  <Text style={styles.link}>Save</Text>
                </Pressable>
              ) : null}
            </View>

            {/* BMI is never stored. It is entirely determined by weight and
                height, so a stored copy would go stale and look just as
                authoritative as the real one. See types.ts. */}
            {currentBmi ? (
              <Text style={styles.bmi}>
                BMI {currentBmi.toFixed(1)} · {bmiLabel(currentBmi)}
              </Text>
            ) : (
              <Text style={styles.hint}>
                {height
                  ? 'Log a weight to see your BMI.'
                  : 'Set your height below to see your BMI.'}
              </Text>
            )}
          </GlassCard>
        </FadeInView>

        <FadeInView delay={60}>
          <GlassCard style={styles.addCard}>
            <Text style={styles.label}>Height</Text>
            <View style={styles.weightRow}>
              <TextInput
                value={heightText}
                onChangeText={setHeightText}
                placeholder={height ? String(height) : '175'}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                selectionColor={colors.primary}
                style={styles.weightInput}
                maxLength={5}
              />
              <Text style={styles.unit}>cm</Text>
              {heightText.trim() ? (
                <Pressable onPress={handleHeight} hitSlop={8}>
                  <Text style={styles.link}>Save</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.hint}>Set once. Only used to work out BMI.</Text>
          </GlassCard>
        </FadeInView>

        <FadeInView delay={80}>
          <Measurements />
        </FadeInView>

        {metrics.length > 0 ? (
          <FadeInView delay={100}>
            <Text style={styles.sectionLabel}>Weigh-ins</Text>
            {metrics.map((metric) => (
              <GlassCard key={metric.id} style={styles.row}>
                <View style={styles.rowInner}>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{metric.weight_kg} kg</Text>
                    <Text style={styles.rowSub}>{formatEventDate(metric.date)}</Text>
                  </View>
                  <Pressable
                    onPress={() => void removeWeight(metric.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete the weigh-in on ${formatEventDate(metric.date)}`}
                    style={styles.rowMenu}
                  >
                    <Ionicons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              </GlassCard>
            ))}
          </FadeInView>
        ) : null}
      </FormScroll>

      {error ? <ErrorBanner message={error} /> : null}
    </>
  );
}
