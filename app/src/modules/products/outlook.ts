/**
 * outlook.ts - everything a product card says, worked out once.
 *
 * The list, the detail screen, the website, both home tiles and the reorder
 * reminders all describe the same containers. Assembled separately, they
 * drifted: v2's website counted "to reorder" as Reorder now plus Running low
 * while the phone counted neither. Here one function turns rows into an
 * Outlook per container, and everything that shows or schedules anything
 * reads it, so a spare that silences a reminder also clears the tile.
 *
 * Pure, so both clients share it.
 */
import { formatEventDate } from '../../core/date';
import {
  lifecycleOf,
  previousContainer,
  priorEstimate,
  spareFor,
  type Estimate,
  type Lifecycle,
} from './containers';
import {
  addDays,
  formatQuantity,
  leadDaysOf,
  project,
  urgencyOf,
  type Product,
  type ProductUse,
  type Projection,
  type Urgency,
} from './types';
import {
  expiryConflict,
  usableLabel,
  usableState,
  usableUntil,
  type ExpiryConflict,
  type UseByState,
} from './useBy';

export type Outlook = {
  product: Product;
  /** This container's uses only. */
  uses: ProductUse[];
  lifecycle: Lifecycle;
  projection: Projection;
  urgency: Urgency;
  /** The previous container's lifespan, until a measured rate exists. */
  estimate: Estimate | null;
  previous: Product | null;
  /** An unopened container of the same product, waiting. */
  spare: Product | null;
  useBy: string | null;
  useByState: UseByState | null;
  conflict: ExpiryConflict | null;
  /** Reorder now, and nothing waiting to replace it. */
  needsReorder: boolean;
  /** Running low, and nothing waiting to replace it. */
  runningLow: boolean;
  /** The day it crosses into Reorder now: empty minus the lead time. */
  reorderOn: string | null;
};

/** One outlook per product, in the order given. */
export function buildOutlooks(products: Product[], uses: ProductUse[], today: string): Outlook[] {
  const byProduct = new Map<string, ProductUse[]>();
  uses.forEach((use) => {
    const list = byProduct.get(use.product_id);
    if (list) list.push(use);
    else byProduct.set(use.product_id, [use]);
  });

  return products.map((product) => {
    const own = byProduct.get(product.id) ?? [];
    const lifecycle = lifecycleOf(product);
    const projection = project(product, own, today);
    const urgency = urgencyOf(product, projection);
    const previous = lifecycle === 'finished' ? null : previousContainer(product, products);
    // A stand-in for data, so only while there is none: the moment a rate is
    // measured, the estimate steps aside rather than competing with it.
    const estimate =
      lifecycle === 'in_use' && projection.dailyRate === null
        ? priorEstimate(product, previous, today)
        : null;
    const spare = spareFor(product, products);
    const useBy = usableUntil(product);
    const waiting = spare !== null;

    return {
      product,
      uses: own,
      lifecycle,
      projection,
      urgency,
      estimate,
      previous,
      spare,
      useBy,
      useByState: usableState(useBy, today),
      // Measured days only: an estimate is not firm enough to warn on.
      conflict: expiryConflict(projection.daysLeft, useBy, today),
      needsReorder: urgency === 'critical' && !waiting,
      runningLow: urgency === 'soon' && !waiting,
      reorderOn: projection.emptyOn ? addDays(projection.emptyOn, -leadDaysOf(product)) : null,
    };
  });
}

export type ChipKind =
  | 'reorder'
  | 'low'
  | 'plenty'
  | 'unknown'
  | 'spare-ready'
  | 'use-by'
  | 'expired'
  | 'finished'
  | 'unopened';

/** A status in words. Each client maps the kind to its colour and icon. */
export type Chip = { kind: ChipKind; label: string };

const URGENCY_CHIP: Record<Urgency, Chip> = {
  critical: { kind: 'reorder', label: 'Reorder now' },
  soon: { kind: 'low', label: 'Running low' },
  ok: { kind: 'plenty', label: 'Plenty left' },
  unknown: { kind: 'unknown', label: 'Not enough data' },
  finished: { kind: 'finished', label: 'Finished' },
  unopened: { kind: 'unopened', label: 'Spare' },
};

/**
 * The chips a card shows, most pressing first.
 *
 * Two kinds of urgency are never merged into one: running out and going off
 * are different problems with different fixes. Whichever comes first leads;
 * an expired product always leads, however much is left in it. A spare
 * waiting behind a container that is running out turns "Reorder now" into
 * "Next one ready", because there is nothing to order.
 */
export function chipsFor(outlook: Outlook, today: string): Chip[] {
  if (outlook.lifecycle === 'finished') return [URGENCY_CHIP.finished];

  const status =
    outlook.spare && (outlook.urgency === 'critical' || outlook.urgency === 'soon')
      ? { kind: 'spare-ready' as const, label: 'Next one ready' }
      : URGENCY_CHIP[outlook.urgency];

  if (!outlook.useBy || !outlook.useByState) return [status];

  const useByChip: Chip = {
    kind: outlook.useByState === 'expired' ? 'expired' : 'use-by',
    label: usableLabel(outlook.useBy, today),
  };

  const emptyOn = outlook.projection.emptyOn;
  const useByFirst =
    outlook.useByState === 'expired' || emptyOn === null || outlook.useBy < emptyOn;

  if (outlook.lifecycle === 'unopened') return [status, useByChip];
  return useByFirst ? [useByChip, status] : [status, useByChip];
}

export type ReorderSummary = {
  /** Reorder now, nothing waiting. What the home tiles show. */
  toReorder: number;
  /** Running low, nothing waiting. */
  runningLow: number;
  inUse: number;
  spares: number;
};

export function reorderSummary(outlooks: Outlook[]): ReorderSummary {
  return outlooks.reduce(
    (summary, outlook) => ({
      toReorder: summary.toReorder + (outlook.needsReorder ? 1 : 0),
      runningLow: summary.runningLow + (outlook.runningLow ? 1 : 0),
      inUse: summary.inUse + (outlook.lifecycle === 'in_use' ? 1 : 0),
      spares: summary.spares + (outlook.lifecycle === 'unopened' ? 1 : 0),
    }),
    { toReorder: 0, runningLow: 0, inUse: 0, spares: 0 },
  );
}

/** What is left, 0 to 1 - the bar shows the supply, filling from the left. */
export function remainingFraction(outlook: Outlook): number {
  const total = outlook.product.total_quantity;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, outlook.projection.remaining / total));
}

/**
 * Where on the bar a lead time of supply is left: the reorder point, drawn as
 * a thin mark so you can watch the fill approach it. Null without a measured
 * rate, because a mark placed by guesswork would look as sure as a real one.
 */
export function reorderMarker(outlook: Outlook): number | null {
  const rate = outlook.projection.dailyRate;
  const total = outlook.product.total_quantity;
  if (rate === null || total <= 0 || outlook.lifecycle !== 'in_use') return null;
  return Math.min(1, (rate * leadDaysOf(outlook.product)) / total);
}

type UseWords = { quantity: number; unit: string; usedOn: string; name?: string };

function sentence(verb: string, { quantity, unit, usedOn, name }: UseWords): string {
  const what = name ? `${formatQuantity(quantity, unit)} of ${name}` : formatQuantity(quantity, unit);
  return `${verb} ${what} · ${formatEventDate(usedOn)}`;
}

/**
 * "Logged 5 g · Yesterday". The day is the point: a use logged for the wrong
 * day looks exactly like a right one in every other respect, and naming it is
 * how a backdated log confirms it landed where you meant.
 */
export function loggedMessage(words: UseWords): string {
  return sentence('Logged', words);
}

export function removedMessage(words: UseWords): string {
  return sentence('Removed', words);
}

export function loggedAllMessage(count: number): string {
  return `Logged ${count} ${count === 1 ? 'product' : 'products'} · Today`;
}

/** What deleting a product takes with it, said before it happens. */
export function deleteSummary(useCount: number): string {
  if (useCount === 0) return 'Nothing has been logged for it yet.';
  return `Deletes ${useCount} logged ${useCount === 1 ? 'use' : 'uses'}.`;
}
