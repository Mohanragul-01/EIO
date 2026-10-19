/**
 * Body measurements: one row per day, any sites measured that day. The latest
 * value of a site is the most recent day that measured it, not the most
 * recent row, because you rarely measure everything every time.
 */
import { latestValues, MEASUREMENT_SITES, seriesForSite } from '../measurements';
import type { BodyMeasurement } from '../types';

function row(date: string, values: Partial<BodyMeasurement>): BodyMeasurement {
  const empty = Object.fromEntries(MEASUREMENT_SITES.map((s) => [s.key, null]));
  return {
    id: date,
    user_id: 'u',
    date,
    created_at: '',
    updated_at: '',
    ...(empty as Omit<BodyMeasurement, 'id' | 'user_id' | 'date' | 'created_at' | 'updated_at'>),
    ...values,
  };
}

describe('MEASUREMENT_SITES', () => {
  it('pairs left and right, and ends with body fat in percent', () => {
    const arms = MEASUREMENT_SITES.filter((s) => s.label === 'Arm');
    expect(arms.map((s) => s.side)).toEqual(['left', 'right']);
    expect(MEASUREMENT_SITES[MEASUREMENT_SITES.length - 1]).toMatchObject({
      key: 'body_fat_pct',
      unit: '%',
    });
  });
});

describe('latestValues', () => {
  const rows = [
    row('2026-10-10', { chest: 100, waist: null }),
    row('2026-09-10', { chest: 98, waist: 80 }),
    row('2026-08-10', { waist: 82 }),
  ];

  it('takes each site from the latest day that measured it, with the one before', () => {
    const latest = latestValues(rows);
    expect(latest.chest).toEqual({ value: 100, date: '2026-10-10', previous: 98 });
    expect(latest.waist).toEqual({ value: 80, date: '2026-09-10', previous: 82 });
  });

  it('leaves out sites never measured', () => {
    expect(latestValues(rows).neck).toBeUndefined();
  });

  it('does not depend on the order rows arrive in', () => {
    expect(latestValues([...rows].reverse()).chest?.value).toBe(100);
  });

  it('reads numeric strings from the database as numbers', () => {
    const latest = latestValues([row('2026-10-10', { chest: '101.5' as unknown as number })]);
    expect(latest.chest?.value).toBe(101.5);
  });
});

describe('seriesForSite', () => {
  it('lists a site oldest first, skipping days it was not measured', () => {
    const rows = [
      row('2026-10-10', { waist: 79 }),
      row('2026-09-10', { chest: 98 }),
      row('2026-08-10', { waist: 82 }),
    ];
    expect(seriesForSite(rows, 'waist')).toEqual([
      { date: '2026-08-10', value: 82 },
      { date: '2026-10-10', value: 79 },
    ]);
  });
});
