/**
 * useFitnessHome: the Log tab's streak and session count cover every session,
 * not just the 60 the history list loads.
 *
 * Someone training four times a week has 60 sessions in about fifteen weeks;
 * counted from the list, the streak could then never pass fifteen weeks and
 * the header said "60 sessions" for ever. api.ts is mocked; its paged read is
 * tested in paging.test.ts.
 *
 * Only Date is faked (Monday 19 Oct 2026): the hook's promises and the
 * testing library's waitFor need real timers.
 */
import { renderHook, waitFor } from '@testing-library/react-native';

import { toISODate } from '../../../core/date';
import type { WorkoutSession } from '../types';
import { useFitnessHome } from '../useFitness';

jest.mock('../api', () => ({
  listSessions: jest.fn(),
  listSessionDays: jest.fn(),
  getProfile: jest.fn(() => Promise.resolve(null)),
  listBodyMetrics: jest.fn(() => Promise.resolve([])),
  listRecentSets: jest.fn(() => Promise.resolve([])),
  listSessionsBetween: jest.fn(),
}));

const api = jest.requireMock('../api') as Record<string, jest.Mock>;

/** A session every Monday, going back `weeks` weeks from 19 Oct 2026. */
function weekly(weeks: number): WorkoutSession[] {
  return Array.from({ length: weeks }, (_, i) => ({
    id: `s${i}`,
    user_id: 'u',
    date: toISODate(new Date(2026, 9, 19 - 7 * i)),
    routine_id: null,
    notes: '',
    mode: 'gym' as const,
    started_at: null,
    ended_at: null,
    bodyweight_kg: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }));
}

beforeEach(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 19, 12, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

it('counts the streak and the sessions over every session, not the loaded 60', async () => {
  const all = weekly(100);
  api.listSessions.mockResolvedValue(all.slice(0, 60));
  api.listSessionDays.mockResolvedValue(all.map(({ id, date, mode }) => ({ id, date, mode })));

  const { result } = await renderHook(() => useFitnessHome());
  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.summary.streak).toBe(100);
  expect(result.current.summary.totalSessions).toBe(100);
  // The list itself is still the recent page.
  expect(result.current.sessions).toHaveLength(60);
});

describe('sessionOn: what tapping a day opens', () => {
  it('finds a session older than the loaded 60, rather than starting a second one', async () => {
    const all = weekly(100);
    api.listSessions.mockResolvedValue(all.slice(0, 60));
    api.listSessionDays.mockResolvedValue([]);
    api.listSessionsBetween.mockImplementation((start: string, end: string) =>
      Promise.resolve(all.filter((s) => s.date >= start && s.date <= end)),
    );
    const old = all[80];

    const { result } = await renderHook(() => useFitnessHome());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.sessionOn(old.date)).resolves.toMatchObject({ id: old.id });
    expect(api.listSessionsBetween).toHaveBeenCalledWith(old.date, old.date);
  });

  it('uses the loaded list when the day is in it, and says null for an empty day', async () => {
    const all = weekly(10);
    api.listSessions.mockResolvedValue(all);
    api.listSessionDays.mockResolvedValue([]);
    api.listSessionsBetween.mockResolvedValue([]);

    const { result } = await renderHook(() => useFitnessHome());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.sessionOn(all[3].date)).resolves.toMatchObject({ id: 's3' });
    expect(api.listSessionsBetween).not.toHaveBeenCalled();
    await expect(result.current.sessionOn('2026-10-18')).resolves.toBeNull();
  });
});
