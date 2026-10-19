/**
 * SessionSheets - the small sheets the logging screen opens.
 *
 * One file because they are one family: each is a short list of choices about
 * the row or block you just tapped, built on the core Sheet so they look and
 * dismiss alike. Each choice applies at once and closes the sheet - there is
 * no "Save" to forget - except the load sheet, which has fields to type in.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { tap } from '../../../core/haptics';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { Band, SetType } from '../types';
import { formatDuration } from '../types';

// SET TYPE ----------------------------------------------------------------------------

const TYPE_OPTIONS: { type: SetType; letter: string; title: string; detail: string }[] = [
  { type: 'warmup', letter: 'W', title: 'Warm-up', detail: 'Not counted in volume or records' },
  { type: 'normal', letter: '1', title: 'Normal', detail: 'A working set' },
  { type: 'failure', letter: 'F', title: 'Failure', detail: 'Taken to failure; may record 0 reps' },
  { type: 'drop', letter: 'D', title: 'Drop set', detail: 'Straight after the last, no rest' },
];

const RPE_OPTIONS = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

export function SetTypeSheet({
  visible,
  title,
  setType,
  rpe,
  clean,
  showClean,
  onPickType,
  onPickRpe,
  onToggleClean,
  onRemove,
  onClose,
}: {
  visible: boolean;
  title: string;
  setType: SetType;
  rpe: number | null;
  clean: boolean;
  /** Only bodyweight exercises use the clean flag (it feeds ladder level-ups). */
  showClean: boolean;
  onPickType: (type: SetType) => void;
  onPickRpe: (rpe: number | null) => void;
  onToggleClean: (clean: boolean) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const letterColor: Record<SetType, string> = {
    warmup: colors.warning,
    normal: colors.textSecondary,
    failure: colors.danger,
    drop: colors.info,
  };

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle="Set type, effort and removal"
      onClose={onClose}
    >
      <ScrollView>
        {TYPE_OPTIONS.map((option) => {
          const selected = option.type === setType;
          return (
            <Pressable
              key={option.type}
              onPress={() => {
                tap();
                onPickType(option.type);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.title}. ${option.detail}`}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={[styles.letter, { color: letterColor[option.type] }]}>
                {option.letter}
              </Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionDetail}>{option.detail}</Text>
              </View>
              {selected ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}

        <Text style={styles.section}>Effort (RPE)</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {RPE_OPTIONS.map((value) => {
            const selected = rpe === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  tap();
                  onPickRpe(selected ? null : value);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`RPE ${value}`}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          How hard it was: 10 is nothing left, 8 is two more reps in the tank. Tap again to clear.
        </Text>

        {showClean ? (
          <View style={styles.switchRow}>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>Clean set</Text>
              <Text style={styles.optionDetail}>Good form, counts toward a level-up</Text>
            </View>
            <Switch
              value={clean}
              onValueChange={onToggleClean}
              accessibilityLabel="Clean set"
              trackColor={{ true: colors.primary, false: colors.glassStrong }}
            />
          </View>
        ) : null}

        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove this set"
          style={({ pressed }) => [styles.option, styles.remove, pressed && styles.pressed]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
          <Text style={[styles.optionTitle, styles.removeLabel]}>Remove set</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

// REST TIME ---------------------------------------------------------------------------

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

export function RestSheet({
  visible,
  exerciseName,
  seconds,
  onPick,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  seconds: number;
  onPick: (seconds: number) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  return (
    <Sheet
      visible={visible}
      title="Rest time"
      subtitle={`After each set of ${exerciseName}. Remembered for next time.`}
      onClose={onClose}
    >
      <View style={styles.chips} accessibilityRole="radiogroup">
        {REST_OPTIONS.map((value) => {
          const selected = value === seconds;
          const label = value === 0 ? 'Off' : formatDuration(value);
          return (
            <Pressable
              key={value}
              onPress={() => {
                tap();
                onPick(value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={value === 0 ? 'No rest timer' : `${label} rest`}
              style={[styles.chip, styles.restChip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

// BODYWEIGHT LOAD ---------------------------------------------------------------------

export function LoadSheet({
  visible,
  exerciseName,
  weight,
  assist,
  bandId,
  bands,
  onChange,
  onManageBands,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  weight: string;
  assist: string;
  bandId: string | null;
  bands: Band[];
  onChange: (patch: { weight?: string; assist?: string; band_id?: string | null }) => void;
  onManageBands: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Sheet
      visible={visible}
      title="Load"
      subtitle={`${exerciseName}: bodyweight, plus or minus`}
      onClose={onClose}
      footer={<Button label="Done" onPress={onClose} />}
    >
      <View style={styles.fieldRow}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Added weight (kg)</Text>
          <TextInput
            value={weight}
            onChangeText={(text) => onChange({ weight: text })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Added weight in kilograms"
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Assistance (kg)</Text>
          <TextInput
            value={assist}
            onChangeText={(text) => onChange({ assist: text, band_id: null })}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            accessibilityLabel="Assistance in kilograms"
          />
        </View>
      </View>

      <Text style={styles.section}>Band</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        <Pressable
          onPress={() => onChange({ band_id: null })}
          accessibilityRole="radio"
          accessibilityState={{ selected: bandId === null }}
          style={[styles.chip, bandId === null && styles.chipSelected]}
        >
          <Text style={[styles.chipLabel, bandId === null && styles.chipLabelSelected]}>None</Text>
        </Pressable>
        {bands.map((band) => {
          const selected = band.id === bandId;
          return (
            <Pressable
              key={band.id}
              onPress={() =>
                onChange({
                  band_id: band.id,
                  // A band IS assistance: its approximate kg is what records compare.
                  assist: band.approx_kg ? String(band.approx_kg) : '',
                })
              }
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${band.label} band${band.approx_kg ? `, about ${band.approx_kg} kg` : ''}`}
              style={[styles.chip, styles.bandChip, selected && styles.chipSelected]}
            >
              <View style={[styles.bandDot, { backgroundColor: band.color }]} />
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {band.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={onManageBands}
          accessibilityRole="button"
          accessibilityLabel="Manage bands"
          style={[styles.chip, styles.bandChip]}
        >
          <Ionicons name="options-outline" size={15} color={colors.textSecondary} />
          <Text style={styles.chipLabel}>Bands</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

// BLOCK MENU ----------------------------------------------------------------------------

export type BlockMenuAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function BlockMenu({
  visible,
  exerciseName,
  actions,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  actions: BlockMenuAction[];
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} title={exerciseName} onClose={onClose}>
      <ScrollView>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={action.onPress}
            disabled={action.disabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!action.disabled }}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.pressed,
              action.disabled && styles.disabled,
            ]}
          >
            <Ionicons
              name={action.icon}
              size={20}
              color={action.danger ? colors.danger : colors.textSecondary}
            />
            <Text style={[styles.optionTitle, action.danger && styles.removeLabel]}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  pressed: { backgroundColor: colors.glass },
  disabled: { opacity: 0.4 },
  letter: {
    ...typography.h2,
    ...typography.numeric,
    width: 28,
    textAlign: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: { ...typography.title },
  optionDetail: { ...typography.caption },
  section: {
    ...typography.overline,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minWidth: 48,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restChip: { minWidth: 72 },
  bandChip: { flexDirection: 'row', gap: spacing.xs },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipLabel: {
    ...typography.title,
    ...typography.numeric,
    color: colors.textSecondary,
  },
  chipLabelSelected: { color: colors.onPrimary },
  bandDot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
  },
  hint: { ...typography.caption, marginTop: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    marginTop: spacing.md,
  },
  remove: { marginTop: spacing.lg },
  removeLabel: { color: colors.danger },
  fieldRow: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1 },
  fieldLabel: { ...typography.caption, marginBottom: spacing.xs },
  input: {
    ...typography.title,
    ...typography.numeric,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
    color: colors.text,
  },
}));
