/**
 * export.ts - write the CSV to a file and hand it to the OS share sheet.
 *
 * Separate from analytics.ts so the formatting stays pure and testable: this
 * file is all side effects (filesystem, share sheet) and none of the logic.
 *
 * No server is involved. The file is written to the cache directory, which the
 * system is free to clear whenever it likes - correct here, because the file
 * exists only long enough to be handed to whatever app you pick. Writing to
 * the document directory instead would quietly accumulate exports forever.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import * as api from './api';
import { exportFilename, toCsv } from './analytics';

export type ExportResult =
  | { status: 'shared'; rows: number }
  | { status: 'empty' }
  | { status: 'unavailable'; rows: number; uri: string };

/**
 * Export transactions as CSV and open the share sheet.
 *
 * Returns what happened rather than throwing for the non-error cases, because
 * "you have nothing to export" and "this device cannot share" are both normal
 * outcomes the screen should explain, not failures.
 */
export async function exportTransactionsCsv(range?: {
  start: string;
  end: string;
}): Promise<ExportResult> {
  const rows = await api.listForExport(range);
  // Refuse rather than producing a file with only a header row, which looks
  // like a broken export.
  if (rows.length === 0) return { status: 'empty' };

  const csv = toCsv(rows);

  const file = new File(Paths.cache, exportFilename());
  // Overwrite: two exports on the same day share a filename, and the newer one
  // is the one you asked for.
  file.create({ overwrite: true });
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) {
    // The file is written and valid; only the share sheet is missing. Hand back
    // the path so the screen can say where it is rather than losing the work.
    return { status: 'unavailable', rows: rows.length, uri: file.uri };
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export transactions',
    // Android reads this when handing off to apps that ask for a UTI.
    UTI: 'public.comma-separated-values-text',
  });

  return { status: 'shared', rows: rows.length };
}
