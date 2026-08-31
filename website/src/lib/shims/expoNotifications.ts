/**
 * A deliberately EMPTY stand-in for `expo-notifications`.
 *
 * Local notifications are scheduled by a phone's operating system and survive
 * the app being closed. A browser cannot do that, so the website genuinely has
 * no equivalent and should not pretend to - a web notification that only fires
 * while this tab happens to be open is worse than none, because you would rely
 * on it.
 *
 * The stub exists only so the bundler can resolve the require. Because it
 * exports no `setNotificationHandler`, the shared loader's call throws and its
 * catch marks notifications unavailable - the same path a production build
 * without the native module takes. Every reminder function then returns
 * harmlessly, and `ensurePermission()` reports 'unsupported', which is the
 * truth.
 */
export {};
