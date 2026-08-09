/**
 * FieldInput - renders the right input widget for one field definition.
 *
 *
 * THIS COMPONENT IS THE WHOLE POINT OF THE FEATURE.
 *
 * The five built-in modules each have a hand-written form. Custom modules
 * share ONE form, which loops over the field definitions and renders this
 * component per field. Add a field type here and every custom module can use
 * it immediately - that's what "data-driven UI" buys you.
 *
 * Note it reuses the same core/ components the hand-written forms use, so a
 * generated form looks and behaves identically to a built-in one rather than
 * like a second-class citizen.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DateField, TextField } from '../../../core/components';
import { minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { fonts, radius, spacing } from '../../../core/theme';
import type { CustomField } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type FieldInputProps = {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
};

export function FieldInput({ field, value, onChange, error }: FieldInputProps) {
  const styles = useStyles();
  // The label carries the required marker, so it's built once here rather
  // than in each branch below.
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case 'longtext':
      return (
        <TextField
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="..."
          error={error}
          multiline
        />
      );

    case 'number':
      return (
        <TextField
          label={label}
          // Stored as a number, displayed as a string - hence the conversion
          // in both directions.
          value={value === null || value === undefined ? '' : String(value)}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            if (!cleaned) {
              onChange(null);
              return;
            }
            const parsed = Number(cleaned);
            // Keep the raw text if it isn't yet a valid number (e.g. mid-typing
            // "12."), so the field doesn't fight the user's keystrokes.
            onChange(Number.isFinite(parsed) ? parsed : null);
          }}
          placeholder="0"
          keyboardType="decimal-pad"
          error={error}
        />
      );

    case 'money':
      return (
        <MoneyInput label={label} value={value} onChange={onChange} error={error} />
      );

    case 'date':
      return (
        <View>
          <DateField
            label={label}
            value={typeof value === 'string' ? value : null}
            onChange={onChange}
            // 'event' rather than 'due': most custom modules log things that
            // happened. A future-dated entry is still reachable via the
            // calendar in 'due' modules, and this is the safer default.
            mode="event"
            allowClear={!field.required}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );

    case 'boolean':
      return (
        <Pressable onPress={() => onChange(!value)} style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{label}</Text>
          <View style={[styles.switch, value === true && styles.switchOn]}>
            <View style={[styles.knob, value === true && styles.knobOn]} />
          </View>
        </Pressable>
      );

    case 'select':
      return (
        <View>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.optionRow}>
            {field.options.map((option) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  // Tapping the selected option clears it, unless the field is
                  // required - otherwise an optional choice could never be
                  // un-answered once touched.
                  onPress={() => onChange(selected && !field.required ? null : option)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );

    case 'text':
    default:
      return (
        <TextField
          label={label}
          value={typeof value === 'string' ? value : ''}
          onChangeText={onChange}
          placeholder="..."
          error={error}
          maxLength={200}
        />
      );
  }
}

/**
 * Money gets its own small component because it needs local text state:
 * the STORED value is integer paise, but the user types rupees, and
 * round-tripping through paise on every keystroke would fight them (typing
 * "12." would collapse to "12").
 */
function MoneyInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = React.useState(
    typeof value === 'number' ? minorToAmountString(value) : '',
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.moneyField, !!error && styles.moneyFieldError]}>
        <Text style={styles.currency}>₹</Text>
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            const minor = parseAmountToMinor(next);
            // null while the text isn't a valid amount - the same convention
            // the Finance form uses, so a half-typed value never saves as 0.
            onChange(minor);
          }}
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          selectionColor={colors.primary}
          style={styles.moneyInput}
          maxLength={12}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  label: {
    ...typography.overline,
    marginBottom: spacing.sm,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },

  moneyField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  moneyFieldError: {
    borderColor: colors.danger,
  },
  currency: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.textMuted,
    marginRight: spacing.sm,
  },
  moneyInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15.5,
    color: colors.text,
    paddingVertical: 14,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: {
    ...typography.title,
    fontSize: 14.5,
    flex: 1,
    paddingRight: spacing.lg,
  },
  switch: {
    width: 46,
    height: 27,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  switchOn: {
    backgroundColor: colors.primary + '4D',
    borderColor: colors.primary + '99',
  },
  knob: {
    width: 19,
    height: 19,
    borderRadius: radius.pill,
    backgroundColor: colors.textMuted,
  },
  knobOn: {
    backgroundColor: colors.primary,
    transform: [{ translateX: 19 }],
  },

  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  optionSelected: {
    backgroundColor: colors.primary + '26',
    borderColor: colors.primary + '66',
  },
  optionText: {
    ...typography.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  optionTextSelected: {
    color: colors.primary,
  },
}));
