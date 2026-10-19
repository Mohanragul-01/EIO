/**
 * containers.ts - one product, bought again and again.
 *
 * A `products` row is one CONTAINER: one tub, one bottle, with its own size,
 * price and dates. The same name can hold many of them - finished ones (the
 * history), at most one open, and spares waiting to be opened - which is what
 * lets the second tub of whey be added at all.
 *
 * The payoff is the estimate. A new tub has no measured rate for its first
 * days, and "not enough data" is the weakest moment of a measured projection.
 * The last tub's real lifespan fills that gap: "~42 days (last one lasted
 * 42)". It is shown as an estimate, muted, and gives way to the measured
 * figure as soon as one exists - see priorEstimate.
 *
 * Pure: no React Native, no database, so the website runs it unchanged.
 */
import {
  addDays,
  daysBetween,
  formatDaysLeft,
  formatQuantity,
  type Product,
  type ProductInput,
} from './types';

export type Lifecycle = 'unopened' | 'in_use' | 'finished';

export const LIFECYCLE_LABEL: Record<Lifecycle, string> = {
  unopened: 'Unopened',
  in_use: 'In use',
  finished: 'Finished',
};

/**
 * Where a container is in its life, read straight from its dates.
 *
 * Derived, not stored, so a container only ever moves by an action - opening
 * it, finishing it - and can never be filed somewhere its dates contradict.
 */
export function lifecycleOf(product: Pick<Product, 'opened_on' | 'finished_on'>): Lifecycle {
  if (product.finished_on) return 'finished';
  if (!product.opened_on) return 'unopened';
  return 'in_use';
}

/**
 * How long a finished container lasted, counting the opening and the
 * finishing day - the same way `daysOpen` counts, so a tub opened and
 * finished on one day lasted one day. Null until it is finished.
 */
export function lifespanDays(product: Pick<Product, 'opened_on' | 'finished_on'>): number | null {
  if (!product.opened_on || !product.finished_on) return null;
  return Math.max(1, daysBetween(product.opened_on, product.finished_on) + 1);
}

/**
 * What makes two containers the same product. Case and stray spaces are
 * typing, not a different product: "whey  protein" is "Whey Protein".
 */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function newestFinishedFirst(a: Product, b: Product): number {
  return (
    (b.finished_on ?? '').localeCompare(a.finished_on ?? '') ||
    b.created_at.localeCompare(a.created_at)
  );
}

/**
 * The container this one replaced.
 *
 * The link when there is one. Otherwise the most recently finished container
 * of the same name, because v2 data has no links and a product re-added
 * under its own name is the same product. It must have finished by the day
 * this one opened: two tubs open at once are not a sequence, and borrowing
 * the lifespan of one that overlapped would measure the wrong thing.
 */
export function previousContainer(product: Product, all: Product[]): Product | null {
  if (product.previous_id) {
    return all.find((other) => other.id === product.previous_id) ?? null;
  }

  const key = nameKey(product.name);
  const candidates = all
    .filter(
      (other) =>
        other.id !== product.id &&
        !!other.finished_on &&
        !!other.opened_on &&
        nameKey(other.name) === key &&
        (!product.opened_on || other.finished_on <= product.opened_on),
    )
    .sort(newestFinishedFirst);

  return candidates[0] ?? null;
}

export type Estimate = {
  /** The whole life this container is expected to have. */
  totalDays: number;
  /** What is left of it, from today. Never negative. */
  daysLeft: number;
  emptyOn: string;
  /** How long the previous container actually lasted. */
  lastLasted: number;
  /** The previous container's size, for saying what was scaled. */
  lastTotal: number;
  /** Whether the lifespan was resized to this container. */
  scaled: boolean;
};

/**
 * A first guess for a new container, from how long the previous one lasted.
 *
 * Scaled by size when the units match, because a 2 kg tub after a 1 kg one
 * lasts about twice as long; across different units the sizes say nothing
 * about each other, so the lifespan is used as it is.
 *
 * Only for a container in use: a spare has not started, and a finished one
 * has its real answer. The caller shows it only until the measured projection
 * exists - an estimate is a stand-in for data, never a rival to it.
 */
export function priorEstimate(
  product: Product,
  previous: Product | null,
  today: string,
): Estimate | null {
  if (!product.opened_on || product.finished_on || !previous) return null;

  const lastLasted = lifespanDays(previous);
  if (lastLasted === null) return null;

  const comparable =
    nameKey(previous.unit) === nameKey(product.unit) && previous.total_quantity > 0;
  const totalDays = comparable
    ? Math.max(1, Math.round((lastLasted * product.total_quantity) / previous.total_quantity))
    : lastLasted;

  const elapsed = Math.max(0, daysBetween(product.opened_on, today));
  const daysLeft = Math.max(0, totalDays - elapsed);

  return {
    totalDays,
    daysLeft,
    emptyOn: addDays(today, daysLeft),
    lastLasted,
    lastTotal: previous.total_quantity,
    scaled: totalDays !== lastLasted,
  };
}

/** Days written as approximate: "~42 days", or months once days stop helping. */
export function formatEstimate(days: number): string {
  if (days <= 0) return 'about empty';
  if (days === 1) return '~1 day';
  if (days < 45) return `~${days} days`;
  return formatDaysLeft(days);
}

/** "~42 days (last one lasted 42)" - the number, and where it came from. */
export function estimateLabel(estimate: Estimate, unit: string): string {
  const source = estimate.scaled
    ? `last one: ${estimate.lastLasted} days for ${formatQuantity(estimate.lastTotal, unit)}`
    : `last one lasted ${estimate.lastLasted}`;
  return `${formatEstimate(estimate.daysLeft)} (${source})`;
}

export type ContainerGroup = {
  key: string;
  /** As the most recent container spells it. */
  name: string;
  /** Newest finished first. */
  containers: Product[];
};

/**
 * Finished containers stacked under their product - "Whey ×3" - so a shelf of
 * empties reads as a few products with a history each, not as a long list of
 * identical names. Products ordered by their most recent finish.
 */
export function finishedGroups(products: Product[]): ContainerGroup[] {
  const groups = new Map<string, ContainerGroup>();

  [...products]
    .filter((product) => !!product.finished_on)
    .sort(newestFinishedFirst)
    .forEach((product) => {
      const key = nameKey(product.name);
      const group = groups.get(key);
      if (group) group.containers.push(product);
      else groups.set(key, { key, name: product.name, containers: [product] });
    });

  // Insertion order is already newest-finish-first, because the containers
  // were walked in that order and each group was created by its newest one.
  return [...groups.values()];
}

/** The finished containers of the same product, newest first, without this one. */
export function previousContainers(product: Product, all: Product[]): Product[] {
  const key = nameKey(product.name);
  return all
    .filter((other) => other.id !== product.id && !!other.finished_on && nameKey(other.name) === key)
    .sort(newestFinishedFirst);
}

/**
 * The spare waiting behind an open container: the one bought first, since
 * that is the one to open next. Only an open container has one.
 */
export function spareFor(product: Product, all: Product[]): Product | null {
  if (lifecycleOf(product) !== 'in_use') return null;
  const key = nameKey(product.name);
  return (
    all
      .filter((other) => lifecycleOf(other) === 'unopened' && nameKey(other.name) === key)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null
  );
}

/** The open container a spare would replace, if there is one. */
export function activeSibling(product: Product, all: Product[]): Product | null {
  const key = nameKey(product.name);
  return (
    all.find(
      (other) =>
        other.id !== product.id && lifecycleOf(other) === 'in_use' && nameKey(other.name) === key,
    ) ?? null
  );
}

/**
 * A new container of the same product, pre-filled from the last one.
 *
 * Copied: what is true of the product - name, size, unit, per use, period
 * after opening, how long a reorder takes - and the price, as a starting
 * point to edit, because prices change. Not copied: the printed expiry and
 * the note, which belong to that one tub.
 */
export function restockDraft(from: Product, today: string, asSpare: boolean): ProductInput {
  return {
    name: from.name,
    category: from.category,
    unit: from.unit,
    total_quantity: from.total_quantity,
    per_use: from.per_use,
    price_minor: from.price_minor,
    opened_on: asSpare ? null : today,
    note: '',
    expires_on: null,
    pao_months: from.pao_months,
    reorder_lead_days: from.reorder_lead_days,
    previous_id: from.id,
  };
}
