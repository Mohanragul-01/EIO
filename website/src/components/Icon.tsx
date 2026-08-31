/**
 * Icon - one drawn icon set, replacing the Unicode glyphs this site started with.
 *
 * WHY THIS FILE EXISTS. The first version used characters: ✎ for edit, 🗑 for
 * delete, ＋ for add, ↻, ⚙, ☾, ▲. They come from a dozen unrelated Unicode
 * blocks, so the browser resolves each one from whatever font happens to have
 * it - different weights, different stroke widths, different optical sizes, and
 * different baselines, none of which line up. 🗑 is worse still: on Windows it
 * renders as a full-colour emoji, so a neutral toolbar had one glossy blue-grey
 * bin in it.
 *
 * A real icon set is the opposite: every glyph drawn on ONE 24x24 grid at ONE
 * stroke weight, so a row of them reads as a set rather than as things that
 * happened to be available. That single change does more for "this looks
 * designed" than any amount of colour or spacing work.
 *
 * These are stroke icons, 1.5px on a 24 grid, round caps and joins. They
 * inherit `currentColor`, so a button's colour drives its icon and there is
 * never a mismatched fill to keep in sync.
 */
import type { CSSProperties } from 'react';

export type IconName =
  | 'dashboard'
  | 'tasks'
  | 'notes'
  | 'finance'
  | 'subscriptions'
  | 'fitness'
  | 'module'
  | 'plus'
  | 'edit'
  | 'trash'
  | 'close'
  | 'check'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronUp'
  | 'chevronDown'
  | 'search'
  | 'calendar'
  | 'download'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'logout'
  | 'inbox'
  | 'checklist'
  | 'journal'
  | 'alert'
  | 'play'
  | 'pause'
  | 'timer'
  | 'trend'
  | 'repeat'
  | 'reset'
  | 'flag'
  | 'sparkline';

/**
 * Path data per icon. Several use more than one subpath; they are joined with
 * a space, which SVG treats as a single path with separate contours.
 */
const PATHS: Record<IconName, string> = {
  dashboard: 'M4 4h6v6H4z M14 4h6v6h-6z M14 14h6v6h-6z M4 14h6v6H4z',
  tasks: 'M9 11l2.5 2.5L20 5 M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9',
  notes:
    'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4',
  finance:
    'M20 12V8H7a2 2 0 0 1 0-4h11v4 M4 6v12a2 2 0 0 0 2 2h14v-4 M18 12a2 2 0 0 0 0 4h3v-4z',
  subscriptions: 'M17 3l3 3-3 3 M4 11V9a3 3 0 0 1 3-3h13 M7 21l-3-3 3-3 M20 13v2a3 3 0 0 1-3 3H4',
  fitness: 'M4 9v6 M8 6v12 M16 6v12 M20 9v6 M8 12h8',
  module:
    'M20 16V8a2 2 0 0 0-1-1.73l-6-3.5a2 2 0 0 0-2 0l-6 3.5A2 2 0 0 0 4 8v8a2 2 0 0 0 1 1.73l6 3.5a2 2 0 0 0 2 0l6-3.5A2 2 0 0 0 20 16z M4.3 7.1L12 11.6l7.7-4.5 M12 21.4V11.6',

  plus: 'M12 5v14 M5 12h14',
  edit: 'M12 20h8 M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4z',
  trash: 'M4 7h16 M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M18 7l-.8 12.1a2 2 0 0 1-2 1.9H8.8a2 2 0 0 1-2-1.9L6 7 M10 11.5v5 M14 11.5v5',
  close: 'M18 6L6 18 M6 6l12 12',
  check: 'M20 6L9 17l-5-5',

  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  chevronUp: 'M5 15l7-7 7 7',
  chevronDown: 'M5 9l7 7 7-7',

  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z M20 20l-4-4',
  calendar: 'M8 3v3 M16 3v3 M4 10h16 M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  download: 'M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3 M8 11l4 4 4-4 M12 15V4',

  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20.5 13.4A8.5 8.5 0 1 1 10.6 3.5a6.6 6.6 0 0 0 9.9 9.9z',
  monitor: 'M19 4H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M9 21h6 M12 17v4',
  logout: 'M10 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 16l4-4-4-4 M20 12H10',

  inbox:
    'M20 12h-4l-1.5 2.5h-5L8 12H4 M6.6 5.6L4 12v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5l-2.6-6.4A2 2 0 0 0 15.5 4h-7a2 2 0 0 0-1.9 1.6z',
  checklist: 'M10 6h10 M10 12h10 M10 18h6 M4 6l1.3 1.3L7.5 5 M4 12l1.3 1.3L7.5 11 M4 18l1.3 1.3L7.5 17',
  journal:
    'M5 19.5A2.5 2.5 0 0 1 7.5 17H19 M7.5 3H19v18H7.5A2.5 2.5 0 0 1 5 18.5v-13A2.5 2.5 0 0 1 7.5 3z M10 8h6',

  alert: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 8v5 M12 16.5h.01',
  play: 'M7 4.5l11 7.5-11 7.5z',
  pause: 'M8 5h3v14H8z M13 5h3v14h-3z',
  timer: 'M10 2.5h4 M12 13.5l3-3 M12 21.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',

  trend: 'M22 7l-8 8-4-4-8 8 M16 7h6v6',
  repeat: 'M17 2l3 3-3 3 M4 12V9a4 4 0 0 1 4-4h12 M7 22l-3-3 3-3 M20 12v3a4 4 0 0 1-4 4H4',
  reset: 'M3 4v6h6 M4.4 15a9 9 0 1 0 1-7.5L3 10',
  flag: 'M5 21V4 M5 5h11l-2 3.5L16 12H5',
  sparkline: 'M3 17l5-6 4 3 5-8 4 5',
};

/**
 * Icons that read better filled than stroked.
 *
 * A play triangle drawn as an outline at 16px is mostly hole, and a hairline
 * one is hard to hit visually next to solid text.
 */
const FILLED: IconName[] = ['play', 'pause'];

export function Icon({
  name,
  size = 16,
  className,
  style,
  strokeWidth,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** Defaults to 1.5, scaled slightly so large icons do not look heavy. */
  strokeWidth?: number;
}) {
  const filled = FILLED.includes(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth ?? (size >= 22 ? 1.4 : 1.6)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      // Never let an icon dictate the height of the line it sits on, and never
      // let it be selected as if it were text.
      style={{ display: 'block', flexShrink: 0, ...style }}
      // Decorative by default. Every control that uses one carries its own
      // aria-label, so announcing the icon too would just say everything twice.
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
