/**
 * Where a tapped notification goes.
 *
 * A module says, in the notification's data, which screen a tap opens and
 * which screen each of its buttons opens; the navigator only reads that. So a
 * module can add a reminder without the navigator learning about it, and a
 * notification from an older build (no route in its data) does nothing rather
 * than crash.
 */
import { targetFor } from '../notificationTarget';

const data = {
  route: 'SubscriptionDetail',
  params: { id: 'abc' },
  actions: { mark_paid: { route: 'SubscriptionDetail', params: { id: 'abc', action: 'pay' } } },
};

/** The rest of a response, which routing does not read. */
const tapped = { notificationId: 'n', title: null, body: null };

describe('targetFor', () => {
  it('opens the route in the data for a tap', () => {
    expect(targetFor({ ...tapped, action: null, data })).toEqual({
      route: 'SubscriptionDetail',
      params: { id: 'abc' },
    });
  });

  it('opens the button its own route', () => {
    expect(targetFor({ ...tapped, action: 'mark_paid', data })).toEqual({
      route: 'SubscriptionDetail',
      params: { id: 'abc', action: 'pay' },
    });
  });

  it('falls back to the tap route for a button it does not know', () => {
    expect(targetFor({ ...tapped, action: 'snooze', data })?.params).toEqual({ id: 'abc' });
  });

  it('does nothing for a notification without a route', () => {
    // v2's reminders carried only { subscriptionId }.
    expect(targetFor({ ...tapped, action: null, data: { subscriptionId: 'abc' } })).toBeNull();
  });

  it('ignores malformed data rather than throwing', () => {
    expect(targetFor({ ...tapped, action: null, data: { route: 7 } })).toBeNull();
    expect(targetFor({ ...tapped, action: null, data: { route: 'X', params: { id: 5 } } })).toEqual(
      { route: 'X', params: {} },
    );
    expect(targetFor({ ...tapped, action: 'a', data: { route: 'X', actions: 'nope' } })).toEqual({
      route: 'X',
      params: {},
    });
  });
});
