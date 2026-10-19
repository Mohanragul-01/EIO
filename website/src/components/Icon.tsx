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
  | 'sparkline'
  // Products: a spare on the shelf, a use-by date, running low, not enough data.
  | 'box'
  | 'clock'
  | 'trendDown'
  | 'help'
  // Finance v3
  | 'swap'
  | 'bolt'
  | 'sliders'
  | 'star'
  | 'starFilled'
  | 'bell'
  | 'archive'
  | 'external'
  | 'more'
  | 'arrowUp'
  | 'arrowDown'
  // B-List: a glyph per category (modules/bucket/categories.ts), plus the
  // card controls. Generic names, since a heart or a clock is not the
  // B-List's alone.
  | 'camera'
  | 'home'
  | 'paw'
  | 'body'
  | 'medkit'
  | 'balloon'
  | 'landmark'
  | 'layers'
  | 'diamond'
  | 'target'
  | 'utensils'
  | 'sparkles'
  | 'chats'
  | 'binoculars'
  | 'rocket'
  | 'leaf'
  | 'wine'
  | 'mountain'
  | 'dice'
  | 'briefcase'
  | 'scissors'
  | 'heart'
  | 'clipboard'
  | 'train'
  | 'language'
  | 'book'
  | 'bulb'
  | 'pulse'
  | 'cash'
  | 'gauge'
  | 'music'
  | 'mic'
  | 'wand'
  | 'gift'
  | 'footsteps'
  | 'shield'
  | 'sailboat'
  | 'telescope'
  | 'shapes'
  | 'ear'
  | 'key'
  | 'people'
  | 'planet'
  | 'ticket'
  | 'trophy'
  | 'chip'
  | 'wrench'
  | 'compass'
  | 'fish'
  | 'car'
  | 'palette'
  | 'droplet'
  | 'flame'
  | 'snowflake'
  | 'feather'
  | 'cup'
  | 'flower'
  | 'pin'
  | 'shuffle'
  | 'chat'
  // Notes v3
  | 'link'
  | 'list';

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

  // B-List category glyphs and card controls. Same grid and weight as the
  // rest; each was checked rendered at 16 and 48 px before it went in.
  camera:
    'M21 18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  bolt: 'M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z',
  home: 'M3.5 10.5L12 4l8.5 6.5 M5.5 9v11h13V9 M10 20v-5.5h4V20',
  paw:
    'M12 12.5c-2.8 0-5.5 3-5.5 5.4 0 1.5 1.1 2.4 2.6 2.4 1.2 0 1.9-.6 2.9-.6s1.7.6 2.9.6c1.5 0 2.6-.9 2.6-2.4 0-2.4-2.7-5.4-5.5-5.4z M5 11a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 5 11z M9.2 7.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M14.8 7.6a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z M19 11a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6z',
  body: 'M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M4 9.5l8 1.5 8-1.5 M12 11v4.5 M8.5 21l3.5-5.5 3.5 5.5',
  medkit:
    'M4 7.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z M9 7.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2 M12 11v6 M9 14h6',
  balloon:
    'M12 15.5c3.3 0 6-3.2 6-6.7a6 6 0 0 0-12 0c0 3.5 2.7 6.7 6 6.7z M12 15.5l-1.2 1.8h2.4z M12 17.3c0 1.5-1.5 2.2-.5 4.2',
  landmark: 'M3 21h18 M5 18h14 M12 3l8.5 5h-17z M6.5 10.5V18 M10 10.5V18 M14 10.5V18 M17.5 10.5V18',
  layers: 'M12 3l9 4.5-9 4.5-9-4.5z M3 12l9 4.5 9-4.5 M3 16.5L12 21l9-4.5',
  diamond: 'M7 4h10l4 5.5-9 11-9-11z M3 9.5h18 M10 4L8.5 9.5 12 20.5l3.5-11L14 4',
  target:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  utensils: 'M5 3v6a2.5 2.5 0 0 0 5 0V3 M7.5 3v18 M19 15V3c-2.5 1-4 3.5-4 7v5z M19 15v6',
  sparkles:
    'M11 3l1.6 4.4L17 9l-4.4 1.6L11 15l-1.6-4.4L5 9l4.4-1.6z M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  chats:
    'M15 10.5a2 2 0 0 1-2 2H7l-4 3.5V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z M18 8.5h1a2 2 0 0 1 2 2V21l-4-3.5h-6a2 2 0 0 1-2-2v-1',
  binoculars:
    'M6.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M17.5 20a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M3 16.5L5.5 6.5A1.5 1.5 0 0 1 7 5.3h1.5a1 1 0 0 1 1 1V14 M21 16.5L18.5 6.5A1.5 1.5 0 0 0 17 5.3h-1.5a1 1 0 0 0-1 1V14 M10 11h4',
  rocket:
    'M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1z M12 15l-3-3a22 22 0 0 1 2-3.9A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0 M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5',
  leaf: 'M4.5 19.5C4 11 9.5 4.5 20 4c.5 10.5-6 16-15.5 15.5z M4.5 19.5L13 11',
  wine:
    'M8 21h8 M12 15v6 M7.2 9h9.6 M12 15a5 5 0 0 0 5-5c0-2-.5-4-1.8-7H8.8C7.5 6 7 8 7 10a5 5 0 0 0 5 5z',
  mountain: 'M2.5 20L9 7l4.5 8 2.5-4 5.5 9z',
  dice:
    'M6 3.5h12A2.5 2.5 0 0 1 20.5 6v12a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18V6A2.5 2.5 0 0 1 6 3.5z M8.5 9.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z M15.5 9.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z M12 12.9a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z M8.5 16.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z M15.5 16.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8z',
  briefcase:
    'M4 7.5h16a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1z M8.5 7.5v-2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v2 M3 13h18',
  scissors:
    'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M20 4L8.1 15.9 M14.5 14.5L20 20 M8.1 8.1L12 12',
  heart:
    'M20.4 5.6a5 5 0 0 0-7.1 0L12 6.9l-1.3-1.3a5 5 0 0 0-7.1 7.1L12 21l8.4-8.3a5 5 0 0 0 0-7.1z',
  clipboard:
    'M15.5 4.5H18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2.5 M9.5 3h5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8.5 12h7 M8.5 16h5',
  train:
    'M7 3.5h10a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3z M4 11h16 M8 15.3a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z M16 15.3a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6z M8 18l-2.5 3 M16 18l2.5 3',
  language: 'M5 8l6 6 M4 14l6-6 2-3 M2 5h12 M7 2h1 M22 22l-5-10-5 10 M14 18h6',
  book:
    'M2.5 4.5h6A3.5 3.5 0 0 1 12 8v12a2.5 2.5 0 0 0-2.5-2.5h-7z M21.5 4.5h-6A3.5 3.5 0 0 0 12 8v12a2.5 2.5 0 0 1 2.5-2.5h7z',
  bulb:
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5 M9 18h6 M10 22h4',
  pulse: 'M3 12h4l3-7 4 14 3-7h4',
  cash: 'M3 6.5h18v11H3z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M6.5 12h.01 M17.5 12h.01',
  gauge: 'M12 14l4-4 M3.3 19a10 10 0 1 1 17.4 0',
  music:
    'M9 18V5.5l11-2V16 M6.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17.5 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  mic:
    'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z M18.5 11a6.5 6.5 0 0 1-13 0 M12 17.5V21 M8.5 21h7',
  wand: 'M4 20L15 9 M17 3v4 M15 5h4 M20 9.5v3 M18.5 11h3 M10.5 4v2 M9.5 5h2',
  gift:
    'M4 11.5v9h16v-9 M3 7.5h18v4H3z M12 20.5v-13 M12 7.5H8.2a2.2 2.2 0 1 1 0-4.4C11 3.1 12 7.5 12 7.5z M12 7.5h3.8a2.2 2.2 0 1 0 0-4.4C13 3.1 12 7.5 12 7.5z',
  footsteps:
    'M7.5 3c1.7 0 3 1.9 3 4.6S9.6 12 9.6 13H5.4c0-1-1-2.7-1-5.4S5.8 3 7.5 3z M5.5 15.5h4v1a2 2 0 0 1-4 0z M16.5 5.5c1.7 0 3 1.9 3 4.6s-.9 4.4-.9 5.4h-4.2c0-1-1-2.7-1-5.4s1.4-4.6 3.1-4.6z M14.5 18h4v1a2 2 0 0 1-4 0z',
  shield: 'M12 21s7.5-3.5 7.5-9.5V5.5L12 3 4.5 5.5v6C4.5 17.5 12 21 12 21z M9 12l2 2 4-4',
  sailboat: 'M12 3v13.5 M12 4.5l6.5 11H12 M10 7.5L5 15.5h5 M3 18.5h18l-2 2.5H5z',
  telescope: 'M3.5 14.5l12-6 2 4-12 6z M15.5 8.5L19 6.8l2 4-3.5 1.7 M10.5 15.5L8 21 M12 14.8L15 21',
  shapes: 'M8.5 3l5 8.5h-10z M16.5 21a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M3.5 14h7v7h-7z',
  ear:
    'M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10a3.5 3.5 0 1 1-7 0 M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 1 1 0 4',
  key:
    'M21 2l-2 2m-7.6 7.6a5.5 5.5 0 1 1-7.8 7.8 5.5 5.5 0 0 1 7.8-7.8zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.9 M16 3.1a4 4 0 0 1 0 7.8',
  planet:
    'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M6.3 10.2C3.6 11 2 12.1 2 13.3c0 2 4.5 3.4 10 3.4s10-1.5 10-3.4c0-1.2-1.6-2.3-4.3-3.1',
  ticket:
    'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4z M14 6v2 M14 11v2 M14 16v2',
  trophy:
    'M8 20.5h8 M12 16v4.5 M7 3.5h10V9a5 5 0 0 1-10 0z M17 5.5h2.5V7a3 3 0 0 1-3 3 M7 5.5H4.5V7a3 3 0 0 0 3 3',
  chip:
    'M6 6h12v12H6z M9.5 9.5h5v5h-5z M9 2.5V6 M15 2.5V6 M9 18v3.5 M15 18v3.5 M2.5 9H6 M2.5 15H6 M18 9h3.5 M18 15h3.5',
  wrench:
    'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.8 3.8z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M15.8 8.2l-2.1 5.5-5.5 2.1 2.1-5.5z',
  fish:
    'M2.5 7.5L6 12l-3.5 4.5 M6 12c2.5-3.6 5.6-5.5 9-5.5 3.2 0 5.6 2.2 6.5 5.5-.9 3.3-3.3 5.5-6.5 5.5-3.4 0-6.5-1.9-9-5.5z M16.5 11h.01',
  car:
    'M5 17H3.5v-4.5l2-5a1.5 1.5 0 0 1 1.4-1h10.2a1.5 1.5 0 0 1 1.4 1l2 5V17H19 M3.5 12.5h17 M9 17h6 M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  palette:
    'M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.4-.7-.4-1.2 0-.9.8-1.7 1.7-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z M7.5 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M10.5 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z M15 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  droplet: 'M12 3c2.5 3.5 6.5 7 6.5 11a6.5 6.5 0 0 1-13 0C5.5 10 9.5 6.5 12 3z',
  flame:
    'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  snowflake:
    'M12 2.5v19 M3.8 7.25l16.4 9.5 M3.8 16.75l16.4-9.5 M9.5 4l2.5 2 2.5-2 M9.5 20l2.5-2 2.5 2',
  feather: 'M20.2 12.2a6 6 0 0 0-8.5-8.5L5 10.5V19h8.5z M16 8L2 22 M17.5 15H9',
  cup:
    'M17 8h1a4 4 0 0 1 0 8h-1 M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z M6.5 2v3 M10 2v3 M13.5 2v3',
  flower:
    'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M9 6a3 3 0 1 0 6 0 3 3 0 1 0-6 0z M15 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0z M9 18a3 3 0 1 0 6 0 3 3 0 1 0-6 0z M3 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  shuffle: 'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 7v5l3 2',
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z',
  sparkline: 'M3 17l5-6 4 3 5-8 4 5',

  box: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8',
  trendDown: 'M22 17l-8-8-4 4-8-8 M16 17h6v-6',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.3 M12 16.8h.01',
  // Finance v3: a transfer between accounts, a one-click quick add, settings.
  swap: 'M7 4L3 8l4 4 M3 8h14 M17 12l4 4-4 4 M21 16H7',
  sliders: 'M4 7h10 M18 7h2 M16 5v4 M4 17h3 M11 17h9 M9 15v4',
  // One star drawn twice: stroked for an empty slot, filled for a given one,
  // so a rating reads by shape as well as by colour.
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  starFilled: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z M10 20.5a2 2 0 0 0 4 0',
  archive: 'M3 4h18v4H3z M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8 M10 12h4',
  external: 'M15 3h6v6 M10 14L21 3 M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  more: 'M5 12h.01 M12 12h.01 M19 12h.01',
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
  arrowDown: 'M12 5v14 M19 12l-7 7-7-7',
  // Notes v3
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  list: 'M9 6h11 M9 12h11 M9 18h11 M4.5 6h.01 M4.5 12h.01 M4.5 18h.01',
};

/**
 * Icons that read better filled than stroked.
 *
 * A play triangle drawn as an outline at 16px is mostly hole, and a hairline
 * one is hard to hit visually next to solid text.
 */
const FILLED: IconName[] = ['play', 'pause', 'starFilled'];

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
