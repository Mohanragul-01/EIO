/**
 * MemorySheet - the "Add memory" that follows a tick.
 *
 * Opened from the bar under a fresh tick, so it starts on "Today" - unless
 * the item already carries a date, in which case it starts there.
 *
 * SAVE WAITS FOR THE DATABASE, like the item sheet's, and the sheet closes
 * only once the memory is stored. It used to close first and write after,
 * so a save that failed on a weak signal took the paragraph you had just
 * written with it. Now a failure is said here, with every word still in the
 * fields to try again.
 */
import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import { makeStyles } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';
import type { BucketItem } from '../types';
import { whenFromDone } from '../when';
import { MemoryFields, type MemoryDraft } from './MemoryFields';

type MemorySheetProps = {
  item: BucketItem | null;
  today: string;
  onClose: () => void;
  /** Resolves once the memory is stored; rejects with what to say if not. */
  onSave: (item: BucketItem, draft: MemoryDraft) => Promise<void>;
};

export function draftOf(item: BucketItem, today: string): MemoryDraft {
  return {
    when: whenFromDone(item.done_on, item.done_precision, today),
    memory: item.memory,
    place: item.place,
    again: item.again,
  };
}

export function MemorySheet({ item, today, onClose, onSave }: MemorySheetProps) {
  const styles = useStyles();
  const [draft, setDraft] = useState<MemoryDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seeded during render when a different item opens, not in an effect: an
  // effect would paint the previous item's memory for a frame on the way in.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const identity = item?.id ?? null;
  if (seededFor !== identity) {
    setSeededFor(identity);
    setDraft(item ? draftOf(item, today) : null);
    setError(null);
  }

  const save = async () => {
    if (!item || !draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(item, draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      visible={item !== null}
      title="Add a memory"
      subtitle={item?.title}
      onClose={onClose}
      footer={<Button label="Save" icon="checkmark" onPress={() => void save()} loading={saving} />}
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {draft && item ? (
          <MemoryFields key={item.id} draft={draft} onChange={setDraft} today={today} />
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  error: { ...typography.caption, color: colors.danger, marginTop: spacing.lg },
}));
