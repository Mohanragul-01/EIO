/**
 * ColorPicker - the seven note colours and "None", each with its name.
 *
 * Named, not just swatches: the colour is the whole meaning of the choice,
 * and a row of unlabelled dots is colour alone - unreadable to anyone who
 * cannot tell two of them apart, and silent to TalkBack.
 *
 * ColorSheet wraps it in a Sheet for the list's selection mode; the note's
 * own menu puts it inline.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { NOTE_COLORS, type NoteColorKey } from '../noteColors';

type ColorPickerProps = {
  /** The current colour; undefined when the selection is a mix. */
  value: NoteColorKey | null | undefined;
  onPick: (color: NoteColorKey | null) => void;
};

export function ColorPicker({ value, onPick }: ColorPickerProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const options: { key: NoteColorKey | null; label: string; swatch: string | null }[] = [
    { key: null, label: 'None', swatch: null },
    ...NOTE_COLORS.map((c) => ({ key: c.key, label: c.label, swatch: c.swatch })),
  ];

  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = value === option.key;
        return (
          <Pressable
            key={option.label}
            onPress={() => onPick(option.key)}
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.key ? option.label : 'No colour'}
          >
            <View
              style={[
                styles.swatch,
                option.swatch ? { backgroundColor: option.swatch, borderColor: option.swatch } : styles.none,
                selected && styles.swatchSelected,
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={18} color={option.swatch ? colors.onPrimary : colors.text} />
              ) : option.swatch ? null : (
                <Ionicons name="ban-outline" size={18} color={colors.textSecondary} />
              )}
            </View>
            <Text style={styles.label}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorSheet({
  visible,
  subtitle,
  value,
  onPick,
  onClose,
}: ColorPickerProps & { visible: boolean; subtitle?: string; onClose: () => void }) {
  return (
    <Sheet visible={visible} title="Colour" subtitle={subtitle} onClose={onClose}>
      <ColorPicker value={value} onPick={onPick} />
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
    paddingBottom: spacing.sm,
  },
  option: {
    width: '25%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pressed: { opacity: 0.7 },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  none: {
    backgroundColor: colors.glass,
    borderColor: colors.glassBorderStrong,
  },
  swatchSelected: {
    borderColor: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
}));
