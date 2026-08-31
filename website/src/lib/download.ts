/**
 * download.ts - hand a generated file to the browser.
 *
 * The web counterpart to app/src/modules/finance/export.ts. The CSV itself is
 * built by the shared `toCsv`, so both clients export byte-identical files;
 * only the delivery differs - a share sheet on the phone, a download here.
 */

/**
 * Save text as a file.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking
 * in the same frame as the click can cancel the download in some browsers,
 * because the fetch of the blob has not started yet. Not revoking at all leaks
 * the whole file for as long as the tab is open.
 */
export function downloadText(filename: string, text: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  // Appended to the document because Firefox ignores a click on a link that is
  // not in the DOM.
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadCsv(filename: string, csv: string): void {
  // The BOM is what makes Excel read the file as UTF-8. Without it, any
  // non-ASCII character in a note - including the rupee sign - is mangled on
  // open, and the file looks corrupt even though it is correct.
  downloadText(filename, `﻿${csv}`, 'text/csv;charset=utf-8');
}
