/**
 * Outlooks: everything a product card says, worked out once.
 *
 * The list, the detail screen, the website, both home tiles and the reminders
 * all describe the same containers. If each assembled its own picture, a spare
 * could silence the reminder but not the tile, or the website could count
 * "to reorder" differently from the phone - which v2 did. So it is composed
 * here, and these tests pin the composition.
 */
import {
  buildOutlooks,
  chipsFor,
  deleteSummary,
  loggedAllMessage,
  loggedMessage,
  removedMessage,
  remainingFraction,
  reorderMarker,
  reorderSummary,
} from '../outlook';
import { addDaysISO, todayISO } from '../../../core/date';
import type { Product, ProductUse } from '../types';

const TODAY = '2026-10-19';

let seq = 0;
const product = (over: Partial<Product> = {}): Product => ({
  id: `p${++seq}`,
  user_id: 'u1',
  name: 'Whey',
  category: 'supplement',
  unit: 'g',
  total_quantity: 1000,
  per_use: 30,
  price_minor: null,
  opened_on: '2026-10-10',
  finished_on: null,
  note: '',
  previous_id: null,
  expires_on: null,
  pao_months: null,
  reorder_lead_days: null,
  created_at: '2026-10-10T00:00:00Z',
  updated_at: '2026-10-10T00:00:00Z',
  ...over,
});

const entry = (product_id: string, used_on: string, quantity: number): ProductUse => ({
  id: `${product_id}-${used_on}-${quantity}`,
  product_id,
  user_id: 'u1',
  used_on,
  quantity,
  note: '',
  created_at: `${used_on}T08:00:00Z`,
});

/** `total` logged on 10, 11 and 12 Oct: enough evidence for a pace. */
const threeDays = (id: string, total: number): ProductUse[] => {
  const each = Math.floor(total / 3);
  return [
    entry(id, '2026-10-10', total - 2 * each),
    entry(id, '2026-10-11', each),
    entry(id, '2026-10-12', each),
  ];
};

// Opened 10 Oct; 900 g used over the 10 days to the 19th = 90 g/day, 100 g
// left: 1 day. Reorder now.
const nearlyEmpty = (id: string, over: Partial<Product> = {}) => ({
  product: product({ id, ...over }),
  uses: threeDays(id, 900),
});

// 100 g used over 10 days = 10 g/day, 900 g left: 90 days. Plenty.
const plenty = (id: string, over: Partial<Product> = {}) => ({
  product: product({ id, ...over }),
  uses: threeDays(id, 100),
});

describe('buildOutlooks', () => {
  it("projects each container from its own uses only", () => {
    const a = nearlyEmpty('a');
    const b = plenty('b', { name: 'Creatine' });
    const [oa, ob] = buildOutlooks([a.product, b.product], [...a.uses, ...b.uses], TODAY);
    expect(oa.projection.used).toBe(900);
    expect(ob.projection.used).toBe(100);
    expect(oa.urgency).toBe('critical');
    expect(ob.urgency).toBe('ok');
  });

  it('needs reordering at Reorder now, with no spare', () => {
    const a = nearlyEmpty('a');
    const [outlook] = buildOutlooks([a.product], a.uses, TODAY);
    expect(outlook.needsReorder).toBe(true);
    expect(outlook.spare).toBeNull();
  });

  it('does not need reordering when a spare is waiting', () => {
    const a = nearlyEmpty('a');
    const spare = product({ id: 's', opened_on: null });
    const [outlook] = buildOutlooks([a.product, spare], a.uses, TODAY);
    expect(outlook.spare?.id).toBe('s');
    expect(outlook.needsReorder).toBe(false);
    expect(chipsFor(outlook, TODAY)[0]).toEqual({ kind: 'spare-ready', label: 'Next one ready' });
  });

  it('marks the reorder point as empty minus lead days', () => {
    const b = plenty('b', { reorder_lead_days: 10 });
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(outlook.projection.emptyOn).toBe('2027-01-17');
    expect(outlook.reorderOn).toBe('2027-01-07');
  });

  it("estimates from the previous container until there is a measured rate", () => {
    const old = product({ id: 'old', opened_on: '2026-08-29', finished_on: '2026-10-09' }); // 42 days
    const fresh = product({ id: 'new', opened_on: TODAY, previous_id: 'old' });
    const [, outlook] = buildOutlooks([old, fresh], [], TODAY);
    expect(outlook.projection.daysLeft).toBeNull();
    expect(outlook.estimate?.daysLeft).toBe(42);
    // An estimate is not data: the urgency still says so.
    expect(outlook.urgency).toBe('unknown');
  });

  it("keeps the last container's estimate after the first scoop", () => {
    // The last tub lasted 33 days. One 30 g scoop the morning after opening
    // the new one used to replace "~32 days" with "about 2 months", and plan
    // the reorder reminder from that.
    const old = product({ id: 'old', opened_on: '2026-09-15', finished_on: '2026-10-17' }); // 33 days
    const fresh = product({ id: 'new', opened_on: '2026-10-18', previous_id: 'old' });
    const [, outlook] = buildOutlooks([old, fresh], [entry('new', '2026-10-18', 30)], TODAY);
    expect(outlook.projection.daysLeft).toBeNull();
    expect(outlook.estimate?.daysLeft).toBe(32);
    expect(outlook.reorderOn).toBeNull();
  });

  it('drops the estimate once the rate is measured', () => {
    const old = product({ id: 'old', opened_on: '2026-08-29', finished_on: '2026-10-09' });
    const current = product({ id: 'new', opened_on: '2026-10-10', previous_id: 'old' });
    const [, outlook] = buildOutlooks([old, current], threeDays('new', 100), TODAY);
    expect(outlook.projection.daysLeft).toBe(90);
    expect(outlook.estimate).toBeNull();
  });

  it('works out use-by and the expiry conflict', () => {
    const b = plenty('b', { expires_on: '2026-11-18' }); // 90 days of supply, 30 days of shelf
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(outlook.useBy).toBe('2026-11-18');
    expect(outlook.useByState).toBe('soon');
    expect(outlook.conflict).toEqual({ lastsDays: 90, expiresInDays: 30 });
  });
});

describe('chipsFor', () => {
  it('names the urgency in words', () => {
    const b = plenty('b');
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(chipsFor(outlook, TODAY)).toEqual([{ kind: 'plenty', label: 'Plenty left' }]);
  });

  it('puts use-by first when it comes before running out', () => {
    const b = plenty('b', { expires_on: '2026-11-03' });
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(chipsFor(outlook, TODAY)).toEqual([
      { kind: 'use-by', label: 'Use by 3 Nov' },
      { kind: 'plenty', label: 'Plenty left' },
    ]);
  });

  it('puts the reorder first when it runs out before the use-by date', () => {
    const a = nearlyEmpty('a', { expires_on: '2026-11-03' });
    const [outlook] = buildOutlooks([a.product], a.uses, TODAY);
    expect(chipsFor(outlook, TODAY)).toEqual([
      { kind: 'reorder', label: 'Reorder now' },
      { kind: 'use-by', label: 'Use by 3 Nov' },
    ]);
  });

  it('leads with expired, whatever is left', () => {
    const b = plenty('b', { expires_on: '2026-10-18' });
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(chipsFor(outlook, TODAY)[0]).toEqual({ kind: 'expired', label: 'Expired 18 Oct' });
  });

  it('calls a spare a spare, with its printed date when it is close', () => {
    const spare = product({ id: 's', opened_on: null, expires_on: '2026-11-01' });
    const [outlook] = buildOutlooks([spare], [], TODAY);
    expect(chipsFor(outlook, TODAY)).toEqual([
      { kind: 'unopened', label: 'Spare' },
      { kind: 'use-by', label: 'Use by 1 Nov' },
    ]);
  });

  it('says finished and nothing else for a finished container', () => {
    const done = product({ id: 'f', finished_on: '2026-10-15', expires_on: '2026-10-16' });
    const [outlook] = buildOutlooks([done], [], TODAY);
    expect(chipsFor(outlook, TODAY)).toEqual([{ kind: 'finished', label: 'Finished' }]);
  });
});

describe('reorderSummary', () => {
  it('counts what to reorder, what is running low, what is in use and the spares', () => {
    const a = nearlyEmpty('a');
    const c = nearlyEmpty('c', { name: 'Creatine' });
    const spareForC = product({ id: 'sc', name: 'Creatine', opened_on: null });
    // 600 used over 10 days = 60/day, 400 left: 6 days with a 7-day lead is
    // Reorder now; with a lead of 2 it is Running low.
    const low = {
      product: product({ id: 'l', name: 'Zinc', reorder_lead_days: 2 }),
      uses: threeDays('l', 600),
    };
    const done = product({ id: 'f', name: 'Old', finished_on: '2026-10-01', opened_on: '2026-09-01' });

    const outlooks = buildOutlooks(
      [a.product, c.product, spareForC, low.product, done],
      [...a.uses, ...c.uses, ...low.uses],
      TODAY,
    );
    expect(reorderSummary(outlooks)).toEqual({ toReorder: 1, runningLow: 1, inUse: 3, spares: 1 });
  });
});

describe('remainingFraction and reorderMarker', () => {
  it('fills the bar with what is left, not what is used', () => {
    const b = plenty('b');
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(remainingFraction(outlook)).toBeCloseTo(0.9, 5);
  });

  it('puts the marker where a lead time of supply is left', () => {
    // 10 g a day, a 7-day lead: the reorder point is at 70 g of 1000 g.
    const b = plenty('b');
    const [outlook] = buildOutlooks([b.product], b.uses, TODAY);
    expect(reorderMarker(outlook)).toBeCloseTo(0.07, 5);
  });

  it('caps the marker at a full bar and draws none without a rate', () => {
    const fast = nearlyEmpty('a', { reorder_lead_days: 60 });
    const [outlook] = buildOutlooks([fast.product], fast.uses, TODAY);
    expect(reorderMarker(outlook)).toBe(1);

    const unknown = product({ id: 'u', opened_on: TODAY });
    expect(reorderMarker(buildOutlooks([unknown], [], TODAY)[0])).toBeNull();
  });
});

describe('messages', () => {
  it('names the day a use landed on, so a backdated log is confirmed', () => {
    expect(loggedMessage({ quantity: 5, unit: 'g', usedOn: todayISO() })).toBe('Logged 5 g · Today');
    expect(loggedMessage({ quantity: 5, unit: 'g', usedOn: addDaysISO(-1) })).toBe(
      'Logged 5 g · Yesterday',
    );
    expect(loggedMessage({ quantity: 5, unit: 'g', usedOn: todayISO(), name: 'Creatine' })).toBe(
      'Logged 5 g of Creatine · Today',
    );
  });

  it('says what was taken back', () => {
    expect(removedMessage({ quantity: 2.5, unit: 'ml', usedOn: addDaysISO(-1) })).toBe(
      'Removed 2.5 ml · Yesterday',
    );
  });

  it('counts a batch', () => {
    expect(loggedAllMessage(1)).toBe('Logged 1 product · Today');
    expect(loggedAllMessage(4)).toBe('Logged 4 products · Today');
  });

  it('states what deleting a product takes with it', () => {
    expect(deleteSummary(0)).toBe('Nothing has been logged for it yet.');
    expect(deleteSummary(1)).toBe('Deletes 1 logged use.');
    expect(deleteSummary(62)).toBe('Deletes 62 logged uses.');
  });
});
