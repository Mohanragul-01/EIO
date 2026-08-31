/**
 * ModuleBuilderPage - define a module without writing code or a migration.
 *
 * Fields are stored as rows and values as jsonb, so a new module needs no
 * schema change. The one thing that must never move is a field's KEY: it is
 * derived from the label once, at creation, and frozen - re-deriving it on
 * every save would orphan every value already stored under the old key the
 * moment you renamed a field.
 *
 * The tile stat and sort order reference field keys for the same reason, which
 * is why both pickers only offer fields that have actually been saved.
 */
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@app/modules/custom/api';
import {
  aggsForFieldType,
  FIELD_TYPES,
  isSortableFieldType,
  MODULE_COLORS,
  needsOptions,
  SUMMARY_AGG_LABEL,
  type CustomField,
  type FieldDraft,
  type SortDirection,
  type SummaryAgg,
} from '@app/modules/custom/types';

import { Shell } from '../components/Shell';
import {
  ErrorBanner,
  Segmented,
  Spinner,
  TextField,
  useConfirm,
} from '../components/ui';
import { useAsync } from '../lib/useAsync';

let draftCounter = 0;
const newDraft = (): FieldDraft => ({
  // Local-only, so React can key the list while editing. The real key is
  // assigned by the database on save.
  localId: `draft-${(draftCounter += 1)}`,
  label: '',
  type: 'text',
  required: false,
  options: [],
});

export function ModuleBuilderPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(moduleId);
  const { confirm, dialog } = useConfirm();

  const [name, setName] = useState('');
  const [color, setColor] = useState(MODULE_COLORS[0]);
  const [drafts, setDrafts] = useState<FieldDraft[]>([newDraft()]);
  const [existing, setExisting] = useState<CustomField[]>([]);

  const [summaryKey, setSummaryKey] = useState<string | null>(null);
  const [summaryAgg, setSummaryAgg] = useState<SummaryAgg | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!moduleId) return null;

    const [module, fields] = await Promise.all([
      api.getModule(moduleId),
      api.listFields(moduleId),
    ]);

    setName(module.name);
    setColor(module.color);
    setSummaryKey(module.summary_field_key);
    setSummaryAgg(module.summary_agg);
    setSortKey(module.sort_field_key);
    setSortDirection(module.sort_direction);
    setExisting(fields);
    setDrafts(
      fields.length > 0
        ? fields.map((field) => ({
            localId: field.id,
            id: field.id,
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            options: field.options ?? [],
          }))
        : [newDraft()],
    );

    return module;
  }, [moduleId]);

  const { loading } = useAsync(load, `builder-${moduleId ?? 'new'}`);

  const update = (localId: string, patch: Partial<FieldDraft>) =>
    setDrafts((current) =>
      current.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft)),
    );

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return setNameError('Give the module a name');

    // A field with no label has no key either, so it is dropped rather than
    // saved as an unnamed column.
    const usable = drafts.filter((draft) => draft.label.trim().length > 0);
    if (usable.length === 0) {
      setError('Add at least one field. A module with no fields can store nothing.');
      return;
    }

    setNameError(null);
    setSaving(true);
    setError(null);

    const input = {
      name: trimmed,
      // The phone picks from an icon set this site does not have; a colour is
      // the part both clients can show identically.
      icon: 'cube-outline',
      color,
      // A count needs no field, so the key is cleared rather than left
      // pointing at something the summary will not read.
      summary_field_key: summaryAgg && summaryAgg !== 'count' ? summaryKey : null,
      summary_agg: summaryAgg,
      sort_field_key: sortKey,
      sort_direction: sortDirection,
    };

    try {
      if (moduleId) {
        await api.updateModule(moduleId, input);
        await api.saveFields(moduleId, usable, existing);
        navigate(`/m/${moduleId}`);
      } else {
        const created = await api.createModule(input, usable);
        navigate(`/m/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that module');
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!moduleId) return;
    const ok = await confirm(
      'Delete module',
      'The module, its fields and every entry in it are removed. This cannot be undone.',
    );
    if (!ok) return;

    try {
      await api.deleteModule(moduleId);
      navigate('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete that module');
    }
  };

  if (loading && isEditing) {
    return (
      <Shell title="Loading">
        <Spinner center />
      </Shell>
    );
  }

  return (
    <Shell
      title={isEditing ? 'Edit module' : 'New module'}
      subtitle="Define what you want to track. No code, no migration."
      actions={
        <div className="row">
          {isEditing ? (
            <button className="btn btn-glass btn-sm" onClick={() => void destroy()}>
              Delete
            </button>
          ) : null}
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : isEditing ? 'Save' : 'Create module'}
          </button>
        </div>
      }
    >
      <ErrorBanner message={error} />

      <div className="split">
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad rise">
            <TextField
              label="Module name"
              value={name}
              error={nameError}
              onChange={(e) => setName(e.target.value)}
              placeholder="Books, Bucket list, Skills…"
              autoFocus
            />

            <div className="field" style={{ marginTop: 'var(--space-lg)' }}>
              <span className="label">Colour</span>
              <div className="chip-row">
                {MODULE_COLORS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setColor(option)}
                    aria-label={`Colour ${option}`}
                    aria-pressed={color === option}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: option,
                      border:
                        color === option
                          ? '2px solid var(--text)'
                          : '2px solid transparent',
                      outline: 'none',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad rise" style={{ animationDelay: '60ms' }}>
            <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="overline">Fields</span>
              <button
                className="btn btn-glass btn-sm"
                onClick={() => setDrafts((current) => [...current, newDraft()])}
              >
                ＋ Add field
              </button>
            </div>

            <div className="col" style={{ gap: 'var(--space-lg)' }}>
              {drafts.map((draft, index) => (
                <div
                  key={draft.localId}
                  style={{
                    padding: 'var(--space-lg)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <div className="row" style={{ gap: 'var(--space-sm)' }}>
                    <input
                      className="input grow"
                      value={draft.label}
                      onChange={(e) => update(draft.localId, { label: e.target.value })}
                      placeholder={`Field ${index + 1}`}
                    />
                    <button
                      className="icon-btn danger"
                      onClick={() =>
                        setDrafts((current) =>
                          current.filter((d) => d.localId !== draft.localId),
                        )
                      }
                      aria-label="Remove field"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="chip-row" style={{ marginTop: 'var(--space-md)' }}>
                    {FIELD_TYPES.map((option) => (
                      <button
                        key={option.type}
                        className={`chip${draft.type === option.type ? ' selected' : ''}`}
                        onClick={() => update(draft.localId, { type: option.type })}
                        title={option.hint}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {needsOptions(draft.type) ? (
                    <input
                      className="input"
                      style={{ marginTop: 'var(--space-md)' }}
                      value={draft.options.join(', ')}
                      onChange={(e) =>
                        update(draft.localId, {
                          options: e.target.value
                            .split(',')
                            .map((o) => o.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Choices, comma separated"
                    />
                  ) : null}

                  <label
                    className="row"
                    style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)', cursor: 'pointer' }}
                  >
                    <button
                      type="button"
                      className={`check${draft.required ? ' on' : ''}`}
                      onClick={() => update(draft.localId, { required: !draft.required })}
                      aria-pressed={draft.required}
                    >
                      {draft.required ? '✓' : ''}
                    </button>
                    <span style={{ fontSize: 13 }}>Required</span>
                  </label>

                  {draft.key ? (
                    <div className="faint" style={{ fontSize: 11.5, marginTop: 'var(--space-sm)' }}>
                      Stored as <code>{draft.key}</code> — frozen, so renaming the label keeps your
                      data.
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* TILE + SORT ---------------------------------------------------- */}
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          {existing.length === 0 ? (
            <div className="card card-pad">
              <div className="overline" style={{ marginBottom: 'var(--space-sm)' }}>
                Tile and sorting
              </div>
              <p className="faint" style={{ fontSize: 12.5 }}>
                Save the module first. Both settings reference a field's stored key, which is
                assigned on save — so there is nothing to point at yet.
              </p>
            </div>
          ) : (
            <>
              <div className="card card-pad rise">
                <div className="overline" style={{ marginBottom: 'var(--space-sm)' }}>
                  Home tile
                </div>
                <p className="faint" style={{ fontSize: 12.5, marginBottom: 'var(--space-md)' }}>
                  What the tile shows instead of a plain count.
                </p>

                <div className="chip-row">
                  <button
                    className={`chip${!summaryAgg || summaryAgg === 'count' ? ' selected' : ''}`}
                    onClick={() => {
                      setSummaryAgg('count');
                      setSummaryKey(null);
                    }}
                  >
                    Count
                  </button>

                  {existing.flatMap((field) =>
                    // aggsForFieldType keeps this honest: you cannot total a
                    // date or average a note, and offering it would produce a
                    // tile showing NaN.
                    aggsForFieldType(field.type)
                      .filter((agg) => agg !== 'count')
                      .map((agg) => (
                        <button
                          key={`${field.key}-${agg}`}
                          className={`chip${
                            summaryAgg === agg && summaryKey === field.key ? ' selected' : ''
                          }`}
                          onClick={() => {
                            setSummaryAgg(agg);
                            setSummaryKey(field.key);
                          }}
                        >
                          {SUMMARY_AGG_LABEL[agg]} {field.label}
                        </button>
                      )),
                  )}
                </div>
              </div>

              <div className="card card-pad rise" style={{ animationDelay: '60ms' }}>
                <div className="overline" style={{ marginBottom: 'var(--space-md)' }}>
                  Sort entries by
                </div>

                <div className="chip-row">
                  <button
                    className={`chip${!sortKey ? ' selected' : ''}`}
                    onClick={() => {
                      setSortKey(null);
                      setSortDirection('desc');
                    }}
                  >
                    Newest first
                  </button>
                  {existing
                    .filter((field) => isSortableFieldType(field.type))
                    .map((field) => (
                      <button
                        key={field.key}
                        className={`chip${sortKey === field.key ? ' selected' : ''}`}
                        onClick={() => setSortKey(field.key)}
                      >
                        {field.label}
                      </button>
                    ))}
                </div>

                {sortKey ? (
                  <div style={{ marginTop: 'var(--space-md)' }}>
                    <Segmented
                      value={sortDirection}
                      onChange={setSortDirection}
                      options={[
                        { value: 'asc', label: 'Ascending' },
                        { value: 'desc', label: 'Descending' },
                      ]}
                    />
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {dialog}
    </Shell>
  );
}
