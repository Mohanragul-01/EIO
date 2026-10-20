/**
 * The Markdown subset notes are read in.
 *
 * Hand-written rather than a library, because the subset is small and both
 * clients must agree on it exactly: a box that ticks on the phone has to be
 * the same line the website ticks. The tests that matter most are the
 * checkbox ones - toggleTask rewrites the note's stored text, so a wrong line
 * index or a mangled prefix would corrupt what the person wrote - and the
 * "stays literal" ones, because plain notes written before v3 must read
 * exactly as they always did.
 */
import {
  parseInline,
  parseMarkdown,
  safeHref,
  stripMarkdown,
  taskChange,
  taskProgress,
  toggleTask,
  type Block,
  type Span,
} from '../markdown';

/** The visible text of a run of spans. */
const textOf = (spans: Span[]) => spans.map((s) => s.text).join('');

describe('parseMarkdown: blocks', () => {
  it('reads headings at three levels, and deeper ones as the third', () => {
    const blocks = parseMarkdown('# One\n## Two\n### Three\n#### Four');
    expect(blocks.map((b) => (b.kind === 'heading' ? b.level : null))).toEqual([1, 2, 3, 3]);
    expect(blocks.map((b) => ('spans' in b ? textOf(b.spans) : ''))).toEqual([
      'One',
      'Two',
      'Three',
      'Four',
    ]);
  });

  it('needs a space after the hashes, so a hashtag stays text', () => {
    expect(parseMarkdown('#idea')[0].kind).toBe('paragraph');
  });

  it('reads bullets with any of - * +', () => {
    const blocks = parseMarkdown('- one\n* two\n+ three');
    expect(blocks.every((b) => b.kind === 'bullet')).toBe(true);
  });

  it('reads numbered items and keeps the number as written', () => {
    const blocks = parseMarkdown('1. first\n2) second\n7. seventh');
    expect(blocks.map((b) => (b.kind === 'numbered' ? b.number : null))).toEqual([1, 2, 7]);
  });

  it('reads tasks, ticked and not, with or without the dash', () => {
    const blocks = parseMarkdown('- [ ] open\n- [x] done\n* [X] also done\n[ ] bare\n[] typed shortcut');
    expect(blocks.map((b) => b.kind)).toEqual(['task', 'task', 'task', 'task', 'task']);
    expect(blocks.map((b) => (b.kind === 'task' ? b.checked : null))).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
    expect(blocks.map((b) => ('spans' in b ? textOf(b.spans) : ''))).toEqual([
      'open',
      'done',
      'also done',
      'bare',
      'typed shortcut',
    ]);
  });

  it('reads an empty task as a box with no text', () => {
    const [block] = parseMarkdown('- [ ]');
    expect(block).toMatchObject({ kind: 'task', checked: false });
    expect(textOf((block as Extract<Block, { kind: 'task' }>).spans)).toBe('');
  });

  it('does not mistake a link at the start of a line for a task', () => {
    expect(parseMarkdown('[x](https://example.com)')[0].kind).toBe('paragraph');
    expect(parseMarkdown('[later] call back')[0].kind).toBe('paragraph');
  });

  it('reads quotes', () => {
    const [block] = parseMarkdown('> worth remembering');
    expect(block.kind).toBe('quote');
    expect(textOf((block as Extract<Block, { kind: 'quote' }>).spans)).toBe('worth remembering');
  });

  it('nests list items by indentation, two spaces a level', () => {
    const blocks = parseMarkdown('- top\n  - nested\n    - [ ] deeper\n\t- tabbed');
    expect(blocks.map((b) => ('depth' in b ? b.depth : null))).toEqual([0, 1, 2, 1]);
  });

  it('keeps each block on its source line, blank lines included', () => {
    const blocks = parseMarkdown('Title line\n\n- [ ] task\r\nlast');
    expect(blocks.map((b) => [b.kind, b.line])).toEqual([
      ['paragraph', 0],
      ['blank', 1],
      ['task', 2],
      ['paragraph', 3],
    ]);
  });

  it('leaves a plain pre-v3 note exactly as written', () => {
    const plain = 'Call the plumber about the tap.\nHe said Tuesday - maybe Wed.';
    const blocks = parseMarkdown(plain);
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'paragraph']);
    expect(blocks.map((b) => ('spans' in b ? textOf(b.spans) : ''))).toEqual(plain.split('\n'));
  });

  it('returns nothing for an empty body', () => {
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('parseInline', () => {
  it('reads bold and italic with either marker', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
    expect(parseInline('__b__')).toEqual([{ text: 'b', bold: true }]);
    expect(parseInline('*i*')).toEqual([{ text: 'i', italic: true }]);
    expect(parseInline('_i_')).toEqual([{ text: 'i', italic: true }]);
  });

  it('nests italic inside bold and bold inside italic', () => {
    expect(parseInline('**bold *both* bold**')).toEqual([
      { text: 'bold ', bold: true },
      { text: 'both', bold: true, italic: true },
      { text: ' bold', bold: true },
    ]);
    expect(parseInline('*it **both** it*')).toEqual([
      { text: 'it ', italic: true },
      { text: 'both', bold: true, italic: true },
      { text: ' it', italic: true },
    ]);
  });

  it('leaves an underscore inside a word alone', () => {
    expect(parseInline('snake_case_name')).toEqual([{ text: 'snake_case_name' }]);
  });

  it('leaves unclosed or spaced markers literal', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ text: '2 * 3 = 6' }]);
    expect(parseInline('**not closed')).toEqual([{ text: '**not closed' }]);
    expect(parseInline('a * b * c')).toEqual([{ text: 'a * b * c' }]);
    expect(parseInline('** spaced **')).toEqual([{ text: '** spaced **' }]);
  });

  it('honours backslash escapes', () => {
    expect(parseInline('\\*not italic\\*')).toEqual([{ text: '*not italic*' }]);
  });

  it('reads a written link', () => {
    expect(parseInline('see [the docs](https://docs.expo.dev) now')).toEqual([
      { text: 'see ' },
      { text: 'the docs', href: 'https://docs.expo.dev' },
      { text: ' now' },
    ]);
  });

  it('formats inside a link', () => {
    expect(parseInline('[**big**](https://a.b)')).toEqual([
      { text: 'big', bold: true, href: 'https://a.b' },
    ]);
  });

  it('turns bare addresses into links, leaving trailing punctuation outside', () => {
    expect(parseInline('go to https://example.com/a?b=1.')).toEqual([
      { text: 'go to ' },
      { text: 'https://example.com/a?b=1', href: 'https://example.com/a?b=1' },
      { text: '.' },
    ]);
    expect(parseInline('www.example.com')).toEqual([
      { text: 'www.example.com', href: 'https://www.example.com' },
    ]);
  });

  it('refuses links that could run code, showing just the words', () => {
    expect(parseInline('[click](javascript:alert(1))')).toEqual([{ text: 'click' }]);
  });
});

describe('safeHref', () => {
  it('allows web and mail addresses only', () => {
    expect(safeHref('https://a.b')).toBe('https://a.b');
    expect(safeHref('http://a.b')).toBe('http://a.b');
    expect(safeHref('mailto:me@a.b')).toBe('mailto:me@a.b');
    expect(safeHref('www.a.b')).toBe('https://www.a.b');
    expect(safeHref('  https://a.b  ')).toBe('https://a.b');
  });

  it('refuses everything else', () => {
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('JavaScript:alert(1)')).toBeNull();
    expect(safeHref('data:text/html,hi')).toBeNull();
    expect(safeHref('notes/other')).toBeNull();
    expect(safeHref('')).toBeNull();
  });
});

describe('stripMarkdown', () => {
  it('drops the syntax and keeps the words, line by line', () => {
    const body = '# Trip\n- [ ] book **trains**\n- [x] pack\n1. *passport*\n> see [map](https://m.ap)\n\nend';
    expect(stripMarkdown(body)).toBe('Trip\nbook trains\npack\npassport\nsee map\n\nend');
  });

  it('leaves plain text untouched', () => {
    expect(stripMarkdown('Just a thought, 2 * 3.')).toBe('Just a thought, 2 * 3.');
  });
});

describe('toggleTask', () => {
  const body = 'Packing\n- [ ] passport\n  - [x] charger\n[] adapter\nnot a task';

  it('ticks and unticks exactly the line asked for', () => {
    expect(toggleTask(body, 1)).toBe('Packing\n- [x] passport\n  - [x] charger\n[] adapter\nnot a task');
    expect(toggleTask(body, 2)).toBe('Packing\n- [ ] passport\n  - [ ] charger\n[] adapter\nnot a task');
  });

  it('fills the typed shortcut box', () => {
    expect(toggleTask(body, 3)).toBe('Packing\n- [ ] passport\n  - [x] charger\n[x] adapter\nnot a task');
  });

  it('round-trips: two toggles restore the original', () => {
    expect(toggleTask(toggleTask(body, 1), 1)).toBe(body);
    expect(toggleTask(toggleTask(body, 2), 2)).toBe(body);
  });

  it('leaves the body alone for a line that is not a task, or does not exist', () => {
    expect(toggleTask(body, 0)).toBe(body);
    expect(toggleTask(body, 4)).toBe(body);
    expect(toggleTask(body, 99)).toBe(body);
    expect(toggleTask(body, -1)).toBe(body);
  });

  it('agrees with parseMarkdown about which line a box is on', () => {
    const tasks = parseMarkdown(body).filter((b) => b.kind === 'task');
    tasks.forEach((task) => {
      const flipped = parseMarkdown(toggleTask(body, task.line)).find((b) => b.line === task.line);
      expect(flipped).toMatchObject({ kind: 'task', checked: !(task as { checked: boolean }).checked });
    });
  });

  it('keeps Windows line endings', () => {
    expect(toggleTask('- [ ] a\r\n- [ ] b', 0)).toBe('- [x] a\r\n- [ ] b');
  });
});

describe('taskProgress', () => {
  it('counts boxes in a note', () => {
    expect(taskProgress('- [x] a\n- [ ] b\n[x] c\nplain')).toEqual({ done: 2, total: 3 });
    expect(taskProgress('no boxes')).toEqual({ done: 0, total: 0 });
  });
});

describe('taskChange', () => {
  it('reverts its own tick and keeps what was typed on other lines since', () => {
    const tick = taskChange('- [ ] passport', 0)!;
    expect(tick.apply('- [ ] passport')).toBe('- [x] passport');
    expect(tick.revert('- [x] passport\n\nTwo paragraphs.')).toBe(
      '- [ ] passport\n\nTwo paragraphs.',
    );
  });

  it('leaves a line that has been edited since', () => {
    const tick = taskChange('- [ ] passport', 0)!;
    expect(tick.revert('- [x] passport and visa')).toBe('- [x] passport and visa');
    expect(tick.revert('- [ ] passport')).toBe('- [ ] passport');
  });

  it('is null for a line that is not a box', () => {
    expect(taskChange('plain', 0)).toBeNull();
  });
});
