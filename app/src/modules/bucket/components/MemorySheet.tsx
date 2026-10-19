/**
 * MemorySheet - the "Add memory" that follows a tick.
 *
 * Opened from the bar under a fresh tick, so it starts on "Today" - unless
 * the item already carries a date, in which case it starts there. Saving
 * closes the sheet before anything else happens: the screen may want to say
 * something, and a toast drawn under an open sheet is never seen.
 */
import React, { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Sheet } from '../../../core/components';
import type { BucketItem } from '../types';
import { whenFromDone } from '../when';
import { MemoryFields, type MemoryDraft } from './MemoryFields';

type MemorySheetProps = {
  item: BucketItem | null;
  today: string;
  onClose: () => void;
  onSave: (item: BucketItem, draft: MemoryDraft) => void;
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
  const [draft, setDraft] = useState<MemoryDraft | null>(null);

  // Seeded during render when a different item opens, not in an effect: an
  // effect would paint the previous item's memory for a frame on the way in.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const identity = item?.id ?? null;
  if (seededFor !== identity) {
    setSeededFor(identity);
    setDraft(item ? draftOf(item, today) : null);
  }

  return (
    <Sheet
      visible={item !== null}
      title="Add a memory"
      subtitle={item?.title}
      onClose={onClose}
      footer={
        <Button
          label="Save"
          icon="checkmark"
          onPress={() => {
            if (item && draft) onSave(item, draft);
          }}
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {draft && item ? (
          <MemoryFields key={item.id} draft={draft} onChange={setDraft} today={today} />
        ) : null}
      </ScrollView>
    </Sheet>
  );
}
