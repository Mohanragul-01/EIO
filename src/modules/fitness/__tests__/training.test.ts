/**
 * Fitness training maths.
 *
 * PR detection is the highest-risk logic here: it is a badge the user will
 * trust, and getting it wrong is silent in both directions. A false positive
 * fires constantly and teaches you to ignore it; a false negative means the
 * moment you actually wanted to see never appears. BMI matters for a different
 * reason - it is derived rather than stored, so it has to be right on read.
 */
import {
  bestWeightAtReps,
  bmi,
  bmiLabel,
  estimatedOneRepMax,
  formatDuration,
  formatSet,
  isPersonalRecord,
  totalVolume,
  nextSetNumber,
} from '../types';

const set = (exercise_id: string, reps: number, weight_kg: number) => ({
  exercise_id,
  reps,
  weight_kg,
});

describe('bestWeightAtReps', () => {
  const history = [
    set('bench', 5, 80),
    set('bench', 5, 85),
    set('bench', 10, 60),
    set('squat', 5, 120),
  ];

  it('finds the heaviest set at that exact rep count', () => {
    expect(bestWeightAtReps(history, 'bench', 5)).toBe(85);
    expect(bestWeightAtReps(history, 'bench', 10)).toBe(60);
  });

  it('does not mix rep counts', () => {
    // 85kg x 5 must not count as the best at 10 reps. They are different
    // achievements, and comparing them would announce records that beat nothing.
    expect(bestWeightAtReps(history, 'bench', 10)).toBe(60);
  });

  it('does not mix exercises', () => {
    expect(bestWeightAtReps(history, 'squat', 5)).toBe(120);
  });

  it('returns null with no history at that rep count', () => {
    // Null, not 0. Zero would compare as a beatable weight and make every
    // first set a record.
    expect(bestWeightAtReps(history, 'bench', 3)).toBeNull();
    expect(bestWeightAtReps(history, 'deadlift', 5)).toBeNull();
    expect(bestWeightAtReps([], 'bench', 5)).toBeNull();
  });
});

describe('isPersonalRecord', () => {
  const history = [set('bench', 5, 80), set('bench', 5, 85)];

  it('is true only when the previous best is beaten', () => {
    expect(isPersonalRecord(history, set('bench', 5, 90))).toBe(true);
    expect(isPersonalRecord(history, set('bench', 5, 84))).toBe(false);
  });

  it('is false for equalling your best', () => {
    // Repeating your best is not a new record. Strictly greater, or the badge
    // fires every time you hit the same working weight.
    expect(isPersonalRecord(history, set('bench', 5, 85))).toBe(false);
  });

  it('is FALSE for the very first set at a rep count', () => {
    // The important one. With no history, treating it as a record would make
    // every set on day one a PR, which trains you to ignore the badge.
    expect(isPersonalRecord([], set('bench', 5, 60))).toBe(false);
    expect(isPersonalRecord(history, set('bench', 3, 100))).toBe(false);
  });

  it('is judged per exercise', () => {
    // A heavy squat must not count as a bench record.
    expect(isPersonalRecord(history, set('squat', 5, 200))).toBe(false);
  });
});

describe('bmi', () => {
  it('is weight over height in metres squared', () => {
    // 70kg at 175cm is a well-known 22.86.
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
  });

  it('returns null when height is unknown', () => {
    // Null rather than a guess: an invented height would produce a number that
    // looks exactly as authoritative as a real one.
    expect(bmi(70, null)).toBeNull();
    expect(bmi(70, 0)).toBeNull();
  });

  it('returns null for a nonsense weight', () => {
    expect(bmi(0, 175)).toBeNull();
    expect(bmi(-5, 175)).toBeNull();
  });

  it('labels the standard bands at their boundaries', () => {
    expect(bmiLabel(18.4)).toBe('Underweight');
    expect(bmiLabel(18.5)).toBe('Healthy');
    expect(bmiLabel(24.9)).toBe('Healthy');
    expect(bmiLabel(25)).toBe('Overweight');
    expect(bmiLabel(30)).toBe('Obese');
  });
});

describe('totalVolume', () => {
  it('sums reps times weight', () => {
    expect(totalVolume([{ reps: 10, weight_kg: 60 }, { reps: 8, weight_kg: 70 }])).toBe(1160);
  });

  it('is zero for no sets, not NaN', () => {
    expect(totalVolume([])).toBe(0);
  });

  it('rounds away floating point noise', () => {
    // 0.1-style drift is far below a kilogram and volume is a trend figure, not
    // one anyone reconciles - unlike money, where this would be unacceptable.
    expect(totalVolume([{ reps: 3, weight_kg: 20.1 }])).toBe(60.3);
  });
});

describe('estimatedOneRepMax', () => {
  it('returns the weight itself for a single', () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
  });

  it('scales with reps, by Epley', () => {
    // 100kg x 5 => 100 * (1 + 5/30) = 116.7
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.7, 1);
  });

  it('ranks a lighter high-rep set above a heavier low-rep one where it should', () => {
    // This is why the progression chart ranks by 1RM rather than raw weight:
    // otherwise dropping the reps would always look like progress.
    expect(estimatedOneRepMax(90, 8)).toBeGreaterThan(estimatedOneRepMax(100, 3));
  });

  it('is zero for nonsense input rather than NaN or Infinity', () => {
    expect(estimatedOneRepMax(0, 5)).toBe(0);
    expect(estimatedOneRepMax(100, 0)).toBe(0);
  });
});

describe('formatting', () => {
  it('drops the decimal on whole weights', () => {
    expect(formatSet(60, 8)).toBe('60 kg x 8');
    expect(formatSet(62.5, 8)).toBe('62.5 kg x 8');
  });

  it('formats the rest timer as minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1:30');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('never shows a negative countdown', () => {
    // The timer recomputes from a deadline, so an overshoot is possible between
    // ticks. It must clamp rather than render "-0:03".
    expect(formatDuration(-10)).toBe('0:00');
  });
});

describe('nextSetNumber', () => {
  const s = (set_number: number) => ({ set_number });

  it('starts at 1 for the first set of an exercise', () => {
    expect(nextSetNumber([])).toBe(1);
  });

  it('counts up while nothing has been deleted', () => {
    expect(nextSetNumber([s(1), s(2)])).toBe(3);
  });

  it('does not reuse a number after a middle set is deleted', () => {
    // THE BUG THIS FIXES. Using the COUNT, this returns 3 - and a set numbered
    // 3 is still there. Nothing in the schema forbids the duplicate, so it
    // saves, and the block shows two rows claiming to be the same set in
    // whatever order Postgres hands them back.
    expect(nextSetNumber([s(1), s(3)])).toBe(4);
  });

  it('does not reuse a number after the last set is deleted', () => {
    // Deleting set 3 of 3 and logging again gives 3 by count, which is right
    // by luck. Deleting 2 and 3 then logging gives 2 by count, which is not.
    expect(nextSetNumber([s(1), s(2)].slice(0, 1))).toBe(2);
  });

  it('is unaffected by the order it receives them in', () => {
    expect(nextSetNumber([s(3), s(1), s(2)])).toBe(4);
  });
});
