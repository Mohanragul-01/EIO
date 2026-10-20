/**
 * NoteEditScreen: what you typed or ticked is what the note keeps.
 *
 * Rendered whole, with navigation and api.ts mocked, because each bug here
 * lived in how the screen's pieces meet: a draft line the Save never saw,
 * and (below) read-mode ticks whose writes and rollbacks met text typed in
 * edit mode afterwards.
 */
import 'react-native-gesture-handler/jestSetup';

import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

import { ToastProvider } from '../../../core/components';
import { ThemeProvider } from '../../../core/ThemeContext';
import { onNotesChanged } from '../notesEvents';
import { NoteEditScreen } from '../screens/NoteEditScreen';
import type { ChecklistItem, Note } from '../types';

jest.mock('react-native-keyboard-controller', () =>
  require('react-native-keyboard-controller/jest'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// The icon font pulls in the asset system, which has nothing to load here.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

type Listener = (event: { preventDefault: () => void; data: { action: unknown } }) => void;

const mockNavigation = {
  setOptions: jest.fn(),
  addListener: jest.fn((_event: string, _listener: Listener) => () => {}),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};
let mockParams: Record<string, unknown> = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('../api', () => ({
  getNote: jest.fn(),
  createNote: jest.fn(() => Promise.resolve({})),
  updateNote: jest.fn(() => Promise.resolve({})),
  setChecklistItems: jest.fn(() => Promise.resolve()),
  setBody: jest.fn(() => Promise.resolve()),
}));
const api = jest.requireMock('../api') as Record<string, jest.Mock>;

async function open(params: Record<string, unknown>) {
  mockParams = params;
  await render(
    <ThemeProvider>
      <ToastProvider>
        <NoteEditScreen />
      </ToastProvider>
    </ThemeProvider>,
  );
}

/** The back gesture, as the screen's discard guard sees it. */
function leave() {
  const calls = mockNavigation.addListener.mock.calls.filter(([event]) => event === 'beforeRemove');
  const listener = calls[calls.length - 1][1];
  const event = { preventDefault: jest.fn(), data: { action: { type: 'GO_BACK' } } };
  listener(event);
  return event;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset, not just cleared: a write a test left unsent must not leak into the next.
  api.setChecklistItems.mockReset().mockResolvedValue(undefined);
  api.setBody.mockReset().mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

function note(overrides: Partial<Note>): Note {
  return {
    id: 'n1',
    user_id: 'u',
    title: 'Trip',
    body: '',
    tags: [],
    note_type: 'note',
    is_inbox: false,
    entry_date: null,
    checklist_items: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    deleted_at: null,
    pinned_at: null,
    archived_at: null,
    color: null,
    ...overrides,
  };
}

const checklist = (items: ChecklistItem[]) =>
  note({ note_type: 'checklist', title: 'Shop', checklist_items: items });

/** Open an existing note, in read mode, once it has loaded. */
async function openNote(row: Note) {
  api.getNote.mockResolvedValue(row);
  await open({ id: row.id });
  await act(async () => {});
}

/** Press the header's Edit, which the screen hands to navigation. */
async function startEditing() {
  const calls = mockNavigation.setOptions.mock.calls;
  const header = calls[calls.length - 1][0].headerRight() as React.ReactElement<{
    children: React.ReactNode;
  }>;
  const edit = React.Children.toArray(header.props.children).find(
    (child) =>
      React.isValidElement<{ accessibilityLabel?: string }>(child) &&
      child.props.accessibilityLabel === 'Edit this note',
  ) as React.ReactElement<{ onPress: () => void }>;
  await act(async () => edit.props.onPress());
}

/** A write the test settles by hand. */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const progress = () => screen.getByText(/ of \d+ done/).props.children.join('');

describe('a checklist line typed into "Add an item" but not added', () => {
  it('is saved by Save', async () => {
    await open({ type: 'checklist' });
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), ' eggs ');
    await fireEvent.press(screen.getByText('Save'));

    expect(api.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ checklist_items: [{ text: 'eggs', done: false }] }),
    );
  });

  it('is added after the items already there', async () => {
    await open({ type: 'checklist' });
    const add = screen.getByPlaceholderText('Add an item');
    await fireEvent.changeText(add, 'milk');
    await fireEvent(add, 'submitEditing');
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');
    await fireEvent.press(screen.getByText('Save'));

    expect(api.createNote).toHaveBeenCalledWith(
      expect.objectContaining({
        checklist_items: [
          { text: 'milk', done: false },
          { text: 'eggs', done: false },
        ],
      }),
    );
  });

  it('counts as a change, so leaving asks first', async () => {
    await open({ type: 'checklist' });
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');

    const event = leave();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Discard this?',
      expect.any(String),
      expect.any(Array),
    );
  });
});

describe('a read-mode tick that fails', () => {
  it('takes back only that tick, not the paragraphs typed in edit mode since', async () => {
    await openNote(note({ body: '- [ ] passport' }));
    const write = deferred();
    api.setBody.mockReturnValueOnce(write.promise);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'passport' }));
    await startEditing();
    const typed = '- [x] passport\n\nTwo paragraphs about the trip.';
    await fireEvent.changeText(screen.getByLabelText('Note'), typed);

    await act(async () => write.reject(new Error('offline')));

    expect(screen.getByLabelText('Note').props.value).toBe(
      '- [ ] passport\n\nTwo paragraphs about the trip.',
    );
  });

  it('on a checklist, takes back only that tick, not the items added in edit mode since', async () => {
    await openNote(checklist([{ text: 'milk', done: false }]));
    const write = deferred();
    api.setChecklistItems.mockReturnValueOnce(write.promise);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'milk' }));
    await startEditing();
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');
    await fireEvent(screen.getByPlaceholderText('Add an item'), 'submitEditing');

    await act(async () => write.reject(new Error('offline')));

    expect(screen.getByDisplayValue('eggs')).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: 'milk' }).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
  });
});

describe('Undo of Uncheck all, pressed after starting to edit', () => {
  it('ticks the items again without losing what was added, and writes no edit', async () => {
    await openNote(
      checklist([
        { text: 'milk', done: true },
        { text: 'bread', done: true },
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Uncheck all' }));
    expect(api.setChecklistItems).toHaveBeenLastCalledWith('n1', [
      { text: 'milk', done: false },
      { text: 'bread', done: false },
    ]);

    await startEditing();
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');
    await fireEvent(screen.getByPlaceholderText('Add an item'), 'submitEditing');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await act(async () => {});

    expect(screen.getByDisplayValue('eggs')).toBeTruthy();
    for (const name of ['milk', 'bread']) {
      expect(screen.getByRole('checkbox', { name }).props.accessibilityState).toEqual(
        expect.objectContaining({ checked: true }),
      );
    }
    // The database gets the Undo, and not the unsaved edit.
    expect(api.setChecklistItems).toHaveBeenLastCalledWith('n1', [
      { text: 'milk', done: true },
      { text: 'bread', done: true },
    ]);
  });
});

describe('quick ticks on a weak signal', () => {
  it('sends one write at a time, each with every tick made so far', async () => {
    await openNote(
      checklist([
        { text: 'milk', done: false },
        { text: 'bread', done: false },
      ]),
    );
    const first = deferred();
    api.setChecklistItems.mockReturnValueOnce(first.promise);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'milk' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'bread' }));
    // The second waits for the first, so the two cannot land the wrong way round.
    expect(api.setChecklistItems).toHaveBeenCalledTimes(1);

    await act(async () => first.resolve());
    expect(api.setChecklistItems).toHaveBeenCalledTimes(2);
    expect(api.setChecklistItems).toHaveBeenLastCalledWith('n1', [
      { text: 'milk', done: true },
      { text: 'bread', done: true },
    ]);
    expect(progress()).toMatch(/^2 of 2 done/);
  });

  it('a first tick that fails is taken back alone, and the next write leaves it out', async () => {
    await openNote(
      checklist([
        { text: 'milk', done: false },
        { text: 'bread', done: false },
      ]),
    );
    const first = deferred();
    api.setChecklistItems.mockReturnValueOnce(first.promise);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'milk' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'bread' }));
    await act(async () => first.reject(new Error('offline')));

    expect(progress()).toMatch(/^1 of 2 done/);
    expect(screen.getByRole('checkbox', { name: 'milk' })).toBeTruthy(); // still open
    expect(api.setChecklistItems).toHaveBeenLastCalledWith('n1', [
      { text: 'milk', done: false },
      { text: 'bread', done: true },
    ]);
    expect(screen.getByText('offline')).toBeTruthy();
  });

  it('a tick that fails after you have left tells the list to look again', async () => {
    const listener = jest.fn();
    const stop = onNotesChanged(listener);
    await openNote(checklist([{ text: 'milk', done: false }]));
    const write = deferred();
    api.setChecklistItems.mockReturnValueOnce(write.promise);

    await fireEvent.press(screen.getByRole('checkbox', { name: 'milk' }));
    await screen.unmount();
    await act(async () => write.reject(new Error('offline')));

    expect(listener).toHaveBeenCalled();
    stop();
  });
});

describe('Save after ticks', () => {
  it('waits for a tick still being written, so the tick cannot land on top of it', async () => {
    await openNote(note({ body: '- [ ] passport' }));
    const order: string[] = [];
    const write = deferred();
    api.setBody.mockReturnValueOnce(write.promise);
    api.updateNote.mockImplementationOnce(() => {
      order.push('save sent');
      return Promise.resolve({});
    });

    await fireEvent.press(screen.getByRole('checkbox', { name: 'passport' }));
    await startEditing();
    await fireEvent.changeText(screen.getByLabelText('Note'), '- [x] passport\n\nAnd a visa.');
    // The tick is still on its way when Save is pressed, and lands a moment later.
    setTimeout(() => {
      order.push('tick landed');
      write.resolve();
    }, 30);
    await fireEvent.press(screen.getByText('Save changes'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)));

    expect(order).toEqual(['tick landed', 'save sent']);
    expect(api.updateNote).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ body: '- [x] passport\n\nAnd a visa.' }),
    );
    expect(mockNavigation.goBack).toHaveBeenCalled();
  });

  it('an Undo pressed after Save builds on what was saved', async () => {
    await openNote(
      checklist([
        { text: 'milk', done: true },
        { text: 'bread', done: true },
      ]),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Uncheck all' }));
    await startEditing();
    await fireEvent.changeText(screen.getByPlaceholderText('Add an item'), 'eggs');
    await fireEvent.press(screen.getByText('Save changes'));
    expect(api.updateNote).toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await act(async () => {});

    expect(api.setChecklistItems).toHaveBeenLastCalledWith('n1', [
      { text: 'milk', done: true },
      { text: 'bread', done: true },
      { text: 'eggs', done: false },
    ]);
  });
});
