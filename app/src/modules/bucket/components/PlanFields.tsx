/**
 * PlanFields - when, the steps, and the money, for a Now or Next item.
 *
 * WHEN with honest precision: Someday, this year, next year, a month, or a
 * day - whichever you actually decided. A target that has passed is shown
 * plainly with three ways forward, never as "overdue": guilt is how a list
 * like this gets abandoned.
 *
 * STEPS SAVE AS YOU GO, unlike everything else in the item sheet, which waits
 * for Save. A checklist is edited a row at a time, and making it wait would
 * mean diffing a list on save. Removing one offers Undo right here, because a
 * toast would be drawn underneath this sheet where nobody can reach it.
 *
 * MONEY does its own arithmetic: "₹38,000 to go · ₹3,200 a month reaches it
 * by Oct 2027". With no target month to work towards, a what-if amount gives
 * the same sentence the other way round; it is not saved - a target is the
 * plan you keep.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { MonthCalendar, TextField } from '../../../core/components';
import { parseAmountToMinor } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import {
  describeSavings,
  formatTarget,
  isTargetPassed,
  moveOptions,
  savingsAdvice,
  targetFor,
  choiceOf,
  type TargetChoice,
} from '../plan';
import type { BucketStep } from '../types';
import { isPendingStep } from '../useBucket';
import { addDaysTo, isoOf, partsOf } from '../when';
import { PeriodPicker, PickDay } from './PeriodPicker';

export type PlanDraft = {
  target: TargetChoice;
  /** Rupees as typed. */
  est: string;
  saved: string;
};

type PlanFieldsProps = {
  draft: PlanDraft;
  onChange: (draft: PlanDraft) => void;
  today: string;
  /** This item's steps, in order. */
  steps: BucketStep[];
  onAddStep: (title: string) => void;
  onToggleStep: (step: BucketStep) => void;
  onRemoveStep: (step: BucketStep) => void;
  onRestoreStep: (step: BucketStep) => void;
  onMoveStep: (step: BucketStep, direction: -1 | 1) => void;
  estError?: string | null;
  savedError?: string | null;
};

type WhenKey = 'someday' | 'this-year' | 'next-year' | 'month' | 'day';

const WHEN_OPTIONS: { key: WhenKey; label: string }[] = [
  { key: 'someday', label: 'Someday' },
  { key: 'this-year', label: 'This year' },
  { key: 'next-year', label: 'Next year' },
  { key: 'month', label: 'A month' },
  { key: 'day', label: 'A day' },
];

export function PlanFields({
  draft,
  onChange,
  today,
  steps,
  onAddStep,
  onToggleStep,
  onRemoveStep,
  onRestoreStep,
  onMoveStep,
  estError,
  savedError,
}: PlanFieldsProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const now = partsOf(today);

  const [newStep, setNewStep] = useState('');
  /** The step whose Move/Remove row is open, after a long press. */
  const [activeStep, setActiveStep] = useState<string | null>(null);
  /** The last step removed, for the inline Undo. */
  const [removed, setRemoved] = useState<BucketStep | null>(null);
  /** The unsaved "what if I put aside…" amount. */
  const [monthly, setMonthly] = useState('');

  const set = (patch: Partial<PlanDraft>) => onChange({ ...draft, ...patch });

  const { target } = draft;
  const stored = targetFor(target);
  const passed = isTargetPassed(stored.target_on, stored.target_precision, today);

  const whenKey: WhenKey | null =
    target.kind === 'someday'
      ? 'someday'
      : target.kind === 'year'
        ? target.year === now.year
          ? 'this-year'
          : target.year === now.year + 1
            ? 'next-year'
            : null
        : target.kind;

  const chooseWhen = (key: WhenKey) => {
    const nextMonth = partsOf(addDaysTo(isoOf(now.year, now.month, 1), 31));
    const choices: Record<WhenKey, TargetChoice> = {
      someday: { kind: 'someday' },
      'this-year': { kind: 'year', year: now.year },
      'next-year': { kind: 'year', year: now.year + 1 },
      month:
        target.kind === 'month' ? target : { kind: 'month', year: nextMonth.year, month: nextMonth.month },
      day: target.kind === 'day' ? target : { kind: 'day', iso: addDaysTo(today, 30) },
    };
    set({ target: choices[key] });
  };

  const estMinor = parseAmountToMinor(draft.est);
  const savedMinor = parseAmountToMinor(draft.saved) ?? 0;
  const advice = savingsAdvice({
    estMinor,
    savedMinor,
    targetOn: stored.target_on,
    targetPrecision: stored.target_precision,
    monthlyMinor: parseAmountToMinor(monthly),
    today,
  });
  const showWhatIf = target.kind === 'someday' && (advice.kind === 'to-go' || advice.kind === 'by-monthly');
  const moneyPercent =
    estMinor && estMinor > 0
      ? savedMinor >= estMinor
        ? 100
        : Math.min(99, Math.round((savedMinor / estMinor) * 100))
      : null;

  const doneCount = steps.filter((s) => s.is_done).length;
  // Nothing moves while a step is still on its way to the database: it has
  // no id to renumber yet.
  const anyPending = steps.some(isPendingStep);

  const submitStep = () => {
    const title = newStep.trim();
    if (!title) return;
    onAddStep(title);
    setNewStep('');
    setRemoved(null);
  };

  return (
    <View>
      {/* WHEN ------------------------------------------------------------- */}
      <Text style={styles.label}>When</Text>
      <View style={styles.chips}>
        {WHEN_OPTIONS.map((option) => {
          const selected = whenKey === option.key;
          return (
            <Pressable
              key={option.key}
              onPress={() => chooseWhen(option.key)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {target.kind === 'month' ? (
        <View style={styles.block}>
          <PeriodPicker
            year={target.year}
            month={target.month}
            minYear={now.year}
            maxYear={now.year + 30}
            isMonthDisabled={(y, m) => y * 12 + m < now.year * 12 + now.month}
            onChange={(year, month) => set({ target: { kind: 'month', year, month: month ?? 1 } })}
          />
        </View>
      ) : null}

      {target.kind === 'day' ? (
        <View style={styles.block}>
          <MonthCalendar
            year={partsOf(target.iso).year}
            month={partsOf(target.iso).month}
            onChangeMonth={(year, month) => {
              const day = Math.min(partsOf(target.iso).day, new Date(year, month, 0).getDate());
              const iso = isoOf(year, month, day);
              set({ target: { kind: 'day', iso: iso < today ? today : iso } });
            }}
            selected={target.iso}
            renderDay={(day) => <PickDay day={day} disabled={day.iso < today} />}
            dayLabel={(day) => (day.iso < today ? 'past, cannot be chosen' : null)}
            onSelect={(iso) => {
              if (iso >= today) set({ target: { kind: 'day', iso } });
            }}
          />
        </View>
      ) : null}

      {passed && stored.target_on && stored.target_precision ? (
        <View style={styles.passed} accessibilityRole="summary">
          <View style={styles.passedHead}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.passedText}>
              Target passed · {formatTarget(stored.target_on, stored.target_precision, today)}. Move to…
            </Text>
          </View>
          <View style={styles.chips}>
            {moveOptions(today).map((option) => (
              <Pressable
                key={option.label}
                onPress={() =>
                  set({ target: choiceOf(option.target.target_on, option.target.target_precision) })
                }
                hitSlop={{ top: 4, bottom: 4 }}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Move the target to ${option.label}`}
              >
                <Text style={styles.chipText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <Text style={styles.summary}>
          {stored.target_on && stored.target_precision
            ? `Aiming for ${formatTarget(stored.target_on, stored.target_precision, today)}`
            : 'No date yet - that is allowed.'}
        </Text>
      )}

      {/* STEPS ------------------------------------------------------------ */}
      <View style={[styles.sectionHead, styles.spaced]}>
        <Text style={styles.label}>Steps</Text>
        {steps.length > 0 ? (
          <Text style={styles.count}>
            {doneCount} of {steps.length}
          </Text>
        ) : null}
      </View>

      {steps.map((step, index) => {
        const pending = isPendingStep(step);
        const open = activeStep === step.id;
        return (
          <View key={step.id}>
            <Pressable
              onPress={() => {
                setActiveStep(null);
                setRemoved(null);
                onToggleStep(step);
              }}
              onLongPress={() => setActiveStep(open ? null : step.id)}
              disabled={pending}
              style={({ pressed }) => [styles.stepRow, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: step.is_done, disabled: pending }}
              accessibilityLabel={step.title}
              accessibilityHint="Hold to move or remove"
            >
              <View style={[styles.box, step.is_done && styles.boxOn]}>
                {step.is_done ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
              </View>
              <Text style={[styles.stepText, step.is_done && styles.stepTextDone]}>{step.title}</Text>
            </Pressable>

            {open ? (
              <View style={styles.stepActions}>
                <StepAction
                  icon="arrow-up"
                  label="Up"
                  disabled={anyPending || index === 0}
                  onPress={() => onMoveStep(step, -1)}
                  accessibilityLabel={`Move ${step.title} up`}
                />
                <StepAction
                  icon="arrow-down"
                  label="Down"
                  disabled={anyPending || index === steps.length - 1}
                  onPress={() => onMoveStep(step, 1)}
                  accessibilityLabel={`Move ${step.title} down`}
                />
                <StepAction
                  icon="trash-outline"
                  label="Remove"
                  onPress={() => {
                    setActiveStep(null);
                    setRemoved(step);
                    onRemoveStep(step);
                  }}
                  accessibilityLabel={`Remove ${step.title}`}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      {removed ? (
        <View style={styles.undoRow}>
          <Text style={styles.undoText} numberOfLines={1}>
            Removed “{removed.title}”
          </Text>
          <Pressable
            onPress={() => {
              onRestoreStep(removed);
              setRemoved(null);
            }}
            style={styles.undoButton}
            accessibilityRole="button"
            accessibilityLabel={`Undo removing ${removed.title}`}
          >
            <Text style={styles.undoLabel}>Undo</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.addRow}>
        <TextInput
          value={newStep}
          onChangeText={setNewStep}
          placeholder="Add a step"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          onSubmitEditing={submitStep}
          submitBehavior="submit"
          returnKeyType="done"
          style={styles.addInput}
          accessibilityLabel="New step"
        />
        <Pressable
          onPress={submitStep}
          disabled={!newStep.trim()}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add the step"
          accessibilityState={{ disabled: !newStep.trim() }}
        >
          <Ionicons
            name="add"
            size={22}
            color={newStep.trim() ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
      <Text style={styles.hint}>Steps save as you go. Hold one to move or remove it.</Text>

      {/* MONEY ------------------------------------------------------------ */}
      <Text style={[styles.label, styles.spaced]}>Money</Text>
      <View style={styles.moneyRow}>
        <TextField
          label="Estimate, ₹"
          value={draft.est}
          onChangeText={(est) => set({ est })}
          keyboardType="decimal-pad"
          placeholder="38000"
          error={estError}
          style={styles.moneyField}
        />
        <TextField
          label="Saved so far, ₹"
          value={draft.saved}
          onChangeText={(saved) => set({ saved })}
          keyboardType="decimal-pad"
          placeholder="0"
          error={savedError}
          style={styles.moneyField}
        />
      </View>

      {moneyPercent !== null ? (
        <View style={styles.meterRow}>
          <View style={styles.meter}>
            <View style={[styles.meterFill, { width: `${moneyPercent}%` }]} />
          </View>
          <Text style={styles.meterLabel}>{moneyPercent}%</Text>
        </View>
      ) : null}

      {describeSavings(advice) ? (
        <Text style={styles.moneyLine} accessibilityLiveRegion="polite">
          {describeSavings(advice)}
        </Text>
      ) : null}

      {showWhatIf ? (
        <TextField
          label="What if I put aside, ₹ a month"
          value={monthly}
          onChangeText={setMonthly}
          keyboardType="decimal-pad"
          placeholder="3200"
          style={styles.whatIf}
        />
      ) : null}
    </View>
  );
}

function StepAction({
  icon,
  label,
  onPress,
  disabled = false,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.stepAction, disabled && styles.disabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <Text style={styles.stepActionText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: { ...typography.overline },
  spaced: { marginTop: spacing.xl },
  block: { marginTop: spacing.md },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.glassStrong },
  chipText: { ...typography.caption, color: colors.textSecondary },
  chipTextOn: { color: colors.primary, fontFamily: typography.title.fontFamily },
  summary: { ...typography.caption, marginTop: spacing.sm },

  // Neutral, deliberately: no red, no warning colour. A date that slipped is
  // a fact with a way forward.
  passed: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  passedHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  passedText: { ...typography.caption, color: colors.textSecondary, flex: 1 },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...typography.caption, ...typography.numeric },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepText: { ...typography.body, flex: 1 },
  // Muted rather than struck through: a ticked step is done, not wrong.
  stepTextDone: { color: colors.textMuted },
  stepActions: { flexDirection: 'row', gap: spacing.sm, marginLeft: 32, marginBottom: spacing.sm },
  stepAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
  },
  stepActionText: { ...typography.caption, color: colors.textSecondary },

  undoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  undoText: { ...typography.caption, flex: 1 },
  undoButton: { minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  undoLabel: { ...typography.title, fontSize: 14, color: colors.primary },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  addInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.md },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hint: { ...typography.caption, marginTop: spacing.sm },

  moneyRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  moneyField: { flex: 1 },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  meter: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.glassBorder,
    overflow: 'hidden',
  },
  meterFill: { height: '100%', backgroundColor: colors.success },
  meterLabel: { ...typography.caption, ...typography.numeric, color: colors.textSecondary },
  moneyLine: { ...typography.body, color: colors.text, marginTop: spacing.sm },
  whatIf: { marginTop: spacing.md },
}));
