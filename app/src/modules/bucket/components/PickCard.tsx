/**
 * PickCard - "Pick for me": three things you could do, chosen for you.
 *
 * With hundreds of free things on the list, the hard part is choosing. Three
 * at random turns a wall into a choice, and the same three all day (picks.ts)
 * means the card is something you can come back to rather than a slot
 * machine.
 *
 * Each pick: tap to look at it, hold to put it on Now, "Not now" to hide it
 * from the picks for thirty days. No tick here - a pick is a suggestion, and a
 * tap that ticked it would be an easy mistake on a card you scan.
 *
 * The pool follows the screen's filters, and says so in the header ("3 of
 * 469 · No/low cost") so you know what you are being picked from. With no cost
 * filter set it leans to no/low cost, the things you could do this weekend,
 * shown as a chip you can clear.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { GlassCard } from '../../../core/components';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { COST_LABEL, type BucketItem } from '../types';
import { CategoryIcon } from './CategoryIcon';
import { CostMark } from './CostMark';

type PickCardProps = {
  picks: BucketItem[];
  poolSize: number;
  /** The card's own cost leaning, when the screen has no cost filter. */
  costChip: { label: string; onClear: () => void } | null;
  /** Offered when the leaning leaves nothing to pick but the wider pool has some. */
  onWiden: (() => void) | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onShuffle: () => void;
  onOpen: (item: BucketItem) => void;
  onPin: (item: BucketItem) => void;
  onNotNow: (item: BucketItem) => void;
};

export function PickCard({
  picks,
  poolSize,
  costChip,
  onWiden,
  collapsed,
  onToggleCollapsed,
  onShuffle,
  onOpen,
  onPin,
  onNotNow,
}: PickCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  const summary = `${picks.length} of ${poolSize}${costChip ? ` · ${costChip.label}` : ''}`;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={onToggleCollapsed}
          style={styles.heading}
          accessibilityRole="button"
          accessibilityLabel={`Pick for me, ${summary}`}
          accessibilityState={{ expanded: !collapsed }}
          accessibilityHint={collapsed ? 'Shows the picks' : 'Folds the card away'}
        >
          <Ionicons name="sparkles-outline" size={16} color={colors.accentAmber} />
          <View style={styles.headingText}>
            <Text style={styles.title}>Pick for me</Text>
            <Text style={styles.summary} numberOfLines={1}>
              {summary}
            </Text>
          </View>
          <Ionicons
            name={collapsed ? 'chevron-down' : 'chevron-up'}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
        {!collapsed && poolSize > 0 ? (
          <Pressable
            onPress={onShuffle}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Shuffle the picks"
          >
            <Ionicons name="shuffle-outline" size={20} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>

      {!collapsed ? (
        <View>
          {costChip ? (
            <View style={styles.chipRow}>
              <Pressable
                onPress={costChip.onClear}
                hitSlop={{ top: 6, bottom: 6 }}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={`Pick from any cost, not only ${costChip.label}`}
              >
                <Text style={styles.chipText}>{costChip.label}</Text>
                <Ionicons name="close" size={12} color={colors.primary} />
              </Pressable>
            </View>
          ) : null}

          {picks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {poolSize === 0 && onWiden
                  ? 'Nothing at this cost to pick from here.'
                  : 'Nothing left to pick from with these filters.'}
              </Text>
              {onWiden ? (
                <Pressable
                  onPress={onWiden}
                  style={styles.widen}
                  accessibilityRole="button"
                >
                  <Text style={styles.widenText}>Pick from any cost</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            picks.map((item) => (
              <View key={item.id} style={styles.row}>
                <Pressable
                  onPress={() => onOpen(item)}
                  onLongPress={() => onPin(item)}
                  style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${item.category}, ${COST_LABEL[item.cost]}`}
                  accessibilityHint="Opens it. Hold to put it on Now."
                  accessibilityActions={[{ name: 'longpress', label: 'Put on Now' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'longpress') onPin(item);
                  }}
                >
                  <CategoryIcon category={item.category} size={15} tile />
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <CostMark cost={item.cost} />
                </Pressable>
                <Pressable
                  onPress={() => onNotNow(item)}
                  style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Not now: hide ${item.title} from the picks for 30 days`}
                >
                  <Text style={styles.notNowText}>Not now</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  headingText: { flex: 1 },
  title: { ...typography.title },
  summary: { ...typography.caption, ...typography.numeric, fontSize: 11.5 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },

  chipRow: { flexDirection: 'row', marginBottom: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.glassBorderStrong,
    backgroundColor: colors.glassStrong,
  },
  chipText: { ...typography.caption, fontSize: 11.5, color: colors.primary },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
  },
  rowTitle: { ...typography.body, color: colors.text, flex: 1 },
  notNow: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: { ...typography.caption, color: colors.textSecondary },

  empty: { paddingVertical: spacing.md, gap: spacing.sm },
  emptyText: { ...typography.caption },
  widen: { minHeight: 48, justifyContent: 'center' },
  widenText: { ...typography.title, fontSize: 14, color: colors.primary },
}));
