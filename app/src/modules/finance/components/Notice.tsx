/**
 * Notice - a short boxed message inside a form: what a capture link filled in,
 * what it could not use, a likely duplicate.
 *
 * The icon and the words carry the meaning; the tone colour only repeats it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';

type NoticeProps = {
  tone: 'info' | 'warning';
  title: string;
  lines?: string[];
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Notice({ tone, title, lines = [], children, style }: NoticeProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const accent = tone === 'warning' ? colors.warning : colors.info;

  return (
    <View
      style={[styles.box, { borderColor: accent + '66', backgroundColor: accent + '14' }, style]}
      accessibilityRole={tone === 'warning' ? 'alert' : 'summary'}
    >
      <View style={styles.head}>
        <Ionicons
          name={tone === 'warning' ? 'warning-outline' : 'information-circle-outline'}
          size={18}
          color={accent}
        />
        <Text style={styles.title}>{title}</Text>
      </View>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      {children}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text,
    flex: 1,
  },
  line: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: 26,
  },
}));
