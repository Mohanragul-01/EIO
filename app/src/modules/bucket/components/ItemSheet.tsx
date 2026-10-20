/**
 * ItemSheet - add something to the list, or change everything about it.
 *
 * Three sections rather than one long form, so the common edit stays short:
 *   About   - title, category, cost, how much you want it now, a note.
 *   Plan    - when, the steps, the money. Only for Now and Next: planning is
 *             for the few things you are actually doing, and offering it on
 *             all 818 would make every item look unfinished.
 *   Memory  - when it happened and what it was like. Only once it is done.
 *
 * CATEGORY IS A TEXT FIELD WITH SUGGESTIONS, not a picker. There are 61
 * categories, so a picker would be another searchable list; and the one thing
 * you cannot do in a picker is add the 62nd. Typing filters what already
 * exists - tap a suggestion and it is exact, ignore them and you have made a
 * new category. One control, both jobs, and no wrong answer.
 *
 * Save writes About, Plan and Memory together and waits for the answer, so a
 * refusal (the same title twice in a category) can be shown here. Steps are
 * the exception and save as you go - see PlanFields.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Button, SegmentedControl, Sheet, TextField } from '../../../core/components';
import { parseAmountToMinor } from '../../../core/money';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { ItemPatch } from '../api';
import { amountText, choiceOf, targetFor } from '../plan';
import { NOW_CAP } from '../shelf';
import {
  COSTS,
  COST_LABEL,
  WANTS,
  WANT_LABEL,
  wantOf,
  type BucketInput,
  type BucketItem,
  type BucketStep,
  type Cost,
  type Want,
} from '../types';
import { whenToDone } from '../when';
import { CategoryIcon } from './CategoryIcon';
import { useCostColor } from './CostMark';
import { MemoryFields, type MemoryDraft } from './MemoryFields';
import { draftOf } from './MemorySheet';
import { PlanFields, type PlanDraft } from './PlanFields';

export type ItemTab = 'about' | 'plan' | 'memory';

const TAB_LABEL: Record<ItemTab, string> = { about: 'About', plan: 'Plan', memory: 'Memory' };

export type StepActions = {
  add: (itemId: string, title: string) => void;
  toggle: (step: BucketStep) => void;
  remove: (step: BucketStep) => void;
  restore: (step: BucketStep) => void;
  move: (step: BucketStep, direction: -1 | 1) => void;
};

type ItemSheetProps = {
  visible: boolean;
  /** The item being changed, or null when adding. */
  item: BucketItem | null;
  initialTab?: ItemTab;
  /** Pre-fills the category when a category filter is active. */
  defaultCategory?: string;
  categories: string[];
  /** This item's steps, in order. */
  steps: BucketStep[];
  today: string;
  /** Now already holds five, not counting this item. */
  shelfFull: boolean;
  onClose: () => void;
  onSave: (fields: BucketInput & ItemPatch) => Promise<void>;
  onDelete?: (item: BucketItem) => void;
  /** "Not done after all" from the Memory tab. */
  onMarkUndone?: (item: BucketItem) => void;
  stepActions: StepActions;
  /**
   * A failure from something saved as you go (a step), which the screen
   * would otherwise only show underneath this sheet.
   */
  actionError?: string | null;
};

const emptyPlan = (item: BucketItem | null): PlanDraft => ({
  target: choiceOf(item?.target_on ?? null, item?.target_precision ?? null),
  est: amountText(item?.est_cost_minor ?? null),
  saved: amountText(item?.saved_minor ?? null),
});

export function ItemSheet({
  visible,
  item,
  initialTab = 'about',
  defaultCategory,
  categories,
  steps,
  today,
  shelfFull,
  onClose,
  onSave,
  onDelete,
  onMarkUndone,
  stepActions,
  actionError,
}: ItemSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const costColor = useCostColor();

  const [tab, setTab] = useState<ItemTab>(initialTab);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState<Cost>('moderate');
  const [want, setWant] = useState<Want>('someday');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<PlanDraft>(emptyPlan(null));
  /** "Add a step" as typed: Save adds it, rather than dropping it. */
  const [newStep, setNewStep] = useState('');
  const [memory, setMemory] = useState<MemoryDraft | null>(null);
  /**
   * Whether "When" was touched. An item done with no date reads back as
   * "Today", and writing that back on an unrelated save (a title fix) would
   * stamp it with today's date.
   */
  const [whenTouched, setWhenTouched] = useState(false);

  const [titleError, setTitleError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [estError, setEstError] = useState<string | null>(null);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /**
   * Seed the fields when the sheet opens, and again when it is opened on a
   * different item. Done during render rather than in an effect: an effect
   * would paint the previous item's text for one frame on the way in.
   */
  const identity = `${visible}:${item?.id ?? 'new'}:${initialTab}`;
  const [seeded, setSeeded] = useState(identity);
  if (seeded !== identity) {
    setSeeded(identity);
    setTab(initialTab);
    setTitle(item?.title ?? '');
    setCategory(
      item?.category ?? (defaultCategory && defaultCategory !== 'any' ? defaultCategory : ''),
    );
    setCost(item?.cost ?? 'moderate');
    setWant(item ? wantOf(item) : 'someday');
    setNote(item?.note ?? '');
    setPlan(emptyPlan(item));
    setNewStep('');
    setMemory(item?.is_done ? draftOf(item, today) : null);
    setWhenTouched(false);
    setTitleError(null);
    setCategoryError(null);
    setEstError(null);
    setSavedError(null);
    setError(null);
  }

  const tabs: ItemTab[] = item ? (item.is_done ? ['about', 'plan', 'memory'] : ['about', 'plan']) : [];
  const planEditable = want === 'now' || want === 'next';

  const suggestions = useMemo(() => {
    const needle = category.trim().toLowerCase();
    if (!needle) return categories.slice(0, 6);
    const hits = categories.filter((c) => c.toLowerCase().includes(needle));
    // An exact match needs no suggestion - you have already typed it.
    if (hits.length === 1 && hits[0].toLowerCase() === needle) return [];
    return hits.slice(0, 6);
  }, [categories, category]);

  const isNewCategory =
    category.trim().length > 0 &&
    !categories.some((c) => c.toLowerCase() === category.trim().toLowerCase());

  // A done item takes no place on Now, so it never has to ask.
  const askingToSwap = want === 'now' && item?.focus !== 'now' && !item?.is_done && shelfFull;

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const cleanCategory = category.trim();

    setTitleError(cleanTitle ? null : 'What is the thing?');
    setCategoryError(cleanCategory ? null : 'Give it a category');
    if (!cleanTitle || !cleanCategory) {
      setTab('about');
      return;
    }

    const fields: BucketInput & ItemPatch = {
      title: cleanTitle,
      category: cleanCategory,
      cost,
      note: note.trim(),
      focus: want === 'someday' ? null : want,
    };

    // The plan is only written while it can be seen and edited. Moving an
    // item back to Someday hides its plan without erasing it.
    if (item && planEditable) {
      const est = plan.est.trim() ? parseAmountToMinor(plan.est) : null;
      const saved = plan.saved.trim() ? parseAmountToMinor(plan.saved) : 0;
      const estBad = plan.est.trim() !== '' && est === null;
      const savedBad = saved === null;
      setEstError(estBad ? 'Digits only, like 38000' : null);
      setSavedError(savedBad ? 'Digits only, like 12000' : null);
      if (estBad || savedBad) {
        setTab('plan');
        return;
      }
      Object.assign(fields, targetFor(plan.target), { est_cost_minor: est, saved_minor: saved ?? 0 });
    }

    if (item?.is_done && memory) {
      if (item.done_on || whenTouched) Object.assign(fields, whenToDone(memory.when, today));
      Object.assign(fields, {
        memory: memory.memory.trim(),
        place: memory.place.trim(),
        again: memory.again,
      });
    }

    // A step typed but not added. Steps save as you go, so it is added as if
    // its own Add had been pressed, beside the save rather than inside it.
    const typedStep = newStep.trim();
    if (item && typedStep) {
      stepActions.add(item.id, typedStep);
      setNewStep('');
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(fields);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!item || !onDelete) return;
    // Permanent, so it is the one thing here that asks first - and it says
    // what else goes with it, because the steps cascade.
    const stepNote =
      steps.length > 0
        ? ` Also deletes its ${steps.length} ${steps.length === 1 ? 'step' : 'steps'}.`
        : '';
    Alert.alert('Remove from the list', `"${item.title}" is deleted.${stepNote}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onDelete(item) },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      title={item ? 'Edit' : 'Add to the list'}
      subtitle={item?.title}
      onClose={onClose}
      footer={
        <>
          <Button
            label={item ? 'Save' : 'Add it'}
            icon="checkmark"
            onPress={() => void handleSave()}
            loading={saving}
          />
          {item && onDelete ? (
            <Pressable
              onPress={handleDelete}
              style={styles.delete}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.title} from the list`}
            >
              <Text style={styles.deleteText}>Remove from the list</Text>
            </Pressable>
          ) : null}
        </>
      }
    >
      {tabs.length > 0 ? (
        <SegmentedControl
          options={tabs}
          value={tab}
          onChange={setTab}
          renderLabel={(t) => TAB_LABEL[t]}
          style={styles.tabs}
        />
      ) : null}

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {tab === 'about' ? (
          <View>
            <TextField
              label="The thing"
              value={title}
              error={titleError}
              onChangeText={(text) => {
                setTitle(text);
                if (titleError) setTitleError(null);
              }}
              placeholder="Learn to sail a dinghy"
              maxLength={140}
            />

            <View style={styles.spaced}>
              <TextField
                label="Category"
                value={category}
                error={categoryError}
                onChangeText={(text) => {
                  setCategory(text);
                  if (categoryError) setCategoryError(null);
                }}
                placeholder="Water Adventures"
              />
            </View>

            {isNewCategory ? (
              <Text style={styles.hint}>New category - it will appear in the filter.</Text>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                {suggestions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => {
                      setCategory(option);
                      setCategoryError(null);
                    }}
                    hitSlop={{ top: 4, bottom: 4 }}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityLabel={`Use the category ${option}`}
                  >
                    <CategoryIcon category={option} size={13} />
                    <Text style={styles.chipText} numberOfLines={1}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <SegmentedControl
              label="What it costs to do"
              options={COSTS}
              value={cost}
              onChange={setCost}
              renderLabel={(o) => COST_LABEL[o]}
              accentFor={costColor}
              style={styles.spaced}
            />

            {/* Separate from cost on purpose: cost is whether you can afford
                it, this is whether you are going to do it. */}
            <SegmentedControl
              label="How much you want it now"
              options={WANTS}
              value={want}
              onChange={setWant}
              renderLabel={(o) => WANT_LABEL[o]}
              style={styles.spaced}
            />
            {askingToSwap ? (
              <Text style={styles.hint}>
                Now holds {NOW_CAP} already. Saving asks which one to swap out.
              </Text>
            ) : null}

            <TextField
              label="Note"
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              style={styles.spaced}
            />
          </View>
        ) : null}

        {tab === 'plan' && item ? (
          planEditable ? (
            <PlanFields
              draft={plan}
              onChange={setPlan}
              today={today}
              steps={steps}
              onAddStep={(stepTitle) => stepActions.add(item.id, stepTitle)}
              onToggleStep={stepActions.toggle}
              onRemoveStep={stepActions.remove}
              onRestoreStep={stepActions.restore}
              onMoveStep={stepActions.move}
              newStep={newStep}
              onNewStepChange={setNewStep}
              estError={estError}
              savedError={savedError}
            />
          ) : (
            <View style={styles.someday}>
              <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
              <Text style={styles.somedayText}>
                Plans are for the few things you are actually doing. Put this on Now or Next to
                give it a date, steps and a budget.
              </Text>
              <View style={styles.somedayButtons}>
                <Button label="Make it Next" variant="glass" onPress={() => setWant('next')} />
                <Button label="Make it Now" variant="glass" onPress={() => setWant('now')} />
              </View>
            </View>
          )
        ) : null}

        {tab === 'memory' && item && memory ? (
          <View>
            <MemoryFields
              draft={memory}
              onChange={(next) => {
                if (next.when !== memory.when) setWhenTouched(true);
                setMemory(next);
              }}
              today={today}
            />
            {onMarkUndone ? (
              <Pressable
                onPress={() => onMarkUndone(item)}
                style={styles.undone}
                accessibilityRole="button"
              >
                <Text style={styles.undoneText}>Not done after all? Mark it not done</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {error || actionError ? <Text style={styles.error}>{error ?? actionError}</Text> : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  tabs: { marginBottom: spacing.lg },
  spaced: { marginTop: spacing.lg },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },

  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxWidth: '100%',
  },
  chipText: { ...typography.caption, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
  pressed: { opacity: 0.6 },

  someday: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  somedayText: { ...typography.body, textAlign: 'center' },
  somedayButtons: { flexDirection: 'row', gap: spacing.md },

  undone: { minHeight: 48, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  undoneText: { ...typography.caption, color: colors.textSecondary },

  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  deleteText: { ...typography.caption, color: colors.danger },
}));
