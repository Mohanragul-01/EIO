/**
 * BodyView - the Body tab: weight, measurements, and the kit that is yours.
 *
 * Weigh-ins and BMI as before (BMI computed, never stored). Measurements are
 * the tape-measure sites from measurements.ts: each site's latest value and
 * its change since the time before - an arrow AND the word, and no judgement
 * (a bigger arm and a smaller waist are both just changes) - with a chart per
 * site. Bands live here too, because a band is a row every client shares;
 * the plate inventory does not, because it describes the plates on the phone's
 * side of the gym (spec: stored on the device).
 */
import { useCallback, useMemo, useState } from 'react';

import { formatEventDate, todayISO } from '@app/core/date';
import * as api from '@app/modules/fitness/api';
import { BAND_COLOURS, parseBandKg } from '@app/modules/fitness/bands';
import {
  latestValues,
  MEASUREMENT_SITES,
  seriesForSite,
  siteName,
  type Site,
  type SiteKey,
} from '@app/modules/fitness/measurements';
import {
  bmi,
  bmiLabel,
  type Band,
  type BodyMeasurement,
  type BodyMetric,
} from '@app/modules/fitness/types';

import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { ErrorBanner, Modal, Spinner, Stat, TextField, useConfirm } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { TrendChart } from './charts';
import { plural, trim } from './format';

const unitOf = (site: Site) => (site.unit === '%' ? '%' : ' cm');

/** The sites a day measured, as the values saveMeasurement takes back. */
function measuredValues(row: BodyMeasurement): Partial<Record<SiteKey, number>> {
  const out: Partial<Record<SiteKey, number>> = {};
  for (const site of MEASUREMENT_SITES) {
    const v = row[site.key];
    if (v !== null && v !== undefined) out[site.key] = Number(v);
  }
  return out;
}

export function BodyView() {
  const toast = useToast();
  const load = useCallback(async () => {
    const [profile, metrics, measurements, bands] = await Promise.all([
      api.getProfile(),
      api.listBodyMetrics(365),
      api.listMeasurements(),
      api.listBands(),
    ]);
    return { profile, metrics, measurements, bands };
  }, []);
  const { data, loading, error, reload, set } = useAsync(load, 'fitness-body');

  if (loading && !data) return <Spinner center />;

  const removeWeight = async (metric: BodyMetric) => {
    set((current) => ({ ...current, metrics: current.metrics.filter((m) => m.id !== metric.id) }));
    try {
      await api.deleteBodyMetric(metric.id);
      toast.show({
        message: `Weigh-in on ${formatEventDate(metric.date)} deleted`,
        actionLabel: 'Undo',
        // A weigh-in is one row per day, so writing the same day and weight back restores it.
        onAction: () =>
          void api
            .recordWeight(metric.date, Number(metric.weight_kg))
            .then(reload)
            .catch(() => toast.show({ message: 'Could not restore that weigh-in' })),
      });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that weigh-in' });
      void reload();
    }
  };

  return (
    <>
      <ErrorBanner message={error} />
      {data ? (
        <div className="col fx-stack">
          <Weight
            metrics={data.metrics}
            heightCm={data.profile.height_cm}
            onSaved={() => void reload()}
            onDelete={(m) => void removeWeight(m)}
          />
          <div className="split">
            <Measurements rows={data.measurements} onChanged={() => void reload()} />
            <div className="col fx-stack">
              <Bands
                bands={data.bands}
                onAdded={(band) =>
                  set((current) => ({ ...current, bands: [...current.bands, band] }))
                }
                onDeleted={(id) =>
                  set((current) => ({
                    ...current,
                    bands: current.bands.filter((b) => b.id !== id),
                  }))
                }
              />
              <section className="card card-pad" aria-labelledby="fx-plates">
                <h3 id="fx-plates" className="overline">
                  Plates
                </h3>
                <p className="secondary fx-small">
                  Your plate inventory and bar weight live on your phone (Fitness, then the plate
                  calculator), because they describe the plates you load, not your account. The
                  website&rsquo;s warm-up sets use a standard set: a 20 kg bar with 25 to 1.25 kg
                  plates.
                </p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

// WEIGHT ----------------------------------------------------------------------------

function Weight({
  metrics,
  heightCm,
  onSaved,
  onDelete,
}: {
  metrics: BodyMetric[];
  heightCm: number | null;
  onSaved: () => void;
  onDelete: (metric: BodyMetric) => void;
}) {
  const latest = metrics[0];
  // Never stored: BMI is fully determined by weight and height.
  const currentBmi = latest ? bmi(Number(latest.weight_kg), heightCm) : null;
  const chart = useMemo(
    () => [...metrics].reverse().map((m) => ({ date: m.date, value: Number(m.weight_kg) })),
    [metrics],
  );
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayISO());
  const [height, setHeight] = useState(heightCm ? String(heightCm) : '');
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const record = async () => {
    const value = Number(weight.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0 || value >= 500)
      return setError('Enter a weight above zero');
    setError(null);
    try {
      await api.recordWeight(date, value);
      setWeight('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that');
    }
  };

  const saveHeight = async () => {
    const value = height.trim() ? Number(height.trim().replace(',', '.')) : null;
    if (value === (heightCm ?? null)) return;
    if (value !== null && (!Number.isFinite(value) || value < 50 || value > 260)) {
      return setError('Height is in centimetres, between 50 and 260');
    }
    setError(null);
    try {
      await api.setHeight(value);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your height');
    }
  };

  const listed = showAll ? metrics : metrics.slice(0, 8);

  return (
    <div className="split">
      <section className="card card-pad" aria-labelledby="fx-weight-title">
        <h3 id="fx-weight-title" className="overline">
          Weight
        </h3>
        {chart.length < 2 ? (
          <p className="muted fx-small fx-chart-empty">
            Record your weight on two different days and the trend appears here.
          </p>
        ) : (
          <TrendChart points={chart} unit="kg" label="Weight" color="var(--accent-emerald)" />
        )}

        {metrics.length > 0 ? (
          <>
            <table className="data fx-compact">
              <caption className="sr-only">Weigh-ins, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Day</th>
                  <th scope="col" className="num">
                    Weight
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {listed.map((m) => (
                  <tr key={m.id}>
                    <td>{formatEventDate(m.date)}</td>
                    <td className="num">{trim(Number(m.weight_kg))} kg</td>
                    <td className="fx-td-actions">
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() => onDelete(m)}
                        aria-label={`Delete the weigh-in on ${formatEventDate(m.date)}`}
                      >
                        <Icon name="trash" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {metrics.length > 8 ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show fewer' : `Show all ${metrics.length}`}
              </button>
            ) : null}
          </>
        ) : null}
      </section>

      <div className="col fx-stack">
        <div className="card card-pad stat-row">
          <Stat
            label="Weight"
            value={latest ? `${trim(Number(latest.weight_kg))} kg` : '—'}
            sub={latest ? formatEventDate(latest.date) : 'Not recorded'}
          />
          <Stat
            label="BMI"
            value={currentBmi ? currentBmi.toFixed(1) : '—'}
            sub={currentBmi ? bmiLabel(currentBmi) : 'Needs your height'}
          />
        </div>

        <section className="card card-pad fx-stack-sm" aria-labelledby="fx-weighin">
          <h3 id="fx-weighin" className="overline">
            Weigh-in
          </h3>
          <div className="fx-field-row">
            <TextField
              label="Weight (kg)"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={latest ? trim(Number(latest.weight_kg)) : 'kg'}
              inputMode="decimal"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void record();
              }}
            />
            <TextField
              label="Day"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </div>
          <div>
            <button type="button" className="btn" onClick={() => void record()}>
              Save
            </button>
          </div>
          <p className="muted fx-small">
            One per day. Saving the same day again replaces it rather than adding a second.
          </p>
        </section>

        <section className="card card-pad">
          <TextField
            label="Height (cm)"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            onBlur={() => void saveHeight()}
            placeholder="175"
            inputMode="decimal"
            hint="Kept once on your profile, not on every weigh-in."
          />
        </section>
        <ErrorBanner message={error} />
      </div>
    </div>
  );
}

// MEASUREMENTS ------------------------------------------------------------------------

function Measurements({ rows, onChanged }: { rows: BodyMeasurement[]; onChanged: () => void }) {
  const toast = useToast();
  const latest = useMemo(() => latestValues(rows), [rows]);
  const measured = MEASUREMENT_SITES.filter((s) => latest[s.key]);
  const [chartFor, setChartFor] = useState<SiteKey | null>(null);
  const [adding, setAdding] = useState(false);
  const site = MEASUREMENT_SITES.find((s) => s.key === (chartFor ?? measured[0]?.key)) ?? null;
  const series = useMemo(() => (site ? seriesForSite(rows, site.key) : []), [rows, site]);

  const removeDay = async (row: BodyMeasurement) => {
    const values = measuredValues(row);
    try {
      await api.deleteMeasurement(row.id);
      onChanged();
      toast.show({
        message: `Measurements on ${formatEventDate(row.date)} deleted`,
        actionLabel: 'Undo',
        // One row per day: writing the same sites back for the same day restores it.
        onAction: () =>
          void api
            .saveMeasurement(row.date, values)
            .then(onChanged)
            .catch(() => toast.show({ message: 'Could not restore those measurements' })),
      });
    } catch (e) {
      toast.show({
        message: e instanceof Error ? e.message : 'Could not delete those measurements',
      });
    }
  };

  return (
    <section className="card card-pad fx-stack-sm" aria-labelledby="fx-measure-title">
      <div className="row-between">
        <h3 id="fx-measure-title" className="overline">
          Measurements
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
          <Icon name="plus" size={14} />
          Add measurements
        </button>
      </div>

      {measured.length === 0 ? (
        <p className="muted fx-small">
          Waist, chest, arms and the rest: a tape measure shows changes the scale hides.
        </p>
      ) : (
        <>
          <table className="data fx-compact">
            <caption className="sr-only">
              Latest measurement per site. Pick one for its chart.
            </caption>
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col" className="num">
                  Latest
                </th>
                <th scope="col">Change</th>
                <th scope="col">Measured</th>
              </tr>
            </thead>
            <tbody>
              {measured.map((s) => {
                const entry = latest[s.key]!;
                const diff =
                  entry.previous === null
                    ? null
                    : Math.round((entry.value - entry.previous) * 10) / 10;
                const selected = site?.key === s.key;
                return (
                  <tr key={s.key} className={selected ? 'fx-row-selected' : undefined}>
                    <td>
                      <button
                        type="button"
                        className="fx-link"
                        aria-pressed={selected}
                        onClick={() => setChartFor(s.key)}
                      >
                        {siteName(s)}
                      </button>
                    </td>
                    <td className="num">
                      {trim(entry.value)}
                      {unitOf(s)}
                    </td>
                    <td>
                      {diff === null ? (
                        <span className="muted">first</span>
                      ) : diff === 0 ? (
                        <span className="muted">no change</span>
                      ) : (
                        <span className="fx-change numeric">
                          <Icon name={diff > 0 ? 'arrowUp' : 'arrowDown'} size={12} />
                          {diff > 0 ? 'up' : 'down'} {trim(Math.abs(diff))}
                          {unitOf(s)}
                        </span>
                      )}
                    </td>
                    <td className="muted">{formatEventDate(entry.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {site ? (
            <div>
              <h4 className="fx-h3">{siteName(site)}</h4>
              <TrendChart
                points={series}
                unit={site.unit === '%' ? '%' : 'cm'}
                label={siteName(site)}
                color="var(--accent-emerald)"
                height={200}
              />
            </div>
          ) : null}

          <details className="fx-details">
            <summary>Days measured ({rows.length})</summary>
            <ul className="fx-list">
              {[...rows]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((row) => (
                  <li key={row.id} className="list-row">
                    <span className="grow">
                      {formatEventDate(row.date)}
                      <span className="muted fx-small">
                        {' '}
                        · {plural(Object.keys(measuredValues(row)).length, 'site')}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => void removeDay(row)}
                      aria-label={`Delete the measurements on ${formatEventDate(row.date)}`}
                    >
                      <Icon name="trash" />
                    </button>
                  </li>
                ))}
            </ul>
          </details>
        </>
      )}

      {adding ? (
        <AddMeasurements
          latest={latest}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            toast.show({ message: 'Measurements saved' });
            onChanged();
          }}
        />
      ) : null}
    </section>
  );
}

function AddMeasurements({
  latest,
  onClose,
  onSaved,
}: {
  latest: ReturnType<typeof latestValues>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Partial<Record<SiteKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Object.entries(values).flatMap(([key, text]) => {
    const n = Number((text ?? '').trim().replace(',', '.'));
    return text && text.trim() ? [[key, n] as const] : [];
  });
  // The same limits the database checks: body fat under 75 %, sites under 300 cm.
  const invalid = parsed.filter(([key, n]) =>
    key === 'body_fat_pct' ? !(n > 0 && n < 75) : !(n > 0 && n < 300),
  );

  const save = async () => {
    if (parsed.length === 0) return setError('Fill in at least one site');
    if (invalid.length > 0) return setError('Check the numbers: some look out of range');
    setSaving(true);
    setError(null);
    try {
      await api.saveMeasurement(date, Object.fromEntries(parsed));
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };

  // Pairs (left and right) share a row.
  const pairs: Site[][] = [];
  for (const site of MEASUREMENT_SITES) {
    const last = pairs[pairs.length - 1];
    if (site.side === 'right' && last?.[0]?.side === 'left' && last[0].label === site.label)
      last.push(site);
    else pairs.push([site]);
  }

  return (
    <Modal
      open
      title="Add measurements"
      onClose={onClose}
      width={560}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <p className="muted fx-small">
        Leave any blank. Your last values are shown faintly; a day you have already measured keeps
        the sites you do not fill in.
      </p>
      <TextField
        label="Day"
        type="date"
        value={date}
        max={todayISO()}
        onChange={(e) => {
          if (e.target.value) setDate(e.target.value);
        }}
      />
      {pairs.map((pair) => (
        <div key={pair[0].key} className="fx-field-row">
          {pair.map((site) => {
            const bad = invalid.some(([key]) => key === site.key);
            return (
              <TextField
                key={site.key}
                label={`${siteName(site)} (${site.unit})`}
                value={values[site.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [site.key]: e.target.value }))}
                placeholder={latest[site.key] ? trim(latest[site.key]!.value) : ''}
                inputMode="decimal"
                error={bad ? 'Out of range' : null}
              />
            );
          })}
        </div>
      ))}
      <ErrorBanner message={error} />
    </Modal>
  );
}

// BANDS -------------------------------------------------------------------------------

function Bands({
  bands,
  onAdded,
  onDeleted,
}: {
  bands: Band[];
  onAdded: (band: Band) => void;
  onDeleted: (id: string) => void;
}) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [label, setLabel] = useState('');
  const [colour, setColour] = useState(BAND_COLOURS[1]);
  const [kg, setKg] = useState('');
  const [saving, setSaving] = useState(false);
  const approx = parseBandKg(kg);

  const add = async () => {
    // Required: records compare assisted sets by their assistance, so a band
    // with no figure would count as no help at all and could outrank honest work.
    if (approx === null || saving) return;
    setSaving(true);
    try {
      const band = await api.saveBand({
        label: label.trim() || colour.name,
        color: colour.hex,
        approx_kg: approx,
        position: bands.length,
      });
      onAdded(band);
      setLabel('');
      setKg('');
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not add that band' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (band: Band) => {
    const ok = await confirm(
      `Delete the ${band.label} band?`,
      'Sets that used it keep their assistance in kg; they just stop naming the band. This cannot be undone.',
    );
    if (!ok) return;
    try {
      await api.deleteBand(band.id);
      onDeleted(band.id);
      toast.show({ message: `${band.label} band deleted` });
    } catch (e) {
      toast.show({ message: e instanceof Error ? e.message : 'Could not delete that band' });
    }
  };

  return (
    <section className="card card-pad fx-stack-sm" aria-labelledby="fx-bands-title">
      <h3 id="fx-bands-title" className="overline">
        Resistance bands
      </h3>
      {bands.length === 0 ? (
        <p className="muted fx-small">None yet. Add the bands you use for assisted sets.</p>
      ) : (
        <ul className="fx-list">
          {bands.map((band) => (
            <li key={band.id} className="list-row">
              <span
                className="fx-band-dot lg"
                style={{ background: band.color }}
                aria-hidden="true"
              />
              <span className="grow">{band.label}</span>
              <span className="muted numeric fx-small">
                {band.approx_kg ? `≈ ${trim(Number(band.approx_kg))} kg of help` : 'no figure'}
              </span>
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => void remove(band)}
                aria-label={`Delete the ${band.label} band`}
              >
                <Icon name="trash" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="field">
        <span className="label" id="fx-band-colour">
          Colour
        </span>
        <div className="chip-row" role="radiogroup" aria-labelledby="fx-band-colour">
          {BAND_COLOURS.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={c.hex === colour.hex}
              className={`chip${c.hex === colour.hex ? ' selected' : ''}`}
              onClick={() => setColour(c)}
            >
              <span className="fx-band-dot" style={{ background: c.hex }} aria-hidden="true" />
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="fx-field-row">
        <TextField
          label="Name"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={colour.name}
          maxLength={30}
        />
        <TextField
          label="Help, roughly (kg)"
          value={kg}
          onChange={(e) => setKg(e.target.value)}
          inputMode="decimal"
          placeholder="15"
          error={kg.trim() && approx === null ? 'More than 0 and under 200' : null}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
      </div>
      <p className="muted fx-small">
        A rough guess is fine: it only has to rank your bands, so an assisted set never outranks an
        honest one.
      </p>
      <div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void add()}
          disabled={saving || approx === null}
        >
          {saving ? <span className="spinner" /> : 'Add band'}
        </button>
      </div>
      {dialog}
    </section>
  );
}
