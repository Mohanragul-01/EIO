/**
 * TemplatePicker - the first step of a new module: start from a template, or
 * from blank.
 *
 * Choosing a card FILLS the builder below it; nothing is saved until you
 * press Create. You see every field, default, chart and reminder the template
 * suggests, and change any of it first. A gallery that installed modules on a
 * tap would be faster and worse: you would meet your new module's fields only
 * when they were already wrong.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { templatePreview, TEMPLATES, type ModuleTemplate } from '../templates';

type TemplatePickerProps = {
  /** The template the builder was filled from, or 'blank'. */
  chosen: string | null;
  onPick: (template: ModuleTemplate | null) => void;
};

export function TemplatePicker({ chosen, onPick }: TemplatePickerProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const card = (
    id: string,
    name: string,
    preview: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    onPress: () => void,
  ) => {
    const selected = chosen === id;
    return (
      <Pressable
        key={id}
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          selected && { borderColor: color },
          pressed && styles.pressed,
        ]}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${name}. ${preview}`}
      >
        <View style={styles.cardHead}>
          <View style={[styles.disc, { backgroundColor: color + '24', borderColor: color + '3B' }]}>
            <Ionicons name={icon} size={17} color={color} />
          </View>
          {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.text} /> : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {TEMPLATES.map((template) =>
        card(template.id, template.name, templatePreview(template), template.icon, template.color, () =>
          onPick(template),
        ),
      )}
      {card('blank', 'Blank', 'Start with one empty field', 'add-outline', colors.textSecondary, () =>
        onPick(null),
      )}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    // Two to a row, with the gap between them.
    width: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    minHeight: 108,
  },
  pressed: {
    opacity: 0.75,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  disc: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    ...typography.title,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  preview: {
    ...typography.caption,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },
}));
