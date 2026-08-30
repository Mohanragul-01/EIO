/**
 * types.ts - the app's navigation map, described to TypeScript.
 *
 * React Navigation is typed by a "param list": an object type where each key
 * is a screen name and each value is the params that screen expects
 * (`undefined` = takes no params).
 *
 * The payoff: `navigation.navigate('TodoList')` autocompletes, and a typo or
 * a missing param becomes a compile error instead of a blank screen at runtime.
 * Every new screen gets one line here.
 */
export type RootStackParamList = {
  Home: undefined;

  // One entry screen per module, plus that module's inner screens.
  TodoList: undefined;
  /**
   * One screen serving both create and edit:
   *   {}          -> create a new task
   *   { id: '...' } -> edit that task
   * Typing it as an optional field is what lets TypeScript accept both calls
   * while still rejecting `navigate('TodoEdit', { todoId: 1 })`.
   */
  /**
   * `frequency` pre-selects the picker when adding from a tab, so adding a
   * weekly task from the Weekly tab needs no extra tap. Ignored when editing,
   * since the row already has one.
   */
  TodoEdit: { id?: string; frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly' };
  NotesList: undefined;
  /**
   * Same create-or-edit pattern as TodoEdit, plus:
   *   `type`  which kind of note to create (note, checklist, journal)
   *   `quick` quick capture: straight into the body, nothing else required
   * Both are ignored when editing, since the row already knows what it is.
   */
  NoteEdit: { id?: string; type?: 'note' | 'checklist' | 'journal'; quick?: boolean };
  FinanceList: undefined;
  TransactionEdit: { id?: string };

  SubscriptionsList: undefined;
  SubscriptionEdit: { id?: string };
  FitnessList: undefined;
  WorkoutEdit: { id?: string };

  //  User-created modules
  // Three screens serve EVERY module you build, however many you create.
  // The moduleId param is what makes one set of screens behave like many.
  /** Design a module: {} to create, { moduleId } to edit an existing one. */
  ModuleBuilder: { moduleId?: string };
  /** The entry list for one custom module. */
  CustomModuleList: { moduleId: string };
  /** The generated form: omit recordId to create, pass it to edit. */
  CustomRecordEdit: { moduleId: string; recordId?: string };
};

/** Every screen name in the app. */
export type RootStackScreenName = keyof RootStackParamList;

/**
 * The screens a module TILE is allowed to point at: those taking no params.
 *
 * Why this exists: the home screen calls `navigate(module.route)` with no
 * params. If the registry allowed any screen name, someone could point a tile
 * at TodoEdit - which needs params - and it would fail at runtime.
 *
 * How it works: this maps over every key, keeps the ones whose params are
 * `undefined`, turns the rest into `never`, then unions the results. `never`
 * vanishes from a union, so only the param-less names survive. The result here
 * is 'Home' | 'TodoList' | 'NotesList' | ... but NOT 'TodoEdit'. Add a
 * param-taking screen later and it's excluded automatically.
 */
export type ModuleEntryScreen = {
  [K in keyof RootStackParamList]: RootStackParamList[K] extends undefined ? K : never;
}[keyof RootStackParamList];
