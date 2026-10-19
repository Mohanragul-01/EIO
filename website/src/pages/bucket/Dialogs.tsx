/**
 * The B-List's three small dialogs on the desktop:
 *   MemoryDialog - "Add memory" after a tick.
 *   SwapDialog   - Now holds five; which one makes way?
 *   MoveDialog   - a passed target, and where it goes next.
 *
 * Each is mounted only while open, so its state seeds once from the item it
 * was opened on.
 */
import { useState } from 'react';

import { formatTarget, moveOptions, type Target } from '@app/modules/bucket/plan';
import { NOW_CAP } from '@app/modules/bucket/shelf';
import type { BucketItem } from '@app/modules/bucket/types';

import { Icon } from '../../components/Icon';
import { Modal } from '../../components/ui';
import { CategoryIcon } from './CategoryIcon';
import { memoryDraftOf } from './ItemDialog';
import { MemoryFields, type MemoryDraft } from './MemoryFields';

export function MemoryDialog({
  item,
  today,
  onClose,
  onSave,
}: {
  item: BucketItem;
  today: string;
  onClose: () => void;
  onSave: (item: BucketItem, draft: MemoryDraft) => void;
}) {
  const [draft, setDraft] = useState<MemoryDraft>(() => memoryDraftOf(item, today));

  return (
    <Modal
      open
      title={`Add a memory · ${item.title}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => onSave(item, draft)}>
            Save
          </button>
        </>
      }
    >
      <MemoryFields draft={draft} onChange={setDraft} today={today} />
    </Modal>
  );
}

export function SwapDialog({
  incoming,
  shelf,
  onSwap,
  onNext,
  onClose,
}: {
  incoming: BucketItem;
  shelf: BucketItem[];
  onSwap: (out: BucketItem, incoming: BucketItem) => void;
  onNext: (incoming: BucketItem) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      title={`Now holds ${NOW_CAP}`}
      onClose={onClose}
      width={460}
      footer={
        <button type="button" className="btn btn-secondary" onClick={() => onNext(incoming)}>
          Put it on Next instead
        </button>
      }
    >
      <p className="secondary">
        Swap one out for “{incoming.title}”. The one you swap out moves to Next.
      </p>
      <div className="col" style={{ gap: 3 }}>
        {shelf.map((item) => (
          <div key={item.id} className="list-row bordered">
            <CategoryIcon category={item.category} size={14} />
            <span className="grow">{item.title}</span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSwap(item, incoming)}
              aria-label={`Swap out ${item.title}`}
            >
              Swap out
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function MoveDialog({
  item,
  today,
  onMove,
  onClose,
}: {
  item: BucketItem;
  today: string;
  onMove: (item: BucketItem, target: Target, label: string) => void;
  onClose: () => void;
}) {
  const was =
    item.target_on && item.target_precision
      ? formatTarget(item.target_on, item.target_precision, today)
      : null;

  return (
    <Modal open title="Move the target" onClose={onClose} width={420}>
      <p className="secondary">
        {item.title}
        {was ? ` · was ${was}` : ''}
      </p>
      <div className="col" style={{ gap: 3 }}>
        {moveOptions(today).map((option) => (
          <button
            key={option.label}
            type="button"
            className="list-row bordered bl-move-option"
            onClick={() => onMove(item, option.target, option.label)}
          >
            <Icon name={option.target.target_on ? 'calendar' : 'clock'} size={14} />
            <span className="grow">
              {option.label}
              {option.target.target_on && option.target.target_precision
                ? ` · ${formatTarget(option.target.target_on, option.target.target_precision, today)}`
                : ' · no date'}
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
