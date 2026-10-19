/**
 * ProgressRing - how close you are to a goal, as a ring with the percentage
 * written inside it (so the amount is never carried by the arc alone).
 */
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { makeStyles, useTheme } from '../../../core/ThemeContext';

export function ProgressRing({
  progress,
  size = 48,
  stroke = 5,
  color,
  showLabel = true,
}: {
  /** 0 to 1. */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  showLabel?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.glassStrong}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? colors.accentCyan}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          // Start at twelve o'clock rather than three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {showLabel ? (
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.label, size < 44 && styles.small]}>
            {Math.round(clamped * 100)}%
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...typography.caption, ...typography.numeric, color: typography.title.color },
  small: { fontSize: 10 },
}));
