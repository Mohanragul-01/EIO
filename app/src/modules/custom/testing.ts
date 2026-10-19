/**
 * testing.ts - builders for the module's tests. Nothing in the app imports it.
 *
 * Lives beside the code rather than under __tests__, because Jest treats every
 * file in __tests__ as a suite and fails one that has no tests in it. Each
 * builder fills every column, including the v3 ones, so a test names only the
 * values it is about.
 */
import type { CustomField, CustomModule, CustomRecord } from './types';

let counter = 0;

export function makeField(over: Partial<CustomField> = {}): CustomField {
  counter += 1;
  return {
    id: over.key ?? `field-${counter}`,
    module_id: 'm1',
    user_id: 'u1',
    key: 'value',
    label: 'Value',
    type: 'text',
    required: false,
    options: [],
    position: 0,
    default_mode: 'none',
    default_value: null,
    hint: '',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

export function makeModule(over: Partial<CustomModule> = {}): CustomModule {
  return {
    id: 'm1',
    user_id: 'u1',
    name: 'Sleep log',
    icon: 'moon-outline',
    color: '#818CF8',
    position: 0,
    summary_field_key: null,
    summary_agg: null,
    sort_field_key: null,
    sort_direction: 'desc',
    title_field_key: null,
    subtitle_field_key: null,
    badge_field_key: null,
    group_field_key: null,
    chart_field_key: null,
    chart_bucket: 'day',
    chart_agg: 'sum',
    chart_window: null,
    chart_hidden: false,
    summary_period: 'all',
    reminder_time: null,
    reminder_days: [0, 1, 2, 3, 4, 5, 6],
    reminder_field_key: null,
    reminder_offset_days: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

/**
 * A record logged at a LOCAL moment, built from parts so a test reads the same
 * in any timezone (the suite runs in America/New_York, across DST changes).
 */
export function makeRecord(
  data: Record<string, unknown>,
  logged: [number, number, number, number?] = [2026, 1, 1, 12],
  id?: string,
): CustomRecord {
  counter += 1;
  const [year, month, day, hour = 12] = logged;
  const created = new Date(year, month - 1, day, hour).toISOString();
  return {
    id: id ?? `record-${counter}`,
    module_id: 'm1',
    user_id: 'u1',
    data,
    created_at: created,
    updated_at: created,
  };
}
