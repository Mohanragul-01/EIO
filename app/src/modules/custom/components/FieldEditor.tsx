/**
 * FieldEditor - one field in the module builder: label, type, choices, hint,
 * default, required.
 *
 * The type chips do not change the type themselves: they ask the screen,
 * which knows the module's entries and can show the type-change guard first
 * for a field that already has values. Everything else edits the draft
 * directly - nothing reaches the database until Save.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard, TextField } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { DEFAULT_MODE_LABEL, defaultModesFor } from '../defaults';
import {
  FIELD_TYPES,
  needsOptions,
  type CustomField,
  type FieldDraft,
  type FieldType,
} from '../types';
import { FieldInput } from './FieldInput';
import { PickerChip } from './PickerChip';

type FieldEditorProps = {
  draft: FieldDraft;
  index: number;
  accent: string;
  canRemove: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
  /** A type chip was tapped; the screen decides whether to ask first. */
  onRetype: (type: FieldType) => void;
  onRemove: () => void;
};

const MODE_NOTE = {
  none: 'Starts empty.',
  fixed: 'Starts with this value:',
  today: "Starts with today's date.",
  last: 'Starts with whatever your last entry said here.',
} as const;

export function FieldEditor({
  draft,
  index,
  accent,
  canRemove,
  onChange,
  onRetype,
  onRemove,
}: FieldEditorProps) {
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

  // The fixed default is typed into the same widget the form will use, so a
  // fixed duration is hours and minutes and a fixed rating is stars.
  const valueField: CustomField = {
    id: draft.localId,
    module_id: '',
    user_id: '',
    key: 'default',
    label: 'Default value',
    type: draft.type,
    required: false,
    options: draft.options,
    position: 0,
    default_mode: 'none',
    default_value: null,
    hint: '',
    created_at: '',
  };

  const name = draft.label.trim() || `Field ${index + 1}`;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.index}>Field {index + 1}</Text>
        {canRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${name}`}
          >
            <Ionicons name="close-circle-outline" size={21} color={colors.textMuted} />
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
      <View style={styles.row} accessibilityRole="radiogroup">
        {FIELD_TYPES.map((option) => (
          <PickerChip
            key={option.type}
            text={option.label}
            icon={option.icon}
            selected={option.type === draft.type}
            accent={accent}
            onPress={() => {
              if (option.type !== draft.type) onRetype(option.type);
            }}
            accessibilityLabel={`${option.label}: ${option.hint}`}
          />
        ))}
      </View>

      {needsOptions(draft.type) ? (
        <View>
          <Text style={styles.label}>{draft.type === 'multiselect' ? 'Tags to pick from' : 'Choices'}</Text>

          {draft.options.length > 0 ? (
            <View style={styles.optionList}>
              {draft.options.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => onChange({ options: draft.options.filter((o) => o !== option) })}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={styles.optionPill}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove the choice ${option}`}
                >
                  <Text style={styles.optionPillText}>{option}</Text>
                  <Ionicons name="close" size={13} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.optionAdd}>
            <TextField
              label=""
              value={optionText}
              onChangeText={setOptionText}
              placeholder={draft.type === 'multiselect' ? 'Add a tag, e.g. Fiction' : 'Add a choice, e.g. Good'}
              onSubmitEditing={addOption}
              returnKeyType="done"
              maxLength={30}
              style={styles.optionInput}
              accessibilityLabel="New choice"
            />
            <Pressable
              onPress={addOption}
              style={styles.optionAddButton}
              accessibilityRole="button"
              accessibilityLabel="Add this choice"
            >
              <Ionicons name="add" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <TextField
        label="Hint (optional)"
        value={draft.hint}
        onChangeText={(text) => onChange({ hint: text })}
        placeholder="Shown under the field, e.g. pages today, not total"
        maxLength={120}
        style={styles.hint}
      />

      <Text style={styles.label}>Fills in with</Text>
      <View style={styles.row} accessibilityRole="radiogroup">
        {defaultModesFor(draft.type).map((mode) => (
          <PickerChip
            key={mode}
            text={DEFAULT_MODE_LABEL[mode]}
            selected={draft.default_mode === mode}
            accent={accent}
            onPress={() => onChange({ default_mode: mode })}
          />
        ))}
      </View>
      <Text style={styles.note}>{MODE_NOTE[draft.default_mode]}</Text>
      {draft.default_mode === 'fixed' ? (
        <View style={styles.fixed}>
          {/* Keyed by type: number, money and duration keep their own text,
              which must start over when the widget changes. */}
          <FieldInput
            key={`${draft.localId}-${draft.type}`}
            field={valueField}
            value={draft.default_value}
            onChange={(value) => onChange({ default_value: value })}
            accent={accent}
            dateMode="due"
          />
        </View>
      ) : null}

      <Pressable
        onPress={() => onChange({ required: !draft.required })}
        style={styles.requiredRow}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: draft.required }}
        accessibilityLabel={`${name} is required`}
      >
        <View
          style={[styles.checkbox, draft.required && { backgroundColor: accent, borderColor: accent }]}
        >
          {draft.required ? <Ionicons name="checkmark" size={13} color={colors.onPrimary} /> : null}
        </View>
        <Text style={styles.requiredText}>Required</Text>
      </Pressable>
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  index: {
    ...typography.overline,
    fontSize: 10,
  },
  label: {
    ...typography.overline,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  note: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  fixed: {
    marginTop: spacing.md,
  },
  hint: {
    marginTop: spacing.xl,
  },
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
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  optionPillText: {
    ...typography.caption,
    fontSize: 12.5,
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
    width: 48,
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
    minHeight: 48,
    marginTop: spacing.md,
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
}));
