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

import { sparkPath } from '../trend';

type SparklineProps = {
  values: number[];
  color: string;
  height?: number;
};

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
