/**
 * Shared chart styling.
 *
 * Extracted the moment a second page needed it. It briefly lived in
 * FinancePage, which made FitnessPage import from FinancePage - a page-to-page
 * dependency that also meant opening Fitness pulled the whole Finance bundle,
 * charts included, for one style object.
 */
export const TOOLTIP_STYLE = {
  background: 'var(--background-elevated)',
  border: '1px solid var(--glass-border-strong)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
} as const;
