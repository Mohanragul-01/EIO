/**
 * A browser stand-in for the `expo` package.
 *
 * The shared notification module calls `isRunningInExpoGo()` to decide whether
 * loading the native notification library is safe. A browser is not Expo Go,
 * so the honest answer is false - and false is also the answer that makes the
 * app's OWN fallback do the work: it goes on to require expo-notifications,
 * gets the empty stub next door, and the guarded try/catch there switches
 * reminders off exactly as it does in any build without the native module.
 *
 * Lying with `true` would reach the same end state by a path the app never
 * intended, and would quietly diverge if that check ever changed meaning.
 */
export function isRunningInExpoGo(): boolean {
  return false;
}
