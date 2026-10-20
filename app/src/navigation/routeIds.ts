/**
 * routeIds - the screens that are one per item, and the item that names each.
 *
 * Given to a Stack.Screen as getId. Without one, React Navigation 7's
 * navigate() to a route already open swaps that screen's params rather than
 * opening a new screen: a reminder tapped while you edit another task would
 * turn the open form into the other task, unsaved edits gone, and Save would
 * write the old form's values into the new item until it reloaded.
 *
 * A create form has no item yet: undefined, which keeps the old behaviour.
 */
import type { RootStackParamList } from './types';

type IdOf<R extends keyof RootStackParamList> = (route: {
  params: RootStackParamList[R] | undefined;
}) => string | undefined;

export const routeIds: {
  TodoEdit: IdOf<'TodoEdit'>;
  CustomRecordEdit: IdOf<'CustomRecordEdit'>;
  ProductDetail: IdOf<'ProductDetail'>;
  CustomModuleList: IdOf<'CustomModuleList'>;
  SubscriptionDetail: IdOf<'SubscriptionDetail'>;
} = {
  TodoEdit: ({ params }) => params?.id,
  CustomRecordEdit: ({ params }) => params?.recordId,
  ProductDetail: ({ params }) => params?.productId,
  CustomModuleList: ({ params }) => params?.moduleId,
  SubscriptionDetail: ({ params }) => params?.id,
};
