/**
 * LadderProgress - a ladder's position over time, as a step chart.
 *
 * The calisthenics answer to the e1RM line (spec §4.7): each move up or back
 * is a step, and the line runs on to today at the rung you are on now, so the
 * long flat stretches - the weeks spent earning a rung - are as visible as the
 * moves. Time runs left to right in proportion, so a fast climb looks fast.
 * The chart also describes itself in one sentence, so it is not visual-only.
 */
import React, { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatEventDate, fromISODate } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';

const HEIGHT = 120;
const PAD = 8;

export function LadderProgress({
  points,
  total,
  name,
}: {
  /** The rung number on each day it changed, oldest first, carried on to today. */
  points: { date: string; number: number }[];
  /** How many rungs the ladder has. */
  total: number;
  name: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  if (points.length < 2 || total < 1) return null;

  const times = points.map((p) => fromISODate(p.date).getTime());
  const t0 = times[0];
  const span = times[times.length - 1] - t0 || 1;
  const x = (i: number) => PAD + ((times[i] - t0) / span) * (width - 2 * PAD);
  const y = (n: number) =>
    total === 1 ? HEIGHT / 2 : PAD + (1 - (n - 1) / (total - 1)) * (HEIGHT - 2 * PAD);

  // A step: across at the old rung, then up (or down) to the new one.
  const line = points
    .flatMap((p, i) =>
      i === 0
        ? [`${x(0)},${y(p.number)}`]
        : [`${x(i)},${y(points[i - 1].number)}`, `${x(i)},${y(p.number)}`],
    )
    .join(' ');

  const first = points[0];
  const last = points[points.length - 1];
  const highest = Math.max(...points.map((p) => p.number));
  const summary = `${name}: step ${first.number} of ${total} on ${formatEventDate(
    first.date,
  )}, step ${last.number} now${highest > last.number ? `, highest step ${highest}` : ''}`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={styles.row}>
        <View style={styles.axis}>
          <Text style={styles.axisText}>Step {total}</Text>
          <Text style={styles.axisText}>Step 1</Text>
        </View>
        <View
          style={styles.plot}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        >
          {width > 0 ? (
            <Svg width={width} height={HEIGHT}>
              {Array.from({ length: total }, (_, i) => (
                <Line
                  key={i}
                  x1={0}
                  y1={y(i + 1)}
                  x2={width}
                  y2={y(i + 1)}
                  stroke={colors.glassBorder}
                  strokeWidth={1}
                />
              ))}
              <Polyline
                points={line}
                fill="none"
                stroke={colors.accentCyan}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
              {/* A dot on each move; the last point is today, not a move. */}
              {points.slice(0, -1).map((p, i) => (
                <Circle
                  key={`${p.date}-${i}`}
                  cx={x(i)}
                  cy={y(p.number)}
                  r={3.5}
                  fill={colors.backgroundElevated}
                  stroke={colors.accentCyan}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          ) : (
            <View style={{ height: HEIGHT }} />
          )}
        </View>
      </View>
      <View style={styles.dates}>
        <Text style={styles.axisText}>{formatEventDate(first.date)}</Text>
        <Text style={styles.axisText}>{formatEventDate(last.date)}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ typography }) => ({
  row: { flexDirection: 'row' },
  axis: { justifyContent: 'space-between', paddingVertical: PAD - 6, marginRight: spacing.sm },
  axisText: { ...typography.caption, ...typography.numeric, fontSize: 11 },
  plot: { flex: 1, height: HEIGHT },
  dates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginLeft: 48,
  },
}));
