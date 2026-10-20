/**
 * Reorder reminders: what gets scheduled, and when.
 *
 * Planned as plain data so it can be tested without a phone: the scheduling
 * itself is core/notifications' job. What matters here is the moment each
 * reminder fires (local 09:00, built from the calendar day so a DST change
 * cannot move it), that a past moment is never planned, and that a spare
 * waiting on the shelf silences the "time to reorder" nudge.
 */
import { buildOutlooks } from '../outlook';
import {
  laterDate,
  laterReminder,
  planLater,
  planReminders,
  REMINDER_HOUR,
  REORDER_CATEGORY,
  reminderIdsFor,
} from '../reminders';
import { addDays, type Product, type ProductUse } from '../types';

const TODAY = '2026-10-19';
/** 08:00 on TODAY, local time. */
const MORNING = new Date(2026, 9, 19, 8, 0, 0);

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
  id: `${product_id}-${used_on}`,
  product_id,
  user_id: 'u1',
  used_on,
  quantity,
  note: '',
  created_at: `${used_on}T08:00:00Z`,
});

/** `total` logged over three days from `from`: enough evidence for a pace. */
const threeDays = (product_id: string, from: string, total: number): ProductUse[] => {
  const each = Math.floor(total / 3);
  return [total - 2 * each, each, each].map((quantity, i) =>
    entry(product_id, addDays(from, i), quantity),
  );
};

const at9 = (y: number, m: number, d: number) => new Date(y, m - 1, d, REMINDER_HOUR, 0, 0, 0);

describe('planReminders', () => {
  it('plans the reorder morning and the empty day for a measured container', () => {
    // 10 g a day, 900 g left: empty on 17 Jan, reorder 7 days before.
    const p = product({ id: 'a' });
    const plan = planReminders(
      buildOutlooks([p], threeDays('a', '2026-10-10', 100), TODAY),
      MORNING,
    );

    expect(plan.map((r) => [r.id, r.date.getTime()])).toEqual([
      ['product-a-reorder', at9(2027, 1, 10).getTime()],
      ['product-a-empty', at9(2027, 1, 17).getTime()],
    ]);
    expect(plan[0].title).toBe('Time to reorder Whey');
    expect(plan[0].body).toBe('About 7 days left at your pace, empty around 17 Jan.');
    expect(plan[1].title).toBe('Whey is about empty');
  });

  it('puts Ordered and In 3 days on both, which the Products handler acts on', () => {
    const p = product({ id: 'a' });
    const plan = planReminders(
      buildOutlooks([p], threeDays('a', '2026-10-10', 100), TODAY),
      MORNING,
    );
    expect(plan.map((r) => r.category)).toEqual([REORDER_CATEGORY, REORDER_CATEGORY]);
    // No route: the app-wide router would open the product for a button
    // press too. The handler opens it for a tap instead.
    expect(plan[0].data).toEqual({ productId: 'a', name: 'Whey' });
  });

  it("uses the product's own lead time", () => {
    const p = product({ id: 'a', reorder_lead_days: 14 });
    const [reorder] = planReminders(
      buildOutlooks([p], threeDays('a', '2026-10-10', 100), TODAY),
      MORNING,
    );
    expect(reorder.date.getTime()).toBe(at9(2027, 1, 3).getTime());
    expect(reorder.body).toBe('About 14 days left at your pace, empty around 17 Jan.');
  });

  it('plans nothing that has already passed', () => {
    // 90 g a day, 100 g left: empty tomorrow, so the reorder morning is gone.
    const p = product({ id: 'a' });
    const plan = planReminders(
      buildOutlooks([p], threeDays('a', '2026-10-10', 900), TODAY),
      MORNING,
    );
    expect(plan.map((r) => r.id)).toEqual(['product-a-empty']);
    expect(plan[0].date.getTime()).toBe(at9(2026, 10, 20).getTime());
  });

  it("plans today's 09:00 only while it is still ahead", () => {
    // 55 g a day, 450 g left: empty on 27 Oct, and a lead of 8 days crosses
    // into Reorder now today.
    const p = product({ id: 'a', reorder_lead_days: 8 });
    const outlooks = buildOutlooks([p], threeDays('a', '2026-10-10', 550), TODAY);

    expect(planReminders(outlooks, MORNING).map((r) => r.id)).toEqual([
      'product-a-reorder',
      'product-a-empty',
    ]);

    const tenAm = new Date(2026, 9, 19, 10, 0, 0);
    expect(planReminders(outlooks, tenAm).map((r) => r.id)).toEqual(['product-a-empty']);
  });

  it('keeps quiet about reordering when a spare is waiting, and says so on the empty day', () => {
    const p = product({ id: 'a' });
    const spare = product({ id: 's', opened_on: null });
    const plan = planReminders(
      buildOutlooks([p, spare], threeDays('a', '2026-10-10', 100), TODAY),
      MORNING,
    );
    expect(plan.map((r) => r.id)).toEqual(['product-a-empty']);
    expect(plan[0].body).toBe('Your next one is ready to open.');
    // Nothing to order, so no buttons; a tap opens the product.
    expect(plan[0].category).toBeNull();
    expect(plan[0].data).toEqual({
      productId: 'a',
      route: 'ProductDetail',
      params: { productId: 'a' },
    });
  });

  it('plans nothing for finished containers, spares, or containers without a rate', () => {
    const finished = product({ id: 'f', finished_on: '2026-10-18' });
    const spare = product({ id: 's', name: 'Zinc', opened_on: null });
    const fresh = product({ id: 'n', name: 'Creatine', opened_on: TODAY });
    const uses = [entry('f', '2026-10-10', 100)];
    expect(planReminders(buildOutlooks([finished, spare, fresh], uses, TODAY), MORNING)).toEqual([]);
  });

  it('fires at 09:00 local on the day across a daylight-saving change', () => {
    // New York falls back at 02:00 on 1 November. Empty that day: 09:00, not
    // 08:00 or 10:00, because the time is built from the calendar day.
    const p = product({ id: 'a', opened_on: '2026-10-20', reorder_lead_days: 1 });
    const today = '2026-10-29';
    // 10 days open, 750 used: 75/day, 250 left: 3 days, empty 1 Nov.
    const plan = planReminders(
      buildOutlooks([p], threeDays('a', '2026-10-20', 750), today),
      new Date(2026, 9, 29, 7, 0, 0),
    );
    expect(plan.map((r) => [r.id, r.date.getHours(), r.date.getDate()])).toEqual([
      ['product-a-reorder', 9, 31],
      ['product-a-empty', 9, 1],
    ]);
  });
});

describe('reminderIdsFor', () => {
  it('prefixes every id with the module key, so a resync can clear them all', () => {
    expect(reminderIdsFor('x')).toEqual({ reorder: 'product-x-reorder', empty: 'product-x-empty' });
  });
});

describe('In 3 days', () => {
  it('comes back at 09:00 on the third day, across a daylight-saving change', () => {
    // Pressed on the evening of 29 Oct; New York falls back on 1 Nov.
    const at = laterDate(new Date(2026, 9, 29, 21, 30, 0));
    expect([at.getDate(), at.getMonth(), at.getHours(), at.getMinutes()]).toEqual([1, 10, 9, 0]);
  });

  it('is the reorder reminder again, under its id, with the same buttons', () => {
    const at = at9(2026, 10, 22);
    expect(laterReminder({ id: 'a', name: 'Whey' }, at)).toEqual({
      id: 'product-a-reorder',
      date: at,
      title: 'Time to reorder Whey',
      body: 'You asked to be reminded today. Ordered it? Tap Ordered.',
      category: REORDER_CATEGORY,
      data: { productId: 'a', name: 'Whey' },
    });
  });
});

describe('planLater', () => {
  // The crossing has passed (90 g a day, 100 g left), so the plan has no
  // reorder reminder of its own: a snooze is all that brings it back.
  const outlooksWith = (...extra: Product[]) =>
    buildOutlooks([product({ id: 'a' }), ...extra], threeDays('a', '2026-10-10', 900), TODAY);
  const ahead = at9(2026, 10, 22).getTime();

  it('puts back a snooze still ahead for a container still to reorder', () => {
    const outlooks = outlooksWith();
    const plan = planReminders(outlooks, MORNING);
    expect(planLater(outlooks, { a: ahead }, plan, MORNING)).toEqual([
      laterReminder({ id: 'a', name: 'Whey' }, new Date(ahead)),
    ]);
  });

  it('drops one that has passed, or whose product is gone, finished or has a spare', () => {
    const passed = at9(2026, 10, 18).getTime();
    expect(planLater(outlooksWith(), { a: passed }, [], MORNING)).toEqual([]);
    expect(planLater(outlooksWith(), { gone: ahead }, [], MORNING)).toEqual([]);

    const spare = product({ id: 's', opened_on: null });
    expect(planLater(outlooksWith(spare), { a: ahead }, [], MORNING)).toEqual([]);

    const done = buildOutlooks([product({ id: 'a', finished_on: TODAY })], [], TODAY);
    expect(planLater(done, { a: ahead }, [], MORNING)).toEqual([]);
  });

  it("gives way to the plan's own reorder reminder", () => {
    // A slower pace moved the crossing ahead again: that reminder stands.
    const outlooks = buildOutlooks(
      [product({ id: 'a' })],
      threeDays('a', '2026-10-10', 100),
      TODAY,
    );
    const plan = planReminders(outlooks, MORNING);
    expect(planLater(outlooks, { a: ahead }, plan, MORNING)).toEqual([]);
  });
});
