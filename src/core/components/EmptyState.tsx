/**
 * EmptyState
 *
 * What a module shows when it has no data yet. Every CRUD screen needs this
 * exact moment, so it lives in core and each caller supplies its own words.
 *
 * The icon sits in a tinted disc inside a wider halo rather than floating
 * loose; a bare glyph in the middle of a screen reads as unfinished.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme } from '../ThemeContext';
import { radius, spacing } from '../theme';
import { FadeInView } from './FadeInView';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  accent?: string;
  action?: React.ReactNode;
};

export function EmptyState({ icon, title, message, accent, action }: EmptyStateProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = accent ?? colors.primary;

  return (
    <View style={styles.container}>
      <FadeInView>
        <View style={styles.inner}>
          <View style={[styles.halo, { backgroundColor: tone + '14' }]}>
            <View style={[styles.disc, { backgroundColor: tone + '24', borderColor: tone + '3B' }]}>
              <Ionicons name={icon} size={26} color={tone} />
            </View>
          </View>

          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      </FadeInView>
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  inner: {
    alignItems: 'center',
    maxWidth: 300,
  },
  halo: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  disc: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    textAlign: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xxl,
    alignSelf: 'stretch',
  },
}));
