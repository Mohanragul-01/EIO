/**
 * TextField
 *
 * Labelled text input on a glass surface. Lives in core because every form in
 * the app needs one.
 *
 * The focus ring is the part that matters: React Native gives inputs no focus
 * styling of its own, so without it there is no signal about which field is
 * active.
 */
import React, { useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { fonts, radius, spacing } from '../theme';

type TextFieldProps = TextInputProps & {
  label: string;
  /** Validation message. Also turns the border red. */
  error?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[styles.field, focused && styles.fieldFocused, !!error && styles.fieldError]}>
        <TextInput
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          // Without this the placeholder is nearly invisible against the field.
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.primary}
          style={[styles.input, inputProps.multiline && styles.inputMultiline]}
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
  field: {
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    paddingHorizontal: spacing.lg,
  },
  fieldFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.glassStrong,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15.5,
    color: colors.text,
    paddingVertical: 14,
    // Android adds its own internal padding; this keeps the text centred
    // inside our own instead.
    textAlignVertical: 'center',
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
}));
