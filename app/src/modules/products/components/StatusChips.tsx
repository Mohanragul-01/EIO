/**
 * StatusChips and SupplyBar - how a product's state is drawn.
 *
 * Every chip is a WORD with an icon, and colour only reinforces it: "Reorder
 * now" in red with an alert, "Use by 3 Nov" in amber with a clock. Running
 * out and going off are different problems, so they are separate chips with
 * different icons, never one merged colour. The words come from outlook.ts,
 * which the website shares; only the drawing is here.
 *
 * The bar shows what is LEFT, filling from the left, with a thin mark where a
 * lead time's worth of supply remains - the reorder point - so you can watch
 * the fill approach it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useTheme } from '../../../core/ThemeContext';
import type { ThemeColors } from '../../../core/theme';
import { radius, spacing } from '../../../core/theme';
import type { Chip, ChipKind } from '../outlook';

type Look = { tone: keyof ThemeColors; icon: keyof typeof Ionicons.glyphMap };

const LOOK: Record<ChipKind, Look> = {
  reorder: { tone: 'danger', icon: 'alert-circle' },
  low: { tone: 'warning', icon: 'trending-down' },
  plenty: { tone: 'success', icon: 'checkmark-circle' },
  unknown: { tone: 'textMuted', icon: 'help-circle-outline' },
  'spare-ready': { tone: 'info', icon: 'cube' },
  'use-by': { tone: 'warning', icon: 'time-outline' },
  expired: { tone: 'danger', icon: 'time' },
  finished: { tone: 'textMuted', icon: 'checkmark-done' },
  unopened: { tone: 'info', icon: 'cube-outline' },
};

/** The colour a chip kind is drawn in, for text that goes with it. */
export function toneOf(colors: ThemeColors, kind: ChipKind): string {
  return colors[LOOK[kind].tone] as string;
}

export function StatusChips({ chips }: { chips: Chip[] }) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {chips.map((chip) => {
        const tone = toneOf(colors, chip.kind);
        return (
          <View
            key={chip.kind}
            style={[styles.chip, { borderColor: tone + '59', backgroundColor: tone + '17' }]}
          >
            <Ionicons name={LOOK[chip.kind].icon} size={13} color={tone} />
            <Text style={[styles.chipText, { color: tone }]}>{chip.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function SupplyBar({
  fraction,
  marker,
  tone,
  thick = false,
}: {
  /** What is left, 0 to 1. */
  fraction: number;
  /** The reorder point, 0 to 1, or null when there is no measured rate. */
  marker: number | null;
  tone: string;
  thick?: boolean;
}) {
  const styles = useStyles();
  return (
    // Decoration: the numbers beside it say the same thing in words.
    <View
      style={[styles.track, thick && styles.trackThick]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[styles.fill, { width: `${Math.round(fraction * 1000) / 10}%`, backgroundColor: tone }]} />
      {marker !== null ? (
        <View style={[styles.marker, { left: `${Math.round(marker * 1000) / 10}%` }]} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: { ...typography.caption, fontSize: 11.5, fontWeight: '600' },

  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.glassBorder,
    marginVertical: 3,
  },
  trackThick: { height: 8, borderRadius: 4 },
  fill: { height: '100%', borderRadius: 3 },
  // Taller than the track, so it reads as a mark on the bar rather than a gap.
  marker: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 2,
    marginLeft: -1,
    borderRadius: 1,
    backgroundColor: colors.textSecondary,
  },
}));
