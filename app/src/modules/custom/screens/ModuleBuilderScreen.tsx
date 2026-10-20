/**
 * ModuleBuilderScreen - where you design a module: what it records, how each
 * field fills itself in, how its list, tile and chart look, and when it
 * reminds you.
 *
 * This is a form whose OUTPUT is another form. Everything you set here becomes
 * rows in user_modules / user_module_fields, and the record screens read those
 * rows to decide what to render. The state and every rule about it live in
 * builder.ts, shared with the website; this screen lays them out.
 *
 * Editing an existing module is intentionally forgiving:
 *   • adding a field   - existing entries just have no value for it (blank)
 *   • renaming a field - the underlying key never changes, so stored values
 *                        stay attached
 *   • retyping a field - nothing stored changes; the guard says how many
 *                        values will stop showing before you commit
 *   • removing a field - the definition goes, the values stay in each record's
 *                        jsonb. Undo brings the field back before you save;
 *                        re-adding one with the same name brings it back after.
 * A builder that could silently destroy data on a mistyped edit would be one
 * you'd never trust with anything important.
 *
 * A NEW module starts at the templates. Choosing one fills the builder for
 * review; nothing is created until you press Create.
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import {
  Button,
  FadeInView,
  FormScroll,
  GlassCard,
  Screen,
  TextField,
  useToast,
} from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import {
  assignKeys,
  blankDraft,
  blankState,
  retypeDraft,
  stateFromModule,
  stateFromTemplate,
  toModuleInput,
  usableDrafts,
  validateBuilder,
  type BuilderErrors,
  type BuilderState,
} from '../builder';
import { FieldEditor } from '../components/FieldEditor';
import { PickerChip } from '../components/PickerChip';
import { ReminderSettings } from '../components/ReminderSettings';
import { TemplatePicker } from '../components/TemplatePicker';
import { TypeChangeSheet } from '../components/TypeChangeSheet';
import { clearModuleReminders, resyncModule } from '../notifications';
import { TEMPLATES, type ModuleTemplate } from '../templates';
import { typeChangeImpact, type TypeChangeImpact } from '../typeChange';
import {
  aggsForFieldType,
  CHART_BUCKET_LABEL,
  fieldTypeLabel,
  isGroupableType,
  isNumericType,
  isSortableFieldType,
  MODULE_COLOR_NAMES,
  MODULE_COLORS,
  MODULE_ICONS,
  SUMMARY_AGG_LABEL,
  SUMMARY_PERIOD_LABEL,
  type ChartBucket,
  type CustomField,
  type CustomRecord,
  type FieldDraft,
  type FieldType,
  type SummaryPeriod,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ModuleBuilder'>;
type Route = RouteProp<RootStackParamList, 'ModuleBuilder'>;

/** Local ids for draft rows. A counter is enough - these never leave the screen. */
let draftCounter = 0;
const nextLocalId = () => `draft-${(draftCounter += 1)}`;

const PERIODS: SummaryPeriod[] = ['all', 'week', 'month'];
const BUCKETS: ChartBucket[] = ['entry', 'day', 'week', 'month'];
const WINDOWS: (number | null)[] = [null, 3, 7];

/** "moon-outline" -> "moon", for a screen reader. */
const iconName = (icon: string) => icon.replace(/-outline$/, '').replace(/-/g, ' ');

type PendingType = { localId: string; label: string; type: FieldType; impact: TypeChangeImpact };

export function ModuleBuilderScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const toast = useToast();
  const editingId = route.params?.moduleId;
  const isEditing = !!editingId;

  const [state, setState] = useState<BuilderState>(() => blankState(nextLocalId));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [existingFields, setExistingFields] = useState<CustomField[]>([]);
  /** The module's entries, for the type-change guard and the delete warning. */
  const [records, setRecords] = useState<CustomRecord[]>([]);
  const [errors, setErrors] = useState<BuilderErrors | null>(null);
  const [pendingType, setPendingType] = useState<PendingType | null>(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit module' : 'New module' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!editingId) return;

    let active = true;
    (async () => {
      try {
        const [module, fields, rows] = await Promise.all([
          api.getModule(editingId),
          api.listFields(editingId),
          api.listRecords(editingId),
        ]);
        if (!active) return;
        setState(stateFromModule(module, fields, nextLocalId));
        setExistingFields(fields);
        setRecords(rows);
      } catch (e) {
        Alert.alert('Could not load', e instanceof Error ? e.message : 'Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [editingId]);

  const update = (patch: Partial<BuilderState>) => {
    setState((current) => ({ ...current, ...patch }));
    if (errors) setErrors(null);
  };

  const updateDraft = (localId: string, patch: Partial<FieldDraft>) =>
    setState((current) => ({
      ...current,
      drafts: current.drafts.map((d) => (d.localId === localId ? { ...d, ...patch } : d)),
    }));

  const applyRetype = (localId: string, type: FieldType) =>
    setState((current) => ({
      ...current,
      drafts: current.drafts.map((d) => (d.localId === localId ? retypeDraft(d, type) : d)),
    }));

  /**
   * A saved field with values gets the guard first. A new field, or one
   * nobody has answered, has nothing to lose and changes straight away.
   */
  const retype = (draft: FieldDraft, type: FieldType) => {
    const saved = existingFields.find((field) => field.id === draft.id);
    if (saved) {
      const impact = typeChangeImpact(records, { key: saved.key, type: draft.type }, { type });
      if (impact.withValue > 0) {
        setPendingType({ localId: draft.localId, label: draft.label.trim(), type, impact });
        return;
      }
    }
    applyRetype(draft.localId, type);
  };

  const addField = () =>
    setState((current) => ({ ...current, drafts: [...current.drafts, blankDraft(nextLocalId())] }));

  /**
   * Removing is a draft change until Save, so it is undone, not confirmed.
   * The toast says what happens to a saved field's values, which is the
   * question a confirm dialog used to answer.
   */
  const removeField = (draft: FieldDraft) => {
    const index = state.drafts.findIndex((d) => d.localId === draft.localId);
    setState((current) => ({
      ...current,
      drafts: current.drafts.filter((d) => d.localId !== draft.localId),
    }));
    if (!draft.id && !draft.label.trim()) return; // an empty new row: nothing to undo
    const name = draft.label.trim() || 'Field';
    toast.show({
      message: draft.id ? `${name} removed. Its values stay in your entries.` : `${name} removed`,
      actionLabel: 'Undo',
      onAction: () =>
        setState((current) => {
          if (current.drafts.some((d) => d.localId === draft.localId)) return current;
          const drafts = [...current.drafts];
          drafts.splice(Math.min(index, drafts.length), 0, draft);
          return { ...current, drafts };
        }),
    });
  };

  const pickTemplate = (template: ModuleTemplate | null) => {
    setState(template ? stateFromTemplate(template, nextLocalId) : blankState(nextLocalId));
    setTemplateId(template?.id ?? 'blank');
    setErrors(null);
  };

  const handleSave = async () => {
    const problem = validateBuilder(state);
    if (problem) {
      setErrors(problem);
      return;
    }

    setSaving(true);
    const keyed = assignKeys(usableDrafts(state.drafts), existingFields.map((f) => f.key));
    const input = toModuleInput(state, keyed);

    try {
      let moduleId: string;
      if (editingId) {
        // Fields first: the module's settings may point at a field this same
        // save creates, so it should exist before anything refers to it.
        await api.saveFields(editingId, keyed, existingFields);
        await api.updateModule(editingId, input);
        moduleId = editingId;
        navigation.goBack();
      } else {
        const created = await api.createModule(input, keyed);
        moduleId = created.id;
        // Straight into the new module, not back to the home screen.
        navigation.replace('CustomModuleList', { moduleId: created.id });
      }
      // Reminders follow the saved settings. Fire and forget: a phone that
      // cannot schedule them has still saved the module.
      void resyncModule(moduleId).catch(() => {});
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    const count = records.length;
    // The database cascades the delete to every entry; say so, with the number.
    const entries =
      count === 0
        ? 'It has no entries.'
        : `Its ${count} ${count === 1 ? 'entry is' : 'entries are'} deleted too.`;
    Alert.alert(`Delete ${state.name.trim() || 'this module'}?`, `${entries} This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteModule(editingId);
            void clearModuleReminders(editingId).catch(() => {});
            // Past the module's own list screen, which now points at nothing.
            navigation.popToTop();
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
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

  const accent = state.color;
  const named = state.drafts.filter((d) => d.label.trim());
  const labelOf = (d: FieldDraft) => d.label.trim();
  const numeric = named.filter((d) => isNumericType(d.type));
  const dates = named.filter((d) => d.type === 'date');
  const chosenTemplate = TEMPLATES.find((t) => t.id === templateId);

  /** A row of "Automatic, field, field..." for a role or a setting. */
  const fieldChoices = (
    current: string | null,
    candidates: FieldDraft[],
    onPick: (ref: string | null) => void,
    noneLabel: string,
  ) => (
    <View style={styles.row} accessibilityRole="radiogroup">
      <PickerChip text={noneLabel} selected={current === null} accent={accent} onPress={() => onPick(null)} />
      {candidates.map((draft) => (
        <PickerChip
          key={draft.localId}
          text={labelOf(draft)}
          selected={current === draft.localId}
          accent={accent}
          onPress={() => onPick(draft.localId)}
        />
      ))}
    </View>
  );

  return (
    <Screen padded={false}>
      <FormScroll contentContainerStyle={styles.scroll}>
        {/*  Templates (new modules only)  */}
        {!isEditing ? (
          <FadeInView>
            <Text style={styles.sectionLabel}>Start from</Text>
            <Text style={styles.sectionHint}>
              {chosenTemplate
                ? `Filled in from ${chosenTemplate.name}. Change anything below; nothing is saved until you press Create.`
                : 'A template fills in the fields for you to review. Nothing is created until you press Create.'}
            </Text>
            <TemplatePicker chosen={templateId} onPick={pickTemplate} />
          </FadeInView>
        ) : null}

        {/*  Identity  */}
        <FadeInView delay={30}>
          <GlassCard style={!isEditing ? styles.spaced : undefined}>
            <TextField
              label="Module name"
              value={state.name}
              onChangeText={(text) => update({ name: text })}
              placeholder="Sleep log, Reading list, Documents..."
              error={errors?.name}
              maxLength={40}
            />

            <Text style={styles.label}>Icon</Text>
            <View style={styles.iconGrid} accessibilityRole="radiogroup">
              {MODULE_ICONS.map((option) => {
                const selected = option === state.icon;
                return (
                  <Pressable
                    key={option}
                    onPress={() => update({ icon: option })}
                    hitSlop={2}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${iconName(option)} icon`}
                    style={({ pressed }) => [
                      styles.iconTile,
                      selected && { backgroundColor: accent + '26', borderColor: accent + '99' },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons name={option} size={19} color={selected ? accent : colors.textMuted} />
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Colour</Text>
            <View style={styles.colorRow} accessibilityRole="radiogroup">
              {MODULE_COLORS.map((option) => {
                const selected = option === state.color;
                return (
                  <Pressable
                    key={option}
                    onPress={() => update({ color: option })}
                    hitSlop={6}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={MODULE_COLOR_NAMES[option] ?? 'Colour'}
                    style={({ pressed }) => [
                      styles.colorDot,
                      { backgroundColor: option },
                      selected && styles.colorDotSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {/* A tick as well as the ring: the choice never rests on an outline alone. */}
                    {selected ? <Ionicons name="checkmark" size={17} color={colors.background} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>
        </FadeInView>

        {/*  Fields  */}
        <FadeInView delay={60}>
          <Text style={styles.sectionLabel}>Fields</Text>
          <Text style={styles.sectionHint}>
            What you want to record each time, in the order the form asks for it.
          </Text>

          {state.drafts.map((draft, index) => (
            <FieldEditor
              key={draft.localId}
              draft={draft}
              index={index}
              accent={accent}
              canRemove={state.drafts.length > 1}
              onChange={(patch) => {
                updateDraft(draft.localId, patch);
                if (errors) setErrors(null);
              }}
              onRetype={(type) => retype(draft, type)}
              onRemove={() => removeField(draft)}
            />
          ))}

          <Button label="Add a field" icon="add" variant="glass" onPress={addField} style={styles.addField} />
        </FadeInView>

        {named.length > 0 ? (
          <FadeInView delay={90}>
            {/*  Row layout and grouping  */}
            <Text style={styles.sectionLabel}>In the list</Text>
            <Text style={styles.sectionHint}>
              What each entry shows. Automatic uses the first text field, the first date and the first
              rating. Yes/no fields can always be ticked in the row.
            </Text>
            <GlassCard>
              <Text style={styles.cardLabelFirst}>Title</Text>
              {fieldChoices(state.titleRef, named, (ref) => update({ titleRef: ref }), 'Automatic')}
              <Text style={styles.cardLabel}>Under it</Text>
              {fieldChoices(state.subtitleRef, named, (ref) => update({ subtitleRef: ref }), 'Automatic')}
              <Text style={styles.cardLabel}>On the right</Text>
              {fieldChoices(state.badgeRef, named, (ref) => update({ badgeRef: ref }), 'Automatic')}
              <Text style={styles.cardLabel}>Group entries by</Text>
              {fieldChoices(
                state.groupRef,
                named.filter((d) => isGroupableType(d.type)),
                (ref) => update({ groupRef: ref }),
                'No groups',
              )}
            </GlassCard>

            {/*  Home tile  */}
            <Text style={styles.sectionLabel}>Home tile</Text>
            <Text style={styles.sectionHint}>What the tile says, and over how long.</Text>
            <GlassCard>
              <View style={styles.row} accessibilityRole="radiogroup">
                <PickerChip
                  text="How many"
                  selected={!state.summaryAgg || state.summaryAgg === 'count'}
                  accent={accent}
                  onPress={() => update({ summaryAgg: 'count', summaryRef: null })}
                />
                {named.flatMap((draft) =>
                  // aggsForFieldType keeps this honest: you cannot total a
                  // date or average a note, and offering it would produce a
                  // tile showing NaN.
                  aggsForFieldType(draft.type)
                    .filter((agg) => agg !== 'count')
                    .map((agg) => (
                      <PickerChip
                        key={`${draft.localId}-${agg}`}
                        text={`${SUMMARY_AGG_LABEL[agg]} ${labelOf(draft)}`}
                        selected={state.summaryAgg === agg && state.summaryRef === draft.localId}
                        accent={accent}
                        onPress={() => update({ summaryAgg: agg, summaryRef: draft.localId })}
                      />
                    )),
                )}
              </View>
              <Text style={styles.cardLabel}>Covering</Text>
              <View style={styles.row} accessibilityRole="radiogroup">
                {PERIODS.map((period) => (
                  <PickerChip
                    key={period}
                    text={SUMMARY_PERIOD_LABEL[period]}
                    selected={state.summaryPeriod === period}
                    accent={accent}
                    onPress={() => update({ summaryPeriod: period })}
                  />
                ))}
              </View>
            </GlassCard>

            {/*  Chart: offered only when there is something to chart  */}
            {numeric.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>Trend chart</Text>
                <Text style={styles.sectionHint}>
                  A line above the list, and the sparkline on the home tile.
                </Text>
                <GlassCard>
                  <View style={styles.row} accessibilityRole="radiogroup">
                    <PickerChip
                      text={`Automatic (${labelOf(numeric[0])})`}
                      selected={!state.chartHidden && state.chartRef === null}
                      accent={accent}
                      onPress={() => update({ chartRef: null, chartHidden: false })}
                    />
                    {numeric.length > 1
                      ? numeric.map((draft) => (
                          <PickerChip
                            key={draft.localId}
                            text={labelOf(draft)}
                            selected={!state.chartHidden && state.chartRef === draft.localId}
                            accent={accent}
                            onPress={() => update({ chartRef: draft.localId, chartHidden: false })}
                          />
                        ))
                      : null}
                    <PickerChip
                      text="No chart"
                      selected={state.chartHidden}
                      accent={accent}
                      onPress={() => update({ chartHidden: true })}
                    />
                  </View>

                  {!state.chartHidden ? (
                    <>
                      <Text style={styles.cardLabel}>Points</Text>
                      <View style={styles.row} accessibilityRole="radiogroup">
                        {BUCKETS.map((bucket) => (
                          <PickerChip
                            key={bucket}
                            text={CHART_BUCKET_LABEL[bucket]}
                            selected={state.chartBucket === bucket}
                            accent={accent}
                            onPress={() => update({ chartBucket: bucket })}
                          />
                        ))}
                      </View>
                      {state.chartBucket !== 'entry' ? (
                        <View style={[styles.row, styles.rowSpaced]} accessibilityRole="radiogroup">
                          <PickerChip
                            text="Total"
                            selected={state.chartAgg === 'sum'}
                            accent={accent}
                            onPress={() => update({ chartAgg: 'sum' })}
                          />
                          <PickerChip
                            text="Average"
                            selected={state.chartAgg === 'average'}
                            accent={accent}
                            onPress={() => update({ chartAgg: 'average' })}
                          />
                        </View>
                      ) : null}
                      <Text style={styles.cardLabel}>Smoothing</Text>
                      <View style={styles.row} accessibilityRole="radiogroup">
                        {WINDOWS.map((window) => (
                          <PickerChip
                            key={String(window)}
                            text={window === null ? 'Off' : `${window}-point average`}
                            selected={state.chartWindow === window}
                            accent={accent}
                            onPress={() => update({ chartWindow: window })}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                </GlassCard>
              </>
            ) : null}

            {/*  Sort  */}
            <Text style={styles.sectionLabel}>Sort entries by</Text>
            <GlassCard>
              {fieldChoices(
                state.sortRef,
                named.filter((d) => isSortableFieldType(d.type)),
                (ref) => update(ref ? { sortRef: ref } : { sortRef: null, sortDirection: 'desc' }),
                'Newest first',
              )}
              {state.sortRef ? (
                <View style={[styles.row, styles.rowSpaced]} accessibilityRole="radiogroup">
                  <PickerChip
                    text="Ascending"
                    selected={state.sortDirection === 'asc'}
                    accent={accent}
                    onPress={() => update({ sortDirection: 'asc' })}
                  />
                  <PickerChip
                    text="Descending"
                    selected={state.sortDirection === 'desc'}
                    accent={accent}
                    onPress={() => update({ sortDirection: 'desc' })}
                  />
                </View>
              ) : null}
            </GlassCard>

            {/*  Reminders  */}
            <Text style={styles.sectionLabel}>Reminders</Text>
            <GlassCard style={styles.spacedTop}>
              <ReminderSettings
                accent={accent}
                time={state.reminderTime}
                days={state.reminderDays}
                fieldRef={state.reminderFieldRef}
                offset={state.reminderOffset}
                dateDrafts={dates}
                onChange={update}
              />
            </GlassCard>
          </FadeInView>
        ) : null}

        <FadeInView delay={120}>
          {errors?.fields || errors?.reminders ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
              <Text style={styles.errorText}>{errors.fields ?? errors.reminders}</Text>
            </View>
          ) : null}

          <Button
            label={isEditing ? 'Save module' : 'Create module'}
            icon="checkmark"
            onPress={handleSave}
            loading={saving}
            style={styles.save}
          />

          {isEditing ? (
            <Button
              label="Delete module"
              icon="trash-outline"
              variant="ghost"
              onPress={handleDelete}
              style={styles.delete}
            />
          ) : null}
        </FadeInView>
      </FormScroll>

      <TypeChangeSheet
        visible={pendingType !== null}
        fieldLabel={pendingType?.label ?? ''}
        typeLabel={pendingType ? fieldTypeLabel(pendingType.type) : ''}
        impact={pendingType?.impact ?? null}
        onClose={() => setPendingType(null)}
        onConfirm={() => {
          if (pendingType) applyRetype(pendingType.localId, pendingType.type);
          setPendingType(null);
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: 104,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spaced: {
    marginTop: spacing.xxl,
  },
  spacedTop: {
    marginTop: spacing.lg,
  },
  label: {
    ...typography.overline,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  cardLabelFirst: {
    ...typography.overline,
    marginBottom: spacing.md,
  },
  cardLabel: {
    ...typography.overline,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },

  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotSelected: {
    borderColor: colors.text,
  },

  sectionLabel: {
    ...typography.overline,
    marginTop: spacing.xxl,
  },
  sectionHint: {
    ...typography.caption,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rowSpaced: {
    marginTop: spacing.md,
  },

  addField: {
    marginTop: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger + '55',
    backgroundColor: colors.glass,
  },
  errorText: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
  },
  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
  },
}));
