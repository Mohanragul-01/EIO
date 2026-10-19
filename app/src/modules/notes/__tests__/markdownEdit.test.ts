/**
 * Editing helpers behind the formatting bar and the Enter key.
 *
 * Each takes the text and the selection and returns both, so the input can be
 * set in one go. The behaviour pinned here is what a phone keyboard user
 * notices: Enter carries a list on (with the next number, with a fresh empty
 * box) and Enter on an empty item ends the list instead of leaving a stray
 * dash; a bar button applied twice undoes itself.
 */
import {
  continueList,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
  type Selection,
} from '../markdownEdit';
import { parseInline } from '../markdown';

/** Text with a | marking a collapsed caret, or [ ] marking a selection. */
function at(marked: string): { text: string; selection: Selection } {
  if (marked.includes('|')) {
    const caret = marked.indexOf('|');
    return { text: marked.replace('|', ''), selection: { start: caret, end: caret } };
  }
  const start = marked.indexOf('«');
  const end = marked.indexOf('»') - 1;
  return { text: marked.replace('«', '').replace('»', ''), selection: { start, end } };
}

/** The reverse: render a result with its caret or selection marked. */
function show(result: { text: string; selection: Selection } | null): string | null {
  if (!result) return null;
  const { text, selection } = result;
  if (selection.start === selection.end) {
    return text.slice(0, selection.start) + '|' + text.slice(selection.start);
  }
  return (
    text.slice(0, selection.start) +
    '«' +
    text.slice(selection.start, selection.end) +
    '»' +
    text.slice(selection.end)
  );
}

/** Simulate pressing Enter at the caret: what onChangeText would hand us. */
function pressEnter(marked: string) {
  const { text, selection } = at(marked);
  const next = text.slice(0, selection.start) + '\n' + text.slice(selection.end);
  return show(continueList(text, next, selection.start));
}

describe('continueList', () => {
  it('continues a bullet with the same marker', () => {
    expect(pressEnter('- milk|')).toBe('- milk\n- |');
    expect(pressEnter('* milk|')).toBe('* milk\n* |');
  });

  it('continues a numbered list with the next number and the same delimiter', () => {
    expect(pressEnter('1. one|')).toBe('1. one\n2. |');
    expect(pressEnter('9) nine|')).toBe('9) nine\n10) |');
  });

  it('continues a task with a fresh, unticked box', () => {
    expect(pressEnter('- [x] packed|')).toBe('- [x] packed\n- [ ] |');
    expect(pressEnter('[] typed|')).toBe('[] typed\n[ ] |');
  });

  it('continues a quote', () => {
    expect(pressEnter('> a line|')).toBe('> a line\n> |');
  });

  it('keeps the indentation of a nested item', () => {
    expect(pressEnter('- top\n  - nested|')).toBe('- top\n  - nested\n  - |');
  });

  it('ends the list when Enter is pressed on an empty item', () => {
    expect(pressEnter('- milk\n- |')).toBe('- milk\n|');
    expect(pressEnter('1. one\n2. |')).toBe('1. one\n|');
    expect(pressEnter('- [ ] a\n- [ ] |')).toBe('- [ ] a\n|');
  });

  it('carries the rest of the line onto the new item when Enter splits it', () => {
    expect(pressEnter('- milk and| eggs')).toBe('- milk and\n- | eggs');
  });

  it('does nothing special for plain lines or a caret before the marker', () => {
    expect(pressEnter('just text|')).toBeNull();
    expect(pressEnter('|- milk')).toBeNull();
  });

  it('ignores changes that are not a single new line', () => {
    expect(continueList('- a', '- ab', 3)).toBeNull();
    expect(continueList('- a', '- a\n\n', 3)).toBeNull();
    expect(continueList('- a', '', 3)).toBeNull();
  });

  it('finds where Enter went even without a caret to go on', () => {
    expect(show(continueList('- a', '- a\n', undefined))).toBe('- a\n- |');
  });

  it('trusts the caret when the new line is ambiguous', () => {
    // "- a\n- b": Enter at the end of "- a" and at the start of "- b" give the
    // same text. Only the caret says which line to continue.
    const prev = '- a\n- b';
    const next = '- a\n\n- b';
    expect(show(continueList(prev, next, 3))).toBe('- a\n- |\n- b');
    expect(continueList(prev, next, 4)).toBeNull();
  });
});

describe('toggleLinePrefix', () => {
  it('adds a checkbox to the caret line, keeping the caret on its word', () => {
    const { text, selection } = at('milk|');
    expect(show(toggleLinePrefix(text, selection, 'task'))).toBe('- [ ] milk|');
  });

  it('removes it when the line already has one', () => {
    const { text, selection } = at('- [x] mi|lk');
    expect(show(toggleLinePrefix(text, selection, 'task'))).toBe('mi|lk');
  });

  it('swaps one kind of list for another', () => {
    const { text, selection } = at('- milk|');
    expect(show(toggleLinePrefix(text, selection, 'task'))).toBe('- [ ] milk|');
  });

  it('applies to every selected line, numbering in order', () => {
    const { text, selection } = at('«one\ntwo\nthree»');
    expect(toggleLinePrefix(text, selection, 'numbered').text).toBe('1. one\n2. two\n3. three');
    expect(toggleLinePrefix(text, selection, 'bullet').text).toBe('- one\n- two\n- three');
  });

  it('turns a mixed selection fully on before it turns anything off', () => {
    const { text, selection } = at('«- one\ntwo»');
    expect(toggleLinePrefix(text, selection, 'bullet').text).toBe('- one\n- two');
  });

  it('only touches the selected lines', () => {
    const { text, selection } = at('keep\nmi|lk\nkeep');
    expect(toggleLinePrefix(text, selection, 'quote').text).toBe('keep\n> milk\nkeep');
  });

  it('cycles a heading: none, #, ##, none', () => {
    let state = at('Title|');
    const steps: (string | null)[] = [];
    for (let i = 0; i < 3; i += 1) {
      const next = toggleLinePrefix(state.text, state.selection, 'heading');
      steps.push(show(next));
      state = next;
    }
    expect(steps).toEqual(['# Title|', '## Title|', 'Title|']);
  });

  it('keeps indentation', () => {
    const { text, selection } = at('  nested|');
    expect(toggleLinePrefix(text, selection, 'bullet').text).toBe('  - nested');
  });

  it('puts a caret that sat inside the old marker after the new one', () => {
    const { text, selection } = at('-| milk');
    expect(show(toggleLinePrefix(text, selection, 'task'))).toBe('- [ ] |milk');
  });
});

describe('wrapSelection', () => {
  it('wraps the selected words, keeping them selected', () => {
    const { text, selection } = at('buy «milk» now');
    expect(show(wrapSelection(text, selection, '**'))).toBe('buy **«milk»** now');
  });

  it('keeps a stray space outside the markers so the format still reads', () => {
    // Double-tapping a word on Android often selects its trailing space too,
    // and "**milk **" would not parse as bold.
    const { text, selection } = at('buy «milk »now');
    const result = wrapSelection(text, selection, '**');
    expect(result.text).toBe('buy **milk** now');
    expect(parseInline(result.text)).toContainEqual({ text: 'milk', bold: true });
  });

  it('unwraps when applied again', () => {
    const { text, selection } = at('buy **«milk»** now');
    expect(show(wrapSelection(text, selection, '**'))).toBe('buy «milk» now');
  });

  it('unwraps a selection that includes its markers', () => {
    const { text, selection } = at('buy «*milk*» now');
    expect(show(wrapSelection(text, selection, '*'))).toBe('buy «milk» now');
  });

  it('inserts an empty pair with the caret between, and takes it out again', () => {
    const { text, selection } = at('say |');
    const once = wrapSelection(text, selection, '**');
    expect(show(once)).toBe('say **|**');
    expect(show(wrapSelection(once.text, once.selection, '**'))).toBe('say |');
  });

  it('bold and italic together read as both', () => {
    const { text, selection } = at('«word»');
    const bold = wrapSelection(text, selection, '**');
    const both = wrapSelection(bold.text, bold.selection, '*');
    expect(both.text).toBe('***word***');
    expect(parseInline(both.text)).toEqual([{ text: 'word', bold: true, italic: true }]);
  });
});

describe('insertLink', () => {
  it('makes the selected words the label, with the caret on the address', () => {
    const { text, selection } = at('see «the docs» now');
    expect(show(insertLink(text, selection))).toBe('see [the docs](https://|) now');
  });

  it('makes a selected address the target, with the caret on the label', () => {
    const { text, selection } = at('«https://a.b»');
    expect(show(insertLink(text, selection))).toBe('[|](https://a.b)');
  });

  it('inserts an empty link at the caret, ready for its label', () => {
    const { text, selection } = at('see |');
    expect(show(insertLink(text, selection))).toBe('see [|](https://)');
  });
});
