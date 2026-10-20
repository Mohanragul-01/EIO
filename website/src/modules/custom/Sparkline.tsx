/**
 * Sparkline - a custom module's trend as one small line, on its dashboard tile.
 *
 * The path is the app's sparkPath, so the tile and the phone's home tile draw
 * the same line from the same points. A fixed viewBox stretched to the tile's
 * width, with a non-scaling stroke so the line keeps its weight. Decorative:
 * the tile's text already says the number.
 */
import { sparkPath } from '@app/modules/custom/trend';

const WIDTH = 120;
const HEIGHT = 24;

export function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  return (
    <svg
      className="cm-sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={sparkPath(values, WIDTH, HEIGHT)}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
