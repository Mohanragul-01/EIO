/**
 * CustomModulePage - records for one module you built yourself.
 *
 * The module's own field definitions decide what the form contains and what the
 * table shows, so this one page renders every module anyone ever creates. Every
 * decision on it - the chart's points, the filter chips, the groups and their
 * totals, the defaults a new entry starts with, whether a quick log is
 * possible - is the app's own tested code (`@app/modules/custom/*`), which is
 * why a number field sorts properly here and a group's total matches the
 * phone's.
 *
 * The phone shows a list of cards. Here it is a table, because the whole point
 * of a table is comparing rows down a column, and a module with five fields is
 * exactly the shape that benefits. Yes/no cells tick in place.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { fromISODate, todayISO } from '@app/core/date';
import * as api from '@app/modules/custom/api';
import { canQuickLog, resolveDefaults } from '@app/modules/custom/defaults';
import { dateFieldOf, entryDateOf } from '@app/modules/custom/entryDate';
import {
  filterChipsFor,
  filterRecords,
  groupRecords,
  groupStatLine,
  NO_FILTERS,
  type ActiveFilters,
  type FilterChip,
} from '@app/modules/custom/filters';
import {
  emptyValueFor,
  formatFieldValue,
  isEmptyValue,
  numericValue,
  readableAs,
  validateRecord,
} from '@app/modules/custom/format';
import { rowRoles } from '@app/modules/custom/roles';
import { sortRecords, summarise } from '@app/modules/custom/summary';
import { chartFieldOf } from '@app/modules/custom/trend';
import {
  isGroupableType,
  isNumericType,
  type CustomField,
  type CustomModule,
  type CustomRecord,
} from '@app/modules/custom/types';

import { Icon } from '../components/Icon';
import { MonthCalendar } from '../components/MonthCalendar';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { Empty, ErrorBanner, Modal, Segmented, Spinner, Stat, useConfirm } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';
import { FieldInput } from '../modules/custom/FieldInput';
import { TrendChart } from '../modules/custom/TrendChart';

type Loaded = { module: CustomModule; fields: CustomField[]; records: CustomRecord[] };
type Editing = { record: CustomRecord | null; date?: string };
type View = 'table' | 'calendar';

function chipOn(chip: FilterChip, active: ActiveFilters): boolean {
  if (chip.kind === 'period') return active.period === chip.period;
  const value = active.value;
  return (
    value !== null &&
    value.kind === chip.value.kind &&
    value.fieldKey === chip.value.fieldKey &&
    value.value === chip.value.value
  );
}

export function CustomModulePage() {
  const { moduleId = '' } = useParams();
  const toast = useToast();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActiveFilters>(NO_FILTERS);
  const [view, setView] = useState<View>('table');
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayISO);
  const [logging, setLogging] = useState(false);
  const { confirm, dialog } = useConfirm();

  /**
   * A sort chosen by clicking a column, which overrides the module's saved
   * default for this visit only.
   *
   * Not persisted, deliberately: the saved order is a property of the module
   * you set in the builder, and a click meant to answer one question should
   * not quietly redefine it.
   */
  const [clickSort, setClickSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  useHotkeys({
    onSearch: () => searchRef.current?.focus(),
    onNew: () => setEditing({ record: null }),
  });

  const load = useCallback(async (): Promise<Loaded> => {
    const [module, fields, records] = await Promise.all([
      api.getModule(moduleId),
      api.listFields(moduleId),
      api.listRecords(moduleId),
    ]);
    return { module, fields, records };
  }, [moduleId]);

  const { data, loading, error, reload, set } = useAsync(load, `module-${moduleId}`);

  const module = data?.module;
  const fields = useMemo(() => data?.fields ?? [], [data]);
  const records = useMemo(() => data?.records ?? [], [data]);
  const today = todayISO();

  const dateField = useMemo(() => dateFieldOf(fields), [fields]);
  const chips = useMemo(() => filterChipsFor(fields, dateField), [fields, dateField]);
  const resolved = useMemo(() => resolveDefaults(fields, records, today), [fields, records, today]);
  const quick = canQuickLog(fields, resolved);

  const sorted = useMemo(() => {
    if (!module) return [];
    const activeKey = clickSort?.key ?? module.sort_field_key;
    const activeDir = clickSort?.dir ?? module.sort_direction;
    const sortField = fields.find((f) => f.key === activeKey) ?? null;
    // Sorted in JavaScript, not SQL. `data->>'key'` compares as text, which
    // puts 100 before 9 for a number field. sortRecords is the app's own
    // function, so a click here orders records exactly as the phone would.
    return sortRecords(records, { sort_field_key: activeKey, sort_direction: activeDir }, sortField);
  }, [module, fields, records, clickSort]);

  const visible = useMemo(() => {
    const filtered = filterRecords(sorted, filters, dateField, today);
    const needle = query.trim().toLowerCase();
    if (!needle) return filtered;
    return filtered.filter((record) =>
      fields.some((field) => formatFieldValue(field, record.data[field.key])?.toLowerCase().includes(needle)),
    );
  }, [sorted, filters, dateField, today, query, fields]);

  const byDay = useMemo(() => {
    const map = new Map<string, CustomRecord[]>();
    sorted.forEach((record) => {
      const day = entryDateOf(record, dateField);
      const list = map.get(day);
      if (list) list.push(record);
      else map.set(day, [record]);
    });
    return map;
  }, [sorted, dateField]);

  const summaryField = useMemo(
    () => fields.find((f) => f.key === module?.summary_field_key) ?? null,
    [fields, module],
  );
  const summary = useMemo(
    () => (module ? summarise(module, summaryField, records, { today, dateField }) : null),
    [module, summaryField, records, today, dateField],
  );

  const toggleSort = (key: string) =>
    setClickSort((current) =>
      current?.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' },
    );

  /** Swap one record in the loaded data, leaving every other row alone. */
  const patchRecord = (id: string, change: (record: CustomRecord) => CustomRecord) =>
    set((current) => ({
      ...current,
      records: current.records.map((record) => (record.id === id ? change(record) : record)),
    }));

  /** Tick a yes/no in place. A failure puts back this value on this row only. */
  const setValue = async (record: CustomRecord, key: string, value: unknown) => {
    const previous = record.data[key];
    patchRecord(record.id, (r) => ({ ...r, data: { ...r.data, [key]: value } }));
    setActionError(null);
    try {
      await api.updateRecord(record.id, { ...record.data, [key]: value });
    } catch (e) {
      patchRecord(record.id, (r) => ({ ...r, data: { ...r.data, [key]: previous } }));
      setActionError(e instanceof Error ? e.message : 'Could not save that');
    }
  };

  const toggle = (record: CustomRecord, field: CustomField) => {
    const next = record.data[field.key] !== true;
    const updated = { ...record, data: { ...record.data, [field.key]: next } };
    void setValue(record, field.key, next);
    // As on the phone: an Undo only when the tick hides the row under the
    // current filter. Otherwise the tick is its own undo.
    if (filterRecords([updated], filters, dateField, today).length === 0) {
      toast.show({
        message: `${field.label}: ${next ? 'yes' : 'no'} · hidden by the filter`,
        actionLabel: 'Undo',
        onAction: () => void setValue(updated, field.key, !next),
      });
    }
  };

  const quickLog = async () => {
    if (!module || logging) return;
    setLogging(true);
    setActionError(null);
    const values =
      view === 'calendar' && dateField ? { ...resolved.values, [dateField.key]: selectedDay } : resolved.values;
    try {
      const created = await api.createRecord(module.id, values);
      set((current) => ({ ...current, records: [created, ...current.records] }));
      const roles = rowRoles(module, fields);
      const named = [roles.title, roles.badge]
        .map((field) => (field ? formatFieldValue(field, values[field.key]) : null))
        .find((text) => text);
      toast.show({
        message: named ? `Logged · ${named}` : 'Logged',
        actionLabel: 'Undo',
        onAction: async () => {
          try {
            await api.deleteRecord(created.id);
            set((current) => ({ ...current, records: current.records.filter((r) => r.id !== created.id) }));
          } catch (e) {
            setActionError(e instanceof Error ? e.message : 'Could not undo that');
          }
        },
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not log that');
    } finally {
      setLogging(false);
    }
  };

  const remove = async (record: CustomRecord) => {
    if (!(await confirm('Delete entry', 'This entry will be removed. This cannot be undone.'))) return;
    setActionError(null);
    try {
      await api.deleteRecord(record.id);
      set((current) => ({ ...current, records: current.records.filter((r) => r.id !== record.id) }));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not delete that');
    }
  };

  if (loading && !data) {
    return (
      <Shell title="Loading">
        <Spinner center />
      </Shell>
    );
  }

  if (!module) {
    return (
      <Shell title="Not found">
        <ErrorBanner message={error ?? 'That module no longer exists.'} />
      </Shell>
    );
  }

  const chartField = chartFieldOf(module, fields);
  // No empty chart: a number-like field with no value anywhere draws nothing.
  const showChart =
    !!chartField &&
    records.some((r) => {
      const value = r.data[chartField.key];
      return !isEmptyValue(value) && readableAs(chartField.type, value);
    });

  const groupField = fields.find((f) => f.key === module.group_field_key && isGroupableType(f.type)) ?? null;
  const filtered = filters.value !== null || filters.period !== null || query.trim() !== '';
  const dayRecords = byDay.get(selectedDay) ?? [];
  const tableRows = view === 'calendar' ? dayRecords : visible;
  const groups =
    view === 'table' && groupField
      ? groupRecords(tableRows, groupField).map((group) => ({
          ...group,
          stat: groupStatLine(module, summaryField, group.records),
        }))
      : [{ key: 'all', label: '', records: tableRows, stat: '' }];

  const activeSort = clickSort?.key ?? module.sort_field_key;
  const activeDir = clickSort?.dir ?? module.sort_direction;
  const newEntry = () =>
    setEditing({ record: null, date: view === 'calendar' && dateField ? selectedDay : undefined });

  return (
    <Shell
      title={module.name}
      subtitle={summary?.text}
      actions={
        <div className="row">
          <Link className="btn btn-secondary btn-sm" to={`/builder/${module.id}`}>
            <Icon name="module" size={14} /> Edit module
          </Link>
          {quick ? (
            <button
              className="btn btn-secondary"
              onClick={() => void quickLog()}
              disabled={logging}
              title="Saves an entry with your defaults straight away. Undo is in the corner."
            >
              <Icon name="check" /> Log with defaults
            </button>
          ) : null}
          <button className="btn" onClick={newEntry} disabled={fields.length === 0}>
            <Icon name="plus" /> New entry
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? actionError} />

      {fields.length === 0 ? (
        <div className="card">
          <Empty
            title="This module has no fields yet"
            message="Add at least one field and you can start recording entries."
            action={
              <Link className="btn" to={`/builder/${module.id}`}>
                Add fields
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="row" style={{ gap: 'var(--space-2xl)' }}>
              <Stat
                label="Entries"
                value={filtered ? `${visible.length} of ${records.length}` : records.length}
                sub={summary && !summary.isFallback ? summary.text : undefined}
                color={module.color}
              />
            </div>
            <div className="row">
              {dateField ? (
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'table', label: 'Table' },
                    { value: 'calendar', label: 'Calendar' },
                  ]}
                />
              ) : null}
              {view === 'table' ? (
                <input
                  ref={searchRef}
                  className="input"
                  style={{ maxWidth: 240 }}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search entries    /"
                  aria-label="Search entries"
                />
              ) : null}
            </div>
          </div>

          {view === 'table' && showChart && chartField ? (
            <TrendChart module={module} field={chartField} fields={fields} records={records} />
          ) : null}

          {view === 'table' && chips.length > 0 && records.length > 0 ? (
            <div className="chip-row" style={{ marginBottom: 'var(--space-lg)' }} role="group" aria-label="Filters">
              <button
                type="button"
                className="chip"
                aria-pressed={filters.value === null && filters.period === null}
                onClick={() => setFilters(NO_FILTERS)}
              >
                All
              </button>
              {chips.map((chip) => {
                const on = chipOn(chip, filters);
                return (
                  <button
                    key={chip.id}
                    type="button"
                    className="chip"
                    aria-pressed={on}
                    onClick={() =>
                      setFilters((current) =>
                        chip.kind === 'period'
                          ? { ...current, period: on ? null : chip.period }
                          : { ...current, value: on ? null : chip.value },
                      )
                    }
                  >
                    {on ? <Icon name="check" size={11} /> : null}
                    {chip.label}
                  </button>
                );
              })}
            </div>
          ) : null}

          {view === 'calendar' ? (
            <div className="split" style={{ marginBottom: 'var(--space-lg)' }}>
              <div className="card card-pad rise">
                <MonthCalendar
                  year={month.year}
                  month={month.month}
                  onChangeMonth={(year, m) => setMonth({ year, month: m })}
                  selected={selectedDay}
                  onSelect={setSelectedDay}
                  renderDay={(day) => {
                    const count = byDay.get(day.iso)?.length ?? 0;
                    return (
                      <span
                        className={`cm-day${day.isToday ? ' today' : ''}${day.isSelected ? ' selected' : ''}${
                          day.inMonth ? '' : ' outside'
                        }`}
                      >
                        {Number(day.iso.slice(8))}
                        <span
                          className="cm-day-dot"
                          style={
                            count > 0
                              ? { background: module.color, opacity: count === 1 ? 0.55 : count === 2 ? 0.8 : 1 }
                              : undefined
                          }
                        />
                      </span>
                    );
                  }}
                  dayLabel={(day) => {
                    const n = byDay.get(day.iso)?.length ?? 0;
                    return n === 0 ? null : `${n} ${n === 1 ? 'entry' : 'entries'}`;
                  }}
                />
              </div>
              <div className="card card-pad rise">
                <div className="overline">
                  {fromISODate(selectedDay).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </div>
                <div className="stat-value numeric" style={{ marginTop: 'var(--space-sm)' }}>
                  {dayRecords.length === 0
                    ? 'Nothing logged'
                    : `${dayRecords.length} ${dayRecords.length === 1 ? 'entry' : 'entries'}`}
                </div>
              </div>
            </div>
          ) : null}

          <div className="card rise" style={{ overflow: 'hidden' }}>
            {tableRows.length === 0 ? (
              <Empty
                title={view === 'calendar' ? 'Nothing that day' : filtered ? 'Nothing matches' : 'No entries yet'}
                message={
                  view === 'calendar'
                    ? 'Pick another day, or add an entry for this one.'
                    : filtered
                      ? 'No entry fits these filters.'
                      : 'Add your first entry and it will appear here.'
                }
                action={
                  filtered && view === 'table' ? (
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setFilters(NO_FILTERS);
                        setQuery('');
                      }}
                    >
                      Show all
                    </button>
                  ) : (
                    <button className="btn" onClick={newEntry}>
                      <Icon name="plus" /> Add one
                    </button>
                  )
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      {fields.map((field) => {
                        const numeric = isNumericType(field.type);
                        const active = activeSort === field.key;
                        return (
                          <th
                            key={field.id}
                            className={`sortable${numeric ? ' num' : ''}`}
                            onClick={() => toggleSort(field.key)}
                            title={`Sort by ${field.label}`}
                            aria-sort={active ? (activeDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          >
                            <span className="cm-th">
                              {field.label}
                              {active ? (
                                <Icon name={activeDir === 'asc' ? 'chevronUp' : 'chevronDown'} size={12} />
                              ) : null}
                            </span>
                          </th>
                        );
                      })}
                      <th style={{ width: 76 }} />
                    </tr>
                  </thead>
                  {groups.map((group) => {
                    const open = !collapsed.includes(group.key);
                    return (
                      <tbody key={group.key}>
                        {group.label ? (
                          <tr className="cm-group-row">
                            <td colSpan={fields.length + 1}>
                              <button
                                type="button"
                                className="cm-group-toggle"
                                aria-expanded={open}
                                onClick={() =>
                                  setCollapsed((current) =>
                                    current.includes(group.key)
                                      ? current.filter((key) => key !== group.key)
                                      : [...current, group.key],
                                  )
                                }
                              >
                                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={13} />
                                <span className="grow">{group.label}</span>
                                <span className="numeric secondary">{group.stat}</span>
                              </button>
                            </td>
                          </tr>
                        ) : null}
                        {open
                          ? group.records.map((record) => (
                              <tr key={record.id}>
                                {fields.map((field) => (
                                  <td key={field.id} className={isNumericType(field.type) ? 'num' : undefined}>
                                    <Cell
                                      field={field}
                                      record={record}
                                      color={module.color}
                                      onToggle={() => toggle(record, field)}
                                    />
                                  </td>
                                ))}
                                <td>
                                  <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                                    <button
                                      className="icon-btn"
                                      onClick={() => setEditing({ record })}
                                      aria-label="Edit entry"
                                    >
                                      <Icon name="edit" />
                                    </button>
                                    <button
                                      className="icon-btn danger"
                                      onClick={() => void remove(record)}
                                      aria-label="Delete entry"
                                    >
                                      <Icon name="trash" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          : null}
                      </tbody>
                    );
                  })}
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {editing ? (
        <RecordDialog
          module={module}
          fields={fields}
          records={records}
          record={editing.record}
          date={editing.date}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      ) : null}

      {dialog}
    </Shell>
  );
}

/** One table cell: yes/no ticks in place, stars draw as stars, the rest as text. */
function Cell({
  field,
  record,
  color,
  onToggle,
}: {
  field: CustomField;
  record: CustomRecord;
  color: string;
  onToggle: () => void;
}) {
  const value = record.data[field.key];

  if (field.type === 'boolean') {
    const on = value === true;
    return (
      <button
        type="button"
        className={`check${on ? ' on' : ''}`}
        onClick={onToggle}
        aria-pressed={on}
        aria-label={field.label}
      >
        {on ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
      </button>
    );
  }

  if (field.type === 'rating' && readableAs('rating', value)) {
    const stars = numericValue(value) ?? 0;
    return (
      <span className="cm-stars-read" aria-label={`${stars} of 5 stars`} role="img">
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon
            key={n}
            name={n <= stars ? 'starFilled' : 'star'}
            size={12}
            style={{ color: n <= stars ? color : 'var(--text-faint)' }}
          />
        ))}
      </span>
    );
  }

  if (field.type === 'multiselect' && Array.isArray(value) && value.length > 0) {
    return (
      <span className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
        {value.map((tag) => (
          <span key={String(tag)} className="pill">
            {String(tag)}
          </span>
        ))}
      </span>
    );
  }

  const shown = formatFieldValue(field, value);
  return shown ?? <span className="faint">—</span>;
}

/* DIALOG ------------------------------------------------------------------- */

function RecordDialog({
  module,
  fields,
  records,
  record,
  date,
  onClose,
  onSaved,
}: {
  module: CustomModule;
  fields: CustomField[];
  records: CustomRecord[];
  record: CustomRecord | null;
  /** Pre-fills the date field, for an entry added from a calendar day. */
  date?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  // A new entry starts from the module's defaults - the same values a quick
  // log would save - and remembers which came from the last entry.
  const [initial] = useState(() => {
    if (record) {
      return {
        values: Object.fromEntries(
          fields.map((field) => [field.key, record.data[field.key] ?? emptyValueFor(field.type)]),
        ),
        fromLast: [] as string[],
      };
    }
    const resolved = resolveDefaults(fields, records, todayISO());
    const dateField = dateFieldOf(fields);
    if (date && dateField) resolved.values[dateField.key] = date;
    return {
      values: resolved.values,
      fromLast: resolved.fromLast.filter((key) => !(date && key === dateField?.key)),
    };
  });

  const [values, setValues] = useState<Record<string, unknown>>(initial.values);
  const [fromLast, setFromLast] = useState<string[]>(initial.fromLast);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setField = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFromLast((current) => current.filter((k) => k !== key));
  };

  const save = async () => {
    const found = validateRecord(fields, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      // Merged over the stored data, so a value kept from a deleted field
      // survives an edit rather than being dropped.
      if (record) await api.updateRecord(record.id, { ...record.data, ...values });
      else await api.createRecord(module.id, values);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that entry');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={record ? 'Edit entry' : `New ${module.name.toLowerCase()} entry`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : record ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      {fields.map((field, index) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          autoFocus={index === 0}
          fromLast={fromLast.includes(field.key)}
          onChange={(value) => setField(field.key, value)}
        />
      ))}

      <ErrorBanner message={error} />
    </Modal>
  );
}
