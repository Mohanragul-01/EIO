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
 *
 * Under every input sits one meta line: the field's hint on the left, and on
 * the right a "last" tag when the value was copied from the previous entry.
 * Copying is a default, not magic, so it is shown; typing clears the tag.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { DateField, TextField } from '../../../core/components';
import type { DateFieldMode } from '../../../core/components/DateField';
import { tap } from '../../../core/haptics';
import { minorToAmountString, parseAmountToMinor } from '../../../core/money';
import { fonts, radius, spacing } from '../../../core/theme';
import { joinMinutes, numericValue, splitMinutes } from '../format';
import type { CustomField } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type FieldInputProps = {
  field: CustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  /** The module's colour, for stars and selected tags. */
  accent?: string;
  /** The value came from the last entry: show the "last" tag. */
  fromLast?: boolean;
  /** 'due' for a date that points forward, such as a reminder date. */
  dateMode?: DateFieldMode;
};

export function FieldInput(props: FieldInputProps) {
  return (
    <View>
      <FieldBody {...props} />
      <FieldMeta hint={props.field.hint} fromLast={props.fromLast} />
    </View>
  );
}

function FieldBody({ field, value, onChange, error, accent, dateMode = 'event' }: FieldInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tint = accent ?? colors.primary;
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
      return <NumberInput label={label} value={value} onChange={onChange} error={error} />;

    case 'money':
      return (
        <MoneyInput label={label} value={value} onChange={onChange} error={error} />
      );

    case 'duration':
      return <DurationInput label={label} value={value} onChange={onChange} error={error} />;

    case 'rating':
      return (
        <View>
          <Text style={styles.label}>{label}</Text>
          <StarInput
            value={numericValue(value)}
            required={field.required}
            accent={tint}
            onChange={onChange}
            fieldLabel={field.label}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );

    case 'date':
      return (
        <View>
          <DateField
            label={label}
            value={typeof value === 'string' ? value : null}
            onChange={onChange}
            // 'event' for most fields: custom modules mostly log things that
            // happened. A date that points forward - a reminder date like
            // "Water next on" - gets 'due', which allows the future.
            mode={dateMode}
            allowClear={!field.required}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );

    case 'boolean':
      return (
        <Pressable
          onPress={() => onChange(value !== true)}
          style={styles.toggleRow}
          accessibilityRole="switch"
          accessibilityLabel={field.label}
          accessibilityState={{ checked: value === true }}
        >
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
          <View style={styles.optionRow} accessibilityRole="radiogroup">
            {field.options.map((option) => {
              const selected = value === option;
              return (
                <Pressable
                  key={option}
                  // Tapping the selected option clears it, unless the field is
                  // required - otherwise an optional choice could never be
                  // un-answered once touched.
                  onPress={() => onChange(selected && !field.required ? null : option)}
                  hitSlop={{ top: 4, bottom: 4 }}
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

    case 'multiselect': {
      const chosen = Array.isArray(value) ? value.map(String) : typeof value === 'string' ? [value] : [];
      return (
        <View>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.optionRow}>
            {field.options.map((option) => {
              const on = chosen.includes(option);
              return (
                <Pressable
                  key={option}
                  onPress={() => {
                    // Kept in the options' own order, so two entries with the
                    // same tags store the same list.
                    const next = on
                      ? chosen.filter((item) => item !== option)
                      : field.options.filter((o) => o === option || chosen.includes(o));
                    onChange(next);
                  }}
                  hitSlop={{ top: 4, bottom: 4 }}
                  style={({ pressed }) => [
                    styles.option,
                    styles.tag,
                    on && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons
                    name={on ? 'checkmark' : 'add'}
                    size={13}
                    color={on ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.optionText, on && styles.optionTextSelected]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      );
    }

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

/** The hint, and the "last" tag. Renders nothing when there is neither. */
function FieldMeta({ hint, fromLast }: { hint?: string; fromLast?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const text = hint?.trim();
  if (!text && !fromLast) return null;

  return (
    <View style={styles.meta}>
      <Text style={styles.hint}>{text ?? ''}</Text>
      {fromLast ? (
        <View
          style={styles.lastTag}
          accessible
          accessibilityLabel="Filled in from your last entry"
        >
          <Ionicons name="arrow-undo-outline" size={11} color={colors.textMuted} />
          <Text style={styles.lastText}>last</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Number keeps its own text, like money: storing a number on every keystroke
 * turned "7." back into "7" while you were still typing the decimal.
 */
function NumberInput({
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
  const [text, setText] = React.useState(() => {
    const number = numericValue(value);
    return number === null ? '' : String(number);
  });

  return (
    <TextField
      label={label}
      value={text}
      onChangeText={(next) => {
        const cleaned = next.replace(/[^0-9.]/g, '');
        setText(cleaned);
        const parsed = cleaned ? Number(cleaned) : NaN;
        onChange(Number.isFinite(parsed) ? parsed : null);
      }}
      placeholder="0"
      keyboardType="decimal-pad"
      error={error}
    />
  );
}

/**
 * Hours and minutes in two boxes, stored as whole minutes so a duration sums
 * and averages like any number. Local text for the same reason as money.
 */
function DurationInput({
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
  const [parts, setParts] = React.useState(() => {
    const minutes = numericValue(value);
    if (minutes === null) return { hours: '', minutes: '' };
    const split = splitMinutes(minutes);
    return { hours: String(split.hours), minutes: String(split.minutes) };
  });

  const update = (next: { hours: string; minutes: string }) => {
    setParts(next);
    onChange(joinMinutes(next.hours, next.minutes));
  };

  const box = (part: 'hours' | 'minutes', unit: string, a11y: string) => (
    <View style={[styles.durationBox, !!error && styles.moneyFieldError]}>
      <TextInput
        value={parts[part]}
        onChangeText={(text) => update({ ...parts, [part]: text.replace(/[^0-9]/g, '') })}
        placeholder="0"
        placeholderTextColor={colors.textFaint}
        keyboardType="number-pad"
        selectionColor={colors.primary}
        style={styles.durationInput}
        maxLength={part === 'hours' ? 4 : 3}
        accessibilityLabel={`${label}, ${a11y}`}
      />
      <Text style={styles.currency}>{unit}</Text>
    </View>
  );

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.durationRow}>
        {box('hours', 'h', 'hours')}
        {box('minutes', 'm', 'minutes')}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

/**
 * Five stars. Tap one to set it; tap the current one again to clear it,
 * unless the field is required. One adjustable control for TalkBack (swipe up
 * or down to change), rather than five buttons it would read one by one.
 */
export function StarInput({
  value,
  required,
  accent,
  onChange,
  fieldLabel,
}: {
  value: number | null;
  required: boolean;
  accent: string;
  onChange: (value: number | null) => void;
  fieldLabel: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const stars = value !== null && value >= 1 && value <= 5 ? Math.round(value) : 0;

  const set = (next: number) => {
    tap();
    onChange(next === stars && !required ? null : next);
  };

  return (
    <View
      style={styles.stars}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={fieldLabel}
      accessibilityValue={{ min: 0, max: 5, now: stars, text: stars ? `${stars} of 5 stars` : 'Not rated' }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment') onChange(Math.min(5, stars + 1));
        if (event.nativeEvent.actionName === 'decrement') {
          onChange(stars <= 1 ? (required ? 1 : null) : stars - 1);
        }
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => set(n)}
          style={({ pressed }) => [styles.star, pressed && styles.pressed]}
        >
          <Ionicons
            name={n <= stars ? 'star' : 'star-outline'}
            size={26}
            color={n <= stars ? accent : colors.textMuted}
          />
        </Pressable>
      ))}
    </View>
  );
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
  const [text, setText] = React.useState(() => {
    const minor = numericValue(value);
    return minor === null ? '' : minorToAmountString(minor);
  });

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
          accessibilityLabel={label}
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

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  hint: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textMuted,
    flex: 1,
  },
  lastTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  lastText: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
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

  durationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  durationBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  durationInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15.5,
    color: colors.text,
    paddingVertical: 14,
    ...typography.numeric,
  },

  stars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  star: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
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
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
