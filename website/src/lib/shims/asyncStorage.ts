/**
 * Stands in for `@react-native-async-storage/async-storage`.
 *
 * The shared Supabase client passes `storage: AsyncStorage` so a session
 * survives a restart. localStorage is the browser's equivalent, but its API is
 * synchronous while Supabase expects AsyncStorage's promise-returning one, so
 * it is wrapped rather than passed directly.
 *
 * Every method swallows its errors. localStorage throws rather than returning
 * null in a browser with site data blocked, and in private mode in some
 * browsers - and a storage failure should cost you a remembered login, not the
 * whole page.
 */
const memory = new Map<string, string>();

/** True when localStorage is present AND actually usable. */
function usable(): boolean {
  try {
    const probe = '__eio_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const available = typeof window !== 'undefined' && usable();

const AsyncStorage = {
  async getItem(key: string): Promise<string | null> {
    if (!available) return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!available) {
      // A session that lasts until the tab closes still beats one that never
      // starts, which is what throwing here would cause.
      memory.set(key, value);
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      memory.set(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    if (!available) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Already gone, or storage is blocked. Either way there is nothing left
      // to remove and nothing worth reporting.
    }
  },
};

export default AsyncStorage;
