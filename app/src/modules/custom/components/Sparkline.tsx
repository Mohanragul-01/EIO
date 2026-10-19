/**
 * Sparkline - a module's trend as one small line, for its home tile.
 *
 * Drawn with react-native-svg directly (it ships in Expo Go) rather than a
 * chart library: twelve points and one stroke do not need axes, a legend or a
 * dependency. It is decoration beside the tile's summary line, which already
 * says the number in words, so screen readers skip it.
 */
import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';

type SparklineProps = {
  values: number[];
  color: string;
  height?: number;
};

/** Points to a path in a box, with a pixel of padding so the stroke is not clipped. */
export function sparkPath(values: number[], width: number, height: number): string {
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat line sits in the middle rather than on the floor.
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = pad + index * step;
      const y = max === min ? height / 2 : pad + (1 - (value - min) / span) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

export function Sparkline({ values, color, height = 22 }: SparklineProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      style={{ height }}
      onLayout={onLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <Path
            d={sparkPath(values, width, height)}
            stroke={color}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  );
}
