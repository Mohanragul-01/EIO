/**
 * CustomModulePage - records for one module you built yourself.
 *
 * The module's own field definitions decide what the form contains and what the
 * table shows, so this one page renders every module anyone ever creates. It
 * uses the shared `sortRecords` and `summarise`, which is why sorting a number
 * field works properly here: ordering jsonb in SQL compares as TEXT and puts
 * 100 before 9.
 *
 * The phone shows a list of cards. Here it is a table, because the whole point
 * of a table is comparing rows down a column, and a module with five fields is
 * exactly the shape that benefits.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import * as api from '@app/modules/custom/api';
import { emptyValueFor, formatFieldValue, validateRecord } from '@app/modules/custom/format';
import { sortRecords, summarise } from '@app/modules/custom/summary';
import {
  needsOptions,
  type CustomField,
  type CustomModule,
  type CustomRecord,
} from '@app/modules/custom/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import {
  Empty,
  ErrorBanner,
  Modal,
  Spinner,
  Stat,
  TextArea,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { useHotkeys } from '../lib/useHotkeys';

export function CustomModulePage() {
  const { moduleId = '' } = useParams();
  const [editing, setEditing] = useState<CustomRecord | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
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
    onNew: () => setEditing('new'),
  });

  const load = useCallback(async () => {
    const [module, fields, records] = await Promise.all([
      api.getModule(moduleId),
      api.listFields(moduleId),
      api.listRecords(moduleId),
    ]);
    return { module, fields, records };
  }, [moduleId]);

  const { data, loading, error, reload } = useAsync(load, `module-${moduleId}`);

  const module = data?.module;
  const fields = useMemo(() => data?.fields ?? [], [data]);
  const records = useMemo(() => data?.records ?? [], [data]);

  const sorted = useMemo(() => {
    if (!module) return [];

    const activeKey = clickSort?.key ?? module.sort_field_key;
    const activeDir = clickSort?.dir ?? module.sort_direction;
    const sortField = fields.find((f) => f.key === activeKey) ?? null;

    // Sorted in JavaScript, not SQL. `data->>'key'` compares as text, which
    // puts 100 before 9 for a number field. sortRecords is the app's own
    // function, so a click here orders records exactly as the phone would.
    return sortRecords(
      records,
      { sort_field_key: activeKey, sort_direction: activeDir },
      sortField,
    );
  }, [module, fields, records, clickSort]);

  const toggleSort = (key: string) =>
    setClickSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sorted;
    return sorted.filter((record) =>
      fields.some((field) => {
        const shown = formatFieldValue(field, record.data[field.key]);
        return shown?.toLowerCase().includes(needle);
      }),
    );
  }, [sorted, fields, query]);

  const summary = useMemo(() => {
    if (!module) return null;
    const field = fields.find((f) => f.key === module.summary_field_key) ?? null;
    return summarise(module, field, records);
  }, [module, fields, records]);

  const remove = async (record: CustomRecord) => {
    if (!(await confirm('Delete entry', 'This entry will be removed.'))) return;
    setActionError(null);
    try {
      await api.deleteRecord(record.id);
      await reload();
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

  return (
    <Shell
      title={module.name}
      subtitle={summary?.text}
      actions={
        <div className="row">
          <Link className="btn btn-secondary btn-sm" to={`/builder/${module.id}`}>
            <Icon name="module" size={14} /> Edit module
          </Link>
          <button className="btn" onClick={() => setEditing('new')} disabled={fields.length === 0}>
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
                value={records.length}
                sub={summary && !summary.isFallback ? summary.text : undefined}
                color={module.color}
              />
            </div>
            <input
              ref={searchRef}
              className="input"
              style={{ maxWidth: 280 }}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries    /"
            />
          </div>

          <div className="card rise" style={{ overflow: 'hidden' }}>
            {visible.length === 0 ? (
              <Empty
                title={query ? 'Nothing matches' : 'No entries yet'}
                message={
                  query
                    ? `Nothing found for "${query.trim()}".`
                    : 'Add your first entry and it will appear here.'
                }
                action={
                  query ? undefined : (
                    <button className="btn" onClick={() => setEditing('new')}>
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
                        const numeric = field.type === 'number' || field.type === 'money';
                        const active =
                          (clickSort?.key ?? module.sort_field_key) === field.key;
                        const dir = clickSort?.dir ?? module.sort_direction;
                        return (
                          <th
                            key={field.id}
                            className={`sortable${numeric ? ' num' : ''}`}
                            onClick={() => toggleSort(field.key)}
                            title={`Sort by ${field.label}`}
                            aria-sort={
                              active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'
                            }
                          >
                            {field.label} {active ? (dir === 'asc' ? 'up' : 'down') : ''}
                          </th>
                        );
                      })}
                      <th style={{ width: 76 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((record) => (
                      <tr key={record.id}>
                        {fields.map((field) => {
                          const shown = formatFieldValue(field, record.data[field.key]);
                          const numeric = field.type === 'number' || field.type === 'money';
                          return (
                            <td key={field.id} className={numeric ? 'num' : undefined}>
                              {shown ?? <span className="faint">—</span>}
                            </td>
                          );
                        })}
                        <td>
                          <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                            <button
                              className="icon-btn"
                              onClick={() => setEditing(record)}
                              aria-label="Edit"
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={() => void remove(record)}
                              aria-label="Delete"
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
          record={editing === 'new' ? null : editing}
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

/* DIALOG ------------------------------------------------------------------- */

function RecordDialog({
  module,
  fields,
  record,
  onClose,
  onSaved,
}: {
  module: CustomModule;
  fields: CustomField[];
  record: CustomRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (record) return { ...record.data };
    // A blank form gets a typed empty per field: false for a toggle, null for
    // everything optional, '' for text. null is "not filled in", which is not
    // the same as "filled in as empty".
    return Object.fromEntries(fields.map((field) => [field.key, emptyValueFor(field.type)]));
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) =>
    setValues((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const found = validateRecord(fields, values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    setError(null);
    try {
      if (record) await api.updateRecord(record.id, values);
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
          onChange={(value) => set(field.key, value)}
        />
      ))}

      <ErrorBanner message={error} />
    </Modal>
  );
}

function FieldInput({
  field,
  value,
  error,
  autoFocus,
  onChange,
}: {
  field: CustomField;
  value: unknown;
  error?: string;
  autoFocus?: boolean;
  onChange: (value: unknown) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  switch (field.type) {
    case 'longtext':
      return (
        <TextArea
          label={label}
          error={error}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          rows={4}
        />
      );

    case 'boolean':
      return (
        <label className="row" style={{ gap: 'var(--space-md)', cursor: 'pointer' }}>
          <button
            type="button"
            className={`check${value === true ? ' on' : ''}`}
            onClick={() => onChange(value !== true)}
            aria-pressed={value === true}
          >
            {value === true ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
          </button>
          <span style={{ fontWeight: 500 }}>{label}</span>
          {error ? <span className="error-text">{error}</span> : null}
        </label>
      );

    case 'select':
      return (
        <label className="field">
          <span className="label">{label}</span>
          <select
            className={`input${error ? ' invalid' : ''}`}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
            autoFocus={autoFocus}
          >
            <option value="">—</option>
            {(needsOptions(field.type) ? field.options : []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {error ? <span className="error-text">{error}</span> : null}
        </label>
      );

    case 'date':
      return (
        <label className="field">
          <span className="label">{label}</span>
          <input
            className={`input${error ? ' invalid' : ''}`}
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value || null)}
            autoFocus={autoFocus}
          />
          {error ? <span className="error-text">{error}</span> : null}
        </label>
      );

    case 'money':
    case 'number': {
      // Money is stored as integer paise, like everywhere else in the app, so
      // the field shows rupees and converts on the way in and out.
      const shown =
        value === null || value === undefined
          ? ''
          : field.type === 'money'
            ? String(Number(value) / 100)
            : String(value);

      return (
        <TextField
          label={label}
          error={error}
          value={shown}
          inputMode="decimal"
          autoFocus={autoFocus}
          hint={field.type === 'money' ? 'In rupees' : undefined}
          onChange={(e) => {
            const text = e.target.value;
            if (text.trim() === '') return onChange(null);
            const parsed = Number(text);
            if (!Number.isFinite(parsed)) return;
            onChange(field.type === 'money' ? Math.round(parsed * 100) : parsed);
          }}
        />
      );
    }

    default:
      return (
        <TextField
          label={label}
          error={error}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
        />
      );
  }
}
