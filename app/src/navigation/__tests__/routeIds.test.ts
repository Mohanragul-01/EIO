/**
 * Which screens are "one per item".
 *
 * Without an id, React Navigation 7's navigate() to a route that is already
 * open swaps that screen's params instead of opening a new one. So a reminder
 * tapped while you are editing another task would turn the open form into the
 * other task - unsaved edits gone, and until it reloaded, Save writing the old
 * values into the new item. An id per item makes it open its own screen.
 */
import { routeIds } from '../routeIds';

describe('routeIds', () => {
  it('gives an item screen the id of its item', () => {
    expect(routeIds.TodoEdit({ params: { id: 't1' } })).toBe('t1');
    expect(routeIds.CustomRecordEdit({ params: { moduleId: 'm1', recordId: 'r1' } })).toBe('r1');
    expect(routeIds.ProductDetail({ params: { productId: 'p1' } })).toBe('p1');
    expect(routeIds.CustomModuleList({ params: { moduleId: 'm1' } })).toBe('m1');
    expect(routeIds.SubscriptionDetail({ params: { id: 's1' } })).toBe('s1');
  });

  it('gives a create form no id, so it behaves as before', () => {
    expect(routeIds.TodoEdit({ params: { frequency: 'daily' } })).toBeUndefined();
    expect(routeIds.TodoEdit({ params: undefined })).toBeUndefined();
    expect(routeIds.CustomRecordEdit({ params: { moduleId: 'm1' } })).toBeUndefined();
  });
});
