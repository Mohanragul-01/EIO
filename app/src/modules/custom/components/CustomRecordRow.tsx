/**
 * CustomRecordRow - one entry in a custom module's list.
 *
 * Has to work for a module it knows nothing about, so it follows a rule
 * rather than a layout: headline from the title field, subtitle from the
 * first date field, then up to three remaining values as small labelled
 * chips. Capping at three keeps a ten-field module from producing a row that
 * fills the screen.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { radius, spacing } from '../../../core/theme';
import { formatFieldValue } from '../format';
import { subtitleFieldOf, titleFieldOf, type CustomField, type CustomRecord } from '../types';
import { makeStyles } from '../../../core/ThemeContext';

type CustomRecordRowProps = {
  record: CustomRecord;
  fields: CustomField[];
  accent: string;
  onPress: () => void;
};

export function CustomRecordRow({ record, fields, accent, onPress }: CustomRecordRowProps) {
  const styles = useStyles();
  const titleField = titleFieldOf(fields);
  const subtitleField = subtitleFieldOf(fields, titleField?.key);

  const title = titleField ? formatFieldValue(titleField, record.data[titleField.key]) : null;
  const subtitle = subtitleField
    ? formatFieldValue(subtitleField, record.data[subtitleField.key])
    : null;

  // Everything not already used above, that actually has a value.
  const extras = fields
    .filter((f) => f.key !== titleField?.key && f.key !== subtitleField?.key)
    .map((f) => ({ field: f, text: formatFieldValue(f, record.data[f.key]) }))
    .filter((entry) => entry.text !== null)
    .slice(0, 3);

  return (
    <GlassCard onPress={onPress} style={styles.card}>
      {/* An entry can legitimately have an empty title field, so fall back to
          something rather than rendering a blank row. */}
      <Text style={styles.title} numberOfLines={1}>
        {title ?? 'Untitled entry'}
      </Text>

      {subtitle ? <Text style={[styles.subtitle, { color: accent }]}>{subtitle}</Text> : null}

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
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 15,
  },
  subtitle: {
    ...typography.caption,
    fontSize: 12,
    marginTop: 3,
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
    fontSize: 11.5,
    color: colors.textSecondary,
    flexShrink: 1,
  },
}));
