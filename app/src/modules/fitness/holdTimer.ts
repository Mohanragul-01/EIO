/**
 * holdTimer.ts - the maths behind the hold timer, for planks, L-sits, levers.
 *
 * For a held exercise the timer IS the input: tap the dial, get a 3-2-1, hold,
 * tap again, and the seconds become the set. Like the rest timer it is kept
 * as a start timestamp, never a counter, so a dropped frame or a locked
 * screen cannot cost a second of your hold.
 *
 * Cues are worked out per frame from the interval the clock moved through:
 * every boundary crossed fires exactly once, in order, however long the gap.
 */

export type HoldPhase =
  { phase: 'leadIn'; count: 3 | 2 | 1 } | { phase: 'holding'; elapsedMs: number };

export const LEAD_IN_MS = 3000;

export function holdPhase(
  now: number,
  startedAt: number,
  leadInMs: number = LEAD_IN_MS,
): HoldPhase {
  const since = now - startedAt;
  if (since < leadInMs) {
    const remaining = Math.ceil((leadInMs - since) / 1000);
    return { phase: 'leadIn', count: Math.min(3, Math.max(1, remaining)) as 3 | 2 | 1 };
  }
  return { phase: 'holding', elapsedMs: since - leadInMs };
}

export type HoldCue = { atSeconds: number; kind: 'tick' | 'target' };

/**
 * How each moment of a hold feels, as haptic pulses played in order a beat
 * apart. The lead-in counts and the ticks are light taps and "Go" is one
 * firm pulse; the target is two firm pulses, the "two-tone" cue, so with the
 * voice off it is never mistaken for the start.
 */
export const CUE_PULSES: Record<'count' | 'go' | 'tick' | 'target', ('tap' | 'success')[]> = {
  count: ['tap'],
  go: ['success'],
  tick: ['tap'],
  target: ['success', 'success'],
};

/**
 * The cues crossed as the hold moved from `prevMs` to `nextMs` (exclusive of
 * prev, inclusive of next): a tick every `tickEverySeconds` (null: no ticks)
 * and the target, which replaces a tick that lands on it.
 */
export function holdCues(
  prevMs: number,
  nextMs: number,
  targetSeconds: number | null,
  tickEverySeconds: number | null = 5,
): HoldCue[] {
  if (nextMs <= prevMs) return [];
  const cues: HoldCue[] = [];
  const crossed = (seconds: number) => seconds * 1000 > prevMs && seconds * 1000 <= nextMs;

  if (tickEverySeconds && tickEverySeconds > 0) {
    const first = Math.floor(prevMs / 1000 / tickEverySeconds) + 1;
    for (let n = first; n * tickEverySeconds * 1000 <= nextMs; n++) {
      const at = n * tickEverySeconds;
      if (at > 0 && crossed(at) && at !== targetSeconds) cues.push({ atSeconds: at, kind: 'tick' });
    }
  }
  if (targetSeconds !== null && targetSeconds > 0 && crossed(targetSeconds)) {
    cues.push({ atSeconds: targetSeconds, kind: 'target' });
  }
  return cues.sort((a, b) => a.atSeconds - b.atSeconds);
}
