/**
 * NowShelf - the few things you are actually doing, in the page's side rail.
 *
 * Up to five cards: what, when you are aiming for, how far along (steps, or
 * money saved), and the next step. A passed target says so plainly and offers
 * Move to… - never red, never "overdue".
 */
import { formatMoney } from '@app/core/money';
import { formatTarget, isTargetPassed } from '@app/modules/bucket/plan';
import { NOW_CAP, nextStep, shelfProgress } from '@app/modules/bucket/shelf';
import type { BucketItem, BucketStep } from '@app/modules/bucket/types';

import { Icon } from '../../components/Icon';
import { CategoryIcon } from './CategoryIcon';

export function NowShelf({
  shelf,
  stepsFor,
  today,
  onOpen,
  onMove,
}: {
  shelf: BucketItem[];
  stepsFor: (item: BucketItem) => BucketStep[];
  today: string;
  onOpen: (item: BucketItem) => void;
  onMove: (item: BucketItem) => void;
}) {
  return (
    <section className="bl-now" aria-label="Now">
      <div className="row-between bl-now-head">
        <span className="column-title">Now</span>
        <span className="column-count numeric">
          {shelf.length} of {NOW_CAP}
        </span>
      </div>

      {shelf.length === 0 ? (
        <p className="faint bl-small">
          Nothing on Now. Put a pick on it, or set an item to Now, to keep it here.
        </p>
      ) : (
        <div className="col" style={{ gap: 'var(--space-sm)' }}>
          {shelf.map((item) => (
            <NowCard
              key={item.id}
              item={item}
              steps={stepsFor(item)}
              today={today}
              onOpen={onOpen}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function NowCard({
  item,
  steps,
  today,
  onOpen,
  onMove,
}: {
  item: BucketItem;
  steps: BucketStep[];
  today: string;
  onOpen: (item: BucketItem) => void;
  onMove: (item: BucketItem) => void;
}) {
  const progress = shelfProgress(item, steps);
  const upNext = nextStep(steps);
  const target =
    item.target_on && item.target_precision
      ? formatTarget(item.target_on, item.target_precision, today)
      : null;
  const passed = isTargetPassed(item.target_on, item.target_precision, today);
  const progressText = progress
    ? progress.kind === 'steps'
      ? `${progress.done} of ${progress.total} steps`
      : `${formatMoney(progress.done, { compact: true })} of ${formatMoney(progress.total, { compact: true })}`
    : null;

  return (
    <article className="card bl-now-card">
      <button type="button" className="bl-now-body" onClick={() => onOpen(item)}>
        <span className="row bl-now-category">
          <CategoryIcon category={item.category} size={12} />
          <span className="truncate">{item.category}</span>
        </span>
        <span className="bl-now-title">{item.title}</span>
        {target && !passed ? (
          <span className="row bl-now-target">
            <Icon name="calendar" size={12} />
            {target}
          </span>
        ) : null}
        {progress ? (
          <span className="row" style={{ gap: 8 }}>
            <span className="meter grow">
              <i style={{ width: `${progress.percent}%` }} />
            </span>
            <span className="faint numeric bl-small">{progress.percent}%</span>
          </span>
        ) : null}
        {upNext ? (
          <span className="faint bl-small truncate">Next: {upNext.title}</span>
        ) : progressText ? (
          <span className="faint bl-small">{progressText}</span>
        ) : null}
      </button>

      {passed ? (
        <button type="button" className="bl-move" onClick={() => onMove(item)}>
          <Icon name="clock" size={13} />
          Target passed · Move to…
        </button>
      ) : null}
    </article>
  );
}
