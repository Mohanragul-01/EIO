/**
 * Generate the EIO app icon set from the app's own palette.
 *
 * Run with:  npm install --no-save sharp && node scripts/make-icons.js
 *
 * sharp is not a project dependency on purpose: it is a large native package
 * needed only when the icon changes, which is roughly never.
 *
 * The letters are drawn as vector paths rather than <text>, because SVG text
 * depends on whatever fonts the renderer happens to find, and a missing font
 * silently produces a blank icon or the wrong typeface.
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'assets');

// Straight from src/core/theme.ts, so the icon matches the aurora.
const INDIGO = '#4F46E5';
const VIOLET = '#7C3AED';
const CANVAS = '#12141B';

/**
 * "EIO" drawn with strokes rather than filled shapes.
 *
 * The first attempt used filled rects plus an even-odd ring for the O; the
 * ring came out as a hairline and the letter gaps were uneven. Strokes give
 * one weight everywhere for free, and round caps match the rounded corners
 * used throughout the app.
 *
 * Grid is 0..206 wide by 0..100 tall, with the stroke inset so nothing clips.
 */
function wordmark(fill) {
  const w = 11; // stroke weight, consistent across every letter
  return `
    <g fill="none" stroke="${fill}" stroke-width="${w}"
       stroke-linecap="round" stroke-linejoin="round">
      <!-- E: spine plus three arms -->
      <path d="M 6 6 L 6 94"/>
      <path d="M 6 6  L 48 6"/>
      <path d="M 6 50 L 40 50"/>
      <path d="M 6 94 L 48 94"/>
      <!-- I -->
      <path d="M 78 6 L 78 94"/>
      <!-- O: a plain circle reads better at launcher size than an ellipse -->
      <circle cx="156" cy="50" r="44"/>
    </g>`;
}

/** Full-bleed gradient tile with the wordmark centred. */
function iconSvg(size, { background = true, fill = '#FFFFFF', scale = 0.62 } = {}) {
  const markW = 206; // 6 to 200, the drawn extent
  const markH = 100;
  const targetW = size * scale;
  const k = targetW / markW;
  const x = (size - markW * k) / 2;
  const y = (size - markH * k) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${INDIGO}"/>
        <stop offset="100%" stop-color="${VIOLET}"/>
      </linearGradient>
      <radialGradient id="glow" cx="0.3" cy="0.2" r="0.9">
        <stop offset="0%"   stop-color="#FFFFFF" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${background ? `<rect width="${size}" height="${size}" fill="url(#g)"/>` : ''}
    ${background ? `<rect width="${size}" height="${size}" fill="url(#glow)"/>` : ''}
    <g transform="translate(${x} ${y}) scale(${k})">
      ${wordmark(fill)}
    </g>
  </svg>`;
}

/** Plain gradient, no mark: the Android adaptive-icon background layer. */
function backgroundSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="${INDIGO}"/>
        <stop offset="100%" stop-color="${VIOLET}"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#g)"/>
  </svg>`;
}

async function write(name, svg, size) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(file);
  const { size: bytes } = fs.statSync(file);
  console.log(`  ${name.padEnd(32)} ${size}x${size}  ${(bytes / 1024).toFixed(0)} KB`);
}

(async () => {
  console.log('writing icons:');

  // Main icon: full-bleed gradient, mark at 62%.
  await write('icon.png', iconSvg(1024), 1024);

  // Android adaptive icon. The foreground must sit inside the centre ~66%,
  // because the launcher masks the outer edge to whatever shape the phone uses
  // (circle, squircle, teardrop). A mark drawn edge to edge would get clipped.
  await write(
    'android-icon-foreground.png',
    iconSvg(1024, { background: false, scale: 0.42 }),
    1024,
  );
  await write('android-icon-background.png', backgroundSvg(1024), 1024);

  // Monochrome layer for Android themed icons: shape only, colour comes from
  // the system, so it must be a white silhouette on transparent.
  await write(
    'android-icon-monochrome.png',
    iconSvg(1024, { background: false, scale: 0.42, fill: '#FFFFFF' }),
    1024,
  );

  // Splash: mark on transparent, sits on the themed background from app.json.
  await write('splash-icon.png', iconSvg(512, { background: false, scale: 0.7 }), 512);

  await write('favicon.png', iconSvg(196), 196);

  console.log('done');
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
