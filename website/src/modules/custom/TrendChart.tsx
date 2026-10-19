/**
 * TrendChart - a custom module's number field over time, on the website.
 *
 * The points come from the app's trend.ts, the same as the phone's card, so
 * the two clients cannot disagree about what was charted; this draws them
 * with the site's recharts setup. With smoothing on, the raw values stay as a
 * faint line under the moving average, so a spike is never smoothed out of
 * sight.
 *
 * No empty chart: the page renders this only when the module has a number-
 * like field with a value, and a range with nothing in it says so in words.
 */
import { useMemo, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { todayISO } from '@app/core/date';
import { dateFieldOf } from '@app/modules/custom/entryDate';
import { formatNumeric } from '@app/modules/custom/summary';
import {
  buildSeries,
  CHART_RANGE_LABEL,
  CHART_RANGES,
  describeChart,
  pointLabel,
  rangeStartISO,
  type ChartRange,
} from '@app/modules/custom/trend';
import type { CustomField, CustomModule, CustomRecord } from '@app/modules/custom/types';

import { TOOLTIP_STYLE } from '../../components/chart';
import { Segmented } from '../../components/ui';

export function TrendChart({
  module,
  field,
  fields,
  records,
}: {
  module: CustomModule;
  field: CustomField;
  fields: CustomField[];
  records: CustomRecord[];
}) {
  const [range, setRange] = useState<ChartRange>('all');

  const points = useMemo(
    () =>
      buildSeries(records, {
        valueField: field,
        dateField: dateFieldOf(fields),
        bucket: module.chart_bucket,
        agg: module.chart_agg,
        window: module.chart_window,
        from: rangeStartISO(range, todayISO()),
      }).map((point) => ({ ...point, label: pointLabel(point.date, module.chart_bucket) })),
    [records, field, fields, module.chart_bucket, module.chart_agg, module.chart_window, range],
  );

  const smoothed = Boolean(module.chart_window);
  const fmt = (value: unknown) => formatNumeric(field, Number(value));
  const gradientId = `trend-${module.id}`;

  return (
    <div className="card card-pad rise" style={{ marginBottom: 'var(--space-lg)' }}>
      <div className="row-between" style={{ marginBottom: 'var(--space-md)' }}>
        <div>
          <div style={{ fontWeight: 600 }}>{field.label}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {describeChart(module)}
          </div>
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          options={CHART_RANGES.map((option) => ({ value: option, label: CHART_RANGE_LABEL[option] }))}
        />
      </div>

      {points.length === 0 ? (
        <p className="faint" style={{ fontSize: 12.5 }}>
          Nothing logged in this range.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={module.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={module.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-faint)' }}
              tickFormatter={fmt}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [fmt(value), name === 'smooth' ? 'Moving average' : field.label]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={smoothed ? 'var(--text-faint)' : module.color}
              strokeWidth={smoothed ? 1 : 2}
              fill={`url(#${gradientId})`}
              dot={points.length === 1}
              isAnimationActive={false}
            />
            {smoothed ? (
              <Line
                type="monotone"
                dataKey="smooth"
                stroke={module.color}
                strokeWidth={2.25}
                dot={false}
                isAnimationActive={false}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
