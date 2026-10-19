/**
 * markdownEdit.ts - the edits behind the formatting bar and the Enter key.
 *
 * Every function takes the text and the selection and returns both, so the
 * input is updated in one step and the caret lands where the next keystroke
 * belongs. Pure, so the same edits drive the phone's bar and the website's
 * toolbar, and so they can be tested without a keyboard.
 *
 * The rules follow the phone keyboard rather than a desktop editor: there is
 * no Tab, so lists continue on Enter; a bar button applied twice undoes
 * itself, because that is the only "undo" a toolbar has.
 */
import { safeHref } from './markdown';

export type Selection = { start: number; end: number };
export type Edit = { text: string; selection: Selection };

export type LineFormat = 'task' | 'bullet' | 'numbered' | 'quote' | 'heading';

/* ENTER CONTINUES A LIST --------------------------------------------------- */

const CONTINUE_TASK = /^(\s*)([-*+]\s+)?\[(?: |x|X)?\](?=\s|$)\s*/;
const CONTINUE_BULLET = /^(\s*)([-*+])\s+/;
const CONTINUE_NUMBERED = /^(\s*)(\d{1,9})([.)])\s+/;
const CONTINUE_QUOTE = /^(\s*)>\s?/;

/**
 * Given the text before and after a change, decide whether it was Enter at
 * the end of (or inside) a list item, and if so return the text with the
 * list carried on - or ended, when Enter was pressed on an empty item.
 *
 * Returns null for anything else, and the caller keeps the change as typed.
 *
 * `caret` is where the caret was BEFORE the change. It is needed because two
 * different presses can produce identical text: Enter at the end of "- a" and
 * at the start of the "- b" below it both give "- a\n\n- b", and only the
 * caret says which line to continue. Without one, the first difference
 * between the two strings is taken as the place Enter went.
 */
export function continueList(prev: string, next: string, caret?: number): Edit | null {
  if (next.length !== prev.length + 1) return null;

  let at: number;
  if (
    caret !== undefined &&
    caret >= 0 &&
    caret <= prev.length &&
    next === prev.slice(0, caret) + '\n' + prev.slice(caret)
  ) {
    at = caret;
  } else {
    at = 0;
    while (at < prev.length && prev[at] === next[at]) at += 1;
    if (next[at] !== '\n' || next.slice(at + 1) !== prev.slice(at)) return null;
  }

  const lineStart = prev.lastIndexOf('\n', at - 1) + 1;
  const lineEndIndex = prev.indexOf('\n', at);
  const lineEnd = lineEndIndex === -1 ? prev.length : lineEndIndex;
  const beforeCaret = prev.slice(lineStart, at);
  const afterCaret = prev.slice(at, lineEnd);

  const prefix = continuationOf(beforeCaret);
  if (!prefix) return null;

  // Enter on an item with nothing in it ends the list: the marker goes, and
  // no new line is added - the same as every phone notes app.
  if ((beforeCaret.slice(prefix.matched.length) + afterCaret).trim() === '') {
    const text = prev.slice(0, lineStart) + prev.slice(lineEnd);
    return { text, selection: { start: lineStart, end: lineStart } };
  }

  const text = prev.slice(0, at) + '\n' + prefix.next + prev.slice(at);
  const cursor = at + 1 + prefix.next.length;
  return { text, selection: { start: cursor, end: cursor } };
}

/** The marker this line starts with, and the one the next line should get. */
function continuationOf(line: string): { matched: string; next: string } | null {
  const task = CONTINUE_TASK.exec(line);
  if (task) {
    // A new box is always empty, whatever state this one is in.
    return { matched: task[0], next: `${task[1]}${task[2] ? task[2].trim() + ' ' : ''}[ ] ` };
  }
  const numbered = CONTINUE_NUMBERED.exec(line);
  if (numbered) {
    return {
      matched: numbered[0],
      next: `${numbered[1]}${Number(numbered[2]) + 1}${numbered[3]} `,
    };
  }
  const bullet = CONTINUE_BULLET.exec(line);
  if (bullet) return { matched: bullet[0], next: `${bullet[1]}${bullet[2]} ` };

  const quote = CONTINUE_QUOTE.exec(line);
  if (quote) return { matched: quote[0], next: `${quote[1]}> ` };

  return null;
}

/* LINE FORMATS ------------------------------------------------------------- */

type LineParts = {
  indent: string;
  kind: LineFormat | null;
  /** Heading level, 0 when the line is not a heading. */
  level: number;
  content: string;
};

const LINE_HEADING = /^(\s*)(#{1,6})\s+(.*)$/;
const LINE_TASK = /^(\s*)(?:[-*+]\s+)?\[(?: |x|X)?\](?:\s+(.*))?$/;
const LINE_BULLET = /^(\s*)[-*+]\s+(.*)$/;
const LINE_NUMBERED = /^(\s*)\d{1,9}[.)]\s+(.*)$/;
const LINE_QUOTE = /^(\s*)>\s?(.*)$/;
const LINE_PLAIN = /^(\s*)(.*)$/;

function splitLine(line: string): LineParts {
  let m = LINE_HEADING.exec(line);
  if (m) return { indent: m[1], kind: 'heading', level: m[2].length, content: m[3] };
  m = LINE_TASK.exec(line);
  if (m) return { indent: m[1], kind: 'task', level: 0, content: m[2] ?? '' };
  m = LINE_BULLET.exec(line);
  if (m) return { indent: m[1], kind: 'bullet', level: 0, content: m[2] };
  m = LINE_NUMBERED.exec(line);
  if (m) return { indent: m[1], kind: 'numbered', level: 0, content: m[2] };
  m = LINE_QUOTE.exec(line);
  if (m) return { indent: m[1], kind: 'quote', level: 0, content: m[2] };
  m = LINE_PLAIN.exec(line) as RegExpExecArray;
  return { indent: m[1], kind: null, level: 0, content: m[2] };
}

/**
 * Turn the caret's line - or every line the selection touches - into a
 * checkbox, bullet, numbered item, quote or heading, replacing whatever list
 * marker it had. If every line already is that kind, the marker comes off
 * instead, so the same button undoes itself. A heading cycles # → ## → none.
 *
 * In a selection of several lines, blank ones are left blank rather than
 * becoming empty bullets; numbers count only the lines that got one.
 */
export function toggleLinePrefix(text: string, selection: Selection, kind: LineFormat): Edit {
  const { start, end } = normalise(selection, text.length);

  const blockStart = text.lastIndexOf('\n', start - 1) + 1;
  // A selection dragged to the very start of the next line does not include it.
  const lastIndex = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const blockEndIndex = text.indexOf('\n', lastIndex);
  const blockEnd = blockEndIndex === -1 ? text.length : blockEndIndex;

  const lines = text.slice(blockStart, blockEnd).split('\n');
  const parts = lines.map(splitLine);
  const several = lines.length > 1;
  const skip = (p: LineParts) => several && p.kind === null && p.content.trim() === '';

  let prefixFor: (p: LineParts, index: number) => string;
  if (kind === 'heading') {
    const current = parts[0].kind === 'heading' ? parts[0].level : 0;
    const level = current === 0 ? 1 : current === 1 ? 2 : 0;
    prefixFor = () => (level === 0 ? '' : '#'.repeat(level) + ' ');
  } else {
    const allHave = parts.filter((p) => !skip(p)).every((p) => p.kind === kind);
    prefixFor = (_p, index) => {
      if (allHave) return '';
      switch (kind) {
        case 'task':
          return '- [ ] ';
        case 'bullet':
          return '- ';
        case 'numbered':
          return `${index + 1}. `;
        case 'quote':
          return '> ';
      }
    };
  }

  // Rebuild line by line, remembering how far each line's marker moved so the
  // selection can follow the words it was on.
  const rebuilt: string[] = [];
  const shifts: { oldStart: number; oldPrefix: number; newStart: number; newPrefix: number }[] = [];
  let oldCursor = blockStart;
  let newCursor = blockStart;
  let counted = 0;

  lines.forEach((line, i) => {
    const p = parts[i];
    const oldPrefix = line.length - p.content.length;
    let next: string;
    if (skip(p)) {
      next = line;
    } else {
      next = p.indent + prefixFor(p, counted) + p.content;
      counted += 1;
    }
    const newPrefix = next.length - p.content.length;
    shifts.push({ oldStart: oldCursor, oldPrefix, newStart: newCursor, newPrefix: skip(p) ? oldPrefix : newPrefix });
    rebuilt.push(next);
    oldCursor += line.length + 1;
    newCursor += next.length + 1;
  });

  const mapped = (position: number) => {
    let shift = shifts[0];
    for (const s of shifts) if (position >= s.oldStart) shift = s;
    const offset = position - shift.oldStart;
    // A caret inside the old marker lands just after the new one.
    if (offset <= shift.oldPrefix) return shift.newStart + shift.newPrefix;
    return shift.newStart + shift.newPrefix + (offset - shift.oldPrefix);
  };

  const newText = text.slice(0, blockStart) + rebuilt.join('\n') + text.slice(blockEnd);
  return { text: newText, selection: { start: mapped(start), end: mapped(end) } };
}

/* INLINE FORMATS ----------------------------------------------------------- */

/**
 * Bold (`**`) or italic (`*`) around the selection, or off again.
 *
 * Asterisks rather than underscores for italic, because an underscore cannot
 * open inside a word and the selection might be half of one. Whitespace at
 * the edges of the selection is kept OUTSIDE the markers: double-tapping a
 * word on Android often selects its trailing space, and "**milk **" would not
 * read as bold at all.
 *
 * "Already formatted" is judged by the run of asterisks on each side: two or
 * more for bold, an odd number (1, or 3 for bold-and-italic) for italic, so
 * italicising a bold word wraps it rather than eating one of its asterisks.
 */
export function wrapSelection(text: string, selection: Selection, marker: '**' | '*'): Edit {
  const width = marker.length;
  const formatted = (run: number) => (width === 2 ? run >= 2 : run % 2 === 1);
  let { start, end } = normalise(selection, text.length);

  if (start === end) {
    if (formatted(runBefore(text, start)) && formatted(runAfter(text, end)) && runBefore(text, start) === runAfter(text, end)) {
      const caret = start - width;
      return {
        text: text.slice(0, caret) + text.slice(end + width),
        selection: { start: caret, end: caret },
      };
    }
    const caret = start + width;
    return {
      text: text.slice(0, start) + marker + marker + text.slice(end),
      selection: { start: caret, end: caret },
    };
  }

  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  if (start === end) return { text, selection };

  const selected = text.slice(start, end);

  if (formatted(runBefore(text, start)) && formatted(runAfter(text, end))) {
    return {
      text: text.slice(0, start - width) + selected + text.slice(end + width),
      selection: { start: start - width, end: end - width },
    };
  }

  const lead = runAfter(selected, 0);
  const trail = runBefore(selected, selected.length);
  if (selected.length > width * 2 && lead < selected.length && formatted(lead) && formatted(trail)) {
    const inner = selected.slice(width, selected.length - width);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      selection: { start, end: start + inner.length },
    };
  }

  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    selection: { start: start + width, end: end + width },
  };
}

/**
 * A link around the selection. Selected words become the label with the
 * caret on the address; a selected address becomes the target with the caret
 * on the label; nothing selected inserts an empty link, label first.
 */
export function insertLink(text: string, selection: Selection): Edit {
  let { start, end } = normalise(selection, text.length);
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;

  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  if (selected && safeHref(selected)) {
    const caret = start + 1;
    return { text: `${before}[](${selected})${after}`, selection: { start: caret, end: caret } };
  }

  const caret = selected ? start + 1 + selected.length + '](https://'.length : start + 1;
  return { text: `${before}[${selected}](https://)${after}`, selection: { start: caret, end: caret } };
}

/* HELPERS ------------------------------------------------------------------ */

function normalise(selection: Selection, length: number): Selection {
  const clamp = (n: number) => Math.max(0, Math.min(length, n));
  const a = clamp(selection.start);
  const b = clamp(selection.end);
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

/** How many asterisks end just before `index`. */
function runBefore(text: string, index: number): number {
  let n = 0;
  while (index - n - 1 >= 0 && text[index - n - 1] === '*') n += 1;
  return n;
}

/** How many asterisks start at `index`. */
function runAfter(text: string, index: number): number {
  let n = 0;
  while (index + n < text.length && text[index + n] === '*') n += 1;
  return n;
}
