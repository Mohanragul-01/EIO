/**
 * LineChart - a small progress line, one point per session.
 *
 * Deliberately plain: a line, a dot per session, the lowest and highest values
 * at the side and the first and last dates underneath. Tap anywhere on the
 * chart and the nearest session is picked, which the page then opens - a
 * whole column is easier to hit than a 6dp dot. The chart also describes
 * itself to screen readers in one sentence, so the trend is not visual-only.
 */
import React, { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatEventDate } from '../../../core/date';
import { makeStyles, useTheme } from '../../../core/ThemeContext';
import { spacing } from '../../../core/theme';

const HEIGHT = 160;
const PAD = 10;

export function LineChart({
  points,
  unit,
  label,
  color,
  selectedIndex,
  onSelect,
}: {
  points: { date: string; value: number }[];
  unit: string;
  label: string;
  color?: string;
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const stroke = color ?? colors.primary;

  if (points.length === 0) {
    return <Text style={styles.empty}>Nothing logged in this range yet.</Text>;
  }

  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) =>
    points.length === 1 ? width / 2 : PAD + (i * (width - 2 * PAD)) / (points.length - 1);
  const y = (v: number) => PAD + (1 - (v - lo) / span) * (HEIGHT - 2 * PAD);
  const fmt = (v: number) => `${Number.isInteger(v) ? v : Math.round(v * 10) / 10} ${unit}`;

  const first = points[0];
  const last = points[points.length - 1];
  const summary = `${label} from ${fmt(first.value)} to ${fmt(last.value)} over ${points.length} ${
    points.length === 1 ? 'session' : 'sessions'
  }, highest ${fmt(hi)}`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={summary}>
      <View style={styles.row}>
        <View style={styles.axis}>
          <Text style={styles.axisText}>{fmt(hi)}</Text>
          <Text style={styles.axisText}>{fmt(lo)}</Text>
        </View>
        <Pressable
          style={styles.plot}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          onPress={(e) => {
            if (!onSelect || width === 0) return;
            const tapX = e.nativeEvent.locationX;
            let nearest = 0;
            points.forEach((_, i) => {
              if (Math.abs(x(i) - tapX) < Math.abs(x(nearest) - tapX)) nearest = i;
            });
            onSelect(nearest);
          }}
        >
          {width > 0 ? (
            <Svg width={width} height={HEIGHT}>
              <Line
                x1={0}
                y1={y(hi)}
                x2={width}
                y2={y(hi)}
                stroke={colors.glassBorder}
                strokeWidth={1}
              />
              <Line
                x1={0}
                y1={y(lo)}
                x2={width}
                y2={y(lo)}
                stroke={colors.glassBorder}
                strokeWidth={1}
              />
              {points.length > 1 ? (
                <Polyline
                  points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
              {points.map((p, i) => (
                <Circle
                  key={`${p.date}-${i}`}
                  cx={x(i)}
                  cy={y(p.value)}
                  r={i === selectedIndex ? 6 : 3.5}
                  fill={i === selectedIndex ? stroke : colors.backgroundElevated}
                  stroke={stroke}
                  strokeWidth={2}
                />
              ))}
            </Svg>
          ) : (
            <View style={{ height: HEIGHT }} />
          )}
        </Pressable>
      </View>
      <View style={styles.dates}>
        <Text style={styles.axisText}>{formatEventDate(first.date)}</Text>
        {points.length > 1 ? (
          <Text style={styles.axisText}>{formatEventDate(last.date)}</Text>
        ) : null}
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
  empty: { ...typography.body, textAlign: 'center', paddingVertical: spacing.xl },
}));
