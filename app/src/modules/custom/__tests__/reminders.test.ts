/**
 * Module reminders, planned as plain data.
 *
 * Two kinds: a nudge at a set time on chosen weekdays, skipped on a day that
 * already has an entry, and a reminder on each date in a chosen date field.
 * Scheduling is the device's job; deciding WHAT to schedule is this, and it
 * is where every rule lives, so it is all tested here with a fixed "now".
 */
import { dateReminderId, modulePrefix, nudgeId, parseReminderTime, planReminders } from '../reminders';
import { makeField, makeModule, makeRecord } from '../testing';

// Monday 19 October 2026, 08:00 local.
const NOW = new Date(2026, 9, 19, 8, 0);

const day = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

describe('parseReminderTime', () => {
  it('reads 24-hour HH:MM and nothing else', () => {
    expect(parseReminderTime('09:30')).toEqual({ hour: 9, minute: 30 });
    expect(parseReminderTime('21:05')).toEqual({ hour: 21, minute: 5 });
    expect(parseReminderTime('24:00')).toBeNull();
    expect(parseReminderTime('9:30')).toBeNull();
    expect(parseReminderTime(null)).toBeNull();
  });
});

describe('ids', () => {
  it('are prefixed with the module key, then the module id', () => {
    expect(nudgeId('m1', '2026-10-19')).toBe('custom-m1-nudge-2026-10-19');
    expect(dateReminderId('m1', 'r1')).toBe('custom-m1-date-r1');
    expect(nudgeId('m1', '2026-10-19').startsWith(modulePrefix('m1'))).toBe(true);
  });
});

describe('nudges', () => {
  const module = makeModule({ id: 'm1', name: 'Sleep', reminder_time: '09:00', reminder_days: [0, 1, 2, 3, 4, 5, 6] });

  it('plans one a day for the next fourteen days, at the chosen time', () => {
    const planned = planReminders(module, [], [], NOW);
    expect(planned).toHaveLength(14);
    expect(day(planned[0].date)).toBe('2026-10-19');
    expect(planned[0].date.getHours()).toBe(9);
    expect(day(planned[13].date)).toBe('2026-11-01');
    expect(planned[0].title).toBe('Sleep');
  });

  it('keeps the local time across the daylight-saving change', () => {
    const planned = planReminders(module, [], [], NOW);
    const after = planned.find((p) => day(p.date) === '2026-11-01');
    expect(after?.date.getHours()).toBe(9);
  });

  it('skips today when today already has an entry', () => {
    const logged = [makeRecord({}, [2026, 10, 19, 7])];
    const planned = planReminders(module, [], logged, NOW);
    expect(planned.map((p) => day(p.date))).not.toContain('2026-10-19');
    expect(planned).toHaveLength(13);
  });

  it('counts an entry dated today in the date field as today having one', () => {
    const night = makeField({ key: 'night', type: 'date' });
    const logged = [makeRecord({ night: '2026-10-19' }, [2026, 10, 18, 22])];
    expect(planReminders(module, [night], logged, NOW).map((p) => day(p.date))).not.toContain('2026-10-19');
  });

  it('skips a time already past today', () => {
    const late = new Date(2026, 9, 19, 10, 0);
    expect(day(planReminders(module, [], [], late)[0].date)).toBe('2026-10-20');
  });

  it('runs only on the chosen weekdays', () => {
    const weekly = { ...module, reminder_days: [1, 4] }; // Monday, Thursday
    const planned = planReminders(weekly, [], [], NOW);
    expect(planned.map((p) => day(p.date))).toEqual([
      '2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29',
    ]);
  });

  it('plans nothing without a time', () => {
    expect(planReminders(makeModule({ reminder_time: null }), [], [], NOW)).toEqual([]);
  });

  it('carries the module id, for a tap to open it one day', () => {
    // A tap opens the module's list (the app-wide router reads route/params).
    expect(planReminders(module, [], [], NOW)[0].data).toEqual({
      moduleId: 'm1',
      route: 'CustomModuleList',
      params: { moduleId: 'm1' },
    });
  });
});

describe('date-field reminders', () => {
  const plant = makeField({ key: 'plant', label: 'Plant', type: 'text', position: 0 });
  const water = makeField({ key: 'water', label: 'Water next on', type: 'date', position: 1 });
  const fields = [plant, water];
  const module = makeModule({ id: 'm1', name: 'Plants', reminder_field_key: 'water' });

  it('reminds on the day, at 09:00 when there is no nudge time', () => {
    const records = [makeRecord({ plant: 'Fern', water: '2026-10-21' }, undefined, 'r1')];
    const [reminder] = planReminders(module, fields, records, NOW);
    expect(reminder.id).toBe('custom-m1-date-r1');
    expect(day(reminder.date)).toBe('2026-10-21');
    expect(reminder.date.getHours()).toBe(9);
    expect(reminder.title).toBe('Fern');
    expect(reminder.body).toBe('Water next on: today');
    // A tap opens the entry the date belongs to.
    expect(reminder.data).toEqual({
      moduleId: 'm1',
      recordId: 'r1',
      route: 'CustomRecordEdit',
      params: { moduleId: 'm1', recordId: 'r1' },
    });
  });

  it('reminds days before, at the nudge time when there is one', () => {
    const early = { ...module, reminder_offset_days: 2, reminder_time: '18:30', reminder_days: [] };
    const records = [makeRecord({ plant: 'Fern', water: '2026-10-25' })];
    const planned = planReminders(early, fields, records, NOW);
    expect(planned).toHaveLength(1);
    expect(day(planned[0].date)).toBe('2026-10-23');
    expect(planned[0].date.getHours()).toBe(18);
    expect(planned[0].body).toBe('Water next on: in 2 days');
  });

  it('skips dates already past, and entries with no date', () => {
    const records = [
      makeRecord({ plant: 'Old', water: '2026-10-01' }),
      makeRecord({ plant: 'None' }),
      makeRecord({ plant: 'Junk', water: 'soon' }),
    ];
    expect(planReminders(module, fields, records, NOW)).toEqual([]);
  });

  it('falls back to the module name for an untitled entry', () => {
    const records = [makeRecord({ water: '2026-10-21' })];
    expect(planReminders(module, fields, records, NOW)[0].title).toBe('Plants');
  });

  it('schedules only the nearest forty', () => {
    const records = Array.from({ length: 60 }, (_, i) =>
      makeRecord({ plant: `P${i}`, water: day(new Date(2026, 9, 20 + i)) }),
    );
    const planned = planReminders(module, fields, records, NOW);
    expect(planned).toHaveLength(40);
    expect(day(planned[0].date)).toBe('2026-10-20');
  });

  it('ignores a reminder field that is no longer a date', () => {
    const asText = makeField({ key: 'water', type: 'text', position: 1 });
    const records = [makeRecord({ water: '2026-10-21' })];
    expect(planReminders(module, [plant, asText], records, NOW)).toEqual([]);
  });
});
