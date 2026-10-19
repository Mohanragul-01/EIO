/**
 * CostMark - what an item costs to do, as one, two or three bars.
 *
 * The list used to mark cost with a coloured dot, which is colour alone: on a
 * phone in sunlight, or to anyone who cannot tell that green from that blue,
 * three dots looked the same. The bars carry the tier in their count as well
 * as their colour, so it reads either way, and they stay small enough for 818
 * rows - a word on every row would be noise.
 *
 * The row's own label says the tier in words for screen readers, so the mark
 * itself is hidden from them.
 */
import React from 'react';
import { View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { COSTS, type Cost } from '../types';

export function useCostColor() {
  const { colors } = useTheme();
  return (cost: Cost) =>
    cost === 'low' ? colors.priorityLow : cost === 'moderate' ? colors.priorityNormal : colors.priorityHigh;
}

export function CostMark({ cost }: { cost: Cost }) {
  const styles = useStyles();
  const colorOf = useCostColor();
  const filled = COSTS.indexOf(cost) + 1;

  return (
    <View
      style={styles.mark}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {COSTS.map((tier, index) => (
        <View
          key={tier}
          style={[
            styles.bar,
            { height: 5 + index * 3 },
            index < filled ? { backgroundColor: colorOf(cost) } : styles.barEmpty,
          ]}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 11 },
  bar: { width: 3, borderRadius: 1 },
  barEmpty: { backgroundColor: colors.glassBorderStrong },
}));
