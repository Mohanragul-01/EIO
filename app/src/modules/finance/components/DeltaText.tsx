/**
 * DeltaText - "+18% vs Sep", with an arrow.
 *
 * Neutral colour on purpose: spending more is not always bad (rent went up,
 * you bought a laptop you meant to buy), and red and green already mean a
 * budget's state on this screen. The sign is in the words and the arrow's
 * shape, so nothing rests on colour; TalkBack hears the sentence form.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { deltaShort, deltaSpoken, type Delta } from '../summary';

type DeltaTextProps = {
  delta: Delta | null;
  /** 'Sep' */
  versus: string;
  /** 'September', for the spoken form. */
  versusLong: string;
  style?: StyleProp<ViewStyle>;
};

export function DeltaText({ delta, versus, versusLong, style }: DeltaTextProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!delta) return null;

  const icon =
    delta.kind === 'percent' || delta.kind === 'amount'
      ? delta.direction === 'up'
        ? 'arrow-up'
        : 'arrow-down'
      : delta.kind === 'same'
        ? 'remove'
        : 'sparkles-outline';

  return (
    <View
      style={[styles.row, style]}
      accessible
      accessibilityLabel={deltaSpoken(delta, versusLong)}
    >
      <Ionicons name={icon} size={11} color={colors.textMuted} />
      <Text style={styles.text}>{deltaShort(delta, versus)}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  text: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 11.5,
    lineHeight: 15,
  },
}));
