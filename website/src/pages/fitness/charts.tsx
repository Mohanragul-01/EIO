/**
 * charts.tsx - the Fitness page's line charts, on the site's recharts setup.
 *
 * One chart, three uses: an exercise's metric over time, a body measurement
 * or weigh-in over time, and a ladder's rung over time (drawn as steps, since
 * you are on one rung until you move). The picture is described in words for
 * screen readers - first value, latest, best - and every point the chart
 * offers a click on is also reachable as a list elsewhere on the page.
 */
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatEventDate } from '@app/core/date';

import { TOOLTIP_STYLE } from '../../components/chart';
import { trim } from './format';

export type ChartPoint = { date: string; value: number };

export function TrendChart({
  points,
  unit,
  label,
  color = 'var(--primary)',
  height = 240,
  step = false,
  selectedIndex = null,
  onSelect,
  formatValue,
}: {
  points: ChartPoint[];
  /** "kg", "reps", "s", "cm", "%". */
  unit: string;
  /** What the line measures, for the tooltip and the description. */
  label: string;
  color?: string;
  height?: number;
  /** Draw as steps (a ladder's rung), not a slope. */
  step?: boolean;
  selectedIndex?: number | null;
  /** Clicking a point picks it. */
  onSelect?: (index: number) => void;
  /** Overrides "62.5 kg" in the tooltip and description. */
  formatValue?: (value: number) => string;
}) {
  const show = formatValue ?? ((v: number) => `${trim(v)}${unit === '%' ? '%' : ` ${unit}`}`);

  if (points.length === 0) {
    return (
      <div className="fx-chart-empty" style={{ height }}>
        Nothing to chart in this range yet.
      </div>
    );
  }

  const first = points[0];
  const last = points[points.length - 1];
  const best = Math.max(...points.map((p) => p.value));
  const description =
    points.length === 1
      ? `${label}: one point, ${show(last.value)} on ${formatEventDate(last.date)}.`
      : `${label} from ${show(first.value)} on ${formatEventDate(first.date)} to ${show(
          last.value,
        )} on ${formatEventDate(last.date)}; best ${show(best)}; ${points.length} points.`;

  const data = points.map((p, index) => ({ ...p, index }));

  return (
    <div role="img" aria-label={description} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
          onClick={(state) => {
            // Null off the points; Number(null) would be 0, the first point.
            const raw = state?.activeTooltipIndex;
            if (!onSelect || raw === null || raw === undefined) return;
            const index = Number(raw);
            if (Number.isInteger(index) && index >= 0) onSelect(index);
          }}
          style={onSelect ? { cursor: 'pointer' } : undefined}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(d: string) => formatEventDate(d)}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            axisLine={false}
            tickLine={false}
            width={52}
            allowDecimals={!step}
            domain={step ? [1, 'dataMax'] : ['auto', 'auto']}
            tickFormatter={(v: number) => (step ? `Step ${v}` : trim(v))}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(d) => formatEventDate(String(d))}
            formatter={(value) => [show(Number(value)), label]}
          />
          <Line
            type={step ? 'stepAfter' : 'monotone'}
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            isAnimationActive={false}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const selected = props.index === selectedIndex;
              return (
                <circle
                  key={`dot-${props.index}`}
                  cx={props.cx}
                  cy={props.cy}
                  r={selected ? 5.5 : 3}
                  fill={selected ? 'var(--surface)' : color}
                  stroke={color}
                  strokeWidth={selected ? 2.5 : 0}
                />
              );
            }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
