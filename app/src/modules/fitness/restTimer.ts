/**
 * restTimer.ts - rest between sets, kept as an end time.
 *
 * A timer that counts down by decrementing every second drifts, and stops
 * entirely while the app is backgrounded or the phone sleeps between sets -
 * which is exactly what phones do in a gym. Storing WHEN it ends and computing
 * what is left from the clock makes it right the moment the screen comes back.
 */

export type RestState = {
  /** Epoch ms when the rest is over. */
  endsAt: number;
  /** The whole length in ms, for the progress line; grows when extended. */
  totalMs: number;
  /** Whose rest it is, so the bar can say "after Squat". */
  exerciseId: string;
} | null;

export function startRest(now: number, seconds: number, exerciseId: string): RestState {
  const totalMs = Math.max(0, seconds) * 1000;
  return { endsAt: now + totalMs, totalMs, exerciseId };
}

export function remainingMs(state: RestState, now: number): number {
  return state ? Math.max(0, state.endsAt - now) : 0;
}

export function isFinished(state: RestState, now: number): boolean {
  return state !== null && now >= state.endsAt;
}

/**
 * Add or take off seconds. Never below zero (taking off more than is left
 * finishes it); adding to a finished timer starts that much from now.
 */
export function adjustRest(state: RestState, now: number, deltaSeconds: number): RestState {
  if (!state) return state;
  const deltaMs = deltaSeconds * 1000;
  const base = isFinished(state, now) ? now : state.endsAt;
  const endsAt = Math.max(now, base + deltaMs);
  const elapsed = now - (state.endsAt - state.totalMs);
  const totalMs = isFinished(state, now)
    ? Math.max(0, endsAt - now)
    : Math.max(0, elapsed + (endsAt - now));
  return { ...state, endsAt, totalMs };
}

/** 0 at the start, 1 when done. */
export function progress(state: RestState, now: number): number {
  if (!state || state.totalMs === 0) return 1;
  return Math.min(1, Math.max(0, 1 - remainingMs(state, now) / state.totalMs));
}
