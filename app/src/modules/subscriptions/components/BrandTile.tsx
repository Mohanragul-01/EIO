/**
 * BrandTile - a rounded square in the service's colour with a monogram.
 *
 * Never a logo: logos are trademarks and a network fetch per row. The colour
 * comes from the data (the row, else its catalogue entry, else a stable
 * fallback), and the monogram's colour is computed from it, so neither is a
 * literal here. A hairline border keeps a black tile visible on the dark
 * canvas and a white one on the light canvas.
 *
 * Decorative: the row it sits in carries the name for screen readers.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { makeStyles } from '../../../core/ThemeContext';
import { fonts } from '../../../core/theme';
import { monogram, readableOn, tileColor } from '../brand';

type BrandTileProps = {
  sub: { name: string; color: string | null; service_key: string | null };
  size?: number;
};

export function BrandTile({ sub, size = 40 }: BrandTileProps) {
  const styles = useStyles();
  const color = tileColor(sub);

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.28),
          backgroundColor: color,
        },
      ]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Text
        style={[styles.letters, { color: readableOn(color), fontSize: Math.round(size * 0.38) }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {monogram(sub.name)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  letters: {
    fontFamily: fonts.bold,
    letterSpacing: -0.3,
  },
}));
