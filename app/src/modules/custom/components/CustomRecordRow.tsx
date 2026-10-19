/**
 * CustomRecordRow - one entry in a custom module's list.
 *
 * Has to work for a module it knows nothing about, so it follows roles rather
 * than a layout (roles.ts): a title, a subtitle under it, a badge on the
 * right, then up to three other values as small labelled chips. Capping at
 * three keeps a ten-field module from producing a row that fills the screen.
 *
 * Every yes/no field is tappable right here - a tick chip, or the badge's
 * circle when the badge is a yes/no - so a module works as a daily check-off
 * without opening each entry. Tapping anywhere else opens the entry. Taps, not
 * swipes: one gesture per region.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import { formatFieldValue, numericValue, readableAs } from '../format';
import type { RowRoles } from '../roles';
import type { CustomField, CustomRecord } from '../types';
import { makeStyles, useTheme } from '../../../core/ThemeContext';

type CustomRecordRowProps = {
  record: CustomRecord;
  roles: RowRoles;
  accent: string;
  onPress: () => void;
  /** Flip a yes/no field on this entry. */
  onToggle: (record: CustomRecord, field: CustomField) => void;
};

export function CustomRecordRow({ record, roles, accent, onPress, onToggle }: CustomRecordRowProps) {
  const styles = useStyles();
  const { title: titleField, subtitle: subtitleField, badge, toggles } = roles;

  const title = titleField ? formatFieldValue(titleField, record.data[titleField.key]) : null;
  const subtitle = subtitleField
    ? formatFieldValue(subtitleField, record.data[subtitleField.key])
    : null;

  // Everything not already given a role, that actually has a value.
  const extras = roles.extras
    .map((f) => ({ field: f, text: formatFieldValue(f, record.data[f.key]) }))
    .filter((entry) => entry.text !== null)
    .slice(0, 3);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={styles.topRow}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <View style={styles.titles}>
          {/* An entry can legitimately have an empty title field, so fall back
              to something rather than rendering a blank row. */}
          <Text style={styles.title} numberOfLines={1}>
            {title ?? 'Untitled entry'}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge ? (
          <Badge record={record} field={badge} accent={accent} onToggle={onToggle} />
        ) : null}
      </View>

      {extras.length > 0 ? (
        <View style={styles.chips}>
          {extras.map((entry) => (
            <View key={entry.field.key} style={styles.chip}>
              <Text style={styles.chipLabel}>{entry.field.label}</Text>
              <Text style={styles.chipValue} numberOfLines={1}>
                {entry.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {toggles.length > 0 ? (
        <View style={styles.toggles}>
          {toggles.map((field) => (
            <ToggleChip
              key={field.key}
              field={field}
              on={record.data[field.key] === true}
              accent={accent}
              onPress={() => onToggle(record, field)}
            />
          ))}
        </View>
      ) : null}
    </GlassCard>
  );
}

/** A yes/no as a tick chip: the tick and the word, never the colour alone. */
function ToggleChip({
  field,
  on,
  accent,
  onPress,
}: {
  field: CustomField;
  on: boolean;
  accent: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.toggle,
        on && { borderColor: accent, backgroundColor: colors.completed },
        pressed && styles.pressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityLabel={field.label}
      accessibilityState={{ checked: on }}
    >
      <Ionicons
        name={on ? 'checkbox' : 'square-outline'}
        size={16}
        color={on ? accent : colors.textMuted}
      />
      <Text style={[styles.toggleText, on && styles.toggleTextOn]} numberOfLines={1}>
        {field.label}
      </Text>
    </Pressable>
  );
}

/** The right-hand slot, drawn by what the badge field holds. */
function Badge({
  record,
  field,
  accent,
  onToggle,
}: {
  record: CustomRecord;
  field: CustomField;
  accent: string;
  onToggle: (record: CustomRecord, field: CustomField) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const value = record.data[field.key];

  if (field.type === 'boolean') {
    const on = value === true;
    return (
      <Pressable
        onPress={() => onToggle(record, field)}
        hitSlop={10}
        style={({ pressed }) => [styles.badgeTick, pressed && styles.pressed]}
        accessibilityRole="checkbox"
        accessibilityLabel={field.label}
        accessibilityState={{ checked: on }}
      >
        <Ionicons
          name={on ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={on ? accent : colors.textMuted}
        />
      </Pressable>
    );
  }

  if (field.type === 'rating') {
    if (!readableAs('rating', value)) return null;
    const stars = numericValue(value) ?? 0;
    return (
      <View
        style={styles.badgeStars}
        accessible
        accessibilityLabel={`${field.label}: ${stars} of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name={n <= stars ? 'star' : 'star-outline'}
            size={12}
            color={n <= stars ? accent : colors.textFaint}
          />
        ))}
      </View>
    );
  }

  const text = formatFieldValue(field, value);
  if (!text) return null;

  if (field.type === 'select' || field.type === 'multiselect') {
    // A choice reads as a status pill. The module colour marks the edge; the
    // words carry the meaning, in the theme's own text colour.
    const tags = Array.isArray(value) ? value.map(String) : [text];
    const more = tags.length - 1;
    return (
      <View style={[styles.badgePill, { borderColor: accent }]}>
        <Text style={styles.badgePillText} numberOfLines={1}>
          {tags[0]}
          {more > 0 ? ` +${more}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <Text style={styles.badgeText} numberOfLines={1} accessibilityLabel={`${field.label}: ${text}`}>
      {text}
    </Text>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  titles: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 15,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.7,
  },

  badgeTick: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStars: {
    flexDirection: 'row',
    gap: 1,
  },
  badgePill: {
    maxWidth: 140,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: colors.glass,
  },
  badgePillText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.text,
  },
  badgeText: {
    ...typography.title,
    ...typography.numeric,
    fontSize: 14,
    maxWidth: 140,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    maxWidth: '100%',
  },
  chipLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textFaint,
  },
  chipValue: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },

  toggles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  toggleText: {
    ...typography.caption,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  toggleTextOn: {
    color: colors.text,
  },
}));
