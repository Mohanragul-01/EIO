/**
 * SwapSheet - Now holds five; which one makes way?
 *
 * The cap is the point of the shelf, so adding a sixth never quietly grows
 * it. Instead you choose: swap one out (it moves to Next, not to nowhere), or
 * put the new one on Next instead. Either way it is one tap, and the screen
 * offers Undo once the sheet has closed.
 */
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { NOW_CAP } from '../shelf';
import type { BucketItem } from '../types';
import { CategoryIcon } from './CategoryIcon';

type SwapSheetProps = {
  /** The item asking for a place on Now; null when closed. */
  incoming: BucketItem | null;
  shelf: BucketItem[];
  onSwap: (out: BucketItem, incoming: BucketItem) => void;
  onNext: (incoming: BucketItem) => void;
  onClose: () => void;
};

export function SwapSheet({ incoming, shelf, onSwap, onNext, onClose }: SwapSheetProps) {
  const styles = useStyles();

  return (
    <Sheet
      visible={incoming !== null}
      title={`Now holds ${NOW_CAP}`}
      subtitle={incoming ? `Swap one out for “${incoming.title}”` : undefined}
      onClose={onClose}
      footer={
        incoming ? (
          <Button label="Put it on Next instead" variant="glass" onPress={() => onNext(incoming)} />
        ) : null
      }
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>The one you swap out moves to Next.</Text>
        {shelf.map((item) => (
          <View key={item.id} style={styles.row}>
            <CategoryIcon category={item.category} size={15} tile />
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Pressable
              onPress={() => incoming && onSwap(item, incoming)}
              style={({ pressed }) => [styles.swap, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Swap out ${item.title}`}
            >
              <Text style={styles.swapText}>Swap out</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  hint: { ...typography.caption, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56 },
  title: { ...typography.body, color: colors.text, flex: 1 },
  swap: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glass,
  },
  swapText: { ...typography.caption, color: colors.primary, fontFamily: typography.title.fontFamily },
  pressed: { opacity: 0.6 },
}));
