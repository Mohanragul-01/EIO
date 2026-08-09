/**
 * ModuleBuilderScreen - where you design a module: name, icon, colour, fields.
 *
 * This is a form whose OUTPUT is another form. Everything you set here becomes
 * rows in user_modules / user_module_fields, and the record screens read those
 * rows to decide what to render.
 *
 * Editing an existing module is intentionally forgiving:
 *   • adding a field   - existing entries just have no value for it (blank)
 *   • renaming a field - the underlying key never changes, so stored values
 *                        stay attached
 *   • deleting a field - the definition goes, the values stay in each record's
 *                        jsonb. Invisible, harmless, and re-adding a field
 *                        with the same name brings them back.
 * A builder that could silently destroy data on a mistyped edit would be one
 * you'd never trust with anything important.
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

import { Button, FadeInView, GlassCard, Screen, TextField } from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import type { RootStackParamList } from '../../../navigation/types';
import * as api from '../api';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import {
  FIELD_TYPES,
  MODULE_COLORS,
  MODULE_ICONS,
  needsOptions,
  type CustomField,
  type FieldDraft,
  type FieldType,
} from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ModuleBuilder'>;
type Route = RouteProp<RootStackParamList, 'ModuleBuilder'>;

/** Local ids for draft rows. A counter is enough - these never leave the screen. */
let draftCounter = 0;
const nextLocalId = () => `draft-${(draftCounter += 1)}`;

export function ModuleBuilderScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const editingId = route.params?.moduleId;
  const isEditing = !!editingId;

  const [name, setName] = useState('');
  const [icon, setIcon] = useState(MODULE_ICONS[0]);
  const [color, setColor] = useState(MODULE_COLORS[0]);
  const [drafts, setDrafts] = useState<FieldDraft[]>([
    // Start with one text field so a brand-new module is never empty.
    { localId: nextLocalId(), label: '', type: 'text', required: false, options: [] },
  ]);

  const [existingFields, setExistingFields] = useState<CustomField[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
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
        const [module, fields] = await Promise.all([
          api.getModule(editingId),
          api.listFields(editingId),
        ]);
        if (!active) return;

        setName(module.name);
        setIcon(module.icon as (typeof MODULE_ICONS)[number]);
        setColor(module.color);
        setExistingFields(fields);
        setDrafts(
          fields.map((f) => ({
            localId: nextLocalId(),
            id: f.id,
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options ?? [],
          })),
        );
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

  const updateDraft = (localId: string, patch: Partial<FieldDraft>) => {
    setDrafts((current) =>
      current.map((d) => (d.localId === localId ? { ...d, ...patch } : d)),
    );
  };

  const addField = () => {
    setDrafts((current) => [
      ...current,
      { localId: nextLocalId(), label: '', type: 'text', required: false, options: [] },
    ]);
  };

  const removeField = (draft: FieldDraft) => {
    const doRemove = () =>
      setDrafts((current) => current.filter((d) => d.localId !== draft.localId));

    // Only warn for fields that already exist - removing an unsaved draft row
    // can't lose anything.
    if (draft.id) {
      Alert.alert(
        `Remove "${draft.label || 'this field'}"?`,
        'It disappears from the form and the list. Values already saved stay in the database, so re-adding a field with the same name brings them back.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ],
      );
    } else {
      doRemove();
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Give the module a name');
      return;
    }

    const usable = drafts.filter((d) => d.label.trim().length > 0);
    if (usable.length === 0) {
      Alert.alert('Add at least one field', 'A module needs somewhere to put information.');
      return;
    }

    // A choice field with no options would render as an empty row you can't
    // answer - catch it here rather than letting it save.
    const brokenSelect = usable.find((d) => needsOptions(d.type) && d.options.length === 0);
    if (brokenSelect) {
      Alert.alert(
        'Add some choices',
        `"${brokenSelect.label}" is a Choice field, so it needs at least one option.`,
      );
      return;
    }

    setNameError(null);
    setSaving(true);

    try {
      if (isEditing) {
        await api.updateModule(editingId, { name: trimmedName, icon, color });
        await api.saveFields(editingId, usable, existingFields);
      } else {
        await api.createModule({ name: trimmedName, icon, color }, usable);
      }
      navigation.goBack();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const handleDelete = () => {
    if (!editingId) return;
    Alert.alert(
      'Delete this module?',
      'Every entry in it is deleted too. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteModule(editingId);
              // Back twice: past the module's own list screen, which is now
              // pointing at something that no longer exists.
              navigation.getParent()?.goBack();
              navigation.goBack();
            } catch (e) {
              Alert.alert('Could not delete', e instanceof Error ? e.message : 'Try again.');
            }
          },
        },
      ],
    );
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
          {/*  Identity  */}
          <FadeInView>
            <GlassCard>
              <TextField
                label="Module name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (nameError) setNameError(null);
                }}
                placeholder="Sleep log, Reading list, Documents..."
                error={nameError}
                autoFocus={!isEditing}
                maxLength={40}
              />

              <Text style={styles.label}>Icon</Text>
              <View style={styles.iconGrid}>
                {MODULE_ICONS.map((option) => {
                  const selected = option === icon;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setIcon(option)}
                      style={({ pressed }) => [
                        styles.iconTile,
                        selected && { backgroundColor: color + '26', borderColor: color + '66' },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name={option}
                        size={19}
                        color={selected ? color : colors.textMuted}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Colour</Text>
              <View style={styles.colorRow}>
                {MODULE_COLORS.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => setColor(option)}
                    style={({ pressed }) => [
                      styles.colorDot,
                      { backgroundColor: option },
                      option === color && styles.colorDotSelected,
                      pressed && styles.pressed,
                    ]}
                  />
                ))}
              </View>
            </GlassCard>
          </FadeInView>

          {/*  Fields  */}
          <FadeInView delay={60}>
            <Text style={styles.sectionLabel}>Fields</Text>
            <Text style={styles.sectionHint}>
              What you want to record each time. The first text field becomes the row title in
              the list.
            </Text>

            {drafts.map((draft, index) => (
              <FieldEditor
                key={draft.localId}
                draft={draft}
                index={index}
                accent={color}
                canRemove={drafts.length > 1}
                onChange={(patch) => updateDraft(draft.localId, patch)}
                onRemove={() => removeField(draft)}
              />
            ))}

            <Button
              label="Add a field"
              icon="add"
              variant="glass"
              onPress={addField}
              style={styles.addField}
            />
          </FadeInView>

          <FadeInView delay={120}>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** One field's editor: label, type, required flag, and choices if it needs them. */
function FieldEditor({
  draft,
  index,
  accent,
  canRemove,
  onChange,
  onRemove,
}: {
  draft: FieldDraft;
  index: number;
  accent: string;
  canRemove: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
  onRemove: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [optionText, setOptionText] = useState('');

  const addOption = () => {
    const value = optionText.trim();
    if (!value || draft.options.includes(value)) {
      setOptionText('');
      return;
    }
    onChange({ options: [...draft.options, value] });
    setOptionText('');
  };

  return (
    <GlassCard style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldIndex}>Field {index + 1}</Text>
        {canRemove ? (
          <Pressable onPress={onRemove} hitSlop={10}>
            <Ionicons name="close-circle-outline" size={19} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <TextField
        label="Label"
        value={draft.label}
        onChangeText={(text) => onChange({ label: text })}
        placeholder="Hours slept, Title, Amount..."
        maxLength={40}
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {FIELD_TYPES.map((option) => {
          const selected = option.type === draft.type;
          return (
            <Pressable
              key={option.type}
              onPress={() =>
                onChange({
                  type: option.type as FieldType,
                  // Options only mean something for 'select'; clear them when
                  // switching away so stale choices don't reappear later.
                  options: needsOptions(option.type) ? draft.options : [],
                })
              }
              style={({ pressed }) => [
                styles.typeChip,
                selected && { backgroundColor: accent + '26', borderColor: accent + '66' },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={option.icon}
                size={13}
                color={selected ? accent : colors.textMuted}
              />
              <Text style={[styles.typeText, selected && { color: accent }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {needsOptions(draft.type) ? (
        <View style={styles.optionsBlock}>
          <Text style={styles.label}>Choices</Text>

          {draft.options.length > 0 ? (
            <View style={styles.optionList}>
              {draft.options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() =>
                    onChange({ options: draft.options.filter((o) => o !== option) })
                  }
                  style={styles.optionPill}
                >
                  <Text style={styles.optionPillText}>{option}</Text>
                  <Ionicons name="close" size={12} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.optionAdd}>
            <TextField
              label=""
              value={optionText}
              onChangeText={setOptionText}
              placeholder="Add a choice, e.g. Good"
              onSubmitEditing={addOption}
              returnKeyType="done"
              maxLength={30}
              style={styles.optionInput}
            />
            <Pressable onPress={addOption} style={styles.optionAddButton} hitSlop={8}>
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={() => onChange({ required: !draft.required })}
        style={styles.requiredRow}
      >
        <View
          style={[
            styles.checkbox,
            draft.required && { backgroundColor: accent, borderColor: accent },
          ]}
        >
          {draft.required ? (
            <Ionicons name="checkmark" size={13} color={colors.onPrimary} />
          ) : null}
        </View>
        <Text style={styles.requiredText}>Required</Text>
      </Pressable>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  flex: { flex: 1 },
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
  label: {
    ...typography.overline,
    marginTop: spacing.xxl,
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
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: 'transparent',
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

  fieldCard: {
    marginBottom: spacing.md,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  fieldIndex: {
    ...typography.overline,
    fontSize: 10,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  typeText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
  },

  optionsBlock: {},
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  optionPillText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text,
  },
  optionAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionInput: {
    flex: 1,
  },
  optionAddButton: {
    width: 44,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  requiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.glassBorderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requiredText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },

  addField: {
    marginTop: spacing.sm,
  },
  save: {
    marginTop: spacing.xxl,
  },
  delete: {
    marginTop: spacing.sm,
  },
}));
