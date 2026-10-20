/**
 * ModuleBuilderPage - define a module without writing code or a migration.
 *
 * Fields are stored as rows and values as jsonb, so a new module needs no
 * schema change. The one thing that must never move is a field's KEY: it is
 * derived from the label once and frozen - re-deriving it on every save would
 * orphan every value already stored under the old key the moment you renamed
 * a field.
 *
 * The builder's state and every rule about it are the app's builder.ts, so
 * the phone and this page save a module identically: templates fill it for
 * review, settings point at drafts until save turns them into keys, and a
 * setting that points at a removed field, or at one that can no longer do the
 * job, is cleared rather than saved.
 *
 * Reminders are set here and ring on the phone, which rebuilds them from the
 * database the next time EIO opens there: a browser cannot schedule them.
 */
import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import * as api from '@app/modules/custom/api';
import {
  assignKeys,
  blankDraft,
  blankState,
  retypeDraft,
  stateFromModule,
  stateFromTemplate,
  toModuleInput,
  usableDrafts,
  validateBuilder,
  type BuilderErrors,
  type BuilderState,
} from '@app/modules/custom/builder';
import { DEFAULT_MODE_LABEL, defaultModesFor } from '@app/modules/custom/defaults';
import { templatePreview, TEMPLATES, type ModuleTemplate } from '@app/modules/custom/templates';
import { typeChangeImpact, typeChangeMessage, type TypeChangeImpact } from '@app/modules/custom/typeChange';
import {
  aggsForFieldType,
  CHART_BUCKET_LABEL,
  FIELD_TYPES,
  fieldTypeLabel,
  isGroupableType,
  isNumericType,
  isSortableFieldType,
  MODULE_COLOR_NAMES,
  MODULE_COLORS,
  needsOptions,
  SUMMARY_AGG_LABEL,
  SUMMARY_PERIOD_LABEL,
  WEEKDAY_LONG,
  type ChartBucket,
  type CustomField,
  type CustomRecord,
  type FieldDraft,
  type FieldType,
  type SummaryPeriod,
} from '@app/modules/custom/types';

import { Icon } from '../components/Icon';
import { Shell } from '../components/Shell';
import { useToast } from '../components/Toast';
import { ErrorBanner, Modal, Spinner, TextField, useConfirm } from '../components/ui';
import { useAsync } from '../lib/useAsync';
import { FieldInput } from '../modules/custom/FieldInput';

let draftCounter = 0;
// Local-only, so React can key the list while editing.
const nextLocalId = () => `draft-${(draftCounter += 1)}`;

const PERIODS: SummaryPeriod[] = ['all', 'week', 'month'];
const BUCKETS: ChartBucket[] = ['entry', 'day', 'week', 'month'];
const WINDOWS: (number | null)[] = [null, 3, 7];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const OFFSETS = [
  { days: 0, label: 'On the day' },
  { days: 1, label: '1 day before' },
  { days: 2, label: '2 days before' },
  { days: 7, label: '1 week before' },
];

type PendingType = { localId: string; label: string; type: FieldType; impact: TypeChangeImpact };

/** A row of single-choice chips. */
function Choices<T>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; key: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={`chip${option.value === value ? ' selected' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ModuleBuilderPage() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isEditing = Boolean(moduleId);
  const { confirm, dialog } = useConfirm();

  const [state, setState] = useState<BuilderState>(() => blankState(nextLocalId));
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [existing, setExisting] = useState<CustomField[]>([]);
  const [records, setRecords] = useState<CustomRecord[]>([]);
  const [pendingType, setPendingType] = useState<PendingType | null>(null);
  const [errors, setErrors] = useState<BuilderErrors | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!moduleId) return null;

    const [module, fields, rows] = await Promise.all([
      api.getModule(moduleId),
      api.listFields(moduleId),
      // For the type-change guard and the delete warning's count.
      api.listRecords(moduleId),
    ]);

    setState(stateFromModule(module, fields, nextLocalId));
    setExisting(fields);
    setRecords(rows);
    return module;
  }, [moduleId]);

  const { loading } = useAsync(load, `builder-${moduleId ?? 'new'}`);

  const update = (patch: Partial<BuilderState>) => {
    setState((current) => ({ ...current, ...patch }));
    setErrors(null);
  };

  const updateDraft = (localId: string, patch: Partial<FieldDraft>) => {
    setState((current) => ({
      ...current,
      drafts: current.drafts.map((draft) => (draft.localId === localId ? { ...draft, ...patch } : draft)),
    }));
    setErrors(null);
  };

  const applyRetype = (localId: string, type: FieldType) =>
    setState((current) => ({
      ...current,
      drafts: current.drafts.map((d) => (d.localId === localId ? retypeDraft(d, type) : d)),
    }));

  /** A saved field with values asks first; anything else changes at once. */
  const retype = (draft: FieldDraft, type: FieldType) => {
    const saved = existing.find((field) => field.id === draft.id);
    if (saved) {
      const impact = typeChangeImpact(records, { key: saved.key, type: draft.type }, { type });
      if (impact.withValue > 0) {
        setPendingType({ localId: draft.localId, label: draft.label.trim(), type, impact });
        return;
      }
    }
    applyRetype(draft.localId, type);
  };

  /** Removing is a draft change until Save, so it is undone rather than confirmed. */
  const removeField = (draft: FieldDraft) => {
    const index = state.drafts.findIndex((d) => d.localId === draft.localId);
    setState((current) => ({ ...current, drafts: current.drafts.filter((d) => d.localId !== draft.localId) }));
    if (!draft.id && !draft.label.trim()) return;
    const name = draft.label.trim() || 'Field';
    toast.show({
      message: draft.id ? `${name} removed. Its values stay in your entries.` : `${name} removed`,
      actionLabel: 'Undo',
      onAction: () =>
        setState((current) => {
          if (current.drafts.some((d) => d.localId === draft.localId)) return current;
          const drafts = [...current.drafts];
          drafts.splice(Math.min(index, drafts.length), 0, draft);
          return { ...current, drafts };
        }),
    });
  };

  const pickTemplate = (template: ModuleTemplate | null) => {
    setState(template ? stateFromTemplate(template, nextLocalId) : blankState(nextLocalId));
    setTemplateId(template?.id ?? 'blank');
    setErrors(null);
  };

  const save = async () => {
    const problem = validateBuilder(state);
    if (problem) {
      setErrors(problem);
      return;
    }

    setSaving(true);
    setError(null);
    const keyed = assignKeys(usableDrafts(state.drafts), existing.map((f) => f.key));
    const input = toModuleInput(state, keyed);

    try {
      if (moduleId) {
        // Fields first, so a setting pointing at a new field finds it there.
        await api.saveFields(moduleId, keyed, existing);
        await api.updateModule(moduleId, input);
        navigate(`/m/${moduleId}`);
      } else {
        const created = await api.createModule(input, keyed);
        navigate(`/m/${created.id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that module');
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!moduleId) return;
    const count = records.length;
    const ok = await confirm(
      'Delete module',
      `The module, its fields and ${
        count === 0 ? 'its entries (it has none)' : `all ${count} of its ${count === 1 ? 'entry' : 'entries'}`
      } are removed. This cannot be undone.`,
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

  const named = state.drafts.filter((d) => d.label.trim());
  const labelOf = (d: FieldDraft) => d.label.trim();
  const numeric = named.filter((d) => isNumericType(d.type));
  const dates = named.filter((d) => d.type === 'date');
  const chosenTemplate = TEMPLATES.find((t) => t.id === templateId);

  /** "Automatic, field, field..." for a role or a setting. */
  const fieldChoices = (
    label: string,
    current: string | null,
    candidates: FieldDraft[],
    onPick: (ref: string | null) => void,
    noneLabel: string,
  ) => (
    <Choices
      label={label}
      value={current}
      onChange={onPick}
      options={[
        { key: 'none', value: null, label: noneLabel },
        ...candidates.map((d) => ({ key: d.localId, value: d.localId as string | null, label: labelOf(d) })),
      ]}
    />
  );

  return (
    <Shell
      title={isEditing ? 'Edit module' : 'New module'}
      subtitle="Define what you want to track. No code, no migration."
      actions={
        <div className="row">
          {isEditing ? (
            <button className="btn btn-secondary btn-sm" onClick={() => void destroy()}>
              Delete
            </button>
          ) : null}
          <button className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : isEditing ? 'Save' : 'Create module'}
          </button>
        </div>
      }
    >
      <ErrorBanner message={error ?? errors?.fields ?? errors?.reminders ?? null} />

      {!isEditing ? (
        <div className="card card-pad rise" style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="overline">Start from</div>
          <p className="faint" style={{ fontSize: 12.5, margin: 'var(--space-xs) 0 var(--space-md)' }}>
            {chosenTemplate
              ? `Filled in from ${chosenTemplate.name}. Change anything; nothing is saved until you press Create module.`
              : 'A template fills in the fields for you to review. Nothing is created until you press Create module.'}
          </p>
          <div className="cm-templates" role="radiogroup" aria-label="Templates">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                role="radio"
                aria-checked={templateId === template.id}
                className={`cm-template${templateId === template.id ? ' selected' : ''}`}
                onClick={() => pickTemplate(template)}
              >
                <span className="row" style={{ gap: 'var(--space-sm)' }}>
                  <span className="dot" style={{ background: template.color, width: 8, height: 8 }} />
                  <span style={{ fontWeight: 600 }}>{template.name}</span>
                  {templateId === template.id ? <Icon name="check" size={13} /> : null}
                </span>
                <span className="faint cm-template-preview">{templatePreview(template)}</span>
              </button>
            ))}
            <button
              type="button"
              role="radio"
              aria-checked={templateId === 'blank'}
              className={`cm-template${templateId === 'blank' ? ' selected' : ''}`}
              onClick={() => pickTemplate(null)}
            >
              <span className="row" style={{ gap: 'var(--space-sm)' }}>
                <Icon name="plus" size={13} />
                <span style={{ fontWeight: 600 }}>Blank</span>
              </span>
              <span className="faint cm-template-preview">Start with one empty field</span>
            </button>
          </div>
        </div>
      ) : null}

      <div className="split">
        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          <div className="card card-pad rise">
            <TextField
              label="Module name"
              value={state.name}
              error={errors?.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Books, Sleep, Plants…"
              autoFocus={isEditing}
            />

            <div className="field" style={{ marginTop: 'var(--space-lg)' }}>
              <span className="label">Colour</span>
              <div className="chip-row" role="radiogroup" aria-label="Colour">
                {MODULE_COLORS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    onClick={() => update({ color: option })}
                    aria-label={MODULE_COLOR_NAMES[option] ?? option}
                    aria-checked={state.color === option}
                    className={`cm-swatch${state.color === option ? ' selected' : ''}`}
                    style={{ background: option }}
                  >
                    {/* A tick as well as the ring: never an outline alone. */}
                    {state.color === option ? <Icon name="check" size={14} strokeWidth={2.5} /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card card-pad rise">
            <div className="row-between" style={{ marginBottom: 'var(--space-lg)' }}>
              <span className="overline">Fields</span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setState((current) => ({ ...current, drafts: [...current.drafts, blankDraft(nextLocalId())] }))
                }
              >
                <Icon name="plus" /> Add field
              </button>
            </div>

            <div className="col" style={{ gap: 'var(--space-lg)' }}>
              {state.drafts.map((draft, index) => (
                <FieldEditor
                  key={draft.localId}
                  draft={draft}
                  index={index}
                  canRemove={state.drafts.length > 1}
                  onChange={(patch) => updateDraft(draft.localId, patch)}
                  onRetype={(type) => retype(draft, type)}
                  onRemove={() => removeField(draft)}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="col" style={{ gap: 'var(--space-lg)' }}>
          {named.length === 0 ? (
            <div className="card card-pad">
              <div className="overline" style={{ marginBottom: 'var(--space-sm)' }}>
                List, tile, chart and reminders
              </div>
              <p className="faint" style={{ fontSize: 12.5 }}>
                Name a field first; these settings point at your fields.
              </p>
            </div>
          ) : (
            <>
              <div className="card card-pad rise cm-settings">
                <div className="overline">In the list</div>
                <p className="faint cm-note">
                  Automatic uses the first text field, the first date and the first rating. Yes/no
                  fields can always be ticked in place.
                </p>
                <span className="label">Title</span>
                {fieldChoices('Title', state.titleRef, named, (ref) => update({ titleRef: ref }), 'Automatic')}
                <span className="label">Under it</span>
                {fieldChoices('Subtitle', state.subtitleRef, named, (ref) => update({ subtitleRef: ref }), 'Automatic')}
                <span className="label">On the right</span>
                {fieldChoices('Badge', state.badgeRef, named, (ref) => update({ badgeRef: ref }), 'Automatic')}
                <span className="label">Group entries by</span>
                {fieldChoices(
                  'Group by',
                  state.groupRef,
                  named.filter((d) => isGroupableType(d.type)),
                  (ref) => update({ groupRef: ref }),
                  'No groups',
                )}
              </div>

              <div className="card card-pad rise cm-settings">
                <div className="overline">Home tile</div>
                <p className="faint cm-note">What the tile says, and over how long.</p>
                <div className="chip-row" role="radiogroup" aria-label="Tile statistic">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!state.summaryAgg || state.summaryAgg === 'count'}
                    className={`chip${!state.summaryAgg || state.summaryAgg === 'count' ? ' selected' : ''}`}
                    onClick={() => update({ summaryAgg: 'count', summaryRef: null })}
                  >
                    How many
                  </button>
                  {named.flatMap((draft) =>
                    // aggsForFieldType keeps this honest: you cannot total a
                    // date or average a note.
                    aggsForFieldType(draft.type)
                      .filter((agg) => agg !== 'count')
                      .map((agg) => {
                        const on = state.summaryAgg === agg && state.summaryRef === draft.localId;
                        return (
                          <button
                            key={`${draft.localId}-${agg}`}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            className={`chip${on ? ' selected' : ''}`}
                            onClick={() => update({ summaryAgg: agg, summaryRef: draft.localId })}
                          >
                            {SUMMARY_AGG_LABEL[agg]} {labelOf(draft)}
                          </button>
                        );
                      }),
                  )}
                </div>
                <span className="label">Covering</span>
                <Choices
                  label="Period"
                  value={state.summaryPeriod}
                  onChange={(period) => update({ summaryPeriod: period })}
                  options={PERIODS.map((p) => ({ key: p, value: p, label: SUMMARY_PERIOD_LABEL[p] }))}
                />
              </div>

              {numeric.length > 0 ? (
                <div className="card card-pad rise cm-settings">
                  <div className="overline">Trend chart</div>
                  <p className="faint cm-note">A line above the entries, and the sparkline on the tile.</p>
                  <Choices
                    label="Chart"
                    value={state.chartHidden ? 'hidden' : state.chartRef ?? 'auto'}
                    onChange={(choice) =>
                      choice === 'hidden'
                        ? update({ chartHidden: true })
                        : update({ chartHidden: false, chartRef: choice === 'auto' ? null : choice })
                    }
                    options={[
                      { key: 'auto', value: 'auto', label: `Automatic (${labelOf(numeric[0])})` },
                      ...(numeric.length > 1
                        ? numeric.map((d) => ({ key: d.localId, value: d.localId, label: labelOf(d) }))
                        : []),
                      { key: 'hidden', value: 'hidden', label: 'No chart' },
                    ]}
                  />
                  {!state.chartHidden ? (
                    <>
                      <span className="label">Points</span>
                      <Choices
                        label="Points"
                        value={state.chartBucket}
                        onChange={(bucket) => update({ chartBucket: bucket })}
                        options={BUCKETS.map((b) => ({ key: b, value: b, label: CHART_BUCKET_LABEL[b] }))}
                      />
                      {state.chartBucket !== 'entry' ? (
                        <Choices
                          label="Total or average"
                          value={state.chartAgg}
                          onChange={(agg) => update({ chartAgg: agg })}
                          options={[
                            { key: 'sum', value: 'sum' as const, label: 'Total' },
                            { key: 'average', value: 'average' as const, label: 'Average' },
                          ]}
                        />
                      ) : null}
                      <span className="label">Smoothing</span>
                      <Choices
                        label="Smoothing"
                        value={state.chartWindow}
                        onChange={(window) => update({ chartWindow: window })}
                        options={WINDOWS.map((w) => ({
                          key: String(w),
                          value: w,
                          label: w === null ? 'Off' : `${w}-point average`,
                        }))}
                      />
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="card card-pad rise cm-settings">
                <div className="overline">Sort entries by</div>
                {fieldChoices(
                  'Sort by',
                  state.sortRef,
                  named.filter((d) => isSortableFieldType(d.type)),
                  (ref) => update(ref ? { sortRef: ref } : { sortRef: null, sortDirection: 'desc' }),
                  'Newest first',
                )}
                {state.sortRef ? (
                  <Choices
                    label="Direction"
                    value={state.sortDirection}
                    onChange={(direction) => update({ sortDirection: direction })}
                    options={[
                      { key: 'asc', value: 'asc' as const, label: 'Ascending' },
                      { key: 'desc', value: 'desc' as const, label: 'Descending' },
                    ]}
                  />
                ) : null}
              </div>

              <div className="card card-pad rise cm-settings">
                <div className="row" style={{ gap: 'var(--space-sm)' }}>
                  <Icon name="bell" size={14} />
                  <span className="overline">Reminders</span>
                </div>
                <p className="faint cm-note">
                  They ring on your phone, which picks up a change the next time EIO opens there.
                </p>

                <label className="row" style={{ gap: 'var(--space-sm)', cursor: 'pointer' }}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={state.reminderTime !== null}
                    className={`check${state.reminderTime !== null ? ' on' : ''}`}
                    onClick={() =>
                      update(
                        state.reminderTime !== null
                          ? { reminderTime: null }
                          : {
                              reminderTime: '20:00',
                              reminderDays: state.reminderDays.length ? state.reminderDays : EVERY_DAY,
                            },
                      )
                    }
                  >
                    {state.reminderTime !== null ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
                  </button>
                  <span>Remind me to log</span>
                  <span className="faint" style={{ fontSize: 12 }}>
                    · skipped on a day that already has an entry
                  </span>
                </label>

                {state.reminderTime !== null ? (
                  <div className="col" style={{ gap: 'var(--space-md)', marginTop: 'var(--space-md)' }}>
                    <input
                      className="input numeric"
                      type="time"
                      style={{ maxWidth: 140 }}
                      value={state.reminderTime}
                      onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
                      aria-label="Reminder time"
                    />
                    <div className="chip-row" role="group" aria-label="Days">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                        const on = state.reminderDays.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className="chip"
                            aria-pressed={on}
                            aria-label={WEEKDAY_LONG[day]}
                            onClick={() =>
                              update({
                                reminderDays: on
                                  ? state.reminderDays.filter((d) => d !== day)
                                  : [...state.reminderDays, day].sort((a, b) => a - b),
                              })
                            }
                          >
                            {WEEKDAY_LONG[day].slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {dates.length > 0 ? (
                  <>
                    <span className="label">Remind me on a date</span>
                    {fieldChoices(
                      'Date reminder',
                      state.reminderFieldRef,
                      dates,
                      (ref) => update({ reminderFieldRef: ref }),
                      'Off',
                    )}
                    {state.reminderFieldRef ? (
                      <Choices
                        label="When"
                        value={state.reminderOffset}
                        onChange={(offset) => update({ reminderOffset: offset })}
                        options={OFFSETS.map((o) => ({ key: String(o.days), value: o.days, label: o.label }))}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={pendingType !== null}
        title={`Change ${pendingType?.label || 'this field'} to ${pendingType ? fieldTypeLabel(pendingType.type) : ''}?`}
        onClose={() => setPendingType(null)}
        width={460}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPendingType(null)}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                if (pendingType) applyRetype(pendingType.localId, pendingType.type);
                setPendingType(null);
              }}
            >
              Change type
            </button>
          </>
        }
      >
        {pendingType ? (
          <>
            <p>{typeChangeMessage(pendingType.impact, fieldTypeLabel(pendingType.type))}</p>
            <p className="faint" style={{ fontSize: 12.5 }}>
              Switch back any time and they show again.
            </p>
            {pendingType.impact.samples.length > 0 ? (
              <table className="data" style={{ marginTop: 'var(--space-md)' }}>
                <thead>
                  <tr>
                    <th>Now</th>
                    <th>As {fieldTypeLabel(pendingType.type)}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingType.impact.samples.map((sample, index) => (
                    <tr key={index}>
                      <td>{sample.before}</td>
                      <td>{sample.after ?? <span className="faint">won’t show</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </>
        ) : null}
      </Modal>

      {dialog}
    </Shell>
  );
}

/** One field: label, type, choices, hint, default, required. */
function FieldEditor({
  draft,
  index,
  canRemove,
  onChange,
  onRetype,
  onRemove,
}: {
  draft: FieldDraft;
  index: number;
  canRemove: boolean;
  onChange: (patch: Partial<FieldDraft>) => void;
  onRetype: (type: FieldType) => void;
  onRemove: () => void;
}) {
  /**
   * The choices box's own text while it has focus. Re-deriving the box from
   * the parsed list on every keystroke trimmed away the space or comma just
   * typed, so a second choice or a two-word one could not be typed at all.
   * The list still updates as you type, so Save never misses the last edit;
   * the box tidies to "a, b" when you leave it.
   */
  const [choicesText, setChoicesText] = useState<string | null>(null);

  // The fixed default is typed into the same widget the form uses.
  const valueField: CustomField = {
    id: draft.localId,
    module_id: '',
    user_id: '',
    key: 'default',
    label: 'Default value',
    type: draft.type,
    required: false,
    options: draft.options,
    position: 0,
    default_mode: 'none',
    default_value: null,
    hint: '',
    created_at: '',
  };

  return (
    <div className="cm-field-card">
      <div className="row" style={{ gap: 'var(--space-sm)' }}>
        <input
          className="input grow"
          value={draft.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder={`Field ${index + 1}`}
          aria-label={`Field ${index + 1} label`}
          maxLength={40}
        />
        {canRemove ? (
          <button className="icon-btn danger" onClick={onRemove} aria-label={`Remove ${draft.label.trim() || `field ${index + 1}`}`}>
            <Icon name="close" />
          </button>
        ) : null}
      </div>

      <div className="chip-row" role="radiogroup" aria-label="Type" style={{ marginTop: 'var(--space-md)' }}>
        {FIELD_TYPES.map((option) => (
          <button
            key={option.type}
            type="button"
            role="radio"
            aria-checked={draft.type === option.type}
            className={`chip${draft.type === option.type ? ' selected' : ''}`}
            onClick={() => {
              if (option.type !== draft.type) onRetype(option.type);
            }}
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
          value={choicesText ?? draft.options.join(', ')}
          onChange={(e) => {
            setChoicesText(e.target.value);
            onChange({
              options: e.target.value
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean),
            });
          }}
          onBlur={() => setChoicesText(null)}
          placeholder={draft.type === 'multiselect' ? 'Tags, comma separated' : 'Choices, comma separated'}
          aria-label="Choices, comma separated"
        />
      ) : null}

      <input
        className="input"
        style={{ marginTop: 'var(--space-md)' }}
        value={draft.hint}
        onChange={(e) => onChange({ hint: e.target.value })}
        placeholder="Hint under the field (optional)"
        aria-label="Hint"
        maxLength={120}
      />

      <div className="row" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)', flexWrap: 'wrap' }}>
        <span className="faint" style={{ fontSize: 12 }}>
          Fills in with
        </span>
        <Choices
          label="Fills in with"
          value={draft.default_mode}
          onChange={(mode) => onChange({ default_mode: mode })}
          options={defaultModesFor(draft.type).map((mode) => ({
            key: mode,
            value: mode,
            label: DEFAULT_MODE_LABEL[mode],
          }))}
        />
      </div>
      {draft.default_mode === 'fixed' ? (
        <div style={{ marginTop: 'var(--space-md)' }}>
          {/* Keyed by type: number, money and duration keep their own text. */}
          <FieldInput
            key={`${draft.localId}-${draft.type}`}
            field={valueField}
            label="Default value"
            value={draft.default_value}
            onChange={(value) => onChange({ default_value: value })}
          />
        </div>
      ) : null}

      <label className="row" style={{ gap: 'var(--space-sm)', marginTop: 'var(--space-md)', cursor: 'pointer' }}>
        <button
          type="button"
          className={`check${draft.required ? ' on' : ''}`}
          onClick={() => onChange({ required: !draft.required })}
          aria-pressed={draft.required}
          aria-label="Required"
        >
          {draft.required ? <Icon name="check" size={11} strokeWidth={2.5} /> : null}
        </button>
        <span style={{ fontSize: 13 }}>Required</span>
      </label>

      {draft.key ? (
        <div className="faint" style={{ fontSize: 11.5, marginTop: 'var(--space-sm)' }}>
          Stored as <code>{draft.key}</code> — frozen, so renaming the label keeps your data.
        </div>
      ) : null}
    </div>
  );
}
