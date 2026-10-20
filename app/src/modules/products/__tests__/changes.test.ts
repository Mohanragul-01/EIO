/**
 * The change signal between the products screens.
 *
 * A toast outlives the screen that raised it, so an Undo tapped after going
 * back to the list writes from a screen that is gone. The list hears about it
 * through this signal; a screen never hears its own writes, which it has
 * already shown.
 */
import { onProductsChanged, productsChanged } from '../changes';

it('tells every other listener, not the one that made the change', () => {
  const list = { name: 'list' };
  const detail = { name: 'detail' };
  const heardByList = jest.fn();
  const heardByDetail = jest.fn();

  const stopList = onProductsChanged(list, heardByList);
  const stopDetail = onProductsChanged(detail, heardByDetail);

  productsChanged(detail);
  expect(heardByList).toHaveBeenCalledTimes(1);
  expect(heardByDetail).not.toHaveBeenCalled();

  stopList();
  stopDetail();
});

it('stops telling a listener once it unsubscribes', () => {
  const owner = {};
  const heard = jest.fn();
  const stop = onProductsChanged(owner, heard);
  stop();
  productsChanged({});
  expect(heard).not.toHaveBeenCalled();
});

it('tells everyone when the change has no owner on screen', () => {
  const heard = jest.fn();
  const stop = onProductsChanged({}, heard);
  productsChanged(null);
  expect(heard).toHaveBeenCalledTimes(1);
  stop();
});
