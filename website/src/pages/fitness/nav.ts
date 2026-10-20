/**
 * nav.ts - where the Fitness page can go.
 *
 * Everything lives in the URL's search params (#/fitness?tab=routines,
 * #/fitness?session=<id>), so Back, refresh and a bookmarked session all work
 * without the shared route table knowing anything about Fitness.
 */
export type FitnessTab = 'log' | 'routines' | 'exercises' | 'body';

export const FITNESS_TABS: FitnessTab[] = ['log', 'routines', 'exercises', 'body'];

export function parseTab(value: string | null): FitnessTab {
  return FITNESS_TABS.includes(value as FitnessTab) ? (value as FitnessTab) : 'log';
}

export type FitnessNav = {
  tab: (tab: FitnessTab) => void;
  session: (id: string) => void;
  summary: (id: string) => void;
  exercise: (id: string) => void;
  ladder: (id: string) => void;
  /** Back to wherever you came from, or to the tab when you arrived by link. */
  back: () => void;
};
