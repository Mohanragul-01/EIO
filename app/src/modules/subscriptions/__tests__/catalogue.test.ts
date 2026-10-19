/**
 * The quick-add catalogue and the brand tile.
 *
 * The catalogue is data, so what is tested is that it is GOOD data: every
 * entry pre-fills a form that saves (a real category, a valid colour, a cycle
 * the editor knows, an https link), and search finds things the way people
 * type them.
 */
import { EXPENSE_CATEGORIES } from '../../../core/categories';
import { contrastRatio } from '../../../core/contrast';
import { fallbackColor, monogram, ON_BRAND_DARK, ON_BRAND_LIGHT, readableOn, tileColor } from '../brand';
import { CATALOGUE, findService, searchCatalogue } from '../catalogue';
import { CYCLE_UNITS } from '../cycles';
import { CURRENCIES } from '../currency';

describe('the catalogue data', () => {
  it('has between 60 and 100 services', () => {
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(60);
    expect(CATALOGUE.length).toBeLessThanOrEqual(100);
  });

  it('has unique keys', () => {
    const keys = CATALOGUE.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('pre-fills only values the form and the database accept', () => {
    const categories = new Set(EXPENSE_CATEGORIES.map((c) => c.key));
    const currencies = new Set(CURRENCIES.map((c) => c.code));
    for (const service of CATALOGUE) {
      expect(service.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(categories.has(service.category)).toBe(true);
      expect(CYCLE_UNITS).toContain(service.cycle.unit);
      expect(service.cycle.count).toBeGreaterThanOrEqual(1);
      expect(service.manageUrl).toMatch(/^https:\/\//);
      expect(currencies.has(service.currency ?? 'INR')).toBe(true);
    }
  });

  it('puts Indian services first', () => {
    const firstForeign = CATALOGUE.findIndex((s) => !s.india);
    const lastIndian = CATALOGUE.map((s) => s.india).lastIndexOf(true);
    expect(lastIndian).toBeLessThan(firstForeign);
  });

  it('includes the 28-day prepaid packs as 28-day cycles', () => {
    expect(findService('jio_prepaid')?.cycle).toEqual({ unit: 'day', count: 28 });
    expect(findService('airtel_prepaid')?.cycle).toEqual({ unit: 'day', count: 28 });
  });
});

describe('searchCatalogue', () => {
  it('lists everything, Indian first, for an empty search', () => {
    const all = searchCatalogue('');
    expect(all).toHaveLength(CATALOGUE.length);
    expect(all[0].india).toBe(true);
  });

  it('ignores case, spaces and punctuation', () => {
    expect(searchCatalogue('youtube prem').map((s) => s.key)).toContain('youtube_premium');
    expect(searchCatalogue('ZEE 5').map((s) => s.key)).toEqual(['zee5']);
    expect(searchCatalogue('disney+').map((s) => s.key)).toContain('jiohotstar');
  });

  it('finds a service by an older or shorter name', () => {
    expect(searchCatalogue('hotstar')[0].key).toBe('jiohotstar');
    expect(searchCatalogue('vodafone').map((s) => s.key)).toContain('vi_prepaid');
  });

  it('ranks names that start with the search first', () => {
    const results = searchCatalogue('air');
    expect(results[0].name.toLowerCase().startsWith('air')).toBe(true);
  });

  it('finds nothing for nonsense', () => {
    expect(searchCatalogue('qqqzzz')).toEqual([]);
  });
});

describe('monogram', () => {
  it('takes the first letters of the first two words', () => {
    expect(monogram('Amazon Prime Video')).toBe('AP');
    expect(monogram('ACT Fibernet')).toBe('AF');
    expect(monogram('Disney+ Hotstar')).toBe('DH');
  });

  it('splits a joined-up name at its capital or digit', () => {
    expect(monogram('JioCinema')).toBe('JC');
    expect(monogram('YouTube')).toBe('YT');
    expect(monogram('Zee5')).toBe('Z5');
    expect(monogram('1Password')).toBe('1P');
  });

  it('uses one letter for a plain single word', () => {
    expect(monogram('Netflix')).toBe('N');
    expect(monogram('  spotify ')).toBe('S');
  });

  it('survives an empty name', () => {
    expect(monogram('')).toBe('?');
  });
});

describe('colours', () => {
  it('picks whichever text colour reads better on the tile', () => {
    expect(readableOn('#E50914')).toBe(ON_BRAND_LIGHT); // Netflix red
    expect(readableOn('#FC8019')).toBe(ON_BRAND_DARK); // Swiggy orange
    expect(readableOn('#FFFFFF')).toBe(ON_BRAND_DARK);
    expect(readableOn('#000000')).toBe(ON_BRAND_LIGHT);
  });

  it('never picks the worse of the two', () => {
    for (const { color } of CATALOGUE) {
      const chosen = contrastRatio(readableOn(color), color);
      const other = contrastRatio(
        readableOn(color) === ON_BRAND_LIGHT ? ON_BRAND_DARK : ON_BRAND_LIGHT,
        color,
      );
      expect(chosen).toBeGreaterThanOrEqual(other);
      // Large monogram text needs 3:1; every catalogue colour clears it.
      expect(chosen).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives a stable colour to a subscription without one', () => {
    expect(fallbackColor('My gym')).toBe(fallbackColor('My gym'));
    expect(fallbackColor('My gym')).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('prefers the row colour, then the catalogue, then the fallback', () => {
    expect(tileColor({ color: '#123456', service_key: 'netflix', name: 'Netflix' })).toBe('#123456');
    expect(tileColor({ color: null, service_key: 'netflix', name: 'Netflix' })).toBe(
      findService('netflix')?.color,
    );
    expect(tileColor({ color: null, service_key: null, name: 'Milk' })).toBe(fallbackColor('Milk'));
  });
});
