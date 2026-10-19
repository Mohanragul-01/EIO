/**
 * Note colours: one swatch per colour, shown on both themes.
 *
 * Two promises are pinned here. The edge stripe must be visible on both
 * canvases (3:1, the floor for non-text UI), and the tint must be faint enough
 * that every text style a card uses - down to the faint timestamp - still
 * clears 4.5:1 on top of it. A colour that made its own note unreadable would
 * be worse than no colour.
 */
import { blendOver, contrastRatio } from '../../../core/contrast';
import { darkColors, lightColors } from '../../../core/theme';
import { NOTE_COLORS, noteTint, readNoteColor } from '../noteColors';

describe('NOTE_COLORS', () => {
  it('offers seven distinct colours with names', () => {
    expect(NOTE_COLORS).toHaveLength(7);
    expect(new Set(NOTE_COLORS.map((c) => c.key)).size).toBe(7);
    expect(new Set(NOTE_COLORS.map((c) => c.swatch)).size).toBe(7);
    NOTE_COLORS.forEach((c) => expect(c.label.length).toBeGreaterThan(0));
  });

  it.each(NOTE_COLORS.map((c) => [c.label, c.swatch]))(
    '%s stripe is visible on both canvases',
    (_label, swatch) => {
      for (const palette of [darkColors, lightColors]) {
        expect(contrastRatio(swatch, palette.background)).toBeGreaterThanOrEqual(3);
        expect(contrastRatio(swatch, palette.backgroundElevated)).toBeGreaterThanOrEqual(3);
      }
    },
  );

  // Only text and textSecondary, and that is the rule NoteCard follows: on a
  // coloured card every caption and timestamp is drawn in textSecondary. Muted
  // and faint sit only just over 4.5:1 on the bare light canvas (by design,
  // the least that passes), so any visible tint takes them under - the same
  // reason text on the `completed` tint is limited to these two.
  it.each(NOTE_COLORS.map((c) => [c.label, c.swatch]))(
    '%s tint keeps the card text styles it uses readable',
    (_label, swatch) => {
      for (const palette of [darkColors, lightColors]) {
        const surface = blendOver(noteTint(swatch), palette.background);
        for (const text of [palette.text, palette.textSecondary]) {
          expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
    },
  );

  it('would fail faint text, which is why coloured cards do not use it', () => {
    const surface = blendOver(noteTint(NOTE_COLORS[0].swatch), lightColors.background);
    expect(contrastRatio(lightColors.textFaint, surface)).toBeLessThan(4.5);
  });
});

describe('readNoteColor', () => {
  it('finds a known key', () => {
    expect(readNoteColor('blue')?.label).toBe('Blue');
  });

  it('treats anything else as no colour rather than failing', () => {
    // A key from a later version, a typo written by hand, or null.
    expect(readNoteColor('magenta')).toBeNull();
    expect(readNoteColor('')).toBeNull();
    expect(readNoteColor(null)).toBeNull();
    expect(readNoteColor(undefined)).toBeNull();
  });
});

describe('noteTint', () => {
  it('is the swatch at low opacity', () => {
    expect(noteTint('#3366CC')).toMatch(/^rgba\(51, 102, 204, 0\.\d+\)$/);
  });
});
