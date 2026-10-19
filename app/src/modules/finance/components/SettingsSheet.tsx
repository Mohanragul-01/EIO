/**
 * SettingsSheet - when your month starts, and getting the data out.
 *
 * The month start is synced (finance_settings), so the website's "this month"
 * agrees with the phone's. The preview line shows exactly which days the
 * current month will cover before you save it, because "starts on the 25th"
 * leaves open whether October is 25 Sep-24 Oct or 25 Oct-24 Nov.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { formatRange, periodBounds, periodOf, periodTitle } from '../period';

type SettingsSheetProps = {
  visible: boolean;
  startDay: number;
  onClose: () => void;
  onSaveStartDay: (day: number) => Promise<void>;
  onExport: (scope: 'month' | 'all') => void;
};

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  const last = day % 10;
  return `${day}${last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th'}`;
}

export function SettingsSheet({ visible, startDay, onClose, onSaveStartDay, onExport }: SettingsSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [day, setDay] = useState(startDay);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identity = `${visible}:${startDay}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setDay(startDay);
    setError(null);
  }

  const today = todayISO();
  const period = periodOf(today, day);
  const preview = `${periodTitle(period)} is ${formatRange(periodBounds(period, day))}.`;

  const step = (delta: number) => setDay((d) => Math.min(31, Math.max(1, d + delta)));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSaveStartDay(day);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      title="Finance settings"
      subtitle="Synced with the website"
      onClose={onClose}
      footer={
        <Button
          label="Save"
          icon="checkmark"
          onPress={() => void save()}
          loading={saving}
          disabled={day === startDay}
        />
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Month starts on</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => step(-1)}
            disabled={day <= 1}
            style={[styles.stepButton, day <= 1 && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="One day earlier"
            accessibilityState={{ disabled: day <= 1 }}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <Text
            style={styles.day}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`The ${ordinal(day)}`}
          >
            {ordinal(day)}
          </Text>
          <Pressable
            onPress={() => step(1)}
            disabled={day >= 31}
            style={[styles.stepButton, day >= 31 && styles.disabled]}
            accessibilityRole="button"
            accessibilityLabel="One day later"
            accessibilityState={{ disabled: day >= 31 }}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Text style={styles.preview}>{preview}</Text>
        <Text style={styles.note}>
          Set it to your salary day, so a month runs from one pay to the next. Totals, budgets and
          the trend all follow it. A day past a month&apos;s end means its last day.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={[styles.label, styles.section]}>Export as CSV</Text>
        <View style={styles.exportRow}>
          <Button
            label="This month"
            icon="share-outline"
            variant="glass"
            onPress={() => {
              onClose();
              onExport('month');
            }}
            style={styles.exportButton}
          />
          <Button
            label="Everything"
            icon="share-outline"
            variant="glass"
            onPress={() => {
              onClose();
              onExport('all');
            }}
            style={styles.exportButton}
          />
        </View>
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.md,
  },
  section: {
    marginTop: spacing.xxl,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stepButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  disabled: {
    opacity: 0.35,
  },
  day: {
    ...typography.h1,
    ...typography.numeric,
    minWidth: 64,
    textAlign: 'center',
  },
  preview: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
  },
  note: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  exportRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  exportButton: {
    flex: 1,
  },
}));
