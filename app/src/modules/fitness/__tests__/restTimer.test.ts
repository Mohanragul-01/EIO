/**
 * The rest timer keeps time from timestamps, never by counting ticks, so a
 * phone that slept or an app that was backgrounded shows the right time the
 * moment it comes back.
 */
import { adjustRest, isFinished, progress, remainingMs, startRest } from '../restTimer';

const T0 = 1_000_000;

describe('rest timer', () => {
  it('counts down from the start', () => {
    const rest = startRest(T0, 90, 'bench');
    expect(remainingMs(rest, T0)).toBe(90_000);
    expect(remainingMs(rest, T0 + 30_000)).toBe(60_000);
  });

  it('is right after a long gap, as if the app had been asleep', () => {
    const rest = startRest(T0, 90, 'bench');
    expect(remainingMs(rest, T0 + 10 * 60_000)).toBe(0);
    expect(isFinished(rest, T0 + 10 * 60_000)).toBe(true);
  });

  it('is finished exactly at its end, not a tick later', () => {
    const rest = startRest(T0, 60, 'bench');
    expect(isFinished(rest, T0 + 59_999)).toBe(false);
    expect(isFinished(rest, T0 + 60_000)).toBe(true);
  });

  it('+15 and −15 move the end', () => {
    const rest = startRest(T0, 60, 'bench');
    expect(remainingMs(adjustRest(rest, T0, 15), T0)).toBe(75_000);
    expect(remainingMs(adjustRest(rest, T0, -15), T0)).toBe(45_000);
  });

  it('−15 past zero finishes it rather than going negative', () => {
    const rest = startRest(T0, 10, 'bench');
    const cut = adjustRest(rest, T0, -15);
    expect(remainingMs(cut, T0)).toBe(0);
    expect(isFinished(cut, T0)).toBe(true);
  });

  it('+15 on a finished timer gives 15 seconds from now', () => {
    const rest = startRest(T0, 60, 'bench');
    const later = T0 + 5 * 60_000;
    expect(remainingMs(adjustRest(rest, later, 15), later)).toBe(15_000);
  });

  it('reports progress from 0 to 1, growing with the total when extended', () => {
    const rest = startRest(T0, 100, 'bench');
    expect(progress(rest, T0)).toBe(0);
    expect(progress(rest, T0 + 50_000)).toBeCloseTo(0.5);
    expect(progress(rest, T0 + 200_000)).toBe(1);
    const extended = adjustRest(rest, T0 + 50_000, 50);
    expect(progress(extended, T0 + 50_000)).toBeCloseTo(50 / 150);
  });

  it('no timer has nothing remaining and is not finished', () => {
    expect(remainingMs(null, T0)).toBe(0);
    expect(isFinished(null, T0)).toBe(false);
  });
});
