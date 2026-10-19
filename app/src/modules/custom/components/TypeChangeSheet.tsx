/**
 * TypeChangeSheet - what changing a saved field's type will do, before it does.
 *
 * Changing a type never deletes anything - every value stays in its entry,
 * and switching back shows it again - but some values may stop SHOWING, and
 * finding that out from a list full of blanks feels exactly like data loss.
 * So the sheet says it in numbers, shows three values as they look now and
 * after, and makes the promise in words. Confirm is fine here: nothing is
 * changed until Save, and this is a choice, not a destructive act.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { typeChangeMessage, type TypeChangeImpact } from '../typeChange';

type TypeChangeSheetProps = {
  visible: boolean;
  fieldLabel: string;
  typeLabel: string;
  impact: TypeChangeImpact | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function TypeChangeSheet({
  visible,
  fieldLabel,
  typeLabel,
  impact,
  onConfirm,
  onClose,
}: TypeChangeSheetProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <Sheet
      visible={visible}
      title={`Change ${fieldLabel || 'this field'} to ${typeLabel}?`}
      subtitle="Nothing is deleted. Switch back any time."
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancel" variant="glass" onPress={onClose} style={styles.button} />
          <Button label="Change type" onPress={onConfirm} style={styles.button} />
        </View>
      }
    >
      {impact ? (
        <>
          <Text style={styles.message}>{typeChangeMessage(impact, typeLabel)}</Text>

          {impact.samples.length > 0 ? (
            <View style={styles.samples}>
              <Text style={styles.overline}>How some entries will look</Text>
              {impact.samples.map((sample, index) => (
                <View
                  key={index}
                  style={styles.sample}
                  accessible
                  accessibilityLabel={`${sample.before} becomes ${sample.after ?? 'hidden'}`}
                >
                  <Text style={styles.before} numberOfLines={1}>
                    {sample.before}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                  {sample.after ? (
                    <Text style={styles.after} numberOfLines={1}>
                      {sample.after}
                    </Text>
                  ) : (
                    <View style={styles.hiddenRow}>
                      <Ionicons name="eye-off-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.hidden}>{"won't show"}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  message: {
    ...typography.body,
    color: colors.text,
  },
  samples: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  overline: {
    ...typography.overline,
    marginBottom: spacing.xs,
  },
  sample: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  before: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  after: {
    ...typography.caption,
    ...typography.numeric,
    color: colors.text,
    flex: 1,
  },
  hiddenRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hidden: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    flex: 1,
  },
}));
