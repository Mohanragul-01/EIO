/**
 * TrendCard - a module's number field over time, above its list.
 *
 * The series maths is trend.ts, tested; this only draws it. react-native-svg
 * directly rather than react-native-chart-kit: one line, a soft fill and a
 * tap-to-read point need about as much code as configuring the library would,
 * and the library cannot draw a smoothed line over the raw one.
 *
 * Axis labels are deliberately minimal - the first and last date, the lowest
 * and highest value - because a phone card has room for a shape, not a grid.
 * Tapping the chart reads the nearest point out above it.
 *
 * NO EMPTY CHART. The list screen renders this only when the module has a
 * number-like field with at least one value; a range with nothing in it says
 * so in words instead of drawing bare axes.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { GlassCard } from '../../../core/components';
import { todayISO } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { radius, spacing } from '../../../core/theme';
import { dateFieldOf } from '../entryDate';
import { formatNumeric } from '../summary';
import {
  buildSeries,
  CHART_RANGES,
  CHART_RANGE_LABEL,
  describeChart as describe,
  pointLabel,
  rangeStartISO,
  type ChartRange,
  type SeriesPoint,
} from '../trend';
import type { CustomField, CustomModule, CustomRecord } from '../types';

const CHART_HEIGHT = 132;
const PAD_Y = 10;

type TrendCardProps = {
  module: CustomModule;
  field: CustomField;
  fields: CustomField[];
  records: CustomRecord[];
  accent: string;
};

export function TrendCard({ module, field, fields, records, accent }: TrendCardProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [range, setRange] = useState<ChartRange>('all');
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const points = useMemo(
    () =>
      buildSeries(records, {
        valueField: field,
        dateField: dateFieldOf(fields),
        bucket: module.chart_bucket,
        agg: module.chart_agg,
        window: module.chart_window,
        from: rangeStartISO(range, todayISO()),
      }),
    [records, field, fields, module.chart_bucket, module.chart_agg, module.chart_window, range],
  );

  // The line people read is the smoothed one when smoothing is on.
  const line = (point: SeriesPoint) => point.smooth ?? point.value;
  const all = points.flatMap((p) => (p.smooth === null ? [p.value] : [p.value, p.smooth]));
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 0;
  const span = max - min || 1;

  const x = (index: number) =>
    points.length > 1 ? (index / (points.length - 1)) * width : width / 2;
  const y = (value: number) =>
    max === min
      ? CHART_HEIGHT / 2
      : PAD_Y + (1 - (value - min) / span) * (CHART_HEIGHT - PAD_Y * 2);

  const pathOf = (pick: (p: SeriesPoint) => number) =>
    points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(pick(p)).toFixed(1)}`).join(' ');

  const main = pathOf(line);
  const area = points.length > 1 ? `${main} L${x(points.length - 1)} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z` : '';

  const shown = selected !== null && points[selected] ? points[selected] : points[points.length - 1];
  const fmt = (value: number) => formatNumeric(field, value);

  const onPress = (event: GestureResponderEvent) => {
    if (points.length === 0 || width === 0) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
    setSelected(Math.round(ratio * (points.length - 1)));
  };

  const summary =
    points.length === 0
      ? `${field.label}: nothing in this range.`
      : `${field.label}, ${describe(module).toLowerCase()}. ${points.length} points from ` +
        `${pointLabel(points[0].date, module.chart_bucket)} to ` +
        `${pointLabel(points[points.length - 1].date, module.chart_bucket)}. ` +
        `Lowest ${fmt(min)}, highest ${fmt(max)}, latest ${fmt(line(points[points.length - 1]))}.`;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>{field.label}</Text>
          <Text style={styles.caption} numberOfLines={1}>{describe(module)}</Text>
        </View>
        <View style={styles.ranges} accessibilityRole="radiogroup">
          {CHART_RANGES.map((option) => {
            const on = option === range;
            return (
              <Pressable
                key={option}
                onPress={() => {
                  setRange(option);
                  setSelected(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={option === 'all' ? 'All time' : `Last ${CHART_RANGE_LABEL[option]}`}
                style={({ pressed }) => [styles.range, on && styles.rangeOn, pressed && styles.pressed]}
              >
                <Text style={[styles.rangeText, on && styles.rangeTextOn]}>{CHART_RANGE_LABEL[option]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {points.length === 0 ? (
        <Text style={styles.empty}>Nothing logged in this range.</Text>
      ) : (
        <>
          <View style={styles.readout}>
            <Text style={styles.readoutValue}>{fmt(line(shown))}</Text>
            <Text style={styles.readoutLabel}>
              {selected === null ? 'Latest · ' : ''}
              {pointLabel(shown.date, module.chart_bucket)}
            </Text>
          </View>

          <View
            onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
            accessible
            accessibilityRole="image"
            accessibilityLabel={summary}
          >
            <Pressable onPress={onPress} style={{ height: CHART_HEIGHT }}>
              {width > 0 ? (
                <Svg width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
                  <Defs>
                    <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={accent} stopOpacity={0.28} />
                      <Stop offset="1" stopColor={accent} stopOpacity={0} />
                    </LinearGradient>
                  </Defs>
                  {area ? <Path d={area} fill="url(#trendFill)" /> : null}
                  {/* With smoothing on, the raw values stay visible as a faint
                      line under the average, so a spike is not hidden. */}
                  {module.chart_window ? (
                    <Path
                      d={pathOf((p) => p.value)}
                      stroke={colors.textFaint}
                      strokeWidth={1}
                      fill="none"
                    />
                  ) : null}
                  <Path
                    d={main}
                    stroke={accent}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  {points.length === 1 ? (
                    <Circle cx={x(0)} cy={y(line(points[0]))} r={4} fill={accent} />
                  ) : null}
                  {selected !== null && points[selected] ? (
                    <>
                      <Line
                        x1={x(selected)}
                        x2={x(selected)}
                        y1={0}
                        y2={CHART_HEIGHT}
                        stroke={colors.glassBorderStrong}
                        strokeWidth={1}
                      />
                      <Circle
                        cx={x(selected)}
                        cy={y(line(points[selected]))}
                        r={4.5}
                        fill={accent}
                        stroke={colors.backgroundElevated}
                        strokeWidth={2}
                      />
                    </>
                  ) : null}
                </Svg>
              ) : null}
            </Pressable>
            {/* Min and max sit over the chart's left edge, out of the line's way. */}
            <Text style={[styles.axis, styles.axisTop]}>{fmt(max)}</Text>
            <Text style={[styles.axis, styles.axisBottom]}>{fmt(min)}</Text>
          </View>

          <View style={styles.dates}>
            <Text style={styles.axisDate}>{pointLabel(points[0].date, module.chart_bucket)}</Text>
            {points.length > 1 ? (
              <Text style={styles.axisDate}>
                {pointLabel(points[points.length - 1].date, module.chart_bucket)}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </GlassCard>
  );
}

const useStyles = makeStyles(({ colors, typography }) => ({
  card: {
    marginBottom: spacing.lg,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headText: {
    flex: 1,
  },
  title: {
    ...typography.title,
    fontSize: 14.5,
  },
  caption: {
    ...typography.caption,
    fontSize: 11.5,
    marginTop: 1,
  },
  ranges: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  range: {
    minWidth: 34,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rangeOn: {
    backgroundColor: colors.glassStrong,
    borderColor: colors.glassBorderStrong,
  },
  rangeText: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textMuted,
  },
  rangeTextOn: {
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  readoutValue: {
    ...typography.h2,
    ...typography.numeric,
  },
  readoutLabel: {
    ...typography.caption,
    ...typography.numeric,
  },
  axis: {
    position: 'absolute',
    left: 0,
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    color: colors.textFaint,
  },
  axisTop: {
    top: -2,
  },
  axisBottom: {
    bottom: -2,
  },
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisDate: {
    ...typography.caption,
    ...typography.numeric,
    fontSize: 10.5,
    color: colors.textFaint,
  },
  empty: {
    ...typography.caption,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
}));
