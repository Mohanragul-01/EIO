/**
 * The hold timer: a 3-2-1 lead-in, then counting up, with a tick every few
 * seconds and a distinct cue at the target. Computed from timestamps like the
 * rest timer, so a dropped frame or a locked screen cannot lose time, and a
 * cue is fired once for every boundary crossed - never twice, never skipped.
 */
import { holdCues, holdPhase } from '../holdTimer';

const T0 = 1_000_000;

describe('holdPhase', () => {
  it('counts 3, 2, 1 during the lead-in', () => {
    expect(holdPhase(T0, T0)).toEqual({ phase: 'leadIn', count: 3 });
    expect(holdPhase(T0 + 999, T0)).toEqual({ phase: 'leadIn', count: 3 });
    expect(holdPhase(T0 + 1000, T0)).toEqual({ phase: 'leadIn', count: 2 });
    expect(holdPhase(T0 + 2500, T0)).toEqual({ phase: 'leadIn', count: 1 });
  });

  it('then holds, timed from the end of the lead-in', () => {
    expect(holdPhase(T0 + 3000, T0)).toEqual({ phase: 'holding', elapsedMs: 0 });
    expect(holdPhase(T0 + 3000 + 12_345, T0)).toEqual({ phase: 'holding', elapsedMs: 12_345 });
  });

  it('can skip the lead-in', () => {
    expect(holdPhase(T0 + 500, T0, 0)).toEqual({ phase: 'holding', elapsedMs: 500 });
  });

  it('is right after a long gap (screen locked mid-hold)', () => {
    expect(holdPhase(T0 + 3000 + 90_000, T0)).toEqual({ phase: 'holding', elapsedMs: 90_000 });
  });
});

describe('holdCues', () => {
  it('ticks on each five-second mark crossed', () => {
    expect(holdCues(4900, 5100, 30)).toEqual([{ atSeconds: 5, kind: 'tick' }]);
    expect(holdCues(5100, 9900, 30)).toEqual([]);
  });

  it('gives the target its own cue instead of a tick', () => {
    expect(holdCues(29_900, 30_100, 30)).toEqual([{ atSeconds: 30, kind: 'target' }]);
  });

  it('fires every boundary crossed in a long gap, once each, in order', () => {
    expect(holdCues(0, 31_000, 30)).toEqual([
      { atSeconds: 5, kind: 'tick' },
      { atSeconds: 10, kind: 'tick' },
      { atSeconds: 15, kind: 'tick' },
      { atSeconds: 20, kind: 'tick' },
      { atSeconds: 25, kind: 'tick' },
      { atSeconds: 30, kind: 'target' },
    ]);
  });

  it('keeps ticking past the target', () => {
    expect(holdCues(34_900, 35_100, 30)).toEqual([{ atSeconds: 35, kind: 'tick' }]);
  });

  it('crossing a boundary exactly counts once, at the later frame', () => {
    expect(holdCues(4000, 5000, 30)).toEqual([{ atSeconds: 5, kind: 'tick' }]);
    expect(holdCues(5000, 6000, 30)).toEqual([]);
  });

  it('nothing on an empty interval, and no tick at zero', () => {
    expect(holdCues(5000, 5000, 30)).toEqual([]);
    expect(holdCues(0, 100, 30)).toEqual([]);
  });

  it('a target that is not a multiple of the tick still gets its cue', () => {
    expect(holdCues(21_000, 23_000, 22)).toEqual([{ atSeconds: 22, kind: 'target' }]);
  });

  it('ticks can be turned off, leaving only the target', () => {
    expect(holdCues(0, 31_000, 30, null)).toEqual([{ atSeconds: 30, kind: 'target' }]);
  });
});
