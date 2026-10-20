/**
 * markdown.ts - the small Markdown a note body is read in.
 *
 * The body is stored as plain text, exactly as typed, and only READ as
 * Markdown. So search keeps working on the words you typed, a note written
 * before v3 reads exactly as it always did (nothing in plain prose is
 * syntax), and the website and the phone render the same text the same way,
 * because they run this same file.
 *
 * Hand-written, not a library, because the subset is small and the two
 * clients must agree on it exactly: the box you tick on the phone has to be
 * the line the website ticks, and toggleTask rewrites the stored text, so a
 * parser that disagreed with it about which line is a box would corrupt a
 * note. Supported, and nothing else:
 *
 *   # ## ###          headings (deeper ones read as ###)
 *   **bold** __bold__ *italic* _italic_  (an underscore inside a word is literal)
 *   - * +             bullets          1. 1)   numbered (the number as written)
 *   > quote           [text](url)      bare https:// and www. addresses
 *   - [ ] - [x]       tasks, and the bare [ ] / [] typed shortcut
 *
 * One block per source line, each remembering its line number, which is what
 * lets a tick in read mode find its way back to the text.
 */
import type { Change } from './types';

export type Span = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  /** Only ever a safe address - see safeHref. */
  href?: string;
};

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3; spans: Span[]; line: number }
  | { kind: 'paragraph'; spans: Span[]; line: number }
  | { kind: 'bullet'; depth: number; spans: Span[]; line: number }
  | { kind: 'numbered'; depth: number; number: number; spans: Span[]; line: number }
  | { kind: 'task'; depth: number; checked: boolean; spans: Span[]; line: number }
  | { kind: 'quote'; spans: Span[]; line: number }
  | { kind: 'blank'; line: number };

const HEADING = /^\s{0,3}(#{1,6})\s+(.*)$/;
// The task test runs before the bullet test, since every dashed task is also
// a bullet. `[` must be followed by a space, an x or nothing, then `]`, then
// whitespace or the end - so `[x](url)` and `[later] call` stay text.
const TASK = /^(\s*)(?:[-*+]\s+)?\[( |x|X)?\](?:\s+(.*))?$/;
const BULLET = /^(\s*)[-*+]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d{1,9})[.)]\s+(.*)$/;
const QUOTE = /^\s{0,3}>\s?(.*)$/;

/** Deepest indent rendered. Further nesting reads at this depth rather than marching off the card. */
const MAX_DEPTH = 4;

export function parseMarkdown(body: string): Block[] {
  if (!body) return [];

  return body.split('\n').map((raw, line): Block => {
    const text = raw.endsWith('\r') ? raw.slice(0, -1) : raw;

    const heading = HEADING.exec(text);
    if (heading) {
      const level = Math.min(heading[1].length, 3) as 1 | 2 | 3;
      return { kind: 'heading', level, spans: parseInline(heading[2]), line };
    }

    const task = TASK.exec(text);
    if (task) {
      return {
        kind: 'task',
        depth: depthOf(task[1]),
        checked: task[2] === 'x' || task[2] === 'X',
        spans: parseInline(task[3] ?? ''),
        line,
      };
    }

    const bullet = BULLET.exec(text);
    if (bullet) {
      return { kind: 'bullet', depth: depthOf(bullet[1]), spans: parseInline(bullet[2]), line };
    }

    const numbered = NUMBERED.exec(text);
    if (numbered) {
      return {
        kind: 'numbered',
        depth: depthOf(numbered[1]),
        number: Number(numbered[2]),
        spans: parseInline(numbered[3]),
        line,
      };
    }

    const quote = QUOTE.exec(text);
    if (quote) return { kind: 'quote', spans: parseInline(quote[1]), line };

    if (text.trim() === '') return { kind: 'blank', line };
    return { kind: 'paragraph', spans: parseInline(text), line };
  });
}

/** Two spaces (or one tab) per level, as phone keyboards make tabs hard to type. */
function depthOf(indent: string): number {
  let width = 0;
  for (const ch of indent) width += ch === '\t' ? 2 : 1;
  return Math.min(MAX_DEPTH, Math.floor(width / 2));
}

/* INLINE ------------------------------------------------------------------- */

type Style = Omit<Span, 'text'>;

const ESCAPABLE = '\\`*_{}[]()#+-.!>~|';
const BARE_URL = /^(?:https?:\/\/|www\.)[^\s<>]+/i;

export function parseInline(text: string): Span[] {
  const out: Span[] = [];
  parseRun(text, {}, out);
  return merge(out);
}

/**
 * One left-to-right pass. A marker only opens if its closer exists, so
 * anything unclosed (a lone asterisk in "2 * 3") falls through as a literal
 * character - prose never loses a character to a half-typed format.
 */
function parseRun(text: string, style: Style, out: Span[]): void {
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ text: buffer, ...style });
    buffer = '';
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];

    if (ch === '\\' && i + 1 < text.length && ESCAPABLE.includes(text[i + 1])) {
      buffer += text[i + 1];
      i += 2;
      continue;
    }

    if (ch === '[' && !style.href) {
      const link = matchLink(text, i);
      if (link) {
        flush();
        const href = safeHref(link.url);
        // An address we will not open still shows its words, just not as a link.
        parseRun(link.label, href ? { ...style, href } : style, out);
        i = link.end;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && text[i + 1] === ch && canOpen(text, i, 2)) {
      const close = findBoldClose(text, i, ch);
      if (close !== -1) {
        flush();
        parseRun(text.slice(i + 2, close), { ...style, bold: true }, out);
        i = close + 2;
        continue;
      }
    }

    if ((ch === '*' || ch === '_') && text[i + 1] !== ch && canOpen(text, i, 1)) {
      const close = findItalicClose(text, i, ch);
      if (close !== -1) {
        flush();
        parseRun(text.slice(i + 1, close), { ...style, italic: true }, out);
        i = close + 1;
        continue;
      }
    }

    if (!style.href && (ch === 'h' || ch === 'H' || ch === 'w' || ch === 'W') && atWordStart(text, i)) {
      const match = BARE_URL.exec(text.slice(i));
      if (match) {
        const url = trimTrailingPunctuation(match[0]);
        const href = safeHref(url);
        if (href) {
          flush();
          out.push({ text: url, ...style, href });
          i += url.length;
          continue;
        }
      }
    }

    buffer += ch;
    i += 1;
  }
  flush();
}

const isSpace = (ch: string | undefined) => ch === undefined || /\s/.test(ch);
// Letters and digits, with anything beyond ASCII counted as a letter (so a
// Hindi or accented word is a word too). Written without \p{L}, which not
// every JavaScript engine the app has run on supports.
const isWordChar = (ch: string | undefined) =>
  ch !== undefined && (/[0-9A-Za-z]/.test(ch) || (ch > '\u007f' && !/\s/.test(ch)));

/**
 * A marker opens only when text follows it directly, and an underscore only
 * at the start of a word - so `snake_case` and `2 * 3` stay as written.
 */
function canOpen(text: string, i: number, width: number): boolean {
  if (isSpace(text[i + width])) return false;
  if (text[i] === '_' && isWordChar(text[i - 1])) return false;
  return true;
}

function findBoldClose(text: string, open: number, ch: string): number {
  const marker = ch + ch;
  for (let j = open + 3; j < text.length - 1; j += 1) {
    if (!text.startsWith(marker, j)) continue;
    if (isSpace(text[j - 1])) continue;
    if (ch === '_' && isWordChar(text[j + 2])) continue;
    // In a run of three ("***word***", bold and italic together) the bold
    // closes on the LAST two, leaving the first to close the italics inside.
    let close = j;
    while (text[close + 2] === ch) close += 1;
    return close;
  }
  return -1;
}

function findItalicClose(text: string, open: number, ch: string): number {
  let j = open + 2;
  while (j < text.length) {
    // A doubled marker inside italics is bold, not the end of the italics.
    if (text[j] === ch && text[j + 1] === ch) {
      j += 2;
      continue;
    }
    if (text[j] === ch && !isSpace(text[j - 1]) && !(ch === '_' && isWordChar(text[j + 1]))) {
      return j;
    }
    j += 1;
  }
  return -1;
}

/** `[label](url)`, with balanced parentheses in the url (Wikipedia has them). */
function matchLink(text: string, open: number): { label: string; url: string; end: number } | null {
  const closeLabel = text.indexOf(']', open + 1);
  if (closeLabel <= open + 1 || text[closeLabel + 1] !== '(') return null;

  let depth = 0;
  for (let j = closeLabel + 1; j < text.length; j += 1) {
    if (text[j] === '(') depth += 1;
    else if (text[j] === ')') {
      depth -= 1;
      if (depth === 0) {
        const url = text.slice(closeLabel + 2, j).trim();
        if (!url) return null;
        return { label: text.slice(open + 1, closeLabel), url, end: j + 1 };
      }
    }
  }
  return null;
}

function atWordStart(text: string, i: number): boolean {
  return i === 0 || /[\s(]/.test(text[i - 1]);
}

/** "see https://a.b." - the full stop ends the sentence, not the address. */
function trimTrailingPunctuation(url: string): string {
  let end = url.length;
  while (end > 0) {
    const ch = url[end - 1];
    if ('.,;:!?\'"'.includes(ch)) {
      end -= 1;
    } else if (ch === ')') {
      const slice = url.slice(0, end);
      const opens = slice.split('(').length - 1;
      const closes = slice.split(')').length - 1;
      if (closes > opens) end -= 1;
      else break;
    } else {
      break;
    }
  }
  return url.slice(0, end);
}

function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const span of spans) {
    const last = out[out.length - 1];
    if (
      last &&
      last.bold === span.bold &&
      last.italic === span.italic &&
      last.href === span.href
    ) {
      last.text += span.text;
    } else {
      out.push({ ...span });
    }
  }
  return out;
}

/**
 * The address a link may open, or null.
 *
 * Web and mail only. The website renders links as real anchors, and a
 * `javascript:` address there would run in the page the moment it was
 * clicked - so anything that is not plainly a web or mail address is shown as
 * words, never as a link.
 */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\/\S/i.test(trimmed)) return trimmed;
  if (/^mailto:\S/i.test(trimmed)) return trimmed;
  if (/^www\.\S/i.test(trimmed)) return `https://${trimmed}`;
  return null;
}

/* WHOLE-BODY HELPERS ------------------------------------------------------- */

/**
 * The body without its syntax, one line per source line - for card previews,
 * where "**Book** the [train](https://...)" should read "Book the train".
 */
export function stripMarkdown(body: string): string {
  return parseMarkdown(body)
    .map((block) => (block.kind === 'blank' ? '' : block.spans.map((s) => s.text).join('')))
    .join('\n');
}

const TOGGLE = /^(\s*(?:[-*+]\s+)?\[)( |x|X)?(\](?:\s.*)?)$/;

/**
 * Tick or untick the box on one line, returning the new body.
 *
 * Changes the one character inside the brackets and nothing else, so the
 * rest of what was typed (indentation, the dash, the words) survives byte for
 * byte. A line that is not a task, or does not exist, returns the body as it
 * was: a stale tap must never rewrite some other line.
 */
export function toggleTask(body: string, line: number): string {
  const lines = body.split('\n');
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return body;

  const raw = lines[line];
  const cr = raw.endsWith('\r') ? '\r' : '';
  const match = TOGGLE.exec(cr ? raw.slice(0, -1) : raw);
  if (!match) return body;

  const checked = match[2] === 'x' || match[2] === 'X';
  lines[line] = `${match[1]}${checked ? ' ' : 'x'}${match[3]}${cr}`;
  return lines.join('\n');
}

/**
 * A tick on one line as a change that can be taken back on its own (see
 * Change in types.ts). Each way it swaps that one line, and only while the
 * line still reads exactly as the other way left it: text typed on other lines
 * since is kept, and a line edited since is left as it now is. Null when the
 * line is not a box.
 */
export function taskChange(body: string, line: number): Change<string> | null {
  const next = toggleTask(body, line);
  if (next === body) return null;
  const before = body.split('\n')[line];
  const after = next.split('\n')[line];
  const swap = (from: string, to: string) => (text: string) => {
    const lines = text.split('\n');
    if (lines[line] !== from) return text;
    lines[line] = to;
    return lines.join('\n');
  };
  return { apply: swap(before, after), revert: swap(after, before) };
}

/** Ticked and total boxes in a body - the "2 of 5" a card shows for a note with tasks. */
export function taskProgress(body: string): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const block of parseMarkdown(body)) {
    if (block.kind !== 'task') continue;
    total += 1;
    if (block.checked) done += 1;
  }
  return { done, total };
}
