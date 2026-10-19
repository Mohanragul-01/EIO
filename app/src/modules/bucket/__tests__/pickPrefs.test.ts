/**
 * What Pick for me remembers between visits: today's shuffle, and whether the
 * card is folded away.
 *
 * Stored as JSON on the device, so it must survive anything storage can hand
 * back - nothing, garbage, or an older shape - without breaking the screen.
 */
import { parsePickPrefs, serialisePickPrefs } from '../picks';

const today = '2026-10-19';

describe('parsePickPrefs', () => {
  it('keeps today’s shuffle', () => {
    const raw = serialisePickPrefs({ day: today, roll: 3, collapsed: false });
    expect(parsePickPrefs(raw, today)).toEqual({ roll: 3, collapsed: false });
  });

  it('starts a new day unshuffled, but remembers the card was folded', () => {
    const raw = serialisePickPrefs({ day: '2026-10-18', roll: 3, collapsed: true });
    expect(parsePickPrefs(raw, today)).toEqual({ roll: 0, collapsed: true });
  });

  it('falls back quietly on nothing, garbage, or the wrong shape', () => {
    const fresh = { roll: 0, collapsed: false };
    expect(parsePickPrefs(null, today)).toEqual(fresh);
    expect(parsePickPrefs('not json', today)).toEqual(fresh);
    expect(parsePickPrefs('[1,2]', today)).toEqual(fresh);
    expect(parsePickPrefs('{"day":"2026-10-19","roll":"seven"}', today)).toEqual(fresh);
    expect(parsePickPrefs('{"day":"2026-10-19","roll":-2}', today)).toEqual(fresh);
  });
});
