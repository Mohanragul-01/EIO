/**
 * previous.ts - which of last time's sets a row is compared with.
 *
 * The PREVIOUS column is the most useful number on the logging screen: it is
 * what you are trying to match or beat. Matching by plain position goes wrong
 * the moment the warm-ups differ - add one warm-up today and every working set
 * would be compared with the set before it last time. So warm-ups are matched
 * with warm-ups and working sets with working sets, each by their order.
 */
import type { SetFact } from './load';
import type { SetType } from './types';

const isWarmup = (type: SetType) => type === 'warmup';

/**
 * Last time's set that row `index` corresponds to, or null when last time had
 * fewer sets of that kind. `rowTypes` is every row of the block, in order.
 */
export function matchPrevious(
  previousSets: SetFact[],
  rowTypes: SetType[],
  index: number,
): SetFact | null {
  const type = rowTypes[index];
  if (type === undefined) return null;
  const warm = isWarmup(type);
  const nth = rowTypes.slice(0, index).filter((t) => isWarmup(t) === warm).length;
  return previousSets.filter((s) => isWarmup(s.set_type) === warm)[nth] ?? null;
}
